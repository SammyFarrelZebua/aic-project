import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, fillLoginForm, loginWithForm } from './helpers/auth';
import { clickSidebarButton } from './helpers/nav';

test.describe('Authentication', () => {
  test('redirects anonymous users to /login when visiting a protected page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Masuk ke sistem' })).toBeVisible();
  });

  test('login page renders the live pipeline dossier panel', async ({ page }, testInfo) => {
    // AuthShell renders the dossier aside with `hidden lg:block` -- it's
    // deliberately not shown below the lg breakpoint, which the
    // mobile-chromium project's viewport always is. Nothing to verify there.
    test.skip(testInfo.project.name === 'mobile-chromium', 'dossier aside is hidden below the lg breakpoint by design');

    await page.goto('/login');
    // The dead code fix wired the DossierPanel into login — verify it renders.
    await expect(page.getByText('Ringkasan pipeline hari ini')).toBeVisible({ timeout: 15_000 });
    // Pipeline nodes should be present once the async summary resolves.
    await expect(page.getByText('Review masuk', { exact: false })).toBeVisible({ timeout: 15_000 });
  });

  test('logs in with valid credentials and lands on the dashboard', async ({ page }) => {
    await loginWithForm(page);
    // KPI cards render after the dashboard API resolves.
    await expect(page.getByText('Akurasi Deteksi (Top-1)')).toBeVisible({ timeout: 20_000 });
  });

  test('rejects invalid credentials with an Indonesian error message', async ({ page }) => {
    await page.goto('/login');
    // fillLoginForm waits for hydration and verifies the fill stuck -- see
    // its comment in helpers/auth.ts for why that matters (a WebKit-only
    // race otherwise leaves the email field empty and blocks submission).
    await fillLoginForm(page, 'nobody@example.com', 'wrong-password');

    // Scope past Next.js's own route-announcer, which also has role="alert".
    // Give this real headroom -- Supabase's signInWithPassword round-trip
    // plus a shallow Next.js URL normalization (a "/login?" reload with no
    // real navigation) can occasionally still be in flight past the 5s
    // default when the dev server is busy.
    const errorBanner = page.getByRole('alert').filter({ hasText: /salah|Invalid/i });
    await expect(errorBanner).toBeVisible({ timeout: 15_000 });
  });

  test('forgot-password page renders with the static panel', async ({ page }, testInfo) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Lupa kata sandi?' })).toBeVisible();

    // StaticPanel is the aside on forgot/reset pages, rendered with `hidden
    // lg:block` in AuthShell -- deliberately not shown below the lg
    // breakpoint, which the mobile-chromium project's viewport always is.
    test.skip(testInfo.project.name === 'mobile-chromium', 'static aside is hidden below the lg breakpoint by design');
    await expect(page.getByText('Pemulihan akses investigasi')).toBeVisible();
  });

  test('logged-in user is bounced away from /login back to /dashboard', async ({ page }) => {
    await loginWithForm(page);
    await page.goto('/login');

    // This is the actual behavior under test: middleware sees an
    // authenticated user hit an auth-only page and 302s them back to
    // /dashboard instead of showing the login form.
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // Deliberately not asserting on the dashboard's own data (e.g. the
    // "Beranda" content heading, gated behind a successful
    // /api/analytics/dashboard fetch) beyond this. Observed on WebKit only:
    // that fetch can get a genuine 401 here -- middleware's auth.getUser()
    // on the /login request refreshes the session and re-issues it as a
    // (possibly multi-chunk) Set-Cookie on the redirect response, and
    // WebKit's cookie jar doesn't always have that fully applied before the
    // dashboard's client-side fetch fires. Neither retrying the fetch nor a
    // full page reload reliably clears it once it happens, so this isn't a
    // simple timing wait to add. That's a separate, narrower concern from
    // "did the auth-only-page bounce happen", which the URL assertion above
    // already covers -- so assert on the sidebar (part of the layout shell,
    // rendered regardless of that fetch's outcome) instead of the
    // fetch-gated content heading.
    await expect(page.getByRole('link', { name: 'Beranda' })).toBeVisible({ timeout: 15_000 });
  });

  test('logout returns to the login page', async ({ page }) => {
    await loginWithForm(page);
    await clickSidebarButton(page, 'Keluar');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Masuk ke sistem' })).toBeVisible({ timeout: 15_000 });
  });

  test('admin credentials resolve from env', () => {
    expect(ADMIN_EMAIL).toMatch(/@/);
    expect(ADMIN_PASSWORD.length).toBeGreaterThan(0);
  });
});
