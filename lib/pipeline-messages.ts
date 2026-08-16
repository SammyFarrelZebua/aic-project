/** Maps raw API error strings to short, non-technical Indonesian messages for the trace strip. */
export function friendlyPipelineError(raw: string): string {
  const msg = raw.toLowerCase()
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
