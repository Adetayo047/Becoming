import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { hashPassword, signToken } from '@/app/lib/auth';
import { ok, err, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password || !fullName) {
      return err('email, password, and fullName are required');
    }

    if (password.length < 8) {
      return err('Password must be at least 8 characters');
    }

    const emailLower = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      return err('An account with this email already exists', 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        fullName: fullName.trim(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        tier: true,
        onboardingComplete: true,
        createdAt: true,
      },
    });

    const token = signToken({ userId: user.id, email: user.email });

    return ok({ token, user }, 201);
  } catch (e) {
    return serverError(e);
  }
}
