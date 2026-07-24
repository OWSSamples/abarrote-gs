import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';
import { rappiProvider } from '@/infrastructure/delivery/rappi-provider';
import { persistDeliveryOrder, resolveWebhookSecret } from '@/infrastructure/delivery/delivery-service';

const MAX_BYTES = 256 * 1024; // 256 KB

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // storeId viene como query param: /api/webhooks/rappi?store=<storeId>
    const storeId = new URL(request.url).searchParams.get('store');
    if (!storeId || !/^(?:main|[a-f0-9-]{32,36})$/.test(storeId)) {
      return NextResponse.json({ error: 'Store scope required' }, { status: 400 });
    }

    const body = await readTextBodyWithLimit(request, MAX_BYTES);
    if (body === null) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const signature = request.headers.get('x-rappi-signature') ?? '';

    // Verificar firma si hay webhook secret configurado
    const secret = await resolveWebhookSecret(storeId, 'rappi');
    if (secret) {
      const valid = rappiProvider.verifyWebhookSignature(body, signature, secret);
      if (!valid) {
        logger.warn('Rappi webhook firma invalida', { action: 'rappi_webhook_invalid_sig', storeId });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const order = rappiProvider.parseWebhookPayload(raw, storeId);
    if (!order) {
      // Payload valido pero no es un nuevo pedido (ej: status update) - responder 200
      return NextResponse.json({ received: true, handled: false });
    }

    // Persistir el pedido - el tendero lo vera en el POS en tiempo real
    await persistDeliveryOrder(order);

    logger.info('Rappi order received', {
      action: 'rappi_order_received',
      orderId: order.externalId,
      storeId,
      total: order.total,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ received: true, orderId: order.id });
  } catch (err) {
    logger.error('Rappi webhook error', {
      action: 'rappi_webhook_error',
      error: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
