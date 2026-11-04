import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { mondayOfWeek } from '@/app/lib/dates';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

function weekBounds(weekStartParam: string | null) {
  const weekStart = weekStartParam ? new Date(weekStartParam + 'T00:00:00Z') : mondayOfWeek();
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return { weekStart, weekEnd };
}

// The "Win Gallery" is the user's own real Community posts from that week —
// no separate wins table, no invented content.
async function getWeekData(userId: string, weekStart: Date, weekEnd: Date) {
  const [wins, completedTasks] = await Promise.all([
    prisma.communityPost.findMany({
      where: { userId, createdAt: { gte: weekStart, lt: weekEnd } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dailyTask.findMany({
      where: { userId, completed: true, date: { gte: weekStart, lt: weekEnd } },
      select: { date: true },
    }),
  ]);
  return { wins, completedCount: completedTasks.length };
}

// How well the week matched the plan — shown on the weekly alignment
// celebration after a review. The score averages whichever of these the user
// actually had this week: actions done, actions linked to a goal, goals planned
// at every level (year → month → week), weekly milestones done.
async function getWeekAlignment(userId: string, weekStart: Date, weekEnd: Date) {
  const startKey = weekStart.toISOString().slice(0, 10);
  const [tasks, goals, reviews] = await Promise.all([
    prisma.dailyTask.findMany({ where: { userId, date: { gte: weekStart, lt: weekEnd } }, select: { completed: true, goalId: true } }),
    prisma.goal.findMany({
      where: { userId, status: 'active' },
      select: {
        yearlyTargets: { where: { year: Number(startKey.slice(0, 4)) }, select: { id: true } },
        monthlyTargets: { where: { month: startKey.slice(0, 7) }, select: { id: true } },
        weeklyFocuses: { where: { weekStart }, select: { status: true } },
      },
    }),
    prisma.weeklyReview.findMany({ where: { userId, weekStart: { lte: weekStart } }, select: { weekStart: true }, orderBy: { weekStart: 'desc' }, take: 52 }),
  ]);

  const tasksDone = tasks.filter((t) => t.completed).length;
  const tasksLinked = tasks.filter((t) => t.goalId).length;
  const fullyPlanned = goals.filter((g) => g.yearlyTargets.length && g.monthlyTargets.length && g.weeklyFocuses.length).length;
  const weekly = goals.flatMap((g) => g.weeklyFocuses);
  const weeklyDone = weekly.filter((w) => w.status === 'completed').length;

  const rates = [
    tasks.length ? tasksDone / tasks.length : null,
    tasks.length ? tasksLinked / tasks.length : null,
    goals.length ? fullyPlanned / goals.length : null,
    weekly.length ? weeklyDone / weekly.length : null,
  ].filter((r): r is number => r !== null);
  const score = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : 0;

  // Consecutive reviewed weeks ending with this one.
  let streakWeeks = 0;
  for (const r of reviews) {
    const expected = new Date(weekStart.getTime() - streakWeeks * 7 * 86400000).toISOString().slice(0, 10);
    if (r.weekStart.toISOString().slice(0, 10) !== expected) break;
    streakWeeks++;
  }

  return {
    score,
    tasksDone,
    tasksTotal: tasks.length,
    tasksLinked,
    goals: goals.length,
    fullyPlanned,
    weeklyDone,
    weeklyTotal: weekly.length,
    streakWeeks,
  };
}

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { weekStart, weekEnd } = weekBounds(req.nextUrl.searchParams.get('weekStart'));

    const [existing, weekData] = await Promise.all([
      prisma.weeklyReview.findUnique({ where: { userId_weekStart: { userId: payload.userId, weekStart } } }),
      getWeekData(payload.userId, weekStart, weekEnd),
    ]);

    return ok({
      weekStart: weekStart.toISOString().split('T')[0],
      review: existing,
      wins: weekData.wins,
      completedCount: weekData.completedCount,
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const body = await req.json();
    const { weekStart: weekStartParam, blockedText, carryForwardText, rating } = body;
    if (!weekStartParam) return err('weekStart is required');
    if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) {
      return err('rating must be between 1 and 5');
    }

    const { weekStart, weekEnd } = weekBounds(weekStartParam);
    const { completedCount } = await getWeekData(payload.userId, weekStart, weekEnd);

    const review = await prisma.weeklyReview.upsert({
      where: { userId_weekStart: { userId: payload.userId, weekStart } },
      create: {
        userId: payload.userId,
        weekStart,
        completedCount,
        blockedText: blockedText?.trim() || null,
        carryForwardText: carryForwardText?.trim() || null,
        rating: rating ?? null,
      },
      update: {
        completedCount,
        blockedText: blockedText?.trim() || null,
        carryForwardText: carryForwardText?.trim() || null,
        rating: rating ?? null,
      },
    });

    return ok({ ...review, alignment: await getWeekAlignment(payload.userId, weekStart, weekEnd) });
  } catch (e) {
    return serverError(e);
  }
}
