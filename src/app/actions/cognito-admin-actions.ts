'use server';

import { requirePermission, requireOwner } from '@/lib/auth/guard';
import {
  listCognitoUsers,
  listAllCognitoUsers,
  getCognitoUser,
  disableCognitoUser,
  enableCognitoUser,
  deleteCognitoUser,
  adminResetUserPassword,
  adminSetUserPassword,
  updateCognitoUserAttributes,
  globalSignOutUser,
  listCognitoGroups,
  listUserGroups,
  addUserToGroup,
  removeUserFromGroup,
  bulkDisableUsers,
  bulkEnableUsers,
  bulkGlobalSignOut,
  type CognitoUserSummary,
  type CognitoGroup,
  type BulkOperationResult,
} from '@/lib/cognito-admin';
import { db } from '@/db';
import { userRoles, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

interface AuditEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entity: string;
  entityId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
}

function audit(
  admin: { uid: string; email: string },
  action: string,
  entityId: string,
  changes: Record<string, unknown>,
): AuditEntry {
  return {
    id: crypto.randomUUID(),
    userId: admin.uid,
    userEmail: admin.email,
    action,
    entity: 'cognito_user',
    entityId,
    changes,
    timestamp: new Date(),
  };
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

  const cognitoUsers = params?.loadAll
    ? await listAllCognitoUsers(params?.filter)
    : (await listCognitoUsers(params)).users;

  const nextToken = params?.loadAll
    ? undefined
    : (await listCognitoUsers(params)).nextToken;

  // Enrich with DB roles
  const dbData = await db
    .select({
      cognitoSub: userRoles.cognitoSub,
      roleId: userRoles.roleId,
      status: userRoles.status,
      displayName: userRoles.displayName,
    })
    .from(userRoles);
  const dbMap = new Map(dbData.map((r) => [r.cognitoSub, r]));

  // Get groups for each user (batch)
  const enrichedUsers: CognitoUserEnriched[] = await Promise.all(
    cognitoUsers.map(async (u) => {
      const dbRow = dbMap.get(u.sub);
      let groups: string[] = [];
      try {
        const userGroups = await listUserGroups(u.username);
        groups = userGroups.map((g) => g.name);
      } catch {
        // User may not have groups — continue
      }
      return {
        ...u,
        hasDbRole: !!dbRow,
        dbRoleId: dbRow?.roleId,
        dbStatus: dbRow?.status,
        groups,
      };
    }),
  );

  return {
    users: enrichedUsers,
    nextToken,
    total: enrichedUsers.length,
  };
}

async function _getCognitoUserDetailAction(usernameOrSub: string): Promise<CognitoUserEnriched> {
  await requirePermission('roles.manage');
  const user = await getCognitoUser(usernameOrSub);
  const dbRow = await db
    .select({ roleId: userRoles.roleId, status: userRoles.status })
    .from(userRoles)
    .where(eq(userRoles.cognitoSub, user.sub))
    .limit(1);

  let groups: string[] = [];
  try {
    const userGroups = await listUserGroups(user.username);
    groups = userGroups.map((g) => g.name);
  } catch {
    // OK
  }

  return {
    ...user,
    hasDbRole: dbRow.length > 0,
    dbRoleId: dbRow[0]?.roleId,
    dbStatus: dbRow[0]?.status,
    groups,
  };
}

// ══════════════════════════════════════════════════════════════
// LIFECYCLE — Disable / Enable / Delete + DB sync
// ══════════════════════════════════════════════════════════════

async function _disableCognitoUserAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await disableCognitoUser(username);

  const target = await getCognitoUser(username);
  await db
    .update(userRoles)
    .set({ status: 'baja', deactivatedAt: new Date(), updatedAt: new Date() })
    .where(eq(userRoles.cognitoSub, target.sub));

  await db.insert(auditLogs).values(audit(admin, 'cognito.user.disable', target.sub, { email: target.email }));
  logger.info('cognito.user.disable', { target: target.sub, email: target.email });
}

async function _enableCognitoUserAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await enableCognitoUser(username);

  const target = await getCognitoUser(username);
  await db
    .update(userRoles)
    .set({ status: 'activo', deactivatedAt: null, updatedAt: new Date() })
    .where(eq(userRoles.cognitoSub, target.sub));

  await db.insert(auditLogs).values(audit(admin, 'cognito.user.enable', target.sub, { email: target.email }));
  logger.info('cognito.user.enable', { target: target.sub, email: target.email });
}

async function _deleteCognitoUserAction(username: string): Promise<void> {
  const admin = await requireOwner();
  const target = await getCognitoUser(username);

  if (target.sub === admin.uid) {
    throw new Error('No puedes eliminar tu propia cuenta.');
  }

  await deleteCognitoUser(username);
  await db.delete(userRoles).where(eq(userRoles.cognitoSub, target.sub));

  await db.insert(auditLogs).values(audit(admin, 'cognito.user.delete', target.sub, { email: target.email }));
  logger.warn('cognito.user.delete', { target: target.sub, email: target.email });
}

// ══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════

async function _globalSignOutAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await globalSignOutUser(username);
  const target = await getCognitoUser(username);
  await db.insert(auditLogs).values(audit(admin, 'cognito.user.global_signout', target.sub, { email: target.email }));
  logger.info('cognito.user.global_signout', { target: target.sub });
}

// ══════════════════════════════════════════════════════════════
// PASSWORD OPS
// ══════════════════════════════════════════════════════════════

async function _resetCognitoPasswordAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await adminResetUserPassword(username);
  const target = await getCognitoUser(username);
  await db.insert(auditLogs).values(audit(admin, 'cognito.user.reset_password', target.sub, { email: target.email }));
}

