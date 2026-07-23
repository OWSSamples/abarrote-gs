import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireCurrentAccessJwt } from '@/lib/auth/guard';
import { requireStoreScope } from '@/lib/auth/store-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 1000);
  }
}

export async function GET() {
  const scope = await requireStoreScope();
  const accessToken = await requireCurrentAccessJwt();
  const headerStore = await headers();
  const host = headerStore.get('host') || 'kiosko.opendex.dev';
  const proto = headerStore.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;
  const billingApiBaseUrl = (process.env.BILLING_API_BASE_URL || 'https://billing.opendexapis.com').replace(/\/+$/, '');

  const tenantAuthority = await fetch(`${origin}/api/internal/billing/tenant-access`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Opendex-Tenant-Id': scope.tenantId,
    },
    cache: 'no-store',
  });

  const billingPlans = await fetch(`${billingApiBaseUrl}/api/v1/billing/plans`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Opendex-Tenant-Id': scope.tenantId,
    },
    cache: 'no-store',
  });

  return NextResponse.json({
    success: tenantAuthority.ok && billingPlans.ok,
    data: {
      userId: scope.user.uid,
      roleName: scope.user.roleName,
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      billingApiBaseUrl,
      tenantAuthority: {
        status: tenantAuthority.status,
        body: await readResponse(tenantAuthority),
      },
      billingPlans: {
        status: billingPlans.status,
        body: await readResponse(billingPlans),
      },
    },
  });
}
