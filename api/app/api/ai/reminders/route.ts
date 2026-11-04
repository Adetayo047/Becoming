import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getOpenAI, AI_MODEL, PERSONALITY_TONE } from '@/app/lib/openai';
import { ok, unauthorized, serverError } from '@/app/lib/response';
import { addDaysKey, todayKey, DATE_KEY } from '@/app/lib/dates';

type Nudge = { taskId: string; title: string; time: string; goal: string | null; deepWork: boolean; line: string };

// One-line "why this matters" per task, per day — regenerated only when the
// task list changes.
const cache = new Map<string, Record<string, string>>();

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Smart Reminders (Stitch: ai_insight_smart_reminders): today's upcoming
// scheduled tasks with a short goal-linked nudge each, a schedule tip when the
// first deep-work block sits outside the user's real peak window, and routine
// stats. ?date=YYYY-MM-DD & ?tz=<minutes east of UTC>.
export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const params = new URL(req.url).searchParams;
    const today = DATE_KEY.test(params.get('date') ?? '') ? params.get('date')! : todayKey();
    const tz = Math.max(-720, Math.min(840, Number(params.get('tz')) || 0));
    const nowLocal = new Date(Date.now() + tz * 60000);
    const nowMinutes = nowLocal.getUTCHours() * 60 + nowLocal.getUTCMinutes();

    const [user, todayTasks, recent, streak] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId }, select: { aiPersonality: true } }),
      prisma.dailyTask.findMany({
        where: { userId: payload.userId, date: new Date(today + 'T12:00:00Z') },
        include: { goal: { select: { title: true } } },
        orderBy: [{ scheduledStart: 'asc' }, { order: 'asc' }],
      }),
      prisma.dailyTask.findMany({
        where: { userId: payload.userId, date: { gte: new Date(addDaysKey(today, -29) + 'T00:00:00Z'), lte: new Date(today + 'T23:59:59Z') } },
        select: { date: true, completed: true, completedAt: true, scheduledStart: true },
      }),
      prisma.habitStreak.findFirst({ where: { userId: payload.userId }, orderBy: { currentStreak: 'desc' }, select: { currentStreak: true } }),
    ]);
    if (!user) return unauthorized();

    // Real peak: the 3-hour window with the most completions in 30 days —
    // same fixed windows as Premium Insights so the two screens agree.
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const t of recent) {
      if (t.completedAt) hourly[new Date(t.completedAt.getTime() + tz * 60000).getUTCHours()]++;
    }
    let peakStart: number | null = null;
    let peakCount = 0;
    for (const h of [6, 9, 12, 15, 18, 21]) {
      const c = hourly[h] + hourly[h + 1] + hourly[(h + 2) % 24];
      if (c > peakCount) { peakCount = c; peakStart = h; }
    }
    const peakLabel = peakStart !== null ? `${String(peakStart).padStart(2, '0')}:00–${String(peakStart + 3).padStart(2, '0')}:00` : null;

    // Routine integrity: share of scheduled tasks completed over the last 7 days.
    const weekAgo = addDaysKey(today, -6);
    const scheduledWeek = recent.filter((t) => t.scheduledStart && t.date.toISOString().slice(0, 10) >= weekAgo);
    const routineIntegrity = scheduledWeek.length ? Math.round((scheduledWeek.filter((t) => t.completed).length / scheduledWeek.length) * 100) : null;

    // Schedule tip: first deep-work block outside the peak window (needs ≥3 data points).
    const deep = todayTasks.find((t) => !t.completed && t.scheduledStart && (t.blockType === 'deep_work' || !t.blockType));
    let insight: { title: string; body: string } | null = null;
    if (deep?.scheduledStart && peakStart !== null && peakCount >= 3) {
      const start = toMinutes(deep.scheduledStart);
      if (start < peakStart * 60 || start >= (peakStart + 3) * 60) {
        insight = {
          title: 'Energy Optimization',
          body: `You finish most tasks between ${peakLabel}, but "${deep.title}" is scheduled at ${deep.scheduledStart}. Move it into your peak window to make it easier.`,
        };
      }
    }

    const upcoming = todayTasks.filter((t) => !t.completed && t.scheduledStart && toMinutes(t.scheduledEnd ?? t.scheduledStart) >= nowMinutes && t.blockType !== 'break');
    const lines = await nudgeLines(payload.userId, today, user.aiPersonality, upcoming.map((t) => ({ id: t.id, title: t.title, goal: t.goal?.title ?? null })));

    const nudges: Nudge[] = upcoming.slice(0, 5).map((t) => ({
      taskId: t.id,
      title: t.title,
      time: t.scheduledStart!,
      goal: t.goal?.title ?? null,
      deepWork: t.blockType === 'deep_work',
      line: lines[t.id] ?? (t.goal ? `This moves "${t.goal.title}" forward.` : 'One focused block keeps your momentum alive.'),
    }));

    return ok({
      insight,
      peakWindow: peakLabel,
      nudges,
      unscheduled: todayTasks.filter((t) => !t.completed && !t.scheduledStart).length,
      stats: { routineIntegrity, streak: streak?.currentStreak ?? 0 },
    });
  } catch (e) {
    return serverError(e);
  }
}

async function nudgeLines(
  userId: string,
  today: string,
  personality: keyof typeof PERSONALITY_TONE,
  tasks: { id: string; title: string; goal: string | null }[]
): Promise<Record<string, string>> {
  if (tasks.length === 0) return {};
  const key = [userId, today, personality, ...tasks.map((t) => t.id)].join('|');
  const cached = cache.get(key);
  if (cached) return cached;

  const openai = getOpenAI();
  if (!openai) return {};
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'For each upcoming task, write ONE short reminder line (max 22 words) that connects the task to the goal it serves. ' +
            'No emojis, no quotation marks. Respond with JSON {"lines":{"<task id>":"<line>"}}. ' +
            PERSONALITY_TONE[personality],
        },
        { role: 'user', content: JSON.stringify(tasks) },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as { lines?: Record<string, unknown> };
    const lines: Record<string, string> = {};
    for (const t of tasks) {
      const l = parsed.lines?.[t.id];
      if (typeof l === 'string' && l.trim()) lines[t.id] = l.trim();
    }
    if (cache.size > 2000) cache.clear();
    cache.set(key, lines);
    return lines;
  } catch (e) {
    console.error('reminder lines AI failed', e);
    return {};
  }
}
