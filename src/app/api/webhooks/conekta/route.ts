import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { paymentCharges, paymentProviderConnections } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';

const MAX_WEBHOOK_BYTES = 64 * 1024;
const MAX_SIGNATURE_LENGTH = 4096;

function decodeBase64Signature(value: string): Buffer | null {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_SIGNATURE_LENGTH ||
    normalized.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    return null;
  }

  const decoded = Buffer.from(normalized, 'base64');
  const canonical = decoded.toString('base64').replace(/=+$/, '');
  return canonical === normalized.replace(/=+$/, '') ? decoded : null;
}

const conektaEventSchema = z
  .object({
    type: z.enum(['order.paid', 'order.expired', 'order.canceled']),
    data: z.object({
      object: z
        .object({
          id: z.string().min(1).max(200),
          status: z.string().max(100).optional(),
          amount: z.number().int().positive().optional(),
          currency: z.string().length(3).optional(),
          charges: z.object({
            data: z
              .array(
                z
                  .object({
                    id: z.string().min(1).max(200),
                    status: z.string().max(100),
                    paid_at: z.number().int().nonnegative().optional(),
                  })
                  .passthrough(),
              )
              .max(100),
          }),
        })
        .passthrough(),
    }),
  })
  .passthrough();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const storeId = new URL(request.url).searchParams.get('store');
    if (!storeId || !/^(?:main|[a-f0-9]{32})$/.test(storeId)) {
      return NextResponse.json({ error: 'Store scope required' }, { status: 400 });
    }
    const body = await readTextBodyWithLimit(request, MAX_WEBHOOK_BYTES);
    if (body === null) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const signature = decodeBase64Signature(request.headers.get('digest') ?? '');
    if (!signature) {
      logger.warn('Conekta webhook signature missing or malformed', {
        action: 'conekta_webhook_invalid_sig_format',
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const [connection] = await db
      .select({ publicKey: paymentProviderConnections.publicKey })
      .from(paymentProviderConnections)
      .where(
        and(
          eq(paymentProviderConnections.provider, 'conekta'),
          eq(paymentProviderConnections.storeId, storeId),
          eq(paymentProviderConnections.status, 'connected'),
        ),
      )
      .limit(1);

    const webhookKey = connection?.publicKey;
    if (!webhookKey) {
      logger.warn('Conekta webhook key not configured', { action: 'conekta_webhook_no_key' });
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    let publicKey: crypto.KeyObject;
    try {
      publicKey = crypto.createPublicKey(webhookKey.replaceAll('\\n', '\n'));
    } catch {
      logger.error('Conekta webhook public key is invalid', { action: 'conekta_webhook_invalid_key' });
      return NextResponse.json({ error: 'Webhook verification is not configured' }, { status: 500 });
    }

    const signatureValid = crypto.verify('RSA-SHA256', Buffer.from(body, 'utf8'), publicKey, signature);
    if (!signatureValid) {
      logger.warn('Conekta webhook signature mismatch', { action: 'conekta_webhook_invalid_sig' });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const parsed = conektaEventSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const event = parsed.data;

    logger.info('Conekta webhook received', {
      action: 'conekta_webhook',
      eventType: event.type,
      orderId: event.data?.object?.id,
    });

    switch (event.type) {
      case 'order.paid': {
        const order = event.data.object;
        const paidCharges = order.charges.data.filter((charge) => charge.status.toLowerCase() === 'paid');
        const charge = paidCharges.length === 1 ? paidCharges[0] : undefined;
        if (!charge || order.status?.toLowerCase() !== 'paid' || !order.amount || !order.currency) {
          logger.warn('Conekta paid event is internally inconsistent', {
            action: 'conekta_webhook_inconsistent_paid_event',
            orderId: order.id,
          });
          return NextResponse.json({ error: 'Charge reconciliation failed' }, { status: 409 });
        }

        const [existing] = await db
          .select({ id: paymentCharges.id, amount: paymentCharges.amount, currency: paymentCharges.currency })
          .from(paymentCharges)
          .where(
            and(
              eq(paymentCharges.storeId, storeId),
              eq(paymentCharges.provider, 'conekta'),
              eq(paymentCharges.providerChargeId, charge.id),
            ),
          )
          .limit(1);
        if (!existing) {
          return NextResponse.json({ received: true, handled: false }, { status: 202 });
        }

        const amountMatches = Math.round(Number(existing.amount) * 100) === order.amount;
        const currencyMatches = existing.currency.toUpperCase() === order.currency.toUpperCase();
        if (!amountMatches || !currencyMatches) {
          logger.warn('Conekta payment reconciliation mismatch', {
            action: 'conekta_payment_reconciliation_mismatch',
            chargeId: existing.id,
            amountMatches,
            currencyMatches,
          });
          return NextResponse.json({ error: 'Charge reconciliation failed' }, { status: 409 });
        }

        const [updated] = await db
          .update(paymentCharges)
          .set({
            status: 'paid',
            paidAt: charge.paid_at ? new Date(charge.paid_at * 1000) : new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(paymentCharges.id, existing.id),
              eq(paymentCharges.storeId, storeId),
              eq(paymentCharges.provider, 'conekta'),
              ne(paymentCharges.status, 'paid'),
            ),
          )
          .returning({ id: paymentCharges.id });

        if (updated) {
          logger.info('Conekta payment confirmed', {
            action: 'conekta_payment_confirmed',
            chargeId: charge.id,
            duration: Date.now() - startTime,
          });
        }
        break;
      }

      case 'order.expired':
      case 'order.canceled': {
        const order = event.data.object;
        const terminalOrderStatuses = new Set(['expired', 'canceled', 'cancelled']);
        if (order.status && !terminalOrderStatuses.has(order.status.toLowerCase())) {
          return NextResponse.json({ error: 'Charge reconciliation failed' }, { status: 409 });
        }
        for (const charge of order.charges.data) {
          await db
            .update(paymentCharges)
            .set({
              status: 'expired',
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(paymentCharges.provider, 'conekta'),
                eq(paymentCharges.storeId, storeId),
                eq(paymentCharges.providerChargeId, charge.id),
                eq(paymentCharges.status, 'pending'),
              ),
            );
        }
        break;
      }

    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Conekta webhook error', { action: 'conekta_webhook_error', error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
