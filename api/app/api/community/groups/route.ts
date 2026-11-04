import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getLimits, upgradeRequired } from '@/app/lib/plans';
import { ok, created, err, unauthorized, serverError } from '@/app/lib/response';

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const groups = await prisma.communityGroup.findMany({
      where: { members: { some: { userId: payload.userId } } },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        createdAt: g.createdAt,
        members: g.members.map((m) => m.user),
        messageCount: g._count.messages,
      }))
    );
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    if (!(await getLimits(payload.userId)).createGroups) {
      return upgradeRequired('Creating group accountability circles is a Plus feature. You can still join groups others create.', 'plus');
    }

    const { name, memberEmails } = await req.json();
    if (!name || !name.trim()) return err('name is required');

    const emails: string[] = Array.isArray(memberEmails)
      ? memberEmails.map((e: string) => e.trim().toLowerCase()).filter(Boolean)
      : [];

    const foundUsers = await prisma.user.findMany({ where: { email: { in: emails } } });
    const foundEmails = new Set(foundUsers.map((u) => u.email));
    const notFound = emails.filter((e) => !foundEmails.has(e) && e !== payload.email.toLowerCase());

    const memberIds = new Set<string>([payload.userId, ...foundUsers.map((u) => u.id)]);

    const group = await prisma.communityGroup.create({
      data: {
        name: name.trim(),
        createdBy: payload.userId,
        members: { create: [...memberIds].map((userId) => ({ userId })) },
      },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      },
    });

    return created({
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      members: group.members.map((m) => m.user),
      ...(notFound.length > 0 && { skippedEmails: notFound }),
    });
  } catch (e) {
    return serverError(e);
  }
}
