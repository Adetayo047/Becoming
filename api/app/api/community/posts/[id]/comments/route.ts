import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getCircleUserIds } from '@/app/lib/community';
import { ok, created, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

async function assertVisible(userId: string, postId: string) {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post) return null;
  const circle = await getCircleUserIds(userId);
  if (!circle.includes(post.userId)) return null;
  return post;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const post = await assertVisible(payload.userId, id);
    if (!post) return notFound('Post');

    const comments = await prisma.postComment.findMany({
      where: { postId: id },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return ok(comments);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const post = await assertVisible(payload.userId, id);
    if (!post) return notFound('Post');

    const { body } = await req.json();
    if (!body || !body.trim()) return err('body is required');

    const comment = await prisma.postComment.create({
      data: { postId: id, userId: payload.userId, body: body.trim() },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    return created(comment);
  } catch (e) {
    return serverError(e);
  }
}
