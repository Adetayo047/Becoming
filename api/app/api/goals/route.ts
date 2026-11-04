import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, created, err, unauthorized, serverError } from '@/app/lib/response';
import { currentMonthKey, todayKey, mondayOfWeek } from '@/app/lib/dates';
import { getLimits, upgradeRequired } from '@/app/lib/plans';

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
        milestones: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        // Current period only — future months/weeks planned ahead in the
        // planner mustn't show up as "this month"/"this week".
        yearlyTargets: { where: { year: new Date().getFullYear() }, orderBy: { createdAt: 'asc' } },
        monthlyTargets: { where: { month: currentMonthKey() }, orderBy: { createdAt: 'asc' } },
        weeklyFocuses: { where: { weekStart: mondayOfWeek() }, orderBy: { createdAt: 'asc' } },
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
    const {
      title, description, category, targetDate, status,
      milestones, monthlyTarget, weeklyFocus, firstTask,
    } = body;

    if (!title || !category) {
      return err('title and category are required');
    }

    const limits = await getLimits(payload.userId);
    const activeGoals = await prisma.goal.count({ where: { userId: payload.userId, status: 'active' } });
    if ((status ?? 'active') === 'active' && activeGoals >= limits.goals) {
      return upgradeRequired(`The Free plan includes up to ${limits.goals} active goals. Upgrade to Pro for unlimited goals, or complete or pause one first.`);
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

    const now = new Date();

    // Milestones
    const validMilestones: string[] = Array.isArray(milestones)
      ? milestones.filter((m: string) => m?.trim().length > 2)
      : [];
    if (validMilestones.length > 0) {
      await prisma.milestone.createMany({
        // 1ms apart so the list keeps the order it was given in.
        data: validMilestones.map((title, i) => ({ goalId: goal.id, title: title.trim(), createdAt: new Date(Date.now() + i) })),
      });
    }

    // Monthly target
    if (monthlyTarget?.trim()) {
      await prisma.monthlyTarget.create({
        data: { goalId: goal.id, month: currentMonthKey(now), title: monthlyTarget.trim() },
      });
    }

    // Weekly focus
    if (weeklyFocus?.trim()) {
      await prisma.weeklyFocus.create({
        data: { goalId: goal.id, weekStart: mondayOfWeek(now), title: weeklyFocus.trim() },
      });
    }

    // First daily task
    if (firstTask?.trim()) {
      await prisma.dailyTask.create({
        data: {
          userId: payload.userId,
          goalId: goal.id,
          title: firstTask.trim(),
          date: new Date(todayKey(now) + 'T12:00:00Z'),
        },
      });
    }

    return created(goal);
  } catch (e) {
    return serverError(e);
  }
}
