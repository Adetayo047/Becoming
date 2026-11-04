import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { isRealtimeConfigured, REALTIME_MODEL, REALTIME_VOICE, VOICE_SYSTEM_PROMPT, PERSONALITY_TONE, nameDirective } from '@/app/lib/openai';
import { ok, err, unauthorized, serverError } from '@/app/lib/response';

// Mints a short-lived OpenAI Realtime client secret for a LIVE DUPLEX voice
// call (WebRTC). The mobile client never sees OPENAI_API_KEY — it gets this
// ephemeral token instead and uses it directly against OpenAI's servers for
// the actual audio connection (POST https://api.openai.com/v1/realtime/calls
// with an SDP offer, Authorization: Bearer <clientSecret>).
//
// This requires `react-native-webrtc`, which is not available inside Expo
// Go — only in a custom EAS dev-client build. Until that build exists, the
// mobile Wake-Up Call screen uses the turn-based fallback at
// POST /api/voice/turn instead, which works in Expo Go today.
export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    if (!isRealtimeConfigured()) {
      return err('Voice calling is not configured yet (OPENAI_API_KEY missing)', 503);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { aiPersonality: true, fullName: true } });

    const chatSession = await prisma.aiChatSession.create({ data: { userId: payload.userId } });
    const voiceCallSession = await prisma.voiceCallSession.create({
      data: {
        userId: payload.userId,
        chatSessionId: chatSession.id,
        status: 'active',
        scheduledFor: new Date(),
        startedAt: new Date(),
      },
    });

    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 600 },
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          instructions:
            VOICE_SYSTEM_PROMPT + ' ' + PERSONALITY_TONE[user?.aiPersonality ?? 'encouraging'] + nameDirective(user?.fullName),
          audio: { output: { voice: REALTIME_VOICE } },
          output_modalities: ['audio'],
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[realtime] client_secrets request failed', res.status, text);
      await prisma.voiceCallSession.update({ where: { id: voiceCallSession.id }, data: { status: 'failed', endedAt: new Date() } });
      return err('Could not start the live voice session — please try again', 502);
    }

    const json = await res.json();

    return ok({
      clientSecret: json.value as string,
      expiresAt: json.expires_at as number,
      realtimeModel: REALTIME_MODEL,
      voiceCallSessionId: voiceCallSession.id,
      chatSessionId: chatSession.id,
    });
  } catch (e) {
    return serverError(e);
  }
}
