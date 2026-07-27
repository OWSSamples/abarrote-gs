import 'server-only';

import { db } from '@/db';
import { deliveryProviderConnections, deliveryOrders } from '@/db/schema-delivery';
import { eq, and } from 'drizzle-orm';
import { decrypt, encrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { assertActiveDeliveryPlugin } from '@/lib/plugins/delivery-plugins';
import { getDeliveryProvider, getDeliveryBreaker } from './delivery-registry';
import type { DeliveryOrder, DeliveryProvider, DeliveryProviderConnection } from './delivery-types';

// ── Connection helpers ────────────────────────────────────────

export async function getDeliveryConnection(
  storeId: string,
  provider: DeliveryProvider,
): Promise<DeliveryProviderConnection | null> {
  const [row] = await db
    .select()
    .from(deliveryProviderConnections)
    .where(
      and(
        eq(deliveryProviderConnections.storeId, storeId),
        eq(deliveryProviderConnections.provider, provider),
        eq(deliveryProviderConnections.status, 'connected'),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    storeId: row.storeId,
    provider: row.provider as DeliveryProvider,
    status: row.status as DeliveryProviderConnection['status'],
    accessTokenEnc: row.accessTokenEnc!,
    webhookSecretEnc: row.webhookSecretEnc ?? undefined,
    providerStoreId: row.providerStoreId,
    environment: row.environment as 'sandbox' | 'production',
    connectedAt: row.connectedAt!,
  };
}

// ── Connect / Disconnect ──────────────────────────────────────

export async function connectDeliveryProvider(params: {
  storeId: string;
  provider: DeliveryProvider;
  accessToken: string;
  webhookSecret?: string;
  providerStoreId: string;
  environment: 'sandbox' | 'production';
}): Promise<{ success: boolean; message: string; storeName?: string }> {
  const { storeId, provider, accessToken, webhookSecret, providerStoreId, environment } = params;

  const adapter = getDeliveryProvider(provider);
  const { valid, storeName } = await adapter.validateCredentials(accessToken, providerStoreId);

  if (!valid) {
    return { success: false, message: 'Credenciales invalidas. Verifica tu API Key y Store ID.' };
  }

  const data = {
    provider,
    storeId,
    status: 'connected' as const,
    accessTokenEnc: encrypt(accessToken),
    webhookSecretEnc: webhookSecret ? encrypt(webhookSecret) : null,
    providerStoreId,
    environment,
    connectedAt: new Date(),
    updatedAt: new Date(),
  };

  const existing = await db
    .select({ id: deliveryProviderConnections.id })
    .from(deliveryProviderConnections)
    .where(and(eq(deliveryProviderConnections.storeId, storeId), eq(deliveryProviderConnections.provider, provider)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(deliveryProviderConnections).set(data).where(eq(deliveryProviderConnections.id, existing[0].id));
  } else {
    const { randomUUID } = await import('crypto');
    await db.insert(deliveryProviderConnections).values({ id: randomUUID(), ...data });
  }

  logger.info('Delivery provider connected', { action: 'delivery_connect', provider, storeId, environment });
  return { success: true, message: `${provider} conectado correctamente`, storeName };
}

export async function disconnectDeliveryProvider(storeId: string, provider: DeliveryProvider): Promise<void> {
  await db
    .update(deliveryProviderConnections)
    .set({ status: 'disconnected', accessTokenEnc: null, webhookSecretEnc: null, updatedAt: new Date() })
    .where(and(eq(deliveryProviderConnections.storeId, storeId), eq(deliveryProviderConnections.provider, provider)));

  logger.info('Delivery provider disconnected', { action: 'delivery_disconnect', provider, storeId });
}

// ── Order persistence ─────────────────────────────────────────

export async function persistDeliveryOrder(order: DeliveryOrder): Promise<void> {
  await assertActiveDeliveryPlugin(order.storeId, order.provider);

  await db.insert(deliveryOrders).values({
    id: order.id,
    externalId: order.externalId,
    provider: order.provider,
    storeId: order.storeId,
    status: order.status,
    customerName: order.customer.name,
    customerPhone: order.customer.phone ?? null,
    customerAddress: order.customer.address,
    items: order.items,
    subtotal: order.subtotal.toFixed(2),
    deliveryFee: order.deliveryFee.toFixed(2),
    discount: order.discount.toFixed(2),
    total: order.total.toFixed(2),
    paymentMethod: order.paymentMethod,
    estimatedPrepMinutes: order.estimatedPrepMinutes ?? null,
    notes: order.notes ?? null,
    rawPayload: order.rawPayload,
    receivedAt: order.receivedAt,
  });
}

// ── Order actions (con circuit breaker) ──────────────────────

export async function acceptDeliveryOrder(
  orderId: string,
  storeId: string,
  provider: DeliveryProvider,
  prepMinutes: number = 20,
): Promise<void> {
  const connection = await getDeliveryConnection(storeId, provider);
  if (!connection) throw new Error(`No hay conexion activa con ${provider}`);

  const adapter = getDeliveryProvider(provider);
  const breaker = getDeliveryBreaker(provider);

  await breaker.execute(() => adapter.acceptOrder(orderId, prepMinutes, connection));

  await db
    .update(deliveryOrders)
    .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(deliveryOrders.externalId, orderId), eq(deliveryOrders.storeId, storeId)));
}

export async function rejectDeliveryOrder(
  orderId: string,
  storeId: string,
  provider: DeliveryProvider,
  reason: string,
): Promise<void> {
  const connection = await getDeliveryConnection(storeId, provider);
  if (!connection) throw new Error(`No hay conexion activa con ${provider}`);

  const adapter = getDeliveryProvider(provider);
  const breaker = getDeliveryBreaker(provider);

  await breaker.execute(() => adapter.rejectOrder(orderId, reason, connection));

  await db
    .update(deliveryOrders)
    .set({ status: 'rejected', cancellationReason: reason, cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(deliveryOrders.externalId, orderId), eq(deliveryOrders.storeId, storeId)));
}

export async function markDeliveryOrderReady(
  orderId: string,
  storeId: string,
  provider: DeliveryProvider,
): Promise<void> {
  const connection = await getDeliveryConnection(storeId, provider);
  if (!connection) throw new Error(`No hay conexion activa con ${provider}`);

  const adapter = getDeliveryProvider(provider);
  const breaker = getDeliveryBreaker(provider);

  await breaker.execute(() => adapter.markReady(orderId, connection));

  await db
    .update(deliveryOrders)
    .set({ status: 'ready', updatedAt: new Date() })
    .where(and(eq(deliveryOrders.externalId, orderId), eq(deliveryOrders.storeId, storeId)));
}

// ── Webhook secret resolver ───────────────────────────────────

export async function resolveWebhookSecret(storeId: string, provider: DeliveryProvider): Promise<string | null> {
  const [row] = await db
    .select({ webhookSecretEnc: deliveryProviderConnections.webhookSecretEnc })
    .from(deliveryProviderConnections)
    .where(and(eq(deliveryProviderConnections.storeId, storeId), eq(deliveryProviderConnections.provider, provider)))
    .limit(1);

  if (!row?.webhookSecretEnc) return null;
  return decrypt(row.webhookSecretEnc);
}
