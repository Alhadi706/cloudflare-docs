/**
 * contextBrokerTypes.ts
 * =====================
 * Type contracts for Spatiotemporal Context Broker — Phase S9
 *
 * These types define the structured interface between:
 *   - Frontend SIC panels
 *   - Context Broker backend (/api/v1/context-broker)
 *   - Future: Digital Assistant / Sovereign Brain
 *
 * source_type labeling discipline (NON-NEGOTIABLE):
 *   observed      — measured directly from verified source data
 *   estimated     — model/rule-based approximation, not surveyed
 *   interpreted   — derived from spectral signal (proxy)
 *   inferred      — derived from rule logic + observed data
 *   recommended   — actionable output based on rules + indicators
 *   unavailable   — data not in the system; must never be omitted silently
 */

// ─── Source classification ─────────────────────────────────────────────────────

export type SourceType =
  | "observed"
  | "estimated"
  | "interpreted"
  | "inferred"
  | "recommended"
  | "unavailable";

export type TemporalMatchClass =
  | "exact"
  | "near"
  | "approximate"
  | "historical"
  | "none";

export type DetailLevel = "executive" | "technical" | "human";

export type RequestType =
  | "get_area_context"
  | "get_corridor_context"
  | "get_project_context"
  | "get_scene_context";

// ─── Request body ──────────────────────────────────────────────────────────────

export interface ContextRequest {
  request_type:    RequestType;
  /** GeoJSON Polygon coordinates or raw [[lon,lat],...] ring */
  geometry?:       GeoJSONPolygon | number[][] | null;
  scene_uid?:      string | null;
  project_id?:     number | null;
  date_from?:      string | null;  // YYYY-MM-DD
  date_to?:        string | null;  // YYYY-MM-DD
  /** null = request all available groups */
  context_groups?: ContextGroupId[] | null;
  detail_level?:   DetailLevel;
}

export type ContextGroupId =
  | "vegetation"
  | "water"
  | "built_environment"
  | "thermal"
  | "inferred_needs";

export interface GeoJSONPolygon {
  type:        "Polygon";
  coordinates: number[][][];
}

// ─── Metric item ───────────────────────────────────────────────────────────────

export interface ContextMetric {
  id:           string;
  label:        string;
  value:        string | number | null;
  unit?:        string | null;
  source_type:  SourceType;
  note?:        string | null;
  /** Only on inferred items — explains the rule that triggered this */
  trigger_rule?: string;
}

// ─── Context groups ────────────────────────────────────────────────────────────

export interface ContextGroup {
  group_id:    ContextGroupId | string;
  group_title: string;
  items:       ContextMetric[];
}

// ─── Geometry summary ──────────────────────────────────────────────────────────

export interface GeometrySummary {
  area_m2:          number;
  area_km2:         number;
  area_formatted:   string;
  perimeter_km:     number;
  bbox:             [number, number, number, number];
  centroid:         [number, number];
  vertex_count:     number;
  compactness_index: number;
  shape_label:      string;
  source_type:      "observed";
  note:             string;
}

// ─── Temporal context ──────────────────────────────────────────────────────────

export interface TemporalContext {
  scene_uid:            string | null;
  scene_date:           string | null;
  requested_date_from:  string | null;
  requested_date_to:    string | null;
  temporal_gap_days:    number | null;
  match_class:          TemporalMatchClass;
  match_class_ar:       string;
  data_is_real:         boolean | null;
  source_type:          "observed";
  note:                 string;
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export type RecommendationSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface Recommendation {
  id:           string;
  severity:     RecommendationSeverity;
  title:        string;
  explanation:  string;
  department:   string;
  trigger_rule: string;
  source_type:  "recommended";
}

// ─── Confidence and limitations ────────────────────────────────────────────────

export interface ConfidenceAndLimitations {
  overall_confidence:   "high" | "medium" | "low" | "none";
  data_type:            string;
  cloud_coverage_pct?:  number | null;
  scene_quality:        string;
  aoi_limitation?:      string | null;
  limitations:          string[];
}

// ─── Inferred needs group ──────────────────────────────────────────────────────

export interface InferredNeedsGroup extends ContextGroup {
  group_id: "inferred_needs";
}

// ─── Brain-ready contract ──────────────────────────────────────────────────────

export interface BrainReadyContract {
  contract_version:        string;
  request_id:              string;
  request_type:            RequestType;
  generated_at:            string;  // ISO 8601
  geometry_summary:        GeometrySummary | null;
  temporal_context:        TemporalContext;
  context_groups:          Record<string, ContextGroup>;
  inferred_needs:          ContextGroup;
  recommendations:         Recommendation[];
  confidence_and_limitations: ConfidenceAndLimitations;
  source_type_legend:      Record<SourceType, string>;
  brain_integration_notes: string[];
}

// ─── Full context response ─────────────────────────────────────────────────────

export interface ContextResponse {
  request_id:               string;
  status:                   "ok" | "error";
  request_type:             RequestType;
  detail_level:             DetailLevel;
  geometry_summary:         GeometrySummary | null;
  temporal_context:         TemporalContext;
  context_groups:           Record<string, ContextGroup>;
  inferred_needs:           ContextGroup;
  recommendations:          Recommendation[];
  confidence_and_limitations: ConfidenceAndLimitations;
  brain_ready:              BrainReadyContract;
}

// ─── Available groups (from /available-groups endpoint) ───────────────────────

export interface AvailableGroupInfo {
  id:           ContextGroupId;
  title:        string;
  indicators:   string[];
  description:  string;
  availability: string;
}

export interface AvailableGroupsResponse {
  status: string;
  groups: AvailableGroupInfo[];
}

// ─── Contract schema (from /contract endpoint) ────────────────────────────────

export interface BrokerContractSchema {
  status:              string;
  contract_version:    string;
  description:         string;
  request_schema:      Record<string, string>;
  response_groups:     string[];
  source_type_values:  SourceType[];
  integration_notes:   string[];
}

// ─── UI display helpers ────────────────────────────────────────────────────────

export const SOURCE_TYPE_COLOR: Record<SourceType, string> = {
  observed:    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  estimated:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  interpreted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  inferred:    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  recommended: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  unavailable: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const SOURCE_TYPE_AR: Record<SourceType, string> = {
  observed:    "مُقاس",
  estimated:   "مُقدَّر",
  interpreted: "مُستقرَأ",
  inferred:    "مُستنتَج",
  recommended: "توصية",
  unavailable: "غير متوفر",
};

export const SEVERITY_COLOR: Record<RecommendationSeverity, string> = {
  critical: "border-red-600 bg-red-50 dark:bg-red-950",
  high:     "border-orange-500 bg-orange-50 dark:bg-orange-950",
  medium:   "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
  low:      "border-blue-400 bg-blue-50 dark:bg-blue-950",
  info:     "border-gray-400 bg-gray-50 dark:bg-gray-900",
};

export const TEMPORAL_MATCH_AR: Record<TemporalMatchClass, string> = {
  exact:       "مطابقة تامة",
  near:        "قريب",
  approximate: "تقريبي",
  historical:  "تاريخي",
  none:        "لا يوجد",
};

export const TEMPORAL_MATCH_COLOR: Record<TemporalMatchClass, string> = {
  exact:       "text-green-600",
  near:        "text-green-500",
  approximate: "text-yellow-600",
  historical:  "text-orange-600",
  none:        "text-red-600",
};
