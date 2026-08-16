import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { AlertCircle, Calendar, ShieldAlert, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { translateIncidentType } from "@/lib/pipeline-messages"

interface EvidenceReview {
  review_id: string
  review_score: number
  review_comment_message: string | null
  review_creation_date: string
}

export default async function CaseDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: prediction, error } = await supabase
    .from("root_cause_predictions")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !prediction) {
    notFound()
  }

  // Fetch candidate name
  let candidateName = prediction.candidate_id
  if (prediction.candidate_type === "factory") {
    const { data } = await supabase.from("factory").select("factory_name").eq("factory_id", prediction.candidate_id).single()
    if (data) candidateName = data.factory_name
  } else if (prediction.candidate_type === "warehouse") {
    const { data } = await supabase.from("warehouse").select("warehouse_name").eq("warehouse_id", prediction.candidate_id).single()
    if (data) candidateName = data.warehouse_name
  } else if (prediction.candidate_type === "courier") {
    const { data } = await supabase.from("courier").select("courier_provider").eq("courier_id", prediction.candidate_id).single()
    if (data) candidateName = data.courier_provider
  }

  // Fetch specific entity-correlated reviews from analytics view as root-cause evidence
  let evidenceQuery = supabase
    .from("analytics_traceability_view")
    .select("review_id, review_score, review_comment_message, review_creation_date")
    .gte("review_creation_date", prediction.detected_period_start)
    .lte("review_creation_date", prediction.detected_period_end)

  if (prediction.candidate_type === "factory") {
    evidenceQuery = evidenceQuery.eq("factory_id", prediction.candidate_id)
  } else if (prediction.candidate_type === "warehouse") {
    evidenceQuery = evidenceQuery.eq("warehouse_id", prediction.candidate_id)
  } else if (prediction.candidate_type === "courier") {
    evidenceQuery = evidenceQuery.eq("courier_id", prediction.candidate_id)
  }

  const { data: evidenceData } = await evidenceQuery
    .order("review_creation_date", { ascending: false })
    .limit(10)

  const reviews: EvidenceReview[] = (evidenceData || []).map((r) => ({
    review_id: r.review_id,
    review_score: r.review_score,
    review_comment_message: r.review_comment_message,
    review_creation_date: r.review_creation_date
  }))

  return (
    <div className="space-y-6">
      <Link href="/cases" className="inline-flex items-center text-sm text-ink-muted hover:text-ink transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Kembali ke Daftar Kasus
      </Link>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="px-2 py-1 text-[10px] font-case rounded uppercase tracking-wider bg-alert-soft text-alert">
            {translateIncidentType(prediction.incident_type)}
          </span>
          <span className="text-sm font-case text-ink-muted">ID: {prediction.id.split("-")[0]}</span>
        </div>
        <h1 className="text-2xl font-semibold text-ink">Investigasi Root Cause</h1>
        <p className="text-sm text-ink-muted mt-1">Dossier analisis anomali otomatis oleh AI</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-paper border-line md:col-span-2">
          <CardHeader className="border-b border-line bg-paper-raised/50 pb-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-alert" />
              Tersangka Utama
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-ink-muted font-case uppercase mb-1">Entitas</div>
                  <div className="text-lg text-ink font-medium">{candidateName}</div>
                  <div className="text-xs text-ink-muted mt-1 uppercase font-case">{prediction.candidate_type}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-muted font-case uppercase mb-1">Confidence Score</div>
                  <div className="text-2xl text-alert font-medium tabular-figures">
                    {(prediction.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="bg-alert-soft/30 border border-alert/20 rounded p-4">
                <h4 className="text-sm font-medium text-ink flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-alert" />
                  Kesimpulan AI
                </h4>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Berdasarkan lonjakan komplain dengan tipe <span className="font-medium text-ink">{translateIncidentType(prediction.incident_type)}</span> yang terjadi pada periode tersebut, 
                  model analitik menetapkan probabilitas tinggi bahwa <span className="font-medium text-ink">{candidateName}</span> 
                  adalah sumber anomali. Tindakan inspeksi atau audit direkomendasikan.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-paper border-line">
          <CardHeader className="border-b border-line bg-paper-raised/50 pb-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Calendar className="w-5 h-5 text-ink-muted" />
              Timeline Kejadian
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-line ml-2">
              <div className="relative pl-6">
                <div className="absolute left-0 top-1.5 w-5 h-5 -ml-2.5 rounded-full bg-paper border-2 border-alert" />
                <div className="text-xs font-case text-ink-muted mb-1">
                  {new Date(prediction.detected_period_end).toLocaleDateString("id-ID")}
                </div>
                <div className="text-sm text-ink">Akhir Periode Anomali</div>
              </div>
              <div className="relative pl-6">
                <div className="absolute left-0 top-1.5 w-5 h-5 -ml-2.5 rounded-full bg-paper border-2 border-line" />
                <div className="text-xs font-case text-ink-muted mb-1">
                  {new Date(prediction.detected_period_start).toLocaleDateString("id-ID")}
                </div>
                <div className="text-sm text-ink">Awal Periode Anomali</div>
              </div>
              <div className="relative pl-6">
                <div className="absolute left-0 top-1.5 w-5 h-5 -ml-2.5 rounded-full bg-paper border-2 border-cleared" />
                <div className="text-xs font-case text-ink-muted mb-1">
                  {new Date(prediction.predicted_at).toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="text-sm text-ink">Deteksi AI Dilakukan</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-paper border-line">
        <CardHeader className="border-b border-line bg-paper-raised/50 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-lg font-medium">Bukti Ulasan Terkait Tersangka (Sample)</CardTitle>
            <Link
              href={`/reviews?${prediction.candidate_type}_id=${prediction.candidate_id}&type=${prediction.incident_type}`}
              className="text-xs bg-paper border border-line hover:bg-paper-raised text-ink px-3 py-1.5 rounded transition-all font-medium inline-flex items-center gap-1 self-start"
            >
              Lihat Semua Ulasan Kasus &rarr;
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-ink-muted uppercase bg-paper-raised border-b border-line font-case">
                <tr>
                  <th className="px-6 py-4 font-medium">Tanggal</th>
                  <th className="px-6 py-4 font-medium">Rating</th>
                  <th className="px-6 py-4 font-medium">Teks Review</th>
                </tr>
              </thead>
              <tbody>
                {reviews && reviews.length > 0 ? (
                  reviews.map((r) => (
                    <tr key={r.review_id} className="border-b border-line last:border-0 hover:bg-paper-raised/50 transition-colors">
                      <td className="px-6 py-4 tabular-figures text-ink-muted whitespace-nowrap">
                        {new Date(r.review_creation_date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-4 text-alert tabular-figures">
                        {"★".repeat(r.review_score)}{"☆".repeat(Math.max(0, 5 - r.review_score))}
                      </td>
                      <td className="px-6 py-4 text-ink">
                        {r.review_comment_message || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-ink-muted">
                      Tidak ada sampel ulasan yang dapat dimuat saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
