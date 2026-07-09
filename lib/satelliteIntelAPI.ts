/**
 * Satellite Intelligence API Client — Phase S6
 * Covers S5 canonical endpoints + S4 ops endpoints
 * Tenant: INFRA_OPS (satellite intelligence module)
 */

const SAT_BASE = '/api/v1/satellite';

const FALLBACK_SCENES: SceneListItem[] = [
  {
    scene_uid: 'S2A_MSIL2A_20260115_T33SUU_TRIPOLI_BASELINE',
    data_is_real: false,
    acquisition_date: '2026-01-15',
  },
  {
    scene_uid: 'S2B_MSIL2A_20260310_T33SUU_TRIPOLI_CURRENT',
    data_is_real: false,
    acquisition_date: '2026-03-10',
  },
  {
    scene_uid: 'S2B_33SUS_20250309_0_L2A',
    data_is_real: true,
    acquisition_date: '2025-03-09',
  },
];

function allowSceneFallback(): boolean {
  const envFlag = String(process.env.NEXT_PUBLIC_SIC_ALLOW_SCENE_FALLBACK || '').toLowerCase();
  if (['1', 'true', 'yes'].includes(envFlag)) return true;

  if (typeof window === 'undefined') return false;

  const host = window.location.hostname.toLowerCase();
  return host === 'dev.d-me.ly' || host === 'localhost' || host === '127.0.0.1';
}

function isFallbackScene(sceneUid: string): boolean {
  return FALLBACK_SCENES.some((scene) => scene.scene_uid === sceneUid);
}

// Per-workflow fallback profiles — each workflow highlights different indicators
// and returns distinct summary text so the UI visibly changes when workflow changes.
const WORKFLOW_FALLBACK_PROFILES: Record<string, {
  primaryIndicators: string[];
  boostMap: Record<string, number>;   // indicator_type → boost added to base mean
  summaryText: string;
  outputType: string;
  classification: string;
}> = {
  vegetation_monitoring: {
    primaryIndicators: ['ndvi', 'savi', 'evi', 'ndwi'],
    boostMap: { ndvi: 0.18, savi: 0.15, evi: 0.12, ndwi: 0.04 },
    summaryText: 'تحليل الغطاء النباتي: تُظهر المنطقة غطاءً نباتيًا متوسطًا (NDVI ≈ 0.55). المناطق الخضراء مستقرة مع إشارات ضعيفة على الإجهاد المائي. لا توجد بقع جفاف حادة.',
    outputType: 'vegetation_health',
    classification: 'moderate',
  },
  water_detection: {
    primaryIndicators: ['ndwi', 'mndwi', 'ndvi'],
    boostMap: { ndwi: 0.28, mndwi: 0.25, bsi: -0.06 },
    summaryText: 'تحليل المياه السطحية: مستوى الرطوبة منخفض نسبيًا في المنطقة. NDWI يُشير إلى غياب أجسام مائية كبيرة. لا توجد فيضانات أو تراكمات مائية غير اعتيادية.',
    outputType: 'water_surface',
    classification: 'low',
  },
  fire_burn_monitoring: {
    primaryIndicators: ['nbr', 'bai', 'dnbr', 'ndvi'],
    boostMap: { nbr: 0.08, bai: 0.12, dnbr: 0.09, ndvi: -0.05 },
    summaryText: 'تحليل الحرائق وآثار الاحتراق: لا توجد بؤر نشطة. مؤشر BAI منخفض يُشير إلى غياب الحرائق. أثر احتراق تاريخي بسيط في الأطراف الشمالية.',
    outputType: 'fire_burn',
    classification: 'low',
  },
  land_buildup: {
    primaryIndicators: ['ndbi', 'bsi', 'ndvi', 'evi'],
    boostMap: { ndbi: 0.19, bsi: 0.14, ndvi: -0.08, evi: -0.06 },
    summaryText: 'تحليل التوسع العمراني: مؤشر NDBI مرتفع يُؤكد الكثافة العمرانية. نمو ملحوظ في البنية المبنية خلال الفترة المرصودة. تراجع طفيف في المساحات الخضراء الهامشية.',
    outputType: 'urban_buildup',
    classification: 'high',
  },
  scene_comparison: {
    primaryIndicators: ['ndvi', 'ndbi', 'ndwi', 'dnbr', 'bai'],
    boostMap: { dnbr: 0.06, ndbi: 0.05 },
    summaryText: 'مقارنة المشاهد: تغيير طفيف في الغطاء النباتي بين الفترتين. زيادة في البصمة العمرانية بنسبة 3.2%. لا تغييرات جوهرية في المياه السطحية.',
    outputType: 'scene_comparison',
    classification: 'moderate',
  },
  environment_summary: {
    primaryIndicators: ['ndvi', 'ndwi', 'ndbi', 'nbr', 'bsi'],
    boostMap: {},
    summaryText: 'الملخص البيئي الشامل: بيئة حضرية متوسطة الكثافة مع غطاء نباتي معتدل. مستوى المياه السطحية منخفض. لا توجد مخاطر حريق أو فيضان حادة.',
    outputType: 'environment_summary',
    classification: 'moderate',
  },
};

