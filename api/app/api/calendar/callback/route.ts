import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { verifyOAuthState } from '@/app/lib/auth';
import { exchangeCodeForTokens } from '@/app/lib/google';

// Google redirects here after the user grants (or denies) calendar access.
// We store the tokens, then bounce back into the app via its deep link
// scheme so expo-web-browser's openAuthSessionAsync can close the in-app
// browser and resolve.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const deniedError = req.nextUrl.searchParams.get('error');

  if (deniedError) {
    return NextResponse.redirect('becoming://calendar-connect?status=denied');
  }
  if (!code || !state) {
    return NextResponse.redirect('becoming://calendar-connect?status=error');
  }

  const payload = verifyOAuthState(state);
  if (!payload) {
    return NextResponse.redirect('becoming://calendar-connect?status=expired');
  }

  const tokens = await exchangeCodeForTokens(code);
  if (tokens.error || !tokens.access_token) {
    console.error('Google token exchange failed:', tokens.error_description ?? tokens.error);
    return NextResponse.redirect('becoming://calendar-connect?status=error');
  }

  await prisma.user.update({
    where: { id: payload.userId },
    data: {
      googleAccessToken: tokens.access_token,
      ...(tokens.refresh_token && { googleRefreshToken: tokens.refresh_token }),
      googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      googleCalendarConnected: true,
    },
  });

  return NextResponse.redirect('becoming://calendar-connect?status=success');
}
