'use server';

import { requireOwner, requirePermission, requireAuth, validateId } from '@/lib/auth/guard';
import { createCognitoUser } from '@/lib/cognito-admin';
import { db } from '@/db';
import { userRoles, roleDefinitions, auditLogs } from '@/db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import type { UserRoleRecord, RoleDefinition, PermissionKey } from '@/types';
import { DEFAULT_SYSTEM_ROLES } from '@/types';
import { randomBytes, scryptSync, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { checkRateLimit } from '@/infrastructure/redis';
import { withLogging } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  validateSchema,
  createRoleSchema,
  updateRoleSchema,
  assignUserRoleSchema,
  createUserWithRoleSchema,
  updateUserPinSchema,
  updateUserProfileSchema,
  idSchema,
} from '@/lib/validation/schemas';

// ==================== PIN RATE LIMITING ====================

/** Strict rate limit for PIN auth: 5 attempts per 5 minutes per IP */
const PIN_RATE_LIMIT = { maxRequests: 5, windowMs: 5 * 60_000 } as const;

// ==================== PIN HASHING (scrypt — async to avoid blocking event loop) ====================

const scryptAsync = promisify(scrypt);

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
  const hashBuf = Buffer.from(hash, 'hex');
  const supplied = await scryptAsync(pin, salt, 64) as Buffer;
  return timingSafeEqual(hashBuf, supplied);
}

// ==================== ROLE DEFINITIONS ====================

