'use server';

import { Configuration, OrdersApi } from 'conekta';
import crypto from 'crypto';
import { db } from '@/db';
import { paymentProviderConnections, paymentCharges } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';

// ── Types ──

export interface ConektaSPEIResult {
  orderId: string;
  chargeId: string;
  clabeReference: string;
  bankName: string;
  amount: number;
  expiresAt: Date;
  referenceNumber: string;
}

export interface ConektaOXXOResult {
  orderId: string;
  chargeId: string;
  barcodeUrl: string;
  reference: string;
  amount: number;
  expiresAt: Date;
}

export interface ConektaChargeStatus {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  paidAt: Date | null;
}

// ── Client Factory ──

async function getConektaClient(): Promise<OrdersApi> {
  // Try DB connection first, then env fallback
  const [connection] = await db
    .select()
    .from(paymentProviderConnections)
    .where(
      and(
        eq(paymentProviderConnections.provider, 'conekta'),
        eq(paymentProviderConnections.storeId, 'main'),
        eq(paymentProviderConnections.status, 'connected'),
      ),
    )
    .limit(1);

  let apiKey: string;

  if (connection?.accessTokenEnc) {
    apiKey = decrypt(connection.accessTokenEnc);
  } else if (process.env.CONEKTA_PRIVATE_KEY) {
    apiKey = process.env.CONEKTA_PRIVATE_KEY;
  } else {
    throw new Error('Conekta no configurado. Agrega tu API Key en Configuración → Pagos.');
  }

  const config = new Configuration({ accessToken: apiKey });
  return new OrdersApi(config);
}

function getConektaEnvironment(): 'production' | 'sandbox' {
  return process.env.CONEKTA_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
}

// ── SPEI Charge ──