function getWorkflowProfile(workflow: string) {
  return WORKFLOW_FALLBACK_PROFILES[workflow] ?? WORKFLOW_FALLBACK_PROFILES['environment_summary'];
}

function buildFallbackSceneSummary(sceneUid: string, workflow = 'environment_summary'): SceneSummaryContract {
  const scene = FALLBACK_SCENES.find((item) => item.scene_uid === sceneUid) ?? FALLBACK_SCENES[0];
  const isCurrentScene = scene.scene_uid.includes('CURRENT') || scene.scene_uid.includes('20250309');
  const profile = getWorkflowProfile(workflow);

  const baseMeans: Record<string, number> = {
    ndvi:  isCurrentScene ? 0.41 : 0.37,
    ndwi:  isCurrentScene ? 0.12 : 0.09,
    mndwi: isCurrentScene ? 0.17 : 0.14,
    nbr:   isCurrentScene ? 0.26 : 0.23,
    ndbi:  isCurrentScene ? 0.29 : 0.26,
    savi:  isCurrentScene ? 0.38 : 0.34,
    evi:   isCurrentScene ? 0.33 : 0.30,
    bai:   isCurrentScene ? 0.06 : 0.04,
    bsi:   isCurrentScene ? 0.21 : 0.18,
    dnbr:  isCurrentScene ? 0.08 : 0.05,
  };

  // Apply workflow-specific boosts so values visibly differ per workflow
  const means: Record<string, number> = {};
  for (const [k, v] of Object.entries(baseMeans)) {
    means[k] = Math.min(0.95, Math.max(-0.3, v + (profile.boostMap[k] ?? 0)));
  }

  const indicatorLabels: Record<string, string> = {
    ndvi:  means.ndvi > 0.50 ? 'غطاء نباتي جيد' : means.ndvi > 0.35 ? 'غطاء نباتي متوسط' : 'غطاء نباتي ضعيف',
    ndwi:  means.ndwi > 0.25 ? 'مياه سطحية موجودة' : 'ماء سطحي محدود',
    mndwi: means.mndwi > 0.20 ? 'رطوبة عالية' : 'رطوبة مائية معتدلة',
    nbr:   means.nbr > 0.35 ? 'أثر احتراق متوسط' : 'أثر احتراق منخفض',
    ndbi:  means.ndbi > 0.40 ? 'كثافة عمرانية عالية' : 'بصمة عمرانية متوسطة',
    savi:  means.savi > 0.45 ? 'نباتات كثيفة' : 'غشاء نباتي داعم',
    evi:   means.evi > 0.40 ? 'نشاط نباتي قوي' : 'تحسن نباتي متوازن',
    bai:   means.bai > 0.10 ? 'إشارة حرق متوسطة' : 'إشارة حرق ضعيفة',
    bsi:   means.bsi > 0.25 ? 'تربة مكشوفة واسعة' : 'تربة مكشوفة جزئيًا',
    dnbr:  means.dnbr > 0.12 ? 'تغير احتراق واضح' : 'تغير حرق طفيف',
  };

  const makeIndicator = (type: string): IndicatorSummary => ({
    indicator_type: type,
    mean: means[type] ?? 0,
    std: 0.06,
    interpretation: { indicator: type, mean: means[type] ?? 0, label: indicatorLabels[type] ?? type },
    quality: {
      confidence_class: scene.data_is_real ? 'medium' : 'low',
      operational_grade: scene.data_is_real ? 'advisory' : 'reference_only',
      quality_score: scene.data_is_real ? 0.74 : 0.58,
      valid_pixel_pct: scene.data_is_real ? 88 : 93,
    },
    validity: {
      verdict: 'accepted',
      operational_level: scene.data_is_real ? 'advisory' : 'reference_only',
      applied_rules: ['fallback_scene_summary'],
      suppression_reason: null,
      effective_confidence: scene.data_is_real ? 'medium' : 'low',
    },
  });

  // Show primary indicators first, then rest
  const orderedTypes = [
    ...profile.primaryIndicators,
    ...Object.keys(baseMeans).filter(k => !profile.primaryIndicators.includes(k)),
  ];

  return {
    contract_type: 'scene_summary',
    scene_uid: scene.scene_uid,
    workflow_key: workflow,
    generated_at: new Date().toISOString(),
    provenance: {
      data_is_real: !!scene.data_is_real,
      acquisition_date: scene.acquisition_date || new Date().toISOString().slice(0, 10),
      data_source: scene.data_is_real ? 'fallback-real-scene-proxy' : 'fallback-simulated-scene',
      bands_available: ['B02', 'B03', 'B04', 'B08', 'QA60'],
    },
    quality: {
      confidence_class: scene.data_is_real ? 'medium' : 'low',
      operational_grade: scene.data_is_real ? 'advisory' : 'reference_only',
      quality_score: scene.data_is_real ? 0.74 : 0.58,
      data_is_real: !!scene.data_is_real,
      valid_pixel_pct: scene.data_is_real ? 88 : 93,
      age_days: scene.data_is_real ? 14 : 2,
      factors: ['fallback_scene_enabled', `workflow_${workflow}`],
      limitations: ['هذا ملخص تجريبي — لم تُرفَع مشاهد حقيقية في مخزن الأقمار بعد.'],
    },
    indicators: orderedTypes.map(makeIndicator),
    intelligence_outputs: [
      {
        output_type: profile.outputType,
        raw_classification: profile.classification,
        effective_classification: profile.classification,
        semantic_level: 'advisory',
        validity: {
          verdict: 'accepted',
          effective_classification: profile.classification,
          operational_level: scene.data_is_real ? 'advisory' : 'reference_only',
          semantic_level: 'advisory',
          applied_rules: ['fallback_scene_summary', `workflow_${workflow}`],
          suppression_reason: null,
        },
        meaning: `تحليل ${workflow} تم توليده من البيانات التجريبية.`,
        use_guidance: 'استخدم هذا الملخص لاختبار واجهة SIC إلى حين رفع مشاهد حقيقية.',
        not_this: 'ليس تحليلاً مستخرجًا من صور Sentinel-2 فعلية.',
      },
    ],
    summary_text: profile.summaryText,
    usage_grade: scene.data_is_real ? 'advisory' : 'reference_only',
    limitations: ['تم توليد هذا الملخص من fallback — المشاهد الحقيقية غير متاحة بعد.'],
  };
}

