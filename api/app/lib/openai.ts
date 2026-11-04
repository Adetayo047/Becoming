import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const AI_MODEL = 'gpt-4o-mini';

export type AiPersonality = 'encouraging' | 'stoic' | 'visionary' | 'direct' | 'analytical';

// A short tone instruction appended to system prompts so the model's voice
// actually shifts with the user's chosen persona (Settings > AI Personality),
// rather than the picker being cosmetic.
export const PERSONALITY_TONE: Record<AiPersonality, string> = {
  encouraging: 'Speak warmly and encouragingly, celebrating effort and progress.',
  stoic: 'Speak plainly and with restraint, in the voice of stoic philosophy — focus on what is controllable, discipline, and duty. Avoid exclamation points and hype.',
  visionary: "Speak expansively, framing today's actions as brushstrokes on the user's long-term vision of who they're becoming.",
  direct: 'Speak briefly and bluntly. No cushioning, no pleasantries — state the observation and the action.',
  analytical: 'Speak like a data analyst: reference the numbers/patterns precisely and frame suggestions as data-driven optimizations.',
};

// Static example lines for the Settings screen's persona preview — generic
// voice-line samples describing the tone, not AI output and not attributed
// to any real user, so nothing here is fabricated user content.
export const PERSONALITY_PREVIEW: Record<AiPersonality, string> = {
  encouraging: "You're making incredible strides today! Every small win is a building block for the future version of you.",
  stoic: 'Focus on what you can control. The obstacle is the way. Your discipline is your freedom.',
  visionary: 'See the version of yourself years from now. Every action today is a pixel in that masterpiece.',
  direct: "Focus dipped today. Recalibrate — start your next block now.",
  analytical: 'Your current alignment is trending up. Shifting deep work earlier could optimize for peak output.',
};

// ─── Voice (Wake-Up Call) ────────────────────────────────────────────────────
// Same OPENAI_API_KEY powers voice — no separate credential to configure.
// Model/voice names are overridable via env since these are OpenAI's
// fastest-moving model family; defaults match the current docs as of this
// writing (verified against developers.openai.com, not assumed from training
// data — see the Realtime/Audio API reference before changing them).
export function isRealtimeConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Live duplex model, used by POST /api/realtime/session (WebRTC — needs the
// react-native-webrtc dev-client build, see mobile/app/wake-up-call.tsx).
export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
export const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'alloy';

// Turn-based fallback (works in Expo Go today): record -> transcribe -> text
// reply -> speak. Used by POST /api/voice/turn.
export const STT_MODEL = process.env.OPENAI_STT_MODEL || 'gpt-4o-transcribe';
export const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
export const TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'alloy';

// Shared persona for the Wake-Up Call, text or voice — written for being
// heard, not read: short sentences, one question at a time, no markdown/lists.
// Appended to a conversational system prompt so the AI addresses the user by
// their real first name (from their account) instead of generic terms like
// "there" or "friend". Falls back to no directive if a name isn't on file.
export function nameDirective(fullName?: string | null): string {
  const firstName = fullName?.trim().split(/\s+/)[0];
  if (!firstName) return '';
  return ` The user's name is ${firstName} — address them by that name naturally (e.g. in your greeting and occasionally through the conversation), not in every single line.`;
}

export const VOICE_SYSTEM_PROMPT =
  'You are the Becoming AI Architect, calling the user for their scheduled Wake-Up Call — a short ' +
  "spoken planning conversation. You're warm but efficient; this is a voice call, not a chat, so: " +
  'use short, natural spoken sentences (no bullet points, no markdown, no headings); ask ONE thing ' +
  'at a time and wait for their answer; keep each turn under 40 words. Your job is to help them turn ' +
  "a goal for today or this week into one concrete milestone and a first task, the same way you'd do " +
  'it over text — just spoken. Once you have enough context, say so and summarize what you heard back ' +
  'to them in plain speech before ending the call.';

// ─── At-Risk Nudge ───────────────────────────────────────────────────────────
// Fires near the end of the user's day (see app/lib/scheduler.ts) when they
// still have incomplete tasks or a streak they haven't touched today — the
// exact "goals don't fail loudly, they fade away quietly" moment. Templated
// per AI Personality rather than an OpenAI call: this runs across every
// eligible user on every scheduler tick, so it has to be instant and never
// fail because of an API outage. All numbers come from the real query in
// scheduler.ts — nothing here is invented per user.
export interface AtRiskContext {
  incompleteTaskCount: number;
  atRiskStreakDays: number | null; // the longest currentStreak not yet continued today, or null if none
}

export function atRiskNudgeCopy(personality: AiPersonality, ctx: AtRiskContext): { title: string; body: string } {
  const { incompleteTaskCount, atRiskStreakDays } = ctx;
  const streak = atRiskStreakDays;

  if (streak && streak > 0) {
    const bodies: Record<AiPersonality, string> = {
      encouraging: `You've got a ${streak}-day streak going — don't let today be the day it slips. A few minutes is all it takes to keep it alive.`,
      stoic: `Your ${streak}-day streak ends today unless you act. Discipline is choosing to show up when it would be easier not to.`,
      visionary: `${streak} days of becoming who you said you'd be. Don't let today be the exception — future you is still watching.`,
      direct: `${streak}-day streak. Still incomplete today. Close it out now.`,
      analytical: `Your ${streak}-day streak is unbroken until midnight. Completing today's task keeps the pattern intact.`,
    };
    return { title: '🔥 Your streak is on the line', body: bodies[personality] };
  }

  const bodies: Record<AiPersonality, string> = {
    encouraging: `You've got ${incompleteTaskCount} task${incompleteTaskCount === 1 ? '' : 's'} left today. Small steps still count — let's finish strong.`,
    stoic: `${incompleteTaskCount} task${incompleteTaskCount === 1 ? '' : 's'} remain today. What you do with the time left is what matters.`,
    visionary: `${incompleteTaskCount} step${incompleteTaskCount === 1 ? '' : 's'} between you and the person you're becoming — still time today.`,
    direct: `${incompleteTaskCount} task${incompleteTaskCount === 1 ? '' : 's'} left. Day's not over.`,
    analytical: `${incompleteTaskCount} of today's tasks are still open. Completion rate drops sharply after today ends — close them now.`,
  };
  return { title: "📋 Today isn't done yet", body: bodies[personality] };
}
