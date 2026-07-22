import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { tenantMemberships, tenants, userIdentities } from '@/db/schema';
import { verifyAccessToken } from '@/lib/cognito-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TENANT_ID_PATTERN = /^[0-9a-f]{32}$/;

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
    const [membership] = await db
      .select({
        tenantId: tenantMemberships.tenantId,
        tenantName: tenants.name,
        role: tenantMemberships.role,
        principalEmail: userIdentities.email,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .innerJoin(userIdentities, eq(userIdentities.cognitoSub, tenantMemberships.cognitoSub))
      .where(
        and(
          eq(tenantMemberships.cognitoSub, principal.sub),
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.status, 'active'),
          eq(tenants.status, 'active'),
          isNull(tenants.deletedAt),
          eq(userIdentities.status, 'active'),
        ),
      )
      .limit(1);

    if (!membership) {
      return jsonResponse({ authorized: false }, 403);
    }

    let billingEmail: string | undefined;
    if (membership.role === 'owner') {
      billingEmail = membership.principalEmail;
    } else if (membership.role === 'admin') {
      const [owner] = await db
        .select({ email: userIdentities.email })
        .from(tenantMemberships)
        .innerJoin(userIdentities, eq(userIdentities.cognitoSub, tenantMemberships.cognitoSub))
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.role, 'owner'),
            eq(tenantMemberships.status, 'active'),
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
        role: membership.role,
        ...(billingEmail ? { billingEmail } : {}),
      },
      200,
    );
  } catch {
    return jsonResponse({ authorized: false }, 401);
  }
}
