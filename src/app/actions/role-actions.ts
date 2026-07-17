'use server';

import { AuthError, requireOwner, requirePermission, requireAuth, validateId } from '@/lib/auth/guard';
import { disableCognitoUser, enableCognitoUser } from '@/lib/cognito-admin';
import { db } from '@/db';
import { setTenantTransactionContext } from '@/db/tenant-context';
import { userIdentities, userRoles, roleDefinitions, auditLogs, userStoreAccess, storeConfig } from '@/db/schema';
import { and, eq, isNotNull, or, sql } from 'drizzle-orm';
import type { UserRoleRecord, RoleDefinition, PermissionKey } from '@/types';
import { DEFAULT_SYSTEM_ROLES } from '@/types';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { checkRateLimitAsync } from '@/infrastructure/redis';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { issueSaleDiscountApproval } from '@/server/sale-discount-approval-service';
import { withLogging } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  validateSchema,
  createRoleSchema,
  updateRoleSchema,
  updateUserPinSchema,
  updateUserProfileSchema,
  idSchema,
  saleDiscountApprovalContextSchema,
  type SaleDiscountApprovalContext,
} from '@/lib/validation/schemas';

// ==================== PIN RATE LIMITING ====================

/** Strict rate limit for PIN auth: 5 attempts per 5 minutes per authenticated terminal user. */
const PIN_RATE_LIMIT = { maxRequests: 5, windowMs: 5 * 60_000 } as const;

// ==================== PIN HASHING (scrypt — async to avoid blocking event loop) ====================

const scryptAsync = promisify(scrypt);
const OWNER_ROLE_NAME = 'Propietario';

function createTenantCapacityError(limit: number): AuthError {
  return new AuthError(
    `Este negocio tiene capacidad para ${limit} usuario(s) activo(s) y ya está completa. ` +
      'El límite incluye al propietario. Aumenta el cupo de usuarios del negocio antes de agregar otra cuenta.',
    409,
  );
}

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(pin, salt, 64) as Buffer).toString('hex');
  return `${salt}:${hash}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  // Reject legacy unhashed PINs — they must be re-set by admin
  if (!stored.includes(':')) {
    return false;
  }
  const [salt, hash] = stored.split(':');
  if (!salt || !/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(hash ?? '')) {
    return false;
  }
  const hashBuf = Buffer.from(hash, 'hex');
  const supplied = await scryptAsync(pin, salt, 64) as Buffer;
  if (hashBuf.length !== supplied.length) return false;
  return timingSafeEqual(hashBuf, supplied);
}

function roleIsVisibleInTenant(storeId: string) {
  return or(
    eq(roleDefinitions.isSystem, true),
    and(eq(roleDefinitions.isSystem, false), eq(roleDefinitions.storeId, storeId)),
  );
}

async function getAccessibleRole(roleId: string, storeId: string) {
  const [role] = await db
    .select()
    .from(roleDefinitions)
    .where(and(eq(roleDefinitions.id, roleId), roleIsVisibleInTenant(storeId)))
    .limit(1);
  return role ?? null;
}

async function getTenantUser(cognitoSub: string, storeId: string) {
  const [row] = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.cognitoSub, cognitoSub),
        eq(userRoles.storeId, storeId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function hasOtherActiveMemberships(cognitoSub: string, excludedStoreId: string): Promise<boolean> {
  const [membership] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.cognitoSub, cognitoSub),
        eq(userRoles.status, 'activo'),
        sql`${userRoles.storeId} <> ${excludedStoreId}`,
      ),
    )
    .limit(1);
  return Boolean(membership);
}

// ==================== ROLE DEFINITIONS ====================

async function seedSystemRoles(): Promise<void> {
  const existing = await db
    .select({ name: roleDefinitions.name })
    .from(roleDefinitions)
    .where(eq(roleDefinitions.isSystem, true));
  const existingNames = new Set(existing.map((role) => role.name));

  if (DEFAULT_SYSTEM_ROLES.every((role) => existingNames.has(role.name))) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('seed-system-roles'))`);
    const current = await tx
      .select({ name: roleDefinitions.name })
      .from(roleDefinitions)
      .where(eq(roleDefinitions.isSystem, true));
    const currentNames = new Set(current.map((role) => role.name));
    const now = new Date();

    for (const role of DEFAULT_SYSTEM_ROLES) {
      if (currentNames.has(role.name)) continue;
      await tx
        .insert(roleDefinitions)
        .values({
          id: crypto.randomUUID(),
          name: role.name,
          description: role.description,
          permissions: JSON.stringify(role.permissions),
          isSystem: true,
          storeId: null,
          createdBy: role.createdBy,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
      currentNames.add(role.name);
    }
  });
}

