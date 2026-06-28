/**
 * corridorApi.ts — Phase S12
 * Client-side API calls for Infrastructure Corridor Management.
 * All data persists in backend (workspace.infrastructure_corridors).
 */

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('tenant_id') ||
    localStorage.getItem('active_tenant_id') ||
    ''
  );
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Role':  'tenant_admin',
  };
  const tenantId = getTenantId();
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

export interface CorridorPayload {
  name:          string;
  geometry:      [number, number][];   // [[lon, lat], ...]
  buffer_meters: number;
  project_id?:   string;
  metadata?:     Record<string, unknown>;
}

export interface CorridorRecord extends CorridorPayload {
  corridor_id:  string;
  created_by:   string | null;
  created_at:   string;
  source:       string;
  metadata:     Record<string, unknown>;
}

export interface DetectionPoint {
  id:           string;
  corridor_id:  string;
  type:         'leak' | 'encroachment' | 'stress';
  label:        string;
  lon:          number;
  lat:          number;
  severity:     'high' | 'medium' | 'low';
  confidence:   string;
  source_type:  string;
  data_source:  string;
  year_range?:  string;
  magnitude?:   number;
  details:      Record<string, unknown>;
}

export interface TemporalPoint {
  year:          string;
  date:          string;
  confidence:    string;
  cloud_cover:   number;
  vegetation:    number;
  not_vegetated: number;
  water:         number;
  source_type:   string;
  data_source:   string;
}

export interface TemporalEvent {
  epoch_from:      string;
  epoch_to:        string;
  type:            'leak' | 'encroachment' | 'stress';
  event_ar:        string;
  candidate_label: string;
  magnitude:       number;
  confidence:      string;
  trend_ar:        string;
  approximate:     boolean;
  note_ar:         string;
}

export interface AnalyzeOptions {
  year_from?:       number;   // min 2015
  year_to?:         number;
  buffer_override?: number;   // metres, overrides saved corridor buffer
}

// ─── S12.3 — Event types ──────────────────────────────────────────────────────

export interface EventLifecycle {
  period:     string;
  status:     string;
  status_ar:  string;
  magnitude:  number;
  confidence: string;
  detail_ar:  string;
}

export interface CorridorEvent {
  // Event fields
  event_id:           string;
  issue_type:         'leak' | 'encroachment' | 'stress';
  label_ar:           string;
  first_seen:         string;
  last_seen:          string;
  peak_period:        string;
  trend:              'increasing' | 'stable' | 'declining' | 'intermittent';
  trend_ar:           string;
  confidence:         'weak' | 'moderate' | 'strong';
  severity:           string;
  evidence_count:     number;
  geometry: {
    lon:       number;
    lat:       number;
    precision: string;
  };
  lifecycle:          EventLifecycle[];
  recommended_action: string;
  // Backward-compat detection fields
  id:           string;
  type:         string;
  label:        string;
  lon:          number;
  lat:          number;
  source_type:  string;
  data_source:  string;
  year_range:   string;
  magnitude:    number;
  corridor_id:  string;
  details:      Record<string, unknown>;
}

export interface SectorSummary {
  sector_id:        number;
  sector_label:     string;
  success:          boolean;
  area_km2?:        number;
  changes_detected: boolean;
  zone_count:       number;
  epochs_count:     number;
  coverage_quality: string;
  centre_lat:       number;
  centre_lon:       number;
  error?:           string | null;
}

// ─── MNT-S13.1 — Multi-Source Satellite Center models ────────────────────────

export interface SectorRank {
  sector_id:          number;
  priority:           number;       // 1 = highest urgency
  priority_label_ar:  string;
  score:              number;
  detection_count:    number;
  event_count:        number;
  evidence_grade:     string;       // observed | confirmed | estimated | inferred | unavailable
  issue_types:        string[];
  centre_lat:         number;
  centre_lon:         number;
  frac_start:         number;
  frac_end:           number;
  recommended_action: string;
}

export interface MultiSourceContext {
  source_stack?:       string[];
  primary_source?:     string;
  evidence_level?:     string;
  confidence?:         number;
  temporal_class?:     string;
  strategy_note_ar?:   string;
  scene_count?:        number;
  fused_anomaly_context?: {
    anomalies:   { type: string; ar: string; en: string; severity: string; value?: number }[];
    anomaly_count: number;
    any_anomaly:   boolean;
  };
  fused_environmental_context?: { ar: string; en: string };
  indicators?: {
    ndvi?: number | null;
    bsi?:  number | null;
    lst_c?: number | null;
    vv_db?: number | null;
    moisture_signal?: boolean | null;
  };
  evidence_notes?: { ar: string[]; en: string[] };
  limitations?:    string[];
}

