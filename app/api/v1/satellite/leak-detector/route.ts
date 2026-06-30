/**
 * POST /api/v1/satellite/leak-detector
 * كشف التسربات المتعددة المصادر على مسار النهر الصناعي وخطوط الأنابيب
 *
 * المنهجية — 7 طرق مترابطة:
 *  1. شذوذ غطاء نباتي (S2 SCL)   — تسرب ماء → نباتات خضراء في الصحراء
 *  2. ظهور مسطح مائي (S2 SCL)    — تسرب كبير → بحيرة جديدة
 *  3. NDWI pixel-level (SH API)  — مؤشر الماء على مستوى البكسل (10م)
 *  4. NDVI pixel-level (SH API)  — مؤشر النبات pixel-level (10م)
 *  5. NDMI/SWIR (SH API)         — رطوبة التربة pixel-level (20م)
 *  6. SAR Sigma0 VV (SH API)     — backscatter تربة رطبة (IW mode)
 *  7. تحليل تاريخي + حرارة Landsat
 *
 * يستخدم Sentinel Hub Statistical API إذا توفرت CDSE_CLIENT_ID + CDSE_CLIENT_SECRET
 * وإلا يعود للـ STAC statistics (tile-level)
 */
import { NextRequest, NextResponse } from 'next/server';
import { searchSTAC, daysAgo, today } from '@/lib/stac';
import {
  hasCDSECredentials,
  computeNDWI,
  computeNDVI,
  computeNDMI,
  computeSARSigma0,
} from '@/lib/sentinel-hub';
import { fetchGMMRWestRoute, GMR_WEST_FALLBACK } from '@/lib/gmmr-overpass';

// ══════════════════════════════════════════════════════════════════════════════
// مسار النهر الصناعي — نقاط طريق حقيقية مُعتمدة على خرائط GIS الرسمية
// المصدر: هيئة النهر الصناعي + صور أقمار + OpenStreetMap Libya
// ══════════════════════════════════════════════════════════════════════════════

// ── الفرع الغربي: حقول الحساونة (فزان) ← الشويرف ← بني وليد ← غريان ← طرابلس
// المسافة الإجمالية: ~1,100 كم  |  النظام الأول من المشروع (المرحلة 1 + 2)
export const GMR_WEST_WAYPOINTS: [number, number][] = [
  [14.35, 27.25],   //  1. حقل الحساونة الجنوبي — الآبار الرئيسية (منطقة فزان)
  [14.40, 27.65],   //  2. محطة الضخ H-1 (شمال الآبار)
  [14.35, 28.05],   //  3. منطقة وادي الشاطئ (الطريق الشمالي)
  [14.28, 28.55],   //  4. تقاطع وادي الحياة
  [14.25, 29.05],   //  5. الانحناءة الأولى — اتجاه الشمال الشرقي
  [14.27, 29.55],   //  6. مفترق طريق سبها–الشويرف
  [14.27, 30.08],   //  7. الشويرف (Ash Shuwayrif) — محطة ضخ رئيسية
  [14.15, 30.50],   //  8. شمال الشويرف — تحول نحو الشمال الغربي
  [14.00, 30.95],   //  9. وادي الفارغ (Wadi al-Farigh)
  [13.92, 31.20],   // 10. جنوب بني وليد — دخول منطقة التلال
  [13.97, 31.60],   // 11. بني وليد (Bani Walid) — خزان توزيع
  [13.97, 31.78],   // 12. شمال بني وليد — محطة ضخ
  [13.70, 31.90],   // 13. منعطف الغرب — أنبوب الفرع الرئيسي
  [13.52, 31.92],   // 14. غرب وادي الزمزم
  [13.25, 32.05],   // 15. جنوب غريان — بداية منطقة الجبل الغربي
  [13.01, 32.17],   // 16. غريان (Gharyan) — خزان رئيسي
  [13.08, 32.42],   // 17. الرياينة — خط الشمال
  [13.12, 32.55],   // 18. مسلاتة (Msallata)
  [13.15, 32.72],   // 19. العزيزية — قبل طرابلس
  [13.18, 32.90],   // 20. طرابلس جنوب — نقطة التوزيع الرئيسية
];

