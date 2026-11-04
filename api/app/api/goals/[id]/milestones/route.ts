import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { created, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

// Add one or more milestones to an existing goal. Goal creation can seed
// milestones, but goals made during onboarding start with none — without this
// their progress could never move past 0%.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== payload.userId) return notFound('Goal');

    const { titles } = await req.json();
    const valid: string[] = Array.isArray(titles)
      ? titles.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 2).map((t) => t.trim())
      : [];
    if (valid.length === 0) return err('titles must include at least one milestone (3+ characters)');
    if (valid.length > 10) return err('You can add up to 10 milestones at a time');

    await prisma.milestone.createMany({
      // 1ms apart so the list keeps the order it was given in.
      data: valid.map((title, i) => ({ goalId: id, title, createdAt: new Date(Date.now() + i) })),
    });

    const milestones = await prisma.milestone.findMany({
      where: { goalId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return created(milestones);
  } catch (e) {
    return serverError(e);
  }
}
