import { cookies } from 'next/headers';
import { db } from '@/db';
import { stores, userStoreAccess } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { requireAuth, AuthError, type AuthenticatedUser } from '@/lib/auth/guard';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Store Scope (ADR-001 Phase 2)
// ══════════════════════════════════════════════════════════════
//
// Derives the active store id for the current request.
// Resolution order:
//   1. `__store_id` cookie (only honored if the user has access to it).
//   2. `is_default = true` row in `user_store_access`.
//   3. First row in `user_store_access` for the user.
//   4. Fallback to 'main' (single-tenant compatibility).
//
// Owners are auto-granted access to every active store on read so they can
// switch via the topbar without explicit provisioning.

const STORE_COOKIE = '__store_id';

export interface StoreScope {
  user: AuthenticatedUser;
  storeId: string;
}

async function listAccessibleStoreIds(user: AuthenticatedUser): Promise<{ storeId: string; isDefault: boolean }[]> {
  if (user.roleId === 'owner') {
    const rows = await db
      .select({ storeId: stores.id })
      .from(stores)
      .where(isNull(stores.deletedAt));
    return rows.map((r) => ({ storeId: r.storeId, isDefault: r.storeId === 'main' }));
  }

  return db
    .select({ storeId: userStoreAccess.storeId, isDefault: userStoreAccess.isDefault })
    .from(userStoreAccess)
    .where(eq(userStoreAccess.userId, user.uid));
}

/**
 * Returns the authenticated user along with the active store id.
 * Throws AuthError(403) if the user has no store access at all.
 */
export async function requireStoreScope(): Promise<StoreScope> {
  const user = await requireAuth();
  const accessible = await listAccessibleStoreIds(user);

  if (accessible.length === 0) {
    logger.warn('User has no store access', { action: 'store_scope_no_access', userId: user.uid });
    throw new AuthError('No tienes acceso a ninguna sucursal. Contacta al administrador.', 403);
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(STORE_COOKIE)?.value;
  const allowed = new Set(accessible.map((r) => r.storeId));

  if (cookieValue && allowed.has(cookieValue)) {
    return { user, storeId: cookieValue };
  }

  const defaultRow = accessible.find((r) => r.isDefault) ?? accessible[0];
  return { user, storeId: defaultRow.storeId };
}

/**
 * Grants a user access to a store. Idempotent.
 */
export async function grantStoreAccess(userId: string, storeId: string, isDefault = false): Promise<void> {
  await db
    .insert(userStoreAccess)
    .values({ userId, storeId, isDefault })
    .onConflictDoNothing();
}

/**
 * Returns true if the user has access to the given store.
 * Owners always pass.
 */
export async function userHasStoreAccess(user: AuthenticatedUser, storeId: string): Promise<boolean> {
  if (user.roleId === 'owner') return true;
  const [row] = await db
    .select({ storeId: userStoreAccess.storeId })
    .from(userStoreAccess)
    .where(and(eq(userStoreAccess.userId, user.uid), eq(userStoreAccess.storeId, storeId)))
    .limit(1);
  return row != null;
}
