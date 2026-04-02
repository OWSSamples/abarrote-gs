import { getRedisClient } from './connection';
import { buildKey, REDIS_PREFIXES, deleteKeysByPattern } from './keys';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Cache Service — Redis primary + in-memory L1 fallback
// ══════════════════════════════════════════════════════════════
//
// Two-tier caching strategy:
//   L1: In-memory Map (same process — sub-ms reads, lost on cold start)
//   L2: Upstash Redis (distributed — p50 ~1-3 ms, survives deploys)
//
// Writes → both L1 + L2 simultaneously
// Reads  → L1 first, L2 on miss, then populate L1

interface MemoryEntry<T = unknown> {
  data: T;
  storedAt: number;
  ttlMs: number;
}

const l1Store = new Map<string, MemoryEntry>();

const L1_MAX_SIZE = 5_000;

function evictL1IfNeeded(): void {
  if (l1Store.size <= L1_MAX_SIZE) return;
  // Drop the oldest 20% by insertion order (Map iterates in insertion order)
  const toDrop = Math.floor(L1_MAX_SIZE * 0.2);
  let dropped = 0;
  for (const key of l1Store.keys()) {
    if (dropped >= toDrop) break;
    l1Store.delete(key);
    dropped++;
  }
}

function isMemoryEntryValid(entry: MemoryEntry): boolean {
  return Date.now() - entry.storedAt < entry.ttlMs;
}

// ── Public Cache API ──

export interface CacheOptions {
  /** Time-to-live in milliseconds. Default: 60 000 (1 minute). */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 60_000;

/**
 * Store a value in both L1 (memory) and L2 (Redis).
 * Accepts either `{ ttlMs }` options or a raw number for backward compatibility.
 */
export async function cacheSet<T>(key: string, data: T, options?: CacheOptions | number): Promise<void> {
  const ttlMs = typeof options === 'number' ? options : (options?.ttlMs ?? DEFAULT_TTL_MS);

  // L1 — always write
  l1Store.set(key, { data, storedAt: Date.now(), ttlMs });
  evictL1IfNeeded();

  // L2 — best-effort
  const redis = getRedisClient();
  if (redis) {
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    try {
      await redis.set(buildKey(REDIS_PREFIXES.CACHE, key), JSON.stringify(data), { ex: ttlSec });
    } catch (err) {
      logger.warn('Redis cache SET failed — L1 still populated', {
        action: 'cache_l2_set_error',
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Retrieve a cached value. Checks L1 first, then L2.
 * On L2 hit, re-populates L1 for subsequent fast reads.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  // L1 check
  const memEntry = l1Store.get(key);
  if (memEntry) {
    if (isMemoryEntryValid(memEntry)) return memEntry.data as T;
    l1Store.delete(key);
  }

  // L2 check
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get<string>(buildKey(REDIS_PREFIXES.CACHE, key));
      if (raw !== null && raw !== undefined) {
        const data: T = typeof raw === 'string' ? JSON.parse(raw) : raw as T;
        // Back-fill L1 with a conservative TTL (we don't know the remaining Redis TTL)
        l1Store.set(key, { data, storedAt: Date.now(), ttlMs: DEFAULT_TTL_MS });
        return data;
      }
    } catch (err) {
      logger.warn('Redis cache GET failed — returning null', {
        action: 'cache_l2_get_error',
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return null;
}

/**
 * Synchronous L1-only read for hot paths that cannot `await`.
 * Does NOT check Redis — returns only if value is in local memory.
 */
export function cacheGetSync<T>(key: string): T | null {
  const memEntry = l1Store.get(key);
  if (!memEntry) return null;
  if (!isMemoryEntryValid(memEntry)) {
    l1Store.delete(key);
    return null;
  }
  return memEntry.data as T;
}

/**
 * Invalidate a specific key from both L1 and L2.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  l1Store.delete(key);
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(buildKey(REDIS_PREFIXES.CACHE, key));
    } catch {
      // Best-effort — L1 already cleared
    }
  }
}

/**
 * Invalidate all keys matching a regex pattern.
 *  - L1: iterates local Map with RegExp test
 *  - L2: uses SCAN with glob pattern
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const regex = new RegExp(pattern);

  // L1
  for (const key of l1Store.keys()) {
    if (regex.test(key)) l1Store.delete(key);
  }

  // L2
  await deleteKeysByPattern(REDIS_PREFIXES.CACHE, '*');
  // Note: deleteKeysByPattern is prefix-scoped, can't use regex on Redis.
  // For fine-grained Redis invalidation, we'd scan + filter.
  const redis = getRedisClient();
  if (redis) {
    try {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, {
          match: `${REDIS_PREFIXES.CACHE}:*`,
          count: 100,
        });
        cursor = nextCursor;
        const matching = keys.filter((k) => regex.test(k.replace(`${REDIS_PREFIXES.CACHE}:`, '')));
        if (matching.length > 0) {
          await redis.del(...matching);
        }
      } while (cursor !== 0);
    } catch {
      // Best-effort
    }
  }
}

/**
 * Flush all cache entries from both L1 and L2.
 */
export async function cacheClear(): Promise<void> {
  l1Store.clear();
  await deleteKeysByPattern(REDIS_PREFIXES.CACHE, '*');
}

/**
 * Returns L1 cache stats for diagnostics.
 */
export function getCacheStats(): { l1Size: number; l1MaxSize: number } {
  return { l1Size: l1Store.size, l1MaxSize: L1_MAX_SIZE };
}

// ══════════════════════════════════════════════════════════════
// Legacy-compatible wrapper — drop-in for existing `cache.*` usage
// ══════════════════════════════════════════════════════════════

export const cache = {
  set: cacheSet,
  get: cacheGet,
  getSync: cacheGetSync,
  invalidate: cacheInvalidate,
  invalidatePattern: cacheInvalidatePattern,
  clear: cacheClear,
};