async function _setCognitoPasswordAction(
  username: string,
  newPassword: string,
  permanent: boolean,
): Promise<void> {
  const admin = await requireOwner();

  if (newPassword.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  await adminSetUserPassword(username, newPassword, permanent);
  const target = await getCognitoUser(username);
  await db.insert(auditLogs).values(
    audit(admin, permanent ? 'cognito.user.set_password_permanent' : 'cognito.user.set_password_temp', target.sub, {
      email: target.email,
    }),
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
  await updateCognitoUserAttributes(username, attrs);

  const target = await getCognitoUser(username);

  // Mirror in DB
  const updates: Partial<typeof userRoles.$inferInsert> = { updatedAt: new Date() };
  if (attrs.displayName !== undefined) updates.displayName = attrs.displayName;
  if (attrs.email !== undefined) updates.email = attrs.email;
  if (Object.keys(updates).length > 1) {
    await db.update(userRoles).set(updates).where(eq(userRoles.cognitoSub, target.sub));
  }

  await db.insert(auditLogs).values(audit(admin, 'cognito.user.update_attributes', target.sub, attrs));
}

// ══════════════════════════════════════════════════════════════
// GROUP MANAGEMENT
// ══════════════════════════════════════════════════════════════

async function _listGroupsAction(): Promise<CognitoGroup[]> {
  await requirePermission('roles.manage');
  return listCognitoGroups();
}

async function _addUserToGroupAction(username: string, groupName: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await addUserToGroup(username, groupName);
  const target = await getCognitoUser(username);
  await db.insert(auditLogs).values(
    audit(admin, 'cognito.user.add_to_group', target.sub, { groupName, email: target.email }),
  );
}

async function _removeUserFromGroupAction(username: string, groupName: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await removeUserFromGroup(username, groupName);
  const target = await getCognitoUser(username);
  await db.insert(auditLogs).values(
    audit(admin, 'cognito.user.remove_from_group', target.sub, { groupName, email: target.email }),
  );
}

// ══════════════════════════════════════════════════════════════
// BULK OPERATIONS — Owner only
// ══════════════════════════════════════════════════════════════

async function _bulkDisableAction(usernames: string[]): Promise<BulkOperationResult> {
  const admin = await requireOwner();
  const result = await bulkDisableUsers(usernames);
  // Sync DB
  for (const u of result.success) {
    const target = await getCognitoUser(u);
    await db.update(userRoles).set({ status: 'baja', deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(userRoles.cognitoSub, target.sub));
  }
  await db.insert(auditLogs).values(
    audit(admin, 'cognito.bulk.disable', 'bulk', { count: result.success.length, failed: result.failed.length }),
  );
  logger.info('cognito.bulk.disable', { success: result.success.length, failed: result.failed.length });
  return result;
}

async function _bulkEnableAction(usernames: string[]): Promise<BulkOperationResult> {
  const admin = await requireOwner();
  const result = await bulkEnableUsers(usernames);
  for (const u of result.success) {
    const target = await getCognitoUser(u);
    await db.update(userRoles).set({ status: 'activo', deactivatedAt: null, updatedAt: new Date() }).where(eq(userRoles.cognitoSub, target.sub));
  }
  await db.insert(auditLogs).values(
    audit(admin, 'cognito.bulk.enable', 'bulk', { count: result.success.length, failed: result.failed.length }),
  );
  return result;
}

async function _bulkGlobalSignOutAction(usernames: string[]): Promise<BulkOperationResult> {
  const admin = await requirePermission('roles.manage');
  const result = await bulkGlobalSignOut(usernames);
  await db.insert(auditLogs).values(
    audit(admin, 'cognito.bulk.global_signout', 'bulk', { count: result.success.length, failed: result.failed.length }),
  );
  return result;
}

// ══════════════════════════════════════════════════════════════
// IMPORT / SYNC
// ══════════════════════════════════════════════════════════════

async function _importCognitoUsersAction(roleId: string): Promise<{ imported: number; skipped: number }> {
  const admin = await requireOwner();
  const allUsers = await listAllCognitoUsers();
  const dbSubs = new Set(
    (await db.select({ cognitoSub: userRoles.cognitoSub }).from(userRoles)).map((r) => r.cognitoSub),
  );

  let imported = 0;
  let skipped = 0;
  const existingCount = dbSubs.size;

  for (const user of allUsers) {
    if (!user.sub || !user.email || dbSubs.has(user.sub)) {
      skipped++;
      continue;
    }

    const empNum = `3226${String(existingCount + imported + 1).padStart(2, '0')}`;
    const now = new Date();
    await db.insert(userRoles).values({
      id: crypto.randomUUID(),
      cognitoSub: user.sub,
      email: user.email,
      displayName: user.displayName || '',
      employeeNumber: empNum,
      roleId,
      assignedBy: admin.uid,
      createdAt: now,
      updatedAt: now,
    });
    imported++;
    dbSubs.add(user.sub); // prevent duplicates in same batch
  }

  await db.insert(auditLogs).values(audit(admin, 'cognito.users.import', 'bulk', { roleId, imported, skipped }));
  logger.info('cognito.users.import', { imported, skipped, roleId });
  return { imported, skipped };
}

// ══════════════════════════════════════════════════════════════
// EXPORT — returns CSV data as string
// ══════════════════════════════════════════════════════════════

async function _exportCognitoUsersCSV(): Promise<string> {
  await requirePermission('roles.manage');
  const users = await listAllCognitoUsers();

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
  const users = await listAllCognitoUsers();
  const dbSubs = new Set(
    (await db.select({ cognitoSub: userRoles.cognitoSub }).from(userRoles)).map((r) => r.cognitoSub),
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
