/**
 * lib/reasoning/engine.ts
 * Construction Reasoning Engine — Phase 4
 *
 * This engine reasons from validated physical evidence.
 * It never touches raw pixels or raw signals.
 * Every conclusion is explainable, evidenced, and has a confidence level.
 *
 * Architecture:
 *   TemporalFeatureRecord[] → PhaseClassifier → ProgressModel → HealthEngine
 *   → InterruptionDetector → TrendAnalyzer → ConstructionIntelligence
 */

import type { FeatureBundle, TemporalFeatureRecord } from '@/lib/features/engine';
import type { ProjectType, ProjectStatus, ActivityState } from '@/lib/pic/types';

// ─────────────────────────────────────────────────────────────────────────────
//  Output Types
// ─────────────────────────────────────────────────────────────────────────────

export type ConstructionPhase =
  | 'pre_construction'   // site not yet started
  | 'site_clearing'      // vegetation removed, ground leveled
  | 'excavation'         // digging, earth movement
  | 'foundation'         // concrete/base work
  | 'structural_works'   // walls, columns, road base
  | 'finishing'          // surface treatment, asphalt, roofing
  | 'completed'          // work done, site stable
  | 'paused'             // temporary stop
  | 'abandoned'          // long-term inactivity
  | 'unknown';

export interface Evidence {
  signal:     string;
  value:      number;
  supports:   string;  // what conclusion does this support?
  weight:     number;  // 0-1 importance of this evidence
  detail_ar:  string;
}

export interface InterruptionRecord {
  start_date:    string;
  end_date:      string | 'ongoing';
  duration_days: number;
  type:          'normal_pause' | 'extended_pause' | 'abandonment' | 'unknown';
  confidence:    number;
  detail_ar:     string;
}

export interface TrendResult {
  direction:    'improving' | 'declining' | 'stable' | 'unknown';
  slope:        number;     // rate of change per week
  significance: number;     // 0-1: how confident is the trend?
  detail_ar:    string;
}

export interface ProgressEstimate {
  value:        number;     // 0-100
  confidence:   number;     // 0-1
  method:       string;     // how was this calculated?
  evidence:     Evidence[];
  limitation_ar: string;
}

export interface HealthEstimate {
  score:        number;     // 0-100
  components:   Record<string, number>;
  detail_ar:    string;
}

export interface ConstructionIntelligence {
  project_id:   string;
  analyzed_at:  string;

  // Core outputs
  phase:               ConstructionPhase;
  phase_confidence:    number;
  status:              ProjectStatus;
  progress:            ProgressEstimate;
  health:              HealthEstimate;
  interruptions:       InterruptionRecord[];
  trend:               TrendResult;

  // Timeline
  timeline_points:     TimelinePoint[];
  first_activity_date: string | null;
  last_activity_date:  string | null;

  // Explainability
  primary_evidence:    Evidence[];
  counter_evidence:    Evidence[];
  missing_evidence:    string[];
  confidence_overall:  number;
  summary_ar:          string;
  limitations_ar:      string[];

  // Stats
  total_observations:  number;
  usable_observations: number;
  rejected_observations: number;
}

