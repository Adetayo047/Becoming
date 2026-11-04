import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';
import { sendEmail, generateVerificationCode } from '@/app/lib/email';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return err('User not found', 404);
    if (user.emailVerified) return ok({ emailVerified: true });

    const verificationCode = generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode, verificationCodeExpiry },
    });

    const { sent } = await sendEmail(
      user.email,
      'Your new Becoming verification code',
      `<p>Your verification code is <strong>${verificationCode}</strong>. It expires in 15 minutes.</p>`
    );

    return ok({
      emailSent: sent,
      ...(sent ? {} : { devVerificationCode: verificationCode }),
    });
  } catch (e) {
    return serverError(e);
  }
}