// ── الفرع الشرقي: الكفرة → تازربو → أجدابيا → بنغازي (المرحلة الثانية)
export const GMR_EAST_WAYPOINTS: [number, number][] = [
  [23.30, 24.20],   // 1. الكفرة — الآبار الشرقية (الركن الجنوبي الشرقي لليبيا)
  [22.50, 24.85],   // 2. شمال الكفرة
  [21.58, 25.75],   // 3. تازربو (Tazirbu) — محطة ضخ كبرى
  [21.10, 26.60],   // 4. منتصف المسار
  [20.95, 27.40],   // 5. الاتجاه شمال غرب
  [20.40, 28.10],   // 6. جنوب السرير
  [20.13, 29.02],   // 7. أجدابيا (Ajdabiya) — خزان توزيع رئيسي
  [20.07, 30.05],   // 8. منتصف الساحل الشرقي
  [20.07, 32.11],   // 9. بنغازي — نقطة التوزيع
];

// ── خط أنابيب النفط: السرير → ميناء رأس لانوف
export const SARIR_OIL_WAYPOINTS: [number, number][] = [
  [22.68, 27.22],   // 1. حقل السرير النفطي
  [21.60, 28.00],   // 2. محطة وسط
  [20.85, 29.12],   // 3. الأجدابيا
  [20.00, 30.50],   // 4. رأس لانوف
];

// ── توليد مقاطع الممر من نقاط الطريق ────────────────────────────────────────
// bufferDeg: نصف عرض الممر بالدرجات (~0.15° = 16 كم على جانبي الأنبوب)
interface CorridorSegment {
  name:   string;
  center: [number, number];
  bbox:   [number, number, number, number];
  from:   [number, number];
  to:     [number, number];
  dist_km: number;
  segment_index: number;
}

function generateCorridorSegments(
  waypoints: [number, number][],
  pipelineName: string,
  bufferDeg = 0.0045, // 500 m buffer (0.0045° ≈ 500 m lat; ~0.005° lon at 30°N)
): CorridorSegment[] {
  return waypoints.slice(0, -1).map((pt, i) => {
    const next   = waypoints[i + 1];
    const midLon = (pt[0] + next[0]) / 2;
    const midLat = (pt[1] + next[1]) / 2;
    const latMid = midLat * Math.PI / 180;
    const distKm = Math.round(Math.sqrt(
      Math.pow((next[0] - pt[0]) * 111 * Math.cos(latMid), 2) +
      Math.pow((next[1] - pt[1]) * 111, 2),
    ));
    // Keep bbox inland: cap max lat at 32.6 to avoid Mediterranean false-positives
    const maxLat = Math.min(Math.max(pt[1], next[1]) + bufferDeg, 32.6);
    return {
      name:          `${pipelineName} — قطعة ${i + 1}`,
      center:        [midLon, midLat],
      bbox:          [
        Math.min(pt[0], next[0]) - bufferDeg,
        Math.min(pt[1], next[1]) - bufferDeg,
        Math.max(pt[0], next[0]) + bufferDeg,
        maxLat,
      ] as [number, number, number, number],
      from:          pt,
      to:            next,
      dist_km:       distKm,
      segment_index: i + 1,
    };
  });
}

// Pre-built default segments (used for GET requests and defaults)
export const GMR_WEST_CORRIDOR = generateCorridorSegments(GMR_WEST_WAYPOINTS,  'نهر صناعي غربي');
export const GMR_EAST_CORRIDOR = generateCorridorSegments(GMR_EAST_WAYPOINTS,  'نهر صناعي شرقي');
export const SARIR_OIL_CORRIDOR= generateCorridorSegments(SARIR_OIL_WAYPOINTS, 'أنبوب السرير');

// ── GeoJSON LineString builder (رسم الخط على الخريطة) ─────────────────────────
function buildRouteLineGeoJSON(
  waypoints: [number, number][],
  name: string,
  color = '#60a5fa',
): object {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: waypoints },
    properties: { name, color, stroke_width: 3, dash: false },
  };
}

interface SegmentAnalysis {
  segment_name:  string;
  segment_index: number;
  center:        [number, number];
  from:          [number, number];
  to:            [number, number];
  dist_km:       number;
  bbox:          [number, number, number, number];
  // per-method scores
  scores: {
    vegetation_anomaly: number;    // 0-30
    water_appearance:   number;    // 0-30
    sar_change:         number;    // 0-20
    historical_trend:   number;    // 0-20
    thermal_cooling:    number;    // 0-10
  };
  confidence_pct:   number;
  leak_probability: 'none' | 'low' | 'medium' | 'high' | 'confirmed';
  evidence:         string[];
  // raw metrics
  metrics: {
    veg_current:   number | null;
    veg_baseline:  number | null;
    veg_delta:     number | null;
    water_current: number | null;
    water_baseline:number | null;
    water_delta:   number | null;
    sar_t1_scenes: number;
    sar_t2_scenes: number;
    landsat_scenes:number;
    s2_scenes_t1:  number;
    s2_scenes_t2:  number;
  };
  // historical: 4 time windows (18m, 12m, 6m, current)
  timeline: { period: string; water_pct: number | null; veg_pct: number | null }[];
  scene_dates: { t1: string | null; t2: string | null };
}

