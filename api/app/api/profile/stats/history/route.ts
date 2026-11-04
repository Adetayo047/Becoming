import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';

// Real per-month aggregates for the Growth Passport's "Historical Progress"
// chart — milestones completed and task-completion rate, computed straight
// from DailyTask/Milestone rows, never fabricated.
export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { searchParams } = new URL(req.url);
    const months = Math.min(12, Math.max(1, Number(searchParams.get('months')) || 6));

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const [milestones, tasks] = await Promise.all([
      prisma.milestone.findMany({
        where: { status: 'completed', goal: { userId: payload.userId }, createdAt: { gte: rangeStart } },
        select: { createdAt: true },
      }),
      prisma.dailyTask.findMany({
        where: { userId: payload.userId, date: { gte: rangeStart } },
        select: { date: true, completed: true },
      }),
    ]);

    const monthKeys: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const milestonesByMonth: Record<string, number> = {};
    for (const m of milestones) {
      const key = `${m.createdAt.getFullYear()}-${String(m.createdAt.getMonth() + 1).padStart(2, '0')}`;
      milestonesByMonth[key] = (milestonesByMonth[key] ?? 0) + 1;
    }

    const taskTotalsByMonth: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!taskTotalsByMonth[key]) taskTotalsByMonth[key] = { total: 0, done: 0 };
      taskTotalsByMonth[key].total += 1;
      if (t.completed) taskTotalsByMonth[key].done += 1;
    }

    const history = monthKeys.map((key) => {
      const taskStats = taskTotalsByMonth[key];
      return {
        month: key,
        milestonesCompleted: milestonesByMonth[key] ?? 0,
        consistencyPercent: taskStats && taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0,
      };
    });

    return ok({ history });
  } catch (e) {
    return serverError(e);
  }
}
