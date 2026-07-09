/**
 * /tiles/sentinel/[...params]/route.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Tile proxy for Sentinel-2 and Sentinel-1 imagery via CDSE Sentinel Hub
 *
 * URL pattern:
 *   /tiles/sentinel/{layer}/{date}/{z}/{y}/{x}
 *
 * Layers:
 *   tci       — True Color (RGB) — Sentinel-2 L2A
 *   ndvi      — Vegetation Index (green gradient)
 *   ndwi      — Water Index (blue gradient)
 *   cir       — Color Infrared / False Color
 *   swir      — SWIR composite (burn areas, geology)
 *   sar       — Sentinel-1 SAR Sigma0 VV (grayscale)
 *   sar_rgb   — Sentinel-1 SAR RGB composite (VV/VH)
 *
 * date: YYYY-MM-DD or "latest" (uses last 60 days)
 *
 * Examples:
 *   /tiles/sentinel/tci/latest/12/2273/1713
 *   /tiles/sentinel/sar/2026-06-01/12/2273/1713
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_DIR   = path.join(process.cwd(), '.data', 'sentinel-tiles');
const CACHE_TTL   = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_CACHE: { token: string; expires: number } = { token: '', expires: 0 };

// ── CDSE OAuth2 token ────────────────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  if (TOKEN_CACHE.token && Date.now() < TOKEN_CACHE.expires) return TOKEN_CACHE.token;

  const id  = process.env.CDSE_CLIENT_ID;
  const sec = process.env.CDSE_CLIENT_SECRET;
  if (!id || !sec) return null;

  try {
    const r = await fetch(
      'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: sec }),
      }
    );
    if (!r.ok) return null;
    const d = await r.json();
    TOKEN_CACHE.token   = d.access_token;
    TOKEN_CACHE.expires = Date.now() + (d.expires_in - 60) * 1000;
    return TOKEN_CACHE.token;
  } catch { return null; }
}

// ── Tile coordinate helpers ──────────────────────────────────────────────────
function tileToBbox(tx: number, ty: number, z: number): [number,number,number,number] {
  const n  = Math.pow(2, z);
  const w  = (tx / n) * 360 - 180;
  const e  = ((tx + 1) / n) * 360 - 180;
  const n_ = Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))) * 180 / Math.PI;
  const s  = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 1) / n))) * 180 / Math.PI;
  return [w, s, e, n_];
}

// ── Evalscripts ───────────────────────────────────────────────────────────────
const EVALSCRIPTS: Record<string, { script: string; collection: string; accept: string }> = {
  tci: {
    collection: 'S2L2A',
    accept: 'image/png',
    script: `//VERSION=3
function setup(){return{input:[{bands:["B04","B03","B02"],units:"REFLECTANCE"}],output:{bands:3,sampleType:"UINT8"}}}
function evaluatePixel(s){
  const gamma=2.2;
  return[
    Math.min(255,Math.round(Math.pow(Math.min(1,s.B04*3.5),1/gamma)*255)),
    Math.min(255,Math.round(Math.pow(Math.min(1,s.B03*3.5),1/gamma)*255)),
    Math.min(255,Math.round(Math.pow(Math.min(1,s.B02*3.5),1/gamma)*255))
  ];
}`,
  },
  ndvi: {
    collection: 'S2L2A',
    accept: 'image/png',
    script: `//VERSION=3
function setup(){return{input:[{bands:["B08","B04"],units:"REFLECTANCE"}],output:{bands:3,sampleType:"UINT8"}}}
function colorRamp(v){
  // -1(red) → 0(yellow) → 0.5(green) → 1(dark green)
  if(v<-0.2) return[220,50,50];
  if(v<0.1)  return[240,230,100];
  if(v<0.3)  return[100,200,80];
  if(v<0.6)  return[50,150,50];
  return[20,100,20];
}
function evaluatePixel(s){
  const ndvi=(s.B08-s.B04)/(s.B08+s.B04+1e-9);
  return colorRamp(ndvi);
}`,
  },
  ndwi: {
    collection: 'S2L2A',
    accept: 'image/png',
    script: `//VERSION=3
function setup(){return{input:[{bands:["B03","B08"],units:"REFLECTANCE"}],output:{bands:3,sampleType:"UINT8"}}}
function evaluatePixel(s){
  const ndwi=(s.B03-s.B08)/(s.B03+s.B08+1e-9);
  if(ndwi>0.3)  return[0,100,255];    // Water
  if(ndwi>0.0)  return[100,180,255];  // Moist
  if(ndwi>-0.2) return[220,200,150];  // Transition
  return[200,180,130];                // Dry land
}`,
  },
  cir: {
    collection: 'S2L2A',
    accept: 'image/png',
    script: `//VERSION=3
function setup(){return{input:[{bands:["B08","B04","B03"],units:"REFLECTANCE"}],output:{bands:3,sampleType:"UINT8"}}}
function evaluatePixel(s){
  return[
    Math.min(255,Math.round(s.B08*3.0*255)),
    Math.min(255,Math.round(s.B04*3.0*255)),
    Math.min(255,Math.round(s.B03*3.0*255))
  ];
}`,
  },
  swir: {
    collection: 'S2L2A',
    accept: 'image/png',
    script: `//VERSION=3
function setup(){return{input:[{bands:["B12","B08","B04"],units:"REFLECTANCE"}],output:{bands:3,sampleType:"UINT8"}}}
function evaluatePixel(s){
  return[
    Math.min(255,Math.round(s.B12*3.0*255)),
    Math.min(255,Math.round(s.B08*2.5*255)),
    Math.min(255,Math.round(s.B04*3.0*255))
  ];
}`,
  },
  sar: {
    collection: 'S1GRD',
    accept: 'image/png',
    script: `//VERSION=3
function setup(){return{input:[{bands:["VV"],units:"LINEAR_POWER"}],output:{bands:3,sampleType:"UINT8"}}}
function toDb(v){return 10*Math.log10(v+1e-10);}
function evaluatePixel(s){
  const db = toDb(s.VV);
  const scaled = Math.min(255, Math.max(0, Math.round((db+25)/30*255)));
  return[scaled,scaled,scaled];
}`,
  },
  sar_rgb: {
    collection: 'S1GRD',
    accept: 'image/png',
    script: `//VERSION=3
function setup(){return{input:[{bands:["VV","VH"],units:"LINEAR_POWER"}],output:{bands:3,sampleType:"UINT8"}}}
function toDb(v){return 10*Math.log10(v+1e-10);}
function evaluatePixel(s){
  const vv=toDb(s.VV); const vh=toDb(s.VH);
  const rvv=Math.min(255,Math.max(0,Math.round((vv+25)/30*255)));
  const rvh=Math.min(255,Math.max(0,Math.round((vh+30)/30*255)));
  const ratio=Math.min(255,Math.max(0,Math.round((vv-vh+15)/15*255)));
  return[rvv,rvh,ratio];
}`,
  },

  // ── Copernicus DEM 30m — ارتفاع التضاريس ────────────────────────────────
  dem: {
    collection: 'DEM',
    accept: 'image/png',
    script: `//VERSION=3
function setup(){return{input:[{bands:["DEM"]}],output:{bands:3,sampleType:"UINT8"}}}
function evaluatePixel(s){
  const h=Math.max(-500,Math.min(3000,s.DEM));
  const v=Math.max(0,Math.min(255,Math.round((h+100)/3100*255)));
  // Hypsometric color: sea=blue, lowland=green, highland=brown, peaks=white
  if(h<0)  return[0,50,Math.min(255,150+Math.round(-h*2))];
  if(h<200)return[Math.round(v*0.5),Math.min(200,100+v),Math.round(v*0.3)];
  if(h<800)return[Math.min(255,150+v),Math.round(120-v*0.2),Math.round(v*0.3)];
  return[Math.min(255,200+v),Math.min(255,180+v),Math.min(255,150+v)];
}`,
  },

  // ── Hillshade (تظليل التضاريس) ───────────────────────────────────────────
  hillshade: {
    collection: 'DEM',
    accept: 'image/png',
    script: `//VERSION=3
function setup(){return{input:[{bands:["DEM"]}],output:{bands:3,sampleType:"UINT8"}}}
function evaluatePixel(s,scenes,inputMetadata,customData,outputSize){
  return[Math.max(0,Math.min(255,Math.round((Math.max(-500,Math.min(3000,s.DEM))+100)/3100*255)))]*3;
}`,
  },
};

// ── Tile cache ─────────────────────────────────────────────────────────────────
function cacheKey(layer: string, date: string, z: number, y: number, x: number): string {
  return crypto.createHash('md5').update(`${layer}_${date}_${z}_${y}_${x}`).digest('hex');
}

function readTileCache(key: string): Buffer | null {
  try {
    const f = path.join(CACHE_DIR, `${key}.png`);
    if (!fs.existsSync(f)) return null;
    if (Date.now() - fs.statSync(f).mtimeMs > CACHE_TTL) return null;
    return fs.readFileSync(f);
  } catch { return null; }
}

function writeTileCache(key: string, data: Buffer) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.png`), data);
  } catch { /* silent */ }
}

