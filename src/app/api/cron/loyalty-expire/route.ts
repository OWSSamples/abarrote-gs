import { NextRequest, NextResponse } from 'next/server';
import { expireStalePointsForStore } from '@/server/loyalty-expiration-service';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { db } from '@/db';
import { storeConfig, stores } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Weekly cron to expire loyalty points for inactive customers.
 * Reads loyaltyExpirationDays from storeConfig (default: 365).
 */
export async function GET(req: NextRequest) {
  const cronSecret = env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const configs = await db
      .select({ storeId: storeConfig.id, days: storeConfig.loyaltyExpirationDays })
      .from(storeConfig)
      .innerJoin(stores, eq(stores.id, storeConfig.id))
      .where(and(eq(stores.status, 'active'), isNull(stores.deletedAt)));

    let expired = 0;
    let processedStores = 0;
    let failedStores = 0;
    for (const config of configs) {
      try {
        const result = await expireStalePointsForStore(config.storeId, config.days ?? 365);
        expired += result.expired;
        processedStores++;
      } catch (error) {
        failedStores++;
        logger.error('Loyalty expiration failed for store', {
          storeId: config.storeId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    logger.info('Loyalty expiration cron completed', { expired, processedStores, failedStores });
    return NextResponse.json({ ok: failedStores === 0, expired, processedStores, failedStores });
  } catch (error) {
    logger.error('Loyalty expiration cron failed', { error });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
