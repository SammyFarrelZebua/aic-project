import * as fs from 'fs';
import * as path from 'path';
import { detectAnomalies } from '../utils/anomaly-detection';

const DATASET_PATH = path.join(process.cwd(), 'data', 'analytics_traceability_dataset.json');

interface TraceabilityRecord {
  review_id: string;
  review_score: number;
  review_comment_title: string | null;
  review_comment_message: string | null;
  review_creation_date: string;
  order_id: string;
  order_status: string;
  order_purchase_timestamp: string;
  order_delivered_customer_date: string | null;
  item_price: number | null;
  item_freight_value: number | null;
  product_id: string | null;
  product_category: string | null;
  batch_id: string | null;
  batch_production_date: string | null;
  factory_id: string | null;
  factory_name: string | null;
  factory_region: string | null;
  shipment_id: string | null;
  shipment_date: string | null;
  shipment_delivery_date: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  warehouse_region: string | null;
  courier_id: string | null;
  courier_name: string | null;
  courier_region: string | null;
  ground_truth_incident: 'PRODUCT_DEFECT' | 'PACKAGING_DAMAGE' | 'LATE_DELIVERY' | null;
}

interface Dataset {
  incidents: unknown[];
  records: TraceabilityRecord[];
}

function loadDataset(): Dataset {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset not found at ${DATASET_PATH}. Run "npm run generate-local" first.`);
  }
  return JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
}

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

async function run() {
  const data = loadDataset();
  const records = data.records;

  console.log('Loading local Transformers.js model (mDeBERTa-v3)...');
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;

  const classifier = await pipeline('zero-shot-classification', 'Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7', { quantized: true } as any);

  const candidateLabels = [
    'cacat produk atau kualitas barang buruk',
    'kemasan paket rusak, penyok, atau basah',
    'keterlambatan pengiriman atau kurir lambat',
    'ulasan normal tanpa keluhan'
  ];

  console.log('Classifying reviews with local model (subset of 200 reviews for speed)...');
  const targetRecords = records.filter(r => {
    const text = `${r.review_comment_title || ''} ${r.review_comment_message || ''}`.trim();
    return r.review_score <= 3 && text.length > 0;
  });

  // Take a subset of 200 reviews to evaluate quickly on CPU
  const evalSubset = targetRecords.slice(0, 200);
  console.log(`Evaluating ${evalSubset.length} reviews...`);

  let tp = 0, fp = 0, fn = 0, tn = 0;
  let count = 0;

  for (const r of evalSubset) {
    const rawText = `${r.review_comment_title || ''} ${r.review_comment_message || ''}`.trim();
    const text = normalizeIndonesianText(rawText);

    // --- GUARDRAIL (PRE-FILTER) ---
    const productDefectRegex = /cacat|rusak|buruk|tidak sesuai|tipis|pecah|patah|jelek|kualitas/i;
    const packagingDamageRegex = /kemasan|kardus|packing|peot|penyok|sobek|bocor|basah/i;
    const lateDeliveryRegex = /telat|lama|lambat|kurir|pengiriman|tunggu|meleset/i;

    let predicted: string | null = null;

    if (!productDefectRegex.test(text) && !packagingDamageRegex.test(text) && !lateDeliveryRegex.test(text)) {
      // General negative review without specific incident keywords -> Skip ML model completely!
      predicted = null;
    } else {
      try {
        const res = await classifier(text, candidateLabels, {
          hypothesis_template: "Ulasan ini berkaitan dengan masalah {}.",
          multi_label: true
        });

        const labelScoreMap = new Map<string, number>();
        for (let i = 0; i < res.labels.length; i++) {
          labelScoreMap.set(res.labels[i], res.scores[i]);
        }

        const prob_product_defect = labelScoreMap.get(candidateLabels[0]) || 0;
        const prob_packaging_damage = labelScoreMap.get(candidateLabels[1]) || 0;
        const prob_late_delivery = labelScoreMap.get(candidateLabels[2]) || 0;
        const prob_normal = labelScoreMap.get(candidateLabels[3]) || 0;

        const scoreMap = [
          { type: 'PRODUCT_DEFECT', score: prob_product_defect },
          { type: 'PACKAGING_DAMAGE', score: prob_packaging_damage },
          { type: 'LATE_DELIVERY', score: prob_late_delivery }
        ];
        scoreMap.sort((a, b) => b.score - a.score);
        const topComplaint = scoreMap[0];

        let threshold = 0.35;
        if (r.review_score === 1) threshold = 0.20;
        else if (r.review_score === 2) threshold = 0.25;

        // Relative Thresholding (Margin Comparison)
        if (topComplaint.score - prob_normal < 0.18) {
          predicted = null;
        } else if (topComplaint.score >= threshold) {
          predicted = topComplaint.type;
        }
      } catch (e) {
        console.error('Inference error:', e);
      }
    }

    const actual = r.ground_truth_incident;

    if (actual) {
      if (predicted === actual) tp++;
      else fn++;
    } else {
      if (predicted) fp++;
      else tn++;
    }

    count++;
    if (count % 20 === 0) {
      console.log(`Processed ${count}/${evalSubset.length}`);
    }
  }

  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);

  console.log('\n================ LOCAL MODEL NLP EVALUATION (SUBSET) ================');
  console.log(`True Positives (TP)  : ${tp}`);
  console.log(`False Positives (FP) : ${fp}`);
  console.log(`False Negatives (FN) : ${fn}`);
  console.log(`True Negatives (TN)  : ${tn}`);
  console.log(`Precision            : ${(precision * 100).toFixed(2)}%`);
  console.log(`Recall               : ${(recall * 100).toFixed(2)}%`);
  console.log(`F1-Score             : ${(f1 * 100).toFixed(2)}%`);
}

run().catch(console.error);
