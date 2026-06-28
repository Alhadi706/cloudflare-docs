/**
 * /api/gis/[...slug]  — Catch-all handler for all GIS analysis endpoints.
 *
 * Covers every endpoint called by SIC panel components:
 *   change-detection | object-detection | insar-deformation | cva-change
 *   subpixel-change  | ground-truth     | suitability        | optimal-path
 *   risk-assessment  | satellite-trend  | network-design     | auto-network
 *   auto-monitor     | analyze-corridor | alerts-registry    | notifications
 *   service-layers
 *
 * Analysis endpoints return deterministic mock data keyed to the input bbox.
 * CRUD endpoints (service-layers, alerts-registry, notifications) persist to
 * local JSON files under .data/gis/.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Data file paths ---
const DATA_DIR          = path.join(process.cwd(), '.data', 'gis');
const SERVICE_LAYERS_F  = path.join(DATA_DIR, 'service-layers.json');
const ALERTS_F          = path.join(DATA_DIR, 'alerts-registry.json');
const NOTIFS_F          = path.join(DATA_DIR, 'notifications.json');

function readJSON<T>(filePath: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T; }
  catch { return fallback; }
}
function writeJSON(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── Deterministic seed from bbox / coordinates ---
function seed(bbox?: number[] | null, fallback = 42): number {
  if (!bbox?.length) return fallback;
  return Math.abs(
    Math.round(bbox.reduce((acc, v) => acc * 31 + (v * 1000) | 0, 1))
  ) % 10000;
}
function lerp(min: number, max: number, t: number): number {
  return +(min + (max - min) * ((t % 100) / 100)).toFixed(2);
}
function bboxCenter(bbox: number[]): [number, number] {
  return [
    (bbox[0] + bbox[2]) / 2,
    (bbox[1] + bbox[3]) / 2,
  ];
}
function bboxArea(bbox: number[]): number {
  if (bbox.length < 4) return 5;
  const dx = Math.abs(bbox[2] - bbox[0]) * 111.32;
  const dy = Math.abs(bbox[3] - bbox[1]) * 110.57;
  return +(dx * dy).toFixed(2);
}
function makeId(prefix = 'id'): string {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}
function nowIso(): string { return new Date().toISOString(); }

// ── Helpers to build GeoJSON features ---
function bboxRing(bbox: number[]): [number, number][] {
  const [w, s, e, n] = bbox;
  return [[w, s], [e, s], [e, n], [w, n], [w, s]];
}

function gridFeatures(
  bbox: number[],
  count: number,
  propsFn: (i: number, lon: number, lat: number) => Record<string, unknown>,
): any[] {
  const [w, s, e, n] = bbox;
  return Array.from({ length: count }, (_, i) => {
    const lon = w + ((e - w) * (i % 5) / 5) + (e - w) / 10;
    const lat = s + ((n - s) * Math.floor(i / 5) / 5) + (n - s) / 10;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [+lon.toFixed(5), +lat.toFixed(5)] },
      properties: propsFn(i, lon, lat),
    };
  });
}

// ── Route handler entry point ---
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await context.params;
  const endpoint = slug.join('/');
  const url      = new URL(req.url);

  switch (endpoint) {
    case 'auto-monitor':     return handleAutoMonitorGet();
    case 'alerts-registry':  return handleAlertsGet(url);
    case 'notifications':    return handleNotifsGet(url);
    case 'service-layers':   return handleServiceLayersGet(url);
    default:
      return NextResponse.json({ error: `Unknown GIS endpoint: ${endpoint}` }, { status: 404 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await context.params;
  const endpoint = slug.join('/');
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  switch (endpoint) {
    case 'change-detection':   return handleChangeDetection(body);
    case 'object-detection':   return handleObjectDetection(body);
    case 'insar-deformation':  return handleInSAR(body);
    case 'cva-change':         return handleCVA(body);
    case 'subpixel-change':    return handleSubpixel(body);
    case 'ground-truth':       return handleGroundTruth(body);
    case 'suitability':        return handleSuitability(body);
    case 'optimal-path':       return handleOptimalPath(body);
    case 'risk-assessment':    return handleRiskAssessment(body);
    case 'satellite-trend':    return handleSatelliteTrend(body);
    case 'network-design':     return handleNetworkDesign(body);
    case 'auto-network':       return handleAutoNetwork(body);
    case 'auto-monitor':       return handleAutoMonitorPost(body);
    case 'analyze-corridor':   return handleAnalyzeCorridor(body);
    case 'alerts-registry':    return handleAlertsPost(body);
    case 'notifications':      return handleNotifsPost(body);
    case 'service-layers':     return handleServiceLayersPost(body, req);
    default:
      return NextResponse.json({ error: `Unknown GIS endpoint: ${endpoint}` }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await context.params;
  const endpoint = slug.join('/');
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const url = new URL(req.url);
  const id = url.searchParams.get('id') ?? slug[slug.length - 1];

  if (endpoint.startsWith('service-layers')) return handleServiceLayersPut(id, body);
  return NextResponse.json({ error: `Not found` }, { status: 404 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await context.params;
  const endpoint = slug.join('/');
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const url = new URL(req.url);
  const id = url.searchParams.get('id') ?? slug[slug.length - 1];

  if (endpoint.startsWith('service-layers')) return handleServiceLayersPut(id, body);
  return NextResponse.json({ error: `Not found` }, { status: 404 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await context.params;
  const endpoint = slug.join('/');
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (endpoint === 'alerts-registry' && id)  return handleAlertsDelete(id);
  if (endpoint === 'notifications'   && id)  return handleNotifsDelete(id);
  if (endpoint.startsWith('service-layers') && id) return handleServiceLayersDelete(id);
  return NextResponse.json({ ok: true });
}

// ---
// CHANGE DETECTION
// ---
function handleChangeDetection(body: Record<string, unknown>) {
  const bbox  = (body.bbox ?? [13.1, 32.7, 13.3, 32.9]) as number[];
  const s     = seed(bbox);
  const today = new Date();
  const before= new Date(today); before.setFullYear(before.getFullYear() - 2);

  return NextResponse.json({
    status:      'ok',
    date_before: before.toISOString().slice(0, 10),
    date_after:  today.toISOString().slice(0, 10),
    days_apart:  730,
    summary: {
      total_changed_area_m2: lerp(80000, 250000, s),
      change_intensity:      s % 3 === 0 ? 'low' : s % 3 === 1 ? 'medium' : 'high',
      change_pct:            lerp(4.5, 18.2, s),
    },
    by_category: {
      buildings:   { added: 30 + s % 40, removed: 8 + s % 15, modified: 20 + s % 30, area_m2: 55000 + s * 3 },
      vegetation:  { added: 5 + s % 8,   removed: 18 + s % 20, modified: 0, area_m2: 28000 + s * 2 },
      roads:       { added: 2 + s % 4,   removed: 1,            modified: 4 + s % 6,  area_m2: 14000 + s },
      water:       { added: 1,           removed: s % 2,        modified: 2 + s % 3,  area_m2: 8000 },
    },
    geojson: {
      type: 'FeatureCollection',
      features: gridFeatures(bbox, 8, (i, lon, lat) => ({
        change_type: ['buildings', 'vegetation', 'roads', 'water'][i % 4],
        intensity:   ['low', 'medium', 'high'][(i + s) % 3],
        area_m2:     5000 + (i + s) * 200,
      })),
    },
    analysis_notes: [
      'التحليل بناءً على مقارنة صور الأقمار الاصطناعية',
      `تغطية المنطقة: ${bboxArea(bbox).toFixed(1)} كم²`,
      'دقة التحليل: 10 أمتار',
    ],
  });
}

// ---
// OBJECT DETECTION
// ---
function handleObjectDetection(body: Record<string, unknown>) {
  const polygon = body.polygon as [number, number][] | undefined;
  const classes = (body.classes as string[]) ?? ['vehicles', 'buildings', 'water_tanks'];
  const bbox    = polygon
    ? [
        Math.min(...polygon.map(p => p[0])),
        Math.min(...polygon.map(p => p[1])),
        Math.max(...polygon.map(p => p[0])),
        Math.max(...polygon.map(p => p[1])),
      ]
    : [13.1, 32.7, 13.3, 32.9];
  const s = seed(bbox);

  const stats: Record<string, number> = {};
  const detections: any[] = [];
  let total = 0;
  for (const cls of classes) {
    const cnt = 10 + (s + cls.length * 7) % 60;
    stats[cls] = cnt;
    total += cnt;
    for (let i = 0; i < Math.min(5, cnt); i++) {
      const lon = bbox[0] + ((bbox[2] - bbox[0]) * (i * 0.18 + 0.05));
      const lat = bbox[1] + ((bbox[3] - bbox[1]) * (i * 0.15 + 0.08));
      detections.push({
        id: `det-${cls}-${i}`,
        class: cls,
        confidence: 0.72 + (i % 3) * 0.08,
        lon: +lon.toFixed(5),
        lat: +lat.toFixed(5),
        bbox_px: [i * 40, i * 30, i * 40 + 60, i * 30 + 50],
      });
    }
  }

  return NextResponse.json({
    ok:           true,
    date:         new Date().toISOString().slice(0, 10),
    image_real:   false,
    total_objects: total,
    stats,
    summary_ar:   `تم رصد ${total} كائناً في المنطقة المحددة`,
    detections,
    bbox:         bbox as [number, number, number, number],
  });
}

// ---
// InSAR DEFORMATION
// ---
function handleInSAR(body: Record<string, unknown>) {
  const bbox = (body.bbox ?? [13.1, 32.7, 13.3, 32.9]) as number[];
  const s    = seed(bbox);
  const rows = 32, cols = 32;
  const makeMap = (base: number, range: number) =>
    Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) =>
        +(base + (((r * cols + c + s) % 100) / 100) * range).toFixed(3)
      )
    );

  return NextResponse.json({
    ok:                  true,
    date_ref:            '2024-01-01',
    date_secondary:      new Date().toISOString().slice(0, 10),
    image_real:          false,
    img_size:            512,
    bbox,
    mean_coherence:      lerp(0.55, 0.88, s),
    min_displacement_mm: lerp(-8.5, -1.2, s),
    max_displacement_mm: lerp(1.8, 7.4, s),
    deform_area_pct:     lerp(5.2, 28.6, s),
    deform_area_km2:     lerp(0.8, 6.4, s),
    hotspot_count:       3 + s % 9,
    critical_count:      s % 3,
    hotspots: gridFeatures(bbox, 4 + s % 5, (i, lon, lat) => ({
      severity:    i < 2 ? 'critical' : 'warning',
      disp_mm:     +(-(2 + i * 1.5)).toFixed(1),
      coherence:   +(0.45 + i * 0.08).toFixed(2),
      label:       `نقطة رصد ${i + 1}`,
    })).map((f: any) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], ...f.properties })),
    coherence_map:     makeMap(0.4, 0.5),
    displacement_map:  makeMap(-5, 10),
    map_downsample:    4,
  });
}

// ---
// CVA MULTI-SPECTRAL
// ---
function handleCVA(body: Record<string, unknown>) {
  const bbox = (body.bbox ?? body.polygon ?? [13.1, 32.7, 13.3, 32.9]) as number[];
  const s    = seed(bbox);
  return NextResponse.json({
    ok:                  true,
    method:              'CVA 4-band',
    change_pct:          lerp(6.2, 24.8, s),
    hotspot_count:       5 + s % 12,
    critical_count:      1 + s % 4,
    warning_count:       3 + s % 7,
    magnitude_max:       lerp(0.42, 0.91, s),
    effective_resolution_m: 10,
    bands_used:          ['NDVI', 'NDWI', 'SAR_VV', 'Brightness'],
    type_distribution:   { vegetation: 35 + s % 20, urban: 25 + s % 15, water: 15 + s % 10, bare_soil: 25 - s % 10 },
    hotspots: gridFeatures(bbox, 6 + s % 6, (i, lon, lat) => ({
      severity:   i < 2 ? 'critical' : i < 4 ? 'warning' : 'info',
      magnitude:  +(0.5 + i * 0.07).toFixed(2),
      type:       ['vegetation', 'urban', 'water', 'bare_soil'][i % 4],
      label:      `بقعة تغيير ${i + 1}`,
      lon, lat,
    })).map((f: any) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], ...f.properties })),
  });
}

// ---
// SUB-PIXEL CHANGE
// ---
function handleSubpixel(body: Record<string, unknown>) {
  const bbox = (body.bbox ?? body.polygon ?? [13.1, 32.7, 13.3, 32.9]) as number[];
  const s    = seed(bbox);
  return NextResponse.json({
    ok:            true,
    method:        'Sub-pixel 2.5m',
    change_pct:    lerp(3.1, 14.6, s),
    region_count:  8 + s % 12,
    critical_count: 1 + s % 3,
    warning_count:  4 + s % 6,
    magnitude_max:  lerp(0.28, 0.72, s),
    effective_resolution_m: 2.5,
    severity:      s % 3 === 0 ? 'low' : s % 3 === 1 ? 'medium' : 'high',
    regions: gridFeatures(bbox, 8 + s % 8, (i, lon, lat) => ({
      severity:  i < 2 ? 'critical' : i < 5 ? 'warning' : 'info',
      magnitude: +(0.3 + i * 0.05).toFixed(2),
      label:     `منطقة دقيقة ${i + 1}`,
      lon, lat,
    })).map((f: any) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], ...f.properties })),
  });
}

// ---
// GROUND TRUTH
// ---
function handleGroundTruth(body: Record<string, unknown>) {
  const bbox = (body.bbox ?? body.polygon ?? [13.1, 32.7, 13.3, 32.9]) as number[];
  const s    = seed(bbox);
  const tp   = 40 + s % 30;
  const fp   = 5  + s % 12;
  const fn   = 8  + s % 10;
  const prec = +(tp / (tp + fp)).toFixed(3);
  const rec  = +(tp / (tp + fn)).toFixed(3);
  const f1   = +(2 * prec * rec / (prec + rec)).toFixed(3);

  return NextResponse.json({
    ok:      true,
    metrics: { TP: tp, FP: fp, FN: fn, precision: prec, recall: rec, f1, accuracy: +(tp / (tp + fp + fn)).toFixed(3) },
    iou:     lerp(0.48, 0.79, s),
    summary_ar: `الدقة: ${(prec * 100).toFixed(1)}% | الاسترجاع: ${(rec * 100).toFixed(1)}% | F1: ${(f1 * 100).toFixed(1)}%`,
    confusion_matrix: [[tp, fp], [fn, Math.round(tp * 0.9)]],
    comparison_notes: ['المقارنة مع بيانات المشاريع الفعلية', `مجموع العينات: ${tp + fp + fn}`],
  });
}

// ---
// SUITABILITY
// ---
function handleSuitability(body: Record<string, unknown>) {
  const bbox      = (body.bbox ?? [13.1, 32.7, 13.3, 32.9]) as number[];
  const useCase   = (body.use_case as string) ?? 'health_center';
  const s         = seed(bbox);
  const score     = 45 + s % 45;
  const [cx, cy]  = bboxCenter(bbox);

  const LABELS: Record<string, string> = {
    health_center: 'مركز صحي', school: 'مدرسة', pump_station: 'محطة ضخ',
    warehouse: 'مستودع', fire_station: 'مركز إطفاء', park: 'حديقة عامة',
  };

  return NextResponse.json({
    use_case:       useCase,
    use_case_label: LABELS[useCase] ?? useCase,
    score,
    score_pct:      score,
    verdict:        score >= 75 ? 'مناسب جداً' : score >= 55 ? 'مناسب' : 'مقبول',
    criteria_scores: {
      roads:       55 + s % 40,
      population:  60 + s % 35,
      hazards:     70 + s % 25,
      environment: 45 + s % 45,
      services:    50 + s % 40,
    },
    weights_used: { roads: 0.25, population: 0.30, hazards: 0.20, environment: 0.15, services: 0.10 },
    top_locations: [
      { lon: cx + 0.005, lat: cy + 0.005, score: score + 10, label: 'الموقع الأمثل',   justification: 'قريب من الطرق الرئيسية وبعيد عن المخاطر' },
      { lon: cx - 0.008, lat: cy + 0.003, score: score + 4,  label: 'الموقع الثانوي', justification: 'مساحة كافية مع وصول جيد' },
      { lon: cx + 0.003, lat: cy - 0.006, score: score - 2,  label: 'الموقع البديل',  justification: 'يحتاج تحسين الوصول' },
    ],
    narrative_ar: `المنطقة ${score >= 60 ? 'مناسبة' : 'مقبولة'} لإنشاء ${LABELS[useCase] ?? useCase} بنسبة ${score}٪. يُنصح بالموقع الأمثل القريب من شبكة الطرق.`,
    bbox,
  });
}

// ---
// OPTIMAL PATH (Routing)
// ---
// ---
// OPTIMAL PATH — professional multi-waypoint routing with real detour geometry
// and statistics derived from actual path shape
// ---

/** Evaluate a cubic Bezier at parameter t (4 control points) */
function cubicBezier(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number],
  t: number,
): [number, number] {
  const mt = 1 - t;
  return [
    mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0],
    mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1],
  ];
}

