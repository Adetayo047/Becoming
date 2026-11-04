import { prisma } from '@/app/lib/prisma';

// The user's "circle" for feed visibility: themselves plus anyone they have
// an ACTIVE accountability partnership with (either direction).
export async function getCircleUserIds(userId: string): Promise<string[]> {
  const partnerships = await prisma.accountabilityPartner.findMany({
    where: {
      status: 'active',
      OR: [{ userId }, { partnerUserId: userId }],
    },
  });

  const partnerIds = partnerships.map((p) => (p.userId === userId ? p.partnerUserId : p.userId));
  return [userId, ...partnerIds];
}
