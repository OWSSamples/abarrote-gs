'use server';

import { requirePermission, sanitize, validateNumber } from '@/lib/auth/guard';
import { withLogging } from '@/lib/errors';
import { db } from '@/db';
import { auditLogs, mercadopagoPayments, mercadopagoRefunds } from '@/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type { MercadoPagoRefund } from '@/types';
import { randomUUID } from 'node:crypto';
import { requireStoreScope } from '@/lib/auth/store-scope';
import {
  validateSchema,
  createMPRefundSchema,
  searchMPPaymentsSchema,
} from '@/lib/validation/schemas';
import {
  createMPRefund,
  fetchMPAccountBalanceFromProvider,
  fetchMPDevicesFromProvider,
  searchMPPaymentsFromProvider,
  type MPAccountBalance,
  type MPDevice,
  type MPSearchResult,
} from '@/server/mercadopago-service';

export type { MPAccountBalance, MPDevice, MPSearchResult } from '@/server/mercadopago-service';

// ==================== QUERIES ====================

/**
 * Fetch all MP payments linked to sales (most recent first).
 */
async function _fetchMercadoPagoPayments(): Promise<
  {
    id: string;
    paymentId: string;
    status: string;
    saleId: string | null;
    externalReference: string | null;
    amount: number;
    paymentMethodId: string | null;
    paymentType: string | null;
    installments: number;
    feeAmount: number | null;
    netAmount: number | null;
    payerEmail: string | null;
    createdAt: string;
  }[]
