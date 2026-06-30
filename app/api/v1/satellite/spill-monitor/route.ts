/**
 * POST /api/v1/satellite/spill-monitor
 * كشف تسربات المياه وتغيرات المسطحات المائية عبر:
 * - Sentinel-2 SCL (تغير نسبة بكسل الماء داخل منطقة محددة)
 * - Sentinel-1 SAR (كشف الزيت على الماء عبر تغير backscatter)
 * - Landsat-9 (نطاق SWIR للتمييز بين الزيت والماء والتربة)
 *
 * ⚠️ مهم — ما الذي يُكشف فعلاً:
 * - النظام يعمل بإحصائيات SCL على مستوى الـ tile (بلاطة 100km×100km)
 * - مناسب لكشف تغيرات كبيرة: فيضانات، تكوّن بحيرات، تسريبات واسعة
 * - التسريبات الصغيرة (<1km²) تتطلب تحليل pixel مباشر (يحتاج مصادقة CDSE)
 * - ابتعد عن bbox قريب من الساحل — المتوسط يشوّه نسبة الماء في الـ tile
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  searchSTAC,
  polygonToBbox,
  expandBbox,
  computeChangeIndicators,
  daysAgo,
  today,
} from '@/lib/stac';

// ── Spill type classification ──────────────────────────────────────────────
function classifySpillRisk(
  water_delta: number,
  not_veg_delta: number,
  sar_t1: number,
  sar_t2: number,
): { risk: string; indicators: string[]; spill_types: string[] } {
  const indicators: string[] = [];
  const spill_types: string[] = [];

  // Water body expansion → possible surface spill / pipeline leak flooding
  if (water_delta >= 3) {
    indicators.push(`توسع مائي غير طبيعي: +${water_delta.toFixed(1)}%`);
    spill_types.push('water_surface_expansion');
  }
  if (water_delta >= 8) {
    indicators.push('تسرب سطحي مرجح — مسطح مائي ظهر فجأة');
    spill_types.push('probable_spill');
  }

  // Vegetation die-off near water → possible toxic spill/contamination
  if (water_delta >= 3 && not_veg_delta >= 3) {
    indicators.push('جفاف نباتي مع توسع مائي — احتمال تلوث');
    spill_types.push('contamination_risk');
  }

  // SAR coverage available for both periods → can detect oil on water
  const sarAvailable = sar_t1 > 0 && sar_t2 > 0;
  if (sarAvailable) {
    indicators.push('تغطية SAR متاحة — يمكن تحليل بقع الزيت على الماء بعد تنزيل البيانات');
    spill_types.push('sar_oil_detection_possible');
  }

  let risk = 'none';
  if (spill_types.includes('probable_spill') || (water_delta >= 5 && not_veg_delta >= 5)) {
    risk = 'high';
  } else if (water_delta >= 3 || not_veg_delta >= 5) {
    risk = 'medium';
  } else if (water_delta >= 1 || not_veg_delta >= 2) {
    risk = 'low';
  }

  return { risk, indicators, spill_types };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  let bbox: [number, number, number, number];
  if (body.bbox?.length === 4) {
    bbox = body.bbox;
  } else if (body.polygon) {
    bbox = expandBbox(polygonToBbox(body.polygon), 0.05);
  } else {
    return NextResponse.json({ detail: 'bbox أو polygon مطلوب' }, { status: 400 });
  }

  const refDays    = body.ref_days    ?? 60;   // فترة مرجعية
  const windowDays = body.window_days ?? 20;   // فترة المراقبة الحالية
  const maxCloud   = body.max_cloud   ?? 35;
  const spillType  = body.spill_type  ?? 'all'; // 'oil', 'water', 'all'

  const todayStr = today();
  const t0 = Date.now();

  // ── Parallel STAC queries ──────────────────────────────────────────────
  const [s2T1, s2T2, s1T1, s1T2, landsatT2] = await Promise.all([
    // Sentinel-2 reference period (vegetation + water bands via SCL)
    searchSTAC({
      bbox, date_from: daysAgo(refDays + windowDays), date_to: daysAgo(windowDays),
      collections: ['sentinel-2-l2a'], max_cloud: maxCloud, limit: 6,
    }).catch(() => []),

    // Sentinel-2 current period
    searchSTAC({
      bbox, date_from: daysAgo(windowDays), date_to: todayStr,
      collections: ['sentinel-2-l2a'], max_cloud: maxCloud, limit: 6,
    }).catch(() => []),

    // Sentinel-1 SAR reference (oil on water detection)
    searchSTAC({
      bbox, date_from: daysAgo(refDays + windowDays), date_to: daysAgo(windowDays),
      collections: ['sentinel-1-grd'], max_cloud: 100, limit: 4,
    }).catch(() => []),

    // Sentinel-1 SAR current
    searchSTAC({
      bbox, date_from: daysAgo(windowDays), date_to: todayStr,
      collections: ['sentinel-1-grd'], max_cloud: 100, limit: 4,
    }).catch(() => []),

    // Landsat-9 current (SWIR bands for surface composition)
    searchSTAC({
      bbox, date_from: daysAgo(windowDays), date_to: todayStr,
      collections: ['landsat-c2-l2'], max_cloud: maxCloud, limit: 3,
    }).catch(() => []),
  ]);

  // ── Pick best scenes ───────────────────────────────────────────────────
  const best = (arr: any[]) => arr.sort((a, b) => a.cloud_cover - b.cloud_cover)[0] ?? null;
  const bestS2T1 = best(s2T1);
  const bestS2T2 = best(s2T2);

  // ── Change detection ───────────────────────────────────────────────────
  const changeIndicators = (bestS2T1 && bestS2T2)
    ? computeChangeIndicators(bestS2T1, bestS2T2)
    : null;

  const waterDelta   = changeIndicators?.water_delta       ?? 0;
  const notVegDelta  = changeIndicators?.not_vegetated_delta ?? 0;
  const vegDelta     = changeIndicators?.vegetation_delta    ?? 0;

  const spillAnalysis = classifySpillRisk(waterDelta, notVegDelta, s1T1.length, s1T2.length);

  // ── SAR summary ────────────────────────────────────────────────────────
  const sarSummary = {
    t1_scenes: s1T1.length,
    t2_scenes: s1T2.length,
    t1_latest: s1T1[0] ? { id: s1T1[0].id, date: s1T1[0].date } : null,
    t2_latest: s1T2[0] ? { id: s1T2[0].id, date: s1T2[0].date } : null,
    oil_detection_method: 'Sentinel-1 SAR C-band — تسرب الزيت يُخمّد أمواج البحيرات والأنهار → بقعة داكنة في الصورة الراداريه',
    pixel_level_available: false,
    pixel_level_note: 'يتطلب تنزيل COG من Copernicus Data Space (يحتاج بيانات اعتماد CDSE)',
  };

  // ── Landsat SWIR summary ───────────────────────────────────────────────
  const landsatSummary = {
    t2_scenes: landsatT2.length,
    bands_available: ['coastal', 'blue', 'green', 'red', 'nir08', 'swir16', 'swir22', 'lwir11'],
    oil_detection_note: 'SWIR-16 (1.6μm) + SWIR-22 (2.2μm) تُميّز الزيت عن الماء والتربة — تحتاج byte-range COG',
    thermal_note: 'LWIR-11 (11μm) — يكشف تسخين خطوط أنابيب أو ضخ غير طبيعي',
    latest_scene: landsatT2[0] ? { id: landsatT2[0].id, date: landsatT2[0].date, cloud: landsatT2[0].cloud_cover } : null,
  };

  // ── Detection capability matrix ────────────────────────────────────────
  const detectionCapability = {
    oil_on_water: {
      method: 'Sentinel-1 SAR C-band backscatter',
      availability: s1T2.length > 0 ? 'available' : 'no_recent_scene',
      accuracy: 'عالية — بقع الزيت تُقلل قيم الـ backscatter بوضوح',
      limitation: 'يتطلب تنزيل الصورة الكاملة (100-500MB)',
    },
    water_body_change: {
      method: 'Sentinel-2 SCL Band 6 (water class)',
      availability: bestS2T2 ? 'available' : 'no_recent_scene',
      current_water_pct: bestS2T2?.statistics?.water ?? null,
      ref_water_pct:     bestS2T1?.statistics?.water ?? null,
      water_delta_pct:   waterDelta !== 0 ? waterDelta : null,
      accuracy: 'متوسطة-عالية — نسبة بكسل الماء في الـ tile',
    },
    pipeline_leak_land: {
      method: 'Landsat-9 SWIR-16 + Thermal LWIR-11',
      availability: landsatT2.length > 0 ? 'scene_available' : 'no_scene',
      accuracy: 'متوسطة — تكشف تجمعات سطحية كبيرة (>1000م²)',
      limitation: 'تسربات صغيرة لا تُكتشف — تحتاج صور جوية أو LiDAR',
    },
    river_turbidity: {
      method: 'Sentinel-2 Band 3 (Green) + Band 2 (Blue) — مؤشر العكارة',
      availability: bestS2T2 ? 'possible' : 'no_scene',
      accuracy: 'جيدة للمياه السطحية الكبيرة — ليبيا لديها مياه جوفية وليس أنهار كبيرة',
    },
  };

  return NextResponse.json({
    ok:          true,
    data_real:   true,
    source:      'CDSE_STAC (S2+S1+Landsat9) + Element84',
    query_ms:    Date.now() - t0,
    bbox,
    analysis_period: {
      reference: { from: daysAgo(refDays + windowDays), to: daysAgo(windowDays) },
      current:   { from: daysAgo(windowDays), to: todayStr },
    },

    // ── Spill risk assessment ──────────────────────────────────────────
    spill_risk:  spillAnalysis.risk,
    indicators:  spillAnalysis.indicators,
    spill_types: spillAnalysis.spill_types,

    // ── Change metrics ─────────────────────────────────────────────────
    change: changeIndicators ? {
      water_delta_pct:      waterDelta,
      vegetation_delta_pct: vegDelta,
      not_vegetated_delta:  notVegDelta,
      confidence:           changeIndicators.confidence,
    } : null,

    // ── Scene catalog ──────────────────────────────────────────────────
    scenes: {
      s2_t1: bestS2T1 ? { id: bestS2T1.id, date: bestS2T1.date, cloud: bestS2T1.cloud_cover, stats: bestS2T1.statistics } : null,
      s2_t2: bestS2T2 ? { id: bestS2T2.id, date: bestS2T2.date, cloud: bestS2T2.cloud_cover, stats: bestS2T2.statistics } : null,
    },
    sar:     sarSummary,
    landsat: landsatSummary,

    // ── What can be detected ───────────────────────────────────────────
    detection_capability: detectionCapability,

    // ── Next steps for full pixel analysis ────────────────────────────
    pixel_analysis_next_steps: [
      'تسجيل مجاني في Copernicus Data Space (dataspace.copernicus.eu)',
      'الحصول على CDSE OAuth2 token (refresh)',
      'تنزيل byte-range من COG للنطاقات الطيفية المطلوبة (SWIR+SAR)',
      'تطبيق خوارزمية Oil Spill Index = (SWIR16 - NIR) / (SWIR16 + NIR)',
    ],
  });
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const bbox = [
    parseFloat(p.get('min_lon') ?? '9.5'),
    parseFloat(p.get('min_lat') ?? '19.5'),
    parseFloat(p.get('max_lon') ?? '25.5'),
    parseFloat(p.get('max_lat') ?? '33.5'),
  ];
  return POST(new NextRequest(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bbox }),
  }));
}
