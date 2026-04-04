'use server';

import { requirePermission, sanitize, validateNumber } from '@/lib/auth/guard';
import { withLogging } from '@/lib/errors';
import { db } from '@/db';
import { mercadopagoPayments, mercadopagoRefunds, saleRecords } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';
import type { MercadoPagoRefund } from '@/types';
import crypto from 'crypto';
import { validateSchema, createMPRefundSchema } from '@/lib/validation/schemas';
import { getBaseUrl } from '@/lib/env';

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
  const user = await requirePermission('sales.view');

  const rows = await db
    .select()
    .from(mercadopagoPayments)
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
  const user = await requirePermission('sales.view');

  const rows = await db
    .select()
    .from(mercadopagoRefunds)
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
 *   3. Call MP Refund API via the backend route
 *   4. Record refund in our DB
 *   5. Audit log
 */
async function _createMercadoPagoRefund(input: {
  mpPaymentId: string;
  amount: number;
  reason: string;
}): Promise<MercadoPagoRefund> {
  const user = await requirePermission('sales.refund');
  validateSchema(createMPRefundSchema, input, 'createMercadoPagoRefund');

  const sanitizedReason = sanitize(input.reason);
  const amount = validateNumber(input.amount, { min: 0.01, max: 999_999 });

  // 1. Find the original payment in our DB
  const [mpPayment] = await db
    .select()
    .from(mercadopagoPayments)
    .where(eq(mercadopagoPayments.paymentId, input.mpPaymentId))
    .limit(1);

  if (!mpPayment) {
    throw new Error('Pago de MercadoPago no encontrado en el sistema.');
  }

  if (mpPayment.status !== 'approved') {
    throw new Error(`No se puede reembolsar un pago con status "${mpPayment.status}".`);
  }

  const paymentAmount = Number(mpPayment.amount) || 0;
  if (amount > paymentAmount) {
    throw new Error(`El monto del reembolso ($${amount}) excede el monto del pago ($${paymentAmount}).`);
  }

  // 2. Call MP Refund API (via our internal API route)
  const refundResponse = await fetch(
    `${getBaseUrl()}/api/mercadopago`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_refund',
        paymentId: input.mpPaymentId,
        amount,
      }),
    },
  );

  if (!refundResponse.ok) {
    const errorData = await refundResponse.json().catch(() => ({}));
    const msg = (errorData as Record<string, string>).error || 'Error al procesar reembolso en MercadoPago';
    logger.error('MP refund API error', { mpPaymentId: input.mpPaymentId, error: msg });
    throw new Error(msg);
  }

  const refundData = (await refundResponse.json()) as {
    id: number;
    status: string;
    amount: number;
  };

  // 3. Record in our DB
  const refundId = `ref-${crypto.randomUUID()}`;
  const now = new Date();

  const refundRecord: MercadoPagoRefund = {
    id: refundId,
    mpPaymentId: input.mpPaymentId,
    mpRefundId: String(refundData.id),
    saleId: mpPayment.saleId,
    amount,
    status: refundData.status === 'approved' ? 'approved' : 'pending',
    reason: sanitizedReason,
    initiatedBy: user.email,
    createdAt: now.toISOString(),
    resolvedAt: refundData.status === 'approved' ? now.toISOString() : null,
  };

  await db.insert(mercadopagoRefunds).values({
    id: refundId,
    mpPaymentId: input.mpPaymentId,
    mpRefundId: String(refundData.id),
    saleId: mpPayment.saleId,
    amount: String(amount),
    status: refundRecord.status,
    reason: sanitizedReason,
    initiatedBy: user.email,
    createdAt: now,
    resolvedAt: refundData.status === 'approved' ? now : null,
  });

  // 4. Update the MP payment status if fully refunded
  if (amount >= paymentAmount) {
    await db
      .update(mercadopagoPayments)
      .set({ status: 'refunded', updatedAt: now })
      .where(eq(mercadopagoPayments.paymentId, input.mpPaymentId));
  } else {
    await db
      .update(mercadopagoPayments)
      .set({ status: 'partially_refunded', updatedAt: now })
      .where(eq(mercadopagoPayments.paymentId, input.mpPaymentId));
  }

  // 5. Audit
  await logAudit({
    userId: user.uid,
    userEmail: user.email,
    action: 'create',
    entity: 'mercadopago_refund',
    entityId: refundId,
    changes: {
      after: {
        mpPaymentId: input.mpPaymentId,
        amount,
        reason: sanitizedReason,
        mpRefundId: refundData.id,
        status: refundRecord.status,
      },
    },
  });

  logger.info('MP refund created', {
    refundId,
    mpPaymentId: input.mpPaymentId,
    amount,
    status: refundRecord.status,
  });

  return refundRecord;
}

