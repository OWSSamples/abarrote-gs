import { NextResponse } from 'next/server';
import { exchangeMPAuthorizationCode } from '@/lib/oauth-providers';
import { logger } from '@/lib/logger';

/**
 * OAuth Callback for MercadoPago.
 * MercadoPago redirects here after user authorizes:
 *   GET /api/oauth/mercadopago/callback?code=AUTH_CODE&state=STATE
 *
 * On success: redirects to settings page with success indicator.
 * On failure: redirects to settings page with error indicator.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const settingsUrl = `${baseUrl}/dashboard/settings`;

  // User denied authorization
  if (error) {
    logger.warn('MP OAuth denied by user', { error });
    const redirectUrl = new URL(settingsUrl);
    redirectUrl.searchParams.set('oauth', 'denied');
    return NextResponse.redirect(redirectUrl.toString());
  }

  if (!code || !state) {
    logger.error('MP OAuth callback missing code or state');
    const redirectUrl = new URL(settingsUrl);
    redirectUrl.searchParams.set('oauth', 'error');
    redirectUrl.searchParams.set('msg', 'Parámetros de autorización incompletos');
    return NextResponse.redirect(redirectUrl.toString());
  }

  const result = await exchangeMPAuthorizationCode(code, state);

  const redirectUrl = new URL(settingsUrl);

  if (result.success) {
    redirectUrl.searchParams.set('oauth', 'success');
    redirectUrl.searchParams.set('provider', 'mercadopago');
    if (result.email) {
      redirectUrl.searchParams.set('email', result.email);
    }
  } else {
    redirectUrl.searchParams.set('oauth', 'error');
    redirectUrl.searchParams.set('msg', result.error ?? 'Error desconocido');
  }

  return NextResponse.redirect(redirectUrl.toString());
}