function mapRoleDef(r: typeof roleDefinitions.$inferSelect): RoleDefinition {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: JSON.parse(r.permissions) as PermissionKey[],
    isSystem: r.isSystem,
    storeId: r.storeId ?? undefined,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function _fetchRoleDefinitions(): Promise<RoleDefinition[]> {
  await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  await seedSystemRoles();
  const rows = await db
    .select()
    .from(roleDefinitions)
    .where(roleIsVisibleInTenant(storeId))
    .orderBy(roleDefinitions.createdAt);
  return rows.map(mapRoleDef);
}

async function _createRoleDefinition(
  data: { name: string; description: string; permissions: PermissionKey[] },
  createdByUid: string,
): Promise<RoleDefinition> {
  const currentUser = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  validateSchema(createRoleSchema, data, 'createRoleDefinition');
  validateSchema(idSchema, createdByUid, 'createRoleDefinition.createdByUid');
  if (createdByUid !== currentUser.uid) {
    throw new AuthError('No puedes crear un rol en nombre de otro usuario.', 403);
  }

  const [duplicate] = await db
    .select({ id: roleDefinitions.id })
    .from(roleDefinitions)
    .where(
      and(
        roleIsVisibleInTenant(storeId),
        sql`lower(${roleDefinitions.name}) = lower(${data.name.trim()})`,
      ),
    )
    .limit(1);
  if (duplicate) {
    throw new Error('Ya existe un rol con ese nombre en tu negocio.');
  }

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(roleDefinitions).values({
    id,
    name: data.name,
    description: data.description,
    permissions: JSON.stringify(data.permissions),
    isSystem: false,
    storeId,
    createdBy: currentUser.uid,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    name: data.name,
    description: data.description,
    permissions: data.permissions,
    isSystem: false,
    storeId,
    createdBy: currentUser.uid,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

async function _updateRoleDefinition(
  id: string,
  data: { name?: string; description?: string; permissions?: PermissionKey[] },
): Promise<void> {
  await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  validateSchema(idSchema, id, 'updateRoleDefinition.id');
  validateSchema(updateRoleSchema, data, 'updateRoleDefinition');

  const existing = await getAccessibleRole(id, storeId);
  if (!existing) {
    throw new Error('Rol no encontrado en tu negocio.');
  }
  if (existing.isSystem) {
    throw new AuthError('Los roles del sistema son compartidos y no se pueden modificar.', 403);
  }

  if (data.name !== undefined) {
    const [duplicate] = await db
      .select({ id: roleDefinitions.id })
      .from(roleDefinitions)
      .where(
        and(
          eq(roleDefinitions.storeId, storeId),
          sql`${roleDefinitions.id} <> ${id}`,
          sql`lower(${roleDefinitions.name}) = lower(${data.name.trim()})`,
        ),
      )
      .limit(1);
    if (duplicate) {
      throw new Error('Ya existe un rol con ese nombre en tu negocio.');
    }
  }

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.permissions !== undefined) updates.permissions = JSON.stringify(data.permissions);
  await db
    .update(roleDefinitions)
    .set(updates)
    .where(and(eq(roleDefinitions.id, id), eq(roleDefinitions.storeId, storeId)));
}

async function _deleteRoleDefinition(id: string): Promise<void> {
  await requireOwner();
  const { storeId } = await requireStoreScope();
  validateId(id, 'Role ID');
  const role = await getAccessibleRole(id, storeId);
  if (!role) {
    throw new Error('Rol no encontrado en tu negocio.');
  }
  if (role.isSystem) {
    throw new Error('No se pueden eliminar roles del sistema');
  }

  const [assignedUser] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.storeId, storeId), eq(userRoles.roleId, id)))
    .limit(1);
  if (assignedUser) {
    throw new Error('No puedes eliminar un rol que todavía tiene usuarios asignados.');
  }

  await db
    .delete(roleDefinitions)
    .where(and(eq(roleDefinitions.id, id), eq(roleDefinitions.storeId, storeId)));
}

