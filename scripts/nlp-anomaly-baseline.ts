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

// Rule-based NLP classifier for Indonesian reviews
function classifyReview(reviewText: string, score: number): { type: string | null; severity: string | null; confidence: number } {
  const text = reviewText.toLowerCase();

  const productDefectRegex = /cacat|rusak|buruk|tidak sesuai|tipis|pecah|patah|jelek|kualitas/i;
  const packagingDamageRegex = /kemasan|kardus|packing|peot|penyok|sobek|bocor|basah/i;
  const lateDeliveryRegex = /telat|lama|lambat|kurir|pengiriman|tunggu|meleset/i;

  let type: string | null = null;
  let confidence = 0.0;

  if (productDefectRegex.test(text)) {
    type = 'PRODUCT_DEFECT';
    confidence = 0.9;
  } else if (packagingDamageRegex.test(text)) {
    type = 'PACKAGING_DAMAGE';
    confidence = 0.9;
  } else if (lateDeliveryRegex.test(text)) {
    type = 'LATE_DELIVERY';
    confidence = 0.9;
  } else if (score <= 2) {
    // Keep fallback null (unknown) to avoid high False Positives in baseline metrics
    type = null;
    confidence = 0.0;
  }

  let severity: string | null = null;
  if (type) {
    if (score === 1) severity = 'HIGH';
    else if (score === 2) severity = 'MEDIUM';
    else severity = 'LOW';
  }

  return { type, severity, confidence };
}

function evaluateNLP(records: TraceabilityRecord[]) {
  console.log('\n================ NLP CLASSIFICATION EVALUATION ================');

  let tp = 0, fp = 0, fn = 0, tn = 0;
  const totalReviews = records.length;
  let classifiedCount = 0;

  records.forEach(r => {
    const text = `${r.review_comment_title || ''} ${r.review_comment_message || ''}`.trim();
    const prediction = classifyReview(text, r.review_score);

    const actual = r.ground_truth_incident;
    const predicted = prediction.type;

    if (actual) {
      if (predicted === actual) {
        tp++;
      } else {
        fn++;
      }
    } else {
      if (predicted) {
        fp++;
      } else {
        tn++;
      }
    }

    if (predicted) classifiedCount++;
  });

  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);

  console.log(`Total Records Evaluated : ${totalReviews}`);
  console.log(`Total Predicted Complaints : ${classifiedCount}`);
  console.log(`True Positives (TP)        : ${tp}`);
  console.log(`False Positives (FP)       : ${fp}`);
  console.log(`False Negatives (FN)       : ${fn}`);
  console.log(`True Negatives (TN)        : ${tn}`);
  console.log(`Precision                  : ${(precision * 100).toFixed(2)}%`);
  console.log(`Recall                     : ${(recall * 100).toFixed(2)}%`);
  console.log(`F1-Score                   : ${(f1 * 100).toFixed(2)}%`);
}

function runAnomalyDetectionAndRanking(records: TraceabilityRecord[]) {
  console.log('\n================ ANOMALY DETECTION & ROOT CAUSE RANKING ================');

  // Pre-classify all reviews
  const predictions = records.map(r => {
    const text = `${r.review_comment_title || ''} ${r.review_comment_message || ''}`.trim();
    const pred = classifyReview(text, r.review_score);
    return {
      ...r,
      predicted_type: pred.type,
      predicted_severity: pred.severity,
      predicted_confidence: pred.confidence
    };
  });

  // Pre-parse purchase dates to avoid performance overhead in filters
  const sortedRecords = predictions.map(r => ({
    ...r,
    purchaseTime: new Date(r.order_purchase_timestamp).getTime()
  })).sort((a, b) => a.purchaseTime - b.purchaseTime);

  // Sweep the timeline day by day
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

    console.log(`\n[ANOMALY DETECTED] Date: ${anomaly.date.toISOString().split('T')[0]} | Type: ${anomaly.type}`);
    console.log(`  Spike Ratio: ${anomaly.spikeRatio.toFixed(2)}x`);
    console.log(`  Candidates Ranking (Top 3):`);
    anomaly.scoredCandidates.slice(0, 3).forEach((c, idx) => {
      console.log(`    ${idx + 1}. [${c.entityType}] ID: ${c.id.padEnd(12)} | Score: ${c.score.toFixed(4)} (DR: ${c.dr.toFixed(2)}x, Share: ${(c.ics*100).toFixed(1)}%)`);
    });
    console.log(`  Ground Truth Root Cause: [${groundTruthType}] ${groundTruthWinner}`);
    console.log(`  Diagnosis Result: ${isCorrect ? '✅ SUCCESS' : '❌ FAILED'}`);
  }

  const accuracy = correctRootCauseCount / (detectedAnomaliesCount || 1);
  console.log('\n================ FINAL PERFORMANCE SUMMARY ================');
  console.log(`Total Anomalies Detected    : ${detectedAnomaliesCount}`);
  console.log(`Correctly Pinpointed Source : ${correctRootCauseCount}`);
  console.log(`Top-1 Identification Accuracy : ${(accuracy * 100).toFixed(2)}%`);
}

function run() {
  const data = loadDataset();
  evaluateNLP(data.records);
  runAnomalyDetectionAndRanking(data.records);
}

run();
