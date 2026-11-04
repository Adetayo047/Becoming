import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest, comparePassword } from '@/app/lib/auth';
import { getLimits, upgradeRequired } from '@/app/lib/plans';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

const SELECT = {
  id: true,
  email: true,
  fullName: true,
  tier: true,
  onboardingComplete: true,
  avatarUrl: true,
  notificationsEnabled: true,
  nudgeFrequency: true,
  stoicMode: true,
  googleCalendarConnected: true,
  emailVerified: true,
  aiPersonality: true,
  focusHoursStart: true,
  focusHoursEnd: true,
  progressVisibility: true,
  wakeUpCallEnabled: true,
  wakeUpCallTime: true,
  utcOffsetMinutes: true,
  createdAt: true,
} as const;

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: SELECT,
    });

    if (!user) return notFound('User');
    return ok(user);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const body = await req.json();
    const {
      fullName,
      onboardingComplete,
      pushToken,
      notificationsEnabled,
      nudgeFrequency,
      stoicMode,
      aiPersonality,
      focusHoursStart,
      focusHoursEnd,
      progressVisibility,
      wakeUpCallEnabled,
      wakeUpCallTime,
      utcOffsetMinutes,
    } = body;

    if (wakeUpCallEnabled === true && !(await getLimits(payload.userId)).premiumAi) {
      return upgradeRequired('The voice wake-up call is a Pro feature. Upgrade to unlock it.');
    }

    if (wakeUpCallTime !== undefined && wakeUpCallTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(wakeUpCallTime)) {
      return err('wakeUpCallTime must be "HH:MM" (24h)');
    }

    const validPersonalities = ['encouraging', 'stoic', 'visionary', 'direct', 'analytical'];
    if (aiPersonality !== undefined && !validPersonalities.includes(aiPersonality)) {
      return err('aiPersonality must be one of ' + validPersonalities.join(', '));
    }
    const validVisibilities = ['only_me', 'trusted', 'community'];
    if (progressVisibility !== undefined && !validVisibilities.includes(progressVisibility)) {
      return err('progressVisibility must be one of ' + validVisibilities.join(', '));
    }

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(onboardingComplete !== undefined && { onboardingComplete }),
        ...(pushToken !== undefined && { pushToken }),
        ...(notificationsEnabled !== undefined && { notificationsEnabled }),
        ...(nudgeFrequency !== undefined && { nudgeFrequency }),
        ...(stoicMode !== undefined && { stoicMode }),
        ...(aiPersonality !== undefined && { aiPersonality }),
        ...(focusHoursStart !== undefined && { focusHoursStart }),
        ...(focusHoursEnd !== undefined && { focusHoursEnd }),
        ...(progressVisibility !== undefined && { progressVisibility }),
        ...(wakeUpCallEnabled !== undefined && { wakeUpCallEnabled }),
        ...(wakeUpCallTime !== undefined && { wakeUpCallTime }),
        ...(utcOffsetMinutes !== undefined && { utcOffsetMinutes }),
      },
      select: SELECT,
    });

    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

// Permanently delete the account. Every user-owned row (goals, tasks, plans,
// partnerships, posts, messages…) cascades with it. Needs the password so a
// borrowed unlocked phone can't wipe someone's history.
export async function DELETE(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { password } = await req.json().catch(() => ({}));
    if (typeof password !== 'string' || !password) return err('Enter your password to confirm');

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { passwordHash: true } });
    if (!user) return notFound('User');
    if (!(await comparePassword(password, user.passwordHash))) return err('That password is incorrect', 401);

    await prisma.user.delete({ where: { id: payload.userId } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
