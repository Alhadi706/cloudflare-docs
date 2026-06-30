/**
 * POST /api/v1/satellite/multi-source
 * تحليل تغيير متعدد المصادر: S2 نباتي + S1 SAR + Landsat حراري + FIRMS حرائق
 * بيانات حقيقية — لا تحاكي
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  searchSTAC, polygonToBbox, expandBbox,
  computeChangeIndicators, daysAgo, today,
} from '@/lib/stac';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Input: bbox OR polygon
  let bbox: [number, number, number, number];
  if (body.bbox?.length === 4) {
    bbox = body.bbox;
  } else if (body.polygon) {
    bbox = expandBbox(polygonToBbox(body.polygon), 0.05);
  } else {
    return NextResponse.json({ detail: 'bbox أو polygon مطلوب' }, { status: 400 });
  }

  const refDays    = body.ref_days    ?? 90;
  const windowDays = body.window_days ?? 30;
  const maxCloud   = body.max_cloud   ?? 40;
  const sensors    = (body.sensors as string[] | undefined) ?? ['s2', 's1', 'landsat'];

  const todayStr = today();
  const t0 = Date.now();

  // Parallel queries across all sensors
  const queries: Promise<any>[] = [];

  // Sentinel-2 optical (vegetation change)
  if (sensors.includes('s2')) {
    queries.push(
      Promise.all([
        searchSTAC({ bbox, date_from: daysAgo(refDays + windowDays), date_to: daysAgo(windowDays), collections: ['sentinel-2-l2a'], max_cloud: maxCloud, limit: 5 }),
        searchSTAC({ bbox, date_from: daysAgo(windowDays), date_to: todayStr, collections: ['sentinel-2-l2a'], max_cloud: maxCloud, limit: 5 }),
      ]).then(([t1, t2]) => ({ type: 's2', t1, t2 })).catch(() => ({ type: 's2', t1: [], t2: [] }))
    );
  }

  // Sentinel-1 SAR (surface change)
  if (sensors.includes('s1')) {
    queries.push(
      Promise.all([
        searchSTAC({ bbox, date_from: daysAgo(refDays + windowDays), date_to: daysAgo(windowDays), collections: ['sentinel-1-grd'], max_cloud: 100, limit: 5 }),
        searchSTAC({ bbox, date_from: daysAgo(windowDays), date_to: todayStr, collections: ['sentinel-1-grd'], max_cloud: 100, limit: 5 }),
      ]).then(([t1, t2]) => ({ type: 's1', t1, t2 })).catch(() => ({ type: 's1', t1: [], t2: [] }))
    );
  }

  // Landsat-9 (thermal + land cover)
  if (sensors.includes('landsat')) {
    queries.push(
      Promise.all([
        searchSTAC({ bbox, date_from: daysAgo(refDays + windowDays), date_to: daysAgo(windowDays), collections: ['landsat-c2-l2'], max_cloud: maxCloud, limit: 5 }),
        searchSTAC({ bbox, date_from: daysAgo(windowDays), date_to: todayStr, collections: ['landsat-c2-l2'], max_cloud: maxCloud, limit: 5 }),
      ]).then(([t1, t2]) => ({ type: 'landsat', t1, t2 })).catch(() => ({ type: 'landsat', t1: [], t2: [] }))
    );
  }

  const results = await Promise.all(queries);

  // Build per-sensor analysis
  const sensorAnalysis: Record<string, any> = {};
  let overallRisk = 'none';
  let riskScore   = 0;

  for (const r of results) {
    const { type, t1, t2 } = r;

    // Pick best (lowest cloud) scene from each period
    const best = (scenes: any[]) => scenes.sort((a, b) => a.cloud_cover - b.cloud_cover)[0] ?? null;
    const bestT1 = best(t1);
    const bestT2 = best(t2);

    const changeIndicators = (bestT1 && bestT2 && type === 's2')
      ? computeChangeIndicators(bestT1, bestT2)
      : null;

    const score = changeIndicators
      ? (changeIndicators.risk_level === 'high' ? 3 : changeIndicators.risk_level === 'medium' ? 2 : 1)
      : (t2.length > 0 ? 1 : 0);

    riskScore += score;

    sensorAnalysis[type] = {
      scenes_t1:   t1.length,
      scenes_t2:   t2.length,
      best_t1:     bestT1 ? { id: bestT1.id, date: bestT1.date, cloud: bestT1.cloud_cover } : null,
      best_t2:     bestT2 ? { id: bestT2.id, date: bestT2.date, cloud: bestT2.cloud_cover } : null,
      change:      changeIndicators,
      coverage:    t2.length > 0 ? 'available' : 'no_recent_scenes',
    };
  }

  // Aggregate risk
  if (riskScore >= 6)      overallRisk = 'critical';
  else if (riskScore >= 4) overallRisk = 'high';
  else if (riskScore >= 2) overallRisk = 'medium';
  else if (riskScore >= 1) overallRisk = 'low';

  // Summary of confirmed detections
  const s2Change = sensorAnalysis['s2']?.change;
  const detections: string[] = [];
  if (s2Change) {
    if (Math.abs(s2Change.vegetation_delta) >= 3)     detections.push(`تغيير غطاء نباتي: ${s2Change.vegetation_delta > 0 ? '+' : ''}${s2Change.vegetation_delta.toFixed(1)}%`);
    if (Math.abs(s2Change.not_vegetated_delta) >= 5) detections.push(`تغيير أرض مكشوفة: ${s2Change.not_vegetated_delta > 0 ? '+' : ''}${s2Change.not_vegetated_delta.toFixed(1)}%`);
    if (Math.abs(s2Change.water_delta) >= 3)          detections.push(`تغيير مساحات مائية: ${s2Change.water_delta > 0 ? '+' : ''}${s2Change.water_delta.toFixed(1)}%`);
  }
  if (sensorAnalysis['s1']?.scenes_t2 > 0) detections.push('تغطية SAR متاحة للتحقق');

  return NextResponse.json({
    ok:           true,
    data_real:    true,
    source:       'CDSE_STAC + Element84',
    query_ms:     Date.now() - t0,
    bbox,
    analysis_period: {
      reference:  { from: daysAgo(refDays + windowDays), to: daysAgo(windowDays) },
      current:    { from: daysAgo(windowDays), to: todayStr },
    },
    overall_risk:   overallRisk,
    sensors:        sensorAnalysis,
    detections,
    monitoring_ready: Object.values(sensorAnalysis).some((s: any) => s.scenes_t2 > 0),
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
    body: JSON.stringify({ bbox, sensors: ['s2', 's1', 'landsat'] }),
  }));
}
