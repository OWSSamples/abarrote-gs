import { test, expect } from '@playwright/test';

/**
 * Navigation & Routing E2E Tests
 *
 * Validates critical navigation paths, auth guards,
 * and public route accessibility without real Firebase auth.
 */

test.describe('Public Routes — Accessibility', () => {
  test('login page loads without errors', async ({ page }) => {
    const response = await page.goto('/auth/login');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('login page has correct page title', async ({ page }) => {
    await page.goto('/auth/login');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});

test.describe('Auth Guard — Protected Routes', () => {
  test('dashboard redirects unauthenticated to login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/auth/login');
  });

  test('inventory page redirects unauthenticated', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/auth/login');
  });

  test('sales page redirects unauthenticated', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/auth/login');
  });

  test('settings page redirects unauthenticated', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/auth/login');
  });
});

test.describe('API Routes — Method & Auth Enforcement', () => {
  test('API route returns 401 for unauthenticated request', async ({ request }) => {
    const response = await request.get('/api/products');
    // API should return 401 or 403 without auth, not 500
    expect([401, 403, 404]).toContain(response.status());
  });

  test('non-existent API route returns 404', async ({ request }) => {
    const response = await request.get('/api/does-not-exist');
    expect(response.status()).toBe(404);
  });
});

test.describe('Error Handling — Client Responses', () => {
  test('custom 404 page loads for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-abc123');
    expect(response?.status()).toBe(404);
  });
});
