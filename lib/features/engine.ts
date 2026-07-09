/**
 * lib/features/engine.ts
 * Physical Feature Extraction Engine — Phase 3
 *
 * Transforms validated pixel observations into physically-meaningful
 * construction features. No reasoning code touches raw pixels —
 * only these features.
 *
 * Every feature has:
 * - A physical meaning (what it measures in the real world)
 * - A scientific basis (why this pixel pattern maps to this phenomenon)
 * - Documented limitations (when it can be wrong)
 * - Confidence propagation from SVQE
 *
 * Feature values are always 0-1:
 *   0 = phenomenon absent
 *   1 = phenomenon fully present
 */

import type { PixelFeatures } from '@/lib/sal/adapters/planet';
import type { ValidatedObservation } from '@/lib/svqe/engine';

// ─────────────────────────────────────────────────────────────────────────────
//  Feature Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ConstructionFeature {
  name:           string;
  value:          number;        // 0-1
  confidence:     number;        // inherited + adjusted
  physical_meaning: string;      // what does this measure?
  interpretation_ar: string;     // Arabic explanation of current value
  supporting:     string[];      // pixel signals that support this
  limiting:       string[];      // known limitations in this observation
}

export interface FeatureBundle {
  scene_id:           string;
  date:               string;
  validation_status:  string;
  base_confidence:    number;
  // Core construction features
  construction_disturbance:  ConstructionFeature;  // is there active construction?
  surface_stability:         ConstructionFeature;  // is the surface stable/done?
  surface_exposure:          ConstructionFeature;  // bare earth / excavation
  vegetation_change:         ConstructionFeature;  // clearing or recovery
  linear_structure:          ConstructionFeature;  // roads, walls, foundations
  activity_persistence:      ConstructionFeature;  // is this activity sustained?
  // Derived
  construction_activity_index: number;  // 0-1 weighted combination
  confidence_weighted_index:   number;  // CAI × mean confidence
}

