import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceClient } from '@/utils/supabase/service';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { detectAnomalies } from '@/utils/anomaly-detection';
import { pipelineState } from '../state';

type ClassifierFn = (text: string, candidateLabels: string[], options?: { hypothesis_template?: string }) => Promise<{ labels: string[]; scores: number[] }>;
let cachedClassifier: ClassifierFn | null = null;

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

  // Start background task
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
  let hasMore = true;
  
  // 1. Clear previous root cause predictions once at start
  const supabase = createServiceClient();
  await supabase.from('root_cause_predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  while (hasMore) {
    hasMore = false;
    
    // 2. Fetch all reviews and existing predictions
    const { data: reviews, error: reviewError } = await supabase.from('review').select('*');
    if (reviewError) throw reviewError;

    const { data: existingPredictions, error: predError } = await supabase.from('complaint_prediction').select('*');
    if (predError) throw predError;

    const existingPredMap = new Map(existingPredictions?.map(p => [p.review_id, p]) || []);

    const newComplaintPredictions = [];
    const allComplaintPredictions = [...(existingPredictions || [])];

    // BATCHING
    const BATCH_SIZE = 25;
    let processedInThisBatch = 0;

    for (const r of (reviews || [])) {
      if (existingPredMap.has(r.review_id)) continue; 

      let type: string | null = null;
      let severity: string | null = null;
      let confidence = 0.0;
      let prob_product_defect = 0.0;
      let prob_packaging_damage = 0.0;
      let prob_late_delivery = 0.0;

      if (r.rating <= 3 && r.review_text && r.review_text.trim().length > 0) {
        if (processedInThisBatch >= BATCH_SIZE) {
          hasMore = true;
          continue;
        }
        processedInThisBatch++;

        if (!cachedClassifier) {
          const { pipeline, env } = await import('@huggingface/transformers');
          env.allowLocalModels = false;
          cachedClassifier = (await pipeline('zero-shot-classification', 'Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7', { quantized: true } as unknown as Parameters<typeof pipeline>[2])) as unknown as ClassifierFn;
        }

        const text = r.review_text.toLowerCase().trim();
        const candidateLabels = [
          'cacat produk atau kualitas barang buruk',
          'kemasan paket rusak, penyok, atau basah',
          'keterlambatan pengiriman atau kurir lambat',
          'ulasan normal tanpa keluhan'
        ];

        try {
          const result = await cachedClassifier(text, candidateLabels, {
            hypothesis_template: "Ulasan ini berkaitan dengan masalah {}."
          });

          // Map labels to their scores
          const labelScoreMap = new Map<string, number>();
          for (let i = 0; i < result.labels.length; i++) {
            labelScoreMap.set(result.labels[i], result.scores[i]);
          }

          prob_product_defect = labelScoreMap.get(candidateLabels[0]) || 0;
          prob_packaging_damage = labelScoreMap.get(candidateLabels[1]) || 0;
          prob_late_delivery = labelScoreMap.get(candidateLabels[2]) || 0;

          const topLabel = result.labels[0];

          if (topLabel === candidateLabels[0]) type = 'PRODUCT_DEFECT';
          else if (topLabel === candidateLabels[1]) type = 'PACKAGING_DAMAGE';
          else if (topLabel === candidateLabels[2]) type = 'LATE_DELIVERY';

          if (type) {
            confidence = labelScoreMap.get(topLabel) || 0;
            severity = r.rating === 1 ? 'HIGH' : r.rating === 2 ? 'MEDIUM' : 'LOW';
          }
        } catch (e) {
          console.error(`ML Classification failed for ${r.review_id}:`, e);
        }
      } else {
        type = null;
      }

      if (type || r.rating > 3 || !r.review_text || r.review_text.trim().length === 0) {
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
        if (type) allComplaintPredictions.push(pred);
      }
    }

    for (let i = 0; i < newComplaintPredictions.length; i += 1000) {
      const chunk = newComplaintPredictions.slice(i, i + 1000);
      const { error } = await supabase.from('complaint_prediction').insert(chunk);
      if (error) throw error;
    }

    pipelineState.processed += processedInThisBatch;
    pipelineState.duration_ms = Date.now() - start;
  }

  // 4. Fetch Analytical View once ALL ML batches are done
  const { data: existingPredictionsFinal } = await supabase.from('complaint_prediction').select('*');
  const allComplaintPredictionsFinal = [...(existingPredictionsFinal || [])];
  
  const { data: analyticsRecords, error: analyticsError } = await supabase.from('analytics_traceability_view').select('*');
  if (analyticsError) throw analyticsError;

  const predictionsMap = new Map(allComplaintPredictionsFinal.map(p => [p.review_id, p]));
  const records = analyticsRecords.map(r => {
    const pred = predictionsMap.get(r.review_id);
    return {
      ...r,
      predicted_type: pred ? pred.complaint_type : null,
      purchaseTime: new Date(r.order_purchase_timestamp).getTime()
    };
  }).sort((a, b) => a.purchaseTime - b.purchaseTime);

  // 5. Temporal Anomaly Detection
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
}
