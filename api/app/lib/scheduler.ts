import cron from 'node-cron';
import { prisma } from '@/app/lib/prisma';
import { notifyUser } from '@/app/lib/push';
import { atRiskNudgeCopy, AiPersonality } from '@/app/lib/openai';

let started = false;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// A user's "local" clock, derived from the UTC offset they last saved in
// Settings (captured client-side from their device) — not a full timezone
// database, so it can drift by an hour across a DST change until they
// reopen Settings. Documented trade-off, not a bug.
function localNow(utcOffsetMinutes: number) {
  const now = new Date(Date.now() + utcOffsetMinutes * 60_000);
  return {
    hhmm: `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`,
    dateKey: `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`,
  };
}

async function wakeUpCallTick() {
  const candidates = await prisma.user.findMany({
    where: { deactivatedAt: null, wakeUpCallEnabled: true, wakeUpCallTime: { not: null }, utcOffsetMinutes: { not: null }, tier: { in: ['pro', 'plus'] } },
    select: { id: true, wakeUpCallTime: true, utcOffsetMinutes: true, wakeUpCallLastFiredDate: true },
  });

  for (const user of candidates) {
    const { hhmm, dateKey } = localNow(user.utcOffsetMinutes!);
    if (hhmm !== user.wakeUpCallTime) continue;
    if (user.wakeUpCallLastFiredDate === dateKey) continue; // already fired today

    // Mark fired before sending — if the push itself fails we'd rather miss
    // one call than spam retries every minute until the clock moves on.
    await prisma.user.update({ where: { id: user.id }, data: { wakeUpCallLastFiredDate: dateKey } });

    await notifyUser(
      user.id,
      'system',
      '📞 Your Wake-Up Call',
      'The AI Architect is calling to plan your day — tap to answer.',
      '/wake-up-call',
      { bypassFocusHours: true }
    );
  }
}

// How many times a day this nudge can fire, and at which local checkpoints —
// the one concrete behavior nudgeFrequency actually drives today (elsewhere
// it only flavors AI chat tone). Deliberately does NOT bypass focus hours,
// unlike the wake-up call: that time is one the user picked themselves,
// these checkpoints are system defaults that could land inside someone's
// configured quiet window.
const AT_RISK_CHECKPOINTS: Record<'sparse' | 'balanced' | 'high_intensity', string[]> = {
  sparse: ['20:30'],
  balanced: ['20:00'],
  high_intensity: ['15:00', '20:00'],
};

async function atRiskTick() {
  const candidates = await prisma.user.findMany({
    where: { deactivatedAt: null, notificationsEnabled: true, utcOffsetMinutes: { not: null } },
    select: { id: true, utcOffsetMinutes: true, nudgeFrequency: true, aiPersonality: true, atRiskNudgeLastFiredKey: true },
  });

  for (const user of candidates) {
    const { hhmm, dateKey } = localNow(user.utcOffsetMinutes!);
    const checkpoints = AT_RISK_CHECKPOINTS[user.nudgeFrequency];
    if (!checkpoints.includes(hhmm)) continue;

    const fireKey = `${dateKey}@${hhmm}`;
    if (user.atRiskNudgeLastFiredKey === fireKey) continue; // already handled this exact checkpoint

    const todayDate = new Date(dateKey + 'T12:00:00Z');

    const [incompleteTaskCount, streaks] = await Promise.all([
      prisma.dailyTask.count({ where: { userId: user.id, date: todayDate, completed: false } }),
      prisma.habitStreak.findMany({ where: { userId: user.id, currentStreak: { gt: 0 } } }),
    ]);

    const atRiskStreaks = streaks.filter((s) => {
      if (!s.lastCompleted) return true;
      const last = new Date(s.lastCompleted);
      const lastKey = `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`;
      return lastKey !== dateKey;
    });
    const atRiskStreakDays = atRiskStreaks.length > 0 ? Math.max(...atRiskStreaks.map((s) => s.currentStreak)) : null;

    // Mark this checkpoint handled regardless of outcome — if there's
    // genuinely nothing at risk, re-checking later today won't change that.
    await prisma.user.update({ where: { id: user.id }, data: { atRiskNudgeLastFiredKey: fireKey } });

    if (incompleteTaskCount === 0 && atRiskStreakDays === null) continue; // day's already handled, nothing to say

    const { title, body } = atRiskNudgeCopy(user.aiPersonality as AiPersonality, { incompleteTaskCount, atRiskStreakDays });
    await notifyUser(user.id, 'ai_architect', title, body, '/(tabs)');
  }
}

// Called once from instrumentation.ts's register() when the server process
// starts. Next.js can spin up multiple worker processes in production (and
// Turbopack dev can re-run module init on reload), so `started` guards
// against registering the same cron job twice within one process — it does
// NOT dedupe across multiple server processes/instances. A multi-instance
// production deployment would fire this once per instance; fine for a
// single-instance deployment, a real gap worth flagging before scaling out.
export function startScheduler() {
  if (started) return;
  started = true;
  cron.schedule('* * * * *', () => {
    wakeUpCallTick().catch((e) => console.error('[scheduler] wake-up call tick failed', e));
    atRiskTick().catch((e) => console.error('[scheduler] at-risk nudge tick failed', e));
  });
  console.log('[scheduler] wake-up call + at-risk nudge scheduler started');
}
