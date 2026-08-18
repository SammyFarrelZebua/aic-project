import { test, expect } from '@playwright/test';
import { loginWithForm } from './helpers/auth';

test.describe('Entities', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithForm(page);
    // The "Entitas" group is a disclosure collapsed by default outside
    // /entities/* routes -- expand it before any sub-link click.
    await page.getByRole('button', { name: 'Entitas' }).click();
  });

  test('lists factories with anomaly status', async ({ page }) => {
    await page.getByRole('link', { name: 'Pabrik' }).click();
    await page.waitForURL(/\/entities\/factories/);
    await expect(page.getByRole('heading', { name: 'Pabrik' })).toBeVisible();
    // Cards render at least one factory from the seed data.
    await expect(page.locator('a[href^="/entities/factories/"]').first()).toBeVisible({ timeout: 20_000 });
  });

  test('opens a factory detail page with batch data', async ({ page }) => {
    await page.getByRole('link', { name: 'Pabrik' }).click();
    await page.waitForURL(/\/entities\/factories/);
    const firstCard = page.locator('a[href^="/entities/factories/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    await firstCard.click();
    await page.waitForURL(/\/entities\/factories\/[^/]+/);
    // Detail page shows anomaly history and batch production cards. Give
    // this an explicit budget rather than the 5s default -- it's a fresh
    // route (server-rendered, 3 parallel Supabase queries) that can be slow
    // to compile/respond under load.
    await expect(page.getByText('Riwayat Anomali')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Batch Produksi')).toBeVisible();
  });

  test('lists warehouses', async ({ page }) => {
    await page.getByRole('link', { name: 'Gudang' }).click();
    await page.waitForURL(/\/entities\/warehouses/);
    await expect(page.getByRole('heading', { name: 'Gudang' })).toBeVisible();
    await expect(page.locator('a[href^="/entities/warehouses/"]').first()).toBeVisible({ timeout: 20_000 });
  });

  test('lists couriers', async ({ page }) => {
    await page.getByRole('link', { name: 'Kurir' }).click();
    await page.waitForURL(/\/entities\/couriers/);
    await expect(page.getByRole('heading', { name: 'Kurir' })).toBeVisible();
    await expect(page.locator('a[href^="/entities/couriers/"]').first()).toBeVisible({ timeout: 20_000 });
  });
});
