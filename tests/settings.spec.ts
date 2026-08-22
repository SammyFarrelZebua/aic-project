import { test, expect } from '@playwright/test';
import { loginWithForm } from './helpers/auth';
import { clickNavLink } from './helpers/nav';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithForm(page);
  });

  test('shows the user profile and system info', async ({ page }) => {
    await clickNavLink(page, 'Pengaturan');
    await page.waitForURL(/\/settings/);
    await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();
    // Profile card.
    await expect(page.getByText('Profil Pengguna')).toBeVisible();
    // System info cards.
    await expect(page.getByText('Informasi Sistem')).toBeVisible();
    await expect(page.getByText('Pipeline Model AI')).toBeVisible();
    await expect(page.getByText('Sumber Dataset')).toBeVisible();
  });
});
