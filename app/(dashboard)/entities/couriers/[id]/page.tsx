import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import Link from 'next/link'
import { cn } from '@/utils/cn'
import { AlertCircle, CheckCircle2, ChevronLeft, Truck, Clock } from 'lucide-react'
import { translateIncidentType } from '@/lib/pipeline-messages'

export default async function CourierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const [courierRes, anomaliesRes, shipmentsRes] = await Promise.all([
    supabase.from('courier').select('*').eq('courier_id', id).single(),
    supabase.from('root_cause_predictions').select('*').eq('candidate_type', 'courier').eq('candidate_id', id).order('predicted_at', { ascending: false }),
    supabase.from('shipment').select('*').eq('courier_id', id).order('ship_date', { ascending: false }).limit(20)
  ])

  const courier = courierRes.data
  const anomalies = anomaliesRes.data || []
  const shipments = shipmentsRes.data || []

  if (!courier) {
    return <div>Courier not found</div>
  }

  const hasAnomalies = anomalies.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-ink-muted mb-4">
        <Link href="/entities/couriers" className="hover:text-ink flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Kembali ke Kurir
        </Link>
      </div>

      <PageHeader
        title={courier.courier_provider}
        description={courier.courier_id}
        icon={Truck}
      >
        {hasAnomalies ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-alert-soft text-alert border border-alert/20">
            <AlertCircle className="w-3.5 h-3.5" /> Ada Anomali
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-cleared-soft text-cleared border border-cleared/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Bersih
          </span>
        )}
      </PageHeader>

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
                        href={`/reviews?courier_id=${id}&type=${anomaly.incident_type}`}
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
              <Truck className="w-5 h-5 text-ink-muted" /> Pengiriman Terkini
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shipments.length === 0 ? (
              <div className="text-ink-muted text-sm py-4 text-center border border-dashed border-line rounded-lg">
                Tidak ada data pengiriman
              </div>
            ) : (
              <div className="space-y-3">
                {shipments.slice(0, 5).map((shipment) => (
                  <div key={shipment.shipment_id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                    <div>
                      <p className="text-sm font-medium text-ink tabular-figures font-case">{shipment.shipment_id}</p>
                      <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Dikirim: {new Date(shipment.ship_date).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        shipment.delivery_status === 'DELIVERED' ? 'bg-cleared-soft text-cleared' : 
                        shipment.delivery_status === 'LATE' ? 'bg-alert-soft text-alert' : 
                        'bg-line text-ink-muted'
                      )}>
                        {shipment.delivery_status}
                      </span>
                    </div>
                  </div>
                ))}
                {shipments.length > 5 && (
                  <div className="text-center pt-2">
                    <span className="text-xs text-ink-muted font-medium cursor-pointer hover:text-ink">
                      Lihat semua pengiriman
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
