import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/app/lib/auth';
import { getOpenAI, AI_MODEL } from '@/app/lib/openai';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { goalTitle, goalCategory } = await req.json();
    if (!goalTitle || typeof goalTitle !== 'string' || goalTitle.trim().length < 5) {
      return err('goalTitle is required (at least 5 characters)');
    }

    const openai = getOpenAI();
    if (!openai) return err('AI is not configured yet', 503);

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            'You help Nigerian young professionals break a big goal into concrete milestones. ' +
            'Given a goal title and category, respond with JSON of the exact shape ' +
            '{"milestones": string[]}. Return 3 to 5 milestones. Each milestone should be a ' +
            'specific, achievable checkpoint on the way to the goal — not vague advice. Keep ' +
            'each one under 12 words.',
        },
        {
          role: 'user',
          content: `Goal: "${goalTitle.trim()}"\nCategory: ${goalCategory ?? 'unspecified'}`,
        },
      ],
    });

    if (completion.choices[0]?.finish_reason === 'length') {
      return err('The AI reply was cut off — please try again', 502);
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return err('AI returned an empty response', 502);

    let parsed: { milestones?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return err('AI returned an unparseable response', 502);
    }

    const milestones = Array.isArray(parsed.milestones)
      ? parsed.milestones.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : [];

    if (milestones.length === 0) return err('AI did not return any milestones', 502);

    return ok({ milestones });
  } catch (e) {
    return serverError(e);
  }
}