// ==================== USER ROLES ====================

function mapUserRole(r: typeof userRoles.$inferSelect): UserRoleRecord {
  return {
    id: r.id,
    cognitoSub: r.cognitoSub,
    storeId: r.storeId,
    email: r.email,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    employeeNumber: r.employeeNumber,
    globalId: r.globalId ?? undefined,
    status: (r.status as 'activo' | 'baja') || 'activo',
    isDefault: r.isDefault,
    deactivatedAt: r.deactivatedAt?.toISOString(),
    pinCode: r.pinCode ? '••••' : undefined,
    roleId: r.roleId,
    assignedBy: r.assignedBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function _fetchUserRoles(): Promise<UserRoleRecord[]> {
  await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const rows = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.storeId, storeId))
    .orderBy(userRoles.createdAt);
  return rows.map(mapUserRole);
}

async function _getUserRoleByUid(cognitoSub: string): Promise<UserRoleRecord | null> {
  const currentUser = await requireAuth();
  if (currentUser.uid !== cognitoSub) {
    await requirePermission('roles.manage');
  }
  const { storeId } = await requireStoreScope();
  const user = await getTenantUser(cognitoSub, storeId);
  return user ? mapUserRole(user) : null;
}

async function _updateUserPin(cognitoSub: string, pinCode: string): Promise<void> {
  const currentUser = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  validateSchema(updateUserPinSchema, { cognitoSub, pinCode }, 'updateUserPin');
  const targetUser = await getTenantUser(cognitoSub, storeId);
  if (!targetUser) {
    throw new Error('Usuario no encontrado en tu negocio.');
  }
  const hashed = await hashPin(pinCode);
  const now = new Date();
  await db
    .update(userRoles)
    .set({ pinCode: hashed, updatedAt: now })
    .where(and(eq(userRoles.cognitoSub, cognitoSub), eq(userRoles.storeId, storeId)));

  // Audit log — PIN change (never log the actual PIN)
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    storeId,
    userId: currentUser.uid,
    userEmail: currentUser.email ?? 'system',
    action: 'update',
    entity: 'userRole',
    entityId: cognitoSub,
    changes: { after: { pinChanged: true, storeId } },
    timestamp: now,
  });
}

