import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { storePlugins } from '@/db/schema';
import { isMissingStorePluginsTable } from '@/lib/plugins/plugin-errors';

export const SERVICIOS_PLUGIN_FEATURE = 'servicios-y-recargas';

export type ServiciosPluginProviderId = 'turecarga' | 'infopago' | 'billpocket';

const SERVICIOS_PROVIDER_PLUGIN_IDS: Record<ServiciosPluginProviderId, string> = {
  turecarga: 'plugin.servicios.turecarga',
  infopago: 'plugin.servicios.infopago',
  billpocket: 'plugin.servicios.billpocket',
};

export interface ServiciosPluginConfig {
  providerId?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
}

export function getServiciosProviderPluginId(providerId?: string | null): string | null {
  if (!providerId) return null;
  return SERVICIOS_PROVIDER_PLUGIN_IDS[providerId as ServiciosPluginProviderId] ?? null;
}

export function hasCompleteServiciosProviderCredentials(config: ServiciosPluginConfig): boolean {
  const hasApiKey = typeof config.apiKey === 'string' && config.apiKey.trim().length > 0;
  const hasApiSecret = typeof config.apiSecret === 'string' && config.apiSecret.trim().length > 0;

  if (config.providerId === 'infopago') return hasApiKey;
  return hasApiKey && hasApiSecret;
}

export async function hasActiveServiciosPlugin(storeId: string, config: ServiciosPluginConfig): Promise<boolean> {
  const pluginId = getServiciosProviderPluginId(config.providerId);
  if (!pluginId || !hasCompleteServiciosProviderCredentials(config)) return false;

  let row: { id: string } | undefined;
  try {
    [row] = await db
      .select({ id: storePlugins.id })
      .from(storePlugins)
      .where(
        and(
          eq(storePlugins.storeId, storeId),
          eq(storePlugins.pluginId, pluginId),
          eq(storePlugins.status, 'installed'),
        ),
      )
      .limit(1);
  } catch (error) {
    if (isMissingStorePluginsTable(error)) return false;
    throw error;
  }

  return Boolean(row);
}

export async function assertActiveServiciosPlugin(storeId: string, config: ServiciosPluginConfig): Promise<void> {
  if (await hasActiveServiciosPlugin(storeId, config)) return;

  throw new Error(
    'El plugin del proveedor de servicios no está instalado o no está configurado para este negocio.',
  );
}