> {
  await requirePermission('sales.refund', 'settings.view');
  const { storeId } = await requireStoreScope();

  const rows = await db
    .select()
    .from(mercadopagoPayments)
    .where(eq(mercadopagoPayments.storeId, storeId))
    .orderBy(desc(mercadopagoPayments.createdAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    paymentId: r.paymentId,
    status: r.status,
    saleId: r.saleId,
    externalReference: r.externalReference,
    amount: Number(r.amount) || 0,
    paymentMethodId: r.paymentMethodId,
    paymentType: r.paymentType,
    installments: r.installments,
    feeAmount: r.feeAmount ? Number(r.feeAmount) : null,
    netAmount: r.netAmount ? Number(r.netAmount) : null,
    payerEmail: r.payerEmail,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Fetch all refunds (most recent first).
 */
async function _fetchMercadoPagoRefunds(): Promise<MercadoPagoRefund[]> {
  await requirePermission('sales.refund', 'settings.view');
  const { storeId } = await requireStoreScope();

  const rows = await db
    .select()
    .from(mercadopagoRefunds)
    .where(eq(mercadopagoRefunds.storeId, storeId))
    .orderBy(desc(mercadopagoRefunds.createdAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    mpPaymentId: r.mpPaymentId,
    mpRefundId: r.mpRefundId,
    saleId: r.saleId,
    amount: Number(r.amount),
    status: r.status as MercadoPagoRefund['status'],
    reason: r.reason,
    initiatedBy: r.initiatedBy,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }));
}

// ==================== REFUND OPERATIONS ====================

/**
 * Initiate a full or partial refund via MercadoPago API.
 *
 * Flow:
 *   1. Validate permissions and input
 *   2. Verify the MP payment exists and is approved
 *   3. Call MP Refund API through the server-only provider service
 *   4. Record refund in our DB
 *   5. Audit log
 */
async function _createMercadoPagoRefund(input: {
  mpPaymentId: string;
  amount: number;
  reason: string;
  clientRequestId: string;
}): Promise<MercadoPagoRefund> {
  const user = await requirePermission('sales.refund');
  const { storeId } = await requireStoreScope();
  const validated = validateSchema(createMPRefundSchema, input, 'createMercadoPagoRefund');

  const sanitizedReason = sanitize(validated.reason);
  if (!sanitizedReason) {
    throw new Error('El motivo del reembolso no contiene texto válido.');
  }
  const validatedAmount = validateNumber(validated.amount, { min: 0.01, max: 999_999 });
  const amountCents = Math.round(validatedAmount * 100);
  const amount = amountCents / 100;
  const refundId = `ref-${validated.clientRequestId}`;

  const outcome = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`mercadopago-refund:${storeId}:${validated.mpPaymentId}`}))`,
    );

    const [existingRequest] = await tx
      .select()
      .from(mercadopagoRefunds)
      .where(and(eq(mercadopagoRefunds.id, refundId), eq(mercadopagoRefunds.storeId, storeId)))
      .limit(1);

    if (existingRequest) {
      const samePayment = existingRequest.mpPaymentId === validated.mpPaymentId;
      const sameAmount = Math.round(Number(existingRequest.amount) * 100) === amountCents;
      const sameReason = existingRequest.reason === sanitizedReason;
      if (!samePayment || !sameAmount || !sameReason) {
        throw new Error('La solicitud de reembolso ya fue utilizada con otros datos.');
      }

      return {
        created: false,
        record: {
          id: existingRequest.id,
          mpPaymentId: existingRequest.mpPaymentId,
          mpRefundId: existingRequest.mpRefundId,
          saleId: existingRequest.saleId,
          amount: Number(existingRequest.amount),
          status: existingRequest.status as MercadoPagoRefund['status'],
          reason: existingRequest.reason,
          initiatedBy: existingRequest.initiatedBy,
          createdAt: existingRequest.createdAt.toISOString(),
          resolvedAt: existingRequest.resolvedAt?.toISOString() ?? null,
        } satisfies MercadoPagoRefund,
      };
    }

    const [mpPayment] = await tx
      .select()
      .from(mercadopagoPayments)
      .where(
        and(
          eq(mercadopagoPayments.paymentId, validated.mpPaymentId),
          eq(mercadopagoPayments.storeId, storeId),
        ),
      )
      .limit(1);

    if (!mpPayment) {
      throw new Error('Pago de MercadoPago no encontrado en el sistema.');
    }

    if (!['approved', 'partially_refunded'].includes(mpPayment.status)) {
      throw new Error('El pago ya no admite reembolsos. Actualiza la información e intenta de nuevo.');
    }

    const paymentAmountCents = Math.round((Number(mpPayment.amount) || 0) * 100);
    const [summary] = await tx
      .select({
        reservedAmount: sql<string>`COALESCE(SUM(${mercadopagoRefunds.amount}), 0)`,
        approvedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${mercadopagoRefunds.status} = 'approved' THEN ${mercadopagoRefunds.amount} ELSE 0 END), 0)`,
      })
      .from(mercadopagoRefunds)
      .where(
        and(
          eq(mercadopagoRefunds.mpPaymentId, validated.mpPaymentId),
          eq(mercadopagoRefunds.storeId, storeId),
          inArray(mercadopagoRefunds.status, ['approved', 'pending']),
        ),
      );
    const reservedCents = Math.round((Number(summary?.reservedAmount) || 0) * 100);
    const approvedCents = Math.round((Number(summary?.approvedAmount) || 0) * 100);
    const remainingCents = Math.max(0, paymentAmountCents - reservedCents);

    if (amountCents > remainingCents) {
      throw new Error(`El monto supera el saldo reembolsable de $${(remainingCents / 100).toFixed(2)}.`);
    }

    const refundData = await createMPRefund(
      validated.mpPaymentId,
      amount,
      validated.clientRequestId,
      storeId,
    );
    if (Math.round(refundData.amount * 100) !== amountCents) {
      throw new Error('MercadoPago devolvió un monto de reembolso inconsistente.');
    }

    const now = new Date();
    const resolvedAt = refundData.status === 'pending' ? null : now;
    const refundRecord: MercadoPagoRefund = {
      id: refundId,
      mpPaymentId: validated.mpPaymentId,
      mpRefundId: refundData.id,
      saleId: mpPayment.saleId,
      amount,
      status: refundData.status,
      reason: sanitizedReason,
      initiatedBy: user.email,
      createdAt: now.toISOString(),
      resolvedAt: resolvedAt?.toISOString() ?? null,
    };

    await tx.insert(mercadopagoRefunds).values({
      id: refundId,
      storeId,
      mpPaymentId: validated.mpPaymentId,
      mpRefundId: refundData.id,
      saleId: mpPayment.saleId,
      amount: String(amount),
      status: refundData.status,
      reason: sanitizedReason,
      initiatedBy: user.email,
      createdAt: now,
      resolvedAt,
    });

    if (refundData.status !== 'rejected') {
      const approvedAfterCents =
        approvedCents + (refundData.status === 'approved' ? amountCents : 0);
      const nextPaymentStatus =
        approvedAfterCents >= paymentAmountCents
          ? 'refunded'
          : 'partially_refunded';
      await tx
        .update(mercadopagoPayments)
        .set({ status: nextPaymentStatus, updatedAt: now })
        .where(and(eq(mercadopagoPayments.id, mpPayment.id), eq(mercadopagoPayments.storeId, storeId)));
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      storeId,
      userId: user.uid,
      userEmail: user.email,
      action: 'create',
      entity: 'mercadopago_refund',
      entityId: refundId,
      changes: {
        after: {
          mpPaymentId: validated.mpPaymentId,
          amount,
          reason: sanitizedReason,
          mpRefundId: refundRecord.mpRefundId,
          status: refundRecord.status,
        },
      },
    });

    return { created: true, record: refundRecord };
  });

  if (!outcome.created) return outcome.record;
  const refundRecord = outcome.record;

  logger.info('MP refund created', {
    refundId,
    mpPaymentId: validated.mpPaymentId,
    amount,
    status: refundRecord.status,
  });

  return refundRecord;
}

