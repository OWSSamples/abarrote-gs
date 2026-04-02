'use server';

import Stripe from 'stripe';
import crypto from 'crypto';
import { db } from '@/db';
import { paymentProviderConnections, paymentCharges } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

// ── Types ──

export interface StripeSPEIResult {
  paymentIntentId: string;
  clientSecret: string;
  clabeReference: string;
  bankName: string;
  amount: number;
  expiresAt: Date;
  referenceNumber: string;
  hostedInstructionsUrl: string | null;
}

export interface StripeOXXOResult {
  paymentIntentId: string;
  clientSecret: string;
  reference: string;
  amount: number;
  expiresAt: Date;
  hostedVoucherUrl: string | null;
}

export interface StripeChargeStatus {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  paidAt: Date | null;
}

// ── Client Factory ──

async function getStripeClient(): Promise<Stripe> {
  const [connection] = await db
    .select()
    .from(paymentProviderConnections)
    .where(
      and(
        eq(paymentProviderConnections.provider, 'stripe'),
        eq(paymentProviderConnections.storeId, 'main'),
        eq(paymentProviderConnections.status, 'connected'),
      ),
    )
    .limit(1);

  let secretKey: string;

  if (connection?.accessTokenEnc) {
    secretKey = decrypt(connection.accessTokenEnc);
  } else if (process.env.STRIPE_SECRET_KEY) {
    secretKey = process.env.STRIPE_SECRET_KEY;
  } else {
    throw new Error('Stripe no configurado. Agrega tu Secret Key en Configuración → Pagos.');
  }

  return new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia' });
}

// ── SPEI (mx_bank_transfer) ──

