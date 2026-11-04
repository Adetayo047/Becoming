import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { ok, created, err, unauthorized, notFound, serverError } from '@/app/lib/response';

type Params = { params: Promise<{ id: string }> };

async function assertOwned(userId: string, milestoneId: string) {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { goal: { select: { userId: true } } },
  });
  return milestone && milestone.goal.userId === userId ? milestone : null;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    const { id } = await params;

    const milestone = await assertOwned(payload.userId, id);
    if (!milestone) return notFound('Milestone');

    const { title, url } = await req.json();
    if (!title || !title.trim()) return err('title is required');
    if (!url || !/^https?:\/\//i.test(url.trim())) return err('url must be a valid http(s) link');

    const resource = await prisma.milestoneResource.create({
      data: { milestoneId: id, title: title.trim(), url: url.trim() },
    });

    return created(resource);
  } catch (e) {
    return serverError(e);
  }
}
