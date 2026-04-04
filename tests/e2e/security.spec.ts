import { test, expect } from '@playwright/test';

/**
 * Security E2E Tests
 *
 * Validates that the Edge middleware (proxy.ts) correctly:
 * - Blocks known bot/scanner User-Agents
 * - Blocks suspicious path probes (.env, .git, etc.)
 * - Returns proper security headers
 * - Generates request-ID for tracing
 */

test.describe('Security — Bot & Scanner Blocking', () => {
  test('blocks sqlmap User-Agent', async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'User-Agent': 'sqlmap/1.6' },
    });
    expect(response.status()).toBe(403);
  });

  test('blocks nikto User-Agent', async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'User-Agent': 'Nikto/2.1.6' },
    });
    expect(response.status()).toBe(403);
  });

  test('blocks masscan User-Agent', async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'User-Agent': 'masscan/1.3' },
    });
    expect(response.status()).toBe(403);
  });

  test('allows normal browser User-Agent', async ({ request }) => {
    const response = await request.get('/auth/login', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    // Should not be blocked (may redirect, but not 403)
    expect(response.status()).not.toBe(403);
  });
});

test.describe('Security — Path Probe Blocking', () => {
  test('blocks .env access', async ({ request }) => {
    const response = await request.get('/.env');
    expect(response.status()).toBe(404);
  });

  test('blocks .git access', async ({ request }) => {
    const response = await request.get('/.git/config');
    expect(response.status()).toBe(404);
  });

  test('blocks wp-admin probe', async ({ request }) => {
    const response = await request.get('/wp-admin/');
    expect(response.status()).toBe(404);
  });

  test('blocks path traversal', async ({ request }) => {
    const response = await request.get('/../../etc/passwd');
    expect(response.status()).toBe(404);
  });

  test('blocks PHP file access', async ({ request }) => {
    const response = await request.get('/shell.php');
    expect(response.status()).toBe(404);
  });
});

test.describe('Security — Response Headers', () => {
  test('returns security headers on login page', async ({ request }) => {
    const response = await request.get('/auth/login');
    const headers = response.headers();

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy']).toBeTruthy();
    expect(headers['x-robots-tag']).toContain('noindex');
  });

  test('returns x-request-id for tracing', async ({ request }) => {
    const response = await request.get('/auth/login');
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();
    // UUID format (roughly)
    expect(requestId.length).toBeGreaterThanOrEqual(32);
  });

  test('hides server technology fingerprint', async ({ request }) => {
    const response = await request.get('/auth/login');
    expect(response.headers()['server']).toBe('abarrote');
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });
});
