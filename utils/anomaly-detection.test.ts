import { describe, it, expect } from 'vitest';
import { detectAnomalies, AnomalyRecord, CandidateMap } from './anomaly-detection';

describe('detectAnomalies', () => {
  it('should return empty if records are empty', () => {
    expect(detectAnomalies([], { factoryIds: [], warehouseIds: [], courierIds: [] })).toEqual([]);
  });

  it('should detect an anomaly when there is a significant spike', () => {
    const records: AnomalyRecord[] = [];
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const baseTime = new Date('2026-08-01T00:00:00Z').getTime();

    // Historic window: 37 days before current day to 7 days before current day (30 days total)
    // We need 200 records in historic window
    for (let i = 0; i < 200; i++) {
      records.push({
        purchaseTime: baseTime + i * (ONE_DAY_MS / 10), // spread over 20 days
        predicted_type: i === 0 ? 'PRODUCT_DEFECT' : null, // 1 defect in historic
        factory_id: 'factory-1'
      });
    }

    // Current window: 7 days before current day to current day
    // We need 50 records in current window
    for (let i = 0; i < 50; i++) {
      records.push({
        purchaseTime: baseTime + 30 * ONE_DAY_MS + i * (ONE_DAY_MS / 10), // spread over 5 days
        predicted_type: i < 10 ? 'PRODUCT_DEFECT' : null, // 10 defects in current
        factory_id: 'factory-1'
      });
    }
    
    // Add one record at the end to set endMillis = baseTime + 37 days
    records.push({
      purchaseTime: baseTime + 37 * ONE_DAY_MS,
      predicted_type: null,
      factory_id: 'factory-1'
    });

    const candidateMap: CandidateMap = {
      factoryIds: ['factory-1', 'factory-2'],
      warehouseIds: ['wh-1'],
      courierIds: ['c-1']
    };

    const anomalies = detectAnomalies(records, candidateMap);
    
    expect(anomalies.length).toBeGreaterThan(0);
    const defectAnomaly = anomalies.find(a => a.type === 'PRODUCT_DEFECT');
    expect(defectAnomaly).toBeDefined();
    expect(defectAnomaly?.spikeRatio).toBeGreaterThan(2.0);
    
    const topCandidate = defectAnomaly?.scoredCandidates[0];
    expect(topCandidate?.id).toBe('factory-1');
  });
});
