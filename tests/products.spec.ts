import { test, expect } from '@playwright/test';
import { loginWithForm } from './helpers/auth';

test.describe('Products', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithForm(page);
  });

  test('lists products with complaint metrics', async ({ page }) => {
    await page.getByRole('link', { name: 'Produk' }).click();
    await page.waitForURL(/\/products/);
    await expect(page.getByRole('heading', { name: 'Produk' })).toBeVisible();
    // Table headers.
    await expect(page.getByRole('columnheader', { name: 'Nama Produk' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Jml Order' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Jml Komplain' })).toBeVisible();
    // At least one product row.
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
  });

  test('searches for a product', async ({ page }) => {
    await page.getByRole('link', { name: 'Produk' }).click();
    await page.waitForURL(/\/products/);
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });

    const searchInput = page.getByPlaceholder('Cari nama produk, brand, kategori...');
    await searchInput.fill('leite');
    await page.getByRole('button', { name: 'Cari' }).click();
    await page.waitForURL(/search=leite/);
    // The search should return results (or at least render without crashing).
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
  });
});
