'use server';

import { AppError, withLogging } from '@/lib/errors';
import { requireOwner, requirePermission } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';

const BILLING_API_BASE_URL = (process.env.BILLING_API_BASE_URL || 'https://billing.opendexapis.com').replace(/\/+$/, '');

export type BillingSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'none'
  | 'unknown';

export interface BillingPaymentMethod {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export interface BillingInvoice {
  id: string;
  number: string;
  period: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'draft' | 'unknown';
  issuedAt: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface BillingOverview {
  tenantId: string;
  customerId: string | null;
  status: BillingSubscriptionStatus;
  planName: string | null;
  planCode: string | null;
  amount: number | null;
  currency: string;
  interval: 'month' | 'year' | 'unknown';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  includedUsers: number | null;
  paymentMethod: BillingPaymentMethod | null;
  invoices: BillingInvoice[];
  portalUrl: string | null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function readBoolean(record: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
  }
  return false;
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeStatus(value: string | null): BillingSubscriptionStatus {
  switch (value) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
    case 'none':
      return value;
    default:
      return value ? 'unknown' : 'none';
  }
}

function normalizeInterval(value: string | null): BillingOverview['interval'] {
  if (value === 'month' || value === 'monthly') return 'month';
  if (value === 'year' || value === 'annual' || value === 'yearly') return 'year';
  return 'unknown';
}

function normalizeInvoice(raw: unknown): BillingInvoice {
  const invoice = readRecord(raw);
  const amountCents = readNumber(invoice, ['amountCents', 'totalCents', 'amountDueCents']);
  return {
    id: readString(invoice, ['id', 'invoiceId']) ?? readString(invoice, ['number']) ?? 'unknown',
    number: readString(invoice, ['number', 'invoiceNumber']) ?? 'Sin folio',
    period: readString(invoice, ['period', 'billingPeriod', 'description']) ?? 'Sin periodo',
    amount: amountCents !== null ? amountCents / 100 : readNumber(invoice, ['amount', 'total', 'amountDue']) ?? 0,
    currency: readString(invoice, ['currency'])?.toUpperCase() ?? 'MXN',
    status: normalizeInvoiceStatus(readString(invoice, ['status'])),
    issuedAt: readString(invoice, ['issuedAt', 'createdAt', 'created']),
    hostedUrl: safeUrl(readString(invoice, ['hostedUrl', 'hostedInvoiceUrl', 'url'])),
    pdfUrl: safeUrl(readString(invoice, ['pdfUrl', 'invoicePdf'])),
  };
}

function normalizeInvoiceStatus(value: string | null): BillingInvoice['status'] {
  switch (value) {
    case 'paid':
    case 'open':
    case 'void':
    case 'draft':
      return value;
    default:
      return 'unknown';
  }
}

function normalizeBillingOverview(payload: unknown, tenantId: string): BillingOverview {
  const root = readRecord(payload);
  const data = readRecord(root.data);
  const source = Object.keys(data).length > 0 ? data : root;
  const subscription = readRecord(source.subscription);
  const plan = readRecord(source.plan);
  const paymentMethod = readRecord(source.paymentMethod ?? source.defaultPaymentMethod);
  const rawInvoices = source.invoices ?? readRecord(source.invoiceHistory).items;
  const subscriptionAmountCents =
    readNumber(subscription, ['amountCents', 'unitAmountCents']) ?? readNumber(plan, ['amountCents', 'unitAmountCents']);

  return {
    tenantId,
    customerId: readString(source, ['customerId', 'billingCustomerId']),
    status: normalizeStatus(readString(subscription, ['status']) ?? readString(source, ['status'])),
    planName: readString(plan, ['name', 'title']) ?? readString(subscription, ['planName', 'plan']),
    planCode: readString(plan, ['code', 'id']) ?? readString(subscription, ['planCode', 'priceId']),
    amount: subscriptionAmountCents !== null
      ? subscriptionAmountCents / 100
      : readNumber(subscription, ['amount', 'unitAmount']) ?? readNumber(plan, ['amount', 'unitAmount']),
    currency: (readString(subscription, ['currency']) ?? readString(plan, ['currency']) ?? 'MXN').toUpperCase(),
    interval: normalizeInterval(readString(subscription, ['interval']) ?? readString(plan, ['interval'])),
    currentPeriodEnd: readString(subscription, ['currentPeriodEnd', 'renewsAt', 'periodEnd']),
    cancelAtPeriodEnd: readBoolean(subscription, ['cancelAtPeriodEnd']),
    includedUsers:
      readNumber(subscription, ['includedUsers', 'seats', 'quantity']) ?? readNumber(plan, ['includedUsers', 'seats']),
    paymentMethod: Object.keys(paymentMethod).length > 0
      ? {
          brand: readString(paymentMethod, ['brand', 'type']),
          last4: readString(paymentMethod, ['last4']),
          expMonth: readNumber(paymentMethod, ['expMonth', 'expirationMonth']),
          expYear: readNumber(paymentMethod, ['expYear', 'expirationYear']),
        }
      : null,
    invoices: Array.isArray(rawInvoices) ? rawInvoices.map(normalizeInvoice) : [],
    portalUrl: safeUrl(readString(source, ['portalUrl', 'customerPortalUrl'])),
  };
}

async function billingRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${BILLING_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new AppError(
      'BILLING_API_ERROR',
      'No fue posible consultar la información de facturación.',
      response.status >= 500 ? 503 : response.status,
      { status: response.status },
    );
  }

  return payload;
}

async function _fetchBillingOverview(): Promise<BillingOverview> {
  await requirePermission('settings.view');
  const { storeId, user } = await requireStoreScope();
  const payload = await billingRequest(`/v1/tenants/${encodeURIComponent(storeId)}/billing`, {
    headers: {
      'X-Tenant-Id': storeId,
      'X-User-Id': user.uid,
      'X-User-Email': user.email,
    },
  });

  return normalizeBillingOverview(payload, storeId);
}

async function _createBillingPortalSession(): Promise<{ url: string }> {
  const user = await requireOwner();
  const { storeId } = await requireStoreScope();
  const payload = readRecord(
    await billingRequest(`/v1/tenants/${encodeURIComponent(storeId)}/billing/portal`, {
      method: 'POST',
      headers: {
        'X-Tenant-Id': storeId,
        'X-User-Id': user.uid,
        'X-User-Email': user.email,
      },
      body: JSON.stringify({ tenantId: storeId, userId: user.uid, email: user.email }),
    }),
  );

  const data = readRecord(payload.data);
  const url = safeUrl(readString(data, ['url', 'portalUrl']) ?? readString(payload, ['url', 'portalUrl']));
  if (!url) {
    throw new AppError('BILLING_PORTAL_URL_MISSING', 'El portal de facturación no devolvió una URL válida.', 502);
  }

  return { url };
}

export const fetchBillingOverview = withLogging('billing.fetchOverview', _fetchBillingOverview);
export const createBillingPortalSession = withLogging('billing.createPortalSession', _createBillingPortalSession);
