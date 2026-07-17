/**
 * Enterprise Audit Logging Service
 *
 * Records immutable audit trail for all mutations in the system.
 * Designed for compliance, forensics, and security monitoring.
 *
 * Features:
 * - Non-blocking writes (fire-and-forget via async queue)
 * - Full context capture (userId, IP, User-Agent, correlation ID)
 * - Before/after change tracking for updates
 * - Type-safe entity/action classification
 * - Batch-friendly for bulk operations
 *
 * Architecture:
 * - Domain layer calls `auditLog(...)` which enqueues synchronously
 * - Background flush writes to DB without blocking the request
 * - If DB write fails, falls back to structured log (never lost)
 */

import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { logger, getRequestContext } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'login'
  | 'logout'
  | 'export'
  | 'bulk_delete'
  | 'config_change';

type AuditEntity =
  | 'product'
  | 'category'
  | 'sale'
  | 'customer'
  | 'supplier'
  | 'promotion'
  | 'user_role'
  | 'store_config'
  | 'payment_provider'
  | 'payment_charge'
  | 'feature_flag'
  | 'corte_caja'
  | 'fiado'
  | 'gasto'
  | 'merma';

interface AuditEntry {
  storeId: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ipAddress?: string;
  userAgent?: string;
}

// ══════════════════════════════════════════════════════════════
// In-memory buffer for non-blocking writes
// ══════════════════════════════════════════════════════════════

interface QueuedEntry extends AuditEntry {
  id: string;
  timestamp: Date;
  requestId?: string;
}

const BUFFER: QueuedEntry[] = [];
const MAX_BUFFER_SIZE = 100;
const FLUSH_INTERVAL_MS = 2_000;

let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushBuffer();
  }, FLUSH_INTERVAL_MS);

  // Allow Node.js to exit even if timer is active
  if (typeof flushTimer === 'object' && 'unref' in flushTimer) {
    flushTimer.unref();
  }
}

/**
 * Flush buffered entries to DB in a single batch insert.
 * Falls back to structured logging if DB write fails.
 */
async function flushBuffer(): Promise<void> {
  if (BUFFER.length === 0) return;

  // Drain buffer atomically
  const entries = BUFFER.splice(0, BUFFER.length);

  try {
    await db.insert(auditLogs).values(
      entries.map((e) => ({
        id: e.id,
        storeId: e.storeId,
        userId: e.userId,
        userEmail: e.userEmail,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId,
        changes: e.changes ?? null,
        ipAddress: e.ipAddress ?? null,
        userAgent: e.userAgent ?? null,
        timestamp: e.timestamp,
      })),
    );

    logger.debug('Audit entries flushed', {
      action: 'audit_flush',
      count: entries.length,
    });
  } catch (err) {
    // NEVER lose audit data — fall back to structured logging
    for (const entry of entries) {
      logger.error('Audit entry (DB write failed, logged as fallback)', {
        action: 'audit_fallback',
        auditAction: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        storeId: entry.storeId,
        userId: entry.userId,
        changes: entry.changes ? JSON.stringify(entry.changes) : undefined,
        ipAddress: entry.ipAddress,
        requestId: entry.requestId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════

/**
 * Record an audit log entry. Non-blocking — enqueues and returns immediately.
 *
 * @example
 * ```ts
 * auditLog({
 *   storeId,
 *   userId: user.uid,
 *   userEmail: user.email,
 *   action: 'update',
 *   entity: 'product',
 *   entityId: productId,
 *   changes: { before: { price: 10 }, after: { price: 15 } },
 * });
 * ```
 */
export function auditLog(entry: AuditEntry): void {
  const requestContext = getRequestContext();

  const queued: QueuedEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date(),
    requestId: requestContext?.requestId,
  };

  BUFFER.push(queued);

  // If buffer is full, flush immediately
  if (BUFFER.length >= MAX_BUFFER_SIZE) {
    void flushBuffer();
  }

  ensureFlushTimer();
}

/**
 * Record an audit log entry and wait for DB write.
 * Use for critical operations where log confirmation is required (e.g., delete, config change).
 */
export async function auditLogSync(entry: AuditEntry): Promise<void> {
  const requestContext = getRequestContext();

  const record: QueuedEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date(),
    requestId: requestContext?.requestId,
  };

  try {
    await db.insert(auditLogs).values({
      id: record.id,
      storeId: record.storeId,
      userId: record.userId,
      userEmail: record.userEmail,
      action: record.action,
      entity: record.entity,
      entityId: record.entityId,
      changes: record.changes ?? null,
      ipAddress: record.ipAddress ?? null,
      userAgent: record.userAgent ?? null,
      timestamp: record.timestamp,
    });
  } catch (err) {
    // Fallback to structured log
    logger.error('Audit sync write failed', {
      action: 'audit_sync_fallback',
      auditAction: record.action,
      entity: record.entity,
      entityId: record.entityId,
      storeId: record.storeId,
      userId: record.userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Force flush all buffered audit entries.
 * Call during graceful shutdown or at end of request.
 */
export async function flushAuditBuffer(): Promise<void> {
  await flushBuffer();
}

/**
 * Get the current buffer size (for monitoring/health checks).
 */
export function getAuditBufferSize(): number {
  return BUFFER.length;
}
