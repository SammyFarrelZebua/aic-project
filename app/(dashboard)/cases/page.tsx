"use client"

import { useState, useEffect } from "react"
import { Loader2, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/utils/cn"
import Link from "next/link"
import { translateIncidentType } from "@/lib/pipeline-messages"

interface CaseItem {
  id: string
  incident_type: string
  detected_period_start: string
  detected_period_end: string
  candidate_id: string
  candidate_type: string
  candidate_name?: string
  confidence: number
}

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50

  useEffect(() => {
    const fetchCases = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/cases?page=${page}&limit=${limit}`)
        const data = await res.json()
        setCases(data.data || [])
        setTotal(data.count || 0)
      } catch (err) {
        console.error("Failed to fetch cases", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCases()
  }, [page])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Kasus Anomali</h1>
        <p className="text-sm text-ink-muted mt-1">Insiden yang terdeteksi oleh AI Intelligence</p>
      </div>

      <Card className="bg-paper border-line">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-ink-muted uppercase bg-paper-raised border-b border-line font-case">
                <tr>
                  <th className="px-6 py-4 font-medium">ID Kasus</th>
                  <th className="px-6 py-4 font-medium">Tipe Insiden</th>
                  <th className="px-6 py-4 font-medium">Periode Deteksi</th>
                  <th className="px-6 py-4 font-medium">Tersangka</th>
                  <th className="px-6 py-4 font-medium text-right">Confidence</th>
                  <th className="px-6 py-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-ink-muted mx-auto" />
                    </td>
                  </tr>
                ) : cases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-ink-muted">
                      Tidak ada kasus yang ditemukan
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id} className="border-b border-line hover:bg-paper-raised/50 transition-colors group">
                      <td className="px-6 py-4 tabular-figures text-ink-muted font-case text-xs">
                        {c.id.split("-")[0]}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-[10px] font-case rounded uppercase tracking-wider bg-alert-soft text-alert">
                          {translateIncidentType(c.incident_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 tabular-figures text-ink text-xs">
                        {new Date(c.detected_period_start).toLocaleDateString("id-ID")} - {new Date(c.detected_period_end).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-4 text-ink">
                        <div className="flex flex-col">
                          <span>{c.candidate_name}</span>
                          <span className="text-[10px] text-ink-muted font-case uppercase tracking-wider">{c.candidate_type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right tabular-figures">
                        <span className={cn(
                          "px-2 py-1 text-[10px] rounded font-case",
                          c.confidence >= 0.8 ? "text-alert bg-alert-soft" : "text-ink-muted bg-paper-raised"
                        )}>
                          {(c.confidence * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/cases/${c.id}`} className="inline-flex items-center text-ink-muted hover:text-ink transition-colors">
                          <span className="text-xs mr-1 opacity-0 group-hover:opacity-100 transition-opacity">Detail</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-muted">
            Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, total)} dari {total} kasus
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-line rounded hover:bg-paper-raised disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm border border-line rounded hover:bg-paper-raised disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
