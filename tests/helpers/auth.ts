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

/**
 * Fill and submit the login form, assuming the page is already on /login.
 * Does not wait for or assert anything about the outcome (success vs. error)
 * -- callers do that, since e.g. an invalid-credentials test expects an
 * error banner, not a redirect.
 */
export async function fillLoginForm(page: Page, email: string, password: string) {
  const emailInput = page.getByLabel('Email');
  const passwordInput = page.getByLabel('Kata sandi');

  // Root cause of a consistent WebKit-only failure: LoginForm's inputs are
  // React-controlled (value={email}/{password}, onChange updates state).
  // If .fill() runs before React has hydrated and attached its onChange
  // handler, the DOM value gets set directly but React's own state stays
  // "", so the *next* hydration reconciliation resets the input back to
  // that stale empty state -- silently discarding what was just typed. On
  // this machine WebKit hydrates slowly/inconsistently enough under
  // Playwright automation to lose this race almost every time (email ends
  // up empty, blocking submission via the input's `required` attribute),
  // while Chromium/Firefox hydrate fast enough that it essentially never
  // manifests. Wait for the page to go quiet (a reasonable proxy for
  // hydration having completed) before typing, and verify defensively
  // afterwards in case a reconciliation still lands in between.
  await page.waitForLoadState('networkidle');
  await emailInput.fill(email);
  await passwordInput.fill(password);
  if ((await emailInput.inputValue()) !== email) {
    await emailInput.fill(email);
  }
  if ((await passwordInput.inputValue()) !== password) {
    await passwordInput.fill(password);
  }

  await page.getByRole('button', { name: 'Masuk' }).click();
}

/** Drive the real login form and assert we land on the dashboard. */
export async function loginWithForm(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  // After pipeline tests, the server may still be settling. A small delay
  // before navigation helps ensure the dev server is ready to accept requests.
  // This is a test-resilience measure, not an app bug.
  await page.waitForTimeout(500);

  await page.goto(LOGIN_URL);
  await fillLoginForm(page, email, password);

  // Supabase session write + Next router redirect. On a `next dev` (webpack)
  // server, whichever test runs first pays the one-time cost of compiling
  // /dashboard on demand -- observed up to ~17s on this machine, past the
  // previous 15s budget. 30s gives real headroom for that cold hit while
  // still catching a genuinely broken redirect quickly on every other run.
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Beranda' })).toBeVisible({ timeout: 15_000 });
}
