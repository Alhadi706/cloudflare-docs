// ─── Area Statistical Intelligence Engine ────────────────────────────────────
// Pure TypeScript computation module — no React, no API calls.
// Combines polygon geometry + scene indicator data into a structured
// human-readable area intelligence summary.
//
// Design principle: Every value must carry a value_type label so the UI
// can be transparent about what is measured vs inferred vs estimated.

import type { SceneSummaryContract } from './satelliteIntelAPI';
import type { AreaReport } from './areaReportAPI';
import type { ZonalStatsResult } from './zonalStatsAPI';
import type { ObjectExtractionResult } from './objectExtractionAPI';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValueType =
  | 'observed'           // directly computed from geometry / verified data
  | 'interpreted'        // derived from spectral indicators — proxy, not surveyed
  | 'estimated'          // model/rule-based estimate, not ground truth
  | 'requires_validation'; // low confidence, field check recommended

export interface AreaMetric {
  id:         string;
  label:      string;
  value:      string;
  unit?:      string;
  value_type: ValueType;
  note?:      string;
}

export interface AreaMetricGroup {
  id:      string;
  title:   string;
  metrics: AreaMetric[];
}

export interface AreaRecommendation {
  id:           string;
  title:        string;
  explanation:  string;
  severity:     'critical' | 'high' | 'medium' | 'low' | 'info';
  department?:  string;
  trigger_rule: string;
}

export interface LightSignal {
  id:        string;
  label:     string;
  icon_hint: 'vegetation' | 'water' | 'urban' | 'thermal' | 'geometry';
  status:    'good' | 'neutral' | 'caution' | 'alert';
  brief:     string; // short Arabic descriptor
}

