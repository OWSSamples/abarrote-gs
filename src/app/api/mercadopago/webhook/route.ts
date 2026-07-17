import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { checkRateLimitAsync, getClientIp } from '@/infrastructure/redis';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { db } from '@/db';
import { auditLogs, mercadopagoPayments, saleRecords } from '@/db/schema';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { getMPAccessToken } from '@/lib/oauth-providers';
import { readTextBodyWithLimit } from '@/lib/http/read-limited-body';
import { z } from 'zod';

/** Rate limit: 30 webhook calls per minute per IP */
const RATE_LIMIT = { limit: 30, windowMs: 60_000 } as const;
const MAX_WEBHOOK_BYTES = 64 * 1024;
const SALE_CURRENCY = 'MXN';
const storeIdSchema = z.string().regex(/^(?:main|[a-f0-9]{32})$/);

const providerPaymentIdSchema = z
  .union([
    z.string().regex(/^\d{1,30}$/),
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String),
  ])
  .transform(String);

const providerPaymentIdentitySchema = z
  .object({
    id: providerPaymentIdSchema,
    status: z.string().min(1).max(50),
  })
  .passthrough();

const approvedProviderPaymentSchema = providerPaymentIdentitySchema.extend({
  status: z.literal('approved'),
  external_reference: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => value === value.trim(), 'La referencia externa no puede contener espacios laterales.'),
  transaction_amount: z.number().finite().positive().max(99_999_999.99),
  currency_id: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase()),
});

type ReconciliationFailure =
  | 'sale_not_found'
  | 'sale_cancelled'
  | 'amount_mismatch'
  | 'currency_mismatch'
  | 'sale_already_linked'
  | 'payment_already_linked'
  | 'payment_record_mismatch'
  | 'concurrent_update';

function parseMoneyToMinorUnits(value: unknown): number | null {
  const normalized = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;

  const minorUnits = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}

function formatMinorUnits(value: number): string {
  return `${Math.floor(value / 100)}.${(value % 100).toString().padStart(2, '0')}`;
}

// =========================================================================
// RUTA DE WEBHOOKS PARA MERCADO PAGO
// URL que debes pegar en Mercado Pago: https://tu-dominio.com/api/mercadopago/webhook
// =========================================================================

/**
 * Verifica la firma HMAC-SHA256 del webhook de MercadoPago.
 * Docs: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 */
