import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, unauthorized, serverError } from '@/app/lib/response';

// A plain heuristic, not an LLM call: match score is based on overlap between
// the two users' active-goal categories. Everyone gets a 50% floor so a
// sparse-data cold start doesn't produce awkward near-zero scores; overlap
// adds up to 50 more. This intentionally does NOT fabricate bios/quotes for
// real users — only real data (their category tags) is shown.
export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const [myGoals, existingPartnerships] = await Promise.all([
      prisma.goal.findMany({ where: { userId: payload.userId, status: 'active' }, select: { category: true } }),
      prisma.accountabilityPartner.findMany({
        where: { OR: [{ userId: payload.userId }, { partnerUserId: payload.userId }] },
      }),
    ]);

    const myCategories = new Set(myGoals.map((g) => g.category));
    const excludedIds = new Set<string>([payload.userId]);
    for (const p of existingPartnerships) {
      excludedIds.add(p.userId === payload.userId ? p.partnerUserId : p.userId);
    }

    const candidates = await prisma.user.findMany({
      // "Only Me" and "Trusted Connections" visibility keep a user out of
      // strangers' discovery results — only "Community" opts in to being
      // surfaced here (see User.progressVisibility, set via Settings).
      where: { id: { notIn: Array.from(excludedIds) }, progressVisibility: 'community' },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        goals: { where: { status: 'active' }, select: { category: true, title: true } },
      },
      take: 50,
    });

    const scored = candidates
      .map((c) => {
        const theirCategories = new Set(c.goals.map((g) => g.category));
        const overlap = [...myCategories].filter((cat) => theirCategories.has(cat));
        const overlapRatio = myCategories.size > 0 ? overlap.length / myCategories.size : 0;
        const matchScore = Math.round(50 + 50 * overlapRatio);

        return {
          id: c.id,
          fullName: c.fullName,
          email: c.email,
          avatarUrl: c.avatarUrl,
          matchScore,
          growthAreas: [...theirCategories],
          activeGoalCount: c.goals.length,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    return ok(scored);
  } catch (e) {
    return serverError(e);
  }
}
