import { describe, it, expect } from 'vitest'
import { describeConnectionFailure, friendlyPipelineError, translateIncidentType } from './pipeline-messages'

describe('describeConnectionFailure', () => {
  it('classifies timeout/abort errors', () => {
    expect(describeConnectionFailure('The operation was aborted due to timeout')).toBe('timeout')
    expect(describeConnectionFailure(new Error('Request timed out'))).toBe('timeout')
    expect(describeConnectionFailure('signal timed out')).toBe('timeout')
    expect(describeConnectionFailure('abort')).toBe('timeout')
  })

  it('classifies network/connection errors', () => {
    expect(describeConnectionFailure('Failed to fetch')).toBe('network')
    expect(describeConnectionFailure('network error')).toBe('network')
    expect(describeConnectionFailure('ECONNREFUSED 127.0.0.1')).toBe('network')
    // Generic WebKit/Safari "Load failed" is not one of our network signals.
    expect(describeConnectionFailure('Load failed')).toBe('other')
  })

  it('treats everything else as other', () => {
    expect(describeConnectionFailure('Something unexpected')).toBe('other')
    expect(describeConnectionFailure(null)).toBe('other')
    expect(describeConnectionFailure(undefined)).toBe('other')
    expect(describeConnectionFailure('')).toBe('other')
  })
})

describe('friendlyPipelineError', () => {
  it('handles network and connection errors', () => {
    expect(friendlyPipelineError('Failed to fetch resource')).toContain('Gagal terhubung ke server')
    expect(friendlyPipelineError('ECONNREFUSED 127.0.0.1')).toContain('Gagal terhubung ke server')
    expect(friendlyPipelineError('network error')).toContain('Gagal terhubung ke server')
  })

  it('maps genuine timeouts to the timeout message', () => {
    expect(friendlyPipelineError('Execution timed out after 30000ms')).toContain('Timeout saat terhubung')
    expect(friendlyPipelineError('The operation was aborted due to timeout')).toContain('Timeout saat terhubung')
  })

  it('handles classification and model errors', () => {
    expect(friendlyPipelineError('Error during classification execution')).toContain('Gagal menghubungi model')
    expect(friendlyPipelineError('pipeline(zero-shot-classification) failed')).toContain('Gagal menghubungi model')
    expect(friendlyPipelineError('model file missing')).toContain('Gagal menghubungi model')
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