async function _updateUserRole(cognitoSub: string, newRoleId: string, assignedByUid: string): Promise<void> {
  const currentUser = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  validateSchema(idSchema, newRoleId, 'updateUserRole.newRoleId');
  validateSchema(idSchema, assignedByUid, 'updateUserRole.assignedByUid');
  if (assignedByUid !== currentUser.uid) {
    throw new AuthError('No puedes actualizar un rol en nombre de otro administrador.', 403);
  }

  const newRole = await getAccessibleRole(newRoleId, storeId);
  if (!newRole) {
    throw new Error('Rol no encontrado. No se actualizó el acceso del usuario.');
  }
  if (newRole.name === OWNER_ROLE_NAME) {
    throw new AuthError('El rol Propietario requiere un flujo explícito de transferencia.', 403);
  }

  const existing = await getTenantUser(cognitoSub, storeId);
  if (!existing) {
    throw new Error('Usuario no encontrado en la base de datos.');
  }
  const previousRole = await getAccessibleRole(existing.roleId, storeId);
  if (previousRole?.name === OWNER_ROLE_NAME) {
    throw new AuthError('No puedes cambiar el rol del propietario desde este formulario.', 403);
  }
  const previousRoleId = existing.roleId;

  const now = new Date();
  await db
    .update(userRoles)
    .set({ roleId: newRoleId, updatedAt: now, assignedBy: currentUser.uid })
    .where(and(eq(userRoles.cognitoSub, cognitoSub), eq(userRoles.storeId, storeId)));

  // Audit log — critical for compliance
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    storeId,
    userId: currentUser.uid,
    userEmail: currentUser.email,
    action: 'update',
    entity: 'userRole',
    entityId: cognitoSub,
    changes: { before: { roleId: previousRoleId }, after: { roleId: newRoleId, storeId } },
    timestamp: now,
  });

  logger.info('User role updated', {
    action: 'updateUserRole',
    userId: currentUser.uid,
    targetUser: cognitoSub,
    previousRoleId: previousRoleId ?? 'none',
    newRoleId,
  });
}

async function _generateGlobalId(cognitoSub: string): Promise<string> {
  const currentUser = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const targetUser = await getTenantUser(cognitoSub, storeId);
  if (!targetUser) throw new Error('Usuario no encontrado en tu negocio.');
  if (targetUser.globalId) throw new Error('Este usuario ya tiene un Global ID asignado. No se puede generar otro.');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  let globalId = '';

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('global-user-id-sequence'))`);
    const [identity] = await tx
      .select({ globalId: userIdentities.globalId })
      .from(userIdentities)
      .where(eq(userIdentities.cognitoSub, cognitoSub))
      .limit(1);
    if (!identity) throw new Error('La identidad global no existe.');
    if (identity.globalId) throw new Error('Este usuario ya tiene un Global ID asignado.');

    const allWithGlobalId = await tx
      .select({ globalId: userIdentities.globalId })
      .from(userIdentities);
    const existingIds = new Set(allWithGlobalId.map((row) => row.globalId).filter(Boolean));
    let sequence = existingIds.size + 1;
    globalId = `GID-${dateStr}-${String(sequence).padStart(4, '0')}`;
    while (existingIds.has(globalId)) {
      sequence++;
      globalId = `GID-${dateStr}-${String(sequence).padStart(4, '0')}`;
    }

    await tx
      .update(userIdentities)
      .set({ globalId, updatedAt: now })
      .where(eq(userIdentities.cognitoSub, cognitoSub));
    await tx
      .update(userRoles)
      .set({ globalId, updatedAt: now })
      .where(eq(userRoles.cognitoSub, cognitoSub));
  });

  // Audit log — Global ID generation
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    storeId,
    userId: currentUser.uid,
    userEmail: currentUser.email ?? 'system',
    action: 'update',
    entity: 'userRole',
    entityId: cognitoSub,
    changes: { after: { globalId, storeId } },
    timestamp: now,
  });

  return globalId;
}

async function _deactivateUser(cognitoSub: string): Promise<void> {
  const currentUser = await requireOwner();
  const { storeId } = await requireStoreScope();
  if (currentUser.uid === cognitoSub) throw new AuthError('No puedes desactivar tu propia cuenta.', 403);
  const now = new Date();
  let cognitoWasDisabled = false;
  try {
    await db.transaction(async (tx) => {
      await setTenantTransactionContext(tx, storeId, currentUser.uid);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`identity-membership:${cognitoSub}`}))`);

      const [membership] = await tx
        .select({ id: userRoles.id, roleId: userRoles.roleId, status: userRoles.status })
        .from(userRoles)
        .where(and(eq(userRoles.cognitoSub, cognitoSub), eq(userRoles.storeId, storeId)))
        .for('update')
        .limit(1);
      if (!membership) throw new Error('Usuario no encontrado en tu negocio.');
      if (membership.status === 'baja') throw new Error('Este usuario ya está dado de baja');

      const [targetRole] = await tx
        .select({ name: roleDefinitions.name })
        .from(roleDefinitions)
        .where(eq(roleDefinitions.id, membership.roleId))
        .limit(1);
      if (targetRole?.name === OWNER_ROLE_NAME) {
        throw new AuthError('No puedes desactivar al propietario del negocio.', 403);
      }

      const [otherMembership] = await tx
        .select({ id: userRoles.id })
        .from(userRoles)
        .where(
          and(
            eq(userRoles.cognitoSub, cognitoSub),
            eq(userRoles.status, 'activo'),
            sql`${userRoles.storeId} <> ${storeId}`,
          ),
        )
        .limit(1);
      if (!otherMembership) {
        await disableCognitoUser(cognitoSub);
        cognitoWasDisabled = true;
      }

      await tx
        .update(userRoles)
        .set({ status: 'baja', deactivatedAt: now, updatedAt: now })
        .where(and(eq(userRoles.id, membership.id), eq(userRoles.storeId, storeId)));
      if (!otherMembership) {
        await tx
          .update(userIdentities)
          .set({ status: 'disabled', updatedAt: now })
          .where(eq(userIdentities.cognitoSub, cognitoSub));
      }

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        userId: currentUser.uid,
        userEmail: currentUser.email ?? 'system',
        action: 'update',
        entity: 'userRole',
        entityId: cognitoSub,
        changes: { before: { status: 'activo' }, after: { status: 'baja', storeId } },
        timestamp: now,
      });
    });
  } catch (error) {
    if (cognitoWasDisabled) {
      await enableCognitoUser(cognitoSub).catch(() => undefined);
    }
    throw error;
  }
}

