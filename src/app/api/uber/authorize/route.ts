import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getBaseUrl } from '@/lib/env';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const storeId = url.searchParams.get('store');

  if (!storeId) {
    return NextResponse.json({ error: 'store parameter is required' }, { status: 400 });
  }

  if (!env.UBER_EATS_CLIENT_ID) {
    logger.error('Uber Eats OAuth not configured — UBER_EATS_CLIENT_ID is missing');
    return NextResponse.json(
      { error: 'Uber Eats OAuth is not configured on the server' },
      { status: 503 },
    );
  }

  const state = randomUUID();
  const redirectUri = env.UBER_EATS_REDIRECT_URI ?? `${getBaseUrl()}/api/uber/callback`;

  const cookieStore = await cookies();
  cookieStore.set('uber_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  cookieStore.set('uber_oauth_store', storeId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.UBER_EATS_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'profile orders',
    state,
  });

  const authUrl = `https://login.uber.com/oauth/v2/authorize?${params.toString()}`;

  logger.info('Uber Eats OAuth initiated', { action: 'uber_oauth_authorize', storeId });

  return NextResponse.redirect(authUrl);
}