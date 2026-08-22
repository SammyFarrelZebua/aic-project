# Detektif Kemasan — Pipeline Architecture Map

Consolidated, line-cited findings from a 4-agent read-only exploration pass over the `backend` branch (2026-08-17): database schema, the pipeline run route, the anomaly-detection engine, and the dashboard. Line numbers reflect file state at exploration time.

**Refreshed 2026-08-22** by a second 4-agent exploration pass covering the whole repo (not just the pipeline). Two corrections from that pass are folded in below: the sample-size gate values had drifted (this doc said ≥50/≥200; the code now reads ≥30/≥50 — see the anomaly-detection section), and the review fetch is now paginated (this doc's step 2 said "no pagination"; both the `review` fetch and the `analytics_traceability_view` fetch go through the same `selectAll<T>()` helper as of the 2026-08-17 pagination fix). A 7th migration (`20260818000000_add_review_date_index.sql`) has also landed since. Everything else below was re-verified and still holds.

## Core flow

| # | Stage | Primary file |
|---|-------|---------------|
| 1 | Customer review | table `review` |
| 2 | Complaint understanding | `app/api/pipeline/run/route.ts` |
| 3 | Temporal anomaly detection | `utils/anomaly-detection.ts` |
| 4 | Supply-chain traceability | `analytics_traceability_view` |
| 5 | Candidate source ranking | `utils/isolation-forest-detector.ts` |
| 6 | Operational alert | `/api/analytics/dashboard` |

---

## Database schema

7 migrations under `supabase/migrations/`, applied in order. No `seed.sql` or `config.toml` exists.

### 20260809000000_init_schema.sql — core entities

| Table | Key columns | Foreign keys |
|---|---|---|
| `factory` | factory_id (PK), factory_name, city, province | — |
| `product` | product_id (PK), product_name, category, brand, price | — |
| `batch` | batch_id (PK), production_date, expiry_date, shift | factory_id → factory (cascade) |
| `warehouse` | warehouse_id (PK), warehouse_name, city, region | — |
| `courier` | courier_id (PK), courier_provider | — |
| `orders` | order_id (PK), order_date, processed_date, packer_shift, quantity | product_id → product (set null), batch_id → batch (set null), warehouse_id → warehouse (set null) |
| `shipment` | shipment_id (PK), ship_date, delivery_date, delivery_status | order_id → orders (cascade), courier_id → courier (set null) |
| `review` | review_id (PK), rating, review_text, review_date | order_id → orders (cascade) |
| `review_image` | image_id (PK), image_path | review_id → review (cascade) |
| `complaint_prediction` | prediction_id (PK), complaint_type, aspect, severity, confidence, created_at | review_id → review (cascade) |
| `incidents` | id (UUID PK), entity_type, entity_id, incident_type, start_date, end_date, injected_rate | none — ground-truth table |
| `root_cause_predictions` | id (UUID PK), incident_type, detected_period_start/end, candidate_type, candidate_id, confidence, predicted_at | none — evaluation output |

`complaint_prediction` was later extended by `20260816000003_add_nlp_probabilities.sql`, adding `prob_product_defect`, `prob_packaging_damage`, `prob_late_delivery` (all `NUMERIC(4,3) DEFAULT 0`) — this is the "store multi-class probabilities" change referenced in recent commit history.

`20260812000000_add_profiles.sql` adds a table **not mentioned in CLAUDE.md**: `public.profiles` (id → auth.users, email, full_name, role default `'viewer'`, created_at), with RLS enabled and two policies (users can view/update their own row), plus a `handle_new_user()` trigger function that auto-provisions a profile on signup.

### Views

Three views exist; only one (`analytics_traceability_view`) is documented in CLAUDE.md.

**`analytics_traceability_view`** — flattens `review → orders → product/batch → factory` and `orders → shipment → warehouse/courier` into one row per review. `review` INNER JOINs `orders` (reviews without a valid order are excluded); every join past that is LEFT JOIN.

```sql
SELECT r.review_id, r.rating AS review_score, NULL AS review_comment_title,
       r.review_text AS review_comment_message, r.review_date::text AS review_creation_date,
       o.order_id, 'delivered' AS order_status,        -- hardcoded fallback
       o.order_date::text AS order_purchase_timestamp,
       s.delivery_date::text AS order_delivered_customer_date,
       p.price AS item_price, 0.0 AS item_freight_value, -- hardcoded fallback
       p.product_id, p.category AS product_category,
       b.batch_id, b.production_date::text AS batch_production_date,
       f.factory_id, f.factory_name, f.province AS factory_region,
       s.shipment_id, s.ship_date::text AS shipment_date,
       s.delivery_date::text AS shipment_delivery_date,
       w.warehouse_id, w.warehouse_name, w.region AS warehouse_region,
       c.courier_id, c.courier_provider AS courier_name,
       NULL AS courier_region                           -- hardcoded fallback
FROM review r
JOIN orders o ON r.order_id = o.order_id
LEFT JOIN product p  ON o.product_id = p.product_id
LEFT JOIN batch b    ON o.batch_id = b.batch_id
LEFT JOIN factory f  ON b.factory_id = f.factory_id
LEFT JOIN shipment s ON o.order_id = s.order_id
LEFT JOIN warehouse w ON o.warehouse_id = w.warehouse_id
LEFT JOIN courier c  ON s.courier_id = c.courier_id;
```

**`product_stats_view`** *(undocumented)* — per product: `order_count`, `complaint_count`, `complaint_ratio`, and a boolean `needs_alert` flag that flips true when `complaint_ratio > 0.1`.

**`daily_complaints_view`** *(undocumented)* — two CTEs joined by date: reviews + low-rating counts, and `complaint_prediction` pivoted into `defects` / `damages` / `delays` per day. Feeds the dashboard trend chart directly.

`20260816000001_add_fk_indexes.sql` adds 9 indexes covering every foreign key introduced in the base schema (`batch.factory_id`, `orders.product_id/batch_id/warehouse_id`, `shipment.order_id/courier_id`, `review.order_id`, `review_image.review_id`, `complaint_prediction.review_id`).

`20260818000000_add_review_date_index.sql` adds `idx_review_review_date ON review(review_date DESC)`. Its own comment documents why: the Reviews page / `/api/reviews` orders by `review_date DESC` joined with `complaint_prediction`, and without this index Postgres full-sorts ~15k rows on every request, which could exceed the statement timeout, return a 500, and get silently swallowed by the frontend (no `res.ok` check) into the "Tidak ada ulasan yang ditemukan" empty state.

### Supabase client helpers

`utils/supabase/` — four thin factories, one per execution context. All read `NEXT_PUBLIC_SUPABASE_URL`; the key and session handling differ.

| File | Export | Key used | Call site |
|---|---|---|---|
| `client.ts` | `createClient()` | publishable (anon) | Browser / Client Components |
| `server.ts` | `createClient(cookieStore)` | publishable (anon) | RSC / Server Actions / Route Handlers |
| `middleware.ts` | `createClient(request)` | publishable (anon) | Next.js middleware — refreshes session cookies, redirects on auth-route rules from `lib/auth-routes.ts` |
| `service.ts` | `createServiceClient()` | service-role (RLS bypass) | API routes / scripts; `persistSession:false, autoRefreshToken:false`; throws explicitly if either env var is missing |

Middleware bypasses auth checks entirely for paths starting with `/api/` or `/auth/`, and for `/reset-password` (kept reachable for Supabase's recovery flow). Otherwise: unauthenticated + protected path → redirect to `/login?next=…`; authenticated + auth-only path → redirect to `/dashboard`.

---

## Pipeline run route

`app/api/pipeline/run/route.ts` — 320 lines. A fire-and-forget background job pattern: `POST` starts the work and returns immediately; progress is polled separately.

### POST handler

1. Builds a cookie-scoped auth client, calls `auth.getUser()` — unauthenticated requests get `401` (the only auth check in the file).
2. If `pipelineState.status === 'running'`, short-circuits and returns success without starting a second run — an in-memory concurrency guard, scoped to a single server process only.
3. Resets shared `pipelineState`, then calls `runPipelineBackground()` without awaiting it.
4. Returns `{ success: true, message: 'Pipeline started' }` immediately. Progress is polled via `GET /api/pipeline/status`, which just returns the live `pipelineState` object.

### Background job — 10 steps

| # | Step | Detail |
|---|---|---|
| 1 | Clear old results | Deletes all rows from `root_cause_predictions`, then all rows from `complaint_prediction` (via `neq` against the nil UUID — PostgREST rejects a filterless delete) |
| 2 | Fetch reviews | Full `review` table, paged through `selectAll<T>()` in 1000-row chunks (PostgREST's default `max_rows` would otherwise silently truncate a bare `.select('*')` — fixed 2026-08-17) |
| 3 | Size the ML workload | `totalMlTasks` = reviews where `rating ≤ 3` and `review_text` is non-empty |
| 4 | Classify each review | See NLP classification below — serial loop, no parallelism |
| 5 | Insert predictions | Chunked at 500 rows/insert into `complaint_prediction`; a chunk failure aborts the whole run |
| 6 | Join onto traceability view | Fetches `analytics_traceability_view`, attaches `predicted_type` (NORMAL → `null`) and `purchaseTime` from the in-memory predictions, sorts ascending by `purchaseTime` |
| 7 | Load candidate pools | All `factory_id`, `warehouse_id`, `courier_id` values, sequentially (not `Promise.all`) |
| 8 | Detect anomalies | `detectAnomalies(records, candidateMap)` — see anomaly detection below |
| 9 | Write root-cause predictions | See root-cause write-back below |
| 10 | Finalize | Sets `pipelineState.status = 'done'`, revalidates the `dashboard-analytics` cache tag (failure here is caught separately and doesn't fail the run) |

**State & error handling**: Progress lives entirely in a plain in-memory object (`app/api/pipeline/state.ts`: `{status, processed, duration_ms, error}`) shared between the run route and the status route — it does not survive server restarts and would not work across multiple serverless instances. Per-review classification errors degrade gracefully to `NORMAL`; DB chunk-insert errors abort the run and are logged with full Supabase error detail (`message`/`details`/`hint`).

### NLP classification (step 4, in detail)

Gate: `rating ≤ 3` and non-empty `review_text`. Everything else is classified `NORMAL` with no model call.

**Text normalization** — lowercases and expands Indonesian SMS-speak before classification: `yg→yang`, `dgn→dengan`, `ga/gak/tdk→tidak`, `tp→tapi`, `krn→karena`, `brg→barang`, `ongkir→ongkos kirim`, `paking→kemasan`, `telat/lambat→terlambat`, `pecah/patah/hancur→rusak`, plus collapsing letter elongation (`baguuus→bagus`).

**Keyword pre-filter (cheap early-out)** — three regexes run before touching the model. If none match, `type = 'NORMAL'` immediately and the zero-shot classifier is skipped entirely:

```
productDefect   /cacat|rusak|buruk|tidak sesuai|tipis|pecah|patah|jelek|kualitas/i
packagingDamage /kemasan|kardus|packing|peot|penyok|sobek|bocor|basah/i
lateDelivery    /telat|lama|lambat|kurir|pengiriman|tunggu|meleset/i
```

**Zero-shot classifier** — model `Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7` loaded once per server process (module-level `cachedClassifier` singleton) via a dynamic `import('@huggingface/transformers')`, quantized, `allowLocalModels = false`. Marked in `next.config.ts` as `serverExternalPackages` so it loads as native Node rather than being bundled. Called with `multi_label: true` (scores are independent entailments, not a softmax) against 4 Indonesian candidate labels mapped to PRODUCT_DEFECT / PACKAGING_DAMAGE / LATE_DELIVERY / NORMAL.

**Decision logic, in order:**

| Rating | Threshold | Severity if classified |
|---|---|---|
| 1 | 0.20 | HIGH |
| 2 | 0.25 | MEDIUM |
| 3 (default) | 0.35 | LOW |

1. If `topComplaint.score − prob_normal < 0.18` → forced to `NORMAL`, regardless of the threshold table above (margin-over-normal gate takes priority).
2. Else if `topComplaint.score ≥ threshold` → classified as that type, `confidence = topComplaint.score`.
3. Else → `NORMAL`.

`prediction_id` is deterministic (`pred-${review_id}`, not random); `prob_normal` is used only for the margin check and is not persisted.

---

## Anomaly detection engine

`utils/anomaly-detection.ts` (114 lines) + `utils/isolation-forest-detector.ts` (105 lines). One exported function, `detectAnomalies(records, candidates)`, sweeping day-by-day over pre-sorted records.

### Sliding window mechanics

- Sweep starts **37 days** after the first record and steps forward one day at a time.
- **Current window**: 7 days immediately before "today" (half-open).
- **Historic window**: the 30 days before that (offset 37 days back from "today" — i.e. 37 − 7 = 30-day span).
- A day is skipped entirely unless the current window has **≥ 30** reviews and the historic window has **≥ 50** reviews (minimum sample-size gate, `utils/anomaly-detection.ts` — the code comment there says these were "lowered ... to detect anomalies in sparse, real-world review data"; CLAUDE.md documents this correctly). These values were re-verified 2026-08-22 against current source — an earlier version of this doc stated ≥50/≥200, which is stale.

### Spike detection, per incident type

```
r_current  = currentComplaints  / (currentWindowSize  || 1)
r_historic = historicComplaints / (historicWindowSize || 1)
spikeRatio = r_current / (r_historic + 0.001)

trigger when: spikeRatio >= 2.0  AND  currentComplaints >= 3
```

Candidate pool per type: `PRODUCT_DEFECT → factories`, `PACKAGING_DAMAGE → warehouses`, `LATE_DELIVERY → couriers`.

> **Not a simple ratio score.** CLAUDE.md describes candidate scoring as `deviationRatio × incidentComplaintShare`. The actual formula blends that with an **Isolation Forest** anomaly score (via the `isolation-forest` npm package, 100 trees by default) that is not mentioned anywhere in CLAUDE.md — see discrepancies below.

### Per-candidate composite score

```
dr  = cRate / (hRate + 0.001)                 // deviation ratio, same entity, current vs historic
ics = cEntComplaints / (cComplaints || 1)      // this entity's share of all current-window complaints

trainingData = buildEntityFeatures(records, type, id, ..., isHistoric=true)   // 30-day window
testData     = buildEntityFeatures(records, type, id, ..., isHistoric=false)  // 7-day window
ifScore      = scoreWithIsolationForest(trainingData, testData)   // clamped to [0,1]

score = 0.6 * ifScore + 0.4 * (dr * ics)
```

Feature vector per entity (5-dim): `[review_count, complaint_count, avg_prob, max_prob, rate]`, where the probability values read `prob_product_defect/prob_packaging_damage/prob_late_delivery` matching the incident type, falling back to `predicted_confidence`, then to a hardcoded `0.9` default if neither exists. All scored candidates are returned sorted descending by `score`; the route trusts this order and simply reads index 0.

**Consumers**: same function, same signature, called from three places — `app/api/pipeline/run/route.ts` (production), and the two offline evaluators `scripts/nlp-anomaly-baseline.ts` / `scripts/nlp-huggingface-eval.ts`, both of which feed a static 5-entity-per-category candidate map and score top-1 accuracy against hardcoded ground truth (`fact-c` / `wh-south` / `cour-fast`).

### Root-cause write-back

`app/api/pipeline/run/route.ts`, step 9 — inline, not delegated:

```
candidate_type = type === 'PRODUCT_DEFECT'   ? 'factory'
                : type === 'PACKAGING_DAMAGE' ? 'warehouse'
                : 'courier'
candidate_id   = anomaly.scoredCandidates[0]?.id
confidence     = Math.min(0.999, (scoredCandidates[0]?.score || 0) / 100)

// rows with no candidate_id are dropped before insert
```

Only the top-ranked candidate per detected anomaly is written. The insert is a single unchunked bulk call (unlike the 500-row-chunked prediction insert in step 5) — acceptable because the windowed algorithm produces a small anomaly count by construction.

---

## Dashboard analytics API

`app/api/analytics/dashboard/route.ts` — 148 lines, `force-dynamic`. Auth is checked with the user-scoped client; the actual data fetch uses the service-role client (RLS bypassed) wrapped in a 5-minute cache.

- `unstable_cache`, key `['dashboard-analytics']`, `revalidate: 300`, tag `dashboard-analytics` (the same tag the pipeline route revalidates on completion). `?fresh=true` bypasses the cache.
- Unauthenticated requests get `401` before any data is touched.

**KPIs**

| KPI | Source |
|---|---|
| totalReviews | count of all `review` rows |
| lowRatings | count of `review` where `rating ≤ 2` |
| predictedComplaints | count of `complaint_prediction` where `complaint_type != 'NORMAL'` |
| totalAnomalies | count of all `root_cause_predictions` rows |
| accuracy | see matching logic below |

**Accuracy matching logic** — predictions are first deduped into groups keyed `${incident_type}_${detected_period_start}`. Each unique group counts as "correct" if any ground-truth incident satisfies:

```
gt.incident_type === pred.incident_type
&& pStart >= gt.start_date - 7 days
&& pStart <= gt.end_date   + 7 days
&& gt.entity_id === pred.candidate_id

accuracy = correctGroups / totalGroups * 100
```

Note this does not cross-check `candidate_type` against any entity-type field on `incidents` — the match is purely on `entity_id === candidate_id`.

**Timeseries & rankings** — timeseries is read directly from `daily_complaints_view`, no client- or route-side aggregation. Rankings count every `root_cause_predictions` row per `${candidate_type}_${candidate_id}` (not deduped, unlike the accuracy calc), join in entity names from `factory`/`warehouse`/`courier`, drop zero-count entities, and sort each list descending — no cap applied.

## Dashboard UI

`app/(dashboard)/dashboard/page.tsx` — 225 lines, client component.

**Data flow** — fetches `/api/analytics/dashboard` once on mount (hits the 5-minute server cache). The "Run Pipeline" button posts to `/api/pipeline/run`, then a separate effect polls `GET /api/pipeline/status` every 2 seconds while `status === 'running'`; on `done` it awaits a fresh `fetchDashboard()` call — this poll-then-refetch is the only place the UI re-pulls KPIs after a run.

**Rendered sections**

- **Trace strip** — 5-node animated status: Review Masuk → Diklasifikasi → Anomali Terdeteksi → Ditelusuri → Alert Dikirim.
- **4 KPI cards** — Akurasi Deteksi (Top-1), Insiden Terdeteksi, Durasi Anomali Aktif (client-computed, see below), Review Diproses.
- **Complaint trend chart** — Recharts area + 30-day trailing baseline average, with amber bands from merged/overlapping anomaly windows.
- **Candidate ranking panel** — merges factory/warehouse/courier rankings into one sorted list; rows expand to show the last 6 detection events.

`avgActiveDays` is computed client-side (`lib/metrics.ts`), not returned by the API: it groups raw `anomalies` by `${candidate_type}_${candidate_id}_${incident_type}`, spans min→max detected period per group, and averages the span in days — an explicit stand-in since the API doesn't expose true onset-lag.

---

## Discrepancies vs. CLAUDE.md

As of the 2026-08-22 refresh, CLAUDE.md has been updated to fix items 4 (7th migration + `product_stats_view`/`daily_complaints_view`/`profiles` are now all documented) and 5 (sample-size gate values corrected and now stated). Items 1–3 below were true as of 2026-08-17 and remain true — CLAUDE.md's pipeline/dashboard section still describes the score as `deviationRatio × incidentComplaintShare` without the isolation-forest term, and still doesn't call out `app/page.tsx`'s redirect or the `(dashboard)` route-group path explicitly (though the page inventory it gives is otherwise accurate — see the 2026-08-22 UI exploration notes below). Left here for historical reference:

1. **Root-cause scoring is undocumented as a hybrid model.** CLAUDE.md states candidates are scored by `deviationRatio × incidentComplaintShare`. The real formula is `0.6 × isolationForestScore + 0.4 × (deviationRatio × incidentComplaintShare)` — an Isolation Forest model (`isolation-forest` npm package, `utils/isolation-forest-detector.ts`) does 60% of the weighting and isn't mentioned in the doc at all.
2. **`app/page.tsx` is not the schema explorer.** It's now a 6-line `redirect('/dashboard')`. The schema explorer described in CLAUDE.md lives at `app/dev/explorer/page.tsx`. (Also worth noting: the same `/` → `/dashboard` redirect is configured a second time in `next.config.ts`'s `redirects()`.)
3. **Dashboard path has moved under a route group.** `app/dashboard/page.tsx` does not exist literally — the real path is `app/(dashboard)/dashboard/page.tsx`.
4. ~~Two views and one table are unmentioned.~~ **Fixed 2026-08-22** — CLAUDE.md's DB section now lists all 7 migrations including `product_stats_view`, `daily_complaints_view`, and `profiles`.
5. ~~Sample-size gate is undocumented.~~ **Fixed 2026-08-22** — CLAUDE.md now states the ≥30 current / ≥50 historic gate explicitly (see the corrected values above; this doc's own value had also drifted and has been corrected in the same pass).

## UI/UX findings from the 2026-08-22 exploration (outside this doc's original pipeline scope)

Captured here since they surfaced during the same pass; the product page inventory itself (all `(dashboard)` pages, auth pages, `dev/explorer`) matches CLAUDE.md exactly with no missing or extra pages.

- `app/(dashboard)/reviews` and `app/(dashboard)/settings` have no `loading.tsx`/`error.tsx`, unlike every other dashboard section (`dashboard`, `alerts`, `cases`, `entities/{factories,warehouses,couriers}`, `products`), which all share byte-identical copies of both.
- The three entity detail pages (`entities/{factories,warehouses,couriers}/[id]/page.tsx`) render a plain "not found" div instead of calling `notFound()`, and each has a non-functional "Lihat semua N batch/pesanan/pengiriman" span with no `href`/`onClick`.
- Client-side/URL-driven filtering exists only on `products` (server-side via query params) and `reviews` (client-side, 300ms-debounced fetch); `cases`, `alerts`, and the `entities/*` list pages have no search/filter UI.
- `lib/dossier-summary.ts` (the login page's live pipeline dossier) explicitly documents that its "activity" check is not a literal today-filter — the demo dataset is 2016–2018, so a calendar-day filter would always read empty; it goes false only on a genuinely fresh DB.

## Adjacent files touched but not deep-dived

Referenced by the files above; flagged for a follow-up pass if needed.

- `app/api/pipeline/status/route.ts`, `app/api/pipeline/state.ts` — the in-memory polling contract
- `lib/auth-routes.ts` — `isAuthOnlyPath` / `isProtectedPath` used by middleware
- `lib/metrics.ts`, `lib/pipeline-messages.ts` — client-side derived metrics and error-message translation
- `components/trace-strip.tsx`, `components/complaint-trend-chart.tsx`, `components/candidate-ranking.tsx` — dashboard presentation components
- `scripts/nlp-local-eval.ts`, `utils/anomaly-detection.test.ts` — additional consumers of `detectAnomalies` spotted via grep, not read in full
- `next.config.ts` — `serverExternalPackages: ['@huggingface/transformers']`
