import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getCircleUserIds } from '@/app/lib/community';
import { ok, created, err, unauthorized, serverError } from '@/app/lib/response';

function summarizePost(post: any, viewerId: string) {
  const reactionCounts: Record<string, number> = {};
  let myReaction: string | null = null;
  for (const r of post.reactions) {
    reactionCounts[r.type] = (reactionCounts[r.type] ?? 0) + 1;
    if (r.userId === viewerId) myReaction = r.type;
  }
  return {
    id: post.id,
    kind: post.kind,
    headline: post.headline,
    body: post.body,
    createdAt: post.createdAt,
    user: post.user,
    goal: post.goal ? { id: post.goal.id, title: post.goal.title, category: post.goal.category } : null,
    reactionCounts,
    myReaction,
    commentCount: post._count.comments,
  };
}

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const circle = await getCircleUserIds(payload.userId);

    const posts = await prisma.communityPost.findMany({
      where: { userId: { in: circle } },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        goal: { select: { id: true, title: true, category: true } },
        reactions: true,
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return ok(posts.map((p) => summarizePost(p, payload.userId)));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { kind, headline, body, goalId } = await req.json();
    if (!kind || !['milestone', 'achievement', 'small_win'].includes(kind)) {
      return err('kind must be one of milestone, achievement, small_win');
    }
    if (!headline || !headline.trim()) return err('headline is required');

    if (goalId) {
      const goal = await prisma.goal.findUnique({ where: { id: goalId } });
      if (!goal || goal.userId !== payload.userId) return err('Invalid goalId');
    }

    const post = await prisma.communityPost.create({
      data: {
        userId: payload.userId,
        kind,
        headline: headline.trim(),
        body: body?.trim() || null,
        goalId: goalId ?? null,
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        goal: { select: { id: true, title: true, category: true } },
        reactions: true,
        _count: { select: { comments: true } },
      },
    });

    return created(summarizePost(post, payload.userId));
  } catch (e) {
    return serverError(e);
  }
}
