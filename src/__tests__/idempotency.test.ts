import { describe, it, expect } from 'vitest';
import { idempotencyCheck, idempotencyClear } from '@/infrastructure/redis';

describe('Idempotency Guard (infrastructure/redis)', () => {
  it('returns true on first call (new operation)', async () => {
    const key = `test-idem-${Date.now()}`;
    const result = await idempotencyCheck(key, { ttlMs: 5_000 });
    expect(result).toBe(true);
  });

  it('returns false on duplicate call', async () => {
    const key = `test-idem-dup-${Date.now()}`;
    await idempotencyCheck(key, { ttlMs: 5_000 });
    const duplicate = await idempotencyCheck(key, { ttlMs: 5_000 });
    expect(duplicate).toBe(false);
  });

  it('allows retry after clearing', async () => {
    const key = `test-idem-clear-${Date.now()}`;
    await idempotencyCheck(key, { ttlMs: 5_000 });
    await idempotencyClear(key);
    const retried = await idempotencyCheck(key, { ttlMs: 5_000 });
    expect(retried).toBe(true);
  });
});
