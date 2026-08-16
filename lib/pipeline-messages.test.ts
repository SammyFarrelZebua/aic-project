import { describe, it, expect } from 'vitest'
import { friendlyPipelineError, translateIncidentType } from './pipeline-messages'

describe('friendlyPipelineError', () => {
  it('handles network and connection errors', () => {
    expect(friendlyPipelineError('Failed to fetch resource')).toContain('Gagal terhubung ke server')
    expect(friendlyPipelineError('ECONNREFUSED 127.0.0.1')).toContain('Gagal terhubung ke server')
    expect(friendlyPipelineError('network error')).toContain('Gagal terhubung ke server')
  })

  it('handles classification and model errors', () => {
    expect(friendlyPipelineError('Error during classification execution')).toContain('Gagal menghubungi model')
    expect(friendlyPipelineError('pipeline(zero-shot-classification) failed')).toContain('Gagal menghubungi model')
    expect(friendlyPipelineError('model file missing')).toContain('Gagal menghubungi model')
  })

  it('handles timeout errors', () => {
    expect(friendlyPipelineError('Execution timed out after 30000ms')).toContain('Pipeline memakan waktu terlalu lama')
  })

  it('handles database errors', () => {
    expect(friendlyPipelineError('Supabase error: relation does not exist')).toContain('Gagal membaca atau menyimpan data')
    expect(friendlyPipelineError('Postgres row constraint violation')).toContain('Gagal membaca atau menyimpan data')
  })

  it('provides a general fallback for unknown errors', () => {
    expect(friendlyPipelineError('Something unexpected broke')).toBe('Pipeline gagal dijalankan. Coba lagi, atau periksa log server.')
  })
})

describe('translateIncidentType', () => {
  it('translates known incident types correctly', () => {
    expect(translateIncidentType('PRODUCT_DEFECT')).toBe('Cacat Produk')
    expect(translateIncidentType('PACKAGING_DAMAGE')).toBe('Kerusakan Kemasan')
    expect(translateIncidentType('LATE_DELIVERY')).toBe('Keterlambatan Kirim')
  })

  it('provides fallback for unknown incident types', () => {
    expect(translateIncidentType('UNKNOWN_INCIDENT')).toBe('UNKNOWN INCIDENT')
  })
})
