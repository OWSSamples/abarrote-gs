import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { storePlugins } from '@/db/schema';
import { isMissingStorePluginsTable } from '@/lib/plugins/plugin-errors';
import type { DeliveryProvider } from '@/infrastructure/delivery/delivery-types';

const DELIVERY_PROVIDER_PLUGIN_IDS: Record<DeliveryProvider, string> = {
  rappi: 'plugin.delivery.rappi',
  ubereats: 'plugin.delivery.ubereats',
};

export function getDeliveryProviderPluginId(provider: DeliveryProvider): string {
  return DELIVERY_PROVIDER_PLUGIN_IDS[provider];
}

export async function hasActiveDeliveryPlugin(storeId: string, provider: DeliveryProvider): Promise<boolean> {
  let plugin: { id: string } | undefined;
  try {
    [plugin] = await db
      .select({ id: storePlugins.id })
      .from(storePlugins)
      .where(
        and(
          eq(storePlugins.storeId, storeId),
          eq(storePlugins.pluginId, getDeliveryProviderPluginId(provider)),
          eq(storePlugins.status, 'installed'),
        ),
      )
      .limit(1);
  } catch (error) {
    if (isMissingStorePluginsTable(error)) return false;
    throw error;
  }

  return Boolean(plugin);
}

export async function assertActiveDeliveryPlugin(storeId: string, provider: DeliveryProvider): Promise<void> {
  if (await hasActiveDeliveryPlugin(storeId, provider)) return;

  throw new Error('El plugin de delivery no está instalado o no está conectado para este negocio.');
}
