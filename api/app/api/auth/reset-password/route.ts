import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/app/lib/prisma';
import { hashPassword } from '@/app/lib/auth';
import { ok, err, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword) return err('token and newPassword are required');
    if (newPassword.length < 8) return err('New password must be at least 8 characters');

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: { resetToken: hashedToken, resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) return err('This reset link is invalid or has expired', 400);

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });

    return ok({ reset: true });
  } catch (e) {
    return serverError(e);
  }
}
