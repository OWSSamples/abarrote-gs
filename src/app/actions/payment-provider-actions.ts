'use server';

import { requireOwner } from '@/lib/auth/guard';
import { withLogging } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { withRateLimit } from '@/infrastructure/redis';
import { logAudit } from '@/lib/audit';
import { sendNotification } from './_notifications';
import { providerConnectionEvent } from './_notification-events';
import {
  connectConekta,
  disconnectConekta,
  getConektaConnectionStatus,
  createConektaSPEICharge,
  createConektaOXXOCharge,
  getConektaChargeStatus,
} from '@/lib/conekta-provider';
import {
  connectStripe,
  disconnectStripe,
  getStripeConnectionStatus,
  createStripeSPEICharge,
  createStripeOXXOCharge,
  getStripeChargeStatus,
} from '@/lib/stripe-provider';
import {
  connectClip,
  disconnectClip,
  getClipConnectionStatus,
  createClipCheckoutCharge,
  createClipTerminalCharge,
  getClipCheckoutStatus,
  getClipTerminalStatus,
} from '@/lib/clip-provider';
import { db } from '@/db';
import { paymentCharges } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { validateSchema, connectConektaSchema, connectStripeSchema, connectClipSchema } from '@/lib/validation/schemas';

// ══════════════════════════════════════════════════
// ── Conekta Actions ──
// ══════════════════════════════════════════════════

async function _connectConektaAction(params: {
  privateKey: string;
  publicKey: string;
  environment: 'sandbox' | 'production';
}): Promise<{ success: boolean; message: string }> {
  await requireOwner();
  validateSchema(connectConektaSchema, params, 'connectConekta');

  // Basic validation
  if (!params.privateKey.startsWith('key_')) {
    return { success: false, message: 'La API Key privada de Conekta debe iniciar con "key_"' };
  }

  logger.info('Conekta connection initiated', { action: 'conekta_connect_init' });

  return connectConekta(params);
}

async function _disconnectConektaAction(): Promise<void> {
  await requireOwner();
  logger.info('Conekta disconnection', { action: 'conekta_disconnect' });
  return disconnectConekta();
}

async function _getConektaStatusAction(): Promise<{
  connected: boolean;
  environment: string | null;
  publicKey: string | null;
}> {
  return getConektaConnectionStatus();
}

async function _createSPEIConektaAction(params: {
  amount: number;
  customerName: string;
  customerEmail: string;
  description: string;
  saleReference: string;
}): Promise<{
  success: boolean;
  data?: Awaited<ReturnType<typeof createConektaSPEICharge>>;
  error?: string;
}> {
  try {
    const data = await createConektaSPEICharge(params);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear cargo SPEI';
    logger.error('Conekta SPEI charge failed', { action: 'conekta_spei_error', error: message });
    return { success: false, error: message };
  }
}

async function _createOXXOConektaAction(params: {
  amount: number;
  customerName: string;
  customerEmail: string;
  description: string;
  saleReference: string;
}): Promise<{
  success: boolean;
  data?: Awaited<ReturnType<typeof createConektaOXXOCharge>>;
  error?: string;
}> {
  try {
    const data = await createConektaOXXOCharge(params);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear cargo OXXO';
    logger.error('Conekta OXXO charge failed', { action: 'conekta_oxxo_error', error: message });
    return { success: false, error: message };
  }
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
  validateSchema(connectStripeSchema, params, 'connectStripe');

  const prefix = params.environment === 'production' ? 'sk_live_' : 'sk_test_';
  if (!params.secretKey.startsWith(prefix) && !params.secretKey.startsWith('sk_')) {
    return { success: false, message: `La Secret Key debe iniciar con "${prefix}" para modo ${params.environment}` };
  }

  logger.info('Stripe connection initiated', { action: 'stripe_connect_init' });

  return connectStripe(params);
}

async function _disconnectStripeAction(): Promise<void> {
  await requireOwner();
  logger.info('Stripe disconnection', { action: 'stripe_disconnect' });
  return disconnectStripe();
}

async function _getStripeStatusAction(): Promise<{
  connected: boolean;
  environment: string | null;
  publishableKey: string | null;
}> {
  return getStripeConnectionStatus();
}

