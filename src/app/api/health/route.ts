import { NextResponse } from 'next/server';
import { checkRedisHealth, type RedisHealth, getCacheStats } from '@/infrastructure/redis';
import { getAllCircuitBreakerStats } from '@/infrastructure/circuit-breaker';
import { getAuditBufferSize } from '@/infrastructure/audit';
import { getDomainEventStats } from '@/domain/events';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

// Health checks deben reflejar estado actual — jamás cachearse.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Health Check Endpoint
 *
 * Returns comprehensive health status for:
 * - Application (always up if this responds)
 * - Database (PostgreSQL via Drizzle)
 * - Cache (Redis/Upstash)
 *
 * Used by:
 * - Kubernetes liveness/readiness probes
 * - Load balancers
 * - Uptime monitoring (Checkly, Pingdom, etc.)
 * - Internal dashboards
 *
 * Response codes:
 * - 200: All systems healthy
 * - 503: One or more systems degraded
 */

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: DatabaseHealth;
    redis: RedisHealth;
  };
  infrastructure: {
    circuitBreakers: ReturnType<typeof getAllCircuitBreakerStats>;
    cache: ReturnType<typeof getCacheStats>;
    auditBufferSize: number;
    domainEvents: Record<string, number>;
  };
}

interface DatabaseHealth {
  connected: boolean;
  latencyMs: number | null;
  error?: string;
}

// Track process start time for uptime calculation
const startTime = Date.now();

async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const start = performance.now();

  try {
    // Simple query to verify connection
    await db.execute(sql`SELECT 1`);
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;

    return {
      connected: true,
      latencyMs,
    };
  } catch (err) {
    return {
      connected: false,
      latencyMs: null,
      error: err instanceof Error ? err.message : 'Unknown database error',
    };
  }
}

function determineOverallStatus(
  dbHealth: DatabaseHealth,
  redisHealth: RedisHealth,
): 'healthy' | 'degraded' | 'unhealthy' {
  // Database is critical - if down, system is unhealthy
  if (!dbHealth.connected) {
    return 'unhealthy';
  }

  // Redis is optional (has memory fallback) - if down, system is degraded
  if (!redisHealth.connected) {
    return 'degraded';
  }

  // High latency is a warning sign
  if ((dbHealth.latencyMs ?? 0) > 500 || (redisHealth.latencyMs ?? 0) > 100) {
    return 'degraded';
  }

  return 'healthy';
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const [dbHealth, redisHealth] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

  const status = determineOverallStatus(dbHealth, redisHealth);

  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: dbHealth,
      redis: redisHealth,
    },
    infrastructure: {
      circuitBreakers: getAllCircuitBreakerStats(),
      cache: getCacheStats(),
      auditBufferSize: getAuditBufferSize(),
      domainEvents: getDomainEventStats(),
    },
  };

  // Return 503 if not fully healthy
  const httpStatus = status === 'healthy' ? 200 : 503;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Status': status,
    },
  });
}

// Also support HEAD requests for simple uptime checks
export async function HEAD(): Promise<NextResponse> {
  const [dbHealth, redisHealth] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

  const status = determineOverallStatus(dbHealth, redisHealth);
  const httpStatus = status === 'healthy' ? 200 : 503;

  return new NextResponse(null, {
    status: httpStatus,
    headers: {
      'X-Health-Status': status,
    },
  });
}
