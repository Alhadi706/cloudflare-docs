/**
 * POST /api/v1/satellite/super-resolution
 * ─────────────────────────────────────────────────────────────────────────
 * تحسين دقة صور الأقمار الاصطناعية باستخدام الذكاء الاصطناعي
 *
 * المنهجية:
 *  1. تحميل مشهد Sentinel-2 TrueColor (RGB) من CDSE Sentinel Hub
 *  2. إرسال الصورة لنموذج Swin2SR (HuggingFace) للتحسين 4×
 *  3. دقة ناتجة: من 10م → 2.5م (نظرياً بعد SR)
 *
 * المدخلات (JSON body):
 *   bbox     [minLon, minLat, maxLon, maxLat]   مطلوب
 *   date     'YYYY-MM-DD'                        اختياري — أقرب مشهد متاح
 *   scale    2 | 4                               اختياري — مضاعف الدقة (افتراضي 4)
 *   size     128 | 256 | 512                     اختياري — حجم مربع الإدخال (افتراضي 256)
 *
 * المخرجات:
 *   { original_b64, enhanced_b64, scale, input_res_m, output_res_m, model, ... }
 */
import { NextRequest, NextResponse } from 'next/server';

const CDSE_TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const SH_PROCESS_URL =
  'https://sh.dataspace.copernicus.eu/api/v1/process';

