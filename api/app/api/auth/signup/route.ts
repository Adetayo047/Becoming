import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { hashPassword, signToken } from '@/app/lib/auth';
import { ok, err, serverError } from '@/app/lib/response';
import { sendEmail, generateVerificationCode } from '@/app/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, termsAccepted } = await req.json();

    if (!email || !password || !fullName) {
      return err('email, password, and fullName are required');
    }

    if (!termsAccepted) {
      return err('You must accept the Terms of Service and Privacy Policy to create an account');
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
    const verificationCode = generateVerificationCode();
    const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    const user = await prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        fullName: fullName.trim(),
        termsAcceptedAt: new Date(),
        emailVerified: false,
        verificationCode,
        verificationCodeExpiry,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        tier: true,
        onboardingComplete: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    const { sent } = await sendEmail(
      user.email,
      'Verify your Becoming account',
      `<p>Your verification code is <strong>${verificationCode}</strong>. It expires in 15 minutes.</p>`
    );

    const token = signToken({ userId: user.id, email: user.email });

    return ok(
      {
        token,
        user,
        emailSent: sent,
        // The email wasn't delivered (no provider configured, or the send
        // failed — see app/lib/email.ts). This is a brand-new, not-yet-verified
        // account the requester just created themselves, so surfacing the code
        // here (instead of only logging it server-side, as the password-reset
        // flow does) keeps signup usable. Once delivery works, `sent` is true
        // and this field is omitted.
        ...(sent ? {} : { devVerificationCode: verificationCode }),
      },
      201
    );
  } catch (e) {
    return serverError(e);
  }
}
