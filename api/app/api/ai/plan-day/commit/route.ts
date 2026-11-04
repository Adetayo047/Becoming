import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getLimits, upgradeRequired } from '@/app/lib/plans';
import { todayKey } from '@/app/lib/dates';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

interface CommitBlock {
  taskId?: string | null;
  title: string;
  startTime: string;
  endTime: string;
  type?: string;
}

// Persists a schedule the user has approved (from /api/ai/plan-day, possibly
// hand-edited via Refine Your Plan). Existing tasks get their scheduled time
// filled in; blocks with no matching task (e.g. an AI-suggested break) become
// new DailyTask rows flagged aiGenerated so the UI can badge them.
export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    if (!(await getLimits(payload.userId)).premiumAi) {
      return upgradeRequired('Plan My Day is a Pro feature. Upgrade to unlock it.');
    }

    const body = await req.json();
    const date: string = body.date ?? todayKey();
    const blocks: CommitBlock[] = body.blocks;

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return err('blocks is required');
    }

    const dateValue = new Date(date + 'T12:00:00Z');

    const results = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b.title || !b.startTime || !b.endTime) continue;

      if (b.taskId) {
        const existing = await prisma.dailyTask.findUnique({ where: { id: b.taskId } });
        if (!existing || existing.userId !== payload.userId) continue;
        const updated = await prisma.dailyTask.update({
          where: { id: b.taskId },
          data: {
            scheduledStart: b.startTime,
            scheduledEnd: b.endTime,
            blockType: b.type ?? existing.blockType,
            order: i,
          },
        });
        results.push(updated);
      } else {
        const created = await prisma.dailyTask.create({
          data: {
            userId: payload.userId,
            title: b.title.trim(),
            date: dateValue,
            scheduledStart: b.startTime,
            scheduledEnd: b.endTime,
            blockType: b.type ?? 'custom',
            aiGenerated: true,
            order: i,
          },
        });
        results.push(created);
      }
    }

    return ok({ committed: results.length, tasks: results });
  } catch (e) {
    return serverError(e);
  }
}