// ─── S12.5 — Live progress model ─────────────────────────────────────────────

export type AnalysisPhase =
  | 'queued'
  | 'initializing'
  | 'loading_imagery'
  | 'analyzing_year'
  | 'analyzing_sector'
  | 'comparing_epochs'
  | 'inferring'
  | 'multi_source_fusion'
  | 'merging_events'
  | 'completed'
  | 'failed';

export interface AnalysisProgress {
  phase:              AnalysisPhase;
  message_ar?:        string;
  strategy?:          string;
  current_year?:      string;
  current_sector?:    number;
  total_sectors?:     number;
  years_done?:        number;
  total_years?:       number;
  detections_so_far?: number;
  total_epochs?:      number;
  total_events?:      number;
  detections_found?:  number;
}

export interface AnalysisResult {
  analysis_id:         string;
  corridor_id:         string;
  status:              'queued' | 'running' | 'completed' | 'failed';
  error?:              string | null;
  detections:          DetectionPoint[];
  temporal_data:       TemporalPoint[];
  brain_context:       Record<string, unknown>;
  report_ar:           string;
  satellite_summary:   Record<string, unknown>;
  temporal_narrative:  TemporalEvent[];
  analysis_params:     { year_from?: number; year_to?: number; buffer_m?: number };
  map_actions:         unknown[];
  data_available:      boolean;
  missing_data_reason: string | null;
  segmented:           boolean;
  sector_count:        number;
  sectors:             SectorSummary[];
  critical_sectors:    SectorSummary[];
  events:              CorridorEvent[];   // S12.3 — merged tracked events
  // S12.5 — progressive fields
  progress:            AnalysisProgress;
  partial_detections:  DetectionPoint[];
  partial_events:      CorridorEvent[];
  // MNT-S13.1 — multi-source fields
  sector_ranking:      SectorRank[];
  multi_source_context: MultiSourceContext;
}

// ─ CRUD ──────────────────────────────────────────────────────────────────────

export async function createCorridor(payload: CorridorPayload): Promise<CorridorRecord> {
  const res = await fetch('/api/v1/corridors', {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Create corridor failed: ${res.status}`);
  return res.json();
}

export async function listCorridors(): Promise<CorridorRecord[]> {
  const res = await fetch('/api/v1/corridors', { headers: getHeaders() });
  if (!res.ok) throw new Error(`List corridors failed: ${res.status}`);
  return res.json();
}

export async function deleteCorridor(corridorId: string): Promise<void> {
  const res = await fetch(`/api/v1/corridors/${corridorId}`, {
    method:  'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Delete corridor failed: ${res.status}`);
}

// ─ Analysis ──────────────────────────────────────────────────────────────────
  export async function renameCorridor(corridorId: string, newName: string): Promise<CorridorRecord> {
    const res = await fetch(`/api/v1/corridors/${corridorId}`, {
      method:  'PATCH',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: newName }),
    });
    if (!res.ok) throw new Error(`Rename corridor failed: ${res.status}`);
    return res.json();
  }

  // ─ Analysis ──────────────────────────────────────────────────────────────────

/** Immediate response from POST /analyze — analysis runs in background */
export interface AnalysisJob {
  analysis_id: string;
  corridor_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
}

export async function analyzeCorridorSatellite(
  corridorId: string,
  options?: AnalyzeOptions,
): Promise<AnalysisJob> {
  const res = await fetch(`/api/v1/corridors/${corridorId}/analyze`, {
    method:  'POST',
    headers: getHeaders(),
    body:    options ? JSON.stringify(options) : undefined,
  });
  if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);
  return res.json();
}

