import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getLimits, upgradeRequired } from '@/app/lib/plans';
import { getOpenAI, AI_MODEL, PERSONALITY_TONE } from '@/app/lib/openai';
import { todayKey } from '@/app/lib/dates';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

interface ProposedBlock {
  taskId: string | null;
  title: string;
  startTime: string;
  endTime: string;
  type: string;
  reasoning: string;
}

// Generates a preview of a time-blocked schedule for a given day — nothing is
// persisted here (see /api/ai/plan-day/commit for that). It reasons over the
// user's REAL tasks/goals for that day, never invents a task that doesn't
// exist without labeling it as a new suggestion.
export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    if (!(await getLimits(payload.userId)).premiumAi) {
      return upgradeRequired('Plan My Day is a Pro feature. Upgrade to unlock it.');
    }

    const body = await req.json().catch(() => ({}));
    const date = body.date ?? todayKey();
    const note: string | undefined = body.note; // e.g. "shift all to morning" for a re-draft

    const openai = getOpenAI();
    if (!openai) return err('AI is not configured yet', 503);

    const [user, tasks, activeGoals] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId }, select: { aiPersonality: true } }),
      prisma.dailyTask.findMany({
        where: { userId: payload.userId, date: new Date(date + 'T12:00:00Z') },
        include: { goal: { select: { title: true, category: true } } },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.goal.findMany({
        where: { userId: payload.userId, status: 'active' },
        select: { title: true, category: true },
        take: 5,
      }),
    ]);

    if (tasks.length === 0) {
      return err('Add at least one task for this day before asking for a schedule', 400);
    }

    const taskList = tasks.map((t) => ({ id: t.id, title: t.title, goal: t.goal?.title ?? null }));

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content:
            'You are a scheduling assistant. Given a list of a person\'s REAL tasks for one day (with ' +
            'their real ids) and their active goals for context, propose a realistic time-blocked ' +
            'schedule between 07:00 and 22:00. For EVERY task given, include exactly one block with its ' +
            'taskId set to that task\'s id — do not invent extra tasks unless a short break/recharge ' +
            'block is genuinely useful, in which case set taskId to null and type to "break". Use at most ' +
            '2 such break blocks and NEVER add any other new tasks — total blocks must be at most the number ' +
            'of tasks plus 2. Keep each reasoning under 15 words. ' +
            'Each block needs: taskId (string or null), title, startTime ("HH:MM" 24h), endTime ("HH:MM"), ' +
            'type (one of "deep_work","review","break","sync","custom"), and a one-sentence reasoning ' +
            'grounded in the given tasks/goals (never invent unrelated facts). Also return a 0-100 ' +
            '"strategicScore" for how well this schedule serves the stated goals, and a one-sentence ' +
            '"summary" explaining the overall approach. Respond ONLY as JSON: {"summary": string, ' +
            '"strategicScore": number, "blocks": ProposedBlock[]}. ' +
            PERSONALITY_TONE[user?.aiPersonality ?? 'encouraging'],
        },
        {
          role: 'user',
          content: `Tasks for ${date}: ${JSON.stringify(taskList)}. Active goals: ${JSON.stringify(
            activeGoals
          )}.${note ? ` Adjustment requested: "${note}"` : ''}`,
        },
      ],
    });

    if (completion.choices[0]?.finish_reason === 'length') {
      return err('The AI reply was cut off — please try again', 502);
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return err('AI returned an empty response', 502);

    let parsed: { summary?: string; strategicScore?: number; blocks?: ProposedBlock[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return err('AI returned an unparseable response', 502);
    }

    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      return err('AI did not return a schedule', 502);
    }

    // Only keep taskIds that are actually the user's real tasks for this day.
    const validIds = new Set(tasks.map((t) => t.id));
    const blocks = parsed.blocks
      .filter((b) => b && b.startTime && b.endTime && b.title)
      .map((b) => ({
        ...b,
        taskId: b.taskId && validIds.has(b.taskId) ? b.taskId : null,
      }));

    return ok({
      date,
      summary: parsed.summary ?? '',
      strategicScore: typeof parsed.strategicScore === 'number' ? parsed.strategicScore : null,
      blocks,
    });
  } catch (e) {
    return serverError(e);
  }
}
