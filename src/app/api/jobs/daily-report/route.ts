import { NextRequest, NextResponse } from 'next/server';
import { readVerifiedJobBody } from '../_verify';
import { logger } from '@/lib/logger';
import { db } from '@/db';
import { storeConfig, stores } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { buildDailyStoreReport } from '@/server/daily-report-service';
import { sendNotificationDirect } from '@/infrastructure/qstash/handlers';

// ══════════════════════════════════════════════════════════════
// POST /api/jobs/daily-report
// ══════════════════════════════════════════════════════════════
//
// Generates and sends the daily Telegram report.
// Replaces the old GET /api/cron/daily-report with QStash scheduling.
//
// Payload: {} (no data needed)

export async function POST(request: NextRequest) {
  const verified = await readVerifiedJobBody(request);
  if (!verified.ok) return verified.response;

  try {
    const activeStores = await db
      .select({ storeId: storeConfig.id })
      .from(storeConfig)
      .innerJoin(stores, eq(stores.id, storeConfig.id))
      .where(
        and(
          eq(storeConfig.enableNotifications, true),
          eq(stores.status, 'active'),
          isNull(stores.deletedAt),
        ),
      );
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const store of activeStores) {
      try {
        const report = await buildDailyStoreReport(store.storeId);
        if (!report.shouldSend) {
          skipped++;
          continue;
        }
        await sendNotificationDirect(report.message, store.storeId);
        sent++;
      } catch (error) {
        failed++;
        logger.error('Daily report failed for store', {
          action: 'job_daily_report_store_error',
          storeId: store.storeId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Daily report job completed', {
      action: 'job_daily_report',
      sent,
      skipped,
      failed,
    });

    return NextResponse.json({ sent, skipped, failed });
  } catch (err) {
    logger.error('Daily report job failed', {
      action: 'job_daily_report_error',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
