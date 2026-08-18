import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { getDossierSummary } from './dossier-summary'
import { createServiceClient } from '@/utils/supabase/service'

vi.mock('@/utils/supabase/service', () => {
  const mockSupabase = {
    from: vi.fn()
  }
  return {
    createServiceClient: () => mockSupabase
  }
})

describe('getDossierSummary', () => {
  const mockSupabase = createServiceClient() as unknown as { from: Mock }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns hasActivity: false when there are no reviews', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      return {
        select: vi.fn().mockImplementation(() => ({
          neq: vi.fn().mockResolvedValue({ count: table === 'review' ? null : 0 })
        }))
      }
    })

    const summary = await getDossierSummary()
    expect(summary.hasActivity).toBe(false)
    expect(summary.counts).toBeNull()
    expect(summary.evidence).toBeNull()
  })

  it('returns hasActivity: true with counts and evidence when reviews exist', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'review') {
        return { select: vi.fn().mockResolvedValue({ count: 150 }) }
      }
      if (table === 'complaint_prediction') {
        const mockSelect = vi.fn().mockImplementation((proj) => {
          if (proj === 'review_id, complaint_type, confidence') {
            return {
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  review_id: 'rev-1',
                  complaint_type: 'PRODUCT_DEFECT',
                  confidence: 0.89
                }
              })
            }
          }
          // The `select("*", { count: "exact", head: true })` count call is
          // chained with `.neq("complaint_type", "NORMAL")` in getDossierSummary.
          return {
            neq: vi.fn().mockReturnValue({ count: 120 })
          }
        })
        return { select: mockSelect }
      }
      if (table === 'root_cause_predictions') {
        return { select: vi.fn().mockResolvedValue({ count: 5 }) }
      }
      if (table === 'analytics_traceability_view') {
        return {
          select: vi.fn().mockImplementation(() => {
            return {
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  review_comment_message: 'Barang rusak',
                  factory_name: 'Factory C',
                  warehouse_name: 'Warehouse South',
                  courier_name: 'Courier Fast'
                }
              })
            }
          })
        }
      }
      return {
        select: vi.fn().mockImplementation(() => ({
          neq: vi.fn().mockResolvedValue({ count: 0 })
        }))
      }
    })

    const summary = await getDossierSummary()
    expect(summary.hasActivity).toBe(true)
    expect(summary.counts).toEqual({
      reviews: 150,
      classified: 120,
      anomalies: 5,
      traced: 5,
      alerts: 5
    })
    expect(summary.evidence).toEqual({
      tag: 'Cacat Produk',
      quote: 'Barang rusak',
      entityName: 'Factory C',
      score: 0.89
    })
  })
})
