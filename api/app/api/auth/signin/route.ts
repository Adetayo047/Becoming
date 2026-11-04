import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { comparePassword, signToken } from '@/app/lib/auth';
import { ok, err, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return err('email and password are required');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return err('Invalid email or password', 401);
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return err('Invalid email or password', 401);
    }

    // Signing in is how a deactivated account comes back.
    const reactivated = !!user.deactivatedAt;
    if (reactivated) await prisma.user.update({ where: { id: user.id }, data: { deactivatedAt: null } });

    const token = signToken({ userId: user.id, email: user.email });

    return ok({
      token,
      reactivated,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tier: user.tier,
        onboardingComplete: user.onboardingComplete,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