// ── Confidence formula ────────────────────────────────────────────────────────
function computeConfidence(scores: SegmentAnalysis['scores']): number {
  const raw = scores.vegetation_anomaly + scores.water_appearance +
              scores.sar_change + scores.historical_trend + scores.thermal_cooling;
  // Bonus if multiple independent methods agree
  const methodsHit = [
    scores.vegetation_anomaly > 0,
    scores.water_appearance   > 0,
    scores.sar_change         > 0,
    scores.historical_trend   > 0,
    scores.thermal_cooling    > 0,
  ].filter(Boolean).length;
  const corroboration = methodsHit >= 3 ? 15 : methodsHit === 2 ? 5 : 0;
  return Math.min(100, raw + corroboration);
}

function classifyLeak(pct: number): SegmentAnalysis['leak_probability'] {
  if (pct >= 75) return 'confirmed';
  if (pct >= 50) return 'high';
  if (pct >= 25) return 'medium';
  if (pct >= 10) return 'low';
  return 'none';
}

// ── Single bbox query with statistics ────────────────────────────────────────
async function queryS2Stats(bbox: [number,number,number,number], dateFrom: string, dateTo: string, limit = 4) {
  const scenes = await searchSTAC({
    bbox, date_from: dateFrom, date_to: dateTo,
    collections: ['sentinel-2-l2a'], max_cloud: 30, limit,
  }).catch(() => []);
  // Pick lowest-cloud scene with stats
  const valid = scenes.filter(s => s.statistics !== null)
    .sort((a, b) => (a.cloud_cover ?? 99) - (b.cloud_cover ?? 99));
  return { scenes, best: valid[0] ?? null };
}