async function seedSystemRoles(): Promise<void> {
  const existing = await db.select().from(roleDefinitions);
  if (existing.length > 0) return;

  const now = new Date();
  for (const role of DEFAULT_SYSTEM_ROLES) {
    await db.insert(roleDefinitions).values({
      id: crypto.randomUUID(),
      name: role.name,
      description: role.description,
      permissions: JSON.stringify(role.permissions),
      isSystem: role.isSystem,
      createdBy: role.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function mapRoleDef(r: typeof roleDefinitions.$inferSelect): RoleDefinition {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: JSON.parse(r.permissions) as PermissionKey[],
    isSystem: r.isSystem,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function _fetchRoleDefinitions(): Promise<RoleDefinition[]> {
  await requirePermission('roles.manage');
  await seedSystemRoles();
  const rows = await db.select().from(roleDefinitions).orderBy(roleDefinitions.createdAt);
  return rows.map(mapRoleDef);
}

async function _createRoleDefinition(
  data: { name: string; description: string; permissions: PermissionKey[] },
  createdByUid: string,
): Promise<RoleDefinition> {
  await requirePermission('roles.manage');
  validateSchema(createRoleSchema, data, 'createRoleDefinition');
  validateSchema(idSchema, createdByUid, 'createRoleDefinition.createdByUid');
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(roleDefinitions).values({
    id,
    name: data.name,
    description: data.description,
    permissions: JSON.stringify(data.permissions),
    isSystem: false,
    createdBy: createdByUid,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    name: data.name,
    description: data.description,
    permissions: data.permissions,
    isSystem: false,
    createdBy: createdByUid,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

async function _updateRoleDefinition(
  id: string,
  data: { name?: string; description?: string; permissions?: PermissionKey[] },
): Promise<void> {
  await requirePermission('roles.manage');
  validateSchema(idSchema, id, 'updateRoleDefinition.id');
  validateSchema(updateRoleSchema, data, 'updateRoleDefinition');

  // System roles can only be modified by the owner
  const existing = await db.select().from(roleDefinitions).where(eq(roleDefinitions.id, id));
  if (existing.length > 0 && existing[0].isSystem) {
    await requireOwner();
  }

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.permissions !== undefined) updates.permissions = JSON.stringify(data.permissions);
  await db.update(roleDefinitions).set(updates).where(eq(roleDefinitions.id, id));
}

async function _deleteRoleDefinition(id: string): Promise<void> {
  await requireOwner();
  validateId(id, 'Role ID');
  const rows = await db.select().from(roleDefinitions).where(eq(roleDefinitions.id, id));
  if (rows.length > 0 && rows[0].isSystem) {
    throw new Error('No se pueden eliminar roles del sistema');
  }
  await db.delete(roleDefinitions).where(eq(roleDefinitions.id, id));
}

// ==================== USER ROLES ====================

function mapUserRole(r: typeof userRoles.$inferSelect): UserRoleRecord {
  return {
    id: r.id,
    cognitoSub: r.cognitoSub,
    email: r.email,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    employeeNumber: r.employeeNumber,
    globalId: r.globalId ?? undefined,
    status: (r.status as 'activo' | 'baja') || 'activo',
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
  const rows = await db.select().from(userRoles).orderBy(userRoles.createdAt);
  return rows.map(mapUserRole);
}

async function _getUserRoleByUid(cognitoSub: string): Promise<UserRoleRecord | null> {
  await requireAuth();
  const rows = await db.select().from(userRoles).where(eq(userRoles.cognitoSub, cognitoSub));
  if (rows.length === 0) return null;
  return mapUserRole(rows[0]);
}

async function _ensureOwnerRole(cognitoSub: string, email: string, displayName: string): Promise<UserRoleRecord> {
  await seedSystemRoles();

  const allDefs = await db.select().from(roleDefinitions);
  const ownerDef = allDefs.find((d) => d.isSystem && d.name === 'Propietario');
  const viewerDef = allDefs.find((d) => d.isSystem && d.name === 'Solo lectura');

  if (!ownerDef || !viewerDef) throw new Error('System roles not found');

  // Check if this specific user already exists first (fast path)
  const existingUser = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.cognitoSub, cognitoSub))
    .limit(1);

  if (existingUser.length > 0) {
    const userRow = existingUser[0];
    if (!userRow.employeeNumber) {
      const allUsers = await db.select().from(userRoles);
      const idx = allUsers.findIndex((r) => r.id === userRow.id) + 1;
      const empNum = `3226${String(idx).padStart(2, '0')}`;
      await db
        .update(userRoles)
        .set({ employeeNumber: empNum, updatedAt: new Date() })
        .where(eq(userRoles.id, userRow.id));
      userRow.employeeNumber = empNum;
    }
    return mapUserRole(userRow);
  }

  const existing = await db.select().from(userRoles);

  const nextNum = existing.length + 1;
  const employeeNumber = `3226${String(nextNum).padStart(2, '0')}`;
  const isFirstUser = existing.length === 0;
  const roleId = isFirstUser ? ownerDef.id : viewerDef.id;
  const assignedBy = isFirstUser ? cognitoSub : 'system';

  const id = crypto.randomUUID();
  const now = new Date();

  // Use ON CONFLICT to handle race condition: if two requests arrive
  // simultaneously for the same Cognito user, only one INSERT succeeds.
  // The loser gets the existing row via RETURNING or a follow-up SELECT.
  try {
    await db.insert(userRoles).values({
      id,
      cognitoSub,
      email,
      displayName: displayName || '',
      employeeNumber,
      roleId,
      assignedBy,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    // Duplicate key — concurrent request already inserted this user
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
      const retryRow = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.cognitoSub, cognitoSub))
        .limit(1);
      if (retryRow.length > 0) return mapUserRole(retryRow[0]);
    }
    throw err;
  }

  return {
    id,
    cognitoSub,
    email,
    displayName: displayName || '',
    avatarUrl: '',
    employeeNumber,
    status: 'activo' as const,
    roleId,
    assignedBy,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

async function _assignUserRole(
  data: { cognitoSub: string; email: string; displayName: string; roleId: string },
  assignedByUid: string,
): Promise<UserRoleRecord> {
  await requirePermission('roles.manage');
  validateSchema(assignUserRoleSchema, data, 'assignUserRole');
  validateSchema(idSchema, assignedByUid, 'assignUserRole.assignedByUid');
  const existingRows = await db.select().from(userRoles).where(eq(userRoles.cognitoSub, data.cognitoSub));

  if (existingRows.length > 0) {
    const now = new Date();
    await db
      .update(userRoles)
      .set({
        roleId: data.roleId,
        displayName: data.displayName,
        email: data.email,
        updatedAt: now,
        assignedBy: assignedByUid,
      })
      .where(eq(userRoles.cognitoSub, data.cognitoSub));
    return {
      id: existingRows[0].id,
      cognitoSub: data.cognitoSub,
      email: data.email,
      displayName: data.displayName,
      avatarUrl: existingRows[0].avatarUrl,
      employeeNumber: existingRows[0].employeeNumber,
      status: (existingRows[0].status as 'activo' | 'baja') || 'activo',
      roleId: data.roleId,
      assignedBy: assignedByUid,
      createdAt: existingRows[0].createdAt.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  const allUsers = await db.select().from(userRoles);
  const empNum = `3226${String(allUsers.length + 1).padStart(2, '0')}`;

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(userRoles).values({
    id,
    cognitoSub: data.cognitoSub,
    email: data.email,
    displayName: data.displayName || '',
    employeeNumber: empNum,
    roleId: data.roleId,
    status: 'activo',
    assignedBy: assignedByUid,
    createdAt: now,
    updatedAt: now,
  });

  // Audit log — role assignment
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: assignedByUid,
    userEmail: data.email,
    action: 'create',
    entity: 'userRole',
    entityId: data.cognitoSub,
    changes: { after: { roleId: data.roleId, status: 'activo' } },
    timestamp: now,
  });

  return {
    id,
    cognitoSub: data.cognitoSub,
    email: data.email,
    displayName: data.displayName || '',
    avatarUrl: '',
    employeeNumber: empNum,
    status: 'activo' as const,
    roleId: data.roleId,
    assignedBy: assignedByUid,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

async function _createCognitoUserWithRole(
  data: { email: string; password?: string; displayName: string; roleId: string; pinCode?: string },
  assignedByUid: string,
): Promise<UserRoleRecord> {
  await requirePermission('roles.manage');
  validateSchema(createUserWithRoleSchema, data, 'createCognitoUserWithRole');
  validateSchema(idSchema, assignedByUid, 'createCognitoUserWithRole.assignedByUid');

  const userRecord = await createCognitoUser({
    email: data.email,
    password: data.password || 'Temp1234!',
    displayName: data.displayName,
  });

  const newRole = await assignUserRole(
    {
      cognitoSub: userRecord.uid,
      email: data.email,
      displayName: data.displayName,
      roleId: data.roleId,
    },
    assignedByUid,
  );

  if (data.pinCode) {
    await updateUserPin(userRecord.uid, data.pinCode);
  }

  return newRole;
}

async function _updateUserPin(cognitoSub: string, pinCode: string): Promise<void> {
  const currentUser = await requirePermission('roles.manage');
  validateSchema(updateUserPinSchema, { cognitoSub, pinCode }, 'updateUserPin');
  const hashed = await hashPin(pinCode);
  const now = new Date();
  await db.update(userRoles).set({ pinCode: hashed, updatedAt: now }).where(eq(userRoles.cognitoSub, cognitoSub));

  // Audit log — PIN change (never log the actual PIN)
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: currentUser.uid,
    userEmail: currentUser.email ?? 'system',
    action: 'update',
    entity: 'userRole',
    entityId: cognitoSub,
    changes: { after: { pinChanged: true } },
    timestamp: now,
  });
}

async function _updateUserRole(cognitoSub: string, newRoleId: string, assignedByUid: string): Promise<void> {
  await requirePermission('roles.manage');

  // Capture previous state for audit trail
  const existing = await db.select().from(userRoles).where(eq(userRoles.cognitoSub, cognitoSub));
  const previousRoleId = existing.length > 0 ? existing[0].roleId : null;

  const now = new Date();
  await db
    .update(userRoles)
    .set({ roleId: newRoleId, updatedAt: now, assignedBy: assignedByUid })
    .where(eq(userRoles.cognitoSub, cognitoSub));

  // Audit log — critical for compliance
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: assignedByUid,
    userEmail: 'system',
    action: 'update',
    entity: 'userRole',
    entityId: cognitoSub,
    changes: { before: { roleId: previousRoleId }, after: { roleId: newRoleId } },
    timestamp: now,
  });

  logger.info('User role updated', {
    action: 'updateUserRole',
    userId: assignedByUid,
    targetUser: cognitoSub,
    previousRoleId: previousRoleId ?? 'none',
    newRoleId,
  });
}

async function _removeUserRole(cognitoSub: string): Promise<void> {
  const currentUser = await requireOwner();

  // Capture previous state for audit
  const existing = await db.select().from(userRoles).where(eq(userRoles.cognitoSub, cognitoSub));
  const prev = existing[0] ?? null;

  await db.delete(userRoles).where(eq(userRoles.cognitoSub, cognitoSub));

  // Audit log — role removal
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: currentUser.uid,
    userEmail: currentUser.email ?? 'system',
    action: 'delete',
    entity: 'userRole',
    entityId: cognitoSub,
    changes: prev ? { before: { roleId: prev.roleId, email: prev.email, status: prev.status } } : {},
    timestamp: new Date(),
  });
}

async function _generateGlobalId(cognitoSub: string): Promise<string> {
  const currentUser = await requirePermission('roles.manage');
  const rows = await db.select().from(userRoles).where(eq(userRoles.cognitoSub, cognitoSub));
  if (rows.length === 0) throw new Error('Usuario no encontrado');
  if (rows[0].globalId) throw new Error('Este usuario ya tiene un Global ID asignado. No se puede generar otro.');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const allWithGlobalId = await db.select().from(userRoles);
  const existingIds = new Set(allWithGlobalId.map((r) => r.globalId).filter(Boolean));
  let seq = existingIds.size + 1;
  let globalId = `GID-${dateStr}-${String(seq).padStart(4, '0')}`;
  while (existingIds.has(globalId)) {
    seq++;
    globalId = `GID-${dateStr}-${String(seq).padStart(4, '0')}`;
  }

  await db.update(userRoles).set({ globalId, updatedAt: now }).where(eq(userRoles.cognitoSub, cognitoSub));

  // Audit log — Global ID generation
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: currentUser.uid,
    userEmail: currentUser.email ?? 'system',
    action: 'update',
    entity: 'userRole',
    entityId: cognitoSub,
    changes: { after: { globalId } },
    timestamp: now,
  });

  return globalId;
}

async function _deactivateUser(cognitoSub: string): Promise<void> {
  const currentUser = await requireOwner();
  const rows = await db.select().from(userRoles).where(eq(userRoles.cognitoSub, cognitoSub));
  if (rows.length === 0) throw new Error('Usuario no encontrado');
  if (rows[0].status === 'baja') throw new Error('Este usuario ya está dado de baja');

  const now = new Date();
  await db
    .update(userRoles)
    .set({ status: 'baja', deactivatedAt: now, updatedAt: now })
    .where(eq(userRoles.cognitoSub, cognitoSub));

  // Audit log — user deactivation
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: currentUser.uid,
    userEmail: currentUser.email ?? 'system',
    action: 'update',
    entity: 'userRole',
    entityId: cognitoSub,
    changes: { before: { status: 'activo' }, after: { status: 'baja' } },
    timestamp: now,
  });
}

