'use server';

import crypto from 'crypto';
import { db } from '@/db';
import { paymentProviderConnections, oauthStates } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { env, getBaseUrl } from '@/lib/env';

// ── Constants ──

const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';
const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';

type ProviderType = 'mercadopago';

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
}

// ── PKCE Helpers ──

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ── Public API ──

/**
 * Generates the OAuth authorization URL for MercadoPago.
 * Stores PKCE code_verifier in DB for later exchange.
 */
export async function generateMPAuthorizationUrl(): Promise<{ url: string; state: string }> {
  const appId = env.MP_APP_ID;
  const baseUrl = getBaseUrl();

  if (!appId) {
    throw new Error('MP_APP_ID no configurado. Crea una aplicación en developers.mercadopago.com');
  }

  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const redirectUri = `${baseUrl}/api/oauth/mercadopago/callback`;

  // Store PKCE state for callback verification (expires in 10 min)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(oauthStates).values({
    id: `oas-${crypto.randomUUID()}`,
    provider: 'mercadopago',
    codeVerifier,
    state,
    redirectUri,
    expiresAt,
  });

  // Cleanup expired states
  await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date()));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    platform_id: 'mp',
  });

  return {
    url: `${MP_AUTH_URL}?${params.toString()}`,
    state,
  };
}

/**
 * Exchanges the authorization code for tokens.
 * Called from the callback route after user authorizes.
 */
export async function exchangeMPAuthorizationCode(
  code: string,
  state: string,
): Promise<{ success: boolean; email?: string; error?: string }> {
  const appId = env.MP_APP_ID;
  const clientSecret = env.MP_CLIENT_SECRET;

  if (!appId || !clientSecret) {
    return { success: false, error: 'MP_APP_ID o MP_CLIENT_SECRET no configurados' };
  }

  // Retrieve and validate PKCE state
  const [oauthState] = await db
    .select()
    .from(oauthStates)
    .where(and(eq(oauthStates.state, state), eq(oauthStates.provider, 'mercadopago')))
    .limit(1);

  if (!oauthState) {
    return { success: false, error: 'Estado OAuth inválido o expirado. Intenta conectar de nuevo.' };
  }

  if (oauthState.expiresAt < new Date()) {
    await db.delete(oauthStates).where(eq(oauthStates.id, oauthState.id));
    return { success: false, error: 'La autorización expiró. Intenta conectar de nuevo.' };
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(MP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: appId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: oauthState.redirectUri,
        code_verifier: oauthState.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      logger.error('MP OAuth token exchange failed', {
        status: tokenResponse.status,
        error: (errorData as Record<string, unknown>).error,
      });
      return {
        success: false,
        error: 'Error al obtener tokens de MercadoPago. Verifica tus credenciales de aplicación.',
      };
    }

    const tokens = (await tokenResponse.json()) as OAuthTokenResponse;

    // Encrypt tokens before storage
    const accessTokenEnc = encrypt(tokens.access_token);
    const refreshTokenEnc = encrypt(tokens.refresh_token);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + tokens.expires_in * 1000);
    const connectionId = `ppc-${crypto.randomUUID()}`;

    // Fetch MP user email for display
    let mpEmail: string | null = null;
    try {
      const userResponse = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userResponse.ok) {
        const userData = (await userResponse.json()) as { email?: string };
        mpEmail = userData.email ?? null;
      }
    } catch {
      // Non-critical — email is cosmetic
    }

    // Upsert connection
    const existing = await db
      .select({ id: paymentProviderConnections.id })
      .from(paymentProviderConnections)
      .where(
        and(eq(paymentProviderConnections.provider, 'mercadopago'), eq(paymentProviderConnections.storeId, 'main')),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(paymentProviderConnections)
        .set({
          status: 'connected',
          accessTokenEnc,
          refreshTokenEnc,
          publicKey: tokens.public_key,
          tokenExpiresAt: expiresAt,
          mpUserId: String(tokens.user_id),
          mpEmail,
          scopes: tokens.scope,
          connectedAt: now,
          disconnectedAt: null,
          lastRefreshedAt: now,
          updatedAt: now,
        })
        .where(eq(paymentProviderConnections.id, existing[0].id));
    } else {
      await db.insert(paymentProviderConnections).values({
        id: connectionId,
        provider: 'mercadopago',
        storeId: 'main',
        status: 'connected',
        accessTokenEnc,
        refreshTokenEnc,
        publicKey: tokens.public_key,
        tokenExpiresAt: expiresAt,
        mpUserId: String(tokens.user_id),
        mpEmail,
        scopes: tokens.scope,
        connectedAt: now,
        lastRefreshedAt: now,
      });
    }

    // Update storeConfig with public key and enable MP
    const { storeConfig: storeConfigTable } = await import('@/db/schema');
    await db
      .update(storeConfigTable)
      .set({
        mpPublicKey: tokens.public_key,
        mpEnabled: true,
        updatedAt: now,
      })
      .where(eq(storeConfigTable.id, 'main'));

    // Invalidate Redis cache so POS dropdown picks up mpEnabled: true
    const { cache } = await import('@/infrastructure/redis');
    await cache.invalidatePattern('config:');

    // Cleanup used state
    await db.delete(oauthStates).where(eq(oauthStates.id, oauthState.id));

    logger.info('MercadoPago OAuth connected', {
      userId: String(tokens.user_id),
      email: mpEmail,
    });

    return { success: true, email: mpEmail ?? undefined };
  } catch (err) {
    logger.error('MP OAuth exchange error', { error: err instanceof Error ? err.message : 'Unknown' });
    return { success: false, error: 'Error interno al conectar con MercadoPago' };
  }
}

