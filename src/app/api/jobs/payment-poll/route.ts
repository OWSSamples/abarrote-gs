import { NextRequest, NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/infrastructure/qstash';
import { logger } from '@/lib/logger';
import { paymentPollPayloadSchema, parseJobPayload } from '@/infrastructure/jobs/schemas';

// ══════════════════════════════════════════════════════════════
// POST /api/jobs/payment-poll
// ══════════════════════════════════════════════════════════════
//
// Polls a payment charge status from the provider API.
// Scheduled by QStash after a charge is created, so we don't
// rely solely on webhooks (belt + suspenders).
//
// Payload: { storeId: string, chargeId: string, provider: 'conekta' | 'stripe' | 'clip' }

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('upstash-signature') ?? '';

  const isValid = await verifyQStashSignature(signature, body);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = parseJobPayload(paymentPollPayloadSchema, body);
  if (!parsed.success) {
    logger.warn('Payment poll invalid payload', { action: 'job_payment_poll_validation', error: parsed.error });
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const payload = parsed.data;

  try {
    const { checkPaymentChargeStatus } = await import('@/server/payment-charge-service');
    const result = await checkPaymentChargeStatus(payload.chargeId, payload.provider, payload.storeId);

    logger.info('Payment poll job completed', {
      action: 'job_payment_poll',
      chargeId: payload.chargeId,
      provider: payload.provider,
      status: result.status,
    });

    // If still pending, QStash can retry via its own retry mechanism.
    // Return 200 to stop retries if terminal state reached.
    if (result.status === 'pending') {
      // Return 500 so QStash retries later (with backoff)
      return NextResponse.json({ status: result.status, retry: true }, { status: 500 });
    }

    return NextResponse.json({ status: result.status, paidAt: result.paidAt });
  } catch (err) {
    logger.error('Payment poll job failed', {
      action: 'job_payment_poll_error',
      chargeId: payload.chargeId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
