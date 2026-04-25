/**
 * Circuit Breaker Pattern — Resilience for External Services
 *
 * Prevents cascading failures by detecting when an external dependency
 * (Telegram, Stripe, Conekta, Clip, MercadoPago) is down and "opening"
 * the circuit to fail-fast instead of timing out on every request.
 *
 * States:
 *   CLOSED  → Normal operation. Requests flow through.
 *   OPEN    → Dependency is down. Requests fail immediately without calling the service.
 *   HALF_OPEN → Recovery probe. A single request is allowed through to test.
 *
 * Configuration is per-service with sensible defaults optimized for serverless.
 *
 * @example
 * ```ts
 * const telegramBreaker = createCircuitBreaker('telegram', { failureThreshold: 3 });
 *
 * const result = await telegramBreaker.execute(async () => {
 *   return sendTelegramMessage(chatId, text);
 * });
 * ```
 */

import { logger } from '@/lib/logger';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  failureThreshold?: number;
  /** How long the circuit stays open before trying a probe (ms). Default: 30_000 (30s) */
  resetTimeoutMs?: number;
  /** Success count needed in HALF_OPEN to close. Default: 2 */
  halfOpenSuccessThreshold?: number;
  /** Optional fallback to execute when circuit is open */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fallback?: () => any;
}

interface CircuitBreakerStats {
  service: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  totalRequests: number;
  totalFailures: number;
}

interface CircuitBreaker {
  /** Execute a function through the circuit breaker */
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Get current circuit stats */
  getStats: () => CircuitBreakerStats;
  /** Force reset to CLOSED */
  reset: () => void;
}

// ══════════════════════════════════════════════════════════════
// Circuit Breaker Error
// ══════════════════════════════════════════════════════════════

export class CircuitOpenError extends Error {
  public readonly service: string;
  public readonly retryAfterMs: number;

  constructor(service: string, retryAfterMs: number) {
    super(`Circuit breaker OPEN for '${service}' — fail-fast. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'CircuitOpenError';
    this.service = service;
    this.retryAfterMs = retryAfterMs;
  }
}

// ══════════════════════════════════════════════════════════════
// Factory
// ══════════════════════════════════════════════════════════════

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 30_000;
const DEFAULT_HALF_OPEN_SUCCESS = 2;

export function createCircuitBreaker(service: string, options?: CircuitBreakerOptions): CircuitBreaker {
  const failureThreshold = options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const resetTimeoutMs = options?.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
  const halfOpenSuccess = options?.halfOpenSuccessThreshold ?? DEFAULT_HALF_OPEN_SUCCESS;
  const fallback = options?.fallback;

  let state: CircuitState = 'CLOSED';
  let consecutiveFailures = 0;
  let halfOpenSuccesses = 0;
  let lastFailureTime: Date | null = null;
  let lastSuccessTime: Date | null = null;
  let totalRequests = 0;
  let totalFailures = 0;

  function transitionTo(newState: CircuitState): void {
    if (state === newState) return;
    logger.info(`Circuit breaker state change: ${state} → ${newState}`, {
      action: 'circuit_breaker_transition',
      service,
      from: state,
      to: newState,
      consecutiveFailures,
    });
    state = newState;

    if (newState === 'HALF_OPEN') {
      halfOpenSuccesses = 0;
    }
  }

  function recordSuccess(): void {
    lastSuccessTime = new Date();
    consecutiveFailures = 0;

    if (state === 'HALF_OPEN') {
      halfOpenSuccesses++;
      if (halfOpenSuccesses >= halfOpenSuccess) {
        transitionTo('CLOSED');
      }
    }
  }

  function recordFailure(error: unknown): void {
    lastFailureTime = new Date();
    totalFailures++;
    consecutiveFailures++;

    logger.warn(`Circuit breaker failure recorded`, {
      action: 'circuit_breaker_failure',
      service,
      consecutiveFailures,
      threshold: failureThreshold,
      error: error instanceof Error ? error.message : String(error),
    });

    if (state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN → back to OPEN
      transitionTo('OPEN');
    } else if (consecutiveFailures >= failureThreshold) {
      transitionTo('OPEN');
    }
  }

  function shouldAllowRequest(): boolean {
    if (state === 'CLOSED') return true;

    if (state === 'OPEN') {
      const elapsed = Date.now() - (lastFailureTime?.getTime() ?? 0);
      if (elapsed >= resetTimeoutMs) {
        transitionTo('HALF_OPEN');
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow probes
    return true;
  }

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    totalRequests++;

    if (!shouldAllowRequest()) {
      const elapsed = Date.now() - (lastFailureTime?.getTime() ?? 0);
      const retryAfter = Math.max(0, resetTimeoutMs - elapsed);

      if (fallback) {
        logger.info('Circuit open — executing fallback', {
          action: 'circuit_breaker_fallback',
          service,
          retryAfterMs: retryAfter,
        });
        return fallback() as T;
      }

      throw new CircuitOpenError(service, retryAfter);
    }

    try {
      const result = await fn();
      recordSuccess();
      return result;
    } catch (error) {
      recordFailure(error);
      throw error;
    }
  }

  function getStats(): CircuitBreakerStats {
    return {
      service,
      state,
      failures: consecutiveFailures,
      successes: halfOpenSuccesses,
      lastFailure: lastFailureTime,
      lastSuccess: lastSuccessTime,
      totalRequests,
      totalFailures,
    };
  }

  function reset(): void {
    transitionTo('CLOSED');
    consecutiveFailures = 0;
    halfOpenSuccesses = 0;
  }

  return { execute, getStats, reset };
}

// ══════════════════════════════════════════════════════════════
// Pre-configured breakers for known services
// ══════════════════════════════════════════════════════════════

/** Telegram — low threshold, fast recovery (notifications are non-critical) */
export const telegramBreaker = createCircuitBreaker('telegram', {
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
});

/** Stripe — higher threshold, slow recovery (payments are critical) */
export const stripeBreaker = createCircuitBreaker('stripe', {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

/** Conekta — similar to Stripe */
export const conektaBreaker = createCircuitBreaker('conekta', {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

/** Clip — terminal payments */
export const clipBreaker = createCircuitBreaker('clip', {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

/** MercadoPago — both API and POS terminal */
export const mercadopagoBreaker = createCircuitBreaker('mercadopago', {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

// ══════════════════════════════════════════════════════════════
// Health check for all breakers
// ══════════════════════════════════════════════════════════════

const ALL_BREAKERS = [telegramBreaker, stripeBreaker, conektaBreaker, clipBreaker, mercadopagoBreaker];
const PAYMENT_BREAKERS = [stripeBreaker, conektaBreaker, clipBreaker, mercadopagoBreaker];

export function getAllCircuitBreakerStats(): CircuitBreakerStats[] {
  return ALL_BREAKERS.map((b) => b.getStats());
}

/** Stats restringidas a los breakers de pagos (excluye telegram). */
export function getPaymentCircuitBreakerStats(): CircuitBreakerStats[] {
  return PAYMENT_BREAKERS.map((b) => b.getStats());
}
