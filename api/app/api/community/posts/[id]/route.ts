import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getCircleUserIds } from '@/app/lib/community';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const post = await prisma.communityPost.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        goal: { select: { id: true, title: true, category: true } },
        reactions: true,
        comments: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!post) return notFound('Post');

    const circle = await getCircleUserIds(payload.userId);
    if (!circle.includes(post.userId)) return notFound('Post');

    const reactionCounts: Record<string, number> = {};
    let myReaction: string | null = null;
    for (const r of post.reactions) {
      reactionCounts[r.type] = (reactionCounts[r.type] ?? 0) + 1;
      if (r.userId === payload.userId) myReaction = r.type;
    }

    return ok({
      id: post.id,
      kind: post.kind,
      headline: post.headline,
      body: post.body,
      createdAt: post.createdAt,
      user: post.user,
      goal: post.goal ? { id: post.goal.id, title: post.goal.title, category: post.goal.category } : null,
      reactionCounts,
      myReaction,
      comments: post.comments,
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const post = await prisma.communityPost.findUnique({ where: { id } });
    if (!post || post.userId !== payload.userId) return notFound('Post');

    const { headline, body, kind } = await req.json();
    if (kind !== undefined && !['milestone', 'achievement', 'small_win'].includes(kind)) {
      return err('kind must be one of milestone, achievement, small_win');
    }
    if (headline !== undefined && !headline.trim()) return err('headline cannot be empty');

    const updated = await prisma.communityPost.update({
      where: { id },
      data: {
        ...(headline !== undefined && { headline: headline.trim() }),
        ...(body !== undefined && { body: body?.trim() || null }),
        ...(kind !== undefined && { kind }),
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        goal: { select: { id: true, title: true, category: true } },
        reactions: true,
        _count: { select: { comments: true } },
      },
    });

    const reactionCounts: Record<string, number> = {};
    let myReaction: string | null = null;
    for (const r of updated.reactions) {
      reactionCounts[r.type] = (reactionCounts[r.type] ?? 0) + 1;
      if (r.userId === payload.userId) myReaction = r.type;
    }

    return ok({
      id: updated.id,
      kind: updated.kind,
      headline: updated.headline,
      body: updated.body,
      createdAt: updated.createdAt,
      user: updated.user,
      goal: updated.goal ? { id: updated.goal.id, title: updated.goal.title, category: updated.goal.category } : null,
      reactionCounts,
      myReaction,
      commentCount: updated._count.comments,
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const post = await prisma.communityPost.findUnique({ where: { id } });
    if (!post || post.userId !== payload.userId) return notFound('Post');

    await prisma.communityPost.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
