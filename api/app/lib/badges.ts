import { prisma } from '@/app/lib/prisma';

// Fixed badge set — small and rule-based, evaluated against data that
// already exists (no separate tracking table per badge). Definitions are
// upserted on first use, so no separate seed step is needed.
export const BADGE_DEFINITIONS = [
  { key: 'goal_setter', label: 'Goal Setter', emoji: '🎯', description: 'Created your first goal' },
  { key: 'early_riser', label: 'Early Riser', emoji: '🌅', description: 'Completed a task before 7am' },
  { key: 'deep_work', label: 'Deep Work', emoji: '⚡', description: 'Completed 10 tasks total' },
  { key: 'consistency_king', label: 'Consistency King', emoji: '👑', description: 'Held a 7-day habit streak' },
  { key: 'milestone_master', label: 'Milestone Master', emoji: '🏁', description: 'Completed 5 milestones' },
  { key: 'community_builder', label: 'Community Builder', emoji: '🤝', description: 'Formed an accountability partnership' },
] as const;

export async function ensureBadgesSeeded() {
  await Promise.all(
    BADGE_DEFINITIONS.map((b) =>
      prisma.badge.upsert({
        where: { key: b.key },
        create: b,
        update: { label: b.label, emoji: b.emoji, description: b.description },
      })
    )
  );
}

// Checks each rule against real data and awards any newly-earned badges.
// Returns the user's full current badge list (existing + newly awarded).
export async function evaluateBadges(userId: string) {
  await ensureBadgesSeeded();

  const [goalCount, completedTaskCount, earlyRiserTask, bestStreak, completedMilestoneCount, activePartnership, existing] =
    await Promise.all([
      prisma.goal.count({ where: { userId } }),
      prisma.dailyTask.count({ where: { userId, completed: true } }),
      prisma.dailyTask.findFirst({
        where: { userId, completed: true, completedAt: { not: null } },
      }),
      prisma.habitStreak.findFirst({ where: { userId }, orderBy: { longestStreak: 'desc' } }),
      prisma.milestone.count({ where: { status: 'completed', goal: { userId } } }),
      prisma.accountabilityPartner.findFirst({
        where: { status: 'active', OR: [{ userId }, { partnerUserId: userId }] },
      }),
      prisma.userBadge.findMany({ where: { userId } }),
    ]);

  const earlyRiserEarned =
    earlyRiserTask?.completedAt != null && new Date(earlyRiserTask.completedAt).getUTCHours() < 7;

  const earnedKeys = new Set(existing.map((b) => b.badgeKey));
  const shouldHave: string[] = [];
  if (goalCount > 0) shouldHave.push('goal_setter');
  if (earlyRiserEarned) shouldHave.push('early_riser');
  if (completedTaskCount >= 10) shouldHave.push('deep_work');
  if ((bestStreak?.longestStreak ?? 0) >= 7) shouldHave.push('consistency_king');
  if (completedMilestoneCount >= 5) shouldHave.push('milestone_master');
  if (activePartnership) shouldHave.push('community_builder');

  const newlyEarned = shouldHave.filter((k) => !earnedKeys.has(k));
  if (newlyEarned.length > 0) {
    await prisma.userBadge.createMany({
      data: newlyEarned.map((badgeKey) => ({ userId, badgeKey })),
      skipDuplicates: true,
    });
  }

  return prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { earnedAt: 'desc' },
  });
}

// Level is derived, not stored: 1 level per 3 completed milestones, plus 1
// per 7 days of best-ever streak, floor of 1. A plain, documented formula —
// not an invented per-user number.
export function computeLevel(completedMilestones: number, longestStreak: number): number {
  return 1 + Math.floor(completedMilestones / 3) + Math.floor(longestStreak / 7);
}
