import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/utils/supabase/service';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { detectAnomalies } from '@/utils/anomaly-detection';
import { pipelineState } from '../state';
import type { SupabaseClient } from '@supabase/supabase-js';

// Thrown from inside runPipelineBackground() when a cancellation is noticed
// at a checkpoint. Distinguishes a deliberate user-requested stop from a
// genuine failure so the outer catch does not report it as an error.
class PipelineCancelledError extends Error {
  constructor() {
    super('Pipeline dibatalkan.');
    this.name = 'PipelineCancelledError';
  }
}

// PostgREST caps .select() at a default max_rows (commonly 1000) unless the
// full range is requested explicitly, so large tables/views must be paged
// through rather than fetched with a single unbounded select('*').
async function selectAll<T>(supabase: SupabaseClient, table: string, columns = '*'): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

type ClassifierFn = (
  text: string,
  candidateLabels: string[],
  options?: { hypothesis_template?: string; multi_label?: boolean }
) => Promise<{ labels: string[]; scores: number[] }>;
let cachedClassifier: ClassifierFn | null = null;

function normalizeIndonesianText(text: string): string {
  let normalized = text.toLowerCase();

  normalized = normalized.replace(/\byg\b/g, 'yang');
  normalized = normalized.replace(/\bdgn\b/g, 'dengan');
  normalized = normalized.replace(/\b(ga|gak|tdk)\b/g, 'tidak');
  normalized = normalized.replace(/\btp\b/g, 'tapi');
  normalized = normalized.replace(/\bkrn\b/g, 'karena');
  normalized = normalized.replace(/\bbrg\b/g, 'barang');
  normalized = normalized.replace(/\bongkir\b/g, 'ongkos kirim');
  normalized = normalized.replace(/\bpaking\b/g, 'kemasan');
  normalized = normalized.replace(/\b(telat|lambat)\b/g, 'terlambat');
  normalized = normalized.replace(/\bkurir\b/g, 'kurir');
  normalized = normalized.replace(/\b(pecah|patah|hancur)\b/g, 'rusak');
  normalized = normalized.replace(/([a-z])\1{2,}/g, '$1');

  return normalized;
}

