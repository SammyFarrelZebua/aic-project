import { describe, it, expect } from 'vitest'
import { averageAnomalyActiveDays } from './metrics'
import type { RootCausePrediction } from '@/types/dashboard'

describe('averageAnomalyActiveDays', () => {
  it('returns null when anomaly list is empty', () => {
    expect(averageAnomalyActiveDays([])).toBeNull()
  })

  it('computes correct active days for a single anomaly', () => {
    const anomalies: RootCausePrediction[] = [
      {
        id: '1',
        incident_type: 'PRODUCT_DEFECT',
        detected_period_start: '2026-08-01T00:00:00Z',
        detected_period_end: '2026-08-08T00:00:00Z',
        candidate_type: 'factory',
        candidate_id: 'factory-1',
        confidence: 0.95,
        predicted_at: '2026-08-08T01:00:00Z'
      }
    ]

    const result = averageAnomalyActiveDays(anomalies)
    expect(result).toBe(7)
  })

  it('aggregates multiple spans for the same entity and incident type', () => {
    const anomalies: RootCausePrediction[] = [
      {
        id: '1',
        incident_type: 'PRODUCT_DEFECT',
        detected_period_start: '2026-08-01T00:00:00Z',
        detected_period_end: '2026-08-08T00:00:00Z',
        candidate_type: 'factory',
        candidate_id: 'factory-1',
        confidence: 0.95,
        predicted_at: '2026-08-08T01:00:00Z'
      },
      {
        id: '2',
        incident_type: 'PRODUCT_DEFECT',
        detected_period_start: '2026-08-05T00:00:00Z',
        detected_period_end: '2026-08-15T00:00:00Z',
        candidate_type: 'factory',
        candidate_id: 'factory-1',
        confidence: 0.92,
        predicted_at: '2026-08-15T01:00:00Z'
      }
    ]

    // Spans from 2026-08-01 to 2026-08-15 = 14 days
    const result = averageAnomalyActiveDays(anomalies)
    expect(result).toBe(14)
  })

  it('averages across distinct entities and incident types', () => {
    const anomalies: RootCausePrediction[] = [
      {
        id: '1',
        incident_type: 'PRODUCT_DEFECT',
        detected_period_start: '2026-08-01T00:00:00Z',
        detected_period_end: '2026-08-05T00:00:00Z',
        candidate_type: 'factory',
        candidate_id: 'factory-1',
        confidence: 0.9,
        predicted_at: '2026-08-05T01:00:00Z'
      },
      {
        id: '2',
        incident_type: 'PACKAGING_DAMAGE',
        detected_period_start: '2026-08-01T00:00:00Z',
        detected_period_end: '2026-08-11T00:00:00Z',
        candidate_type: 'warehouse',
        candidate_id: 'warehouse-1',
        confidence: 0.85,
        predicted_at: '2026-08-11T01:00:00Z'
      }
    ]

    // (4 days + 10 days) / 2 = 7 days
    const result = averageAnomalyActiveDays(anomalies)
    expect(result).toBe(7)
  })
})
