import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { env, getBaseUrl } from '@/lib/env';
import { connectDeliveryProvider } from '@/infrastructure/delivery/delivery-service';
import { encrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const baseUrl = getBaseUrl();
  const settingsUrl = `${baseUrl}/dashboard/settings`;

  const cookieStore = await cookies();
  const storedState = cookieStore.get('uber_oauth_state')?.value;
  const storeId = cookieStore.get('uber_oauth_store')?.value;

  cookieStore.delete('uber_oauth_state');
  cookieStore.delete('uber_oauth_store');

  if (error) {
    logger.warn('Uber Eats OAuth denied by user', {
      action: 'uber_oauth_denied',
      error,
      errorDescription,
      storeId,
    });
    const redirectUrl = new URL(settingsUrl);
    redirectUrl.searchParams.set('oauth', 'denied');
    redirectUrl.searchParams.set('provider', 'ubereats');
    return NextResponse.redirect(redirectUrl.toString());
  }

  if (!code || !state || !storedState || state !== storedState) {
    logger.error('Uber Eats OAuth callback invalid params', {
      action: 'uber_oauth_invalid',
      hasCode: !!code,
      hasState: !!state,
      hasStoredState: !!storedState,
      stateMatch: state === storedState,
      storeId,
    });
    const redirectUrl = new URL(settingsUrl);
    redirectUrl.searchParams.set('oauth', 'error');
    redirectUrl.searchParams.set('provider', 'ubereats');
    redirectUrl.searchParams.set('msg', 'Parámetros de autorización inválidos');
    return NextResponse.redirect(redirectUrl.toString());
  }

  if (!storeId) {
    logger.error('Uber Eats OAuth missing storeId in cookies');
    const redirectUrl = new URL(settingsUrl);
    redirectUrl.searchParams.set('oauth', 'error');
    redirectUrl.searchParams.set('provider', 'ubereats');
    redirectUrl.searchParams.set('msg', 'Error interno: storeId faltante');
    return NextResponse.redirect(redirectUrl.toString());
  }

  if (!env.UBER_EATS_CLIENT_ID || !env.UBER_EATS_CLIENT_SECRET) {
    logger.error('Uber Eats OAuth credentials not configured on server');
    const redirectUrl = new URL(settingsUrl);
    redirectUrl.searchParams.set('oauth', 'error');
    redirectUrl.searchParams.set('provider', 'ubereats');
    redirectUrl.searchParams.set('msg', 'Servidor no configurado para Uber Eats');
    return NextResponse.redirect(redirectUrl.toString());
  }

  try {
    const tokenRes = await fetch('https://api.uber.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${env.UBER_EATS_CLIENT_ID}:${env.UBER_EATS_CLIENT_SECRET}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: env.UBER_EATS_REDIRECT_URI ?? `${baseUrl}/api/uber/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      logger.error('Uber Eats token exchange failed', {
        action: 'uber_oauth_token_failed',
        status: tokenRes.status,
        body,
        storeId,
      });
      const redirectUrl = new URL(settingsUrl);
      redirectUrl.searchParams.set('oauth', 'error');
      redirectUrl.searchParams.set('provider', 'ubereats');
      redirectUrl.searchParams.set('msg', 'Error al intercambiar el código de autorización');
      return NextResponse.redirect(redirectUrl.toString());
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error) {
      logger.error('Uber Eats token error response', {
        action: 'uber_oauth_token_error',
        error: tokenData.error,
        description: tokenData.error_description,
        storeId,
      });
      const redirectUrl = new URL(settingsUrl);
      redirectUrl.searchParams.set('oauth', 'error');
      redirectUrl.searchParams.set('provider', 'ubereats');
      redirectUrl.searchParams.set('msg', tokenData.error_description ?? tokenData.error);
      return NextResponse.redirect(redirectUrl.toString());
    }

    if (!tokenData.access_token) {
      logger.error('Uber Eats token response missing access_token', {
        action: 'uber_oauth_no_token',
        storeId,
      });
      const redirectUrl = new URL(settingsUrl);
      redirectUrl.searchParams.set('oauth', 'error');
      redirectUrl.searchParams.set('provider', 'ubereats');
      redirectUrl.searchParams.set('msg', 'Respuesta inválida de Uber Eats');
      return NextResponse.redirect(redirectUrl.toString());
    }

    const accessToken = tokenData.access_token;
    const webhookSecret = env.UBER_EATS_WEBHOOK_SECRET;

    const result = await connectDeliveryProvider({
      storeId,
      provider: 'ubereats',
      accessToken,
      webhookSecret: webhookSecret || undefined,
      providerStoreId: storeId,
      environment: 'production',
    });

    logger.info('Uber Eats OAuth connected successfully', {
      action: 'uber_oauth_connected',
      storeId,
      storeName: result.storeName,
    });

    const redirectUrl = new URL(settingsUrl);
    redirectUrl.searchParams.set('oauth', 'success');
    redirectUrl.searchParams.set('provider', 'ubereats');
    if (result.storeName) {
      redirectUrl.searchParams.set('storeName', result.storeName);
    }

    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    logger.error('Uber Eats OAuth unexpected error', {
      action: 'uber_oauth_unexpected_error',
      error: err instanceof Error ? err.message : 'unknown',
      storeId,
    });
    const redirectUrl = new URL(settingsUrl);
    redirectUrl.searchParams.set('oauth', 'error');
    redirectUrl.searchParams.set('provider', 'ubereats');
    redirectUrl.searchParams.set('msg', 'Error interno del servidor');
    return NextResponse.redirect(redirectUrl.toString());
  }
}