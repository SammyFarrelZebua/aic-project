/**
 * Classifies a raw fetch failure (an Error message or thrown reason) into a
 * stable reason for the pipeline controls. Used by the dashboard to decide
 * whether a failed request is worth retrying automatically and what to tell
 * the user. A single source of truth, so the message wording and the retry
 * logic never drift apart.
 */
export type ConnectionFailure = 'timeout' | 'network' | 'other'

export function describeConnectionFailure(reason: unknown): ConnectionFailure {
  const raw = reason instanceof Error ? reason.message : String(reason ?? '')
  const msg = raw.toLowerCase()
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('time out') ||
    msg.includes('abort') ||
    msg.includes('slow down')
  ) {
    return 'timeout'
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('econn')) {
    return 'network'
  }
  return 'other'
}

/** Maps raw API error strings to short, non-technical Indonesian messages for the trace strip. */
export function friendlyPipelineError(raw: string): string {
  const msg = raw.toLowerCase()
  if (msg.includes("cancelled") || msg.includes("cancel requested") || msg.includes("dibatalkan")) {
    return "Pipeline dibatalkan."
  }
  if (describeConnectionFailure(raw) === 'timeout') {
    return "Timeout saat terhubung ke server. Coba lagi."
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("econn")) {
    return "Gagal terhubung ke server. Periksa koneksi dan coba lagi."
  }
  if (msg.includes("classif") || msg.includes("pipeline(") || msg.includes("model")) {
    return "Gagal menghubungi model klasifikasi. Coba jalankan ulang pipeline."
  }
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("time out") || msg.includes("abort")) {
    return "Pipeline memakan waktu terlalu lama dan berhenti. Coba lagi."
  }
  if (msg.includes("row") || msg.includes("supabase") || msg.includes("postgres") || msg.includes("relation")) {
    return "Gagal membaca atau menyimpan data di database."
  }
  return "Pipeline gagal dijalankan. Coba lagi, atau periksa log server."
}

export function translateIncidentType(type: string): string {
  switch (type) {
    case 'PRODUCT_DEFECT':
      return 'Cacat Produk';
    case 'PACKAGING_DAMAGE':
      return 'Kerusakan Kemasan';
    case 'LATE_DELIVERY':
      return 'Keterlambatan Kirim';
    default:
      return type.replace(/_/g, ' ');
  }
}
