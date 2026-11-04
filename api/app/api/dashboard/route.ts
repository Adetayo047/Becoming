import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';
import { getLimits } from '@/app/lib/plans';

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

// Task dates are stored as YYYY-MM-DD at noon UTC, so all trend maths below
// works on those UTC day keys to avoid timezone drift.
function dayKey(d: Date) {
  return d.toISOString().split('T')[0];
}

function addDays(key: string, n: number) {
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
}

function mondayKey(key: string) {
  const dow = new Date(key + 'T12:00:00Z').getUTCDay();
  return addDays(key, dow === 0 ? -6 : 1 - dow);
}

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const now = new Date();
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const today = dayKey(now);
    const thisMonday = mondayKey(today);
    const trendStart = addDays(thisMonday, -7 * 7); // 8 weeks incl. this one

    const [goals, tasks, streaks, trendTasks] = await Promise.all([
      prisma.goal.findMany({
        where: { userId: payload.userId, status: 'active' },
        include: { milestones: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dailyTask.findMany({
        where: {
          userId: payload.userId,
          date: { gte: fourteenDaysAgo },
          completed: true,
        },
        select: { date: true },
      }),
      prisma.habitStreak.findMany({
        where: { userId: payload.userId, currentStreak: { gt: 0 } },
        orderBy: { currentStreak: 'desc' },
        take: 5,
      }),
      prisma.dailyTask.findMany({
        where: { userId: payload.userId, date: { gte: new Date(trendStart + 'T00:00:00Z') } },
        select: { date: true, completed: true },
      }),
    ]);

    // Goal % completion
    const goalsWithPercent = goals.map((g) => {
      const total = g.milestones.length;
      const done = g.milestones.filter((m) => m.status === 'completed').length;
      return {
        id: g.id,
        title: g.title,
        category: g.category,
        status: g.status,
        completionPercent: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });

    // Heatmap: tasks completed per day over last 14 days
    const countByDate: Record<string, number> = {};
    tasks.forEach((t) => {
      const d = t.date.toISOString().split('T')[0];
      countByDate[d] = (countByDate[d] ?? 0) + 1;
    });

    const heatmap = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (13 - i));
      const dateStr = d.toISOString().split('T')[0];
      return { date: dateStr, count: countByDate[dateStr] ?? 0 };
    });

    const overallPercent =
      goalsWithPercent.length > 0
        ? Math.round(
            goalsWithPercent.reduce((sum, g) => sum + g.completionPercent, 0) /
              goalsWithPercent.length
          )
        : 0;

    // Trend: completion rate for each of the last 8 weeks, this week's
    // completions per day, change vs the same days last week, and peak weekday.
    const weekly = Array.from({ length: 8 }, (_, i) => ({ weekStart: addDays(trendStart, i * 7), completed: 0, total: 0, rate: 0 }));
    const thisWeekDays = Array.from({ length: 7 }, (_, i) => ({ date: addDays(thisMonday, i), count: 0 }));
    const byWeekday = Array(7).fill(0);
    const elapsed = thisWeekDays.findIndex((d) => d.date === today) + 1;
    let lastWeekSoFar = 0;

    for (const t of trendTasks) {
      const key = dayKey(t.date);
      const week = weekly.find((w) => w.weekStart === mondayKey(key));
      if (!week) continue;
      week.total++;
      if (!t.completed) continue;
      week.completed++;
      byWeekday[new Date(key + 'T12:00:00Z').getUTCDay()]++;
      const day = thisWeekDays.find((d) => d.date === key);
      if (day) day.count++;
      if (key >= addDays(thisMonday, -7) && key < addDays(thisMonday, -7 + elapsed)) lastWeekSoFar++;
    }
    weekly.forEach((w) => { w.rate = w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0; });

    const thisWeekSoFar = thisWeekDays.reduce((sum, d) => sum + d.count, 0);
    const changePercent = lastWeekSoFar > 0 ? Math.round(((thisWeekSoFar - lastWeekSoFar) / lastWeekSoFar) * 100) : null;
    const peak = Math.max(...byWeekday);
    const peakDay = peak > 0 ? WEEKDAYS[byWeekday.indexOf(peak)] : null;

    return ok({
      // Trends are a Pro feature — free users get null and a locked preview card.
      trend: (await getLimits(payload.userId)).trends
        ? { weekly, thisWeek: thisWeekDays, thisWeekCompleted: thisWeekSoFar, lastWeekSameDays: lastWeekSoFar, changePercent, peakDay }
        : null,
      overallPercent,
      totalTasksCompleted: tasks.length,
      goals: goalsWithPercent,
      heatmap,
      streaks,
    });
  } catch (e) {
    return serverError(e);
  }
}
