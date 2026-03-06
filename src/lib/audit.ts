'use server';

import { db } from '@/db';
import { auditLogs } from '@/db/audit-schema';

type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'view';

export async function logAudit(params: {
  userId: string;
  userEmail: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  changes?: { before?: any; after?: any };
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: params.userId,
      userEmail: params.userEmail,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      changes: params.changes || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    });
  } catch (error) {
    console.error('Error logging audit:', error);
  }
}

export async function getAuditLogs(filters?: {
  userId?: string;
  entity?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  // Implementar query con filtros
  return [];
}