async function _reactivateUser(cognitoSub: string): Promise<void> {
  const currentUser = await requireOwner();
  const rows = await db.select().from(userRoles).where(eq(userRoles.cognitoSub, cognitoSub));
  if (rows.length === 0) throw new Error('Usuario no encontrado');
  if (rows[0].status === 'activo') throw new Error('Este usuario ya está activo');

  const now = new Date();
  await db
    .update(userRoles)
    .set({ status: 'activo', deactivatedAt: null, updatedAt: now })
    .where(eq(userRoles.cognitoSub, cognitoSub));

  // Audit log — user reactivation
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: currentUser.uid,
    userEmail: currentUser.email ?? 'system',
    action: 'update',
    entity: 'userRole',
    entityId: cognitoSub,
    changes: { before: { status: 'baja' }, after: { status: 'activo' } },
    timestamp: now,
  });
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

  const safeData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.displayName !== undefined) {
    const sanitized = data.displayName.trim().slice(0, 100);
    if (sanitized.length === 0) throw new Error('El nombre no puede estar vacío');
    safeData.displayName = sanitized;
  }
  if (data.avatarUrl !== undefined) {
    safeData.avatarUrl = data.avatarUrl;
  }

  await db.update(userRoles).set(safeData).where(eq(userRoles.cognitoSub, cognitoSub));
  const rows = await db.select().from(userRoles).where(eq(userRoles.cognitoSub, cognitoSub));
  if (rows.length === 0) throw new Error('User not found');
  return mapUserRole(rows[0]);
}