export async function POST() {
  // Claim the concurrency slot synchronously, before any `await` yields
  // control back to the event loop. This must happen first: the auth check
  // below is a real network round-trip, and Node only guarantees run-to-
  // completion for the synchronous code between awaits -- if the "already
  // running?" check ran after that await (as it used to), two near-
  // simultaneous POSTs (e.g. a double-click) could both resolve their own
  // auth call and both see pipelineState.status as not-'running' before
  // either had a chance to flip it, letting both start
  // runPipelineBackground() concurrently. Both then delete-then-insert
  // complaint_prediction with the same deterministic prediction_id values,
  // and whichever insert commits second collides with the first's
  // already-committed rows ("duplicate key value violates unique
  // constraint complaint_prediction_pkey"). Claiming the slot before the
  // first await closes that window: whichever request's synchronous prefix
  // runs first claims it uninterrupted, so the second request's own
  // synchronous prefix (whenever it runs) always sees 'running' already set.
  if (pipelineState.status === 'running') {
    return NextResponse.json({ success: true, message: 'Pipeline already running in background' });
  }

  pipelineState.status = 'running';
  pipelineState.processed = 0;
  pipelineState.duration_ms = 0;
  pipelineState.error = null;
  pipelineState.cancelRequested = false;

  const cookieStore = await cookies();
  const authClient = createClient(cookieStore);
  const { data: { user }, error: authError } = await authClient.auth.getUser();

  if (authError || !user) {
    // Not actually starting a run -- release the slot we claimed above.
    pipelineState.status = 'idle';
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  runPipelineBackground().catch((e) => {
    // A deliberate cancel already settles pipelineState itself (see the
    // catch inside runPipelineBackground); do not let this fire-and-forget
    // handler clobber that back to 'error'.
    if (pipelineState.status === 'cancelled') return;
    pipelineState.status = 'error';
    pipelineState.error = e.message;
  });

  return NextResponse.json({ success: true, message: 'Pipeline started' });
}

async function runPipelineBackground() {
  const start = Date.now();
  const supabase = createServiceClient();

  try {
    const { error: delRcpError } = await supabase.from('root_cause_predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delRcpError) throw new Error(`Gagal menghapus root_cause_predictions lama: ${delRcpError.message}`);
    const { error: delCpError } = await supabase.from('complaint_prediction').delete().neq('prediction_id', '00000000-0000-0000-0000-000000000000');
    if (delCpError) throw new Error(`Gagal menghapus complaint_prediction lama: ${delCpError.message}`);

    const reviews = await selectAll<any>(supabase, 'review');
    console.log(`[Pipeline] Fetched ${reviews.length} reviews total`);

    let bypassCount = 0;
    let mlEvaluatedCount = 0;
    let nonNormalCount = 0;

    const newComplaintPredictions = [];

    const totalMlTasks = reviews.filter(r => r.rating <= 3 && r.review_text && r.review_text.trim().length > 0).length;
    let mlProcessedCount = 0;

    for (const r of reviews) {
      let type: string | null = null;
      let severity: string | null = null;
      let confidence = 0.0;
      let prob_product_defect = 0.0;
      let prob_packaging_damage = 0.0;
      let prob_late_delivery = 0.0;
      let prob_normal = 0.0;

      if (r.rating <= 3 && r.review_text && r.review_text.trim().length > 0) {
        const text = normalizeIndonesianText(r.review_text.trim());

        const productDefectRegex = /cacat|rusak|buruk|tidak sesuai|tipis|pecah|patah|jelek|kualitas/i;
        const packagingDamageRegex = /kemasan|kardus|packing|peot|penyok|sobek|bocor|basah/i;
        const lateDeliveryRegex = /telat|lama|lambat|kurir|pengiriman|tunggu|meleset/i;

        if (!productDefectRegex.test(text) && !packagingDamageRegex.test(text) && !lateDeliveryRegex.test(text)) {
          type = 'NORMAL';
          bypassCount++;
        } else {
          if (!cachedClassifier) {
            const { pipeline, env } = await import('@huggingface/transformers');
            env.allowLocalModels = false;
            cachedClassifier = (await pipeline('zero-shot-classification', 'Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7', { quantized: true } as unknown as Record<string, unknown>)) as unknown as ClassifierFn;
          }

          const candidateLabels = [
            'cacat produk atau kualitas barang buruk',
            'kemasan paket rusak, penyok, atau basah',
            'keterlambatan pengiriman atau kurir lambat',
            'ulasan normal tanpa keluhan'
          ];

          try {
            const result = await cachedClassifier(text, candidateLabels, {
              hypothesis_template: "Ulasan ini berkaitan dengan masalah {}.",
              multi_label: true
            });

            const labelScoreMap = new Map<string, number>();
            for (let i = 0; i < result.labels.length; i++) {
              labelScoreMap.set(result.labels[i], result.scores[i]);
            }

            prob_product_defect = labelScoreMap.get(candidateLabels[0]) || 0;
            prob_packaging_damage = labelScoreMap.get(candidateLabels[1]) || 0;
            prob_late_delivery = labelScoreMap.get(candidateLabels[2]) || 0;
            prob_normal = labelScoreMap.get(candidateLabels[3]) || 0;

            const scoreMap = [
              { type: 'PRODUCT_DEFECT', score: prob_product_defect },
              { type: 'PACKAGING_DAMAGE', score: prob_packaging_damage },
              { type: 'LATE_DELIVERY', score: prob_late_delivery }
            ];
            scoreMap.sort((a, b) => b.score - a.score);
            const topComplaint = scoreMap[0];

            let threshold = 0.35;
            if (r.rating === 1) threshold = 0.20;
            else if (r.rating === 2) threshold = 0.25;

            mlEvaluatedCount++;
            if (topComplaint.score - prob_normal < 0.18) {
              type = 'NORMAL';
            } else if (topComplaint.score >= threshold) {
              type = topComplaint.type;
              confidence = topComplaint.score;
              severity = r.rating === 1 ? 'HIGH' : r.rating === 2 ? 'MEDIUM' : 'LOW';
              nonNormalCount++;
            } else {
              type = 'NORMAL';
            }
          } catch (e) {
            console.error(`ML Classification failed for ${r.review_id}:`, e);
            type = 'NORMAL';
          }
        }

        mlProcessedCount++;
        if (mlProcessedCount % 25 === 0 || mlProcessedCount === totalMlTasks) {
          pipelineState.processed = mlProcessedCount;
          pipelineState.duration_ms = Date.now() - start;

          // Cooperative cancellation checkpoint -- the only place in the
          // classification loop where we cheaply notice a cancel request.
          if (pipelineState.cancelRequested) {
            pipelineState.status = 'cancelled';
            pipelineState.duration_ms = Date.now() - start;
            pipelineState.error = null;
            throw new PipelineCancelledError();
          }
        }
      } else {
        type = 'NORMAL';
      }

      const pred = {
        prediction_id: `pred-${r.review_id}`,
        review_id: r.review_id,
        complaint_type: type,
        severity,
        confidence,
        prob_product_defect,
        prob_packaging_damage,
        prob_late_delivery
      };
      newComplaintPredictions.push(pred);
    }

    // Insert predictions in chunks of 500 to Supabase and log error if any.
    // Uses upsert (not insert) keyed on prediction_id -- prediction_id is
    // deterministic (`pred-${review_id}`, see below), so this loop is
    // idempotent by design. That matters because this loop has no
    // cancellation checkpoint (see the checkpoint added below): if a run is
    // cancelled mid-classification but the cooperative check at the
    // classification loop's last checkpoint already passed, it keeps
    // writing every chunk here uninterrupted before the cancel is ever
    // honored (line ~275 below). If a fresh run is then started right
    // after (a real, observed sequence: cancel -> immediate re-run click),
    // its own delete-then-insert can overlap with the still-finishing
    // cancelled run's writes and previously crashed with "duplicate key
    // value violates unique constraint complaint_prediction_pkey" on a
    // plain .insert(). upsert makes that overlap harmless instead of fatal
    // -- whichever write lands last for a given review just wins, and since
    // both runs' classifications are for the same review, that's fine.
    for (let i = 0; i < newComplaintPredictions.length; i += 500) {
      if (pipelineState.cancelRequested) {
        pipelineState.status = 'cancelled';
        pipelineState.duration_ms = Date.now() - start;
        pipelineState.error = null;
        throw new PipelineCancelledError();
      }
      const chunk = newComplaintPredictions.slice(i, i + 500);
      const { error } = await supabase.from('complaint_prediction').upsert(chunk, { onConflict: 'prediction_id' });
      if (error) {
        console.error(`[DB Insert Error] Failed at chunk starting at index ${i}:`, error.message, error.details, error.hint);
        throw new Error(`Gagal menyimpan chunk prediksi ${i} ke database: ${error.message}`);
      }
    }

    console.log(`[Pipeline] ML bypassed: ${bypassCount}, ML evaluated: ${mlEvaluatedCount}, non-NORMAL predicted: ${nonNormalCount}`);
    pipelineState.processed = totalMlTasks;

    // A cancel may have arrived after the classification loop's last
    // checkpoint (e.g. during the insert-chunk loop above) but before we
    // reach the anomaly-detection/finalization phases below. Catching it
    // here avoids running the expensive, non-interruptible detectAnomalies()
    // pass and the root_cause_predictions insert for a run the user already
    // asked to stop.
    if (pipelineState.cancelRequested) {
      pipelineState.status = 'cancelled';
      pipelineState.duration_ms = Date.now() - start;
      pipelineState.error = null;
      return;
    }

    const analyticsRecords = await selectAll<any>(supabase, 'analytics_traceability_view');

    const predictionsMap = new Map(newComplaintPredictions.map(p => [p.review_id, p]));
    const records = analyticsRecords.map(r => {
      const pred = predictionsMap.get(r.review_id);
      return {
        ...r,
        predicted_type: pred ? (pred.complaint_type === 'NORMAL' ? null : pred.complaint_type) : null,
        purchaseTime: new Date(r.order_purchase_timestamp).getTime()
      };
    }).sort((a, b) => a.purchaseTime - b.purchaseTime);

    const { data: factories } = await supabase.from('factory').select('factory_id');
    const { data: warehouses } = await supabase.from('warehouse').select('warehouse_id');
    const { data: couriers } = await supabase.from('courier').select('courier_id');

    const candidateMap = {
      factoryIds: (factories || []).map(f => f.factory_id),
      warehouseIds: (warehouses || []).map(w => w.warehouse_id),
      courierIds: (couriers || []).map(c => c.courier_id)
    };

    // detectAnomalies() is fully synchronous (no awaits inside), so a cancel
    // requested while it is running cannot be noticed until it returns --
    // see the check immediately below and the plan's documented limitation.
    const detectedAnomalies = detectAnomalies(records, candidateMap);

    if (pipelineState.cancelRequested) {
      pipelineState.status = 'cancelled';
      pipelineState.duration_ms = Date.now() - start;
      pipelineState.error = null;
      return;
    }

    const dbRootCausePredictions = detectedAnomalies.map(anomaly => ({
      incident_type: anomaly.type,
      detected_period_start: anomaly.currentWindowStart.toISOString(),
      detected_period_end: anomaly.date.toISOString(),
      candidate_type: anomaly.scoredCandidates[0]?.entityType || 'unknown',
      candidate_id: anomaly.scoredCandidates[0]?.id,
      confidence: Math.min(0.999, (anomaly.scoredCandidates[0]?.score || 0) / 100)
    })).filter(p => p.candidate_id);

    if (dbRootCausePredictions.length > 0) {
      const { error } = await supabase.from('root_cause_predictions').insert(dbRootCausePredictions);
      if (error) throw error;
    }

    pipelineState.duration_ms = Date.now() - start;
    pipelineState.status = 'done';

    try {
      revalidateTag('dashboard-analytics', { expire: 0 });
    } catch (err) {
      console.error('Failed to revalidate dashboard-analytics cache tag:', err);
    }
  } catch (err: unknown) {
    if (err instanceof PipelineCancelledError || pipelineState.cancelRequested) {
      // Already settled to 'cancelled' at the throw site (or by the
      // pre-detectAnomalies/pre-finalize checks above); do not overwrite it
      // with an 'error' status, and do not propagate this as a real failure.
      pipelineState.status = 'cancelled';
      pipelineState.error = null;
      return;
    }
    const error = err as Error;
    pipelineState.status = 'error';
    pipelineState.error = error.message;
    throw err;
  }
}
