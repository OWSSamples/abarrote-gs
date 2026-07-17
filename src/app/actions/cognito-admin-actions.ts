'use server';

import { AuthError, requirePermission, requireOwner } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import {
  listAllCognitoUsers,
  getCognitoUser,
  adminResetUserPassword,
  adminSetUserPassword,
  updateCognitoUserAttributes,
  globalSignOutUser,
  bulkGlobalSignOut,
  adminSetUserMfaPreference,
  type CognitoUserSummary,
  type CognitoGroup,
  type BulkOperationResult,
} from '@/lib/cognito-admin';
import { deactivateUser, reactivateUser } from '@/app/actions/role-actions';
import { db } from '@/db';
import { userIdentities, userRoles, auditLogs, roleDefinitions, userStoreAccess } from '@/db/schema';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { withLogging } from '@/lib/errors';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface CognitoUserEnriched extends CognitoUserSummary {
  hasDbRole: boolean;
  dbRoleId?: string;
  dbRoleName?: string;
  dbStatus?: string;
  groups: string[];
}

export interface CognitoUsersListResult {
  users: CognitoUserEnriched[];
  nextToken?: string;
  total: number;
}

async function hasActiveMembershipOutside(cognitoSub: string, storeId: string): Promise<boolean> {
  const [membership] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.cognitoSub, cognitoSub),
        eq(userRoles.status, 'activo'),
        ne(userRoles.storeId, storeId),
      ),
    )
    .limit(1);
  return Boolean(membership);
}

async function assertIdentityIsTenantExclusive(cognitoSub: string, storeId: string): Promise<void> {
  if (await hasActiveMembershipOutside(cognitoSub, storeId)) {
    throw new AuthError(
      'Esta identidad pertenece a varios negocios. La seguridad global de la cuenta solo puede modificarla el propio usuario.',
      409,
    );
  }
}

interface AuditEntry {
  id: string;
  storeId: string;
  userId: string;
  userEmail: string;
  action: string;
  entity: string;
  entityId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
}

interface TenantCognitoUser extends CognitoUserSummary {
  tenantRoleName?: string;
}

function audit(
  admin: { uid: string; email: string },
  storeId: string,
  action: string,
  entityId: string,
  changes: Record<string, unknown>,
): AuditEntry {
  return {
    id: crypto.randomUUID(),
    storeId,
    userId: admin.uid,
    userEmail: admin.email,
    action,
    entity: 'cognito_user',
    entityId,
    changes,
    timestamp: new Date(),
  };
}

