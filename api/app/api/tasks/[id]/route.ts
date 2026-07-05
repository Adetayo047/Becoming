import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const task = await prisma.dailyTask.findUnique({ where: { id } });
    if (!task || task.userId !== payload.userId) return notFound('Task');

    const body = await req.json();
    const { completed, title } = body;

    const updated = await prisma.dailyTask.update({
      where: { id },
      data: {
        ...(completed !== undefined && {
          completed,
          completedAt: completed ? new Date() : null,
        }),
        ...(title !== undefined && { title: title.trim() }),
      },
      include: {
        goal: { select: { title: true, category: true } },
      },
    });

    // Update habit streak if marking complete
    if (completed === true) {
      await upsertStreak(payload.userId, task.title);
    }

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

    const task = await prisma.dailyTask.findUnique({ where: { id } });
    if (!task || task.userId !== payload.userId) return notFound('Task');

    await prisma.dailyTask.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}

async function upsertStreak(userId: string, taskTitle: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const existing = await prisma.habitStreak.findUnique({
    where: { userId_taskTitle: { userId, taskTitle } },
  });

  if (!existing) {
    await prisma.habitStreak.create({
      data: { userId, taskTitle, currentStreak: 1, longestStreak: 1, lastCompleted: today },
    });
    return;
  }

  const lastDate = existing.lastCompleted ? new Date(existing.lastCompleted) : null;
  lastDate?.setHours(0, 0, 0, 0);

  const isConsecutive = lastDate?.getTime() === yesterday.getTime();
  const alreadyDoneToday = lastDate?.getTime() === today.getTime();

  if (alreadyDoneToday) return;

  const newStreak = isConsecutive ? existing.currentStreak + 1 : 1;

  await prisma.habitStreak.update({
    where: { userId_taskTitle: { userId, taskTitle } },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, existing.longestStreak),
      lastCompleted: today,
    },
  });
}
