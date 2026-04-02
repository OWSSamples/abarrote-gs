import { getRedisClient } from './connection';
import { buildKey, REDIS_PREFIXES } from './keys';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Idempotency Guard — Prevents duplicate processing of operations
// ══════════════════════════════════════════════════════════════
//
// Critical for operations that must execute exactly once even under
// network retries, double-clicks, or concurrent requests:
//   - Payment creation
//   - Sale completion
//   - Refund processing
//
// Uses Redis SET NX with a TTL. The idempotency key survives across
// serverless instances. When Redis is unavailable, falls back to an
// in-memory Set (single-instance only — still protects against double-clicks).

const memoryIdempotencySet = new Map<string, number>();
const MEMORY_CLEANUP_MS = 120_000;
let lastMemoryCleanup = Date.now();

function cleanupMemory(): void {
  const now = Date.now();
  if (now - lastMemoryCleanup < MEMORY_CLEANUP_MS) return;
  lastMemoryCleanup = now;
  for (const [key, expiresAt] of memoryIdempotencySet) {
    if (now > expiresAt) memoryIdempotencySet.delete(key);
  }
}

export interface IdempotencyOptions {
  /** How long to remember the key, in milliseconds. Default: 300 000 (5 min). */
  ttlMs?: number;
}

const DEFAULT_IDEM_TTL_MS = 300_000;

/**
 * Checks if an operation with this key has already been processed.
 *
 * Returns `true` if this is a **new** (first-time) operation → safe to proceed.
 * Returns `false` if the key already exists → duplicate, skip processing.
 *
 * @param key — Unique idempotency key (e.g. `sale:${clientGeneratedId}`)
 *
 * @example
 * ```ts
 * const isNew = await idempotencyCheck(`sale:${idempotencyKey}`);
 * if (!isNew) return { success: true, message: 'Ya procesado' };
 * // ... proceed with sale creation
 * ```
 */
export async function idempotencyCheck(
  key: string,
  options?: IdempotencyOptions,
): Promise<boolean> {
  const ttlMs = options?.ttlMs ?? DEFAULT_IDEM_TTL_MS;
  const redis = getRedisClient();

  if (redis) {
    try {
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      const redisKey = buildKey(REDIS_PREFIXES.IDEMPOTENCY, key);
      const result = await redis.set(redisKey, '1', { nx: true, ex: ttlSec });
      return result === 'OK'; // true = new, false = duplicate
    } catch (err) {
      logger.warn('Idempotency Redis check failed — falling back to memory', {
        action: 'idempotency_redis_error',
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Memory fallback
  cleanupMemory();
  if (memoryIdempotencySet.has(key)) {
    const expiresAt = memoryIdempotencySet.get(key);
    if (expiresAt && Date.now() < expiresAt) return false; // duplicate
  }
  memoryIdempotencySet.set(key, Date.now() + ttlMs);
  return true;
}

/**
 * Manually clear an idempotency key (e.g. if the operation failed and
 * the client should be allowed to retry).
 */
export async function idempotencyClear(key: string): Promise<void> {
  memoryIdempotencySet.delete(key);
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(buildKey(REDIS_PREFIXES.IDEMPOTENCY, key));
    } catch {
      // Best-effort
    }
  }
}
