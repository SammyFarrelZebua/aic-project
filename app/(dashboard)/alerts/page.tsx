import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/utils/cn'
import { Bell, MapPin, Factory, Truck, PackageX, Clock, SearchX, AlertTriangle } from 'lucide-react'

export const metadata = { title: "Peringatan Anomali | Detektif Kemasan" }

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ page?: string, limit?: string }> }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const resolvedSearchParams = await searchParams;
  const page = resolvedSearchParams?.page ? parseInt(resolvedSearchParams.page as string, 10) : 1
  const limit = resolvedSearchParams?.limit ? parseInt(resolvedSearchParams.limit as string, 10) : 50
  const offset = (page - 1) * limit
  
  const { data: alertsData, count } = await supabase
    .from('root_cause_predictions')
    .select('*', { count: 'exact' })
    .order('predicted_at', { ascending: false })
    .range(offset, offset + limit - 1)
    
  const { data: factories } = await supabase.from('factory').select('*')
  const { data: warehouses } = await supabase.from('warehouse').select('*')
  const { data: couriers } = await supabase.from('courier').select('*')
  
  const alerts = alertsData?.map(alert => {
    let entityName = "Unknown"
    
    if (alert.candidate_type === 'factory') {
      entityName = factories?.find(f => f.factory_id === alert.candidate_id)?.factory_name || entityName
    } else if (alert.candidate_type === 'warehouse') {
      entityName = warehouses?.find(w => w.warehouse_id === alert.candidate_id)?.warehouse_name || entityName
    } else if (alert.candidate_type === 'courier') {
      entityName = couriers?.find(c => c.courier_id === alert.candidate_id)?.courier_provider || entityName
    }
    
    return { ...alert, entityName }
  }) || []

  const getIncidentStyles = (type: string) => {
    switch(type) {
      case 'PRODUCT_DEFECT': return 'text-alert bg-alert-soft border-alert/20'
      case 'PACKAGING_DAMAGE': return 'text-evidence-glow bg-evidence-glow/10 border-evidence-glow/20'
      case 'LATE_DELIVERY': return 'text-cleared bg-cleared-soft border-cleared/20'
      default: return 'text-ink-muted bg-paper-raised border-line'
    }
  }

  const getIncidentIcon = (type: string) => {
    switch(type) {
      case 'PRODUCT_DEFECT': return <AlertTriangle className="h-5 w-5" />
      case 'PACKAGING_DAMAGE': return <PackageX className="h-5 w-5" />
      case 'LATE_DELIVERY': return <Clock className="h-5 w-5" />
      default: return <SearchX className="h-5 w-5" />
    }
  }

  const getEntityIcon = (type: string) => {
    switch(type) {
      case 'factory': return <Factory className="h-4 w-4" />
      case 'warehouse': return <MapPin className="h-4 w-4" />
      case 'courier': return <Truck className="h-4 w-4" />
      default: return <Bell className="h-4 w-4" />
    }
  }

  const getIncidentName = (type: string) => {
    switch(type) {
      case 'PRODUCT_DEFECT': return 'Cacat Produk'
      case 'PACKAGING_DAMAGE': return 'Kerusakan Kemasan'
      case 'LATE_DELIVERY': return 'Keterlambatan'
      default: return type
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Peringatan</h1>
          <p className="text-ink-muted">Deteksi anomali rantai pasok dan prediksi akar masalah.</p>
        </div>
        <Bell className="h-8 w-8 text-ink-muted" />
      </div>
      
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <Card className="bg-paper border-line">
            <CardContent className="p-8 text-center text-ink-muted flex flex-col items-center">
              <Bell className="h-12 w-12 mb-4 opacity-20" />
              <p>Tidak ada peringatan terbaru.</p>
            </CardContent>
          </Card>
        ) : (
          alerts.map(alert => (
            <Link key={alert.id} href={`/cases/${alert.id}`} className="block">
              <Card className="bg-paper border-line overflow-hidden hover:border-ink/30 hover:shadow-sm transition-all duration-300 cursor-pointer">
                <div className="flex flex-col sm:flex-row">
                  <div className={cn(
                    "px-6 py-4 flex flex-col justify-center items-center sm:w-48 border-b sm:border-b-0 sm:border-r border-line",
                    getIncidentStyles(alert.incident_type)
                  )}>
                    {getIncidentIcon(alert.incident_type)}
                    <span className="font-case text-xs uppercase mt-2 font-bold text-center">
                      {getIncidentName(alert.incident_type)}
                    </span>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                          {getEntityIcon(alert.candidate_type)}
                          {alert.entityName}
                        </h3>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-ink tabular-figures">
                            {Math.round(alert.confidence * 100)}%
                          </div>
                          <div className="text-xs text-ink-muted font-case uppercase">Confidence</div>
                        </div>
                      </div>
                      <div className="text-sm text-ink-muted flex items-center gap-4">
                        <span>
                          <span className="font-case uppercase text-xs mr-2">Periode Deteksi:</span> 
                          {new Date(alert.detected_period_start).toLocaleDateString('id-ID')} - {new Date(alert.detected_period_end).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-line text-xs text-ink-muted flex justify-between">
                      <span className="font-case uppercase">Diprediksi pada:</span>
                      <span className="tabular-figures">{new Date(alert.predicted_at).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      {count && count > limit && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-ink-muted">
            Menampilkan {offset + 1} - {Math.min(offset + limit, count)} dari {count} peringatan
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={`/alerts?page=${page - 1}&limit=${limit}`} className="px-4 py-2 text-sm border border-line rounded hover:bg-paper-raised transition-colors">Previous</Link>
            ) : (
              <button disabled className="px-4 py-2 text-sm border border-line rounded opacity-50 cursor-not-allowed">Previous</button>
            )}
            
            {offset + limit < count ? (
              <Link href={`/alerts?page=${page + 1}&limit=${limit}`} className="px-4 py-2 text-sm border border-line rounded hover:bg-paper-raised transition-colors">Next</Link>
            ) : (
              <button disabled className="px-4 py-2 text-sm border border-line rounded opacity-50 cursor-not-allowed">Next</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
