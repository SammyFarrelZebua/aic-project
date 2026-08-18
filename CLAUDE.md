# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context
* **Project Name**: Detektif Kemasan (AIC 2026)
* **Goal**: AI-powered complaint intelligence that traces customer reviews (probable operational source ranking, not causal proof) back to the supply chain.
* **Core Flow**: Customer Review -> Complaint Understanding (NLP classification) -> Temporal Anomaly Detection -> Supply-Chain Traceability -> Candidate Source Ranking -> Operational Alert.
* **Source Dataset**: Olist Brazilian E-Commerce Dataset, subset to ~15,000 orders. Review text is machine-translated Portuguese->Indonesian; the UI and NLP labels are Indonesian.

## Commands
* `npm run dev` — start the Next.js dev server
* `npm run build` — production build
* `npm run start` — start production server
* `npm run lint` — run ESLint
* `npm run ingest` — run `scripts/etl-ingest.ts`: downloads Olist CSVs, generates synthetic factory/warehouse/courier/batch metadata, injects 3 controlled incidents, and writes everything to Supabase
* `npm run generate-local` — run `scripts/generate-local-dataset.ts`: same generation logic as `ingest` but writes local JSON/CSV under `data/` instead of Supabase (used for offline NLP experiments)
* `npm run validate` — run `scripts/validate.ts`: sanity-checks row counts, the `analytics_traceability_view`, and the injected incident stats against Supabase
* `npm run test-baseline` — run `scripts/nlp-anomaly-baseline.ts`: evaluates a rule-based Indonesian regex classifier against `data/ground_truth_incidents.csv` (precision/recall/F1 + Top-1 anomaly-ranking accuracy)
* `npm run test-huggingface` — run `scripts/nlp-huggingface-eval.ts`: same evaluation but classifies via the Hugging Face Inference API (zero-shot, `MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7`), with a JSON prediction cache at `data/hf_predictions_cache.json` and rule-based fallback after repeated API failures

There is no unit test framework wired into `package.json`; correctness of the NLP/anomaly pipeline is checked via `test-baseline` / `test-huggingface` (offline, dataset-driven) against `data/ground_truth_incidents.csv`.

## Architecture

### Database (Supabase / Postgres)
Schema lives in a single migration: `supabase/migrations/20260809000000_init_schema.sql`. Core entities and traceability paths:
* `factory` -> `batch` -> `product` -> `orders`
* `warehouse`/`courier` -> `shipment` -> `orders`
* `orders` -> `review` -> `review_image`
* `review` -> `complaint_prediction` (NLP output)
* `incidents` (synthetic ground truth) and `root_cause_predictions` (pipeline output, evaluated against `incidents`)

`analytics_traceability_view` flattens `review -> orders -> product/batch -> factory` and `orders -> shipment -> warehouse/courier` into one row per review; both API routes and the eval scripts read from this view rather than joining raw tables themselves.

Supabase client helpers live in `utils/supabase/`: `client.ts` (browser), `server.ts` (RSC, cookie-based), `middleware.ts` (session refresh), and `service.ts` (service-role key, `persistSession:false` — used server-side by API routes and scripts, bypasses RLS).

### Inference & anomaly pipeline (`app/api/pipeline/run/route.ts`)
This is the core detection logic, and the anomaly detection approach has been refactored and centralized in `utils/anomaly-detection.ts`. Both the main API route and the offline evaluation scripts (`scripts/nlp-anomaly-baseline.ts` / `nlp-huggingface-eval.ts`) use this shared utility:
1. Clears `root_cause_predictions` / `complaint_prediction`, fetches all reviews via a paginated `selectAll<T>()` helper (`route.ts:13-26`) — PostgREST's default `max_rows` (1000) silently truncates a bare `.select('*')`, so both the `review` and `analytics_traceability_view` reads must page through `.range()` in chunks of 1000 rather than fetch in one call. This was a real production bug (pipeline was silently only processing the first 1,000 reviews) fixed 2026-08-17; keep this pattern if you touch these fetches.
2. For `rating <= 3`, lazily loads a Transformers.js zero-shot classifier (`Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7`, runs in-process via `@huggingface/transformers`) to label each review as `PRODUCT_DEFECT`, `PACKAGING_DAMAGE`, or `LATE_DELIVERY`; severity is derived from rating.
3. Joins predictions onto `analytics_traceability_view` and runs a sliding-window temporal anomaly detector per incident type: 7-day current window vs. a 30-day historic window (offset 37 days), flagging a spike when `r_current/(r_historic+0.001) >= 2.0` and current count `>= 3`.
4. Scores candidate factories/warehouses/couriers by `deviationRatio * incidentComplaintShare` and inserts the top candidate per anomaly into `root_cause_predictions`.