async function requireTenantCognitoUser(
  usernameOrSub: string,
  storeId: string,
): Promise<TenantCognitoUser> {
  let target: CognitoUserSummary;
  try {
    target = await getCognitoUser(usernameOrSub);
  } catch {
    throw new AuthError('Usuario no encontrado en tu negocio.', 404);
  }

  const [membership] = await db
    .select({ id: userRoles.id, roleName: roleDefinitions.name })
    .from(userRoles)
    .leftJoin(roleDefinitions, eq(roleDefinitions.id, userRoles.roleId))
    .where(
      and(
        eq(userRoles.cognitoSub, target.sub),
        eq(userRoles.storeId, storeId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new AuthError('Usuario no encontrado en tu negocio.', 404);
  }

  return { ...target, tenantRoleName: membership.roleName ?? undefined };
}

function assertOwnerAccountProtected(admin: { uid: string }, target: TenantCognitoUser): void {
  if (target.tenantRoleName === 'Propietario' && target.sub !== admin.uid) {
    throw new AuthError('La cuenta del propietario no puede administrarse desde otro usuario.', 403);
  }
}

async function listTenantCognitoUsers(storeId: string, filter?: string): Promise<CognitoUserSummary[]> {
  const tenantUsers = await db
    .select({ cognitoSub: userRoles.cognitoSub })
    .from(userRoles)
    .where(eq(userRoles.storeId, storeId));
  const allowedSubs = new Set(tenantUsers.map((user) => user.cognitoSub));
  if (allowedSubs.size === 0) return [];

  const cognitoUsers = await listAllCognitoUsers(filter);
  return cognitoUsers.filter((user) => allowedSubs.has(user.sub));
}

// ══════════════════════════════════════════════════════════════
// READ OPERATIONS — require `roles.manage`
// ══════════════════════════════════════════════════════════════

async function _listCognitoUsersAction(params?: {
  limit?: number;
  paginationToken?: string;
  filter?: string;
  loadAll?: boolean;
}): Promise<CognitoUsersListResult> {
  await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();

  const cognitoUsers = await listTenantCognitoUsers(storeId, params?.filter);
  const requestedLimit = params?.loadAll ? cognitoUsers.length : Math.min(params?.limit ?? 60, 60);
  const visibleUsers = cognitoUsers.slice(0, requestedLimit);

  // Enrich with DB roles
  const dbData = await db
    .select({
      cognitoSub: userRoles.cognitoSub,
      roleId: userRoles.roleId,
      roleName: roleDefinitions.name,
      status: userRoles.status,
      displayName: userRoles.displayName,
    })
    .from(userRoles)
    .leftJoin(roleDefinitions, eq(userRoles.roleId, roleDefinitions.id))
    .where(eq(userRoles.storeId, storeId));
  const dbMap = new Map(dbData.map((r) => [r.cognitoSub, r]));

  // Get groups for each user (batch)
  const enrichedUsers: CognitoUserEnriched[] = await Promise.all(
    visibleUsers.map(async (u) => {
      const dbRow = dbMap.get(u.sub);
      return {
        ...u,
        hasDbRole: !!dbRow,
        dbRoleId: dbRow?.roleId,
        dbRoleName: dbRow?.roleName ?? undefined,
        dbStatus: dbRow?.status,
        groups: [],
      };
    }),
  );

  return {
    users: enrichedUsers,
    nextToken: undefined,
    total: cognitoUsers.length,
  };
}

async function _getCognitoUserDetailAction(usernameOrSub: string): Promise<CognitoUserEnriched> {
  await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const user = await requireTenantCognitoUser(usernameOrSub, storeId);
  const dbRow = await db
    .select({ roleId: userRoles.roleId, roleName: roleDefinitions.name, status: userRoles.status })
    .from(userRoles)
    .leftJoin(roleDefinitions, eq(userRoles.roleId, roleDefinitions.id))
    .where(
      and(
        eq(userRoles.cognitoSub, user.sub),
        eq(userRoles.storeId, storeId),
      ),
    )
    .limit(1);

  return {
    ...user,
    hasDbRole: dbRow.length > 0,
    dbRoleId: dbRow[0]?.roleId,
    dbRoleName: dbRow[0]?.roleName ?? undefined,
    dbStatus: dbRow[0]?.status,
    groups: [],
  };
}

// ══════════════════════════════════════════════════════════════
// LIFECYCLE — Disable / Enable / Delete + DB sync
// ══════════════════════════════════════════════════════════════

async function _disableCognitoUserAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const target = await requireTenantCognitoUser(username, storeId);
  assertOwnerAccountProtected(admin, target);
  await deactivateUser(target.sub);
  logger.info('cognito.user.disable', { target: target.sub, storeId });
}

async function _enableCognitoUserAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const target = await requireTenantCognitoUser(username, storeId);
  assertOwnerAccountProtected(admin, target);
  await reactivateUser(target.sub);
  logger.info('cognito.user.enable', { target: target.sub, storeId });
}

async function _deleteCognitoUserAction(username: string): Promise<void> {
  await requireOwner();
  const { storeId } = await requireStoreScope();
  const target = await requireTenantCognitoUser(username, storeId);
  void target;
  throw new AuthError(
    'La eliminación permanente de identidades está deshabilitada. Usa Dar de baja para conservar auditoría y accesos de otros negocios.',
    403,
  );
}

// ══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════

async function _globalSignOutAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const target = await requireTenantCognitoUser(username, storeId);
  assertOwnerAccountProtected(admin, target);
  if (await hasActiveMembershipOutside(target.sub, storeId)) {
    throw new AuthError(
      'No se puede cerrar globalmente la sesión de una identidad que pertenece a otros negocios.',
      409,
    );
  }
  await globalSignOutUser(username);
  await db.insert(auditLogs).values(audit(admin, storeId, 'cognito.user.global_signout', target.sub, {}));
  logger.info('cognito.user.global_signout', { target: target.sub });
}

