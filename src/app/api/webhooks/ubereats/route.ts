import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';
import { uberEatsProvider } from '@/infrastructure/delivery/ubereats-provider';
import { persistDeliveryOrder, resolveWebhookSecret } from '@/infrastructure/delivery/delivery-service';

const MAX_BYTES = 256 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const storeId = new URL(request.url).searchParams.get('store');
    if (!storeId || !/^(?:main|[a-f0-9-]{32,36})$/.test(storeId)) {
      return NextResponse.json({ error: 'Store scope required' }, { status: 400 });
    }

    const body = await readTextBodyWithLimit(request, MAX_BYTES);
    if (body === null) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const signature = request.headers.get('x-uber-signature') ?? '';

    const secret = await resolveWebhookSecret(storeId, 'ubereats');
    if (secret) {
      const valid = uberEatsProvider.verifyWebhookSignature(body, signature, secret);
      if (!valid) {
        logger.warn('UberEats webhook firma invalida', { action: 'ubereats_webhook_invalid_sig', storeId });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const order = uberEatsProvider.parseWebhookPayload(raw, storeId);
    if (!order) {
      return NextResponse.json({ received: true, handled: false });
    }

    await persistDeliveryOrder(order);

    logger.info('UberEats order received', {
      action: 'ubereats_order_received',
      orderId: order.externalId,
      storeId,
      total: order.total,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ received: true, orderId: order.id });
  } catch (err) {
    logger.error('UberEats webhook error', {
      action: 'ubereats_webhook_error',
      error: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
