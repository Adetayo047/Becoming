import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/app/lib/auth';
import { getOpenAI, AI_MODEL } from '@/app/lib/openai';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { goalTitle, weeklyFocus } = await req.json();
    if (!goalTitle || typeof goalTitle !== 'string' || goalTitle.trim().length < 3) {
      return err('goalTitle is required');
    }

    const openai = getOpenAI();
    if (!openai) return err('AI is not configured yet', 503);

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content:
            'You help someone pick the single most useful thing to do TODAY toward a goal. ' +
            'Given a goal (and optionally this week\'s focus), respond with JSON of the exact ' +
            'shape {"task": string}. The task should be small enough to finish in under an hour, ' +
            'concrete, and phrased as an action (start with a verb). Under 12 words.',
        },
        {
          role: 'user',
          content: `Goal: "${goalTitle.trim()}"${weeklyFocus ? `\nThis week's focus: "${weeklyFocus}"` : ''}`,
        },
      ],
    });

    if (completion.choices[0]?.finish_reason === 'length') {
      return err('The AI reply was cut off — please try again', 502);
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return err('AI returned an empty response', 502);

    let parsed: { task?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return err('AI returned an unparseable response', 502);
    }

    if (typeof parsed.task !== 'string' || !parsed.task.trim()) {
      return err('AI did not return a task', 502);
    }

    return ok({ task: parsed.task.trim() });
  } catch (e) {
    return serverError(e);
  }
}