// ── Transparent fallback tile (1×1 transparent PNG) ─────────────────────────
const TRANSPARENT_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { params: string[] } },
) {
  const parts = params.params;
  // Expected: [layer, date, z, y, x]
  if (!parts || parts.length < 5) {
    return new NextResponse('Usage: /tiles/sentinel/{layer}/{date}/{z}/{y}/{x}', { status: 400 });
  }

  const [layer, date, zStr, yStr, xStr] = parts;
  const z = parseInt(zStr);
  const y = parseInt(yStr);
  const x = parseInt(xStr);

  if (isNaN(z) || isNaN(y) || isNaN(x)) {
    return new NextResponse(TRANSPARENT_TILE, { headers: { 'Content-Type': 'image/png' } });
  }

  const ev = EVALSCRIPTS[layer]
    ?? EVALSCRIPTS[layer.replace('s2_', '').replace('s1_', '')];
  if (!ev) {
    return new NextResponse(TRANSPARENT_TILE, { headers: { 'Content-Type': 'image/png' } });
  }

  // Sentinel Hub minimum zoom is 7 (z=6 gives >2000m/px which SH rejects)
  // Maximum useful zoom is 14 (beyond native 10m resolution)
  if (z > 14 || z < 7) {
    return new NextResponse(TRANSPARENT_TILE, { headers: { 'Content-Type': 'image/png' } });
  }

  // Check cache
  const key = cacheKey(layer, date, z, y, x);
  const cached = readTileCache(key);
  if (cached) {
    return new NextResponse(cached, {
      headers: { 'Content-Type': 'image/png', 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  const token = await getToken();
  if (!token) {
    return new NextResponse(TRANSPARENT_TILE, { headers: { 'Content-Type': 'image/png', 'X-Error': 'no_token' } });
  }

  const bbox = tileToBbox(x, y, z);

  // Date range: if "latest" or date, search last 60 days
  const dateTo   = date === 'latest' ? new Date().toISOString().slice(0, 10) : date;
  const dateFrom = new Date(new Date(dateTo).getTime() - 60 * 86400_000).toISOString().slice(0, 10);

  const isSAR = ev.collection === 'S1GRD';
  const body = JSON.stringify({
    input: {
      bounds: {
        bbox,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        type: ev.collection,
        dataFilter: {
          timeRange: { from: `${dateFrom}T00:00:00Z`, to: `${dateTo}T23:59:59Z` },
          mosaickingOrder: isSAR ? 'mostRecent' : 'leastCC',
        },
      }],
    },
    output: {
      width: 256,
      height: 256,
      responses: [{ identifier: 'default', format: { type: 'image/png' } }],
    },
    evalscript: ev.script,
  });

  try {
    const r = await fetch('https://sh.dataspace.copernicus.eu/api/v1/process', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'image/png',
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!r.ok) {
      return new NextResponse(TRANSPARENT_TILE, {
        headers: { 'Content-Type': 'image/png', 'X-Error': `sh_${r.status}` },
      });
    }

    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);

    // Cache and return
    writeTileCache(key, buf);
    return new NextResponse(buf, {
      headers: {
        'Content-Type':  'image/png',
        'Cache-Control': 'public, max-age=86400',
        'X-Cache':       'MISS',
        'X-Layer':       layer,
        'X-Collection':  ev.collection,
      },
    });
  } catch {
    return new NextResponse(TRANSPARENT_TILE, {
      headers: { 'Content-Type': 'image/png', 'X-Error': 'fetch_failed' },
    });
  }
}
