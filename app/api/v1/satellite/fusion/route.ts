/**
 * POST /api/v1/satellite/fusion
 * ─────────────────────────────────────────────────────────────────────────
 * دمج SAR + Optical لصور أوضح
 * يجمع: Sentinel-1 SAR + Sentinel-2 RGB + Sentinel-2 SWIR
 *
 * المدخلات:
 *   bbox   [minLon, minLat, maxLon, maxLat]
 *   size   128|256|512   (افتراضي 256)
 *   scale  1|2           (مضاعف الإخراج، افتراضي 2)
 *
 * المخرجات:
 *   { ok, image_b64_png, width, height, method, elapsed_ms }
 */
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const SCRIPT = path.join(process.cwd(), 'scripts', 'sar_optical_fusion.py');
const TIMEOUT = 120_000;

function bboxAreaKm2(bbox: number[]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const dx = (maxLon - minLon) * 111.32 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const dy = (maxLat - minLat) * 110.54;
  return dx * dy;
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const bbox: number[] = body.bbox;
  const size  = [128, 256, 512].includes(body.size)  ? body.size  : 256;
  const scale = [1, 2].includes(body.scale) ? body.scale : 2;

  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some(isNaN)) {
    return NextResponse.json({ error: 'bbox required', hint: '[minLon,minLat,maxLon,maxLat]' }, { status: 400 });
  }

  const area = bboxAreaKm2(bbox);
  if (area > 50) {
    return NextResponse.json({ error: 'area_too_large', area_km2: Math.round(area), hint: 'حد الدمج 50 كم²' }, { status: 400 });
  }

  const t0 = Date.now();
  const env = { ...process.env, PYTHONUNBUFFERED: '1' };

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn('python3', [SCRIPT,
      '--bbox', bbox.join(','),
      '--size', String(size),
      '--scale', String(scale),
    ], { env, timeout: TIMEOUT });

    const chunks: Buffer[] = [];
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => chunks.push(d));
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0 || chunks.length === 0) {
        resolve(NextResponse.json({
          error: 'fusion_failed',
          hint:  stderr.slice(-400) || 'no output',
        }, { status: 500 }));
        return;
      }

      const pngBuf = Buffer.concat(chunks);
      const b64    = pngBuf.toString('base64');

      resolve(NextResponse.json({
        ok:           true,
        image_b64:    b64,
        mime:         'image/png',
        size_bytes:   pngBuf.length,
        output_px:    size * scale,
        input_res_m:  10,
        output_res_m: 10 / scale,
        sources:      ['S2 RGB 10م', 'S2 SWIR 20م', 'S1 SAR 10م'],
        method:       'SAR-texture LAB fusion + SWIR material + CLAHE + bicubic',
        area_km2:     Math.round(area * 10) / 10,
        elapsed_ms:   Date.now() - t0,
        hint:         stderr.includes('✅') ? stderr.split('✅')[1]?.trim() : 'done',
      }));
    });

    proc.on('error', (e) => resolve(NextResponse.json({ error: e.message }, { status: 500 })));
    setTimeout(() => { proc.kill(); resolve(NextResponse.json({ error: 'timeout', hint: 'قلل حجم المنطقة' }, { status: 504 })); }, TIMEOUT);
  });
}
