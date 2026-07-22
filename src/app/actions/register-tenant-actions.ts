'use server';

import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  auditLogs,
  roleDefinitions,
  storeConfig,
  stores,
  tenantMemberships,
  tenants,
  userRoles,
  userStoreAccess,
} from '@/db/schema';
import { checkRateLimitAsync } from '@/infrastructure/redis/rate-limit';
import { AuthError, requireAuth, requireCurrentAccessJwt } from '@/lib/auth/guard';
import { listCognitoUsers } from '@/lib/cognito-admin';
import { withLogging, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { assertHumanRequest } from '@/lib/security/bot-protection';
import { fetchAndSyncTenantEntitlements } from '@/server/billing-entitlement-service';
import { handleUserSignupWorkflow } from '@/workflows/handle-user-signup';
import { start } from 'workflow/api';

const STORE_COOKIE = '__store_id';
const SUPPORTED_BUSINESS_TYPES = new Set(['miscelania', 'abarrotes', 'ropa', 'comida_rapida', 'otro_retail']);

function normalizeTenantName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

function normalizeText(value: string | undefined, maxLength: number): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeCountry(value: string | undefined): string {
  const country = normalizeText(value, 2).toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : 'MX';
}

function normalizeEmail(value: string | undefined): string | undefined {
  const email = normalizeText(value, 180).toLowerCase();
  if (!email) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('El correo de contacto no es válido.');
  }
  return email;
}

function normalizePhone(value: string | undefined): string {
  const phone = normalizeText(value, 32);
  if (phone.length < 8) {
    throw new ValidationError('Ingresa un teléfono de contacto válido.');
  }
  if (!/^[0-9+()\-\s.]+$/.test(phone)) {
    throw new ValidationError('El teléfono solo puede contener números, espacios y símbolos telefónicos.');
  }
  return phone;
}

function normalizeLogo(value: string | undefined): string | undefined {
  const logo = value?.trim();
  if (!logo) return undefined;
  if (logo.length > 300_000) {
    throw new ValidationError('El logo es demasiado grande. Usa una imagen menor a 200 KB.');
  }
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(logo)) {
    throw new ValidationError('El logo debe ser una imagen PNG, JPG o WebP.');
  }
  return logo;
}

function normalizeBusinessType(value: string | undefined): string {
  const businessType = normalizeText(value, 40).toLowerCase();
  if (!SUPPORTED_BUSINESS_TYPES.has(businessType)) {
    throw new ValidationError('Selecciona un tipo de negocio soportado.');
  }
  return businessType;
}

function normalizeEstimatedUsers(value: number | undefined): number {
  const users = Number.isFinite(value) ? Math.trunc(value as number) : 1;
  if (users < 1 || users > 500) {
    throw new ValidationError('El número de usuarios debe estar entre 1 y 500.');
  }
  return users;
}

function createTenantId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string }; message?: string };
  return candidate.code === '23505' || candidate.cause?.code === '23505' || candidate.message?.includes('duplicate key') === true;
}

async function storeNameExists(tenantName: string): Promise<boolean> {
  const [existingStore] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(sql`lower(${stores.name}) = lower(${tenantName})`, isNull(stores.deletedAt)))
    .limit(1);

  return Boolean(existingStore);
}

