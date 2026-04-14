'use server';

import crypto from 'crypto';
import { db } from '@/db';
import { paymentProviderConnections, paymentCharges, storeConfig as storeConfigTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { clipBreaker } from '@/infrastructure/circuit-breaker';
import { env, getAppUrl } from '@/lib/env';

// ── Constants ──

const CLIP_CHECKOUT_BASE = 'https://api.payclip.com/v2/checkout';
const CLIP_PINPAD_BASE = 'https://api.payclip.io/f2f/pinpad/v1';

// ── Types ──

export interface ClipCheckoutResult {
  paymentRequestId: string;
  paymentUrl: string;
  amount: number;
  status: string;
  referenceNumber: string;
}

export interface ClipTerminalResult {
  pinpadRequestId: string;
  amount: number;
  serialNumber: string;
  status: string;
  referenceNumber: string;
}

export interface ClipChargeStatus {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  paidAt: Date | null;
}

interface ClipCheckoutResponse {
  payment_request_id: string;
  payment_url: string;
  status: string;
}

interface ClipCheckoutStatusResponse {
  payment_request_id: string;
  status: string;
  amount: number;
  currency: string;
  payment_method: string;
  approved_at?: string;
}

interface ClipPinpadResponse {
  pinpad_request_id: string;
  reference: string;
  amount: string;
  status: string;
}

interface ClipPinpadStatusResponse {
  pinpad_request_id: string;
  reference: string;
  amount: string;
  amount_paid: string;
  status: string;
  create_date: string;
}

// ── Auth Token Factory ──

async function getClipAuthToken(): Promise<string> {
  const [connection] = await db
    .select()
    .from(paymentProviderConnections)
    .where(
      and(
        eq(paymentProviderConnections.provider, 'clip'),
        eq(paymentProviderConnections.storeId, 'main'),
        eq(paymentProviderConnections.status, 'connected'),
      ),
    )
    .limit(1);

  let apiKey: string;
  let secretKey: string;

  if (connection?.accessTokenEnc && connection?.publicKey) {
    // accessTokenEnc stores the encrypted secret key; publicKey stores the API key
    secretKey = decrypt(connection.accessTokenEnc);
    apiKey = connection.publicKey;
  } else if (env.CLIP_API_KEY && env.CLIP_SECRET_KEY) {
    apiKey = env.CLIP_API_KEY;
    secretKey = env.CLIP_SECRET_KEY;
  } else {
    throw new Error('Clip no configurado. Agrega tus credenciales en Configuración → Pagos.');
  }

  // Clip requires Basic auth: base64(apiKey:secretKey)
  const token = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
  return `Basic ${token}`;
}

async function getClipSerialNumber(): Promise<string | null> {
  const [connection] = await db
    .select()
    .from(paymentProviderConnections)
    .where(
      and(
        eq(paymentProviderConnections.provider, 'clip'),
        eq(paymentProviderConnections.storeId, 'main'),
        eq(paymentProviderConnections.status, 'connected'),
      ),
    )
    .limit(1);

  const metadata = connection?.providerMetadata as Record<string, unknown> | null;
  return (metadata?.serialNumber as string) ?? env.CLIP_SERIAL_NUMBER ?? null;
}

// ── Checkout (Payment Link) ──

export async function createClipCheckoutCharge(params: {
  amount: number;
  description: string;
  saleReference: string;
  successUrl?: string;
  errorUrl?: string;
}): Promise<ClipCheckoutResult> {
  return clipBreaker.execute(async () => {
    const { amount, description, saleReference } = params;
    const authToken = await getClipAuthToken();

    const appBaseUrl = getAppUrl();

    const successUrl =
      params.successUrl ?? `${appBaseUrl}/dashboard?clip_payment=success&ref=${encodeURIComponent(saleReference)}`;
    const errorUrl =
      params.errorUrl ?? `${appBaseUrl}/dashboard?clip_payment=error&ref=${encodeURIComponent(saleReference)}`;

    const body = {
      amount,
      currency: 'MXN',
      purchase_description: (description || 'Venta POS').substring(0, 250),
      redirection_url: {
        success: successUrl,
        error: errorUrl,
        default: `${appBaseUrl}/dashboard`,
      },
      metadata: {
        external_reference: saleReference,
        customer_info: { source: 'abarrote-gs-pos' },
      },
      webhook_url: `${appBaseUrl}/api/webhooks/clip`,
    };

    const response = await fetch(CLIP_CHECKOUT_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error('Clip checkout creation failed', {
        action: 'clip_checkout_error',
        statusCode: response.status,
        error: errorText.substring(0, 500),
      });
      throw new Error(`Error al crear link de pago Clip (HTTP ${response.status})`);
    }

    const data = (await response.json()) as ClipCheckoutResponse;

    const referenceNumber = `CL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    await db.insert(paymentCharges).values({
      id: crypto.randomUUID(),
      provider: 'clip',
      providerChargeId: data.payment_request_id,
      saleId: null,
      storeId: 'main',
      amount: amount.toFixed(2),
      currency: 'MXN',
      paymentMethod: 'tarjeta_clip',
      status: 'pending',
      referenceNumber,
      expiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000), // default 3 days
      providerMetadata: {
        paymentRequestId: data.payment_request_id,
        paymentUrl: data.payment_url,
      },
    });

    logger.info('Clip checkout charge created', {
      action: 'clip_checkout_charge',
      paymentRequestId: data.payment_request_id,
      amount,
    });

    return {
      paymentRequestId: data.payment_request_id,
      paymentUrl: data.payment_url,
      amount,
      status: data.status,
      referenceNumber,
    };
  }); // clipBreaker.execute end
}

// ── PinPad Terminal Payment ──

export async function createClipTerminalCharge(params: {
  amount: number;
  saleReference: string;
  serialNumber?: string;
  webhookUrl?: string;
}): Promise<ClipTerminalResult> {
  return clipBreaker.execute(async () => {
    const { amount, saleReference } = params;
    const authToken = await getClipAuthToken();

    const serialNumber = params.serialNumber ?? (await getClipSerialNumber());
    if (!serialNumber) {
      throw new Error(
        'No se configuró el número de serie del lector Clip. ' + 'Configúralo en Configuración → Pagos → Clip.',
      );
    }

    const appBaseUrl = getAppUrl();

    const body = {
      amount: Number(amount.toFixed(2)),
      reference: saleReference,
      serial_number_pos: serialNumber,
      webhook_url: params.webhookUrl ?? `${appBaseUrl}/api/webhooks/clip`,
      preferences: {
        is_auto_return_enabled: true,
        is_tip_enabled: false,
        is_msi_enabled: false,
        is_mci_enabled: false,
        is_dcc_enabled: false,
        is_retry_enabled: true,
        is_share_enabled: false,
        is_auto_print_receipt_enabled: false,
        is_split_payment_enabled: false,
      },
    };

    const response = await fetch(`${CLIP_PINPAD_BASE}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error('Clip PinPad payment failed', {
        action: 'clip_pinpad_error',
        statusCode: response.status,
        error: errorText.substring(0, 500),
      });
      throw new Error(`Error al crear pago en terminal Clip (HTTP ${response.status})`);
    }

    const data = (await response.json()) as ClipPinpadResponse;

    const referenceNumber = `CT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    await db.insert(paymentCharges).values({
      id: crypto.randomUUID(),
      provider: 'clip',
      providerChargeId: data.pinpad_request_id,
      saleId: null,
      storeId: 'main',
      amount: amount.toFixed(2),
      currency: 'MXN',
      paymentMethod: 'clip_terminal',
      status: 'pending',
      referenceNumber,
      providerMetadata: {
        pinpadRequestId: data.pinpad_request_id,
        serialNumber,
        reference: saleReference,
      },
    });

    logger.info('Clip terminal charge created', {
      action: 'clip_terminal_charge',
      pinpadRequestId: data.pinpad_request_id,
      amount,
      serialNumber: serialNumber.substring(0, 4) + '***',
    });

    return {
      pinpadRequestId: data.pinpad_request_id,
      amount,
      serialNumber,
      status: data.status ?? 'PENDING',
      referenceNumber,
    };
  }); // clipBreaker.execute end
}

// ── Charge Status ──

export async function getClipCheckoutStatus(paymentRequestId: string): Promise<ClipChargeStatus> {
  return clipBreaker.execute(async () => {
    const authToken = await getClipAuthToken();

    const response = await fetch(`${CLIP_CHECKOUT_BASE}/${encodeURIComponent(paymentRequestId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Error al consultar estado de pago Clip (HTTP ${response.status})`);
    }

    const data = (await response.json()) as ClipCheckoutStatusResponse;

    const status = mapClipStatus(data.status);

    return {
      id: data.payment_request_id,
      status,
      paidAt: status === 'paid' && data.approved_at ? new Date(data.approved_at) : null,
    };
  }); // clipBreaker.execute end
}

export async function getClipTerminalStatus(pinpadRequestId: string): Promise<ClipChargeStatus> {
  return clipBreaker.execute(async () => {
    const authToken = await getClipAuthToken();

    const response = await fetch(`${CLIP_PINPAD_BASE}/payment?pinpadRequestId=${encodeURIComponent(pinpadRequestId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authToken,
        'Pinpad-Include-Detail': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al consultar estado de pago PinPad Clip (HTTP ${response.status})`);
    }

    const data = (await response.json()) as ClipPinpadStatusResponse;

    const status = mapClipPinpadStatus(data.status);

    return {
      id: data.pinpad_request_id,
      status,
      paidAt: status === 'paid' ? new Date(data.create_date) : null,
    };
  }); // clipBreaker.execute end
}

// ── Connection Management ──

export async function connectClip(params: {
  apiKey: string;
  secretKey: string;
  serialNumber?: string;
  environment: 'sandbox' | 'production';
}): Promise<{ success: boolean; message: string }> {
  const { apiKey, secretKey, serialNumber, environment } = params;

  // Validate by making a "health check" — attempt to list devices
  const token = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
  try {
    const response = await fetch(`${CLIP_PINPAD_BASE}/devices/status`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${token}`,
      },
    });
    // 401 = bad credentials. Other codes may be valid (e.g. 404 if no devices)
    if (response.status === 401 || response.status === 403) {
      return { success: false, message: 'Credenciales Clip inválidas. Verifica tu API Key y Clave Secreta.' };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    logger.warn('Clip connection test warning', { action: 'clip_connect', error: message });
  }

  const { encrypt } = await import('@/lib/crypto');

  const existing = await db
    .select()
    .from(paymentProviderConnections)
    .where(and(eq(paymentProviderConnections.provider, 'clip'), eq(paymentProviderConnections.storeId, 'main')))
    .limit(1);

  const connectionData = {
    provider: 'clip' as const,
    storeId: 'main',
    status: 'connected',
    accessTokenEnc: encrypt(secretKey),
    publicKey: apiKey,
    environment,
    providerMetadata: serialNumber ? { serialNumber } : {},
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

  logger.info('Clip connected', { action: 'clip_connect', environment, hasSerialNumber: !!serialNumber });

  // Update storeConfig flag + invalidate cache
  await db.update(storeConfigTable).set({ clipEnabled: true, updatedAt: new Date() }).where(eq(storeConfigTable.id, 'main'));
  const { cache } = await import('@/infrastructure/redis');
  await cache.invalidatePattern('config:');

  return { success: true, message: `Clip conectado en modo ${environment}` };
}

export async function disconnectClip(): Promise<void> {
  const now = new Date();
  await db
    .update(paymentProviderConnections)
    .set({
      status: 'disconnected',
      accessTokenEnc: null,
      publicKey: null,
      providerMetadata: {},
      disconnectedAt: now,
      updatedAt: now,
    })
    .where(and(eq(paymentProviderConnections.provider, 'clip'), eq(paymentProviderConnections.storeId, 'main')));

  // Clear storeConfig flag + invalidate cache
  await db.update(storeConfigTable).set({ clipEnabled: false, updatedAt: now }).where(eq(storeConfigTable.id, 'main'));
  const { cache } = await import('@/infrastructure/redis');
  await cache.invalidatePattern('config:');

  logger.info('Clip disconnected', { action: 'clip_disconnect' });
}

export async function getClipConnectionStatus(): Promise<{
  connected: boolean;
  environment: string | null;
  apiKey: string | null;
  serialNumber: string | null;
}> {
  const [connection] = await db
    .select()
    .from(paymentProviderConnections)
    .where(and(eq(paymentProviderConnections.provider, 'clip'), eq(paymentProviderConnections.storeId, 'main')))
    .limit(1);

  if (!connection || connection.status !== 'connected') {
    return { connected: false, environment: null, apiKey: null, serialNumber: null };
  }

  const metadata = connection.providerMetadata as Record<string, unknown> | null;
  return {
    connected: true,
    environment: connection.environment,
    apiKey: connection.publicKey,
    serialNumber: (metadata?.serialNumber as string) ?? null,
  };
}

// ── Helpers ──

function mapClipStatus(status: string): 'pending' | 'paid' | 'expired' | 'failed' {
  const normalized = status.toUpperCase();
  if (normalized === 'APPROVED' || normalized === 'PAID' || normalized === 'COMPLETED') return 'paid';
  if (normalized === 'EXPIRED' || normalized === 'CANCELED' || normalized === 'CANCELLED') return 'expired';
  if (normalized === 'DECLINED' || normalized === 'REJECTED' || normalized === 'FAILED') return 'failed';
  return 'pending';
}

function mapClipPinpadStatus(status: string): 'pending' | 'paid' | 'expired' | 'failed' {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'APPROVED') return 'paid';
  if (normalized === 'CANCELED' || normalized === 'CANCELLED' || normalized === 'EXPIRED') return 'expired';
  if (normalized === 'DECLINED' || normalized === 'REJECTED' || normalized === 'FAILED') return 'failed';
  return 'pending';
}
