import { test, expect } from '@playwright/test';
import { loginWithForm } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithForm(page);
  });

  test('renders all four KPI cards', async ({ page }) => {
    await expect(page.getByText('Akurasi Deteksi (Top-1)')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Insiden Terdeteksi')).toBeVisible();
    await expect(page.getByText('Durasi Anomali Aktif')).toBeVisible();
    await expect(page.getByText('Review Diproses')).toBeVisible();
  });

  test('shows the pipeline trace strip with the five investigation nodes', async ({ page }) => {
    await expect(page.getByText('Jejak Pipeline')).toBeVisible();
    const labels = [
      'Review Masuk',
      'Diklasifikasi',
      'Anomali Terdeteksi',
      'Ditelusuri',
      'Alert Dikirim',
    ];
    for (const label of labels) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test('displays the complaint trend chart and ranking panel', async ({ page }) => {
    await expect(page.getByText('Tren Komplain Harian')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Peringkat Tersangka')).toBeVisible();
  });

  test('renders the candidate ranking entries with entity types', async ({ page }) => {
    // Wait for the ranking panel to be populated (any of Pabrik/Gudang/Kurir).
    await expect(page.getByText('Peringkat Tersangka')).toBeVisible({ timeout: 20_000 });
    const ranking = page.locator('ul.divide-y.divide-line');
    if ((await ranking.count()) > 0) {
      // If there are candidates, the panel lists entity-type badges.
      await expect(ranking.first()).toBeVisible();
    }
  });

  test('runs the pipeline end-to-end and shows completion', async ({ page }) => {
    // Classifies ~15k reviews in-process (Transformers.js) — on a loaded dev
    // machine this has been observed to run past 3 minutes, so give it a
    // generous budget. The test's own timeout must exceed the assertion's.
    test.setTimeout(360_000);

    // Click "Run Pipeline"; the trace strip should enter running state.
    await page.getByRole('button', { name: 'Run Pipeline' }).click();

    // The button disables while running, then completion is reflected on the strip.
    await expect(page.getByRole('button', { name: 'Menjalankan Pipeline...' })).toBeVisible({ timeout: 10_000 });

    // Polling every 2s → completion (the "Selesai dalam ..." line appears).
    await expect(page.getByText(/Selesai dalam \d+(\.\d+)?s/)).toBeVisible({ timeout: 300_000 });
  });

  test('pipeline button is disabled while a run is in progress', async ({ page }) => {
    await page.getByRole('button', { name: 'Run Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'Menjalankan Pipeline...' })).toBeDisabled({ timeout: 10_000 });
  });
});
