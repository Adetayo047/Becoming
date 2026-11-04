import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getLimits, upgradeRequired } from '@/app/lib/plans';
import { getOpenAI, AI_MODEL, PERSONALITY_TONE } from '@/app/lib/openai';
import { ok, unauthorized, serverError } from '@/app/lib/response';
import { addDaysKey, todayKey, DATE_KEY } from '@/app/lib/dates';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WINDOWS = [6, 9, 12, 15, 18, 21]; // 3-hour windows starting at these hours

type Insight = { title: string; body: string };

// AI habit insights only change when the numbers do — one call per user per
// day per data state; a restart just regenerates them.
const cache = new Map<string, Insight[]>();

// Premium Insights (Plus) — patterns from the last 30 days of real activity:
// when tasks actually get done, how reliably the user bounces back after a
// missed day, and AI-written habit observations from those numbers.
// ?date=YYYY-MM-DD (local today) & ?tz=<minutes east of UTC> from the app.
export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    if (!(await getLimits(payload.userId)).insights) {
      return upgradeRequired('Premium Insights are part of Becoming Plus.', 'plus');
    }

    const params = new URL(req.url).searchParams;
    const today = DATE_KEY.test(params.get('date') ?? '') ? params.get('date')! : todayKey();
    const tz = Math.max(-720, Math.min(840, Number(params.get('tz')) || 0));
    const from = addDaysKey(today, -29);

    const [user, tasks] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId }, select: { fullName: true, aiPersonality: true } }),
      prisma.dailyTask.findMany({
        where: { userId: payload.userId, date: { gte: new Date(from + 'T00:00:00Z'), lte: new Date(today + 'T23:59:59Z') } },
        select: { date: true, completed: true, completedAt: true },
      }),
    ]);
    if (!user) return unauthorized();

    // When tasks get ticked off, in the user's local hours.
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const t of tasks) {
      if (!t.completedAt) continue;
      const local = new Date(t.completedAt.getTime() + tz * 60000);
      hourly[local.getUTCHours()]++;
    }
    const windows = WINDOWS.map((h) => ({ start: h, count: hourly[h] + hourly[h + 1] + hourly[(h + 2) % 24] }));
    const completions = hourly.reduce((a, b) => a + b, 0);
    const peak = completions > 0 ? windows.reduce((best, w) => (w.count > best.count ? w : best)) : null;

    // Per-day totals, then the weekday that slips most.
    const days = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      const key = t.date.toISOString().slice(0, 10);
      const d = days.get(key) ?? { total: 0, done: 0 };
      d.total++;
      if (t.completed) d.done++;
      days.set(key, d);
    }
    const byWeekday = WEEKDAYS.map(() => ({ total: 0, done: 0 }));
    for (const [key, d] of days) {
      const w = byWeekday[new Date(key + 'T12:00:00Z').getUTCDay()];
      w.total += d.total;
      w.done += d.done;
    }
    const rated = byWeekday.map((w, i) => ({ day: WEEKDAYS[i], rate: w.total ? w.done / w.total : null, total: w.total })).filter((w) => w.rate !== null && w.total >= 2);
    const weakest = rated.length >= 2 ? rated.reduce((a, b) => (b.rate! < a.rate! ? b : a)) : null;
    const strongest = rated.length >= 2 ? rated.reduce((a, b) => (b.rate! > a.rate! ? b : a)) : null;

    // Resilience: after a day with tasks but none done, how often the next
    // planned day had a completion — blended with completion and consistency.
    const planned = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
    let misses = 0;
    let bounces = 0;
    planned.forEach(([, d], i) => {
      if (d.done > 0 || i === planned.length - 1) return;
      misses++;
      if (planned[i + 1][1].done > 0) bounces++;
    });
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.completed).length;
    const completionRate = totalTasks ? doneTasks / totalTasks : 0;
    // No misses yet says little about bouncing back — fall back to completion.
    const bounceRate = misses ? bounces / misses : completionRate;
    const consistency = planned.filter(([, d]) => d.done > 0).length / 30;
    const resilience = totalTasks ? Math.round((0.5 * bounceRate + 0.3 * completionRate + 0.2 * Math.min(1, consistency * 2)) * 100) : 0;
    const resilienceLabel = resilience >= 80 ? 'Exceptional' : resilience >= 60 ? 'Strong' : resilience >= 40 ? 'Steady' : 'Building';

    const stats = {
      days: 30,
      totalTasks,
      doneTasks,
      completionRate: Math.round(completionRate * 100),
      activeDays: planned.filter(([, d]) => d.done > 0).length,
      peakWindow: peak && peak.count > 0 ? `${String(peak.start).padStart(2, '0')}:00–${String(peak.start + 3).padStart(2, '0')}:00` : null,
      weakestDay: weakest ? { day: weakest.day, rate: Math.round(weakest.rate! * 100) } : null,
      strongestDay: strongest ? { day: strongest.day, rate: Math.round(strongest.rate! * 100) } : null,
      misses,
      bounces,
    };

    const insights = await habitInsights(payload.userId, today, user.fullName.split(' ')[0] || 'friend', user.aiPersonality, stats);

    return ok({
      windows,
      peakStart: peak && peak.count > 0 ? peak.start : null,
      resilience: { score: resilience, label: resilienceLabel, bounceRate: Math.round(bounceRate * 100), completionRate: stats.completionRate, activeDays: stats.activeDays },
      stats,
      insights,
    });
  } catch (e) {
    return serverError(e);
  }
}

