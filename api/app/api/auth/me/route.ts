import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, notFound, serverError } from '@/app/lib/response';

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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

    if (!user) return notFound('User');
    return ok(user);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const body = await req.json();
    const { fullName, onboardingComplete, pushToken } = body;

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(onboardingComplete !== undefined && { onboardingComplete }),
        ...(pushToken !== undefined && { pushToken }),
      },
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

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
