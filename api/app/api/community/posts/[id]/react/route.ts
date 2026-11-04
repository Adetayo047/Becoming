import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getCircleUserIds } from '@/app/lib/community';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

const VALID_TYPES = ['celebration', 'favorite', 'fire', 'thumbs_up'];

// Posting a reaction toggles it: same type again removes it, a different
// type replaces it (one reaction per user per post, matching the DB's
// unique(postId, userId) constraint).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const { type } = await req.json();
    if (!type || !VALID_TYPES.includes(type)) {
      return err(`type must be one of ${VALID_TYPES.join(', ')}`);
    }

    const post = await prisma.communityPost.findUnique({ where: { id } });
    if (!post) return notFound('Post');

    const circle = await getCircleUserIds(payload.userId);
    if (!circle.includes(post.userId)) return notFound('Post');

    const existing = await prisma.postReaction.findUnique({
      where: { postId_userId: { postId: id, userId: payload.userId } },
    });

    if (existing && existing.type === type) {
      await prisma.postReaction.delete({ where: { id: existing.id } });
      return ok({ reaction: null });
    }

    const reaction = await prisma.postReaction.upsert({
      where: { postId_userId: { postId: id, userId: payload.userId } },
      create: { postId: id, userId: payload.userId, type },
      update: { type },
    });

    return ok({ reaction: reaction.type });
  } catch (e) {
    return serverError(e);
  }
}
