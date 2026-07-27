import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { db } from '@/db';
import { uberOauthStates } from '@/db/schema-uber';
import { deliveryProviderConnections } from '@/db/schema-delivery';
import { eq, and, gt } from 'drizzle-orm';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { encrypt } from '@/lib/crypto';
import { upsertStorePlugin } from '@/server/plugin-store-service';

function getStringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === 'string' && field.trim() ? field : undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?plugin=ubereats&oauth=error&msg=missing_params', req.url),
    );
  }

  try {
    // 1. Validar State (Anti-CSRF e Idempotencia)
    const stateHash = createHash('sha256').update(state).digest('hex');
    const [storedState] = await db
      .select()
      .from(uberOauthStates)
      .where(and(eq(uberOauthStates.stateHash, stateHash), gt(uberOauthStates.expiresAt, new Date())))
      .limit(1);

    if (!storedState || storedState.consumedAt) {
      logger.error('Invalid or expired Uber OAuth state', { stateHash });
      return NextResponse.redirect(
        new URL('/dashboard?plugin=ubereats&oauth=error&msg=invalid_state', req.url),
      );
    }

    // 2. Consumir State inmediatamente
    await db.update(uberOauthStates).set({ consumedAt: new Date() }).where(eq(uberOauthStates.stateHash, stateHash));

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
      return NextResponse.redirect(
        new URL('/dashboard?plugin=ubereats&oauth=error&msg=token_exchange_failed', req.url),
      );
    }

    const tokens = (await tokenResponse.json()) as Record<string, unknown>;
    const accessToken = getStringField(tokens, 'access_token');
    if (!accessToken) {
      logger.error('Uber token exchange response missing access token', { stateHash });
      return NextResponse.redirect(
        new URL('/dashboard?plugin=ubereats&oauth=error&msg=missing_access_token', req.url),
      );
    }

    const providerStoreId =
      getStringField(tokens, 'store_id') ??
      getStringField(tokens, 'merchant_id') ??
      getStringField(tokens, 'organization_id') ??
      storedState.storeId;

    const connectionData = {
      provider: 'ubereats',
      storeId: storedState.storeId,
      status: 'connected',
      accessTokenEnc: encrypt(accessToken),
      webhookSecretEnc: null,
      providerStoreId,
      environment: 'production',
      connectedAt: new Date(),
      updatedAt: new Date(),
    };

    const [existingConnection] = await db
      .select({ id: deliveryProviderConnections.id })
      .from(deliveryProviderConnections)
      .where(
        and(
          eq(deliveryProviderConnections.storeId, storedState.storeId),
          eq(deliveryProviderConnections.provider, 'ubereats'),
        ),
      )
      .limit(1);

    if (existingConnection) {
      await db
        .update(deliveryProviderConnections)
        .set(connectionData)
        .where(eq(deliveryProviderConnections.id, existingConnection.id));
    } else {
      await db.insert(deliveryProviderConnections).values({ id: randomUUID(), ...connectionData });
    }

    logger.info('Uber Eats marketplace app installed', {
      action: 'uber_marketplace_installed',
      storeId: storedState.storeId,
      providerStoreId,
    });

    await upsertStorePlugin({
      storeId: storedState.storeId,
      pluginId: 'plugin.delivery.ubereats',
      category: 'delivery',
      providerId: 'ubereats',
      installedBy: storedState.userId,
      status: 'installed',
      metadata: { providerStoreId, environment: 'production' },
    });

    return NextResponse.redirect(new URL('/dashboard?plugin=ubereats&oauth=success', req.url));
  } catch (error) {
    logger.error('Unexpected error in Uber callback', { error: (error as Error).message });
    return NextResponse.redirect(
      new URL('/dashboard?plugin=ubereats&oauth=error&msg=internal_error', req.url),
    );
  }
}
