import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { notifyUser } from '@/app/lib/push';
import { created, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

const MAX_LENGTH = 280;
const DAILY_LIMIT = 30;

// Send a check-in note / word of encouragement to your accountability partner.
// Unlike a poke there's no cooldown, just a daily cap so it can't be spammed.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const row = await prisma.accountabilityPartner.findUnique({ where: { id } });
    if (!row || (row.userId !== payload.userId && row.partnerUserId !== payload.userId)) {
      return notFound('Partnership');
    }
    if (row.status !== 'active') return err('Your partner needs to accept the invite first');

    const { body } = await req.json().catch(() => ({}));
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) return err('Write a message first');
    if (text.length > MAX_LENGTH) return err(`Keep it under ${MAX_LENGTH} characters`);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await prisma.partnerMessage.count({
      where: { partnershipId: id, senderId: payload.userId, createdAt: { gte: since } },
    });
    if (sentToday >= DAILY_LIMIT) return err("You've sent a lot today — let them catch up!", 429);

    const message = await prisma.partnerMessage.create({
      data: { partnershipId: id, senderId: payload.userId, kind: 'note', body: text },
      include: { sender: { select: { id: true, fullName: true } } },
    });

    const firstName = message.sender.fullName?.trim().split(/\s+/)[0] || 'Your partner';
    await notifyUser(
      row.userId === payload.userId ? row.partnerUserId : row.userId,
      'accountability',
      `💬 ${firstName} sent you encouragement`,
      text,
      `/partner/${id}`
    );

    return created({ ...message, mine: true });
  } catch (e) {
    return serverError(e);
  }
}
