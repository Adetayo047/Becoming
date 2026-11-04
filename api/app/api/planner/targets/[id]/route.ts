import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

async function findOwned(kind: string | null, id: string, userId: string) {
  const item =
    kind === 'yearly'
      ? await prisma.yearlyTarget.findUnique({ where: { id }, include: { goal: { select: { userId: true } } } })
      : kind === 'monthly'
      ? await prisma.monthlyTarget.findUnique({ where: { id }, include: { goal: { select: { userId: true } } } })
      : kind === 'weekly'
      ? await prisma.weeklyFocus.findUnique({ where: { id }, include: { goal: { select: { userId: true } } } })
      : null;
  return item && item.goal.userId === userId ? item : null;
}

// Toggle status / rename a yearly outcome, monthly focus or weekly milestone.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const { kind, status, title } = await req.json();
    if (kind !== 'yearly' && kind !== 'monthly' && kind !== 'weekly') return err('kind must be "yearly", "monthly" or "weekly"');
    if (!(await findOwned(kind, id, payload.userId))) return notFound('Plan item');
    if (status !== undefined && status !== 'pending' && status !== 'completed') return err('invalid status');

    const data = {
      ...(status !== undefined && { status }),
      ...(typeof title === 'string' && title.trim().length >= 3 && { title: title.trim() }),
    };
    const updated =
      kind === 'yearly'
        ? await prisma.yearlyTarget.update({ where: { id }, data })
        : kind === 'monthly'
        ? await prisma.monthlyTarget.update({ where: { id }, data })
        : await prisma.weeklyFocus.update({ where: { id }, data });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const kind = new URL(req.url).searchParams.get('kind');
    if (!(await findOwned(kind, id, payload.userId))) return notFound('Plan item');

    if (kind === 'yearly') await prisma.yearlyTarget.delete({ where: { id } });
    else if (kind === 'monthly') await prisma.monthlyTarget.delete({ where: { id } });
    else await prisma.weeklyFocus.delete({ where: { id } });

    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
