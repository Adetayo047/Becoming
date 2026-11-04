import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string; messageId: string }> };

// Heart (or un-heart) a message your partner sent you.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id, messageId } = await params;

    const message = await prisma.partnerMessage.findUnique({
      where: { id: messageId },
      include: { partnership: true },
    });
    const p = message?.partnership;
    if (!message || message.partnershipId !== id || !p || (p.userId !== payload.userId && p.partnerUserId !== payload.userId)) {
      return notFound('Message');
    }
    if (message.senderId === payload.userId) return err("You can't heart your own message", 403);

    const { liked } = await req.json().catch(() => ({}));
    const updated = await prisma.partnerMessage.update({
      where: { id: messageId },
      data: { liked: Boolean(liked) },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
