import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';
import { isDemoPayments } from '@/app/lib/billing';

// Paid tiers require a real charge — until PAYSTACK_SECRET_KEY is set, this
// route refuses rather than silently granting a paid tier for free (or
// pretending a card was charged when none was). Only the free tier can be
// set with no payment involved, unless DEMO_PAYMENTS=true is set explicitly
// for testing, in which case the client runs a labelled demo checkout.
export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { tier } = await req.json();
    if (!tier || !['free', 'pro', 'plus'].includes(tier)) {
      return err('tier must be one of free, pro, plus');
    }

    if (tier !== 'free' && !process.env.PAYSTACK_SECRET_KEY && !isDemoPayments()) {
      return err(
        'Payments are not set up yet, so upgrading would charge nothing and grant a paid tier for free — not allowed. Once Paystack is configured this will process a real payment.',
        503
      );
    }

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: { tier },
      select: { id: true, tier: true },
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
