"use client"

import React, { useMemo } from "react"
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts"
import type { RootCausePrediction, TimeseriesPoint } from "@/types/dashboard"

interface ComplaintTrendChartProps {
  timeseries: TimeseriesPoint[]
  anomalies: RootCausePrediction[]
}

interface ChartRow extends TimeseriesPoint {
  total: number
  baseline: number | null
}

const BASELINE_WINDOW = 30

function buildRows(timeseries: TimeseriesPoint[]): ChartRow[] {
  const totals = timeseries.map((d) => d.defects + d.damages + d.delays)
  return timeseries.map((d, i) => {
    const windowStart = Math.max(0, i - BASELINE_WINDOW + 1)
    const slice = totals.slice(windowStart, i + 1)
    const baseline = i >= 6 ? slice.reduce((a, b) => a + b, 0) / slice.length : null
    return { ...d, total: totals[i], baseline }
  })
}

// Merge overlapping/adjacent anomaly detection windows into bands, so a
// 15-day incident (re-flagged daily) renders as one shaded band, not 15.
function mergeAnomalyBands(anomalies: RootCausePrediction[]) {
  const intervals = anomalies
    .map((a) => ({
      start: a.detected_period_start.slice(0, 10),
      end: a.detected_period_end.slice(0, 10),
    }))
    .sort((a, b) => a.start.localeCompare(b.start))

  const merged: { start: string; end: string }[] = []
  for (const cur of intervals) {
    const last = merged[merged.length - 1]
    if (last && cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end
    } else {
      merged.push({ ...cur })
    }
  }
  return merged
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-md border border-line bg-paper px-3 py-2 text-xs shadow-lg">
      <p className="font-case mb-1 text-ink">{label}</p>
      <p className="text-ink-muted">
        Review masuk: <span className="font-case text-ink">{row.reviews}</span>
      </p>
      <p className="text-ink-muted">
        Total komplain: <span className="font-case text-ink">{row.total}</span>
      </p>
      <p className="text-ink-muted">
        Defect / Kemasan / Telat:{" "}
        <span className="font-case text-ink">
          {row.defects}/{row.damages}/{row.delays}
        </span>
      </p>
    </div>
  )
}

export function ComplaintTrendChart({ timeseries, anomalies }: ComplaintTrendChartProps) {
  const rows = useMemo(() => buildRows(timeseries), [timeseries])
  const bands = useMemo(() => mergeAnomalyBands(anomalies), [anomalies])

  if (rows.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-ink-muted">
        Belum ada data. Jalankan pipeline untuk mengisi tren komplain.
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--ink-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis stroke="var(--ink-muted)" fontSize={11} tickLine={false} axisLine={false} width={28} />
          <Tooltip content={<CustomTooltip />} />
          {bands.map((band, i) => (
            <ReferenceArea
              key={i}
              x1={band.start}
              x2={band.end}
              fill="var(--alert)"
              fillOpacity={0.12}
              stroke="var(--alert)"
              strokeOpacity={0.25}
            />
          ))}
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--ink)"
            strokeWidth={1.75}
            fill="var(--ink)"
            fillOpacity={0.06}
            dot={false}
            name="Total komplain"
          />
          <Line
            type="monotone"
            dataKey="baseline"
            stroke="var(--ink-muted)"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            dot={false}
            name="Baseline (rata-rata 30 hari)"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-ink-muted">
        Area amber menandai periode yang ditandai anomali oleh pipeline · garis putus-putus
        adalah rata-rata bergerak 30 hari sebagai referensi baseline.
      </p>
    </div>
  )
}