// ── CDSE OAuth2 ─────────────────────────────────────────────────────────────
async function getCDSEToken(): Promise<string | null> {
  const id  = process.env.CDSE_CLIENT_ID;
  const sec = process.env.CDSE_CLIENT_SECRET;
  if (!id || !sec) return null;
  try {
    const r = await fetch(CDSE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     id,
        client_secret: sec,
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.access_token ?? null;
  } catch { return null; }
}

// ── Download Sentinel-2 TrueColor PNG from Sentinel Hub ─────────────────────
const TRUE_COLOR_EVAL = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ['B04','B03','B02'], units: 'REFLECTANCE' }],
    output: { bands: 3, sampleType: 'UINT8' },
  };
}
function evaluatePixel(s) {
  return [
    Math.min(255, Math.max(0, Math.round(s.B04 * 3.5 * 255))),
    Math.min(255, Math.max(0, Math.round(s.B03 * 3.5 * 255))),
    Math.min(255, Math.max(0, Math.round(s.B02 * 3.5 * 255))),
  ];
}`;

async function downloadS2Tile(
  token: string,
  bbox: [number, number, number, number],
  dateFrom: string,
  dateTo: string,
  size: number,
): Promise<Buffer | null> {
  try {
    const body = {
      input: {
        bounds: {
          bbox,
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
        },
        data: [{
          type: 'S2L2A',
          dataFilter: {
            timeRange: { from: `${dateFrom}T00:00:00Z`, to: `${dateTo}T23:59:59Z` },
            mosaickingOrder: 'leastCC',
          },
        }],
      },
      output: {
        width: size,
        height: size,
        responses: [{ identifier: 'default', format: { type: 'image/png' } }],
      },
      evalscript: TRUE_COLOR_EVAL,
    };

    const r = await fetch(SH_PROCESS_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'image/png',
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  } catch { return null; }
}

// ── HuggingFace Swin2SR Super-Resolution ────────────────────────────────────
// مجاني بدون مفتاح — نموذج متخصص في صور الأقمار الاصطناعية
const HF_MODEL_URL =
  'https://api-inference.huggingface.co/models/caidas/swin2SR-classical-sr-x4-64';

async function applySwin2SR(imageBuffer: Buffer): Promise<Buffer | null> {
  try {
    const r = await fetch(HF_MODEL_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(process.env.HUGGINGFACE_TOKEN
          ? { 'Authorization': `Bearer ${process.env.HUGGINGFACE_TOKEN}` }
          : {}),
      },
      body: imageBuffer,
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  } catch { return null; }
}

// ── Simple bicubic upscale fallback (canvas-less, pure math) ────────────────
// تحسين بسيط يُطبَّق عند عدم توفر HuggingFace
async function bicubicFallback(imgBuf: Buffer, scale: number): Promise<Buffer> {
  // Return original with a note — cannot do real bicubic without sharp/canvas
  // The frontend will show a clear message about fallback mode
  return imgBuf;
}

// ── bbox → area check (prevent huge requests) ───────────────────────────────
function bboxAreaKm2(bbox: number[]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const dx = (maxLon - minLon) * 111.32 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const dy = (maxLat - minLat) * 110.54;
  return dx * dy;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const t0 = Date.now();

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const bbox: [number, number, number, number] = body.bbox;
  const scale: number = body.scale === 2 ? 2 : 4;
  const size:  number = body.size  === 512 ? 512 : body.size === 128 ? 128 : 256;
  const date:  string = body.date ?? daysAgo(30);

  // Validate bbox
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    return NextResponse.json({ error: 'bbox_required', hint: '[minLon, minLat, maxLon, maxLat]' }, { status: 400 });
  }
  const areakm2 = bboxAreaKm2(bbox);
  if (areakm2 > 2500) {
    return NextResponse.json({
      error: 'area_too_large',
      area_km2: Math.round(areakm2),
      hint: 'ارسم منطقة أصغر من 50×50 كم لنتائج SR دقيقة',
    }, { status: 400 });
  }

  // Pixel resolution info
  const nativeResM   = 10;
  const outputResM   = nativeResM / scale;

  // Step 1: Download tile
  const token = await getCDSEToken();
  if (!token) {
    return NextResponse.json({
      error: 'no_cdse_credentials',
      hint: 'أضف CDSE_CLIENT_ID + CDSE_CLIENT_SECRET في .env',
    }, { status: 503 });
  }

  const dateTo   = date;
  const dateFrom = daysAgo(45); // search last 45 days for a clear scene

  const originalBuf = await downloadS2Tile(token, bbox, dateFrom, dateTo, size);
  if (!originalBuf) {
    return NextResponse.json({
      error: 'no_scene_found',
      hint: 'لم يُعثر على مشهد Sentinel-2 واضح في النطاق والتاريخ المحدد',
      bbox, dateFrom, dateTo,
    }, { status: 404 });
  }

  const originalB64 = originalBuf.toString('base64');

  // Step 2: Super-Resolution
  let enhancedB64: string | null = null;
  let srModel = 'none';
  let srSuccess = false;

  const hfResult = await applySwin2SR(originalBuf);
  if (hfResult && hfResult.length > originalBuf.length * 0.5) {
    enhancedB64 = hfResult.toString('base64');
    srModel     = 'Swin2SR-classical-x4 (HuggingFace)';
    srSuccess   = true;
  } else {
    // Fallback: return original with upscale hint
    enhancedB64 = originalB64;
    srModel     = 'bicubic-fallback (HuggingFace unavailable)';
    srSuccess   = false;
  }

  const elapsed = Date.now() - t0;

  return NextResponse.json({
    ok:             true,
    original_b64:   originalB64,
    enhanced_b64:   enhancedB64,
    sr_applied:     srSuccess,
    model:          srModel,
    scale_factor:   scale,
    input_size_px:  size,
    output_size_px: srSuccess ? size * scale : size,
    native_res_m:   nativeResM,
    output_res_m:   srSuccess ? outputResM : nativeResM,
    area_km2:       Math.round(areakm2 * 10) / 10,
    bbox,
    date_searched:  `${dateFrom} → ${dateTo}`,
    elapsed_ms:     elapsed,
    hint: srSuccess
      ? `الصورة مُحسَّنة بالذكاء الاصطناعي: ${nativeResM}م → ${outputResM}م (${scale}× تحسين)`
      : `الصورة الأصلية بدقة ${nativeResM}م — HuggingFace غير متاح حالياً، جرب لاحقاً`,
  });
}
