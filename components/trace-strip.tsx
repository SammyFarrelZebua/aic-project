"use client"

import React, { useEffect, useState } from "react"
import { FileSearch, ScanSearch, Radar, Network, ShieldAlert, Loader2, X } from "lucide-react"
import { cn } from "@/utils/cn"
import type { PipelineStatus } from "@/types/dashboard"

// Alias kept so existing imports of `TraceStatus` from this module keep
// working -- the canonical union now lives in types/dashboard.ts alongside
// the rest of the pipeline's shared shapes.
export type TraceStatus = PipelineStatus

export interface TraceCounts {
  reviews: number
  classified: number
  anomalies: number
  traced: number
  alerts: number
}

interface TraceStripProps {
  status: TraceStatus
  counts: TraceCounts | null
  durationMs?: number | null
  errorMessage?: string | null
  /** Rendered as a small inline action inside the strip while status === "running". */
  onCancel?: () => void
}

const NODES = [
  { key: "reviews" as const, label: "Review Masuk", icon: FileSearch },
  { key: "classified" as const, label: "Diklasifikasi", icon: ScanSearch },
  { key: "anomalies" as const, label: "Anomali Terdeteksi", icon: Radar },
  { key: "traced" as const, label: "Ditelusuri", icon: Network },
  { key: "alerts" as const, label: "Alert Dikirim", icon: ShieldAlert },
]

// x position (%) and a slight y jitter (viewBox units) so the connecting
// line reads as an investigation-board string, not a corporate stepper.
const NODE_X = [6, 28, 50, 72, 94]
const LINE_Y = [55, 32, 60, 30, 55]
const REVEAL_STAGGER_MS = 220

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const listener = () => setReduced(mq.matches)
    mq.addEventListener("change", listener)
    return () => mq.removeEventListener("change", listener)
  }, [])
  return reduced
}

/**
 * The backend pipeline is one synchronous POST — it has no per-stage
 * progress to stream. So "running" shows an indeterminate in-flight state
 * (no fabricated intermediate numbers), and once the real result lands,
 * this reveals the five final counts in pipeline order rather than dumping
 * them all at once. Every setRevealed call below happens inside a timer
 * callback (an external-system tick), never synchronously in the effect
 * body, so restarting the sequence on a new run doesn't fight React's
 * "don't setState synchronously in an effect" guidance.
 */
function useStaggeredReveal(status: TraceStatus, reducedMotion: boolean) {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    if (status !== "done") return
    const step = reducedMotion ? 0 : REVEAL_STAGGER_MS
    const timers = [
      setTimeout(() => setRevealed(0), 0),
      ...NODES.map((_, i) => setTimeout(() => setRevealed(i + 1), 40 + step * i)),
    ]
    return () => timers.forEach(clearTimeout)
  }, [status, reducedMotion])

  return revealed
}

export function TraceStrip({ status, counts, durationMs, errorMessage, onCancel }: TraceStripProps) {
  const reducedMotion = usePrefersReducedMotion()
  const revealed = useStaggeredReveal(status, reducedMotion)

  const nodeState = (i: number): "pending" | "active" | "done" | "failed" => {
    if (status === "error") return i === 0 ? "failed" : "pending"
    if (status === "running" || status === "cancelling") return "active"
    if (status === "done") return i < revealed ? "done" : "pending"
    // idle and cancelled share the same "last known state" look: nodes light
    // up only if there's a previous result to show, otherwise stay pending.
    return counts ? "done" : "pending"
  }

  return (
    <div className="relative w-full overflow-x-auto rounded-lg border border-line bg-paper-raised px-4 pt-10 pb-6 sm:px-8">
      {status === "running" && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-md border border-alert/40 px-3 py-1.5 text-xs font-case text-alert transition-colors hover:bg-alert/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alert"
        >
          Cancel Pipeline
        </button>
      )}
      <div className="relative min-w-[560px] h-[92px]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {NODE_X.slice(0, -1).map((x, i) => {
            const x2 = NODE_X[i + 1]
            const y1 = LINE_Y[i]
            const y2 = LINE_Y[i + 1]
            const midX = (x * 10 + x2 * 10) / 2
            const midY = i % 2 === 0 ? Math.min(y1, y2) - 20 : Math.max(y1, y2) + 20
            const lit = status === "done" ? i < revealed : (status === "idle" || status === "cancelled") && !!counts
            return (
              <path
                key={i}
                d={`M ${x * 10},${y1} Q ${midX},${midY} ${x2 * 10},${y2}`}
                fill="none"
                stroke={lit ? "var(--cleared)" : "var(--line)"}
                strokeWidth={lit ? 2 : 1.5}
                strokeDasharray={lit ? undefined : "1 7"}
                strokeLinecap="round"
                className={cn(
                  "transition-[stroke] duration-500",
                  (status === "running" || status === "cancelling") && !reducedMotion && "trace-line-pulse"
                )}
              />
            )
          })}
        </svg>

        {NODES.map((node, i) => {
          const st = nodeState(i)
          const Icon = node.icon
          const pendingReveal = status === "done" && i >= revealed
          const value = status === "running" || status === "cancelling" ? null : counts ? counts[node.key] : null
          return (
            <div
              key={node.key}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-2"
              style={{ left: `${NODE_X[i]}%` }}
            >
              <span
                className="font-case tabular-figures text-xs text-ink-muted"
                aria-live={status === "done" ? "polite" : undefined}
              >
                {pendingReveal ? "···" : value === null ? "—" : value.toLocaleString("id-ID")}
              </span>
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors duration-300",
                  st === "pending" && "border-line bg-paper text-ink-muted",
                  st === "active" && "border-cleared bg-cleared-soft text-cleared",
                  st === "done" && "border-cleared bg-cleared text-paper",
                  st === "failed" && "border-alert bg-alert-soft text-alert"
                )}
              >
                {st === "active" ? (
                  <Loader2 className={cn("h-5 w-5", !reducedMotion && "animate-spin")} />
                ) : st === "failed" ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span className="w-24 text-center text-[11px] leading-tight text-ink-muted">
                {node.label}
              </span>
            </div>
          )
        })}
      </div>

      {status === "done" && durationMs != null && (
        <p className="mt-3 text-center text-xs text-ink-muted font-case">
          Selesai dalam {(durationMs / 1000).toFixed(1)}s
        </p>
      )}
      {status === "cancelled" && (
        <p className="mt-3 text-center text-xs text-ink-muted font-case">
          Pipeline dibatalkan.
        </p>
      )}
      {status === "error" && errorMessage && (
        <p className="mt-3 text-center text-xs text-alert">{errorMessage}</p>
      )}
    </div>
  )
}
