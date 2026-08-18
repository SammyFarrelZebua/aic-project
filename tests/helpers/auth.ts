import { expect, type Page } from '@playwright/test';

/**
 * Shared auth helpers for the Detektif Kemasan E2E suite.
 *
 * The app uses Supabase SSR with cookie-based sessions, so the pragmatic way
 * to "log in" for tests is to drive the real login form once, then reuse the
 * resulting cookies. `loginAndStoreState` performs that one real login; every
 * other spec loads the saved storage state instead.
 */

export const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@admin.com';
export const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'admin123';

export const LOGIN_URL = '/login';
export const DASHBOARD_URL = '/dashboard';

/** Drive the real login form and assert we land on the dashboard. */
export async function loginWithForm(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto(LOGIN_URL);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();

  // Supabase session write + Next router redirect
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Beranda' })).toBeVisible({ timeout: 15_000 });
}
