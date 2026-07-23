'use server';

import { createInternalToken, type TenantContext } from '@ows-global/service-auth';
import { db } from '@/db';
import {
  roleDefinitions,
  stores,
  tenantMemberships,
  tenants,
  userIdentities,
  userRoles,
} from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { StoreScope } from '@/lib/auth/store-scope';
import { logger } from '@/lib/logger';

const INTERNAL_JWT_SECRET = process.env.INTERNAL_JWT_SECRET;

function mapBillingRole(roleName: string | null, membershipRole: string): 'owner' | 'admin' | 'member' {
  if (roleName === 'Propietario' || membershipRole === 'owner') return 'owner';
  if (roleName === 'Administrador' || membershipRole === 'admin') return 'admin';
  return 'member';
}

async function resolveBillingContext(scope: StoreScope): Promise<{
  tenantName: string;
  billingEmail: string;
  role: 'owner' | 'admin' | 'member';
}> {
  const tenantRows = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, scope.tenantId))
    .limit(1);
  const tenantName = tenantRows[0]?.name ?? '';

  const membershipRows = await db
    .select({
      membershipRole: tenantMemberships.role,
      roleName: roleDefinitions.name,
      principalEmail: userIdentities.email,
    })
    .from(tenantMemberships)
    .innerJoin(userIdentities, eq(userIdentities.cognitoSub, tenantMemberships.cognitoSub))
    .innerJoin(stores, eq(stores.tenantId, tenantMemberships.tenantId))
    .innerJoin(
      userRoles,
      and(eq(userRoles.cognitoSub, tenantMemberships.cognitoSub), eq(userRoles.storeId, stores.id)),
    )
    .leftJoin(roleDefinitions, eq(roleDefinitions.id, userRoles.roleId))
    .where(
      and(
        eq(tenantMemberships.cognitoSub, scope.user.uid),
        eq(tenantMemberships.tenantId, scope.tenantId),
        eq(tenantMemberships.status, 'active'),
        eq(userRoles.status, 'activo'),
        eq(userIdentities.status, 'active'),
      ),
    )
    .limit(1);

  const membership = membershipRows[0];
  if (!membership) {
    throw new Error('No active membership found for billing token');
  }

  const role = mapBillingRole(membership.roleName, membership.membershipRole);
  let billingEmail: string | undefined;

  if (role === 'owner') {
    billingEmail = membership.principalEmail;
  } else {
    const [owner] = await db
      .select({ email: userIdentities.email })
      .from(tenantMemberships)
      .innerJoin(userIdentities, eq(userIdentities.cognitoSub, tenantMemberships.cognitoSub))
      .innerJoin(stores, eq(stores.tenantId, tenantMemberships.tenantId))
      .innerJoin(
        userRoles,
        and(eq(userRoles.cognitoSub, tenantMemberships.cognitoSub), eq(userRoles.storeId, stores.id)),
      )
      .innerJoin(roleDefinitions, eq(roleDefinitions.id, userRoles.roleId))
      .where(
        and(
          eq(tenantMemberships.tenantId, scope.tenantId),
          eq(roleDefinitions.name, 'Propietario'),
          eq(tenantMemberships.status, 'active'),
          eq(userRoles.status, 'activo'),
          eq(userIdentities.status, 'active'),
        ),
      )
      .limit(1);
    billingEmail = owner?.email ?? membership.principalEmail;
  }

  return { tenantName, billingEmail: billingEmail ?? membership.principalEmail, role };
}

export async function createBillingInternalToken(scope: StoreScope): Promise<{
  token: string;
  requestId: string;
  tenantName: string;
  billingEmail: string;
}> {
  if (!INTERNAL_JWT_SECRET) {
    throw new Error('INTERNAL_JWT_SECRET environment variable is required');
  }

  const requestId = crypto.randomUUID();
  const { tenantName, billingEmail, role } = await resolveBillingContext(scope);

  const context: TenantContext = {
    userId: scope.user.uid,
    tenantId: scope.tenantId,
    storeId: scope.storeId,
    role,
    scopes: ['billing:read'],
    requestId,
  };

  const token = await createInternalToken(
    context,
    'billing',
    new TextEncoder().encode(INTERNAL_JWT_SECRET),
    { issuer: 'opendex-kiosko-bff', expiresInSeconds: 300 },
  );

  logger.debug('Billing internal token minted', {
    action: 'billing_internal_token_minted',
    tenantId: scope.tenantId,
    storeId: scope.storeId,
    role,
    requestId,
  });

  return { token, requestId, tenantName, billingEmail };
}
