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

export interface ScoredCandidate {
  id: string;
  score: number;
  dr: number;
  ics: number;
  entityType: 'factory' | 'warehouse' | 'courier';
}

export interface DetectedAnomaly {
  date: Date;
  type: 'PRODUCT_DEFECT' | 'PACKAGING_DAMAGE' | 'LATE_DELIVERY';
  spikeRatio: number;
  currentWindowStart: Date;
  scoredCandidates: ScoredCandidate[];
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

    // Lowered thresholds to detect anomalies in sparse, real-world review data.
    if (cWindowReviews.length < 30 || hWindowReviews.length < 50) continue;

    for (const type of incidentTypes) {
      const cComplaints = cWindowReviews.filter(r => r.predicted_type === type).length;
      const hComplaints = hWindowReviews.filter(r => r.predicted_type === type).length;

      const r_c = cComplaints / (cWindowReviews.length || 1);
      const r_h = hComplaints / (hWindowReviews.length || 1);
      const spikeRatio = r_c / (r_h + 0.001);

      if (spikeRatio >= 2.0 && cComplaints >= 3) {
        const allCandidates: { id: string; entityType: 'factory' | 'warehouse' | 'courier' }[] = [
          ...candidates.factoryIds.map(id => ({ id, entityType: 'factory' as const })),
          ...candidates.warehouseIds.map(id => ({ id, entityType: 'warehouse' as const })),
          ...candidates.courierIds.map(id => ({ id, entityType: 'courier' as const }))
        ];

        const trainingData = allCandidates.map(c =>
          buildEntityFeatures(records, type, c.entityType, c.id, currentWindowStart, currentDate, true)
        );
        const testData = allCandidates.map(c =>
          buildEntityFeatures(records, type, c.entityType, c.id, currentWindowStart, currentDate, false)
        );
        const ifScores = scoreWithIsolationForest(trainingData, testData);

        const scored: ScoredCandidate[] = allCandidates.map((c, idx) => {
          const id = c.id;
          const entityType = c.entityType;

          const cEnt = cWindowReviews.filter(r =>
            entityType === 'factory' ? r.factory_id === id :
            entityType === 'warehouse' ? r.warehouse_id === id : r.courier_id === id
          );
          const cEntComplaints = cEnt.filter(r => r.predicted_type === type).length;

          const hEnt = hWindowReviews.filter(r =>
            entityType === 'factory' ? r.factory_id === id :
            entityType === 'warehouse' ? r.warehouse_id === id : r.courier_id === id
          );
          const hEntComplaints = hEnt.filter(r => r.predicted_type === type).length;

          const cRate = cEntComplaints / (cEnt.length || 1);
          const hRate = hEntComplaints / (hEnt.length || 1);

          const dr = cRate / (hRate + 0.001);
          const ics = cEntComplaints / (cComplaints || 1);
          const ifScore = ifScores[idx] || 0;
          const score = 0.6 * ifScore + 0.4 * (dr * ics);
          return { id, score, dr, ics, entityType };
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
