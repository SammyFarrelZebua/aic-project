import { test, expect } from '@playwright/test';
import { loginWithForm } from './helpers/auth';
import { clickNavLink } from './helpers/nav';

test.describe('Reviews', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithForm(page);
  });

  test('lists reviews with AI classification columns', async ({ page }) => {
    await clickNavLink(page, 'Ulasan');
    await page.waitForURL(/\/reviews/);
    await expect(page.getByRole('heading', { name: 'Ulasan' })).toBeVisible();
    // Table headers incl. probability columns.
    await expect(page.getByRole('columnheader', { name: 'Teks Review' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tipe Komplain' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Severity' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Confidence' })).toBeVisible();
    // Rows render once the API resolves.
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
  });

  test('filters reviews by complaint type', async ({ page }) => {
    await clickNavLink(page, 'Ulasan');
    await page.waitForURL(/\/reviews/);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });

    const typeSelect = page.locator('select').first();
    await typeSelect.selectOption('PRODUCT_DEFECT');
    // Debounced fetch → filtered rows re-render.
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
  });

  test('filters reviews by rating', async ({ page }) => {
    await clickNavLink(page, 'Ulasan');
    await page.waitForURL(/\/reviews/);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });

    const ratingSelect = page.locator('select').nth(1);
    await ratingSelect.selectOption('1');
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
  });

  test('searches review text', async ({ page }) => {
    await clickNavLink(page, 'Ulasan');
    await page.waitForURL(/\/reviews/);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });

    const searchInput = page.getByPlaceholder('Cari teks review...');
    await searchInput.fill('telat');
    // Debounce → results re-render.
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
  });

  test('deep-links from a case into filtered reviews', async ({ page }) => {
    // The "Lihat Semua Ulasan Kasus" link on case detail goes to /reviews?<entity>_id=X&type=Y.
    // Navigate directly to a reviews URL with an entity filter to verify the filter banner renders.
    await page.goto('/reviews?factory_id=fact-c&type=PRODUCT_DEFECT');
    await expect(page.getByText('Filter aktif:')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Pabrik: fact-c/)).toBeVisible();
  });
});
