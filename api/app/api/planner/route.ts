import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';
import { todayKey, mondayOfWeek, parseDateKey, addDaysKey, DATE_KEY } from '@/app/lib/dates';

type Gap = { type: 'no_yearly' | 'no_monthly' | 'no_weekly' | 'no_tasks_week' | 'unlinked_task'; goalId?: string; taskId?: string; message: string };

// The Cascading Action Planner for one day (?date=YYYY-MM-DD, default today):
// that year's outcomes → month's focus → week's milestones → the day's
// actions, per active goal, plus an alignment score and the gaps (missing
// levels, unlinked tasks) that pull it down.
export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const param = new URL(req.url).searchParams.get('date');
    const today = param && DATE_KEY.test(param) ? param : todayKey();
    const year = Number(today.slice(0, 4));
    const month = today.slice(0, 7);
    const weekStart = mondayOfWeek(parseDateKey(today));
    const weekStartKey = weekStart.toISOString().slice(0, 10);
    const weekEndKey = addDaysKey(weekStartKey, 6);

    const [goals, weekTasks] = await Promise.all([
      prisma.goal.findMany({
        where: { userId: payload.userId, status: 'active' },
        include: {
          milestones: { select: { status: true } },
          yearlyTargets: { where: { year }, orderBy: { createdAt: 'asc' } },
          monthlyTargets: { where: { month }, orderBy: { createdAt: 'asc' } },
          weeklyFocuses: { where: { weekStart }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dailyTask.findMany({
        where: {
          userId: payload.userId,
          date: {
            gte: new Date(weekStartKey + 'T00:00:00Z'),
            lte: new Date(weekEndKey + 'T23:59:59Z'),
          },
        },
        include: { goal: { select: { title: true, category: true } } },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const todayTasks = weekTasks.filter((t) => t.date.toISOString().split('T')[0] === today);
    const gaps: Gap[] = [];
    let checks = 0;
    let passed = 0;

    const plannedGoals = goals.map((g) => {
      const tasksThisWeek = weekTasks.filter((t) => t.goalId === g.id);
      const total = g.milestones.length;
      const done = g.milestones.filter((m) => m.status === 'completed').length;

      const levels = [
        { ok: g.yearlyTargets.length > 0, gap: { type: 'no_yearly' as const, message: `"${g.title}" has no outcome set for ${year}` } },
        { ok: g.monthlyTargets.length > 0, gap: { type: 'no_monthly' as const, message: `"${g.title}" has no focus for this month` } },
        { ok: g.weeklyFocuses.length > 0, gap: { type: 'no_weekly' as const, message: `"${g.title}" has no milestones for this week` } },
        { ok: tasksThisWeek.length > 0, gap: { type: 'no_tasks_week' as const, message: `No actions toward "${g.title}" this week` } },
      ];
      for (const l of levels) {
        checks++;
        if (l.ok) passed++;
        else gaps.push({ ...l.gap, goalId: g.id });
      }

      return {
        id: g.id,
        title: g.title,
        category: g.category,
        completionPercent: total > 0 ? Math.round((done / total) * 100) : 0,
        yearlyTargets: g.yearlyTargets,
        monthlyTargets: g.monthlyTargets,
        weeklyFocuses: g.weeklyFocuses,
        weekTaskCount: tasksThisWeek.length,
        weekTasksDone: tasksThisWeek.filter((t) => t.completed).length,
      };
    });

    for (const t of todayTasks) {
      checks++;
      if (t.goalId) passed++;
      else gaps.push({ type: 'unlinked_task', taskId: t.id, message: `"${t.title}" isn't linked to any goal` });
    }

    const score = checks > 0 ? Math.round((passed / checks) * 100) : 0;
    const message =
      checks === 0
        ? 'Create a goal to start building your plan.'
        : score >= 80
        ? 'Your daily actions are highly aligned with your long-term vision.'
        : score >= 50
        ? 'Mostly aligned. Close the gaps below to connect today to your vision.'
        : 'Your days are drifting from your goals. Fill in the gaps below.';

    return ok({
      year,
      month,
      weekStart: weekStartKey,
      today,
      goals: plannedGoals,
      todayTasks,
      alignment: { score, message },
      gaps,
    });
  } catch (e) {
    return serverError(e);
  }
}
