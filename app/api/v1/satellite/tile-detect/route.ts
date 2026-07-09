/**
 * POST /api/v1/satellite/tile-detect
 * ─────────────────────────────────────────────────────────────────────────
 * كشف الكائنات من صور Esri الفضائية (0.5م/pixel) باستخدام YOLOv8-OBB
 * نموذج DOTA المُدرَّب على الصور الجوية
 *
 * الفئات: مركبات صغيرة/كبيرة، طائرات، سفن، خزانات، جسور، مسابح، ملاعب...
 *
 * المدخلات:
 *   bbox   [minLon, minLat, maxLon, maxLat]   مطلوب
 *   zoom   14-19                                (افتراضي 18 = 0.5م)
 *   conf   0.1 - 0.9                            (افتراضي 0.15)
 *   grid   2-6 (NxN tiles)                      (افتراضي 4)
 */
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'tile_detect.py');
const TIMEOUT_MS  = 90_000; // 90s for model + tile download

function bboxAreaKm2(bbox: number[]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const dx = (maxLon - minLon) * 111.32 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const dy = (maxLat - minLat) * 110.54;
  return dx * dy;
}

async function runTileDetect(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [SCRIPT_PATH, ...args], {
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      timeout: TIMEOUT_MS,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    proc.on('error', reject);
    setTimeout(() => { proc.kill(); reject(new Error('timeout')); }, TIMEOUT_MS);
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const bbox: number[] = body.bbox;
  const zoom: number   = Math.min(19, Math.max(14, body.zoom ?? 18));
  const conf: number   = Math.min(0.9, Math.max(0.05, body.conf ?? 0.15));
  const grid: number   = Math.min(6,   Math.max(2, body.grid ?? 4));

  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some(isNaN)) {
    return NextResponse.json({
      error:  'bbox_required',
      hint:   '[minLon, minLat, maxLon, maxLat]',
    }, { status: 400 });
  }

  const areakm2 = bboxAreaKm2(bbox);
  // At zoom 18, grid 4x4 = 4 tiles × 256px × 0.5m = 512m per side ≈ 0.26 km²
  // At zoom 16, grid 4x4 = 4 tiles × 256px × 2.0m = 2048m per side ≈ 4 km²
  if (areakm2 > 25) {
    return NextResponse.json({
      error:    'area_too_large',
      area_km2: Math.round(areakm2),
      hint:     'حد الكشف 25 كم² — قم بتضييق المنطقة أو تخفيض مستوى التكبير',
    }, { status: 400 });
  }

  const t0 = Date.now();
  const args = [
    '--bbox', bbox.join(','),
    '--zoom', String(zoom),
    '--conf', String(conf),
    '--grid', String(grid),
  ];

  try {
    const { stdout, stderr, code } = await runTileDetect(args);

    if (code !== 0) {
      const errMsg = stderr.slice(-500) || stdout.slice(-500);
      // Check for missing ultralytics
      if (errMsg.includes('ultralytics') || errMsg.includes('No module')) {
        return NextResponse.json({
          error: 'ai_not_installed',
          hint:  'pip install ultralytics',
        }, { status: 503 });
      }
      return NextResponse.json({
        error:   'detection_failed',
        details: errMsg,
      }, { status: 500 });
    }

    // Parse JSON output from Python script
    const jsonStart = stdout.indexOf('{');
    if (jsonStart === -1) {
      return NextResponse.json({
        error:   'no_json_output',
        stdout:  stdout.slice(-300),
      }, { status: 500 });
    }

    const result = JSON.parse(stdout.slice(jsonStart));
    return NextResponse.json({
      ...result,
      elapsed_ms: Date.now() - t0,
    });

  } catch (e: any) {
    if (e.message === 'timeout') {
      return NextResponse.json({
        error: 'timeout',
        hint:  'الكشف استغرق أكثر من 90 ثانية — قلل حجم المنطقة أو استخدم grid=2',
      }, { status: 504 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
