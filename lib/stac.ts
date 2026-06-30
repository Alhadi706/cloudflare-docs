/**
 * lib/stac.ts — Satellite STAC API client
 *
 * Free public endpoints (no auth required for metadata):
 *   • CDSE Copernicus — Sentinel-2 L2A, Sentinel-1 GRD, Sentinel-5P
 *     https://catalogue.dataspace.copernicus.eu/stac/search
 *     Includes SCL statistics: vegetation%, not_vegetated%, water%, clouds%
 *   • Element84 Earth Search — Sentinel-2 L2A, Landsat C2L2
 *     https://earth-search.aws.element84.com/v1/search
 */

const CDSE_STAC      = 'https://catalogue.dataspace.copernicus.eu/stac/search';
const ELEMENT84_STAC = 'https://earth-search.aws.element84.com/v1/search';
const TIMEOUT_MS     = 14_000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SCLStatistics {
  vegetation_pct:    number | null;
  not_vegetated_pct: number | null;
  water_pct:         number | null;
  cloud_shadow_pct:  number | null;
  clouds_pct:        number | null;  // high + medium probability clouds
}

export interface STACScene {
  id:            string;
  collection:    string;
  date:          string;                        // ISO date YYYY-MM-DD
  cloud_cover:   number | null;
  bbox:          [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  thumbnail_url: string | null;
  platform:      string;
  source:        'cdse' | 'element84';
  data_real:     true;
  statistics:    SCLStatistics | null;           // tile-level, Sentinel-2 only
  assets?:       Record<string, string>;         // band asset URLs
}

export interface STACSearchParams {
  bbox:        [number, number, number, number];
  date_from:   string;    // ISO date  e.g. '2026-01-01'
  date_to:     string;    // ISO date  e.g. '2026-06-30'
  collections: string[];  // e.g. ['sentinel-2-l2a', 'sentinel-1-grd']
  max_cloud?:  number;    // 0–100, applies only to Sentinel-2
  limit?:      number;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseCDSE(f: Record<string, unknown>): STACScene {
  const props   = (f.properties ?? {}) as Record<string, unknown>;
  const stats   = props.statistics   as Record<string, number> | undefined;
  const assetRaw= (f.assets ?? {})   as Record<string, { href: string }>;

  return {
    id:           f.id as string,
    collection:   (f.collection as string) ?? '',
    date:         ((props.datetime as string) ?? '').slice(0, 10),
    cloud_cover:  typeof props['eo:cloud_cover'] === 'number'
                    ? (props['eo:cloud_cover'] as number)
                    : null,
    bbox:         (f.bbox as [number, number, number, number]) ?? [0, 0, 0, 0],
    thumbnail_url: assetRaw.thumbnail?.href ?? assetRaw.QUICKLOOK?.href ?? null,
    platform:     (props.platform as string) ?? (props.constellation as string) ?? '',
    source:       'cdse',
    data_real:    true,
    statistics: stats ? {
      vegetation_pct:    stats.vegetation     ?? null,
      not_vegetated_pct: stats.not_vegetated  ?? null,
      water_pct:         stats.water          ?? null,
      cloud_shadow_pct:  stats.cloud_shadow   ?? null,
      clouds_pct:        ((stats.high_proba_clouds ?? 0) + (stats.medium_proba_clouds ?? 0)) || null,
    } : null,
    assets: Object.fromEntries(
      Object.entries(assetRaw).map(([k, v]) => [k, v.href])
    ),
  };
}

function parseElement84(f: Record<string, unknown>): STACScene {
  const props   = (f.properties ?? {}) as Record<string, unknown>;
  const assetRaw= (f.assets ?? {})   as Record<string, { href: string }>;

  return {
    id:           f.id as string,
    collection:   (f.collection as string) ?? '',
    date:         ((props.datetime as string) ?? '').slice(0, 10),
    cloud_cover:  typeof props['eo:cloud_cover'] === 'number'
                    ? (props['eo:cloud_cover'] as number)
                    : null,
    bbox:         (f.bbox as [number, number, number, number]) ?? [0, 0, 0, 0],
    thumbnail_url: assetRaw.thumbnail?.href ?? null,
    platform:     (props.platform as string) ?? '',
    source:       'element84',
    data_real:    true,
    statistics:   null,
    assets: Object.fromEntries(
      Object.entries(assetRaw).map(([k, v]) => [k, v.href])
    ),
  };
}

// ─── Core search ─────────────────────────────────────────────────────────────

export async function searchSTAC(params: STACSearchParams): Promise<STACScene[]> {
  const { bbox, date_from, date_to, collections, max_cloud = 90, limit = 10 } = params;

  const results: STACScene[] = [];

  // ── CDSE ──────────────────────────────────────────────────────────────────
  const cdse_cols = collections.filter(c =>
    ['sentinel-2-l2a', 'sentinel-1-grd', 'sentinel-5p-l2'].includes(c)
  );

  if (cdse_cols.length > 0) {
    try {
      const body: Record<string, unknown> = {
        collections: cdse_cols,
        bbox:        [...bbox],
        limit,
        datetime:    `${date_from}T00:00:00Z/${date_to}T23:59:59Z`,
      };
      if (max_cloud < 100 && cdse_cols.includes('sentinel-2-l2a')) {
        body.query = { 'eo:cloud_cover': { lt: max_cloud } };
      }
      const res = await fetch(CDSE_STAC, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'digital-dashboard/2.1' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const d = (await res.json()) as { features?: unknown[] };
        results.push(...(d.features ?? []).map(f => parseCDSE(f as Record<string, unknown>)));
      }
    } catch { /* CDSE unreachable */ }
  }

  // ── Element84 fallback / Landsat supplement ──────────────────────────────
  const e84_cols = collections.filter(c =>
    ['sentinel-2-l2a', 'landsat-c2-l2'].includes(c)
  );

  if (results.length === 0 && e84_cols.length > 0) {
    try {
      const body = {
        collections: e84_cols,
        bbox:        [...bbox],
        limit,
        datetime:    `${date_from}T00:00:00Z/${date_to}T23:59:59Z`,
      };
      const res = await fetch(ELEMENT84_STAC, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'digital-dashboard/2.1' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const d = (await res.json()) as { features?: unknown[] };
        results.push(...(d.features ?? []).map(f => parseElement84(f as Record<string, unknown>)));
      }
    } catch { /* Element84 unreachable */ }
  }

  return results.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return the single scene with lowest cloud cover from a STAC search */
export async function getBestScene(
  bbox:       [number, number, number, number],
  dateFrom:   string,
  dateTo:     string,
  collection: string = 'sentinel-2-l2a',
  maxCloud:   number = 40,
): Promise<STACScene | null> {
  const scenes = await searchSTAC({
    bbox, date_from: dateFrom, date_to: dateTo,
    collections: [collection], max_cloud: maxCloud, limit: 8,
  });
  if (scenes.length === 0) return null;
  return scenes.reduce((best, s) => {
    const bCloud = best.cloud_cover ?? 100;
    const sCloud = s.cloud_cover  ?? 100;
    return sCloud < bCloud ? s : best;
  });
}

/** Convert polygon [[lon,lat],...] to bbox [minLon, minLat, maxLon, maxLat] */
export function polygonToBbox(
  polygon: [number, number][],
): [number, number, number, number] {
  const lons = polygon.map(p => p[0]);
  const lats = polygon.map(p => p[1]);
  return [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats),
  ];
}

/** Add buffer (in degrees) to a bbox */
export function expandBbox(
  bbox: [number, number, number, number],
  deg:  number = 0.01,
): [number, number, number, number] {
  return [bbox[0] - deg, bbox[1] - deg, bbox[2] + deg, bbox[3] + deg];
}

/** Format ISO date string N days in the past */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Today's date as ISO string */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Change analysis ──────────────────────────────────────────────────────────

export interface ChangeIndicators {
  vegetation_delta:    number | null;
  not_vegetated_delta: number | null;
  water_delta:         number | null;
  detected_changes:    string[];
  risk_level:          'none' | 'low' | 'medium' | 'high';
  confidence:          number;   // 0–1
  analysis_scope:      'tile_level';   // honest label
}

export function computeChangeIndicators(
  t1: STACScene | null,
  t2: STACScene | null,
): ChangeIndicators {
  const empty: ChangeIndicators = {
    vegetation_delta: null, not_vegetated_delta: null, water_delta: null,
    detected_changes: [], risk_level: 'none', confidence: 0,
    analysis_scope: 'tile_level',
  };

  if (!t1?.statistics || !t2?.statistics) return empty;

  const s1 = t1.statistics;
  const s2 = t2.statistics;

  const veg_d  = (s2.vegetation_pct    ?? 0) - (s1.vegetation_pct    ?? 0);
  const nveg_d = (s2.not_vegetated_pct ?? 0) - (s1.not_vegetated_pct ?? 0);
  const water_d= (s2.water_pct         ?? 0) - (s1.water_pct         ?? 0);

  const changes: string[] = [];
  let risk: ChangeIndicators['risk_level'] = 'none';

  function elevRisk(r: 'low' | 'medium' | 'high') {
    const order = { none: 0, low: 1, medium: 2, high: 3 };
    if (order[r] > order[risk]) risk = r;
  }

  if (nveg_d > 5) {
    changes.push(`ارتفاع في المساحات الجرداء: +${nveg_d.toFixed(1)}% — احتمال إنشاء أو تجريف`);
    elevRisk(nveg_d > 10 ? 'high' : 'medium');
  } else if (nveg_d > 2) {
    changes.push(`ارتفاع طفيف في الأراضي الجرداء: +${nveg_d.toFixed(1)}%`);
    elevRisk('low');
  }

  if (veg_d < -5) {
    changes.push(`انخفاض الغطاء النباتي: ${veg_d.toFixed(1)}% — احتمال إزالة نباتات`);
    elevRisk(veg_d < -10 ? 'high' : 'medium');
  } else if (veg_d < -2) {
    changes.push(`انخفاض طفيف في الغطاء النباتي: ${veg_d.toFixed(1)}%`);
    elevRisk('low');
  }

  if (water_d > 8) {
    changes.push(`ارتفاع ملحوظ في مؤشر المياه: +${water_d.toFixed(1)}% — احتمال فيضان`);
    elevRisk(water_d > 15 ? 'high' : 'medium');
  } else if (water_d > 3) {
    changes.push(`ارتفاع في المياه السطحية: +${water_d.toFixed(1)}%`);
    elevRisk('low');
  }

  if (water_d < -5) {
    changes.push(`انخفاض المياه السطحية: ${water_d.toFixed(1)}% — احتمال جفاف أو استنزاف`);
    elevRisk('low');
  }

  // Confidence based on cloud cover quality
  const c1 = t1.cloud_cover ?? 100;
  const c2 = t2.cloud_cover ?? 100;
  const avgCloud = (c1 + c2) / 2;
  const confidence = avgCloud < 10 ? 0.85
    : avgCloud < 20 ? 0.70
    : avgCloud < 30 ? 0.55
    : avgCloud < 50 ? 0.40
    : 0.25;

  return {
    vegetation_delta:    +veg_d.toFixed(2),
    not_vegetated_delta: +nveg_d.toFixed(2),
    water_delta:         +water_d.toFixed(2),
    detected_changes:    changes,
    risk_level:          risk,
    confidence,
    analysis_scope:      'tile_level',
  };
}
