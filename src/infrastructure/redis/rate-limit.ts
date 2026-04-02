import { Ratelimit } from '@upstash/ratelimit';
import { getRedisClient } from './connection';
import { REDIS_PREFIXES } from './keys';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Rate Limiter — Upstash sliding window + in-memory fallback
// ══════════════════════════════════════════════════════════════
//
// Strategy:
//   Redis available  → Distributed sliding window (multi-instance safe)
//   Redis unavailable → Local in-memory counter (single-instance only)
//
// Both paths expose the same `RateLimitResult` contract so consumers
// never need to know which backend is active.

export interface RateLimitConfig {
  /** Max requests allowed in the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Requests remaining in the current window. */
  remaining: number;
  /** When the current window resets. */
  reset: Date;
  /** True if the request was blocked. */
  blocked: boolean;
  /** @deprecated Use `blocked` instead. Kept for backward compatibility. */
  isRateLimited: boolean;
  /** Convenience inverse of `blocked`. */
  allowed: boolean;
}

// ── Defaults ──

const DEFAULT_CONFIG: RateLimitConfig = { limit: 10, windowMs: 60_000 };

/** Accepts both `{ limit }` and legacy `{ maxRequests }` shape. */
function normalizeConfig(input: RateLimitConfig | { maxRequests: number; windowMs: number }): RateLimitConfig {
  if ('maxRequests' in input) {
    return { limit: input.maxRequests, windowMs: input.windowMs };
  }
  return input;
}

// ── In-memory fallback ──

interface MemoryRecord {
  count: number;
  expiresAt: number;
}

const memoryBuckets = new Map<string, MemoryRecord>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = Date.now();

function cleanupStale(): void {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, record] of memoryBuckets) {
    if (now > record.expiresAt) memoryBuckets.delete(key);
  }
}

function checkMemory(identifier: string, config: RateLimitConfig): RateLimitResult {
  cleanupStale();
  const now = Date.now();
  const existing = memoryBuckets.get(identifier);

  if (!existing || now > existing.expiresAt) {
    memoryBuckets.set(identifier, { count: 1, expiresAt: now + config.windowMs });
    return {
      remaining: config.limit - 1,
      reset: new Date(now + config.windowMs),
      blocked: false,
      isRateLimited: false,
      allowed: true,
    };
  }

  const count = existing.count + 1;
  memoryBuckets.set(identifier, { count, expiresAt: existing.expiresAt });
  const blocked = count > config.limit;

  if (blocked) {
    logger.warn('Rate limit exceeded (memory fallback)', {
      action: 'ratelimit_blocked_memory',
      identifier,
      count,
      limit: config.limit,
    });
  }

  return {
    remaining: Math.max(0, config.limit - count),
    reset: new Date(existing.expiresAt),
    blocked,
    isRateLimited: blocked,
    allowed: !blocked,
  };
}

// ── Upstash limiter pool (keyed by config fingerprint) ──

const upstashPool = new Map<string, Ratelimit>();

function getOrCreateLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  const fingerprint = `${config.limit}:${config.windowMs}`;
  const cached = upstashPool.get(fingerprint);
  if (cached) return cached;

  const windowSec = Math.max(1, Math.ceil(config.windowMs / 1000));
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, `${windowSec} s`),
    prefix: REDIS_PREFIXES.RATE_LIMIT,
    analytics: false,
  });

  upstashPool.set(fingerprint, limiter);
  return limiter;
}

// ══════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════

/**
 * Synchronous rate limiter.
 *
 * Returns immediately using in-memory state.
 * When Redis is available, schedules an async check that updates
 * the memory bucket if Redis is stricter (e.g. cross-instance traffic).
 *
 * Best for: Server Actions, middleware, any sync code path.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig | { maxRequests: number; windowMs: number } = DEFAULT_CONFIG,
): RateLimitResult {
  const normalized = normalizeConfig(config);
  const limiter = getOrCreateLimiter(normalized);
  const memResult = checkMemory(identifier, normalized);

  if (limiter) {
    // Fire-and-forget: sync memory result for the caller now,
    // but reconcile with Redis asynchronously
    limiter.limit(identifier).then((redis) => {
      if (redis.remaining <= 0 && memResult.allowed) {
        memoryBuckets.set(identifier, {
          count: normalized.limit + 1,
          expiresAt: redis.reset,
        });
      }
    }).catch((err) => {
      logger.warn('Upstash rate limit probe failed — memory still authoritative', {
        action: 'ratelimit_redis_probe_error',
        identifier,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return memResult;
}

/**
 * Async rate limiter — queries Redis directly when available.
 *
 * Preferred for API routes where `await` is natural and you want
 * true distributed accuracy.
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig | { maxRequests: number; windowMs: number } = DEFAULT_CONFIG,
): Promise<RateLimitResult> {
  const normalized = normalizeConfig(config);
  const limiter = getOrCreateLimiter(normalized);
  if (!limiter) return checkMemory(identifier, normalized);

  try {
    const result = await limiter.limit(identifier);
    const blocked = !result.success;

    if (blocked) {
      logger.warn('Rate limit exceeded (redis)', {
        action: 'ratelimit_blocked_redis',
        identifier,
        remaining: result.remaining,
        limit: normalized.limit,
      });
    }

    return {
      remaining: result.remaining,
      reset: new Date(result.reset),
      blocked,
      isRateLimited: blocked,
      allowed: result.success,
    };
  } catch (err) {
    logger.warn('Upstash rate limit failed — falling back to memory', {
      action: 'ratelimit_redis_error',
      identifier,
      error: err instanceof Error ? err.message : String(err),
    });
    return checkMemory(identifier, normalized);
  }
}

/**
 * Extracts the client IP from a Next.js request.
 * Checks x-forwarded-for (reverse proxy/CDN), then x-real-ip, defaults to '0.0.0.0'.
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? '0.0.0.0';
}
