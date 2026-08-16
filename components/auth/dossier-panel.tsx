import { cn } from "@/utils/cn"
import type { DossierSummary } from "@/lib/dossier-summary"

interface DossierPanelProps {
  summary: DossierSummary
}

const NODES = [
  { key: "reviews", label: "Review masuk", unit: "review diproses", isFinding: false },
  { key: "classified", label: "Diklasifikasi", unit: "terkategori otomatis", isFinding: false },
  { key: "anomalies", label: "Anomali terdeteksi", unit: "lonjakan tidak wajar", isFinding: true },
  { key: "traced", label: "Ditelusuri", unit: "kasus dilacak ke sumber", isFinding: true },
  { key: "alerts", label: "Alert dikirim", unit: "tim sudah diberi tahu", isFinding: true },
] as const

export function DossierPanel({ summary }: DossierPanelProps) {
  return (
    <div className="flex h-full flex-col bg-auth-dossier-bg px-10 py-12 min-[861px]:px-14 min-[861px]:py-14">
      <p className="mb-1.5 font-case text-[11px] font-medium uppercase tracking-[0.1em] text-auth-dossier-eyebrow">
        Alur investigasi aktif
      </p>
      <h2 className="mb-10 font-case text-[17px] font-medium text-auth-dossier-title">
        Ringkasan pipeline hari ini
      </h2>

      {!summary.hasActivity || !summary.counts ? (
        <p className="mb-11 font-case text-[13px] text-auth-dossier-stat">Belum ada aktivitas hari ini.</p>
      ) : (
        <ul className="mb-11 flex flex-col">
          {NODES.map((node, i) => {
            const value = summary.counts![node.key]
            const isAlert = node.isFinding && value > 0
            const isLast = i === NODES.length - 1
            return (
              <li key={node.key} className={cn("flex gap-4", !isLast && "pb-[26px]")}>
                <div className="flex w-5 shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      "mt-1 h-[9px] w-[9px] shrink-0 rounded-full",
                      isAlert ? "bg-auth-alert" : "bg-auth-cleared"
                    )}
                  />
                  {!isLast && <span className="mt-1 w-px flex-1 bg-auth-dossier-line" />}
                </div>
                <div>
                  <p className="mb-0.5 font-case text-[13px] font-medium text-auth-dossier-title">
                    {node.label}
                  </p>
                  <p
                    className={cn(
                      "font-case text-xs",
                      isAlert ? "text-auth-dossier-stat-alert" : "text-auth-dossier-stat"
                    )}
                  >
                    {value.toLocaleString("id-ID")} {node.unit}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {summary.evidence && (
        <div className="mt-auto rounded-[3px] border border-auth-evidence-border bg-auth-evidence-bg px-5 py-[18px]">
          <span className="mb-3 inline-block rounded-sm bg-auth-alert/[0.16] px-2 py-1 font-case text-[10.5px] font-semibold uppercase tracking-[0.05em] text-auth-alert">
            {summary.evidence.tag}
          </span>
          <p className="mb-3 text-[13.5px] italic leading-[1.6] text-auth-evidence-quote">
            &ldquo;{summary.evidence.quote}&rdquo;
          </p>
          <div className="flex justify-between border-t border-auth-evidence-border pt-2.5 font-case text-[11px] text-auth-evidence-meta">
            <span>{summary.evidence.entityName}</span>
            <span>Skor {summary.evidence.score.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
