import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest, comparePassword, hashPassword } from '@/app/lib/auth';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

export async function PATCH(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return err('currentPassword and newPassword are required');
    }
    if (newPassword.length < 8) {
      return err('New password must be at least 8 characters');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return notFound('User');

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) return err('Current password is incorrect', 401);

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash },
    });

    return ok({ updated: true });
  } catch (e) {
    return serverError(e);
  }
}
