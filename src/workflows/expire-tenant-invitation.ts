import { sleep } from 'workflow';

export interface ExpireTenantInvitationResult {
  invitationId: string;
  expired: boolean;
}

export async function expireTenantInvitationWorkflow(
  invitationId: string,
  storeId: string,
  expiresAt: string,
): Promise<ExpireTenantInvitationResult> {
  'use workflow';

  await sleep(new Date(expiresAt));
  return expireTenantInvitationStep(invitationId, storeId);
}

async function expireTenantInvitationStep(
  invitationId: string,
  storeId: string,
): Promise<ExpireTenantInvitationResult> {
  'use step';

  const [{ db }, { tenantInvitations }, { and, eq, lte }] = await Promise.all([
    import('@/db'),
    import('@/db/schema'),
    import('drizzle-orm'),
  ]);
  const now = new Date();
  const [expired] = await db
    .update(tenantInvitations)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        eq(tenantInvitations.id, invitationId),
        eq(tenantInvitations.storeId, storeId),
        eq(tenantInvitations.status, 'pending'),
        lte(tenantInvitations.expiresAt, now),
      ),
    )
    .returning({ id: tenantInvitations.id });

  return { invitationId, expired: Boolean(expired) };
}
