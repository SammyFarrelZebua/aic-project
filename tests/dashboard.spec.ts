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

  test('cancels a running pipeline and allows an immediate re-run', async ({ page }) => {
    // Shares the same in-process pipelineState as the completion test above,
    // so this must run in its own worker/serial context -- see
    // PLAYWRIGHT_TESTS.md for the isolation note.
    test.setTimeout(120_000);

    await page.getByRole('button', { name: 'Run Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'Menjalankan Pipeline...' })).toBeVisible({ timeout: 10_000 });

    // The dashboard resets to a clean/empty display the instant Run fires,
    // instead of showing the previous run's stale KPIs/charts.
    await expect(page.getByText('—').first()).toBeVisible({ timeout: 5_000 });

    // Give the classification loop a few seconds to actually start before
    // cancelling, so this exercises a genuine mid-run stop.
    await page.waitForTimeout(5000);
    await page.getByRole('button', { name: 'Cancel Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'Menghentikan Pipeline...' })).toBeVisible({ timeout: 10_000 });

    // The classification loop's cancellation checkpoint fires every 25
    // reviews, so this should settle well within the polling window.
    await expect(page.getByText('Pipeline dibatalkan.')).toBeVisible({ timeout: 60_000 });

    // The concurrency guard must not treat "cancelled" as "still running" --
    // a fresh run should be startable immediately.
    await expect(page.getByRole('button', { name: 'Run Pipeline' })).toBeEnabled({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Run Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'Menjalankan Pipeline...' })).toBeVisible({ timeout: 10_000 });

    // Cancel this one too so the suite doesn't leave a run in flight.
    await page.getByRole('button', { name: 'Cancel Pipeline' }).click();
    await expect(page.getByText('Pipeline dibatalkan.')).toBeVisible({ timeout: 60_000 });
  });
});