async function _reactivateUser(cognitoSub: string): Promise<void> {
  const currentUser = await requireOwner();
  const { storeId } = await requireStoreScope();
  const targetUser = await getTenantUser(cognitoSub, storeId);
  if (!targetUser) throw new Error('Usuario no encontrado en tu negocio.');
  if (targetUser.status === 'activo') throw new Error('Este usuario ya está activo');

  const now = new Date();
  let cognitoWasEnabled = false;
  try {
    await db.transaction(async (tx) => {
      await setTenantTransactionContext(tx, storeId, currentUser.uid);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`identity-membership:${cognitoSub}`}))`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`tenant-user-capacity:${storeId}`}))`);

      const [[membership], [config], [activeUsers]] = await Promise.all([
        tx
          .select({ id: userRoles.id, status: userRoles.status, isDefault: userRoles.isDefault })
          .from(userRoles)
          .where(and(eq(userRoles.cognitoSub, cognitoSub), eq(userRoles.storeId, storeId)))
          .for('update')
          .limit(1),
        tx
          .select({ estimatedUsers: storeConfig.estimatedUsers })
          .from(storeConfig)
          .where(eq(storeConfig.id, storeId))
          .limit(1),
        tx
          .select({ count: sql<number>`count(*)` })
          .from(userRoles)
          .where(and(eq(userRoles.storeId, storeId), eq(userRoles.status, 'activo'))),
      ]);
      if (!membership) throw new Error('Usuario no encontrado en tu negocio.');
      if (membership.status === 'activo') throw new Error('Este usuario ya está activo');
      const limit = Math.max(1, Number(config?.estimatedUsers ?? 1));
      if (Number(activeUsers?.count ?? 0) >= limit) throw createTenantCapacityError(limit);

      await enableCognitoUser(cognitoSub);
      cognitoWasEnabled = true;

      await tx
        .update(userIdentities)
        .set({ status: 'active', updatedAt: now })
        .where(eq(userIdentities.cognitoSub, cognitoSub));
      await tx
        .update(userRoles)
        .set({ status: 'activo', deactivatedAt: null, updatedAt: now })
        .where(and(eq(userRoles.id, membership.id), eq(userRoles.storeId, storeId)));
      await tx
        .insert(userStoreAccess)
        .values({ userId: cognitoSub, storeId, isDefault: membership.isDefault, createdAt: now })
        .onConflictDoUpdate({
          target: [userStoreAccess.userId, userStoreAccess.storeId],
          set: { isDefault: membership.isDefault },
        });
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        userId: currentUser.uid,
        userEmail: currentUser.email ?? 'system',
        action: 'update',
        entity: 'userRole',
        entityId: cognitoSub,
        changes: { before: { status: 'baja' }, after: { status: 'activo', storeId } },
        timestamp: now,
      });
    });
  } catch (error) {
    if (cognitoWasEnabled && !(await hasOtherActiveMemberships(cognitoSub, storeId))) {
      await disableCognitoUser(cognitoSub).catch(() => undefined);
    }
    throw error;
  }
}

