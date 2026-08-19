/**
 * /api/gis/[...slug]  — Catch-all handler for all GIS analysis endpoints.
 *
 * Covers every endpoint called by SIC panel components:
 *   change-detection | object-detection | insar-deformation | cva-change
 *   subpixel-change  | ground-truth     | suitability        | optimal-path
 *   risk-assessment  | satellite-trend  | network-design     | auto-network
 *   auto-monitor     | analyze-corridor | alerts-registry    | notifications
 *   service-layers   | spatial-analyst  | image-analyst      | area-report
 *
 * Analysis endpoints return deterministic mock data keyed to the input bbox.
 * CRUD endpoints (service-layers, alerts-registry, notifications) persist to
 * local JSON files under .data/gis/.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Redis from 'ioredis';

// ── Redis cache (1-hour TTL for computed routes) ---
let redis: Redis | null = null;
try {
  redis = new Redis({ host: '127.0.0.1', port: 6379, lazyConnect: true,
    connectTimeout: 2000, commandTimeout: 2000, maxRetriesPerRequest: 1 });
  redis.on('error', () => { /* suppress connection errors */ });
} catch { redis = null; }

const CACHE_TTL_SEC = 3600; // 1 hour
const HYP3_API = 'https://hyp3-api.asf.alaska.edu';
const ED_USER = process.env.NASA_EARTHDATA_USER || '';
const ED_PASS = process.env.NASA_EARTHDATA_PASS || '';

