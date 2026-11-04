import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string; subtaskId: string }> };

async function getOwnedSubtask(userId: string, milestoneId: string, subtaskId: string) {
  const subtask = await prisma.milestoneSubtask.findUnique({
    where: { id: subtaskId },
    include: { milestone: { include: { goal: { select: { userId: true } } } } },
  });
  if (!subtask || subtask.milestoneId !== milestoneId || subtask.milestone.goal.userId !== userId) return null;
  return subtask;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id, subtaskId } = await params;

    const subtask = await getOwnedSubtask(payload.userId, id, subtaskId);
    if (!subtask) return notFound('Subtask');

    const { completed, title, order } = await req.json();

    const updated = await prisma.milestoneSubtask.update({
      where: { id: subtaskId },
      data: {
        ...(completed !== undefined && { completed }),
        ...(title !== undefined && { title: title.trim() }),
        ...(order !== undefined && { order }),
      },
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id, subtaskId } = await params;

    const subtask = await getOwnedSubtask(payload.userId, id, subtaskId);
    if (!subtask) return notFound('Subtask');

    await prisma.milestoneSubtask.delete({ where: { id: subtaskId } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