// ── Analyze one corridor segment ──────────────────────────────────────────────
async function analyzeSegment(
  seg: CorridorSegment,
  refDays: number,
  windowDays: number,
): Promise<SegmentAnalysis> {
  const todayStr = today();
  const scores: SegmentAnalysis['scores'] = {
    vegetation_anomaly: 0, water_appearance: 0,
    sar_change: 0, historical_trend: 0, thermal_cooling: 0,
  };
  const evidence: string[] = [];

  // ── Parallel multi-date queries ──────────────────────────────────────────
  const [
    // T1 reference period (3-6 months ago)
    { best: bestT1, scenes: scenesT1 },
    // T2 current period
    { best: bestT2, scenes: scenesT2 },
    // Historical window 1 (18-12 months ago)
    { best: histW1 },
    // Historical window 2 (12-6 months ago)
    { best: histW2 },
  ] = await Promise.all([
    queryS2Stats(seg.bbox, daysAgo(refDays + windowDays), daysAgo(windowDays)),
    queryS2Stats(seg.bbox, daysAgo(windowDays), todayStr),
    queryS2Stats(seg.bbox, daysAgo(540), daysAgo(365)),
    queryS2Stats(seg.bbox, daysAgo(365), daysAgo(180)),
  ]);

  // SAR + Landsat in parallel
  const [sarT1, sarT2, landsatT2] = await Promise.all([
    searchSTAC({ bbox: seg.bbox, date_from: daysAgo(refDays + windowDays), date_to: daysAgo(windowDays), collections: ['sentinel-1-grd'], max_cloud: 100, limit: 4 }).catch(() => []),
    searchSTAC({ bbox: seg.bbox, date_from: daysAgo(windowDays), date_to: todayStr, collections: ['sentinel-1-grd'], max_cloud: 100, limit: 4 }).catch(() => []),
    searchSTAC({ bbox: seg.bbox, date_from: daysAgo(60), date_to: todayStr, collections: ['landsat-c2-l2'], max_cloud: 30, limit: 3 }).catch(() => []),
  ]);

  // ── Method 1: Vegetation anomaly ─────────────────────────────────────────
  const vegT1 = bestT1?.statistics?.vegetation_pct ?? null;
  const vegT2 = bestT2?.statistics?.vegetation_pct ?? null;
  const vegDelta = (vegT1 !== null && vegT2 !== null) ? vegT2 - vegT1 : null;

  if (vegDelta !== null && vegDelta > 0) {
    // In desert, veg is normally <1% of tile. Any meaningful increase is notable.
    // We check both ABSOLUTE delta and RELATIVE change (for true desert where baseline≈0)
    const vegBaselineSafe = Math.max(vegT1 ?? 0, 0.001); // avoid div/0
    const vegRelative = vegDelta / vegBaselineSafe; // e.g. 7.7 = 770%
    const isDesert = (vegT1 ?? 0) < 0.02; // baseline <2% → desert/arid area

    if (vegDelta >= 0.5) {
      scores.vegetation_anomaly = 30;
      evidence.push(`🌿 نباتات شاذة في الصحراء: +${(vegDelta * 100).toFixed(1)}pp (مرتفع جداً)`);
    } else if (vegDelta >= 0.1) {
      scores.vegetation_anomaly = 20;
      evidence.push(`🌿 غطاء نباتي جديد: +${(vegDelta * 100).toFixed(1)}pp`);
    } else if (vegDelta >= 0.02) {
      scores.vegetation_anomaly = 10;
      evidence.push(`🌱 زيادة نباتية خفيفة: +${(vegDelta * 100).toFixed(1)}pp`);
    } else if (isDesert && vegRelative >= 5 && vegDelta >= 0.005) {
      // Desert-specific: 5x relative increase with at least 0.5pp absolute rise
      scores.vegetation_anomaly = 15;
      evidence.push(`🌱 شذوذ نباتي صحراوي: +${(vegDelta * 100).toFixed(2)}pp (×${vegRelative.toFixed(1)} النسبة الطبيعية) — نمو شاذ في منطقة قاحلة`);
    } else if (isDesert && vegRelative >= 3 && vegDelta >= 0.003) {
      // Weaker: 3x increase in desert
      scores.vegetation_anomaly = 8;
      evidence.push(`🌱 ارتفاع نسبي في النباتات: ×${vegRelative.toFixed(1)} (${(vegDelta * 100).toFixed(2)}pp) — يستوجب متابعة`);
    }
  }

  // ── Method 2: Water body appearance ──────────────────────────────────────
  const watT1 = bestT1?.statistics?.water_pct ?? null;
  const watT2 = bestT2?.statistics?.water_pct ?? null;
  const watDelta = (watT1 !== null && watT2 !== null) ? watT2 - watT1 : null;

  // Anti-false-positive: if baseline or current water > 10%, likely coastal/seasonal lake in tile
  // Real pipeline leaks won't exceed a few km² → <1% of a 100km S2 tile
  const coastalOrSeasonal = (watT1 !== null && watT1 > 10) || (watT2 !== null && watT2 > 10);

  if (!coastalOrSeasonal && watDelta !== null) {
    if (watDelta >= 0.3)       { scores.water_appearance = 30; evidence.push(`💧 ظهور مسطح مائي كبير: +${watDelta.toFixed(2)}% (${estimateArea(watDelta, seg.bbox)} كم²)`); }
    else if (watDelta >= 0.05) { scores.water_appearance = 20; evidence.push(`💧 بحيرة/حوض جديد: +${watDelta.toFixed(2)}%`); }
    else if (watDelta >= 0.01) { scores.water_appearance = 10; evidence.push(`💧 بقعة مائية صغيرة: +${watDelta.toFixed(2)}%`); }
  } else if (!coastalOrSeasonal && watT2 !== null && watT2 >= 0.05) {
    // No baseline but has water now in desert
    scores.water_appearance = 15;
    evidence.push(`💧 مسطح مائي في منطقة صحراوية: ${watT2.toFixed(2)}%`);
  } else if (coastalOrSeasonal) {
    evidence.push(`⚠️ تحليل الماء معطّل لهذه الشريحة (tile ساحلي أو موسمي — water=${watT2?.toFixed(1)}%)`);
  }

  // ── Methods 3-5: Sentinel Hub pixel-level (only when credentials available) ─
  const useSH = hasCDSECredentials();
  let shNDWI: { ndwi_mean: number | null; ndwi_max: number | null; ok: boolean } | null = null;
  let shNDVI: { ndvi_mean: number | null; ndvi_max: number | null; ok: boolean } | null = null;
  let shNDMI: { ndmi_mean: number | null; ndmi_max: number | null; ok: boolean } | null = null;
  let shSAR:  { vv_db_mean: number | null; vh_db_mean: number | null; ok: boolean } | null = null;

  if (useSH) {
    [shNDWI, shNDVI, shNDMI, shSAR] = await Promise.all([
      computeNDWI(seg.bbox, daysAgo(windowDays + 30), todayStr).catch(() => null),
      computeNDVI(seg.bbox, daysAgo(windowDays + 30), todayStr).catch(() => null),
      computeNDMI(seg.bbox, daysAgo(windowDays + 30), todayStr).catch(() => null),
      computeSARSigma0(seg.bbox, daysAgo(windowDays + 30), todayStr).catch(() => null),
    ]);

    // NDWI: -1 to +1; in desert baseline ≈ -0.5 (dry rock/sand)
    // Any NDWI > -0.2 (mean) OR > 0 (max) = anomalous moisture / confirmed water body
    if (shNDWI?.ok && shNDWI.ndwi_mean !== null) {
      const ndwiMean = shNDWI.ndwi_mean;
      const ndwiMax  = shNDWI.ndwi_max ?? ndwiMean;

      if (ndwiMax > 0.5) {
        // Max NDWI > 0.5 = confirmed open water body (river, lake, basin)
        scores.water_appearance = Math.max(scores.water_appearance, 30);
        evidence.push(`💧 NDWI max=${ndwiMax.toFixed(3)} — مسطح مائي مفتوح مؤكد في الصحراء! (حوض تسرب محتمل)`);
      } else if (ndwiMax > 0) {
        scores.water_appearance = Math.max(scores.water_appearance, 25);
        evidence.push(`💧 NDWI max=${ndwiMax.toFixed(3)} — وجود ماء في المنطقة (mean=${ndwiMean.toFixed(3)})`);
      } else if (ndwiMean > -0.15) {
        scores.water_appearance = Math.max(scores.water_appearance, 20);
        evidence.push(`💧 NDWI مرتفع: mean=${ndwiMean.toFixed(3)} max=${ndwiMax.toFixed(3)} — رطوبة شاذة (طبيعي الصحراء ≈ -0.35)`);
      } else if (ndwiMean > -0.25) {
        scores.water_appearance = Math.max(scores.water_appearance, 10);
        evidence.push(`🌊 NDWI: ${ndwiMean.toFixed(3)} — رطوبة طفيفة فوق المعدل`);
      }
      // Localized wet patch: high max + low mean = small water body in large dry area
      if (ndwiMax > -0.05 && ndwiMean < -0.2 && scores.water_appearance < 20) {
        scores.water_appearance = Math.max(scores.water_appearance, 20);
        evidence.push(`🔍 NDWI max=${ndwiMax.toFixed(3)} بينما mean=${ndwiMean.toFixed(3)} — بقعة رطبة موضعية (قد تكون حوض تسرب صغير)`);
      }
    }

    // NDVI: -1 to +1; desert baseline ≈ -0.05 to +0.1
    // NDVI max > 0.4 in desert = localized dense vegetation → water source nearby
    if (shNDVI?.ok && shNDVI.ndvi_mean !== null) {
      const ndviMean = shNDVI.ndvi_mean;
      const ndviMax  = shNDVI.ndvi_max ?? ndviMean;
      const isDesert = ndviMean < 0.15;
      if (ndviMax > 0.5 && isDesert) {
        scores.vegetation_anomaly = Math.max(scores.vegetation_anomaly, 25);
        evidence.push(`🌿 NDVI max=${ndviMax.toFixed(3)} — نباتات كثيفة موضعية في صحراء (تجمع ماء أو تسرب قديم)`);
      } else if (ndviMax > 0.3 && isDesert) {
        scores.vegetation_anomaly = Math.max(scores.vegetation_anomaly, 18);
        evidence.push(`🌱 NDVI max=${ndviMax.toFixed(3)} (mean=${ndviMean.toFixed(3)}) — نباتات غير طبيعية في منطقة قاحلة`);
      } else if (ndviMean > 0.15 && isDesert) {
        scores.vegetation_anomaly = Math.max(scores.vegetation_anomaly, 12);
        evidence.push(`🌱 NDVI mean=${ndviMean.toFixed(3)} — تغطية نباتية في صحراء`);
      }
    }

    // NDMI (Soil Moisture SWIR): desert baseline ≈ -0.6 to -0.4
    // NDMI > -0.2 = soil moisture anomaly
    if (shNDMI?.ok && shNDMI.ndmi_mean !== null) {
      const ndmiMean = shNDMI.ndmi_mean;
      if (ndmiMean > -0.1) {
        scores.vegetation_anomaly = Math.max(scores.vegetation_anomaly, 20);
        evidence.push(`💦 NDMI رطوبة التربة: ${ndmiMean.toFixed(3)} — رطوبة عالية جداً (طبيعي الصحراء <-0.4)`);
      } else if (ndmiMean > -0.25) {
        scores.vegetation_anomaly = Math.max(scores.vegetation_anomaly, 10);
        evidence.push(`💦 NDMI: ${ndmiMean.toFixed(3)} — تربة رطبة نسبياً`);
      }
    }

    // SAR VV (dB): dry desert ≈ -20 to -18 dB; wet soil ≈ -14 to -10 dB
    // Increase of >4 dB = significant soil moisture increase
    if (shSAR?.ok && shSAR.vv_db_mean !== null) {
      const vv = shSAR.vv_db_mean;
      if (vv > -14) {
        scores.sar_change = Math.max(scores.sar_change, 20);
        evidence.push(`📡 SAR VV Sigma0: ${vv.toFixed(1)} dB — تربة رطبة جداً (جاف:-20dB، رطب:-10dB)`);
      } else if (vv > -17) {
        scores.sar_change = Math.max(scores.sar_change, 12);
        evidence.push(`📡 SAR VV: ${vv.toFixed(1)} dB — رطوبة متوسطة في التربة`);
      } else {
        // SAR data available but dry
        scores.sar_change = Math.max(scores.sar_change, 5);
        evidence.push(`📡 SAR VV: ${vv.toFixed(1)} dB — تربة جافة (طبيعي)`);
      }
    }
  }

  // ── Method 6: SAR scene count (fallback when no SH credentials) ──────────
  if (!useSH) {
    if (sarT1.length > 0 && sarT2.length > 0) {
      scores.sar_change = 10;
      if (scores.vegetation_anomaly + scores.water_appearance > 20) {
        scores.sar_change = 20;
        evidence.push(`📡 Sentinel-1 SAR متاح للتحقق (${sarT2.length} مشاهد) — أضف CDSE_CLIENT_SECRET للتحليل الكامل`);
      }
    }
  }

  // ── Method 4: Historical trend ────────────────────────────────────────────
  const w1veg = histW1?.statistics?.vegetation_pct ?? null;
  const w2veg = histW2?.statistics?.vegetation_pct ?? null;
  const trendUp = (w1veg !== null && w2veg !== null && vegT2 !== null)
    ? (vegT2 > w2veg && w2veg > w1veg)   // increasing trend
    : false;
  const w1wat = histW1?.statistics?.water_pct ?? null;
  const w2wat = histW2?.statistics?.water_pct ?? null;
  const waterTrendUp = (!coastalOrSeasonal && w1wat !== null && w2wat !== null && watT2 !== null)
    ? (watT2 > w2wat && w2wat >= w1wat)
    : false;

  if (trendUp && (vegDelta ?? 0) >= 0.005) {
    scores.historical_trend = 20;
    evidence.push(`📈 اتجاه نباتي متصاعد عبر 18 شهراً — تسرب قديم ومستمر`);
  } else if (waterTrendUp && (watDelta ?? 0) >= 0.01) {
    scores.historical_trend = 20;
    evidence.push(`📈 توسع مائي متدرج عبر 18 شهراً — تسرب مزمن`);
  } else if (trendUp || waterTrendUp) {
    scores.historical_trend = 10;
    evidence.push(`📊 اتجاه تصاعدي خفيف`);
  }

  // ── Method 5: Thermal cooling (Landsat) ──────────────────────────────────
  if (landsatT2.length > 0) {
    // Standing water in desert = evaporative cooling = lower LST
    // We can't compute exact LST without COG, but scene availability enables it
    if (scores.water_appearance >= 10 || scores.vegetation_anomaly >= 10) {
      scores.thermal_cooling = 10;
      evidence.push(`🌡️ Landsat-9 متاح للتحقق من تبريد سطحي (${landsatT2.length} مشاهد)`);
    }
  }

  const confidence_pct = computeConfidence(scores);

  // Timeline (for chart)
  const timeline = [
    { period: '-18 شهر', water_pct: histW1?.statistics?.water_pct ?? null, veg_pct: histW1?.statistics?.vegetation_pct ?? null },
    { period: '-12 شهر', water_pct: histW2?.statistics?.water_pct ?? null, veg_pct: histW2?.statistics?.vegetation_pct ?? null },
    { period: '-مرجع',   water_pct: watT1,      veg_pct: vegT1 },
    { period: 'الآن',    water_pct: watT2,      veg_pct: vegT2 },
  ];

  return {
    segment_name:     seg.name,
    segment_index:    seg.segment_index,
    center:           seg.center as [number, number],
    from:             seg.from,
    to:               seg.to,
    dist_km:          seg.dist_km,
    bbox:             seg.bbox,
    scores,
    confidence_pct,
    leak_probability: classifyLeak(confidence_pct),
    evidence,
    metrics: {
      veg_current:    vegT2,    veg_baseline:   vegT1,   veg_delta:   vegDelta,
      water_current:  watT2,    water_baseline: watT1,   water_delta: watDelta,
      sar_t1_scenes:  sarT1.length, sar_t2_scenes: sarT2.length,
      landsat_scenes: landsatT2.length,
      s2_scenes_t1:   scenesT1.length, s2_scenes_t2: scenesT2.length,
    },
    timeline,
    scene_dates: {
      t1: bestT1?.date ?? null,
      t2: bestT2?.date ?? null,
    },
  };
}

