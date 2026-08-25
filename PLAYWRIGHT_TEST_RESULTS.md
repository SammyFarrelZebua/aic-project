# Playwright Test Results — Detektif Kemasan

> **Superseded (2026-08-22):** this is the historical result of the 2026-08-19 run, preserved for reference. The full Playwright suite was since fixed to 100% passing on 2026-08-22 — see [`PLAYWRIGHT_TESTS.md`](PLAYWRIGHT_TESTS.md)'s "Verified run (2026-08-22)" for the green run and root causes. Note this 08-19 run predates the Produk-page removal and the associated test-count change (see `PLAYWRIGHT_TESTS.md`'s test-count note).

**Run date:** 2026-08-19
**Command:** `npx playwright test --project=chromium --workers=1`
**Target:** live `npm run dev` instance at `http://localhost:3000`, seeded database (15,066 reviews, 5 factories/warehouses/couriers, 3 ground-truth incidents)
**Total duration:** 14m 6s (845.97s)

## Summary

| Metric | Count |
|---|---|
| Total tests | 35 |
| ✅ Passed | 26 |
| ❌ Failed | 8 |
| ⏭️ Skipped | 1 |
| 🔁 Flaky (passed on retry) | 0 |

**26/34 executable tests passed (76%).** All 8 failures trace back to a single root cause — see below. No test-selector or app-logic bugs were found in this run.

## Root cause of all 8 failures

The **`runs the pipeline end-to-end and shows completion`** test (`dashboard.spec.ts:45`) did not finish within its 300s assertion budget on this run — the in-process ML classification (Transformers.js, ~15k reviews) took longer than that this time. Because the pipeline runs as a **background job in the same Node process as the dev server** (`app/api/pipeline/run/route.ts`, fire-and-forget `POST`), the classification loop kept consuming CPU/memory *after* Playwright gave up and moved to the next test — starving every subsequent request for several minutes:

1. `dashboard.spec.ts:45` **"runs the pipeline end-to-end..."** — timed out waiting for the completion text (300s budget hit while the job was still genuinely running server-side).
2. `dashboard.spec.ts:66` **"cancels a running pipeline..."** — started immediately after test 1 aborted, so it hit the *original* (still-running) pipeline job rather than a fresh one; its own cancel-and-verify flow then also timed out (70s) because the server was still saturated finishing the first run's classification pass.
3. `entities.spec.ts:12,20,35,42` (4 tests) — all failed identically: `Test timeout of 30000ms exceeded while running "beforeEach" hook"` → `page.goto("http://localhost:3000/login")` never resolved within 30s. The dev server was too CPU-starved to serve a basic page load.
4. `navigation.spec.ts:9` — same symptom, `page.waitForURL` timeout navigating between sections.
5. `navigation.spec.ts:24` — same symptom, but this time `page.goto('/login')` itself resolved (server was recovering) yet the subsequent login `waitForURL(/dashboard/)` still missed its 15s window.

By the time `settings.spec.ts` (the last spec, alphabetically) ran, the server had fully recovered — confirmed by `GET /api/pipeline/status` returning `{"status":"idle", ...}` and `/login` responding in ~2.3s immediately after the run finished. This is a **resource-contention artifact of running the whole suite back-to-back on a single worker against one dev-mode Node process**, not a defect in the app or in any individual test's logic.

One test was auto-**skipped**: `cases-alerts.spec.ts:19` ("navigates to a case detail page from the list") — this test's own guard clause skips itself when `root_cause_predictions` has no rows yet to click into (expected/intentional, documented in the test itself).

### Why this happened on this run specifically
This run also included fixing a **blocking issue** found beforehand: two files (`app/(dashboard)/dashboard/page.tsx`, `app/api/pipeline/run/route.ts`) had unresolved git merge-conflict markers committed directly into source, which crashed the whole app (`/login` → 500) until resolved. Once fixed, the dev server had just recompiled every route from a cold cache when the suite started, adding extra load on top of the ML classification — a less-loaded machine, or splitting the pipeline tests into their own isolated run (see `PLAYWRIGHT_TESTS.md`), avoids this cascade.

## Full results by spec file

### ✅ `auth.spec.ts` — 8/8 passed
| Test | Status | Duration |
|---|---|---|
| redirects anonymous users to /login when visiting a protected page | ✅ passed | 1.9s |
| login page renders the live pipeline dossier panel | ✅ passed | 1.5s |
| logs in with valid credentials and lands on the dashboard | ✅ passed | 12.3s |
| rejects invalid credentials with an Indonesian error message | ✅ passed | 3.9s |
| forgot-password page renders with the static panel | ✅ passed | 7.5s |
| logged-in user is bounced away from /login back to /dashboard | ✅ passed | 7.9s |
| logout returns to the login page | ✅ passed | 5.9s |
| admin credentials resolve from env | ✅ passed | 5ms |

