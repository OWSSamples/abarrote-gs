'use server';

import { db } from '@/db';
import { deliveryOrders, deliveryProviderConnections } from '@/db/schema-delivery';
import { eq, and, desc } from 'drizzle-orm';
import {
  connectDeliveryProvider,
  disconnectDeliveryProvider,
  acceptDeliveryOrder,
  rejectDeliveryOrder,
  markDeliveryOrderReady,
} from '@/infrastructure/delivery/delivery-service';
import type { DeliveryProvider } from '@/infrastructure/delivery/delivery-types';

// ── Conexion ──────────────────────────────────────────────────────

// ── Conexion ──────────────────────────────────────────────────

export async function connectDeliveryProviderAction(params: {
  storeId: string;
  provider: DeliveryProvider;
  accessToken: string;
  webhookSecret?: string;
  providerStoreId: string;
  environment: 'sandbox' | 'production';
}) {
  try {
    const result = await connectDeliveryProvider(params);
    return result;
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

export async function disconnectDeliveryProviderAction(storeId: string, provider: DeliveryProvider) {
  try {
    await disconnectDeliveryProvider(storeId, provider);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

export async function getDeliveryConnectionStatusAction(storeId: string) {
  const rows = await db
    .select({
      provider: deliveryProviderConnections.provider,
      status: deliveryProviderConnections.status,
      providerStoreId: deliveryProviderConnections.providerStoreId,
      environment: deliveryProviderConnections.environment,
      connectedAt: deliveryProviderConnections.connectedAt,
    })
    .from(deliveryProviderConnections)
    .where(eq(deliveryProviderConnections.storeId, storeId));

  return rows;
}

// ── Pedidos ───────────────────────────────────────────────────

export async function getDeliveryOrdersAction(storeId: string, status?: string) {
  const conditions = [eq(deliveryOrders.storeId, storeId)];
  if (status) conditions.push(eq(deliveryOrders.status, status));

  return db
    .select()
    .from(deliveryOrders)
    .where(and(...conditions))
    .orderBy(desc(deliveryOrders.receivedAt))
    .limit(50);
}

export async function acceptDeliveryOrderAction(
  orderId: string,
  storeId: string,
  provider: DeliveryProvider,
  prepMinutes?: number,
) {
  try {
    await acceptDeliveryOrder(orderId, storeId, provider, prepMinutes);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error al aceptar pedido' };
  }
}

export async function rejectDeliveryOrderAction(
  orderId: string,
  storeId: string,
  provider: DeliveryProvider,
  reason: string,
) {
  try {
    await rejectDeliveryOrder(orderId, storeId, provider, reason);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error al rechazar pedido' };
  }
}

export async function markDeliveryOrderReadyAction(
  orderId: string,
  storeId: string,
  provider: DeliveryProvider,
) {
  try {
    await markDeliveryOrderReady(orderId, storeId, provider);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error al marcar como listo' };
  }
}
