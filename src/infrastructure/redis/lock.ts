import { getRedisClient } from './connection';
import { buildKey, REDIS_PREFIXES } from './keys';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Distributed Lock — Redis-based mutual exclusion
// ══════════════════════════════════════════════════════════════
//
// Uses SET NX EX pattern (atomic acquire) + Lua EVAL for safe release.
// Prevents double-processing on concurrent requests in multi-instance
// deployments (e.g. two serverless functions processing the same sale).
//
// When Redis is unavailable, acquires immediately (no-op lock) so the
// app continues working in local dev or Redis downtime.

export interface LockOptions {
  /** Lock TTL in milliseconds. Default: 10 000 (10 s). */
  ttlMs?: number;
  /** How long to wait for lock acquisition in milliseconds. Default: 5 000 (5 s). */
  waitMs?: number;
  /** Polling interval while waiting. Default: 100 ms. */
  retryIntervalMs?: number;
}

export interface Lock {
  /** The resource that was locked. */
  resource: string;
  /** Release the lock. Must be called when done. */
  release: () => Promise<void>;
}

const DEFAULT_TTL_MS = 10_000;
const DEFAULT_WAIT_MS = 5_000;
const DEFAULT_RETRY_MS = 100;

// Lua script for safe release: only delete if the value matches our token
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * Acquires a distributed lock on a named resource.
 *
 * @param resource — Logical name of the resource to lock (e.g. `sale:${saleId}`)
 * @returns A `Lock` object with a `release()` method, or `null` if acquisition timed out.
 *
 * @example
 * ```ts
 * const lock = await acquireLock(`sale:${saleId}`);
 * if (!lock) throw new Error('Could not acquire lock — concurrent processing');
 * try {
 *   await processSale(saleId);
 * } finally {
 *   await lock.release();
 * }
 * ```
 */
export async function acquireLock(
  resource: string,
  options?: LockOptions,
): Promise<Lock | null> {
  const redis = getRedisClient();
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

  // No Redis → immediate no-op lock (works for single-instance dev)
  if (!redis) {
    return {
      resource,
      release: async () => { /* no-op */ },
    };
  }

  const key = buildKey(REDIS_PREFIXES.LOCK, resource);
  const token = crypto.randomUUID();
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  const waitMs = options?.waitMs ?? DEFAULT_WAIT_MS;
  const retryMs = options?.retryIntervalMs ?? DEFAULT_RETRY_MS;
  const deadline = Date.now() + waitMs;

  while (Date.now() < deadline) {
    try {
      // SET key token NX EX ttl — atomic acquire
      const acquired = await redis.set(key, token, { nx: true, ex: ttlSec });

      if (acquired === 'OK') {
        return {
          resource,
          release: async () => {
            try {
              await redis.eval(RELEASE_SCRIPT, [key], [token]);
            } catch (err) {
              logger.warn('Lock release failed — will auto-expire via TTL', {
                action: 'lock_release_error',
                resource,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        };
      }
    } catch (err) {
      logger.warn('Lock acquire attempt failed', {
        action: 'lock_acquire_error',
        resource,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to retry
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, retryMs));
  }

  logger.warn('Lock acquisition timed out', {
    action: 'lock_timeout',
    resource,
    waitMs,
  });

  return null;
}

/**
 * Convenience: execute a function while holding a lock.
 * Automatically releases on completion or error.
 *
 * @throws Error if lock cannot be acquired.
 */
export async function withLock<T>(
  resource: string,
  fn: () => Promise<T>,
  options?: LockOptions,
): Promise<T> {
  const lock = await acquireLock(resource, options);
  if (!lock) {
    throw new Error(`No se pudo adquirir lock para: ${resource}`);
  }
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
