"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Loader2, Play } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard } from "@/components/kpi-card"
import { TraceStrip, type TraceCounts, type TraceStatus } from "@/components/trace-strip"
import { ComplaintTrendChart } from "@/components/complaint-trend-chart"
import { CandidateRanking } from "@/components/candidate-ranking"
import { averageAnomalyActiveDays } from "@/lib/metrics"
import { friendlyPipelineError } from "@/lib/pipeline-messages"
import type { DashboardData, DashboardResponse } from "@/types/dashboard"
import { cn } from "@/utils/cn"

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [pipelineStatus, setPipelineStatus] = useState<TraceStatus>("idle")
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [pipelineDuration, setPipelineDuration] = useState<number | null>(null)

  const fetchDashboard = useCallback(() => {
    return fetch("/api/analytics/dashboard")
      .then((res) => res.json() as Promise<DashboardResponse>)
      .then((json) => {
        if (!json.success || !json.data) throw new Error(json.error || "Gagal memuat data dashboard.")
        setData(json.data)
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat data dashboard.")
      })
      .finally(() => {
        setLoadingInitial(false)
      })
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pipelineStatus === "running") {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/pipeline/status");
          const json = await res.json();
          if (json.success && json.data) {
            setPipelineDuration(json.data.duration_ms);
            
            if (json.data.status === 'done') {
              setPipelineStatus("done");
              await fetchDashboard();
            } else if (json.data.status === 'error') {
              setPipelineStatus("error");
              setPipelineError(friendlyPipelineError(json.data.error || "Unknown error"));
            }
          }
        } catch (e) {
          console.error("Failed to poll pipeline status", e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [pipelineStatus, fetchDashboard]);

  const handleRunPipeline = async () => {
    setPipelineStatus("running")
    setPipelineError(null)
    try {
      const res = await fetch("/api/pipeline/run", { method: "POST" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Pipeline gagal dijalankan.")
      // the useEffect will now take over polling
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Pipeline gagal dijalankan."
      setPipelineError(friendlyPipelineError(raw))
      setPipelineStatus("error")
    }
  }

  const counts: TraceCounts | null = useMemo(() => {
    if (!data) return null
    return {
      reviews: data.kpis.totalReviews ?? 0,
      classified: data.kpis.predictedComplaints ?? 0,
      anomalies: data.kpis.totalAnomalies ?? 0,
      traced: data.kpis.totalAnomalies ?? 0,
      alerts: data.kpis.totalAnomalies ?? 0,
    }
  }, [data])

  const avgActiveDays = useMemo(
    () => (data ? averageAnomalyActiveDays(data.anomalies) : null),
    [data]
  )

  if (loadingInitial && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
        Memuat dashboard investigasi...
      </div>
    )
  }

  if (loadError && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className="max-w-md rounded-lg border border-alert/40 bg-alert-soft p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-alert" />
          <p className="mb-4 text-sm text-ink">{loadError}</p>
          <button
            onClick={fetchDashboard}
            className="rounded-md border border-alert/50 px-4 py-2 text-sm font-case text-alert hover:bg-alert/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alert"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-paper text-ink">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <h1 className="mt-1 font-case text-2xl text-ink sm:text-3xl">Beranda</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Ringkasan investigasi dan kinerja rantai pasok.
            </p>
          </div>
        </header>

        {loadError && data && (
          <div className="flex items-center gap-2 rounded-md border border-alert/40 bg-alert-soft px-4 py-2.5 text-sm text-alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Gagal memperbarui data terbaru: {loadError}
          </div>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-case text-xs uppercase tracking-wide text-ink-muted">
              Jejak Pipeline
            </h2>
            <button
              onClick={handleRunPipeline}
              disabled={pipelineStatus === "running"}
              className={cn(
                "flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 font-case text-sm text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cleared"
              )}
            >
              {pipelineStatus === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {pipelineStatus === "running" ? "Menjalankan Pipeline..." : "Run Pipeline"}
            </button>
          </div>
          <TraceStrip
            status={pipelineStatus}
            counts={counts}
            durationMs={pipelineDuration}
            errorMessage={pipelineError}
          />
        </section>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Akurasi Deteksi (Top-1)"
            value={`${data!.kpis.accuracy.toFixed(0)}%`}
            sublabel="vs. insiden ground truth"
            emphasize
          />
          <KpiCard
            label="Insiden Terdeteksi"
            value={(data!.kpis.totalAnomalies ?? 0).toLocaleString("id-ID")}
          />
          <KpiCard
            label="Durasi Anomali Aktif"
            value={avgActiveDays != null ? `${avgActiveDays.toFixed(1)} hari` : "—"}
            sublabel="rata-rata per kasus"
          />
          <KpiCard
            label="Review Diproses"
            value={(data!.kpis.totalReviews ?? 0).toLocaleString("id-ID")}
            sublabel={`${(data!.kpis.lowRatings ?? 0).toLocaleString("id-ID")} rating ≤ 2`}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-line bg-paper-raised lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-case text-sm uppercase tracking-wide text-ink-muted">
                Tren Komplain Harian
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ComplaintTrendChart timeseries={data!.timeseries} anomalies={data!.anomalies} />
            </CardContent>
          </Card>

          <Card className="border-line bg-paper-raised">
            <CardHeader>
              <CardTitle className="font-case text-sm uppercase tracking-wide text-ink-muted">
                Peringkat Tersangka
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <CandidateRanking rankings={data!.rankings} anomalies={data!.anomalies} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
