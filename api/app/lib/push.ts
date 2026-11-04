import { prisma } from '@/app/lib/prisma';

type NotificationCategory = 'ai_architect' | 'accountability' | 'system';

// Sends a push notification via Expo's push service — plain HTTPS, no SDK
// needed. Requires the recipient to have a real Expo push token, which the
// client can only obtain once the app has a real EAS project id configured
// (see mobile/app.json's extra.eas.projectId).
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: pushToken, title, body, data, sound: 'default' }),
    });

    const json = await res.json();
    const ticket = json?.data;
    if (ticket?.status === 'error') {
      return { ok: false, error: ticket.message ?? 'Push send failed' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Push send failed' };
  }
}

// "HH:MM" strings compared as plain minute counts — handles a window that
// wraps past midnight (e.g. 22:00-06:00) as well as a same-day one.
function isWithinFocusHours(start: string, end: string, now = new Date()): boolean {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMinutes >= startMin && nowMinutes < endMin;
  return nowMinutes >= startMin || nowMinutes < endMin; // wraps midnight
}

// Writes a Notification row (so it shows up in the in-app hub) and, if the
// user has push enabled with a real token, also sends the push — unless
// they're inside their configured Focus Hours, in which case the push is
// muted (matching "Apps like Community will be muted during this time")
// but the notification still lands in the hub for later. Use this instead
// of calling sendPushNotification directly for anything that should have a
// persistent history.
export async function notifyUser(
  userId: string,
  category: NotificationCategory,
  title: string,
  body: string,
  actionUrl?: string,
  // Wake-Up Calls fire at a time the user picked themselves — muting them
  // because it happens to overlap a separately-configured Focus Hours
  // window would be a confusing silent failure, not the intended behavior.
  options?: { bypassFocusHours?: boolean }
) {
  await prisma.notification.create({
    data: { userId, category, title, body, actionUrl },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.pushToken || !user.notificationsEnabled) return;

  if (
    !options?.bypassFocusHours &&
    user.focusHoursStart &&
    user.focusHoursEnd &&
    isWithinFocusHours(user.focusHoursStart, user.focusHoursEnd)
  ) {
    return;
  }

  // actionUrl travels in the push payload's `data` so a tap can deep-link
  // even when the app was fully closed, not just from the in-app hub list.
  await sendPushNotification(user.pushToken, title, body, actionUrl ? { actionUrl, category } : undefined);
}
