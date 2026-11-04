import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const calls = await prisma.voiceCallSession.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, status: true, scheduledFor: true, startedAt: true, endedAt: true, createdAt: true },
    });

    return ok(calls);
  } catch (e) {
    return serverError(e);
  }
}
