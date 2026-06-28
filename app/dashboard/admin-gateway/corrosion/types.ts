// ─── Corrosion Module Types ───────────────────────────────────────────────────

/** NACE SP0169 classification categories */
export type NaceClass = 'PROTECTED' | 'MARGINAL' | 'NOT_PROTECTED' | 'UNKNOWN';

/** SVY file analysis result */
export interface SvyAnalysis {
  status: 'svy_parsed' | 'svy_binary_detected' | 'svy_unknown';
  svy_mode: 'svy_text' | 'svy_binary' | 'svy_unknown';
  supported: boolean;
  filename: string;
  row_count: number;
  raw_headers: string[];
  sample_rows: Record<string, string>[];
  delimiter: string | null;
  coord_fields: Record<string, string>;
  gis_usable: boolean;
  gis_points: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: number[] };
    properties: Record<string, any>;
  }>;
  crs_guess: string | null;
  message_ar: string;
  recommended_next: string;
  total_rows: number;
  inserted_rows: number;
}

export interface SummaryData {
  total_records: number;
  assets_affected: number;
  critical_count: number;
  last_updated: string;
}

export interface UploadRecord {
  upload_id: string;
  filename: string;
  upload_timestamp: string;
  processing_status: 'success' | 'partial' | 'error';
  total_rows: number;
  inserted_rows: number;
  skipped_rows: number;
  failed_rows: number;
  pipeline_id?: string | null;
  survey_date?: string | null;
}

export interface UploadDetail extends UploadRecord {
  column_mapping?: Record<string, string>;
  sample_rows?: Record<string, any>[];
  error_messages?: string[];
  file_type?: string;
  engine_used?: string;
  detected_header_row?: number | null;
  sheets_processed?: string[];
  sheets_skipped?: string[];
}

export interface CpSession {
  session_id: string;
  pipeline_id?: string | null;
  file_name: string;
  survey_date?: string | null;
  gis_points?: Array<{
    chainage_m: number;
    on_mv: number;
    off_mv: number;
    gps_lat: number;
    gps_lon: number;
    is_off_below_850mv: boolean;
    protection_status: 'PROTECTED' | 'MARGINAL' | 'UNPROTECTED';
  }>;
  start_distance?: number | null;
  end_distance?: number | null;
  total_points: number;
  has_gps?: boolean;
  geo_source_session_id?: string | null;
  file_format?: string | null;
  cp_system_installed?: 'YES' | 'NO' | null;
  cp_installation_year?: number | null;
}

export interface CpPipeline {
  pipeline_id?: string | null;
  display_name: string;
  session_count: number;
  has_multi_survey: boolean;
  sessions: CpSession[];
}

export interface CpFixedSegment {
  seg_id: string;
  start_distance: number;
  end_distance: number;
  point_count: number;
  avg_potential: number | null;
  avg_shift: number | null;
  classification: NaceClass;
  severity_score: number;
  risk_explanation: string;
  /** Points breakdown */
  protected_pts?: number;
  marginal_pts?: number;
  not_protected_pts?: number;
  /** Real GPS geometry from backend */
  gps_start?: [number, number] | null;       // [lon, lat]
  gps_end?: [number, number] | null;         // [lon, lat]
  gps_centroid?: [number, number] | null;    // [lon, lat]
  gps_linestring?: [number, number][] | null; // [[lon,lat],...]
  /** GIS-ready output from backend */
  gis?: {
    start_distance: number;
    end_distance: number;
    risk_level: NaceClass;
    severity_score: number;
  };
}

export interface CpAnalysis {
  session: CpSession;
  overall_status: 'GOOD' | 'WARNING' | 'CRITICAL';
  manager_summary: string;
  recommendation: string;
  stats: {
    total_points: number;
    protected_count: number;
    marginal_count: number;
    not_protected_count: number;
    protected_pct: number;
    marginal_pct: number;
    not_protected_pct: number;
    critical_zones: number;
    max_negative_potential: number | null;
    avg_shift: number | null;
    worst_segment: { start: number; end: number; length: number } | null;
  };
  compliance_summary: {
    nace_standard: 'SP0169';
    compliant: boolean;
    protected_pct: number;
    marginal_pct: number;
    not_protected_pct: number;
    critical_zones: number;
    notes: string;
  };
  data_quality: {
    confidence_score: number;   // 0.0 – 1.0
    total_points: number;
    missing_potential: number;
    missing_shift: number;
    anomaly_count: number;
  };
  segment_size_used: number;
  is_svy_session?: boolean;
  on_off_count?: number;
  chart_data: { distance: number | null; natural_potential: number | null; as_found: number | null; shift_value: number | null; on_potential?: number | null; off_potential?: number | null }[];
  fixed_segments: CpFixedSegment[];
}

export interface CpCompareData {
  session_a: CpSession;
  session_b: CpSession;
  session_c?: CpSession | null;
  session_d?: CpSession | null;
  prediction_eligible: boolean;
  prediction_note: string;
  degradation_rate_mv_per_month: number | null;
  trend: 'improving' | 'stable' | 'degrading' | 'critical_degradation';
  overlap_segments?: number;
  no_overlap?: boolean;
  comparison: {
    start_distance: number;
    end_distance: number;
    session_a_avg_mv: number | null;
    session_b_avg_mv: number | null;
    session_c_avg_mv?: number | null;
    session_d_avg_mv?: number | null;
    delta_potential_mv: number | null;
    session_a_class: string;
    session_b_class: string;
    session_c_class?: string | null;
    session_d_class?: string | null;
    change: string;
  }[];
  protection_loss_zones: {
    start_distance: number;
    end_distance: number;
    prev_class: string;
    curr_class: string;
    delta_potential: number | null;
  }[];
  combined_chart: { distance: number; np_a: number | null; np_b: number | null; np_c?: number | null; np_d?: number | null }[];
}

