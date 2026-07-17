'use server';

import { requireOwner, requirePermission } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { AppError, withLogging } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';
import { sendNotification } from './_notifications';
import { providerConnectionEvent } from './_notification-events';
import {
  connectConekta,
  disconnectConekta,
  getConektaConnectionStatus,
} from '@/lib/conekta-provider';
import {
  connectStripe,
  disconnectStripe,
  getStripeConnectionStatus,
} from '@/lib/stripe-provider';
import {
  connectClip,
  disconnectClip,
  getClipConnectionStatus,
} from '@/lib/clip-provider';
import { db } from '@/db';
import { paymentCharges } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import {
  validateSchema,
  connectConektaSchema,
  connectStripeSchema,
  connectClipSchema,
  checkPaymentChargeSchema,
  pendingPaymentProviderSchema,
} from '@/lib/validation/schemas';
import { checkPaymentChargeStatus } from '@/server/payment-charge-service';

// ══════════════════════════════════════════════════
// ── Conekta Actions ──
// ══════════════════════════════════════════════════

async function _connectConektaAction(params: {
  privateKey: string;
  publicKey: string;
  environment: 'sandbox' | 'production';
}): Promise<{ success: boolean; message: string }> {
  await requireOwner();
  const { storeId } = await requireStoreScope();
  validateSchema(connectConektaSchema, params, 'connectConekta');

  // Basic validation
  if (!params.privateKey.startsWith('key_')) {
    return { success: false, message: 'La API Key privada de Conekta debe iniciar con "key_"' };
  }

  logger.info('Conekta connection initiated', { action: 'conekta_connect_init' });

  return connectConekta(params, storeId);
}

async function _disconnectConektaAction(): Promise<void> {
  await requireOwner();
  const { storeId } = await requireStoreScope();
  logger.info('Conekta disconnection', { action: 'conekta_disconnect' });
  return disconnectConekta(storeId);
}

async function _getConektaStatusAction(): Promise<{
  connected: boolean;
  environment: string | null;
  publicKey: string | null;
}> {
  await requirePermission('settings.view');
  const { storeId } = await requireStoreScope();
  return getConektaConnectionStatus(storeId);
}

// ══════════════════════════════════════════════════
// ── Stripe Actions ──
// ══════════════════════════════════════════════════

async function _connectStripeAction(params: {
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string;
  environment: 'sandbox' | 'production';
}): Promise<{ success: boolean; message: string }> {
  await requireOwner();
  const { storeId } = await requireStoreScope();
  validateSchema(connectStripeSchema, params, 'connectStripe');

  const prefix = params.environment === 'production' ? 'sk_live_' : 'sk_test_';
  if (!params.secretKey.startsWith(prefix) && !params.secretKey.startsWith('sk_')) {
    return { success: false, message: `La Secret Key debe iniciar con "${prefix}" para modo ${params.environment}` };
  }

  logger.info('Stripe connection initiated', { action: 'stripe_connect_init' });

  return connectStripe(params, storeId);
}

async function _disconnectStripeAction(): Promise<void> {
  await requireOwner();
  const { storeId } = await requireStoreScope();
  logger.info('Stripe disconnection', { action: 'stripe_disconnect' });
  return disconnectStripe(storeId);
}

async function _getStripeStatusAction(): Promise<{
  connected: boolean;
  environment: string | null;
  publishableKey: string | null;
}> {
  await requirePermission('settings.view');
  const { storeId } = await requireStoreScope();
  return getStripeConnectionStatus(storeId);
}

// ══════════════════════════════════════════════════
// ── Clip Actions ──
// ══════════════════════════════════════════════════

async function _connectClipAction(params: {
  apiKey: string;
  secretKey: string;
  serialNumber?: string;
  environment: 'sandbox' | 'production';
}): Promise<{ success: boolean; message: string }> {
  const user = await requireOwner();
  const { storeId } = await requireStoreScope();
  validateSchema(connectClipSchema, params, 'connectClip');

  logger.info('Clip connection initiated', { action: 'clip_connect_init' });

  const result = await connectClip(params, storeId);

  if (result.success) {
    await logAudit({
      storeId,
      userId: user.uid,
      userEmail: user.email,
      action: 'create',
      entity: 'payment_provider',
      entityId: 'clip',
      changes: { after: { provider: 'clip', environment: params.environment, action: 'connect' } },
    });
    sendNotification(providerConnectionEvent({ provider: 'Clip', action: 'connect', userEmail: user.email ?? '', environment: params.environment }), storeId).catch(() => {});
  }

  return result;
}