export async function createStripeSPEICharge(params: {
  amount: number;
  customerEmail: string;
  description: string;
  saleReference: string;
}): Promise<StripeSPEIResult> {
  const { amount, customerEmail, description, saleReference } = params;
  const stripe = await getStripeClient();

  const amountCents = Math.round(amount * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'mxn',
    payment_method_types: ['customer_balance'],
    payment_method_data: {
      type: 'customer_balance',
    },
    payment_method_options: {
      customer_balance: {
        funding_type: 'bank_transfer',
        bank_transfer: {
          type: 'mx_bank_transfer',
        },
      },
    },
    customer: await getOrCreateStripeCustomer(stripe, customerEmail),
    description: description || 'Venta POS',
    metadata: {
      sale_reference: saleReference,
      source: 'abarrote-gs-pos',
    },
  });

  // Extract bank transfer details from next_action
  const nextAction = paymentIntent.next_action;
  const bankTransfer = nextAction?.display_bank_transfer_instructions;
  const clabeRef = bankTransfer?.financial_addresses?.[0]?.spei?.clabe ?? '';
  const bankNameStr = bankTransfer?.financial_addresses?.[0]?.spei?.bank_name ?? 'STP';

  const referenceNumber = `ST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 72 * 3600 * 1000); // 72h default

  // Track charge in DB
  await db.insert(paymentCharges).values({
    id: crypto.randomUUID(),
    provider: 'stripe',
    providerChargeId: paymentIntent.id,
    saleId: null,
    storeId: 'main',
    amount: amount.toFixed(2),
    currency: 'MXN',
    paymentMethod: 'spei_stripe',
    status: 'pending',
    customerEmail,
    referenceNumber,
    clabeReference: clabeRef,
    expiresAt,
    providerMetadata: { paymentIntentId: paymentIntent.id },
  });

  logger.info('Stripe SPEI charge created', {
    action: 'stripe_spei_charge',
    paymentIntentId: paymentIntent.id,
    amount,
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret ?? '',
    clabeReference: clabeRef,
    bankName: bankNameStr,
    amount,
    expiresAt,
    referenceNumber,
    hostedInstructionsUrl: bankTransfer?.hosted_instructions_url ?? null,
  };
}

// ── OXXO ──

export async function createStripeOXXOCharge(params: {
  amount: number;
  customerEmail: string;
  description: string;
  saleReference: string;
}): Promise<StripeOXXOResult> {
  const { amount, customerEmail, description, saleReference } = params;
  const stripe = await getStripeClient();

  const amountCents = Math.round(amount * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'mxn',
    payment_method_types: ['oxxo'],
    payment_method_options: {
      oxxo: {
        expires_after_days: 3,
      },
    },
    description: description || 'Venta POS',
    metadata: {
      sale_reference: saleReference,
      source: 'abarrote-gs-pos',
      customer_email: customerEmail,
    },
  });

  // Confirm with OXXO payment method
  const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {
    payment_method_data: {
      type: 'oxxo',
      billing_details: {
        email: customerEmail,
      },
    },
  });

  const nextAction = confirmedIntent.next_action;
  const oxxoDisplay = nextAction?.oxxo_display_details;
  const reference = oxxoDisplay?.number ?? '';
  const expiresAt = oxxoDisplay?.expires_after
    ? new Date(oxxoDisplay.expires_after * 1000)
    : new Date(Date.now() + 3 * 24 * 3600 * 1000);

  // Track charge in DB
  await db.insert(paymentCharges).values({
    id: crypto.randomUUID(),
    provider: 'stripe',
    providerChargeId: paymentIntent.id,
    saleId: null,
    storeId: 'main',
    amount: amount.toFixed(2),
    currency: 'MXN',
    paymentMethod: 'oxxo_stripe',
    status: 'pending',
    customerEmail,
    referenceNumber: reference,
    oxxoReference: reference,
    oxxoBarcode: oxxoDisplay?.hosted_voucher_url ?? null,
    expiresAt,
    providerMetadata: { paymentIntentId: paymentIntent.id },
  });

  logger.info('Stripe OXXO charge created', {
    action: 'stripe_oxxo_charge',
    paymentIntentId: paymentIntent.id,
    amount,
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: confirmedIntent.client_secret ?? '',
    reference,
    amount,
    expiresAt,
    hostedVoucherUrl: oxxoDisplay?.hosted_voucher_url ?? null,
  };
}

// ── Charge Status ──

export async function getStripeChargeStatus(paymentIntentId: string): Promise<StripeChargeStatus> {
  const stripe = await getStripeClient();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  const status = pi.status === 'succeeded'
    ? 'paid' as const
    : pi.status === 'canceled'
      ? 'expired' as const
      : pi.status === 'requires_payment_method' || pi.status === 'requires_action'
        ? 'pending' as const
        : 'failed' as const;

  return {
    id: pi.id,
    status,
    paidAt: status === 'paid' ? new Date() : null,
  };
}

// ── Customer Management ──

async function getOrCreateStripeCustomer(stripe: Stripe, email: string): Promise<string> {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) {
    return existing.data[0].id;
  }
  const customer = await stripe.customers.create({ email });
  return customer.id;
}

// ── Connection Management ──

export async function connectStripe(params: {
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string;
  environment: 'sandbox' | 'production';
}): Promise<{ success: boolean; message: string }> {
  const { secretKey, publishableKey, webhookSecret, environment } = params;

  // Validate key by making a test request
  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia' });
    await stripe.balance.retrieve();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, message: `API Key inválida: ${message}` };
  }

  const { encrypt } = await import('@/lib/crypto');

  const existing = await db
    .select()
    .from(paymentProviderConnections)
    .where(
      and(
        eq(paymentProviderConnections.provider, 'stripe'),
        eq(paymentProviderConnections.storeId, 'main'),
      ),
    )
    .limit(1);

  const connectionData = {
    provider: 'stripe' as const,
    storeId: 'main',
    status: 'connected',
    accessTokenEnc: encrypt(secretKey),
    publicKey: publishableKey,
    webhookSecretEnc: webhookSecret ? encrypt(webhookSecret) : null,
    environment,
    connectedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    await db
      .update(paymentProviderConnections)
      .set(connectionData)
      .where(eq(paymentProviderConnections.id, existing[0].id));
  } else {
    await db.insert(paymentProviderConnections).values({
      id: crypto.randomUUID(),
      ...connectionData,
    });
  }

  logger.info('Stripe connected', { action: 'stripe_connect', environment });

  return { success: true, message: `Stripe conectado en modo ${environment}` };
}

export async function disconnectStripe(): Promise<void> {
  await db
    .update(paymentProviderConnections)
    .set({
      status: 'disconnected',
      accessTokenEnc: null,
      publicKey: null,
      webhookSecretEnc: null,
      disconnectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentProviderConnections.provider, 'stripe'),
        eq(paymentProviderConnections.storeId, 'main'),
      ),
    );

  logger.info('Stripe disconnected', { action: 'stripe_disconnect' });
}

export async function getStripeConnectionStatus(): Promise<{
  connected: boolean;
  environment: string | null;
  publishableKey: string | null;
}> {
  const [connection] = await db
    .select()
    .from(paymentProviderConnections)
    .where(
      and(
        eq(paymentProviderConnections.provider, 'stripe'),
        eq(paymentProviderConnections.storeId, 'main'),
      ),
    )
    .limit(1);

  if (!connection || connection.status !== 'connected') {
    return { connected: false, environment: null, publishableKey: null };
  }

  return {
    connected: true,
    environment: connection.environment,
    publishableKey: connection.publicKey,
  };
}
