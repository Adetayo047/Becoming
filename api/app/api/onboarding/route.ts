import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';
import { currentMonthKey, todayKey, mondayOfWeek } from '@/app/lib/dates';

// Called after onboarding step 3 — creates first goal + milestones, marks user done
export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { goalTitle, goalCategory, milestones, monthlyTarget, weeklyFocus, firstTask } =
      await req.json();

    if (!goalTitle || !goalCategory) {
      return err('goalTitle and goalCategory are required');
    }

    const now = new Date();
    const month = currentMonthKey(now);
    const today = todayKey(now);
    const monday = mondayOfWeek(now);

    // 1. Create goal
    const goal = await prisma.goal.create({
      data: {
        userId: payload.userId,
        title: goalTitle.trim(),
        category: goalCategory,
        status: 'active',
      },
    });

    // 2. Milestones
    const validMilestones: string[] = Array.isArray(milestones)
      ? milestones.filter((m: string) => m?.trim().length > 2)
      : [];

    if (validMilestones.length > 0) {
      await prisma.milestone.createMany({
        // 1ms apart so the list keeps the order it was given in.
        data: validMilestones.map((title, i) => ({ goalId: goal.id, title: title.trim(), createdAt: new Date(Date.now() + i) })),
      });
    }

    // 3. Monthly target
    if (monthlyTarget?.trim()) {
      await prisma.monthlyTarget.create({
        data: { goalId: goal.id, month, title: monthlyTarget.trim() },
      });
    }

    // 4. Weekly focus
    if (weeklyFocus?.trim()) {
      await prisma.weeklyFocus.create({
        data: { goalId: goal.id, weekStart: monday, title: weeklyFocus.trim() },
      });
    }

    // 5. First daily task
    if (firstTask?.trim()) {
      await prisma.dailyTask.create({
        data: {
          userId: payload.userId,
          goalId: goal.id,
          title: firstTask.trim(),
          date: new Date(today + 'T12:00:00Z'),
        },
      });
    }

    // 6. Mark onboarding complete
    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: { onboardingComplete: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        tier: true,
        onboardingComplete: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return ok({ user: updatedUser, goal });
  } catch (e) {
    return serverError(e);
  }
}
