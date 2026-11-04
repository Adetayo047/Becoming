import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getUserFromRequest } from '@/app/lib/auth';
import { refreshAccessToken, createCalendarEvent } from '@/app/lib/google';
import { ok, err, unauthorized, notFound, serverError } from '@/app/lib/response';

export async function POST(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return unauthorized();

    const { taskId } = await req.json();
    if (!taskId) return err('taskId is required');

    const task = await prisma.dailyTask.findUnique({ where: { id: taskId } });
    if (!task || task.userId !== payload.userId) return notFound('Task');

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.googleCalendarConnected || !user.googleRefreshToken) {
      return err('Connect Google Calendar first (Profile → Calendar Sync)', 400);
    }

    // Refresh the access token if it's expired or about to expire.
    let accessToken = user.googleAccessToken;
    const expiringSoon = !user.googleTokenExpiry || user.googleTokenExpiry.getTime() < Date.now() + 60_000;
    if (expiringSoon) {
      const refreshed = await refreshAccessToken(user.googleRefreshToken);
      if (refreshed.error || !refreshed.access_token) {
        return err('Google Calendar connection expired — reconnect it in Profile', 401);
      }
      accessToken = refreshed.access_token;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: accessToken,
          googleTokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
    }

    const result = await createCalendarEvent(accessToken!, { title: task.title, date: task.date });
    if (!result.ok) return err(result.error ?? 'Could not create calendar event', 502);

    return ok({ synced: true });
  } catch (e) {
    return serverError(e);
  }
}