export interface TemporalFeatureRecord {
  date:    string;
  bundle:  FeatureBundle;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Individual Feature Computations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CONSTRUCTION DISTURBANCE
 *
 * Physical meaning: Is there active construction/excavation happening?
 *
 * Scientific basis:
 * - High surface roughness (std_luminance) → varied materials, machinery
 * - High entropy → disordered surface texture = construction chaos
 * - Low vegetation → cleared area
 * - High soil exposure → earth moved
 *
 * Limitations: Desert sand areas naturally high in bare soil & brightness
 */
function computeConstructionDisturbance(f: PixelFeatures, conf: number): ConstructionFeature {
  // Libya-specific baseline: desert has high bare soil naturally
  // Construction adds: high std_luminance, high entropy, AND edge activity
  const raw = Math.min(1,
    f.std_luminance   * 0.40 +  // varied materials/shadows
    f.entropy         * 0.30 +  // disordered texture
    f.edge_density    * 0.20 +  // structural edges
    f.bare_soil_proxy * 0.10    // exposed earth (less weight — desert baseline)
  );

  const val = Math.round(raw * 100) / 100;
  const interp = val >= 0.60
    ? `نشاط إنشائي مرتفع (${(val*100).toFixed(0)}%)`
    : val >= 0.30
      ? `نشاط إنشائي معتدل (${(val*100).toFixed(0)}%)`
      : val >= 0.10
        ? `نشاط إنشائي خفيف (${(val*100).toFixed(0)}%)`
        : `لا نشاط إنشائي واضح (${(val*100).toFixed(0)}%)`;

  return {
    name:              'construction_disturbance',
    value:             val,
    confidence:        conf,
    physical_meaning:  'Active construction/excavation presence',
    interpretation_ar: interp,
    supporting:        ['std_luminance', 'entropy', 'edge_density'],
    limiting:          ['Desert sand mimics bare soil', 'Shadow patterns vary by sun angle'],
  };
}

/**
 * SURFACE STABILITY
 *
 * Physical meaning: Is the project surface stable (completed / not changing)?
 *
 * Scientific basis:
 * - Low entropy → uniform surface (asphalt, concrete)
 * - High contrast with low variance → finished material with regular edges
 * - Low bare soil → covered surface
 *
 * Inverted relationship: high stability = low disturbance + consistent surface
 */
function computeSurfaceStability(f: PixelFeatures, conf: number): ConstructionFeature {
  // Stability = inverse of disorder + consistent luminance
  const disorder  = f.entropy + f.std_luminance + f.bare_soil_proxy;
  const uniformity = Math.max(0, 1 - (disorder / 2));
  const val        = Math.round(uniformity * 100) / 100;

  const interp = val >= 0.70
    ? `سطح مستقر ومكتمل (${(val*100).toFixed(0)}%) — مرحلة تشطيب أو اكتمال`
    : val >= 0.40
      ? `استقرار جزئي (${(val*100).toFixed(0)}%)`
      : `سطح غير مستقر (${(val*100).toFixed(0)}%) — أعمال جارية`;

  return {
    name:              'surface_stability',
    value:             val,
    confidence:        conf,
    physical_meaning:  'Completed / stable surface fraction',
    interpretation_ar: interp,
    supporting:        ['entropy_inverse', 'std_luminance_inverse'],
    limiting:          ['Temporary parking/storage can show false stability'],
  };
}

/**
 * SURFACE EXPOSURE (Excavation Indicator)
 *
 * Physical meaning: Fraction of area with exposed bare earth/soil
 *
 * Scientific basis:
 * - high bare_soil_proxy + high red_mean → exposed reddish earth
 * - Excavation removes vegetation and exposes subsoil
 * - Libya ground is naturally beige/reddish → calibrated for local soil color
 *
 * Limitations: Background desert areas will always score moderately
 */
function computeSurfaceExposure(f: PixelFeatures, conf: number): ConstructionFeature {
  // Soil exposure: bare soil proxy weighted by red-dominance
  const soilSignal = f.bare_soil_proxy;
  const redSignal  = Math.max(0, f.red_mean - f.green_mean) * 2;  // red dominance
  const val        = Math.min(1, Math.round((soilSignal * 0.6 + redSignal * 0.4) * 100) / 100);

  const interp = val >= 0.60
    ? `تربة مكشوفة بكثافة — حفر أو تسوية أرضية`
    : val >= 0.30
      ? `تربة مكشوفة جزئياً`
      : `السطح مغطى (نباتات أو مبنى أو رصف)`;

  return {
    name:              'surface_exposure',
    value:             val,
    confidence:        conf * 0.85,  // lower — Libya desert baseline affects this
    physical_meaning:  'Bare earth / excavation presence',
    interpretation_ar: interp,
    supporting:        ['bare_soil_proxy', 'red_mean'],
    limiting:          ['Libya desert baseline is naturally high in soil color'],
  };
}

/**
 * VEGETATION CHANGE
 *
 * Physical meaning: Vegetation presence (positive = green, negative = cleared)
 *
 * Scientific basis:
 * - vegetation_proxy ≈ (G-R)/(G+R) — rough NDVI from visible bands
 * - Positive = healthy vegetation present
 * - Decrease over time = site clearing or drought
 * - Increase = recovery (possible abandonment signal)
 *
 * Limitations: No NIR band → proxy accuracy ±0.25
 */
function computeVegetationChange(f: PixelFeatures, conf: number): ConstructionFeature {
  // Normalize from [-0.3, 0.5] to [0, 1] (typical Libya range)
  const normalized = Math.min(1, Math.max(0, (f.vegetation_proxy + 0.3) / 0.8));
  const val        = Math.round(normalized * 100) / 100;

  const interp = val >= 0.60
    ? `غطاء نباتي كثيف — لا إنشاء هنا حالياً`
    : val >= 0.35
      ? `غطاء نباتي معتدل`
      : val >= 0.15
        ? `نباتات خفيفة — موقع شبه جرداء`
        : `لا نباتات — أرض مكشوفة أو مبنية`;

  return {
    name:              'vegetation_activity',
    value:             val,
    confidence:        conf * 0.75,  // lower — proxy without NIR
    physical_meaning:  'Vegetation cover fraction (NDVI-proxy)',
    interpretation_ar: interp,
    supporting:        ['green_mean', 'vegetation_proxy'],
    limiting:          ['No NIR band — uncertainty ±0.25', 'Seasonal variation significant'],
  };
}

/**
 * LINEAR STRUCTURE DETECTION
 *
 * Physical meaning: Presence of linear construction elements
 * (roads, foundations, walls, pipeline trenches)
 *
 * Scientific basis:
 * - High edge_density → many sharp boundaries
 * - High contrast → structural edges between materials
 * - Medium brightness with high edges → constructed surfaces
 *
 * Key for road projects: long linear edges detected = road base/asphalt
 */
function computeLinearStructure(f: PixelFeatures, conf: number): ConstructionFeature {
  // Linear construction: edges + contrast + not too vegetated
  const edgeSignal    = f.edge_density;
  const contrastSig   = f.contrast;
  const noVeg         = Math.max(0, 0.3 - f.vegetation_proxy);  // more weight if no green
  const val = Math.min(1, Math.round((
    edgeSignal  * 0.45 +
    contrastSig * 0.35 +
    noVeg       * 0.20
  ) * 100) / 100);

  const interp = val >= 0.60
    ? `هياكل خطية قوية — طريق أو أساسات أو أسوار`
    : val >= 0.35
      ? `هياكل خطية متوسطة`
      : `هياكل خطية ضعيفة`;

  return {
    name:              'linear_structure',
    value:             val,
    confidence:        conf,
    physical_meaning:  'Linear construction elements (roads, walls, foundations)',
    interpretation_ar: interp,
    supporting:        ['edge_density', 'contrast'],
    limiting:          ['Shadow patterns can create false linear signals'],
  };
}

/**
 * ACTIVITY PERSISTENCE
 * (requires temporal context — compares to rolling mean)
 *
 * Physical meaning: Is the observed activity level sustained over time?
 *
 * High construction disturbance + temporal consistency = real project activity
 * High disturbance on single scene = could be noise
 */
function computeActivityPersistence(
  current:  PixelFeatures,
  history:  PixelFeatures[],
  conf:     number,
): ConstructionFeature {
  if (history.length < 3) {
    return {
      name: 'activity_persistence', value: 0.5, confidence: conf * 0.5,
      physical_meaning: 'Temporal consistency of activity',
      interpretation_ar: 'بيانات تاريخية غير كافية للتحقق من الاستمرارية',
      supporting: [], limiting: ['Needs ≥3 historical observations'],
    };
  }

  const histMean_std = history.slice(-5).reduce((s, h) => s + h.std_luminance, 0) / Math.min(5, history.length);
  const histMean_ent = history.slice(-5).reduce((s, h) => s + h.entropy, 0) / Math.min(5, history.length);

  // How consistent is current with recent history?
  const stdConsistency = 1 - Math.min(1, Math.abs(current.std_luminance - histMean_std) * 5);
  const entConsistency = 1 - Math.min(1, Math.abs(current.entropy - histMean_ent) * 5);
  const val = Math.round((stdConsistency * 0.5 + entConsistency * 0.5) * 100) / 100;

  const interp = val >= 0.70
    ? `نشاط متسق تاريخياً — حقيقي وليس ضوضاء`
    : val >= 0.40
      ? `اتساق متوسط`
      : `نشاط غير متسق — قد يكون تغيير مؤقت`;

  return {
    name:              'activity_persistence',
    value:             val,
    confidence:        conf,
    physical_meaning:  'Consistency of activity signal over time',
    interpretation_ar: interp,
    supporting:        ['std_luminance_history', 'entropy_history'],
    limiting:          ['Only uses last 5 observations'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Construction Activity Index (CAI)
//  Weighted combination of all features — represents overall construction state
// ─────────────────────────────────────────────────────────────────────────────

function computeCAI(bundle: Omit<FeatureBundle, 'construction_activity_index' | 'confidence_weighted_index'>): number {
  const { construction_disturbance: cd, surface_stability: ss, surface_exposure: se,
          linear_structure: ls, activity_persistence: ap } = bundle;

  // CAI increases when:
  // - disturbance is high (active work)
  // - stability is low (not yet done)
  // - exposure is moderate (earth moved but not all concrete yet)
  // - linear structure is present (roads/walls being built)
  // - activity is persistent (not just a single noisy scene)

  return Math.min(1, Math.max(0, Math.round((
    cd.value   * 0.35 +        // most important: is there disturbance?
    (1-ss.value) * 0.20 +     // unstable surface = work in progress
    se.value   * 0.15 +        // exposed earth = excavation/foundation
    ls.value   * 0.20 +        // linear structure = infrastructure
    ap.value   * 0.10          // persistence confirms it's real
  ) * 100) / 100));
}

// ─────────────────────────────────────────────────────────────────────────────
//  FeatureEngine — main entry point
// ─────────────────────────────────────────────────────────────────────────────

export class FeatureEngine {

  extract(
    validated:    ValidatedObservation,
    pixelHistory: PixelFeatures[],
  ): FeatureBundle {
    const f    = validated.features;
    const conf = validated.validation.final_confidence;

    const cd = computeConstructionDisturbance(f, conf);
    const ss = computeSurfaceStability(f, conf);
    const se = computeSurfaceExposure(f, conf);
    const vc = computeVegetationChange(f, conf);
    const ls = computeLinearStructure(f, conf);
    const ap = computeActivityPersistence(f, pixelHistory, conf);

    const partial = {
      scene_id:          validated.scene_id,
      date:              validated.scan_date,
      validation_status: validated.validation.final_status,
      base_confidence:   conf,
      construction_disturbance:  cd,
      surface_stability:         ss,
      surface_exposure:          se,
      vegetation_change:         vc,
      linear_structure:          ls,
      activity_persistence:      ap,
    };

    const cai  = computeCAI(partial);
    const cwi  = cai * conf;  // confidence-weighted index

    return { ...partial, construction_activity_index: cai, confidence_weighted_index: cwi };
  }

  extractBatch(
    validated: ValidatedObservation[],
  ): TemporalFeatureRecord[] {
    const records: TemporalFeatureRecord[] = [];
    const pixelHistory: PixelFeatures[] = [];

    for (const obs of validated) {
      if (!obs.is_usable) {
        // Don't extract from rejected observations, but note the gap
        continue;
      }
      const bundle = this.extract(obs, pixelHistory);
      records.push({ date: obs.scan_date, bundle });
      pixelHistory.push(obs.features);
      if (pixelHistory.length > 30) pixelHistory.shift(); // rolling window
    }

    return records;
  }
}
