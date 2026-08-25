# Detektif Kemasan (AIC 2026)

AI-powered complaint intelligence that traces customer reviews back to the supply chain (probable operational source ranking, not causal proof).

## Overview
**Core Flow**: Customer Review -> Complaint Understanding (NLP classification) -> Temporal Anomaly Detection -> Supply-Chain Traceability -> Candidate Source Ranking -> Operational Alert.

**Source Dataset**: Olist Brazilian E-Commerce Dataset, subset to ~15,000 orders. Review text is **generated** — a hand-written Indonesian clause corpus (`utils/review-corpus.ts`), not machine-translated. The UI and NLP labels are Indonesian.

## Getting Started

### 1. Environment Variables
Copy the `.env.example` file to `.env.local` and fill in the required values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HF_ACCESS_TOKEN`

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

### 4. Start Development Server
Run the Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The root route will automatically redirect you to the main dashboard.

## How It Works

### Methodology
The pipeline (`POST /api/pipeline/run`, run as a background job) takes customer reviews and traces likely operational sources:
1. **Preprocessing** — normalizes Indonesian SMS-speak (`normalizeIndonesianText`), then a regex keyword pre-filter skips the zero-shot model for reviews that match no complaint keyword.
2. **NLP classification** — low-rated reviews (`rating ≤ 3`) that pass the pre-filter are labeled `PRODUCT_DEFECT` / `PACKAGING_DAMAGE` / `LATE_DELIVERY` by a Transformers.js zero-shot model (`Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7`), with rating-dependent thresholds and a margin-over-normal gate. Multi-class probabilities are stored in `complaint_prediction`.
3. **Temporal anomaly detection** — a sliding window (7-day current vs 30-day historic) flags a spike when the complaint ratio jumps ≥ 2.0× with ≥ 3 current-window complaints (and sample-size gates).
4. **Candidate source ranking** — candidates are restricted to the entity type structurally responsible for the incident (`PRODUCT_DEFECT`→factories, `PACKAGING_DAMAGE`→warehouses, `LATE_DELIVERY`→couriers) and scored with a hybrid composite (`0.6 × isolation-forest score + 0.4 × deviation-ratio × complaint-share`). The top candidate per anomaly is written to `root_cause_predictions`.
5. **Operational alert** — the dashboard reads the results from Supabase; accuracy is computed against the injected ground-truth `incidents`.

See [`PIPELINE_ARCHITECTURE.md`](PIPELINE_ARCHITECTURE.md) for the full line-cited deep-dive.