/**
 * Refreshes an expired/expiring MercadoPago access token.
 * Called automatically when getting the access token.
 */
export async function refreshMPAccessToken(connectionId: string, refreshTokenEnc: string): Promise<boolean> {
  const appId = env.MP_APP_ID;
  const clientSecret = env.MP_CLIENT_SECRET;

  if (!appId || !clientSecret) {
    logger.error('Cannot refresh MP token: MP_APP_ID or MP_CLIENT_SECRET missing');
    return false;
  }

  try {
    const refreshToken = decrypt(refreshTokenEnc);

    const response = await fetch(MP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: appId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      logger.error('MP token refresh failed', { status: response.status });
      await db
        .update(paymentProviderConnections)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(paymentProviderConnections.id, connectionId));
      return false;
    }

    const tokens = (await response.json()) as OAuthTokenResponse;
    const now = new Date();

    await db
      .update(paymentProviderConnections)
      .set({
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: encrypt(tokens.refresh_token),
        publicKey: tokens.public_key,
        tokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000),
        lastRefreshedAt: now,
        status: 'connected',
        updatedAt: now,
      })
      .where(eq(paymentProviderConnections.id, connectionId));

    logger.info('MP token refreshed successfully', { connectionId });
    return true;
  } catch (err) {
    logger.error('MP token refresh error', { error: err instanceof Error ? err.message : 'Unknown' });
    return false;
  }
}

/**
 * Gets the decrypted access token for MercadoPago.
 * Auto-refreshes if within 24h of expiry.
 * Falls back to env MP_ACCESS_TOKEN if no OAuth connection exists.
 */
export async function getMPAccessToken(): Promise<string | null> {
  try {
    const [connection] = await db
      .select()
      .from(paymentProviderConnections)
      .where(
        and(eq(paymentProviderConnections.provider, 'mercadopago'), eq(paymentProviderConnections.storeId, 'main')),
      )
      .limit(1);

    if (!connection || connection.status === 'disconnected' || !connection.accessTokenEnc) {
      // Fallback to env variable (legacy / dev mode)
      return env.MP_ACCESS_TOKEN ?? null;
    }

    // Check if token needs refresh (within 24 hours of expiry)
    const refreshThreshold = 24 * 60 * 60 * 1000; // 24h
    const needsRefresh =
      connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - Date.now() < refreshThreshold;

    if (needsRefresh && connection.refreshTokenEnc) {
      const refreshed = await refreshMPAccessToken(connection.id, connection.refreshTokenEnc);
      if (refreshed) {
        // Re-fetch the updated connection
        const [updated] = await db
          .select()
          .from(paymentProviderConnections)
          .where(eq(paymentProviderConnections.id, connection.id))
          .limit(1);
        if (updated?.accessTokenEnc) {
          return decrypt(updated.accessTokenEnc);
        }
      }
      // If refresh failed but token not yet expired, still try the existing one
      if (connection.tokenExpiresAt && connection.tokenExpiresAt > new Date()) {
        return decrypt(connection.accessTokenEnc);
      }
      // Token fully expired and refresh failed — fall back to env
      return env.MP_ACCESS_TOKEN ?? null;
    }

    // Token is still valid
    if (connection.status === 'expired') {
      return env.MP_ACCESS_TOKEN ?? null;
    }

    return decrypt(connection.accessTokenEnc);
  } catch (err) {
    logger.error('getMPAccessToken error', { error: err instanceof Error ? err.message : 'Unknown' });
    return env.MP_ACCESS_TOKEN ?? null;
  }
}

/**
 * Disconnects MercadoPago OAuth. Clears encrypted tokens.
 */
export async function disconnectProvider(provider: ProviderType): Promise<void> {
  const now = new Date();

  await db
    .update(paymentProviderConnections)
    .set({
      status: 'disconnected',
      accessTokenEnc: null,
      refreshTokenEnc: null,
      disconnectedAt: now,
      updatedAt: now,
    })
    .where(and(eq(paymentProviderConnections.provider, provider), eq(paymentProviderConnections.storeId, 'main')));

  // Disable MP in storeConfig
  if (provider === 'mercadopago') {
    const { storeConfig: storeConfigTable } = await import('@/db/schema');
    await db.update(storeConfigTable).set({ mpEnabled: false, updatedAt: now }).where(eq(storeConfigTable.id, 'main'));
    const { cache } = await import('@/infrastructure/redis');
    await cache.invalidatePattern('config:');
  }

  logger.info(`${provider} disconnected`);
}

/**
 * Gets the connection status for display in the UI.
 */
export async function getProviderConnectionStatus(provider: ProviderType): Promise<{
  connected: boolean;
  email: string | null;
  expiresAt: string | null;
  publicKey: string | null;
  status: string;
}> {
  try {
    const [connection] = await db
      .select()
      .from(paymentProviderConnections)
      .where(and(eq(paymentProviderConnections.provider, provider), eq(paymentProviderConnections.storeId, 'main')))
      .limit(1);

    if (!connection || connection.status === 'disconnected') {
      return { connected: false, email: null, expiresAt: null, publicKey: null, status: 'disconnected' };
    }

    return {
      connected: connection.status === 'connected',
      email: connection.mpEmail,
      expiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
      publicKey: connection.publicKey,
      status: connection.status,
    };
  } catch {
    return { connected: false, email: null, expiresAt: null, publicKey: null, status: 'error' };
  }
}
