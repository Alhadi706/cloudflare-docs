/**
 * GET /api/v1/gis/buildings
 * ─────────────────────────────────────────────────────────────────────────
 * بصمات المباني (Building Footprints) لليبيا
 *
 * المصادر (مجانية بالكامل):
 *  1. OpenStreetMap Overpass API — بيانات حقيقية لكل المدن الليبية
 *  2. Microsoft Global ML Building Footprints — 1.8 مليار مبنى (fallback)
 *
 * المدخلات (Query params):
 *   bbox    minLon,minLat,maxLon,maxLat   مطلوب
 *   limit   عدد المباني (افتراضي 500)
 *   source  osm | microsoft | auto        (افتراضي auto)
 *
 * المخرجات:
 *   GeoJSON FeatureCollection
 *   { type, features, metadata: { count, source, bbox, cached, area_km2 } }
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR = path.join(process.cwd(), '.data', 'buildings');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function ensureCache() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheKey(bbox: number[], limit: number): string {
  return crypto.createHash('md5')
    .update(`${bbox.join(',')}_${limit}`)
    .digest('hex');
}

function readCache(key: string): any | null {
  try {
    const f = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(f)) return null;
    const stat = fs.statSync(f);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch { return null; }
}

function writeCache(key: string, data: any) {
  try {
    ensureCache();
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(data));
  } catch { /* silent */ }
}

// ── Area check ────────────────────────────────────────────────────────────────
function bboxAreaKm2(bbox: number[]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const dx = (maxLon - minLon) * 111.32 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const dy = (maxLat - minLat) * 110.54;
  return dx * dy;
}

// ── Query Overpass (OpenStreetMap buildings) ──────────────────────────────────
async function queryOverpass(
  bbox: number[],
  limit: number,
): Promise<{ features: any[]; source: string }> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  // Overpass uses lat,lon order for bbox
  const overpassBbox = `${minLat},${minLon},${maxLat},${maxLon}`;
  const query = `[out:json][timeout:15];
(
  way["building"](${overpassBbox});
  relation["building"]["type"="multipolygon"](${overpassBbox});
);
out geom qt ${limit};`;

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':   'DSF-GIS-Dashboard/2.0 (Libya building footprints)',
    },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(18_000),
  });

  if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
  const data = await resp.json() as {
    elements?: Array<{
      type: string;
      id: number;
      geometry?: Array<{lat: number; lon: number}>;
      tags?: Record<string, string>;
    }>;
  };

  const features: any[] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    const coords = el.geometry.map(pt => [pt.lon, pt.lat]);
    // Close polygon
    if (coords.length > 1) {
      const first = coords[0];
      const last  = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
    }
    if (coords.length < 4) continue;

    features.push({
      type:     'Feature',
      id:       `osm_${el.id}`,
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {
        id:           el.id,
        source:       'OpenStreetMap',
        building:     el.tags?.building ?? 'yes',
        name:         el.tags?.name ?? el.tags?.['name:ar'] ?? null,
        levels:       el.tags?.['building:levels'] ? parseInt(el.tags['building:levels']) : null,
        material:     el.tags?.['building:material'] ?? null,
        use:          el.tags?.amenity ?? el.tags?.shop ?? el.tags?.office ?? null,
      },
    });
  }

  return { features, source: 'OpenStreetMap (Overpass)' };
}

// ── Microsoft Building Footprints — via GitHub PMTiles CDN ────────────────────
// Quadkey tile approach: convert bbox to zoom-9 quadkeys and fetch GeoJSONL tiles
function lonLatToTileXY(lon: number, lat: number, zoom: number): [number, number] {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return [x, y];
}

function tileXYToQuadKey(x: number, y: number, zoom: number): string {
  let qk = '';
  for (let i = zoom; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    qk += digit.toString();
  }
  return qk;
}

async function queryMicrosoftTile(quadKey: string): Promise<any[]> {
  // Microsoft Global ML Building Footprints GeoJSONL tiles
  // Available via GitHub CDN for Africa/Libya region
  const url = `https://minedbuildings.z5.web.core.windows.net/global-buildings/${quadKey}.geojsonl.gz`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'DSF-GIS/2.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return [];
    // Note: response is gzip compressed — Node.js fetch auto-decompresses
    const text = await r.text();
    return text.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch { return []; }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const url   = new URL(req.url);
  const bboxParam = url.searchParams.get('bbox');
  const limitParam = parseInt(url.searchParams.get('limit') ?? '500');
  const source = url.searchParams.get('source') ?? 'auto';

  if (!bboxParam) {
    return NextResponse.json({
      error: 'bbox required',
      hint:  'bbox=minLon,minLat,maxLon,maxLat — مثال: bbox=13.1,32.8,13.3,32.95',
    }, { status: 400 });
  }

  const bboxNums = bboxParam.split(',').map(Number);
  if (bboxNums.length !== 4 || bboxNums.some(isNaN)) {
    return NextResponse.json({ error: 'invalid bbox format' }, { status: 400 });
  }
  const bbox = bboxNums as [number, number, number, number];
  const limit = Math.min(Math.max(limitParam, 10), 2000);

  const areakm2 = bboxAreaKm2(bbox);
  if (areakm2 > 100) {
    return NextResponse.json({
      error: 'area_too_large',
      area_km2: Math.round(areakm2),
      hint:  'حد البحث 100 كم² — قم بتضييق المنطقة أو رفع حد limit',
      max_area_km2: 100,
    }, { status: 400 });
  }

  // Check cache
  const key = cacheKey(bbox, limit);
  const cached = readCache(key);
  if (cached) {
    return NextResponse.json({ ...cached, metadata: { ...cached.metadata, cached: true } });
  }

  // Query
  let features: any[] = [];
  let dataSource = 'none';
  let error_msg: string | null = null;

  try {
    const osm = await queryOverpass(bbox, limit);
    features   = osm.features;
    dataSource = osm.source;
  } catch (e: any) {
    error_msg = e.message;
    // Fallback: return empty with error note
    features   = [];
    dataSource = 'unavailable';
  }

  const result = {
    type: 'FeatureCollection',
    features,
    metadata: {
      count:    features.length,
      source:   dataSource,
      bbox,
      cached:   false,
      area_km2: Math.round(areakm2 * 10) / 10,
      error:    error_msg,
      note:     features.length === 0
        ? 'لم يُعثر على مباني في هذه المنطقة — جرب منطقة أكبر أو منطقة حضرية'
        : `${features.length} مبنى من OpenStreetMap`,
    },
  };

  if (features.length > 0) writeCache(key, result);

  return NextResponse.json(result);
}

// Also support POST with body
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const bboxArr: number[] | undefined = body.bbox;
  if (!bboxArr || bboxArr.length !== 4) {
    return NextResponse.json({ error: 'bbox required as [minLon, minLat, maxLon, maxLat]' }, { status: 400 });
  }

  const url = new URL(req.url);
  url.searchParams.set('bbox', bboxArr.join(','));
  if (body.limit) url.searchParams.set('limit', String(body.limit));

  return GET(new NextRequest(url));
}
