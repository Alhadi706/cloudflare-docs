/**
 * lib/svqe/engine.ts
 * Signal Validation & Quality Engine — Phase 2
 *
 * Every observation must pass through this engine before entering the
 * Feature Layer. Observations that fail validation are rejected or
 * downgraded — they never corrupt the intelligence outputs.
 *
 * Architecture:
 *   SceneInput → 7 independent validators → ConfidenceAggregator → ValidatedObservation
 *
 * Each validator answers one scientific question. All results are
 * combined transparently. Nothing is a black box.
 */

import type { PixelFeatures, CropRegion } from '@/lib/sal/adapters/planet';

// ─────────────────────────────────────────────────────────────────────────────
//  Input & Output Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneObservation {
  scene_id:        string;
  scan_date:       string;          // YYYY-MM-DD
  cloud_cover_pct: number;          // from metadata
  features:        PixelFeatures;   // decoded from thumbnail
  crop:            CropRegion;      // spatial crop result
  gap_days_from_prev: number;       // days since previous scene (0 if first)
  pixel_resolution_m: number;       // meters per original pixel (~3 for PlanetScope)
}

export type ValidationStatus = 'ACCEPTED' | 'DOWNGRADED' | 'REJECTED';

export interface ValidationFinding {
  validator:    string;
  status:       ValidationStatus;
  reason:       string;
  confidence_delta: number;    // negative = reduces confidence
  is_blocking:  boolean;       // REJECTED if true
  detail_ar:    string;        // Arabic explanation
}

export interface ValidationResult {
  final_status:      ValidationStatus;
  final_confidence:  number;         // 0-1 adjusted
  findings:          ValidationFinding[];
  rejection_reason?: string;
  // For the explainability trace
  quality_summary_ar: string;
}