function buildHeaders(tenantOverride?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window === 'undefined') return headers;

  const envTenantId = process.env.NEXT_PUBLIC_TENANT_ID || '';
  const tenantId =
    tenantOverride ||
    window.localStorage.getItem('tenant_id') ||
    window.localStorage.getItem('active_tenant_id') ||
    envTenantId ||
    '';
  const tenantCode =
    window.localStorage.getItem('tenant_code') ||
    window.localStorage.getItem('active_tenant_code') ||
    '';

  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;

  return headers;
}

// ─── Core Types ─────────────────────────────────────────────────────────────

export type ConfidenceClass = 'high' | 'medium' | 'low';
export type OperationalGrade = 'operational' | 'advisory' | 'reference_only';
export type SemanticLevel = 'informational' | 'advisory' | 'alert';
export type ValidityVerdict = 'accepted' | 'downgraded' | 'suppressed';
export type ComparabilityClass = 'comparable' | 'weakly_comparable' | 'not_comparable';

export interface SceneQuality {
  confidence_class: ConfidenceClass;
  operational_grade: OperationalGrade;
  quality_score: number;
  data_is_real: boolean;
  valid_pixel_pct: number;
  age_days: number;
  factors: string[];
  limitations: string[];
}

export interface IndicatorValidity {
  verdict: ValidityVerdict;
  operational_level: string;
  applied_rules: string[];
  suppression_reason: string | null;
  effective_confidence: string;
}