// ══════════════════════════════════════════════════════════════
// MFA OPS
// ══════════════════════════════════════════════════════════════

async function _setUserMfaAction(username: string, enabled: boolean): Promise<void> {
  const admin = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const target = await requireTenantCognitoUser(username, storeId);
  assertOwnerAccountProtected(admin, target);
  await assertIdentityIsTenantExclusive(target.sub, storeId);
  try {
    await adminSetUserMfaPreference(username, enabled);
  } catch (err) {
    if (err instanceof Error && err.message.includes('delivery config')) {
      throw new Error(
        'Este usuario aún no ha configurado su app autenticadora (TOTP). ' +
        'El usuario debe iniciar sesión y configurar MFA desde su perfil antes de que el admin pueda activarlo.',
      );
    }
    throw err;
  }
  await db.insert(auditLogs).values(
    audit(admin, storeId, enabled ? 'cognito.user.mfa_enabled' : 'cognito.user.mfa_disabled', target.sub, {}),
  );
  logger.info(enabled ? 'cognito.user.mfa_enabled' : 'cognito.user.mfa_disabled', { target: target.sub });
}

// ══════════════════════════════════════════════════════════════
// PASSWORD OPS
// ══════════════════════════════════════════════════════════════

async function _resetCognitoPasswordAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const target = await requireTenantCognitoUser(username, storeId);
  assertOwnerAccountProtected(admin, target);
  await assertIdentityIsTenantExclusive(target.sub, storeId);
  await adminResetUserPassword(username);
  await db.insert(auditLogs).values(audit(admin, storeId, 'cognito.user.reset_password', target.sub, {}));
}

