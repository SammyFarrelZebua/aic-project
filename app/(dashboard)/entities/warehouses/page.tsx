import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import Link from 'next/link'
import { cn } from '@/utils/cn'
import { AlertCircle, CheckCircle2, Warehouse } from 'lucide-react'

export default async function WarehousesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const [warehousesRes, anomaliesRes] = await Promise.all([
    supabase.from('warehouse').select('*'),
    supabase.from('root_cause_predictions').select('candidate_id, predicted_at').eq('candidate_type', 'warehouse')
  ])

  const warehouses = warehousesRes.data || []
  const anomalies = anomaliesRes.data || []

  const warehouseStats = warehouses.map(warehouse => {
    const warehouseAnomalies = anomalies.filter(a => a.candidate_id === warehouse.warehouse_id)
    const sortedAnomalies = warehouseAnomalies.sort((a, b) => new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime())
    return {
      ...warehouse,
      anomalyCount: warehouseAnomalies.length,
      latestAnomaly: sortedAnomalies[0]?.predicted_at || null
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gudang"
        description="Daftar gudang dan status anomali"
        icon={Warehouse}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouseStats.map((warehouse) => (
          <Link href={`/entities/warehouses/${warehouse.warehouse_id}`} key={warehouse.warehouse_id} className="block group">
            <Card className="h-full transition-colors hover:border-ink/50 bg-paper-raised">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-ink font-medium">{warehouse.warehouse_name}</CardTitle>
                  <p className="text-ink-muted text-sm">{warehouse.city}, {warehouse.region}</p>
                </div>
                {warehouse.anomalyCount > 0 ? (
                  <div className="bg-alert-soft p-1.5 rounded-md flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-alert" />
                  </div>
                ) : (
                  <div className="bg-cleared-soft p-1.5 rounded-md flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-cleared" />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-ink-muted font-case uppercase tracking-wider text-xs">Total Anomali</span>
                    <span className={cn("font-medium tabular-figures", warehouse.anomalyCount > 0 ? "text-alert" : "text-cleared")}>
                      {warehouse.anomalyCount}
                    </span>
                  </div>
                  {warehouse.latestAnomaly && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-ink-muted font-case uppercase tracking-wider text-xs">Anomali Terakhir</span>
                      <span className="text-ink tabular-figures">
                        {new Date(warehouse.latestAnomaly).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
