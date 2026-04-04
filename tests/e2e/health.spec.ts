import { test, expect } from '@playwright/test';

/**
 * Health Endpoint E2E Tests
 *
 * Validates the /api/health endpoint responds correctly
 * and returns proper structure for monitoring/observability.
 */

test.describe('API Health Endpoint', () => {
  test('returns 200 with healthy status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('healthy');
  });

  test('returns component check results', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();

    expect(body).toHaveProperty('checks');
    expect(body.checks).toHaveProperty('database');
    expect(body.checks).toHaveProperty('redis');
  });

  test('includes timestamp for freshness', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();

    expect(body).toHaveProperty('timestamp');

    // Timestamp should be within last 5 seconds
    const ts = new Date(body.timestamp).getTime();
    const now = Date.now();
    expect(now - ts).toBeLessThan(5_000);
  });

  test('responds within acceptable latency', async ({ request }) => {
    const start = Date.now();
    const response = await request.get('/api/health');
    const elapsed = Date.now() - start;

    expect(response.status()).toBe(200);
    // Health check should complete within 3 seconds
    expect(elapsed).toBeLessThan(3_000);
  });

  test('returns correct content-type', async ({ request }) => {
    const response = await request.get('/api/health');
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });
});