async function _updateUserProfile(
  cognitoSub: string,
  data: { displayName?: string; avatarUrl?: string },
): Promise<UserRoleRecord> {
  const currentUser = await requireAuth();
  validateSchema(updateUserProfileSchema, { cognitoSub, ...data }, 'updateUserProfile');

  // Users can only update their own profile — unless they have roles.manage
  if (currentUser.uid !== cognitoSub) {
    await requirePermission('roles.manage');
  }
  const { storeId } = await requireStoreScope();
  const targetUser = await getTenantUser(cognitoSub, storeId);
  if (!targetUser) {
    throw new Error('Usuario no encontrado en tu negocio.');
  }

  const safeData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.displayName !== undefined) {
    const sanitized = data.displayName.trim().slice(0, 100);
    if (sanitized.length === 0) throw new Error('El nombre no puede estar vacío');
    safeData.displayName = sanitized;
  }
  if (data.avatarUrl !== undefined) {
    safeData.avatarUrl = data.avatarUrl;
  }

  await db
    .update(userRoles)
    .set(safeData)
    .where(
      currentUser.uid === cognitoSub
        ? eq(userRoles.cognitoSub, cognitoSub)
        : and(eq(userRoles.cognitoSub, cognitoSub), eq(userRoles.storeId, storeId)),
    );
  if (currentUser.uid === cognitoSub) {
    await db
      .update(userIdentities)
      .set({
        ...(safeData.displayName !== undefined ? { displayName: String(safeData.displayName) } : {}),
        ...(safeData.avatarUrl !== undefined ? { avatarUrl: String(safeData.avatarUrl) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(userIdentities.cognitoSub, cognitoSub));
  }
  const rows = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.cognitoSub, cognitoSub),
        eq(userRoles.storeId, storeId),
      ),
    )
    .limit(1);
  if (rows.length === 0) throw new Error('User not found');
  return mapUserRole(rows[0]);
}

