import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAction, withLogging, wrapActions } from '@/lib/errors/action-factory';

// Mock logger — incluye TODOS los métodos del logger real (debug, info, warn, error, child, withTiming)
// para evitar que otros tests que reusan el mock fallen con "logger.X is not a function".
vi.mock('@/lib/logger', () => {
  const noop = vi.fn();
  const childLogger = { debug: noop, info: noop, warn: noop, error: noop };
  return {
    logger: {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
      child: vi.fn(() => childLogger),
      withTiming: vi.fn(async (_action: string, fn: () => Promise<unknown>) => fn()),
    },
    getRequestContext: vi.fn(() => undefined),
    withRequestContext: vi.fn(<T>(_ctx: unknown, fn: () => T) => fn()),
    extractRequestId: vi.fn(() => undefined),
  };
});

describe('Action Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAction', () => {
    describe('default mode (no safe)', () => {
      it('returns result on success', async () => {
        const action = createAction('test.action', async (x: number) => x * 2);
        const result = await action(5);
        expect(result).toBe(10);
      });

      it('throws on error', async () => {
        const action = createAction('test.fail', async () => {
          throw new Error('Test error');
        });
        await expect(action()).rejects.toThrow('Test error');
      });

      it('logs errors automatically', async () => {
        const { logger } = await import('@/lib/logger');
        const action = createAction('test.logError', async () => {
          throw new Error('Logged error');
        });

        await expect(action()).rejects.toThrow();
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Action Failed'),
          expect.objectContaining({ action: 'test.logError' }),
        );
      });

      it('preserves async function behavior', async () => {
        const action = createAction('test.async', async (ms: number) => {
          await new Promise((r) => setTimeout(r, ms));
          return 'done';
        });
        const result = await action(10);
        expect(result).toBe('done');
      });

      it('handles multiple arguments', async () => {
        const action = createAction('test.multiArgs', async (a: number, b: string, c: boolean) => ({ a, b, c }));
        const result = await action(1, 'hi', true);
        expect(result).toEqual({ a: 1, b: 'hi', c: true });
      });
    });

    describe('safe mode', () => {
      it('returns ActionResult on success', async () => {
        const action = createAction('test.safe', async (x: number) => x * 2, { safe: true });
        const result = await action(5);

        expect(result.success).toBe(true);
        expect(result.data).toBe(10);
        expect(result.meta.action).toBe('test.safe');
        expect(typeof result.meta.durationMs).toBe('number');
      });

      it('returns ActionResult with error on failure (no throw)', async () => {
        const action = createAction(
          'test.safeFail',
          async () => {
            throw new Error('Safe error');
          },
          { safe: true },
        );

        // Should NOT throw
        const result = await action();

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.description).toContain('Safe error');
      });
    });

    describe('options', () => {
      it('logs success when logSuccess=true', async () => {
        const { logger } = await import('@/lib/logger');
        const action = createAction('test.logSuccess', async () => 'ok', { logSuccess: true });

        await action();
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('Action Success'),
          expect.objectContaining({ action: 'test.logSuccess' }),
        );
      });

      it('includes tags in logs', async () => {
        const { logger } = await import('@/lib/logger');
        const action = createAction(
          'test.tags',
          async () => {
            throw new Error('Tagged error');
          },
          { tags: ['critical', 'payment'] },
        );

        await expect(action()).rejects.toThrow();
        expect(logger.error).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ tags: ['critical', 'payment'] }),
        );
      });
    });
  });

  describe('withLogging', () => {
    it('wraps function with logging', async () => {
      const fn = async (x: number) => x + 1;
      const wrapped = withLogging('test.withLogging', fn);

      const result = await wrapped(5);
      expect(result).toBe(6);
    });

    it('logs errors and re-throws', async () => {
      const { logger } = await import('@/lib/logger');
      const fn = async () => {
        throw new Error('WithLogging error');
      };
      const wrapped = withLogging('test.withLoggingFail', fn);

      await expect(wrapped()).rejects.toThrow('WithLogging error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('wrapActions', () => {
    it('wraps all functions in an object', async () => {
      const actions = {
        add: async (a: number, b: number) => a + b,
        multiply: async (a: number, b: number) => a * b,
      };

      const wrapped = wrapActions('math', actions);

      expect(await wrapped.add(2, 3)).toBe(5);
      expect(await wrapped.multiply(2, 3)).toBe(6);
    });

    it('preserves function types', async () => {
      const actions = {
        getUser: async (id: string) => ({ id, name: 'Test' }),
      };

      const wrapped = wrapActions('user', actions);
      const user = await wrapped.getUser('123');

      expect(user).toEqual({ id: '123', name: 'Test' });
    });
  });
});
