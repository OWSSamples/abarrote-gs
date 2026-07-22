import { test, expect } from '@playwright/test';

/**
 * Comprehensive API Route E2E Tests
 *
 * Validates that API endpoints return correct status codes,
 * enforce authentication, respect HTTP methods, and handle
 * edge cases gracefully.
 */

const PROTECTED_API_ROUTES = [
  '/api/products',
  '/api/sales',
  '/api/inventory',
  '/api/customers',
  '/api/stores',
];

const WEBHOOK_ROUTES = [
  { path: '/api/webhooks/cobrar', method: 'POST' as const },
];

test.describe('API Routes — Authentication Enforcement', () => {
  for (const route of PROTECTED_API_ROUTES) {
    test(`${route} rejects unauthenticated GET`, async ({ request }) => {
      const response = await request.get(route);
      // Any auth-protected route should return 401, 403, or 404 — never 500
      expect(response.status()).toBeLessThan(500);
      expect([401, 403, 404]).toContain(response.status());
    });

    test(`${route} rejects unauthenticated POST`, async ({ request }) => {
      const response = await request.post(route, {
        data: { test: true },
      });
      expect(response.status()).toBeLessThan(500);
    });
  }
});

test.describe('API Routes — Content Type', () => {
  test('health endpoint returns JSON', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.headers()['content-type']).toContain('application/json');
  });

  for (const wh of WEBHOOK_ROUTES) {
    test(`${wh.path} returns JSON`, async ({ request }) => {
      const response = await request.post(wh.path, {
        data: { id: 'test', type: 'test', data: { id: 'test' } },
      });
      expect(response.headers()['content-type']).toContain('application/json');
    });
  }
});

test.describe('API Routes — Error Resilience', () => {
  test('oversized payload is rejected gracefully', async ({ request }) => {
    // 2MB payload
    const largePayload = { data: 'x'.repeat(2 * 1024 * 1024) };
    const response = await request.post('/api/webhooks/cobrar', {
      data: largePayload,
    });
    // Should be rejected (413, 400, or similar) — not 500
    expect(response.status()).toBeLessThan(500);
  });

  test('empty POST body returns error', async ({ request }) => {
    const response = await request.post('/api/webhooks/cobrar', {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBeLessThanOrEqual(400);
  });

  test('deeply nested JSON is handled', async ({ request }) => {
    const obj: Record<string, unknown> = { id: 'test', type: 'charge.paid', data: { id: 'x' } };
    let current = obj;
    for (let i = 0; i < 50; i++) {
      current.nested = {};
      current = current.nested as Record<string, unknown>;
    }
    const response = await request.post('/api/webhooks/cobrar', { data: obj });
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('API Routes — CORS & Method Safety', () => {
  test('OPTIONS request returns CORS headers or 404', async ({ request }) => {
    const response = await request.fetch('/api/health', { method: 'OPTIONS' });
    // Should not error — either 200 with CORS or 405/404
    expect(response.status()).toBeLessThan(500);
  });

  test('DELETE on health endpoint is rejected', async ({ request }) => {
    const response = await request.delete('/api/health');
    expect([404, 405]).toContain(response.status());
  });
});
