import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string; resourceId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id, resourceId } = await params;

    const resource = await prisma.milestoneResource.findUnique({
      where: { id: resourceId },
      include: { milestone: { include: { goal: { select: { userId: true } } } } },
    });
    if (!resource || resource.milestoneId !== id || resource.milestone.goal.userId !== payload.userId) {
      return notFound('Resource');
    }

    await prisma.milestoneResource.delete({ where: { id: resourceId } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
