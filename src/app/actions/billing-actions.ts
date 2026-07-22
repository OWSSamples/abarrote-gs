'use server';

import { AppError, withLogging } from '@/lib/errors';
import { requireCurrentAccessJwt, requireOwner, requirePermission, validateId } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';

const BILLING_API_BASE_URL = (process.env.BILLING_API_BASE_URL || 'https://billing.opendexapis.com').replace(/\/+$/, '');
const BILLING_API_PREFIX = '/api/v1';

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
  billingAccountId: string | null;
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

export interface BillingCheckoutRequest {
  priceId: string;
  billingAccountId: string;
  quantity?: number;
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

function readArray(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;

    const nested = readRecord(value);
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.data)) return nested.data;
  }
  return [];
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

function firstRecordFromPayload(payload: unknown, keys: string[]): Record<string, unknown> {
  const root = readRecord(payload);
  const data = root.data;
  if (Array.isArray(data)) return readRecord(data[0]);

  const dataRecord = readRecord(data);
  const source = Object.keys(dataRecord).length > 0 ? dataRecord : root;

  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return readRecord(value[0]);

    const nested = readRecord(value);
    if (Array.isArray(nested.items)) return readRecord(nested.items[0]);
    if (Array.isArray(nested.data)) return readRecord(nested.data[0]);
  }

  return source;
}

function normalizeBillingOverview(
  subscriptionPayload: unknown,
  tenantId: string,
  planPayload?: unknown,
  pricePayload?: unknown,
): BillingOverview {
  const subscription = firstRecordFromPayload(subscriptionPayload, ['subscriptions', 'items']);
  const nestedPlan = readRecord(subscription.plan);
  const plan = Object.keys(nestedPlan).length > 0
    ? nestedPlan
    : firstRecordFromPayload(planPayload, ['plans', 'items']);
  const price = firstRecordFromPayload(pricePayload, ['prices', 'items']);
  const paymentMethod = readRecord(subscription.paymentMethod ?? subscription.defaultPaymentMethod);
  const billingAccount = readRecord(subscription.billingAccount ?? subscription.account ?? subscription.billing);
  const rawInvoices = readArray(subscription, ['invoices', 'invoiceHistory']);
  const subscriptionAmountCents =
    readNumber(subscription, ['amountCents', 'unitAmountCents'])
    ?? readNumber(price, ['amountCents', 'unitAmountCents'])
    ?? readNumber(plan, ['amountCents', 'unitAmountCents']);

  return {
    tenantId,
    billingAccountId:
      readString(subscription, ['billingAccountId', 'billing_account_id'])
      ?? readString(billingAccount, ['id', 'billingAccountId']),
    customerId:
      readString(subscription, ['customerId', 'billingCustomerId', 'stripeCustomerId'])
      ?? readString(billingAccount, ['customerId', 'stripeCustomerId']),
    status: normalizeStatus(readString(subscription, ['status'])),
    planName: readString(plan, ['name', 'title']) ?? readString(subscription, ['planName', 'plan']),
    planCode:
      readString(plan, ['code', 'id'])
      ?? readString(price, ['code', 'id'])
      ?? readString(subscription, ['planCode', 'priceId']),
    amount: subscriptionAmountCents !== null
      ? subscriptionAmountCents / 100
      : readNumber(subscription, ['amount', 'unitAmount'])
        ?? readNumber(price, ['amount', 'unitAmount'])
        ?? readNumber(plan, ['amount', 'unitAmount']),
    currency: (
      readString(subscription, ['currency']) ?? readString(price, ['currency']) ?? readString(plan, ['currency']) ?? 'MXN'
    ).toUpperCase(),
    interval: normalizeInterval(
      readString(subscription, ['interval']) ?? readString(price, ['interval']) ?? readString(plan, ['interval']),
    ),
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
    invoices: rawInvoices.map(normalizeInvoice),
    portalUrl: safeUrl(readString(subscription, ['portalUrl', 'customerPortalUrl'])),
  };
}

async function billingRequest(path: string, token: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${BILLING_API_BASE_URL}${BILLING_API_PREFIX}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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
  const { storeId } = await requireStoreScope();
  const token = await requireCurrentAccessJwt();
  const [subscriptions, plans, prices] = await Promise.all([
    billingRequest('/billing/subscriptions', token),
    billingRequest('/billing/plans', token).catch(() => null),
    billingRequest('/billing/prices', token).catch(() => null),
  ]);

  return normalizeBillingOverview(subscriptions, storeId, plans, prices);
}

async function _createBillingPortalSession(billingAccountId: string): Promise<{ url: string }> {
  await requireOwner();
  await requireStoreScope();
  const token = await requireCurrentAccessJwt();
  const safeBillingAccountId = validateId(billingAccountId, 'billingAccountId');
  const payload = readRecord(
    await billingRequest('/billing/portal', token, {
      method: 'POST',
      body: JSON.stringify({ billingAccountId: safeBillingAccountId }),
    }),
  );

  const data = readRecord(payload.data);
  const url = safeUrl(readString(data, ['url', 'portalUrl']) ?? readString(payload, ['url', 'portalUrl']));
  if (!url) {
    throw new AppError('BILLING_PORTAL_URL_MISSING', 'El portal de facturación no devolvió una URL válida.', 502);
  }

  return { url };
}

async function _createBillingCheckoutSession(input: BillingCheckoutRequest): Promise<{ sessionId: string | null; url: string }> {
  await requireOwner();
  await requireStoreScope();
  const token = await requireCurrentAccessJwt();
  const priceId = validateId(input.priceId, 'priceId');
  const billingAccountId = validateId(input.billingAccountId, 'billingAccountId');
  const quantity = input.quantity === undefined ? 1 : Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    throw new AppError('BILLING_INVALID_QUANTITY', 'La cantidad de licencias no es válida.', 422);
  }

  const payload = readRecord(
    await billingRequest('/billing/checkout', token, {
      method: 'POST',
      body: JSON.stringify({ priceId, billingAccountId, quantity }),
    }),
  );
  const data = readRecord(payload.data);
  const url = safeUrl(readString(data, ['url']) ?? readString(payload, ['url']));
  if (!url) {
    throw new AppError('BILLING_CHECKOUT_URL_MISSING', 'El checkout no devolvió una URL válida.', 502);
  }

  return {
    sessionId: readString(data, ['sessionId']) ?? readString(payload, ['sessionId']),
    url,
  };
}

export const fetchBillingOverview = withLogging('billing.fetchOverview', _fetchBillingOverview);
export const createBillingPortalSession = withLogging('billing.createPortalSession', _createBillingPortalSession);
export const createBillingCheckoutSession = withLogging('billing.createCheckoutSession', _createBillingCheckoutSession);
