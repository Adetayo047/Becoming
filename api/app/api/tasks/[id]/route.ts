import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { notifyUser } from '@/app/lib/push';
import { todayKey } from '@/app/lib/dates';
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
    const { completed, title, scheduledStart, scheduledEnd, blockType, order, goalId } = body;

    if (goalId) {
      const goal = await prisma.goal.findUnique({ where: { id: goalId } });
      if (!goal || goal.userId !== payload.userId) return notFound('Goal');
    }

    const updated = await prisma.dailyTask.update({
      where: { id },
      data: {
        ...(completed !== undefined && {
          completed,
          completedAt: completed ? new Date() : null,
        }),
        ...(title !== undefined && { title: title.trim() }),
        ...(scheduledStart !== undefined && { scheduledStart }),
        ...(scheduledEnd !== undefined && { scheduledEnd }),
        ...(blockType !== undefined && { blockType }),
        ...(order !== undefined && { order }),
        ...(goalId !== undefined && { goalId }),
      },
      include: {
        goal: { select: { title: true, category: true } },
      },
    });

    // Update habit streak to match the toggle
    if (completed === true) {
      await upsertStreak(payload.userId, task.title);
      await celebrateIfAllDoneToday(payload.userId);
    } else if (completed === false) {
      await revertStreakIfToday(payload.userId, task.title);
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

// Sends a celebratory push the moment every one of today's tasks is complete.
async function celebrateIfAllDoneToday(userId: string) {
  const todaysTasks = await prisma.dailyTask.findMany({
    where: { userId, date: new Date(todayKey() + 'T12:00:00Z') },
  });
  if (todaysTasks.length === 0) return;

  const allDone = todaysTasks.every((t) => t.completed);
  if (!allDone) return;

  await notifyUser(
    userId,
    'system',
    '🎉 All done for today!',
    `You completed all ${todaysTasks.length} of today's tasks. Keep the streak going.`
  );
}

// Undo the increment when a task completed today gets unmarked. We don't
// track full completion history, so we can't reliably restore a prior
// streak length beyond today — just back it off by one and clear
// lastCompleted, rather than leaving a streak that no longer matches reality.
async function revertStreakIfToday(userId: string, taskTitle: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.habitStreak.findUnique({
    where: { userId_taskTitle: { userId, taskTitle } },
  });
  if (!existing || !existing.lastCompleted) return;

  const lastDate = new Date(existing.lastCompleted);
  lastDate.setHours(0, 0, 0, 0);
  if (lastDate.getTime() !== today.getTime()) return;

  await prisma.habitStreak.update({
    where: { userId_taskTitle: { userId, taskTitle } },
    data: {
      currentStreak: Math.max(0, existing.currentStreak - 1),
      lastCompleted: null,
    },
  });
}