async function _createSPEIStripeAction(params: {
  amount: number;
  customerEmail: string;
  description: string;
  saleReference: string;
}): Promise<{
  success: boolean;
  data?: Awaited<ReturnType<typeof createStripeSPEICharge>>;
  error?: string;
}> {
  try {
    const data = await createStripeSPEICharge(params);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear cargo SPEI';
    logger.error('Stripe SPEI charge failed', { action: 'stripe_spei_error', error: message });
    return { success: false, error: message };
  }
}

async function _createOXXOStripeAction(params: {
  amount: number;
  customerEmail: string;
  description: string;
  saleReference: string;
}): Promise<{
  success: boolean;
  data?: Awaited<ReturnType<typeof createStripeOXXOCharge>>;
  error?: string;
}> {
  try {
    const data = await createStripeOXXOCharge(params);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear cargo OXXO';
    logger.error('Stripe OXXO charge failed', { action: 'stripe_oxxo_error', error: message });
    return { success: false, error: message };
  }
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
  validateSchema(connectClipSchema, params, 'connectClip');

  logger.info('Clip connection initiated', { action: 'clip_connect_init' });

  const result = await connectClip(params);

  if (result.success) {
    await logAudit({
      userId: user.uid,
      userEmail: user.email,
      action: 'create',
      entity: 'payment_provider',
      entityId: 'clip',
      changes: { after: { provider: 'clip', environment: params.environment, action: 'connect' } },
    });
    sendNotification(providerConnectionEvent({ provider: 'Clip', action: 'connect', userEmail: user.email ?? '', environment: params.environment })).catch(() => {});
  }

  return result;
}

async function _disconnectClipAction(): Promise<void> {
  const user = await requireOwner();
  logger.info('Clip disconnection', { action: 'clip_disconnect' });

  await disconnectClip();

  await logAudit({
    userId: user.uid,
    userEmail: user.email,
    action: 'delete',
    entity: 'payment_provider',
    entityId: 'clip',
    changes: { after: { provider: 'clip', action: 'disconnect' } },
  });
  sendNotification(providerConnectionEvent({ provider: 'Clip', action: 'disconnect', userEmail: user.email ?? '' })).catch(() => {});
}

async function _getClipStatusAction(): Promise<{
  connected: boolean;
  environment: string | null;
  apiKey: string | null;
  serialNumber: string | null;
}> {
  return getClipConnectionStatus();
}

async function _createClipCheckoutAction(params: {
  amount: number;
  description: string;
  saleReference: string;
}): Promise<{
  success: boolean;
  data?: Awaited<ReturnType<typeof createClipCheckoutCharge>>;
  error?: string;
}> {
  try {
    const data = await createClipCheckoutCharge(params);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear link de pago Clip';
    logger.error('Clip checkout charge failed', { action: 'clip_checkout_error', error: message });
    return { success: false, error: message };
  }
}

async function _createClipTerminalAction(params: {
  amount: number;
  saleReference: string;
  serialNumber?: string;
}): Promise<{
  success: boolean;
  data?: Awaited<ReturnType<typeof createClipTerminalCharge>>;
  error?: string;
}> {
  try {
    const data = await createClipTerminalCharge(params);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear pago en terminal Clip';
    logger.error('Clip terminal charge failed', { action: 'clip_terminal_error', error: message });
    return { success: false, error: message };
  }
}

// ══════════════════════════════════════════════════
// ── Cobrar.io (QR) Actions ──
// ══════════════════════════════════════════════════

