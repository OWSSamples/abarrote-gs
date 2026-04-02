import { NextRequest, NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/infrastructure/qstash';
import { sendDailyTelegramReport } from '@/app/actions/analytics-advanced-actions';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// POST /api/jobs/daily-report
// ══════════════════════════════════════════════════════════════
//
// Generates and sends the daily Telegram report.
// Replaces the old GET /api/cron/daily-report with QStash scheduling.
//
// Payload: {} (no data needed)

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('upstash-signature') ?? '';

  const isValid = await verifyQStashSignature(signature, body);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendDailyTelegramReport();

    logger.info('Daily report job completed', {
      action: 'job_daily_report',
      sent: result.sent,
    });

    return NextResponse.json(result);
  } catch (err) {
    logger.error('Daily report job failed', {
      action: 'job_daily_report_error',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