/** Haversine distance in km between two [lon,lat] points */
function haversineKm(a: [number,number], b: [number,number]): number {
  const R = 6371, toRad = Math.PI/180;
  const dLat = (b[1]-a[1])*toRad, dLon = (b[0]-a[0])*toRad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a[1]*toRad)*Math.cos(b[1]*toRad)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}

/** Compute path length in km from a coordinate array */
function pathLengthKm(coords: [number,number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversineKm(coords[i-1], coords[i]);
  return +d.toFixed(3);
}

async function handleOptimalPath(body: Record<string, unknown>) {
  const start     = (body.start     as [number, number]) ?? [13.15, 32.78];
  const end       = (body.end       as [number, number]) ?? [13.22, 32.80];
  const priority  = (body.priority  as string) ?? 'balanced';
  const obstacles = (body.obstacles as Record<string, boolean>) ?? {};

  const hasBuildings   = obstacles.buildings        === true;
  const hasRestricted  = obstacles.restricted_zones === true;
  const hasWater       = obstacles.water            === true;
  const hasSteep       = obstacles.steep_slope      === true;

  // ── Metric coordinate system ---
  const midLat     = (start[1] + end[1]) / 2;
  const KM_PER_LAT = 110.574;
  const KM_PER_LON = 111.320 * Math.cos(midLat * Math.PI / 180);

  // Direction vector in km
  const dxKm  = (end[0] - start[0]) * KM_PER_LON;
  const dyKm  = (end[1] - start[1]) * KM_PER_LAT;
  const lenKm = Math.sqrt(dxKm**2 + dyKm**2) || 1;

  const directKm = +lenKm.toFixed(2);

  // Unit vector along path (in degrees)
  const fwdLon =  dxKm / lenKm / KM_PER_LON;
  const fwdLat =  dyKm / lenKm / KM_PER_LAT;
  // Perpendicular unit vector (90° CCW in km-space → north-biased)
  const perpLon = (-dyKm / lenKm) / KM_PER_LON;
  const perpLat = ( dxKm / lenKm) / KM_PER_LAT;

  // ── Detour parameters per priority ---
  // "lateral" = max perpendicular offset (km) at the peak of the arc
  // "ratio"   = total_km / direct_km
  //
  // For `least_obstacles` + buildings/restricted:
  //   We use a LARGE offset so the path clearly bypasses urban areas.
  //   The path swings out ~35-45% of its own length to one side.
  //
  let lateral: number;
  let ratio:   number;

  if (priority === 'shortest') {
    lateral = directKm * 0.015;   // ≈1.5% — essentially straight
    ratio   = 1.04;
  } else if (priority === 'balanced') {
    lateral = directKm * 0.10;    // ≈10%  — gentle curve
    ratio   = 1.12;
  } else if (priority === 'easiest_terrain') {
    lateral = directKm * 0.22;    // ≈22%  — routes around steep terrain
    ratio   = 1.28;
  } else { // least_obstacles
    if (hasBuildings && hasRestricted) {
      lateral = directKm * 0.48;  // major urban bypass — almost half the path length
      ratio   = 1.52;
    } else if (hasBuildings) {
      lateral = directKm * 0.42;  // large bypass to avoid built-up area
      ratio   = 1.44;
    } else if (hasRestricted) {
      lateral = directKm * 0.38;
      ratio   = 1.38;
    } else if (hasWater) {
      lateral = directKm * 0.28;
      ratio   = 1.30;
    } else if (hasSteep) {
      lateral = directKm * 0.25;
      ratio   = 1.28;
    } else {
      lateral = directKm * 0.20;
      ratio   = 1.24;
    }
  }

  // ── Build cubic Bezier control points ---
  // P0 = start, P3 = end
  // P1 and P2 are placed at 30% and 70% along the path,
  // shifted perpendicular by `lateral` km.
  // This creates a path that clearly sweeps out to one side and back,
  // rather than just bulging at the center.
  const p1: [number, number] = [
    start[0] + fwdLon * directKm * 0.30 * KM_PER_LON / KM_PER_LON + perpLon * lateral,
    start[1] + fwdLat * directKm * 0.30 * KM_PER_LAT / KM_PER_LAT + perpLat * lateral,
  ];
  // Small secondary perpendicular shift to avoid exact symmetry
  const lateral2 = lateral * 0.88;
  const p2: [number, number] = [
    start[0] + fwdLon * directKm * 0.70 * KM_PER_LON / KM_PER_LON + perpLon * lateral2,
    start[1] + fwdLat * directKm * 0.70 * KM_PER_LAT / KM_PER_LAT + perpLat * lateral2,
  ];

  // ── Sample the Bezier at 50 points — used as fallback if OSRM unavailable ---
  const NUM_PTS = 50;
  let rawCoords: [number, number][] = [];
  for (let i = 0; i < NUM_PTS; i++) {
    const t = i / (NUM_PTS - 1);
    const [lon, lat] = cubicBezier(start, p1, p2, end, t);

    // Micro-texture: tiny perpendicular noise simulating road follows real terrain
    // Scale: 0.2% of direct distance — purely cosmetic, not affecting avoidance
    const noise = priority === 'shortest' ? 0 : 0.002 * directKm;
    const nx = Math.sin(i * 1.1 + 0.5) * noise * perpLon;
    const ny = Math.cos(i * 0.8 + 0.3) * noise * perpLat;
    rawCoords.push([+(lon + nx).toFixed(6), +(lat + ny).toFixed(6)]);
  }

  // ── OSRM real road routing — overrides Bezier when available ---
  // OSRM uses OpenStreetMap roads which naturally go around buildings.
  // For least_obstacles we inject an intermediate waypoint to force a peripheral route.
  let osrmDurationMin = 0;
  let osrmUsed = false;
  try {
    let waypoints = `${start[0].toFixed(5)},${start[1].toFixed(5)};${end[0].toFixed(5)},${end[1].toFixed(5)}`;

    if (priority === 'least_obstacles' && (hasBuildings || hasRestricted)) {
      // Force peripheral routing: intermediate waypoint shifted perpendicularly away from urban corridor
      const lateralBypass = lenKm * (hasBuildings && hasRestricted ? 0.45 : hasBuildings ? 0.38 : 0.30);
      const midWpLon = (start[0] + end[0]) / 2 + perpLon * lateralBypass;
      const midWpLat = (start[1] + end[1]) / 2 + perpLat * lateralBypass;
      waypoints = `${start[0].toFixed(5)},${start[1].toFixed(5)};${midWpLon.toFixed(5)},${midWpLat.toFixed(5)};${end[0].toFixed(5)},${end[1].toFixed(5)}`;
    } else if (priority === 'easiest_terrain' && lenKm > 3) {
      const midWpLon = (start[0] + end[0]) / 2 + perpLon * lenKm * 0.12;
      const midWpLat = (start[1] + end[1]) / 2 + perpLat * lenKm * 0.12;
      waypoints = `${start[0].toFixed(5)},${start[1].toFixed(5)};${midWpLon.toFixed(5)},${midWpLat.toFixed(5)};${end[0].toFixed(5)},${end[1].toFixed(5)}`;
    }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
    const osrmResp = await fetch(osrmUrl, { signal: AbortSignal.timeout(7000) });
    const osrmData = await osrmResp.json() as {
      code: string;
      routes?: Array<{ geometry: { coordinates: [number, number][] }; distance: number; duration: number }>;
    };

    if (osrmData.code === 'Ok' && (osrmData.routes?.[0]?.geometry?.coordinates?.length ?? 0) > 1) {
      rawCoords       = osrmData.routes![0].geometry.coordinates;
      osrmDurationMin = Math.round(osrmData.routes![0].duration / 60);
      osrmUsed        = true;
    }
  } catch { /* OSRM unavailable — keep Bezier fallback */ }

  // ── Compute real path length from sampled coordinates ---
  const totalKm = pathLengthKm(rawCoords);

  // ── Peak lateral offset (for reporting) ---
  // Actual peak offset of the Bezier from the A→B straight line
  const peakT    = 0.5;
  const [pkLon, pkLat] = cubicBezier(start, p1, p2, end, peakT);
  const midStraightLon = (start[0] + end[0]) / 2;
  const midStraightLat = (start[1] + end[1]) / 2;
  const peakOffsetKm = +Math.sqrt(
    ((pkLon - midStraightLon) * KM_PER_LON)**2 +
    ((pkLat - midStraightLat) * KM_PER_LAT)**2
  ).toFixed(2);

  // ── Statistics derived from actual path shape ---
  // We estimate obstacle crossings by comparing how much of the path lies
  // "close" to the straight line (the corridor where urban density is highest).
  // closeness: fraction of path within ±500m of the straight A→B line.
  // 0 = path completely bypasses the direct corridor
  // 1 = path stays on the direct line

  // For our Bezier, compute fraction of points within 500m of straight line
  const CORRIDOR_M = 500; // meters
  let inCorridor = 0;
  for (const [lon, lat] of rawCoords) {
    // Distance from this point to the straight A→B line (cross-product method)
    const ax = (lon - start[0]) * KM_PER_LON;
    const ay = (lat - start[1]) * KM_PER_LAT;
    const t  = Math.max(0, Math.min(1, (ax*dxKm/lenKm + ay*dyKm/lenKm) / lenKm));
    const closestX = t * dxKm;
    const closestY = t * dyKm;
    const dist = Math.sqrt((ax - closestX)**2 + (ay - closestY)**2) * 1000; // meters
    if (dist < CORRIDOR_M) inCorridor++;
  }
  const corridorFraction = inCorridor / NUM_PTS; // 0→1

  // Buildings crossed: OSRM follows real roads (which go around buildings).
  // For shortest/balanced, roads may still pass through dense urban fabric (streets within neighborhoods).
  // For least_obstacles with bypass waypoint, corridorFraction is low → near-zero crossings.
  const urbanDensity = 4; // buildings per km in dense urban area (estimate)
  const rawBldgs = Math.round(directKm * urbanDensity * corridorFraction);
  const buildingsCrossed = osrmUsed
    ? (priority === 'least_obstacles'
        ? 0  // bypass waypoint routes around urban core
        : Math.round(corridorFraction * directKm * 2))  // urban fabric density, real roads still traverse neighborhoods
    : (hasBuildings && priority === 'least_obstacles' ? Math.min(1, rawBldgs) : rawBldgs);
  const waterCrossings      = hasWater     && priority === 'least_obstacles' ? 0 : Math.round(corridorFraction * 2);
  const steepSegments       = hasSteep     && priority !== 'shortest'        ? 0 : Math.round((1 - corridorFraction) * 3);
  const restrictedCrossings = hasRestricted && priority === 'least_obstacles' ? 0 : Math.round(corridorFraction * 1.5);
  const totalAvoided        = Math.round((1 - corridorFraction) * (directKm * urbanDensity * 0.8));
  const avoidanceDetourKm   = +(totalKm - directKm).toFixed(2);

  // ── Terrain profile along actual path ---
  const PROF_PTS = 25;
  const profile = Array.from({ length: PROF_PTS }, (_, i) => {
    const t = i / (PROF_PTS - 1);
    const distKm = +(totalKm * t).toFixed(3);
    // Simulate elevation variation — smoother for easiest_terrain
    const baseElev = 200 + Math.sin(t * Math.PI) * (peakOffsetKm * 8); // arc goes over slightly different terrain
    const elev = Math.round(baseElev
      + Math.sin(i * 0.55 + 0.4) * (priority === 'easiest_terrain' ? 10 : 28)
      + Math.cos(i * 0.32 + 0.7) * 16
    );
    return { dist_km: distKm, elev_m: elev };
  });

  const elevs    = profile.map(p => p.elev_m);
  const minElev  = Math.min(...elevs);
  const maxElev  = Math.max(...elevs);
  const elevRange = maxElev - minElev;
  const cut      = Math.round(elevRange * totalKm * (priority === 'easiest_terrain' ? 2800 : 4200));
  const fill     = Math.round(cut * 0.62);

  const detourPct = +((totalKm / directKm - 1) * 100).toFixed(1);
  const estTimeMix = osrmDurationMin > 0 ? osrmDurationMin : Math.round(totalKm * 4.5);

  // ── Human-readable notes ---
  const selectedObsAr = Object.entries(obstacles)
    .filter(([, v]) => v === true)
    .map(([k]) => ({
      buildings: 'مباني', water: 'مجاري مائية', steep_slope: 'منحدرات حادة',
      restricted_zones: 'مناطق محظورة', existing_roads: 'طرق قائمة',
    }[k] ?? k))
    .join('، ');

  const bypassNote = peakOffsetKm >= 1
    ? `تم انحراف المسار ${peakOffsetKm.toFixed(1)} كم عن الخط المستقيم`
    : `تم انحراف المسار ${Math.round(peakOffsetKm * 1000)} م عن الخط المستقيم`;

  const notes: string[] = [
    `إجمالي المسافة: ${totalKm} كم | المسافة المستقيمة: ${directKm} كم | زيادة: ${detourPct}%`,
    `فارق الارتفاع: ${minElev} – ${maxElev} م (مدى ${elevRange} م)`,
  ];
  if (priority === 'least_obstacles' && selectedObsAr) {
    notes.push(`${bypassNote} لتجنب: ${selectedObsAr}`);
    notes.push(`نسبة المسار خارج الممر الحضري: ${((1 - corridorFraction) * 100).toFixed(0)}٪`);
  } else if (priority === 'easiest_terrain') {
    notes.push(`${bypassNote} — مسار يتجنب الانحدارات الحادة وميل أقصاه ${(4.2 - peakOffsetKm * 0.3).toFixed(1)}°`);
  } else if (priority === 'shortest') {
    notes.push('المسار الأقصر — يمر عبر الممر المباشر دون انحراف يذكر');
    if (buildingsCrossed > 0) notes.push(`تحذير: المسار يقطع عبر مناطق مبنية (تقدير: ${buildingsCrossed} مبنى)`);
  } else {
    notes.push(`${bypassNote} — توازن بين المسافة وتجنب الموانع`);
  }
  notes.push('ملاحظة: الإحصاءات مشتقة من شكل المسار الهندسي — التحقق الميداني ضروري قبل التنفيذ');

  // ── Alternatives (computed at different lateral offsets) ---
  const altShortest = pathLengthKm([start, ...Array.from({length:10},(_, i)=>{
    const t=(i+1)/11, [ln,lt]=cubicBezier(start,
      [start[0]+fwdLon*directKm*0.3+perpLon*directKm*0.015, start[1]+fwdLat*directKm*0.3+perpLat*directKm*0.015],
      [start[0]+fwdLon*directKm*0.7+perpLon*directKm*0.015, start[1]+fwdLat*directKm*0.7+perpLat*directKm*0.015],
      end, t); return [+ln.toFixed(6), +lt.toFixed(6)] as [number,number];
  }), end]);
  const altLeastObs = pathLengthKm([start, ...Array.from({length:10},(_, i)=>{
    const t=(i+1)/11, [ln,lt]=cubicBezier(start,
      [start[0]+fwdLon*directKm*0.3+perpLon*directKm*0.42, start[1]+fwdLat*directKm*0.3+perpLat*directKm*0.42],
      [start[0]+fwdLon*directKm*0.7+perpLon*directKm*0.37, start[1]+fwdLat*directKm*0.7+perpLat*directKm*0.37],
      end, t); return [+ln.toFixed(6), +lt.toFixed(6)] as [number,number];
  }), end]);

  return NextResponse.json({
    status:   'ok',
    priority,
    path:        { type: 'LineString', coordinates: rawCoords },
    direct_line: { type: 'LineString', coordinates: [start, end] },
    stats: {
      total_distance_km:   totalKm,
      direct_distance_km:  directKm,
      detour_pct:          detourPct,
      estimated_time_min:  estTimeMix,
      segment_count:       rawCoords.length - 1,
      avg_slope_deg:       +(elevRange / (totalKm * 1000 / 100) * 0.57).toFixed(2),
      max_slope_deg:       +(elevRange / (totalKm * 1000 / 20) * 0.57).toFixed(2),
      difficulty:          directKm < 5 ? 'easy' : directKm < 15 ? 'moderate' : 'hard',
    },
    obstacle_stats: {
      buildings_crossed:    buildingsCrossed,
      water_crossings:      waterCrossings,
      steep_segments:       steepSegments,
      restricted_crossings: restrictedCrossings,
      total_avoided:        totalAvoided,
      avoidance_detour_km:  avoidanceDetourKm,
    },
    terrain_profile: profile,
    notes,
    engineering: {
      dem_source:         'simulated',
      routing_source:     osrmUsed ? 'OSRM/OpenStreetMap' : 'bezier-fallback',
      path_selected:      `${priority}-optimized`,
      bypass_peak_km:     peakOffsetKm,
      corridor_fraction:  +corridorFraction.toFixed(3),
      alternatives_count: 3,
      alternatives: [
        {
          label: 'المسار الأقصر',
          length_m: Math.round(altShortest * 1000),
          max_slope_pct: 14.2,
          cut_m3: Math.round(cut * 1.4),
          fill_m3: Math.round(fill),
          violations: Math.round(directKm * urbanDensity * 0.9),
          selected: priority === 'shortest',
          points_sample: [start, end],
        },
        {
          label: 'أسهل تضاريس',
          length_m: Math.round(directKm * 1.28 * 1000),
          max_slope_pct: 3.8,
          cut_m3: Math.round(cut * 0.65),
          fill_m3: Math.round(fill * 0.75),
          violations: Math.round(directKm * urbanDensity * 0.4),
          selected: priority === 'easiest_terrain',
          points_sample: [start, p1, end],
        },
        {
          label: 'أقل عوائق',
          length_m: Math.round(altLeastObs * 1000),
          max_slope_pct: 8.6,
          cut_m3: Math.round(cut * 0.85),
          fill_m3: Math.round(fill * 0.90),
          violations: 0,
          selected: priority === 'least_obstacles',
          points_sample: [start, p1, p2, end],
        },
      ],
      standards:     ['AASHTO 2018', 'BS EN 16954', 'متطلبات وزارة الأشغال الليبية'],
      standards_ref: 'AASHTO A Policy on Geometric Design of Highways and Streets, 2018',
      quantities: [
        { desc: 'حفريات جافة',     qty: cut,                               unit: 'م³',  note: 'تخمين أولي بناءً على DEM' },
        { desc: 'ردم وتسوية',       qty: fill,                              unit: 'م³',  note: 'تخمين أولي' },
        { desc: 'رصف أسفلت',        qty: Math.round(totalKm * 7.5 * 1000), unit: 'م²',  note: 'عرض 7.5م' },
        { desc: 'صرف مياه (علب)', qty: Math.round(totalKm * 4),          unit: 'عدد', note: 'كل 250م' },
        { desc: 'حواجز أمان',       qty: Math.round(totalKm * 500),        unit: 'م',   note: 'جانبان' },
      ],
      cut_m3:       cut,
      fill_m3:      fill,
      elev_min_m:   minElev,
      elev_max_m:   maxElev,
      elev_range_m: elevRange,
    },
  });
}
// RISK ASSESSMENT
// ---
function handleRiskAssessment(body: Record<string, unknown>) {
  const polygon = body.geometry?.polygon as [number,number][] | undefined;
  const bbox    = polygon
    ? [Math.min(...polygon.map(p=>p[0])), Math.min(...polygon.map(p=>p[1])),
       Math.max(...polygon.map(p=>p[0])), Math.max(...polygon.map(p=>p[1]))]
    : (body.bbox ?? [13.1, 32.7, 13.3, 32.9]) as number[];
  const s       = seed(bbox);
  const overall = 25 + s % 55;
  const level   = overall < 35 ? 'low' : overall < 55 ? 'medium' : overall < 75 ? 'high' : 'critical';

  return NextResponse.json({
    status: 'ok',
    overall_risk_score: overall,
    overall_risk_level: level,
    area_km2: +bboxArea(bbox).toFixed(2),
    risk_summary: {
      flood:      { level: s%3===0?'low':'medium',   area_pct: 15+s%25, notes: 'مناطق منخفضة قريبة من مجاري مائية' },
      earthquake: { level: 'low',                    area_pct: 5+s%10,  notes: 'منطقة مستقرة جيولوجياً' },
      industrial: { level: s%2===0?'medium':'high',  area_pct: 10+s%20, notes: 'مستودعات ومنشآت صناعية قريبة' },
      slope:      { level: s%4===0?'high':'low',     area_pct: 8+s%15,  notes: 'بعض الانحدارات الحادة في الحافة الشمالية' },
    },
    geojson: {
      type: 'FeatureCollection',
      features: gridFeatures(bbox, 6, (i, lon, lat) => ({
        risk_type:  ['flood', 'earthquake', 'industrial', 'slope'][i % 4],
        risk_level: ['low','medium','high','critical'][(i + s) % 4],
        area_m2:    8000 + i * 1500,
      })),
    },
    priority_actions: [
      'إجراء مسح هيدروجيولوجي للمناطق المنخفضة',
      'تعزيز إجراءات السلامة حول المنشآت الصناعية',
      'مراقبة مستمرة بالأقمار الاصطناعية كل 30 يوماً',
    ],
    analysis_notes: [
      'التحليل بناءً على بيانات الأقمار الاصطناعية والنماذج الرقمية للارتفاع',
      `مساحة المنطقة: ${bboxArea(bbox).toFixed(1)} كم²`,
    ],
  });
}

// ---
// SATELLITE TREND
// ---
function handleSatelliteTrend(body: Record<string, unknown>) {
  const polygon   = body.polygon as [number, number][] | undefined;
  const indicator = (body.indicator as string) ?? 'ndvi';
  const months    = (body.months  as number)  ?? 12;
  const bbox      = polygon
    ? [Math.min(...polygon.map(p=>p[0])), Math.min(...polygon.map(p=>p[1])),
       Math.max(...polygon.map(p=>p[0])), Math.max(...polygon.map(p=>p[1]))]
    : [13.1, 32.7, 13.3, 32.9];
  const s = seed(bbox);

  const INDICATOR_META: Record<string, { label_ar: string; unit: string; base: number; range: number }> = {
    ndvi:       { label_ar: 'المؤشر النباتي NDVI',       unit: '%',      base: 12.5, range: 6   },
    ndwi:       { label_ar: 'المؤشر المائي NDWI',        unit: '%',      base: -0.2, range: 0.3 },
    brightness: { label_ar: 'سطوع السطح',                 unit: 'DN',     base: 118,  range: 25  },
    sar_vv:     { label_ar: 'رادار SAR VV',               unit: 'dB',     base: -8.4, range: 4   },
  };
  const meta = INDICATOR_META[indicator] ?? INDICATOR_META.ndvi;

  const now   = new Date();
  const points = Array.from({ length: months }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (months - 1 - i));
    const v = meta.base + (Math.sin(i * 0.52 + s * 0.1) * meta.range * 0.5)
                        + (Math.cos(i * 0.31 + s * 0.2) * meta.range * 0.3);
    const anomaly = Math.abs(v - meta.base) > meta.range * 0.7;
    return {
      date:    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      value:   +v.toFixed(2),
      anomaly,
    };
  });

  const vals   = points.map(p => p.value);
  const first  = vals[0], last = vals[vals.length - 1];
  const trend  = last > first + meta.range * 0.15 ? 'up' : last < first - meta.range * 0.15 ? 'down' : 'stable';
  const anomalies = points.filter(p => p.anomaly).length;

  return NextResponse.json({
    ok:               true,
    indicator,
    label_ar:         meta.label_ar,
    unit:             meta.unit,
    months_requested: months,
    months_available: months,
    missing_count:    0,
    baseline_mean:    +meta.base.toFixed(2),
    trend_direction:  trend,
    anomaly_count:    anomalies,
    points,
  });
}

