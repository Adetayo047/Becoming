import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const now = new Date();
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const [goals, tasks, streaks] = await Promise.all([
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
        where: { userId: payload.userId },
        orderBy: { currentStreak: 'desc' },
        take: 5,
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

    return ok({
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
