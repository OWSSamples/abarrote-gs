'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { AuthError, requirePermission } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { AppError } from '@/lib/errors';
import { db } from '@/db';
import { deliveryProviderConnections } from '@/db/schema-delivery';
import { storeConfig, storePlugins } from '@/db/schema';
import {
  SYSTEM_PLUGIN_CATALOG,
  getSystemPlugin,
  type SystemPluginCategory,
  type SystemPluginStatus,
} from '@/lib/plugins/plugin-catalog';
import {
  getServiciosProviderPluginId,
  hasCompleteServiciosProviderCredentials,
} from '@/lib/plugins/system-service-plugins';
import { isMissingStorePluginsTable } from '@/lib/plugins/plugin-errors';
import { upsertStorePlugin } from '@/server/plugin-store-service';

export interface PluginStoreItem {
  id: string;
  providerId?: string;
  name: string;
  vendor: string;
  category: SystemPluginCategory;
  summary: string;
  description: string;
  installMode: 'oauth' | 'managed' | 'external';
  available: boolean;
  authorizePath?: string;
  docsUrl?: string;
  capabilities: string[];
  permissions: string[];
  status: SystemPluginStatus | 'not_installed';
  connected: boolean;
  installedAt?: string;
  updatedAt?: string;
}

function pluginStoreMigrationError(): AppError {
  return new AppError(
    'PLUGIN_STORE_MIGRATION_REQUIRED',
    'La tienda de plugins requiere aplicar la migración 0043_store_plugins antes de instalar o administrar plugins.',
    503,
  );
}

async function loadServiciosPluginConfig(storeId: string) {
  const [config] = await db
    .select({
      providerId: storeConfig.serviciosProvider,
      apiKey: storeConfig.serviciosApiKey,
      apiSecret: storeConfig.serviciosApiSecret,
    })
    .from(storeConfig)
    .where(eq(storeConfig.id, storeId))
    .limit(1);

  return {
    providerId: config?.providerId,
    apiKey: config?.apiKey,
    apiSecret: config?.apiSecret,
    pluginId: getServiciosProviderPluginId(config?.providerId),
    complete: hasCompleteServiciosProviderCredentials({
      providerId: config?.providerId,
      apiKey: config?.apiKey,
      apiSecret: config?.apiSecret,
    }),
  };
}

function toDateString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export async function fetchPluginStoreAction(): Promise<PluginStoreItem[]> {
  await requirePermission('settings.view');
  const { storeId } = await requireStoreScope();
  const pluginIds = SYSTEM_PLUGIN_CATALOG.map((plugin) => plugin.id);
  const deliveryProviderIds = SYSTEM_PLUGIN_CATALOG
    .filter((plugin) => plugin.category === 'delivery' && plugin.providerId)
    .map((plugin) => plugin.providerId!);

  let installedRows: {
    pluginId: string;
    status: string;
    installedAt: Date;
    updatedAt: Date;
  }[] = [];
  let deliveryRows: {
    provider: string;
    status: string;
  }[] = [];
  let configRows: {
    serviciosProvider: string;
    serviciosApiKey: string | null;
    serviciosApiSecret: string | null;
  }[] = [];

  try {
    [installedRows, deliveryRows, configRows] = await Promise.all([
      pluginIds.length > 0
        ? db
            .select({
              pluginId: storePlugins.pluginId,
              status: storePlugins.status,
              installedAt: storePlugins.installedAt,
              updatedAt: storePlugins.updatedAt,
            })
            .from(storePlugins)
            .where(and(eq(storePlugins.storeId, storeId), inArray(storePlugins.pluginId, pluginIds)))
        : Promise.resolve([]),
      deliveryProviderIds.length > 0
        ? db
            .select({
              provider: deliveryProviderConnections.provider,
              status: deliveryProviderConnections.status,
            })
            .from(deliveryProviderConnections)
            .where(
              and(
                eq(deliveryProviderConnections.storeId, storeId),
                inArray(deliveryProviderConnections.provider, deliveryProviderIds),
              ),
            )
        : Promise.resolve([]),
      db
        .select({
          serviciosProvider: storeConfig.serviciosProvider,
          serviciosApiKey: storeConfig.serviciosApiKey,
          serviciosApiSecret: storeConfig.serviciosApiSecret,
        })
        .from(storeConfig)
        .where(eq(storeConfig.id, storeId))
        .limit(1),
    ]);
  } catch (error) {
    if (!isMissingStorePluginsTable(error)) throw error;
  }

  const installedByPlugin = new Map(installedRows.map((row) => [row.pluginId, row]));
  const deliveryStatusByProvider = new Map(deliveryRows.map((row) => [row.provider, row.status]));
  const config = configRows[0];
  const activeServiciosPluginId = getServiciosProviderPluginId(config?.serviciosProvider);
  const serviciosConfigComplete = hasCompleteServiciosProviderCredentials({
    providerId: config?.serviciosProvider,
    apiKey: config?.serviciosApiKey,
    apiSecret: config?.serviciosApiSecret,
  });

  return SYSTEM_PLUGIN_CATALOG.map((plugin) => {
    const installed = installedByPlugin.get(plugin.id);
    const connected =
      plugin.category === 'delivery'
        ? deliveryStatusByProvider.get(plugin.providerId ?? '') === 'connected' && installed?.status === 'installed'
        : plugin.category === 'services'
          ? activeServiciosPluginId === plugin.id && serviciosConfigComplete && installed?.status === 'installed'
          : installed?.status === 'installed';
    const status =
      plugin.category === 'services' && installed?.status === 'installed' && !connected
        ? 'configuring'
        : ((installed?.status as SystemPluginStatus | undefined) ?? 'not_installed');

    return {
      ...plugin,
      available:
        plugin.available ||
        (plugin.category === 'services' && activeServiciosPluginId === plugin.id && serviciosConfigComplete),
      status,
      connected,
      installedAt: toDateString(installed?.installedAt),
      updatedAt: toDateString(installed?.updatedAt),
    };
  });
}