// ---
// NETWORK DESIGN (Hydraulics)
// ---
function handleNetworkDesign(body: Record<string, unknown>) {
  const netType = (body.network_type as string) ?? 'water';
  const nodes   = (body.nodes as any[]) ?? [];
  const s       = nodes.length > 0 ? nodes.length : 3;

  const resultNodes = nodes.length > 0
    ? nodes.map((n: any, i: number) => ({
        id:          n.id ?? `N${i+1}`,
        head_m:      +(35 + i * 2.5).toFixed(1),
        pressure_m:  +(25 + i * 1.8).toFixed(1),
        pressure_bar: +(2.5 + i * 0.18).toFixed(2),
        elev_m:      +(210 + i * 3.2).toFixed(1),
        status:      i === 0 ? 'reservoir' : 'junction',
      }))
    : [
        { id: 'N1', head_m: 42.0, pressure_m: 32.0, pressure_bar: 3.14, elev_m: 215.0, status: 'reservoir' },
        { id: 'N2', head_m: 38.5, pressure_m: 28.5, pressure_bar: 2.80, elev_m: 218.5, status: 'junction' },
        { id: 'N3', head_m: 35.2, pressure_m: 25.2, pressure_bar: 2.47, elev_m: 220.0, status: 'demand' },
      ];

  return NextResponse.json({
    network_type: netType,
    results: {
      nodes: resultNodes,
      pipes: resultNodes.slice(0, -1).map((n: any, i: number) => ({
        id:              `P${i+1}`,
        flow_lps:        +(12.5 - i * 1.5).toFixed(1),
        velocity_ms:     +(0.85 + i * 0.12).toFixed(2),
        headloss_m:      +(3.5 + i * 0.8).toFixed(2),
        headloss_per_km: +(8.2 + i * 1.5).toFixed(1),
        diameter_mm:     150,
        status:          'ok',
      })),
    },
    summary: {
      total_demand_lps: +(8.5 * s).toFixed(1),
      total_demand_m3h: +(8.5 * s * 3.6).toFixed(1),
      total_population: s * 250,
      min_pressure_m:   25.2,
      max_pressure_m:   42.0,
      pipe_count:       Math.max(1, resultNodes.length - 1),
      node_count:       resultNodes.length,
      warnings:         [],
    },
    geojson: { type: 'FeatureCollection', features: [] },
  });
}

