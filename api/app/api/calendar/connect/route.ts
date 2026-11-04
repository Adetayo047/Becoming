import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, verifyToken, signOAuthState } from '@/app/lib/auth';
import { isGoogleConfigured, googleAuthUrl } from '@/app/lib/google';

// Opened as a real browser navigation (expo-web-browser), not a fetch — so
// the session token has to travel as a query param on this first hop to our
// own server. We immediately exchange it for a short-lived, purpose-scoped
// state token before redirecting to Google, so Google never sees the real
// session token.
export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Calendar sync is not configured yet — Google OAuth credentials are missing.' },
      { status: 503 }
    );
  }

  const headerPayload = getUserFromRequest(req);
  let userId = headerPayload?.userId;

  if (!userId) {
    const queryToken = req.nextUrl.searchParams.get('token');
    if (queryToken) {
      try {
        userId = verifyToken(queryToken).userId;
      } catch {
        // fall through to unauthorized below
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const state = signOAuthState(userId);
  return NextResponse.redirect(googleAuthUrl(state));
}
