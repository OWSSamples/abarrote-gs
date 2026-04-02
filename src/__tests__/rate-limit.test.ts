import { describe, it, expect } from 'vitest';
import { checkRateLimit, getClientIp } from '@/infrastructure/redis';

describe('Rate Limiter (infrastructure/redis)', () => {
  it('allows requests within limit', () => {
    const id = `test-allow-${Date.now()}`;
    const result = checkRateLimit(id, { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.isRateLimited).toBe(false);
    expect(result.remaining).toBe(4);
  });

  it('blocks after exceeding limit', () => {
    const id = `test-block-${Date.now()}`;
    const config = { limit: 3, windowMs: 60_000 };

    checkRateLimit(id, config);
    checkRateLimit(id, config);
    checkRateLimit(id, config);
    const fourth = checkRateLimit(id, config);

    expect(fourth.blocked).toBe(true);
    expect(fourth.isRateLimited).toBe(true);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it('accepts maxRequests alias for backward compatibility', () => {
    const id = `test-compat-${Date.now()}`;
    const result = checkRateLimit(id, { maxRequests: 10, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('returns a valid reset date', () => {
    const id = `test-reset-${Date.now()}`;
    const result = checkRateLimit(id, { limit: 10, windowMs: 30_000 });
    expect(result.reset).toBeInstanceOf(Date);
    expect(result.reset.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('getClientIp', () => {
  const makeHeaders = (map: Record<string, string>) => ({
    headers: { get: (name: string) => map[name.toLowerCase()] ?? null },
  });

  it('extracts from x-forwarded-for', () => {
    expect(getClientIp(makeHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('extracts from x-real-ip', () => {
    expect(getClientIp(makeHeaders({ 'x-real-ip': '9.10.11.12' }))).toBe('9.10.11.12');
  });

  it('falls back to 0.0.0.0', () => {
    expect(getClientIp(makeHeaders({}))).toBe('0.0.0.0');
  });
});
