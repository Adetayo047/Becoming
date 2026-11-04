import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getOpenAI, AI_MODEL, PERSONALITY_TONE } from '@/app/lib/openai';
import { mondayOfWeek } from '@/app/lib/dates';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { weekStart: weekStartParam, blockedText } = await req.json();

    const weekStart = weekStartParam ? new Date(weekStartParam + 'T00:00:00Z') : mondayOfWeek();
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    const completedTasks = await prisma.dailyTask.findMany({
      where: { userId: payload.userId, completed: true, date: { gte: weekStart, lt: weekEnd } },
      select: { date: true },
    });

    // Real per-day breakdown — this is what the model reasons over, not
    // invented statistics.
    const perDay: Record<string, number> = {};
    for (const t of completedTasks) {
      const day = DAY_NAMES[new Date(t.date).getUTCDay()];
      perDay[day] = (perDay[day] ?? 0) + 1;
    }

    if (completedTasks.length === 0) {
      return ok({ insight: null, reason: 'Not enough completed tasks this week for a pattern yet.' });
    }

    const openai = getOpenAI();
    if (!openai) return err('AI is not configured yet', 503);

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { aiPersonality: true } });

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content:
            'You analyze a week of someone\'s task-completion data and write ONE short, specific, ' +
            'insight (under 30 words) about their real pattern — e.g. which day they were ' +
            'most productive, or a real observation about consistency. Ground it strictly in the numbers ' +
            'given; never invent a statistic or day not present in the data. Respond as JSON: {"insight": string}. ' +
            PERSONALITY_TONE[user?.aiPersonality ?? 'encouraging'],
        },
        {
          role: 'user',
          content: `Completed tasks per day this week: ${JSON.stringify(perDay)}. Total: ${completedTasks.length}.${
            blockedText ? ` They said this blocked them: "${blockedText}"` : ''
          }`,
        },
      ],
    });

    if (completion.choices[0]?.finish_reason === 'length') {
      return err('The AI reply was cut off — please try again', 502);
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return err('AI returned an empty response', 502);

    const parsed = JSON.parse(raw);
    if (typeof parsed.insight !== 'string' || !parsed.insight.trim()) {
      return err('AI did not return an insight', 502);
    }

    await prisma.weeklyReview.upsert({
      where: { userId_weekStart: { userId: payload.userId, weekStart } },
      create: { userId: payload.userId, weekStart, aiInsight: parsed.insight.trim() },
      update: { aiInsight: parsed.insight.trim() },
    });

    return ok({ insight: parsed.insight.trim() });
  } catch (e) {
    return serverError(e);
  }
}