export async function installPluginAction(pluginId: string): Promise<{ success: true; authorizeUrl?: string }> {
  const user = await requirePermission('settings.edit');
  const { storeId } = await requireStoreScope();
  const plugin = getSystemPlugin(pluginId);

  if (!plugin) {
    throw new AuthError('Plugin no encontrado.', 404);
  }
  const serviciosConfig = plugin.category === 'services' ? await loadServiciosPluginConfig(storeId) : null;
  const canInstallFromExistingConfig =
    plugin.category === 'services' && serviciosConfig?.pluginId === plugin.id && serviciosConfig.complete;

  if (!plugin.available && !canInstallFromExistingConfig) {
    throw new AuthError('Este plugin todavía no está disponible para instalación.', 409);
  }

  if (plugin.installMode === 'oauth') {
    if (!plugin.authorizePath) {
      throw new AuthError('El plugin no tiene flujo de autorización configurado.', 409);
    }
    return { success: true, authorizeUrl: `${plugin.authorizePath}?store=${encodeURIComponent(storeId)}` };
  }

  try {
    await upsertStorePlugin({
      storeId,
      pluginId: plugin.id,
      category: plugin.category,
      providerId: plugin.providerId,
      installedBy: user.uid,
      status: canInstallFromExistingConfig ? 'installed' : 'configuring',
      metadata: canInstallFromExistingConfig
        ? { source: 'existing_store_config', providerId: serviciosConfig?.providerId }
        : undefined,
    });
  } catch (error) {
    if (isMissingStorePluginsTable(error)) throw pluginStoreMigrationError();
    throw error;
  }

  revalidatePath('/dashboard/apps');
  return { success: true };
}

export async function uninstallPluginAction(pluginId: string): Promise<{ success: true }> {
  await requirePermission('settings.edit');
  const { storeId } = await requireStoreScope();
  const plugin = getSystemPlugin(pluginId);

  if (!plugin) {
    throw new AuthError('Plugin no encontrado.', 404);
  }

  try {
    await db
      .update(storePlugins)
      .set({
        status: 'disabled',
        disabledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.pluginId, plugin.id)));
  } catch (error) {
    if (isMissingStorePluginsTable(error)) throw pluginStoreMigrationError();
    throw error;
  }

  if (plugin.category === 'delivery' && plugin.providerId) {
    await db
      .update(deliveryProviderConnections)
      .set({
        status: 'disconnected',
        accessTokenEnc: null,
        webhookSecretEnc: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deliveryProviderConnections.storeId, storeId),
          eq(deliveryProviderConnections.provider, plugin.providerId),
        ),
      );
  }

  revalidatePath('/dashboard/apps');
  return { success: true };
}
