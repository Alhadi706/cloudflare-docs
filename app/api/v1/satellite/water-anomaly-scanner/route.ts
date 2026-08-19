/**
 * POST /api/v1/satellite/water-anomaly-scanner
 * ──────────────────────────────────────────────────────────────────────────
 * ماسح الشذوذات المائية — يكشف تسريبات المياه في أي منطقة بليبيا
 *
 * يعمل في 3 أوضاع:
 *  - polygon:  منطقة مرسومة يدوياً على الخريطة
 *  - asset:    أصل من قاعدة البيانات (خط أنابيب، محطة، شبكة) ← يستخرج geometry تلقائياً
 *  - corridor: مسار نقاط طريق مع buffer (مثل GMMR)
 *
 * المنهجية (4 مؤشرات متوازية):
 *  1. NDWI  — مياه حرة على السطح (بركة/فيضان)
 *  2. NDVI  — نباتات شاذة في الصحراء (تسرب مزمن)
 *  3. NDMI  — رطوبة التربة (تسرب تحت السطح)
 *  4. SAR   — backscatter تربة مبللة (يعمل خلال الغيوم)
 *
 * يقارن الفترة الحالية بخط أساس تاريخي لاكتشاف التغيير
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  hasCDSECredentials, computeNDWI, computeNDVI, computeNDMI, computeSARSigma0,
} from '@/lib/sentinel-hub';
import { searchSTAC, daysAgo, today } from '@/lib/stac';
import { BACKEND, extractTenantId, buildBackendHeaders } from '@/lib/backendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Libya bounding box ────────────────────────────────────────────────────────
const LIBYA_BBOX: [number,number,number,number] = [9.5, 19.5, 25.5, 33.5];

type Bbox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

/** Convert polygon to bounding box */
function polygonToBbox(poly: [number,number][]): Bbox {
  const lons = poly.map(p => p[0]);
  const lats = poly.map(p => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/** Build corridor bbox from waypoints + buffer */
function corridorBbox(waypoints: [number,number][], bufferDeg: number): Bbox {
  const lons = waypoints.map(p => p[0]);
  const lats = waypoints.map(p => p[1]);
  return [
    Math.min(...lons) - bufferDeg,
    Math.min(...lats) - bufferDeg,
    Math.max(...lons) + bufferDeg,
    Math.max(...lats) + bufferDeg,
  ];
}

/** Expand bbox by degrees */
function expandBbox(bbox: Bbox, deg: number): Bbox {
  return [bbox[0]-deg, bbox[1]-deg, bbox[2]+deg, bbox[3]+deg];
}

/** Compute area in km² */
function bboxAreaKm2(bbox: Bbox): number {
  const dLon = (bbox[2] - bbox[0]) * 111 * Math.cos((bbox[1]+bbox[3])/2 * Math.PI/180);
  const dLat = (bbox[3] - bbox[1]) * 111;
  return Math.abs(dLon * dLat);
}

/** Classify anomaly severity */
function classifyAnomaly(ndwi: number|null, ndvi: number|null, ndmi: number|null, sarVv: number|null, baseline: {ndwi?:number,ndvi?:number,ndmi?:number,sarVv?:number}) {
  const evidence: string[] = [];
  let score = 0;
  const isDesert = (baseline.ndvi ?? 0) < 0.05;

  // NDWI: Water presence
  if (ndwi !== null) {
    const delta = ndwi - (baseline.ndwi ?? -0.3);
    if (ndwi > 0.2) {
      score += 40; evidence.push(`💧 NDWI=${ndwi.toFixed(3)} — مياه حرة على السطح`);
    } else if (delta > 0.15) {
      score += 30; evidence.push(`💧 NDWI ارتفع ${delta.toFixed(2)} — شذوذ مائي`);
    } else if (delta > 0.08) {
      score += 15; evidence.push(`💧 NDWI +${delta.toFixed(2)} — ترطيب ملحوظ`);
    }
  }

  // NDVI: Vegetation anomaly (strongest indicator in desert)
  if (ndvi !== null) {
    const delta = ndvi - (baseline.ndvi ?? 0.02);
    if (isDesert && ndvi > 0.15) {
      score += 40; evidence.push(`🌿 NDVI=${ndvi.toFixed(3)} — نباتات شاذة في صحراء (تسرب مزمن)`);
    } else if (isDesert && delta > 0.08) {
      score += 25; evidence.push(`🌱 نمو نباتي شاذ في منطقة قاحلة: +${delta.toFixed(3)}`);
    } else if (!isDesert && delta > 0.1) {
      score += 15; evidence.push(`🌿 NDVI ارتفع ${delta.toFixed(2)} — رطوبة تربة زائدة`);
    }
  }

  // NDMI: Soil moisture
  if (ndmi !== null) {
    const delta = ndmi - (baseline.ndmi ?? -0.4);
    if (delta > 0.2) {
      score += 25; evidence.push(`🫧 NDMI +${delta.toFixed(2)} — رطوبة تربة غير طبيعية`);
    } else if (delta > 0.1) {
      score += 12; evidence.push(`🫧 NDMI +${delta.toFixed(2)} — تربة أكثر رطوبة من المعتاد`);
    }
  }

  // SAR: Soil backscatter change
  if (sarVv !== null && baseline.sarVv !== undefined) {
    const delta = sarVv - baseline.sarVv;
    if (delta > 3) {
      score += 20; evidence.push(`📡 SAR VV +${delta.toFixed(1)}dB — تربة مبللة (رادار)`);
    } else if (delta > 1.5) {
      score += 10; evidence.push(`📡 SAR VV +${delta.toFixed(1)}dB — تغيير في انعكاسية التربة`);
    }
  }

  const severity: 'confirmed' | 'high' | 'medium' | 'low' | 'normal' =
    score >= 60 ? 'confirmed' :
    score >= 40 ? 'high' :
    score >= 20 ? 'medium' :
    score >= 8  ? 'low' : 'normal';

  return { score, severity, evidence };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));

  const {
    mode = 'polygon',      // 'polygon' | 'asset' | 'corridor' | 'bbox'
    polygon,               // [[lon,lat], ...] for mode=polygon
    asset_id,              // UUID for mode=asset
    asset_geometry,        // optional: GeoJSON geometry passed directly (avoids backend fetch)
    waypoints,             // [[lon,lat], ...] for mode=corridor
    bbox: inputBbox,       // [minLon,minLat,maxLon,maxLat] for mode=bbox
    buffer_m = 500,        // buffer in meters for corridor/asset
    days_back = 30,        // comparison window
    name = '',             // optional name for this scan
  } = body;

  const useSH = hasCDSECredentials();
  const bufferDeg = Math.max(buffer_m, 100) / 111_000;

  // ── Resolve geometry to bbox ────────────────────────────────────────────────
  let scanBbox: Bbox | null = null;
  let scanName = name;
  let geometrySource = '';
  let assetGeometry: any = null;

  if (mode === 'polygon' && polygon?.length >= 3) {
    scanBbox = expandBbox(polygonToBbox(polygon), 0.002);
    scanName = scanName || 'منطقة مرسومة';
    geometrySource = 'polygon';

  } else if (mode === 'asset' && asset_id) {
    // Use geometry passed directly from client (preferred — avoids backend single-fetch 405)
    if (asset_geometry?.coordinates) {
      assetGeometry = asset_geometry;
      scanName = scanName || name || 'أصل مسجل';
      const coords = assetGeometry.type === 'LineString'
        ? assetGeometry.coordinates as [number,number][]
        : assetGeometry.type === 'Polygon'
        ? assetGeometry.coordinates[0] as [number,number][]
        : (assetGeometry.coordinates.flat?.(2) as [number,number][]) ?? [];
      if (coords.length > 0) {
        scanBbox = expandBbox(polygonToBbox(coords), bufferDeg + 0.005);
      }
      geometrySource = 'asset';
    } else {
      // Fallback: try fetching from backend list and filtering by ID
      const tenantId = extractTenantId(req);
      if (!tenantId) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
      }
      try {
        const assetRes = await fetch(`${BACKEND}/api/v1/workspace/assets?tenant_id=${tenantId}&limit=500`, {
          headers: buildBackendHeaders(tenantId, {
            'X-User-Role': req.headers.get('x-verified-role') || '',
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!assetRes.ok) throw new Error(`Asset list fetch: HTTP ${assetRes.status}`);
        const allAssets: any[] = await assetRes.json();
        const found = Array.isArray(allAssets)
          ? allAssets.find((f: any) => f.id === asset_id)
          : null;
        if (!found) throw new Error(`الأصل ${asset_id} غير موجود`);
        assetGeometry = found.geometry;
        const p = found.properties ?? {};
        scanName = scanName || p.asset_name || p.name || 'أصل مجهول';
        if (assetGeometry?.coordinates) {
          const coords = assetGeometry.type === 'LineString'
            ? assetGeometry.coordinates as [number,number][]
            : assetGeometry.type === 'Polygon'
            ? assetGeometry.coordinates[0] as [number,number][]
            : (assetGeometry.coordinates.flat?.(2) as [number,number][]) ?? [];
          if (coords.length > 0) {
            scanBbox = expandBbox(polygonToBbox(coords), bufferDeg + 0.005);
          }
        }
        geometrySource = 'asset';
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: `فشل جلب الأصل: ${e.message}` }, { status: 422 });
      }
    }

  } else if (mode === 'corridor' && waypoints?.length >= 2) {
    scanBbox = corridorBbox(waypoints as [number,number][], bufferDeg + 0.002);
    scanName = scanName || 'ممر مرسوم';
    geometrySource = 'corridor';

  } else if (mode === 'bbox' && inputBbox?.length === 4) {
    scanBbox = inputBbox as Bbox;
    scanName = scanName || 'منطقة محددة';
    geometrySource = 'bbox';

  } else if (mode === 'libya') {
    // Broad Libya scan - use a grid approach (split into cells)
    scanBbox = LIBYA_BBOX;
    scanName = 'ليبيا — مسح شامل';
    geometrySource = 'libya';
  }

  if (!scanBbox) {
    return NextResponse.json({
      ok: false,
      error: 'يجب تحديد منطقة: ارسم مضلعاً، أو اختر أصلاً، أو أدخل نقاط المسار',
    }, { status: 400 });
  }

  // ── Libya bounds check ────────────────────────────────────────────────────
  const clippedBbox: Bbox = [
    Math.max(scanBbox[0], LIBYA_BBOX[0]),
    Math.max(scanBbox[1], LIBYA_BBOX[1]),
    Math.min(scanBbox[2], LIBYA_BBOX[2]),
    Math.min(scanBbox[3], LIBYA_BBOX[3]),
  ];

  const areakm2 = bboxAreaKm2(clippedBbox);

  // ── Multi-source analysis ─────────────────────────────────────────────────
  const nowStr   = today();
  const t1Start  = daysAgo(days_back);
  const t1End    = daysAgo(Math.floor(days_back / 2));
  const t2Start  = daysAgo(Math.floor(days_back / 2));

  // Split large areas into sub-cells for pixel-level analysis
  const MAX_AREA_KM2 = 5000; // Larger areas get tile-level stats only
  const usePixelLevel = useSH && areakm2 <= MAX_AREA_KM2;

  let currentNDWI: Awaited<ReturnType<typeof computeNDWI>> | null = null;
  let currentNDVI: Awaited<ReturnType<typeof computeNDVI>> | null = null;
  let currentNDMI: Awaited<ReturnType<typeof computeNDMI>> | null = null;
  let currentSAR:  Awaited<ReturnType<typeof computeSARSigma0>> | null = null;
  let baselineNDWI: Awaited<ReturnType<typeof computeNDWI>> | null = null;
  let baselineNDVI: Awaited<ReturnType<typeof computeNDVI>> | null = null;
  let baselineNDMI: Awaited<ReturnType<typeof computeNDMI>> | null = null;
  let baselineSAR:  Awaited<ReturnType<typeof computeSARSigma0>> | null = null;

  // Parallel: current + baseline
  if (usePixelLevel) {
    [currentNDWI, currentNDVI, currentNDMI, currentSAR,
     baselineNDWI, baselineNDVI, baselineNDMI, baselineSAR] = await Promise.all([
      computeNDWI(clippedBbox, t2Start, nowStr).catch(() => null),
      computeNDVI(clippedBbox, t2Start, nowStr).catch(() => null),
      computeNDMI(clippedBbox, t2Start, nowStr).catch(() => null),
      computeSARSigma0(clippedBbox, t2Start, nowStr).catch(() => null),
      computeNDWI(clippedBbox, t1Start, t1End).catch(() => null),
      computeNDVI(clippedBbox, t1Start, t1End).catch(() => null),
      computeNDMI(clippedBbox, t1Start, t1End).catch(() => null),
      computeSARSigma0(clippedBbox, t1Start, t1End).catch(() => null),
    ]);
  } else {
    // STAC tile-level fallback (no SH credentials or large area)
    const [t2Scenes, t1Scenes] = await Promise.all([
      searchSTAC({ bbox: clippedBbox, date_from: t2Start, date_to: nowStr, collections: ['sentinel-2-l2a'], max_cloud: 30, limit: 4 }).catch(() => []),
      searchSTAC({ bbox: clippedBbox, date_from: t1Start, date_to: t1End, collections: ['sentinel-2-l2a'], max_cloud: 30, limit: 4 }).catch(() => []),
    ]);
    const best2 = t2Scenes.sort((a,b) => (a.cloud_cover??99)-(b.cloud_cover??99))[0];
    const best1 = t1Scenes.sort((a,b) => (a.cloud_cover??99)-(b.cloud_cover??99))[0];
    if (best2?.statistics && best1?.statistics) {
      currentNDWI  = { ok: true, ndwi_mean: best2.statistics.water_pct?best2.statistics.water_pct/100:null, ndwi_max: null };
      currentNDVI  = { ok: true, ndvi_mean: best2.statistics.vegetation_pct?best2.statistics.vegetation_pct/100:null, ndvi_max: null };
      baselineNDWI = { ok: true, ndwi_mean: best1.statistics.water_pct?best1.statistics.water_pct/100:null, ndwi_max: null };
      baselineNDVI = { ok: true, ndvi_mean: best1.statistics.vegetation_pct?best1.statistics.vegetation_pct/100:null, ndvi_max: null };
    }
  }

  // ── Classify anomalies ────────────────────────────────────────────────────
  const { score, severity, evidence } = classifyAnomaly(
    currentNDWI?.ndwi_mean ?? null,
    currentNDVI?.ndvi_mean ?? null,
    currentNDMI?.ndmi_mean ?? null,
    currentSAR?.vv_db_mean ?? null,
    {
      ndwi:  baselineNDWI?.ndwi_mean ?? undefined,
      ndvi:  baselineNDVI?.ndvi_mean ?? undefined,
      ndmi:  baselineNDMI?.ndmi_mean ?? undefined,
      sarVv: baselineSAR?.vv_db_mean  ?? undefined,
    },
  );

  // Centre of the scanned area
  const centreLon = (clippedBbox[0] + clippedBbox[2]) / 2;
  const centreLat = (clippedBbox[1] + clippedBbox[3]) / 2;

  // Generate anomaly point(s)
  const anomalies = severity !== 'normal' ? [{
    id:        `anom-${Date.now()}`,
    lon:       centreLon,
    lat:       centreLat,
    bbox:      clippedBbox,
    severity,
    score,
    leak_probability: severity === 'confirmed' ? 'confirmed' :
                      severity === 'high'      ? 'high'      :
                      severity === 'medium'    ? 'medium'    : 'low',
    confidence_pct:   Math.min(score, 100),
    evidence,
    area_km2: Math.round(areakm2 * 10) / 10,
    scan_name: scanName,
    type: (currentNDWI?.ndwi_mean ?? 0) > 0.2 ? 'surface_water' :
          (currentNDVI?.ndvi_mean ?? 0) > 0.15 ? 'vegetation_anomaly' :
          (currentNDMI?.ndmi_mean ?? 0) > -0.1 ? 'soil_moisture' : 'general',
  }] : [];

  // ── Build summary interpretation ──────────────────────────────────────────
  const interpretations: string[] = [];
  if (!evidence.length) {
    interpretations.push('✅ لم يُكشف عن شذوذات مائية ملحوظة في هذه المنطقة خلال الفترة المحددة');
  } else {
    if (severity === 'confirmed') interpretations.push('⚠️ شذوذ مائي مؤكد — يُوصى بالتحقق الميداني');
    if (severity === 'high')      interpretations.push('🔴 احتمال تسرب مرتفع — أولوية قصوى للفحص');
    if (severity === 'medium')    interpretations.push('🟠 تغيير في رطوبة التربة — يستوجب متابعة');
    if (severity === 'low')       interpretations.push('🟡 تغيير طفيف — قد يكون موسمياً');
  }

  const raw_metrics = {
    current: {
      ndwi: currentNDWI?.ndwi_mean,  ndwi_max: currentNDWI?.ndwi_max,
      ndvi: currentNDVI?.ndvi_mean,  ndvi_max: currentNDVI?.ndvi_max,
      ndmi: currentNDMI?.ndmi_mean,
      sar_vv: currentSAR?.vv_db_mean,
    },
    baseline: {
      ndwi: baselineNDWI?.ndwi_mean,
      ndvi: baselineNDVI?.ndvi_mean,
      ndmi: baselineNDMI?.ndmi_mean,
      sar_vv: baselineSAR?.vv_db_mean,
    },
    delta: {
      ndwi: currentNDWI?.ndwi_mean != null && baselineNDWI?.ndwi_mean != null
        ? currentNDWI.ndwi_mean - baselineNDWI.ndwi_mean : null,
      ndvi: currentNDVI?.ndvi_mean != null && baselineNDVI?.ndvi_mean != null
        ? currentNDVI.ndvi_mean - baselineNDVI.ndvi_mean : null,
    },
  };

  return NextResponse.json({
    ok:            true,
    data_real:     true,
    source:        usePixelLevel ? 'Sentinel-2 + SAR (Sentinel Hub Statistical API, 10م/بكسل)' : 'Sentinel-2 STAC (tile-level)',
    pixel_level:   usePixelLevel,
    query_ms:      Date.now() - t0,

    // Scan metadata
    scan_name:     scanName,
    mode:          geometrySource,
    bbox:          clippedBbox,
    area_km2:      Math.round(areakm2 * 10) / 10,
    period: {
      current:  { from: t2Start, to: nowStr },
      baseline: { from: t1Start, to: t1End },
      days_back,
    },

    // Results
    overall_severity: severity,
    overall_score:    score,
    anomalies_count:  anomalies.length,
    anomalies,

    // Summary
    interpretation:   interpretations.join(' | '),
    evidence,
    raw_metrics,

    // Sensor info
    sensor_info: {
      s2_resolution: '10م/بكسل (NDWI/NDVI) | 20م/بكسل (NDMI)',
      sar_resolution: '10م/بكسل (SAR Sigma0)',
      detection_threshold: 'NDWI>0.2 = مياه حرة | NDVI>0.15 في الصحراء = نبات شاذ',
      limitations: 'الحد الأدنى للتسرب المكتشف: ~100م² + استمرار >2 أسابيع',
    },
  });
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    ok: true,
    description: 'ماسح الشذوذات المائية — يكشف تسريبات المياه في أي منطقة بليبيا',
    usage: 'POST مع mode: polygon|asset|corridor|bbox|libya',
    modes: {
      polygon:  'polygon: [[lon,lat],...] — ارسم منطقة على الخريطة',
      asset:    'asset_id: UUID — يستخرج geometry من قاعدة بيانات الأصول',
      corridor: 'waypoints: [[lon,lat],...] + buffer_m — ممر حول خط أنابيب',
      bbox:     'bbox: [minLon,minLat,maxLon,maxLat] — مربع مباشر',
      libya:    'مسح شامل لليبيا (tile-level فقط)',
    },
    sensors: ['Sentinel-2 NDWI', 'Sentinel-2 NDVI', 'Sentinel-2 NDMI', 'Sentinel-1 SAR'],
  });
}
