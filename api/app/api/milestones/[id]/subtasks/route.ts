import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, created, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

async function assertOwned(userId: string, milestoneId: string) {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { goal: { select: { userId: true } } },
  });
  return milestone && milestone.goal.userId === userId ? milestone : null;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const milestone = await assertOwned(payload.userId, id);
    if (!milestone) return notFound('Milestone');

    const { title } = await req.json();
    if (!title || !title.trim()) return err('title is required');

    const count = await prisma.milestoneSubtask.count({ where: { milestoneId: id } });

    const subtask = await prisma.milestoneSubtask.create({
      data: { milestoneId: id, title: title.trim(), order: count },
    });

    return created(subtask);
  } catch (e) {
    return serverError(e);
  }
}
