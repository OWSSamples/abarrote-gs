import 'server-only';

import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { storePlugins } from '@/db/schema';
import type { SystemPluginCategory, SystemPluginStatus } from '@/lib/plugins/plugin-catalog';

export async function upsertStorePlugin(params: {
  storeId: string;
  pluginId: string;
  category: SystemPluginCategory;
  providerId?: string;
  installedBy?: string | null;
  status?: SystemPluginStatus;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date();
  const status = params.status ?? 'installed';

  await db
    .insert(storePlugins)
    .values({
      id: `plugin-${randomUUID()}`,
      storeId: params.storeId,
      pluginId: params.pluginId,
      category: params.category,
      providerId: params.providerId ?? null,
      installedBy: params.installedBy ?? null,
      status,
      installedAt: now,
      configuredAt: status === 'installed' ? now : null,
      disabledAt: null,
      metadata: params.metadata ?? {},
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [storePlugins.storeId, storePlugins.pluginId],
      set: {
        category: params.category,
        providerId: params.providerId ?? null,
        status,
        configuredAt: status === 'installed' ? now : null,
        disabledAt: null,
        metadata: params.metadata ?? {},
        updatedAt: now,
        installedBy: sql`COALESCE(${storePlugins.installedBy}, ${params.installedBy ?? null})`,
      },
    });
}
