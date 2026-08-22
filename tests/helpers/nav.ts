import type { Locator, Page } from '@playwright/test';

/**
 * Click something inside the sidebar (a nav link, the "Entitas" disclosure
 * button, the "Keluar" logout button, ...), opening the mobile drawer first
 * if it's currently closed.
 *
 * Below Tailwind's `md` breakpoint, `components/sidebar.tsx` renders the
 * whole sidebar off-screen (`-translate-x-full`) until the hamburger button
 * (`aria-label="Buka menu"`) sets `mobileOpen`. Sidebar contents are still
 * present in the DOM and pass Playwright's `.toBeVisible()` (which doesn't
 * care about scroll/transform position), but `.click()`'s actionability
 * check does require the target to be within the viewport -- so clicking
 * anything inside a closed mobile drawer directly (e.g. on the
 * `mobile-chromium` project) retries scrolling it into view for the full
 * test timeout and never succeeds.
 *
 * The hamburger button itself is *always* present and visible on mobile
 * viewports regardless of drawer state (it's the fixed top bar, not part of
 * the drawer), so its visibility can't be used to detect "is the drawer
 * open" -- clicking it again while already open just has the now-open
 * drawer's own container (higher z-index) intercept the click. Instead,
 * attempt the real click first; only fall back to opening the drawer if
 * that fails (i.e. we're on a mobile viewport with the drawer closed), then
 * retry once.
 */
async function clickInSidebar(page: Page, locator: Locator) {
  try {
    await locator.click({ timeout: 3_000 });
    return;
  } catch {
    // Fall through to the mobile-drawer-open path below.
  }
  await page.getByRole('button', { name: 'Buka menu' }).click();
  await locator.click();
}

export async function clickNavLink(page: Page, name: string) {
  await clickInSidebar(page, page.getByRole('link', { name }));
}

export async function clickSidebarButton(page: Page, name: string) {
  await clickInSidebar(page, page.getByRole('button', { name }));
}
