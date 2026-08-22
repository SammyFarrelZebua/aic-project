import { defineConfig, devices } from '@playwright/test';

/**
 * Env vars for the app itself (Supabase URLs, keys, HF token) are loaded by
 * Next.js from `.env.local` / `.env` when the webServer dev process boots.
 * The PLAYWRIGHT_* vars below are read directly from the shell environment
 * (or set in CI), so no dotenv dependency is required here.
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Bumped from Playwright's 30s default. The pipeline-heavy tests in
   * dashboard.spec.ts run a CPU-bound, largely-synchronous classification +
   * anomaly-detection pass in-process on the single dev-server thread; a
   * still-settling server has been observed to stall even a plain
   * page.goto('/login') in the next test well past 30s. Those tests already
   * carry their own much larger test.setTimeout() overrides and end with an
   * explicit settle wait, but this blanket bump gives every other spec a
   * little more headroom too. */
  timeout: 45_000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Capture a screenshot on failure. */
    screenshot: 'only-on-failure',
  },

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },

    /* Slower, additional coverage — run explicitly with `--project=firefox` or `--project=webkit`. */
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
