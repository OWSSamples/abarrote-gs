import { NextResponse } from 'next/server';
import { checkRedisHealth, type RedisHealth } from '@/infrastructure/redis';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

// Health checks deben reflejar estado actual — jamás cachearse.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Health Check Endpoint
 *
 * Returns a public, non-sensitive readiness status for:
 * - Application (always up if this responds)
 * - Database (PostgreSQL via Drizzle)
 * - Cache (Redis/Upstash)
 *
 * Used by:
 * - External uptime monitoring
 * - Load balancer and readiness probes
 *
 * Response codes:
 * - 200: The application is serviceable (healthy or degraded)
 * - 503: A critical dependency is unavailable
 */

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: DatabaseHealth;
    redis: Pick<RedisHealth, 'connected' | 'latencyMs'>;
  };
  cognito: {
    userPoolId: string | null;
    clientIdPrefix: string;
    region: string;
    source: string;
  };
}

interface DatabaseHealth {
  connected: boolean;
  latencyMs: number | null;
}

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
  } catch {
    return {
      connected: false,
      latencyMs: null,
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

function getHttpStatus(status: HealthStatus['status']): 200 | 503 {
  // Redis has an in-memory fallback, so a degraded state remains serviceable.
  return status === 'unhealthy' ? 503 : 200;
}

function getHealthHeaders(status: HealthStatus['status']): Record<string, string> {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Health-Status': status,
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
  };
}

function getCognitoConfig() {
  const nextPublicPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || null;
  const nextPublicClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || null;
  const serverPoolId = process.env.COGNITO_USER_POOL_ID || null;
  const serverClientId = process.env.COGNITO_CLIENT_ID || null;

  const userPoolId = nextPublicPoolId || serverPoolId;
  const clientId = nextPublicClientId || serverClientId;
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION || process.env.COGNITO_REGION || 'us-east-1';

  return {
    userPoolId,
    clientIdPrefix: (clientId || '').slice(0, 6),
    region,
    source: nextPublicPoolId ? 'NEXT_PUBLIC' : serverPoolId ? 'SERVER' : 'NONE',
  };
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const [dbHealth, redisHealth] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

  const status = determineOverallStatus(dbHealth, redisHealth);

  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealth,
      redis: {
        connected: redisHealth.connected,
        latencyMs: redisHealth.latencyMs,
      },
    },
    cognito: getCognitoConfig(),
  };

  return NextResponse.json(response, {
    status: getHttpStatus(status),
    headers: getHealthHeaders(status),
  });
}

// Also support HEAD requests for simple uptime checks
export async function HEAD(): Promise<NextResponse> {
  const [dbHealth, redisHealth] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

  const status = determineOverallStatus(dbHealth, redisHealth);

  return new NextResponse(null, {
    status: getHttpStatus(status),
    headers: getHealthHeaders(status),
  });
}