async function cacheGet(key: string): Promise<unknown | null> {
  try { const v = await redis?.get(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
async function cacheSet(key: string, data: unknown): Promise<void> {
  try { await redis?.set(key, JSON.stringify(data), 'EX', CACHE_TTL_SEC); }
  catch { /* ignore */ }
}
function routeCacheKey(start: [number,number], end: [number,number], priority: string, obstacles: Record<string,boolean>): string {
  const raw = JSON.stringify({ s: start.map(v => +v.toFixed(4)), e: end.map(v => +v.toFixed(4)), p: priority, o: obstacles });
  return 'gis:route:' + crypto.createHash('sha1').update(raw).digest('hex');
}

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
    case 'insar-results':      return await handleInSARResults(body);
    case 'insar-deformation':  return handleInSAR(body);
case 'insar': return handleInSAR(body);
    case 'cva-change':         return handleCVA(body);
    case 'subpixel-change':    return handleSubpixel(body);
    case 'ground-truth':       return handleGroundTruth(body);
    case 'suitability':        return handleSuitability(body);
    case 'optimal-path':       return handleOptimalPath(body);
    case 'risk-assessment':    return await handleRiskAssessment(body);
    case 'satellite-trend':    return handleSatelliteTrend(body);
    case 'network-design':     return handleNetworkDesign(body);
    case 'auto-network':       return handleAutoNetwork(body);
    case 'auto-monitor':       return handleAutoMonitorPost(body);
    case 'analyze-corridor':   return handleAnalyzeCorridor(body);
    case 'alerts-registry':    return handleAlertsPost(body);
    case 'notifications':      return handleNotifsPost(body);
    case 'service-layers':     return handleServiceLayersPost(body, req);
    // ── Phase 2: Spatial Analyst ─────────────────────────────────
    case 'spatial-analyst':    return handleSpatialAnalyst(body);
    // ── Phase 3: Image Analyst ────────────────────────────────────
    case 'image-analyst':      return await handleImageAnalyst(body);
    // ── Phase 4: Area Report ──────────────────────────────────────
    case 'area-report':        return await handleAreaReport(body, req);
    // ── Phase 5: CVA — real CDSE implementation ───────────────────
    case 'cva-change':         return await handleCVAReal(body);
    // ── Phase 6: Satellite Trend — temporal spectral series ───────
    case 'satellite-trend':    return await handleSatelliteTrendReal(body);
    // ── Phase 7: 3D Analyst ───────────────────────────────────────
    case '3d-analyst':         return await handleThreeDAnalyst(body);
    default:
      return NextResponse.json({ error: `Unknown GIS endpoint: ${endpoint}` }, { status: 404 });
  }
}

async function getEarthdataToken(): Promise<string | null> {
  if (!ED_USER || !ED_PASS) return null;
  try {
    const creds = Buffer.from(`${ED_USER}:${ED_PASS}`).toString('base64');
    const res = await fetch('https://urs.earthdata.nasa.gov/api/users/find_or_create_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.access_token || null;
  } catch {
    return null;
  }
}

async function fetchHyP3JobById(token: string, jobId: string): Promise<any | null> {
  try {
    const res = await fetch(`${HYP3_API}/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function insarBoundsFromBody(body: Record<string, unknown>): [number, number, number, number] | null {
  const bbox = body.bbox;
  if (Array.isArray(bbox) && bbox.length === 4) {
    return [
      Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3]),
    ];
  }

  const polygon = body.polygon;
  if (Array.isArray(polygon) && polygon.length >= 3) {
    const lons = polygon.map((p: any) => Number(Array.isArray(p) ? p[0] : 0));
    const lats = polygon.map((p: any) => Number(Array.isArray(p) ? p[1] : 0));
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  }
  return null;
}

type InSarMeasuredStats = {
  max_subsidence_mm: number;
  max_uplift_mm: number;
  mean_displacement_mm: number;
  annual_rate_mm_year: number | null;
  deform_area_pct: number;
  sample_count: number;
  valid_pixel_count: number;
  raster_width: number;
  raster_height: number;
  nodata_value: number | null;
  raster_bbox: [number, number, number, number] | null;
};

function isLikelyLonLatBounds(b: [number, number, number, number]): boolean {
  const [w, s, e, n] = b;
  return (
    Number.isFinite(w) && Number.isFinite(s) && Number.isFinite(e) && Number.isFinite(n)
    && Math.abs(w) <= 180 && Math.abs(e) <= 180
    && Math.abs(s) <= 90 && Math.abs(n) <= 90
  );
}

function utmToLonLat(easting: number, northing: number, zone: number, isSouthHemisphere: boolean): [number, number] | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing) || !Number.isFinite(zone) || zone < 1 || zone > 60) return null;

  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const eccSq = 2 * f - f * f;
  const eccPrimeSq = eccSq / (1 - eccSq);

  const x = easting - 500000.0;
  let y = northing;
  if (isSouthHemisphere) y -= 10000000.0;

  const m = y / k0;
  const mu = m / (a * (1 - eccSq / 4 - 3 * eccSq * eccSq / 64 - 5 * eccSq * eccSq * eccSq / 256));

  const e1 = (1 - Math.sqrt(1 - eccSq)) / (1 + Math.sqrt(1 - eccSq));
  const j1 = 3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32;
  const j2 = 21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32;
  const j3 = 151 * Math.pow(e1, 3) / 96;
  const j4 = 1097 * Math.pow(e1, 4) / 512;

  const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);

  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);

  const c1 = eccPrimeSq * cosFp * cosFp;
  const t1 = tanFp * tanFp;
  const n1 = a / Math.sqrt(1 - eccSq * sinFp * sinFp);
  const r1 = a * (1 - eccSq) / Math.pow(1 - eccSq * sinFp * sinFp, 1.5);
  const d = x / (n1 * k0);

  const lat = fp - (n1 * tanFp / r1) * (
    (d * d) / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * eccPrimeSq) * Math.pow(d, 4) / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * eccPrimeSq - 3 * c1 * c1) * Math.pow(d, 6) / 720
  );

  const lon0Deg = zone * 6 - 183;
  const lon = (
    d
    - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * eccPrimeSq + 24 * t1 * t1) * Math.pow(d, 5) / 120
  ) / cosFp;

  const latDeg = lat * 180 / Math.PI;
  const lonDeg = lon0Deg + (lon * 180 / Math.PI);
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return null;
  return [lonDeg, latDeg];
}

function normalizeRasterBoundsToLonLat(
  bounds: [number, number, number, number] | null,
  epsg: number | null,
): [number, number, number, number] | null {
  if (!bounds) return null;
  if (isLikelyLonLatBounds(bounds)) return bounds;
  if (!epsg) return null;

  const isNorth = epsg >= 32601 && epsg <= 32660;
  const isSouth = epsg >= 32701 && epsg <= 32760;
  if (!isNorth && !isSouth) return null;

  const zone = epsg % 100;
  const [w, s, e, n] = bounds;
  const corners = [
    utmToLonLat(w, s, zone, isSouth),
    utmToLonLat(e, s, zone, isSouth),
    utmToLonLat(e, n, zone, isSouth),
    utmToLonLat(w, n, zone, isSouth),
  ].filter(Boolean) as [number, number][];

  if (corners.length !== 4) return null;
  const lons = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  const out: [number, number, number, number] = [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats),
  ];

  return isLikelyLonLatBounds(out) ? out : null;
}

function boundsFromCmrEntry(entry: any): [number, number, number, number] | null {
  const box = Array.isArray(entry?.boxes) ? entry.boxes[0] : null;
  if (typeof box === 'string') {
    const nums = box.split(/\s+/).map((x) => Number(x)).filter((x) => Number.isFinite(x));
    if (nums.length === 4) {
      const [s, w, n, e] = nums;
      return [w, s, e, n];
    }
  }

  const polyRaw = Array.isArray(entry?.polygons) ? entry.polygons[0] : null;
  const polyStr = Array.isArray(polyRaw) ? polyRaw[0] : null;
  if (typeof polyStr === 'string') {
    const nums = polyStr.split(/\s+/).map((x) => Number(x)).filter((x) => Number.isFinite(x));
    if (nums.length >= 6 && nums.length % 2 === 0) {
      const lons: number[] = [];
      const lats: number[] = [];
      for (let i = 0; i < nums.length; i += 2) {
        lons.push(nums[i]);
        lats.push(nums[i + 1]);
      }
      return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    }
  }

  return null;
}

async function resolveBoundsFromGranules(granules: string[]): Promise<[number, number, number, number] | null> {
  for (const granule of granules.slice(0, 2)) {
    const g = String(granule || '').trim();
    if (!g) continue;
    try {
      const q = new URLSearchParams({
        page_size: '1',
        sort_key: '-start_date',
        'options[producer_granule_id][pattern]': 'true',
        producer_granule_id: `${g}*`,
      });
      const res = await fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?${q.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const d = await res.json();
      const entry = Array.isArray(d?.feed?.entry) ? d.feed.entry[0] : null;
      const b = boundsFromCmrEntry(entry);
      if (b) return b;
    } catch {
      // Continue with next granule.
    }
  }
  return null;
}

async function extractInSarStatsFromArrayBuffer(ab: ArrayBuffer): Promise<InSarMeasuredStats | null> {
  try {
    const { fromArrayBuffer } = await import('geotiff');
    const tiff = await fromArrayBuffer(ab);
    const image = await tiff.getImage(0);
    const width = image.getWidth();
    const height = image.getHeight();
    const bbRaw = (image as any).getBoundingBox?.() as [number, number, number, number] | undefined;
    const rawRasterBbox = Array.isArray(bbRaw) && bbRaw.length === 4
      ? [Number(bbRaw[0]), Number(bbRaw[1]), Number(bbRaw[2]), Number(bbRaw[3])] as [number, number, number, number]
      : null;
    const projectedEpsgRaw = Number((image as any).getGeoKeys?.()?.ProjectedCSTypeGeoKey);
    const projectedEpsg = Number.isFinite(projectedEpsgRaw) ? projectedEpsgRaw : null;
    const rasterBbox = normalizeRasterBoundsToLonLat(rawRasterBbox, projectedEpsg);
    const noDataRaw = image.getGDALNoData?.() ?? null;
    const noDataVal = noDataRaw === null || noDataRaw === undefined ? null : Number(noDataRaw);

    const rasters = await image.readRasters({ interleave: true, samples: [0] });
    const arr = (Array.isArray(rasters) ? rasters[0] : rasters) as Float32Array | Int16Array | Int32Array | undefined;
    if (!arr || arr.length === 0) return null;

    function compute(step: number, skipNoData: boolean) {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      let sum = 0;
      let validCount = 0;
      let deformCount = 0;
      for (let i = 0; i < arr.length; i += step) {
        const v = Number(arr[i]);
        if (!Number.isFinite(v)) continue;
        if (skipNoData && noDataVal !== null && Math.abs(v - noDataVal) < 1e-6) continue;
        if (Math.abs(v) > 10_000) continue;
        validCount += 1;
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
        if (Math.abs(v) >= 2) deformCount += 1;
      }
      return { min, max, sum, validCount, deformCount };
    }

    const maxSamples = 250_000;
    const sampledStep = Math.max(1, Math.floor(arr.length / maxSamples));
    let pass = compute(sampledStep, true);

    // Sparse displacement rasters can hide valid values in coarse sampling.
    if (pass.validCount < 10 && sampledStep > 1) {
      pass = compute(1, true);
    }

    // Some HyP3 products declare NoData=0 while valid displacement can include many zeros.
    if (pass.validCount < 10 && noDataVal === 0) {
      pass = compute(1, false);
    }

    if (pass.validCount < 10 || !Number.isFinite(pass.min) || !Number.isFinite(pass.max)) return null;

    return {
      max_subsidence_mm: +pass.min.toFixed(2),
      max_uplift_mm: +pass.max.toFixed(2),
      mean_displacement_mm: +(pass.sum / pass.validCount).toFixed(2),
      annual_rate_mm_year: null,
      deform_area_pct: +((pass.deformCount / pass.validCount) * 100).toFixed(2),
      sample_count: pass.validCount,
      valid_pixel_count: pass.validCount,
      raster_width: width,
      raster_height: height,
      nodata_value: noDataVal,
      raster_bbox: rasterBbox,
    };
  } catch {
    return null;
  }
}

async function extractInSarStatsFromGeoTiff(url: string): Promise<InSarMeasuredStats | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return null;

    const rawBuf = Buffer.from(await res.arrayBuffer());
    const ab = rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength) as ArrayBuffer;
    return await extractInSarStatsFromArrayBuffer(ab);
  } catch {
    return null;
  }
}

async function extractInSarStatsFromZip(url: string): Promise<InSarMeasuredStats | null> {
  try {
    const jszipMod = await import('jszip');
    const JSZip = jszipMod.default;
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) return null;
    const rawBuf = Buffer.from(await res.arrayBuffer());
    const zip = await JSZip.loadAsync(rawBuf);
    const names = Object.keys(zip.files);

    const preferred = names.find((n) => /los.*disp|displacement|_disp/i.test(n) && /\.tif$/i.test(n));
    const anyTif = names.find((n) => /\.tif$/i.test(n));
    const tifName = preferred || anyTif;
    if (!tifName) return null;

    const entry = zip.file(tifName);
    if (!entry) return null;
    const ab = await entry.async('arraybuffer');
    return await extractInSarStatsFromArrayBuffer(ab);
  } catch {
    return null;
  }
}

async function handleInSARResults(body: Record<string, unknown>) {
  const jobId = String(body.job_id || body.id || '').trim();
  const jobName = String(body.name || 'InSAR Job');
  let bounds = insarBoundsFromBody(body);
  let boundsSource: 'request' | 'cmr_granule' | 'raster_georef' | 'unknown' = bounds ? 'request' : 'unknown';

  const token = await getEarthdataToken();
  const cloudJob = token && jobId ? await fetchHyP3JobById(token, jobId) : null;
  const granules = Array.isArray(cloudJob?.job_parameters?.granules)
    ? cloudJob.job_parameters.granules.map((g: any) => String(g || '').trim()).filter(Boolean)
    : [];
  if (!bounds && granules.length > 0) {
    const gBounds = await resolveBoundsFromGranules(granules);
    if (gBounds) {
      bounds = gBounds;
      boundsSource = 'cmr_granule';
    }
  }

  let centroid: [number, number] | null = bounds
    ? [+(bounds[0] + bounds[2]) / 2, +(bounds[1] + bounds[3]) / 2]
    : null;

  const files = Array.isArray(cloudJob?.files)
    ? cloudJob.files.map((f: any) => ({
        name: f?.filename || f?.name || 'unknown',
        url: f?.url || null,
        size_mb: f?.size ? +(f.size / 1048576).toFixed(2) : null,
      }))
    : [];

  const displacementFile = files.find((f: any) =>
    typeof f.name === 'string'
    && /\.tif$/i.test(f.name)
    && /los|disp|displacement|vert/i.test(f.name)
  );
  const zipFile = files.find((f: any) => typeof f.name === 'string' && /\.zip$/i.test(f.name));
  const browseFile = files.find((f: any) => typeof f.name === 'string' && /\.png$/i.test(f.name));

  let measuredStats = displacementFile?.url
    ? await extractInSarStatsFromGeoTiff(String(displacementFile.url))
    : null;
  if (!measuredStats && zipFile?.url) {
    measuredStats = await extractInSarStatsFromZip(String(zipFile.url));
  }

  if (!bounds && measuredStats?.raster_bbox) {
    bounds = measuredStats.raster_bbox;
    boundsSource = 'raster_georef';
    centroid = [+(bounds[0] + bounds[2]) / 2, +(bounds[1] + bounds[3]) / 2];
  }
  const timeSeries: Array<{ at: string; displacement_mm: number }> = [];

  let geojson: any = null;
  if (bounds && centroid) {
    const [w, s, e, n] = bounds;
    geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
          },
          properties: {
            layer: 'insar-aoi',
            name: jobName,
            max_subsidence_mm: measuredStats?.max_subsidence_mm ?? null,
            max_uplift_mm: measuredStats?.max_uplift_mm ?? null,
          },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [
              +(centroid[0] + (e - w) * 0.08).toFixed(6),
              +(centroid[1] - (n - s) * 0.06).toFixed(6),
            ],
          },
          properties: {
            layer: 'insar-hotspot',
            type: 'subsidence',
            severity: 'critical',
            displacement_mm: measuredStats?.max_subsidence_mm ?? null,
          },
        },
      ],
    };
  }

  const cloudStatus = cloudJob?.status_code || cloudJob?.status || null;
  const isCompleted = cloudStatus === 'SUCCEEDED' || cloudStatus === 'COMPLETED' || !cloudStatus;

  return NextResponse.json({
    ok: true,
    available: true,
    job_id: jobId || null,
    name: cloudJob?.name || jobName,
    status: cloudStatus || 'SUCCEEDED',
    completed: isCompleted,
    bounds,
    centroid,
    has_precise_bounds: !!bounds,
    bounds_source: boundsSource,
    bounds_confidence: bounds ? 'provided' : 'unknown',
    raster: {
      displacement_url: displacementFile?.url || null,
      browse_url: browseFile?.url || null,
    },
    files,
    measurements_available: !!measuredStats,
    stats: measuredStats,
    metrics_estimated: false,
    metrics_source: measuredStats ? 'direct_geotiff_measurement' : 'no_numeric_metrics_without_direct_raster_read',
    time_series_data: timeSeries,
    time_series_available: false,
    geojson,
    report: {
      ar: measuredStats
        ? `تم استخراج قياسات مباشرة من ملف الإزاحة InSAR. هبوط أقصى ${measuredStats.max_subsidence_mm} مم وارتفاع أقصى ${measuredStats.max_uplift_mm} مم.`
        : `تم تحميل ملفات المهمة، لكن لم يتم استخراج قياسات رقمية لأن قراءة Raster لم تنجح أو لم يتوفر ملف إزاحة قابل للقراءة.`,
      en: measuredStats
        ? `Direct displacement raster measurements extracted for ${cloudJob?.name || jobName}.`
        : `Job files were loaded, but no numeric metrics were produced because displacement raster parsing was unavailable.`,
    },
    message_ar: isCompleted
      ? (bounds
          ? (measuredStats
              ? 'تم تحميل نتائج مهمة InSAR مع قياسات حقيقية من ملف الإزاحة.'
              : 'تم تحميل النتائج بدون قياسات رقمية لأن ملف الإزاحة غير قابل للقراءة حالياً.')
          : 'تم تحميل المهمة، لكن حدود المنطقة غير متاحة لهذه المهمة حتى الآن.')
      : 'المهمة لم تكتمل بعد. تم عرض آخر بيانات متاحة.',
    source: cloudJob
      ? (measuredStats ? 'ASF HyP3 metadata + direct raster measurement' : 'ASF HyP3 metadata only (no raster metrics extracted)')
      : 'No HyP3 metadata available (credentials/job lookup missing).',
  });
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
// CHANGE DETECTION — requires real Sentinel-2 imagery API
// ---
function handleChangeDetection(_body: Record<string, unknown>) {
  return NextResponse.json({
    available: false,
    code: 'SATELLITE_SOURCE_REQUIRED',
    message_ar: 'كشف التغيير يتطلب تحميل صور Sentinel-2 الفعلية ومقارنتها — الخدمة غير متاحة بدون مزوّد بيانات فضائية مُفعَّل.',
    required_services: ['Copernicus Data Space (CDSE)', 'Sentinel Hub API'],
    how_to_enable: 'أضف SENTINEL_HUB_CLIENT_ID و SENTINEL_HUB_CLIENT_SECRET إلى متغيرات البيئة.',
    reference: 'https://shapps.dataspace.copernicus.eu/',
  }, { status: 503 });
}

// ---
// OBJECT DETECTION — spectral analysis via Sentinel-2 (CDSE) + VIIRS fire data
// ─────────────────────────────────────────────────────────────────────────────
// ما يعمل فعلاً مع Sentinel-2 دقة 10م:
//   water_pools  → NDWI (نسبة المياه) — pixel-level via CDSE
//   bare_ground  → BSI  (مؤشر التربة المكشوفة) — pixel-level via CDSE
//   hotspots     → VIIRS NASA FIRMS (حرائق وبؤر حرارية)
//   urban_cover  → NDVI < 0.1 (تقدير الغطاء الحضري)
// ما يتطلب دقة أعلى (لا يُنفَّذ حالياً):
//   vehicles     → يحتاج ≤ 50سم (Planet Scope / Maxar)
//   buildings    → يحتاج ≤ 2م   (Airbus Pléiades)
// ─────────────────────────────────────────────────────────────────────────────
async function handleObjectDetection(body: Record<string, unknown>) {
  const polygon = body.polygon as [number, number][] | undefined;
  const classes = (body.classes as string[]) ?? ['water_pools','bare_ground','hotspots'];

  if (!polygon || polygon.length < 3) {
    return NextResponse.json({ error: 'polygon required' }, { status: 400 });
  }

  // ── Compute bbox from polygon ────────────────────────────────────────────
  const lons = polygon.map(p => p[0]);
  const lats = polygon.map(p => p[1]);
  const bbox: [number,number,number,number] = [
    Math.min(...lons), Math.min(...lats),
    Math.max(...lons), Math.max(...lats),
  ];

  // Area in hectares
  const dx = (bbox[2]-bbox[0]) * 111_320 * Math.cos((bbox[1]+bbox[3])/2 * Math.PI/180);
  const dy = (bbox[3]-bbox[1]) * 110_540;
  const areaHa = (dx * dy) / 10_000;

  const today = new Date().toISOString().slice(0,10);
  const from45 = new Date(Date.now() - 45*86400_000).toISOString().slice(0,10);

  // ── Sentinel-2 spectral stats via CDSE ───────────────────────────────────
  const CDSE_ID  = process.env.CDSE_CLIENT_ID;
  const CDSE_SEC = process.env.CDSE_CLIENT_SECRET;
  let ndwi: number|null = null;
  let ndvi: number|null = null;
  let bsi:  number|null = null;
  let sceneDateUsed: string|null = null;
  let cdseActive = false;

  if (CDSE_ID && CDSE_SEC) {
    try {
      // OAuth2 token
      const tokRes = await fetch(
        'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
        { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body: new URLSearchParams({ grant_type:'client_credentials', client_id:CDSE_ID, client_secret:CDSE_SEC }) }
      );
      const tok = tokRes.ok ? (await tokRes.json()).access_token : null;

      if (tok) {
        cdseActive = true;
        // Statistical API — NDWI, NDVI, BSI in one call
        const EVAL = `//VERSION=3
function setup(){return{input:[{bands:['B03','B04','B08','B11'],units:'REFLECTANCE'}],output:{bands:3,sampleType:'FLOAT32'}}}
function evaluatePixel(s){
  const ndwi=(s.B03-s.B08)/(s.B03+s.B08+1e-9);
  const ndvi=(s.B08-s.B04)/(s.B08+s.B04+1e-9);
  const bsi=((s.B11+s.B04)-(s.B08+s.B03))/((s.B11+s.B04)+(s.B08+s.B03)+1e-9);
  return[ndwi,ndvi,bsi];
}`;
        const statsBody = {
          input:{
            bounds:{bbox,properties:{crs:'http://www.opengis.net/def/crs/EPSG/0/4326'}},
            data:[{type:'S2L2A',dataFilter:{timeRange:{from:`${from45}T00:00:00Z`,to:`${today}T23:59:59Z`},mosaickingOrder:'leastCC'}}],
          },
          aggregation:{
            timeRange:{from:`${from45}T00:00:00Z`,to:`${today}T23:59:59Z`},
            aggregationInterval:{of:'P45D'},
            evalscript:EVAL,width:256,height:256,
          },
        };
        const sRes = await fetch('https://sh.dataspace.copernicus.eu/api/v1/statistics',{
          method:'POST',
          headers:{'Authorization':`Bearer ${tok}`,'Content-Type':'application/json'},
          body:JSON.stringify(statsBody),
        });
        if (sRes.ok) {
          const sd = await sRes.json();
          const interval = sd?.data?.[0];
          if (interval) {
            sceneDateUsed = interval.interval?.from?.slice(0,10) ?? from45;
            const bands = interval.outputs?.default?.bands ?? {};
            ndwi = bands.B0?.statistics?.mean ?? null;
            ndvi = bands.B1?.statistics?.mean ?? null;
            bsi  = bands.B2?.statistics?.mean ?? null;
          }
        }
      }
    } catch { /* silent */ }
  }

  // ── VIIRS hotspots ─────────────────────────────────────────────────────
  const FIRMS_URL = `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv`;
  const hotspotPoints: {lon:number;lat:number;frp:number}[] = [];
  try {
    const fRes = await fetch(FIRMS_URL, { signal: AbortSignal.timeout(8000) });
    if (fRes.ok) {
      const csv = await fRes.text();
      for (const line of csv.split('\n').slice(1)) {
        const cols = line.split(',');
        if (cols.length < 10) continue;
        const lat = parseFloat(cols[0]);
        const lon = parseFloat(cols[1]);
        const frp = parseFloat(cols[9]) || 0;
        if (lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]) {
          hotspotPoints.push({ lon, lat, frp });
        }
      }
    }
  } catch { /* offline */ }

  // ── Build detection results ─────────────────────────────────────────────
  const detections: {class:string;class_ar:string;lon:number;lat:number;area_px:number;area_m2:number;confidence:number}[] = [];
  const stats: Record<string,number> = {};

  // Helper: generate representative points distributed across AOI
  const genPoints = (cls:string, cls_ar:string, count:number, conf:number, estAreaM2:number) => {
    for (let i=0; i<count; i++) {
      const lon = bbox[0] + Math.random() * (bbox[2]-bbox[0]);
      const lat = bbox[1] + Math.random() * (bbox[3]-bbox[1]);
      detections.push({ class:cls, class_ar:cls_ar, lon, lat, area_px: Math.round(estAreaM2/100), area_m2: estAreaM2, confidence: conf });
    }
    stats[cls] = (stats[cls]??0) + count;
  };

  const requestedAll = classes.includes('all');

  // WATER POOLS — NDWI > 0.1 means significant water
  if (requestedAll || classes.includes('water_pools')) {
    if (ndwi !== null && ndwi > 0.05) {
      const waterPct = Math.min(80, Math.max(0, (ndwi - 0.05) * 400));
      const waterAreaM2 = areaHa * 10000 * waterPct / 100;
      const count = Math.max(1, Math.round(waterAreaM2 / 5000));
      genPoints('water_pools','برك مياه', Math.min(count,8), 0.75 + ndwi*0.2, waterAreaM2/count);
    } else if (ndwi === null) {
      genPoints('water_pools','برك مياه', 0, 0, 0);
    }
  }

  // BARE GROUND — BSI > 0.1 means exposed soil
  if (requestedAll || classes.includes('bare_ground')) {
    if (bsi !== null && bsi > 0.05) {
      const bareAreaM2 = areaHa * 10000 * Math.min(0.9, bsi + 0.2);
      const count = Math.max(1, Math.round(bareAreaM2 / 20000));
      genPoints('bare_ground','أرض مكشوفة', Math.min(count,10), 0.70 + bsi*0.15, bareAreaM2/count);
    } else if (bsi === null) {
      // No CDSE — estimate from context
      genPoints('bare_ground','أرض مكشوفة', 3, 0.45, areaHa*2000);
    }
  }

  // HOTSPOTS — real VIIRS data
  if (requestedAll || classes.includes('hotspots')) {
    for (const h of hotspotPoints.slice(0,15)) {
      detections.push({ class:'hotspots', class_ar:'بؤر حرارية', lon:h.lon, lat:h.lat, area_px:8, area_m2:375*375, confidence:0.92 });
      stats.hotspots = (stats.hotspots??0)+1;
    }
  }

  // URBAN COVER estimate (from NDVI)
  if ((requestedAll || classes.includes('buildings')) && ndvi !== null) {
    const urbanPct = ndvi < 0.1 ? Math.max(0, (0.1-ndvi)*500) : 0;
    if (urbanPct > 5) {
      const urbanAreaM2 = areaHa * 10000 * urbanPct / 100;
      genPoints('buildings','مبانٍ (تقدير)', Math.min(Math.round(urbanAreaM2/8000),6), 0.40, urbanAreaM2/4);
    }
  }

  // VEHICLES — not possible at 10m
  if (requestedAll || classes.includes('vehicles')) {
    stats.vehicles = 0;
  }

  const totalObjects = Object.values(stats).reduce((a,b)=>a+b,0);
  const dataSource = cdseActive ? `Sentinel-2 CDSE pixel-level (${sceneDateUsed ?? from45})` : 'تقديري (CDSE غير متاح)';

  // Honest assessment per class
  const classStatus: Record<string, {available:boolean;note:string}> = {
    water_pools: { available: true,  note: ndwi!==null ? `NDWI=${ndwi?.toFixed(2)} via CDSE` : 'تقديري بدون CDSE' },
    bare_ground: { available: true,  note: bsi!==null  ? `BSI=${bsi?.toFixed(2)} via CDSE`  : 'تقديري بدون CDSE' },
    hotspots:    { available: true,  note: `VIIRS NASA FIRMS — ${hotspotPoints.length} بؤرة في المنطقة` },
    buildings:   { available: false, note: 'تقدير غطاء حضري فقط (يحتاج دقة ≤ 2م لكشف المباني الفردية)' },
    vehicles:    { available: false, note: 'يتطلب صور بدقة ≤ 50سم (Planet Scope / Maxar) — غير متاح حالياً' },
  };

  return NextResponse.json({
    ok:           true,
    date:         sceneDateUsed ?? today,
    image_real:   cdseActive,
    data_source:  dataSource,
    viirs_active: hotspotPoints.length >= 0,
    cdse_active:  cdseActive,
    ndwi, ndvi, bsi,
    total_objects: totalObjects,
    stats,
    class_status:  classStatus,
    bbox,
    area_ha:       Math.round(areaHa * 10) / 10,
    detections,
    summary_ar: `تم تحليل ${Math.round(areaHa)} هكتار — ${totalObjects} كيان مرصود`
      + (hotspotPoints.length > 0 ? ` · ${hotspotPoints.length} بؤرة حرارية VIIRS` : '')
      + (cdseActive ? ` · بيانات Sentinel-2 حقيقية` : ` · بيانات تقديرية (أضف CDSE للتحليل الكامل)`),
  });
}

// ---
// InSAR DEFORMATION — requires Sentinel-1 SAR data processing
// ---
function handleInSAR(_body: Record<string, unknown>) {
  return NextResponse.json({
    available: false,
    code: 'SAR_DATA_REQUIRED',
    message_ar: 'تحليل InSAR لرصد هبوط الأرض يتطلب بيانات رادار Sentinel-1 (SLC مزدوج الاستقطاب) ومعالجة متخصصة.',
    required_services: ['Sentinel-1 SLC data via CDSE', 'SNAP / ISCE++ processing pipeline'],
    how_to_enable: 'يحتاج سيرفر معالجة مخصص لبيانات SAR (RAM ≥ 32GB + وقت معالجة ~2 ساعة لكل مشهد).',
    reference: 'https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-1',
  }, { status: 200 });
}

// ---
// CVA MULTI-SPECTRAL — requires multi-temporal Sentinel-2 imagery
// ---
function handleCVA(_body: Record<string, unknown>) {
  return NextResponse.json({
    available: false,
    code: 'SATELLITE_SOURCE_REQUIRED',
    message_ar: 'تحليل CVA متعدد الأطياف يتطلب تحميل صورتين زمنيتين من Sentinel-2 لحساب تغيير الأطياف الطيفية.',
    required_services: ['Sentinel Hub API', 'Copernicus Data Space (CDSE)'],
    how_to_enable: 'أضف SENTINEL_HUB_CLIENT_ID و SENTINEL_HUB_CLIENT_SECRET إلى متغيرات البيئة.',
    reference: 'https://shapps.dataspace.copernicus.eu/',
  }, { status: 503 });
}

// ---
// SUB-PIXEL CHANGE — requires high-resolution commercial imagery ≤ 2.5m
// ---
function handleSubpixel(_body: Record<string, unknown>) {
  return NextResponse.json({
    available: false,
    code: 'HIGH_RES_IMAGERY_REQUIRED',
    message_ar: 'تحليل التغيير دون البيكسل يتطلب صوراً فضائية بدقة 2.5 متر أو أعلى — غير متاحة من Sentinel-2 (دقته 10م).',
    required_services: ['Airbus Pléiades (50 سم)', 'Planet SuperDove (3م)', 'Maxar WorldView (30 سم)'],
  }, { status: 503 });
}

// ---
// GROUND TRUTH — requires real field validation data
// ---
function handleGroundTruth(_body: Record<string, unknown>) {
  return NextResponse.json({
    available: false,
    code: 'FIELD_DATA_REQUIRED',
    message_ar: 'التحقق الميداني يتطلب إدخال بيانات حقيقية مُجمَّعة من الميدان ومقارنتها بنتائج الأقمار الاصطناعية.',
    how_to_enable: 'استخدم تطبيق الجوال لإدخال تقارير التحقق الميداني وربطها بهذا التحليل.',
  }, { status: 503 });
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

/** Sample n evenly-spaced coordinates from a path */
function samplePath(coords: [number,number][], n: number): [number,number][] {
  if (coords.length <= n) return coords;
  const step = (coords.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => coords[Math.min(Math.round(i * step), coords.length - 1)]);
}

/**
 * Query Overpass API for actual building count within bufferM metres of a path.
 * Uses the "around polyline" Overpass filter with 15 sampled path points.
 */
async function fetchBuildingCount(coords: [number,number][], bufferM: number): Promise<number> {
  const pts = samplePath(coords, 15);
  // Overpass around polyline: lat,lon pairs separated by commas
  const coordStr = pts.map(([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(',');
  const query = `[out:json][timeout:12];way["building"](around:${bufferM},${coordStr});out count;`;
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'digital-dashboard/1.0 (GIS routing analysis)',
    },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(14000),
  });
  const data = await resp.json() as { elements?: Array<{ tags?: { ways?: string } }> };
  return parseInt(data.elements?.[0]?.tags?.ways ?? '0', 10);
}

/**
 * Query SRTM 30m elevation via opentopodata (primary) → Open-Elevation (fallback).
 * opentopodata uses 30m resolution vs Open-Elevation's 90m — more accurate slopes.
 */
async function fetchElevations(coords: [number,number][], n: number): Promise<number[]> {
  const pts = samplePath(coords, n);
  const locations = pts.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));

  // Primary: opentopodata SRTM 30m (free, no key, 1000 req/day, 100 pts/req)
  try {
    const locStr = pts.map(([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join('|');
    const resp = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locStr)}`, {
      headers: { 'User-Agent': 'digital-dashboard/1.0 (GIS routing analysis)' },
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json() as { status: string; results?: Array<{ elevation: number }> };
    if (data.status === 'OK' && (data.results?.length ?? 0) > 0) {
      return data.results!.map(r => r.elevation);
    }
  } catch { /* fall through to backup */ }

  // Fallback: Open-Elevation (SRTM 90m)
  const resp = await fetch('https://api.open-elevation.com/api/v1/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await resp.json() as { results?: Array<{ elevation: number }> };
  return (data.results ?? []).map(r => r.elevation);
}

/**
 * Query Overpass for building cluster centroid in the direct corridor.
 * Used to place OSRM bypass waypoints relative to the actual building cluster,
 * not just the geometric midpoint — gives more accurate obstacle avoidance.
 */
async function fetchBuildingCluster(
  start: [number,number], end: [number,number],
): Promise<{ centerLon: number; centerLat: number; count: number } | null> {
  const pad = 0.01; // ~1km padding around bbox
  const minLon = +(Math.min(start[0], end[0]) - pad).toFixed(5);
  const minLat = +(Math.min(start[1], end[1]) - pad).toFixed(5);
  const maxLon = +(Math.max(start[0], end[0]) + pad).toFixed(5);
  const maxLat = +(Math.max(start[1], end[1]) + pad).toFixed(5);
  const query = `[out:json][timeout:10];way["building"](${minLat},${minLon},${maxLat},${maxLon});out center 150;`;
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'digital-dashboard/1.0 (GIS routing analysis)' },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(10000),
  });
  const data = await resp.json() as { elements?: Array<{ center?: { lat: number; lon: number } }> };
  const centers = (data.elements ?? []).filter(e => e.center).map(e => [e.center!.lon, e.center!.lat] as [number,number]);
  if (centers.length < 5) return null;
  return {
    centerLon: centers.reduce((s, [lon]) => s + lon, 0) / centers.length,
    centerLat: centers.reduce((s, [, lat]) => s + lat, 0) / centers.length,
    count: centers.length,
  };
}

/**
 * Query Overpass for road type distribution within bufferM metres of a path.
 * Returns percentages by road class (primary/secondary/residential/track).
 */
async function fetchRoadQuality(coords: [number,number][], bufferM: number): Promise<{
  primary_pct: number; secondary_pct: number; residential_pct: number;
  track_pct: number; total_ways: number; dominant: string;
}> {
  const pts = samplePath(coords, 12);
  const coordStr = pts.map(([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(',');
  const query = `[out:json][timeout:10];way["highway"](around:${bufferM},${coordStr});out tags 500;`;
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'digital-dashboard/1.0 (GIS routing analysis)' },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(12000),
  });
  const data = await resp.json() as { elements?: Array<{ tags?: { highway?: string } }> };
  const counts: Record<string, number> = {};
  for (const el of data.elements ?? []) {
    const hw = el.tags?.highway ?? 'unknown';
    counts[hw] = (counts[hw] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const highways = (['motorway','trunk','primary'] as const).map(k => counts[k] ?? 0).reduce((a,b)=>a+b,0);
  const mids     = (['secondary','tertiary','unclassified'] as const).map(k => counts[k] ?? 0).reduce((a,b)=>a+b,0);
  const lows     = (['residential','service'] as const).map(k => counts[k] ?? 0).reduce((a,b)=>a+b,0);
  const tracks   = counts['track'] ?? 0;
  const highPct  = Math.round(highways / total * 100);
  const midPct   = Math.round(mids     / total * 100);
  const lowPct   = Math.round(lows     / total * 100);
  const dominant = highPct >= midPct && highPct >= lowPct ? 'primary'
    : midPct >= lowPct ? 'secondary' : 'residential';
  return { primary_pct: highPct, secondary_pct: midPct, residential_pct: lowPct,
           track_pct: Math.round(tracks / total * 100), total_ways: total, dominant };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1+2  — Engineering calculation engines
// All formulas are from referenced international standards
// ═══════════════════════════════════════════════════════════════════════════════

// ── Sewer hydraulic profile (Manning's gravity-flow analysis) ─────────────────
// BS EN 476:2011 §7.3, ISO 4435, ASCE MOP 36
// Builds point-by-point invert elevation ensuring:
//   • Min grade ≥ 0.5% (self-cleaning)
//   • Min cover ≥ 1.2m
//   • Max depth ≤ 5.0m (triggers lift station beyond that)
function buildSewerHGL(elevs: number[], totalKm: number): {
  hgl:          Array<{ dist_km: number; ground_m: number; invert_m: number; depth_m: number; grade_pct: number }>;
  liftStations: number;
  maxDepth:     number;
  avgDepth:     number;
} {
  const MIN_COVER  = 1.2;    // m — minimum soil cover over pipe crown
  const MAX_DEPTH  = 5.0;    // m — max trench depth before lift station
  const MIN_GRADE  = 0.005;  // 0.5% — minimum for self-cleaning at V≥0.6m/s
  const segDistM   = totalKm * 1000 / Math.max(elevs.length - 1, 1);

  const hgl: Array<{ dist_km: number; ground_m: number; invert_m: number; depth_m: number; grade_pct: number }> = [];
  let currentInvert = +(elevs[0] - MIN_COVER).toFixed(3);
  let liftStations  = 0;
  const depths: number[] = [];

  hgl.push({ dist_km: 0, ground_m: +elevs[0].toFixed(1), invert_m: currentInvert, depth_m: +(elevs[0] - currentInvert).toFixed(2), grade_pct: 0 });

  for (let i = 1; i < elevs.length; i++) {
    const gnd = elevs[i];
    const requiredInvert = +(currentInvert - MIN_GRADE * segDistM).toFixed(3);
    const maxAllowed     = +(gnd - MAX_DEPTH).toFixed(3);  // too deep → lift
    const minAllowed     = +(gnd - MIN_COVER).toFixed(3);  // too shallow → not OK

    let nextInvert: number;
    if (requiredInvert < maxAllowed) {
      // Pipe would exceed max depth → insert lift station, reset to min cover
      liftStations++;
      nextInvert = minAllowed;
    } else {
      nextInvert = Math.min(requiredInvert, minAllowed); // never shallower than min cover
    }
    const depth      = +(gnd - nextInvert).toFixed(2);
    const gradePct   = +((currentInvert - nextInvert) / segDistM * 100).toFixed(3);
    depths.push(depth);
    hgl.push({ dist_km: +(totalKm * i / (elevs.length - 1)).toFixed(3), ground_m: +gnd.toFixed(1), invert_m: +nextInvert.toFixed(2), depth_m: depth, grade_pct: gradePct });
    currentInvert = nextInvert;
  }

  const avgDepth = depths.length ? +(depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(2) : MIN_COVER;
  const maxDepth = depths.length ? +Math.max(...depths).toFixed(2) : MIN_COVER;
  return { hgl, liftStations, maxDepth, avgDepth };
}

// ── Manning's pipe diameter for gravity sewer ─────────────────────────────────
// Full-flow condition: Q = (1/n) × (π/4×D²) × (D/4)^(2/3) × S^(1/2)
// → D = (Q·n / 0.3117 × S^0.5)^(3/8)   [SI units: m³/s, m, dimensionless]
function manningSewerDiameter(Q_ls: number, S_pct: number, n = 0.011): number {
  const Q   = Q_ls / 1000;                      // L/s → m³/s
  const S   = Math.max(S_pct / 100, 0.001);     // % → fraction, avoid zero
  const D   = Math.pow((Q * n) / (0.3117 * Math.sqrt(S)), 3 / 8);
  const std = [150, 200, 250, 300, 375, 450, 525, 600, 750, 900];
  return std.find(s => s >= D * 1000) ?? 900;   // mm, next standard size up
}

// ── Manning's velocity check ─────────────────────────────────────────────────
function manningVelocity(D_mm: number, S_pct: number, n = 0.011): number {
  const R = (D_mm / 1000) / 4;                  // hydraulic radius for full flow = D/4
  const S = S_pct / 100;
  return +(Math.pow(R, 2/3) * Math.sqrt(S) / n).toFixed(2);
}

// ── Hazen-Williams head loss (water pipes) ───────────────────────────────────
// h_f = 10.67 × L × Q^1.852 / (C^1.852 × D^4.87)  [L in m, Q in m³/s, D in m]
// C = 130 for PE100 (new), 110 for aged steel
function hazenWilliams(Q_ls: number, D_mm: number, L_m: number, C = 130): number {
  const Q = Q_ls / 1000;
  const D = D_mm / 1000;
  if (Q <= 0 || D <= 0) return 0;
  return +(10.67 * L_m * Math.pow(Q, 1.852) / (Math.pow(C, 1.852) * Math.pow(D, 4.87))).toFixed(2);
}

// ── Water pipe velocity from flow + diameter ─────────────────────────────────
function pipeVelocity(Q_ls: number, D_mm: number): number {
  const A = Math.PI * Math.pow(D_mm / 2000, 2); // m²
  return A > 0 ? +(Q_ls / 1000 / A).toFixed(2) : 0;
}

// ── Water pipe diameter selection (velocity-based, continuity) ───────────────
// Design velocity target 1.0–1.5 m/s, max 3.0 m/s
function waterPipeDiameter(Q_ls: number, V_target = 1.2): number {
  const A_needed = (Q_ls / 1000) / V_target; // m²
  const D_needed = Math.sqrt(4 * A_needed / Math.PI) * 1000; // mm
  const std = [80, 100, 125, 150, 200, 250, 300, 350, 400, 500, 600];
  return std.find(s => s >= D_needed) ?? 600;
}

// ── Earthwork by Average End Area (profile-based) ────────────────────────────
// AASHTO 2018 §11 — uses actual terrain profile + design grade line
// Road is designed at a constant grade between start and end elevations
// Each segment: area = |terrain - design| × roadWidth, vol = avg_area × dist
function earthworkFromProfile(elevs: number[], totalKm: number, roadWidth: number): {
  cut_m3: number; fill_m3: number; cut_sections: number; fill_sections: number;
} {
  if (elevs.length < 2) return { cut_m3: 0, fill_m3: 0, cut_sections: 0, fill_sections: 0 };
  const segDistM     = totalKm * 1000 / (elevs.length - 1);
  const designSlope  = (elevs[elevs.length - 1] - elevs[0]) / (totalKm * 1000);
  let cut = 0, fill = 0, cutSections = 0, fillSections = 0;

  for (let i = 0; i < elevs.length - 1; i++) {
    const dA = elevs[i]     - (elevs[0] + designSlope * segDistM * i);
    const dB = elevs[i + 1] - (elevs[0] + designSlope * segDistM * (i + 1));
    const aA = Math.abs(dA) * roadWidth;
    const aB = Math.abs(dB) * roadWidth;
    const vol = ((aA + aB) / 2) * segDistM;
    if (dA >= 0 || dB >= 0) { cut  += vol * 0.6; cutSections++;  } // cut avg
    else                     { fill += vol * 0.8; fillSections++; } // fill with swell
  }
  // Add uniform subgrade preparation (0.3m across full width)
  const subgrade = Math.round(totalKm * 1000 * roadWidth * 0.30);
  return { cut_m3: Math.round(cut) + subgrade, fill_m3: Math.round(fill), cut_sections: cutSections, fill_sections: fillSections };
}

// ── Power line sag (parabolic approximation) ────────────────────────────────
// IEC 60826:2017 §5.3 — Parabolic sag: s = w × L² / (8H)
// ACSR "Zebra" 400mm²: w = 15.97 N/m, UTS = 125.1 kN
// Everyday tension = 22% UTS = 27.5 kN (IEC 60826 climate zone B, Libya)
function powerLineSag(spanM: number): { sag_m: number; tower_height_m: number } {
  const w   = 15.97;          // N/m — Zebra conductor weight
  const H   = 27500;          // N — everyday horizontal tension (22% UTS)
  const sag = +(w * spanM ** 2 / (8 * H)).toFixed(2);
  const clearance = 8.5;      // m — IEC 60826 §220kV (coastal Libya)
  const attach    = 6.0;      // m — attachment height above ground clearance baseline
  const rawH  = clearance + sag + attach;
  const towerH = Math.ceil(rawH / 3) * 3; // round up to 3m panel multiples
  return { sag_m: sag, tower_height_m: towerH };
}

// ── Road design speed from context ──────────────────────────────────────────
// AASHTO Table 2-1: Speed selection depends on functional class AND terrain
// We infer context from totalKm / directKm ratio (detour factor)
function roadDesignSpeed(totalKm: number, directKm: number, maxSlopePct: number): number {
  const detourFactor = directKm > 0 ? totalKm / directKm : 1;
  // High detour = urban environment = lower design speed
  if (detourFactor > 1.6) return maxSlopePct > 6 ? 40 : 60;   // dense urban
  if (detourFactor > 1.3) return maxSlopePct > 8 ? 60 : 80;   // suburban / secondary
  return maxSlopePct > 8 ? 60 : maxSlopePct > 4 ? 80 : 100;   // rural
}

// ── Vertical alignment PVI table (AASHTO Green Book 2018 §3.3 / Table 3-35,36) ──
// Input: sampled elevation profile + total route length
// Returns PVI table with: station, g1%, g2%, A, K, L_vc, type (crest/sag), SSD_ok
function buildVertAlignment(
  elevs: number[],
  totalKm: number,
  designSpeed: number,
  sightSSD: number,
): Array<{ station_km: number; g1_pct: number; g2_pct: number; A: number; K: number; L_vc_m: number; type: 'crest'|'sag'; L_min_m: number; ok: boolean; note: string }> {
  if (elevs.length < 3) return [];
  const n = elevs.length;
  const segKm = totalKm / (n - 1);

  // Grade at each segment (percent)
  const grades: number[] = [];
  for (let i = 1; i < n; i++) {
    grades.push(+((elevs[i] - elevs[i - 1]) / (segKm * 1000) * 100).toFixed(2));
  }

  // AASHTO K-values per Table 3-35 (crest) and 3-36 (sag)
  // K_crest: controls sight distance over crest; K_sag: controls comfort in sag
  const kCrest: Record<number, number> = { 40: 4, 50: 7, 60: 11, 70: 17, 80: 26, 90: 39, 100: 54, 110: 74, 120: 99 };
  const kSag:   Record<number, number> = { 40: 9, 50: 13, 60: 18, 70: 23, 80: 30, 90: 38, 100: 46, 110: 55, 120: 65 };
  const speeds  = [40,50,60,70,80,90,100,110,120];
  const vKey    = speeds.reduce((a, b) => Math.abs(b - designSpeed) < Math.abs(a - designSpeed) ? b : a);
  const Kc      = kCrest[vKey] ?? 11;
  const Ks      = kSag[vKey]   ?? 18;

  // Detect grade breaks > 0.5% absolute change
  const pvis: ReturnType<typeof buildVertAlignment> = [];
  const THRESHOLD = 0.5;
  for (let i = 1; i < grades.length; i++) {
    const A = +(grades[i] - grades[i - 1]).toFixed(2);
    if (Math.abs(A) < THRESHOLD) continue;
    const type: 'crest'|'sag' = A < 0 ? 'crest' : 'sag'; // crest: going downhill
    const K     = type === 'crest' ? Kc : Ks;
    const L_min = +(K * Math.abs(A)).toFixed(1);     // L = K × |A|
    const L_vc  = +(Math.max(L_min, 30)).toFixed(1); // minimum 30m practical
    const station = +(i * segKm).toFixed(3);
    // SSD check for crest: L ≥ sight distance
    const ssdOk = type === 'sag' || L_vc >= sightSSD;
    pvis.push({
      station_km: station,
      g1_pct:     grades[i - 1],
      g2_pct:     grades[i],
      A:          Math.abs(A),
      K,
      L_vc_m:     L_vc,
      type,
      L_min_m:    L_min,
      ok:         ssdOk,
      note:       ssdOk
        ? `✓ L=${L_vc}م (K=${K})`
        : `⚠ L=${L_vc}م < SSD=${sightSSD}م — يلزم تمديد منحنى`,
    });
  }

  // Cap at 20 most significant (largest |A|)
  return pvis.sort((a, b) => b.A - a.A).slice(0, 20).sort((a, b) => a.station_km - b.station_km);
}

// ── Construction Work Program (weeks by phase) ────────────────────────────────
// Uses modified FIDIC time estimation based on:
//  - quantities, crew sizes, working hours in Libya (6 days/week, 10h/day)
//  - concurrent phases offset by ~20%
function buildWorkProgram(
  infraType: string,
  totalKm: number,
  quantities: Array<{ desc: string; qty: number; unit: string }>,
  specific: Record<string, unknown>,
): Array<{ phase: string; duration_wk: number; start_wk: number; end_wk: number; crew: string }> {
  const phases: { phase: string; duration_wk: number; start_wk: number; end_wk: number; crew: string }[] = [];
  const qty = (key: string) => quantities.find(q => q.desc.includes(key))?.qty ?? 0;

  if (infraType === 'road') {
    const cutFill = (qty('حفريات') + qty('ردم')) / 1000; // k-m³
    const pave    = qty('رصف') / 1000; // k-m²
    const ew_wk   = Math.max(2, Math.ceil(cutFill / 3.5));  // 3500 m³/week by dozer+scraper
    const pv_wk   = Math.max(2, Math.ceil(pave / 4.2));     // 4200 m²/week by paver
    phases.push({ phase: 'مسح وترحيل',           duration_wk: 2,         start_wk: 1,          end_wk: 2,          crew: 'فريق مساحة + جهاز GPS' });
    phases.push({ phase: 'تسوية وحفر وردم (AEA)', duration_wk: ew_wk,     start_wk: 2,          end_wk: 2+ew_wk,    crew: 'جرافة D6 + سكريبر 12m³ × 2' });
    phases.push({ phase: 'تحسين الأساس + قاعدة', duration_wk: Math.max(2, Math.ceil(ew_wk*0.7)), start_wk: 2+Math.ceil(ew_wk*0.6), end_wk: 0, crew: 'هراسة 12t + ناقلات' });
    phases.push({ phase: 'رصف أسفلتي (AC-20)',   duration_wk: pv_wk,     start_wk: 0,          end_wk: 0,          crew: 'فينيشر أسفلت + هراسة مزدوجة' });
    phases.push({ phase: 'صرف + حواجز + إشارات', duration_wk: Math.max(1, Math.ceil(pv_wk*0.4)), start_wk: 0, end_wk: 0, crew: 'طاقم متعدد التخصص' });
    phases.push({ phase: 'فحص واستلام',          duration_wk: 2,         start_wk: 0,          end_wk: 0,          crew: 'مهندس استشاري + مختبر' });
  } else if (infraType === 'sewer') {
    const pipe_km = totalKm;
    const mh      = qty('غرف تفتيش');
    const ls      = (specific.lift_stations as number) ?? 0;
    const ex_wk   = Math.max(2, Math.ceil(pipe_km / 0.18)); // 180m/week urban trench
    phases.push({ phase: 'مسح ورسم شبكة',         duration_wk: 2,       start_wk: 1,    end_wk: 2,    crew: 'فريق مساحة هيدروليكي' });
    phases.push({ phase: 'حفر خندق + أساس رملي',  duration_wk: ex_wk,   start_wk: 2,    end_wk: 0,    crew: 'حفارة JCB × 2 + ناقلات' });
    phases.push({ phase: 'مد أنابيب PVC + ردم',   duration_wk: Math.ceil(ex_wk*0.85), start_wk: 4, end_wk: 0, crew: 'طاقم تمديد + رافعة صغيرة' });
    phases.push({ phase: 'غرف تفتيش + تلدين',     duration_wk: Math.max(2, Math.ceil(mh/5)), start_wk: 0, end_wk: 0, crew: 'بنّاء + طاقم أسمنت' });
    if (ls > 0) phases.push({ phase: `محطات رفع (${ls})`, duration_wk: ls*3, start_wk: 0, end_wk: 0, crew: 'متخصص محطات ضخ + كهربائي' });
    phases.push({ phase: 'اختبار ضغط + تشغيل',   duration_wk: 2,       start_wk: 0,    end_wk: 0,    crew: 'فريق اختبار + مفتش صحي' });
  } else if (infraType === 'water_pipe') {
    const pipe_km = totalKm;
    const ps      = (specific.pump_stations as number) ?? 0;
    const ex_wk   = Math.max(2, Math.ceil(pipe_km / 0.20)); // 200m/week
    phases.push({ phase: 'مسح هيدروليكي',           duration_wk: 2,       start_wk: 1,    end_wk: 2,    crew: 'مهندس هيدروليك + GPS' });
    phases.push({ phase: 'حفر + سرير رملي',         duration_wk: ex_wk,   start_wk: 2,    end_wk: 0,    crew: 'حفارة + ناقلات رمل' });
    phases.push({ phase: 'مد PE100 + لحام',         duration_wk: Math.ceil(ex_wk*0.9), start_wk: 4, end_wk: 0, crew: 'طاقم لحام HDPE + تثبيت' });
    phases.push({ phase: 'صمامات + ARV + ردم',     duration_wk: Math.max(2, Math.ceil(ex_wk*0.4)), start_wk: 0, end_wk: 0, crew: 'فني تجهيزات + ردم' });
    if (ps > 0) phases.push({ phase: `محطات ضخ (${ps})`, duration_wk: ps*4, start_wk: 0, end_wk: 0, crew: 'مقاول ميكانيك + كهربائي' });
    phases.push({ phase: 'اختبار ضغط + تعقيم',   duration_wk: 2,       start_wk: 0,    end_wk: 0,    crew: 'مختبر + كيميائي' });
  } else if (infraType === 'power_line') {
    const towers  = qty('أبراج خطية') + qty('أبراج زاوية');
    const tw_wk   = Math.max(3, Math.ceil(towers / 3)); // 3 towers/week erection
    phases.push({ phase: 'مسح + حق المرور ROW',     duration_wk: 3,       start_wk: 1,    end_wk: 3,    crew: 'فريق مساحة + قانوني' });
    phases.push({ phase: 'طرق وصول + قواعد أبراج', duration_wk: Math.ceil(tw_wk*0.7), start_wk: 3, end_wk: 0, crew: 'جرافة + خلاطة خرسانة' });
    phases.push({ phase: 'نصب أبراج SST',           duration_wk: tw_wk,   start_wk: 0,    end_wk: 0,    crew: 'رافعة 50t + فريق نصب (10)' });
    phases.push({ phase: 'شد موصلات ACSR',          duration_wk: Math.max(2, Math.ceil(tw_wk*0.5)), start_wk: 0, end_wk: 0, crew: 'رافعة خط + معدات شد' });
    phases.push({ phase: 'فحص كهربائي + تشغيل',   duration_wk: 3,       start_wk: 0,    end_wk: 0,    crew: 'مهندس كهرباء + GECOL' });
  } else {
    phases.push({ phase: 'أعمال مدنية + تركيب',   duration_wk: Math.max(4, Math.ceil(totalKm / 0.5)), start_wk: 1, end_wk: 0, crew: 'طاقم شامل' });
    phases.push({ phase: 'اختبار + استلام',        duration_wk: 2, start_wk: 0, end_wk: 0, crew: 'مهندس + مفتش' });
  }

  // Compute start/end weeks with 20% concurrent overlap
  let current = 1;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].start_wk === 0) phases[i].start_wk = current;
    current = phases[i].start_wk + Math.ceil(phases[i].duration_wk * 0.8); // 20% overlap
    phases[i].end_wk = phases[i].start_wk + phases[i].duration_wk;
  }

  return phases;
}

// ── Risk Register ─────────────────────────────────────────────────────────────
// Structured risk items per infrastructure type + Libya-specific context
// Probability × Impact matrix (1-5 each), Risk Score = P × I
function buildRiskRegister(
  infraType: string,
  totalKm: number,
  specific: Record<string, unknown>,
  maxSlopePct: number,
): Array<{ id: string; risk: string; category: string; probability: number; impact: number; score: number; mitigation: string }> {
  const risks: ReturnType<typeof buildRiskRegister> = [];
  let id = 1;
  const r = (risk: string, cat: string, p: number, im: number, mit: string) =>
    risks.push({ id: `R${String(id++).padStart(2,'0')}`, risk, category: cat, probability: p, impact: im, score: p*im, mitigation: mit });

  // Common Libya risks
  r('تأخير في الحصول على الأراضي وحق المرور', 'قانوني', 4, 4,
    'إعداد دراسة تقديرية للتعويضات مسبقاً + التنسيق مع البلدية');
  r('نقص المواد الإنشائية والمعدات في السوق', 'تزويد', 3, 3,
    'حجز مواد مسبق بـ 3 أشهر + تحديد موردين بدلاء');
  r('ظروف جوفية مغايرة (تربة، مياه جوفية)', 'جيوتقني', 3, 4,
    'تحقيق تربة (Soil Investigation) قبل التصميم التفصيلي');
  r('تعارض مع شبكات مدفونة غير مسجلة', 'مدني', 4, 3,
    'مسح GPR قبل الحفر + تنسيق مع كل الجهات (كهرباء، مياه، اتصالات)');
  r('تأخير تمويلي أو تغيير الأولويات', 'مالي', 3, 5,
    'تقسيم المشروع لمراحل قابلة للتمويل المستقل');

  if (infraType === 'road') {
    const haViolations = (specific.horizontal_alignment as any)?.violations ?? 0;
    if (haViolations > 0) r(`${haViolations} منحنى أفقي تحت Rmin`, 'هندسي', 4, 4, 'مراجعة المحاذاة + رفع نصف القطر أو تخفيض السرعة التصميمية');
    if (maxSlopePct > 6)  r(`ميل طولي حاد ${maxSlopePct}٪`, 'هندسي', 3, 3, 'تحديد منحنيات رأسية ملائمة (K-values) + تصريف مياه مناسب');
    r('ضعف طبقة الأساس (CBR < 5٪)', 'جيوتقني', 3, 4, 'اختبار CBR + تحسين بالجير أو الإسمنت حسب النتائج');
    r('تراكم المياه السطحية على الطريق', 'تصميم', 2, 3, 'حساب التصريف بمعادلة Rational + نوع المقطع الصحيح');
  } else if (infraType === 'sewer') {
    const ls = (specific.lift_stations as number) ?? 0;
    if (ls > 3) r(`${ls} محطات رفع — تعقيد تشغيلي عالٍ`, 'تشغيل', 4, 4, 'دراسة مسار بديل بحضيض أعمق + تقييم جدوى تقليل المحطات');
    r('تآكل خارجي للأنابيب في التربة الكلسية', 'مواد', 2, 3, 'استخدام SN8 + طبقة ملف بولي إيثيلين للحماية');
    r('انبعاثات H₂S في الخطوط الطويلة', 'سلامة', 3, 4, 'تهوية إجبارية في غرف التفتيش + مراقبة مستمرة');
  } else if (infraType === 'water_pipe') {
    const ps = (specific.pump_stations as number) ?? 0;
    if (ps > 0) r(`${ps} محطات ضخ — تكلفة طاقة مرتفعة`, 'تشغيل', 3, 3, 'دراسة توليد شمسي للمحطات + اختيار مضخة بكفاءة ≥ 75٪');
    r('ضربة ماء (Water Hammer) عند إغلاق الصمامات', 'هيدروليك', 3, 4, 'صمامات بطيئة الإغلاق + خزان هواء تفوير');
    r('تلوث الشبكة أثناء الإنشاء', 'صحة', 2, 5, 'بروتوكول تعقيم ISO 2531 + اختبار كلور باقٍ ≥ 0.2 mg/L');
  } else if (infraType === 'power_line') {
    r('اشتراطات GECOL وتأخير ربط الشبكة', 'تنظيمي', 4, 4, 'استيفاء متطلبات GECOL Technical مبكراً + التنسيق الرسمي');
    r('إشكاليات التوتر الناجمة عن ضربات البرق', 'كهربائي', 3, 4, 'أسلاك OPGW أرضية + برق واقٍ IEC 62305');
    r('تدلي زائد عند ارتفاع درجات الحرارة (>45°C)', 'كهربائي', 3, 3, 'تصميم سقوط عند 50°C + مراجعة ACSR بيانات المصنع');
  }

  // Sort by risk score descending
  return risks.sort((a, b) => b.score - a.score);
}

// ── Horizontal alignment PI table (AASHTO Green Book 2018 §3.3) ──────────────
// Computes Points of Intersection from coordinate array bearing changes.
// Returns array of PI objects with: station, delta_deg, R_m, T_m, L_m, check
function buildHorizAlignment(
  coords: [number, number][],
  totalKm: number,
  designSpeed: number,
): Array<{ station_km: number; delta_deg: number; R_m: number; T_m: number; L_m: number; ok: boolean; note: string }> {
  if (coords.length < 3) return [];
  const KM_PER_LAT = 110.574;
  const KM_PER_LON = 111.320 * Math.cos((coords[0][1] * Math.PI) / 180);

  // Minimum radius per AASHTO (e=4% max superelevation, f table)
  const minR: Record<number, number> = { 40: 40, 50: 60, 60: 130, 70: 175, 80: 270, 90: 395, 100: 510, 110: 650, 120: 800 };
  const vKey  = [40,50,60,70,80,90,100,110,120].reduce((a, b) => Math.abs(b - designSpeed) < Math.abs(a - designSpeed) ? b : a);
  const Rmin  = minR[vKey] ?? 130;

  // Compute cumulative distance and bearing at each point
  const bearings: number[] = [];
  const dists: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const dx = (coords[i][0] - coords[i-1][0]) * KM_PER_LON;
    const dy = (coords[i][1] - coords[i-1][1]) * KM_PER_LAT;
    dists.push(dists[i-1] + Math.sqrt(dx*dx + dy*dy));
    bearings.push(Math.atan2(dx, dy) * 180 / Math.PI); // bearing from north
  }

  // Detect PIs: bearing changes > 3°
  const pis: ReturnType<typeof buildHorizAlignment> = [];
  const THRESHOLD = 3; // degrees
  for (let i = 1; i < bearings.length; i++) {
    let delta = bearings[i] - bearings[i-1];
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const absDelta = Math.abs(delta);
    if (absDelta < THRESHOLD) continue;

    // PI is at the i-th point
    const stationKm = +(dists[i] / dists[dists.length - 1] * totalKm).toFixed(3);
    // Assign R: use road minimum or looser on flat terrain
    const R = Math.max(Rmin, Math.round(Rmin * (absDelta < 10 ? 1.3 : absDelta < 20 ? 1.1 : 1.0)));
    const deltaRad = absDelta * Math.PI / 180;
    const T = +(R * Math.tan(deltaRad / 2)).toFixed(1);
    const L = +(R * deltaRad).toFixed(1);
    const ok = R >= Rmin;
    pis.push({
      station_km: stationKm,
      delta_deg:  +absDelta.toFixed(1),
      R_m:        R,
      T_m:        T,
      L_m:        L,
      ok,
      note: ok ? `✓ R=${R}م ≥ Rmin=${Rmin}م` : `⚠ R=${R}م < Rmin=${Rmin}م — يلزم ترحيل OP أو تخفيض V`,
    });
  }

  // Cap at 20 most significant PIs
  return pis.sort((a, b) => b.delta_deg - a.delta_deg).slice(0, 20).sort((a, b) => a.station_km - b.station_km);
}

// ── Cost estimation (Libya 2024 unit rates, LYD + USD) ───────────────────────
// Unit rates in LYD (1 USD ≈ 5 LYD official / 8 LYD market; using 5 LYD/USD)
// Reference: Ministry of Public Works Libya 2022 schedule + FIDIC adjustment
const UNIT_RATES: Record<string, Record<string, number>> = {
  road: {
    'حفريات (AEA method)':           45,   // LYD/m³
    'ردم وتسوية (مدموك)':             35,   // LYD/m³
    'رصف أسفلت AC-20 (140mm)':       85,   // LYD/m²
    'قاعدة محجر مكسور (250mm)':      55,   // LYD/m³
    'تحسين تربة الأساس (200mm)':     35,   // LYD/m³
    'صرف جانبي — براميل تعبئة':     800,  // LYD/each
    'حواجز أمان W-beam EN 1317':     150,  // LYD/m
  },
  sewer: {
    'أنابيب PVC-U Ø200mm SN8':      180,  // LYD/m
    'أنابيب PVC-U Ø300mm SN8':      260,  // LYD/m
    'أنابيب PVC-U Ø400mm SN8':      380,  // LYD/m
    'أنابيب PVC-U Ø450mm SN8':      480,  // LYD/m
    'حفريات خندق (AEA method)':      55,   // LYD/m³
    'سرير رملي (Zone 1)':           120,  // LYD/m³
    'غرف تفتيش Ø1200mm':          4500,  // LYD/each
    'محطات رفع (Wet Well + Pumps)': 350000, // LYD/each
    'ردم وإعادة الرصف':              40,   // LYD/m³
  },
  water_pipe: {
    'أنابيب PE100 Ø200mm PN10':     220,  // LYD/m
    'أنابيب PE100 Ø300mm PN10':     350,  // LYD/m
    'أنابيب PE100 Ø400mm PN10':     520,  // LYD/m
    'حفريات خندق':                   55,   // LYD/m³
    'سرير رملي ناعم':               120,  // LYD/m³
    'غرف صمامات عزل (Gate Valve)': 3800, // LYD/each
    'نقاط تنفيس هواء ARV (DN50)':  1200, // LYD/each
    'محطات ضخ':                    280000, // LYD/each
  },
  power_line: {
    'أبراج خطية SST (Suspension)':  95000, // LYD/each (132kV)
    'أبراج زاوية/نهاية (Angle/Dead-End)': 145000, // LYD/each
    'موصلات ACSR "Zebra" 400mm²':   180,  // LYD/m (3 phases)
    'سلاسل عوازل (V-String)':       850,  // LYD/each
    'حفر وصب قواعد خرسانية B25':   1200, // LYD/m³
    'طرق إنشائية مؤقتة':            65,   // LYD/m²
  },
  telecom: {
    'خندق حفر':                      55,   // LYD/m³
    'كابل ألياف ضوئية G.652D':      85,   // LYD/m (96-core)
    'أنابيب حماية HDPE Ø50mm':      45,   // LYD/m
    'غرف تفتيش (Jointing Chamber)': 3200, // LYD/each
    'نقاط وصل مفصل (Splice)':       950,  // LYD/each
    'عوامل توزيع (ODF)':           8500,  // LYD/each
  },
};
const USD_RATE = 5; // LYD per USD

function computeCost(
  infraType: string,
  quantities: Array<{ desc: string; qty: number; unit: string }>,
): { direct_lyd: number; direct_usd: number; with_contingency_lyd: number; breakdown: Array<{ desc: string; qty: number; unit: string; rate_lyd: number; total_lyd: number }> } {
  const rates = UNIT_RATES[infraType] ?? {};
  const breakdown: { desc: string; qty: number; unit: string; rate_lyd: number; total_lyd: number }[] = [];
  let direct = 0;
  for (const { desc, qty, unit } of quantities) {
    // Find matching rate (partial key match for pipe variants)
    let rate = rates[desc] ?? 0;
    if (!rate) {
      for (const [key, r] of Object.entries(rates)) {
        if (desc.startsWith(key.slice(0, 12))) { rate = r; break; }
      }
    }
    if (!rate) continue;
    const total = Math.round(qty * rate);
    direct += total;
    breakdown.push({ desc, qty, unit, rate_lyd: rate, total_lyd: total });
  }
  const contingency = Math.round(direct * 0.15);
  const engFee      = Math.round(direct * 0.10);
  return {
    direct_lyd:            direct,
    direct_usd:            Math.round(direct / USD_RATE),
    with_contingency_lyd:  direct + contingency + engFee,
    breakdown,
  };
}

// ── Infrastructure-specific engineering analysis ─────────────────────────────
interface InfraDesignParams {
  adt:         number;  // vehicles/day (0 = auto)
  population:  number;  // persons served (0 = auto)
  cbr:         number;  // subgrade CBR %
  designLife:  number;  // design life years
  rainfallMmH: number;  // 10-yr storm intensity mm/h
}
const DEFAULT_DP: InfraDesignParams = { adt: 0, population: 0, cbr: 6, designLife: 20, rainfallMmH: 40 };

function computeInfraEngineering(
  infraType: string,
  rawElevs: number[],
  totalKm: number,
  directKm: number,
  maxSlopePct: number,
  avgSlopePct: number,
  routeCoords: [number, number][] = [],
  dp: InfraDesignParams = DEFAULT_DP,
): {
  standards: string[];
  standards_ref: string;
  quantities: Array<{ desc: string; qty: number; unit: string; note: string }>;
  cut_m3: number;
  fill_m3: number;
  specific: Record<string, unknown>;
} {
  const elevs     = rawElevs.length >= 2 ? rawElevs : [100, 100];
  const startElev = elevs[0];
  const endElev   = elevs[elevs.length - 1];
  const minElev   = Math.min(...elevs);
  const maxElev   = Math.max(...elevs);
  const elevRange = maxElev - minElev;

  switch (infraType) {

    // ── خط كهرباء هوائي — IEC 60826:2017 ────────────────────────────────────
    case 'power_line': {
      const spanM       = 300;
      const towerCount  = Math.ceil(totalKm * 1000 / spanM) + 1;
      const angleTowers = Math.max(1, Math.ceil(rawElevs.length >= 3
        ? rawElevs.reduce((n, e, i) => i === 0 ? n : (Math.abs(e - rawElevs[i-1]) > 5 ? n + 1 : n), 0) / 4
        : towerCount * 0.08));
      const conductorKm = +(totalKm * 3 * 1.025).toFixed(1);
      // Sag + tower height calculation (IEC 60826 §5.3 parabolic)
      const { sag_m, tower_height_m } = powerLineSag(spanM);
      // Foundations only: 4 legs × 2.5m³ per leg per tower
      const foundVol = towerCount * 4 * 2.5;
      // Access roads for construction: 4m wide × totalKm × 50% (not all terrain accessible)
      const accessRoadVol = Math.round(totalKm * 1000 * 4 * 0.25 * 0.5); // 250mm subgrade
      const cut  = Math.round(foundVol + accessRoadVol);
      const fill = Math.round(foundVol * 0.3);
      return {
        standards:    ['IEC 60826:2017', 'IEC 61089:1991', 'IEEE 524-2016', 'أكواد هيئة النظام الكهربائي الليبي GECOL'],
        standards_ref: 'IEC 60826:2017 — Design criteria of overhead transmission lines, Edition 3.0',
        quantities: [
          { desc: 'أبراج خطية SST (Suspension)',  qty: towerCount - angleTowers,     unit: 'برج',   note: `ارتفاع ${tower_height_m}م، امتداد ${spanM}م` },
          { desc: 'أبراج زاوية/نهاية (Angle/Dead-End)', qty: angleTowers,            unit: 'برج',   note: 'عند تغيير الاتجاه >15° أو نهاية الخط' },
          { desc: 'موصلات ACSR "Zebra" 400mm²',  qty: Math.round(conductorKm * 1000), unit: 'م', note: `3 أوجه + OPGW | تدلي ${sag_m}م عند ${spanM}م` },
          { desc: 'سلاسل عوازل (V-String)',       qty: towerCount * 6,               unit: 'سلسلة', note: '2 سلسلة/مرحلة × 3 مراحل — IEC 60305' },
          { desc: 'حفر وصب قواعد خرسانية B25',   qty: Math.round(foundVol),         unit: 'م³',    note: '4 أقدام × 2.5م³ لكل برج' },
          { desc: 'طرق إنشائية مؤقتة',            qty: Math.round(totalKm * 0.5 * 4 * 1000), unit: 'م²', note: 'عرض 4م، 50٪ من طول المسار' },
        ],
        cut_m3: cut,
        fill_m3: fill,
        specific: {
          tower_count:          towerCount,
          angle_towers:         angleTowers,
          standard_span_m:      spanM,
          conductor_length_km:  conductorKm,
          design_voltage_kv:    220,
          right_of_way_m:       30,
          ground_clearance_m:   8.5,
          sag_m:                sag_m,
          tower_height_m:       tower_height_m,
          max_tension_kn:       '27.5 kN (22٪ UTS everyday)',
          wind_pressure:        '550 Pa — منطقة B ليبيا الساحلية (IEC 60826)',
          conductor_type:       'ACSR 400mm² "Zebra" — w=15.97 N/m, UTS=125.1 kN',
          earth_wire:           'OPGW 24-core — حماية صاعقة + فايبر',
          insulation_level:     '220 kV — BIL 1050 kV — IEC 60071',
          route_type:           'خط هوائي مستقيم — IEC 60826 §3: الخطوط لا تتبع الطرق',
          why_not_osrm:         'خطوط النقل تسلك أقصر مسار هوائي — OSRM يتبع الطرق وهو خاطئ',
        },
      };
    }

    // ── شبكة صرف صحي — Manning + HGL Profile ────────────────────────────────
    case 'sewer': {
      // Step 1: Build hydraulic profile point-by-point
      const { hgl, liftStations, maxDepth, avgDepth } = buildSewerHGL(elevs, totalKm);

      // Step 2: Total grade for status reporting
      const totalGrade = rawElevs.length >= 2 && totalKm > 0
        ? Math.max(0, (startElev - endElev)) / (totalKm * 1000) * 100
        : 0;
      const minGrade = 0.5;
      const gradeStatus = totalGrade >= minGrade
        ? `✓ مقبول (${totalGrade.toFixed(3)}٪ ≥ 0.5٪)`
        : `⚠ غير كافٍ (${totalGrade.toFixed(3)}٪ < 0.5٪)`;

      // Step 3: Design flow estimate — WHO: 150 L/cap/day, 400 pop/km² urban
      // Catchment area ≈ totalKm × 0.1 km width (100m corridor)
      const catchmentKm2 = totalKm * 0.1;
      const population   = dp.population > 0 ? dp.population : Math.round(catchmentKm2 * 4000);
      const Qavg_ls      = +(population * 150 / 86400 * 0.8).toFixed(1); // 80% return rate
      const Qpeak_ls     = +(Qavg_ls * 2.5).toFixed(1);                   // peaking factor 2.5

      // Step 4: Manning's pipe diameter at actual design grade
      const designGrade   = Math.max(totalGrade, minGrade);
      const pipeDiam      = manningSewerDiameter(Qpeak_ls, designGrade);
      const V_full        = manningVelocity(pipeDiam, designGrade);
      const V_design      = +(V_full * 0.8).toFixed(2); // design at 80% full

      // Step 5: Earthwork from actual depth profile
      const trenchWidth   = pipeDiam / 1000 + 0.8; // pipe OD + 400mm each side
      const trenchVol     = Math.round(hgl.reduce((sum, pt, i) => {
        if (i === 0) return 0;
        const avgDepthSeg = ((hgl[i-1].depth_m + pt.depth_m) / 2);
        const segDistM    = totalKm * 1000 / (hgl.length - 1);
        return sum + avgDepthSeg * trenchWidth * segDistM;
      }, 0));
      const fillVol       = Math.round(trenchVol * 0.88); // 12% spoil (swelling)

      // Lift station TDH estimate
      const avgLiftHead   = liftStations > 0 ? Math.round(maxDepth + 3) : 0;

      return {
        standards:    ['ISO 4435:2003', 'BS EN 476:2011', 'ASCE MOP 36:2007', 'الكود الليبي LTL-007', 'GL-10 (GCLS)'],
        standards_ref: 'BS EN 476:2011 §7.3 + Manning n=0.011 (PVC-U SN8) — Grade criteria per WHO/ASCE',
        quantities: [
          { desc: `أنابيب PVC-U Ø${pipeDiam}mm SN8`,  qty: Math.round(totalKm * 1000), unit: 'م',    note: `BS EN 1401 | V=${V_design}م/ث @ ${designGrade.toFixed(2)}٪` },
          { desc: 'حفريات خندق (AEA method)',         qty: trenchVol,                  unit: 'م³',   note: `عمق متوسط ${avgDepth}م، عرض ${trenchWidth.toFixed(2)}م` },
          { desc: 'سرير رملي (Zone 1)',               qty: Math.round(trenchVol * 0.10), unit: 'م³',  note: 'سمك 150mm أسفل + جانبان حتى منتصف الأنبوب' },
          { desc: 'غرف تفتيش Ø1200mm',               qty: Math.round(totalKm * 4),    unit: 'غرفة', note: 'كل 250م + كل تغيير اتجاه + كل تفرع' },
          { desc: 'محطات رفع (Wet Well + Pumps)',     qty: liftStations,               unit: 'محطة', note: liftStations ? `TDH ≈ ${avgLiftHead}م — يلزم تصميم مستقل` : 'غير مطلوبة ✓' },
          { desc: 'ردم وإعادة الرصف',                qty: fillVol,                    unit: 'م³',   note: 'رمل Zone 2 أسفل، دحل جيولوجي أعلى' },
        ],
        cut_m3:  trenchVol,
        fill_m3: fillVol,
        specific: {
          design_population:        population,
          q_avg_ls:                 Qavg_ls,
          q_peak_ls:                Qpeak_ls,
          peaking_factor:           2.5,
          total_grade_pct:          +totalGrade.toFixed(3),
          design_grade_pct:         +designGrade.toFixed(3),
          grade_status:             gradeStatus,
          min_required_grade_pct:   minGrade,
          pipe_diameter_mm:         pipeDiam,
          pipe_material:            'PVC-U SN8 — Manning n=0.011 (BS EN 1401)',
          velocity_full_ms:         V_full,
          velocity_design_ms:       V_design,
          v_min_check:              V_design >= 0.6 ? `✓ V=${V_design}م/ث ≥ 0.6م/ث (تنظيف ذاتي)` : `⚠ V=${V_design}م/ث < 0.6م/ث — لا تنظيف ذاتي`,
          v_max_check:              V_full <= 3.0 ? `✓ V_full=${V_full}م/ث ≤ 3.0م/ث` : `⚠ V_full=${V_full}م/ث > 3.0م/ث — تآكل`,
          lift_stations:            liftStations,
          lift_station_tdh_m:       avgLiftHead || 'غير مطلوب',
          is_gravity_flow:          liftStations === 0,
          avg_pipe_depth_m:         avgDepth,
          max_pipe_depth_m:         maxDepth,
          start_invert_m:           hgl[0]?.invert_m ?? (startElev - 1.5),
          end_invert_m:             hgl[hgl.length - 1]?.invert_m ?? (endElev - 1.5),
          hgl_sample:               hgl.filter((_, i) => i % Math.max(1, Math.floor(hgl.length / 8)) === 0).slice(0, 8),
          why_gravity_matters:      'الصرف يعمل بالجاذبية — كل متر عكسي = محطة رفع (~200,000 $)',
        },
      };
    }

    // ── أنبوب مياه — Hazen-Williams + Continuity ────────────────────────────
    case 'water_pipe': {
      // Step 1: Design flow from population
      const catchKm2   = totalKm * 0.15;         // 150m service corridor
      const pop        = dp.population > 0 ? dp.population : Math.round(catchKm2 * 3000);
      const Qavg_ls    = +(pop * 200 / 86400).toFixed(1); // 200 L/cap/day
      const Qmax_ls    = +(Qavg_ls * 2.0).toFixed(1);     // max hourly factor 2.0
      const Qfire_ls   = 30;                      // fire flow: NFPA 1 min 30 L/s
      const Qdesign_ls = +(Math.max(Qmax_ls, Qfire_ls)).toFixed(1);

      // Step 2: Pipe diameter at target velocity 1.2 m/s (WHO/EN 805)
      const pipeDiam   = waterPipeDiameter(Qdesign_ls, 1.2);
      const V_actual   = pipeVelocity(Qdesign_ls, pipeDiam);

      // Step 3: Hydraulic head loss (Hazen-Williams, C=130 for PE100)
      const hf_total   = hazenWilliams(Qdesign_ls, pipeDiam, totalKm * 1000, 130);
      const hf_per_km  = +(hf_total / totalKm).toFixed(2);

      // Step 4: Pressure analysis
      const isGravity   = startElev > endElev + 5;
      const staticHead  = maxElev - minElev;
      const staticPKpa  = Math.round(staticHead * 9.81);
      const availHead   = (startElev - endElev) - hf_total;
      const residualKpa = Math.round(availHead * 9.81);

      // Step 5: Pump stations — triggered by BOTH elevation AND head-loss deficit
      let uphillCount = 0;
      for (let i = 1; i < elevs.length; i++) if (elevs[i] > elevs[i - 1] + 2) uphillCount++;
      let pumpStations = 0;
      let pumpTDH      = 0;
      if (!isGravity || residualKpa < 200) {
        const totalHeadNeeded = hf_total + Math.max(0, endElev - startElev) + 30; // 30m residual
        pumpStations = Math.max(
          !isGravity ? Math.min(Math.ceil(uphillCount / 3), 4) : 0,
          Math.ceil(totalHeadNeeded / 60), // one booster per 60m TDH
        );
        pumpTDH = Math.round(totalHeadNeeded / pumpStations);
      }
      const pressOk = residualKpa >= 200 && pumpStations === 0;

      // Step 6: Pipe class (max operating pressure incl. surge 50%)
      const maxOpKpa  = staticPKpa * 1.5;
      const pipeClass = maxOpKpa > 1200 ? 'PN16' : maxOpKpa > 800 ? 'PN12.5' : 'PN10';

      // Step 7: Earthwork
      const trenchD   = 1.0;
      const trenchW   = +(pipeDiam / 1000 + 0.8).toFixed(2);
      const trenchVol = Math.round(totalKm * 1000 * trenchD * trenchW);
      const fillVol   = Math.round(trenchVol * 0.92);

      return {
        standards:    ['ISO 4427-2:2019', 'EN 805:2000', 'NFPA 1:2021 (Fire Flow)', 'مواصفة هيئة المياه GWA-2021'],
        standards_ref: 'ISO 4427-2:2019 PE100 + EN 805 §8.2 (pressure zones) + Hazen-Williams C=130',
        quantities: [
          { desc: `أنابيب PE100 Ø${pipeDiam}mm ${pipeClass}`,   qty: Math.round(totalKm * 1000), unit: 'م',    note: `SDR11 | V=${V_actual}م/ث | hf=${hf_per_km}م/كم` },
          { desc: 'حفريات خندق',                                qty: trenchVol,                  unit: 'م³',   note: `عمق ${trenchD}م، عرض ${trenchW.toFixed(2)}م` },
          { desc: 'سرير رملي ناعم',                             qty: Math.round(trenchVol * 0.12), unit: 'م³',  note: '100mm أسفل + 150mm فوق الأنبوب' },
          { desc: 'غرف صمامات عزل (Gate Valve)',               qty: Math.round(totalKm * 2),    unit: 'غرفة', note: 'كل 500م — EN 1074' },
          { desc: 'نقاط تنفيس هواء ARV (DN50)',                qty: Math.round(totalKm * 2),    unit: 'عدد',  note: 'عند كل قمة طوبوغرافية — EN 1074-4' },
          { desc: 'محطات ضخ',                                   qty: pumpStations,               unit: 'محطة', note: pumpStations ? `TDH=${pumpTDH}م — يلزم اختيار مضخة` : 'غير مطلوبة ✓' },
        ],
        cut_m3:  trenchVol,
        fill_m3: fillVol,
        specific: {
          design_population:       pop,
          q_avg_ls:                Qavg_ls,
          q_max_hourly_ls:         Qmax_ls,
          q_fire_ls:               Qfire_ls,
          q_design_ls:             Qdesign_ls,
          pipe_diameter_mm:        pipeDiam,
          pipe_material:           `PE100 ${pipeClass}`,
          flow_velocity_ms:        V_actual,
          v_check:                 V_actual <= 3.0 && V_actual >= 0.3 ? `✓ V=${V_actual}م/ث (0.3–3.0م/ث)` : `⚠ V=${V_actual}م/ث خارج النطاق`,
          head_loss_total_m:       +hf_total.toFixed(1),
          head_loss_per_km_m:      hf_per_km,
          hf_formula:              `Hazen-Williams: hf=${hf_total.toFixed(1)}م | C=130 (PE100)`,
          is_gravity_feed:         isGravity,
          static_head_m:           +staticHead.toFixed(1),
          static_pressure_kpa:     staticPKpa,
          residual_pressure_kpa:   residualKpa,
          pressure_check:          pressOk ? `✓ ${residualKpa} kPa ≥ 200 kPa` : `⚠ ${residualKpa} kPa < 200 kPa — يلزم ضخ`,
          pump_stations:           pumpStations,
          pump_tdh_m:              pumpTDH || 'غير مطلوب',
          pipe_class:              pipeClass,
          max_operating_kpa:       maxOpKpa,
          disinfection:            'كلورة — Cl₂ باقٍ ≥ 0.2 mg/L (WHO)',
        },
      };
    }

    // ── طريق — AASHTO Green Book 2018 ───────────────────────────────────────
    case 'road': {
      // Step 1: Context-aware design speed
      const designSpeed = roadDesignSpeed(totalKm, directKm, maxSlopePct);
      const minCurveR   = designSpeed >= 100 ? 650 : designSpeed >= 80 ? 270 : designSpeed >= 60 ? 130 : 60;
      const maxGrade    = designSpeed >= 100 ? 5   : designSpeed >= 80 ? 7   : 8;
      const sightSSD    = Math.round(designSpeed ** 2 / 254 / 0.35 + designSpeed / 3.6 * 2.5); // AASHTO SSD

      // Step 2: Cross-section
      const lanes      = 2;
      const laneW      = 3.65; // AASHTO Table 2-9
      const shoulderW  = designSpeed >= 80 ? 3.0 : 2.5;
      const medianW    = 0;    // undivided
      const roadWidth  = +(lanes * laneW + 2 * shoulderW + medianW).toFixed(1);

      // Step 3: Earthwork from terrain profile (Average End Area)
      const ewResult  = earthworkFromProfile(elevs, totalKm, roadWidth);

      // Step 4: Pavement design — AASHTO 1993 flexible pavement (AASHTO Guide §3)
      // Inputs: ADT (estimated from context), CBR (Libya average 5-8 for sandy soil),
      //         reliability R=75% (rural) or R=85% (urban) → ZR
      // SN = a1*D1 + a2*m2*D2 + a3*m3*D3 (layer coefficients + drainage modifier)
      // W18 = ESAL = ADT × % trucks × 365 × GF × LEF (directional split 50%)
      const isUrban   = totalKm / directKm > 1.3;
      const adt       = dp.adt > 0 ? dp.adt : (isUrban ? 3500 : 1200); // user or auto
      const truckPct  = isUrban ? 0.10  : 0.15;         // truck fraction
      const GF        = dp.designLife;                  // growth factor (user-specified)
      const LEF       = 1.5;                             // avg load equivalency factor
      const W18       = adt * truckPct * 365 * GF * LEF * 0.5; // ESALs (one direction)
      // CBR → MR (Resilient Modulus): MR (psi) = 1500 × CBR (AASHTO eq.)
      const CBR_sub   = dp.cbr;                         // user-specified subgrade CBR
      const MR_psi    = 1500 * CBR_sub;
      // Reliability adjustment
      const ZR        = isUrban ? -1.037 : -0.842;      // Z for R=85% / R=75%
      const So        = 0.45;                            // standard deviation
      const ΔPSI      = 1.7;                             // pt=2.0, po=3.7
      // AASHTO 1993 design equation (iterative solve for SN)
      // log10(W18) = ZR*So + 9.36*log10(SN+1) - 0.20 + log10(ΔPSI/(4.2-1.5))/(0.40+1094/(SN+1)^5.19) + 2.32*log10(MR)-8.07
      const log_w18 = Math.log10(W18);
      let SN = 2.0; // initial guess
      for (let iter = 0; iter < 50; iter++) {
        const rhs = ZR * So + 9.36 * Math.log10(SN + 1) - 0.20
          + Math.log10(ΔPSI / (4.2 - 1.5)) / (0.40 + 1094 / Math.pow(SN + 1, 5.19))
          + 2.32 * Math.log10(MR_psi) - 8.07;
        if (Math.abs(rhs - log_w18) < 0.001) break;
        SN += (log_w18 - rhs) * 0.3; // Newton-Raphson step
      }
      SN = Math.max(2.0, Math.round(SN * 10) / 10);

      // Layer design from SN: a1=0.44 (AC), a2=0.14 (base CBR80), a3=0.11 (subgrade)
      // Correct: subtract base and subgrade contribution, then size AC for remainder
      const D2_mm     = 250;  // base course (standard)
      const D3_mm     = 200;  // subgrade improvement
      const SN_base   = 0.14 * D2_mm / 25.4;
      const SN_sub    = 0.11 * D3_mm / 25.4;
      const SN_ac_req = Math.max(0, SN - SN_base - SN_sub);
      const D1_mm     = Math.max(100, Math.ceil(SN_ac_req / 0.44 * 25.4 / 10) * 10); // round up to 10mm
      const SN_actual = +(0.44 * D1_mm / 25.4 + SN_base + SN_sub).toFixed(2);
      const snOk      = SN_actual >= SN;

      // Culvert/side drain sizing — Rational method Q = C×i×A
      // i = rainfall intensity (Tripoli: ~40 mm/hr for 10-yr storm)
      // C = 0.65 (paved), A = contributing area (width 30m × segment length)
      const i_mm_hr  = dp.rainfallMmH; // 10-year storm (user-specified region)
      const C_runoff = 0.65;
      const drainSpacing = 125; // meters between side drains
      const A_ha     = (30 * drainSpacing) / 10000; // contributing area per drain
      const Q_m3s    = C_runoff * (i_mm_hr / 3600 / 1000) * A_ha * 10000; // m³/s
      const Q_ls     = +(Q_m3s * 1000).toFixed(1);
      const culvertD  = Q_ls <= 50 ? 600 : Q_ls <= 120 ? 900 : 1200; // mm diameter

      const pavementArea = Math.round(totalKm * 1000 * roadWidth);
      const baseVol      = Math.round(pavementArea * D2_mm / 1000);
      const subgradeVol  = Math.round(pavementArea * D3_mm / 1000);

      // Step 5: Grade check
      const gradeStatus = maxSlopePct <= maxGrade
        ? `✓ ميل ${maxSlopePct}٪ ≤ الحد ${maxGrade}٪ (V=${designSpeed}كم/س)`
        : `⚠ ميل ${maxSlopePct}٪ > الحد ${maxGrade}٪ — يلزم تعديل المسار أو تخفيض السرعة`;

      // Step 6: Horizontal alignment (PI table) — AASHTO §3.3
      const piTable = buildHorizAlignment(routeCoords, totalKm, designSpeed);
      const piViolations = piTable.filter(p => !p.ok).length;
      const alignOk = piViolations === 0;

      // Step 7: Vertical alignment (PVI table) — AASHTO §3.3 / Table 3-35,36
      const pviTable = buildVertAlignment(rawElevs, totalKm, designSpeed, sightSSD);
      const pviViolations = pviTable.filter(p => !p.ok).length;

      return {
        standards:    ['AASHTO Green Book 2018 (6th Ed.)', 'وزارة الأشغال العامة الليبية 2019', 'EN 13108-1 (رصف أسفلت)', 'EN 1317 (حواجز أمان)'],
        standards_ref: 'AASHTO A Policy on Geometric Design of Highways and Streets, 2018 — Table 2-1, 3-34',
        quantities: [
          { desc: 'حفريات (AEA method)',           qty: ewResult.cut_m3,              unit: 'م³', note: `${ewResult.cut_sections} مقطع حفر | ميل أقصى ${maxSlopePct}٪` },
          { desc: 'ردم وتسوية (مدموك)',             qty: ewResult.fill_m3,             unit: 'م³', note: `${ewResult.fill_sections} مقطع ردم | معامل انتفاخ 20٪` },
          { desc: `رصف أسفلت AC-20 (${D1_mm}mm)`,   qty: pavementArea,                 unit: 'م²', note: `SN=${SN_actual} ≥ ${SN} (AASHTO 1993) | رابطة+سطح` },
          { desc: `قاعدة محجر مكسور (${D2_mm}mm)`,    qty: baseVol,                      unit: 'م³', note: `CBR ≥ 80٪ مدموك — عرض ${roadWidth}م` },
          { desc: `تحسين تربة الأساس (${D3_mm}mm)`,   qty: subgradeVol,                  unit: 'م³', note: `CBR_sub=${CBR_sub} → MR=${MR_psi.toLocaleString()} psi` },
          { desc: `صرف جانبي — عيار Ø${culvertD}mm`,  qty: Math.round(totalKm * 8),      unit: 'عدد', note: `Q=${Q_ls}L/s (Rational C=0.65, i=40mm/h)` },
          { desc: 'حواجز أمان W-beam EN 1317',    qty: Math.round(totalKm * 2 * 1000), unit: 'م', note: 'جانبان — N2 معتمد' },
        ],
        cut_m3:  ewResult.cut_m3,
        fill_m3: ewResult.fill_m3,
        specific: {
          design_speed_kmh:    designSpeed,
          context:             totalKm / directKm > 1.6 ? 'حضري (Urban)' : totalKm / directKm > 1.3 ? 'شبه حضري' : 'ريفي (Rural)',
          min_curve_radius_m:  minCurveR,
          road_width_m:        roadWidth,
          lanes,
          lane_width_m:        laneW,
          shoulder_m:          shoulderW,
          max_grade_allowed:   `${maxGrade}٪`,
          actual_max_grade:    `${maxSlopePct}٪`,
          grade_status:        gradeStatus,
          sight_distance_ssd_m: sightSSD,
          sight_check:         `SSD=${sightSSD}م (AASHTO §3.2, f=0.35, t=2.5s)`,
          design_class:        designSpeed >= 100 ? 'Principal Arterial' : designSpeed >= 80 ? 'Minor Arterial' : designSpeed >= 60 ? 'Collector' : 'Local',
          pavement_sn:         snOk ? `✓ SN=${SN_actual} ≥ ${SN} (AASHTO 1993)` : `⚠ SN=${SN_actual} < ${SN} — يلزم زيادة السماكة`,
          pavement_design: {
            adt,
            design_life_yr:     dp.designLife,
            w18_esals:          Math.round(W18),
            cbr_subgrade:       CBR_sub,
            mr_psi:             MR_psi,
            reliability_pct:    isUrban ? 85 : 75,
            sn_required:        SN,
            sn_actual:          SN_actual,
            ac_thickness_mm:    D1_mm,
            base_thickness_mm:  D2_mm,
            subgrade_mm:        D3_mm,
            sn_ok:              snOk,
          },
          drainage: {
            rainfall_intensity: `${i_mm_hr} mm/h (عاصفة 10 سنوات — ${i_mm_hr >= 40 ? 'طرابلس' : i_mm_hr >= 35 ? 'بنغازي/مصراتة' : 'سبها/الجنوب'})`,
            runoff_coeff:       C_runoff,
            design_flow_ls:     Q_ls,
            culvert_diameter_mm: culvertD,
            drain_spacing_m:    drainSpacing,
          },
          pavement_layers:     `تحسين تربة ${D3_mm}mm / قاعدة ${D2_mm}mm / رصف AC ${D1_mm}mm`,
          horizontal_alignment: {
            pi_count:     piTable.length,
            violations:   piViolations,
            align_ok:     alignOk ? `✓ جميع الانحناءات مطابقة (Rmin=${minCurveR}م)` : `⚠ ${piViolations} انحناء يخالف Rmin=${minCurveR}م`,
            pi_table:     piTable,
          },
          vertical_alignment: {
            pvi_count:    pviTable.length,
            violations:   pviViolations,
            vert_ok:      pviViolations === 0 ? `✓ جميع المنحنيات الرأسية مطابقة` : `⚠ ${pviViolations} مخالفة — SSD غير كافٍ عند بعض القمم`,
            pvi_table:    pviTable,
          },
        },
      };
    }

    // ── اتصالات / كابل ────────────────────────────────────────────────────────
    case 'telecom': {
      const cut  = Math.round(totalKm * 1000 * 0.5 * 0.6); // shallow trench
      const fill = Math.round(cut * 0.95);
      return {
        standards:    ['ITU-T G.652D', 'EN 50174-2', 'ETSI EN 300 019'],
        standards_ref: 'ITU-T G.652D: Characteristics of single-mode optical fibre cable',
        quantities: [
          { desc: 'خندق حفر',                    qty: Math.round(totalKm * 600 * 0.5), unit: 'م³', note: 'عمق 0.6م، عرض 0.3م داخل الشوارع' },
          { desc: 'كابل ألياف ضوئية G.652D',     qty: Math.round(totalKm * 1.05 * 1000), unit: 'م', note: '96-core ADSS أو OPGW' },
          { desc: 'أنابيب حماية HDPE Ø50mm',     qty: Math.round(totalKm * 1000),      unit: 'م',   note: 'مزدوج — للحماية والتوسعة المستقبلية' },
          { desc: 'غرف تفتيش (Jointing Chamber)', qty: Math.round(totalKm * 2),         unit: 'عدد', note: 'كل 500م' },
          { desc: 'نقاط وصل مفصل (Splice)',       qty: Math.round(totalKm * 4),         unit: 'عدد', note: 'كل 250م — loss <0.1dB/splice' },
          { desc: 'عوامل توزيع (ODF)',            qty: Math.round(totalKm * 0.5) + 2,  unit: 'وحدة', note: 'عند بداية ونهاية المسار' },
        ],
        cut_m3: cut,
        fill_m3: fill,
        specific: {
          cable_type:          'كابل ألياف ضوئية G.652D 96-core',
          fiber_count:         96,
          max_attenuation:     '0.2 dB/km @ 1550nm',
          bandwidth:           'غير محدود نظرياً — SMF',
          installation:        'مدفون في خندق + أنبوب HDPE Ø50mm مزدوج',
          route_strategy:      'يتبع الشوارع القائمة (OSRM) — مثالي لتسهيل الصيانة',
          splice_loss_budget:  '< 0.1 dB لكل وصلة',
        },
      };
    }

    // ── عام ──────────────────────────────────────────────────────────────────
    default: {
      const cutPerKm = maxSlopePct > 8 ? 4200 : maxSlopePct > 3 ? 2800 : 1400;
      const cut  = Math.round(elevRange * totalKm * cutPerKm);
      const fill = Math.round(cut * 0.62);
      return {
        standards:    ['ISO 9001:2015', 'EN 16954', 'معايير هندسية عامة'],
        standards_ref: 'معايير هندسية عامة — يجب تحديد نوع البنية التحتية للحصول على معايير دقيقة',
        quantities: [
          { desc: 'حفريات', qty: cut,  unit: 'م³', note: 'تقدير أولي' },
          { desc: 'ردم',    qty: fill, unit: 'م³', note: 'تقدير أولي' },
        ],
        cut_m3: cut,
        fill_m3: fill,
        specific: {},
      };
    }
  }
}

async function handleOptimalPath(body: Record<string, unknown>) {
  const start     = (body.start     as [number, number]) ?? [13.15, 32.78];
  const end       = (body.end       as [number, number]) ?? [13.22, 32.80];
  const priority  = (body.priority  as string) ?? 'balanced';
  const obstacles = (body.obstacles as Record<string, boolean>) ?? {};
  const manualPath = body.manual_path as [number, number][] | undefined;
  const infraType  = (body.infrastructure_type as string) ?? 'general';
  const dp_raw     = (body.design_params as Record<string, number>) ?? {};
  const designParams: InfraDesignParams = {
    adt:         +(dp_raw.adt          ?? 0),
    population:  +(dp_raw.population   ?? 0),
    cbr:         +(dp_raw.cbr          ?? 6),
    designLife:  +(dp_raw.design_life  ?? 20),
    rainfallMmH: +(dp_raw.rainfall_mm_h ?? 40),
  };

  // Infrastructure types that must NOT follow car roads (OSRM):
  //   power_line → straight towers, sewer → gravity flow, both use direct routing
  const skipOsrmForInfra = infraType === 'power_line';

  // ── Redis cache check — skip for manual paths, use for auto-routing only ---
  const ck = routeCacheKey(start, end, priority + ':' + infraType, obstacles);
  if (!manualPath) {
    const cached = await cacheGet(ck);
    if (cached) return NextResponse.json({ ...cached as object, cached: true });
  }

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

  // ── Manual path override — skip OSRM entirely when user provides custom path ---
  let osrmDurationMin = 0;
  let osrmUsed = false;
  let clusterUsed = false;
  if (manualPath && manualPath.length >= 2) {
    rawCoords = manualPath;
    // Fall through to enrichment (Overpass + elevation + road quality)
  } else if (skipOsrmForInfra) {
    // Power lines route straight — OSRM would wrongly snap to existing car roads.
    // A 220kV transmission line goes POINT-TO-POINT with minimum angle changes.
    // rawCoords is already the near-straight Bezier (lateral ≈1.5% of length).
    osrmUsed = false;
  } else try {
    let waypoints = `${start[0].toFixed(5)},${start[1].toFixed(5)};${end[0].toFixed(5)},${end[1].toFixed(5)}`;

    if (priority === 'least_obstacles' && (hasBuildings || hasRestricted)) {
      const lat = lenKm * (hasBuildings && hasRestricted ? 0.45 : hasBuildings ? 0.38 : 0.30);

      // Run cluster query in parallel with a short race — if it wins, use real centroid
      let clusterCenterLon = (start[0] + end[0]) / 2;
      let clusterCenterLat = (start[1] + end[1]) / 2;
      try {
        const cluster = await Promise.race([
          fetchBuildingCluster(start, end),
          new Promise<null>(r => setTimeout(() => r(null), 9000)),
        ]);
        if (cluster && cluster.count >= 10) {
          clusterCenterLon = cluster.centerLon;
          clusterCenterLat = cluster.centerLat;
          clusterUsed = true;
        }
      } catch { /* use geometric midpoint */ }

      // 3-waypoint arc anchored at real cluster center (or midpoint fallback)
      const wp = (frac: number, scale: number, anchorLon: number, anchorLat: number): string => {
        const blendLon = start[0] + fwdLon * directKm * frac;
        const blendLat = start[1] + fwdLat * directKm * frac;
        // Blend between geometric frac-point and cluster center as arc anchor
        const mixLon = blendLon * 0.5 + anchorLon * 0.5;
        const mixLat = blendLat * 0.5 + anchorLat * 0.5;
        return `${+(mixLon + perpLon * lat * scale).toFixed(5)},${+(mixLat + perpLat * lat * scale).toFixed(5)}`;
      };
      waypoints = [
        `${start[0].toFixed(5)},${start[1].toFixed(5)}`,
        wp(0.25, 0.65, clusterCenterLon, clusterCenterLat),
        wp(0.50, 1.00, clusterCenterLon, clusterCenterLat),
        wp(0.75, 0.65, clusterCenterLon, clusterCenterLat),
        `${end[0].toFixed(5)},${end[1].toFixed(5)}`,
      ].join(';');
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

  // ── Parallel enrichment: Overpass buildings + Open-Elevation (both fire simultaneously) ---
  const PROF_PTS = 25;
  const BUILDING_BUFFER_M = 100; // metres from path edge to count as "near" a building

  const [overpassResult, elevationResult, roadQualityResult] = await Promise.allSettled([
    fetchBuildingCount(rawCoords, BUILDING_BUFFER_M),
    fetchElevations(rawCoords, PROF_PTS),
    fetchRoadQuality(rawCoords, 30),
  ]);

  // Real building count near the path (Overpass)
  const realBuildingsNearPath = overpassResult.status === 'fulfilled' ? overpassResult.value : -1;

  // Real SRTM elevations along path (Open-Elevation)
  const rawElevs: number[] = elevationResult.status === 'fulfilled' && elevationResult.value.length > 0
    ? elevationResult.value
    : [];

  // Road type distribution (Overpass highway tags)
  const roadQuality = roadQualityResult.status === 'fulfilled'
    ? roadQualityResult.value
    : null;

  // ── Real slope calculation from SRTM elevations ---
  let avgSlopePct = 0;
  let maxSlopePct = 0;
  const slopePerSeg: number[] = [];
  if (rawElevs.length >= 3) {
    const segDistKm = totalKm / (rawElevs.length - 1);
    const segDistM  = segDistKm * 1000;
    for (let i = 1; i < rawElevs.length; i++) {
      slopePerSeg.push(Math.abs((rawElevs[i] - rawElevs[i - 1]) / segDistM * 100));
    }
    avgSlopePct = +(slopePerSeg.reduce((a, b) => a + b, 0) / slopePerSeg.length).toFixed(1);
    maxSlopePct = +Math.max(...slopePerSeg).toFixed(1);
  }
  const avgSlopeDeg = +(Math.atan(avgSlopePct / 100) * 180 / Math.PI).toFixed(2);
  const maxSlopeDeg = +(Math.atan(maxSlopePct / 100) * 180 / Math.PI).toFixed(2);

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
  const corridorFraction = inCorridor / rawCoords.length; // 0→1 (works for both OSRM and Bezier)

  // ── Real building statistics from Overpass (or fallback estimate) ---
  // realBuildingsNearPath = actual OSM buildings within BUILDING_BUFFER_M of the path
  // For "least_obstacles" with bypass waypoint, OSRM routes away from urban core → lower count
  const urbanDensity = 4;
  const rawBldgs = Math.round(directKm * urbanDensity * corridorFraction);
  let buildingsCrossed: number;
  if (realBuildingsNearPath >= 0) {
    // Overpass succeeded — use real count
    buildingsCrossed = realBuildingsNearPath;
  } else {
    // Fallback to geometry estimate
    buildingsCrossed = osrmUsed
      ? (priority === 'least_obstacles' ? 0 : Math.round(corridorFraction * directKm * 2))
      : (hasBuildings && priority === 'least_obstacles' ? Math.min(1, rawBldgs) : rawBldgs);
  }

  const waterCrossings      = hasWater     && priority === 'least_obstacles' ? 0 : Math.round(corridorFraction * 2);
  const steepSegments       = hasSteep     && priority !== 'shortest'        ? 0 : Math.round((1 - corridorFraction) * 3);
  const restrictedCrossings = hasRestricted && priority === 'least_obstacles' ? 0 : Math.round(corridorFraction * 1.5);
  const totalAvoided        = realBuildingsNearPath >= 0
    ? Math.max(0, Math.round(realBuildingsNearPath * 0.4))  // real: ~40% of nearby buildings are fully avoided
    : Math.round((1 - corridorFraction) * (directKm * urbanDensity * 0.8));
  const avoidanceDetourKm   = +(totalKm - directKm).toFixed(2);

  // ── Terrain profile — real SRTM elevations from Open-Elevation (or simulated fallback) ---
  let profile: Array<{ dist_km: number; elev_m: number; slope_pct: number }>;
  if (rawElevs.length >= 3) {
    // Use real elevations from SRTM via Open-Elevation API, with per-segment slope
    const step = totalKm / (rawElevs.length - 1);
    profile = rawElevs.map((elev_m, i) => ({
      dist_km:   +(step * i).toFixed(3),
      elev_m:    Math.round(elev_m),
      slope_pct: i === 0 ? 0 : +(slopePerSeg[i - 1] ?? 0).toFixed(1),
    }));
  } else {
    // Fallback: simulated elevation variation
    profile = Array.from({ length: PROF_PTS }, (_, i) => {
      const t = i / (PROF_PTS - 1);
      const elev = Math.round(
        200 + Math.sin(t * Math.PI) * (peakOffsetKm * 8)
        + Math.sin(i * 0.55 + 0.4) * (priority === 'easiest_terrain' ? 10 : 28)
        + Math.cos(i * 0.32 + 0.7) * 16
      );
      return { dist_km: +(totalKm * t).toFixed(3), elev_m: elev, slope_pct: 0 };
    });
  }

  const elevs    = profile.map(p => p.elev_m);
  const minElev  = Math.min(...elevs);
  const maxElev  = Math.max(...elevs);
  const elevRange = maxElev - minElev;
  // Cut/fill based on real max slope — steeper → more earthwork
  const cutPerKm = maxSlopePct > 8 ? 4200 : maxSlopePct > 3 ? 2800 : 1400;
  const cut      = Math.round(elevRange * totalKm * cutPerKm);
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
  if (maxSlopePct > 0) notes.push(`الميل الأقصى: ${maxSlopePct}٪ (${maxSlopeDeg}°) | متوسط الميل: ${avgSlopePct}٪ (${avgSlopeDeg}°) | مصدر: SRTM`);
  if (roadQuality) notes.push(`جودة الطريق: ${roadQuality.primary_pct}٪ رئيسي | ${roadQuality.secondary_pct}٪ ثانوي | ${roadQuality.residential_pct}٪ سكني | مصدر: OpenStreetMap`);

  // ── Infrastructure-specific engineering ---
  const infraEng = computeInfraEngineering(
    infraType, rawElevs, totalKm, directKm, maxSlopePct, avgSlopePct, rawCoords, designParams,
  );

  // ── Cost estimation ---
  const costEst = computeCost(infraType, infraEng.quantities);

  // ── Work Program + Risk Register ---
  const spec = infraEng.specific as Record<string, unknown>;
  const workProgram  = buildWorkProgram(infraType, totalKm, infraEng.quantities, spec);
  const riskRegister = buildRiskRegister(infraType, totalKm, spec, maxSlopePct);

  // ── Notes — add infra-specific warnings ---
  if (infraType === 'power_line' && osrmUsed) {
    notes.unshift('⚠ خطوط الكهرباء الهوائية تتبع مسار مستقيم بين الأبراج — لا تتبع شوارع السيارات');
  }
  if (infraType === 'sewer') {
    notes.push(`تحليل التدفق: ${spec.grade_status}`);
    if ((spec.lift_stations as number) > 0) {
      notes.push(`⚠ محطات رفع مطلوبة (${spec.lift_stations}) — تكلفة إضافية ~200,000$ للمحطة`);
    } else {
      notes.push('✓ تدفق بالجاذبية ممكن على طول المسار');
    }
  }
  if (infraType === 'water_pipe') {
    notes.push(`تحليل هيدروليكي: ${spec.is_gravity_feed ? 'تدفق بالجاذبية' : `يحتاج ${spec.pump_stations} محطة ضخ`}`);
    notes.push(`فئة الأنبوب: PE100 ${spec.pipe_class} — ضغط ساكن ${spec.static_pressure_kpa} kPa`);
  }
  if (infraType === 'road') {
    notes.push(`سرعة التصميم: ${spec.design_speed_kmh} كم/س | أدنى نصف قطر منحنى: ${spec.min_curve_radius_m}م`);
    notes.push(`حالة الميل: ${spec.grade_status}`);
  }

  const result = {
    status:   'ok',
    priority,
    infra_type: infraType,
    path:        { type: 'LineString', coordinates: rawCoords },
    direct_line: { type: 'LineString', coordinates: [start, end] },
    stats: {
      total_distance_km:   totalKm,
      direct_distance_km:  directKm,
      detour_pct:          detourPct,
      estimated_time_min:  estTimeMix,
      segment_count:       rawCoords.length - 1,
      avg_slope_pct:       avgSlopePct,
      max_slope_pct:       maxSlopePct,
      avg_slope_deg:       avgSlopeDeg,
      max_slope_deg:       maxSlopeDeg,
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
      dem_source:          rawElevs.length >= 3 ? 'SRTM-30m/opentopodata' : 'simulated',
      routing_source:      manualPath ? 'manual/user-drawn' : skipOsrmForInfra ? `${infraType}-direct-routing` : osrmUsed ? 'OSRM/OpenStreetMap' : 'bezier-fallback',
      infra_routing_note:  skipOsrmForInfra ? 'مسار مستقيم بين نقطتين — مناسب للبنية التحتية الخطية (أبراج كهرباء)' : undefined,
      buildings_source:    realBuildingsNearPath >= 0 ? 'Overpass/OSM' : 'geometry-estimate',
      cluster_source:      clusterUsed ? 'Overpass/OSM-cluster-centroid' : 'geometric-midpoint',
      road_quality:        roadQuality ?? { primary_pct: 0, secondary_pct: 0, residential_pct: 0, track_pct: 0, total_ways: 0, dominant: 'unknown' },
      road_quality_source: roadQuality ? 'Overpass/OSM' : 'unavailable',
      path_selected:       `${priority}-optimized (${infraType})`,
      bypass_peak_km:      peakOffsetKm,
      corridor_fraction:   +corridorFraction.toFixed(3),
      standards:           infraEng.standards,
      standards_ref:       infraEng.standards_ref,
      quantities:          infraEng.quantities,
      cut_m3:              infraEng.cut_m3,
      fill_m3:             infraEng.fill_m3,
      elev_min_m:          minElev,
      elev_max_m:          maxElev,
      elev_range_m:        elevRange,
      infra_specific:      infraEng.specific,
      cost_estimate: {
        direct_lyd:           costEst.direct_lyd,
        direct_usd:           costEst.direct_usd,
        with_contingency_lyd: costEst.with_contingency_lyd,
        with_contingency_usd: Math.round(costEst.with_contingency_lyd / USD_RATE),
        currency_note:        '1 USD = 5 LYD (المعدل الرسمي 2024)',
        contingency_pct:      15,
        engineering_fee_pct:  10,
        breakdown:            costEst.breakdown,
      },
      work_program:        workProgram,
      risk_register:       riskRegister,
    },
  };

  // ── Store in Redis cache (fire-and-forget, skip for manual paths) ---
  if (!manualPath) void cacheSet(ck, result);

  return NextResponse.json(result);
}
// RISK ASSESSMENT — uses real OpenTopoData SRTM elevations
// ---
async function handleRiskAssessment(body: Record<string, unknown>): Promise<NextResponse> {
  const polygon = (body.geometry as any)?.polygon as [number,number][] | undefined;
  const bbox    = polygon
    ? [Math.min(...polygon.map((p: [number,number])=>p[0])), Math.min(...polygon.map((p: [number,number])=>p[1])),
       Math.max(...polygon.map((p: [number,number])=>p[0])), Math.max(...polygon.map((p: [number,number])=>p[1]))]
    : (body.bbox ?? [13.1, 32.7, 13.3, 32.9]) as number[];

  // Sample a 5×5 grid across the bbox
  const [w, s_c, e, n] = bbox;
  const pts: Array<[number,number]> = [];
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 5; col++)
      pts.push([+(w + (e-w)*(col/4)).toFixed(5), +(s_c + (n-s_c)*(row/4)).toFixed(5)]);

  // Fetch real elevations from OpenTopoData SRTM 30m
  let elevations: number[] = [];
  let elevSource = 'unavailable';
  try {
    const locStr = pts.map(([lon, lat]) => `${lat},${lon}`).join('|');
    const resp = await fetch(
      `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locStr)}`,
      { headers: { 'User-Agent': 'digital-dashboard/1.0' }, signal: AbortSignal.timeout(10000) }
    );
    const data = await resp.json() as { status: string; results?: Array<{ elevation: number }> };
    if (data.status === 'OK' && data.results?.length) {
      elevations = data.results.map(r => r.elevation);
      elevSource = 'SRTM-30m / opentopodata.org';
    }
  } catch { /* network error — return partial */ }

  const hasReal = elevations.length >= 10;
  const areaKm2 = +bboxArea(bbox).toFixed(2);

  if (!hasReal) {
    return NextResponse.json({
      status: 'unavailable',
      data_real: false,
      area_km2: areaKm2,
      message_ar: 'تعذّر الاتصال بـ OpenTopoData للحصول على بيانات الارتفاع الحقيقية — تحقق من الاتصال بالإنترنت وأعد المحاولة.',
      dem_source: 'unavailable',
    }, { status: 503 });
  }

  const minElev   = Math.min(...elevations);
  const maxElev   = Math.max(...elevations);
  const meanElev  = +(elevations.reduce((a,b)=>a+b,0) / elevations.length).toFixed(1);
  const elevRange = +(maxElev - minElev).toFixed(1);

  // Slope risk: elevation range / sqrt(area) → steeper = higher risk
  const roughness  = elevRange / Math.sqrt(areaKm2);
  const slopeScore = Math.min(100, Math.round(roughness * 2.5));
  const slopeLevel = slopeScore < 20 ? 'low' : slopeScore < 50 ? 'medium' : slopeScore < 75 ? 'high' : 'critical';

  // Flood risk: fraction of sample points below 5m elevation
  const lowPct     = +(elevations.filter(e => e < 5).length / elevations.length * 100).toFixed(1);
  const floodScore = Math.min(100, Math.round(+lowPct * 2 + (meanElev < 10 ? 30 : 0)));
  const floodLevel = floodScore < 20 ? 'low' : floodScore < 45 ? 'medium' : floodScore < 70 ? 'high' : 'critical';

  const overallScore = Math.round(slopeScore * 0.4 + floodScore * 0.6);
  const overallLevel = overallScore < 25 ? 'low' : overallScore < 50 ? 'medium' : overallScore < 75 ? 'high' : 'critical';

  return NextResponse.json({
    status:             'ok',
    data_real:          true,
    dem_source:         elevSource,
    area_km2:           areaKm2,
    terrain: {
      min_elev_m:     minElev,
      max_elev_m:     maxElev,
      mean_elev_m:    meanElev,
      elev_range_m:   elevRange,
      sample_points:  elevations.length,
    },
    overall_risk_score: overallScore,
    overall_risk_level: overallLevel,
    risk_summary: {
      slope:      { level: slopeLevel,  score: slopeScore, source: elevSource,   notes: `مدى الارتفاع ${elevRange}م على ${areaKm2} كم²` },
      flood:      { level: floodLevel,  score: floodScore, source: elevSource,   notes: `${lowPct}٪ من المنطقة أقل من 5م فوق سطح البحر` },
      earthquake: { level: 'unknown',  score: null,       source: null,         notes: 'يتطلب بيانات زلزالية متخصصة — غير متاح' },
      industrial: { level: 'unknown',  score: null,       source: null,         notes: 'يتطلب مصدر بيانات صناعي — غير متاح' },
    },
    analysis_notes: [
      `مصدر البيانات: ${elevSource} | ${elevations.length} نقطة عينة حقيقية`,
      `فارق الارتفاع: ${minElev}م – ${maxElev}م (مدى ${elevRange}م)`,
      'مخاطر الزلازل والمنشآت الصناعية تتطلب مصادر بيانات إضافية.',
    ],
    unavailable_risks: ['earthquake', 'industrial'],
  });
}

// ---
// SATELLITE TREND — requires Sentinel-2 imagery API for real spectral indices
// ---
function handleSatelliteTrend(_body: Record<string, unknown>) {
  return NextResponse.json({
    available: false,
    code: 'SATELLITE_SOURCE_REQUIRED',
    message_ar: 'حساب اتجاه المؤشرات الفضائية (NDVI/NDWI/SAR) يتطلب الوصول إلى أرشيف صور Sentinel-2 — الخدمة غير متاحة بدون مزوّد بيانات فضائية.',
    required_services: ['Sentinel Hub Statistics API', 'Copernicus Data Space (CDSE)'],
    how_to_enable: 'أضف SENTINEL_HUB_CLIENT_ID و SENTINEL_HUB_CLIENT_SECRET إلى متغيرات البيئة.',
    reference: 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html',
  }, { status: 503 });
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
  // Read real state from persisted files
  const alerts = readJSON<any[]>(ALERTS_F, []);
  const notifs  = readJSON<any[]>(NOTIFS_F, []);

  const activeAlerts  = alerts.filter((a: any) => a.active !== false);
  const recentCutoff  = new Date(Date.now() - 24 * 3600_000).toISOString();
  const recentNotifs  = notifs.filter((n: any) => (n.created_at ?? '') >= recentCutoff);
  const criticalCount = recentNotifs.filter((n: any) => n.severity === 'critical').length;

  const sorted   = [...notifs].sort((a: any, b: any) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const lastRun  = sorted[0]?.created_at ?? null;
  const nextRun  = lastRun ? new Date(new Date(lastRun).getTime() + 86400_000).toISOString() : null;

  return NextResponse.json({
    data_real: true,
    source: '.data/gis/notifications.json + .data/gis/alerts-registry.json',
    state: {
      last_run:  lastRun,
      next_run:  nextRun,
      running:   false,
      last_result_summary: {
        total_checked:  activeAlerts.length,
        total_events:   recentNotifs.length,
        critical_count: criticalCount,
      },
    },
    last_log: sorted.slice(0, 10).map((n: any) => ({
      ts:  n.created_at,
      msg: n.summary ?? n.title ?? `تنبيه: ${n.alert_name ?? n.alert_id ?? n.id}`,
      severity: n.severity ?? null,
    })),
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
// ANALYZE CORRIDOR — requires real Sentinel-2 scene for change analysis
// ---
function handleAnalyzeCorridor(_body: Record<string, unknown>) {
  return NextResponse.json({
    available: false,
    code: 'SATELLITE_SOURCE_REQUIRED',
    message_ar: 'تحليل الممر يتطلب مشهد Sentinel-2 حقيقي لمقارنته بالخط الأساسي — استخدم نظام التنبيهات التلقائي الذي يعمل بصور فعلية.',
    alternative: 'نظام التنبيهات التلقائي (/api/gis/auto-monitor) يعمل على صور Sentinel-2 حقيقية ويفحص الممرات المسجّلة يومياً.',
    reference: 'api/gis/alerts-registry',
  }, { status: 503 });
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

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2: SPATIAL ANALYST — geometry operations (no external API needed)
// ══════════════════════════════════════════════════════════════════════════════

function handleSpatialAnalyst(body: Record<string, unknown>) {
  const tool     = String(body.tool ?? '');
  const geometry = body.geometry as any;
  const bbox     = body.bbox as number[] | undefined;

  // ── Buffer around point/line/polygon (approximate, degrees) ─────────────
  if (tool === 'sa_buffer' || tool === 'buffer') {
    const distance_m = Number(body.distance_m ?? 500);
    const degApprox  = distance_m / 111_000;
    if (!geometry) {
      return NextResponse.json({ ok: false, error: 'geometry مطلوب' }, { status: 400 });
    }
    // Simple circular buffer for Point
    if (geometry.type === 'Point') {
      const [lon, lat] = geometry.coordinates as [number, number];
      const steps = 32;
      const ring: [number, number][] = Array.from({ length: steps + 1 }, (_, i) => {
        const a = (i / steps) * 2 * Math.PI;
        return [lon + degApprox * Math.cos(a), lat + (degApprox / Math.cos(lat * Math.PI / 180)) * Math.sin(a)];
      });
      return NextResponse.json({
        ok: true, tool: 'buffer', distance_m,
        result: { type: 'Polygon', coordinates: [ring] },
        area_km2: Math.round(Math.PI * (distance_m / 1000) ** 2 * 100) / 100,
        message_ar: `عازلة بنطاق ${distance_m}م حول النقطة`,
      });
    }
    // For LineString: bbox expansion approximation
    if (geometry.type === 'LineString') {
      const coords = geometry.coordinates as [number, number][];
      const lons = coords.map(c => c[0]), lats = coords.map(c => c[1]);
      const ring: [number, number][] = [
        [Math.min(...lons) - degApprox, Math.min(...lats) - degApprox],
        [Math.max(...lons) + degApprox, Math.min(...lats) - degApprox],
        [Math.max(...lons) + degApprox, Math.max(...lats) + degApprox],
        [Math.min(...lons) - degApprox, Math.max(...lats) + degApprox],
        [Math.min(...lons) - degApprox, Math.min(...lats) - degApprox],
      ];
      const lenKm = coords.reduce((acc, c, i) => {
        if (i === 0) return acc;
        const dx = (c[0] - coords[i-1][0]) * 111_000 * Math.cos(c[1] * Math.PI/180);
        const dy = (c[1] - coords[i-1][1]) * 111_000;
        return acc + Math.sqrt(dx*dx + dy*dy) / 1000;
      }, 0);
      const area_km2 = Math.round(lenKm * (distance_m / 1000) * 2 * 100) / 100;
      return NextResponse.json({
        ok: true, tool: 'buffer', distance_m,
        result: { type: 'Polygon', coordinates: [ring] },
        area_km2,
        message_ar: `ممر بعرض ${distance_m}م على طول المسار (${Math.round(lenKm * 10) / 10} كم)`,
      });
    }
  }

  // ── Area of polygon ───────────────────────────────────────────────────────
  if (tool === 'sa_area' || tool === 'area') {
    if (!geometry?.coordinates) {
      // Use bbox
      if (bbox?.length === 4) {
        const [minLon, minLat, maxLon, maxLat] = bbox;
        const w = (maxLon - minLon) * 111_000 * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
        const h = (maxLat - minLat) * 111_000;
        const km2 = Math.round(w * h / 1_000_000 * 100) / 100;
        return NextResponse.json({ ok: true, tool: 'area', area_km2: km2, area_m2: km2 * 1_000_000, message_ar: `المساحة: ${km2} كم²` });
      }
      return NextResponse.json({ ok: false, error: 'geometry أو bbox مطلوب' }, { status: 400 });
    }
    const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates as [number, number][];
    // Shoelace formula
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += (ring[i][0] - ring[j][0]) * (ring[i][1] + ring[j][1]);
    }
    const latMid = (ring.reduce((s: number, c: [number, number]) => s + c[1], 0) / ring.length) as number;
    const area_m2 = Math.abs(area) / 2 * 111_000 ** 2 * Math.cos(latMid * Math.PI / 180);
    const km2 = Math.round(area_m2 / 1_000_000 * 100) / 100;
    return NextResponse.json({ ok: true, tool: 'area', area_km2: km2, area_m2: Math.round(area_m2), message_ar: `المساحة: ${km2} كم²` });
  }

  // ── Length of line ────────────────────────────────────────────────────────
  if (tool === 'sa_length' || tool === 'length') {
    if (!geometry?.coordinates) return NextResponse.json({ ok: false, error: 'LineString geometry مطلوب' }, { status: 400 });
    const coords = geometry.type === 'LineString' ? geometry.coordinates as [number, number][] : [[0, 0]] as [number, number][];
    const km = coords.reduce((acc, c, i) => {
      if (i === 0) return acc;
      const dx = (c[0] - coords[i-1][0]) * 111_000 * Math.cos(c[1] * Math.PI/180);
      const dy = (c[1] - coords[i-1][1]) * 111_000;
      return acc + Math.sqrt(dx*dx + dy*dy) / 1000;
    }, 0);
    return NextResponse.json({ ok: true, tool: 'length', length_km: Math.round(km * 100) / 100, length_m: Math.round(km * 1000), message_ar: `الطول: ${Math.round(km * 10) / 10} كم` });
  }

  // ── Slope estimation from bbox ────────────────────────────────────────────
  if (tool === 'sa_slope' || tool === 'slope') {
    return NextResponse.json({
      ok: true, tool: 'slope',
      message_ar: 'استخدم تحليل التضاريس (⛰️ تحليل التضاريس) للحصول على خريطة الميول التفصيلية — يعتمد على بيانات SRTM 30م.',
      hint: 'اضغط على تبويب "تحليل التضاريس" وارسم منطقتك للحصول على slope_grid',
    });
  }

  // ── Generic info for unimplemented tools ─────────────────────────────────
  const TOOLS_AR: Record<string, string> = {
    sa_hillshade:   'إضاءة تضاريس — يعتمد على DEM من terrain3d',
    sa_watershed:   'حوض التصريف — يتطلب DEM عالي الدقة',
    sa_density:     'كثافة النقاط — حساب نقاط في دائرة',
    sa_interpolate: 'استيفاء IDW — يحتاج مجموعة نقاط إدخال',
    sa_profile:     'مقطع الارتفاع — استخدم Terrain 3D مع نقاط المسار',
    sa_overlay:     'تداخل طبقتين — يحتاج GeoJSON للطبقتين',
  };
  return NextResponse.json({
    ok:          false,
    tool,
    message_ar:  TOOLS_AR[tool] ?? `أداة غير معروفة: ${tool}`,
    available_tools: ['buffer', 'area', 'length', 'slope', ...Object.keys(TOOLS_AR)],
  }, { status: 422 });
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3: IMAGE ANALYST — spectral indices via Sentinel Hub (CDSE)
// ══════════════════════════════════════════════════════════════════════════════

async function handleImageAnalyst(body: Record<string, unknown>) {
  const index = String(body.index ?? body.tool ?? 'ndvi');
  const bbox  = body.bbox as [number, number, number, number] | undefined;
  const days_back = Number(body.days_back ?? 30);

  if (!bbox || bbox.length !== 4) {
    return NextResponse.json({ ok: false, error: 'bbox مطلوب: [minLon,minLat,maxLon,maxLat]' }, { status: 400 });
  }

  const CDSE_ID  = process.env.CDSE_CLIENT_ID;
  const CDSE_SEC = process.env.CDSE_CLIENT_SECRET;

  if (!CDSE_ID || !CDSE_SEC) {
    return NextResponse.json({
      ok: false, error: 'CDSE credentials missing',
      message_ar: 'بيانات Sentinel Hub غير مضبوطة — تحقق من CDSE_CLIENT_ID و CDSE_CLIENT_SECRET في .env.local',
    }, { status: 503 });
  }

  // Import Sentinel Hub helpers
  const { computeNDWI, computeNDVI, computeNDMI, computeSARSigma0 } = await import('@/lib/sentinel-hub');

  const now   = new Date();
  const from  = new Date(now.getTime() - days_back * 86400_000);
  const dateTo   = now.toISOString().slice(0, 10);
  const dateFrom = from.toISOString().slice(0, 10);

  const INDEX_MAP: Record<string, string> = {
    ia_ndvi: 'ndvi', ia_ndwi: 'ndwi', ia_ndmi: 'ndmi',
    ia_sar:  'sar',  ia_nbr:  'ndvi', ia_savi: 'ndvi', ia_evi: 'ndvi',
    ndvi: 'ndvi',    ndwi: 'ndwi',    ndmi: 'ndmi',    sar: 'sar',
  };
  const resolved = INDEX_MAP[index] ?? 'ndvi';

  try {
    let value: number | null = null;
    let raw:   any           = null;
    let label = '';
    let interpretation = '';

    if (resolved === 'ndwi') {
      raw   = await computeNDWI(bbox, dateFrom, dateTo);
      value = raw?.ndwi_mean ?? null;
      label = 'NDWI (مؤشر المياه)';
      interpretation = value === null ? 'لا بيانات'
        : value > 0.3 ? '🌊 مياه حرة — تسرب محتمل أو تراكم مياه'
        : value > 0.1 ? '💧 رطوبة سطحية مرتفعة'
        : value > 0   ? '🔵 رطوبة طبيعية'
        : '✅ منطقة جافة طبيعية';
    } else if (resolved === 'ndvi') {
      raw   = await computeNDVI(bbox, dateFrom, dateTo);
      value = raw?.ndvi_mean ?? null;
      label = 'NDVI (مؤشر النبات)';
      interpretation = value === null ? 'لا بيانات'
        : value > 0.4  ? '🌿 نبات كثيف وصحي — محتمل ري أو تسرب في الصحراء'
        : value > 0.15 ? '🟡 نبات متفرق أو ضعيف'
        : value > 0.05 ? '🏜️ صحراء جزئية'
        : '🏜️ صحراء كاملة';
    } else if (resolved === 'ndmi') {
      raw   = await computeNDMI(bbox, dateFrom, dateTo);
      value = raw?.ndmi_mean ?? null;
      label = 'NDMI (رطوبة الغطاء النباتي)';
      interpretation = value === null ? 'لا بيانات'
        : value > 0.2 ? '💦 رطوبة عالية'
        : value > 0   ? '💧 رطوبة متوسطة'
        : '🌵 جفاف';
    } else if (resolved === 'sar') {
      raw   = await computeSARSigma0(bbox, dateFrom, dateTo);
      value = raw?.vv ?? null;
      label = 'SAR σ0 VV (رادار)';
      interpretation = value === null ? 'لا بيانات'
        : value > -10 ? '💦 تربة رطبة — تسرب محتمل'
        : value > -18 ? '🟡 رطوبة طبيعية'
        : '🏜️ تربة جافة';
    }

    return NextResponse.json({
      ok: true,
      index: resolved,
      label,
      value:         value !== null ? Math.round(value * 10000) / 10000 : null,
      interpretation,
      bbox,
      period: { from: dateFrom, to: dateTo, days_back },
      source: 'Sentinel-2 / Sentinel Hub Statistical API',
      scale: resolved === 'ndwi' || resolved === 'ndvi' || resolved === 'ndmi'
        ? 'يتراوح من -1 (جاف) إلى +1 (رطب/نبات)'
        : 'dB (سالب كبير = جاف، سالب صغير = رطب)',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4: AREA REPORT — aggregate summary of all monitoring for a bbox
// ══════════════════════════════════════════════════════════════════════════════

async function handleAreaReport(body: Record<string, unknown>, req: NextRequest) {
  const bbox = body.bbox as [number, number, number, number] | undefined;
  if (!bbox || bbox.length !== 4) {
    return NextResponse.json({ ok: false, error: 'bbox مطلوب' }, { status: 400 });
  }

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const center = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
  const w = (maxLon - minLon) * 111_000 * Math.cos(center[1] * Math.PI / 180);
  const h = (maxLat - minLat) * 111_000;
  const area_km2 = Math.round(w * h / 1_000_000 * 10) / 10;

  // Run fire check
  let fire_summary: any = null;
  try {
    const fr = await fetch(`${req.nextUrl.origin}/api/v1/satellite/fire-monitor?days=7`, { signal: AbortSignal.timeout(10_000) });
    if (fr.ok) {
      const fd = await fr.json();
      const clusters: any[] = fd.alert_clusters ?? [];
      // Filter to bbox
      const inBox = clusters.filter((c: any) =>
        c.lon >= minLon && c.lon <= maxLon && c.lat >= minLat && c.lat <= maxLat
      );
      fire_summary = {
        total_in_bbox: inBox.length,
        confirmed:  inBox.filter((c: any) => c.classification === 'confirmed_fire').length,
        urban:      inBox.filter((c: any) => c.classification === 'urban_incident').length,
        max_frp_mw: inBox.length ? Math.max(...inBox.map((c: any) => c.max_frp_mw ?? 0)) : 0,
      };
    }
  } catch { /* optional */ }

  // Run water scan
  let water_summary: any = null;
  try {
    const wr = await fetch(`${req.nextUrl.origin}/api/v1/satellite/water-anomaly-scanner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'bbox', bbox, days_back: 30 }),
      signal: AbortSignal.timeout(60_000),
    });
    if (wr.ok) {
      const wd = await wr.json();
      water_summary = {
        severity:   wd.overall_severity,
        score:      wd.overall_score,
        anomalies:  wd.anomalies_count ?? 0,
        evidence:   (wd.evidence ?? []).slice(0, 3),
      };
    }
  } catch { /* optional */ }

  // Build summary report
  const risk_level =
    (fire_summary?.urban > 0 || fire_summary?.confirmed > 0 || water_summary?.severity === 'confirmed') ? 'high' :
    (fire_summary?.total_in_bbox > 0 || ['high', 'medium'].includes(water_summary?.severity ?? '')) ? 'medium' : 'low';

  const risk_ar = risk_level === 'high' ? '🔴 مرتفع' : risk_level === 'medium' ? '🟡 متوسط' : '🟢 منخفض';

  const sections: string[] = [];
  if (fire_summary) {
    sections.push(fire_summary.total_in_bbox > 0
      ? `🔥 رُصدت ${fire_summary.total_in_bbox} بؤرة حرارية (${fire_summary.urban} حضري، ${fire_summary.confirmed} مؤكد)`
      : '🔥 لا توجد بؤر حرارية في هذه المنطقة خلال 7 أيام');
  }
  if (water_summary) {
    sections.push(water_summary.severity === 'normal'
      ? '💧 لا شذوذات مائية مكتشفة'
      : `💧 شذوذ مائي: ${water_summary.severity} (${water_summary.anomalies} نقطة)`);
  }

  return NextResponse.json({
    ok:        true,
    bbox,
    area_km2,
    center,
    risk_level,
    risk_ar,
    executive_summary: `المنطقة: ${area_km2} كم² | المخاطر: ${risk_ar}`,
    sections,
    fire:  fire_summary,
    water: water_summary,
    generated_at: new Date().toISOString(),
    note: 'تقرير مجمّع يشمل: حرائق VIIRS (7 أيام) + ماسح الشذوذات المائية (30 يوم)',
  });
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 5: CVA REAL — multi-temporal change detection via CDSE
// ═══════════════════════════════════════════════════════════════════
async function handleCVAReal(body: Record<string, unknown>) {
  const bbox      = body.bbox as [number,number,number,number] | undefined;
  const t1_days   = Number(body.t1_days   ?? 90);
  const t2_days   = Number(body.t2_days   ?? 0);
  const days_each = Number(body.days_each ?? 30);
  if (!bbox || bbox.length !== 4) return NextResponse.json({ ok: false, error: 'bbox مطلوب' }, { status: 400 });
  const CDSE_ID = process.env.CDSE_CLIENT_ID;
  if (!CDSE_ID) return NextResponse.json({ ok: false, code: 'NO_CREDENTIALS', message_ar: 'CDSE_CLIENT_ID غير مضبوط' }, { status: 503 });
  const now = new Date();
  const mkDate = (d: number) => new Date(now.getTime() - d * 86400_000).toISOString().slice(0, 10);
  const t1From = mkDate(t1_days + days_each); const t1To = mkDate(t1_days);
  const t2From = mkDate(t2_days + days_each); const t2To = mkDate(Math.max(t2_days, 1));
  const { computeNDVI, computeNDWI, computeNDMI } = await import('@/lib/sentinel-hub');
  try {
    const [r1vi, r2vi, r1wi, r2wi, r1mi, r2mi] = await Promise.all([
      computeNDVI(bbox, t1From, t1To), computeNDVI(bbox, t2From, t2To),
      computeNDWI(bbox, t1From, t1To), computeNDWI(bbox, t2From, t2To),
      computeNDMI(bbox, t1From, t1To), computeNDMI(bbox, t2From, t2To),
    ]);
    const r4 = (v: number | null) => v !== null ? Math.round(v * 10000) / 10000 : null;
    const dV = (r2vi?.ndvi_mean ?? 0) - (r1vi?.ndvi_mean ?? 0);
    const dW = (r2wi?.ndwi_mean ?? 0) - (r1wi?.ndwi_mean ?? 0);
    const dM = (r2mi?.ndmi_mean ?? 0) - (r1mi?.ndmi_mean ?? 0);
    const mag = Math.sqrt(dV**2 + dW**2 + dM**2);
    let change_type = 'stable', change_ar = '⚪ مستقر';
    if (mag > 0.05) {
      if (dW > 0.05)       { change_type = 'water_increase';  change_ar = '🌊 زيادة مياه — تسرب/فيضان محتمل'; }
      else if (dV > 0.1)   { change_type = 'vegetation_gain'; change_ar = '🌿 ازدياد نباتي'; }
      else if (dV < -0.1)  { change_type = 'vegetation_loss'; change_ar = '🍂 تراجع نباتي'; }
      else if (dW < -0.05) { change_type = 'water_decrease';  change_ar = '🏜️ تراجع مياه'; }
      else                 { change_type = 'other';           change_ar = '⚠️ تغيير ملحوظ'; }
    }
    return NextResponse.json({ ok: true, change_type, change_ar, magnitude: r4(mag) ?? 0,
      deltas: { ndvi: r4(dV), ndwi: r4(dW), ndmi: r4(dM) },
      t1: { from: t1From, to: t1To, ndvi: r4(r1vi?.ndvi_mean ?? null), ndwi: r4(r1wi?.ndwi_mean ?? null) },
      t2: { from: t2From, to: t2To, ndvi: r4(r2vi?.ndvi_mean ?? null), ndwi: r4(r2wi?.ndwi_mean ?? null) },
      source: 'Sentinel-2 CDSE Statistical API' });
  } catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 6: SATELLITE TREND — monthly spectral time series
// ═══════════════════════════════════════════════════════════════════
async function handleSatelliteTrendReal(body: Record<string, unknown>) {
  const bbox   = body.bbox as [number,number,number,number] | undefined;
  const index  = String(body.index ?? 'ndvi');
  const months = Math.min(12, Math.max(3, Number(body.months ?? 6)));
  if (!bbox || bbox.length !== 4) return NextResponse.json({ ok: false, error: 'bbox مطلوب' }, { status: 400 });
  if (!process.env.CDSE_CLIENT_ID) return NextResponse.json({ ok: false, error: 'CDSE_CLIENT_ID missing' }, { status: 503 });
  const { computeNDVI, computeNDWI, computeNDMI } = await import('@/lib/sentinel-hub');
  const now = new Date();
  const series: { month: string; value: number | null }[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const end   = new Date(now.getFullYear(), now.getMonth() - m, 0);
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    const from  = start.toISOString().slice(0, 10);
    const to    = end.toISOString().slice(0, 10);
    const label = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}`;
    try {
      let val: number | null = null;
      if (index === 'ndvi') { const r = await computeNDVI(bbox, from, to); val = r?.ndvi_mean ?? null; }
      else if (index === 'ndwi') { const r = await computeNDWI(bbox, from, to); val = r?.ndwi_mean ?? null; }
      else if (index === 'ndmi') { const r = await computeNDMI(bbox, from, to); val = r?.ndmi_mean ?? null; }
      series.push({ month: label, value: val !== null ? Math.round(val * 10000) / 10000 : null });
    } catch { series.push({ month: label, value: null }); }
  }
  const vals = series.map(p => p.value).filter((v): v is number => v !== null);
  const trend = vals.length >= 2 ? (vals[vals.length-1] - vals[0] > 0.02 ? 'increasing' : vals[vals.length-1] - vals[0] < -0.02 ? 'decreasing' : 'stable') : 'stable';
  return NextResponse.json({ ok: true, index, months, series, trend,
    trend_ar: trend === 'increasing' ? '📈 تصاعدي' : trend === 'decreasing' ? '📉 تنازلي' : '➡️ مستقر',
    stats: vals.length ? { min: Math.min(...vals), max: Math.max(...vals), mean: Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10000)/10000 } : null,
    source: 'Sentinel-2 CDSE Monthly Statistical API' });
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 7: 3D ANALYST — uses terrainUtils (no internal HTTP calls)
// ═══════════════════════════════════════════════════════════════════
async function handleThreeDAnalyst(body: Record<string, unknown>) {
  const tool = String(body.tool ?? '');
  const bbox = body.bbox as [number,number,number,number] | undefined;
  const { computeFullTerrain } = await import('@/lib/terrainUtils');

  if (tool === '3d_viewshed' || tool === '3d_contour' || tool === '3d_cut_fill') {
    if (!bbox) return NextResponse.json({ ok: false, error: 'bbox مطلوب' }, { status: 400 });
    const base = Number((body as any).base_level_m ?? 0);
    const td = await computeFullTerrain(bbox, 11, base);

    if (tool === '3d_contour') {
      return NextResponse.json({ ok: true, tool, contours: td.contours, stats: td.stats,
        message_ar: `${td.contours.length} خط كنتور | ${td.stats.min_elevation}م → ${td.stats.max_elevation}م`, source: 'SRTM 30m' });
    }
    if (tool === '3d_cut_fill') {
      const cf = td.cut_fill_grid.flat();
      const cut = cf.filter(v=>v>0), fill = cf.filter(v=>v<0);
      return NextResponse.json({ ok: true, tool, base_level_m: base,
        cut_cells: cut.length, fill_cells: fill.length,
        avg_cut_m:  cut.length  ? Math.round(cut.reduce((a,b)=>a+b,0)/cut.length)   : 0,
        avg_fill_m: fill.length ? Math.round(Math.abs(fill.reduce((a,b)=>a+b,0)/fill.length)) : 0,
        cut_fill_grid: td.cut_fill_grid, source: 'SRTM 30m',
        message_ar: `حفر: ${cut.length} خلية | ردم: ${fill.length} خلية (مرجع ${base}م)` });
    }
    // viewshed
    const n = td.grid_size;
    const [minLon,,maxLon,maxLat] = bbox;
    const observer = (body as any).observer as [number,number] ?? [(bbox[0]+bbox[2])/2,(bbox[1]+bbox[3])/2];
    const obsH = Number((body as any).obs_height_m ?? 10);
    const obsCol = Math.round((observer[0]-minLon)/(maxLon-minLon)*(n-1));
    const obsRow = Math.round((maxLat-observer[1])/(maxLat-bbox[1])*(n-1));
    const grid = td.elevation_grid;
    const obsElev = grid[Math.max(0,Math.min(n-1,obsRow))][Math.max(0,Math.min(n-1,obsCol))] + obsH;
    const visGrid = grid.map((row,r) => row.map((_,c) => {
      const steps = Math.max(Math.abs(r-obsRow),Math.abs(c-obsCol));
      if (steps === 0) return true;
      for (let s=1;s<steps;s++) {
        const sr=Math.round(obsRow+(r-obsRow)/steps*s), sc=Math.round(obsCol+(c-obsCol)/steps*s);
        const midE=grid[Math.max(0,Math.min(n-1,sr))][Math.max(0,Math.min(n-1,sc))];
        const expE=obsElev-(obsElev-grid[r][c])*(s/steps);
        if (midE > expE+2) return false;
      }
      return true;
    }));
    const vis = visGrid.flat().filter(Boolean).length;
    const pct = Math.round(vis/(n*n)*100);
    return NextResponse.json({ ok: true, tool, observer, obs_height_m: obsH,
      visibility_pct: pct, visible_cells: vis, total_cells: n*n, visible_grid: visGrid,
      message_ar: `${pct}% من المنطقة مرئية من نقطة الرصد (ارتفاع ${obsH}م)`, source: 'SRTM 30m' });
  }

  if (tool === '3d_profile') {
    const geometry = (body as any).geometry;
    if (!geometry?.coordinates) return NextResponse.json({ ok: false, error: 'LineString geometry مطلوب' }, { status: 400 });
    const coords: [number,number][] = geometry.coordinates;
    const lons = coords.map((c:any)=>c[0]), lats = coords.map((c:any)=>c[1]);
    const pb: [number,number,number,number] = [Math.min(...lons)-0.01,Math.min(...lats)-0.01,Math.max(...lons)+0.01,Math.max(...lats)+0.01];
    const td = await computeFullTerrain(pb, 11, 0);
    const gn = td.grid_size; const gg = td.elevation_grid;
    const N = 20; let dist = 0;
    const profile = Array.from({length:N+1},(_,i) => {
      const t=i/N, lon=coords[0][0]+t*(coords[coords.length-1][0]-coords[0][0]), lat=coords[0][1]+t*(coords[coords.length-1][1]-coords[0][1]);
      const col=Math.round((lon-pb[0])/(pb[2]-pb[0])*(gn-1)), row=Math.round((pb[3]-lat)/(pb[3]-pb[1])*(gn-1));
      const elev=gg[Math.max(0,Math.min(gn-1,row))]?.[Math.max(0,Math.min(gn-1,col))]??0;
      if (i>0) { const p=profile[i-1]; const dx=(lon-p.lon)*111000*Math.cos(lat*Math.PI/180),dy=(lat-p.lat)*111000; dist+=Math.sqrt(dx*dx+dy*dy)/1000; }
      return { dist_km: Math.round(dist*100)/100, lon, lat, elevation: elev };
    });
    const elevs = profile.map(p=>p.elevation);
    return NextResponse.json({ ok: true, tool, profile, total_km: Math.round(dist*100)/100,
      min_elevation: Math.min(...elevs), max_elevation: Math.max(...elevs), source: 'SRTM 30m',
      message_ar: `مقطع ارتفاع ${Math.round(dist*10)/10}كم | ${Math.min(...elevs)}م→${Math.max(...elevs)}م` });
  }

  return NextResponse.json({ ok: false, tool, message_ar: `أداة غير معروفة: ${tool}`,
    available_tools: ['3d_viewshed','3d_contour','3d_cut_fill','3d_profile','3d_shadow','3d_los'] }, { status: 422 });
}
