import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, created, err, unauthorized, serverError } from '@/app/lib/response';

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const goals = await prisma.goal.findMany({
      where: {
        userId: payload.userId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        milestones: { orderBy: { createdAt: 'asc' } },
        monthlyTargets: { orderBy: { createdAt: 'asc' } },
        weeklyFocuses: { orderBy: { weekStart: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute completion percent from milestones
    const goalsWithPercent = goals.map((g) => {
      const total = g.milestones.length;
      const done = g.milestones.filter((m: { status: string }) => m.status === 'completed').length;
      return { ...g, completionPercent: total > 0 ? Math.round((done / total) * 100) : 0 };
    });

    return ok(goalsWithPercent);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const body = await req.json();
    const { title, description, category, targetDate, status } = body;

    if (!title || !category) {
      return err('title and category are required');
    }

    const goal = await prisma.goal.create({
      data: {
        userId: payload.userId,
        title: title.trim(),
        description: description?.trim() ?? null,
        category,
        targetDate: targetDate ? new Date(targetDate) : null,
        status: status ?? 'active',
      },
    });

    return created(goal);
  } catch (e) {
    return serverError(e);
  }
}
