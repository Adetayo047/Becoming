import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: { tier: 'free' },
      select: { id: true, tier: true },
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
