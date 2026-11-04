import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getLimits, upgradeRequired } from '@/app/lib/plans';
import { getOpenAI, AI_MODEL, PERSONALITY_TONE, nameDirective } from '@/app/lib/openai';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

interface ProposedMilestone {
  title: string;
  monthlyTarget?: string;
  weeklyFocus?: string;
  firstTask?: string;
}

const SYSTEM_PROMPT =
  'You are the Becoming AI Architect — a warm, sharp goal-setting coach for ambitious young ' +
  'Nigerians. You have a short conversation with the user to understand their goal, then help ' +
  "them turn it into a concrete milestone. Ask ONE clarifying question at a time — don't " +
  "interrogate. Once you have enough (usually after 2-4 exchanges), propose a milestone. " +
  'Respond ONLY as JSON: {"reply": string, "proposedMilestone": null | {"title": string, ' +
  '"monthlyTarget": string, "weeklyFocus": string, "firstTask": string}}. Keep "reply" ' +
  'conversational and under 60 words. Only set proposedMilestone once you actually have enough ' +
  'context — otherwise it must be null.';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    if (!(await getLimits(payload.userId)).premiumAi) {
      return upgradeRequired('The AI Goal Architect is a Pro feature. Upgrade to unlock it.');
    }

    const { sessionId, message } = await req.json();
    if (!message || !message.trim()) return err('message is required');

    const openai = getOpenAI();
    if (!openai) return err('AI is not configured yet', 503);

    // Run the independent lookups in parallel instead of one after another —
    // every awaited DB round trip before the OpenAI call is user-visible latency.
    const [user, existingSession] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId }, select: { aiPersonality: true, fullName: true } }),
      sessionId ? prisma.aiChatSession.findUnique({ where: { id: sessionId } }) : Promise.resolve(null),
    ]);

    if (sessionId && (!existingSession || existingSession.userId !== payload.userId)) {
      return notFound('Chat session');
    }
    const session = existingSession ?? (await prisma.aiChatSession.create({ data: { userId: payload.userId } }));

    // Only the last few turns matter for a one-question-at-a-time coach, and
    // a shorter prompt is a faster response.
    const recent = await prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const priorMessages = recent.reverse();

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            SYSTEM_PROMPT + ' ' + PERSONALITY_TONE[user?.aiPersonality ?? 'encouraging'] + nameDirective(user?.fullName),
        },
        ...priorMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: message.trim() },
      ],
    });

    // A reply cut off by the token limit would be broken mid-phrase — fail
    // loudly instead of showing half a sentence.
    if (completion.choices[0]?.finish_reason === 'length') {
      return err('The AI reply was cut off — please try again', 502);
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return err('AI returned an empty response', 502);

    let parsed: { reply?: string; proposedMilestone?: ProposedMilestone | null };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return err('AI returned an unparseable response', 502);
    }

    if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
      return err('AI did not return a reply', 502);
    }

    // Persist both turns together after the model has answered.
    // Explicit timestamps: one INSERT would otherwise give both rows the same
    // now(), making their order ambiguous on the next request.
    const now = Date.now();
    await prisma.aiChatMessage.createMany({
      data: [
        { sessionId: session.id, role: 'user', content: message.trim(), createdAt: new Date(now - 1) },
        { sessionId: session.id, role: 'assistant', content: parsed.reply.trim(), createdAt: new Date(now) },
      ],
    });

    return ok({
      sessionId: session.id,
      reply: parsed.reply.trim(),
      proposedMilestone: parsed.proposedMilestone ?? null,
    });
  } catch (e) {
    return serverError(e);
  }
}
