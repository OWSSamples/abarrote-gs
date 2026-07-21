'use server';

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { setTenantTransactionContext } from '@/db/tenant-context';
import {
  auditLogs,
  roleDefinitions,
  storeConfig,
  stores,
  tenantInvitations,
  userIdentities,
  userRoles,
  userStoreAccess,
} from '@/db/schema';
import { checkRateLimitAsync } from '@/infrastructure/redis';
import { sendEmail } from '@/lib/email';
import { getAppUrl } from '@/lib/env';
import { AuthError, requireAuth, requirePermission } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';
import { withLogging, ValidationError } from '@/lib/errors';
import { escapeHtml } from '@/lib/text-escape';
import type { TenantInvitation } from '@/types';

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
const STORE_COOKIE = '__store_id';

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Ingresa un correo electrónico válido.');
  }
  return email;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function mapInvitation(row: typeof tenantInvitations.$inferSelect): TenantInvitation {
  return {
    id: row.id,
    storeId: row.storeId,
    email: row.email,
    roleId: row.roleId,
    status: row.status as TenantInvitation['status'],
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

async function getAllowedRole(roleId: string, storeId: string) {
  const [role] = await db
    .select({ id: roleDefinitions.id, name: roleDefinitions.name })
    .from(roleDefinitions)
    .where(
      and(
        eq(roleDefinitions.id, roleId),
        or(eq(roleDefinitions.isSystem, true), eq(roleDefinitions.storeId, storeId)),
      ),
    )
    .limit(1);

  if (!role) throw new ValidationError('El rol seleccionado no está disponible en este negocio.');
  if (role.name === 'Propietario') {
    throw new AuthError('El rol Propietario requiere un flujo explícito de transferencia.', 403);
  }
  return role;
}

async function _createTenantInvitation(input: {
  email: string;
  roleId: string;
}): Promise<TenantInvitation> {
  const actor = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const email = normalizeEmail(input.email);
  const emailRateKey = hashToken(email).slice(0, 24);
  const rateLimit = await checkRateLimitAsync(
    `tenant-invitation:${storeId}:${actor.uid}:${emailRateKey}`,
    { limit: 5, windowMs: 60 * 60_000 },
  );
  if (!rateLimit.allowed) {
    throw new AuthError('Espera antes de volver a enviar una invitación a este correo.', 429);
  }
  const role = await getAllowedRole(input.roleId, storeId);
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
  const invitationId = randomUUID();

  const [[tenant], [config]] = await Promise.all([
    db
      .select({ name: stores.name })
      .from(stores)
      .where(and(eq(stores.id, storeId), eq(stores.status, 'active'), isNull(stores.deletedAt)))
      .limit(1),
    db
      .select({ from: storeConfig.emailFrom, fromName: storeConfig.emailFromName, replyTo: storeConfig.emailReplyTo })
      .from(storeConfig)
      .where(eq(storeConfig.id, storeId))
      .limit(1),
  ]);
  if (!tenant) throw new AuthError('El negocio no está disponible para recibir usuarios.', 409);

  const [existingMember] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .innerJoin(userIdentities, eq(userIdentities.cognitoSub, userRoles.cognitoSub))
    .where(
      and(
        eq(userRoles.storeId, storeId),
        sql`lower(${userIdentities.email}) = ${email}`,
      ),
    )
    .limit(1);
  if (existingMember) {
    throw new AuthError('Este correo ya pertenece al equipo del negocio.', 409);
  }

  await db.transaction(async (tx) => {
    await setTenantTransactionContext(tx, storeId, actor.uid);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`tenant-invite:${storeId}:${email}`}))`);
    await tx
      .update(tenantInvitations)
      .set({ status: 'revoked', updatedAt: now })
      .where(
        and(
          eq(tenantInvitations.storeId, storeId),
          sql`lower(${tenantInvitations.email}) = ${email}`,
          eq(tenantInvitations.status, 'pending'),
        ),
      );
    await tx.insert(tenantInvitations).values({
      id: invitationId,
      storeId,
      email,
      roleId: role.id,
      tokenHash: hashToken(token),
      status: 'pending',
      invitedBy: actor.uid,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  });

  const acceptUrl = `${getAppUrl().replace(/\/$/, '')}/auth/accept-invitation?token=${encodeURIComponent(token)}`;
  const safeTenantName = escapeHtml(tenant.name);
  const safeRoleName = escapeHtml(role.name);
  const emailResult = await sendEmail(
    {
      to: email,
      subject: `Invitación para colaborar en ${tenant.name}`,
      text: `Te invitaron a colaborar en ${tenant.name} con el rol ${role.name}. La invitación vence en 48 horas: ${acceptUrl}`,
      html: `<p>Te invitaron a colaborar en <strong>${safeTenantName}</strong> con el rol <strong>${safeRoleName}</strong>.</p><p>La invitación vence en 48 horas.</p><p><a href="${escapeHtml(acceptUrl)}">Revisar invitación</a></p>`,
      replyTo: config?.replyTo || undefined,
    },
    config?.from || undefined,
    config?.fromName || tenant.name,
  );

  if (!emailResult.success) {
    await db
      .update(tenantInvitations)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(and(eq(tenantInvitations.id, invitationId), eq(tenantInvitations.storeId, storeId)));
    throw new AuthError(
      emailResult.error || 'No fue posible enviar la invitación en este momento.',
      503,
    );
  }

  await db.insert(auditLogs).values({
    id: randomUUID(),
    storeId,
    userId: actor.uid,
    userEmail: actor.email,
    action: 'create',
    entity: 'tenantInvitation',
    entityId: invitationId,
    changes: { after: { roleId: role.id, expiresAt: expiresAt.toISOString() } },
    timestamp: now,
  });

  const [created] = await db
    .select()
    .from(tenantInvitations)
    .where(eq(tenantInvitations.id, invitationId))
    .limit(1);
  if (!created) throw new Error('No fue posible recuperar la invitación creada.');
  return mapInvitation(created);
}

async function _getTenantInvitationPreview(token: string): Promise<{
  valid: boolean;
  tenantName?: string;
  email?: string;
  roleName?: string;
}> {
  if (!token || token.length > 256) return { valid: false };
  const [invitation] = await db
    .select({
      tenantName: stores.name,
      email: tenantInvitations.email,
      roleName: roleDefinitions.name,
    })
    .from(tenantInvitations)
    .innerJoin(stores, eq(stores.id, tenantInvitations.storeId))
    .innerJoin(roleDefinitions, eq(roleDefinitions.id, tenantInvitations.roleId))
    .where(
      and(
        eq(tenantInvitations.tokenHash, hashToken(token)),
        eq(tenantInvitations.status, 'pending'),
        gt(tenantInvitations.expiresAt, new Date()),
        eq(stores.status, 'active'),
        isNull(stores.deletedAt),
      ),
    )
    .limit(1);

  if (!invitation) return { valid: false };
  return {
    valid: true,
    tenantName: invitation.tenantName,
    email: maskEmail(invitation.email),
    roleName: invitation.roleName,
  };
}

async function _acceptTenantInvitation(token: string): Promise<{ storeId: string }> {
  const identity = await requireAuth();
  if (!token || token.length > 256) throw new ValidationError('La invitación no es válida.');
  const tokenHash = hashToken(token);
  const now = new Date();
  let acceptedStoreId = '';

  await db.transaction(async (tx) => {
    // The invitation itself determines the tenant only after it is locked and
    // validated below; use the authenticated identity for the actor context.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`tenant-invite-accept:${tokenHash}`}))`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`identity-membership:${identity.uid}`}))`);
    const [invitation] = await tx
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.tokenHash, tokenHash))
      .limit(1);

    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt <= now) {
      throw new ValidationError('La invitación venció, fue utilizada o ya no está disponible.');
    }
    if (normalizeEmail(identity.email) !== normalizeEmail(invitation.email)) {
      throw new AuthError('Inicia sesión con el correo al que se envió la invitación.', 403);
    }
    await setTenantTransactionContext(tx, invitation.storeId, identity.uid);

    const [tenant] = await tx
      .select({ id: stores.id })
      .from(stores)
      .where(
        and(
          eq(stores.id, invitation.storeId),
          eq(stores.status, 'active'),
          isNull(stores.deletedAt),
        ),
      )
      .limit(1);
    if (!tenant) throw new ValidationError('El negocio de esta invitación ya no está disponible.');

    const [existing] = await tx
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.cognitoSub, identity.uid),
          eq(userRoles.storeId, invitation.storeId),
        ),
      )
      .limit(1);

    if (!existing) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`tenant-user-capacity:${invitation.storeId}`}))`,
      );
      const [[config], [activeCount], [anyMembership]] = await Promise.all([
        tx
          .select({ estimatedUsers: storeConfig.estimatedUsers })
          .from(storeConfig)
          .where(eq(storeConfig.id, invitation.storeId))
          .limit(1),
        tx
          .select({ count: sql<number>`count(*)` })
          .from(userRoles)
          .where(and(eq(userRoles.storeId, invitation.storeId), eq(userRoles.status, 'activo'))),
        tx
          .select({ id: userRoles.id })
          .from(userRoles)
          .where(eq(userRoles.cognitoSub, identity.uid))
          .limit(1),
      ]);
      const limit = Math.max(1, Number(config?.estimatedUsers ?? 1));
      if (Number(activeCount?.count ?? 0) >= limit) {
        throw new AuthError(`El negocio alcanzó su límite de ${limit} usuario(s) activos.`, 409);
      }

      await tx.insert(userRoles).values({
        id: randomUUID(),
        cognitoSub: identity.uid,
        storeId: invitation.storeId,
        email: identity.email,
        displayName: identity.displayName || identity.email,
        employeeNumber: `USR-${randomBytes(4).toString('hex').toUpperCase()}`,
        roleId: invitation.roleId,
        status: 'activo',
        isDefault: !anyMembership,
        assignedBy: invitation.invitedBy,
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .insert(userStoreAccess)
        .values({
          userId: identity.uid,
          storeId: invitation.storeId,
          isDefault: !anyMembership,
          createdAt: now,
        })
        .onConflictDoNothing();
    }

    await tx
      .update(tenantInvitations)
      .set({
        status: 'accepted',
        acceptedBy: identity.uid,
        acceptedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(tenantInvitations.id, invitation.id),
          eq(tenantInvitations.status, 'pending'),
        ),
      );

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      storeId: invitation.storeId,
      userId: identity.uid,
      userEmail: identity.email,
      action: 'update',
      entity: 'tenantInvitation',
      entityId: invitation.id,
      changes: { after: { status: 'accepted', roleId: invitation.roleId } },
      timestamp: now,
    });
    acceptedStoreId = invitation.storeId;
  });

  const cookieStore = await cookies();
  cookieStore.set(STORE_COOKIE, acceptedStoreId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 12,
    priority: 'high',
  });
  return { storeId: acceptedStoreId };
}

