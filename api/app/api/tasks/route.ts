import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, created, err, unauthorized, serverError } from '@/app/lib/response';

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];

    const tasks = await prisma.dailyTask.findMany({
      where: {
        userId: payload.userId,
        date: new Date(date + 'T12:00:00Z'),
      },
      include: {
        goal: { select: { title: true, category: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return ok(tasks);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const body = await req.json();
    const { title, goalId, date } = body;

    if (!title) return err('title is required');

    const taskDate = date ?? new Date().toISOString().split('T')[0];

    const task = await prisma.dailyTask.create({
      data: {
        userId: payload.userId,
        goalId: goalId ?? null,
        title: title.trim(),
        date: new Date(taskDate + 'T12:00:00Z'),
        completed: false,
      },
      include: {
        goal: { select: { title: true, category: true } },
      },
    });

    return created(task);
  } catch (e) {
    return serverError(e);
  }
}
