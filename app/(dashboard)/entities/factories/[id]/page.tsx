import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ChevronLeft, Package, Clock } from 'lucide-react'
import { translateIncidentType } from '@/lib/pipeline-messages'

export default async function FactoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const [factoryRes, anomaliesRes, batchesRes] = await Promise.all([
    supabase.from('factory').select('*').eq('factory_id', id).single(),
    supabase.from('root_cause_predictions').select('*').eq('candidate_type', 'factory').eq('candidate_id', id).order('predicted_at', { ascending: false }),
    supabase.from('batch').select('*').eq('factory_id', id).order('production_date', { ascending: false })
  ])

  const factory = factoryRes.data
  const anomalies = anomaliesRes.data || []
  const batches = batchesRes.data || []

  if (!factory) {
    return <div>Factory not found</div>
  }

  const hasAnomalies = anomalies.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-ink-muted mb-4">
        <Link href="/entities/factories" className="hover:text-ink flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Kembali ke Pabrik
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink flex items-center gap-3">
            {factory.factory_name}
            {hasAnomalies ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-alert-soft text-alert border border-alert/20">
                <AlertCircle className="w-3.5 h-3.5" /> Ada Anomali
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cleared-soft text-cleared border border-cleared/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Bersih
              </span>
            )}
          </h1>
          <p className="text-ink-muted text-sm mt-1">{factory.city}, {factory.province}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-paper-raised">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-ink flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-ink-muted" /> Riwayat Anomali
            </CardTitle>
          </CardHeader>
          <CardContent>
            {anomalies.length === 0 ? (
              <div className="text-ink-muted text-sm py-4 text-center border border-dashed border-line rounded-lg">
                Tidak ada anomali terdeteksi
              </div>
            ) : (
              <div className="space-y-4">
                {anomalies.map((anomaly) => (
                  <div key={anomaly.id} className="flex items-start justify-between p-3 rounded-lg bg-alert-soft/50 border border-alert/20">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {translateIncidentType(anomaly.incident_type)}
                      </p>
                      <p className="text-xs text-ink-muted mt-1 font-case uppercase tracking-wide">
                        Confidence: <span className="tabular-figures">{(anomaly.confidence * 100).toFixed(1)}%</span>
                      </p>
                      <Link
                        href={`/reviews?factory_id=${id}&type=${anomaly.incident_type}`}
                        className="text-xs text-alert hover:underline mt-2 inline-block font-medium"
                      >
                        Lihat ulasan terkait &rarr;
                      </Link>
                    </div>
                    <span className="text-xs text-ink-muted tabular-figures">
                      {new Date(anomaly.predicted_at).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-paper-raised">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-ink flex items-center gap-2">
              <Package className="w-5 h-5 text-ink-muted" /> Batch Produksi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {batches.length === 0 ? (
              <div className="text-ink-muted text-sm py-4 text-center border border-dashed border-line rounded-lg">
                Tidak ada data batch
              </div>
            ) : (
              <div className="space-y-3">
                {batches.slice(0, 5).map((batch) => (
                  <div key={batch.batch_id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                    <div>
                      <p className="text-sm font-medium text-ink tabular-figures font-case">{batch.batch_id}</p>
                      <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Shift {batch.shift}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-muted font-case uppercase">Produksi</p>
                      <p className="text-sm text-ink tabular-figures">
                        {new Date(batch.production_date).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))}
                {batches.length > 5 && (
                  <div className="text-center pt-2">
                    <span className="text-xs text-ink-muted font-medium cursor-pointer hover:text-ink">
                      Lihat semua {batches.length} batch
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
