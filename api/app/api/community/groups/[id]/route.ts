import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { todayKey } from '@/app/lib/dates';
import { ok, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const group = await prisma.communityGroup.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      },
    });
    if (!group) return notFound('Group');

    const isMember = group.members.some((m) => m.userId === payload.userId);
    if (!isMember) return notFound('Group');

    // Group-goal progress: % of members who completed at least one task today.
    const memberIds = group.members.map((m) => m.userId);
    const today = new Date(todayKey() + 'T12:00:00Z');
    const doneToday = await prisma.dailyTask.groupBy({
      by: ['userId'],
      where: { userId: { in: memberIds }, date: today, completed: true },
    });

    return ok({
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      members: group.members.map((m) => m.user),
      groupGoalProgress: {
        membersDone: doneToday.length,
        totalMembers: memberIds.length,
        percent: memberIds.length > 0 ? Math.round((doneToday.length / memberIds.length) * 100) : 0,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