export interface TimelinePoint {
  date:                  string;
  construction_activity: number;    // 0-1
  activity_state:        ActivityState;
  phase:                 ConstructionPhase;
  confidence:            number;
  feature_dominant:      string;    // which feature drove the score
  explanation_ar:        string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Project Type Configurations
//  Different project types use different evidence weights
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectConfig {
  name_ar:              string;
  feature_weights:      Record<string, number>;
  expected_phases:      ConstructionPhase[];
  progress_uses_linear: boolean;  // roads: measure length; others: measure phases
  min_reliable_area_m:  number;   // minimum project area for reliable analysis
}

const PROJECT_CONFIGS: Partial<Record<ProjectType, ProjectConfig>> = {
  road: {
    name_ar: 'طريق',
    feature_weights: { linear_structure: 0.40, construction_disturbance: 0.25, surface_stability: 0.20, surface_exposure: 0.15 },
    expected_phases:  ['site_clearing','excavation','foundation','structural_works','finishing','completed'],
    progress_uses_linear: true,
    min_reliable_area_m: 500,
  },
  building: {
    name_ar: 'مبنى',
    feature_weights: { construction_disturbance: 0.35, surface_exposure: 0.25, surface_stability: 0.20, linear_structure: 0.20 },
    expected_phases:  ['site_clearing','excavation','foundation','structural_works','finishing','completed'],
    progress_uses_linear: false,
    min_reliable_area_m: 200,
  },
  bridge: {
    name_ar: 'جسر',
    feature_weights: { linear_structure: 0.45, construction_disturbance: 0.30, surface_stability: 0.25 },
    expected_phases:  ['site_clearing','excavation','foundation','structural_works','finishing','completed'],
    progress_uses_linear: true,
    min_reliable_area_m: 200,
  },
  earthwork: {
    name_ar: 'أعمال ترابية',
    feature_weights: { surface_exposure: 0.45, construction_disturbance: 0.35, surface_stability: 0.20 },
    expected_phases:  ['excavation','foundation','structural_works','completed'],
    progress_uses_linear: false,
    min_reliable_area_m: 500,
  },
  utility: {
    name_ar: 'مرافق',
    feature_weights: { construction_disturbance: 0.35, surface_exposure: 0.35, linear_structure: 0.30 },
    expected_phases:  ['site_clearing','excavation','structural_works','finishing','completed'],
    progress_uses_linear: true,
    min_reliable_area_m: 300,
  },
};

const DEFAULT_CONFIG: ProjectConfig = {
  name_ar: 'مشروع',
  feature_weights: { construction_disturbance: 0.35, surface_stability: 0.20, surface_exposure: 0.20, linear_structure: 0.15, activity_persistence: 0.10 },
  expected_phases: ['site_clearing','excavation','foundation','structural_works','finishing','completed'],
  progress_uses_linear: false,
  min_reliable_area_m: 300,
};

function getConfig(type?: ProjectType | string): ProjectConfig {
  return (type && PROJECT_CONFIGS[type as ProjectType]) ?? DEFAULT_CONFIG;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Phase Classifier
//  Determines construction phase from feature patterns
// ─────────────────────────────────────────────────────────────────────────────

function classifyPhase(bundle: FeatureBundle): { phase: ConstructionPhase; confidence: number } {
  const cd = bundle.construction_disturbance.value;
  const ss = bundle.surface_stability.value;
  const se = bundle.surface_exposure.value;
  const ls = bundle.linear_structure.value;
  const ap = bundle.activity_persistence.value;
  const vc = bundle.vegetation_change.value;

  if (cd < 0.08 && ss < 0.30 && vc > 0.50) {
    return { phase: 'pre_construction', confidence: 0.75 };
  }
  if (vc < 0.25 && se > 0.35 && cd > 0.20 && ss < 0.40) {
    return { phase: 'site_clearing', confidence: 0.70 };
  }
  if (se > 0.45 && cd > 0.35 && ls < 0.30) {
    return { phase: 'excavation', confidence: 0.70 };
  }
  if (ls > 0.40 && cd > 0.25 && se > 0.20 && ss < 0.50) {
    return { phase: 'structural_works', confidence: 0.65 };
  }
  if (ss > 0.55 && cd < 0.25 && ls > 0.30) {
    return { phase: 'finishing', confidence: 0.65 };
  }
  if (ss > 0.75 && cd < 0.12 && ap > 0.70) {
    return { phase: 'completed', confidence: 0.70 };
  }
  if (cd < 0.08 && ss > 0.30 && ap < 0.30) {
    return { phase: 'paused', confidence: 0.60 };
  }
  return { phase: 'unknown', confidence: 0.40 };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Activity State from CAI
// ─────────────────────────────────────────────────────────────────────────────

function caiToState(cai: number): ActivityState {
  if (cai >= 0.25) return 'active';
  if (cai >= 0.08) return 'slow';
  return 'stopped';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Progress Estimator
// ─────────────────────────────────────────────────────────────────────────────

function estimateProgress(
  records:      TemporalFeatureRecord[],
  config:       ProjectConfig,
  startDate?:   string,
  expectedEnd?: string,
  projectType?: string,
): ProgressEstimate {
  const evidence: Evidence[] = [];

  if (records.length === 0) {
    return { value: 0, confidence: 0, method: 'no_data',
      evidence: [], limitation_ar: 'لا بيانات كافية' };
  }

  const usable = records.filter(r => r.bundle.base_confidence > 0.20);
  if (usable.length === 0) {
    return { value: 0, confidence: 0.1, method: 'all_rejected',
      evidence: [], limitation_ar: 'جميع المشاهد المتاحة ذات جودة منخفضة' };
  }

  // Method A: Phase-based progress
  // Identify the most advanced phase observed, estimate progress from phase sequence
  const phaseOrder: ConstructionPhase[] = config.expected_phases;
  let latestPhaseIdx = -1;
  let latestPhaseConf = 0;
  let phaseSample = 0, stableSample = 0;

  for (const r of usable.slice(-10)) {
    const { phase, confidence } = classifyPhase(r.bundle);
    const idx = phaseOrder.indexOf(phase);
    if (idx > latestPhaseIdx || (idx === latestPhaseIdx && confidence > latestPhaseConf)) {
      latestPhaseIdx  = idx;
      latestPhaseConf = confidence;
    }
    if (r.bundle.surface_stability.value > 0.55) stableSample++;
    phaseSample++;
  }

  // Progress per phase (uniform distribution across phases)
  const phasePct = latestPhaseIdx >= 0
    ? Math.round(((latestPhaseIdx + 0.5) / phaseOrder.length) * 85) // cap at 85% via satellite
    : 0;

  // Stable surface fraction also signals completion
  const stableRatio = phaseSample > 0 ? stableSample / phaseSample : 0;
  const stabilityPct = Math.round(stableRatio * 90);  // stable → approaching done

  // Method B: Time-based (if dates available)
  let timePct = 0;
  if (startDate && expectedEnd) {
    const now   = new Date().toISOString().slice(0, 10);
    const total = daysBetween(startDate, expectedEnd);
    const elap  = daysBetween(startDate, now);
    timePct     = Math.min(100, Math.round((elap / Math.max(total, 1)) * 100));
  }

  // Blend:
  // If we have good satellite data → favor satellite (phase+stability)
  // If satellite data is poor → use time as fallback
  const satConf   = usable[usable.length-1]?.bundle?.base_confidence ?? 0.3;
  const satWeight = Math.min(0.75, satConf * 0.9);
  const timeWeight = 1 - satWeight;

  const satEstimate = Math.round((phasePct * 0.6 + stabilityPct * 0.4));
  const blended     = Math.round(satEstimate * satWeight + timePct * timeWeight);
  const final       = Math.min(97, blended);  // never 100% — need physical inspection

  if (latestPhaseIdx >= 0) {
    evidence.push({
      signal:    'construction_phase',
      value:     latestPhaseIdx / phaseOrder.length,
      supports:  `مرحلة ${phaseOrder[latestPhaseIdx]} رُصدت في ${usable.slice(-3).length} مشاهد أخيرة`,
      weight:    0.60,
      detail_ar: `المرحلة ${latestPhaseIdx + 1} من ${phaseOrder.length} (${phaseOrder[latestPhaseIdx]})`,
    });
  }
  if (timePct > 0) {
    evidence.push({
      signal:    'time_elapsed',
      value:     timePct / 100,
      supports:  `${timePct}% من المدة الزمنية المُخططة مرت`,
      weight:    timeWeight,
      detail_ar: `مضى ${timePct}% من الجدول الزمني`,
    });
  }

  const limitation =
    satConf < 0.40
      ? 'جودة البيانات المتاحة منخفضة — الإنجاز تقدير أولي'
      : usable.length < 5
        ? 'عدد قليل من المشاهد الصالحة — هامش الخطأ ±15%'
        : `هامش الخطأ التقديري: ±10%`;

  return {
    value:        final,
    confidence:   Math.min(0.85, satConf * 0.9),
    method:       'phase_classification + time_blend',
    evidence,
    limitation_ar: limitation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Health Engine
// ─────────────────────────────────────────────────────────────────────────────

function computeHealth(
  records:       TemporalFeatureRecord[],
  progress:      ProgressEstimate,
  interruptions: InterruptionRecord[],
  startDate?:    string,
  expectedEnd?:  string,
): HealthEstimate {
  if (records.length === 0) {
    return { score: 50, components: {}, detail_ar: 'بيانات غير كافية' };
  }

  const recent = records.slice(-10);
  const usable = recent.filter(r => r.bundle.base_confidence > 0.20);

  // Component 1: Progress vs schedule (30%)
  let progressScore = 0.5;
  if (startDate && expectedEnd) {
    const now   = new Date().toISOString().slice(0, 10);
    const total = daysBetween(startDate, expectedEnd);
    const elap  = daysBetween(startDate, now);
    const expectedPct = Math.min(1, elap / Math.max(total, 1));
    const actualPct   = progress.value / 100;
    progressScore     = Math.min(1, actualPct / Math.max(0.05, expectedPct));
  }

  // Component 2: Recent activity level (25%)
  const recentCAI = usable.length > 0
    ? usable.reduce((s, r) => s + r.bundle.construction_activity_index, 0) / usable.length
    : 0;

  // Component 3: Interruption penalty (25%)
  const totalStopDays    = interruptions.reduce((s, i) => s + i.duration_days, 0);
  const interruptionPenalty = Math.min(1, totalStopDays / 180);  // 180+ days = maximum penalty

  // Component 4: Data quality (10%)
  const avgConf = records.slice(-5).reduce((s, r) => s + r.bundle.base_confidence, 0) / Math.min(5, records.length);

  // Component 5: Activity consistency (10%)
  const caiValues = usable.map(r => r.bundle.construction_activity_index);
  const caiMean   = caiValues.reduce((a,b) => a+b, 0) / (caiValues.length || 1);
  const caiStd    = Math.sqrt(caiValues.reduce((s, v) => s + (v - caiMean) * (v - caiMean), 0) / (caiValues.length || 1));
  const consistency = Math.max(0, 1 - caiStd * 3);

  const components = {
    progress_vs_schedule: progressScore,
    recent_activity:      recentCAI,
    interruption_factor:  1 - interruptionPenalty,
    data_quality:         avgConf,
    activity_consistency: consistency,
  };

  const score = Math.round(Math.max(0, Math.min(100,
    progressScore   * 30 +
    recentCAI       * 25 +
    (1 - interruptionPenalty) * 25 +
    avgConf         * 10 +
    consistency     * 10
  )));

  const detail = score >= 80
    ? `المشروع بصحة جيدة (${score}/100) — تقدم منتظم وبيانات كافية`
    : score >= 60
      ? `صحة متوسطة (${score}/100) — تحتاج متابعة`
      : score >= 40
        ? `صحة منخفضة (${score}/100) — يحتاج تدخلاً`
        : `صحة حرجة (${score}/100) — مشروع في خطر`;

  return { score, components, detail_ar: detail };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Interruption Detector
// ─────────────────────────────────────────────────────────────────────────────

const INTERRUPTION_THRESHOLDS = {
  normal_pause:   7,    // < 7 days = normal
  extended_pause: 21,   // 7-30 days
  abandonment:    90,   // > 90 days
};

function detectInterruptions(points: TimelinePoint[]): InterruptionRecord[] {
  const interruptions: InterruptionRecord[] = [];
  let stoppedSince: string | null = null;
  let stopDays = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];

    if (p.activity_state === 'stopped') {
      if (!stoppedSince) stoppedSince = p.date;
      if (prev) stopDays += daysBetween(prev.date, p.date);
    } else if (stoppedSince) {
      if (stopDays >= INTERRUPTION_THRESHOLDS.normal_pause) {
        interruptions.push(classifyInterruption(stoppedSince, p.date, stopDays));
      }
      stoppedSince = null;
      stopDays = 0;
    }
  }

  if (stoppedSince && stopDays >= INTERRUPTION_THRESHOLDS.normal_pause) {
    const inter = classifyInterruption(stoppedSince, 'ongoing', stopDays);
    interruptions.push(inter);
  }

  return interruptions;
}

function classifyInterruption(
  start: string, end: string | 'ongoing', days: number
): InterruptionRecord {
  const type = days > INTERRUPTION_THRESHOLDS.abandonment ? 'abandonment'
    : days > INTERRUPTION_THRESHOLDS.extended_pause ? 'extended_pause'
    : 'normal_pause';

  const detail = type === 'abandonment'
    ? `⚠️ توقف طويل محتمل هجر (${days} يوم)`
    : type === 'extended_pause'
      ? `توقف ممتد (${days} يوم) — تحتاج تحقق ميداني`
      : `توقف عادي (${days} يوم)`;

  return {
    start_date:    start,
    end_date:      end,
    duration_days: days,
    type,
    confidence:    type === 'normal_pause' ? 0.90 : 0.70,
    detail_ar:     detail,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Trend Analyzer (linear regression on CAI values)
// ─────────────────────────────────────────────────────────────────────────────

function analyzeTrend(records: TemporalFeatureRecord[], windowDays = 30): TrendResult {
  if (records.length < 3) {
    return { direction: 'unknown', slope: 0, significance: 0, detail_ar: 'بيانات غير كافية للاتجاه' };
  }

  const cutoff  = new Date(Date.now() - windowDays * 86400_000).toISOString().slice(0, 10);
  const window  = records.filter(r => r.date >= cutoff);
  const usable  = (window.length >= 3 ? window : records.slice(-10))
    .filter(r => r.bundle.base_confidence > 0.20);

  if (usable.length < 3) {
    return { direction: 'unknown', slope: 0, significance: 0, detail_ar: 'مشاهد صالحة غير كافية للاتجاه' };
  }

  // Simple linear regression on CAI values
  const n     = usable.length;
  const xs    = usable.map((_, i) => i);
  const ys    = usable.map(r => r.bundle.construction_activity_index);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const xxSum = xs.reduce((s, x) => s + (x - xMean) * (x - xMean), 0);
  const xySum = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const slope = xxSum > 0 ? xySum / xxSum : 0;

  // R² as significance measure
  const residuals = ys.map((y, i) => (y - (yMean + slope * (xs[i] - xMean))) * (y - (yMean + slope * (xs[i] - xMean))));
  const ssTot     = ys.reduce((s, y) => s + (y - yMean) * (y - yMean), 0);
  const r2        = ssTot > 0 ? Math.max(0, 1 - residuals.reduce((a, b) => a + b, 0) / ssTot) : 0;

  const slopePerWeek = slope * 7;  // normalized to weekly change
  const direction: TrendResult['direction'] = r2 > 0.3
    ? (slopePerWeek > 0.02 ? 'improving' : slopePerWeek < -0.02 ? 'declining' : 'stable')
    : 'stable';

  const detail = direction === 'improving'
    ? `تصاعد في النشاط (+${(slopePerWeek*100).toFixed(1)}%/أسبوع)`
    : direction === 'declining'
      ? `تراجع في النشاط (${(slopePerWeek*100).toFixed(1)}%/أسبوع)`
      : `نشاط مستقر`;

  return { direction, slope: slopePerWeek, significance: r2, detail_ar: detail };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Status Deriver
// ─────────────────────────────────────────────────────────────────────────────

function deriveStatus(
  phase:         ConstructionPhase,
  progress:      ProgressEstimate,
  lastActivity:  string | null,
  expectedEnd?:  string,
): ProjectStatus {
  if (phase === 'completed' || progress.value >= 97) return 'completed';
  if (phase === 'abandoned') return 'stopped';

  if (lastActivity) {
    const daysSince = daysBetween(lastActivity, new Date().toISOString().slice(0, 10));
    if (daysSince > 30) return 'stopped';
    if (daysSince > 14) return 'slow';
  }

  if (expectedEnd && new Date().toISOString().slice(0, 10) > expectedEnd) return 'delayed';
  if (phase === 'paused') return 'slow';
  if (['site_clearing','excavation','foundation','structural_works','finishing'].includes(phase)) return 'active';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
//  Evidence Collector
// ─────────────────────────────────────────────────────────────────────────────

function collectEvidence(
  records:    TemporalFeatureRecord[],
  phase:      ConstructionPhase,
  progress:   ProgressEstimate,
): { primary: Evidence[]; counter: Evidence[]; missing: string[] } {
  const primary:  Evidence[] = [];
  const counter:  Evidence[] = [];
  const missing:  string[]   = [];

  const recent   = records.slice(-5);
  const avgCAI   = recent.reduce((s, r) => s + r.bundle.construction_activity_index, 0) / (recent.length || 1);
  const avgStab  = recent.reduce((s, r) => s + r.bundle.surface_stability.value, 0) / (recent.length || 1);
  const avgLinear = recent.reduce((s, r) => s + r.bundle.linear_structure.value, 0) / (recent.length || 1);

  if (avgCAI > 0.25) {
    primary.push({ signal:'construction_activity_index', value:avgCAI,
      supports:'يدعم وجود نشاط إنشائي حقيقي', weight:0.40, detail_ar:`متوسط النشاط ${(avgCAI*100).toFixed(0)}% في آخر ${recent.length} مشاهد` });
  }
  if (avgLinear > 0.35) {
    primary.push({ signal:'linear_structure', value:avgLinear,
      supports:'يدعم تقدم البنية التحتية', weight:0.30, detail_ar:`هياكل خطية بقوة ${(avgLinear*100).toFixed(0)}%` });
  }
  if (avgStab > 0.60) {
    primary.push({ signal:'surface_stability', value:avgStab,
      supports:'يدعم اكتمال أجزاء من الموقع', weight:0.25, detail_ar:`استقرار السطح ${(avgStab*100).toFixed(0)}%` });
  }
  if (progress.confidence < 0.40) {
    counter.push({ signal:'low_confidence', value:1-progress.confidence,
      supports:'يُضعف موثوقية التقدير', weight:0.50, detail_ar:`ثقة منخفضة (${(progress.confidence*100).toFixed(0)}%)` });
  }

  if (records.length < 5) missing.push('مشاهد صالحة إضافية — الإنجاز تقدير أولي');
  if (!records.some(r => r.bundle.vegetation_change.confidence > 0.6))
    missing.push('إشارة NIR لتحديد النباتات بدقة (غير متاح من Planet RGB)');

  return { primary, counter, missing };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Summary Generator
// ─────────────────────────────────────────────────────────────────────────────

function generateSummary(
  phase:         ConstructionPhase,
  status:        ProjectStatus,
  progress:      ProgressEstimate,
  health:        HealthEstimate,
  trend:         TrendResult,
  interruptions: InterruptionRecord[],
  projectName:   string,
  projectType?:  string,
): string {
  const typeAr = getConfig(projectType as ProjectType).name_ar;
  const parts: string[] = [];

  const statusLabels: Record<ProjectStatus, string> = {
    active: 'يسير بشكل طبيعي', slow: 'يسير ببطء',
    stopped: 'متوقف', delayed: 'متأخر عن الموعد',
    completed: 'مكتمل', cancelled: 'ملغى', unknown: 'غير محدد الحالة',
  };

  parts.push(`مشروع ${typeAr} "${projectName}" ${statusLabels[status]} — إنجاز مقدَّر: ${progress.value}% (ثقة ${(progress.confidence*100).toFixed(0)}%).`);

  if (interruptions.length > 0) {
    const totalDays = interruptions.reduce((s, i) => s + i.duration_days, 0);
    parts.push(`رُصدت ${interruptions.length} انقطاعات بمجموع ${totalDays} يوم.`);
  }

  if (trend.direction !== 'unknown' && trend.significance > 0.3) {
    parts.push(`الاتجاه الأخير: ${trend.detail_ar}.`);
  }

  parts.push(`درجة الصحة: ${health.score}/100.`);

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
//  ConstructionReasoningEngine — Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export class ConstructionReasoningEngine {

  analyze(opts: {
    project_id:    string;
    project_name:  string;
    project_type?: string;
    start_date?:   string;
    expected_end?: string;
    records:       TemporalFeatureRecord[];
    total_scenes_found:   number;
    rejected_scenes:      number;
  }): ConstructionIntelligence {

    const { project_id, project_name, project_type, start_date, expected_end, records } = opts;
    const config = getConfig(project_type as ProjectType | undefined);

    // 1. Build timeline points
    const timeline_points: TimelinePoint[] = records.map(r => {
      const { phase, confidence: pConf } = classifyPhase(r.bundle);
      const cai   = r.bundle.construction_activity_index;
      const state = caiToState(cai);

      // Most influential feature
      const features = {
        construction_disturbance: r.bundle.construction_disturbance.value,
        surface_stability:        r.bundle.surface_stability.value,
        linear_structure:         r.bundle.linear_structure.value,
        surface_exposure:         r.bundle.surface_exposure.value,
      };
      const dominant = Object.entries(features).sort((a,b) => b[1]-a[1])[0][0];

      return {
        date:                  r.date,
        construction_activity: cai,
        activity_state:        state,
        phase,
        confidence:            r.bundle.base_confidence,
        feature_dominant:      dominant,
        explanation_ar:        r.bundle.construction_disturbance.interpretation_ar,
      };
    });

    // 2. Current phase (last 3 observations consensus)
    const recent3 = records.slice(-3);
    const phaseVotes: Record<string, number> = {};
    for (const r of recent3) {
      const { phase } = classifyPhase(r.bundle);
      phaseVotes[phase] = (phaseVotes[phase] ?? 0) + 1;
    }
    const currentPhase = (Object.entries(phaseVotes).sort((a,b) => b[1]-a[1])[0]?.[0] as ConstructionPhase) ?? 'unknown';
    const phaseConf    = recent3.length > 0 ? recent3.slice(-1)[0]?.bundle.base_confidence ?? 0.5 : 0.3;

    // 3. Progress
    const progress = estimateProgress(records, config, start_date, expected_end, project_type);

    // 4. Interruptions
    const interruptions = detectInterruptions(timeline_points);

    // 5. Trend
    const trend = analyzeTrend(records);

    // 6. Health
    const health = computeHealth(records, progress, interruptions, start_date, expected_end);

    // 7. Activity dates
    const active_points     = timeline_points.filter(p => p.activity_state === 'active');
    const first_activity    = active_points[0]?.date ?? null;
    const last_activity     = active_points[active_points.length-1]?.date ?? null;

    // 8. Status
    const status = deriveStatus(currentPhase, progress, last_activity, expected_end);

    // 9. Evidence
    const { primary, counter, missing } = collectEvidence(records, currentPhase, progress);

    // 10. Overall confidence
    const confidenceOverall = records.length > 0
      ? records.slice(-5).reduce((s, r) => s + r.bundle.base_confidence, 0) / Math.min(5, records.length)
      : 0;

    // 11. Summary
    const summary = generateSummary(currentPhase, status, progress, health, trend, interruptions, project_name, project_type);

    // 12. Limitations
    const limitations: string[] = [];
    if (progress.confidence < 0.40) limitations.push('دقة التحليل المكاني منخفضة — المشروع صغير نسبياً');
    if (records.length < 10) limitations.push('عدد محدود من المشاهد الصالحة');
    limitations.push('تقدير الإنجاز من الصور الفضائية: هامش خطأ ±10-15%');

    return {
      project_id,
      analyzed_at:         new Date().toISOString(),
      phase:               currentPhase,
      phase_confidence:    phaseConf,
      status,
      progress,
      health,
      interruptions,
      trend,
      timeline_points,
      first_activity_date: first_activity,
      last_activity_date:  last_activity,
      primary_evidence:    primary,
      counter_evidence:    counter,
      missing_evidence:    missing,
      confidence_overall:  Math.round(confidenceOverall * 100) / 100,
      summary_ar:          summary,
      limitations_ar:      limitations,
      total_observations:  opts.total_scenes_found,
      usable_observations: records.length,
      rejected_observations: opts.rejected_scenes,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper
// ─────────────────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86400_000);
}
