import { createServiceClient } from "@/utils/supabase/service"
import type { IncidentType } from "@/types/dashboard"

export interface DossierCounts {
  reviews: number
  classified: number
  anomalies: number
  traced: number
  alerts: number
}

export interface DossierEvidence {
  tag: string
  quote: string
  entityName: string
  score: number
}

export interface DossierSummary {
  hasActivity: boolean
  counts: DossierCounts | null
  evidence: DossierEvidence | null
}

const INCIDENT_LABEL: Record<IncidentType, string> = {
  PRODUCT_DEFECT: "Cacat Produk",
  PACKAGING_DAMAGE: "Kemasan Rusak",
  LATE_DELIVERY: "Keterlambatan Kirim",
}

/**
 * Login-screen "pipeline snapshot" data. Reuses the same overall pipeline
 * totals shown on the dashboard's idle trace strip (not a literal
 * calendar-day filter) -- this is a historical demo dataset (2016-2018),
 * so "today" would always be empty and the panel would look broken on
 * every visit. hasActivity only goes false when there's truly no data
 * yet (fresh DB before the first ingest/pipeline run).
 */
export async function getDossierSummary(): Promise<DossierSummary> {
  const supabase = createServiceClient()

  const [{ count: reviews }, { count: classified }, { count: anomalies }] = await Promise.all([
    supabase.from("review").select("*", { count: "exact", head: true }),
    supabase.from("complaint_prediction").select("*", { count: "exact", head: true }).neq("complaint_type", "NORMAL"),
    supabase.from("root_cause_predictions").select("*", { count: "exact", head: true }),
  ])

  if (!reviews) {
    return { hasActivity: false, counts: null, evidence: null }
  }

  const counts: DossierCounts = {
    reviews: reviews ?? 0,
    classified: classified ?? 0,
    anomalies: anomalies ?? 0,
    traced: anomalies ?? 0,
    alerts: anomalies ?? 0,
  }

  const { data: topPrediction } = await supabase
    .from("complaint_prediction")
    .select("review_id, complaint_type, confidence")
    .order("confidence", { ascending: false })
    .limit(1)
    .maybeSingle()

  let evidence: DossierEvidence | null = null
  if (topPrediction) {
    const { data: record } = await supabase
      .from("analytics_traceability_view")
      .select("review_comment_message, factory_name, warehouse_name, courier_name")
      .eq("review_id", topPrediction.review_id)
      .limit(1)
      .maybeSingle()

    if (record?.review_comment_message) {
      const type = topPrediction.complaint_type as IncidentType
      const entityName =
        type === "PRODUCT_DEFECT"
          ? record.factory_name
          : type === "PACKAGING_DAMAGE"
            ? record.warehouse_name
            : record.courier_name

      evidence = {
        tag: INCIDENT_LABEL[type] ?? type,
        quote: record.review_comment_message,
        entityName: entityName ?? "Tidak diketahui",
        score: Number(topPrediction.confidence),
      }
    }
  }

  return { hasActivity: true, counts, evidence }
}
