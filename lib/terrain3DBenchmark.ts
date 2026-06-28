import type { Terrain3DRequest, Terrain3DResponse } from './terrain3DAPI';

export interface BenchmarkCheck {
  id: string;
  label: string;
  passed: boolean;
  note: string;
  severity: 'critical' | 'important' | 'advisory';
}

export interface Terrain3DBenchmarkResult {
  policyVersion: string;
  policyName: string;
  presetId: string;
  presetName: string;
  score: number;
  verdict: 'accepted' | 'conditional' | 'rejected';
  checks: BenchmarkCheck[];
  executedAt: string;
}

export const TERRAIN3D_POLICY_VERSION = 'T3D-AP-V1';
export const TERRAIN3D_POLICY_NAME = '3D Analyst Acceptance Policy v1';

interface BenchmarkThresholds {
  minSamplePoints: number;
  reliefMin: number;
  reliefMax: number;
  slopeMeanMin: number;
  slopeMeanMax: number;
  minContourBands: number;
}

export interface Terrain3DBenchmarkPreset {
  id: string;
  name: string;
  request: Terrain3DRequest;
  thresholds: BenchmarkThresholds;
}

export const TERRAIN_3D_BENCHMARK_PRESETS: Terrain3DBenchmarkPreset[] = [
  {
    id: 'tripoli_coastal_terrain_v1',
    name: 'Benchmark الساحل الغربي - طرابلس',
    request: {
      bbox: [13.16, 32.84, 13.24, 32.9],
      contour_interval_m: 20,
      grid_size: 11,
      los: {
        start: [13.16, 32.84],
        end: [13.24, 32.9],
        observer_height_m: 1.75,
        target_height_m: 1.75,
      },
    },
    thresholds: {
      minSamplePoints: 100,
      reliefMin: 20,
      reliefMax: 60,
      slopeMeanMin: 0.15,
      slopeMeanMax: 2,
      minContourBands: 2,
    },
  },
  {
    id: 'sabha_inland_terrain_v1',
    name: 'Benchmark الداخل الجنوبي - سبها',
    request: {
      bbox: [14.37, 27.0, 14.52, 27.13],
      contour_interval_m: 20,
      grid_size: 11,
      los: {
        start: [14.38, 27.02],
        end: [14.5, 27.11],
        observer_height_m: 1.75,
        target_height_m: 1.75,
      },
    },
    thresholds: {
      minSamplePoints: 100,
      reliefMin: 5,
      reliefMax: 180,
      slopeMeanMin: 0.05,
      slopeMeanMax: 6,
      minContourBands: 1,
    },
  },
];

function toVerdict(score: number): Terrain3DBenchmarkResult['verdict'] {
  if (score >= 85) return 'accepted';
  if (score >= 60) return 'conditional';
  return 'rejected';
}

export function evaluateTerrain3DBenchmark(
  preset: Terrain3DBenchmarkPreset,
  result: Terrain3DResponse
): Terrain3DBenchmarkResult {
  const t = preset.thresholds;
  const checks: BenchmarkCheck[] = [
    {
      id: 'sample_points',
      label: 'عدد عينات DEM كافٍ للتحليل',
      passed: result.quality.sample_points >= t.minSamplePoints,
      note: `عينات التنفيذ: ${result.quality.sample_points}`,
      severity: 'critical',
    },
    {
      id: 'relief_range',
      label: 'فرق المناسيب ضمن نطاق المنطقة المرجعية',
      passed: result.terrain.relief_m >= t.reliefMin && result.terrain.relief_m <= t.reliefMax,
      note: `Relief = ${result.terrain.relief_m} م`,
      severity: 'important',
    },
    {
      id: 'slope_mean',
      label: 'متوسط الانحدار معقول للساحل الحضري',
      passed: result.terrain.slope_mean_deg >= t.slopeMeanMin && result.terrain.slope_mean_deg <= t.slopeMeanMax,
      note: `Mean slope = ${result.terrain.slope_mean_deg}°`,
      severity: 'important',
    },
    {
      id: 'contours',
      label: 'إنتاج أشرطة كنتور صالحة للعرض',
      passed: result.contours.bands.length >= t.minContourBands,
      note: `عدد الأشرطة = ${result.contours.bands.length}`,
      severity: 'important',
    },
    {
      id: 'visibility',
      label: 'نتيجة LOS متاحة وقابلة للتفسير',
      passed: !!result.visibility,
      note: result.visibility
        ? (result.visibility.visible ? 'LOS مفتوح' : `محجوب عند ${result.visibility.blocked_at_distance_m ?? 'غير محدد'} م`)
        : 'لم يتم حساب LOS',
      severity: 'critical',
    },
    {
      id: 'cut_fill',
      label: 'حسابات Cut/Fill متولدة بدون قيم شاذة',
      passed: result.cut_fill.cut_m3 >= 0 && result.cut_fill.fill_m3 >= 0,
      note: `Cut=${result.cut_fill.cut_m3.toFixed(0)} / Fill=${result.cut_fill.fill_m3.toFixed(0)} م³`,
      severity: 'advisory',
    },
  ];

  const totalWeight = checks.reduce((acc, check) => acc + (check.severity === 'critical' ? 3 : check.severity === 'important' ? 2 : 1), 0);
  const earnedWeight = checks.reduce((acc, check) => {
    if (!check.passed) return acc;
    return acc + (check.severity === 'critical' ? 3 : check.severity === 'important' ? 2 : 1);
  }, 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return {
    policyVersion: TERRAIN3D_POLICY_VERSION,
    policyName: TERRAIN3D_POLICY_NAME,
    presetId: preset.id,
    presetName: preset.name,
    score,
    verdict: toVerdict(score),
    checks,
    executedAt: new Date().toISOString(),
  };
}
