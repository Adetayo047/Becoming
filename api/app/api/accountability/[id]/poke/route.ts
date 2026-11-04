import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { notifyUser } from '@/app/lib/push';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours — enough to be a nudge, not spam
const MAX_MESSAGE_LENGTH = 140;

// A lightweight, direct accountability nudge — the thing missing between
// "see your partner's activity" and actually reaching out. `message` is
// optional: either the sender's own real words, or a generic canned line if
// left blank — never anything invented and attributed to them.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const row = await prisma.accountabilityPartner.findUnique({ where: { id } });
    if (!row || (row.userId !== payload.userId && row.partnerUserId !== payload.userId)) {
      return notFound('Partnership');
    }
    if (row.status !== 'active') {
      return err('You can only poke an active accountability partner', 400);
    }

    const iAmUser = row.userId === payload.userId;
    const targetUserId = iAmUser ? row.partnerUserId : row.userId;
    const lastPokedAt = iAmUser ? row.userLastPokedAt : row.partnerLastPokedAt;

    if (lastPokedAt && Date.now() - lastPokedAt.getTime() < COOLDOWN_MS) {
      const minutesLeft = Math.ceil((COOLDOWN_MS - (Date.now() - lastPokedAt.getTime())) / 60_000);
      return err(`You can poke them again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}`, 429);
    }

    const body = await req.json().catch(() => ({}));
    let message: string | undefined = body.message?.trim();
    if (message && message.length > MAX_MESSAGE_LENGTH) {
      return err(`Keep it under ${MAX_MESSAGE_LENGTH} characters`);
    }

    const sender = await prisma.user.findUnique({ where: { id: payload.userId }, select: { fullName: true } });
    const senderFirstName = sender?.fullName?.trim().split(/\s+/)[0] || 'Your partner';

    await prisma.accountabilityPartner.update({
      where: { id },
      data: iAmUser ? { userLastPokedAt: new Date() } : { partnerLastPokedAt: new Date() },
    });

    const pokeBody = message || `${senderFirstName} is cheering you on — keep going today!`;
    await prisma.partnerMessage.create({
      data: { partnershipId: id, senderId: payload.userId, kind: 'poke', body: pokeBody },
    });

    await notifyUser(
      targetUserId,
      'accountability',
      `👊 ${senderFirstName} poked you`,
      pokeBody,
      `/partner/${id}`
    );

    return ok({ poked: true });
  } catch (e) {
    return serverError(e);
  }
}
