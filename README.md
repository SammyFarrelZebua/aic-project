# Detektif Kemasan (AIC 2026)

AI-powered complaint intelligence that traces customer reviews back to the supply chain (probable operational source ranking, not causal proof).

## Overview
**Core Flow**: Customer Review -> Complaint Understanding (NLP classification) -> Temporal Anomaly Detection -> Supply-Chain Traceability -> Candidate Source Ranking -> Operational Alert.

**Source Dataset**: Olist Brazilian E-Commerce Dataset, subset to ~15,000 orders. Review text is **generated** — a hand-written Indonesian clause corpus (`utils/review-corpus.ts`), not machine-translated. The UI and NLP labels are Indonesian.

## Getting Started

There are two ways to run the app: **Docker** (recommended for a quick reproduction) or **local development** (recommended for working on the code). Both require a Supabase project and its env vars.

### Prerequisites
- A Supabase project (see [Supabase](https://supabase.com)). You'll need its URL and keys — see [Environment Variables](#1-environment-variables).
- Either **Docker** + Docker Compose (for the Docker path), or **Node.js 22+** (for the local path).

### 0. Environment Variables
Copy the `.env.example` file to `.env.local` and fill in the required values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HF_ACCESS_TOKEN` (optional — used by the offline HuggingFace eval script)

```bash
cp .env.example .env.local
# then edit .env.local
```

### 1. Docker Setup (recommended for reproduction)

Run the whole app in a container — no local Node install needed. The container builds the Next.js production bundle and serves it on port 3000.

```bash
# 1. Set your env vars in .env.local first (see step 0 above)
# 2. Build + start the container
docker compose up --build -d
```

Then open [http://localhost:3000](http://localhost:3000). The root route redirects to the dashboard.

- **Stop**: `docker compose down`
- **Logs**: `docker compose logs -f web`
- **Rebuild after code changes**: `docker compose up --build -d`

> **Note:** the container runs the **production** build (`npm run start`). The Supabase schema and seed data are **not** applied by Docker — you still need to run the migrations and ingestion once (see [Database Setup](#2-database-setup) below), either from your host with a Node environment or against your Supabase project. The `.dockerignore` excludes `.env*.local` from the image, so your keys stay out of the container image.

### 2. Database Setup
The schema lives in **7 migrations** under `supabase/migrations/` (core schema + `analytics_traceability_view`, `profiles`, `product_stats_view`, FK indexes, `daily_complaints_view`, NLP probability columns, and a review-date index).
To set up your local database or remote Supabase instance, run the migrations:
```bash
npx supabase db push
```

### 3. Data Ingestion
Populate the database with synthetic Olist factory/warehouse/courier/batch metadata and inject the 3 controlled incidents:
```bash
npm run ingest
```

### 4. Local Development (recommended for working on the code)
Install dependencies and start the Next.js dev server:
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The root route will automatically redirect you to the main dashboard.

> **Admin login**: create the demo admin account with `npx tsx scripts/seed-admin.ts` (credentials `admin@admin.com` / `admin123`) — this is also the account the Playwright E2E suite uses.

## How It Works

### Methodology
The pipeline (`POST /api/pipeline/run`, run as a background job) takes customer reviews and traces likely operational sources:
1. **Preprocessing** — normalizes Indonesian SMS-speak (`normalizeIndonesianText`), then a regex keyword pre-filter skips the zero-shot model for reviews that match no complaint keyword.
2. **NLP classification** — low-rated reviews (`rating ≤ 3`) that pass the pre-filter are labeled `PRODUCT_DEFECT` / `PACKAGING_DAMAGE` / `LATE_DELIVERY` by a Transformers.js zero-shot model (`Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7`), with rating-dependent thresholds and a margin-over-normal gate. Multi-class probabilities are stored in `complaint_prediction`.
3. **Temporal anomaly detection** — a sliding window (7-day current vs 30-day historic) flags a spike when the complaint ratio jumps ≥ 2.0× with ≥ 3 current-window complaints (and sample-size gates).
4. **Candidate source ranking** — candidates are restricted to the entity type structurally responsible for the incident (`PRODUCT_DEFECT`→factories, `PACKAGING_DAMAGE`→warehouses, `LATE_DELIVERY`→couriers) and scored with a hybrid composite (`0.6 × isolation-forest score + 0.4 × deviation-ratio × complaint-share`). The top candidate per anomaly is written to `root_cause_predictions`.
5. **Operational alert** — the dashboard reads the results from Supabase; accuracy is computed against the injected ground-truth `incidents`.

## Documentation

The repo keeps a small set of focused documents. Start here, then dive in where relevant:

| Doc | What it covers |
|---|---|
| [`PIPELINE_ARCHITECTURE.md`](PIPELINE_ARCHITECTURE.md) | **Deep-dive architecture** — line-cited map of the DB schema, the pipeline run route (all 10 steps), the NLP classification logic, the anomaly-detection engine, the isolation-forest scoring, the dashboard analytics API, and known discrepancies/notes. Read this to understand *how things work* in detail. |
| [`CLAUDE.md`](CLAUDE.md) | **Agent/codebase guide** — commands, architecture overview, data-generation details (incl. the review-corpus invariant), env vars, UI rough edges, and known dev caveats. The canonical reference for working in the repo. |

`CLAUDE.md` and `PIPELINE_ARCHITECTURE.md` are the two deepest references for the pipeline internals.

