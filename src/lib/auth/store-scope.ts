import { cache } from 'react';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { roleDefinitions, stores, userRoles } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { requireAuth, AuthError, type AuthenticatedUser } from '@/lib/auth/guard';
import { logger } from '@/lib/logger';
import type { PermissionKey } from '@/types';

// ══════════════════════════════════════════════════════════════
// Store Scope (ADR-001 Phase 2)
// ══════════════════════════════════════════════════════════════
//
// Derives the active store id for the current request.
// Resolution order:
//   1. `__store_id` cookie (only honored if the user has access to it).
//   2. `is_default = true` tenant membership.
//   3. First active membership for the user.
// No implicit fallback is allowed. A valid Cognito identity without an active
// membership is authenticated, but has no tenant access.
//
// Every user, including owners, always needs an explicit assignment. This
// prevents an unprovisioned identity from seeing a legacy `main` tenant.

const STORE_COOKIE = '__store_id';

export interface StoreScope {
  user: AuthenticatedUser;
  storeId: string;
  accessibleStores: AccessibleStore[];
}

export interface AccessibleStore {
  id: string;
  name: string;
  isDefault: boolean;
}

interface AccessibleMembership extends AccessibleStore {
  membershipId: string;
  roleId: string;
  roleName: string | null;
  permissions: string | null;
  displayName: string;
}

function parsePermissions(value: string | null): PermissionKey[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as PermissionKey[] : [];
  } catch {
    return [];
  }
}

async function listAccessibleMemberships(user: AuthenticatedUser): Promise<AccessibleMembership[]> {
  const rows = await db
    .select({
      id: stores.id,
      name: stores.name,
      isDefault: userRoles.isDefault,
      membershipId: userRoles.id,
      roleId: userRoles.roleId,
      roleName: roleDefinitions.name,
      permissions: roleDefinitions.permissions,
      displayName: userRoles.displayName,
    })
    .from(userRoles)
    .innerJoin(stores, eq(stores.id, userRoles.storeId))
    .leftJoin(roleDefinitions, eq(roleDefinitions.id, userRoles.roleId))
    .where(
      and(
        eq(userRoles.cognitoSub, user.uid),
        eq(userRoles.status, 'activo'),
        eq(stores.status, 'active'),
        isNull(stores.deletedAt),
      ),
    );

  return rows.sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, 'es'),
  );
}

export async function listAccessibleStores(user: AuthenticatedUser): Promise<AccessibleStore[]> {
  const memberships = await listAccessibleMemberships(user);
  return memberships.map(({ id, name, isDefault }) => ({ id, name, isDefault }));
}

/**
 * Returns the authenticated user along with the active store id.
 * Throws AuthError(403) if the user has no store access at all.
 */
const resolveStoreScope = cache(async (): Promise<StoreScope> => {
  const user = await requireAuth();
  const memberships = await listAccessibleMemberships(user);

  if (memberships.length === 0) {
    logger.warn('User has no store access', { action: 'store_scope_no_access', userId: user.uid });
    throw new AuthError('No tienes acceso a ningún negocio. Completa el registro o contacta al administrador.', 403);
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(STORE_COOKIE)?.value;
  const selected = (cookieValue ? memberships.find((membership) => membership.id === cookieValue) : undefined)
    ?? memberships.find((membership) => membership.isDefault)
    ?? memberships[0];
  if (!selected?.roleName) {
    logger.error('Tenant membership has no valid role', {
      action: 'store_scope_invalid_role',
      userId: user.uid,
      storeId: selected?.id,
    });
    throw new AuthError('Tu acceso al negocio no tiene un rol válido. Contacta al administrador.', 403);
  }
  const accessibleStores = memberships.map(({ id, name, isDefault }) => ({ id, name, isDefault }));
  const tenantUser: AuthenticatedUser = {
    ...user,
    roleId: selected.roleId,
    roleName: selected.roleName ?? undefined,
    permissions: parsePermissions(selected.permissions),
    displayName: selected.displayName || user.displayName,
  };

  return { user: tenantUser, storeId: selected.id, accessibleStores };
});

export async function requireStoreScope(): Promise<StoreScope> {
  return resolveStoreScope();
}

/**
 * Returns true if the user has access to the given store.
 * Access is always derived from an explicit tenant assignment.
 */
export async function userHasStoreAccess(user: AuthenticatedUser, storeId: string): Promise<boolean> {
  const accessible = await listAccessibleStores(user);
  return accessible.some((store) => store.id === storeId);
}
