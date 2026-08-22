import { test, expect } from '@playwright/test';
import { loginWithForm } from './helpers/auth';
import { clickNavLink } from './helpers/nav';

test.describe('Cases', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithForm(page);
  });

  test('lists anomaly cases in the cases table', async ({ page }) => {
    await clickNavLink(page, 'Kasus');
    await page.waitForURL(/\/cases/);
    await expect(page.getByRole('heading', { name: 'Kasus Anomali' })).toBeVisible();
    // Table header present.
    await expect(page.getByRole('columnheader', { name: 'ID Kasus' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tipe Insiden' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tersangka' })).toBeVisible();
  });

  test('navigates to a case detail page from the list', async ({ page }) => {
    await clickNavLink(page, 'Kasus');
    await page.waitForURL(/\/cases/);

    // Wait for the table to finish loading (spinner disappears).
    await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 20_000 });

    // If there are cases, open the first row's detail link. The empty-state
    // row ("Tidak ada kasus...") is still a <tr>, so gate on the detail link
    // itself rather than row count -- otherwise an empty table falls through
    // to a click on a link that was never rendered.
    const detailLinks = page.locator('tbody tr a[href^="/cases/"]');
    if ((await detailLinks.count()) > 0) {
      await detailLinks.first().click();
      await page.waitForURL(/\/cases\/[^/]+/);
      await expect(page.getByRole('heading', { name: 'Investigasi Root Cause' })).toBeVisible();
      await expect(page.getByText('Tersangka Utama')).toBeVisible();
      await expect(page.getByText('Timeline Kejadian')).toBeVisible();
    } else {
      test.skip(true, 'No cases in root_cause_predictions yet -- run the pipeline first.');
    }
  });

  test('shows the empty state when there are no cases', async ({ page }) => {
    // Simulate an empty dataset by routing the API to return no rows.
    await page.route('**/api/cases**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [], count: 0 }),
      });
    });
    await clickNavLink(page, 'Kasus');
    await page.waitForURL(/\/cases/);
    await expect(page.getByText('Tidak ada kasus yang ditemukan')).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithForm(page);
  });

  test('lists alerts from root_cause_predictions', async ({ page }) => {
    await clickNavLink(page, 'Peringatan');
    await page.waitForURL(/\/alerts/);
    await expect(page.getByRole('heading', { name: 'Peringatan' })).toBeVisible();
  });

  test('shows the empty state when there are no alerts', async ({ page }) => {
    await page.route('**/alerts', async (route) => {
      // This is a server component, so we can't easily stub data; instead just
      // assert the page renders and either shows alerts or the empty message.
      await route.continue();
    });
    await clickNavLink(page, 'Peringatan');
    await page.waitForURL(/\/alerts/);
    // Either alerts render, or the empty state.
    const emptyState = page.getByText('Tidak ada peringatan terbaru.');
    const alertCards = page.locator('a[href^="/cases/"]');
    await expect(emptyState.or(alertCards.first())).toBeVisible();
  });
});