// ---
// AUTO NETWORK DESIGN
// ---
function handleAutoNetwork(body: Record<string, unknown>) {
  const polygon = (body.polygon as [number,number][]) ?? [[13.1,32.7],[13.3,32.7],[13.3,32.9],[13.1,32.9]];
  const bbox    = [
    Math.min(...polygon.map(p=>p[0])), Math.min(...polygon.map(p=>p[1])),
    Math.max(...polygon.map(p=>p[0])), Math.max(...polygon.map(p=>p[1])),
  ];
  const area_ha = +(bboxArea(bbox) * 100).toFixed(1);
  const pop     = Math.round(area_ha * 85);
  const spacing = (body.spacing_m as number) ?? 200;

  return NextResponse.json({
    summary: {
      area_ha,
      total_population: pop,
      water_demand_lps:  +(pop * 0.003).toFixed(1),
      sewer_flow_lps:    +(pop * 0.0025).toFixed(1),
      nodes_count:       Math.round(area_ha * 4),
      pipes_count:       Math.round(area_ha * 4.5),
      grid_spacing_m:    spacing,
    },
    geojson: {
      type: 'FeatureCollection',
      features: gridFeatures(bbox, 12, (i, lon, lat) => ({
        type: i % 4 === 0 ? 'node' : 'pipe',
        flow_lps: +(5 + i * 0.8).toFixed(1),
      })),
    },
    pipes: [],
    nodes: [],
  });
}

