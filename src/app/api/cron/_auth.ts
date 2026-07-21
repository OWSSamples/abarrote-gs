import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

/**
 * Validates the shared-secret authorization for cron endpoints.
 *
 * Cron routes are protected by `CRON_SECRET` (sent as `Bearer <secret>`
 * in the `Authorization` header). If the secret is unset or the header
 * does not match, a 401 response is returned; otherwise `null`.
 *
 * Usage:
 *   const unauthorized = verifyCronAuth(req);
 *   if (unauthorized) return unauthorized;
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  // CRON_SECRET is mandatory — if not set, reject all requests
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  return null;
}