async function _revokeTenantInvitation(invitationId: string): Promise<void> {
  const actor = await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const now = new Date();
  const [revoked] = await db
    .update(tenantInvitations)
    .set({ status: 'revoked', updatedAt: now })
    .where(
      and(
        eq(tenantInvitations.id, invitationId),
        eq(tenantInvitations.storeId, storeId),
        eq(tenantInvitations.status, 'pending'),
      ),
    )
    .returning({ id: tenantInvitations.id });
  if (!revoked) throw new ValidationError('La invitación no está disponible para revocarse.');

  await db.insert(auditLogs).values({
    id: randomUUID(),
    storeId,
    userId: actor.uid,
    userEmail: actor.email,
    action: 'update',
    entity: 'tenantInvitation',
    entityId: invitationId,
    changes: { after: { status: 'revoked' } },
    timestamp: now,
  });
}

async function _listTenantInvitations(): Promise<TenantInvitation[]> {
  await requirePermission('roles.manage');
  const { storeId } = await requireStoreScope();
  const now = new Date();
  await db
    .update(tenantInvitations)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        eq(tenantInvitations.storeId, storeId),
        eq(tenantInvitations.status, 'pending'),
        sql`${tenantInvitations.expiresAt} <= ${now}`,
      ),
    );
  const rows = await db
    .select()
    .from(tenantInvitations)
    .where(eq(tenantInvitations.storeId, storeId))
    .orderBy(sql`${tenantInvitations.createdAt} DESC`)
    .limit(100);
  return rows.map(mapInvitation);
}

export const createTenantInvitation = withLogging('tenantInvitation.create', _createTenantInvitation);
export const getTenantInvitationPreview = withLogging('tenantInvitation.preview', _getTenantInvitationPreview);
export const acceptTenantInvitation = withLogging('tenantInvitation.accept', _acceptTenantInvitation);
export const revokeTenantInvitation = withLogging('tenantInvitation.revoke', _revokeTenantInvitation);
export const listTenantInvitations = withLogging('tenantInvitation.list', _listTenantInvitations);
