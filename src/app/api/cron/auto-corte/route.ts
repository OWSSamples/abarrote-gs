import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { storeConfig, stores } from '@/db/schema';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { constantTimeStringEqual } from '@/lib/constant-time';
import { runAutoCashCloseForStore } from '@/server/auto-cash-close-service';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const receivedSecret = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!env.CRON_SECRET || !receivedSecret || !constantTimeStringEqual(env.CRON_SECRET, receivedSecret)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const configuredStores = await db
      .select({
        storeId: storeConfig.id,
        autoCorteEnabled: storeConfig.autoCorteEnabled,
        autoCorteTime: storeConfig.autoCorteTime,
        salesOpenTime: storeConfig.salesOpenTime,
        businessTimezone: storeConfig.businessTimezone,
        defaultStartingFund: storeConfig.defaultStartingFund,
      })
      .from(storeConfig)
      .innerJoin(stores, eq(stores.id, storeConfig.id))
      .where(
        and(
          eq(storeConfig.autoCorteEnabled, true),
          eq(stores.status, 'active'),
          isNull(stores.deletedAt),
        ),
      );

    const summary = { processed: configuredStores.length, created: 0, failed: 0 };
    for (const store of configuredStores) {
      try {
        const result = await runAutoCashCloseForStore(store.storeId, {
          autoCorteEnabled: store.autoCorteEnabled,
          autoCorteTime: store.autoCorteTime,
          salesOpenTime: store.salesOpenTime,
          businessTimezone: store.businessTimezone,
          defaultStartingFund: Number(store.defaultStartingFund),
        });
        if (result === 'created') summary.created++;
      } catch (error) {
        summary.failed++;
        logger.error('Automatic cash close failed for store', {
          action: 'auto_cash_close_store_failed',
          storeId: store.storeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Automatic cash close cron completed', summary);
    return NextResponse.json({ ok: summary.failed === 0, ...summary });
  } catch (error) {
    logger.error('Automatic cash close cron failed', {
      action: 'auto_cash_close_cron_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
