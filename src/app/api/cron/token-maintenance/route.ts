import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { paymentProviderConnections, oauthStates, paymentCharges } from '@/db/schema';
import { eq, lt, and } from 'drizzle-orm';
import { refreshMPAccessToken } from '@/lib/oauth-providers';
import { logger } from '@/lib/logger';
import { verifyCronAuth } from '../_auth';

/**
 * Token maintenance cron — runs every 6 hours.
 *
 * 1. Proactively refreshes MercadoPago tokens expiring within 48h
 * 2. Purges expired OAuth PKCE states (> 10 min old)
 * 3. Transitions stale payment charges from 'pending' → 'expired'
 */
export async function GET(req: NextRequest) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  const results = {
    tokensRefreshed: 0,
    tokensFailed: 0,
    statesCleanedUp: 0,
    chargesExpired: 0,
  };

  try {
    // 1. Proactive MP token refresh — tokens expiring within 48h
    const soonExpiring = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const mpConnections = await db
      .select({ id: paymentProviderConnections.id, refreshTokenEnc: paymentProviderConnections.refreshTokenEnc })
      .from(paymentProviderConnections)
      .where(
        and(
          eq(paymentProviderConnections.provider, 'mercadopago'),
          eq(paymentProviderConnections.status, 'connected'),
          lt(paymentProviderConnections.tokenExpiresAt, soonExpiring),
        ),
      );

    for (const conn of mpConnections) {
      if (!conn.refreshTokenEnc) continue;
      try {
        const ok = await refreshMPAccessToken(conn.id, conn.refreshTokenEnc);
        if (ok) results.tokensRefreshed++;
        else results.tokensFailed++;
      } catch {
        results.tokensFailed++;
      }
    }

    // 2. Purge expired OAuth states (PKCE entries older than 10 min)
    const stateResult = await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date()));
    results.statesCleanedUp = stateResult.rowCount ?? 0;

    // 3. Expire stale pending charges past their expiresAt
    const chargeResult = await db
      .update(paymentCharges)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(eq(paymentCharges.status, 'pending'), lt(paymentCharges.expiresAt, new Date())));
    results.chargesExpired = chargeResult.rowCount ?? 0;

    logger.info('Token maintenance cron completed', results);
    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    logger.error('Token maintenance cron failed', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