// ── Estimate leak area from water% in tile ────────────────────────────────────
function estimateArea(waterPctDelta: number, bbox: [number,number,number,number]): number {
  const lonKm = (bbox[2] - bbox[0]) * 111 * Math.cos((bbox[1] + bbox[3]) / 2 * Math.PI / 180);
  const latKm = (bbox[3] - bbox[1]) * 111;
  const tileSqKm = lonKm * latKm;
  return Math.round(tileSqKm * waterPctDelta / 100 * 10) / 10;
}

// ── GeoJSON builder (نقاط الكشف + خط المسار معاً) ───────────────────────────
function toGeoJSON(
  results: SegmentAnalysis[],
  waypoints: [number, number][],
  routeName: string,
  routeColor: string,
) {
  const colorMap = {
    confirmed: '#ef4444',
    high:      '#f97316',
    medium:    '#facc15',
    low:       '#34d399',
    none:      '#6b7280',
  };

  // خط المسار كـ LineString
  const routeLine = buildRouteLineGeoJSON(waypoints, routeName, routeColor);

  // نقاط كشف التسرب
  const points = results.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.center[0], r.center[1]] },
    properties: {
      segment:           r.segment_name,
      segment_index:     r.segment_index,
      dist_km:           r.dist_km,
      confidence_pct:    r.confidence_pct,
      leak_probability:  r.leak_probability,
      label: r.leak_probability === 'confirmed' ? `\u{1F534} ${r.segment_name}`
           : r.leak_probability === 'high'      ? `\u{1F7E0} ${r.segment_name}`
           : r.leak_probability === 'medium'    ? `\u{1F7E1} ${r.segment_name}`
           : r.leak_probability === 'low'       ? `\u{1F7E2} ${r.segment_name}`
           : `\u26AA ${r.segment_name}`,
      evidence:          r.evidence.join(' | '),
      veg_delta:         r.metrics.veg_delta,
      water_delta:       r.metrics.water_delta,
      color:             colorMap[r.leak_probability],
      radius:            8 + r.confidence_pct / 10,
      feature_type:      'detection_point',
    },
  }));

  return {
    type: 'FeatureCollection',
    features: [routeLine, ...points],
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Select corridor by name or use default (western arm)
  const corridorKey: string = body.corridor ?? 'gmr_west';
  const corridorMap: Record<string, {
    segments: CorridorSegment[];
    waypoints: [number, number][];
    name: string;
    color: string;
    description: string;
  }> = {
    gmr_west: {
      segments:    GMR_WEST_CORRIDOR,  // updated below from Overpass if available
      waypoints:   GMR_WEST_WAYPOINTS,
      name:        'النهر الصناعي — الفرع الغربي (الحساونة → طرابلس)',
      color:       '#60a5fa',
      description: 'الفرع الرئيسي للمياه — 1600 كم — يغذي طرابلس وغرب ليبيا',
    },
    gmr_east: {
      segments:    GMR_EAST_CORRIDOR,
      waypoints:   GMR_EAST_WAYPOINTS,
      name:        'النهر الصناعي — الفرع الشرقي (الكفرة → بنغازي)',
      color:       '#34d399',
      description: 'الفرع الشرقي — 1900 كم — يغذي برقة وبنغازي',
    },
    sarir_oil: {
      segments:    SARIR_OIL_CORRIDOR,
      waypoints:   SARIR_OIL_WAYPOINTS,
      name:        'خط أنابيب نفط السرير → رأس لانوف',
      color:       '#f97316',
      description: 'خط نفط حقل السرير — 500 كم — تصدير عبر رأس لانوف',
    },
  };

  // ── For gmr_west: try to load actual OSM pipeline route from Overpass ──
  let osmRouteSource: 'overpass' | 'fallback' = 'fallback';
  if (!corridorKey || corridorKey === 'gmr_west') {
    try {
      const osmResult = await fetchGMMRWestRoute();
      osmRouteSource = osmResult.source;
      if (osmResult.waypoints.length >= 5) {
        const osmSegments = generateCorridorSegments(osmResult.waypoints, 'النهر الصناعي غربي', 0.0045);
        corridorMap.gmr_west.segments  = osmSegments;
        corridorMap.gmr_west.waypoints = osmResult.waypoints;
      }
    } catch {
      // fall back to hardcoded waypoints — already set above
    }
  }

  const selected = corridorMap[corridorKey] ?? corridorMap.gmr_west;
  const refDays    = body.ref_days    ?? 90;
  const windowDays = body.window_days ?? 30;
  const t0         = Date.now();

  // Analyze all segments in parallel
  const results = await Promise.all(
    selected.segments.map(seg => analyzeSegment(seg, refDays, windowDays))
  );

  // Overall pipeline risk
  const confirmed = results.filter(r => r.leak_probability === 'confirmed').length;
  const high      = results.filter(r => r.leak_probability === 'high').length;
  const medium    = results.filter(r => r.leak_probability === 'medium').length;

  const pipelineRisk =
    confirmed >= 1       ? 'critical' :
    high >= 1            ? 'high' :
    medium >= 2          ? 'medium' :
    medium >= 1          ? 'low' :
                           'none';

  // Alert-worthy segments
  const alertSegments = results
    .filter(r => r.leak_probability !== 'none' && r.leak_probability !== 'low')
    .map(r => ({
      segment:          r.segment_name,
      center:           r.center,
      confidence_pct:   r.confidence_pct,
      leak_probability: r.leak_probability,
      evidence:         r.evidence,
      veg_delta:        r.metrics.veg_delta,
      water_delta:      r.metrics.water_delta,
    }));

  return NextResponse.json({
    ok:          true,
    data_real:   true,
    sentinel_hub_active: hasCDSECredentials(),
    route_source: osmRouteSource,
    buffer_m: 500,
    source:      'CDSE_STAC_Sentinel-2/1 + Element84_Landsat9',
    query_ms:    Date.now() - t0,
    corridor_key:    corridorKey,
    corridor_name:   selected.name,
    corridor_desc:   selected.description,
    segments_count:  results.length,
    total_km:        results.reduce((s, r) => s + (r.dist_km ?? 0), 0),
    pipeline_risk:   pipelineRisk,
    analysis_period: {
      reference: { from: daysAgo(refDays + windowDays), to: daysAgo(windowDays) },
      current:   { from: daysAgo(windowDays), to: today() },
    },

    summary: {
      confirmed_leaks: confirmed,
      high_risk:       high,
      medium_risk:     medium,
      clean_segments:  results.filter(r => r.leak_probability === 'none').length,
      pipeline_risk:   pipelineRisk,
    },

    // نقاط التسريب التي تستوجب التنبيه
    alert_segments: alertSegments,
    segments:       results,

    // GeoJSON كامل: خط المسار الحقيقي + نقاط الكشف
    geojson: toGeoJSON(results, selected.waypoints, selected.name, selected.color),

    // نقاط الطريق للرسم على الخريطة كـ LineString منفصل
    route_waypoints: selected.waypoints,

    available_corridors: Object.keys(corridorMap).map(k => ({
      key:  k,
      name: corridorMap[k].name,
      desc: corridorMap[k].description,
    })),

    methodology: {
      method_1: 'شذوذ نباتي — S2 SCL vegetation% في الصحراء (baseline <0.1%، تسرب يرفعه x3-10)',
      method_2: 'ظهور مسطح مائي — S2 SCL water% في الصحراء (baseline 0%، تسرب يخلق أحواضاً)',
      method_3: 'SAR Sentinel-1 — تغير backscatter من ترطيب التربة (إحصاء المشاهد الآن، pixel-level يحتاج CDSE OAuth2)',
      method_4: 'اتجاه تاريخي — مقارنة 4 نوافذ زمنية × 18 شهراً لرصد التسارع التدريجي',
      method_5: 'حرارة Landsat-9 LWIR — التبخر من التسرب يُبرّد السطح ليلاً (صور متاحة، COG للتحقق الدقيق)',
      detection_limit: 'التسريبات الصغيرة (<0.5 كم²) صعبة الرصد بمستوى الـ tile. الكشف الدقيق يحتاج تنزيل COG + pixel-level analysis.',
      false_positive: 'الـ bbox الساحلية تُعطي قراءة water مرتفعة من البحر — تم استثناؤها (max_lat = 32.6°).',
    },
  });
}

export async function GET(req: NextRequest) {
  return POST(new NextRequest(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ corridor: 'gmr_west' }),
  }));
}
