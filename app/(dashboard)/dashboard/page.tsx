"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Loader2, Play, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard } from "@/components/kpi-card"
import { TraceStrip, type TraceCounts, type TraceStatus } from "@/components/trace-strip"
import { ComplaintTrendChart } from "@/components/complaint-trend-chart"
import { CandidateRanking } from "@/components/candidate-ranking"
import { averageAnomalyActiveDays } from "@/lib/metrics"
import { friendlyPipelineError } from "@/lib/pipeline-messages"
import type { DashboardData, DashboardResponse } from "@/types/dashboard"
import { cn } from "@/utils/cn"

// Placeholder shown the instant a run starts (and while cancelling), instead
// of leaving the previous run's KPIs/charts/rankings on screen looking like
// live results. ComplaintTrendChart and CandidateRanking already render a
// clean "no data yet" message on empty arrays, so this needs no changes to
// either component -- only the KPI cards need "—" placeholder strings (done
// inline below) since KpiCard itself does no empty-state handling.
const EMPTY_DASHBOARD: DashboardData = {
  kpis: { totalReviews: null, lowRatings: null, predictedComplaints: null, totalAnomalies: null, accuracy: 0 },
  timeseries: [],
  rankings: { factories: [], warehouses: [], couriers: [] },
  anomalies: [],
}

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
    if (pipelineStatus === "running" || pipelineStatus === "cancelling") {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/pipeline/status");
          const json = await res.json();
          if (json.success && json.data) {
            setPipelineDuration(json.data.duration_ms);

            if (json.data.status === 'done') {
              setPipelineStatus("done");
              await fetchDashboard();
            } else if (json.data.status === 'cancelled') {
              // Server confirmed the cooperative cancellation flag was
              // noticed and the run stopped itself. Tables were cleared at
              // the start of the run and are only partially/never
              // repopulated (see PIPELINE_ARCHITECTURE.md / plan notes), so
              // there is nothing fresh to fetch -- the reset display already
              // reflects that.
              setPipelineStatus("cancelled");
              setPipelineError(null);
            } else if (json.data.status === 'error') {
              setPipelineStatus("error");
              setPipelineError(friendlyPipelineError(json.data.error || "Unknown error"));
            } else if (json.data.status === 'idle') {
              // The pipeline's progress lives in an in-memory, single-process
              // object (app/api/pipeline/state.ts) that resets to "idle" on
              // any server restart/reload. If we started polling because the
              // user clicked "Run Pipeline" but the server then bounced
              // before finishing, we'd otherwise poll forever waiting for a
              // "done"/"error" that will never arrive -- surface it instead.
              // (A deliberate cancel always settles on the server's
              // "cancelled" status above, never "idle", so this branch stays
              // specific to genuine restarts.)
              setPipelineStatus("error");
              setPipelineError(
                friendlyPipelineError(
                  "Server restarted while the pipeline was running. Please try again."
                )
              );
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

  const handleCancelPipeline = async () => {
    setPipelineStatus("cancelling")
    setPipelineError(null)
    try {
      const res = await fetch("/api/pipeline/cancel", { method: "POST" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Gagal membatalkan pipeline.")
      // the polling effect keeps running while status === "cancelling" and
      // picks up the server's "cancelled" status on the next poll.
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Gagal membatalkan pipeline."
      setPipelineError(friendlyPipelineError(raw))
      // Fall back to "running" rather than "error" -- the pipeline itself
      // is (as far as we know) still going, only the cancel request failed.
      setPipelineStatus("running")
    }
  }

  const isActive = pipelineStatus === "running" || pipelineStatus === "cancelling"

  // Derived, not a mutation of `data` -- while a run is in flight (or being
  // cancelled) the dashboard shows a clean reset state instead of the
  // previous run's numbers; `data` itself stays untouched so a later "done"
  // fetch, or falling back out of "cancelling", doesn't need any repair.
  const displayData = useMemo<DashboardData>(
    () => (isActive ? EMPTY_DASHBOARD : data ?? EMPTY_DASHBOARD),
    [isActive, data]
  )

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
    () => (displayData ? averageAnomalyActiveDays(displayData.anomalies) : null),
    [displayData]
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
      <div className="space-y-8">
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
            <div className="flex items-center gap-2">
              {pipelineStatus === "running" && (
                <button
                  onClick={handleCancelPipeline}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-alert/50 px-4 py-2.5 font-case text-sm text-alert transition-colors hover:bg-alert/10",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alert"
                  )}
                >
                  <X className="h-4 w-4" />
                  Cancel Pipeline
                </button>
              )}
              <button
                onClick={handleRunPipeline}
                disabled={isActive}
                className={cn(
                  "flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 font-case text-sm text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cleared"
                )}
              >
                {isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {pipelineStatus === "cancelling"
                  ? "Menghentikan Pipeline..."
                  : pipelineStatus === "running"
                    ? "Menjalankan Pipeline..."
                    : "Run Pipeline"}
              </button>
            </div>
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
            value={isActive ? "—" : `${displayData.kpis.accuracy.toFixed(0)}%`}
            sublabel="vs. insiden ground truth"
            emphasize
          />
          <KpiCard
            label="Insiden Terdeteksi"
            value={isActive ? "—" : (displayData.kpis.totalAnomalies ?? 0).toLocaleString("id-ID")}
          />
          <KpiCard
            label="Durasi Anomali Aktif"
            value={!isActive && avgActiveDays != null ? `${avgActiveDays.toFixed(1)} hari` : "—"}
            sublabel="rata-rata per kasus"
          />
          <KpiCard
            label="Review Diproses"
            value={isActive ? "—" : (displayData.kpis.totalReviews ?? 0).toLocaleString("id-ID")}
            sublabel={isActive ? undefined : `${(displayData.kpis.lowRatings ?? 0).toLocaleString("id-ID")} rating ≤ 2`}
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
              <ComplaintTrendChart timeseries={displayData.timeseries} anomalies={displayData.anomalies} />
            </CardContent>
          </Card>

          <Card className="border-line bg-paper-raised">
            <CardHeader>
              <CardTitle className="font-case text-sm uppercase tracking-wide text-ink-muted">
                Peringkat Tersangka
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <CandidateRanking rankings={displayData.rankings} anomalies={displayData.anomalies} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