// ---
// AUTO MONITOR
// ---
function handleAutoMonitorGet() {
  return NextResponse.json({
    state: {
      last_run:  new Date(Date.now() - 3600_000).toISOString(),
      next_run:  new Date(Date.now() + 82800_000).toISOString(),
      running:   false,
      last_result_summary: { total_checked: 12, total_events: 3, critical_count: 0 },
    } satisfies { last_run: string; next_run: string; running: boolean; last_result_summary: { total_checked: number; total_events: number; critical_count: number } },
    last_log: [
      { ts: new Date(Date.now() - 3600_000).toISOString(), msg: 'دورة فحص مكتملة: 12 منطقة، 3 أحداث' },
      { ts: new Date(Date.now() - 7200_000).toISOString(), msg: 'بدء دورة الفحص التلقائي' },
    ],
  });
}

function handleAutoMonitorPost(body: Record<string, unknown>) {
  const force = body.force === true;
  if (!force) {
    return NextResponse.json({ skipped: true, reason: 'لم تمض 24 ساعة منذ آخر فحص. استخدم force=true للفحص الفوري.' });
  }
  return NextResponse.json({
    skipped:  false,
    started:  true,
    run_id:   makeId('run'),
    message:  'بدأت دورة الفحص التلقائي الآن',
    estimated_duration_sec: 45,
  });
}

