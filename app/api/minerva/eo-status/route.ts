import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/minerva/eo-status
 * Returns real latest EO scene dates from Planetary Computer STAC.
 * Used by CommandCenter to show ACCURATE dates (not hardcoded).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '32.89');
  const lon = parseFloat(searchParams.get('lon') || '13.18');
  const buf = 0.2;

  const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';

  async function fetchLatest(collection: string, extraQuery?: object) {
    try {
      const r = await fetch(STAC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'MINERVA/1.0' },
        body: JSON.stringify({
          collections: [collection],
          bbox: [lon - buf, lat - buf, lon + buf, lat + buf],
          sortby: [{ field: 'properties.datetime', direction: 'desc' }],
          limit: 1,
          ...(extraQuery || {}),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return null;
      const data = await r.json();
      const item = data.features?.[0];
      if (!item) return null;
      return {
        date:       item.properties.datetime?.slice(0, 10) ?? null,
        scene_id:   item.id,
        platform:   item.properties.platform ?? null,
        cloud_pct:  item.properties['eo:cloud_cover'] ?? null,
      };
    } catch {
      return null;
    }
  }

  // Fetch all three in parallel
  const [s2, s1, modis] = await Promise.all([
    fetchLatest('sentinel-2-l2a', { query: { 'eo:cloud_cover': { lt: 30 } } }),
    fetchLatest('sentinel-1-rtc'),
    fetchLatest('modis-11A1-061'),
  ]);

  // Build Sentinel-2 visual tile URL (TrueColor RGB)
  let s2_tile_url: string | null = null;
  if (s2?.scene_id) {
    s2_tile_url =
      `https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}` +
      `@1x.png?collection=sentinel-2-l2a&item=${s2.scene_id}` +
      `&assets=B04,B03,B02&color_formula=gamma+RGB+3.7+saturation+1.5+sigmoidal+RGB+15+0.35`;
  }

  return NextResponse.json({
    ok: true,
    lat, lon,
    sentinel2:    { ...s2,  tile_url: s2_tile_url },
    sentinel1:    s1,
    modis:        modis,
    basemap_note: 'خلفية الخريطة (ArcGIS World Imagery) قديمة — استخدم طبقة Sentinel-2 للرؤية الحديثة',
    generated_at: new Date().toISOString(),
  });
}
