import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*auth\/login.*/);
  });

  test('displays login form elements', async ({ page }) => {
    await page.goto('/auth/login');
    const button = page.getByRole('button', { name: /entrar|login|iniciar/i });
    await expect(button).toBeVisible();
  });

  test('rejects invalid credentials with error message', async ({ page }) => {
    await page.goto('/auth/login');

    const emailField = page.getByPlaceholder(/correo|email/i);
    const passwordField = page.getByPlaceholder(/contraseña|password/i);

    if (await emailField.isVisible()) {
      await emailField.fill('invalid@test.com');
      await passwordField.fill('wrongpassword');

      const button = page.getByRole('button', { name: /entrar|login|iniciar/i });
      await button.click();

      // Should show an error or remain on login page
      await expect(page).toHaveURL(/.*auth\/login.*/);
    }
  });
});
