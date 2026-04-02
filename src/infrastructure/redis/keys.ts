import { getRedisClient } from './connection';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Key Namespace Registry
// ══════════════════════════════════════════════════════════════
//
// Central authority for all Redis key prefixes.
// Prevents key collisions across services and makes SCAN/cleanup safe.

export const REDIS_PREFIXES = {
  CACHE: 'cache',
  RATE_LIMIT: 'rl',
  LOCK: 'lock',
  SESSION: 'session',
  IDEMPOTENCY: 'idem',
} as const;

export type RedisPrefix = (typeof REDIS_PREFIXES)[keyof typeof REDIS_PREFIXES];

/**
 * Builds a fully-qualified Redis key with namespace prefix.
 * @example buildKey('cache', 'products', 'list') → 'cache:products:list'
 */
export function buildKey(prefix: RedisPrefix, ...segments: string[]): string {
  return [prefix, ...segments].join(':');
}

// ══════════════════════════════════════════════════════════════
// Key management utilities
// ══════════════════════════════════════════════════════════════

/**
 * Scans and deletes all keys matching a prefix + glob pattern.
 * Uses SCAN to avoid blocking Redis on large keyspaces.
 *
 * @returns Number of keys deleted
 */
export async function deleteKeysByPattern(prefix: RedisPrefix, pattern: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  const fullPattern = `${prefix}:${pattern}`;
  let cursor = 0;
  let deletedCount = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: fullPattern, count: 100 });
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== 0);
  } catch (err) {
    logger.warn('Redis deleteKeysByPattern failed', {
      action: 'redis_keys_delete_error',
      pattern: fullPattern,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return deletedCount;
}

/**
 * Counts keys matching a prefix + glob pattern.
 * Useful for monitoring and diagnostics.
 */
export async function countKeysByPrefix(prefix: RedisPrefix): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  let cursor = 0;
  let total = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: `${prefix}:*`, count: 100 });
      cursor = nextCursor;
      total += keys.length;
    } while (cursor !== 0);
  } catch {
    // Silent — diagnostic only
  }

  return total;
}