// ---
// ANALYZE CORRIDOR (SmartAlertsPanel)
// ---
function handleAnalyzeCorridor(body: Record<string, unknown>) {
  const polygon    = (body.polygon as [number,number][]) ?? [[13.1,32.7],[13.3,32.9]];
  const alertTypes = (body.alert_types as string[]) ?? ['construction', 'vegetation_loss'];
  const sensitivity= (body.sensitivity as string) ?? 'medium';
  const threshold  = sensitivity === 'high' ? 0.10 : sensitivity === 'medium' ? 0.20 : 0.35;
  const bbox       = [
    Math.min(...polygon.map(p=>p[0])), Math.min(...polygon.map(p=>p[1])),
    Math.max(...polygon.map(p=>p[0])), Math.max(...polygon.map(p=>p[1])),
  ];
  const s          = seed(bbox);
  const evtCount   = alertTypes.length * (1 + s % 3);
  const critCount  = s % 2;

  const TYPE_AR: Record<string, string> = {
    construction:    'نشاط بناء',
    demolition:      'هدم',
    vegetation_loss: 'تراجع نباتي',
    flooding:        'فيضان',
    fire:            'حريق',
    urban_expansion: 'توسع عمراني',
  };

  return NextResponse.json({
    status: 'ok',
    summary: {
      total_events: evtCount,
      critical_count: critCount,
      warning_count:  evtCount - critCount,
      info_count:     0,
    },
    events: alertTypes.flatMap((type, ti) =>
      Array.from({ length: 1 + s % 3 }, (_, i) => ({
        id:          makeId('ev'),
        alert_type:  type,
        severity:    ti === 0 && i === 0 && critCount > 0 ? 'critical' : 'warning',
        location:    {
          lon: +(bbox[0] + ((bbox[2]-bbox[0])*(ti*0.3+0.1))).toFixed(5),
          lat: +(bbox[1] + ((bbox[3]-bbox[1])*(i*0.2+0.1))).toFixed(5),
        },
        area_m2:     3000 + (ti + i + s) * 500,
        confidence:  +(0.55 + (i + s) % 4 * 0.08).toFixed(2),
        description_ar: `${TYPE_AR[type] ?? type} مرصود بمستوى ${sensitivity}`,
        change_pct:  +(threshold * 100 + (i + s) % 15).toFixed(1),
      }))
    ),
  });
}

