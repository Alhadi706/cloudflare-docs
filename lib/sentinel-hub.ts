/**
 * lib/sentinel-hub.ts
 * Sentinel Hub Process API client — يستخدم CDSE OAuth2
 *
 * يوفر:
 *  - getAccessToken()        — توكن OAuth2 مع cache
 *  - computeNDWI()           — مؤشر الماء (B3-B8)/(B3+B8)  — Sentinel-2
 *  - computeNDVI()           — مؤشر النبات (B8-B4)/(B8+B4) — Sentinel-2
 *  - computeSARBackscatter() — طاقة الرادار VV/VH            — Sentinel-1
 *  - computeSARCoherence()   — التماسك (InSAR proxy)         — Sentinel-1
 *
 * لا تعمل بدون:
 *   CDSE_CLIENT_ID=...
 *   CDSE_CLIENT_SECRET=...
 */

const TOKEN_ENDPOINT =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const SH_BASE = 'https://sh.dataspace.copernicus.eu';

// ── In-memory token cache ────────────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

export async function getAccessToken(): Promise<string | null> {
  const clientId     = process.env.CDSE_CLIENT_ID;
  const clientSecret = process.env.CDSE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Reuse if still valid (with 60s buffer)
  if (_cachedToken && Date.now() < _tokenExpiry - 60_000) return _cachedToken;

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });
  if (!res.ok) {
    console.warn('[SH] Token request failed:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _cachedToken;
}

export function hasCDSECredentials(): boolean {
  return !!(process.env.CDSE_CLIENT_ID && process.env.CDSE_CLIENT_SECRET);
}

// ── Sentinel Hub Process API ─────────────────────────────────────────────────
// يُعيد إحصاءات مجمّعة (mean, min, max, std) لـ evalscript محدد على AOI وفترة زمنية
interface SHStatsRequest {
  bbox:       [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  dateFrom:   string;  // "YYYY-MM-DD"
  dateTo:     string;
  evalscript: string;
  collection: 'sentinel-2-l2a' | 'sentinel-1-grd' | 'sentinel-2-l1c';
}

interface SHBandStats {
  mean:    number | null;
  min:     number | null;
  max:     number | null;
  std:     number | null;
  samples: number;
}

export interface SHStatsResult {
  ok:      boolean;
  error?:  string;
  dateFrom: string;
  dateTo:   string;
  bands:   Record<string, SHBandStats>;
}

export async function fetchSHStats(req: SHStatsRequest): Promise<SHStatsResult> {
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, error: 'no_credentials', dateFrom: req.dateFrom, dateTo: req.dateTo, bands: {} };
  }

  // CDSE Sentinel Hub uses direct collection type names (not byoc IDs)
  const collectionMap: Record<string, string> = {
    'sentinel-2-l2a':  'S2L2A',
    'sentinel-1-grd':  'S1GRD',
    'sentinel-2-l1c':  'S2L1C',
  };
  const collectionId = collectionMap[req.collection] ?? req.collection;

  const body = {
    input: {
      bounds: {
        bbox:      req.bbox,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        dataFilter: {
          timeRange: { from: `${req.dateFrom}T00:00:00Z`, to: `${req.dateTo}T23:59:59Z` },
          mosaickingOrder: 'leastCC',
        },
        processing: { harmonizeValues: false },
        type: collectionId,
      }],
    },
    output: {
      width:  256,
      height: 256,
      responses: [{ identifier: 'default', format: { type: 'image/tiff' } }],
    },
    evalscript:  req.evalscript,
  };

  // Use Statistical API for aggregated stats (no image download needed)
  const statsBody = {
    input: {
      bounds: {
        bbox:       req.bbox,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        dataFilter: {
          timeRange: { from: `${req.dateFrom}T00:00:00Z`, to: `${req.dateTo}T23:59:59Z` },
          mosaickingOrder: 'leastCC',
        },
        type: collectionId,
      }],
    },
    aggregation: {
      timeRange:      { from: `${req.dateFrom}T00:00:00Z`, to: `${req.dateTo}T23:59:59Z` },
      aggregationInterval: { of: 'P30D' },
      evalscript:     req.evalscript,
      // Use width/height — avoids unit confusion with WGS84 degree CRS
      width:  256,
      height: 256,
    },
  };

  try {
    const res = await fetch(`${SH_BASE}/api/v1/statistics`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(statsBody),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}`, dateFrom: req.dateFrom, dateTo: req.dateTo, bands: {} };
    }

    const data = await res.json();
    // Parse response — Statistics API returns: data[].outputs.{bandId}.bands.B0.stats
    const intervals = data?.data ?? [];
    if (intervals.length === 0) {
      return { ok: true, dateFrom: req.dateFrom, dateTo: req.dateTo, bands: {} };
    }

    // Merge stats across all intervals (take most recent non-null)
    const bands: Record<string, SHBandStats> = {};
    for (const interval of intervals) {
      const outputs = interval?.outputs ?? {};
      for (const [bandName, bandData] of Object.entries(outputs as Record<string, any>)) {
        const b0stats = (bandData as any)?.bands?.B0?.stats ?? {};
        if (b0stats.mean != null) {
          bands[bandName] = {
            mean:    b0stats.mean    ?? null,
            min:     b0stats.min     ?? null,
            max:     b0stats.max     ?? null,
            std:     b0stats.stDev   ?? null,
            samples: b0stats.sampleCount ?? 0,
          };
        }
      }
    }

    return { ok: true, dateFrom: req.dateFrom, dateTo: req.dateTo, bands };
  } catch (e: any) {
    console.warn('[SH Stats] Error:', e.message?.slice(0, 120));
    return { ok: false, error: e.message, dateFrom: req.dateFrom, dateTo: req.dateTo, bands: {} };
  }
}

// ── Evalscripts ──────────────────────────────────────────────────────────────

// NDWI — مؤشر الماء: قيم موجبة = ماء / قيم سالبة = أرض جافة
// مثالي لكشف ظهور ماء في صحراء (قيمة >-0.2 في الصحراء = شذوذ مائي)
export const NDWI_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03","B08","dataMask"] }],
    output: [
      { id: "ndwi",     bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8"   }
    ]
  };
}
function evaluatePixel(s) {
  return {
    ndwi:     [(s.B03 - s.B08) / (s.B03 + s.B08 + 0.0001)],
    dataMask: [s.dataMask]
  };
}`;

// NDVI — مؤشر النبات: قيم موجبة عالية = غطاء نباتي كثيف
// كشف نباتات جديدة في الصحراء من تسرب مياه
export const NDVI_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04","B08","dataMask"] }],
    output: [
      { id: "ndvi",     bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8"   }
    ]
  };
}
function evaluatePixel(s) {
  return {
    ndvi:     [(s.B08 - s.B04) / (s.B08 + s.B04 + 0.0001)],
    dataMask: [s.dataMask]
  };
}`;

// SAR VV (Sigma0) — طاقة الرادار: ترطيب التربة يرفع الـ VV
// يُحوَّل من linear إلى dB: يكون في حدود -25 إلى 0 dB للأرض
export const SAR_VV_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV","VH","dataMask"] }],
    output: [
      { id: "vv_db",    bands: 1, sampleType: "FLOAT32" },
      { id: "vh_db",    bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8"   }
    ]
  };
}
function evaluatePixel(s) {
  let vv_db = 10 * Math.log10(s.VV + 0.0001);
  let vh_db = 10 * Math.log10(s.VH + 0.0001);
  return {
    vv_db:    [vv_db],
    vh_db:    [vh_db],
    dataMask: [s.dataMask]
  };
}`;

