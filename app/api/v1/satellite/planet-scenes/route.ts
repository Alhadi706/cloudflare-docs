/**
 * GET /api/v1/satellite/planet-scenes
 * بحث عن مشاهد PlanetScope فوق منطقة محددة
 *
 * Query params:
 *   bbox=minLon,minLat,maxLon,maxLat  (إلزامي)
 *   date_from=YYYY-MM-DD              (افتراضي: 30 يوم مضت)
 *   date_to=YYYY-MM-DD                (افتراضي: اليوم)
 *   max_cloud=0-1                     (افتراضي: 0.3)
 *   limit=N                           (افتراضي: 20)
 *   item_type=PSScene|SkySatScene     (افتراضي: PSScene)
 */
import { NextRequest, NextResponse } from 'next/server';

const PLANET_BASE = 'https://api.planet.com/data/v1';

function planetAuth() {
  const key = process.env.PLANET_API_KEY ?? '';
  if (!key) return null;
  const encoded = Buffer.from(`${key}:`).toString('base64');
  return `Basic ${encoded}`;
}

export async function GET(req: NextRequest) {
  const auth = planetAuth();
  if (!auth) {
    return NextResponse.json({ ok: false, error: 'PLANET_API_KEY not configured' }, { status: 503 });
  }

  const url   = req.nextUrl;
  const bbox  = url.searchParams.get('bbox');
  if (!bbox) {
    return NextResponse.json({ ok: false, error: 'bbox required: minLon,minLat,maxLon,maxLat' }, { status: 400 });
  }

  const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
  if ([minLon, minLat, maxLon, maxLat].some(isNaN)) {
    return NextResponse.json({ ok: false, error: 'invalid bbox' }, { status: 400 });
  }

  const now      = new Date();
  const dateTo   = url.searchParams.get('date_to')   ?? now.toISOString().slice(0, 10);
  const dateFrom = url.searchParams.get('date_from') ?? new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
  const maxCloud = parseFloat(url.searchParams.get('max_cloud') ?? '0.3');
  const limit    = Math.min(50, parseInt(url.searchParams.get('limit') ?? '20'));
  const itemType = url.searchParams.get('item_type') ?? 'PSScene';

  const body = {
    item_types: [itemType],
    limit,
    filter: {
      type: 'AndFilter',
      config: [
        {
          type: 'GeometryFilter',
          field_name: 'geometry',
          config: {
            type: 'Polygon',
            coordinates: [[[minLon,minLat],[maxLon,minLat],[maxLon,maxLat],[minLon,maxLat],[minLon,minLat]]],
          },
        },
        {
          type: 'DateRangeFilter',
          field_name: 'acquired',
          config: {
            gte: `${dateFrom}T00:00:00Z`,
            lte: `${dateTo}T23:59:59Z`,
          },
        },
        {
          type: 'RangeFilter',
          field_name: 'cloud_cover',
          config: { lte: maxCloud },
        },
      ],
    },
  };

  try {
    const res = await fetch(`${PLANET_BASE}/quick-search`, {
      method:  'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return NextResponse.json({ ok: false, error: `Planet API ${res.status}: ${err.slice(0, 100)}` }, { status: res.status });
    }

    const data = await res.json();
    const features: any[] = data.features ?? [];

    const scenes = features.map(f => {
      const p = f.properties ?? {};
      const sceneId = f.id;
      return {
        scene_uid:          sceneId,
        acquisition_date:   p.acquired?.slice(0, 10) ?? '',
        acquisition_time:   p.acquired?.slice(11, 16) ?? '',
        cloud_cover_pct:    Math.round((p.cloud_cover ?? 0) * 100),
        satellite_id:       p.satellite_id ?? '',
        pixel_resolution_m: p.pixel_resolution ?? 3,
        item_type:          p.item_type ?? itemType,
        data_is_real:       true,
        source:             'PlanetScope',
        // Thumbnail URL — proxied through our API to add auth
        thumbnail_url:      `/api/v1/satellite/planet-thumbnail?scene_id=${sceneId}&item_type=${p.item_type ?? itemType}`,
        // Direct Planet thumbnail (requires auth header)
        _planet_thumb:      `https://tiles.planet.com/data/v1/item-types/${p.item_type ?? itemType}/items/${sceneId}/thumb`,
        geometry:           f.geometry,
      };
    });

    return NextResponse.json({
      ok:       true,
      total:    scenes.length,
      scenes,
      bbox:     [minLon, minLat, maxLon, maxLat],
      period:   { from: dateFrom, to: dateTo },
      source:   'PlanetScope (Planet Labs)',
      note:     `دقة ${scenes[0]?.pixel_resolution_m ?? 3}م — تغطية يومية`,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