async function _createCobrarCharge(params: { amount: number; reference: string }): Promise<{
  success: boolean;
  chargeId?: string;
  error?: string;
}> {
  try {
    const chargeId = `cobrar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(paymentCharges).values({
      id: chargeId,
      provider: 'cobrar',
      providerChargeId: chargeId, // self-referencing, webhook uses this
      amount: String(params.amount),
      currency: 'MXN',
      paymentMethod: 'qr_cobro',
      status: 'pending',
      referenceNumber: params.reference,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, chargeId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al crear cargo Cobrar.io';
    logger.error('Cobrar charge creation failed', { action: 'cobrar_charge_error', error: message });
    return { success: false, error: message };
  }
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
  // First get providerChargeId from our DB
  const [charge] = await db.select().from(paymentCharges).where(eq(paymentCharges.id, chargeId)).limit(1);

  if (!charge) {
    return { status: 'failed', paidAt: null };
  }

  // Cobrar.io: status is updated by webhook, just read from DB
  if (provider === 'cobrar') {
    // Check if expired based on expiresAt
    if (charge.status === 'pending' && charge.expiresAt && new Date() > charge.expiresAt) {
      await db
        .update(paymentCharges)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(paymentCharges.id, chargeId));
      return { status: 'expired', paidAt: null };
    }
    return {
      status: charge.status as 'pending' | 'paid' | 'expired' | 'failed',
      paidAt: charge.paidAt?.toISOString() ?? null,
    };
  }

  let result: { status: 'pending' | 'paid' | 'expired' | 'failed'; paidAt: Date | null };

  if (provider === 'conekta') {
    const orderId = (charge.providerMetadata as Record<string, string>)?.orderId ?? charge.providerChargeId;
    result = await getConektaChargeStatus(orderId);
  } else if (provider === 'clip') {
    const metadata = charge.providerMetadata as Record<string, string>;
    if (metadata?.pinpadRequestId) {
      result = await getClipTerminalStatus(charge.providerChargeId);
    } else {
      result = await getClipCheckoutStatus(charge.providerChargeId);
    }
  } else {
    result = await getStripeChargeStatus(charge.providerChargeId);
  }

  // Update our DB
  if (result.status !== charge.status) {
    await db
      .update(paymentCharges)
      .set({
        status: result.status,
        paidAt: result.paidAt,
        updatedAt: new Date(),
      })
      .where(eq(paymentCharges.id, chargeId));
  }

  return {
    status: result.status,
    paidAt: result.paidAt?.toISOString() ?? null,
  };
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
  const conditions = [eq(paymentCharges.status, 'pending')];
  if (provider) {
    conditions.push(eq(paymentCharges.provider, provider));
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

export const connectConektaAction = withRateLimit(
  'paymentProvider.connectConekta',
  withLogging('paymentProvider.connectConektaAction', _connectConektaAction),
);
export const disconnectConektaAction = withRateLimit(
  'paymentProvider.disconnectConekta',
  withLogging('paymentProvider.disconnectConektaAction', _disconnectConektaAction),
);
export const getConektaStatusAction = withLogging('paymentProvider.getConektaStatusAction', _getConektaStatusAction);
export const createSPEIConektaAction = withRateLimit(
  'paymentProvider.createSPEIConekta',
  withLogging('paymentProvider.createSPEIConektaAction', _createSPEIConektaAction),
);
export const createOXXOConektaAction = withRateLimit(
  'paymentProvider.createOXXOConekta',
  withLogging('paymentProvider.createOXXOConektaAction', _createOXXOConektaAction),
);
export const connectStripeAction = withRateLimit(
  'paymentProvider.connectStripe',
  withLogging('paymentProvider.connectStripeAction', _connectStripeAction),
);
export const disconnectStripeAction = withRateLimit(
  'paymentProvider.disconnectStripe',
  withLogging('paymentProvider.disconnectStripeAction', _disconnectStripeAction),
);
export const getStripeStatusAction = withLogging('paymentProvider.getStripeStatusAction', _getStripeStatusAction);
export const createSPEIStripeAction = withRateLimit(
  'paymentProvider.createSPEIStripe',
  withLogging('paymentProvider.createSPEIStripeAction', _createSPEIStripeAction),
);
export const createOXXOStripeAction = withRateLimit(
  'paymentProvider.createOXXOStripe',
  withLogging('paymentProvider.createOXXOStripeAction', _createOXXOStripeAction),
);
export const connectClipAction = withRateLimit(
  'paymentProvider.connectClip',
  withLogging('paymentProvider.connectClipAction', _connectClipAction),
);
export const disconnectClipAction = withRateLimit(
  'paymentProvider.disconnectClip',
  withLogging('paymentProvider.disconnectClipAction', _disconnectClipAction),
);
export const getClipStatusAction = withLogging('paymentProvider.getClipStatusAction', _getClipStatusAction);
export const createClipCheckoutAction = withRateLimit(
  'paymentProvider.createClipCheckout',
  withLogging('paymentProvider.createClipCheckoutAction', _createClipCheckoutAction),
);
export const createClipTerminalAction = withRateLimit(
  'paymentProvider.createClipTerminal',
  withLogging('paymentProvider.createClipTerminalAction', _createClipTerminalAction),
);
export const createCobrarCharge = withRateLimit(
  'paymentProvider.createCobrarCharge',
  withLogging('paymentProvider.createCobrarCharge', _createCobrarCharge),
);
export const checkChargeStatus = withLogging('paymentProvider.checkChargeStatus', _checkChargeStatus);
export const getPendingCharges = withLogging('paymentProvider.getPendingCharges', _getPendingCharges);
