import { NextRequest, NextResponse } from 'next/server';

// OSM Relation IDs for Libya's 22 municipalities (sha'biyat)
// Sourced from OpenStreetMap admin_level=4 relations
const KEY_TO_OSM_RELATION: Record<string, number> = {
  libya:        192758,
  tripoli:      2060186,
  jafara:       2060176,
  zawiya:       2060189,
  murqub:       3795005,
  nalut:        2060182,
  jabal_gharbi: 2060175,   // جبل نفوسة
  sirte:        2060185,
  jufra:        2060177,
  benghazi:     2060170,
  marj:         2060179,
  jabal_akhdar: 2060174,
  derna:        2060172,
  tobruk:       2060171,   // البطنان district (covers Tobruk)
  wahat:        2060169,
  kufra:        2060178,
  sebha:        2060184,
  ubari:        2060187,   // وادي الحياة district (covers Ubari)
  murzuq:       2060181,
  ghat:         2060173,
  wadi_shati:   2060188,
};

// Approximate bounding boxes for municipalities without OSM relations
const FALLBACK_BBOX: Record<string, number[][]> = {
  misrata: [[14.8, 31.5], [15.7, 31.5], [15.7, 32.5], [14.8, 32.5], [14.8, 31.5]],
  zliten:  [[14.3, 32.0], [14.9, 32.0], [14.9, 32.6], [14.3, 32.6], [14.3, 32.0]],
  beida:   [[21.4, 32.5], [22.1, 32.5], [22.1, 32.9], [21.4, 32.9], [21.4, 32.5]],
};

// In-memory cache (survives for process lifetime)
const geometryCache: Record<string, { name: string; geometry: any }> = {};

function bboxToPolygon(coords: number[][]): any {
  return { type: 'Polygon', coordinates: [coords] };
}

async function fetchByOsmRelation(relationId: number): Promise<{ name: string; geometry: any } | null> {
  const url =
    `https://nominatim.openstreetmap.org/lookup` +
    `?osm_ids=R${relationId}&format=json&polygon_geojson=1`;

  const r = await fetch(url, {
    headers: { 'User-Agent': 'DSF-DigitalDashboard/1.0 (dsf@d-me.ly)' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });

  if (!r.ok) return null;

  const results: any[] = await r.json();
  const hit = results?.[0];

  if (
    !hit?.geojson ||
    (hit.geojson.type !== 'Polygon' && hit.geojson.type !== 'MultiPolygon')
  ) {
    return null;
  }

  return { name: hit.display_name ?? String(relationId), geometry: hit.geojson };
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') ?? '';

  if (!key) {
    return NextResponse.json({ error: 'missing key' }, { status: 400 });
  }

  // Return from cache immediately
  if (geometryCache[key]) {
    return NextResponse.json(geometryCache[key]);
  }

  // Try OSM relation lookup (real administrative boundaries)
  const relationId = KEY_TO_OSM_RELATION[key];
  if (relationId) {
    try {
      const result = await fetchByOsmRelation(relationId);
      if (result) {
        geometryCache[key] = result;
        return NextResponse.json(result);
      }
    } catch {
      // Fall through to bbox
    }
  }

  // Fallback: approximate bounding box
  const fallbackCoords = FALLBACK_BBOX[key];
  if (fallbackCoords) {
    const result = { name: key, geometry: bboxToPolygon(fallbackCoords) };
    geometryCache[key] = result;
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'boundary not found' }, { status: 404 });
}
