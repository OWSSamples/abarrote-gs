import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cache, cacheGetSync } from '@/infrastructure/redis';

describe('Cache (infrastructure/redis)', () => {
  beforeEach(async () => {
    await cache.clear();
  });

  it('stores and retrieves values', async () => {
    await cache.set('key1', { foo: 'bar' }, { ttlMs: 60_000 });
    expect(await cache.get('key1')).toEqual({ foo: 'bar' });
  });

  it('returns null for missing keys', async () => {
    expect(await cache.get('nonexistent')).toBeNull();
  });

  it('expires entries after TTL', async () => {
    vi.useFakeTimers();
    await cache.set('key1', 'value', { ttlMs: 1000 });

    vi.advanceTimersByTime(500);
    expect(cacheGetSync('key1')).toBe('value');

    vi.advanceTimersByTime(600);
    expect(cacheGetSync('key1')).toBeNull();

    vi.useRealTimers();
  });

  it('invalidates by key', async () => {
    await cache.set('key1', 'value');
    await cache.invalidate('key1');
    expect(await cache.get('key1')).toBeNull();
  });

  it('invalidates by pattern', async () => {
    await cache.set('products:list', [1, 2, 3]);
    await cache.set('products:detail:1', { id: 1 });
    await cache.set('sales:list', [4, 5]);

    await cache.invalidatePattern('^products');
    expect(await cache.get('products:list')).toBeNull();
    expect(await cache.get('products:detail:1')).toBeNull();
    expect(await cache.get('sales:list')).toEqual([4, 5]);
  });

  it('clears all entries', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.clear();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });

  it('getSync returns value without await', async () => {
    await cache.set('sync-key', 'sync-value', { ttlMs: 60_000 });
    expect(cacheGetSync('sync-key')).toBe('sync-value');
  });
});