// ==================== ACCOUNT & BALANCE ====================

async function _fetchMPAccountBalance(): Promise<MPAccountBalance> {
  await requirePermission('sales.refund', 'settings.view');
  const { storeId } = await requireStoreScope();
  return fetchMPAccountBalanceFromProvider(storeId);
}

// ==================== DEVICES (POINT TERMINALS) ====================

async function _fetchMPDevices(): Promise<MPDevice[]> {
  await requirePermission('sales.refund', 'settings.view');
  const { storeId } = await requireStoreScope();
  return fetchMPDevicesFromProvider(storeId);
}

// ==================== SEARCH PAYMENTS (MP API) ====================

async function _searchMPPayments(input: {
  status?: string;
  beginDate?: string;
  endDate?: string;
  externalReference?: string;
  offset?: number;
  limit?: number;
}): Promise<MPSearchResult> {
  await requirePermission('sales.refund', 'settings.view');
  const { storeId } = await requireStoreScope();
  const validated = validateSchema(searchMPPaymentsSchema, input, 'searchMPPayments');

  return searchMPPaymentsFromProvider({
    status: validated.status,
    beginDate: validated.beginDate,
    endDate: validated.endDate,
    externalReference: validated.externalReference ? sanitize(validated.externalReference) : undefined,
    offset: validated.offset,
    limit: validated.limit,
  }, storeId);
}

// ==================== EXPORTS WITH LOGGING ====================

export const fetchMercadoPagoPayments = withLogging('mercadopago.fetchMercadoPagoPayments', _fetchMercadoPagoPayments);
export const fetchMercadoPagoRefunds = withLogging('mercadopago.fetchMercadoPagoRefunds', _fetchMercadoPagoRefunds);
export const createMercadoPagoRefund = withLogging('mercadopago.createMercadoPagoRefund', _createMercadoPagoRefund);
export const fetchMPAccountBalance = withLogging('mercadopago.fetchMPAccountBalance', _fetchMPAccountBalance);
export const fetchMPDevices = withLogging('mercadopago.fetchMPDevices', _fetchMPDevices);
export const searchMPPayments = withLogging('mercadopago.searchMPPayments', _searchMPPayments);
