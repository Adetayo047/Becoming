import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleCalendarConnected: false,
      },
    });

    return ok({ disconnected: true });
  } catch (e) {
    return serverError(e);
  }
}
