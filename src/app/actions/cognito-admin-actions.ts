'use server';

import { requirePermission, requireOwner } from '@/lib/auth/guard';
import {
  listCognitoUsers,
  getCognitoUser,
  disableCognitoUser,
  enableCognitoUser,
  deleteCognitoUser,
  adminResetUserPassword,
  adminSetUserPassword,
  updateCognitoUserAttributes,
  type CognitoUserSummary,
} from '@/lib/cognito-admin';
import { db } from '@/db';
import { userRoles, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withLogging } from '@/lib/errors';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// READ OPERATIONS — require `roles.manage`
// ══════════════════════════════════════════════════════════════

async function _listCognitoUsersAction(params?: {
  limit?: number;
  paginationToken?: string;
  filter?: string;
}): Promise<{
  users: (CognitoUserSummary & { hasDbRole: boolean })[];
  nextToken?: string;
}> {
  await requirePermission('roles.manage');
  const { users, nextToken } = await listCognitoUsers(params);

  // Annotate with whether each user has a row in user_roles
  const dbSubs = new Set(
    (await db.select({ cognitoSub: userRoles.cognitoSub }).from(userRoles)).map(
      (r) => r.cognitoSub,
    ),
  );

  return {
    users: users.map((u) => ({ ...u, hasDbRole: dbSubs.has(u.sub) })),
    nextToken,
  };
}

async function _getCognitoUserAction(usernameOrSub: string): Promise<CognitoUserSummary> {
  await requirePermission('roles.manage');
  return getCognitoUser(usernameOrSub);
}

// ══════════════════════════════════════════════════════════════
// LIFECYCLE — require `roles.manage`. Sync with user_roles row.
// ══════════════════════════════════════════════════════════════

async function _disableCognitoUserAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await disableCognitoUser(username);

  // Mirror in DB if a user_roles row exists for this sub
  const target = await getCognitoUser(username);
  await db
    .update(userRoles)
    .set({ status: 'baja', deactivatedAt: new Date(), updatedAt: new Date() })
    .where(eq(userRoles.cognitoSub, target.sub));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: admin.uid,
    userEmail: admin.email,
    action: 'cognito.user.disable',
    entity: 'cognito_user',
    entityId: target.sub,
    changes: { email: target.email },
    timestamp: new Date(),
  });

  logger.info({ action: 'cognito.user.disable', target: target.sub, email: target.email });
}

async function _enableCognitoUserAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await enableCognitoUser(username);

  const target = await getCognitoUser(username);
  await db
    .update(userRoles)
    .set({ status: 'activo', deactivatedAt: null, updatedAt: new Date() })
    .where(eq(userRoles.cognitoSub, target.sub));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: admin.uid,
    userEmail: admin.email,
    action: 'cognito.user.enable',
    entity: 'cognito_user',
    entityId: target.sub,
    changes: { email: target.email },
    timestamp: new Date(),
  });

  logger.info({ action: 'cognito.user.enable', target: target.sub, email: target.email });
}

async function _deleteCognitoUserAction(username: string): Promise<void> {
  const admin = await requireOwner();
  const target = await getCognitoUser(username);

  if (target.sub === admin.uid) {
    throw new Error('No puedes eliminar tu propia cuenta.');
  }

  await deleteCognitoUser(username);
  await db.delete(userRoles).where(eq(userRoles.cognitoSub, target.sub));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: admin.uid,
    userEmail: admin.email,
    action: 'cognito.user.delete',
    entity: 'cognito_user',
    entityId: target.sub,
    changes: { email: target.email },
    timestamp: new Date(),
  });

  logger.warn({ action: 'cognito.user.delete', target: target.sub, email: target.email });
}

// ══════════════════════════════════════════════════════════════
// PASSWORD OPS — require `roles.manage`
// ══════════════════════════════════════════════════════════════

