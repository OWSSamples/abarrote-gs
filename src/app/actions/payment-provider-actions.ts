'use server';

import { requireOwner } from '@/lib/auth/guard';
import { logger } from '@/lib/logger';
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
import { validateSchema, connectConektaSchema, connectStripeSchema, connectClipSchema, createChargeSchema, createClipTerminalSchema, idSchema } from '@/lib/validation/schemas';

// ══════════════════════════════════════════════════
// ── Conekta Actions ──
// ══════════════════════════════════════════════════

export async function connectConektaAction(params: {
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

export async function disconnectConektaAction(): Promise<void> {
  await requireOwner();
  logger.info('Conekta disconnection', { action: 'conekta_disconnect' });
  return disconnectConekta();
}

export async function getConektaStatusAction(): Promise<{
  connected: boolean;
  environment: string | null;
  publicKey: string | null;
}> {
  return getConektaConnectionStatus();
}

export async function createSPEIConektaAction(params: {
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

export async function createOXXOConektaAction(params: {
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

export async function connectStripeAction(params: {
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

export async function disconnectStripeAction(): Promise<void> {
  await requireOwner();
  logger.info('Stripe disconnection', { action: 'stripe_disconnect' });
  return disconnectStripe();
}

export async function getStripeStatusAction(): Promise<{
  connected: boolean;
  environment: string | null;
  publishableKey: string | null;
}> {
  return getStripeConnectionStatus();
}

export async function createSPEIStripeAction(params: {
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

export async function createOXXOStripeAction(params: {
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

export async function connectClipAction(params: {
  apiKey: string;
  secretKey: string;
  serialNumber?: string;
  environment: 'sandbox' | 'production';
}): Promise<{ success: boolean; message: string }> {
  await requireOwner();
  validateSchema(connectClipSchema, params, 'connectClip');

  logger.info('Clip connection initiated', { action: 'clip_connect_init' });

  return connectClip(params);
}

export async function disconnectClipAction(): Promise<void> {
  await requireOwner();
  logger.info('Clip disconnection', { action: 'clip_disconnect' });
  return disconnectClip();
}

export async function getClipStatusAction(): Promise<{
  connected: boolean;
  environment: string | null;
  apiKey: string | null;
  serialNumber: string | null;
}> {
  return getClipConnectionStatus();
}

export async function createClipCheckoutAction(params: {
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

export async function createClipTerminalAction(params: {
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
// ── Charge Polling (shared) ──
// ══════════════════════════════════════════════════

export async function checkChargeStatus(chargeId: string, provider: 'conekta' | 'stripe' | 'clip'): Promise<{
  status: 'pending' | 'paid' | 'expired' | 'failed';
  paidAt: string | null;
}> {
  // First get providerChargeId from our DB
  const [charge] = await db
    .select()
    .from(paymentCharges)
    .where(eq(paymentCharges.id, chargeId))
    .limit(1);

  if (!charge) {
    return { status: 'failed', paidAt: null };
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

export async function getPendingCharges(provider?: 'conekta' | 'stripe' | 'clip'): Promise<Array<{
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
}>> {
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
