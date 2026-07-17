import 'server-only';

import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'view';

interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export async function logAudit(params: {
  storeId: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  changes?: AuditChanges;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      storeId: params.storeId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      changes: params.changes ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch (error) {
    // Never let audit logging failures bubble up and break the main flow
    console.error('Audit log write failed:', error instanceof Error ? error.message : error);
  }
}

export async function getAuditLogs(filters: {
  storeId: string;
  userId?: string;
  entity?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  if (!filters.storeId) throw new Error('El tenant es obligatorio para consultar auditoría.');
  const conditions = [eq(auditLogs.storeId, filters.storeId)];

  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.entity) {
    conditions.push(eq(auditLogs.entity, filters.entity));
  }
  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.startDate) {
    conditions.push(gte(auditLogs.timestamp, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(auditLogs.timestamp, filters.endDate));
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.timestamp))
    .limit(filters.limit ?? 200);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userEmail: r.userEmail,
    action: r.action as AuditAction,
    entity: r.entity,
    entityId: r.entityId,
    changes: r.changes as AuditChanges | null,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    timestamp: r.timestamp.toISOString(),
  }));
}