async function _resetCognitoPasswordAction(username: string): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await adminResetUserPassword(username);

  const target = await getCognitoUser(username);
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: admin.uid,
    userEmail: admin.email,
    action: 'cognito.user.reset_password',
    entity: 'cognito_user',
    entityId: target.sub,
    changes: { email: target.email },
    timestamp: new Date(),
  });
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
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: admin.uid,
    userEmail: admin.email,
    action: permanent ? 'cognito.user.set_password_permanent' : 'cognito.user.set_password_temp',
    entity: 'cognito_user',
    entityId: target.sub,
    changes: { email: target.email },
    timestamp: new Date(),
  });

  logger.warn({
    action: 'cognito.user.set_password',
    target: target.sub,
    permanent,
  });
}

// ══════════════════════════════════════════════════════════════
// ATTRIBUTE UPDATES — require `roles.manage`
// ══════════════════════════════════════════════════════════════

async function _updateCognitoUserAttributesAction(
  username: string,
  attrs: { email?: string; displayName?: string; emailVerified?: boolean },
): Promise<void> {
  const admin = await requirePermission('roles.manage');
  await updateCognitoUserAttributes(username, attrs);

  const target = await getCognitoUser(username);

  // Mirror display name + email in DB if user_roles row exists
  const updates: Partial<typeof userRoles.$inferInsert> = { updatedAt: new Date() };
  if (attrs.displayName !== undefined) updates.displayName = attrs.displayName;
  if (attrs.email !== undefined) updates.email = attrs.email;
  if (Object.keys(updates).length > 1) {
    await db.update(userRoles).set(updates).where(eq(userRoles.cognitoSub, target.sub));
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: admin.uid,
    userEmail: admin.email,
    action: 'cognito.user.update_attributes',
    entity: 'cognito_user',
    entityId: target.sub,
    changes: attrs,
    timestamp: new Date(),
  });
}

// ══════════════════════════════════════════════════════════════
// SYNC — Import all Cognito users that don't have a user_roles row
// ══════════════════════════════════════════════════════════════

async function _importCognitoUsersAction(roleId: string): Promise<{ imported: number; skipped: number }> {
  const admin = await requireOwner();

  let imported = 0;
  let skipped = 0;
  let nextToken: string | undefined = undefined;

  do {
    const page = await listCognitoUsers({ limit: 60, paginationToken: nextToken });
    nextToken = page.nextToken;

    for (const user of page.users) {
      if (!user.sub || !user.email) {
        skipped++;
        continue;
      }

      const existing = await db
        .select({ id: userRoles.id })
        .from(userRoles)
        .where(eq(userRoles.cognitoSub, user.sub))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const now = new Date();
      const allUsers = await db.select({ id: userRoles.id }).from(userRoles);
      const empNum = `3226${String(allUsers.length + imported + 1).padStart(2, '0')}`;

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
    }
  } while (nextToken);

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: admin.uid,
    userEmail: admin.email,
    action: 'cognito.users.import',
    entity: 'cognito_user',
    entityId: 'bulk',
    changes: { roleId, imported, skipped },
    timestamp: new Date(),
  });

  logger.info({ action: 'cognito.users.import', imported, skipped, roleId });
  return { imported, skipped };
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

export const listCognitoUsersAction = withLogging('cognito.listUsers', _listCognitoUsersAction);
export const getCognitoUserAction = withLogging('cognito.getUser', _getCognitoUserAction);
export const disableCognitoUserAction = withLogging('cognito.disableUser', _disableCognitoUserAction);
export const enableCognitoUserAction = withLogging('cognito.enableUser', _enableCognitoUserAction);
export const deleteCognitoUserAction = withLogging('cognito.deleteUser', _deleteCognitoUserAction);
export const resetCognitoPasswordAction = withLogging('cognito.resetPassword', _resetCognitoPasswordAction);
export const setCognitoPasswordAction = withLogging('cognito.setPassword', _setCognitoPasswordAction);
export const updateCognitoUserAttributesAction = withLogging(
  'cognito.updateAttributes',
  _updateCognitoUserAttributesAction,
);
export const importCognitoUsersAction = withLogging('cognito.importUsers', _importCognitoUsersAction);
