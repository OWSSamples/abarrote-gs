import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { paymentCharges, paymentProviderConnections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body = await request.text();
    const signature = request.headers.get('digest') ?? '';

    // Get webhook signing key
    const webhookKey = process.env.CONEKTA_WEBHOOK_KEY;
    if (!webhookKey) {
      logger.warn('Conekta webhook key not configured', { action: 'conekta_webhook_no_key' });
      return NextResponse.json({ error: 'Webhook key not configured' }, { status: 500 });
    }

    // Verify signature (Conekta uses HMAC SHA-256 in the digest header)
    const expectedDigest = crypto
      .createHmac('sha256', webhookKey)
      .update(body)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedDigest))) {
      logger.warn('Conekta webhook signature mismatch', { action: 'conekta_webhook_invalid_sig' });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body) as {
      type: string;
      data: {
        object: {
          id: string;
          status: string;
          charges: {
            data: Array<{
              id: string;
              status: string;
              paid_at: number;
            }>;
          };
        };
      };
    };

    logger.info('Conekta webhook received', {
      action: 'conekta_webhook',
      eventType: event.type,
      orderId: event.data?.object?.id,
    });

    switch (event.type) {
      case 'order.paid': {
        const order = event.data.object;
        const charge = order.charges?.data?.[0];
        if (charge) {
          await db
            .update(paymentCharges)
            .set({
              status: 'paid',
              paidAt: new Date(charge.paid_at * 1000),
              updatedAt: new Date(),
            })
            .where(eq(paymentCharges.providerChargeId, charge.id));

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
        const charge = order.charges?.data?.[0];
        if (charge) {
          await db
            .update(paymentCharges)
            .set({
              status: 'expired',
              updatedAt: new Date(),
            })
            .where(eq(paymentCharges.providerChargeId, charge.id));
        }
        break;
      }

      default:
        logger.info('Conekta webhook event ignored', { action: 'conekta_webhook_ignored', eventType: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Conekta webhook error', { action: 'conekta_webhook_error', error: message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
