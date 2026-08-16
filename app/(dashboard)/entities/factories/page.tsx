import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { cn } from '@/utils/cn'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export default async function FactoriesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const [factoriesRes, anomaliesRes] = await Promise.all([
    supabase.from('factory').select('*'),
    supabase.from('root_cause_predictions').select('candidate_id, predicted_at').eq('candidate_type', 'factory')
  ])

  const factories = factoriesRes.data || []
  const anomalies = anomaliesRes.data || []

  const factoryStats = factories.map(factory => {
    const factoryAnomalies = anomalies.filter(a => a.candidate_id === factory.factory_id)
    const sortedAnomalies = factoryAnomalies.sort((a, b) => new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime())
    return {
      ...factory,
      anomalyCount: factoryAnomalies.length,
      latestAnomaly: sortedAnomalies[0]?.predicted_at || null
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Pabrik</h1>
        <p className="text-ink-muted text-sm mt-1">Daftar pabrik dan status anomali</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {factoryStats.map((factory) => (
          <Link href={`/entities/factories/${factory.factory_id}`} key={factory.factory_id} className="block group">
            <Card className="h-full transition-colors hover:border-ink/50 bg-paper-raised">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-ink font-medium">{factory.factory_name}</CardTitle>
                  <p className="text-ink-muted text-sm">{factory.city}, {factory.province}</p>
                </div>
                {factory.anomalyCount > 0 ? (
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
                    <span className={cn("font-medium tabular-figures", factory.anomalyCount > 0 ? "text-alert" : "text-cleared")}>
                      {factory.anomalyCount}
                    </span>
                  </div>
                  {factory.latestAnomaly && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-ink-muted font-case uppercase tracking-wider text-xs">Anomali Terakhir</span>
                      <span className="text-ink tabular-figures">
                        {new Date(factory.latestAnomaly).toLocaleDateString('id-ID')}
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
