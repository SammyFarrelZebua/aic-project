import { test, expect } from '@playwright/test';

/**
 * Minimal smoke test that the app boots. This replaces the default
 * Playwright example spec (which pointed at playwright.dev).
 */
test('app boots and redirects the root route to /login', async ({ page }) => {
  await page.goto('/');
  // Anonymous → root redirects to /dashboard → middleware bounces to /login.
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Masuk ke sistem' })).toBeVisible();
});
