import type { RootCausePrediction } from "@/types/dashboard"

/**
 * The dashboard API doesn't expose ground-truth incident onset dates in its
 * response (only used server-side for the accuracy %), so a true
 * "days from incident start to alert" lag can't be computed on the client.
 * As an honest stand-in, this averages how many days each (candidate,
 * incident type) kept getting re-flagged — i.e. how long the anomaly stayed
 * active in the sliding window once first detected.
 */
export function averageAnomalyActiveDays(anomalies: RootCausePrediction[]): number | null {
  const groups = new Map<string, { min: number; max: number }>()

  for (const a of anomalies) {
    const key = `${a.candidate_type}_${a.candidate_id}_${a.incident_type}`
    const start = new Date(a.detected_period_start).getTime()
    const end = new Date(a.detected_period_end).getTime()
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { min: start, max: end })
    } else {
      existing.min = Math.min(existing.min, start)
      existing.max = Math.max(existing.max, end)
    }
  }

  if (groups.size === 0) return null

  const ONE_DAY_MS = 24 * 60 * 60 * 1000
  const days = Array.from(groups.values()).map((g) => (g.max - g.min) / ONE_DAY_MS)
  return days.reduce((a, b) => a + b, 0) / days.length
}
