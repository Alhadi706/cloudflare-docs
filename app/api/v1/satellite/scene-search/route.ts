/**
 * POST /api/v1/satellite/scene-search
 * ─────────────────────────────────────
 * Real satellite scene search via Copernicus CDSE STAC + Element84 Earth Search.
 * No authentication required — all sources are public metadata APIs.
 *
 * Body:
 *   bbox        [minLon, minLat, maxLon, maxLat]   required
 *   date_from   'YYYY-MM-DD'                        required
 *   date_to     'YYYY-MM-DD'                        required
 *   collections string[]  default: ['sentinel-2-l2a','sentinel-1-grd']
 *   max_cloud   number    default: 80 (Sentinel-2 only)
 *   limit       number    default: 20
 *
 * Response:
 *   { scenes, total, query_ms, sources_tried, data_real: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchSTAC, today, daysAgo } from '@/lib/stac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_COLLECTIONS = ['sentinel-2-l2a', 'sentinel-1-grd'];

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Validate bbox ────────────────────────────────────────────────────────
  const rawBbox = body.bbox;
  if (!Array.isArray(rawBbox) || rawBbox.length !== 4 || rawBbox.some(v => typeof v !== 'number')) {
    return NextResponse.json(
      { detail: 'bbox يجب أن يكون مصفوفة من 4 أرقام [minLon, minLat, maxLon, maxLat]' },
      { status: 400 }
    );
  }
  const bbox = rawBbox as [number, number, number, number];

  // ── Dates ────────────────────────────────────────────────────────────────
  const date_from = (body.date_from as string) || daysAgo(90);
  const date_to   = (body.date_to   as string) || today();

  // Validate date range
  const daysDiff = Math.round(
    (new Date(date_to).getTime() - new Date(date_from).getTime()) / 86400000
  );
  if (daysDiff < 0) {
    return NextResponse.json({ detail: 'date_from يجب أن يكون قبل date_to' }, { status: 400 });
  }
  if (daysDiff > 730) {
    return NextResponse.json({ detail: 'النطاق الزمني لا يتجاوز 730 يوماً' }, { status: 400 });
  }

  const collections = Array.isArray(body.collections) && body.collections.length > 0
    ? body.collections as string[]
    : DEFAULT_COLLECTIONS;

  const max_cloud = typeof body.max_cloud === 'number' ? body.max_cloud : 80;
  const limit     = Math.min(typeof body.limit === 'number' ? body.limit : 20, 100);

  // ── Query ────────────────────────────────────────────────────────────────
  const t0 = Date.now();
  let scenes = [];
  let error_detail: string | null = null;

  try {
    scenes = await searchSTAC({ bbox, date_from, date_to, collections, max_cloud, limit });
  } catch (err) {
    error_detail = err instanceof Error ? err.message : String(err);
  }

  const query_ms = Date.now() - t0;

  // ── Group by collection for summary ─────────────────────────────────────
  const by_collection: Record<string, number> = {};
  for (const s of scenes) {
    by_collection[s.collection] = (by_collection[s.collection] ?? 0) + 1;
  }

  return NextResponse.json({
    data_real:   true,
    status:      error_detail ? 'partial' : 'ok',
    total:       scenes.length,
    query_ms,
    query: {
      bbox, date_from, date_to, collections, max_cloud, limit,
      days_range: daysDiff,
    },
    by_collection,
    sources_tried: ['cdse_stac', 'element84_stac'],
    scenes,
    ...(error_detail ? { warning: error_detail } : {}),
  });
}

/** GET — quick status / capability check */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    endpoint:   'POST /api/v1/satellite/scene-search',
    data_real:  true,
    sources: [
      {
        id:          'cdse_stac',
        name:        'Copernicus Data Space Ecosystem STAC',
        url:         'https://catalogue.dataspace.copernicus.eu/stac/search',
        auth:        false,
        collections: ['sentinel-2-l2a', 'sentinel-1-grd', 'sentinel-5p-l2'],
        extras:      'SCL statistics (vegetation%, water%, not_vegetated%)',
      },
      {
        id:          'element84_stac',
        name:        'Element84 Earth Search',
        url:         'https://earth-search.aws.element84.com/v1/search',
        auth:        false,
        collections: ['sentinel-2-l2a', 'landsat-c2-l2'],
        extras:      'Public COG band assets (no auth needed for Landsat)',
      },
    ],
    body_schema: {
      bbox:        '[minLon, minLat, maxLon, maxLat]  required',
      date_from:   "'YYYY-MM-DD'  default: 90 days ago",
      date_to:     "'YYYY-MM-DD'  default: today",
      collections: "string[]  default: ['sentinel-2-l2a','sentinel-1-grd']",
      max_cloud:   'number 0-100  default: 80',
      limit:       'number 1-100  default: 20',
    },
  });
}
