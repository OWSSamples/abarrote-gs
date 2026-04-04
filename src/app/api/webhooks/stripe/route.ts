import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { paymentCharges } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { idempotencyCheck } from '@/infrastructure/redis';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('Stripe webhook secret not configured', { action: 'stripe_webhook_no_secret' });
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Verify signature
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      logger.error('Stripe secret key not configured', { action: 'stripe_webhook_no_key' });
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-03-25.dahlia',
    });

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

    // Idempotency: prevent duplicate processing on webhook retries
    const isNew = await idempotencyCheck(`stripe_webhook:${event.id}`, { ttlMs: 86_400_000 });
    if (!isNew) {
      logger.info('Stripe webhook duplicate skipped', { action: 'stripe_webhook_duplicate', eventId: event.id });
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await db
          .update(paymentCharges)
          .set({
            status: 'paid',
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(paymentCharges.providerChargeId, pi.id));

        logger.info('Stripe payment confirmed', {
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
          .where(eq(paymentCharges.providerChargeId, pi.id));
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
          .where(eq(paymentCharges.providerChargeId, pi.id));
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
