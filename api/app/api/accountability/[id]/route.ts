import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getTier, LIMITS, upgradeRequired } from '@/app/lib/plans';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

async function getOwnedPartnership(userId: string, id: string) {
  const row = await prisma.accountabilityPartner.findUnique({ where: { id } });
  if (!row || (row.userId !== userId && row.partnerUserId !== userId)) return null;
  return row;
}

// Partner detail: who they are, how consistent they've been (sync rate =
// share of their tasks completed in the last 7 days, vs the 7 before), their
// best current streak, and the encouragement history between the two of you.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const row = await getOwnedPartnership(payload.userId, id);
    if (!row) return notFound('Partnership');
    const otherId = row.userId === payload.userId ? row.partnerUserId : row.userId;

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(now.getDate() - 13);
    const key = (d: Date) => new Date(d.toISOString().split('T')[0] + 'T00:00:00Z');

    const [partner, recentTasks, streak, activeGoals, messages] = await Promise.all([
      prisma.user.findUnique({ where: { id: otherId }, select: { id: true, fullName: true, email: true, avatarUrl: true } }),
      prisma.dailyTask.findMany({
        where: { userId: otherId, date: { gte: key(twoWeeksAgo) } },
        select: { date: true, completed: true },
      }),
      prisma.habitStreak.findFirst({ where: { userId: otherId }, orderBy: { currentStreak: 'desc' } }),
      prisma.goal.count({ where: { userId: otherId, status: 'active' } }),
      prisma.partnerMessage.findMany({
        where: { partnershipId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { sender: { select: { id: true, fullName: true } } },
      }),
    ]);

    const rate = (tasks: typeof recentTasks) =>
      tasks.length > 0 ? Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100) : null;
    const thisWeek = recentTasks.filter((t) => t.date >= key(weekAgo));
    const lastWeek = recentTasks.filter((t) => t.date < key(weekAgo));
    const syncRate = rate(thisWeek);
    const lastRate = rate(lastWeek);

    return ok({
      id: row.id,
      status: row.status,
      partner,
      activeGoals,
      syncRate,
      syncChange: syncRate !== null && lastRate !== null ? syncRate - lastRate : null,
      tasksCompletedThisWeek: thisWeek.filter((t) => t.completed).length,
      currentStreak: streak?.currentStreak ?? 0,
      messages: messages.map((m) => ({
        id: m.id,
        kind: m.kind,
        body: m.body,
        liked: m.liked,
        createdAt: m.createdAt,
        mine: m.senderId === payload.userId,
        sender: m.sender,
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

// Accept a pending invite — only the invitee (partnerUserId) can accept.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const row = await getOwnedPartnership(payload.userId, id);
    if (!row) return notFound('Partnership');
    if (row.partnerUserId !== payload.userId) {
      return err('Only the invited partner can accept this invite', 403);
    }
    if (row.status === 'active') return ok(row);

    const tier = await getTier(payload.userId);
    const activeElsewhere = await prisma.accountabilityPartner.count({
      where: { status: 'active', id: { not: id }, OR: [{ userId: payload.userId }, { partnerUserId: payload.userId }] },
    });
    if (activeElsewhere >= LIMITS[tier].partners) {
      return upgradeRequired(
        `Your ${tier === 'free' ? 'Free' : 'Pro'} plan includes ${LIMITS[tier].partners} accountability partner${LIMITS[tier].partners === 1 ? '' : 's'}. Upgrade to accept more.`,
        tier === 'free' ? 'pro' : 'plus'
      );
    }

    const updated = await prisma.accountabilityPartner.update({
      where: { id },
      data: { status: 'active' },
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// Either side can remove the partnership (declines an invite, or ends one).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const row = await getOwnedPartnership(payload.userId, id);
    if (!row) return notFound('Partnership');

    await prisma.accountabilityPartner.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