`app/api/analytics/dashboard/route.ts` (`force-dynamic`) computes dashboard KPIs, accuracy of `root_cause_predictions` vs. `incidents` (±7 day window + matching entity), a daily complaint-type timeseries, and factory/warehouse/courier rankings by anomaly count.

### Dashboard
`app/dashboard/page.tsx` is a client component that fetches `/api/analytics/dashboard` on mount, has a "Run Pipeline" button that calls `POST /api/pipeline/run` and refetches, and renders KPI cards, a Recharts complaint-trend line chart, and a top-suspects ranking panel. `app/page.tsx` is a server-rendered Supabase schema explorer (introspects tables/columns via the service key, falls back to a static schema list) — a debugging aid, not the product UI.

### Data generation
`scripts/etl-ingest.ts` and `scripts/generate-local-dataset.ts` share the same synthetic-data logic (5 factories/warehouses/couriers, batches hashed by product+month) but differ in output: `etl-ingest.ts` upserts into Supabase, `generate-local-dataset.ts` writes `data/analytics_traceability_dataset.{json,csv}` for offline use. Both deterministically inject 3 controlled incidents by date window (Factory C product defects, Warehouse South packaging damage, Courier Fast Express late delivery) and record them to `incidents` / `data/ground_truth_incidents.csv` as ground truth for accuracy evaluation.

Review text is generated by `utils/review-corpus.ts` (`generateReviewText(rating, seedKey, incidentType?)`), a hand-written Indonesian clause corpus (FNV-1a-hashed multi-slot opener/detail/closer/context banks), not machine translation — this replaced an earlier scripted Portuguese->Indonesian translator that produced many duplicate/empty review texts. **Constraint that must hold if this corpus is ever edited**: none of the generic/positive/neutral banks may contain any substring matching the rule-based classifier regexes in `app/api/pipeline/run/route.ts` (`cacat|rusak|buruk|tidak sesuai|tipis|pecah|patah|jelek|kualitas`, `kemasan|kardus|packing|peot|penyok|sobek|bocor|basah`, `telat|lama|lambat|kurir|pengiriman|tunggu|meleset`) — only the incident-specific `*_TEMPLATE`/`*_SPECIFIC` banks may. Violating this silently collapses classifier precision (seen dropping to ~1% from hidden substrings like "lama" inside "pengalaman"/"selamat"); re-audit with `grep -noiE` against all three patterns after any edit. `etl-ingest.ts`'s `incidents` table insert has no dedup — repeated `npm run ingest` runs against the same Supabase project accumulate duplicate incident rows and must be cleaned up manually.

Also see `PIPELINE_ARCHITECTURE.md` (project root) for a full architecture writeup, and `HANDOFF.md` (project root) for the state of the most recent working session (dataset regeneration + the pagination-bug fix above).

## Notes
* Root-level `test.js` / `test.mjs` are ad hoc smoke scripts (import `@xenova/transformers`, not the `@huggingface/transformers` package actually in `package.json`) and are not wired into `npm` scripts.
* Env vars (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `HF_ACCESS_TOKEN`.

## Next.js Special Rules
* **This is NOT the Next.js you know**: This version has breaking changes. APIs, conventions, and file structure may differ from standard training data. Read `node_modules/next/dist/docs/` before writing code.
