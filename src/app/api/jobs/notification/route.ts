import { NextRequest, NextResponse } from 'next/server';
import { readVerifiedJobBody } from '../_verify';
import { logger } from '@/lib/logger';
import { notificationPayloadSchema, parseJobPayload } from '@/infrastructure/jobs/schemas';

// ══════════════════════════════════════════════════════════════
// POST /api/jobs/notification
// ══════════════════════════════════════════════════════════════
//
// Receives a Telegram notification payload from QStash and sends it.
// This decouples notification sending from the main request flow.
//
// Payload: { message: string, storeId: string }

export async function POST(request: NextRequest) {
  const verified = await readVerifiedJobBody(request);
  if (!verified.ok) {
    logger.warn('Invalid QStash signature on notification job', {
      action: 'job_notification_auth_fail',
    });
    return verified.response;
  }

  const parsed = parseJobPayload(notificationPayloadSchema, verified.body);
  if (!parsed.success) {
    logger.warn('Notification invalid payload', { action: 'job_notification_validation', error: parsed.error });
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const payload = parsed.data;

  try {
    // Dynamic import to avoid circular deps with server actions
    const { sendNotificationDirect } = await import('@/infrastructure/qstash/handlers');
    await sendNotificationDirect(payload.message, payload.storeId);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Notification job handler failed', {
      action: 'job_notification_error',
      error: err instanceof Error ? err.message : String(err),
    });
    // Return 500 so QStash retries
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
