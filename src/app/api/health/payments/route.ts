import { NextResponse } from 'next/server';
import { getPaymentCircuitBreakerStats } from '@/infrastructure/circuit-breaker';

/**
 * Health check enfocado a procesadores de pago.
 * Pensado para uptime monitors / alertas de PagerDuty.
 *
 * Estados:
 *   - healthy:  todos los breakers en CLOSED
 *   - degraded: al menos uno en HALF_OPEN
 *   - down:     al menos uno en OPEN  → HTTP 503
 *
 * No requiere auth — solo expone metadata operacional, no claves ni datos PII.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ProviderHealth {
  service: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
  errorRate: number;
  lastFailure: string | null;
  lastSuccess: string | null;
}

interface PaymentsHealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  providers: ProviderHealth[];
  summary: {
    total: number;
    closed: number;
    halfOpen: number;
    open: number;
  };
}

export async function GET(): Promise<NextResponse<PaymentsHealthResponse>> {
  const stats = getPaymentCircuitBreakerStats();

  const providers: ProviderHealth[] = stats.map((s) => ({
    service: s.service,
    state: s.state,
    consecutiveFailures: s.failures,
    totalRequests: s.totalRequests,
    totalFailures: s.totalFailures,
    errorRate: s.totalRequests > 0 ? Math.round((s.totalFailures / s.totalRequests) * 1000) / 10 : 0,
    lastFailure: s.lastFailure ? s.lastFailure.toISOString() : null,
    lastSuccess: s.lastSuccess ? s.lastSuccess.toISOString() : null,
  }));

  const summary = {
    total: providers.length,
    closed: providers.filter((p) => p.state === 'CLOSED').length,
    halfOpen: providers.filter((p) => p.state === 'HALF_OPEN').length,
    open: providers.filter((p) => p.state === 'OPEN').length,
  };

  const status: PaymentsHealthResponse['status'] =
    summary.open > 0 ? 'down' : summary.halfOpen > 0 ? 'degraded' : 'healthy';

  const httpStatus = status === 'down' ? 503 : 200;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      providers,
      summary,
    },
    {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': status,
      },
    },
  );
}

export async function HEAD(): Promise<NextResponse> {
  const stats = getPaymentCircuitBreakerStats();
  const hasOpen = stats.some((s) => s.state === 'OPEN');
  return new NextResponse(null, {
    status: hasOpen ? 503 : 200,
    headers: { 'X-Health-Status': hasOpen ? 'down' : 'healthy' },
  });
}
