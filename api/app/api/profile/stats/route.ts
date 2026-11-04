import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { evaluateBadges, computeLevel } from '@/app/lib/badges';
import { ok, unauthorized, serverError } from '@/app/lib/response';

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const [user, goals, streaks, completedMilestoneCount, userBadges, totalGoalsThisMonth] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId } }),
      prisma.goal.findMany({ where: { userId: payload.userId, status: 'active' }, include: { milestones: true } }),
      prisma.habitStreak.findMany({ where: { userId: payload.userId } }),
      prisma.milestone.count({ where: { status: 'completed', goal: { userId: payload.userId } } }),
      evaluateBadges(payload.userId),
      prisma.milestone.count({
        where: {
          status: 'completed',
          goal: { userId: payload.userId },
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    // Same alignment-score logic as /api/dashboard, kept consistent.
    const goalsWithPercent = goals.map((g) => {
      const total = g.milestones.length;
      const done = g.milestones.filter((m) => m.status === 'completed').length;
      return total > 0 ? Math.round((done / total) * 100) : 0;
    });
    const alignmentScore =
      goalsWithPercent.length > 0
        ? Math.round(goalsWithPercent.reduce((sum, p) => sum + p, 0) / goalsWithPercent.length)
        : 0;

    const bestStreak = streaks.reduce((max, s) => Math.max(max, s.longestStreak), 0);
    const currentStreak = streaks.reduce((max, s) => Math.max(max, s.currentStreak), 0);

    return ok({
      fullName: user?.fullName,
      avatarUrl: user?.avatarUrl,
      memberSince: user?.createdAt,
      totalMilestones: completedMilestoneCount,
      milestonesThisMonth: totalGoalsThisMonth,
      currentStreak,
      longestStreak: bestStreak,
      alignmentScore,
      level: computeLevel(completedMilestoneCount, bestStreak),
      badges: userBadges.map((ub) => ({
        key: ub.badgeKey,
        label: ub.badge.label,
        emoji: ub.badge.emoji,
        description: ub.badge.description,
        earnedAt: ub.earnedAt,
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}