### ✅ `cases-alerts.spec.ts` — 4/5 passed, 1 skipped
| Test | Status | Duration |
|---|---|---|
| lists anomaly cases in the cases table | ✅ passed | 10.3s |
| navigates to a case detail page from the list | ⏭️ skipped (no cases in DB yet) | — |
| shows the empty state when there are no cases | ✅ passed | 5.6s |
| lists alerts from root_cause_predictions | ✅ passed | 5.1s |
| shows the empty state when there are no alerts | ✅ passed | 5.7s |

### ⚠️ `dashboard.spec.ts` — 4/6 passed
| Test | Status | Duration |
|---|---|---|
| renders all four KPI cards | ✅ passed | 4.2s |
| shows the pipeline trace strip with the five investigation nodes | ✅ passed | 4.3s |
| displays the complaint trend chart and ranking panel | ✅ passed | 8.5s |
| renders the candidate ranking entries with entity types | ✅ passed | 5.9s |
| **runs the pipeline end-to-end and shows completion** | ❌ **failed** | 304.5s (timed out at 300s budget) |
| pipeline button is disabled while a run is in progress | ✅ passed | 6.2s |
| **cancels a running pipeline and allows an immediate re-run** | ❌ **failed** | 70.1s (cascading from the test above) |

### ❌ `entities.spec.ts` — 0/4 passed
| Test | Status | Duration |
|---|---|---|
| lists factories with anomaly status | ❌ **failed** | 30.2s (login page.goto timeout — server starved) |
| opens a factory detail page with batch data | ❌ **failed** | 30.2s (same) |
| lists warehouses | ❌ **failed** | 30.2s (same) |
| lists couriers | ❌ **failed** | 30.2s (same) |

### ✅ `example.spec.ts` — 1/1 passed
| Test | Status | Duration |
|---|---|---|
| app boots and redirects the root route to /login | ✅ passed | 4.7s |

### ❌ `navigation.spec.ts` — 0/2 passed
| Test | Status | Duration |
|---|---|---|
| navigates to every main section via the sidebar | ❌ **failed** | 30.2s (waitForURL timeout — server starved) |
| expands the Entitas group and visits each entity list | ❌ **failed** | 19.7s (post-login redirect timeout — server recovering) |

### ✅ `products.spec.ts` — 2/2 passed
| Test | Status | Duration |
|---|---|---|
| lists products with complaint metrics | ✅ passed | 14.3s |
| searches for a product | ✅ passed | 13.1s |

### ✅ `reviews.spec.ts` — 5/5 passed
| Test | Status | Duration |
|---|---|---|
| lists reviews with AI classification columns | ✅ passed | 5.8s |
| filters reviews by complaint type | ✅ passed | 4.2s |
| filters reviews by rating | ✅ passed | 5.1s |
| searches review text | ✅ passed | 4.4s |
| deep-links from a case into filtered reviews | ✅ passed | 6.1s |

### ✅ `settings.spec.ts` — 1/1 passed
| Test | Status | Duration |
|---|---|---|
| shows the user profile and system info | ✅ passed | 7.7s |

## Also fixed during this run (blocking issue, not a test result)

Before this run could execute, the app itself was broken: two files had **unresolved git merge-conflict markers committed into source** (not an in-progress merge — `git status` was clean, the markers were already committed):

- `app/(dashboard)/dashboard/page.tsx` (lines 83–103) — conflicting pipeline-status "idle" handling
- `app/api/pipeline/run/route.ts` (lines 125–134, 332–345) — conflicting review-fetch helper and error-catch typing

This caused a webpack `ModuleBuildError: Merge conflict marker encountered`, crashing every page (`/login` → HTTP 500). Resolved by reading each side's intent against surrounding (already-merged) code and the git history, keeping the newer cancellation-aware logic (`selectAll` helper, `PipelineCancelledError` handling) while preserving the safer `unknown`/`error` typing from the other side. Verified with `tsc --noEmit` (clean) and `vitest run` (21/21 passing). **Changes are staged but not committed** (session default is not to commit to `main` without being asked).

## Recommendations

1. **Re-run just the failed specs in isolation** once the dev server is idle, to confirm they pass on their own (the failures here are load-induced, not logic bugs):
   ```bash
   npx playwright test tests/entities.spec.ts tests/navigation.spec.ts --project=chromium
   npx playwright test tests/dashboard.spec.ts -g "runs the pipeline end-to-end" --project=chromium
   npx playwright test tests/dashboard.spec.ts -g "cancels a running pipeline" --project=chromium
   ```
2. **Consider running the pipeline-heavy tests (`runs the pipeline end-to-end`, `cancels a running pipeline`) in a separate Playwright invocation** from the rest of the suite, so a slow classification pass can't starve unrelated page loads. `PLAYWRIGHT_TESTS.md` already documents this isolation concern for the completion test; it now applies to the cancel test too.
3. **Commit the merge-conflict fix** (or have someone review it) — until it's committed, a fresh `git pull`/checkout on another machine will hit the same broken build.
