import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginWithForm } from './helpers/auth';

test.describe('Authentication', () => {
  test('redirects anonymous users to /login when visiting a protected page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Masuk ke sistem' })).toBeVisible();
  });

  test('login page renders the live pipeline dossier panel', async ({ page }) => {
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
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Kata sandi').fill('wrong-password');
    await page.getByRole('button', { name: 'Masuk' }).click();

    // Scope past Next.js's own route-announcer, which also has role="alert".
    const errorBanner = page.getByRole('alert').filter({ hasText: /salah|Invalid/i });
    await expect(errorBanner).toBeVisible();
  });

  test('forgot-password page renders with the static panel', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Lupa kata sandi?' })).toBeVisible();
    // StaticPanel is the aside on forgot/reset pages.
    await expect(page.getByText('Pemulihan akses investigasi')).toBeVisible();
  });

  test('logged-in user is bounced away from /login back to /dashboard', async ({ page }) => {
    await loginWithForm(page);
    await page.goto('/login');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Beranda' })).toBeVisible();
  });

  test('logout returns to the login page', async ({ page }) => {
    await loginWithForm(page);
    await page.getByRole('button', { name: 'Keluar' }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Masuk ke sistem' })).toBeVisible();
  });

  test('admin credentials resolve from env', () => {
    expect(ADMIN_EMAIL).toMatch(/@/);
    expect(ADMIN_PASSWORD.length).toBeGreaterThan(0);
  });
});
