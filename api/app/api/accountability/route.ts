import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, created, err, unauthorized, serverError } from '@/app/lib/response';
import { getTier, LIMITS, upgradeRequired, countPartnerships } from '@/app/lib/plans';

// A partnership row is created with the inviter as `userId` and the invitee
// as `partnerUserId`. Either side can appear as either role depending on who
// invited whom, so we always look up both directions and report the *other*
// party from the current user's perspective.
export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const rows = await prisma.accountabilityPartner.findMany({
      where: { OR: [{ userId: payload.userId }, { partnerUserId: payload.userId }] },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        partner: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const partnerships = await Promise.all(
      rows.map(async (row) => {
        const iInvited = row.userId === payload.userId;
        const other = iInvited ? row.partner : row.user;

        const [activeGoals, tasksCompletedRecently] = await Promise.all([
          prisma.goal.count({ where: { userId: other.id, status: 'active' } }),
          prisma.dailyTask.count({
            where: { userId: other.id, completed: true, date: { gte: fourteenDaysAgo } },
          }),
        ]);

        return {
          id: row.id,
          status: row.status,
          iInvited,
          partner: other,
          activeGoals,
          tasksCompletedRecently,
          createdAt: row.createdAt,
        };
      })
    );

    return ok(partnerships);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { partnerEmail } = await req.json();
    if (!partnerEmail) return err('partnerEmail is required');

    const email = partnerEmail.trim().toLowerCase();
    if (email === payload.email.toLowerCase()) {
      return err("You can't invite yourself");
    }

    const partnerUser = await prisma.user.findUnique({ where: { email } });
    if (!partnerUser) {
      return err('No Becoming account found for that email — they need to sign up first', 404);
    }

    const existing = await prisma.accountabilityPartner.findFirst({
      where: {
        OR: [
          { userId: payload.userId, partnerUserId: partnerUser.id },
          { userId: partnerUser.id, partnerUserId: payload.userId },
        ],
      },
    });
    if (existing) return err('You already have a pending or active partnership with this person');

    const tier = await getTier(payload.userId);
    if ((await countPartnerships(payload.userId)) >= LIMITS[tier].partners) {
      return upgradeRequired(
        tier === 'free'
          ? 'The Free plan includes 1 accountability partner. Upgrade to Pro for up to 3.'
          : 'Pro includes up to 3 accountability partners. Upgrade to Plus for unlimited partners.',
        tier === 'free' ? 'pro' : 'plus'
      );
    }

    const partnership = await prisma.accountabilityPartner.create({
      data: { userId: payload.userId, partnerUserId: partnerUser.id, status: 'pending' },
      include: {
        partner: { select: { id: true, fullName: true, email: true } },
      },
    });

    return created(partnership);
  } catch (e) {
    return serverError(e);
  }
}
