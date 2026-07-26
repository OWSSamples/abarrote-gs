import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { env } from '@/lib/env';
import { db } from '@/db';
import { uberOauthStates } from '@/db/schema-uber';
import { logger } from '@/lib/logger';

function maskIdentifier(value: string | undefined): string {
  if (!value) return 'missing';
  const trimmed = value.trim();
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get('store') ?? 'main';

    if (!env.UBER_DEVELOPER_CLIENT_ID || !env.UBER_DEVELOPER_CLIENT_SECRET || !env.UBER_OAUTH_REDIRECT_URI) {
      logger.error('Uber OAuth server configuration missing', {
        action: 'uber_oauth_config_missing',
        hasClientId: Boolean(env.UBER_DEVELOPER_CLIENT_ID),
        hasClientSecret: Boolean(env.UBER_DEVELOPER_CLIENT_SECRET),
        hasRedirectUri: Boolean(env.UBER_OAUTH_REDIRECT_URI),
      });
      return NextResponse.json({ error: 'Uber OAuth is not configured' }, { status: 503 });
    }
    
    // TODO: Replace with tenant/workspace resolver once the integration leaves beta.
    const workspaceId = '00000000-0000-0000-0000-000000000000'; 
    const userId = '00000000-0000-0000-0000-000000000000';

    // 2. Generar State robusto (Anti-CSRF)
    const state = randomBytes(32).toString('hex');
    const stateHash = createHash('sha256').update(state).digest('hex');

    // 3. Persistir contexto
    await db.insert(uberOauthStates).values({
      stateHash,
      workspaceId,
      userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    });

    // 4. Construir URL con Credenciales de UBER (No Cognito)
    const params = new URLSearchParams({
      client_id: env.UBER_DEVELOPER_CLIENT_ID.trim(),
      response_type: 'code',
      redirect_uri: env.UBER_OAUTH_REDIRECT_URI,
      scope: 'eats.pos_provisioning',
      state: state,
    });

    logger.info('Uber OAuth authorize URL generated', {
      action: 'uber_oauth_authorize_generated',
      storeId,
      uberClientId: maskIdentifier(env.UBER_DEVELOPER_CLIENT_ID),
      redirectUri: env.UBER_OAUTH_REDIRECT_URI,
      scope: 'eats.pos_provisioning',
    });

    return NextResponse.redirect(`${env.UBER_OAUTH_AUTHORIZE_URL}?${params.toString()}`);
  } catch (error) {
    logger.error('Error initiating Uber OAuth', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
