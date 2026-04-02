import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';

const authHandler = auth.middleware({ loginUrl: '/auth/login' });

/**
 * CSRF Protection via Origin header verification.
 *
 * Next.js Server Actions use POST requests. We verify the Origin header
 * against the Host header to prevent cross-site request forgery.
 * Follows OWASP "Verifying the Origin with Standard Headers" approach.
 *
 * GET/HEAD/OPTIONS are safe methods — no CSRF check needed.
 * Webhook routes use HMAC/signature auth. Cron routes use secret-based auth.
 */
function csrfCheck(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/webhooks') || pathname.startsWith('/api/cron') || pathname.startsWith('/api/jobs')) {
    return null;
  }

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (!origin || !host) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (originHost !== host) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return null;
}

/**
 * Applies security headers to the response.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );
  response.headers.set('X-XSS-Protection', '1; mode=block');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
  }

  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://sdk.mercadopago.com"
    : "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://sdk.mercadopago.com";

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.amazonaws.com https://lh3.googleusercontent.com https://*.mlstatic.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.telegram.org https://api.mercadopago.com https://*.amazonaws.com wss://*.firebaseio.com",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export async function proxy(request: Parameters<typeof authHandler>[0]) {
  // 1. CSRF check first — block cross-origin mutations early
  const csrfResponse = csrfCheck(request as NextRequest);
  if (csrfResponse) {
    return csrfResponse;
  }

  // 2. Auth + security headers
  const response = await authHandler(request);

  // authHandler returns either a redirect or NextResponse.next()
  if (response) {
    applySecurityHeaders(response);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|auth|login-brand\\.svg|backgrounds).*)',
  ],
};