async function _authorizePin(
  pinCode: string,
  requiredPermission: PermissionKey,
): Promise<{ success: boolean; authorizedByUid?: string; userDisplayName?: string; error?: string }> {
  // 1. Require authenticated session first
  const currentUser = await requireAuth();

  // 2. Rate limit PIN attempts (prevents brute force on 4-digit PINs)
  const rl = checkRateLimit(`pin:${currentUser.uid}`, PIN_RATE_LIMIT);
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
    const rows = await db.select().from(userRoles).where(isNotNull(userRoles.pinCode));

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
    const roles = await db.select().from(roleDefinitions).where(eq(roleDefinitions.id, matchedUser.roleId));
    if (roles.length === 0) {
      return { success: false, error: 'Rol no encontrado' };
    }

    const userRoleDef = roles[0];
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
export const ensureOwnerRole = withLogging('role.ensureOwnerRole', _ensureOwnerRole);
export const assignUserRole = withLogging('role.assignUserRole', _assignUserRole);
export const createCognitoUserWithRole = withLogging('role.createCognitoUserWithRole', _createCognitoUserWithRole);
export const updateUserPin = withLogging('role.updateUserPin', _updateUserPin);
export const updateUserRole = withLogging('role.updateUserRole', _updateUserRole);
export const removeUserRole = withLogging('role.removeUserRole', _removeUserRole);
export const generateGlobalId = withLogging('role.generateGlobalId', _generateGlobalId);
export const deactivateUser = withLogging('role.deactivateUser', _deactivateUser);
export const reactivateUser = withLogging('role.reactivateUser', _reactivateUser);
export const updateUserProfile = withLogging('role.updateUserProfile', _updateUserProfile);
export const authorizePin = withLogging('role.authorizePin', _authorizePin);
