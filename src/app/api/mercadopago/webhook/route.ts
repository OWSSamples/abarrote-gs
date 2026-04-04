import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { checkRateLimit, getClientIp } from '@/infrastructure/redis';
import { logger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';
import { env } from '@/lib/env';
import { db } from '@/db';
import { mercadopagoPayments, saleRecords } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getMPAccessToken } from '@/lib/oauth-providers';

/** Rate limit: 30 webhook calls per minute per IP */
const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 } as const;

// =========================================================================
// RUTA DE WEBHOOKS PARA MERCADO PAGO 
// URL que debes pegar en Mercado Pago: https://tu-dominio.com/api/mercadopago/webhook
// =========================================================================

/**
 * Verifica la firma HMAC-SHA256 del webhook de MercadoPago.
 * Docs: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 */
function verifyWebhookSignature(req: Request, body: string): boolean {
  const secret = env.MP_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('MP_WEBHOOK_SECRET not configured — rejecting all webhooks');
    return false;
  }

  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');

  if (!xSignature || !xRequestId) {
    console.error('[Webhook] Falta x-signature o x-request-id en headers');
    return false;
  }

  // Parse x-signature: "ts=...,v1=..."
  const parts: Record<string, string> = {};
  for (const part of xSignature.split(',')) {
    const [key, ...valueParts] = part.split('=');
    parts[key.trim()] = valueParts.join('=').trim();
  }

  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1) {
    console.error('[Webhook] Formato de x-signature inválido');
    return false;
  }

  // Obtener data.id del query string
  const url = new URL(req.url);
  const dataId = url.searchParams.get('data.id') || '';

  // Construir el manifest para HMAC
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false; // Buffers of different lengths throw — treat as invalid
  }
}

export async function POST(req: Request) {
    try {
        // Rate limiting
        const ip = getClientIp(req);
        const rl = checkRateLimit(`mp:webhook:${ip}`, RATE_LIMIT);
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        // Clonar el body para verificación de firma
        const rawBody = await req.text();
        
        // Verificar firma HMAC
        if (!verifyWebhookSignature(req, rawBody)) {
            logger.warn('Webhook signature verification failed', { ip });
            return NextResponse.json({ error: 'Firma inválida' }, { status: 403 });
        }

        const url = new URL(req.url);

        const queryId = url.searchParams.get('data.id') || url.searchParams.get('id');
        const queryType = url.searchParams.get('type') || url.searchParams.get('topic');

        let body: Record<string, unknown> = {};
        try {
            body = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
            // body vacío es válido en algunos webhooks
        }

        const dataObj = typeof body?.data === 'object' && body.data !== null ? body.data as Record<string, unknown> : {};
        const paymentId = queryId || (typeof dataObj.id === 'string' || typeof dataObj.id === 'number' ? String(dataObj.id) : null);
        const eventType = queryType || (typeof body?.type === 'string' ? body.type : null) || (typeof body?.action === 'string' ? body.action : null);

        // Solo nos interesan los eventos de pagos ('payment')
        if (eventType === 'payment' && paymentId) {
            logger.info('Payment webhook received', { paymentId });

            // Token priority: OAuth DB (encrypted) → env fallback
            const accessToken = await getMPAccessToken();

            if (!accessToken) {
                logger.error('No MP access token available (OAuth nor env)');
                return NextResponse.json({ received: true }, { status: 200 });
            }

            const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
            const paymentClient = new Payment(client);

            const paymentData = await paymentClient.get({ id: paymentId }).catch((err: unknown) => {
                logger.error('Failed to fetch payment', { paymentId, error: err instanceof Error ? err.message : 'Unknown' });
                return null;
            });

            if (paymentData) {
                logger.info('Payment status', { paymentId, status: paymentData.status, ref: paymentData.external_reference });

                if (paymentData.status === 'approved') {
                    logger.info('Payment approved — updating DB', { paymentId });

                    // Reconcile: find the sale linked by external_reference (folio)
                    let linkedSaleId: string | null = null;
                    const extRef = paymentData.external_reference;
                    if (extRef) {
                        const [sale] = await db
                            .select({ id: saleRecords.id })
                            .from(saleRecords)
                            .where(eq(saleRecords.folio, extRef))
                            .limit(1);
                        if (sale) {
                            linkedSaleId = sale.id;
                            // Update sale with MP payment reference
                            await db
                                .update(saleRecords)
                                .set({ mpPaymentId: paymentId })
                                .where(eq(saleRecords.id, sale.id));
                        }
                    }

                    await db.insert(mercadopagoPayments).values({
                        id: `mp-${crypto.randomUUID()}`,
                        paymentId: paymentId || 'unknown',
                        status: paymentData.status || 'unknown',
                        externalReference: extRef || null,
                        saleId: linkedSaleId,
                        amount: String(paymentData.transaction_amount || 0),
                        paymentMethodId: paymentData.payment_method_id || null,
                        paymentType: paymentData.payment_type_id || null,
                        installments: paymentData.installments || 1,
                        feeAmount: paymentData.fee_details?.length
                            ? String(paymentData.fee_details.reduce((s, f) => s + (f.amount ?? 0), 0))
                            : null,
                        netAmount: paymentData.transaction_details?.net_received_amount
                            ? String(paymentData.transaction_details.net_received_amount)
                            : null,
                        payerEmail: paymentData.payer?.email || null,
                    }).onConflictDoUpdate({
                        target: mercadopagoPayments.paymentId,
                        set: {
                            status: paymentData.status || 'unknown',
                            amount: String(paymentData.transaction_amount || 0),
                            saleId: linkedSaleId,
                            paymentMethodId: paymentData.payment_method_id || null,
                            paymentType: paymentData.payment_type_id || null,
                            installments: paymentData.installments || 1,
                            feeAmount: paymentData.fee_details?.length
                                ? String(paymentData.fee_details.reduce((s, f) => s + (f.amount ?? 0), 0))
                                : null,
                            netAmount: paymentData.transaction_details?.net_received_amount
                                ? String(paymentData.transaction_details.net_received_amount)
                                : null,
                            payerEmail: paymentData.payer?.email || null,
                            updatedAt: new Date(),
                        },
                    });

                    // Aseguramos trazabilidad en la base de datos de auditoría
                    await logAudit({
                        userId: 'system',
                        userEmail: 'system@webhook',
                        action: 'update',
                        entity: 'mercadopago_payment',
                        entityId: paymentId || 'unknown',
                        changes: {
                            after: {
                                status: paymentData.status,
                                ref: paymentData.external_reference
                            }
                        },
                        ipAddress: ip
                    });

                } else if (paymentData.status === 'rejected') {
                    logger.info('Payment rejected', { paymentId });
                } else if (paymentData.status === 'in_process') {
                    logger.info('Payment pending', { paymentId });
                }
            }
        } else {
            logger.info('Webhook event ignored', { eventType: eventType ?? 'unknown' });
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        logger.error('Critical webhook processing error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ success: false }, { status: 200 });
    }
}