type Stats = {
  totalTasks: number;
  doneTasks: number;
  completionRate: number;
  activeDays: number;
  peakWindow: string | null;
  weakestDay: { day: string; rate: number } | null;
  strongestDay: { day: string; rate: number } | null;
  misses: number;
  bounces: number;
};

// Built from the numbers alone — used when AI isn't available.
function ruleInsights(s: Stats): Insight[] {
  const out: Insight[] = [];
  if (s.peakWindow) out.push({ title: 'Your Peak Window', body: `Most of your tasks get done between ${s.peakWindow}. Put your hardest work there.` });
  if (s.weakestDay && s.strongestDay && s.weakestDay.day !== s.strongestDay.day) {
    out.push({ title: `The ${s.weakestDay.day} Slide`, body: `You finish ${s.weakestDay.rate}% of tasks on ${s.weakestDay.day}s vs ${s.strongestDay.rate}% on ${s.strongestDay.day}s. Plan lighter ${s.weakestDay.day}s.` });
  }
  if (s.misses > 0) out.push({ title: 'Bounce-Back Pattern', body: `After ${s.misses} missed day${s.misses === 1 ? '' : 's'}, you came back the next day ${s.bounces} time${s.bounces === 1 ? '' : 's'}. One small task the day after a miss keeps the chain alive.` });
  if (out.length < 3) out.push({ title: 'Consistency Loop', body: `${s.activeDays} active day${s.activeDays === 1 ? '' : 's'} in the last 30. Insights sharpen as you log more days.` });
  return out.slice(0, 3);
}

async function habitInsights(userId: string, today: string, firstName: string, personality: keyof typeof PERSONALITY_TONE, s: Stats): Promise<Insight[]> {
  if (s.totalTasks < 3) return ruleInsights(s);
  const key = [userId, today, personality, JSON.stringify(s)].join('|');
  const cached = cache.get(key);
  if (cached) return cached;

  const openai = getOpenAI();
  if (!openai) return ruleInsights(s);
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 350,
      messages: [
        {
          role: 'system',
          content:
            'You analyse 30 days of a person\'s task data in a goal app and write exactly 3 habit insights. ' +
            'Respond with JSON {"insights":[{"title":string,"body":string}]}. Title: 2-4 words, catchy. ' +
            'Body: max 30 words, cites a real number from the data, ends with one concrete adjustment. ' +
            'Use ONLY the numbers given — never invent sleep, biometrics or anything not in the data. ' +
            PERSONALITY_TONE[personality],
        },
        { role: 'user', content: `Name: ${firstName}\nData (last 30 days): ${JSON.stringify(s)}` },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as { insights?: Insight[] };
    const insights = (parsed.insights ?? []).filter((i) => typeof i?.title === 'string' && typeof i?.body === 'string').slice(0, 3);
    if (insights.length === 0) return ruleInsights(s);
    if (cache.size > 2000) cache.clear();
    cache.set(key, insights);
    return insights;
  } catch (e) {
    console.error('insights AI failed, using rules', e);
    return ruleInsights(s);
  }
}
