import 'server-only';

import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { tenantBillingEntitlements } from '@/db/schema';
import { InfrastructureError } from '@/lib/errors';

const BILLING_API_BASE_URL = (
  process.env.BILLING_API_BASE_URL || 'https://billing.opendexapis.com'
).replace(/\/+$/, '');
const TENANT_ID_PATTERN = /^[0-9a-f]{32}$/;
const ENTITLEMENT_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export interface TenantEntitlementProjection {
  code: string;
  name: string;
  value: number;
  expiresAt: Date | null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeEntitlements(payload: unknown): TenantEntitlementProjection[] {
  const root = readRecord(payload);
  if (!Array.isArray(root.data)) {
    throw new InfrastructureError('Billing devolvió una respuesta de permisos inválida.');
  }

  return root.data.map((raw) => {
    const item = readRecord(raw);
    const code = typeof item.code === 'string' ? item.code.trim() : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const value = typeof item.value === 'number' ? item.value : Number.NaN;
    const expiresAt = typeof item.expiresAt === 'string'
      ? new Date(item.expiresAt)
      : null;

    if (
      !ENTITLEMENT_CODE_PATTERN.test(code)
      || !name
      || !Number.isInteger(value)
      || value < 0
      || (expiresAt && Number.isNaN(expiresAt.getTime()))
    ) {
      throw new InfrastructureError('Billing devolvió un permiso que no cumple el contrato.');
    }
    return { code, name: name.slice(0, 120), value, expiresAt };
  });
}

export async function fetchAndSyncTenantEntitlements(
  tenantId: string,
  accessToken: string,
): Promise<TenantEntitlementProjection[]> {
  if (!TENANT_ID_PATTERN.test(tenantId) || !accessToken) {
    throw new InfrastructureError('No fue posible preparar el contexto de facturación.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  let response: Response;
  try {
    response = await fetch(`${BILLING_API_BASE_URL}/api/v1/billing/entitlements`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Opendex-Tenant-Id': tenantId,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    throw new InfrastructureError('No fue posible sincronizar los límites del plan.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new InfrastructureError('Billing rechazó la sincronización de los límites del plan.');
  }
  return persistTenantEntitlementsPayload(tenantId, await response.json());
}

export async function persistTenantEntitlementsPayload(
  tenantId: string,
  payload: unknown,
): Promise<TenantEntitlementProjection[]> {
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new InfrastructureError('El tenant de facturación no es válido.');
  }
  const entitlements = normalizeEntitlements(payload);
  const syncedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .delete(tenantBillingEntitlements)
      .where(eq(tenantBillingEntitlements.tenantId, tenantId));
    if (entitlements.length > 0) {
      await tx.insert(tenantBillingEntitlements).values(
        entitlements.map((entitlement) => ({
          tenantId,
          ...entitlement,
          syncedAt,
        })),
      );
    }
  });
  return entitlements;
}

export async function getActiveTenantEntitlementValue(
  tenantId: string,
  code: string,
): Promise<number | null> {
  const [entitlement] = await db
    .select({ value: tenantBillingEntitlements.value })
    .from(tenantBillingEntitlements)
    .where(
      and(
        eq(tenantBillingEntitlements.tenantId, tenantId),
        eq(tenantBillingEntitlements.code, code),
        or(
          isNull(tenantBillingEntitlements.expiresAt),
          gt(tenantBillingEntitlements.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  return entitlement?.value ?? null;
}