function verifyWebhookSignature(req: Request, paymentId: string): boolean {
  const secret = env.MP_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('MP_WEBHOOK_SECRET not configured — rejecting all webhooks');
    return false;
  }

  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');

  if (!xSignature || !xRequestId) {
    logger.warn('Mercado Pago webhook missing signature headers');
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

  if (!ts || !/^\d{1,20}$/.test(ts) || !v1 || !/^[a-fA-F0-9]{64}$/.test(v1)) {
    logger.warn('Mercado Pago webhook signature has an invalid format');
    return false;
  }

  // Construir el manifest para HMAC
  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
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
    const rateLimit = await checkRateLimitAsync(`mp:webhook:${ip}`, RATE_LIMIT);
    if (rateLimit.isRateLimited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const rawBody = await readTextBodyWithLimit(req, MAX_WEBHOOK_BYTES);
    if (rawBody === null) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const url = new URL(req.url);
    const parsedStoreId = storeIdSchema.safeParse(url.searchParams.get('store'));
    if (!parsedStoreId.success) {
      return NextResponse.json({ error: 'Store scope required' }, { status: 400 });
    }
    const storeId = parsedStoreId.data;
    const signedPaymentId = url.searchParams.get('data.id');
    if (!signedPaymentId || !/^\d{1,30}$/.test(signedPaymentId)) {
      logger.warn('Mercado Pago webhook missing signed payment ID', { ip });
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
    }

    // La firma de Mercado Pago autentica data.id; no aceptamos IDs alternativos del body o de `id=`.
    if (!verifyWebhookSignature(req, signedPaymentId)) {
      logger.warn('Webhook signature verification failed', { ip });
      return NextResponse.json({ error: 'Firma inválida' }, { status: 403 });
    }
    const queryType = url.searchParams.get('type') || url.searchParams.get('topic');

    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      // body vacío es válido en algunos webhooks
    }

    const dataObj = typeof body?.data === 'object' && body.data !== null ? (body.data as Record<string, unknown>) : {};
    const bodyPaymentId =
      typeof dataObj.id === 'string' || typeof dataObj.id === 'number' ? String(dataObj.id) : null;
    if (bodyPaymentId && bodyPaymentId !== signedPaymentId) {
      logger.warn('Mercado Pago webhook body ID does not match signed ID', { ip, paymentId: signedPaymentId });
      return NextResponse.json({ error: 'Identificador inconsistente' }, { status: 400 });
    }

    const paymentId = signedPaymentId;
    const eventType =
      queryType ||
      (typeof body?.type === 'string' ? body.type : null) ||
      (typeof body?.action === 'string' ? body.action : null);

    // Solo nos interesan los eventos de pagos ('payment')
    if (eventType === 'payment' && paymentId) {
      logger.info('Payment webhook received', { paymentId });

      // Token priority: OAuth DB (encrypted) → env fallback
      const accessToken = await getMPAccessToken(storeId);

      if (!accessToken) {
        logger.error('No MP access token available (OAuth nor env)');
        return NextResponse.json({ error: 'Proveedor no disponible' }, { status: 503 });
      }

      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
      const paymentClient = new Payment(client);

      const paymentData = await paymentClient.get({ id: paymentId }).catch((err: unknown) => {
        logger.error('Failed to fetch payment', { paymentId, error: err instanceof Error ? err.message : 'Unknown' });
        return null;
      });

      if (!paymentData) {
        return NextResponse.json({ error: 'No fue posible verificar el pago' }, { status: 502 });
      }

      const identity = providerPaymentIdentitySchema.safeParse(paymentData);
      if (!identity.success || identity.data.id !== paymentId) {
        logger.warn('Mercado Pago returned an inconsistent payment identity', { paymentId });
        return NextResponse.json({ error: 'Pago inconsistente' }, { status: 409 });
      }

      logger.info('Payment status', { paymentId, status: identity.data.status });
      if (identity.data.status !== 'approved') {
        return NextResponse.json({ received: true, handled: false }, { status: 200 });
      }

      const approvedPayment = approvedProviderPaymentSchema.safeParse(paymentData);
      if (!approvedPayment.success) {
        logger.warn('Approved Mercado Pago payment is missing reconciliation data', { paymentId });
        return NextResponse.json({ error: 'Datos de pago incompletos' }, { status: 409 });
      }

      const providerAmount = parseMoneyToMinorUnits(approvedPayment.data.transaction_amount);
      if (providerAmount === null) {
        logger.warn('Mercado Pago payment amount has an unsupported precision', { paymentId });
        return NextResponse.json({ error: 'Importe inválido' }, { status: 409 });
      }

      const extRef = approvedPayment.data.external_reference;
      const providerCurrency = approvedPayment.data.currency_id;
      const now = new Date();
      const reconciliation = await db.transaction(async (tx) => {
        // Shared with the refund flow so an approved replay cannot overwrite a refund transition.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`mercadopago-refund:${paymentId}`}))`,
        );
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`mercadopago-sale:${storeId}:${extRef}`}))`,
        );

        const [sale] = await tx
          .select({
            id: saleRecords.id,
            total: saleRecords.total,
            status: saleRecords.status,
            mpPaymentId: saleRecords.mpPaymentId,
          })
          .from(saleRecords)
          .where(and(eq(saleRecords.folio, extRef), eq(saleRecords.storeId, storeId)))
          .limit(1);

        if (!sale) return { ok: false, reason: 'sale_not_found' as ReconciliationFailure } as const;
        if (sale.status === 'cancelada') {
          return { ok: false, reason: 'sale_cancelled' as ReconciliationFailure } as const;
        }
        if (providerCurrency !== SALE_CURRENCY) {
          return { ok: false, reason: 'currency_mismatch' as ReconciliationFailure } as const;
        }

        const saleAmount = parseMoneyToMinorUnits(sale.total);
        if (saleAmount === null || saleAmount !== providerAmount) {
          return { ok: false, reason: 'amount_mismatch' as ReconciliationFailure } as const;
        }
        if (sale.mpPaymentId && sale.mpPaymentId !== paymentId) {
          return { ok: false, reason: 'sale_already_linked' as ReconciliationFailure } as const;
        }

        const [otherSale] = await tx
          .select({ id: saleRecords.id })
          .from(saleRecords)
          .where(
            and(
              eq(saleRecords.storeId, storeId),
              eq(saleRecords.mpPaymentId, paymentId),
              ne(saleRecords.id, sale.id),
            ),
          )
          .limit(1);
        if (otherSale) {
          return { ok: false, reason: 'payment_already_linked' as ReconciliationFailure } as const;
        }

        const [existingPayment] = await tx
          .select()
          .from(mercadopagoPayments)
          .where(
            and(
              eq(mercadopagoPayments.paymentId, paymentId),
              eq(mercadopagoPayments.storeId, storeId),
            ),
          )
          .limit(1);
        if (
          existingPayment &&
          ((existingPayment.saleId && existingPayment.saleId !== sale.id) ||
            (existingPayment.externalReference && existingPayment.externalReference !== extRef) ||
            (existingPayment.amount !== null &&
              parseMoneyToMinorUnits(existingPayment.amount) !== providerAmount))
        ) {
          return { ok: false, reason: 'payment_record_mismatch' as ReconciliationFailure } as const;
        }

        const [otherPayment] = await tx
          .select({ id: mercadopagoPayments.id })
          .from(mercadopagoPayments)
          .where(
            and(
              eq(mercadopagoPayments.storeId, storeId),
              eq(mercadopagoPayments.saleId, sale.id),
              ne(mercadopagoPayments.paymentId, paymentId),
            ),
          )
          .limit(1);
        if (otherPayment) {
          return { ok: false, reason: 'sale_already_linked' as ReconciliationFailure } as const;
        }

        const [linkedSale] = await tx
          .update(saleRecords)
          .set({ mpPaymentId: paymentId })
          .where(
            and(
              eq(saleRecords.id, sale.id),
              eq(saleRecords.storeId, storeId),
              ne(saleRecords.status, 'cancelada'),
              or(isNull(saleRecords.mpPaymentId), eq(saleRecords.mpPaymentId, paymentId)),
            ),
          )
          .returning({ id: saleRecords.id });
        if (!linkedSale) {
          return { ok: false, reason: 'concurrent_update' as ReconciliationFailure } as const;
        }

        const storedStatus =
          existingPayment && ['partially_refunded', 'refunded'].includes(existingPayment.status)
            ? existingPayment.status
            : 'approved';
        const values = {
          status: storedStatus,
          externalReference: extRef,
          saleId: sale.id,
          amount: formatMinorUnits(providerAmount),
          paymentMethodId: paymentData.payment_method_id || null,
          paymentType: paymentData.payment_type_id || null,
          installments:
            Number.isInteger(paymentData.installments) && (paymentData.installments ?? 0) > 0
              ? paymentData.installments!
              : 1,
          feeAmount: paymentData.fee_details?.length
            ? String(paymentData.fee_details.reduce((sum, fee) => sum + (fee.amount ?? 0), 0))
            : null,
          netAmount: paymentData.transaction_details?.net_received_amount
            ? String(paymentData.transaction_details.net_received_amount)
            : null,
          payerEmail: paymentData.payer?.email || null,
          updatedAt: now,
        };

        if (existingPayment) {
          await tx
            .update(mercadopagoPayments)
            .set(values)
            .where(
              and(
                eq(mercadopagoPayments.id, existingPayment.id),
                eq(mercadopagoPayments.storeId, storeId),
              ),
            );
        } else {
          await tx.insert(mercadopagoPayments).values({
            id: `mp-${crypto.randomUUID()}`,
            storeId,
            paymentId,
            ...values,
            createdAt: now,
          });
        }

        await tx.insert(auditLogs).values({
          id: crypto.randomUUID(),
          storeId,
          userId: 'system',
          userEmail: 'system@webhook',
          action: 'update',
          entity: 'mercadopago_payment',
          entityId: paymentId,
          changes: {
            after: {
              status: storedStatus,
              ref: extRef,
              saleId: sale.id,
              storeId,
            },
          },
          ipAddress: ip,
        });

        return { ok: true, saleId: sale.id, storedStatus } as const;
      });

      if (!reconciliation.ok) {
        logger.warn('Mercado Pago payment reconciliation rejected', {
          paymentId,
          storeId,
          reason: reconciliation.reason,
        });
        return NextResponse.json({ error: 'No fue posible reconciliar el pago' }, { status: 409 });
      }

    } else {
      logger.info('Webhook event ignored', { eventType: eventType ?? 'unknown' });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('Critical webhook processing error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