// ---
// ALERTS REGISTRY (CRUD)
// ---
function handleAlertsGet(url: URL) {
  const items = readJSON<any[]>(ALERTS_F, []);
  return NextResponse.json({ items });
}

function handleAlertsPost(body: Record<string, unknown>) {
  const items = readJSON<any[]>(ALERTS_F, []);
  const existing = items.findIndex((a: any) => a.id === body.id);
  if (existing >= 0) {
    items[existing] = { ...items[existing], ...body, updated_at: nowIso() };
  } else {
    items.push({ ...body, created_at: nowIso(), updated_at: nowIso() });
  }
  writeJSON(ALERTS_F, items);
  return NextResponse.json({ ok: true });
}

function handleAlertsDelete(id: string) {
  const items = readJSON<any[]>(ALERTS_F, []).filter((a: any) => a.id !== id);
  writeJSON(ALERTS_F, items);
  return NextResponse.json({ ok: true });
}

// ---
// NOTIFICATIONS (CRUD)
// ---
function handleNotifsGet(url: URL) {
  const items  = readJSON<any[]>(NOTIFS_F, []);
  const unread = items.filter((n: any) => !n.read).length;
  return NextResponse.json({ items, unread });
}

function handleNotifsPost(body: Record<string, unknown>) {
  const items = readJSON<any[]>(NOTIFS_F, []);
  const item  = { id: makeId('notif'), created_at: nowIso(), read: false, ...body };
  items.unshift(item);
  writeJSON(NOTIFS_F, items.slice(0, 200)); // keep latest 200
  return NextResponse.json({ ok: true, item });
}

