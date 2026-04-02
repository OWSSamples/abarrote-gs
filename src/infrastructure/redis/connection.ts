import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Redis Connection Manager — Singleton with health monitoring
// ══════════════════════════════════════════════════════════════

export interface RedisHealth {
  connected: boolean;
  latencyMs: number | null;
  lastCheckedAt: string;
}

let _instance: Redis | null = null;
let _initialized = false;
let _lastHealth: RedisHealth = {
  connected: false,
  latencyMs: null,
  lastCheckedAt: new Date().toISOString(),
};

/**
 * Returns the Upstash Redis singleton — or null if env vars are missing.
 *
 * Every consumer must handle `null` gracefully (in-memory fallback).
 * The singleton is lazy-initialized on first call and cached for the
 * lifetime of the serverless function invocation.
 */
export function getRedisClient(): Redis | null {
  if (_initialized) return _instance;
  _initialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    logger.info('Upstash Redis not configured — all services will use in-memory fallback', {
      action: 'redis_connection_skip',
    });
    return null;
  }

  try {
    _instance = new Redis({
      url,
      token,
      enableAutoPipelining: true,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.min(Math.exp(retryCount) * 50, 1000),
      },
    });

    logger.info('Upstash Redis connection established', {
      action: 'redis_connection_init',
      endpoint: url.replace(/\/\/.*@/, '//***@'), // mask credentials in logs
    });
  } catch (err) {
    logger.error('Failed to initialize Upstash Redis connection', {
      action: 'redis_connection_error',
      error: err instanceof Error ? err.message : String(err),
    });
    _instance = null;
  }

  return _instance;
}

/**
 * Probes Redis with a lightweight PING and returns health info.
 * Used by health-check endpoints and monitoring.
 */
export async function checkRedisHealth(): Promise<RedisHealth> {
  const redis = getRedisClient();

  if (!redis) {
    _lastHealth = { connected: false, latencyMs: null, lastCheckedAt: new Date().toISOString() };
    return _lastHealth;
  }

  const start = performance.now();
  try {
    await redis.ping();
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    _lastHealth = { connected: true, latencyMs, lastCheckedAt: new Date().toISOString() };
  } catch {
    _lastHealth = { connected: false, latencyMs: null, lastCheckedAt: new Date().toISOString() };
  }

  return _lastHealth;
}

/**
 * Returns the last known health state without issuing a new probe.
 */
export function getLastRedisHealth(): RedisHealth {
  return _lastHealth;
}

/**
 * Returns true if a Redis client is available (not necessarily healthy).
 * Use `checkRedisHealth()` for a full probe.
 */
export function isRedisAvailable(): boolean {
  return getRedisClient() !== null;
}
