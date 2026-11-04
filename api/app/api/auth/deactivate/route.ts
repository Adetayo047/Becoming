import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';

// "Deactivate instead": keep everything, pause scheduled nudges and wake-up
// calls (the scheduler skips deactivated users). Signing in reactivates.
export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    await prisma.user.update({ where: { id: payload.userId }, data: { deactivatedAt: new Date() } });
    return ok({ deactivated: true });
  } catch (e) {
    return serverError(e);
  }
}