async function _setCognitoPasswordAction(
  username: string,
  newPassword: string,
  permanent: boolean,
): Promise<void> {
  const admin = await requireOwner();
  const { storeId } = await requireStoreScope();
  const target = await requireTenantCognitoUser(username, storeId);
  assertOwnerAccountProtected(admin, target);
  await assertIdentityIsTenantExclusive(target.sub, storeId);

  if (newPassword.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  await adminSetUserPassword(username, newPassword, permanent);
  await db.insert(auditLogs).values(
    audit(
      admin,
      storeId,
      permanent ? 'cognito.user.set_password_permanent' : 'cognito.user.set_password_temp',
      target.sub,
      {},
    ),
  );
  logger.warn('cognito.user.set_password', { target: target.sub, permanent });
}

// ══════════════════════════════════════════════════════════════
// ATTRIBUTE UPDATES
// ══════════════════════════════════════════════════════════════

async function _updateCognitoUserAttributesAction(
  username: string,
  attrs: { email?: string; displayName?: string; emailVerified?: boolean; phoneNumber?: string },
): Promise<void> {
  const admin = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const target = await requireTenantCognitoUser(username, storeId);
  assertOwnerAccountProtected(admin, target);
  await assertIdentityIsTenantExclusive(target.sub, storeId);
  await updateCognitoUserAttributes(username, attrs);

  // Mirror in DB
  const updates: Partial<typeof userRoles.$inferInsert> = { updatedAt: new Date() };
  if (attrs.displayName !== undefined) updates.displayName = attrs.displayName;
  if (attrs.email !== undefined) updates.email = attrs.email;
  if (Object.keys(updates).length > 1) {
    await db
      .update(userRoles)
      .set(updates)
      .where(and(eq(userRoles.cognitoSub, target.sub), eq(userRoles.storeId, storeId)));
  }
  await db
    .update(userIdentities)
    .set({
      ...(attrs.displayName !== undefined ? { displayName: attrs.displayName } : {}),
      ...(attrs.email !== undefined ? { email: attrs.email.trim().toLowerCase() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(userIdentities.cognitoSub, target.sub));

  await db.insert(auditLogs).values(
    audit(admin, storeId, 'cognito.user.update_attributes', target.sub, {
      fields: Object.keys(attrs),
    }),
  );
}

// ══════════════════════════════════════════════════════════════
// GROUP MANAGEMENT
// ══════════════════════════════════════════════════════════════

async function _listGroupsAction(): Promise<CognitoGroup[]> {
  await requirePermission('roles.manage');
  await requireStoreScope();
  return [];
}

async function _addUserToGroupAction(_username: string, _groupName: string): Promise<void> {
  await requirePermission('roles.manage');
  await requireStoreScope();
  throw new AuthError('Usa los roles del negocio; los grupos globales de Cognito están deshabilitados.', 403);
}

async function _removeUserFromGroupAction(_username: string, _groupName: string): Promise<void> {
  await requirePermission('roles.manage');
  await requireStoreScope();
  throw new AuthError('Usa los roles del negocio; los grupos globales de Cognito están deshabilitados.', 403);
}

// ══════════════════════════════════════════════════════════════
// BULK OPERATIONS — Owner only
// ══════════════════════════════════════════════════════════════

async function _bulkDisableAction(usernames: string[]): Promise<BulkOperationResult> {
  const admin = await requireOwner();
  const { storeId } = await requireStoreScope();
  const targets = await Promise.all(usernames.map((username) => requireTenantCognitoUser(username, storeId)));
  targets.forEach((target) => assertOwnerAccountProtected(admin, target));
  if (targets.some((target) => target.sub === admin.uid)) {
    throw new AuthError('No puedes incluir tu propia cuenta en esta operación.', 403);
  }
  const result: BulkOperationResult = { success: [], failed: [] };
  for (const target of targets) {
    try {
      await deactivateUser(target.sub);
      result.success.push(target.username);
    } catch (error) {
      result.failed.push({
        username: target.username,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  await db.insert(auditLogs).values(
    audit(admin, storeId, 'cognito.bulk.disable', 'bulk', {
      count: result.success.length,
      failed: result.failed.length,
    }),
  );
  logger.info('cognito.bulk.disable', { success: result.success.length, failed: result.failed.length });
  return result;
}

async function _bulkEnableAction(usernames: string[]): Promise<BulkOperationResult> {
  const admin = await requireOwner();
  const { storeId } = await requireStoreScope();
  const targets = await Promise.all(usernames.map((username) => requireTenantCognitoUser(username, storeId)));
  targets.forEach((target) => assertOwnerAccountProtected(admin, target));
  const result: BulkOperationResult = { success: [], failed: [] };
  for (const target of targets) {
    try {
      await reactivateUser(target.sub);
      result.success.push(target.username);
    } catch (error) {
      result.failed.push({
        username: target.username,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  await db.insert(auditLogs).values(
    audit(admin, storeId, 'cognito.bulk.enable', 'bulk', {
      count: result.success.length,
      failed: result.failed.length,
    }),
  );
  return result;
}

async function _bulkGlobalSignOutAction(usernames: string[]): Promise<BulkOperationResult> {
  const admin = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const targets = await Promise.all(usernames.map((username) => requireTenantCognitoUser(username, storeId)));
  targets.forEach((target) => assertOwnerAccountProtected(admin, target));
  for (const target of targets) {
    if (await hasActiveMembershipOutside(target.sub, storeId)) {
      throw new AuthError(
        'La operación incluye una identidad que pertenece a otros negocios y no puede cerrar sesiones globales.',
        409,
      );
    }
  }
  const result = await bulkGlobalSignOut(targets.map((target) => target.username));
  await db.insert(auditLogs).values(
    audit(admin, storeId, 'cognito.bulk.global_signout', 'bulk', {
      count: result.success.length,
      failed: result.failed.length,
    }),
  );
  return result;
}

// ══════════════════════════════════════════════════════════════
// IMPORT / SYNC
// ══════════════════════════════════════════════════════════════

async function _importCognitoUsersAction(roleId: string): Promise<{ imported: number; skipped: number }> {
  await requireOwner();
  await requireStoreScope();
  void roleId;
  throw new AuthError(
    'La importación global de Cognito está deshabilitada. Crea los usuarios desde Roles para vincularlos al negocio de forma segura.',
    403,
  );
}

// ══════════════════════════════════════════════════════════════
// EXPORT — returns CSV data as string
// ══════════════════════════════════════════════════════════════

async function _exportCognitoUsersCSV(): Promise<string> {
  await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const users = await listTenantCognitoUsers(storeId);

  // Escape CSV values to prevent formula injection (=, +, -, @, \t, \r)
  const escapeCsv = (val: string): string => {
    const s = String(val).replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(s)) return `"'${s}"`;
    return `"${s}"`;
  };

  const header = 'sub,email,displayName,status,enabled,mfaEnabled,createdAt\n';
  const rows = users
    .map(
      (u) =>
        `${escapeCsv(u.sub)},${escapeCsv(u.email)},${escapeCsv(u.displayName)},${escapeCsv(u.status)},${escapeCsv(String(u.enabled))},${escapeCsv(String(u.mfaEnabled))},${escapeCsv(u.createdAt)}`,
    )
    .join('\n');
  return header + rows;
}

// ══════════════════════════════════════════════════════════════
// STATS / DASHBOARD
// ══════════════════════════════════════════════════════════════

export interface CognitoPoolStats {
  total: number;
  confirmed: number;
  unconfirmed: number;
  forceChangePassword: number;
  disabled: number;
  mfaEnabled: number;
  withDbRole: number;
  withoutDbRole: number;
}

async function _getCognitoPoolStatsAction(): Promise<CognitoPoolStats> {
  await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const users = await listTenantCognitoUsers(storeId);
  const dbSubs = new Set(
    (
      await db
        .select({ cognitoSub: userRoles.cognitoSub })
        .from(userRoles)
        .where(eq(userRoles.storeId, storeId))
    ).map((r) => r.cognitoSub),
  );

  return {
    total: users.length,
    confirmed: users.filter((u) => u.status === 'CONFIRMED').length,
    unconfirmed: users.filter((u) => u.status === 'UNCONFIRMED').length,
    forceChangePassword: users.filter((u) => u.status === 'FORCE_CHANGE_PASSWORD').length,
    disabled: users.filter((u) => !u.enabled).length,
    mfaEnabled: users.filter((u) => u.mfaEnabled).length,
    withDbRole: users.filter((u) => dbSubs.has(u.sub)).length,
    withoutDbRole: users.filter((u) => !dbSubs.has(u.sub)).length,
  };
}

// ══════════════════════════════════════════════════════════════
// RECONCILIATION — Detect & purge orphaned DB users (no Cognito match)
// ══════════════════════════════════════════════════════════════

export interface OrphanedUser {
  id: string;
  cognitoSub: string;
  email: string;
  displayName: string;
  status: string;
  createdAt: Date | null;
}

export interface ReconciliationResult {
  orphanedUsers: OrphanedUser[];
  validUsers: number;
  cognitoTotal: number;
}

/**
 * Detects DB users whose `cognitoSub` does NOT exist in the Cognito User Pool.
 * These are typically legacy Firebase users that were never migrated.
 */
async function _reconcileUsersAction(): Promise<ReconciliationResult> {
  await requireOwner();
  const { storeId } = await requireStoreScope();

  // Fetch all Cognito users (source of truth)
  const cognitoUsers = await listTenantCognitoUsers(storeId);
  const cognitoSubs = new Set(cognitoUsers.map((u) => u.sub));

  // Fetch all DB user records
  const dbUsers = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.storeId, storeId));

  const orphaned: OrphanedUser[] = [];
  let validCount = 0;

  for (const row of dbUsers) {
    if (cognitoSubs.has(row.cognitoSub)) {
      validCount++;
    } else {
      orphaned.push({
        id: row.id,
        cognitoSub: row.cognitoSub,
        email: row.email,
        displayName: row.displayName,
        status: row.status,
        createdAt: row.createdAt,
      });
    }
  }

  logger.info('cognito.reconcile', {
    total: dbUsers.length,
    valid: validCount,
    orphaned: orphaned.length,
    cognitoTotal: cognitoUsers.length,
    storeId,
  });

  return {
    orphanedUsers: orphaned,
    validUsers: validCount,
    cognitoTotal: cognitoUsers.length,
  };
}

/**
 * Permanently removes orphaned DB user records that have no corresponding Cognito account.
 * This is irreversible — only the owner can execute this.
 * Creates an audit log for each purged record.
 */
async function _purgeOrphanedUsersAction(userIds: string[]): Promise<{ purged: number; failed: string[] }> {
  const admin = await requireOwner();
  const { storeId } = await requireStoreScope();

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new Error('Debes proporcionar al menos un ID de usuario a purgar.');
  }

  if (userIds.length > 50) {
    throw new Error('Máximo 50 usuarios por operación de purga.');
  }

  // Verify these are actually orphaned (double-check against Cognito)
  const cognitoUsers = await listTenantCognitoUsers(storeId);
  const cognitoSubs = new Set(cognitoUsers.map((u) => u.sub));

  // Fetch all target users by ID
  const targets = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.storeId, storeId),
        inArray(userRoles.id, userIds),
      ),
    );

  let purged = 0;
  const failed: string[] = [];

  for (const target of targets) {
    // Safety: refuse to delete if the user DOES exist in Cognito
    if (cognitoSubs.has(target.cognitoSub)) {
      failed.push(target.id);
      logger.warn('cognito.purge.refused', {
        reason: 'user_exists_in_cognito',
        userId: target.id,
        storeId,
      });
      continue;
    }

    // Safety: refuse to delete the current admin's own record
    if (target.cognitoSub === admin.uid) {
      failed.push(target.id);
      continue;
    }

    // Hard delete the orphaned record
    await db.transaction(async (tx) => {
      await tx
        .delete(userStoreAccess)
        .where(and(eq(userStoreAccess.userId, target.cognitoSub), eq(userStoreAccess.storeId, storeId)));
      await tx
        .delete(userRoles)
        .where(and(eq(userRoles.id, target.id), eq(userRoles.storeId, storeId)));
    });

    // Audit log
    await db.insert(auditLogs).values(audit(admin, storeId, 'cognito.orphan.purge', target.id, {
      cognitoSub: target.cognitoSub,
      reason: 'legacy_firebase_no_cognito_account',
    }));

    purged++;
  }

  logger.info('cognito.purge.complete', { purged, failed: failed.length, total: userIds.length });
  return { purged, failed };
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

export const listCognitoUsersAction = withLogging('cognito.listUsers', _listCognitoUsersAction);
export const getCognitoUserDetailAction = withLogging('cognito.getUserDetail', _getCognitoUserDetailAction);
export const disableCognitoUserAction = withLogging('cognito.disableUser', _disableCognitoUserAction);
export const enableCognitoUserAction = withLogging('cognito.enableUser', _enableCognitoUserAction);
export const deleteCognitoUserAction = withLogging('cognito.deleteUser', _deleteCognitoUserAction);
export const globalSignOutAction = withLogging('cognito.globalSignOut', _globalSignOutAction);
export const resetCognitoPasswordAction = withLogging('cognito.resetPassword', _resetCognitoPasswordAction);
export const setCognitoPasswordAction = withLogging('cognito.setPassword', _setCognitoPasswordAction);
export const updateCognitoUserAttributesAction = withLogging('cognito.updateAttributes', _updateCognitoUserAttributesAction);
export const listGroupsAction = withLogging('cognito.listGroups', _listGroupsAction);
export const addUserToGroupAction = withLogging('cognito.addToGroup', _addUserToGroupAction);
export const removeUserFromGroupAction = withLogging('cognito.removeFromGroup', _removeUserFromGroupAction);
export const bulkDisableAction = withLogging('cognito.bulkDisable', _bulkDisableAction);
export const bulkEnableAction = withLogging('cognito.bulkEnable', _bulkEnableAction);
export const bulkGlobalSignOutAction = withLogging('cognito.bulkSignOut', _bulkGlobalSignOutAction);
export const importCognitoUsersAction = withLogging('cognito.importUsers', _importCognitoUsersAction);
export const exportCognitoUsersCSV = withLogging('cognito.exportCSV', _exportCognitoUsersCSV);
export const getCognitoPoolStatsAction = withLogging('cognito.poolStats', _getCognitoPoolStatsAction);
export const reconcileUsersAction = withLogging('cognito.reconcile', _reconcileUsersAction);
export const purgeOrphanedUsersAction = withLogging('cognito.purgeOrphans', _purgeOrphanedUsersAction);
export const setUserMfaAction = withLogging('cognito.setMfa', _setUserMfaAction);
