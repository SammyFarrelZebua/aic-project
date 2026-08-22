# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context
* **Project Name**: Detektif Kemasan (AIC 2026)
* **Goal**: AI-powered complaint intelligence that traces customer reviews (probable operational source ranking, not causal proof) back to the supply chain.
* **Core Flow**: Customer Review -> Complaint Understanding (NLP classification) -> Temporal Anomaly Detection -> Supply-Chain Traceability -> Candidate Source Ranking -> Operational Alert.
* **Source Dataset**: Olist Brazilian E-Commerce Dataset, subset to ~15,000 orders. Review text is machine-translated Portuguese->Indonesian; the UI and NLP labels are Indonesian.

## Commands
* `npm run dev` — start the Next.js dev server (webpack)
* `npm run build` — production build (webpack)
* `npm run start` — start production server
* `npm run lint` — run ESLint
* `npm run ingest` — run `scripts/etl-ingest.ts`: downloads Olist CSVs, generates synthetic factory/warehouse/courier/batch metadata, injects 3 controlled incidents, and writes everything to Supabase
* `npm run generate-local` — run `scripts/generate-local-dataset.ts`: same generation logic as `ingest` but writes local JSON/CSV under `data/` instead of Supabase (used for offline NLP experiments)
* `npm run validate` — run `scripts/validate.ts`: sanity-checks row counts, the `analytics_traceability_view`, and the injected incident stats against Supabase
* `npm run test` — run the Vitest unit-test suite (config in `vitest.config.ts`; unit tests live next to modules in `lib/` and `utils/`)
* `npm run test-baseline` — run `scripts/nlp-anomaly-baseline.ts`: evaluates a rule-based Indonesian regex classifier against `data/ground_truth_incidents.csv` (precision/recall/F1 + Top-1 anomaly-ranking accuracy)
* `npm run test-huggingface` — run `scripts/nlp-huggingface-eval.ts`: same evaluation but classifies via the Hugging Face Inference API (zero-shot, `MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7`), with a JSON prediction cache at `data/hf_predictions_cache.json` and rule-based fallback after repeated API failures
* Playwright E2E tests live under `tests/` (see `PLAYWRIGHT_TESTS.md` for the full list). Run with `npx playwright test --workers=1` (the config runs all 4 browser projects with unbounded parallelism by default, which reliably causes cross-project races — see `PLAYWRIGHT_TESTS.md`'s concurrency caveat); requires a running dev server (`npm run dev`) and a seeded database with an admin account (`npm run ingest` + `npx tsx scripts/seed-admin.ts`).

The NLP/anomaly pipeline is checked via `test-baseline` / `test-huggingface` (offline, dataset-driven) against `data/ground_truth_incidents.csv`.

## Architecture

### Database (Supabase / Postgres)
Schema lives in 7 migrations under `supabase/migrations/`:
* `20260809000000_init_schema.sql` — core schema + `analytics_traceability_view`. Core entities and traceability paths:
  * `factory` -> `batch` -> `product` -> `orders`
  * `warehouse`/`courier` -> `shipment` -> `orders`
  * `orders` -> `review` -> `review_image`
  * `review` -> `complaint_prediction` (NLP output)
  * `incidents` (synthetic ground truth) and `root_cause_predictions` (pipeline output, evaluated against `incidents`)
* `20260812000000_add_profiles.sql` — `profiles` table (the only RLS-enabled table, auto-provisioned via trigger on `auth.users`)
* `20260816000000_product_stats_view.sql` — `product_stats_view` (per-product order/complaint counts, `needs_alert` flag)
* `20260816000001_add_fk_indexes.sql` — 9 FK indexes for the core tables
* `20260816000002_daily_complaints_view.sql` — `daily_complaints_view` (per-day review + complaint-type counts for the dashboard timeseries)
* `20260816000003_add_nlp_probabilities.sql` — adds `prob_product_defect` / `prob_packaging_damage` / `prob_late_delivery` multi-class columns to `complaint_prediction`
* `20260818000000_add_review_date_index.sql` — adds `idx_review_review_date ON review(review_date DESC)`. Without it, the Reviews page/`/api/reviews` query (ordered by `review_date DESC`, joined with `complaint_prediction`) did a full sort over ~15k rows and could exceed the statement timeout, returning a 500 that the frontend silently swallowed into the "Tidak ada ulasan yang ditemukan" empty state.

`analytics_traceability_view` flattens `review -> orders -> product/batch -> factory` and `orders -> shipment -> warehouse/courier` into one row per review; both API routes and the eval scripts read from this view rather than joining raw tables themselves.

Supabase client helpers live in `utils/supabase/`: `client.ts` (browser), `server.ts` (RSC, cookie-based), `middleware.ts` (session refresh), and `service.ts` (service-role key, `persistSession:false` — used server-side by API routes and scripts, bypasses RLS).

### Routing & auth
* This Next.js version uses **`proxy.ts`** (not `middleware.ts`) as the routing guard. It routes through `utils/supabase/middleware.ts` for session refresh and route protection.
* Protected routes and auth-only pages are centralized in `lib/auth-routes.ts` (`isProtectedPath` / `isAuthOnlyPath`). Protected: `/dashboard`, `/cases`, `/entities`, `/products`, `/alerts`, `/reviews`, `/settings` (and `/`). Auth-only: `/login`, `/forgot-password`.
* `app/page.tsx` redirects `/` -> `/dashboard` (also configured in `next.config.ts`).

### Inference & anomaly pipeline (`app/api/pipeline/run/route.ts`)
This is the core detection logic, and the anomaly detection approach has been refactored and centralized in `utils/anomaly-detection.ts`. Both the main API route and the offline evaluation scripts (`scripts/nlp-anomaly-baseline.ts` / `nlp-huggingface-eval.ts`) use this shared utility:
1. Clears `root_cause_predictions` / `complaint_prediction`, then fetches both the full `review` table and `analytics_traceability_view` via the same generic `selectAll<T>()` helper (`app/api/pipeline/run/route.ts`) — PostgREST's default `max_rows` (1000) silently truncates a bare `.select('*')`, so both reads page through `.range()` in chunks of 1000 rather than fetching in one call. This was a real production bug (pipeline was silently only processing the first 1,000 reviews) fixed 2026-08-17; keep this pattern if you touch these fetches. (There is no separate `fetchAllReviews()` function — both tables/views go through the one `selectAll<T>()` helper.)
2. For `rating <= 3`, lazily loads a Transformers.js zero-shot classifier (`Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7`, runs in-process via `@huggingface/transformers`) to label each review as `PRODUCT_DEFECT`, `PACKAGING_DAMAGE`, or `LATE_DELIVERY`; severity is derived from rating. A cheap regex keyword pre-filter skips the model for reviews that match no complaint keyword; confidence thresholds vary by rating (1->0.20, 2->0.25, 3->0.35) with a 0.18 "margin over normal" gate. Multi-class probabilities are stored in `complaint_prediction`.
3. Joins predictions onto `analytics_traceability_view` and runs a sliding-window temporal anomaly detector per incident type: 7-day current window vs. a 30-day historic window (offset 37 days), flagging a spike when `r_current/(r_historic+0.001) >= 2.0`, current-window complaint count `>= 3`, and a sample-size gate (current window `>= 30` reviews, historic window `>= 50` reviews).
4. Scores candidate factories/warehouses/couriers with a **hybrid composite score**: `0.6 * isolationForestScore + 0.4 * (deviationRatio * incidentComplaintShare)`. The isolation-forest component (`utils/isolation-forest-detector.ts`) builds a 5-dim entity feature vector and normalizes outlier scores to [0,1]. Inserts the top candidate per anomaly into `root_cause_predictions`.

The pipeline runs as a **background job**: `POST /api/pipeline/run` returns immediately, progress is polled via `GET /api/pipeline/status`, and status lives in the in-memory `app/api/pipeline/state.ts` (does not survive restarts; single-process only).

`app/api/analytics/dashboard/route.ts` (`force-dynamic`, 5-min cache via `unstable_cache`, `?fresh=true` bypass) computes dashboard KPIs, accuracy of `root_cause_predictions` vs. `incidents` (±7 day window + matching entity), a daily complaint-type timeseries from `daily_complaints_view`, and factory/warehouse/courier rankings by anomaly count. Note: the entity match in the accuracy calculation only compares `incidents.entity_id === root_cause_predictions.candidate_id` — it does not cross-check `candidate_type` against an entity-type field, so a prediction attributed to the right ID but wrong entity type would still count as correct.

### Dashboard & pages
The app UI lives under a `(dashboard)` route group with a sidebar layout:
* `app/(dashboard)/dashboard/page.tsx` — client component fetching `/api/analytics/dashboard` on mount, "Run Pipeline" button that POSTs `/api/pipeline/run` and polls `/api/pipeline/status`, KPI cards, a Recharts complaint-trend chart, a top-suspects ranking panel, and a TraceStrip pipeline visual.
* `app/(dashboard)/cases/page.tsx` + `cases/[id]/page.tsx` — anomaly case list and detail dossier with entity-correlated review evidence (reads `analytics_traceability_view`).
* `app/(dashboard)/alerts/page.tsx` — alert cards from `root_cause_predictions`.
* `app/(dashboard)/entities/{factories,warehouses,couriers}/` — list + detail pages with per-entity anomaly counts.
* `app/(dashboard)/products/page.tsx` — searchable product stats from `product_stats_view`.
* `app/(dashboard)/reviews/page.tsx` — filterable review list (search/type/rating/entity) reading `/api/reviews`.
* `app/(dashboard)/settings/page.tsx` — auth user profile + system info.
* Auth pages: `app/login`, `app/forgot-password`, `app/reset-password`, and `app/auth/confirm` (email OTP handler). The login page renders a live pipeline "dossier" panel (`components/auth/dossier-panel.tsx` fed by `lib/dossier-summary.ts`); forgot/reset use `components/auth/static-panel.tsx`.
* `app/dev/explorer/page.tsx` is a server-rendered Supabase schema explorer (introspects tables/columns via the service key) — a debugging aid, not the product UI.

### Data generation
`scripts/etl-ingest.ts` and `scripts/generate-local-dataset.ts` share the same synthetic-data logic (`utils/data-generator.ts`, with the Indonesian clause banks in `utils/review-corpus.ts`): 5 factories/warehouses/couriers, batches hashed by product+month. They differ in output: `etl-ingest.ts` upserts into Supabase, `generate-local-dataset.ts` writes `data/analytics_traceability_dataset.{json,csv}` for offline use. Both deterministically inject 3 controlled incidents by date window (Factory C `fact-c` PRODUCT_DEFECT Jul 2018, Warehouse South `wh-south` PACKAGING_DAMAGE May 2018, Courier Fast Express `cour-fast` LATE_DELIVERY Jun 2018) and record them to `incidents` / `data/ground_truth_incidents.csv` as ground truth for accuracy evaluation.

Review text is generated by `utils/review-corpus.ts` (`generateReviewText(rating, seedKey, incidentType?)`), a hand-written Indonesian clause corpus (FNV-1a-hashed multi-slot opener/detail/closer/context banks), not machine translation — this replaced an earlier scripted Portuguese->Indonesian translator that produced many duplicate/empty review texts. **Constraint that must hold if this corpus is ever edited**: none of the generic/positive/neutral banks may contain any substring matching the rule-based classifier regexes in `app/api/pipeline/run/route.ts` (`cacat|rusak|buruk|tidak sesuai|tipis|pecah|patah|jelek|kualitas`, `kemasan|kardus|packing|peot|penyok|sobek|bocor|basah`, `telat|lama|lambat|kurir|pengiriman|tunggu|meleset`) — only the incident-specific `*_TEMPLATE`/`*_SPECIFIC` banks may. Violating this silently collapses classifier precision (seen dropping to ~1% from hidden substrings like "lama" inside "pengalaman"/"selamat"); re-audit with `grep -noiE` against all three patterns after any edit. `etl-ingest.ts`'s `incidents` table insert has no dedup — repeated `npm run ingest` runs against the same Supabase project accumulate duplicate incident rows and must be cleaned up manually.

Also see `PIPELINE_ARCHITECTURE.md` (project root) for a full architecture writeup, and `HANDOFF.md` (project root) for the state of the most recent working session (dataset regeneration + the pagination-bug fix above).

## Notes
* Root-level `test.js` / `test.mjs` do not currently exist anywhere in the working tree or git history (verified 2026-08-22) — treat any earlier reference to ad hoc `@xenova/transformers` smoke scripts at the repo root as stale. The `Xenova/` name that does appear in the codebase is only the model-id prefix passed to `@huggingface/transformers` (e.g. `Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7`), not a separate package.
* `next.config.ts` currently carries two Windows-dev-only workarounds (uncommitted as of 2026-08-22, not yet merged to main): `distDir: '.next-dev'` (sidesteps an EPERM lock on `.next/dev/logs/next-development.log` that crashes `next dev` on this machine) and `experimental: { mcpServer: false }` (disables Next 16's experimental dev-mode MCP server, which writes to that same log path). `tsconfig.json`'s `include` and `.gitignore` were updated in tandem to cover the new `.next-dev/` output dir. These have no effect on production builds/behavior.
* `PIPELINE_ARCHITECTURE.md` is a line-cited architecture map of the whole system and the canonical deep-dive reference. `updates_log.md` is a running changelog.
* Env vars (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `HF_ACCESS_TOKEN`.
* `scripts/seed-admin.ts` creates the admin login (`admin@admin.com` / `admin123`) — the account Playwright E2E tests use.
* A few UI rough edges worth knowing about if you touch those pages: `app/(dashboard)/reviews` and `app/(dashboard)/settings` have no `loading.tsx`/`error.tsx` (every other dashboard section does); the three entity detail pages (`entities/{factories,warehouses,couriers}/[id]/page.tsx`) render a plain "not found" div instead of calling `notFound()`, and each has a non-functional "Lihat semua N ..." span with no href/onClick.
* `components/sidebar.tsx`'s mobile hamburger (`aria-label="Buka menu"`) and mobile-close (`aria-label="Tutup menu"`) icon buttons were unlabeled until 2026-08-22 — fixed as a small accessibility improvement (found while debugging Playwright's `mobile-chromium` project, whose viewport puts the whole sidebar behind that closed drawer by default; see `PLAYWRIGHT_TESTS.md`).
* Repeated "Run Pipeline" clicks against the same long-lived `npm run dev` process have been observed to grow its memory by roughly 1-1.5GB per run with no release in between (not root-caused further) — if a dev server feels increasingly sluggish after many manual pipeline runs in one sitting, restart it.

## Next.js Special Rules
* **This is NOT the Next.js you know**: This version has breaking changes. APIs, conventions, and file structure may differ from standard training data. Read `node_modules/next/dist/docs/` before writing code.
