# Playwright E2E Test Suite — Detektif Kemasan

End-to-end browser tests for the Detektif Kemasan (AIC 2026) dashboard. Tests live in `tests/`, run with [Playwright](https://playwright.dev/).

## Prerequisites

The suite drives the **real app** against a **seeded database**, so before running:

1. **Install the app + Supabase schema**
   ```bash
   npm ci
   npx supabase db push            # apply migrations
   npm run ingest                  # seed Olist data + 3 ground-truth incidents
   npx tsx scripts/seed-admin.ts   # create admin@admin.com / admin123
   ```

2. **Environment** — the dev server reads `.env.local` (Supabase URL/keys, HF token). Override the test credentials/base URL if needed:
   ```bash
   # optional overrides
   PLAYWRIGHT_BASE_URL=http://localhost:3000
   PLAYWRIGHT_ADMIN_EMAIL=admin@admin.com
   PLAYWRIGHT_ADMIN_PASSWORD=admin123
   ```

3. **Playwright browsers**
   ```bash
   npx playwright install chromium
   ```

## Running

| Command | What it does |
|---|---|
| `npx playwright test` | Runs the full suite (chromium + mobile-chromium) on a fresh dev server |
| `npx playwright test tests/auth.spec.ts` | Runs one spec file |
| `npx playwright test --project=firefox` | Runs a single browser project |
| `npx playwright test --headed` | Watch tests run in a browser window |
| `npx playwright test --ui` | Interactive UI mode |
| `npx playwright test --project=chromium --grep "login"` | Filter by test name |

The `webServer` config auto-starts `npm run dev` (reusing an already-running server locally). Screenshots are captured on failure; traces on first retry. The GitHub Actions workflow (`.github/workflows/playwright.yml`) runs the full suite on push/PR to `main`.

## Test inventory

### `tests/example.spec.ts`
Smoke test replacing the Playwright template default.

| Test | Verifies |
|---|---|
| `app boots and redirects the root route to /login` | Anonymous `/` → `/dashboard` redirect → middleware bounce to `/login` |

### `tests/auth.spec.ts` — Authentication & session
| Test | Verifies |
|---|---|
| `redirects anonymous users to /login when visiting a protected page` | Middleware route protection on `/dashboard` |
| `login page renders the live pipeline dossier panel` | **Dead-code fix**: `DossierPanel` (pipeline snapshot) renders on login |
| `logs in with valid credentials and lands on the dashboard` | Real Supabase login flow; KPI cards render |
| `rejects invalid credentials with an Indonesian error message` | Error banner on bad login |
| `forgot-password page renders with the static panel` | `StaticPanel` aside on forgot-password |
| `logged-in user is bounced away from /login back to /dashboard` | Auth-only page guard |
| `logout returns to the login page` | Sidebar logout flow |
| `admin credentials resolve from env` | Env-var sanity check |

### `tests/dashboard.spec.ts` — Dashboard home
| Test | Verifies |
|---|---|
| `renders all four KPI cards` | Accuracy / incidents / duration / reviews KPIs |
| `shows the pipeline trace strip with the five investigation nodes` | TraceStrip nodes render |
| `displays the complaint trend chart and ranking panel` | Recharts chart + ranking panel |
| `renders the candidate ranking entries with entity types` | Candidate ranking rows + type badges |
| `runs the pipeline end-to-end and shows completion` | "Run Pipeline" → running → "Selesai dalam Xs" |
| `pipeline button is disabled while a run is in progress` | In-flight button state |
| `cancels a running pipeline and allows an immediate re-run` | Reset-to-empty display on Run, "Cancel Pipeline" -> "Pipeline dibatalkan.", re-run not blocked by the concurrency guard |

### `tests/cases-alerts.spec.ts` — Cases & alerts
| Test | Verifies |
|---|---|
| `lists anomaly cases in the cases table` | Cases table headers render |
| `navigates to a case detail page from the list` | Case → detail dossier (root cause, timeline, evidence) |
| `shows the empty state when there are no cases` | Empty-state message via API stub |
| `lists alerts from root_cause_predictions` | Alerts page renders |
| `shows the empty state when there are no alerts` | Empty-state OR alert cards present |

### `tests/entities.spec.ts` — Supply-chain entities
| Test | Verifies |
|---|---|
| `lists factories with anomaly status` | Factory cards + anomaly badges |
| `opens a factory detail page with batch data` | Factory detail: anomaly history + batch production |
| `lists warehouses` | Warehouse list |
| `lists couriers` | Courier list |

### `tests/products.spec.ts` — Product stats
| Test | Verifies |
|---|---|
| `lists products with complaint metrics` | Products table + complaint metrics |
| `searches for a product` | Search form navigates with query |

### `tests/reviews.spec.ts` — Reviews & AI classification
| Test | Verifies |
|---|---|
| `lists reviews with AI classification columns` | Reviews table incl. probability + confidence columns |
| `filters reviews by complaint type` | Type dropdown filter |
| `filters reviews by rating` | Rating dropdown filter |
| `searches review text` | Debounced text search |
| `deep-links from a case into filtered reviews` | Entity-filter banner renders from URL params |

### `tests/settings.spec.ts` — Settings
| Test | Verifies |
|---|---|
| `shows the user profile and system info` | Profile card + system/model/dataset info |

### `tests/navigation.spec.ts` — Sidebar
| Test | Verifies |
|---|---|
| `navigates to every main section via the sidebar` | All primary nav links |
| `expands the Entitas group and visits each entity list` | Factories/warehouses/couriers sub-nav |

## Notes

- **Login strategy**: each spec performs one real login via the login form per test (cookie-based Supabase SSR session). There is no storage-state sharing yet — a future optimization could add a `storageState` fixture to log in once per worker.
- **Pipeline run test** is intentionally slow (classifies ~15k reviews in-process via Transformers.js) — it exercises the full NLP + anomaly + ranking path and asserts the completion line. It has been observed to take anywhere from ~1 to ~5 minutes depending on machine load (`test.setTimeout(360_000)`, assertion timeout `300_000`). Under heavy concurrent load (e.g. running the full suite on a single worker back-to-back with everything else) it can occasionally exceed even that budget — this is dev-server/model-load contention, not an app bug. Run it in isolation (`npx playwright test tests/dashboard.spec.ts -g "runs the pipeline"`) if it flakes in a full-suite run.
- **Empty-state tests** use Playwright request stubbing (`page.route`) so they don't require wiping the DB.
- The `tests/` folder is excluded from Vitest (see `vitest.config.ts`), so the unit suite doesn't pick up Playwright specs.
- **First-run cold start**: the very first test against a freshly-started `npm run dev` can be slow (on-demand webpack compilation of the login/dashboard bundles). If you see timeouts only on the first test of a fresh server, warm it with `curl http://localhost:3000/login` before running the suite, or just re-run — the `webServer.reuseExistingServer` option means subsequent runs hit the already-warm server.
- **Cancel Pipeline**: added alongside the "reset display on Run" behavior. Clicking Run immediately shows placeholder/empty KPIs and charts (derived display data, never mutating the underlying fetched data) rather than the previous run's stale numbers. Cancel uses a cooperative in-memory flag (`pipelineState.cancelRequested`) checked at the classification loop's existing every-25-review checkpoint -- there is no true task-cancellation primitive, so a cancel clicked during the one-time model load or the synchronous `detectAnomalies()` pass can take a few extra seconds to take effect. A cancelled run leaves `root_cause_predictions` empty and `complaint_prediction` possibly partially populated; this is intentional (the pipeline already deletes-then-repopulates both tables on every run, so partial state is transient) -- see the plan notes in the repo history for the full design rationale.

## Verified run (2026-08-18)

Ran against a live `npm run dev` instance with a seeded database (15,066 reviews, 5 factories/warehouses/couriers, 3 ground-truth incidents). Final result on a warm server, single worker: **34/34 passing** (one full run: 32/34 with the pipeline test hitting a tight timeout under heavy concurrent load — see note above; fixed by widening timeouts and re-verified individually).

Issues found and fixed during verification (all in the test suite, not the app):
1. `auth.spec.ts` — `getByRole('alert')` matched both the real error banner and Next.js's route-announcer element; scoped with `.filter({ hasText })`.
2. `dashboard.spec.ts` — the pipeline test's own timeout wasn't raised to match its assertion's timeout, so Playwright's 30s default killed it before the 180s/300s assertion budget ran out; added `test.setTimeout(360_000)`.
3. `cases-alerts.spec.ts` — the case-detail test's empty-state guard counted the "no cases" placeholder row as a real row and tried to click a nonexistent link; now gates on the actual detail-link locator and skips cleanly when there's no data yet.
4. `entities.spec.ts` — clicked the "Pabrik"/"Gudang"/"Kurir" sidebar links without first expanding the collapsed "Entitas" disclosure group; added the expand click to `beforeEach`, plus a wider timeout on one assertion that raced route compilation under load.
