import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

async function assertMember(userId: string, groupId: string) {
  const membership = await prisma.communityGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return Boolean(membership);
}

// Polling endpoint — no WebSocket infra in this stack. Pass ?since=<ISO
// timestamp> to fetch only messages newer than the last poll; omit it for
// the initial full load (most recent 100).
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    if (!(await assertMember(payload.userId, id))) return notFound('Group');

    const since = req.nextUrl.searchParams.get('since');

    const messages = await prisma.communityMessage.findMany({
      where: { groupId: id, ...(since && { createdAt: { gt: new Date(since) } }) },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
      ...(!since && { take: 100 }),
    });

    return ok(messages);
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    if (!(await assertMember(payload.userId, id))) return notFound('Group');

    const { body } = await req.json();
    if (!body || !body.trim()) return err('body is required');

    const message = await prisma.communityMessage.create({
      data: { groupId: id, userId: payload.userId, body: body.trim() },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    return ok(message);
  } catch (e) {
    return serverError(e);
  }
}
