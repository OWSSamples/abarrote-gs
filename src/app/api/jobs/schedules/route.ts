import { NextResponse } from 'next/server';
import { scheduleJob, isQStashAvailable, getQStashClient } from '@/infrastructure/qstash';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

// ══════════════════════════════════════════════════════════════
// GET  /api/jobs/schedules — List active QStash schedules
// POST /api/jobs/schedules — Create the standard schedules
// ══════════════════════════════════════════════════════════════
//
// Protected by CRON_SECRET (same as the old cron endpoints).
// Run once after deployment to set up recurring jobs.

function authorize(request: Request): boolean {
  const cronSecret = env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  return !!cronSecret && auth === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isQStashAvailable()) {
    return NextResponse.json({ error: 'QStash not configured' }, { status: 503 });
  }

  try {
    const client = getQStashClient();
    const schedules = await client!.schedules.list();

    return NextResponse.json({
      count: schedules.length,
      schedules: schedules.map((s) => ({
        id: s.scheduleId,
        cron: s.cron,
        destination: s.destination,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    logger.error('Failed to list QStash schedules', {
      action: 'qstash_schedules_list_error',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to list schedules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isQStashAvailable()) {
    return NextResponse.json({ error: 'QStash not configured' }, { status: 503 });
  }

  const results: Array<{ job: string; scheduleId: string | null }> = [];

  // Daily report — every day at 10 PM Mexico City (UTC-6 → 04:00 UTC)
  const dailyId = await scheduleJob('daily-report', '0 4 * * *', {});
  results.push({ job: 'daily-report', scheduleId: dailyId });

  logger.info('QStash schedules initialized', {
    action: 'qstash_schedules_init',
    results,
  });

  return NextResponse.json({ success: true, schedules: results });
}
