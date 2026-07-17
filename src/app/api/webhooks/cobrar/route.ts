import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { paymentCharges } from '@/db/schema';
import { checkRateLimitAsync, getClientIp } from '@/infrastructure/redis';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';

const MAX_WEBHOOK_BYTES = 64 * 1024;

const cobrarEventSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  data: z.object({
    id: z.string().min(1).max(200),
    amount: z.number().positive().max(99_999_999.99),
    currency: z.string().length(3).transform((value) => value.toUpperCase()),
    status: z.string().min(1).max(50),
    reference: z.string().min(1).max(200),
    payment_method: z.string().max(100).optional(),
    paid_at: z.string().datetime({ offset: true }).optional(),
  }),
});

const VALID_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  pending: new Set(['paid', 'expired', 'failed']),
  paid: new Set(),
  expired: new Set(['paid']),
  failed: new Set(['paid']),
};

function verifySignature(body: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const signature = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const secret = env.COBRAR_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('Cobrar.io webhook rejected because its signing secret is not configured', {
      action: 'cobrar_webhook_no_secret',
    });
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimitAsync(`cobrar_webhook:${ip}`, { limit: 30, windowMs: 60_000 });
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

    if (!verifySignature(body, request.headers.get('x-cobrar-signature'), secret)) {
      logger.warn('Cobrar.io webhook signature verification failed', {
        action: 'cobrar_webhook_invalid_sig',
        ip,
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = cobrarEventSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const event = parsed.data;

    const statusMap: Record<string, 'paid' | 'expired' | 'failed'> = {
      'charge.paid': 'paid',
      'charge.expired': 'expired',
      'charge.cancelled': 'failed',
    };
    const newStatus = statusMap[event.type];
    if (!newStatus) {
      return NextResponse.json({ received: true, handled: false });
    }

    const reportedStatusMap: Record<string, 'paid' | 'expired' | 'failed'> = {
      paid: 'paid',
      succeeded: 'paid',
      completed: 'paid',
      expired: 'expired',
      cancelled: 'failed',
      canceled: 'failed',
      failed: 'failed',
    };
    const reportedStatus = reportedStatusMap[event.data.status.trim().toLowerCase()];
    if (reportedStatus !== newStatus) {
      logger.warn('Cobrar.io webhook event and data status mismatch', {
        action: 'cobrar_webhook_status_mismatch',
        eventId: event.id,
        eventType: event.type,
        reportedStatus: event.data.status,
      });
      return NextResponse.json({ error: 'Inconsistent payment status' }, { status: 409 });
    }

    const [existing] = await db
      .select()
      .from(paymentCharges)
      .where(
        and(
          eq(paymentCharges.storeId, storeId),
          eq(paymentCharges.provider, 'cobrar'),
          eq(paymentCharges.providerChargeId, event.data.id),
        ),
      )
      .limit(1);

    if (!existing) {
      logger.warn('Cobrar.io webhook charge not found', {
        action: 'cobrar_webhook_not_found',
        chargeId: event.data.id,
      });
      return NextResponse.json({ received: true, handled: false }, { status: 202 });
    }

    const amountMatches = Math.abs(Number(existing.amount) - event.data.amount) < 0.005;
    const currencyMatches = existing.currency.toUpperCase() === event.data.currency;
    const referenceMatches = existing.referenceNumber === event.data.reference;
    if (!amountMatches || !currencyMatches || !referenceMatches) {
      logger.warn('Cobrar.io webhook reconciliation mismatch', {
        action: 'cobrar_webhook_reconciliation_mismatch',
        chargeId: existing.id,
        amountMatches,
        currencyMatches,
        referenceMatches,
      });
      return NextResponse.json({ error: 'Charge reconciliation failed' }, { status: 409 });
    }

    if (existing.status === newStatus) {
      return NextResponse.json({ received: true, handled: true, duplicate: true });
    }

    const allowed = VALID_TRANSITIONS[existing.status];
    if (!allowed?.has(newStatus)) {
      logger.warn('Cobrar.io invalid status transition blocked', {
        action: 'cobrar_webhook_invalid_transition',
        chargeId: existing.id,
        currentStatus: existing.status,
        attemptedStatus: newStatus,
      });
      return NextResponse.json({ received: true, handled: false });
    }

    const [updated] = await db
      .update(paymentCharges)
      .set({
        status: newStatus,
        paidAt: newStatus === 'paid' ? (event.data.paid_at ? new Date(event.data.paid_at) : new Date()) : undefined,
        providerMetadata: {
          eventId: event.id,
          providerStatus: event.data.status,
          paymentMethod: event.data.payment_method,
        },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentCharges.id, existing.id),
          eq(paymentCharges.storeId, storeId),
          eq(paymentCharges.provider, 'cobrar'),
          newStatus === 'paid'
            ? ne(paymentCharges.status, 'paid')
            : eq(paymentCharges.status, 'pending'),
        ),
      )
      .returning({ status: paymentCharges.status });

    if (!updated) {
      return NextResponse.json({ received: true, handled: true, duplicate: true });
    }

    logger.info('Cobrar.io charge status reconciled', {
      action: 'cobrar_webhook_reconciled',
      chargeId: existing.id,
      oldStatus: existing.status,
      newStatus,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({ received: true, handled: true });
  } catch (error) {
    logger.error('Cobrar.io webhook processing failed', {
      action: 'cobrar_webhook_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
