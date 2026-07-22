import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken, verifyIdToken } from '@/lib/cognito-admin';
import { checkRateLimitAsync, getClientIp } from '@/infrastructure/redis';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const SESSION_COOKIE = '__session';
const ACCESS_TOKEN_COOKIE = '__cognito_access';
const STORE_COOKIE = '__store_id';
const MAX_BODY_BYTES = 16 * 1024;
const MAX_ABSOLUTE_SESSION_SECONDS = 6 * 60 * 60;
const sessionSchema = z.object({
  token: z.string().min(100).max(12_000),
  accessToken: z.string().min(100).max(12_000).optional(),
});

function noStoreJson(body: Record<string, unknown>, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function hasTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
    priority: 'high' as const,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasTrustedOrigin(request)) {
    return noStoreJson({ error: 'Solicitud no autorizada.' }, 403);
  }

  const rateLimit = await checkRateLimitAsync(`auth_session:${getClientIp(request)}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimit.isRateLimited) {
    return noStoreJson({ error: 'Demasiadas solicitudes.' }, 429);
  }

  try {
    const rawBody = await readTextBodyWithLimit(request, MAX_BODY_BYTES);
    if (rawBody === null) {
      return noStoreJson({ error: 'Solicitud demasiado grande.' }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return noStoreJson({ error: 'Solicitud inválida.' }, 400);
    }

    const parsed = sessionSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson({ error: 'Solicitud inválida.' }, 400);
    }

    const decoded = await verifyIdToken(parsed.data.token);
    if (parsed.data.accessToken) {
      const accessToken = await verifyAccessToken(parsed.data.accessToken);
      if (accessToken.sub !== decoded.sub) {
        return noStoreJson({ error: 'Los tokens de sesión no pertenecen al mismo usuario.' }, 401);
      }
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const authenticatedAt = decoded.auth_time ?? decoded.iat ?? nowSeconds;
    const tokenRemaining = decoded.exp - nowSeconds;
    const absoluteRemaining = authenticatedAt + MAX_ABSOLUTE_SESSION_SECONDS - nowSeconds;
    const maxAge = Math.min(tokenRemaining, absoluteRemaining);
    if (!Number.isFinite(maxAge) || maxAge <= 0) {
      return noStoreJson({ error: 'La sesión expiró.' }, 401);
    }

    const response = noStoreJson({ ok: true });
    response.cookies.set(SESSION_COOKIE, parsed.data.token, sessionCookieOptions(maxAge));
    if (parsed.data.accessToken) {
      response.cookies.set(ACCESS_TOKEN_COOKIE, parsed.data.accessToken, sessionCookieOptions(maxAge));
    }
    return response;
  } catch (error) {
    const err = error as { name?: string; message?: string };
    logger.warn('Auth session establishment failed', {
      action: 'auth.session.establish_failed',
      errorName: err.name,
      errorMessage: err.message,
    });
    return noStoreJson({ error: 'No fue posible establecer la sesión.' }, 401);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!hasTrustedOrigin(request)) {
    return noStoreJson({ error: 'Solicitud no autorizada.' }, 403);
  }

  const response = noStoreJson({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', sessionCookieOptions(0));
  response.cookies.set(STORE_COOKIE, '', sessionCookieOptions(0));
  return response;
}
