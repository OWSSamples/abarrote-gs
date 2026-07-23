import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { roleDefinitions, stores, tenantMemberships, tenants, userIdentities, userRoles } from '@/db/schema';
import { verifyAccessToken } from '@/lib/cognito-admin';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TENANT_ID_PATTERN = /^[0-9a-f]{32}$/;

function mapBillingRole(roleName: string | null, membershipRole: string): 'owner' | 'admin' | 'member' {
  if (roleName === 'Propietario' || membershipRole === 'owner') return 'owner';
  if (roleName === 'Administrador' || membershipRole === 'admin') return 'admin';
  return 'member';
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get('authorization');
  const tenantId = request.headers.get('x-opendex-tenant-id')?.trim().toLowerCase() ?? '';

  if (!authorization?.startsWith('Bearer ') || !TENANT_ID_PATTERN.test(tenantId)) {
    return jsonResponse({ authorized: false }, 401);
  }

  const accessToken = authorization.slice('Bearer '.length).trim();
  if (!accessToken) {
    return jsonResponse({ authorized: false }, 401);
  }

  try {
    const principal = await verifyAccessToken(accessToken);
    logger.info('Billing tenant-access token verified', {
      action: 'billing_tenant_access_token_ok',
      tenantId,
      sub: principal.sub,
      clientId: principal.client_id,
    });
    const [membership] = await db
      .select({
        tenantId: tenantMemberships.tenantId,
        tenantName: tenants.name,
        membershipRole: tenantMemberships.role,
        roleName: roleDefinitions.name,
        principalEmail: userIdentities.email,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .innerJoin(userIdentities, eq(userIdentities.cognitoSub, tenantMemberships.cognitoSub))
      .innerJoin(stores, eq(stores.tenantId, tenantMemberships.tenantId))
      .innerJoin(
        userRoles,
        and(eq(userRoles.cognitoSub, tenantMemberships.cognitoSub), eq(userRoles.storeId, stores.id)),
      )
      .leftJoin(roleDefinitions, eq(roleDefinitions.id, userRoles.roleId))
      .where(
        and(
          eq(tenantMemberships.cognitoSub, principal.sub),
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.status, 'active'),
          eq(tenants.status, 'active'),
          isNull(tenants.deletedAt),
          eq(stores.status, 'active'),
          isNull(stores.deletedAt),
          eq(userRoles.status, 'activo'),
          eq(userIdentities.status, 'active'),
        ),
      )
      .limit(1);

    if (!membership) {
      return jsonResponse({ authorized: false }, 403);
    }

    const role = mapBillingRole(membership.roleName, membership.membershipRole);
    let billingEmail: string | undefined;
    if (role === 'owner') {
      billingEmail = membership.principalEmail;
    } else if (role === 'admin') {
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
            eq(tenantMemberships.tenantId, tenantId),
            eq(roleDefinitions.name, 'Propietario'),
            eq(tenantMemberships.status, 'active'),
            eq(userRoles.status, 'activo'),
            eq(userIdentities.status, 'active'),
          ),
        )
        .limit(1);
      billingEmail = owner?.email ?? membership.principalEmail;
    }

    return jsonResponse(
      {
        authorized: true,
        tenantId: membership.tenantId,
        tenantName: membership.tenantName,
        subject: principal.sub,
        role,
        ...(billingEmail ? { billingEmail } : {}),
      },
      200,
    );
  } catch (error) {
    logger.warn('Billing tenant-access verification failed', {
      action: 'billing_tenant_access_failed',
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ authorized: false }, 401);
  }
}
