import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { code } = await req.json();
    if (!code) return err('code is required');

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return err('User not found', 404);

    if (user.emailVerified) {
      return ok({ emailVerified: true });
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      return err('No verification code pending — request a new one');
    }

    if (user.verificationCodeExpiry < new Date()) {
      return err('This code has expired — request a new one');
    }

    if (user.verificationCode !== String(code).trim()) {
      return err('Incorrect code');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationCode: null, verificationCodeExpiry: null },
    });

    return ok({ emailVerified: true });
  } catch (e) {
    return serverError(e);
  }
}
