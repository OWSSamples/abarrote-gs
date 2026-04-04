/**
 * Action Factory - Enterprise Pattern
 * 
 * Creates server actions with built-in:
 * - Structured logging (start, success, error)
 * - Timing metrics
 * - Error normalization
 * - Optional safe return (no throw)
 * 
 * @example
 * // Basic usage - logs but still throws on error
 * export const createProduct = createAction(
 *   'createProduct',
 *   async (data: ProductData) => {
 *     await requirePermission('inventory.edit');
 *     return db.insert(products).values(data);
 *   }
 * );
 * 
 * // Safe mode - returns ActionResult instead of throwing
 * export const createProductSafe = createAction(
 *   'createProduct',
 *   async (data: ProductData) => { ... },
 *   { safe: true }
 * );
 */

import { logger, withRequestContext, extractRequestId } from '@/lib/logger';
import { parseError, AppError } from './index';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    title: string;
    description: string;
    code?: string;
  };
  meta: {
    action: string;
    durationMs: number;
    timestamp: string;
  };
}

export interface ActionOptions {
  /** If true, returns ActionResult instead of throwing */
  safe?: boolean;
  /** If true, logs successful executions (default: false for read, true for write) */
  logSuccess?: boolean;
  /** Custom tags for filtering in logs */
  tags?: string[];
}

type ActionFn<TArgs extends unknown[], TReturn> = (...args: TArgs) => Promise<TReturn>;

// ─────────────────────────────────────────────────────────────────────
// Action Factory
// ─────────────────────────────────────────────────────────────────────

/**
 * Create a wrapped server action with logging and error handling.
 * 
 * Default behavior:
 * - Logs errors automatically
 * - Re-throws errors (backward compatible)
 * - Measures execution time
 * 
 * With { safe: true }:
 * - Returns { success, data, error, meta } instead of throwing
 */
export function createAction<TArgs extends unknown[], TReturn>(
  actionName: string,
  actionFn: ActionFn<TArgs, TReturn>,
  options: ActionOptions & { safe: true }
): (...args: TArgs) => Promise<ActionResult<TReturn>>;

export function createAction<TArgs extends unknown[], TReturn>(
  actionName: string,
  actionFn: ActionFn<TArgs, TReturn>,
  options?: ActionOptions & { safe?: false }
): (...args: TArgs) => Promise<TReturn>;

export function createAction<TArgs extends unknown[], TReturn>(
  actionName: string,
  actionFn: ActionFn<TArgs, TReturn>,
  options: ActionOptions = {}
): (...args: TArgs) => Promise<TReturn | ActionResult<TReturn>> {
  const { safe = false, logSuccess = false, tags = [] } = options;

  return async (...args: TArgs): Promise<TReturn | ActionResult<TReturn>> => {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    // Auto-extract request context from Next.js headers for correlation
    let requestId: string | undefined;
    try {
      const { headers } = await import('next/headers');
      const hdrs = await headers();
      requestId = hdrs.get('x-request-id') ?? undefined;
    } catch {
      // Not in a request context (e.g., cron/background job) — ok
    }

    const execute = async (): Promise<TReturn | ActionResult<TReturn>> => {
    const buildMeta = () => ({
      action: actionName,
      durationMs: Math.round(performance.now() - startTime),
      timestamp,
    });

    try {
      const result = await actionFn(...args);
      const meta = buildMeta();

      if (logSuccess) {
        logger.info(`Action Success: [${actionName}]`, {
          action: actionName,
          durationMs: meta.durationMs,
          tags,
        });
      }

      if (safe) {
        return {
          success: true,
          data: result,
          meta,
        } as ActionResult<TReturn>;
      }

      return result;
    } catch (error) {
      const meta = buildMeta();
      const parsed = parseError(error);

      // Always log errors
      logger.error(`Action Failed: [${actionName}]`, {
        action: actionName,
        title: parsed.title,
        description: parsed.description,
        durationMs: meta.durationMs,
        tags,
        code: error instanceof AppError ? error.code : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (safe) {
        return {
          success: false,
          error: {
            ...parsed,
            code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
          },
          meta,
        } as ActionResult<TReturn>;
      }

      // Re-throw for backward compatibility
      throw error;
    }
    };

    // Wrap in request context for automatic correlation ID propagation
    if (requestId) {
      return withRequestContext({ requestId }, execute);
    }
    return execute();
  };
}

// ─────────────────────────────────────────────────────────────────────
// Batch Action Wrapper
// ─────────────────────────────────────────────────────────────────────

/**
 * Wrap multiple action functions at once.
 * Useful for wrapping an entire actions module.
 * 
 * @example
 * const rawActions = {
 *   createProduct: async (data) => { ... },
 *   updateProduct: async (id, data) => { ... },
 * };
 * export const actions = wrapActions('product', rawActions);
 */
export function wrapActions<T extends Record<string, ActionFn<unknown[], unknown>>>(
  prefix: string,
  actions: T,
  options: ActionOptions = {}
): T {
  const wrapped: Record<string, ActionFn<unknown[], unknown>> = {};
  const safeOptions = { ...options, safe: false as const };

  for (const [name, fn] of Object.entries(actions)) {
    const actionName = `${prefix}.${name}`;
    wrapped[name] = createAction(actionName, fn as ActionFn<unknown[], unknown>, safeOptions);
  }

  return wrapped as T;
}

// ─────────────────────────────────────────────────────────────────────
// Legacy Support
// ─────────────────────────────────────────────────────────────────────

/**
 * Simple logging wrapper for existing actions.
 * Does NOT change behavior - just adds logging.
 * 
 * Use this for gradual migration without breaking existing code.
 */
export function withLogging<TArgs extends unknown[], TReturn>(
  actionName: string,
  actionFn: ActionFn<TArgs, TReturn>
): ActionFn<TArgs, TReturn> {
  return createAction(actionName, actionFn, { safe: false }) as ActionFn<TArgs, TReturn>;
}

/**
 * Re-export safeAction for backward compatibility
 */
export { safeAction } from './safe-action';
