/**
 * Enterprise Structured Logger
 *
 * Features:
 * - JSON output compatible with Vercel, Datadog, Splunk, etc.
 * - Correlation IDs for distributed tracing
 * - Request context propagation via AsyncLocalStorage
 * - Automatic timing for async operations
 *
 * @example
 * // Basic logging
 * logger.info('User created', { userId: 'u-123' });
 *
 * // With request context
 * withRequestContext({ requestId: 'req-abc' }, async () => {
 *   logger.info('Processing'); // Auto-includes requestId
 * });
 */

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  action?: string;
  userId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  duration?: number;
  [key: string]: unknown;
}

interface RequestContext {
  requestId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  startTime?: number;
}

// ══════════════════════════════════════════════════════════════
// ASYNC LOCAL STORAGE FOR REQUEST CONTEXT
// ══════════════════════════════════════════════════════════════
//
// Uses real AsyncLocalStorage in Node.js (server actions, Vitest)
// and falls back to a no-op stub in Edge/Browser runtimes.
// Correlation IDs are also propagated via x-request-id header,
// read by the action factory from next/headers.

type ALS<T> = { getStore(): T | undefined; run<R>(store: T, fn: () => R): R };

let requestContextStorage: ALS<RequestContext>;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AsyncLocalStorage } = require('node:async_hooks') as {
    AsyncLocalStorage: new () => ALS<RequestContext>;
  };
  requestContextStorage = new AsyncLocalStorage();
} catch {
  requestContextStorage = {
    getStore: () => undefined,
    run: <R>(_store: RequestContext, fn: () => R) => fn(),
  };
}

/**
 * Get current request context (if any)
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Run code with request context that auto-propagates to all logs
 */
export function withRequestContext<T>(context: Partial<RequestContext>, fn: () => T): T {
  const existing = getRequestContext();
  const merged: RequestContext = {
    requestId: context.requestId ?? existing?.requestId ?? generateRequestId(),
    traceId: context.traceId ?? existing?.traceId,
    spanId: context.spanId ?? existing?.spanId,
    userId: context.userId ?? existing?.userId,
    startTime: context.startTime ?? existing?.startTime ?? Date.now(),
  };

  return requestContextStorage.run(merged, fn);
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ══════════════════════════════════════════════════════════════
// CORE LOGGING
// ══════════════════════════════════════════════════════════════

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function log(level: LogLevel, message: string, ctx?: LogContext): void {
  if (!shouldLog(level)) return;

  // Merge request context
  const requestContext = getRequestContext();

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    // Request context (auto-propagated)
    ...(requestContext && {
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
      spanId: requestContext.spanId,
    }),
    // Explicit context (overrides request context)
    ...ctx,
    // Environment info
    env: process.env.NODE_ENV,
    service: 'kiosko-pos',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  };

  // Remove undefined values for cleaner output
  const cleaned = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined));

  if (level === 'error') {
    console.error(JSON.stringify(cleaned));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(cleaned));
  } else if (level === 'debug') {
    console.debug(JSON.stringify(cleaned));
  } else {
    console.log(JSON.stringify(cleaned));
  }
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

export const logger = {
  debug: (message: string, ctx?: LogContext) => log('debug', message, ctx),
  info: (message: string, ctx?: LogContext) => log('info', message, ctx),
  warn: (message: string, ctx?: LogContext) => log('warn', message, ctx),
  error: (message: string, ctx?: LogContext) => log('error', message, ctx),

  /**
   * Log with child context (useful for prefixing)
   */
  child: (defaultCtx: LogContext) => ({
    debug: (message: string, ctx?: LogContext) => log('debug', message, { ...defaultCtx, ...ctx }),
    info: (message: string, ctx?: LogContext) => log('info', message, { ...defaultCtx, ...ctx }),
    warn: (message: string, ctx?: LogContext) => log('warn', message, { ...defaultCtx, ...ctx }),
    error: (message: string, ctx?: LogContext) => log('error', message, { ...defaultCtx, ...ctx }),
  }),

  /**
   * Wraps an async function with timing + error logging
   */
  async withTiming<T>(action: string, fn: () => Promise<T>, ctx?: LogContext): Promise<T> {
    const start = Date.now();
    const requestContext = getRequestContext();

    try {
      const result = await fn();
      log('info', `${action} completed`, {
        ...ctx,
        action,
        duration: Date.now() - start,
        requestId: requestContext?.requestId,
      });
      return result;
    } catch (err) {
      log('error', `${action} failed`, {
        ...ctx,
        action,
        duration: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        requestId: requestContext?.requestId,
      });
      throw err;
    }
  },

  /**
   * Create a span for timing a section of code
   */
  startSpan(name: string): { end: (ctx?: LogContext) => void } {
    const start = Date.now();
    const spanId = Math.random().toString(36).slice(2, 10);

    return {
      end: (ctx?: LogContext) => {
        log('info', `${name}`, {
          ...ctx,
          spanId,
          duration: Date.now() - start,
        });
      },
    };
  },
};

// ══════════════════════════════════════════════════════════════
// MIDDLEWARE HELPER
// ══════════════════════════════════════════════════════════════

/**
 * Extract request ID from headers or generate one
 */
export function extractRequestId(headers: Headers): string {
  return (
    headers.get('x-request-id') ?? headers.get('x-correlation-id') ?? headers.get('x-trace-id') ?? generateRequestId()
  );
}

/**
 * Log an incoming request
 */
export function logRequest(method: string, path: string, headers: Headers, ctx?: LogContext): void {
  const requestId = extractRequestId(headers);

  withRequestContext({ requestId }, () => {
    logger.info(`${method} ${path}`, {
      ...ctx,
      method,
      path,
      userAgent: headers.get('user-agent')?.slice(0, 100),
      ip: headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    });
  });
}

/**
 * Log a completed response
 */
export function logResponse(method: string, path: string, status: number, durationMs: number, ctx?: LogContext): void {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

  logger[level](`${method} ${path} ${status}`, {
    ...ctx,
    method,
    path,
    status,
    duration: durationMs,
  });
}
