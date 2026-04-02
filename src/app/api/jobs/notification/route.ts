import { NextRequest, NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/infrastructure/qstash';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// POST /api/jobs/notification
// ══════════════════════════════════════════════════════════════
//
// Receives a Telegram notification payload from QStash and sends it.
// This decouples notification sending from the main request flow.
//
// Payload: { message: string }

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('upstash-signature') ?? '';

  const isValid = await verifyQStashSignature(signature, body);
  if (!isValid) {
    logger.warn('Invalid QStash signature on notification job', {
      action: 'job_notification_auth_fail',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: { message: string };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!payload.message || typeof payload.message !== 'string') {
    return NextResponse.json({ error: 'Missing message field' }, { status: 400 });
  }

  try {
    // Dynamic import to avoid circular deps with server actions
    const { sendNotificationDirect } = await import('@/infrastructure/qstash/handlers');
    await sendNotificationDirect(payload.message);

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
