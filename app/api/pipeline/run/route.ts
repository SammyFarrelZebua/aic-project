import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/utils/supabase/service';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { detectAnomalies } from '@/utils/anomaly-detection';
import { pipelineState } from '../state';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  const cookieStore = await cookies();
  const authClient = createClient(cookieStore);
  const { data: { user }, error: authError } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (pipelineState.status === 'running') {
    return NextResponse.json({ success: true, message: 'Pipeline already running in background' });
  }

  pipelineState.status = 'running';
  pipelineState.processed = 0;
  pipelineState.duration_ms = 0;
  pipelineState.error = null;

  runPipelineBackground().catch((e) => {
    pipelineState.status = 'error';
    pipelineState.error = e.message;
  });

  return NextResponse.json({ success: true, message: 'Pipeline started' });
}

async function runPipelineBackground() {
  const start = Date.now();
  const supabase = createServiceClient();

  try {
    await supabase.from('root_cause_predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('complaint_prediction').delete().neq('prediction_id', '00000000-0000-0000-0000-000000000000');

    const reviews = await selectAll<any>(supabase, 'review');

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
        } else {
          if (!cachedClassifier) {
            const { pipeline, env } = await import('@huggingface/transformers');
            env.allowLocalModels = false;
            cachedClassifier = (await pipeline('zero-shot-classification', 'Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7', { quantized: true } as any)) as unknown as ClassifierFn;
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

            if (topComplaint.score - prob_normal < 0.18) {
              type = 'NORMAL';
            } else if (topComplaint.score >= threshold) {
              type = topComplaint.type;
              confidence = topComplaint.score;
              severity = r.rating === 1 ? 'HIGH' : r.rating === 2 ? 'MEDIUM' : 'LOW';
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

    // Insert predictions in chunks of 500 to Supabase and log error if any
    for (let i = 0; i < newComplaintPredictions.length; i += 500) {
      const chunk = newComplaintPredictions.slice(i, i + 500);
      const { error } = await supabase.from('complaint_prediction').insert(chunk);
      if (error) {
        console.error(`[DB Insert Error] Failed at chunk starting at index ${i}:`, error.message, error.details, error.hint);
        throw new Error(`Gagal menyimpan chunk prediksi ${i} ke database: ${error.message}`);
      }
    }

    pipelineState.processed = totalMlTasks;

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

    const detectedAnomalies = detectAnomalies(records, candidateMap);

    const dbRootCausePredictions = detectedAnomalies.map(anomaly => ({
      incident_type: anomaly.type,
      detected_period_start: anomaly.currentWindowStart.toISOString(),
      detected_period_end: anomaly.date.toISOString(),
      candidate_type: anomaly.type === 'PRODUCT_DEFECT' ? 'factory' : anomaly.type === 'PACKAGING_DAMAGE' ? 'warehouse' : 'courier',
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
  } catch (err: any) {
    pipelineState.status = 'error';
    pipelineState.error = err.message;
    throw err;
  }
}
