'use server';

import { AppError, withLogging } from '@/lib/errors';
import { requireCurrentAccessJwt, requireOwner, requirePermission, validateId } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { assertHumanRequest } from '@/lib/security/bot-protection';
import { persistTenantEntitlementsPayload } from '@/server/billing-entitlement-service';

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

export interface BillingEntitlement {
  code: string;
  name: string;
  value: number;
  expiresAt: string | null;
}

export interface BillingAvailablePlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceId: string;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number;
  currency: string;
  interval: 'month' | 'year' | 'unknown';
  maxUsers: number | null;
  maxStores: number | null;
  highlights: string[];
}

export interface BillingOverview {
  tenantId: string;
  billingAccountId: string | null;
  customerId: string | null;
  status: BillingSubscriptionStatus;
  planName: string | null;
  planCode: string | null;
  planId: string | null;
  amount: number | null;
  currency: string;
  interval: 'month' | 'year' | 'unknown';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  includedUsers: number | null;
  paymentMethod: BillingPaymentMethod | null;
  invoices: BillingInvoice[];
  entitlements: BillingEntitlement[];
  availablePlans: BillingAvailablePlan[];
  portalUrl: string | null;
}

export interface BillingCheckoutRequest {
  priceId: string;
  billingAccountId: string;
  quantity?: number;
}

