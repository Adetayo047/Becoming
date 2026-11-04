import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

async function getOwnedMilestone(userId: string, id: string) {
  const milestone = await prisma.milestone.findUnique({
    where: { id },
    include: { goal: { select: { userId: true } } },
  });
  if (!milestone || milestone.goal.userId !== userId) return null;
  return milestone;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: {
        goal: { select: { id: true, userId: true, title: true, category: true } },
        subtasks: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
        resources: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!milestone || milestone.goal.userId !== payload.userId) return notFound('Milestone');

    // "Up Next" — the next not-yet-completed milestone on the same goal,
    // created after this one. Purely derived from real ordering, nothing invented.
    const upNext = await prisma.milestone.findFirst({
      where: {
        goalId: milestone.goalId,
        status: 'pending',
        OR: [
          { createdAt: { gt: milestone.createdAt } },
          { createdAt: milestone.createdAt, id: { gt: milestone.id } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, title: true },
    });

    const subtaskTotal = milestone.subtasks.length;
    const subtaskDone = milestone.subtasks.filter((s) => s.completed).length;

    return ok({
      ...milestone,
      subtaskCompletionPercent: subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : null,
      upNext,
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const milestone = await getOwnedMilestone(payload.userId, id);
    if (!milestone) return notFound('Milestone');

    const { completed, title, reflection, logMinutes } = await req.json();

    if (logMinutes !== undefined && (typeof logMinutes !== 'number' || logMinutes <= 0)) {
      return err('logMinutes must be a positive number');
    }

    const updated = await prisma.milestone.update({
      where: { id },
      data: {
        ...(completed !== undefined && { status: completed ? 'completed' : 'pending' }),
        ...(title !== undefined && { title: title.trim() }),
        ...(reflection !== undefined && { reflection: reflection.trim(), reflectionUpdatedAt: new Date() }),
        ...(logMinutes !== undefined && { timeInvestedMinutes: { increment: Math.round(logMinutes) } }),
      },
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
