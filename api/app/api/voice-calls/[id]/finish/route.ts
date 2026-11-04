import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ['completed', 'missed', 'failed'] as const;

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const call = await prisma.voiceCallSession.findUnique({ where: { id } });
    if (!call || call.userId !== payload.userId) return notFound('Voice call session');

    const { status } = await req.json().catch(() => ({ status: 'completed' }));
    if (status && !VALID_STATUSES.includes(status)) {
      return err('status must be one of ' + VALID_STATUSES.join(', '));
    }

    const updated = await prisma.voiceCallSession.update({
      where: { id },
      data: { status: status ?? 'completed', endedAt: new Date() },
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