export async function getLatestAnalysis(corridorId: string): Promise<AnalysisResult | null> {
  const res = await fetch(`/api/v1/corridors/${corridorId}/analysis`, { headers: getHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.has_analysis ? data : null;
}

// ─ MNT-S13.2 SIC Multi-Source Analysis ──────────────────────────────────────

export interface SICAnalysisResult {
  status:             string;
  engine:             string;
  detections:         DetectionPoint[];
  events:             CorridorEvent[];
  temporal_data:      TemporalPoint[];
  temporal_narrative: TemporalEvent[];
  sector_ranking:     SectorRank[];
  ms_broker:          MultiSourceContext;
  confidence:         number;
  sources:            string[];
  coverage_quality:   string;
  is_segmented:       boolean;
  sector_count:       number;
  satellite_analysis: Record<string, unknown>;
}

export async function sicAnalyzeCorridor(
  geometry:    [number, number][],
  bufferM:     number,
  yearFrom:    number,
  yearTo:      number,
  corridorId?: string,
): Promise<SICAnalysisResult> {
  const res = await fetch('/api/v1/satellite/multi-source/corridor-full', {
    method:  'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      geometry,
      buffer_m:    bufferM,
      year_from:   yearFrom,
      year_to:     yearTo,
      corridor_id: corridorId,
    }),
  });
  if (!res.ok) throw new Error(`SIC analysis failed: ${res.status}`);
  return res.json();
}

// ─ MNT-S13.3 Patch-Level Refinement (Async Job) ────────────────────────────

export type CandidateConfidence = 'weak' | 'moderate' | 'high';

export interface CandidateEvidence {
  type:           string;
  description_ar: string;
  value?:         number;
  years?:         number[];
  note?:          string;
  signal?:        string;
}

export interface LeakCandidateZone {
  candidate_id:            string;
  geometry_polygon:        [number, number][];  // [[lon, lat], ...] closed ring — real optical segmentation
  center_lat:              number;
  center_lon:              number;
  distance_to_corridor_m:  number;
  first_seen:              string;
  last_seen:               string;
  confidence:              CandidateConfidence;
  precision_level:         string;   // "corridor-level" | "sector-level" | "patch-level" | "sub-patch-optical"
  evidence:                CandidateEvidence[];
  score:                   number;
  recommended_action:      string;
  label_ar:                string;
  honest_note:             string;
  anomaly_type:            string;
  patch_id:                number;
  frac_along_corridor:     number;
  // MNT-S13.8 — spectral emission points (real geographic coordinates)
  emission_points?: Array<{
    point_id?:           string;
    lon:                 number;
    lat:                 number;
    mndwi_peak?:         number;
    anomaly_score:       number;
    unmixed_water_frac?: number;
    color_code?:         string;
    is_longitudinal?:    boolean;
    description_ar?:     string;
  }>;
  // MNT-S13.6 — optical analysis fields
  temporal_trend?:         string;
  intelligence_report_ar?: string;
  mndwi_growth_chart?:     Record<string, number>;
  leak_subtype?:           string;
  desert_anomaly_score?:   number;
  longitudinal_score?:     number;
  // MNT-S13.8 — heatmap + valve proximity
  heatmap_peak_count?:     number;
  heatmap_pattern?:        string;
  valve_proximity_m?:      number;
  nearest_valve_id?:       string;
}

export interface RefineJobCreated {
  job_id:     string;
  status:     string;
  created_at: string;
  message_ar: string;
}

export type RefineJobPhase = 'queued' | 'multi_source' | 'sic_analysis' | 'refining' | 'completed' | 'failed';

export interface RefineJobStatus {
  job_id:              string;
  status:              RefineJobPhase | 'not_found';
  phase:               string;
  message_ar:          string;
  // Progress fields (MNT-S13.4)
  progress_ratio:      number;
  current_patch:       number;
  total_patches:       number;
  current_epoch:       number;
  total_epochs:        number;
  current_stage_label: string;
  candidate_count:     number;
  partial_candidates:  LeakCandidateZone[];
  // Results
  candidates:          LeakCandidateZone[];
  merged_candidates:   LeakCandidateZone[];   // aggregated across all runs for this corridor
  merged_count:        number;
  sic_report_ar:       string;               // Arabic intelligence report from best candidate
  sic_detections:      DetectionPoint[];
  sic_events:          CorridorEvent[];
  sic_sector_ranking:  SectorRank[];
  sic_temporal_data:   TemporalPoint[];
  sic_ms_broker:       MultiSourceContext | null;
  sic_confidence:      number;
  sic_sources:         string[];
  error:               string | null;
  created_at:          string;
  completed_at:        string | null;
}

export async function startRefineAnalysis(
  geometry:    [number, number][],
  bufferM:     number,
  yearFrom:    number,
  yearTo:      number,
  corridorId?: string,
): Promise<RefineJobCreated> {
  const res = await fetch('/api/v1/satellite/multi-source/corridor-refine', {
    method:  'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      geometry,
      buffer_m:    bufferM,
      year_from:   yearFrom,
      year_to:     yearTo,
      corridor_id: corridorId,
    }),
  });
  if (!res.ok) throw new Error(`Refine job start failed: ${res.status}`);
  return res.json();
}

