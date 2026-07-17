'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { setTenantTransactionContext } from '@/db/tenant-context';
import { auditLogs, roleDefinitions, stores, userRoles } from '@/db/schema';
import { AuthError, requireOwner, validateId } from '@/lib/auth/guard';
import { requirePlatformAdministrator } from '@/lib/auth/platform-admin';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { withLogging, ValidationError } from '@/lib/errors';
import type { TenantStatus } from '@/types';

interface TransferOwnershipInput {
  targetCognitoSub: string;
  previousOwnerRoleId: string;
}

interface UpdateTenantStatusInput {
  storeId: string;
  status: TenantStatus;
  reason: string;
}

async function _transferTenantOwnership(input: TransferOwnershipInput): Promise<void> {
  const actor = await requireOwner();
  const { storeId } = await requireStoreScope();
  const targetCognitoSub = validateId(input.targetCognitoSub, 'Usuario destino');
  const fallbackRoleId = validateId(input.previousOwnerRoleId, 'Rol del propietario anterior');
  if (targetCognitoSub === actor.uid) {
    throw new ValidationError('Selecciona otro miembro activo para transferir la propiedad.');
  }

  await db.transaction(async (tx) => {
    await setTenantTransactionContext(tx, storeId, actor.uid);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`tenant-owner:${storeId}`}))`);

    const [[ownerRole], [fallbackRole], [currentOwner], [target]] = await Promise.all([
      tx
        .select({ id: roleDefinitions.id })
        .from(roleDefinitions)
        .where(and(eq(roleDefinitions.name, 'Propietario'), eq(roleDefinitions.isSystem, true)))
        .limit(1),
      tx
        .select({ id: roleDefinitions.id, name: roleDefinitions.name })
        .from(roleDefinitions)
        .where(
          and(
            eq(roleDefinitions.id, fallbackRoleId),
            or(eq(roleDefinitions.isSystem, true), eq(roleDefinitions.storeId, storeId)),
          ),
        )
        .limit(1),
      tx
        .select({ id: userRoles.id, roleId: userRoles.roleId })
        .from(userRoles)
        .where(
          and(
            eq(userRoles.cognitoSub, actor.uid),
            eq(userRoles.storeId, storeId),
            eq(userRoles.status, 'activo'),
          ),
        )
        .limit(1),
      tx
        .select({ id: userRoles.id, roleId: userRoles.roleId })
        .from(userRoles)
        .where(
          and(
            eq(userRoles.cognitoSub, targetCognitoSub),
            eq(userRoles.storeId, storeId),
            eq(userRoles.status, 'activo'),
          ),
        )
        .limit(1),
    ]);

    if (!ownerRole || !currentOwner || currentOwner.roleId !== ownerRole.id) {
      throw new AuthError('La membresía propietaria actual no es válida.', 409);
    }
    if (!target) throw new ValidationError('El nuevo propietario debe ser un miembro activo del negocio.');
    if (!fallbackRole || fallbackRole.name === 'Propietario') {
      throw new ValidationError('Asigna al propietario anterior un rol distinto de Propietario.');
    }

    const now = new Date();
    // Promote first so the final-owner trigger never observes a tenant without owner.
    await tx
      .update(userRoles)
      .set({ roleId: ownerRole.id, assignedBy: actor.uid, updatedAt: now })
      .where(and(eq(userRoles.id, target.id), eq(userRoles.storeId, storeId)));
    await tx
      .update(userRoles)
      .set({ roleId: fallbackRole.id, assignedBy: actor.uid, updatedAt: now })
      .where(and(eq(userRoles.id, currentOwner.id), eq(userRoles.storeId, storeId)));

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      storeId,
      userId: actor.uid,
      userEmail: actor.email,
      action: 'update',
      entity: 'tenantOwnership',
      entityId: storeId,
      changes: {
        before: { ownerCognitoSub: actor.uid },
        after: { ownerCognitoSub: targetCognitoSub, previousOwnerRoleId: fallbackRole.id },
      },
      timestamp: now,
    });
  });
}

async function _updateTenantStatus(input: UpdateTenantStatusInput): Promise<void> {
  const administrator = await requirePlatformAdministrator();
  const storeId = validateId(input.storeId, 'Tenant');
  const reason = input.reason.trim();
  if (!['active', 'suspended', 'archived'].includes(input.status)) {
    throw new ValidationError('El estado solicitado no es válido.');
  }
  if (reason.length < 10 || reason.length > 500) {
    throw new ValidationError('Documenta el motivo con entre 10 y 500 caracteres.');
  }

  await db.transaction(async (tx) => {
    await setTenantTransactionContext(tx, storeId, administrator.uid);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`tenant-lifecycle:${storeId}`}))`);

    const [tenant] = await tx
      .select({ id: stores.id, status: stores.status })
      .from(stores)
      .where(and(eq(stores.id, storeId), isNull(stores.deletedAt)))
      .limit(1);
    if (!tenant) throw new ValidationError('El negocio solicitado no existe.');
    if (tenant.status === 'archived' && input.status !== 'archived') {
      throw new AuthError('Un negocio archivado no puede reactivarse desde este flujo.', 409);
    }
    if (tenant.status === input.status) return;

    const now = new Date();
    const [updated] = await tx
      .update(stores)
      .set({
        status: input.status,
        suspendedAt: input.status === 'suspended' ? now : null,
        archivedAt: input.status === 'archived' ? now : null,
      })
      .where(and(eq(stores.id, storeId), eq(stores.status, tenant.status), isNull(stores.deletedAt)))
      .returning({ id: stores.id });
    if (!updated) throw new AuthError('El estado cambió durante la operación. Intenta de nuevo.', 409);

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      storeId,
      userId: administrator.uid,
      userEmail: administrator.email,
      action: 'update',
      entity: 'tenantLifecycle',
      entityId: storeId,
      changes: { before: { status: tenant.status }, after: { status: input.status, reason } },
      timestamp: now,
    });
  });
}

export const transferTenantOwnership = withLogging('tenant.transferOwnership', _transferTenantOwnership);
export const updateTenantStatus = withLogging('tenant.updateStatus', _updateTenantStatus);
