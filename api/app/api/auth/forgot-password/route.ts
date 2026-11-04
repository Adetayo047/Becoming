import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/app/lib/prisma';
import { ok, err, serverError } from '@/app/lib/response';

// No email provider is wired up yet (needs e.g. Resend/SendGrid + a verified
// sending domain). Until then, the reset link is logged server-side instead
// of emailed — the flow (token generation, expiry, validation) is real, only
// delivery is a stand-in.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return err('email is required');

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

    // Always respond the same way whether or not the account exists, so this
    // endpoint can't be used to enumerate registered emails.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: hashedToken, resetTokenExpiry: expiry },
      });

      // TODO: send this via an email provider once one is configured.
      console.log(`[password reset] ${user.email} -> token: ${rawToken} (expires ${expiry.toISOString()})`);
    }

    return ok({ sent: true });
  } catch (e) {
    return serverError(e);
  }
}