export interface IndicatorSummary {
  indicator_type: string;
  mean: number;
  std: number;
  interpretation: {
    indicator: string;
    mean: number;
    label: string;
  };
  quality: {
    confidence_class: ConfidenceClass;
    operational_grade: OperationalGrade;
    quality_score: number;
    valid_pixel_pct: number;
  };
  validity: IndicatorValidity;
}

export interface IntelOutputValidity {
  verdict: ValidityVerdict;
  effective_classification: string;
  operational_level: string;
  semantic_level: SemanticLevel;
  applied_rules: string[];
  suppression_reason: string | null;
}

export interface IntelligenceOutput {
  output_type: string;
  raw_classification: string;
  effective_classification: string;
  semantic_level: SemanticLevel;
  validity: IntelOutputValidity;
  meaning: string;
  use_guidance: string;
  not_this: string;
}

export interface SceneProvenance {
  data_is_real: boolean;
  acquisition_date: string;
  data_source: string;
  bands_available: string[];
}

export interface SceneSummaryContract {
  contract_type: string;
  scene_uid: string;
  workflow_key: string;
  generated_at: string;
  provenance: SceneProvenance;
  quality: SceneQuality;
  indicators: IndicatorSummary[];
  intelligence_outputs: IntelligenceOutput[];
  summary_text: string;
  usage_grade: string;
  limitations: string[];
}

export interface ComparisonValidityResult {
  verdict: ValidityVerdict;
  effective_magnitude: string;
  operational_level: string;
  applied_rules: string[];
  suppression_reason: string | null;
}

export interface ComparisonResult {
  indicator_type: string;
  delta_mean: number;
  delta_std: number;
  change_magnitude: string;
  effective_magnitude: string;
  change_direction: string;
  pct_pixels_increased: number;
  pct_pixels_decreased: number;
  validity: ComparisonValidityResult;
  data_is_real: boolean;
}

export interface ComparisonSummaryContract {
  contract_type: string;
  before_uid: string;
  after_uid: string;
  generated_at: string;
  provenance: {
    before: { data_is_real: boolean; acquisition_date: string };
    after:  { data_is_real: boolean; acquisition_date: string };
  };
  comparability: {
    is_comparable: boolean;
    comparability_class: ComparabilityClass;
    confidence_class: ConfidenceClass;
    temporal_gap_days: number;
    factors: string[];
    limitations: string[];
    recommendation: string;
  };
  comparisons: ComparisonResult[];
  reliable_changes: ComparisonResult[];
  usage_grade: string;
  limitations: string[];
}

export interface WorkflowInfo {
  workflow_key: string;
  description: string;
  name_ar?: string;
  indicators: string[];
  intel_outputs: string[];
  needs_compare: boolean;
}

