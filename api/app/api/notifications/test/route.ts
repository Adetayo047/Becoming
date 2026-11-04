import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { sendPushNotification } from '@/app/lib/push';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.pushToken) {
      return err('No push token registered yet — enable notifications first', 400);
    }

    const result = await sendPushNotification(
      user.pushToken,
      'Becoming 👋',
      'This is a test notification — push is working!'
    );

    if (!result.ok) return err(result.error ?? 'Could not send notification', 502);
    return ok({ sent: true });
  } catch (e) {
    return serverError(e);
  }
}
