import { NextRequest, NextResponse } from 'next/server';
import { sendDailyTelegramReport } from '@/app/actions/analytics-advanced-actions';
import { logger } from '@/lib/logger';
import { idempotencyCheck } from '@/infrastructure/redis';
import { verifyCronAuth } from '../_auth';

/**
 * Cron endpoint for the automated daily Telegram report.
 *
 * Can be triggered by:
 * - Vercel Cron Jobs (vercel.json → cron)
 * - External cron service (e.g. cron-job.org) hitting this URL
 * - Manual call from the dashboard
 *
 * Protected by a shared secret to prevent unauthorized triggers.
 */
export async function GET(req: NextRequest) {
  const unauthorized = verifyCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    // Idempotency: prevent duplicate reports if cron retries
    const today = new Date().toISOString().split('T')[0];
    const isNew = await idempotencyCheck(`cron_daily_report:${today}`, { ttlMs: 86_400_000 });
    if (!isNew) {
      logger.info('Daily report already sent today', { action: 'cron_daily_report_duplicate', date: today });
      return NextResponse.json({ sent: false, reason: 'already_sent_today' });
    }

    const result = await sendDailyTelegramReport();
    logger.info('Daily Telegram report', { sent: result.sent });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Daily report cron failed', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Error al generar reporte diario' }, { status: 500 });
  }
}
