// ══════════════════════════════════════════════════════════════
// Redis Infrastructure — Public API
// ══════════════════════════════════════════════════════════════
//
// Barrel export for all Redis-backed infrastructure services.
//
// Structure:
//   src/infrastructure/redis/
//   ├── index.ts          ← This file (public surface)
//   ├── connection.ts     ← Singleton + health check
//   ├── keys.ts           ← Namespace registry + key utilities
//   ├── cache.ts          ← L1/L2 cache (memory + Redis)
//   ├── rate-limit.ts     ← Distributed rate limiting
//   ├── lock.ts           ← Distributed mutex locks
//   └── idempotency.ts    ← Exactly-once processing guard
//
// Usage:
//   import { cache, checkRateLimit, withLock } from '@/infrastructure/redis';

// ── Connection ──
export {
  getRedisClient,
  checkRedisHealth,
  getLastRedisHealth,
  isRedisAvailable,
  type RedisHealth,
} from './connection';

// ── Key Management ──
export {
  REDIS_PREFIXES,
  buildKey,
  deleteKeysByPattern,
  countKeysByPrefix,
  type RedisPrefix,
} from './keys';

// ── Cache ──
export {
  cache,
  cacheSet,
  cacheGet,
  cacheGetSync,
  cacheInvalidate,
  cacheInvalidatePattern,
  cacheClear,
  getCacheStats,
  type CacheOptions,
} from './cache';

// ── Rate Limiting ──
export {
  checkRateLimit,
  checkRateLimitAsync,
  getClientIp,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limit';

// ── Distributed Locks ──
export {
  acquireLock,
  withLock,
  type Lock,
  type LockOptions,
} from './lock';

// ── Idempotency ──
export {
  idempotencyCheck,
  idempotencyClear,
  type IdempotencyOptions,
} from './idempotency';