async function _authorizePin(
  pinCode: string,
  requiredPermission: PermissionKey,
  approvalContext?: SaleDiscountApprovalContext,
): Promise<{
  success: boolean;
  authorizedByUid?: string;
  userDisplayName?: string;
  approvalToken?: string;
  error?: string;
}> {
  // 1. Require an authenticated user with an active tenant assignment.
  const { user: currentUser, storeId } = await requireStoreScope();

  // 2. Rate limit PIN attempts (prevents brute force on 4-digit PINs)
  const rl = await checkRateLimitAsync(`pin:${storeId}:${currentUser.uid}`, PIN_RATE_LIMIT);
  if (!rl.allowed) {
    logger.warn('PIN rate limit exceeded', {
      action: 'authorizePin',
      userId: currentUser.uid,
    });
    return { success: false, error: 'Demasiados intentos. Espera unos minutos.' };
  }

  // 3. Validate PIN format (4-6 digits only)
  if (!/^\d{4,6}$/.test(pinCode)) {
    return { success: false, error: 'Formato de PIN inválido' };
  }

  try {
    // 4. Load users with PIN set — POS design: any authorized user can approve
    //    (e.g., manager authorizes discount on cashier terminal)
    const rows = await db
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.storeId, storeId),
          isNotNull(userRoles.pinCode),
          eq(userRoles.status, 'activo'),
        ),
      );

    // 5. Constant-time comparison across all PINs
    let matchedUser: (typeof rows)[number] | null = null;
    for (const row of rows) {
      if (row.pinCode && await verifyPin(pinCode, row.pinCode)) {
        matchedUser = row;
        // Don't break — continue iterating for constant-time behavior
      }
    }

    if (!matchedUser) {
      logger.warn('PIN authorization failed', {
        action: 'authorizePin',
        userId: currentUser.uid,
        requiredPermission,
      });
      return { success: false, error: 'PIN incorrecto' };
    }

    // 6. Check the matched user's permissions
    const userRoleDef = await getAccessibleRole(matchedUser.roleId, storeId);
    if (!userRoleDef) {
      return { success: false, error: 'Rol no encontrado' };
    }

    let perms: PermissionKey[] = [];
    if (typeof userRoleDef.permissions === 'string') {
      try {
        perms = JSON.parse(userRoleDef.permissions) as PermissionKey[];
      } catch {
        perms = [];
      }
    } else if (Array.isArray(userRoleDef.permissions)) {
      perms = userRoleDef.permissions as PermissionKey[];
    }

    const hasPermission = perms.includes(requiredPermission) || userRoleDef.name === 'Propietario';
    if (!hasPermission) {
      return { success: false, error: 'Usuario no tiene permisos para esta acción' };
    }

    let approvalToken: string | undefined;
    if (requiredPermission === 'sales.discount') {
      const parsedContext = saleDiscountApprovalContextSchema.safeParse(approvalContext);
      if (!parsedContext.success) {
        return { success: false, error: 'El contexto del descuento no es válido.' };
      }
      approvalToken = await issueSaleDiscountApproval({
        requesterUid: currentUser.uid,
        authorizedByUid: matchedUser.cognitoSub,
        storeId,
        context: parsedContext.data,
      });
    }

    logger.info('PIN authorization granted', {
      action: 'authorizePin',
      userId: currentUser.uid,
      authorizedBy: matchedUser.cognitoSub,
      requiredPermission,
    });

    return {
      success: true,
      authorizedByUid: matchedUser.cognitoSub,
      userDisplayName: matchedUser.displayName || matchedUser.email,
      approvalToken,
    };
  } catch (error) {
    logger.error('PIN authorization error', {
      action: 'authorizePin',
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Error del servidor al validar PIN' };
  }
}

// ==================== EXPORTS ====================

export const fetchRoleDefinitions = withLogging('role.fetchRoleDefinitions', _fetchRoleDefinitions);
export const createRoleDefinition = withLogging('role.createRoleDefinition', _createRoleDefinition);
export const updateRoleDefinition = withLogging('role.updateRoleDefinition', _updateRoleDefinition);
export const deleteRoleDefinition = withLogging('role.deleteRoleDefinition', _deleteRoleDefinition);
export const fetchUserRoles = withLogging('role.fetchUserRoles', _fetchUserRoles);
export const getUserRoleByUid = withLogging('role.getUserRoleByUid', _getUserRoleByUid);
export const updateUserPin = withLogging('role.updateUserPin', _updateUserPin);
export const updateUserRole = withLogging('role.updateUserRole', _updateUserRole);
export const generateGlobalId = withLogging('role.generateGlobalId', _generateGlobalId);
export const deactivateUser = withLogging('role.deactivateUser', _deactivateUser);
export const reactivateUser = withLogging('role.reactivateUser', _reactivateUser);
export const updateUserProfile = withLogging('role.updateUserProfile', _updateUserProfile);
export const authorizePin = withLogging('role.authorizePin', _authorizePin);
