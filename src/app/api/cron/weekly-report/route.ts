import { NextRequest, NextResponse } from 'next/server';
import { sendWeeklyTelegramReport } from '@/app/actions/analytics-advanced-actions';
import { logger } from '@/lib/logger';
import { idempotencyCheck } from '@/infrastructure/redis';
import { env } from '@/lib/env';

/**
 * Cron endpoint for the automated weekly Telegram report.
 * Runs every Monday at 7:00 AM CST (vercel.json).
 */
export async function GET(req: NextRequest) {
  const cronSecret = env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const weekKey = getISOWeekKey();
    const isNew = await idempotencyCheck(`cron_weekly_report:${weekKey}`, { ttlMs: 7 * 86_400_000 });
    if (!isNew) {
      logger.info('Weekly report already sent this week', { action: 'cron_weekly_report_duplicate', week: weekKey });
      return NextResponse.json({ sent: false, reason: 'already_sent_this_week' });
    }

    const result = await sendWeeklyTelegramReport();
    logger.info('Weekly Telegram report', { sent: result.sent });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Weekly report cron failed', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Error al generar reporte semanal' }, { status: 500 });
  }
}

/** Returns a YYYY-Www key for idempotency (ISO week number). */
function getISOWeekKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