/** NACE-compliant engineering report structure */
export interface CpEngineeringReport {
  report_id: string;
  generated_at: string;
  pipeline_id: string | null;
  session_ids: string[];
  nace_standard: 'SP0169';
  overall_status: 'GOOD' | 'WARNING' | 'CRITICAL';
  compliance: {
    compliant: boolean;
    protected_pct: number;
    marginal_pct: number;
    not_protected_pct: number;
    critical_zones: number;
    notes: string;
  };
  data_quality: {
    confidence_score: number;
    total_points: number;
    anomaly_count: number;
  };
  worst_segments: CpFixedSegment[];
  recommendation: string;
  manager_summary: string;
}

export type Tab = 'sessions' | 'analysis' | 'work-orders' | 'segments' | 'compare' | 'prediction' | 'timeline' | 'cips' | 'scenarios' | 'engineering' | 'report' | 'admin-reports' | 'pipeline-map' | 'annual_plan' | 'field_teams' | 'phases';

export interface PredictionTabProps {
  pipelines?: unknown;
  pipelinesLoading?: boolean;
  selectedPipeline?: string | null;
  onSelectPipeline?: (id: string | null) => void;
  viewMode?: 'specialist' | 'manager';
  onGoToSessions: () => void;
  onGoToWorkOrders?: () => void;
  onRefresh?: () => void;
  segmentSize?: number;
  onSegmentSizeChange?: (s: number) => void;
  compareSessionA?: string | null;
  compareSessionB?: string | null;
  onCompareSessionAChange?: (id: string | null) => void;
  onCompareSessionBChange?: (id: string | null) => void;
  compareData?: unknown;
  compareLoading?: boolean;
}

// ─── CP ML Prediction System Types ───────────────────────────────────────────

export interface CpPredictedSegment {
  seg_id: string;
  predicted_avg_mv: number;
  trend_mv_per_year: number;
  r_squared: number;
  confidence: number;
  predicted_class: NaceClass;
  sessions_used: number;
}

export interface CpPrediction {
  id: number;
  pipeline_id: string;
  predicted_for_date: string;
  trained_on_sessions: Array<{ session_id: string; survey_date: string; file_name: string }>;
  segments_predicted: CpPredictedSegment[];
  overall_trend_mv_per_year: number | null;
  prediction_note: string | null;
  created_at: string;
  sessions_used?: number;
  model_params?: { slope_weight: number; calibration_version: number };
}

export interface CpValidationResult {
  pipeline_id: string;
  session_id: string;
  survey_date: string;
  segments_compared: number;
  mae: number;
  rmse: number;
  accuracy_pct: number;
  cumulative_accuracy: number;
  calibration_version: number;
  new_slope_weight: number;
  segment_details: Array<{
    seg_id: string;
    predicted_mv: number;
    actual_mv: number;
    error_mv: number;
    predicted_class: string;
    actual_class: string;
    class_match: boolean;
  }>;
  suggestions: string[];
}

export interface CpModelMemory {
  pipeline_id: string;
  model_params: { slope_weight: number; recent_error_weight: number; calibration_version: number };
  cumulative_accuracy: number;
  error_history: Array<{ session_id: string; survey_date: string; mae: number; rmse: number; accuracy_pct: number }>;
  last_trained_at: string | null;
  last_validated_at: string | null;
}

export interface CpMlHistory {
  pipeline_id: string;
  sessions: Array<{ session_id: string; file_name: string; survey_date: string | null; total_points: number }>;
  predictions: Array<{ id: number; predicted_for_date: string; overall_trend_mv_per_year: number | null; prediction_note: string | null; created_at: string; segments_count: number }>;
  accuracy_trend: Array<{ survey_date: string; accuracy_pct: number; mae: number; rmse: number }>;
  model_memory: CpModelMemory | null;
  suggestions: string[];
}

// ─── Auto-Forecast Dashboard Types ───────────────────────────────────────────

export interface AutoForecastSession {
  session_id: string;
  file_name: string;
  survey_date: string | null;
  total_points: number;
  start_distance: number | null;
  end_distance: number | null;
}

export interface AutoForecastSummary {
  forecast_id: number;
  predicted_for_date: string;
  overall_trend_mv_per_year: number | null;
  segments_count: number;
  at_risk_segments: number;
  prediction_note: string | null;
  created_at: string;
  segments: CpPredictedSegment[];
}

export interface AutoForecastAccuracy {
  cumulative_accuracy: number;
  validations_count: number;
  last_validated_at: string | null;
  last_trained_at: string | null;
  calibration_version: number;
  recent_errors: Array<{ survey_date: string; mae: number; rmse: number; accuracy_pct: number }>;
}

export interface AutoForecastPipeline {
  pipeline_id: string;
  session_count: number;
  oldest_survey: string | null;
  latest_survey: string | null;
  total_points: number;
  start_distance: number | null;
  end_distance: number | null;
  sessions: AutoForecastSession[];
  forecast: AutoForecastSummary | null;
  accuracy: AutoForecastAccuracy | null;
  ready_for_forecast: boolean;
}
