import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

const VALID_CATEGORIES = ['ai_architect', 'accountability', 'system'];

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const category = req.nextUrl.searchParams.get('category');
    if (category && !VALID_CATEGORIES.includes(category)) {
      return err(`category must be one of ${VALID_CATEGORIES.join(', ')}`);
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: payload.userId, ...(category && { category: category as any }) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return ok(notifications);
  } catch (e) {
    return serverError(e);
  }
}

// Body: { id: string } to mark one read, or { clearAll: true } to delete everything.
export async function PATCH(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { id, clearAll } = await req.json();

    if (clearAll) {
      await prisma.notification.deleteMany({ where: { userId: payload.userId } });
      return ok({ cleared: true });
    }

    if (!id) return err('id or clearAll is required');

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== payload.userId) return err('Notification not found', 404);

    const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
