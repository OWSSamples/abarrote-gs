import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { AuthError, requireCurrentAccessJwt } from '@/lib/auth/guard';
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

async function probe(
  url: string,
  method: 'GET' | 'POST',
  headers: HeadersInit,
): Promise<{
  status: number;
  body: unknown;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      method,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    return { status: response.status, body: await readResponse(response) };
  } catch {
    return {
      status: 503,
      body: { error: 'billing_service_unavailable' },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  try {
    const scope = await requireStoreScope();
    const accessToken = await requireCurrentAccessJwt();
    const headerStore = await headers();
    const host = headerStore.get('host') || 'kiosko.opendex.dev';
    const proto = headerStore.get('x-forwarded-proto') || 'https';
    const origin = `${proto}://${host}`;
    const billingApiBaseUrl = (
      process.env.BILLING_API_BASE_URL || 'https://billing.opendexapis.com'
    ).replace(/\/+$/, '');
    const authHeaders = {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Opendex-Tenant-Id': scope.tenantId,
    };

    const [tenantAuthority, billingPlans] = await Promise.all([
      probe(`${origin}/api/internal/billing/tenant-access`, 'POST', authHeaders),
      probe(`${billingApiBaseUrl}/api/v1/billing/plans`, 'GET', authHeaders),
    ]);

    return NextResponse.json(
      {
        success: tenantAuthority.status === 200 && billingPlans.status === 200,
        data: {
          userId: scope.user.uid,
          roleName: scope.user.roleName,
          tenantId: scope.tenantId,
          storeId: scope.storeId,
          billingApiBaseUrl,
          tenantAuthority,
          billingPlans,
        },
      },
      {
        status:
          tenantAuthority.status === 200 && billingPlans.status === 200
            ? 200
            : Math.max(tenantAuthority.status, billingPlans.status),
      },
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json(
      {
        success: false,
        error:
          status === 401 || status === 403
            ? 'authentication_required'
            : 'billing_diagnostic_unavailable',
      },
      { status },
    );
  }
}
