import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { paymentCharges } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/infrastructure/redis';

/**
 * Clip Webhook Handler
 *
 * Handles webhook notifications from both:
 * - Checkout Redireccionado (payment links)
 * - PinPad API (physical terminal payments)
 *
 * Security layers:
 * 1. Rate limiting per IP (30 req/60s)
 * 2. Shared secret validation via X-Clip-Webhook-Secret header (if configured)
 * 3. HMAC-SHA256 signature via X-Clip-Signature header (if configured)
 * 4. DB record matching — only updates charges that exist in our system
 * 5. Status transition validation — prevents replay / downgrade attacks
 */

const VALID_STATUS_TRANSITIONS: Record<string, Set<string>> = {
  pending: new Set(['paid', 'expired', 'failed']),
  paid: new Set([]), // terminal state — no transitions allowed
  expired: new Set([]),
  failed: new Set(['pending']), // retry only
};

interface ClipCheckoutWebhookPayload {
  payment_request_id: string;
  status: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  approved_at?: string;
}

interface ClipPinpadWebhookPayload {
  pinpad_request_id: string;
  reference: string;
  amount: string;
  status: string;
  transaction_id?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // ── Rate limiting ──
    const ip = getClientIp(request);
    const rl = checkRateLimit(`clip_webhook:${ip}`, { limit: 30, windowMs: 60_000 });
    if (rl.isRateLimited) {
      logger.warn('Clip webhook rate limited', { action: 'clip_webhook_rate_limit', ip });
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.text();

    // ── Shared secret verification ──
    const webhookSecret = process.env.CLIP_WEBHOOK_SECRET;
    if (webhookSecret) {
      // Option 1: HMAC signature header (preferred)
      const signature = request.headers.get('x-clip-signature');
      if (signature) {
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(body)
          .digest('hex');
        const isValid = crypto.timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expectedSignature, 'hex'),
        );
        if (!isValid) {
          logger.warn('Clip webhook signature mismatch', { action: 'clip_webhook_sig_fail', ip });
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      } else {
        // Option 2: Shared secret in custom header
        const headerSecret = request.headers.get('x-clip-webhook-secret');
        if (headerSecret) {
          const isValid = crypto.timingSafeEqual(
            Buffer.from(headerSecret),
            Buffer.from(webhookSecret),
          );
          if (!isValid) {
            logger.warn('Clip webhook secret mismatch', { action: 'clip_webhook_secret_fail', ip });
            return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
          }
        }
        // If neither header is present, fall through to DB-record validation
        // This allows the webhook to work even without signature while still logging
        logger.info('Clip webhook received without signature (using DB validation only)', {
          action: 'clip_webhook_no_sig', ip,
        });
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      logger.warn('Clip webhook invalid JSON', { action: 'clip_webhook_invalid_json' });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Determine source: PinPad or Checkout
    const isPinpad = 'pinpad_request_id' in payload;
    const isCheckout = 'payment_request_id' in payload;

    if (!isPinpad && !isCheckout) {
      logger.warn('Clip webhook unknown payload format', {
        action: 'clip_webhook_unknown',
        keys: Object.keys(payload).join(','),
      });
      return NextResponse.json({ error: 'Unknown payload format' }, { status: 400 });
    }

    if (isCheckout) {
      const data = payload as unknown as ClipCheckoutWebhookPayload;
      const providerChargeId = data.payment_request_id;
      const status = mapClipWebhookStatus(data.status);

      logger.info('Clip checkout webhook received', {
        action: 'clip_checkout_webhook',
        paymentRequestId: providerChargeId,
        status: data.status,
      });

      // Validate: only update if we have a matching record
      const [existing] = await db
        .select({ id: paymentCharges.id, status: paymentCharges.status })
        .from(paymentCharges)
        .where(eq(paymentCharges.providerChargeId, providerChargeId))
        .limit(1);

      if (!existing) {
        logger.warn('Clip webhook: no matching charge found', {
          action: 'clip_webhook_no_match',
          providerChargeId,
        });
        return NextResponse.json({ received: true, matched: false });
      }

      if (status !== existing.status) {
        // Validate status transition to prevent replay/downgrade attacks
        const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status];
        if (!allowedTransitions?.has(status)) {
          logger.warn('Clip checkout webhook invalid status transition', {
            action: 'clip_checkout_invalid_transition',
            chargeId: existing.id,
            currentStatus: existing.status,
            attemptedStatus: status,
          });
          return NextResponse.json({ received: true, transitionDenied: true });
        }

        await db
          .update(paymentCharges)
          .set({
            status,
            paidAt: status === 'paid' && data.approved_at ? new Date(data.approved_at) : status === 'paid' ? new Date() : undefined,
            updatedAt: new Date(),
          })
          .where(eq(paymentCharges.providerChargeId, providerChargeId));

        logger.info('Clip checkout payment status updated', {
          action: 'clip_checkout_status_update',
          chargeId: existing.id,
          oldStatus: existing.status,
          newStatus: status,
          duration: Date.now() - startTime,
        });
      }
    }

    if (isPinpad) {
      const data = payload as unknown as ClipPinpadWebhookPayload;
      const providerChargeId = data.pinpad_request_id;
      const status = mapClipPinpadWebhookStatus(data.status);

      logger.info('Clip PinPad webhook received', {
        action: 'clip_pinpad_webhook',
        pinpadRequestId: providerChargeId,
        status: data.status,
      });

      const [existing] = await db
        .select({ id: paymentCharges.id, status: paymentCharges.status })
        .from(paymentCharges)
        .where(eq(paymentCharges.providerChargeId, providerChargeId))
        .limit(1);

      if (!existing) {
        logger.warn('Clip PinPad webhook: no matching charge found', {
          action: 'clip_pinpad_webhook_no_match',
          providerChargeId,
        });
        return NextResponse.json({ received: true, matched: false });
      }

      if (status !== existing.status) {
        // Validate status transition
        const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status];
        if (!allowedTransitions?.has(status)) {
          logger.warn('Clip PinPad webhook invalid status transition', {
            action: 'clip_pinpad_invalid_transition',
            chargeId: existing.id,
            currentStatus: existing.status,
            attemptedStatus: status,
          });
          return NextResponse.json({ received: true, transitionDenied: true });
        }

        await db
          .update(paymentCharges)
          .set({
            status,
            paidAt: status === 'paid' ? new Date() : undefined,
            updatedAt: new Date(),
          })
          .where(eq(paymentCharges.providerChargeId, providerChargeId));

        logger.info('Clip PinPad payment status updated', {
          action: 'clip_pinpad_status_update',
          chargeId: existing.id,
          oldStatus: existing.status,
          newStatus: status,
          duration: Date.now() - startTime,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Clip webhook error', { action: 'clip_webhook_error', error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function mapClipWebhookStatus(status: string): 'pending' | 'paid' | 'expired' | 'failed' {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'APPROVED' || normalized === 'PAID' || normalized === 'COMPLETED') return 'paid';
  if (normalized === 'EXPIRED' || normalized === 'CANCELED' || normalized === 'CANCELLED') return 'expired';
  if (normalized === 'DECLINED' || normalized === 'REJECTED' || normalized === 'FAILED') return 'failed';
  return 'pending';
}

function mapClipPinpadWebhookStatus(status: string): 'pending' | 'paid' | 'expired' | 'failed' {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'APPROVED') return 'paid';
  if (normalized === 'CANCELED' || normalized === 'CANCELLED' || normalized === 'EXPIRED') return 'expired';
  if (normalized === 'DECLINED' || normalized === 'REJECTED' || normalized === 'FAILED') return 'failed';
  return 'pending';
}
