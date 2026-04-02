import { describe, it, expect } from 'vitest';
import { buildKey, REDIS_PREFIXES } from '@/infrastructure/redis';

describe('Redis Key Management', () => {
  it('builds namespaced keys', () => {
    expect(buildKey(REDIS_PREFIXES.CACHE, 'products', 'list')).toBe('cache:products:list');
    expect(buildKey(REDIS_PREFIXES.RATE_LIMIT, 'ip:1.2.3.4')).toBe('rl:ip:1.2.3.4');
    expect(buildKey(REDIS_PREFIXES.LOCK, 'sale', 'abc-123')).toBe('lock:sale:abc-123');
    expect(buildKey(REDIS_PREFIXES.IDEMPOTENCY, 'sale:xyz')).toBe('idem:sale:xyz');
  });

  it('defines all expected prefixes', () => {
    expect(REDIS_PREFIXES.CACHE).toBe('cache');
    expect(REDIS_PREFIXES.RATE_LIMIT).toBe('rl');
    expect(REDIS_PREFIXES.LOCK).toBe('lock');
    expect(REDIS_PREFIXES.SESSION).toBe('session');
    expect(REDIS_PREFIXES.IDEMPOTENCY).toBe('idem');
  });
});
