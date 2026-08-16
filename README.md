# Detektif Kemasan (AIC 2026)

AI-powered complaint intelligence that traces customer reviews back to the supply chain (probable operational source ranking, not causal proof).

## Overview
**Core Flow**: Customer Review -> Complaint Understanding (NLP classification) -> Temporal Anomaly Detection -> Supply-Chain Traceability -> Candidate Source Ranking -> Operational Alert.

**Source Dataset**: Olist Brazilian E-Commerce Dataset, subset to ~15,000 orders. Review text is machine-translated Portuguese->Indonesian; the UI and NLP labels are Indonesian.

## Getting Started

### 1. Environment Variables
Copy the `.env.example` file to `.env.local` and fill in the required values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HF_ACCESS_TOKEN`

### 2. Database Setup
The schema lives in a single migration at `supabase/migrations/20260809000000_init_schema.sql`.
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
