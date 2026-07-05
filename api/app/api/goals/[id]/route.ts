import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

async function getOwnedGoal(userId: string, goalId: string) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal || goal.userId !== userId) return null;
  return goal;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const goal = await prisma.goal.findUnique({
      where: { id },
      include: {
        milestones: { orderBy: { createdAt: 'asc' } },
        monthlyTargets: { orderBy: { month: 'desc' } },
        weeklyFocuses: { orderBy: { weekStart: 'desc' } },
        dailyTasks: {
          where: { date: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) } },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!goal || goal.userId !== payload.userId) return notFound('Goal');

    const total = goal.milestones.length;
    const done = goal.milestones.filter((m) => m.status === 'completed').length;

    return ok({ ...goal, completionPercent: total > 0 ? Math.round((done / total) * 100) : 0 });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const owned = await getOwnedGoal(payload.userId, id);
    if (!owned) return notFound('Goal');

    const body = await req.json();
    const { title, description, category, targetDate, status } = body;

    const updated = await prisma.goal.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
        ...(status && { status }),
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
    const { id } = await params;

    const owned = await getOwnedGoal(payload.userId, id);
    if (!owned) return notFound('Goal');

    await prisma.goal.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
