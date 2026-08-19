// Types derived directly from app/api/pipeline/run/route.ts and
// app/api/analytics/dashboard/route.ts response shapes. Keep in sync if
// those routes change — do not hand-guess fields here.

// The pipeline's lifecycle as exposed to the UI. 'cancelling'/'cancelled' are
// client-driven: the server itself only ever reports 'running' up until it
// settles on 'cancelled' once the cooperative cancellation flag is noticed
// (see app/api/pipeline/state.ts + app/api/pipeline/run/route.ts).
export type PipelineStatus = "idle" | "running" | "cancelling" | "cancelled" | "done" | "error";

export type IncidentType = "PRODUCT_DEFECT" | "PACKAGING_DAMAGE" | "LATE_DELIVERY";
export type CandidateType = "factory" | "warehouse" | "courier";

export interface PipelineRunResult {
  processed_reviews: number;
  predicted_complaints: number;
  detected_anomalies: number;
  duration_ms: number;
  has_more?: boolean;
}

export interface PipelineRunResponse {
  success: boolean;
  data?: PipelineRunResult;
  error?: string;
}

export interface DashboardKpis {
  totalReviews: number | null;
  lowRatings: number | null;
  predictedComplaints: number | null;
  totalAnomalies: number | null;
  /** 0-100, percentage of detections matching injected ground truth (incidents table) */
  accuracy: number;
}

export interface TimeseriesPoint {
  date: string; // YYYY-MM-DD
  reviews: number;
  low_ratings: number;
  defects: number;
  damages: number;
  delays: number;
}

export interface RankingEntry {
  id: string;
  name: string;
  anomaly_count: number;
}

export interface Rankings {
  factories: RankingEntry[];
  warehouses: RankingEntry[];
  couriers: RankingEntry[];
}

export interface RootCausePrediction {
  id: string;
  incident_type: IncidentType;
  detected_period_start: string; // ISO timestamp
  detected_period_end: string; // ISO timestamp
  candidate_type: CandidateType;
  candidate_id: string;
  confidence: number;
  predicted_at: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  timeseries: TimeseriesPoint[];
  rankings: Rankings;
  anomalies: RootCausePrediction[];
}

export interface DashboardResponse {
  success: boolean;
  data?: DashboardData;
  error?: string;
}
