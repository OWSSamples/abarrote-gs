import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { paymentCharges, paymentProviderConnections } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/crypto';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';

const MAX_WEBHOOK_BYTES = 64 * 1024;

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
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const [connection] = await db
      .select({
        accessTokenEnc: paymentProviderConnections.accessTokenEnc,
        webhookSecretEnc: paymentProviderConnections.webhookSecretEnc,
      })
      .from(paymentProviderConnections)
      .where(
        and(
          eq(paymentProviderConnections.provider, 'stripe'),
          eq(paymentProviderConnections.storeId, storeId),
          eq(paymentProviderConnections.status, 'connected'),
        ),
      )
      .limit(1);

    if (!connection?.accessTokenEnc || !connection.webhookSecretEnc) {
      logger.warn('Stripe webhook secret not configured', { action: 'stripe_webhook_no_secret' });
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const stripe = new Stripe(decrypt(connection.accessTokenEnc), {
      apiVersion: '2026-04-22.dahlia',
    });
    const webhookSecret = decrypt(connection.webhookSecretEnc);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch {
      logger.warn('Stripe webhook signature verification failed', { action: 'stripe_webhook_invalid_sig' });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    logger.info('Stripe webhook received', {
      action: 'stripe_webhook',
      eventType: event.type,
      eventId: event.id,
    });

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const [existing] = await db
          .select({ id: paymentCharges.id, amount: paymentCharges.amount, currency: paymentCharges.currency })
          .from(paymentCharges)
          .where(
            and(
              eq(paymentCharges.storeId, storeId),
              eq(paymentCharges.provider, 'stripe'),
              eq(paymentCharges.providerChargeId, pi.id),
            ),
          )
          .limit(1);
        if (!existing) {
          return NextResponse.json({ received: true, handled: false }, { status: 202 });
        }

        const amountMatches = Math.round(Number(existing.amount) * 100) === pi.amount_received;
        const currencyMatches = existing.currency.toLowerCase() === pi.currency.toLowerCase();
        if (!amountMatches || !currencyMatches) {
          logger.warn('Stripe payment reconciliation mismatch', {
            action: 'stripe_payment_reconciliation_mismatch',
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
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(paymentCharges.id, existing.id),
              eq(paymentCharges.storeId, storeId),
              eq(paymentCharges.provider, 'stripe'),
              ne(paymentCharges.status, 'paid'),
            ),
          )
          .returning({ id: paymentCharges.id });

        if (updated) logger.info('Stripe payment confirmed', {
          action: 'stripe_payment_confirmed',
          paymentIntentId: pi.id,
          duration: Date.now() - startTime,
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await db
          .update(paymentCharges)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(paymentCharges.provider, 'stripe'),
              eq(paymentCharges.storeId, storeId),
              eq(paymentCharges.providerChargeId, pi.id),
              eq(paymentCharges.status, 'pending'),
            ),
          );
        break;
      }

      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await db
          .update(paymentCharges)
          .set({
            status: 'expired',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(paymentCharges.provider, 'stripe'),
              eq(paymentCharges.storeId, storeId),
              eq(paymentCharges.providerChargeId, pi.id),
              eq(paymentCharges.status, 'pending'),
            ),
          );
        break;
      }

      default:
        logger.info('Stripe webhook event ignored', { action: 'stripe_webhook_ignored', eventType: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Stripe webhook error', { action: 'stripe_webhook_error', error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