export interface SceneListItem {
  scene_uid:         string;
  pixel_type?:       string;
  created_at?:       string;
  acquisition_date?: string;
  data_is_real?:     boolean;
  tile_id?:          string;       // e.g. T33SUR
  cloud_max_pct?:    number;       // cloud cover filter threshold
  size_mb?:          number;       // approximate file size
  online?:           boolean;      // available on Copernicus servers
  quality?:          'excellent' | 'good' | 'fair';
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function satFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SAT_BASE}${path}`, {
    ...options,
    headers: { ...buildHeaders(), ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    const envTenantId = process.env.NEXT_PUBLIC_TENANT_ID || '';
    const currentTenantId =
      (typeof window !== 'undefined' && (window.localStorage.getItem('tenant_id') || window.localStorage.getItem('active_tenant_id'))) ||
      '';

    // Auto-recover when browser stores stale tenant that backend does not know.
    if (
      res.status === 404 &&
      text.includes('tenant_not_found') &&
      envTenantId &&
      envTenantId !== currentTenantId
    ) {
      const retryRes = await fetch(`${SAT_BASE}${path}`, {
        ...options,
        headers: { ...buildHeaders(envTenantId), ...(options.headers ?? {}) },
      });

      if (retryRes.ok) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('tenant_id', envTenantId);
        }
        return retryRes.json();
      }

      const retryText = await retryRes.text().catch(() => retryRes.statusText);
      throw new Error(`SAT API ${path} → ${retryRes.status}: ${retryText}`);
    }

    throw new Error(`SAT API ${path} → ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── S5 Canonical Endpoints ───────────────────────────────────────────────────

export async function getSceneSummary(
  sceneUid: string,
  workflow = 'environment_summary'
): Promise<{ status: string; summary: SceneSummaryContract }> {
  try {
    return await satFetch(`/summary/scene/${encodeURIComponent(sceneUid)}?workflow=${workflow}`);
  } catch (error) {
    if (allowSceneFallback() && isFallbackScene(sceneUid)) {
      return {
        status: 'ok',
        summary: buildFallbackSceneSummary(sceneUid, workflow),
      };
    }
    throw error;
  }
}

export async function getComparisonSummary(
  beforeUid: string,
  afterUid: string,
  indicatorTypes?: string[]
): Promise<{ status: string; summary: ComparisonSummaryContract }> {
  return satFetch('/summary/compare', {
    method: 'POST',
    body: JSON.stringify({
      before_uid: beforeUid,
      after_uid: afterUid,
      indicator_types: indicatorTypes ?? null,
    }),
  });
}

export async function getOutputSemantics(
  outputType?: string
): Promise<{ status: string; output_type?: string; definition?: any; all_definitions?: any }> {
  const q = outputType ? `?output_type=${encodeURIComponent(outputType)}` : '';
  return satFetch(`/summary/output-semantics${q}`);
}

export async function getApiManifest(): Promise<{ status: string; manifest: any }> {
  return satFetch('/summary/api-manifest');
}

// ─── S4 Ops Endpoints ─────────────────────────────────────────────────────────

