import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';

// Logged when the user dismisses the incoming-call screen without
// answering — no OpenAI call happens, just a lightweight history row.
export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const call = await prisma.voiceCallSession.create({
      data: { userId: payload.userId, status: 'declined', scheduledFor: new Date(), endedAt: new Date() },
    });

    return ok(call);
  } catch (e) {
    return serverError(e);
  }
}
