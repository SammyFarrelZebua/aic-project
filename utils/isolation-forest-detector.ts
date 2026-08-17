import { IsolationForest } from 'isolation-forest';
import { AnomalyRecord } from './anomaly-detection';

/**
 * Builds a feature vector for a specific entity over a time window.
 *
 * Features:
 * 0: review_count (total reviews for the entity in the window)
 * 1: complaint_count (number of reviews predicted with the relevant complaint type)
 * 2: avg_prob (average NLP probability/confidence for the category)
 * 3: max_prob (maximum NLP probability/confidence for the category)
 * 4: rate (complaint_count / review_count)
 */
export function buildEntityFeatures(
  records: AnomalyRecord[],
  type: string,
  targetId: string,
  currentStart: Date,
  currentDate: Date,
  isHistoric: boolean
): number[] {
  let startMs: number;
  let endMs: number;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (isHistoric) {
    // Historic window: 30 days prior to currentWindowStart
    startMs = currentStart.getTime() - 30 * ONE_DAY_MS;
    endMs = currentStart.getTime();
  } else {
    // Current window: 7 days (currentStart to currentDate)
    startMs = currentStart.getTime();
    endMs = currentDate.getTime();
  }

  const windowRecords = records.filter(
    r => r.purchaseTime >= startMs && r.purchaseTime < endMs
  );

  const entityRecords = windowRecords.filter(r => {
    if (type === 'PRODUCT_DEFECT') return r.factory_id === targetId;
    if (type === 'PACKAGING_DAMAGE') return r.warehouse_id === targetId;
    if (type === 'LATE_DELIVERY') return r.courier_id === targetId;
    return false;
  });

  const review_count = entityRecords.length;
  const complaintRecords = entityRecords.filter(r => r.predicted_type === type);
  const complaint_count = complaintRecords.length;

  let total_prob = 0;
  let max_prob = 0;

  for (const r of complaintRecords) {
    let prob = 0;
    if (type === 'PRODUCT_DEFECT' && r.prob_product_defect !== undefined) {
      prob = r.prob_product_defect;
    } else if (type === 'PACKAGING_DAMAGE' && r.prob_packaging_damage !== undefined) {
      prob = r.prob_packaging_damage;
    } else if (type === 'LATE_DELIVERY' && r.prob_late_delivery !== undefined) {
      prob = r.prob_late_delivery;
    } else if (r.predicted_confidence !== undefined) {
      prob = r.predicted_confidence;
    } else {
      prob = 0.9; // Default fallback confidence for predicted complaint
    }

    total_prob += prob;
    if (prob > max_prob) {
      max_prob = prob;
    }
  }

  const avg_prob = complaint_count > 0 ? total_prob / complaint_count : 0;
  const rate = complaint_count / (review_count || 1);

  return [review_count, complaint_count, avg_prob, max_prob, rate];
}

/**
 * Trains an Isolation Forest on training data and scores test vectors.
 * Returns an array of anomaly scores between 0 and 1 (higher score = more anomalous).
 */
export function scoreWithIsolationForest(
  trainingData: number[][],
  testData: number[][],
  numberOfTrees: number = 100
): number[] {
  if (trainingData.length === 0 || testData.length === 0) {
    return testData.map(() => 0);
  }

  const inf = new IsolationForest(numberOfTrees, trainingData.length);
  // Type assertion for compatibility with isolation-forest's DataObject[]
  inf.fit(trainingData as any);
  const rawScores = inf.predict(testData as any);

  // Normalize scores to [0, 1] range
  return rawScores.map(s => {
    if (isNaN(s)) return 0;
    return Math.max(0, Math.min(1, s));
  });
}
