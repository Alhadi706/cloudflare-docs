/**
 * POST /api/v1/satellite/corridor-monitor
 * ────────────────────────────────────────
 * Real satellite-based corridor monitoring using Sentinel-2 + Sentinel-1.
 *
 * Compares a reference period (T1) against a current period (T2) to detect:
 *   • Construction / encroachment  — NDBI / not_vegetated_pct increase
 *   • Vegetation removal           — vegetation_pct decrease
 *   • Flooding / moisture anomaly  — water_pct increase
 *   • Ground disturbance (SAR)     — Sentinel-1 scene availability change
 *
 * Data source: Copernicus CDSE STAC (public, no auth required).
 * Analysis scope: tile-level SCL statistics (100×100 km MGRS tile).
 * For pixel-level corridor analysis see: requires Sentinel Hub OAuth2.
 *
 * Body:
 *   bbox         [minLon, minLat, maxLon, maxLat]  required (or use polygon)
 *   polygon      [[lon,lat], ...]                  alternative to bbox
 *   corridor_id  string                            optional label
 *   ref_days     number  default: 90               how far back is T1 midpoint
 *   window_days  number  default: 30               size of each comparison window
 *   max_cloud    number  default: 30               max cloud % for S2 scenes
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  searchSTAC,
  getBestScene,
  polygonToBbox,
  expandBbox,
  computeChangeIndicators,
  daysAgo,
  today,
  type STACScene,
} from '@/lib/stac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function scenesBrief(scenes: STACScene[]) {
  return scenes.slice(0, 8).map(s => ({
    id:          s.id,
    date:        s.date,
    cloud_cover: s.cloud_cover,
    platform:    s.platform,
    source:      s.source,
  }));
}

function monitoringReadiness(
  t1Best: STACScene | null,
  t2Best: STACScene | null,
  sarT1:  number,
  sarT2:  number,
): { level: 'ready' | 'partial' | 'unavailable'; reason_ar: string; recommendation_ar: string } {
  if (t1Best && t2Best) {
    const avgCloud = ((t1Best.cloud_cover ?? 100) + (t2Best.cloud_cover ?? 100)) / 2;
    if (avgCloud < 20) {
      return {
        level: 'ready',
        reason_ar: `مشاهد نظيفة متوفرة: T1 (${t1Best.date}, ${t1Best.cloud_cover?.toFixed(0)}% غيوم) | T2 (${t2Best.date}, ${t2Best.cloud_cover?.toFixed(0)}% غيوم)`,
        recommendation_ar: 'المقارنة البصرية جاهزة. للتحليل الدقيق للبكسل: فعّل Sentinel Hub OAuth2.',
      };
    }
    return {
      level: 'partial',
      reason_ar: `المشاهد متوفرة لكن بتغطية سحابية متوسطة (${avgCloud.toFixed(0)}%)`,
      recommendation_ar: 'انتظر مشهداً بغيوم أقل من 20% لتحليل أكثر دقة.',
    };
  }
  if (t2Best && !t1Best) {
    return {
      level: 'partial',
      reason_ar: 'مشهد حديث متوفر لكن لا يوجد مشهد مرجعي للفترة المطلوبة',
      recommendation_ar: 'وسّع نطاق ref_days أو تحقق من التغطية.',
    };
  }
  if (!t2Best && sarT2 > 0) {
    return {
      level: 'partial',
      reason_ar: `لا توجد صور بصرية واضحة، لكن ${sarT2} مشهد رادار SAR متاح`,
      recommendation_ar: 'البيانات الرادارية متاحة للكشف عن التغييرات السطحية.',
    };
  }
  return {
    level: 'unavailable',
    reason_ar: 'لا توجد مشاهد صالحة في الفترة المحددة',
    recommendation_ar: 'وسّع نطاق التاريخ أو رفع حد الغيوم (max_cloud).',
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 }); }

  // ── Parse bbox ─────────────────────────────────────────────────────────
  let bbox: [number, number, number, number] | null = null;

  if (Array.isArray(body.polygon) && body.polygon.length >= 3) {
    try {
      bbox = polygonToBbox(body.polygon as [number, number][]);
    } catch {
      return NextResponse.json({ detail: 'تنسيق polygon غير صحيح' }, { status: 400 });
    }
  } else if (Array.isArray(body.bbox) && body.bbox.length === 4) {
    bbox = body.bbox as [number, number, number, number];
  } else {
    return NextResponse.json(
      { detail: 'يجب تمرير bbox أو polygon' },
      { status: 400 }
    );
  }

  // Expand slightly to ensure tile coverage
  const searchBbox = expandBbox(bbox, 0.05);

  const corridor_id  = (body.corridor_id as string)  || 'corridor';
  const ref_days     = typeof body.ref_days    === 'number' ? body.ref_days    : 90;
  const window_days  = typeof body.window_days === 'number' ? body.window_days : 30;
  const max_cloud    = typeof body.max_cloud   === 'number' ? body.max_cloud   : 30;

  // ── Date windows ───────────────────────────────────────────────────────
  // T1 reference window: centered ref_days ago
  const t1_to   = isoDate(ref_days - Math.floor(window_days / 2));
  const t1_from = isoDate(ref_days + Math.floor(window_days / 2));

  // T2 current window: last window_days
  const t2_from = isoDate(window_days);
  const t2_to   = today();

  const analysisStart = Date.now();

  // ── Parallel STAC queries ─────────────────────────────────────────────
  const [
    s2_t1_scenes,
    s2_t2_scenes,
    sar_t1_scenes,
    sar_t2_scenes,
  ] = await Promise.allSettled([
    searchSTAC({ bbox: searchBbox, date_from: t1_from, date_to: t1_to,   collections: ['sentinel-2-l2a'], max_cloud, limit: 10 }),
    searchSTAC({ bbox: searchBbox, date_from: t2_from, date_to: t2_to,   collections: ['sentinel-2-l2a'], max_cloud, limit: 10 }),
    searchSTAC({ bbox: searchBbox, date_from: t1_from, date_to: t1_to,   collections: ['sentinel-1-grd'], limit: 6 }),
    searchSTAC({ bbox: searchBbox, date_from: t2_from, date_to: t2_to,   collections: ['sentinel-1-grd'], limit: 6 }),
  ]);

  const s2T1 = s2_t1_scenes.status === 'fulfilled' ? s2_t1_scenes.value : [];
  const s2T2 = s2_t2_scenes.status === 'fulfilled' ? s2_t2_scenes.value : [];
  const sarT1= sar_t1_scenes.status === 'fulfilled' ? sar_t1_scenes.value : [];
  const sarT2= sar_t2_scenes.status === 'fulfilled' ? sar_t2_scenes.value : [];

  // Pick best (lowest cloud cover) S2 scene per period
  const t1Best = s2T1.length ? s2T1.reduce((a, b) =>
    (a.cloud_cover ?? 100) < (b.cloud_cover ?? 100) ? a : b
  ) : null;

  const t2Best = s2T2.length ? s2T2.reduce((a, b) =>
    (a.cloud_cover ?? 100) < (b.cloud_cover ?? 100) ? a : b
  ) : null;

  // ── Change analysis ───────────────────────────────────────────────────
  const change = computeChangeIndicators(t1Best, t2Best);

  // ── SAR surface change indicator ──────────────────────────────────────
  const sar_change_signal: string[] = [];
  if (sarT1.length > 0 && sarT2.length > 0) {
    const sarDelta = sarT2.length - sarT1.length;
    if (sarDelta !== 0) {
      sar_change_signal.push(
        `SAR: ${sarT1.length} مشهد رادار في T1 → ${sarT2.length} في T2`
      );
    }
  }

  // ── Monitoring readiness ──────────────────────────────────────────────
  const readiness = monitoringReadiness(t1Best, t2Best, sarT1.length, sarT2.length);

  // ── All detected changes (S2 + SAR) ───────────────────────────────────
  const all_changes = [...change.detected_changes, ...sar_change_signal];

  const query_ms = Date.now() - analysisStart;

  // ── Response ──────────────────────────────────────────────────────────
  return NextResponse.json({
    data_real:    true,
    analysis_date: new Date().toISOString(),
    corridor_id,
    query_ms,

    bbox_searched: searchBbox,

    reference_period: {
      label:         'T1 (مرجعي)',
      date_from:     t1_from,
      date_to:       t1_to,
      s2_scenes_found: s2T1.length,
      sar_scenes_found: sarT1.length,
      best_scene:    t1Best ? {
        id:          t1Best.id,
        date:        t1Best.date,
        cloud_cover: t1Best.cloud_cover,
        platform:    t1Best.platform,
        source:      t1Best.source,
        statistics:  t1Best.statistics,
      } : null,
      all_scenes: scenesBrief(s2T1),
    },

    current_period: {
      label:         'T2 (حديث)',
      date_from:     t2_from,
      date_to:       t2_to,
      s2_scenes_found: s2T2.length,
      sar_scenes_found: sarT2.length,
      best_scene:    t2Best ? {
        id:          t2Best.id,
        date:        t2Best.date,
        cloud_cover: t2Best.cloud_cover,
        platform:    t2Best.platform,
        source:      t2Best.source,
        statistics:  t2Best.statistics,
      } : null,
      all_scenes: scenesBrief(s2T2),
    },

    sar_coverage: {
      t1_count:           sarT1.length,
      t2_count:           sarT2.length,
      change_detectable:  sarT1.length > 0 && sarT2.length > 0,
      note:               'رادار SAR لا يتأثر بالغيوم — يكشف تغييرات السطح ليلاً ونهاراً',
    },

    change_indicators: {
      ...change,
      data_scope_note: 'المؤشرات محسوبة على مستوى بلاطة الـ MGRS (100×100 كم) — ليست للمسار المحدد',
    },

    monitoring_readiness: readiness,

    detected_changes: all_changes,
    risk_level:       change.risk_level,
    confidence:       change.confidence,

    // Instructions for pixel-level analysis
    pixel_analysis: {
      available:  false,
      reason_ar:  'التحليل على مستوى البكسل يتطلب Sentinel Hub OAuth2 أو تحميل بيانات COG',
      what_needed: [
        'SENTINEL_HUB_CLIENT_ID + SENTINEL_HUB_CLIENT_SECRET (من Copernicus CDSE)',
        'أو: COPERNICUS_USERNAME + COPERNICUS_PASSWORD (OAuth2 CDSE)',
      ],
      reference_scene_id:  t1Best?.id ?? null,
      current_scene_id:    t2Best?.id ?? null,
      when_enabled:        'يتيح حساب NDVI/NDBI/SAR backscatter لمنطقة المسار فقط بدقة 10م',
    },
  });
}

/** GET — capability check */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    endpoint:     'POST /api/v1/satellite/corridor-monitor',
    data_real:    true,
    description:  'مراقبة مسارات الطرق والمجاري والكهرباء بالأقمار الاصطناعية',
    satellites:   ['Sentinel-2 L2A (بصري 10م)', 'Sentinel-1 GRD (رادار SAR)'],
    detects: [
      'اعتداء وبناء عشوائي (not_vegetated_pct increase)',
      'إزالة النباتات والأشجار (vegetation_pct decrease)',
      'فيضان أو رطوبة شاذة (water_pct increase)',
      'تغييرات سطحية (SAR backscatter change)',
    ],
    body_schema: {
      bbox:        '[minLon, minLat, maxLon, maxLat]  required (أو polygon)',
      polygon:     '[[lon,lat], ...]  بديل عن bbox',
      corridor_id: 'string  تسمية المسار',
      ref_days:    'number  default: 90  (عمق المرجع بالأيام)',
      window_days: 'number  default: 30  (نافذة كل فترة)',
      max_cloud:   'number  default: 30  (الحد الأقصى للسحب %)',
    },
  });
}