export interface BillingFreePlanRequest {
  planId: string;
  billingAccountId: string;
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
  const periodStart = readString(invoice, ['periodStart']);
  const periodEnd = readString(invoice, ['periodEnd']);
  return {
    id: readString(invoice, ['id', 'invoiceId']) ?? readString(invoice, ['number']) ?? 'unknown',
    number: readString(invoice, ['number', 'invoiceNumber']) ?? 'Sin folio',
    period:
      readString(invoice, ['period', 'billingPeriod', 'description'])
      ?? (periodStart && periodEnd
        ? `${periodStart.slice(0, 10)} - ${periodEnd.slice(0, 10)}`
        : 'Sin periodo'),
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

function recordsFromPayload(payload: unknown, keys: string[]): Record<string, unknown>[] {
  const root = readRecord(payload);
  if (Array.isArray(root.data)) return root.data.map(readRecord);

  const data = readRecord(root.data);
  for (const key of keys) {
    const direct = root[key];
    if (Array.isArray(direct)) return direct.map(readRecord);
    const nested = data[key];
    if (Array.isArray(nested)) return nested.map(readRecord);
  }

  if (Array.isArray(data.items)) return data.items.map(readRecord);
  if (Array.isArray(root.items)) return root.items.map(readRecord);
  return [];
}

function readFeatureLimit(features: Record<string, unknown>, code: string): number | null {
  const raw = features[code];
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
  const definition = readRecord(raw);
  return readNumber(definition, ['value']);
}

function normalizeAvailablePlans(planPayload: unknown, pricePayload: unknown): BillingAvailablePlan[] {
  const plans = recordsFromPayload(planPayload, ['plans', 'items']);
  const prices = recordsFromPayload(pricePayload, ['prices', 'items']);

  return plans.flatMap((plan): BillingAvailablePlan[] => {
    const id = readString(plan, ['id']);
    const metadata = readRecord(plan.metadata);
    const code = readString(metadata, ['catalogCode']);
    if (
      !id ||
      !code ||
      readString(metadata, ['catalog']) !== 'opendex-kiosko' ||
      plan.isActive === false ||
      readString(plan, ['status']) === 'inactive'
    ) {
      return [];
    }

    const nestedPrices = Array.isArray(plan.prices) ? plan.prices.map(readRecord) : [];
    const price = [...nestedPrices, ...prices].find((candidate) =>
      readString(candidate, ['planId']) === id &&
      candidate.isActive !== false &&
      normalizeInterval(readString(candidate, ['interval'])) === 'month',
    );
    if (!price) return [];

    const priceId = readString(price, ['id']);
    const totalAmountCents = readNumber(price, ['amount', 'amountCents']);
    if (!priceId || totalAmountCents === null) return [];

    const priceMetadata = readRecord(price.metadata);
    const baseAmountCents = readNumber(priceMetadata, ['baseAmountCents'])
      ?? readNumber(metadata, ['baseAmountCents']);
    const taxAmountCents = readNumber(priceMetadata, ['taxAmountCents'])
      ?? readNumber(metadata, ['taxAmountCents']);
    const taxRateBps = readNumber(priceMetadata, ['taxRateBps'])
      ?? readNumber(metadata, ['taxRateBps'])
      ?? 0;
    if (baseAmountCents === null || taxAmountCents === null) return [];

    const highlights = Array.isArray(metadata.highlights)
      ? metadata.highlights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const features = readRecord(plan.features);

    return [{
      id,
      code,
      name: readString(plan, ['name']) ?? code,
      description: readString(plan, ['description']),
      priceId,
      baseAmount: baseAmountCents / 100,
      taxAmount: taxAmountCents / 100,
      totalAmount: totalAmountCents / 100,
      taxRate: taxRateBps / 100,
      currency: readString(price, ['currency'])?.toUpperCase() ?? 'MXN',
      interval: normalizeInterval(readString(price, ['interval'])),
      maxUsers: readFeatureLimit(features, 'max_users'),
      maxStores: readFeatureLimit(features, 'max_stores'),
      highlights,
    }];
  }).sort((left, right) => left.baseAmount - right.baseAmount);
}

function normalizeBillingOverview(
  subscriptionPayload: unknown,
  tenantId: string,
  planPayload?: unknown,
  pricePayload?: unknown,
  accountPayload?: unknown,
  entitlementPayload?: unknown,
  invoicePayload?: unknown,
  paymentMethodPayload?: unknown,
): BillingOverview {
  const subscription = firstRecordFromPayload(subscriptionPayload, ['subscriptions', 'items']);
  const nestedPlan = readRecord(subscription.subscriptionPlan ?? subscription.plan);
  const plan = nestedPlan;
  const nestedPrice = readRecord(subscription.price);
  const price = nestedPrice;
  const paymentMethodRoot = readRecord(paymentMethodPayload);
  const externalPaymentMethod = readRecord(paymentMethodRoot.data);
  const nestedPaymentMethod = readRecord(
    subscription.paymentMethod ?? subscription.defaultPaymentMethod,
  );
  const paymentMethod = Object.keys(externalPaymentMethod).length > 0
    ? externalPaymentMethod
    : nestedPaymentMethod;
  const nestedBillingAccount = readRecord(
    subscription.billingAccount ?? subscription.account ?? subscription.billing,
  );
  const billingAccount = Object.keys(nestedBillingAccount).length > 0
    ? nestedBillingAccount
    : firstRecordFromPayload(accountPayload, ['account', 'billingAccount']);
  const invoiceRoot = readRecord(invoicePayload);
  const externalInvoices = Array.isArray(invoiceRoot.data) ? invoiceRoot.data : [];
  const rawInvoices = externalInvoices.length > 0
    ? externalInvoices
    : readArray(subscription, ['invoices', 'invoiceHistory']);
  const entitlementRoot = readRecord(entitlementPayload);
  const rawEntitlements = Array.isArray(entitlementRoot.data)
    ? entitlementRoot.data
    : readArray(entitlementRoot, ['entitlements', 'items']);
  const entitlements = rawEntitlements.flatMap((raw): BillingEntitlement[] => {
    const entitlement = readRecord(raw);
    const code = readString(entitlement, ['code']);
    const value = readNumber(entitlement, ['value']);
    if (!code || value === null) return [];
    return [{
      code,
      name: readString(entitlement, ['name']) ?? code,
      value,
      expiresAt: readString(entitlement, ['expiresAt']),
    }];
  });
  const maxUsers = entitlements.find((entitlement) => entitlement.code === 'max_users')?.value ?? null;
  const subscriptionAmountCents =
    readNumber(subscription, ['amountCents', 'unitAmountCents'])
    ?? readNumber(price, ['amountCents', 'unitAmountCents', 'amount'])
    ?? readNumber(plan, ['amountCents', 'unitAmountCents', 'price']);

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
      readString(readRecord(plan.metadata), ['catalogCode'])
      ?? readString(plan, ['code', 'id'])
      ?? readString(price, ['code', 'id'])
      ?? readString(subscription, ['planCode', 'priceId']),
    planId: readString(subscription, ['planId']) ?? readString(plan, ['id']),
    amount: subscriptionAmountCents !== null
      ? subscriptionAmountCents / 100
      : readNumber(subscription, ['amount', 'unitAmount']),
    currency: (
      readString(subscription, ['currency']) ?? readString(price, ['currency']) ?? readString(plan, ['currency']) ?? 'MXN'
    ).toUpperCase(),
    interval: normalizeInterval(
      readString(subscription, ['interval']) ?? readString(price, ['interval']) ?? readString(plan, ['interval']),
    ),
    currentPeriodEnd: readString(subscription, ['currentPeriodEnd', 'renewsAt', 'periodEnd']),
    cancelAtPeriodEnd: readBoolean(subscription, ['cancelAtPeriodEnd']),
    includedUsers:
      maxUsers
      ?? readNumber(subscription, ['includedUsers', 'seats', 'quantity'])
      ?? readNumber(plan, ['includedUsers', 'seats']),
    paymentMethod: Object.keys(paymentMethod).length > 0
      ? {
          brand: readString(paymentMethod, ['brand', 'type']),
          last4: readString(paymentMethod, ['last4']),
          expMonth: readNumber(paymentMethod, ['expMonth', 'expirationMonth']),
          expYear: readNumber(paymentMethod, ['expYear', 'expirationYear']),
        }
      : null,
    invoices: rawInvoices.map(normalizeInvoice),
    entitlements,
    availablePlans: normalizeAvailablePlans(planPayload, pricePayload),
    portalUrl: safeUrl(readString(subscription, ['portalUrl', 'customerPortalUrl'])),
  };
}

async function billingRequest(
  path: string,
  token: string,
  tenantId: string,
  init?: RequestInit,
): Promise<unknown> {
  const requestHeaders = new Headers(init?.headers);
  requestHeaders.set('Accept', 'application/json');
  requestHeaders.set('Content-Type', 'application/json');
  requestHeaders.set('Authorization', `Bearer ${token}`);
  requestHeaders.set('X-Opendex-Tenant-Id', tenantId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  let response: Response;
  try {
    response = await fetch(`${BILLING_API_BASE_URL}${BILLING_API_PREFIX}${path}`, {
      ...init,
      headers: requestHeaders,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    throw new AppError(
      'BILLING_API_UNAVAILABLE',
      'El servicio de facturación no está disponible temporalmente.',
      503,
    );
  } finally {
    clearTimeout(timeout);
  }

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
  const { tenantId } = await requireStoreScope();
  const token = await requireCurrentAccessJwt();
  const swallow = (error: unknown): null => {
    if (error instanceof AppError && (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 503)) {
      return null;
    }
    throw error;
  };
  const [
    subscriptions,
    plans,
    prices,
    account,
    entitlements,
    invoices,
    paymentMethod,
  ] = await Promise.all([
    billingRequest('/billing/subscriptions', token, tenantId).catch(swallow),
    billingRequest('/billing/plans', token, tenantId).catch(swallow),
    billingRequest('/billing/prices', token, tenantId).catch(swallow),
    billingRequest('/billing/account', token, tenantId).catch(swallow),
    billingRequest('/billing/entitlements', token, tenantId).catch(swallow),
    billingRequest('/billing/invoices?limit=20', token, tenantId).catch(swallow),
    billingRequest('/billing/payment-method', token, tenantId).catch(swallow),
  ]);

  if (entitlements) {
    await persistTenantEntitlementsPayload(tenantId, entitlements);
  }

  return normalizeBillingOverview(
    subscriptions,
    tenantId,
    plans,
    prices,
    account,
    entitlements,
    invoices,
    paymentMethod,
  );
}

async function _createBillingPortalSession(billingAccountId: string): Promise<{ url: string }> {
  await requireOwner();
  const { tenantId } = await requireStoreScope();
  const token = await requireCurrentAccessJwt();
  const safeBillingAccountId = validateId(billingAccountId, 'billingAccountId');
  const payload = readRecord(
    await billingRequest('/billing/portal', token, tenantId, {
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
  await assertHumanRequest();
  await requireOwner();
  const { tenantId } = await requireStoreScope();
  const token = await requireCurrentAccessJwt();
  const priceId = validateId(input.priceId, 'priceId');
  const billingAccountId = validateId(input.billingAccountId, 'billingAccountId');
  const quantity = input.quantity === undefined ? 1 : Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    throw new AppError('BILLING_INVALID_QUANTITY', 'La cantidad de licencias no es válida.', 422);
  }

  const payload = readRecord(
    await billingRequest('/billing/checkout', token, tenantId, {
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

async function _activateFreeBillingPlan(input: BillingFreePlanRequest): Promise<void> {
  await assertHumanRequest();
  await requireOwner();
  const { tenantId } = await requireStoreScope();
  const token = await requireCurrentAccessJwt();
  const planId = validateId(input.planId, 'planId');
  const billingAccountId = validateId(input.billingAccountId, 'billingAccountId');

  await billingRequest('/billing/subscriptions/free', token, tenantId, {
    method: 'POST',
    body: JSON.stringify({ planId, billingAccountId }),
  });
}

export const fetchBillingOverview = withLogging('billing.fetchOverview', _fetchBillingOverview);
export const createBillingPortalSession = withLogging('billing.createPortalSession', _createBillingPortalSession);
export const createBillingCheckoutSession = withLogging('billing.createCheckoutSession', _createBillingCheckoutSession);
export const activateFreeBillingPlan = withLogging('billing.activateFreePlan', _activateFreeBillingPlan);
