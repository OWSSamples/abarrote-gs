import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getActiveProvider } from '@/infrastructure/servicios';
import { checkRateLimitAsync, getClientIp } from '@/infrastructure/redis';
import { db } from '@/db';
import { storeConfig } from '@/db/schema';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';
import { updateServicioFromProvider } from '@/server/servicios-provider-update-service';

const MAX_WEBHOOK_BYTES = 64 * 1024;
const storeIdSchema = z.string().regex(/^(?:main|[a-f0-9]{32})$/);

const providerUpdateSchema = z.object({
  providerTransactionId: z.string().trim().min(1).max(200),
  status: z.enum(['completado', 'pendiente', 'procesando', 'fallido', 'cancelado']),
  authorizationCode: z.string().max(500).optional(),
  errorMessage: z.string().max(2_000).optional(),
});

function hasRequiredCredentials(providerId: string, apiKey?: string | null, apiSecret?: string | null): boolean {
  const hasApiKey = typeof apiKey === 'string' && apiKey.length > 0;
  const hasApiSecret = typeof apiSecret === 'string' && apiSecret.length > 0;

  if (providerId === 'infopago') return hasApiKey;
  if (providerId === 'turecarga' || providerId === 'billpocket') return hasApiKey && hasApiSecret;
  return true;
}

/**
 * Webhook endpoint for servicios providers (TuRecarga, Infopago, etc.).
 *
 * POST /api/webhooks/servicios
 *
 * Each provider sends status updates here when a topup or payment
 * is confirmed, failed, or reversed. The webhook is verified using
 * the provider's signature verification method.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(req);

  const rateLimit = await checkRateLimitAsync(`servicios_webhook:${ip}`, { limit: 60, windowMs: 60_000 });
  if (rateLimit.isRateLimited) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const url = new URL(req.url);
    const parsedStoreId = storeIdSchema.safeParse(url.searchParams.get('store'));
    if (!parsedStoreId.success) {
      return NextResponse.json({ error: 'Store scope required' }, { status: 400 });
    }
    const storeId = parsedStoreId.data;

    const body = await readTextBodyWithLimit(req, MAX_WEBHOOK_BYTES);
    if (body === null) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Load current provider config
    const [row] = await db
      .select({
        providerId: storeConfig.serviciosProvider,
        apiKey: storeConfig.serviciosApiKey,
        apiSecret: storeConfig.serviciosApiSecret,
        sandbox: storeConfig.serviciosSandbox,
      })
      .from(storeConfig)
      .where(eq(storeConfig.id, storeId))
      .limit(1);

    const providerId = row?.providerId ?? 'local';
    if (!hasRequiredCredentials(providerId, row?.apiKey, row?.apiSecret)) {
      logger.error('Servicios webhook provider credentials are incomplete', {
        action: 'servicios_webhook_incomplete_provider_config',
        provider: providerId,
      });
      return NextResponse.json({ error: 'Provider configuration is incomplete' }, { status: 503 });
    }

    const provider = getActiveProvider({
      providerId,
      apiKey: row?.apiKey ?? undefined,
      apiSecret: row?.apiSecret ?? undefined,
      sandbox: row?.sandbox ?? true,
    });

    // Local provider doesn't receive webhooks
    if (!provider.isLive) {
      logger.warn('Webhook received but no live provider configured', {
        action: 'servicios_webhook_no_provider',
      });
      return NextResponse.json({ error: 'No live provider configured' }, { status: 400 });
    }

    // Verify webhook signature
    if (!provider.verifyWebhook || !provider.parseWebhook) {
      logger.error('Live servicios provider lacks secure webhook support', {
        action: 'servicios_webhook_unsupported_provider',
        provider: provider.id,
      });
      return NextResponse.json({ error: 'Provider does not support secure webhooks' }, { status: 503 });
    }

    const valid = await provider.verifyWebhook(req.headers, body);
    if (!valid) {
      logger.warn('Servicios webhook signature verification failed', {
        action: 'servicios_webhook_invalid_signature',
        provider: provider.id,
        ip,
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the webhook payload
    const update = providerUpdateSchema.parse(await provider.parseWebhook(body));

    // Apply the status update
    const result = await updateServicioFromProvider({
      storeId,
      providerId: provider.id,
      ...update,
    });

    if (result === 'unknown') {
      // The provider may notify before the originating request has committed its local row.
      return NextResponse.json({ error: 'Transaction not ready' }, { status: 503 });
    }

    logger.info('Servicios webhook processed', {
      action: 'servicios_webhook_success',
      provider: provider.id,
      providerTxn: update.providerTransactionId,
      status: update.status,
      result,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({ ok: true, handled: result !== 'rejected' });
  } catch (error) {
    logger.error('Servicios webhook error', {
      action: 'servicios_webhook_error',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
