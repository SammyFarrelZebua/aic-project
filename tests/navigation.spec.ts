import { test, expect } from '@playwright/test';
import { loginWithForm } from './helpers/auth';
import { clickNavLink, clickSidebarButton } from './helpers/nav';

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithForm(page);
  });

  test('navigates to every main section via the sidebar', async ({ page }) => {
    const links = [
      { label: 'Beranda', path: /\/dashboard/ },
      { label: 'Ulasan', path: /\/reviews/ },
      { label: 'Kasus', path: /\/cases/ },
      { label: 'Peringatan', path: /\/alerts/ },
      { label: 'Pengaturan', path: /\/settings/ },
    ];
    for (const { label, path } of links) {
      await clickNavLink(page, label);
      await page.waitForURL(path);
    }
  });

  test('expands the Entitas group and visits each entity list', async ({ page }) => {
    // Expand the Entitas group if not already open.
    await clickSidebarButton(page, 'Entitas');
    const subLinks = [
      { label: 'Pabrik', path: /\/entities\/factories/ },
      { label: 'Gudang', path: /\/entities\/warehouses/ },
      { label: 'Kurir', path: /\/entities\/couriers/ },
    ];
    for (const { label, path } of subLinks) {
      await clickNavLink(page, label);
      await page.waitForURL(path);
    }
  });
});