// ==================== ACCOUNT & BALANCE ====================

export interface MPAccountBalance {
  userId: number;
  nickname: string;
  email: string;
  balance: {
    available_balance: number;
    unavailable_balance: number;
    total_amount: number;
    currency_id: string;
  };
}

async function _fetchMPAccountBalance(): Promise<MPAccountBalance> {
  await requirePermission('sales.view');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/mercadopago`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_balance' }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as Record<string, string>).error || 'Error al consultar saldo de MercadoPago',
    );
  }

  return response.json() as Promise<MPAccountBalance>;
}

// ==================== PAYMENT LINKS (PREFERENCES) ====================

export interface MPPaymentLink {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
  externalReference: string;
}

async function _generateMPPaymentLink(input: {
  amount: number;
  description: string;
  externalReference?: string;
}): Promise<MPPaymentLink> {
  const user = await requirePermission('sales.create');

  const amount = validateNumber(input.amount, { min: 1, max: 999_999 });
  const description = sanitize(input.description);
  const externalReference = input.externalReference
    ? sanitize(input.externalReference)
    : `link-${crypto.randomUUID().slice(0, 8)}`;

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/mercadopago`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create_preference',
      amount,
      description,
      external_reference: externalReference,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as Record<string, string>).error || 'Error al crear link de pago',
    );
  }

  const data = (await response.json()) as {
    id: string;
    init_point: string;
    sandbox_init_point: string;
  };

  await logAudit({
    userId: user.uid,
    userEmail: user.email,
    action: 'create',
    entity: 'mp_payment_link',
    entityId: data.id,
    changes: { after: { amount, description, externalReference } },
  });

  logger.info('MP payment link created', {
    preferenceId: data.id,
    amount,
    description,
  });

  return {
    preferenceId: data.id,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
    externalReference,
  };
}

// ==================== DEVICES (POINT TERMINALS) ====================

export interface MPDevice {
  id: string;
  pos_id: number;
  store_id: string;
  external_pos_id: string;
  operating_mode: string;
}

async function _fetchMPDevices(): Promise<MPDevice[]> {
  await requirePermission('sales.view');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/mercadopago`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_devices' }),
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { devices?: MPDevice[] };
  return data.devices ?? [];
}

// ==================== SEARCH PAYMENTS (MP API) ====================

export interface MPSearchResult {
  results: Array<{
    id: number;
    status: string;
    status_detail: string;
    date_created: string;
    date_approved: string | null;
    transaction_amount: number;
    currency_id: string;
    payment_method_id: string;
    payment_type_id: string;
    description: string | null;
    external_reference: string | null;
    payer: { email: string | null };
    fee_details: Array<{ amount: number; type: string }>;
  }>;
  paging: { total: number; limit: number; offset: number };
}

async function _searchMPPayments(input: {
  status?: string;
  beginDate?: string;
  endDate?: string;
  externalReference?: string;
  offset?: number;
  limit?: number;
}): Promise<MPSearchResult> {
  await requirePermission('sales.view');

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/mercadopago`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'search_payments',
      status: input.status || undefined,
      beginDate: input.beginDate || undefined,
      endDate: input.endDate || undefined,
      externalReference: input.externalReference
        ? sanitize(input.externalReference)
        : undefined,
      offset: input.offset ?? 0,
      limit: input.limit ?? 30,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as Record<string, string>).error || 'Error al buscar pagos en MercadoPago',
    );
  }

  return response.json() as Promise<MPSearchResult>;
}

// ==================== EXPORTS WITH LOGGING ====================

export const fetchMercadoPagoPayments = withLogging('mercadopago.fetchMercadoPagoPayments', _fetchMercadoPagoPayments);
export const fetchMercadoPagoRefunds = withLogging('mercadopago.fetchMercadoPagoRefunds', _fetchMercadoPagoRefunds);
export const createMercadoPagoRefund = withLogging('mercadopago.createMercadoPagoRefund', _createMercadoPagoRefund);
export const fetchMPAccountBalance = withLogging('mercadopago.fetchMPAccountBalance', _fetchMPAccountBalance);
export const generateMPPaymentLink = withLogging('mercadopago.generateMPPaymentLink', _generateMPPaymentLink);
export const fetchMPDevices = withLogging('mercadopago.fetchMPDevices', _fetchMPDevices);
export const searchMPPayments = withLogging('mercadopago.searchMPPayments', _searchMPPayments);
