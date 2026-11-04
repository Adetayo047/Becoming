import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';
import { isDemoPayments } from '@/app/lib/billing';
import { PLANS } from '@/app/lib/plans';

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    return ok({
      currentTier: user?.tier ?? 'free',
      plans: PLANS,
      // No real payment processor configured yet — the `paystackConfigured`
      // flag lets the client show "billing is UI-only for now" honestly
      // instead of pretending a card is on file.
      paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      demoPayments: isDemoPayments(),
    });
  } catch (e) {
    return serverError(e);
  }
}
