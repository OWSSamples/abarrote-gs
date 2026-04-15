import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';
import { logger } from '@/lib/logger';

const authHandler = auth.middleware({ loginUrl: '/auth/login' });

// ══════════════════════════════════════════════════════════════
// Bot / Scanner Blocklist — blocked at Edge before any routing
// ══════════════════════════════════════════════════════════════

const BOT_UA_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /nmap/i,
  /zgrab/i,
  /dirbuster/i,
  /gobuster/i,
  /nuclei/i,
  /hydra/i,
  /metasploit/i,
  /havij/i,
  /acunetix/i,
  /nessus/i,
  /openvas/i,
  /burpsuite/i,
  /\bscanner\b/i,
  /\bfuzzer\b/i,
];

function isBlockedBot(request: NextRequest): boolean {
  const ua = request.headers.get('user-agent') ?? '';
  return BOT_UA_PATTERNS.some((p) => p.test(ua));
}

// ══════════════════════════════════════════════════════════════
// Suspicious Path Patterns — block scanner probes immediately
// ══════════════════════════════════════════════════════════════

const BLOCKED_PATH_PATTERNS = [
  /\/\.env/i,
  /\/\.git/i,
  /\/wp-admin/i,
  /\/wp-login/i,
  /\/phpMyAdmin/i,
  /\/phpmyadmin/i,
  /\/admin\/config/i,
  /\/etc\/passwd/i,
  /\/proc\/self/i,
  /\.\.(\/|\\)/,
  /%2e%2e/i,
  /\x00/,
  /\.(php|asp|aspx|jsp|cgi|sh|bash)$/i,
];

function isSuspiciousPath(request: NextRequest): boolean {
  const path = request.nextUrl.pathname + request.nextUrl.search;
  return BLOCKED_PATH_PATTERNS.some((p) => p.test(path));
}

// ══════════════════════════════════════════════════════════════
// CSRF Protection via Origin header verification
// ══════════════════════════════════════════════════════════════
//
// Next.js Server Actions use POST requests. We verify the Origin
// header against the Host header to prevent cross-site request
// forgery. Follows OWASP "Verifying the Origin with Standard Headers".
//
// GET/HEAD/OPTIONS are safe methods — no CSRF check needed.
// Webhook routes use HMAC/signature auth. Cron/job routes use
// secret-based or QStash-signature auth.

function csrfCheck(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }

  const { pathname } = request.nextUrl;

  // Exempt routes: webhooks, cron, jobs, oauth, telegram, auth
  if (
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/jobs') ||
    pathname.startsWith('/api/oauth') ||
    pathname.startsWith('/api/mercadopago/webhook') ||
    pathname.startsWith('/api/telegram/webhook') ||
    pathname.startsWith('/auth')
  ) {
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

// ══════════════════════════════════════════════════════════════
// Security Headers — applied to every response
// ══════════════════════════════════════════════════════════════

const isDev = process.env.NODE_ENV === 'development';

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://sdk.mercadopago.com"
  : "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://sdk.mercadopago.com";

const CSP = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.shopify.com",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.shopify.com",
  "img-src 'self' data: blob: https://*.amazonaws.com https://lh3.googleusercontent.com https://*.mlstatic.com https://*.firebasestorage.app",
  "connect-src 'self' https://*.neon.tech wss://*.neon.tech https://firestore.googleapis.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.upstash.io https://api.mercadopago.com https://api.stripe.com https://api.conekta.io https://api.telegram.org https://*.firebaseio.com wss://*.firebaseio.com https://*.amazonaws.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(self), payment=(), interest-cohort=()',
  );
  // Disable legacy XSS auditor (can be exploited in old browsers)
  response.headers.set('X-XSS-Protection', '0');

  // Hide server technology fingerprint
  response.headers.delete('X-Powered-By');
  response.headers.set('Server', 'abarrote');

  if (!isDev) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  response.headers.set('Content-Security-Policy', CSP);

  response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  return response;
}

// ══════════════════════════════════════════════════════════════
// Main Proxy Export
// ══════════════════════════════════════════════════════════════

export async function proxy(request: Parameters<typeof authHandler>[0]) {
  const req = request as NextRequest;

  // 1. Block bots and scanners at the edge
  if (isBlockedBot(req)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 2. Block suspicious scanner probe paths
  if (isSuspiciousPath(req)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 3. CSRF check for all state-mutating requests
  const csrfResponse = csrfCheck(req);
  if (csrfResponse) {
    return applySecurityHeaders(csrfResponse);
  }

  // 4. Request-ID for tracing / observability
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  // 5. Structured request logging
  const start = Date.now();
  logger.info('Incoming request', {
    action: 'http_request',
    requestId,
    method: req.method,
    path: req.nextUrl.pathname,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? undefined,
  });

  // 6. Auth check + session handling (via auth.middleware)
  const response = await authHandler(request);

  // Apply security headers + request-ID to all responses
  if (response) {
    applySecurityHeaders(response);
    response.headers.set('x-request-id', requestId);

    // Structured response logging
    logger.info('Request completed', {
      action: 'http_response',
      requestId,
      method: req.method,
      path: req.nextUrl.pathname,
      status: response.status,
      durationMs: Date.now() - start,
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Exclude: api, static, auth, display (public customer screen), etc.
    '/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|auth|display|login-brand\\.svg|backgrounds).*)',
  ],
};
