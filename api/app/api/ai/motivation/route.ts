import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getOpenAI, AI_MODEL, PERSONALITY_TONE } from '@/app/lib/openai';
import { ok, unauthorized, serverError } from '@/app/lib/response';
import { addDaysKey, todayKey, DATE_KEY } from '@/app/lib/dates';

type Situation = 'no_goals' | 'comeback' | 'all_done' | 'in_progress' | 'not_started' | 'no_tasks';

type Snapshot = {
  firstName: string;
  goal: { title: string; percent: number; yearly?: string; monthly?: string } | null;
  goalCount: number;
  todayDone: number;
  todayTotal: number;
  weekDone: number;
  weekTotal: number;
  streak: number;
  daysSinceLastWin: number | null;
  situation: Situation;
};

// One line per user per day *per state* — it only changes when their progress
// does (a task ticked, a streak moved), so pulling to refresh doesn't spend an
// AI call. In-memory is enough: a restart just regenerates it.
const cache = new Map<string, string>();

function situationOf(s: Omit<Snapshot, 'situation'>): Situation {
  if (s.goalCount === 0) return 'no_goals';
  if (s.daysSinceLastWin !== null && s.daysSinceLastWin >= 3 && s.todayDone === 0) return 'comeback';
  if (s.todayTotal === 0) return 'no_tasks';
  if (s.todayDone === s.todayTotal) return 'all_done';
  if (s.todayDone > 0) return 'in_progress';
  return 'not_started';
}

// Used when AI isn't configured or fails — still built from the user's real
// numbers so it never falls back to a one-size-fits-all quote.
function fallback(s: Snapshot): string {
  const goal = s.goal?.title ?? 'your goal';
  switch (s.situation) {
    case 'no_goals':
      return 'Every version of you starts with one decision. Set your first goal today.';
    case 'comeback':
      return `It's been ${s.daysSinceLastWin} days, ${s.firstName}. One small action today restarts "${goal}".`;
    case 'no_tasks':
      return `"${goal}" moves when you do. Pick one action for today.`;
    case 'all_done':
      return s.streak > 1
        ? `All ${s.todayTotal} done and a ${s.streak}-day streak. This is who you're becoming.`
        : `All ${s.todayTotal} done today. "${goal}" just got closer.`;
    case 'in_progress':
      return `${s.todayDone} of ${s.todayTotal} done. Finish strong — ${s.todayTotal - s.todayDone} to go.`;
    case 'not_started':
      return s.streak > 0
        ? `Your ${s.streak}-day streak is waiting. Start with the smallest task.`
        : `${s.todayTotal} action${s.todayTotal === 1 ? '' : 's'} between you and a better tomorrow. Start with one.`;
  }
}