export interface AreaIntelResult {
  polygon:      [number, number][];
  area_m2:      number;
  area_km2:     number;
  perimeter_km: number;
  bbox:         [number, number, number, number];
  centroid:     [number, number];
  computed_at:  string;
  scene_uid:    string | null;
  has_scene_data: boolean;
  light_signals:   LightSignal[];
  groups:          AreaMetricGroup[];
  recommendations: AreaRecommendation[];
  quality: {
    data_type:  'real' | 'simulated' | 'none';
    confidence: 'high' | 'medium' | 'low';
    analysis_score: number;
    indicator_agreement: 'high' | 'medium' | 'low';
    notes:      string[];
  };
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

const EARTH_R = 6371000; // metres

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function computeAreaM2(coords: [number, number][]): number {
  const n = coords.length;
  if (n < 3) return 0;
  const meanLat = coords.reduce((s, c) => s + c[1], 0) / n;
  const cosLat = Math.cos((meanLat * Math.PI) / 180);
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[(i + 1) % n];
    const x1 = (lon1 * Math.PI * EARTH_R * cosLat) / 180;
    const y1 = (lat1 * Math.PI * EARTH_R) / 180;
    const x2 = (lon2 * Math.PI * EARTH_R * cosLat) / 180;
    const y2 = (lat2 * Math.PI * EARTH_R) / 180;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function computePerimeterKm(coords: [number, number][]): number {
  const n = coords.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const [lo1, la1] = coords[i];
    const [lo2, la2] = coords[(i + 1) % n];
    total += haversineKm(lo1, la1, lo2, la2);
  }
  return total;
}

// ─── Number formatters ────────────────────────────────────────────────────────

function fmtArea(m2: number): { value: string; unit: string } {
  if (m2 >= 1_000_000) return { value: (m2 / 1_000_000).toFixed(2), unit: 'كم²' };
  if (m2 >= 10_000)    return { value: (m2 / 10_000).toFixed(1),    unit: 'هكتار' };
  return { value: m2.toFixed(0), unit: 'م²' };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

// ─── Indicator extraction helper ──────────────────────────────────────────────

type IndicatorMap = Record<string, { mean: number; verdict: string; label: string }>;

function extractIndicators(summary: SceneSummaryContract): IndicatorMap {
  const map: IndicatorMap = {};
  for (const ind of summary.indicators) {
    map[ind.indicator_type] = {
      mean:    ind.mean,
      verdict: ind.validity.verdict,
      label:   ind.interpretation?.label ?? '',
    };
  }
  return map;
}

function normalizedVegetationStrength(ind: IndicatorMap): number | null {
  const ndvi = ind['ndvi']?.verdict !== 'suppressed' ? clamp01((ind['ndvi'].mean + 0.1) / 0.7) : null;
  const savi = ind['savi']?.verdict !== 'suppressed' ? clamp01((ind['savi'].mean + 0.05) / 0.75) : null;
  const evi = ind['evi']?.verdict !== 'suppressed' ? clamp01((ind['evi'].mean + 0.05) / 0.65) : null;
  return average([
    typeof ndvi === 'number' ? ndvi * 0.5 : null,
    typeof savi === 'number' ? savi * 0.3 : null,
    typeof evi === 'number' ? evi * 0.2 : null,
  ]);
}

function normalizedUrbanStrength(ind: IndicatorMap): number | null {
  const ndbi = ind['ndbi']?.verdict !== 'suppressed' ? clamp01((ind['ndbi'].mean + 0.2) / 0.6) : null;
  const bsi = ind['bsi']?.verdict !== 'suppressed' ? clamp01((ind['bsi'].mean + 0.2) / 0.8) : null;
  const invNdvi = ind['ndvi']?.verdict !== 'suppressed' ? clamp01(1 - ((ind['ndvi'].mean + 0.1) / 0.7)) : null;
  return average([
    typeof ndbi === 'number' ? ndbi * 0.5 : null,
    typeof bsi === 'number' ? bsi * 0.25 : null,
    typeof invNdvi === 'number' ? invNdvi * 0.25 : null,
  ]);
}

function deriveIndicatorAgreement(ind: IndicatorMap): { score: number; level: 'high' | 'medium' | 'low' } {
  const vegetation = normalizedVegetationStrength(ind);
  const urban = normalizedUrbanStrength(ind);
  const water = ind['mndwi']?.verdict !== 'suppressed'
    ? clamp01((ind['mndwi'].mean + 0.2) / 0.8)
    : ind['ndwi']?.verdict !== 'suppressed'
      ? clamp01((ind['ndwi'].mean + 0.2) / 0.8)
      : null;

  const checks: number[] = [];
  if (typeof vegetation === 'number' && ind['ndvi']?.verdict !== 'suppressed') {
    checks.push(1 - Math.abs(vegetation - clamp01((ind['ndvi'].mean + 0.1) / 0.7)));
  }
  if (typeof urban === 'number' && ind['ndbi']?.verdict !== 'suppressed') {
    checks.push(1 - Math.abs(urban - clamp01((ind['ndbi'].mean + 0.2) / 0.6)));
  }
  if (typeof vegetation === 'number' && typeof urban === 'number') {
    checks.push(1 - clamp01(Math.max(0, vegetation + urban - 1)));
  }
  if (typeof water === 'number' && typeof urban === 'number') {
    checks.push(1 - clamp01(Math.max(0, water + urban - 1.1)));
  }

  const score = Math.round((average(checks) ?? 0.45) * 100);
  return {
    score,
    level: score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low',
  };
}

function deriveAoiSuitability(area_km2: number, perimeter_km: number): number {
  const area_m2 = Math.max(area_km2 * 1_000_000, 1);
  const compactness = (4 * Math.PI * area_m2) / Math.max((perimeter_km * 1000) ** 2, 1);
  const areaScore = area_km2 < 0.03 ? 45 : area_km2 < 0.15 ? 62 : area_km2 < 8 ? 85 : 72;
  const shapeScore = compactness > 0.6 ? 90 : compactness > 0.35 ? 75 : compactness > 0.18 ? 58 : 42;
  return Math.round((areaScore * 0.55) + (shapeScore * 0.45));
}

function deriveZonalEvidence(
  zonalStats: ZonalStatsResult | null,
  objectExtraction: ObjectExtractionResult | null,
  areaReport: AreaReport | null,
  ind: IndicatorMap,
): { score: number; level: 'high' | 'medium' | 'low'; notes: string[] } {
  if (objectExtraction) {
    const signals: number[] = [];
    const buildingsPerKm2 = objectExtraction.densities?.buildings_per_km2;

    if (typeof buildingsPerKm2 === 'number' && ind['ndbi']?.verdict !== 'suppressed') {
      const urbanProxy = clamp01((ind['ndbi'].mean + 0.2) / 0.6);
      const densityProxy = clamp01(buildingsPerKm2 / 4500);
      signals.push(Math.max(0, 100 - (Math.abs(urbanProxy - densityProxy) * 100)));
    }

    const extractionScore = objectExtraction.extraction_quality?.average_score;
    if (typeof extractionScore === 'number') {
      signals.push(clamp01(extractionScore) * 100);
    }

    const base = average(signals) ?? (objectExtraction.source_mode === 'backend-object-extraction' ? 86 : 70);
    const sourceBoost = objectExtraction.source_mode === 'backend-object-extraction' ? 1.08 : 0.98;
    const score = Math.max(45, Math.min(99, Math.round(base * sourceBoost)));

    return {
      score,
      level: score >= 78 ? 'high' : score >= 58 ? 'medium' : 'low',
      notes: [
        `مصدر المجسمات: ${objectExtraction.source_mode === 'backend-object-extraction' ? 'object-extraction backend' : 'area-report fallback'}`,
        `جودة الاستخراج: ${typeof extractionScore === 'number' ? `${Math.round(clamp01(extractionScore) * 100)}%` : 'غير متاح'}`,
        ...(objectExtraction.notes ?? []),
      ],
    };
  }

  if (zonalStats && zonalStats.stats) {
    const stats = zonalStats.stats;
    const signals: number[] = [];

    if (typeof stats.vegetation_pct === 'number' && ind['ndvi']?.verdict !== 'suppressed') {
      const ndviToPct = clamp01((ind['ndvi'].mean + 0.1) / 0.7) * 100;
      signals.push(Math.max(0, 100 - Math.abs(stats.vegetation_pct - ndviToPct)));
    }

    if (typeof stats.buildings_density_km2 === 'number' && ind['ndbi']?.verdict !== 'suppressed') {
      const urbanProxy = clamp01((ind['ndbi'].mean + 0.2) / 0.6);
      const densityProxy = clamp01(stats.buildings_density_km2 / 4500);
      signals.push(Math.max(0, 100 - (Math.abs(urbanProxy - densityProxy) * 100)));
    }

    const waterRef = ind['mndwi']?.verdict !== 'suppressed' ? ind['mndwi'] : ind['ndwi'];
    if (typeof stats.surface_water === 'boolean' && waterRef) {
      const waterLikely = waterRef.mean > 0.05;
      signals.push(waterLikely === stats.surface_water ? 92 : 58);
    }

    const base = average(signals) ?? (zonalStats.source_mode === 'backend-zonal' ? 82 : 66);
    const sourceBoost = zonalStats.source_mode === 'backend-zonal' ? 1.06 : 0.98;
    const score = Math.max(40, Math.min(98, Math.round(base * sourceBoost)));

    return {
      score,
      level: score >= 78 ? 'high' : score >= 58 ? 'medium' : 'low',
      notes: [
        `مصدر AOI: ${zonalStats.source_mode === 'backend-zonal' ? 'zonal-stats backend' : 'area-report fallback'}`,
        ...(zonalStats.notes ?? []),
      ],
    };
  }

  if (!areaReport) {
    return {
      score: 0,
      level: 'low',
      notes: ['لا توجد إحصاءات نطاقية AOI من تقرير المنطقة في هذه الدورة'],
    };
  }

  const env = areaReport.environment_summary;
  const est = areaReport.spatial_estimates;

  const signals: number[] = [];

  if (typeof env.vegetation_pct === 'number' && ind['ndvi']?.verdict !== 'suppressed') {
    const ndviToPct = clamp01(((ind['ndvi'].mean + 0.1) / 0.7)) * 100;
    const d = Math.abs(env.vegetation_pct - ndviToPct);
    signals.push(Math.max(0, 100 - d));
  }

  if (ind['ndbi']?.verdict !== 'suppressed') {
    const urbanProxy = clamp01((ind['ndbi'].mean + 0.2) / 0.6);
    const builtDensity = clamp01(est.buildings_count / Math.max(est.area_km2 * 4500, 1));
    signals.push(Math.max(0, 100 - (Math.abs(urbanProxy - builtDensity) * 100)));
  }

  if (ind['ndwi']?.verdict !== 'suppressed' || ind['mndwi']?.verdict !== 'suppressed') {
    const waterRef = ind['mndwi']?.verdict !== 'suppressed' ? ind['mndwi'] : ind['ndwi'];
    if (waterRef) {
      const waterLikely = waterRef.mean > 0.05 ? 1 : 0;
      const areaHasWater = env.surface_water ? 1 : 0;
      signals.push(waterLikely === areaHasWater ? 90 : 55);
    }
  }

  const sourceWeight = areaReport.meta?.data_source === 'satellite' ? 1 : 0.72;
  const base = Math.round((average(signals) ?? 62) * sourceWeight);
  const score = Math.max(35, Math.min(98, base));

  return {
    score,
    level: score >= 78 ? 'high' : score >= 58 ? 'medium' : 'low',
    notes: [
      `تم دمج Zonal AOI من التقرير (${areaReport.meta?.data_source ?? 'unknown-source'})`,
      `توافق غطاء النبات AOI/NDVI: ${typeof env.vegetation_pct === 'number' ? `${env.vegetation_pct.toFixed(1)}%` : 'غير متاح'}`,
      `كثافة مبانٍ نطاقية: ${est.buildings_count} مبنى في ${est.area_km2.toFixed(2)} كم²`,
    ],
  };
}

// ─── Metric group builders ────────────────────────────────────────────────────

function buildGeometryGroup(area_m2: number, perimeter_km: number): AreaMetricGroup {
  const a = fmtArea(area_m2);
  const compactness = (4 * Math.PI * area_m2) / (perimeter_km * 1000) ** 2;
  return {
    id: 'geometry',
    title: 'نظرة عامة على المنطقة',
    metrics: [
      { id: 'area', label: 'المساحة الإجمالية', value: a.value, unit: a.unit, value_type: 'observed' },
      { id: 'perim', label: 'المحيط', value: perimeter_km.toFixed(2), unit: 'كم', value_type: 'observed' },
      {
        id: 'shape',
        label: 'معامل التضاريس',
        value: compactness > 0.7 ? 'مدمج' : compactness > 0.4 ? 'متوسط' : 'ممتد',
        value_type: 'observed',
        note: 'مشتق من نسبة المساحة إلى المحيط',
      },
    ],
  };
}

function buildVegetationGroup(ind: IndicatorMap): AreaMetricGroup {
  const ndvi   = ind['ndvi'];
  const savi   = ind['savi'];
  const evi    = ind['evi'];
  const metrics: AreaMetric[] = [];

  if (ndvi && ndvi.verdict !== 'suppressed') {
    const v = ndvi.mean;
    const ctx =
      v > 0.5 ? 'غطاء نباتي كثيف' :
      v > 0.3 ? 'غطاء نباتي متوسط' :
      v > 0.1 ? 'غطاء نباتي خفيف' :
      'شبه معدوم الغطاء النباتي';
    metrics.push({
      id: 'ndvi_ctx',
      label: 'حالة الغطاء النباتي',
      value: ctx,
      value_type: 'interpreted',
      note: `NDVI = ${v.toFixed(3)} — مستقرأ من الأشعة تحت الحمراء القريبة والحمراء المرئية`,
    });
    const est = Math.max(0, Math.min(100, (normalizedVegetationStrength(ind) ?? ((v - 0.0) / 0.6)) * 100));
    metrics.push({
      id: 'veg_cover_est',
      label: 'تقدير نسبة الغطاء النباتي',
      value: `~${est.toFixed(0)}%`,
      value_type: 'estimated',
      note: 'مقدّر بناءً على قيمة NDVI — ليس مسحاً فعلياً',
    });
  }

  if (savi && savi.verdict !== 'suppressed') {
    metrics.push({
      id: 'savi',
      label: 'مؤشر الإجهاد النباتي (SAVI)',
      value: savi.mean.toFixed(3),
      value_type: 'interpreted',
      note: 'يأخذ بعين الاعتبار تأثير التربة — مناسب للمناطق الجافة',
    });
  }

  if (evi && evi.verdict !== 'suppressed') {
    metrics.push({
      id: 'evi',
      label: 'مؤشر النباتات المحسّن (EVI)',
      value: evi.mean.toFixed(3),
      value_type: 'interpreted',
    });
  }

  if (metrics.length === 0) {
    metrics.push({
      id: 'veg_na',
      label: 'البيانات النباتية',
      value: 'غير متوفرة أو موقوفة لهذا المشهد',
      value_type: 'requires_validation',
    });
  }

  return { id: 'vegetation', title: 'البيئة والغطاء النباتي', metrics };
}

function buildWaterGroup(ind: IndicatorMap): AreaMetricGroup {
  const ndwi  = ind['ndwi'];
  const mndwi = ind['mndwi'];
  const metrics: AreaMetric[] = [];

  const ref = mndwi?.verdict !== 'suppressed' ? mndwi : (ndwi?.verdict !== 'suppressed' ? ndwi : null);
  if (ref) {
    const v = ref.mean;
    const ctx =
      v > 0.3 ? 'احتمال تشبع مائي مرتفع أو هيئات مائية مكشوفة' :
      v > 0.0 ? 'احتمال رطوبة سطحية أو مياه جوفية قريبة' :
      'مستوى رطوبة سطحية منخفض';
    metrics.push({
      id: 'water_ctx',
      label: 'حالة المياه السطحية',
      value: ctx,
      value_type: 'interpreted',
      note: `NDWI/MNDWI = ${v.toFixed(3)} — إشارة طيفية، تحتاج تحقق ميداني`,
    });
    if (v > 0.0) {
      metrics.push({
        id: 'flood_exposure',
        label: 'تقدير تعرض للفيضان',
        value: v > 0.3 ? 'مرتفع' : 'طفيف إلى متوسط',
        value_type: 'estimated',
        note: 'مقدّر — يحتاج دراسة هيدرولوجية للتأكيد',
      });
    }
  } else {
    metrics.push({
      id: 'water_na',
      label: 'بيانات المياه',
      value: 'غير متوفرة',
      value_type: 'requires_validation',
    });
  }

  return { id: 'water', title: 'المياه والصرف', metrics };
}

function buildBuiltEnvGroup(ind: IndicatorMap): AreaMetricGroup {
  const ndbi = ind['ndbi'];
  const bsi  = ind['bsi'];
  const metrics: AreaMetric[] = [];

  if (ndbi && ndbi.verdict !== 'suppressed') {
    const v = ndbi.mean;
    const ctx =
      v > 0.2 ? 'كثافة عمرانية مرتفعة' :
      v > 0.0 ? 'عمران متوسط أو جزئي' :
      'سيطرة غير عمرانية (تربة/نبات)';
    metrics.push({
      id: 'ndbi_ctx',
      label: 'حالة التغطية العمرانية',
      value: ctx,
      value_type: 'interpreted',
      note: `NDBI = ${v.toFixed(3)} — مشتق من الأشعة تحت الحمراء القصيرة والقريبة`,
    });
    const urbanEst = Math.max(0, Math.min(100, (normalizedUrbanStrength(ind) ?? ((v + 0.3) / 0.7)) * 100));
    metrics.push({
      id: 'urban_est',
      label: 'تقدير نسبة المساحات المبنية',
      value: `~${urbanEst.toFixed(0)}%`,
      value_type: 'estimated',
      note: 'تقدير تقريبي — لا يُستخدم لأغراض تخطيطية رسمية',
    });
  }

  if (bsi && bsi.verdict !== 'suppressed') {
    metrics.push({
      id: 'bsi',
      label: 'مؤشر التربة العارية (BSI)',
      value: bsi.mean.toFixed(3),
      value_type: 'interpreted',
      note: 'مرتفع = انكشاف تربة / بناء حديث / تدهور نباتي',
    });
  }

  if (metrics.length === 0) {
    metrics.push({
      id: 'built_na', label: 'بيانات البيئة المبنية', value: 'غير متوفرة', value_type: 'requires_validation',
    });
  }

  return { id: 'built_env', title: 'البيئة المبنية', metrics };
}

function buildThermalGroup(ind: IndicatorMap): AreaMetricGroup {
  const bai  = ind['bai'];
  const nbr  = ind['nbr'];
  const dnbr = ind['dnbr'];
  const metrics: AreaMetric[] = [];

  if (bai && bai.verdict !== 'suppressed') {
    const v = bai.mean;
    metrics.push({
      id: 'bai_ctx',
      label: 'مؤشر منطقة الاحتراق (BAI)',
      value: v > 0.5 ? 'إشارة احتراق نشط محتمل' : v > 0.2 ? 'إشارة حرارية معتدلة' : 'منخفض',
      value_type: 'interpreted',
      note: `BAI = ${v.toFixed(3)}`,
    });
  }

  if (dnbr && dnbr.verdict !== 'suppressed') {
    const v = dnbr.mean;
    metrics.push({
      id: 'dnbr_ctx',
      label: 'تغيير مؤشر الاحتراق (dNBR)',
      value: v > 0.27 ? 'مناطق محترقة مؤكدة' : v > 0.1 ? 'حرائق منخفضة الشدة' : 'لا تغيير ملحوظ',
      value_type: 'interpreted',
      note: `dNBR = ${v.toFixed(3)} — يتطلب مشهدَي مقارنة`,
    });
  }

  if (nbr && nbr.verdict !== 'suppressed' && !bai && !dnbr) {
    metrics.push({
      id: 'nbr',
      label: 'نسبة الاحتراق المعيارية (NBR)',
      value: nbr.mean.toFixed(3),
      value_type: 'interpreted',
    });
  }

  if (metrics.length === 0) {
    metrics.push({
      id: 'thermal_na', label: 'الإشارة الحرارية', value: 'غير ذات دلالة في هذا المشهد', value_type: 'interpreted',
    });
  }

  return { id: 'thermal', title: 'الحرارة والاحتراق', metrics };
}

function buildModelChainGroup(ind: IndicatorMap): AreaMetricGroup {
  const metrics: AreaMetric[] = [];
  const vegetation = normalizedVegetationStrength(ind);
  const urban = normalizedUrbanStrength(ind);
  const water = ind['mndwi']?.verdict !== 'suppressed'
    ? clamp01((ind['mndwi'].mean + 0.2) / 0.8)
    : ind['ndwi']?.verdict !== 'suppressed'
      ? clamp01((ind['ndwi'].mean + 0.2) / 0.8)
      : null;

  if (typeof vegetation === 'number' || typeof urban === 'number' || typeof water === 'number') {
    const v = vegetation ?? 0.35;
    const u = urban ?? 0.45;
    const w = water ?? 0.25;

    const ecoIntegrity = clamp01((v * 0.5) + ((1 - u) * 0.3) + ((1 - Math.abs(0.35 - w)) * 0.2));
    const heatBurden = clamp01((u * 0.55) + ((1 - v) * 0.35) + ((1 - w) * 0.1));
    const hydrologyPressure = clamp01(((1 - w) * 0.55) + (u * 0.25) + ((1 - v) * 0.2));

    const ecoLabel = ecoIntegrity >= 0.72 ? 'مرتفع' : ecoIntegrity >= 0.5 ? 'متوسط' : 'منخفض';
    const heatLabel = heatBurden >= 0.72 ? 'مرتفع' : heatBurden >= 0.5 ? 'متوسط' : 'منخفض';
    const hydroLabel = hydrologyPressure >= 0.72 ? 'مرتفع' : hydrologyPressure >= 0.5 ? 'متوسط' : 'منخفض';

    metrics.push({
      id: 'model_chain_ctx',
      label: 'نتيجة سلسلة النمذجة المكانية',
      value: `سلامة بيئية ${ecoLabel} • عبء حراري ${heatLabel} • ضغط هيدرولوجي ${hydroLabel}`,
      value_type: 'interpreted',
      note: 'مركب Raster Algebra من NDVI/NDBI/NDWI(MNDWI) لدعم القرار التشغيلي',
    });

    metrics.push({
      id: 'eco_integrity_idx',
      label: 'مؤشر السلامة البيئية',
      value: `${Math.round(ecoIntegrity * 100)}%`,
      value_type: 'interpreted',
    });
    metrics.push({
      id: 'heat_burden_idx',
      label: 'مؤشر العبء الحراري',
      value: `${Math.round(heatBurden * 100)}%`,
      value_type: 'interpreted',
    });
    metrics.push({
      id: 'hydrology_pressure_idx',
      label: 'مؤشر الضغط الهيدرولوجي',
      value: `${Math.round(hydrologyPressure * 100)}%`,
      value_type: 'interpreted',
    });
  }

  if (metrics.length === 0) {
    metrics.push({
      id: 'model_chain_na',
      label: 'سلسلة النمذجة المكانية',
      value: 'البيانات غير كافية لبناء سلسلة Raster Algebra',
      value_type: 'requires_validation',
    });
  }

  return { id: 'model_chain', title: 'سلسلة النمذجة المكانية', metrics };
}

function buildEstimatesGroup(
  ind: IndicatorMap,
  area_km2: number,
  calibration: {
    analysisScore: number;
    indicatorAgreement: 'high' | 'medium' | 'low';
    aoiSuitability: number;
    zonalEvidenceLevel: 'high' | 'medium' | 'low';
  },
  areaReport: AreaReport | null,
  zonalStats: ZonalStatsResult | null,
  objectExtraction: ObjectExtractionResult | null,
): AreaMetricGroup {
  const ndvi = ind['ndvi'];
  const ndbi = ind['ndbi'];
  const ndwi = ind['ndwi'];
  const metrics: AreaMetric[] = [];

  metrics.push({
    id: 'analysis_score',
    label: 'درجة صلاحية التحليل',
    value: `${calibration.analysisScore}%`,
    value_type: calibration.analysisScore >= 75 ? 'interpreted' : calibration.analysisScore >= 55 ? 'estimated' : 'requires_validation',
    note: `ملاءمة AOI = ${calibration.aoiSuitability}% • اتفاق المؤشرات = ${calibration.indicatorAgreement === 'high' ? 'عالٍ' : calibration.indicatorAgreement === 'medium' ? 'متوسط' : 'منخفض'} • دليل نطاقي = ${calibration.zonalEvidenceLevel === 'high' ? 'عالٍ' : calibration.zonalEvidenceLevel === 'medium' ? 'متوسط' : 'منخفض'}`,
  });

  if (objectExtraction?.objects) {
    const o = objectExtraction.objects;
    metrics.push({
      id: 'zonal_objects',
      label: 'استخراج مجسمات AOI',
      value: `${Math.round(o.buildings_count ?? 0)} مبنى • ${Math.round(o.trees_count ?? 0)} شجرة • ${(o.road_km_total ?? 0).toFixed(1)} كم طرق`,
      value_type: 'observed',
      note: `المصدر: ${objectExtraction.source_mode === 'backend-object-extraction' ? 'محرك extraction مباشر' : 'fallback من area-report'}`,
    });
  } else if (zonalStats?.stats?.objects) {
    const o = zonalStats.stats.objects;
    metrics.push({
      id: 'zonal_objects',
      label: 'دلائل نطاقية (AOI) للمجسمات',
      value: `${Math.round(o.buildings_count ?? 0)} مبنى • ${Math.round(o.trees_count ?? 0)} شجرة • ${(o.road_km_total ?? 0).toFixed(1)} كم طرق`,
      value_type: 'observed',
      note: 'مستخرجة من zonal-stats على مستوى AOI',
    });
  } else if (areaReport) {
    metrics.push({
      id: 'zonal_objects',
      label: 'دلائل نطاقية (AOI) للمجسمات',
      value: `${areaReport.spatial_estimates.buildings_count} مبنى • ${areaReport.spatial_estimates.trees_count} شجرة • ${areaReport.spatial_estimates.road_km_total.toFixed(1)} كم طرق`,
      value_type: 'observed',
      note: 'مستخرجة من تقرير نطاق AOI لتقليل الاعتماد على المتوسطات العامة للمشهد',
    });
  }

  if (ndvi && ndvi.verdict !== 'suppressed' && ndbi && ndbi.verdict !== 'suppressed') {
    const greeningNeed =
      ndvi.mean < 0.1 && ndbi.mean > 0.15 ? 'مرتفعة جداً' :
      ndvi.mean < 0.2                      ? 'مرتفعة' :
      ndbi.mean > 0.2                       ? 'متوسطة' : 'منخفضة';
    metrics.push({
      id: 'greening_need',
      label: 'الحاجة المقدّرة للتخضير',
      value: greeningNeed,
      value_type: 'estimated',
      note: 'مشتق من الوضع النباتي والعمراني — مؤشر استرشادي',
    });
  }

  if (ndwi) {
    const mndwi = ind['mndwi'];
    const ref = (mndwi?.verdict !== 'suppressed' ? mndwi : ndwi) ?? ndwi;
    if (ref.verdict !== 'suppressed') {
      const drainStress = ref.mean > 0.2 ? 'مرتفع' : ref.mean > 0 ? 'متوسط' : 'منخفض';
      metrics.push({
        id: 'drainage_stress',
        label: 'ضغط الصرف المائي المقدّر',
        value: drainStress,
        value_type: 'estimated',
        note: 'مقدّر من مؤشر الماء — يحتاج دراسة هيدرولوجية',
      });
    }
  }

  if (ndbi && ndbi.verdict !== 'suppressed') {
    const urbPress = ndbi.mean > 0.2 ? 'مرتفع' : ndbi.mean > 0.05 ? 'متوسط' : 'منخفض';
    metrics.push({
      id: 'urban_pressure',
      label: 'ضغط التمدد العمراني المقدّر',
      value: urbPress,
      value_type: 'estimated',
      note: 'مشتق من NDBI — مؤشر أولي',
    });
  }

  if (area_km2 > 0) {
    metrics.push({
      id: 'survey_priority',
      label: 'أولوية المسح الميداني',
      value: area_km2 > 5 ? 'مرتفعة' : area_km2 > 1 ? 'متوسطة' : 'منخفضة',
      value_type: 'estimated',
      note: 'مشتق من حجم المنطقة — قد يختلف بناءً على الأولويات التشغيلية',
    });
  }

  if (metrics.length === 0) {
    metrics.push({
      id: 'no_est', label: 'التقديرات', value: 'غير كافية للتقدير بدون بيانات مشهد', value_type: 'requires_validation',
    });
  }

  return { id: 'estimates', title: 'التقديرات الاستخباراتية', metrics };
}

// ─── Light signals builder ───────────────────────────────────────────────────

function buildLightSignals(ind: IndicatorMap): LightSignal[] {
  const sigs: LightSignal[] = [];

  // Vegetation
  const ndvi = ind['ndvi'];
  if (ndvi && ndvi.verdict !== 'suppressed') {
    const v = ndvi.mean;
    sigs.push({
      id: 'sig_veg', label: 'الغطاء النباتي', icon_hint: 'vegetation',
      status: v > 0.4 ? 'good' : v > 0.2 ? 'neutral' : v > 0.1 ? 'caution' : 'alert',
      brief:  v > 0.4 ? 'كثيف' : v > 0.2 ? 'متوسط' : v > 0.1 ? 'خفيف' : 'شبه معدوم',
    });
  } else {
    sigs.push({ id: 'sig_veg', label: 'الغطاء النباتي', icon_hint: 'vegetation', status: 'neutral', brief: 'غير متوفر' });
  }

  // Water
  const wRef = (ind['mndwi']?.verdict !== 'suppressed' ? ind['mndwi'] : ind['ndwi']);
  if (wRef && wRef.verdict !== 'suppressed') {
    const v = wRef.mean;
    sigs.push({
      id: 'sig_water', label: 'المياه السطحية', icon_hint: 'water',
      status: v > 0.3 ? 'alert' : v > 0.0 ? 'caution' : 'good',
      brief:  v > 0.3 ? 'تشبع مائي' : v > 0.0 ? 'رطوبة ملحوظة' : 'طبيعي',
    });
  } else {
    sigs.push({ id: 'sig_water', label: 'المياه السطحية', icon_hint: 'water', status: 'neutral', brief: 'غير متوفر' });
  }

  // Urban
  const ndbi = ind['ndbi'];
  if (ndbi && ndbi.verdict !== 'suppressed') {
    const v = ndbi.mean;
    sigs.push({
      id: 'sig_urban', label: 'الكثافة العمرانية', icon_hint: 'urban',
      status: v > 0.2 ? 'caution' : v > 0.05 ? 'neutral' : 'good',
      brief:  v > 0.2 ? 'مرتفعة' : v > 0.05 ? 'متوسطة' : 'منخفضة',
    });
  } else {
    sigs.push({ id: 'sig_urban', label: 'الكثافة العمرانية', icon_hint: 'urban', status: 'neutral', brief: 'غير متوفر' });
  }

  // Thermal / burn
  const burnRef = (ind['dnbr']?.verdict !== 'suppressed' ? ind['dnbr'] : ind['bai']);
  if (burnRef && burnRef.verdict !== 'suppressed') {
    const v = burnRef.mean;
    sigs.push({
      id: 'sig_thermal', label: 'الإشارة الحرارية', icon_hint: 'thermal',
      status: v > 0.3 ? 'alert' : v > 0.1 ? 'caution' : 'good',
      brief:  v > 0.3 ? 'احتراق محتمل' : v > 0.1 ? 'حرارة ملحوظة' : 'طبيعي',
    });
  } else {
    sigs.push({ id: 'sig_thermal', label: 'الإشارة الحرارية', icon_hint: 'thermal', status: 'neutral', brief: 'طبيعي' });
  }

  return sigs;
}

// ─── Recommendation rules ─────────────────────────────────────────────────────

function buildRecommendations(
  area_km2: number,
  ind: IndicatorMap,
  quality: { confidence: 'high' | 'medium' | 'low'; data_type: string },
): AreaRecommendation[] {
  const recs: AreaRecommendation[] = [];
  const ndvi   = ind['ndvi'];
  const ndwi   = ind['ndwi'];
  const mndwi  = ind['mndwi'];
  const ndbi   = ind['ndbi'];
  const bai    = ind['bai'];
  const dnbr   = ind['dnbr'];

  // ── R1: Greening need ────────────────────────────────────────────────────
  if (ndvi?.verdict !== 'suppressed' && ndvi && ndvi.mean < 0.15) {
    recs.push({
      id: 'r_greening',
      title: 'التوسع في المساحات الخضراء',
      explanation: 'الإشارة النباتية منخفضة جداً في هذه المنطقة. يُوصى بدراسة جدوى التخضير لتحسين البيئة الحرارية وجودة الهواء.',
      severity: ndvi.mean < 0.08 ? 'high' : 'medium',
      department: 'التخطيط العمراني / البيئة',
      trigger_rule: 'NDVI < 0.15',
    });
  }

  // ── R2: Flood/drainage review ──────────────────────────────────────────
  const wRef = mndwi?.verdict !== 'suppressed' ? mndwi : ndwi;
  if (wRef?.verdict !== 'suppressed' && wRef && wRef.mean > 0.0) {
    recs.push({
      id: 'r_drainage',
      title: 'مراجعة شبكة الصرف المائي',
      explanation: 'تُشير الإشارة المائية إلى احتمال تراكم سطحي أو رطوبة مرتفعة. يُوصى بمراجعة نظام الصرف قبل أحداث الأمطار.',
      severity: wRef.mean > 0.3 ? 'high' : 'medium',
      department: 'البنية التحتية / الطوارئ',
      trigger_rule: 'NDWI/MNDWI > 0',
    });
  }

  // ── R3: High urban + low vegetation → heat burden ─────────────────────
  if (
    ndbi?.verdict !== 'suppressed' && ndbi && ndbi.mean > 0.15 &&
    ndvi?.verdict !== 'suppressed' && ndvi && ndvi.mean < 0.2
  ) {
    recs.push({
      id: 'r_heat',
      title: 'مراجعة العبء الحراري',
      explanation: 'كثافة عمرانية مرتفعة مع غطاء نباتي منخفض يُصنّف هذه المنطقة ذات عبء حراري محتمل. يُوصى بدراسة الجزر الحرارية.',
      severity: 'medium',
      department: 'التخطيط / الصحة العامة',
      trigger_rule: 'NDBI > 0.15 و NDVI < 0.2',
    });
  }

  // ── R4: Burn / fire signal ─────────────────────────────────────────────
  const burnRef = dnbr?.verdict !== 'suppressed' ? dnbr : bai;
  if (burnRef?.verdict !== 'suppressed' && burnRef && burnRef.mean > 0.3) {
    recs.push({
      id: 'r_burn',
      title: 'التحقق من نشاط احتراق',
      explanation: 'رُصدت إشارة احتراق أو نشاط حراري. يُوصى بالتحقق الميداني ومراجعة سجلات الحرائق في المنطقة.',
      severity: 'high',
      department: 'الطوارئ / البيئة',
      trigger_rule: 'dNBR/BAI > 0.3',
    });
  }

  // ── R5: Large area → field survey priority ─────────────────────────────
  if (area_km2 > 5) {
    recs.push({
      id: 'r_survey',
      title: 'جدولة مسح ميداني للمنطقة',
      explanation: `مساحة المنطقة (${area_km2.toFixed(1)} كم²) تستدعي مسحاً ميدانياً منهجياً لتأكيد النتائج الطيفية وتحديث السجلات.`,
      severity: 'info',
      department: 'المساحة / التخطيط',
      trigger_rule: 'المساحة > 5 كم²',
    });
  }

  // ── R6: Simulated/low quality → always recommend real data ────────────
  if (quality.data_type === 'simulated' || quality.confidence === 'low') {
    recs.push({
      id: 'r_real_data',
      title: 'التحقق من بيانات حقيقية',
      explanation: 'النتائج الحالية مستخرجة من بيانات محاكاة أو ذات ثقة منخفضة. لا تُبنى قرارات تشغيلية على هذا التحليل دون تأكيد بصور حقيقية.',
      severity: quality.data_type === 'simulated' ? 'high' : 'medium',
      department: 'الاستشعار عن بُعد',
      trigger_rule: 'نوع البيانات = محاكاة أو ثقة منخفضة',
    });
  }

  return recs;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeAreaStats(
  polygon:  [number, number][],
  summary:  SceneSummaryContract | null,
  sceneUid: string | null,
  areaReport: AreaReport | null = null,
  zonalStats: ZonalStatsResult | null = null,
  objectExtraction: ObjectExtractionResult | null = null,
): AreaIntelResult {
  const area_m2       = computeAreaM2(polygon);
  const area_km2      = area_m2 / 1_000_000;
  const perimeter_km  = computePerimeterKm(polygon);
  const bbox: [number, number, number, number] = [
    Math.min(...polygon.map(c => c[0])),
    Math.min(...polygon.map(c => c[1])),
    Math.max(...polygon.map(c => c[0])),
    Math.max(...polygon.map(c => c[1])),
  ];
  const centroid: [number, number] = [
    polygon.reduce((s, c) => s + c[0], 0) / polygon.length,
    polygon.reduce((s, c) => s + c[1], 0) / polygon.length,
  ];

  const ind = summary ? extractIndicators(summary) : {};
  const hasData = !!summary;
  const indicatorAgreement = hasData ? deriveIndicatorAgreement(ind) : { score: 0, level: 'low' as const };
  const aoiSuitability = deriveAoiSuitability(area_km2, perimeter_km);
  const zonalEvidence = hasData ? deriveZonalEvidence(zonalStats, objectExtraction, areaReport, ind) : { score: 0, level: 'low' as const, notes: [] as string[] };
  const analysisScore = hasData
    ? Math.round(
        ((summary?.quality?.quality_score ?? 0) * 0.35) +
        ((summary?.quality?.valid_pixel_pct ?? 0) * 0.25) +
        (indicatorAgreement.score * 0.2) +
        (aoiSuitability * 0.1) +
        (zonalEvidence.score * 0.1)
      )
    : 0;
  const qualityInfo = {
    data_type: summary
      ? (summary.provenance.data_is_real ? 'real' : 'simulated') as 'real' | 'simulated'
      : 'none' as const,
    confidence: (hasData ? (analysisScore >= 78 ? 'high' : analysisScore >= 58 ? 'medium' : 'low') : 'low') as 'high' | 'medium' | 'low',
    analysis_score: analysisScore,
    indicator_agreement: indicatorAgreement.level,
    notes: hasData
      ? [
          summary!.provenance.data_is_real
            ? 'بيانات من صور حقيقية (COG)'
            : 'بيانات محاكاة — تُستخدم للاسترشاد فقط',
          `درجة التحليل المعيارية: ${analysisScore}%`,
          `اتفاق المؤشرات: ${indicatorAgreement.level === 'high' ? 'عالٍ' : indicatorAgreement.level === 'medium' ? 'متوسط' : 'منخفض'}`,
          `ملاءمة AOI للتحليل: ${aoiSuitability}%`,
          `الدليل النطاقي AOI: ${zonalEvidence.level === 'high' ? 'عالٍ' : zonalEvidence.level === 'medium' ? 'متوسط' : 'منخفض'} (${zonalEvidence.score}%)`,
          ...zonalEvidence.notes,
        ]
      : ['لا توجد بيانات مشهد — احسب المقاييس الهندسية فقط'],
  };

  const light_signals = hasData ? buildLightSignals(ind) : [];

  const groups: AreaMetricGroup[] = [
    buildGeometryGroup(area_m2, perimeter_km),
    ...(hasData
      ? [
          buildVegetationGroup(ind),
          buildWaterGroup(ind),
          buildBuiltEnvGroup(ind),
          buildThermalGroup(ind),
          buildModelChainGroup(ind),
          buildEstimatesGroup(ind, area_km2, {
            analysisScore,
            indicatorAgreement: indicatorAgreement.level,
            aoiSuitability,
            zonalEvidenceLevel: zonalEvidence.level,
          }, areaReport, zonalStats, objectExtraction),
        ]
      : []),
  ];

  const recommendations = hasData
    ? buildRecommendations(area_km2, ind, qualityInfo)
    : [
        {
          id: 'r_no_data',
          title: 'تشغيل تحليل المشهد أولاً',
          explanation: 'لتوليد توصيات ذات دلالة، شغّل التحليل على مشهد يغطي هذه المنطقة.',
          severity: 'info' as const,
          trigger_rule: 'لا توجد بيانات مشهد',
        },
      ];

  return {
    polygon,
    area_m2,
    area_km2,
    perimeter_km,
    bbox,
    centroid,
    computed_at: new Date().toISOString(),
    scene_uid: sceneUid,
    has_scene_data: hasData,
    light_signals,
    groups,
    recommendations,
    quality: qualityInfo,
  };
}