export async function getRefineJobStatus(jobId: string): Promise<RefineJobStatus> {
  const res = await fetch(
    `/api/v1/satellite/multi-source/corridor-refine/${jobId}`,
    { headers: getHeaders() },
  );
  if (!res.ok) throw new Error(`Refine job poll failed: ${res.status}`);
  return res.json();
}

// ─ Work Orders ───────────────────────────────────────────────────────────────

export interface WorkOrderCreated {
  work_order_id:     number;
  work_order_number: string | null;
  created_at:        string | null;
  corridor_id:       string;
  detection_id:      string;
  title_ar:          string;
  priority:          string;
  status:            string;
}

export async function createWorkOrderFromDetection(
  corridorId:   string,
  detection:    DetectionPoint,
  notes?:       string,
): Promise<WorkOrderCreated> {
  const res = await fetch(
    `/api/v1/corridors/${corridorId}/detections/${detection.id}/work-order`,
    {
      method:  'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        detection_id:   detection.id,
        detection_type: detection.type,
        detection_label: detection.label,
        lon:            detection.lon,
        lat:            detection.lat,
        severity:       detection.severity,
        confidence:     detection.confidence,
        notes,
      }),
    },
  );
  if (!res.ok) throw new Error(`Work order creation failed: ${res.status}`);
  return res.json();
}

// ─ Brain with structured corridor context ────────────────────────────────────

export async function queryBrainWithContext(
  question:     string,
  brainContext: Record<string, unknown>,
): Promise<string> {
  // Build a grounded prompt prefix from real data — brain MUST use this context
  const ctx = brainContext as {
    corridor?: { name?: string; buffer_meters?: number; point_count?: number };
    analysis_params?: { year_from?: number; year_to?: number; buffer_m?: number; time_range?: string };
    detection_summary?: { total?: number; leaks?: number; encroachments?: number; stress?: number; high_severity?: number };
    temporal_narrative?: TemporalEvent[];
    data_available?: boolean;
    data_source?: string;
  };

  const corridorName   = ctx.corridor?.name ?? 'غير محدد';
  const bufferM        = ctx.corridor?.buffer_meters ?? '?';
  const dataAvailable  = ctx.data_available ?? false;
  const summary        = ctx.detection_summary ?? {};
  const params         = ctx.analysis_params ?? {};
  const narrative      = ctx.temporal_narrative ?? [];

  let contextPrefix = `[سياق ممر البنية التحتية — ${corridorName}]\n`;
  contextPrefix += `الممر: ${corridorName} | حزام: ${bufferM}م\n`;
  if (params.time_range) contextPrefix += `النطاق الزمني: ${params.time_range}\n`;
  contextPrefix += `بيانات الأقمار الصناعية: ${dataAvailable ? `متاحة (${ctx.data_source})` : 'غير متاحة'}\n`;
  if (dataAvailable && summary.total !== undefined) {
    contextPrefix += `نتائج التحليل: ${summary.total} نقطة — تسريبات ${summary.leaks ?? 0} | تعديات ${summary.encroachments ?? 0} | إجهاد ${summary.stress ?? 0} | خطورة عالية ${summary.high_severity ?? 0}\n`;
  }
  if (narrative.length > 0) {
    contextPrefix += `السيرة الزمنية (تقريبي):\n`;
    narrative.slice(0, 4).forEach(ev => {
      contextPrefix += `  [${ev.epoch_from}–${ev.epoch_to}] ${ev.event_ar} — ${ev.candidate_label}\n`;
    });
  }
  if (!dataAvailable) {
    contextPrefix += `تنبيه: لا توجد بيانات قمر صناعي متاحة حالياً. أجب بصراحة إذا لم تتوفر البيانات.\n`;
  }
  contextPrefix += `\nالسؤال: ${question}`;

  const res = await fetch('/api/v1/brain', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID, 'X-User-Role': 'tenant_admin' },
    body:    JSON.stringify({ question: contextPrefix }),
  });

  if (!res.ok) throw new Error(`Brain API error: ${res.status}`);
  const data = await res.json();
  return data.answer ?? 'لم يتم الحصول على رد من المساعد.';
}
