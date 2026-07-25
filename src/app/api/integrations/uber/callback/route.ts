import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/db';
import { uberOauthStates } from '@/db/schema-uber';
import { eq, and, gt } from 'drizzle-orm';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/settings?uber=error&msg=missing_params', req.url));
  }

  try {
    // 1. Validar State (Anti-CSRF e Idempotencia)
    const stateHash = createHash('sha256').update(state).digest('hex');
    const [storedState] = await db.select().from(uberOauthStates)
      .where(and(
        eq(uberOauthStates.stateHash, stateHash),
        gt(uberOauthStates.expiresAt, new Date())
      )).limit(1);

    if (!storedState || storedState.consumedAt) {
      logger.error('Invalid or expired Uber OAuth state', { stateHash });
      return NextResponse.redirect(new URL('/dashboard/settings?uber=error&msg=invalid_state', req.url));
    }

    // 2. Consumir State inmediatamente
    await db.update(uberOauthStates)
      .set({ consumedAt: new Date() })
      .where(eq(uberOauthStates.stateHash, stateHash));

    // 3. Intercambiar Code por Tokens reales de Uber
    const tokenResponse = await fetch(env.UBER_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.UBER_DEVELOPER_CLIENT_ID || '',
        client_secret: env.UBER_DEVELOPER_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        redirect_uri: env.UBER_OAUTH_REDIRECT_URI || '',
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      logger.error('Uber token exchange failed', { status: tokenResponse.status, errorData });
      return NextResponse.redirect(new URL('/dashboard/settings?uber=error&msg=token_exchange_failed', req.url));
    }

    const tokens = await tokenResponse.json();
    
    // NOTA: Aquí sigue la lógica de descubrimiento de tiendas y cifrado AES-256
    // Por ahora redirigimos al dashboard con éxito de autorización
    return NextResponse.redirect(new URL(`/dashboard/settings?uber=authorized&workspace=${storedState.workspaceId}`, req.url));

  } catch (error) {
    logger.error('Unexpected error in Uber callback', { error: (error as Error).message });
    return NextResponse.redirect(new URL('/dashboard/settings?uber=error&msg=internal_error', req.url));
  }
}