export interface ValidatedObservation extends SceneObservation {
  validation: ValidationResult;
  is_usable:  boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Physical Limits Registry (scientifically justified bounds)
// ─────────────────────────────────────────────────────────────────────────────

const PHYSICS = {
  MAX_DAILY_CHANGE: {
    mean_luminance:      0.40,   // reflectance can't change 40%/day without cloud
    std_luminance:       0.30,   // surface roughness proxy
    vegetation_proxy:    0.25,   // NDVI-proxy can't jump >0.25 in one day
    bare_soil_proxy:     0.40,   // excavation can expose soil quickly
    entropy:             0.30,
    edge_density:        0.25,
  },
  CLOUD_LIMIT_REJECT:    0.60,   // >60% cloud → reject (too much contamination)
  CLOUD_LIMIT_DEGRADE:   0.30,   // 30-60% → downgrade
  MIN_SPATIAL_RELIABLE:  16,     // <4×4 pixels → unreliable
  MIN_SPATIAL_DEGRADE:   64,     // <8×8 pixels → degraded
  MAX_GAP_DAYS:          90,     // gaps > 90 days break temporal comparison
  WARN_GAP_DAYS:         21,     // 21-90 days → note gap
  // Libya-specific: scene brightness bounds
  BRIGHTNESS_CLOUD_MIN:  0.80,   // bright overall → likely cloud
  BRIGHTNESS_NIGHT_MAX:  0.05,   // very dark → night/corrupt
  BRIGHTNESS_IDEAL:      [0.15, 0.65] as [number, number],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
//  Validator 1: Cloud Contamination
// ─────────────────────────────────────────────────────────────────────────────

function validateCloud(obs: SceneObservation): ValidationFinding {
  const cc = obs.cloud_cover_pct;

  if (cc > PHYSICS.CLOUD_LIMIT_REJECT) {
    return {
      validator:        'cloud',
      status:           'REJECTED',
      reason:           `cloud_cover=${cc}%>60%`,
      confidence_delta: -1.0,
      is_blocking:      true,
      detail_ar:        `تغطية سحابية ${cc}% — الصورة غير صالحة للتحليل`,
    };
  }
  if (cc > PHYSICS.CLOUD_LIMIT_DEGRADE) {
    const delta = -((cc - PHYSICS.CLOUD_LIMIT_DEGRADE) / (PHYSICS.CLOUD_LIMIT_REJECT - PHYSICS.CLOUD_LIMIT_DEGRADE)) * 0.4;
    return {
      validator:        'cloud',
      status:           'DOWNGRADED',
      reason:           `cloud_cover=${cc}%>30%`,
      confidence_delta: delta,
      is_blocking:      false,
      detail_ar:        `تغطية سحابية ${cc}% — ثقة مخفَّضة`,
    };
  }
  return {
    validator:        'cloud',
    status:           'ACCEPTED',
    reason:           `cloud_cover=${cc}%≤30%`,
    confidence_delta: cc < 5 ? +0.05 : 0,
    is_blocking:      false,
    detail_ar:        `سماء صافية (${cc}%)`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Validator 2: Spatial Coverage Quality
// ─────────────────────────────────────────────────────────────────────────────

function validateSpatialCoverage(obs: SceneObservation): ValidationFinding {
  const px = obs.crop.project_px_count;

  if (px < PHYSICS.MIN_SPATIAL_RELIABLE) {
    return {
      validator:        'spatial',
      status:           'DOWNGRADED',
      reason:           `project_pixels=${px}<16`,
      confidence_delta: -(1 - px / PHYSICS.MIN_SPATIAL_RELIABLE) * 0.5,
      is_blocking:      false,
      detail_ar:        `المشروع يحتل ${px} pixels فقط في الـ thumbnail — موثوقية منخفضة جداً`,
    };
  }
  if (px < PHYSICS.MIN_SPATIAL_DEGRADE) {
    const ratio = px / PHYSICS.MIN_SPATIAL_DEGRADE;
    return {
      validator:        'spatial',
      status:           'DOWNGRADED',
      reason:           `project_pixels=${px}<64`,
      confidence_delta: -(1 - ratio) * 0.25,
      is_blocking:      false,
      detail_ar:        `المشروع يحتل ${px} pixels — دقة مكانية محدودة`,
    };
  }
  return {
    validator:        'spatial',
    status:           'ACCEPTED',
    reason:           `project_pixels=${px}≥64`,
    confidence_delta: Math.min(0.1, (px - 64) / 2000),
    is_blocking:      false,
    detail_ar:        `تغطية مكانية كافية: ${px} pixels`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Validator 3: Image Quality (brightness, contrast)
// ─────────────────────────────────────────────────────────────────────────────

function validateImageQuality(obs: SceneObservation): ValidationFinding {
  const { mean_luminance, std_luminance } = obs.features;

  if (mean_luminance > PHYSICS.BRIGHTNESS_CLOUD_MIN) {
    return {
      validator:        'quality',
      status:           'REJECTED',
      reason:           `brightness=${mean_luminance.toFixed(2)}>0.80`,
      confidence_delta: -1.0,
      is_blocking:      true,
      detail_ar:        `سطوع مرتفع جداً (${(mean_luminance*100).toFixed(0)}%) — احتمال سحاب أو تشبع`,
    };
  }
  if (mean_luminance < PHYSICS.BRIGHTNESS_NIGHT_MAX) {
    return {
      validator:        'quality',
      status:           'REJECTED',
      reason:           `brightness=${mean_luminance.toFixed(2)}<0.05`,
      confidence_delta: -1.0,
      is_blocking:      true,
      detail_ar:        `سطوع منخفض جداً (${(mean_luminance*100).toFixed(0)}%) — صورة مظلمة أو فاسدة`,
    };
  }
  if (std_luminance < 0.02) {
    return {
      validator:        'quality',
      status:           'DOWNGRADED',
      reason:           `low_contrast:std=${std_luminance.toFixed(3)}`,
      confidence_delta: -0.20,
      is_blocking:      false,
      detail_ar:        `تباين منخفض — الصورة قد تكون رتيبة أو ملبَّدة`,
    };
  }

  const [lo, hi] = PHYSICS.BRIGHTNESS_IDEAL;
  const inIdeal = mean_luminance >= lo && mean_luminance <= hi;
  return {
    validator:        'quality',
    status:           'ACCEPTED',
    reason:           `brightness=${mean_luminance.toFixed(2)},std=${std_luminance.toFixed(3)}`,
    confidence_delta: inIdeal ? +0.05 : 0,
    is_blocking:      false,
    detail_ar:        `جودة الصورة جيدة`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Validator 4: Temporal Gap
// ─────────────────────────────────────────────────────────────────────────────

function validateTemporalGap(obs: SceneObservation): ValidationFinding {
  const gap = obs.gap_days_from_prev;

  if (gap === 0) {
    return { validator:'temporal_gap', status:'ACCEPTED', reason:'first_scene',
      confidence_delta:0, is_blocking:false, detail_ar:'أول مشهد — لا مقارنة زمنية' };
  }
  if (gap > PHYSICS.MAX_GAP_DAYS) {
    // Gap too large: comparison is not meaningful across seasons
    return {
      validator:        'temporal_gap',
      status:           'DOWNGRADED',
      reason:           `gap=${gap}d>90d`,
      confidence_delta: -0.30,
      is_blocking:      false,
      detail_ar:        `فجوة زمنية كبيرة (${gap} يوم) — قد تعكس تغيرات موسمية لا إنشائية`,
    };
  }
  if (gap > PHYSICS.WARN_GAP_DAYS) {
    return {
      validator:        'temporal_gap',
      status:           'DOWNGRADED',
      reason:           `gap=${gap}d>21d`,
      confidence_delta: -0.10,
      is_blocking:      false,
      detail_ar:        `فجوة ${gap} يوم — مقبولة مع تحفظ`,
    };
  }
  const bonus = gap <= 5 ? +0.05 : 0;
  return {
    validator:        'temporal_gap',
    status:           'ACCEPTED',
    reason:           `gap=${gap}d≤21d`,
    confidence_delta: bonus,
    is_blocking:      false,
    detail_ar:        `فجوة زمنية مناسبة (${gap} يوم)`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Validator 5: Temporal Feature Consistency
//  (detects implausible single-day jumps in features)
// ─────────────────────────────────────────────────────────────────────────────

function validateTemporalConsistency(
  obs:      SceneObservation,
  prevFeatures: PixelFeatures | null,
): ValidationFinding {
  if (!prevFeatures || obs.gap_days_from_prev === 0) {
    return { validator:'temporal_consistency', status:'ACCEPTED', reason:'no_prev',
      confidence_delta:0, is_blocking:false, detail_ar:'لا سجل سابق' };
  }

  const gap = Math.max(1, obs.gap_days_from_prev);
  const violations: string[] = [];
  let maxViolation = 0;

  for (const [key, limit] of Object.entries(PHYSICS.MAX_DAILY_CHANGE)) {
    const curr = (obs.features as any)[key] ?? 0;
    const prev = (prevFeatures as any)[key] ?? 0;
    const dailyChange = Math.abs(curr - prev) / gap;
    if (dailyChange > limit) {
      violations.push(`${key}:${dailyChange.toFixed(3)}/d>${limit}`);
      maxViolation = Math.max(maxViolation, dailyChange / limit);
    }
  }

  if (maxViolation > 3) {
    return {
      validator:        'temporal_consistency',
      status:           'REJECTED',
      reason:           `extreme_jump:${violations[0]}`,
      confidence_delta: -1.0,
      is_blocking:      true,
      detail_ar:        `قفزة مفاجئة مستحيلة فيزيائياً: ${violations.slice(0,2).join(', ')}`,
    };
  }
  if (violations.length > 0) {
    return {
      validator:        'temporal_consistency',
      status:           'DOWNGRADED',
      reason:           `rapid_change:${violations.slice(0,2).join(';')}`,
      confidence_delta: -0.20 * Math.min(1, maxViolation - 1),
      is_blocking:      false,
      detail_ar:        `تغيير سريع في ${violations.length} ميزة — قد يعكس تغير الإضاءة`,
    };
  }
  return {
    validator:        'temporal_consistency',
    status:           'ACCEPTED',
    reason:           'consistent',
    confidence_delta: 0,
    is_blocking:      false,
    detail_ar:        'التغيير الزمني ضمن الحدود الطبيعية',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Validator 6: Statistical Anomaly Detection
//  (z-score against rolling 90-day window)
// ─────────────────────────────────────────────────────────────────────────────

function validateStatisticalAnomaly(
  obs:     SceneObservation,
  history: SceneObservation[],
): ValidationFinding {
  if (history.length < 5) {
    return { validator:'statistical', status:'ACCEPTED', reason:'insufficient_history',
      confidence_delta:0, is_blocking:false, detail_ar:'سجل تاريخي غير كافٍ للكشف الإحصائي' };
  }

  // Use mean_luminance as representative scalar
  const values = history.slice(-20).map(h => h.features.mean_luminance);
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const s = Math.sqrt(values.reduce((a, v) => a + (v - m) * (v - m), 0) / values.length);
  const z = s > 0 ? Math.abs(obs.features.mean_luminance - m) / s : 0;

  if (z > 4.0) {
    return {
      validator:        'statistical',
      status:           'REJECTED',
      reason:           `z_score=${z.toFixed(1)}>4`,
      confidence_delta: -1.0,
      is_blocking:      true,
      detail_ar:        `قيمة شاذة للغاية (z=${z.toFixed(1)}) — احتمال خطأ في البيانات`,
    };
  }
  if (z > 2.5) {
    return {
      validator:        'statistical',
      status:           'DOWNGRADED',
      reason:           `z_score=${z.toFixed(1)}>2.5`,
      confidence_delta: -0.20,
      is_blocking:      false,
      detail_ar:        `قيمة غير اعتيادية (z=${z.toFixed(1)}) — تحتاج مراجعة`,
    };
  }
  return {
    validator:        'statistical',
    status:           'ACCEPTED',
    reason:           `z_score=${z.toFixed(2)}`,
    confidence_delta: z < 1.0 ? +0.03 : 0,
    is_blocking:      false,
    detail_ar:        `القيم ضمن النطاق الإحصائي الطبيعي`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Validator 7: Seasonal Context (Libya-specific)
//  Flags observations that are unusually bright in summer (Saharan haze)
// ─────────────────────────────────────────────────────────────────────────────

function validateSeasonalContext(obs: SceneObservation): ValidationFinding {
  const month = new Date(obs.scan_date).getMonth(); // 0-indexed
  const isDrySeason = [3, 4, 5, 6, 7, 8].includes(month); // Apr-Sep
  const lum = obs.features.mean_luminance;

  // Libya summer: high reflectance from sand/haze is expected
  // Flag if luminance is extremely high and it's not summer
  if (!isDrySeason && lum > 0.70) {
    return {
      validator:        'seasonal',
      status:           'DOWNGRADED',
      reason:           `high_lum_non_summer:${lum.toFixed(2)}`,
      confidence_delta: -0.15,
      is_blocking:      false,
      detail_ar:        `سطوع مرتفع (${(lum*100).toFixed(0)}%) في غير موسم الصيف — احتمال ضباب`,
    };
  }
  return {
    validator:        'seasonal',
    status:           'ACCEPTED',
    reason:           `month=${month+1},lum=${lum.toFixed(2)}`,
    confidence_delta: 0,
    is_blocking:      false,
    detail_ar:        'متسق مع السياق الموسمي لطرابلس',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Confidence Aggregator — combines all findings into final verdict
// ─────────────────────────────────────────────────────────────────────────────

function aggregateFindings(
  findings:        ValidationFinding[],
  baseConfidence:  number,
): { status: ValidationStatus; confidence: number; reason?: string } {

  const blocking = findings.find(f => f.is_blocking && f.status === 'REJECTED');
  if (blocking) {
    return { status: 'REJECTED', confidence: 0, reason: blocking.reason };
  }

  const totalDelta = findings.reduce((sum, f) => sum + f.confidence_delta, 0);
  const adjusted   = Math.max(0.01, Math.min(1, baseConfidence + totalDelta));

  const hasFlagged    = findings.some(f => f.status === 'REJECTED');
  const hasDowngraded = findings.some(f => f.status === 'DOWNGRADED');

  const status: ValidationStatus = hasFlagged ? 'REJECTED'
    : hasDowngraded ? 'DOWNGRADED' : 'ACCEPTED';

  return { status, confidence: adjusted };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API — SignalValidationEngine
// ─────────────────────────────────────────────────────────────────────────────

export class SignalValidationEngine {

  validate(
    obs:          SceneObservation,
    history:      SceneObservation[],
    prevFeatures: PixelFeatures | null,
  ): ValidatedObservation {

    // Base confidence starts at 0.80 — good default for clear-sky Planet scenes
    const baseConf = 0.80;

    const findings: ValidationFinding[] = [
      validateCloud(obs),
      validateSpatialCoverage(obs),
      validateImageQuality(obs),
      validateTemporalGap(obs),
      validateTemporalConsistency(obs, prevFeatures),
      validateStatisticalAnomaly(obs, history),
      validateSeasonalContext(obs),
    ];

    const agg = aggregateFindings(findings, baseConf);

    const accepted   = findings.filter(f => f.status === 'ACCEPTED');
    const downgraded = findings.filter(f => f.status === 'DOWNGRADED');
    const rejected   = findings.filter(f => f.status === 'REJECTED' || f.is_blocking);

    const summary_ar = agg.status === 'REJECTED'
      ? `مرفوض: ${rejected.map(f => f.detail_ar).join(' | ')}`
      : agg.status === 'DOWNGRADED'
        ? `مقبول بتحفظ (ثقة ${(agg.confidence * 100).toFixed(0)}%): ${downgraded.map(f => f.detail_ar).join(' | ')}`
        : `مقبول (ثقة ${(agg.confidence * 100).toFixed(0)}%) — ${accepted.length}/7 اختبارات نجحت`;

    const result: ValidationResult = {
      final_status:       agg.status,
      final_confidence:   agg.confidence,
      findings,
      rejection_reason:   agg.reason,
      quality_summary_ar: summary_ar,
    };

    return {
      ...obs,
      validation: result,
      is_usable:  agg.status !== 'REJECTED',
    };
  }

  /** Batch validation — maintains rolling history for temporal checks */
  validateBatch(observations: SceneObservation[]): ValidatedObservation[] {
    const results: ValidatedObservation[] = [];
    const acceptedHistory: SceneObservation[] = [];

    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i];
      const prevValid = acceptedHistory.length > 0
        ? acceptedHistory[acceptedHistory.length - 1]
        : null;

      const prevFeatures = prevValid?.features ?? null;
      const validated    = this.validate(obs, acceptedHistory.slice(-20), prevFeatures);

      results.push(validated);
      if (validated.is_usable) acceptedHistory.push(obs);
    }

    return results;
  }
}