// SWIR — Short-Wave Infrared — كاشف ممتاز للرطوبة في التربة
// B11 (1610nm) + B12 (2190nm) — الماء يمتص SWIR بقوة
export const SWIR_MOISTURE_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B08","B11","dataMask"] }],
    output: [
      { id: "ndmi",     bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8"   }
    ]
  };
}
function evaluatePixel(s) {
  return {
    ndmi:     [(s.B08 - s.B11) / (s.B08 + s.B11 + 0.0001)],
    dataMask: [s.dataMask]
  };
}`;

// ── High-level convenience functions ─────────────────────────────────────────

export async function computeNDWI(
  bbox: [number, number, number, number],
  dateFrom: string,
  dateTo: string,
): Promise<{ ndwi_mean: number | null; ndwi_max: number | null; ok: boolean; error?: string }> {
  const result = await fetchSHStats({
    bbox, dateFrom, dateTo,
    evalscript: NDWI_EVALSCRIPT,
    collection: 'sentinel-2-l2a',
  });
  return {
    ok:        result.ok,
    error:     result.error,
    ndwi_mean: result.bands['ndwi']?.mean ?? null,
    ndwi_max:  result.bands['ndwi']?.max  ?? null,
  };
}

export async function computeNDVI(
  bbox: [number, number, number, number],
  dateFrom: string,
  dateTo: string,
): Promise<{ ndvi_mean: number | null; ndvi_max: number | null; ok: boolean; error?: string }> {
  const result = await fetchSHStats({
    bbox, dateFrom, dateTo,
    evalscript: NDVI_EVALSCRIPT,
    collection: 'sentinel-2-l2a',
  });
  return {
    ok:        result.ok,
    error:     result.error,
    ndvi_mean: result.bands['ndvi']?.mean ?? null,
    ndvi_max:  result.bands['ndvi']?.max  ?? null,
  };
}

export async function computeNDMI(
  bbox: [number, number, number, number],
  dateFrom: string,
  dateTo: string,
): Promise<{ ndmi_mean: number | null; ndmi_max: number | null; ok: boolean; error?: string }> {
  const result = await fetchSHStats({
    bbox, dateFrom, dateTo,
    evalscript: SWIR_MOISTURE_EVALSCRIPT,
    collection: 'sentinel-2-l2a',
  });
  return {
    ok:        result.ok,
    error:     result.error,
    ndmi_mean: result.bands['ndmi']?.mean ?? null,
    ndmi_max:  result.bands['ndmi']?.max  ?? null,
  };
}

export async function computeSARSigma0(
  bbox: [number, number, number, number],
  dateFrom: string,
  dateTo: string,
): Promise<{ vv_db_mean: number | null; vh_db_mean: number | null; ok: boolean; error?: string }> {
  const result = await fetchSHStats({
    bbox, dateFrom, dateTo,
    evalscript: SAR_VV_EVALSCRIPT,
    collection: 'sentinel-1-grd',
  });
  return {
    ok:         result.ok,
    error:      result.error,
    vv_db_mean: result.bands['vv_db']?.mean ?? null,
    vh_db_mean: result.bands['vh_db']?.mean ?? null,
  };
}