async function _disconnectClipAction(): Promise<void> {
  const user = await requireOwner();
  const { storeId } = await requireStoreScope();
  logger.info('Clip disconnection', { action: 'clip_disconnect' });

  await disconnectClip(storeId);

  await logAudit({
    storeId,
    userId: user.uid,
    userEmail: user.email,
    action: 'delete',
    entity: 'payment_provider',
    entityId: 'clip',
    changes: { after: { provider: 'clip', action: 'disconnect' } },
  });
  sendNotification(providerConnectionEvent({ provider: 'Clip', action: 'disconnect', userEmail: user.email ?? '' }), storeId).catch(() => {});
}

async function _getClipStatusAction(): Promise<{
  connected: boolean;
  environment: string | null;
  hasApiKey: boolean;
  serialNumber: string | null;
}> {
  await requirePermission('settings.view');
  const { storeId } = await requireStoreScope();
  const status = await getClipConnectionStatus(storeId);
  return {
    connected: status.connected,
    environment: status.environment,
    hasApiKey: Boolean(status.apiKey),
    serialNumber: status.serialNumber,
  };
}

// ══════════════════════════════════════════════════
// ── Cobrar.io (QR) Actions ──
// ══════════════════════════════════════════════════

async function _createCobrarCharge(_params: { amount: number; reference: string }): Promise<{
  success: boolean;
  chargeId?: string;
  error?: string;
}> {
  await requirePermission('sales.create');
  throw new AppError(
    'PAYMENT_FLOW_DISABLED',
    'El cobro QR automatizado permanecerá deshabilitado hasta vincular cada cargo a una venta verificada.',
    503,
  );
}

// ══════════════════════════════════════════════════
// ── Charge Polling (shared) ──
// ══════════════════════════════════════════════════

async function _checkChargeStatus(
  chargeId: string,
  provider: 'conekta' | 'stripe' | 'clip' | 'cobrar',
): Promise<{
  status: 'pending' | 'paid' | 'expired' | 'failed';
  paidAt: string | null;
}> {
  await requirePermission('sales.create', 'sales.view');
  const { storeId } = await requireStoreScope();
  const validated = validateSchema(checkPaymentChargeSchema, { chargeId, provider }, 'checkChargeStatus');
  return checkPaymentChargeStatus(validated.chargeId, validated.provider, storeId);
}

async function _getPendingCharges(provider?: 'conekta' | 'stripe' | 'clip'): Promise<
  Array<{
    id: string;
    provider: string;
    amount: string;
    paymentMethod: string;
    status: string;
    referenceNumber: string | null;
    clabeReference: string | null;
    oxxoReference: string | null;
    expiresAt: string | null;
    createdAt: string;
  }>
> {
  await requirePermission('sales.view');
  const { storeId } = await requireStoreScope();
  const validatedProvider = validateSchema(pendingPaymentProviderSchema, provider, 'getPendingCharges');
  const conditions = [eq(paymentCharges.status, 'pending'), eq(paymentCharges.storeId, storeId)];
  if (validatedProvider) {
    conditions.push(eq(paymentCharges.provider, validatedProvider));
  }

  const charges = await db
    .select()
    .from(paymentCharges)
    .where(and(...conditions))
    .orderBy(desc(paymentCharges.createdAt))
    .limit(50);

  return charges.map((c) => ({
    id: c.id,
    provider: c.provider,
    amount: String(c.amount),
    paymentMethod: c.paymentMethod,
    status: c.status,
    referenceNumber: c.referenceNumber,
    clabeReference: c.clabeReference,
    oxxoReference: c.oxxoReference,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));
}

// ══════════════════════════════════════════════════
// ── Exports with Logging ──
// ══════════════════════════════════════════════════

export const connectConektaAction = withLogging('paymentProvider.connectConektaAction', _connectConektaAction);
export const disconnectConektaAction = withLogging(
  'paymentProvider.disconnectConektaAction',
  _disconnectConektaAction,
);
export const getConektaStatusAction = withLogging('paymentProvider.getConektaStatusAction', _getConektaStatusAction);
export const connectStripeAction = withLogging('paymentProvider.connectStripeAction', _connectStripeAction);
export const disconnectStripeAction = withLogging(
  'paymentProvider.disconnectStripeAction',
  _disconnectStripeAction,
);
export const getStripeStatusAction = withLogging('paymentProvider.getStripeStatusAction', _getStripeStatusAction);
export const connectClipAction = withLogging('paymentProvider.connectClipAction', _connectClipAction);
export const disconnectClipAction = withLogging('paymentProvider.disconnectClipAction', _disconnectClipAction);
export const getClipStatusAction = withLogging('paymentProvider.getClipStatusAction', _getClipStatusAction);
export const createCobrarCharge = withLogging('paymentProvider.createCobrarCharge', _createCobrarCharge);
export const checkChargeStatus = withLogging('paymentProvider.checkChargeStatus', _checkChargeStatus);
export const getPendingCharges = withLogging('paymentProvider.getPendingCharges', _getPendingCharges);