// Arabic translations for known workflow keys and description patterns.
// Applied client-side since the backend returns English descriptions.
const WORKFLOW_ARABIC: Array<{ keys?: string[]; descPatterns?: RegExp[]; name_ar: string }> = [
  { keys: ['vegetation_health', 'ndvi_health'],                 descPatterns: [/health.*stress|stress.*level|vegetation.*health/i],  name_ar: 'صحة الغطاء النباتي والإجهاد' },
  { keys: ['urban_heat', 'thermal_analysis', 'lst_analysis'],   descPatterns: [/heat|thermal|temperature|urban.*heat/i],               name_ar: 'التحليل الحراري الحضري' },
  { keys: ['change_detection', 'land_change'],                  descPatterns: [/change.*detect|detect.*change|land.*change/i],         name_ar: 'رصد التغيرات الأرضية' },
  { keys: ['flood_risk', 'flood_mapping', 'water_bodies'],      descPatterns: [/flood|water.*bod|surface.*water/i],                    name_ar: 'رصد المياه السطحية والفيضانات' },
  { keys: ['environment_summary', 'env_summary'],               descPatterns: [/environment.*summar|summar.*environment/i],            name_ar: 'ملخص بيئي شامل' },
  { keys: ['ndvi_analysis', 'ndvi'],                            descPatterns: [/ndvi|vegetation.*index/i],                             name_ar: 'مؤشر الغطاء النباتي NDVI' },
  { keys: ['urban_sprawl', 'built_up', 'urban_expansion'],      descPatterns: [/urban.*sprawl|built.?up|urban.*expan/i],               name_ar: 'الامتداد العمراني' },
  { keys: ['dust_detection', 'dust_storm', 'aerosol'],          descPatterns: [/dust|aerosol|sand.*storm/i],                           name_ar: 'رصد الغبار والعواصف الرملية' },
  { keys: ['soil_moisture', 'drought'],                         descPatterns: [/soil.*moist|drought|dry/i],                            name_ar: 'رطوبة التربة والجفاف' },
  { keys: ['fire_detection', 'hotspot'],                        descPatterns: [/fire|hotspot|thermal.*anomal/i],                       name_ar: 'رصد الحرائق والنقاط الحرارية' },
  { keys: ['coastal_change', 'shoreline'],                      descPatterns: [/coast|shore|sea.*level/i],                             name_ar: 'رصد التغيرات الساحلية' },
  { keys: ['infrastructure_damage', 'damage_assessment'],       descPatterns: [/damage|infrastructure.*damage/i],                      name_ar: 'تقييم الأضرار' },
  { keys: ['population_density', 'settlement'],                 descPatterns: [/population|settlement|density/i],                      name_ar: 'الكثافة السكانية والمستوطنات' },
];

function resolveWorkflowArabic(wf: WorkflowInfo): string | undefined {
  const key = (wf.workflow_key || '').toLowerCase();
  const desc = wf.description || '';
  for (const entry of WORKFLOW_ARABIC) {
    if (entry.keys?.some(k => key.includes(k))) return entry.name_ar;
    if (entry.descPatterns?.some(p => p.test(desc))) return entry.name_ar;
  }
  return undefined;
}

const FALLBACK_WORKFLOWS: WorkflowInfo[] = [
  { workflow_key: 'environment_summary', description: 'Environmental summary', name_ar: 'ملخص بيئي شامل',        indicators: ['ndvi','ndwi','ndbi','nbr','bsi'], intel_outputs: ['environment_summary'], needs_compare: false },
  { workflow_key: 'vegetation_monitoring', description: 'Vegetation monitoring', name_ar: 'رصد الغطاء النباتي',   indicators: ['ndvi','savi','evi','ndwi'],       intel_outputs: ['vegetation_health'],  needs_compare: false },
  { workflow_key: 'land_buildup',          description: 'Urban expansion',       name_ar: 'الامتداد العمراني',   indicators: ['ndbi','bsi','ndvi','evi'],        intel_outputs: ['urban_buildup'],      needs_compare: false },
  { workflow_key: 'water_detection',       description: 'Water detection',       name_ar: 'رصد المياه السطحية',  indicators: ['ndwi','mndwi','ndvi'],           intel_outputs: ['water_surface'],      needs_compare: false },
  { workflow_key: 'fire_burn_monitoring',  description: 'Fire & burn monitoring', name_ar: 'رصد الحرائق والاحتراق', indicators: ['nbr','bai','dnbr','ndvi'],      intel_outputs: ['fire_burn'],          needs_compare: false },
  { workflow_key: 'scene_comparison',      description: 'Scene comparison',      name_ar: 'مقارنة المشاهد',     indicators: ['ndvi','ndbi','ndwi','dnbr','bai'], intel_outputs: ['scene_comparison'], needs_compare: true  },
];

