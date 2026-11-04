import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';

// The whole plan for one year (?year=YYYY, default this year) so the planner
// can drill year → month → week without a round trip per level: each active
// goal's outcomes, monthly focuses and weekly milestones, plus per-day task
// counts. Weeks are keyed by their Monday, so the range starts up to 6 days
// before 1 Jan to cover a week that straddles new year.
export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const param = Number(new URL(req.url).searchParams.get('year'));
    const year = Number.isInteger(param) && param >= 2000 && param <= 2100 ? param : new Date().getFullYear();
    const from = new Date(Date.UTC(year - 1, 11, 26));
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const [goals, tasks] = await Promise.all([
      prisma.goal.findMany({
        where: { userId: payload.userId, status: 'active' },
        select: {
          id: true,
          title: true,
          category: true,
          yearlyTargets: { where: { year }, orderBy: { createdAt: 'asc' } },
          monthlyTargets: { where: { month: { startsWith: `${year}-` } }, orderBy: { createdAt: 'asc' } },
          weeklyFocuses: { where: { weekStart: { gte: from, lte: to } }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dailyTask.findMany({
        where: { userId: payload.userId, date: { gte: from, lte: to } },
        select: { date: true, completed: true },
      }),
    ]);

    const taskDays: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      const key = t.date.toISOString().slice(0, 10);
      const day = (taskDays[key] ??= { total: 0, done: 0 });
      day.total++;
      if (t.completed) day.done++;
    }

    return ok({
      year,
      goals: goals.map((g) => ({
        ...g,
        weeklyFocuses: g.weeklyFocuses.map((w) => ({ ...w, weekStart: w.weekStart.toISOString().slice(0, 10) })),
      })),
      taskDays,
    });
  } catch (e) {
    return serverError(e);
  }
}
