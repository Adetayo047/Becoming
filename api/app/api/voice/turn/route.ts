import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { getLimits, upgradeRequired } from '@/app/lib/plans';
import { getOpenAI, AI_MODEL, STT_MODEL, TTS_MODEL, TTS_VOICE, PERSONALITY_TONE, nameDirective } from '@/app/lib/openai';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

// By design this is NOT a back-and-forth conversation — the user speaks
// once about what they want to get done, we transcribe it, extract concrete
// task titles, and the client adds them straight to today's task list (the
// same list the Today screen already shows). No clarifying questions, no
// milestone/category ceremony, no approval gate: say it, it's on the plan.
// Same endpoint, same one-shot behavior whether it was opened from the
// floating Quick-Talk button or from answering the scheduled Wake-Up Call.
const EXTRACTION_PROMPT =
  'The user is speaking out loud about what they want to get done. Extract 1 to 5 concrete, ' +
  'actionable task titles from what they said — each under 12 words, phrased as an action starting ' +
  "with a verb. If they mention something already on today's list (given below), don't repeat it. " +
  "If what they said doesn't contain any actionable task, return an empty tasks array. Do not ask " +
  'a question back — you only get this one turn, not a conversation. Respond ONLY as JSON: ' +
  '{"tasks": string[], "confirmation": string}. "confirmation" is one short spoken-style sentence ' +
  '(under 25 words) confirming what was added (or, if tasks is empty, saying you didn\'t catch an ' +
  'actionable task and they should try again).';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();
    if (!(await getLimits(payload.userId)).premiumAi) {
      return upgradeRequired('The voice wake-up call is a Pro feature. Upgrade to unlock it.');
    }

    const openai = getOpenAI();
    if (!openai) return err('AI is not configured yet', 503);

    const form = await req.formData();
    const audio = form.get('audio');
    const voiceCallSessionId = form.get('voiceCallSessionId') as string | null;
    const alreadyAddedRaw = form.get('alreadyAdded') as string | null; // JSON string[] — titles added earlier this call
    let alreadyAdded: string[] = [];
    try {
      alreadyAdded = alreadyAddedRaw ? JSON.parse(alreadyAddedRaw) : [];
    } catch {
      alreadyAdded = [];
    }

    if (!audio || !(audio instanceof Blob)) {
      return err('audio file is required (multipart field "audio")');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { aiPersonality: true, fullName: true } });

    let voiceCallSession;
    if (voiceCallSessionId) {
      voiceCallSession = await prisma.voiceCallSession.findUnique({ where: { id: voiceCallSessionId } });
      if (!voiceCallSession || voiceCallSession.userId !== payload.userId) return notFound('Voice call session');
    } else {
      const chatSession = await prisma.aiChatSession.create({ data: { userId: payload.userId } });
      voiceCallSession = await prisma.voiceCallSession.create({
        data: {
          userId: payload.userId,
          chatSessionId: chatSession.id,
          status: 'active',
          scheduledFor: new Date(),
          startedAt: new Date(),
        },
      });
    }

    if (!voiceCallSession.chatSessionId) return err('Voice call session has no chat session', 500);

    // 1. Speech -> text
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: STT_MODEL,
    });
    const transcriptText = (transcription as { text: string }).text?.trim();
    if (!transcriptText) {
      return err("Couldn't hear that clearly — try again", 422);
    }

    // 2. Text -> extracted tasks (single turn, no conversation history fed
    // back in — each utterance is extracted independently, only grounded
    // against what's already been added this call to avoid duplicates).
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: EXTRACTION_PROMPT + ' ' + PERSONALITY_TONE[user?.aiPersonality ?? 'encouraging'] + nameDirective(user?.fullName),
        },
        {
          role: 'user',
          content: `Already on today's plan this call: ${JSON.stringify(alreadyAdded)}. They just said: "${transcriptText}"`,
        },
      ],
    });

    if (completion.choices[0]?.finish_reason === 'length') {
      return err('The AI reply was cut off — please try again', 502);
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return err('AI returned an empty response', 502);

    let parsed: { tasks?: string[]; confirmation?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return err('AI returned an unparseable response', 502);
    }
    if (!Array.isArray(parsed.tasks) || typeof parsed.confirmation !== 'string' || !parsed.confirmation.trim()) {
      return err('AI did not return a usable extraction', 502);
    }
    const tasks = parsed.tasks.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim());
    const confirmation = parsed.confirmation.trim();

    const now = Date.now();
    await prisma.aiChatMessage.createMany({
      data: [
        { sessionId: voiceCallSession.chatSessionId, role: 'user', content: transcriptText, createdAt: new Date(now - 1) },
        { sessionId: voiceCallSession.chatSessionId, role: 'assistant', content: confirmation, createdAt: new Date(now) },
      ],
    });

    // 3. Text -> speech
    const speech = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: confirmation,
      response_format: 'mp3',
    });
    const replyAudioBase64 = Buffer.from(await speech.arrayBuffer()).toString('base64');

    return ok({
      voiceCallSessionId: voiceCallSession.id,
      chatSessionId: voiceCallSession.chatSessionId,
      transcript: transcriptText,
      tasks,
      confirmation,
      replyAudioBase64,
      replyAudioFormat: 'mp3',
    });
  } catch (e) {
    return serverError(e);
  }
}
