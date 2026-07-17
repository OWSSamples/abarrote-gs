import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { paymentCharges } from '@/db/schema';
import { getClipCheckoutStatus, getClipTerminalStatus } from '@/lib/clip-provider';
import { logger } from '@/lib/logger';
import { checkRateLimitAsync, getClientIp } from '@/infrastructure/redis';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';

const MAX_WEBHOOK_BYTES = 64 * 1024;

const checkoutSignalSchema = z.object({ payment_request_id: z.string().min(1).max(200) }).passthrough();
const pinpadSignalSchema = z.object({ pinpad_request_id: z.string().min(1).max(200) }).passthrough();
const genericSignalSchema = z
  .object({
    id: z.string().min(1).max(200),
    origin: z.string().min(1).max(100),
    event_type: z.string().min(1).max(100),
  })
  .passthrough();
const clipSignalSchema = z.union([checkoutSignalSchema, pinpadSignalSchema, genericSignalSchema]);

type ChargeStatus = 'pending' | 'paid' | 'expired' | 'failed';

const VALID_STATUS_TRANSITIONS: Record<string, ReadonlySet<ChargeStatus>> = {
  pending: new Set(['paid', 'expired', 'failed']),
  paid: new Set(),
  expired: new Set(['paid']),
  failed: new Set(['paid']),
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimitAsync(`clip_webhook:${ip}`, { limit: 30, windowMs: 60_000 });

  if (rateLimit.isRateLimited) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const storeId = new URL(request.url).searchParams.get('store');
    if (!storeId || !/^(?:main|[a-f0-9]{32})$/.test(storeId)) {
      return NextResponse.json({ error: 'Store scope required' }, { status: 400 });
    }
    const body = await readTextBodyWithLimit(request, MAX_WEBHOOK_BYTES);
    if (body === null) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = clipSignalSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn('Clip webhook payload rejected', { action: 'clip_webhook_invalid_payload', ip });
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const signal = parsed.data;
    const providerChargeId =
      'payment_request_id' in signal
        ? signal.payment_request_id
        : 'pinpad_request_id' in signal
          ? signal.pinpad_request_id
          : signal.id;

    const [existing] = await db
      .select({
        id: paymentCharges.id,
        status: paymentCharges.status,
        paymentMethod: paymentCharges.paymentMethod,
      })
      .from(paymentCharges)
      .where(
        and(
          eq(paymentCharges.storeId, storeId),
          eq(paymentCharges.provider, 'clip'),
          eq(paymentCharges.providerChargeId, providerChargeId),
        ),
      )
      .limit(1);

    if (!existing) {
      logger.warn('Clip webhook signal has no matching charge', {
        action: 'clip_webhook_no_match',
        providerChargeId,
      });
      return NextResponse.json({ received: true, matched: false }, { status: 202 });
    }

    // Webhook fields are not authoritative; reconcile through Clip's authenticated API.
    const providerStatus =
      existing.paymentMethod === 'clip_terminal'
        ? await getClipTerminalStatus(providerChargeId, storeId)
        : await getClipCheckoutStatus(providerChargeId, storeId);

    if (providerStatus.id !== providerChargeId) {
      logger.warn('Clip reconciliation returned a different charge identifier', {
        action: 'clip_webhook_id_mismatch',
        chargeId: existing.id,
        requestedProviderChargeId: providerChargeId,
        returnedProviderChargeId: providerStatus.id,
      });
      return NextResponse.json({ error: 'Charge reconciliation failed' }, { status: 409 });
    }

    if (providerStatus.status === existing.status) {
      return NextResponse.json({ received: true, matched: true, changed: false });
    }

    const nextStatus = providerStatus.status as ChargeStatus;
    const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status];
    if (!allowedTransitions?.has(nextStatus)) {
      logger.warn('Clip webhook status transition denied', {
        action: 'clip_webhook_transition_denied',
        chargeId: existing.id,
        currentStatus: existing.status,
        attemptedStatus: nextStatus,
      });
      return NextResponse.json({ received: true, matched: true, changed: false });
    }

    const [updated] = await db
      .update(paymentCharges)
      .set({
        status: nextStatus,
        paidAt: nextStatus === 'paid' ? providerStatus.paidAt ?? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentCharges.id, existing.id),
          eq(paymentCharges.storeId, storeId),
          eq(paymentCharges.provider, 'clip'),
          nextStatus === 'paid'
            ? ne(paymentCharges.status, 'paid')
            : eq(paymentCharges.status, 'pending'),
        ),
      )
      .returning({ status: paymentCharges.status });

    if (!updated) {
      return NextResponse.json({ received: true, matched: true, changed: false });
    }

    logger.info('Clip payment status reconciled', {
      action: 'clip_webhook_reconciled',
      chargeId: existing.id,
      oldStatus: existing.status,
      newStatus: nextStatus,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({ received: true, matched: true, changed: true });
  } catch (error) {
    logger.error('Clip webhook reconciliation failed', {
      action: 'clip_webhook_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 502 });
  }
}
