import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { stores } from '@/db/schema';

export async function isTenantActive(storeId: string): Promise<boolean> {
  const [tenant] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(
      and(
        eq(stores.id, storeId),
        eq(stores.status, 'active'),
        isNull(stores.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(tenant);
}
