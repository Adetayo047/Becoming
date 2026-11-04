import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { created, err, unauthorized, notFound, serverError } from '@/app/lib/response';
import { currentMonthKey, mondayOfWeek, parseDateKey, DATE_KEY, MONTH_KEY } from '@/app/lib/dates';

// Add a yearly outcome (kind: "yearly", period "YYYY"), monthly focus
// ("monthly", "YYYY-MM") or weekly milestone ("weekly", any "YYYY-MM-DD" in
// that week) to a goal. Without a period it goes on the current year/month/week.
export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { kind, goalId, title, period } = await req.json();
    if (kind !== 'yearly' && kind !== 'monthly' && kind !== 'weekly') return err('kind must be "yearly", "monthly" or "weekly"');
    if (typeof title !== 'string' || title.trim().length < 3) return err('title must be at least 3 characters');
    if (period !== undefined) {
      const valid = kind === 'yearly' ? /^\d{4}$/.test(String(period)) : kind === 'monthly' ? MONTH_KEY.test(period) : DATE_KEY.test(period);
      if (!valid) return err('invalid period');
    }

    const goal = await prisma.goal.findUnique({ where: { id: goalId ?? '' } });
    if (!goal || goal.userId !== payload.userId) return notFound('Goal');

    const now = new Date();
    const item =
      kind === 'yearly'
        ? await prisma.yearlyTarget.create({ data: { goalId, year: period ? Number(period) : now.getFullYear(), title: title.trim() } })
        : kind === 'monthly'
        ? await prisma.monthlyTarget.create({ data: { goalId, month: period ?? currentMonthKey(now), title: title.trim() } })
        : await prisma.weeklyFocus.create({ data: { goalId, weekStart: mondayOfWeek(period ? parseDateKey(period) : now), title: title.trim() } });

    return created(item);
  } catch (e) {
    return serverError(e);
  }
}
