import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ChevronLeft, ShoppingCart, Calendar, Warehouse } from 'lucide-react'
import { translateIncidentType } from '@/lib/pipeline-messages'

export default async function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const [warehouseRes, anomaliesRes, ordersRes] = await Promise.all([
    supabase.from('warehouse').select('*').eq('warehouse_id', id).single(),
    supabase.from('root_cause_predictions').select('*').eq('candidate_type', 'warehouse').eq('candidate_id', id).order('predicted_at', { ascending: false }),
    supabase.from('orders').select('*').eq('warehouse_id', id).order('order_date', { ascending: false }).limit(20)
  ])

  const warehouse = warehouseRes.data
  const anomalies = anomaliesRes.data || []
  const orders = ordersRes.data || []

  if (!warehouse) {
    return <div>Warehouse not found</div>
  }

  const hasAnomalies = anomalies.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-ink-muted mb-4">
        <Link href="/entities/warehouses" className="hover:text-ink flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Kembali ke Gudang
        </Link>
      </div>

      <PageHeader
        title={warehouse.warehouse_name}
        description={`${warehouse.city}, ${warehouse.region}`}
        icon={Warehouse}
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
                        href={`/reviews?warehouse_id=${id}&type=${anomaly.incident_type}`}
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
              <ShoppingCart className="w-5 h-5 text-ink-muted" /> Pesanan Terkini
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-ink-muted text-sm py-4 text-center border border-dashed border-line rounded-lg">
                Tidak ada data pesanan
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.order_id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                    <div>
                      <p className="text-sm font-medium text-ink tabular-figures font-case">{order.order_id}</p>
                      <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(order.order_date).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-muted font-case uppercase">Produk</p>
                      <p className="text-sm text-ink font-case">{order.product_id}</p>
                    </div>
                  </div>
                ))}
                {orders.length > 5 && (
                  <div className="text-center pt-2">
                    <span className="text-xs text-ink-muted font-medium cursor-pointer hover:text-ink">
                      Lihat semua pesanan
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
