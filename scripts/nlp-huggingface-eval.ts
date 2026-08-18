import * as fs from 'fs';
import * as path from 'path';
import { HfInference } from '@huggingface/inference';
import { detectAnomalies } from '../utils/anomaly-detection';

const DATASET_PATH = path.join(process.cwd(), 'data', 'analytics_traceability_dataset.json');
const CACHE_PATH = path.join(process.cwd(), 'data', 'hf_predictions_cache.json');
const MODEL_NAME = 'MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7';
const HF_TOKEN = process.env.HF_ACCESS_TOKEN || '';

const hf = new HfInference(HF_TOKEN);

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

interface CacheEntry {
  type: string | null;
  prob_product_defect?: number;
  prob_packaging_damage?: number;
  prob_late_delivery?: number;
  prob_normal?: number;
}

let cache: Record<string, string | null | CacheEntry> = {};
if (fs.existsSync(CACHE_PATH)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  } catch (e) {
    console.error('Failed to load cache, starting fresh:', e);
  }
}

function saveCache() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function loadDataset(): Dataset {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset not found at ${DATASET_PATH}. Run "npm run generate-local" first.`);
  }
  return JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
}

function classifyReviewRuleBased(reviewText: string): string | null {
  const text = reviewText.toLowerCase();
  const productDefectRegex = /cacat|rusak|buruk|tidak sesuai|tipis|pecah|patah|jelek|kualitas/i;
  const packagingDamageRegex = /kemasan|kardus|packing|peot|penyok|sobek|bocor|basah/i;
  const lateDeliveryRegex = /telat|lama|lambat|kurir|pengiriman|tunggu|meleset/i;

  if (productDefectRegex.test(text)) return 'PRODUCT_DEFECT';
  if (packagingDamageRegex.test(text)) return 'PACKAGING_DAMAGE';
  if (lateDeliveryRegex.test(text)) return 'LATE_DELIVERY';
  return null;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; estimated_time?: number };
    const isRateLimit = err.status === 429 || err.status === 503;
    const isModelLoading = err.message && (err.message.includes('loading') || err.message.includes('currently loading'));

    if (retries > 0 && (isRateLimit || isModelLoading)) {
      const waitTime = err.estimated_time ? err.estimated_time * 1000 : delay;
      console.log(`[HF API] Retrying in ${(waitTime / 1000).toFixed(1)}s... (Reason: ${err.message || err.status})`);
      await new Promise(res => setTimeout(res, waitTime));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

let consecutiveFailures = 0;
let apiDisabled = false;

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

function getPredictionFromCache(reviewId: string, score: number): string | null {
  const cachedEntry = cache[reviewId];
  if (cachedEntry === undefined) return null;
  if (cachedEntry === null) return null;

  if (typeof cachedEntry === 'string') {
    return cachedEntry;
  }

  if (typeof cachedEntry === 'object') {
    const prob_product_defect = cachedEntry.prob_product_defect || 0;
    const prob_packaging_damage = cachedEntry.prob_packaging_damage || 0;
    const prob_late_delivery = cachedEntry.prob_late_delivery || 0;
    const prob_normal = cachedEntry.prob_normal || 0;

    const scoreMap = [
      { type: 'PRODUCT_DEFECT', score: prob_product_defect },
      { type: 'PACKAGING_DAMAGE', score: prob_packaging_damage },
      { type: 'LATE_DELIVERY', score: prob_late_delivery }
    ];
    scoreMap.sort((a, b) => b.score - a.score);
    const topComplaint = scoreMap[0];

    let threshold = 0.35;
    if (score === 1) threshold = 0.20;
    else if (score === 2) threshold = 0.25;

    // Relative Thresholding (Margin Comparison)
    if (topComplaint.score - prob_normal < 0.18) {
      return null;
    }
    if (topComplaint.score >= threshold) {
      return topComplaint.type;
    }
    return null;
  }

  return null;
}

async function classifyReviewZeroShot(reviewId: string, rawText: string, score: number): Promise<string | null> {
  // If score is high (>= 4), classify as normal directly to save API quota
  if (score >= 4) {
    cache[reviewId] = null;
    return null;
  }
  if (!rawText || !rawText.trim()) {
    cache[reviewId] = null;
    return null;
  }
  if (cache[reviewId] !== undefined) {
    return getPredictionFromCache(reviewId, score);
  }

  const text = normalizeIndonesianText(rawText);

  if (apiDisabled) {
    const fallback = classifyReviewRuleBased(text);
    cache[reviewId] = fallback;
    return fallback;
  }

  // Indonesian translated candidate labels (optimized for semantic clarity)
  const candidateLabels = [
    'cacat produk atau kualitas barang buruk',
    'kemasan paket rusak, penyok, atau basah',
    'keterlambatan pengiriman atau kurir lambat',
    'ulasan normal tanpa keluhan'
  ];

  try {
    const res = await retryWithBackoff(() => hf.zeroShotClassification({
      model: MODEL_NAME,
      inputs: text,
      parameters: {
        candidate_labels: candidateLabels,
        hypothesis_template: "Ulasan ini berkaitan dengan masalah {}.",
        multi_label: true
      }
    }));

    const resData = res as unknown as { labels: string[]; scores: number[] } | { labels: string[]; scores: number[] }[];
    const labels = Array.isArray(resData) ? resData[0]?.labels : resData?.labels;
    const scores = Array.isArray(resData) ? resData[0]?.scores : resData?.scores;

    if (!labels || !scores) {
      throw new Error('Invalid HF API response structure');
    }

    // Map labels to their scores
    const labelScoreMap = new Map<string, number>();
    for (let i = 0; i < labels.length; i++) {
      labelScoreMap.set(labels[i], scores[i]);
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
    if (score === 1) threshold = 0.20;
    else if (score === 2) threshold = 0.25;

    let pred: string | null = null;
    // Relative Thresholding (Margin Comparison)
    if (topComplaint.score - prob_normal < 0.18) {
      pred = null;
    } else if (topComplaint.score >= threshold) {
      pred = topComplaint.type;
    }

    // Store in cache with the new format (including probabilities)
    cache[reviewId] = {
      type: pred,
      prob_product_defect,
      prob_packaging_damage,
      prob_late_delivery,
      prob_normal
    };

    consecutiveFailures = 0; // Reset counter on success
    return pred;
  } catch (error: unknown) {
    const err = error as { message?: string };
    consecutiveFailures++;
    console.warn(`[HF API Failed] falling back to rules for ${reviewId}: ${err.message || err}`);

    if (consecutiveFailures >= 5) {
      apiDisabled = true;
      console.warn('\n======================================================================');
      console.warn('[HF API] API calling disabled due to 5 consecutive failures.');
      console.warn('Falling back entirely to rule-based classification for remaining records.');
      console.warn('======================================================================\n');
    }

    const fallback = classifyReviewRuleBased(text);
    cache[reviewId] = fallback; // cache fallback values to avoid redundant API retry loops.
    return fallback;
  }
}

async function run() {
  const data = loadDataset();
  const records = data.records;

  if (!HF_TOKEN) {
    console.warn('\n[Warning] HF_ACCESS_TOKEN is not set in environment. Free serverless requests might get rate-limited quickly.\n');
  }

  console.log('Running HuggingFace zero-shot classification...');
  let processed = 0;
  let cacheHits = 0;
  let apiCalls = 0;

  // Filter records that need classification (score <= 3 and has text)
  const targetRecords = records.filter(r => {
    const text = `${r.review_comment_title || ''} ${r.review_comment_message || ''}`.trim();
    return r.review_score <= 3 && text.length > 0;
  });

  console.log(`Total target reviews to classify: ${targetRecords.length} (out of ${records.length} total reviews)`);

  for (const r of targetRecords) {
    const text = `${r.review_comment_title || ''} ${r.review_comment_message || ''}`.trim();

    if (cache[r.review_id] !== undefined) {
      cacheHits++;
    } else {
      apiCalls++;
    }

    await classifyReviewZeroShot(r.review_id, text, r.review_score);
    processed++;

    if (apiCalls > 0 && apiCalls % 10 === 0 && cache[r.review_id] === undefined) {
      saveCache();
    }

    if (processed % 50 === 0) {
      saveCache();
      console.log(`Progress: ${processed}/${targetRecords.length} processed (Cache Hits: ${cacheHits}, API Calls: ${apiCalls})`);
    }
  }
  saveCache();
  console.log(`\nClassification complete! Total Cache Hits: ${cacheHits}, Total API Calls: ${apiCalls}`);

  // Evaluate NLP Metrics
  let tp = 0, fp = 0, fn = 0, tn = 0;
  records.forEach(r => {
    const text = `${r.review_comment_title || ''} ${r.review_comment_message || ''}`.trim();
    // Default to null (normal) for score >= 4, check cache for score <= 3
    const predicted = (r.review_score <= 3 && text) ? getPredictionFromCache(r.review_id, r.review_score) : null;
    const actual = r.ground_truth_incident;

    if (actual) {
      if (predicted === actual) tp++;
      else fn++;
    } else {
      if (predicted) fp++;
      else tn++;
    }
  });

  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);

  console.log('\n================ HF NLP CLASSIFICATION EVALUATION ================');
  console.log(`Total Records Evaluated : ${records.length}`);
  console.log(`True Positives (TP)        : ${tp}`);
  console.log(`False Positives (FP)       : ${fp}`);
  console.log(`False Negatives (FN)       : ${fn}`);
  console.log(`True Negatives (TN)        : ${tn}`);
  console.log(`Precision                  : ${(precision * 100).toFixed(2)}%`);
  console.log(`Recall                     : ${(recall * 100).toFixed(2)}%`);
  console.log(`F1-Score                   : ${(f1 * 100).toFixed(2)}%`);

  // Run Anomaly Detection and Ranking using HF predictions
  runAnomalyDetectionAndRanking(records);
}

function runAnomalyDetectionAndRanking(records: TraceabilityRecord[]) {
  console.log('\n================ HF ANOMALY DETECTION & ROOT CAUSE RANKING ================');

  // Pre-classify all reviews using cache predictions
  const predictions = records.map(r => {
    const text = `${r.review_comment_title || ''} ${r.review_comment_message || ''}`.trim();
    const pred = (r.review_score <= 3 && text) ? getPredictionFromCache(r.review_id, r.review_score) : null;

    let severity: string | null = null;
    if (pred) {
      if (r.review_score === 1) severity = 'HIGH';
      else if (r.review_score === 2) severity = 'MEDIUM';
      else severity = 'LOW';
    }

    return {
      ...r,
      predicted_type: pred,
      predicted_severity: severity,
      predicted_confidence: pred ? 0.95 : 0.0
    };
  });

  const sortedRecords = predictions.map(r => ({
    ...r,
    purchaseTime: new Date(r.order_purchase_timestamp).getTime()
  })).sort((a, b) => a.purchaseTime - b.purchaseTime);

  let detectedAnomaliesCount = 0;
  let correctRootCauseCount = 0;

  const factories = ['fact-a', 'fact-b', 'fact-c', 'fact-d', 'fact-e'];
  const warehouses = ['wh-north', 'wh-east', 'wh-south', 'wh-west', 'wh-central'];
  const couriers = ['cour-std', 'cour-air', 'cour-fast', 'cour-eco', 'cour-local'];

  console.log('Scanning timeline for anomalies...');

  const candidateMap = {
    factoryIds: factories,
    warehouseIds: warehouses,
    courierIds: couriers
  };

  const detectedAnomalies = detectAnomalies(sortedRecords, candidateMap);
  detectedAnomaliesCount = detectedAnomalies.length;

  for (const anomaly of detectedAnomalies) {
    let groundTruthWinner = '';
    let groundTruthType: 'factory' | 'warehouse' | 'courier' = 'factory';
    if (anomaly.type === 'PRODUCT_DEFECT') {
      groundTruthWinner = 'fact-c';
      groundTruthType = 'factory';
    } else if (anomaly.type === 'PACKAGING_DAMAGE') {
      groundTruthWinner = 'wh-south';
      groundTruthType = 'warehouse';
    } else if (anomaly.type === 'LATE_DELIVERY') {
      groundTruthWinner = 'cour-fast';
      groundTruthType = 'courier';
    }

    const topCandidate = anomaly.scoredCandidates[0];
    const isCorrect = topCandidate && topCandidate.id === groundTruthWinner && topCandidate.entityType === groundTruthType;
    if (isCorrect) correctRootCauseCount++;
  }

  const accuracy = correctRootCauseCount / (detectedAnomaliesCount || 1);
  console.log('\n================ FINAL PERFORMANCE SUMMARY (HUGGING FACE) ================');
  console.log(`Total Anomalies Detected    : ${detectedAnomaliesCount}`);
  console.log(`Correctly Pinpointed Source : ${correctRootCauseCount}`);
  console.log(`Top-1 Identification Accuracy : ${(accuracy * 100).toFixed(2)}%`);
}

run().catch(console.error);