// GET /api/ai/motivation?date=YYYY-MM-DD (the user's local today) — a one-line
// motivation written for this user's goal and how they're actually doing.
export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const param = new URL(req.url).searchParams.get('date');
    const today = param && DATE_KEY.test(param) ? param : todayKey();
    const weekAgo = addDaysKey(today, -6);

    const [user, goals, recentTasks, topStreak, lastWin] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId }, select: { fullName: true, aiPersonality: true } }),
      prisma.goal.findMany({
        where: { userId: payload.userId, status: 'active' },
        include: {
          milestones: { select: { status: true } },
          yearlyTargets: { where: { year: Number(today.slice(0, 4)) }, take: 1 },
          monthlyTargets: { where: { month: today.slice(0, 7) }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dailyTask.findMany({
        where: { userId: payload.userId, date: { gte: new Date(weekAgo + 'T00:00:00Z'), lte: new Date(today + 'T23:59:59Z') } },
        select: { date: true, completed: true },
      }),
      prisma.habitStreak.findFirst({ where: { userId: payload.userId }, orderBy: { currentStreak: 'desc' }, select: { currentStreak: true } }),
      prisma.dailyTask.findFirst({
        where: { userId: payload.userId, completed: true, date: { lte: new Date(today + 'T23:59:59Z') } },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ]);
    if (!user) return unauthorized();

    // The goal with the most left to do is the one that needs the push.
    const ranked = goals
      .map((g) => {
        const done = g.milestones.filter((m) => m.status === 'completed').length;
        return { g, percent: g.milestones.length ? Math.round((done / g.milestones.length) * 100) : 0 };
      })
      .sort((a, b) => a.percent - b.percent);
    const focus = ranked[0];

    const todayTasks = recentTasks.filter((t) => t.date.toISOString().slice(0, 10) === today);
    const base = {
      firstName: user.fullName.split(' ')[0] || 'friend',
      goal: focus
        ? { title: focus.g.title, percent: focus.percent, yearly: focus.g.yearlyTargets[0]?.title, monthly: focus.g.monthlyTargets[0]?.title }
        : null,
      goalCount: goals.length,
      todayDone: todayTasks.filter((t) => t.completed).length,
      todayTotal: todayTasks.length,
      weekDone: recentTasks.filter((t) => t.completed).length,
      weekTotal: recentTasks.length,
      streak: topStreak?.currentStreak ?? 0,
      daysSinceLastWin: lastWin
        ? Math.round((Date.parse(today) - Date.parse(lastWin.date.toISOString().slice(0, 10))) / 86400000)
        : null,
    };
    const snap: Snapshot = { ...base, situation: situationOf(base) };

    const key = [payload.userId, today, user.aiPersonality, snap.situation, snap.todayDone, snap.todayTotal, snap.streak, snap.goal?.title].join('|');
    const cached = cache.get(key);
    if (cached) return ok({ message: cached, situation: snap.situation, source: 'ai' });

    const openai = getOpenAI();
    if (openai && snap.situation !== 'no_goals') {
      try {
        const completion = await openai.chat.completions.create({
          model: AI_MODEL,
          max_tokens: 80,
          temperature: 0.9,
          messages: [
            {
              role: 'system',
              content:
                'You write the one-line daily motivation on the home screen of a goal-achievement app. ' +
                'Write ONE or TWO short sentences, max 25 words total, specific to the person\'s goal and ' +
                'how they are doing today — refer to a real detail (their goal, their numbers, their streak, ' +
                'their plan). If they are behind, be honest but never shaming; give the next tiny step. ' +
                'If they are doing well, name it. No quotation marks, no hashtags, no emojis, not a famous quote. ' +
                PERSONALITY_TONE[user.aiPersonality],
            },
            {
              role: 'user',
              content: [
                `Name: ${snap.firstName}`,
                `Situation: ${snap.situation}`,
                snap.goal && `Main goal: "${snap.goal.title}" (${snap.goal.percent}% of milestones done)`,
                snap.goal?.yearly && `This year's outcome: "${snap.goal.yearly}"`,
                snap.goal?.monthly && `This month's focus: "${snap.goal.monthly}"`,
                `Today: ${snap.todayDone} of ${snap.todayTotal} tasks done`,
                `Last 7 days: ${snap.weekDone} of ${snap.weekTotal} tasks done`,
                `Current streak: ${snap.streak} days`,
                snap.daysSinceLastWin !== null && `Days since last completed task: ${snap.daysSinceLastWin}`,
              ].filter(Boolean).join('\n'),
            },
          ],
        });
        const message = completion.choices[0]?.message?.content?.trim().replace(/^["“]|["”]$/g, '');
        if (message && completion.choices[0]?.finish_reason !== 'length') {
          if (cache.size > 5000) cache.clear();
          cache.set(key, message);
          return ok({ message, situation: snap.situation, source: 'ai' });
        }
      } catch (e) {
        console.error('motivation AI failed, using fallback', e);
      }
    }

    return ok({ message: fallback(snap), situation: snap.situation, source: 'fallback' });
  } catch (e) {
    return serverError(e);
  }
}