export async function createConektaSPEICharge(params: {
  amount: number;
  customerName: string;
  customerEmail: string;
  description: string;
  saleReference: string;
  expirationHours?: number;
}): Promise<ConektaSPEIResult> {
  const { amount, customerName, customerEmail, description, saleReference, expirationHours = 72 } = params;
  const ordersApi = await getConektaClient();

  const amountCents = Math.round(amount * 100);
  const expiresAt = Math.floor(Date.now() / 1000) + expirationHours * 3600;

  const orderResponse = await ordersApi.createOrder({
    currency: 'MXN',
    customer_info: {
      name: customerName,
      email: customerEmail,
      phone: '0000000000',
    },
    line_items: [
      {
        name: description || 'Venta POS',
        unit_price: amountCents,
        quantity: 1,
      },
    ],
    charges: [
      {
        payment_method: {
          type: 'spei',
          expires_at: expiresAt,
        },
      },
    ],
    metadata: {
      sale_reference: saleReference,
      source: 'abarrote-gs-pos',
    },
  });

  const order = orderResponse.data;
  const charge = order.charges?.data?.[0];
  if (!charge) {
    throw new Error('Conekta no retornó información del cargo SPEI');
  }

  const paymentMethodResponse = charge.payment_method as unknown as Record<string, unknown>;
  const clabeRef = (paymentMethodResponse?.clabe as string) ?? '';
  const bankNameStr = (paymentMethodResponse?.bank as string) ?? 'STP';

  const referenceNumber = `CK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  // Track charge in DB
  await db.insert(paymentCharges).values({
    id: crypto.randomUUID(),
    provider: 'conekta',
    providerChargeId: charge.id ?? order.id ?? '',
    saleId: null,
    storeId: 'main',
    amount: amount.toFixed(2),
    currency: 'MXN',
    paymentMethod: 'spei_conekta',
    status: 'pending',
    customerName,
    customerEmail,
    referenceNumber,
    clabeReference: clabeRef,
    expiresAt: new Date(expiresAt * 1000),
    providerMetadata: { orderId: order.id, chargeId: charge.id },
  });

  logger.info('Conekta SPEI charge created', {
    action: 'conekta_spei_charge',
    orderId: order.id,
    amount,
    clabeRef: clabeRef.substring(0, 6) + '***',
  });

  return {
    orderId: order.id ?? '',
    chargeId: charge.id ?? '',
    clabeReference: clabeRef,
    bankName: bankNameStr,
    amount,
    expiresAt: new Date(expiresAt * 1000),
    referenceNumber,
  };
}

// ── OXXO Charge ──

export async function createConektaOXXOCharge(params: {
  amount: number;
  customerName: string;
  customerEmail: string;
  description: string;
  saleReference: string;
  expirationHours?: number;
}): Promise<ConektaOXXOResult> {
  const { amount, customerName, customerEmail, description, saleReference, expirationHours = 72 } = params;
  const ordersApi = await getConektaClient();

  const amountCents = Math.round(amount * 100);
  const expiresAt = Math.floor(Date.now() / 1000) + expirationHours * 3600;

  const orderResponse = await ordersApi.createOrder({
    currency: 'MXN',
    customer_info: {
      name: customerName,
      email: customerEmail,
      phone: '0000000000',
    },
    line_items: [
      {
        name: description || 'Venta POS',
        unit_price: amountCents,
        quantity: 1,
      },
    ],
    charges: [
      {
        payment_method: {
          type: 'oxxo_cash',
          expires_at: expiresAt,
        },
      },
    ],
    metadata: {
      sale_reference: saleReference,
      source: 'abarrote-gs-pos',
    },
  });

  const order = orderResponse.data;
  const charge = order.charges?.data?.[0];
  if (!charge) {
    throw new Error('Conekta no retornó información del cargo OXXO');
  }

  const pm = charge.payment_method as unknown as Record<string, unknown>;
  const barcodeUrl = (pm?.barcode_url as string) ?? '';
  const reference = (pm?.reference as string) ?? '';

  // Track charge in DB
  await db.insert(paymentCharges).values({
    id: crypto.randomUUID(),
    provider: 'conekta',
    providerChargeId: charge.id ?? order.id ?? '',
    saleId: null,
    storeId: 'main',
    amount: amount.toFixed(2),
    currency: 'MXN',
    paymentMethod: 'oxxo_conekta',
    status: 'pending',
    customerName,
    customerEmail,
    referenceNumber: reference,
    oxxoBarcode: barcodeUrl,
    oxxoReference: reference,
    expiresAt: new Date(expiresAt * 1000),
    providerMetadata: { orderId: order.id, chargeId: charge.id },
  });

  logger.info('Conekta OXXO charge created', {
    action: 'conekta_oxxo_charge',
    orderId: order.id,
    amount,
  });

  return {
    orderId: order.id ?? '',
    chargeId: charge.id ?? '',
    barcodeUrl,
    reference,
    amount,
    expiresAt: new Date(expiresAt * 1000),
  };
}

// ── Charge Status ──

export async function getConektaChargeStatus(orderId: string): Promise<ConektaChargeStatus> {
  const ordersApi = await getConektaClient();
  const response = await ordersApi.getOrderById(orderId);
  const order = response.data;
  const charge = order.charges?.data?.[0];

  if (!charge) {
    throw new Error('Cargo no encontrado en Conekta');
  }

  const status = charge.status === 'paid'
    ? 'paid' as const
    : charge.status === 'expired'
      ? 'expired' as const
      : charge.status === 'pending_payment'
        ? 'pending' as const
        : 'failed' as const;

  return {
    id: charge.id ?? orderId,
    status,
    paidAt: status === 'paid' ? new Date((charge.paid_at ?? 0) * 1000) : null,
  };
}

// ── Connection Management ──

export async function connectConekta(params: {
  privateKey: string;
  publicKey: string;
  environment: 'sandbox' | 'production';
}): Promise<{ success: boolean; message: string }> {
  const { privateKey, publicKey, environment } = params;

  // Validate key by making a test request
  const config = new Configuration({ accessToken: privateKey });
  const ordersApi = new OrdersApi(config);

  try {
    // Test connectivity
    await ordersApi.getOrders();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    if (message.includes('401') || message.includes('authentication')) {
      return { success: false, message: 'API Key inválida. Verifica tus credenciales en panel.conekta.com' };
    }
    // Some 404s are OK for empty accounts
    if (!message.includes('404')) {
      logger.warn('Conekta connection test warning', { action: 'conekta_connect', error: message });
    }
  }

  const { encrypt } = await import('@/lib/crypto');

  // Upsert connection
  const existing = await db
    .select()
    .from(paymentProviderConnections)
    .where(
      and(
        eq(paymentProviderConnections.provider, 'conekta'),
        eq(paymentProviderConnections.storeId, 'main'),
      ),
    )
    .limit(1);

  const connectionData = {
    provider: 'conekta' as const,
    storeId: 'main',
    status: 'connected',
    accessTokenEnc: encrypt(privateKey),
    publicKey,
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

  logger.info('Conekta connected', { action: 'conekta_connect', environment });

  return { success: true, message: `Conekta conectado en modo ${environment}` };
}

export async function disconnectConekta(): Promise<void> {
  await db
    .update(paymentProviderConnections)
    .set({
      status: 'disconnected',
      accessTokenEnc: null,
      publicKey: null,
      disconnectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentProviderConnections.provider, 'conekta'),
        eq(paymentProviderConnections.storeId, 'main'),
      ),
    );

  logger.info('Conekta disconnected', { action: 'conekta_disconnect' });
}

export async function getConektaConnectionStatus(): Promise<{
  connected: boolean;
  environment: string | null;
  publicKey: string | null;
}> {
  const [connection] = await db
    .select()
    .from(paymentProviderConnections)
    .where(
      and(
        eq(paymentProviderConnections.provider, 'conekta'),
        eq(paymentProviderConnections.storeId, 'main'),
      ),
    )
    .limit(1);

  if (!connection || connection.status !== 'connected') {
    return { connected: false, environment: null, publicKey: null };
  }

  return {
    connected: true,
    environment: connection.environment,
    publicKey: connection.publicKey,
  };
}