function handleNotifsDelete(id: string) {
  const items = readJSON<any[]>(NOTIFS_F, []).filter((n: any) => n.id !== id);
  writeJSON(NOTIFS_F, items);
  return NextResponse.json({ ok: true });
}

// ---
// SERVICE LAYERS (CRUD)
// ---
function handleServiceLayersGet(url: URL) {
  const items = readJSON<any[]>(SERVICE_LAYERS_F, []);
  // municipalities (static)
  const municipalities = [
    { key: 'tripoli',   labelEn: 'Tripoli',   labelAr: 'طرابلس'  },
    { key: 'benghazi',  labelEn: 'Benghazi',  labelAr: 'بنغازي'  },
    { key: 'misrata',   labelEn: 'Misrata',   labelAr: 'مصراتة'  },
    { key: 'zawiya',    labelEn: 'Zawiya',    labelAr: 'الزاوية' },
    { key: 'sabha',     labelEn: 'Sabha',     labelAr: 'سبها'    },
  ];
  return NextResponse.json({ items, municipalities });
}

function handleServiceLayersPost(body: Record<string, unknown>, req: NextRequest) {
  const items = readJSON<any[]>(SERVICE_LAYERS_F, []);
  const item  = {
    id:              makeId('sl'),
    tenant_id:       req.headers.get('x-verified-tenant-id') ?? 'default',
    name:            body.name ?? 'طبقة جديدة',
    type:            body.type ?? 'custom',
    geometry_type:   body.geometry_type ?? 'point',
    municipality_key: body.municipality_key ?? null,
    visible:         true,
    locked:          false,
    order:           items.length,
    style:           (body.style as Record<string,unknown>) ?? {},
    metadata:        (body.metadata as Record<string,unknown>) ?? {},
    created_at:      nowIso(),
    updated_at:      nowIso(),
    ...body,
  };
  items.push(item);
  writeJSON(SERVICE_LAYERS_F, items);
  return NextResponse.json({ item }, { status: 201 });
}

function handleServiceLayersPut(id: string, body: Record<string, unknown>) {
  const items = readJSON<any[]>(SERVICE_LAYERS_F, []);
  const idx   = items.findIndex((i: any) => i.id === id);
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  items[idx]  = { ...items[idx], ...body, id, updated_at: nowIso() };
  writeJSON(SERVICE_LAYERS_F, items);
  return NextResponse.json({ item: items[idx] });
}

function handleServiceLayersDelete(id: string) {
  const items = readJSON<any[]>(SERVICE_LAYERS_F, []).filter((i: any) => i.id !== id);
  writeJSON(SERVICE_LAYERS_F, items);
  return NextResponse.json({ ok: true });
}
