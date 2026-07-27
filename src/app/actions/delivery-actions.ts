'use server';

import { db } from '@/db';
import { deliveryOrders, deliveryProviderConnections } from '@/db/schema-delivery';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  connectDeliveryProvider,
  disconnectDeliveryProvider,
  acceptDeliveryOrder,
  rejectDeliveryOrder,
  markDeliveryOrderReady,
} from '@/infrastructure/delivery/delivery-service';
import type { DeliveryProvider } from '@/infrastructure/delivery/delivery-types';
import { AuthError, requirePermission } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';

async function requireActiveStore(storeId: string) {
  const scope = await requireStoreScope();
  if (scope.storeId !== storeId) {
    throw new AuthError('No tienes permisos para operar este negocio.', 403);
  }
  return scope;
}

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
    await requirePermission('settings.view');
    await requireActiveStore(params.storeId);
    const result = await connectDeliveryProvider(params);
    return result;
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

export async function disconnectDeliveryProviderAction(storeId: string, provider: DeliveryProvider) {
  try {
    await requirePermission('settings.view');
    await requireActiveStore(storeId);
    await disconnectDeliveryProvider(storeId, provider);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

export async function getDeliveryConnectionStatusAction(storeId: string) {
  await requirePermission('settings.view');
  await requireActiveStore(storeId);

  const [rows, orderStats] = await Promise.all([
    db
      .select({
        provider: deliveryProviderConnections.provider,
        status: deliveryProviderConnections.status,
        providerStoreId: deliveryProviderConnections.providerStoreId,
        environment: deliveryProviderConnections.environment,
        connectedAt: deliveryProviderConnections.connectedAt,
        updatedAt: deliveryProviderConnections.updatedAt,
      })
      .from(deliveryProviderConnections)
      .where(eq(deliveryProviderConnections.storeId, storeId)),
    db
      .select({
        provider: deliveryOrders.provider,
        totalOrders: sql<number>`count(*)`,
        pendingOrders: sql<number>`count(*) filter (where ${deliveryOrders.status} = 'pending')`,
        activeOrders: sql<number>`count(*) filter (where ${deliveryOrders.status} in ('pending', 'accepted', 'preparing', 'ready'))`,
        latestOrderAt: sql<Date | null>`max(${deliveryOrders.receivedAt})`,
      })
      .from(deliveryOrders)
      .where(eq(deliveryOrders.storeId, storeId))
      .groupBy(deliveryOrders.provider),
  ]);

  const statsByProvider = new Map(
    orderStats.map((stat) => [
      stat.provider,
      {
        totalOrders: Number(stat.totalOrders) || 0,
        pendingOrders: Number(stat.pendingOrders) || 0,
        activeOrders: Number(stat.activeOrders) || 0,
        latestOrderAt: stat.latestOrderAt,
      },
    ]),
  );

  return rows.map((row) => ({
    ...row,
    ...(statsByProvider.get(row.provider) ?? {
      totalOrders: 0,
      pendingOrders: 0,
      activeOrders: 0,
      latestOrderAt: null,
    }),
  }));
}

// ── Pedidos ───────────────────────────────────────────────────

export async function getDeliveryOrdersAction(storeId: string, status?: string) {
  await requirePermission('sales.view');
  await requireActiveStore(storeId);

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
    await requirePermission('sales.create');
    await requireActiveStore(storeId);
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
    await requirePermission('sales.create');
    await requireActiveStore(storeId);
    await rejectDeliveryOrder(orderId, storeId, provider, reason);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error al rechazar pedido' };
  }
}

export async function markDeliveryOrderReadyAction(orderId: string, storeId: string, provider: DeliveryProvider) {
  try {
    await requirePermission('sales.create');
    await requireActiveStore(storeId);
    await markDeliveryOrderReady(orderId, storeId, provider);
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Error al marcar como listo' };
  }
}
