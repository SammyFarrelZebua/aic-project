"use client"

import React, { useMemo, useState } from "react"
import { Factory, Warehouse, Truck, ChevronDown } from "lucide-react"
import { cn } from "@/utils/cn"
import type { CandidateType, IncidentType, Rankings, RootCausePrediction } from "@/types/dashboard"

interface CandidateRankingProps {
  rankings: Rankings
  anomalies: RootCausePrediction[]
}

interface CandidateRow {
  id: string
  name: string
  type: CandidateType
  anomalyCount: number
  incidentType: IncidentType | null
  avgConfidence: number | null
  events: RootCausePrediction[]
}

const TYPE_META: Record<CandidateType, { label: string; icon: typeof Factory; tone: string }> = {
  factory: { label: "Pabrik", icon: Factory, tone: "alert" },
  warehouse: { label: "Gudang", icon: Warehouse, tone: "evidence" },
  courier: { label: "Kurir", icon: Truck, tone: "cleared" },
}

const INCIDENT_LABEL: Record<IncidentType, string> = {
  PRODUCT_DEFECT: "Cacat Produk",
  PACKAGING_DAMAGE: "Kemasan Rusak",
  LATE_DELIVERY: "Keterlambatan Kirim",
}

function toneClasses(tone: string) {
  switch (tone) {
    case "alert":
      return "border-alert/40 bg-alert-soft text-alert"
    case "evidence":
      return "border-evidence-glow/40 bg-evidence-glow/10 text-evidence-glow"
    default:
      return "border-cleared/40 bg-cleared-soft text-cleared"
  }
}

function buildRows(rankings: Rankings, anomalies: RootCausePrediction[]): CandidateRow[] {
  const groups: { type: CandidateType; entries: Rankings["factories"] }[] = [
    { type: "factory", entries: rankings.factories },
    { type: "warehouse", entries: rankings.warehouses },
    { type: "courier", entries: rankings.couriers },
  ]

  const rows: CandidateRow[] = []
  for (const group of groups) {
    for (const entry of group.entries) {
      const events = anomalies
        .filter((a) => a.candidate_type === group.type && a.candidate_id === entry.id)
        .sort((a, b) => a.detected_period_start.localeCompare(b.detected_period_start))
      const avgConfidence = events.length
        ? events.reduce((sum, e) => sum + e.confidence, 0) / events.length
        : null
      rows.push({
        id: entry.id,
        name: entry.name,
        type: group.type,
        anomalyCount: entry.anomaly_count,
        incidentType: events[0]?.incident_type ?? null,
        avgConfidence,
        events,
      })
    }
  }
  return rows.sort((a, b) => b.anomalyCount - a.anomalyCount)
}

export function CandidateRanking({ rankings, anomalies }: CandidateRankingProps) {
  const rows = useMemo(() => buildRows(rankings, anomalies), [rankings, anomalies])
  const [expanded, setExpanded] = useState<string | null>(null)
  const maxCount = Math.max(1, ...rows.map((r) => r.anomalyCount))

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">
        Belum ada kandidat tersangka. Jalankan pipeline untuk memulai investigasi.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-line">
      {rows.map((row, i) => {
        const meta = TYPE_META[row.type]
        const Icon = meta.icon
        const isTop = i === 0
        const isOpen = expanded === `${row.type}-${row.id}`
        const key = `${row.type}-${row.id}`
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : key)}
              aria-expanded={isOpen}
              className={cn(
                "flex w-full items-center gap-3 py-3 pl-3 pr-2 text-left transition-colors hover:bg-paper-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cleared",
                isTop && "border-l-2 border-alert"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                  toneClasses(meta.tone)
                )}
              >
                <Icon className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink" title={row.name}>
                    {row.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-case uppercase tracking-wide",
                      toneClasses(meta.tone)
                    )}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper">
                  <div
                    className="h-full rounded-full bg-ink-muted"
                    style={{ width: `${Math.max(6, (row.anomalyCount / maxCount) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-muted">
                  <span>{row.incidentType ? INCIDENT_LABEL[row.incidentType] : "—"}</span>
                  <span className="font-case">{row.anomalyCount}x terdeteksi</span>
                  {row.avgConfidence != null && (
                    <span className="font-case">
                      confidence {(row.avgConfidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-ink-muted transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>

            {isOpen && (
              <div className="border-t border-dashed border-line bg-paper-raised px-4 py-3">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-muted font-case">
                  Riwayat deteksi ({row.events.length})
                </p>
                <ul className="space-y-1.5">
                  {row.events.slice(-6).reverse().map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 text-xs text-ink-muted"
                    >
                      <span className="font-case">
                        {e.detected_period_start.slice(0, 10)} → {e.detected_period_end.slice(0, 10)}
                      </span>
                      <span className="font-case text-ink">{(e.confidence * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
                {row.events.length > 6 && (
                  <p className="mt-1.5 text-[11px] text-ink-muted">
                    +{row.events.length - 6} deteksi lainnya di luar rentang ini.
                  </p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