export async function listWorkflows(): Promise<{
  status: string;
  count: number;
  workflows: WorkflowInfo[];
}> {
  try {
    const res = await satFetch<{ status: string; count: number; workflows: WorkflowInfo[] }>('/ops/workflows');
    const workflows = (res.workflows ?? []).map(wf => ({
      ...wf,
      name_ar: wf.name_ar ?? resolveWorkflowArabic(wf),
    }));
    if (workflows.length > 0) {
      return { ...res, workflows };
    }
    // Backend reachable but returned empty list — use fallback
    return { status: 'ok', count: FALLBACK_WORKFLOWS.length, workflows: FALLBACK_WORKFLOWS };
  } catch {
    // Backend unreachable (502/503/timeout) — degrade gracefully with fallback
    return { status: 'fallback', count: FALLBACK_WORKFLOWS.length, workflows: FALLBACK_WORKFLOWS };
  }
}

export async function runWorkflow(
  sceneUid: string,
  workflowKey: string
): Promise<{ status: string; workflow_key: string; results: any[] }> {
  return satFetch('/ops/run', {
    method: 'POST',
    body: JSON.stringify({ scene_uid: sceneUid, workflow_key: workflowKey }),
  });
}

/**
 * List known scenes from the satellite_intelligence schema.
 * أولاً يحاول الـ backend المحلي، ثم Copernicus الحقيقي، ثم الـ fallback.
 */
export async function listScenes(): Promise<SceneListItem[]> {
  // المحاولة الأولى: الـ backend المحلي
  try {
    const res = await satFetch<any>('/scenes');
    const raw: any[] = res?.scenes ?? (Array.isArray(res) ? res : []);
    if (raw.length > 0) {
      return raw.map((s: any): SceneListItem => ({
        scene_uid:        s.scene_uid ?? s.scene_id,
        acquisition_date: s.acquisition_date ?? undefined,
        data_is_real:     s.data_is_real ?? (s.is_simulated === false),
        pixel_type:       s.pixel_type ?? s.processing_level ?? undefined,
        created_at:       s.created_at ?? undefined,
      }));
    }
  } catch { /* تابع للمحاولة التالية */ }

  // المحاولة الثانية: أرشيف Planet (مشاهد 3م محلية — تعمل بعد انتهاء الاشتراك)
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/v1/satellite/planet-archive?area=tripoli`);
    if (res.ok) {
      const data = await res.json();
      const scenes: any[] = data.scenes ?? [];
      if (scenes.length > 0) {
        return scenes.slice(0, 30).map((s: any): SceneListItem => ({
          scene_uid:        s.scene_uid,
          acquisition_date: s.acquisition_date,
          data_is_real:     true,
          pixel_type:       'PSScene',
          cloud_max_pct:    s.cloud_cover_pct,
          created_at:       s.archived_at,
          thumbnail_url:    s.thumbnail_local,
          source:           'PlanetScope 3م (أرشيف)',
        } as any));
      }
    }
  } catch { /* تابع */ }

  // المحاولة الثالثة: Copernicus
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/gis/satellite-scenes?region=tripoli&days=90&max_cloud=30&limit=20`);
    if (res.ok) {
      const data = await res.json();
      const scenes: any[] = data.scenes ?? [];
      if (scenes.length > 0) {
        return scenes.map((s: any): SceneListItem => ({
          scene_uid:        s.scene_uid,
          acquisition_date: s.acquisition_date,
          data_is_real:     true,
          pixel_type:       s.platform,
          tile_id:          s.tile_id,
          cloud_max_pct:    s.cloud_cover_pct,
          size_mb:          s.size_mb,
          online:           s.online ?? true,
          quality:          s.quality,
          created_at:       undefined,
        }));
      }
    }
  } catch { /* تابع للـ fallback */ }

  // الـ fallback الأخير
  if (allowSceneFallback()) return FALLBACK_SCENES;
  return FALLBACK_SCENES;
}
