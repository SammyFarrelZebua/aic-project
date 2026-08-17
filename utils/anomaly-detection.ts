import { buildEntityFeatures, scoreWithIsolationForest } from './isolation-forest-detector';

export interface AnomalyRecord {
  purchaseTime: number;
  predicted_type: string | null;
  predicted_confidence?: number;
  prob_product_defect?: number;
  prob_packaging_damage?: number;
  prob_late_delivery?: number;
  factory_id?: string | null;
  warehouse_id?: string | null;
  courier_id?: string | null;
}

export interface CandidateMap {
  factoryIds: string[];
  warehouseIds: string[];
  courierIds: string[];
}

export interface DetectedAnomaly {
  date: Date;
  type: 'PRODUCT_DEFECT' | 'PACKAGING_DAMAGE' | 'LATE_DELIVERY';
  spikeRatio: number;
  currentWindowStart: Date;
  scoredCandidates: { id: string; score: number; dr: number; ics: number }[];
}

export function detectAnomalies(
  records: AnomalyRecord[],
  candidates: CandidateMap
): DetectedAnomaly[] {
  if (records.length === 0) return [];

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const startMillis = records[0].purchaseTime;
  const endMillis = records[records.length - 1].purchaseTime;

  const incidentTypes = ['PRODUCT_DEFECT', 'PACKAGING_DAMAGE', 'LATE_DELIVERY'] as const;
  const detectedAnomalies: DetectedAnomaly[] = [];

  for (let currentMillis = startMillis + 37 * ONE_DAY_MS; currentMillis <= endMillis; currentMillis += ONE_DAY_MS) {
    const currentDate = new Date(currentMillis);
    const currentWindowStart = new Date(currentMillis - 7 * ONE_DAY_MS);
    const historicWindowStart = new Date(currentMillis - 37 * ONE_DAY_MS);

    const cWindowReviews = records.filter(
      r => r.purchaseTime >= currentWindowStart.getTime() && r.purchaseTime < currentDate.getTime()
    );
    const hWindowReviews = records.filter(
      r => r.purchaseTime >= historicWindowStart.getTime() && r.purchaseTime < currentWindowStart.getTime()
    );

    if (cWindowReviews.length < 50 || hWindowReviews.length < 200) continue;

    for (const type of incidentTypes) {
      const cComplaints = cWindowReviews.filter(r => r.predicted_type === type).length;
      const hComplaints = hWindowReviews.filter(r => r.predicted_type === type).length;

      const r_c = cComplaints / (cWindowReviews.length || 1);
      const r_h = hComplaints / (hWindowReviews.length || 1);
      const spikeRatio = r_c / (r_h + 0.001);

      if (spikeRatio >= 2.0 && cComplaints >= 3) {
        let targetCandidates: string[] = [];
        if (type === 'PRODUCT_DEFECT') targetCandidates = candidates.factoryIds;
        else if (type === 'PACKAGING_DAMAGE') targetCandidates = candidates.warehouseIds;
        else targetCandidates = candidates.courierIds;

        const trainingData = targetCandidates.map(id =>
          buildEntityFeatures(records, type, id, currentWindowStart, currentDate, true)
        );
        const testData = targetCandidates.map(id =>
          buildEntityFeatures(records, type, id, currentWindowStart, currentDate, false)
        );
        const ifScores = scoreWithIsolationForest(trainingData, testData);

        const scored = targetCandidates.map((id, idx) => {
          const cEnt = cWindowReviews.filter(r =>
            type === 'PRODUCT_DEFECT' ? r.factory_id === id :
            type === 'PACKAGING_DAMAGE' ? r.warehouse_id === id : r.courier_id === id
          );
          const cEntComplaints = cEnt.filter(r => r.predicted_type === type).length;

          const hEnt = hWindowReviews.filter(r =>
            type === 'PRODUCT_DEFECT' ? r.factory_id === id :
            type === 'PACKAGING_DAMAGE' ? r.warehouse_id === id : r.courier_id === id
          );
          const hEntComplaints = hEnt.filter(r => r.predicted_type === type).length;

          const cRate = cEntComplaints / (cEnt.length || 1);
          const hRate = hEntComplaints / (hEnt.length || 1);

          const dr = cRate / (hRate + 0.001);
          const ics = cEntComplaints / (cComplaints || 1);
          const ifScore = ifScores[idx] || 0;
          const score = 0.6 * ifScore + 0.4 * (dr * ics);
          return { id, score, dr, ics };
        }).sort((a, b) => b.score - a.score);

        detectedAnomalies.push({
          date: currentDate,
          type,
          spikeRatio,
          currentWindowStart,
          scoredCandidates: scored
        });
      }
    }
  }

  return detectedAnomalies;
}