async function findActiveTenantForUser(
  userId: string,
  preferredStoreId?: string,
): Promise<{ id: string; tenantId: string; name: string } | null> {
  const [tenant] = await db
    .select({ id: stores.id, tenantId: stores.tenantId, name: stores.name })
    .from(userRoles)
    .innerJoin(stores, eq(stores.id, userRoles.storeId))
    .innerJoin(tenants, eq(tenants.id, stores.tenantId))
    .innerJoin(
      tenantMemberships,
      and(
        eq(tenantMemberships.tenantId, stores.tenantId),
        eq(tenantMemberships.cognitoSub, userRoles.cognitoSub),
      ),
    )
    .where(
      and(
        eq(userRoles.cognitoSub, userId),
        eq(userRoles.status, 'activo'),
        eq(tenantMemberships.status, 'active'),
        eq(tenants.status, 'active'),
        eq(stores.status, 'active'),
        isNull(stores.deletedAt),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${stores.id} = ${preferredStoreId ?? ''} THEN 0 ELSE 1 END`,
      sql`${userRoles.isDefault} DESC`,
      userRoles.createdAt,
    )
    .limit(1);

  return tenant ?? null;
}

interface RegistrationPreflightInput {
  tenantName: string;
  email: string;
}

interface RegistrationPreflightResult {
  allowed: boolean;
  tenantNameAvailable: boolean;
  identityExists: boolean;
  retryAfterSeconds?: number;
}

interface PendingSignupVerificationInput {
  email: string;
}

interface PendingSignupVerificationResult {
  status: 'pending' | 'confirmed' | 'not_found' | 'disabled' | 'rate_limited';
  username?: string;
  email?: string;
  retryAfterSeconds?: number;
}

function escapeCognitoFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function getRegistrationClientIp(): Promise<string> {
  const headerStore = await headers();
  return (
    headerStore.get('cf-connecting-ip') ||
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip') ||
    'unknown'
  );
}

async function _checkRegistrationPreflight(
  input: RegistrationPreflightInput,
): Promise<RegistrationPreflightResult> {
  await assertHumanRequest();
  const tenantName = normalizeTenantName(input.tenantName);
  const email = normalizeEmail(input.email);

  if (tenantName.length < 2) {
    throw new ValidationError('El nombre del negocio debe tener al menos 2 caracteres.');
  }
  if (!email) {
    throw new ValidationError('El correo para iniciar sesión no es válido.');
  }

  const clientIp = await getRegistrationClientIp();
  const emailFingerprint = crypto.createHash('sha256').update(email).digest('hex').slice(0, 24);
  const rateLimit = await checkRateLimitAsync(
    `auth:registration:${clientIp}:${emailFingerprint}`,
    { limit: 10, windowMs: 30 * 60_000 },
  );

  if (!rateLimit.allowed) {
    return {
      allowed: false,
      tenantNameAvailable: false,
      identityExists: false,
      retryAfterSeconds: Math.max(1, Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000)),
    };
  }

  const existingIdentities = await listCognitoUsers({
    limit: 3,
    filter: `email = "${escapeCognitoFilterValue(email)}"`,
  });
  const identityExists = existingIdentities.users.some(
    (candidate) => candidate.email.trim().toLowerCase() === email,
  );

  return {
    allowed: true,
    tenantNameAvailable: !(await storeNameExists(tenantName)),
    identityExists,
  };
}

export const checkRegistrationPreflight = withLogging(
  'auth.checkRegistrationPreflight',
  _checkRegistrationPreflight,
);

async function _preparePendingSignupVerification(
  input: PendingSignupVerificationInput,
): Promise<PendingSignupVerificationResult> {
  await assertHumanRequest();
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new ValidationError('Ingresa un correo válido para continuar el registro.');
  }

  const clientIp = await getRegistrationClientIp();
  const emailFingerprint = crypto.createHash('sha256').update(email).digest('hex').slice(0, 24);
  const rateLimit = await checkRateLimitAsync(
    `auth:registration_verify:${clientIp}:${emailFingerprint}`,
    { limit: 6, windowMs: 30 * 60_000 },
  );

  if (!rateLimit.allowed) {
    return {
      status: 'rate_limited',
      retryAfterSeconds: Math.max(1, Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000)),
    };
  }

  const users = await listCognitoUsers({
    limit: 2,
    filter: `email = "${escapeCognitoFilterValue(email)}"`,
  });
  const user = users.users.find((candidate) => candidate.email.toLowerCase() === email);

  if (!user) {
    return { status: 'not_found' };
  }

  if (!user.enabled) {
    return { status: 'disabled' };
  }

  if (user.status === 'UNCONFIRMED') {
    return {
      status: 'pending',
      username: user.username,
      email: user.email,
    };
  }

  return { status: 'confirmed', email: user.email };
}

export const preparePendingSignupVerification = withLogging(
  'auth.preparePendingSignupVerification',
  _preparePendingSignupVerification,
);

async function _getCurrentTenantRegistrationStatus(): Promise<{
  hasTenant: boolean;
  email: string;
}> {
  const user = await requireAuth();
  const tenant = await findActiveTenantForUser(user.uid);
  return { hasTenant: tenant !== null, email: user.email };
}

export const getCurrentTenantRegistrationStatus = withLogging(
  'auth.getCurrentTenantRegistrationStatus',
  _getCurrentTenantRegistrationStatus,
);

interface ProvisionRegisteredTenantInput {
  tenantName: string;
  country: string;
  businessType: string;
  businessTypeOther?: string;
  contactEmail?: string;
  phone: string;
  taxId?: string;
  taxRegime?: string;
  taxRegimeDescription?: string;
  estimatedUsers: number;
  logoDataUrl?: string;
  mode?: 'initial' | 'additional';
}

async function _provisionRegisteredTenant(
  input: ProvisionRegisteredTenantInput,
): Promise<{ tenantId: string; storeId: string; tenantName: string }> {
  await assertHumanRequest();
  const user = await requireAuth();
  const tenantName = normalizeTenantName(input.tenantName);
  const country = normalizeCountry(input.country);
  const businessType = normalizeBusinessType(input.businessType);
  const businessTypeOther = businessType === 'otro_retail' ? normalizeText(input.businessTypeOther, 80) : '';
  const contactEmail = normalizeEmail(input.contactEmail) ?? user.email;
  const phone = normalizePhone(input.phone);
  const estimatedUsers = normalizeEstimatedUsers(input.estimatedUsers);
  const logoUrl = normalizeLogo(input.logoDataUrl);
  const taxId = normalizeText(input.taxId, 32).toUpperCase();
  const taxRegime = normalizeText(input.taxRegime, 60);
  const taxRegimeDescription = normalizeText(input.taxRegimeDescription, 120);

  if (tenantName.length < 2) {
    throw new ValidationError('El nombre del negocio debe tener al menos 2 caracteres.');
  }
  if (businessType === 'otro_retail' && businessTypeOther.length < 3) {
    throw new ValidationError('Describe el tipo de negocio.');
  }
  if (country === 'MX') {
    if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(taxId)) {
      throw new ValidationError('Ingresa un RFC válido para México.');
    }
    if (!taxRegime) {
      throw new ValidationError('Selecciona o captura el régimen fiscal.');
    }
  } else if (!taxId || !taxRegime) {
    throw new ValidationError('Captura el identificador fiscal y régimen tributario del país.');
  }

  const cookieStore = await cookies();
  const preferredStoreId = cookieStore.get(STORE_COOKIE)?.value;
  const existingUserStore = await findActiveTenantForUser(user.uid, preferredStoreId);
  const additionalEntitlements = existingUserStore && input.mode === 'additional'
    ? await fetchAndSyncTenantEntitlements(
        existingUserStore.tenantId,
        await requireCurrentAccessJwt(),
      )
    : [];
  const maxStores = additionalEntitlements.find((item) => item.code === 'max_stores')?.value
    ?? null;

  if (existingUserStore && input.mode !== 'additional') {
    if (normalizeTenantName(existingUserStore.name).toLowerCase() === tenantName.toLowerCase()) {
      cookieStore.set(STORE_COOKIE, existingUserStore.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
      return {
        tenantId: existingUserStore.tenantId,
        storeId: existingUserStore.id,
        tenantName: existingUserStore.name,
      };
    }

    throw new AuthError(
      'Esta cuenta ya pertenece a un negocio. Inicia sesión y usa "Crear otro negocio" para agregar otro negocio al workspace.',
      409,
    );
  }

  const provisionLimit = await checkRateLimitAsync(
    `tenant:provision:${user.uid}`,
    { limit: 5, windowMs: 60 * 60_000 },
  );
  if (!provisionLimit.allowed) {
    throw new AuthError('Alcanzaste el límite temporal de creación de negocios. Intenta más tarde.', 429);
  }

  if (await storeNameExists(tenantName)) {
    throw new ValidationError('Ese nombre de tienda ya está registrado. Elige otro nombre.');
  }

  const [ownerRole] = await db
    .select({ id: roleDefinitions.id })
    .from(roleDefinitions)
    .where(and(eq(roleDefinitions.name, 'Propietario'), eq(roleDefinitions.isSystem, true)))
    .limit(1);

  if (!ownerRole) {
    throw new Error('Los roles del sistema no están inicializados.');
  }

  const tenantId = existingUserStore?.tenantId ?? createTenantId();
  const storeId = createTenantId();
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`tenant-provision:${user.uid}`}))`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`identity-membership:${user.uid}`}))`);

      if (existingUserStore && input.mode === 'additional' && maxStores !== null) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`tenant-store-capacity:${tenantId}`}))`);
        const [activeStores] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(stores)
          .where(
            and(
              eq(stores.tenantId, tenantId),
              eq(stores.status, 'active'),
              isNull(stores.deletedAt),
            ),
          );
        if (Number(activeStores?.count ?? 0) >= maxStores) {
          throw new AuthError(
            `Tu plan permite ${maxStores} negocio(s) activo(s).`,
            409,
          );
        }
      }

      const [concurrentAccess] = await tx
        .select({ storeId: userRoles.storeId })
        .from(userRoles)
        .where(and(eq(userRoles.cognitoSub, user.uid), eq(userRoles.status, 'activo')))
        .limit(1);
      if (concurrentAccess && input.mode !== 'additional') {
        throw new ValidationError('Tu cuenta ya está vinculada a un negocio. Actualiza la página para continuar.');
      }

      if (!existingUserStore) {
        await tx.insert(tenants).values({
          id: tenantId,
          name: tenantName,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
      }

      await tx
        .insert(stores)
        .values({ id: storeId, tenantId, name: tenantName, createdAt: now });

      await tx
        .insert(storeConfig)
        .values({
          id: storeId,
          storeName: tenantName,
          legalName: tenantName,
          phone,
          country,
          businessType,
          businessTypeOther: businessTypeOther || undefined,
          contactEmail,
          estimatedUsers,
          rfc: taxId,
          regimenFiscal: taxRegime,
          regimenDescription: taxRegimeDescription || taxRegime,
          logoUrl,
          updatedAt: now,
        } as typeof storeConfig.$inferInsert);

      await tx
        .update(userRoles)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(userRoles.cognitoSub, user.uid));

      await tx
        .update(tenantMemberships)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(tenantMemberships.cognitoSub, user.uid));
      await tx
        .insert(tenantMemberships)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          cognitoSub: user.uid,
          role: 'owner',
          status: 'active',
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [tenantMemberships.tenantId, tenantMemberships.cognitoSub],
          set: { role: 'owner', status: 'active', isDefault: true, updatedAt: now },
        });

      const [createdOwner] = await tx
        .insert(userRoles)
        .values({
          id: crypto.randomUUID(),
          cognitoSub: user.uid,
          email: user.email,
          storeId,
          roleId: ownerRole.id,
          assignedBy: user.uid,
          displayName: user.displayName ?? user.email,
          employeeNumber: 'OWNER-001',
          status: 'activo',
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: userRoles.id,
          storeId: userRoles.storeId,
          roleId: userRoles.roleId,
        });

      if (!createdOwner || createdOwner.storeId !== storeId || createdOwner.roleId !== ownerRole.id) {
        throw new Error('No fue posible crear la membresía propietaria del nuevo negocio.');
      }

      // Compatibility write for code deployed before the membership cut-over.
      await tx
        .update(userStoreAccess)
        .set({ isDefault: false })
        .where(eq(userStoreAccess.userId, user.uid));
      await tx
        .insert(userStoreAccess)
        .values({ userId: user.uid, storeId, isDefault: true, createdAt: now })
        .onConflictDoUpdate({
          target: [userStoreAccess.userId, userStoreAccess.storeId],
          set: { isDefault: true },
        });

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        userId: user.uid,
        userEmail: user.email,
        action: 'create',
        entity: 'store_config',
        entityId: storeId,
        changes: {
          after: {
            storeId,
            tenantId,
            tenantName,
            tenantIdLength: tenantId.length,
            storeIdLength: storeId.length,
            country,
            businessType,
            estimatedUsers,
            source: 'self_signup',
          },
        },
        timestamp: now,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ValidationError('Ese nombre de tienda ya está registrado. Elige otro nombre.');
    }
    throw error;
  }

  cookieStore.set(STORE_COOKIE, storeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  if (!existingUserStore) {
    try {
      const run = await start(handleUserSignupWorkflow, [{
        userId: user.uid,
        tenantId,
        storeId,
      }]);
      logger.info('Signup onboarding workflow queued', {
        action: 'signup_onboarding_queued',
        tenantId,
        storeId,
        workflowRunId: run.runId,
      });
    } catch (error) {
      logger.warn('Signup onboarding workflow could not be queued', {
        action: 'signup_onboarding_enqueue_failed',
        tenantId,
        storeId,
        errorCode: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  return { tenantId, storeId, tenantName };
}

export const provisionRegisteredTenant = withLogging(
  'auth.provisionRegisteredTenant',
  _provisionRegisteredTenant,
);

type AdditionalTenantInput = Omit<ProvisionRegisteredTenantInput, 'mode'>;

async function _provisionAdditionalTenant(
  input: AdditionalTenantInput,
): Promise<{ tenantId: string; storeId: string; tenantName: string }> {
  return _provisionRegisteredTenant({ ...input, mode: 'additional' });
}

export const provisionAdditionalTenant = withLogging(
  'tenant.provisionAdditionalTenant',
  _provisionAdditionalTenant,
);
