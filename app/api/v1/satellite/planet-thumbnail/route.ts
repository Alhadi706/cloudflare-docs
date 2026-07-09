/**
 * GET /api/v1/satellite/planet-thumbnail
 * Proxy Planet thumbnail — يفحص الأرشيف المحلي أولاً، ثم يستدعي Planet API
 * يعمل حتى بعد انتهاء الاشتراك (يخدم من الكاش المحلي)
 */
import { NextRequest, NextResponse } from 'next/server';
import fs   from 'fs';
import path from 'path';

const THUMB_DIR = path.join(process.cwd(), '.data', 'planet-archive', 'thumbnails');

export async function GET(req: NextRequest) {
  const sceneId  = req.nextUrl.searchParams.get('scene_id');
  const itemType = req.nextUrl.searchParams.get('item_type') ?? 'PSScene';

  if (!sceneId) {
    return NextResponse.json({ error: 'scene_id required' }, { status: 400 });
  }

  // ── 1. Check local archive first ─────────────────────────────────────────
  const localPath = path.join(THUMB_DIR, `${sceneId}.png`);
  if (fs.existsSync(localPath)) {
    try {
      const buf = fs.readFileSync(localPath);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type':  'image/png',
          'Cache-Control': 'public, max-age=86400',
          'X-Source':      'local-archive',
        },
      });
    } catch { /* fall through to Planet API */ }
  }

  // ── 2. Fetch from Planet API ──────────────────────────────────────────────
  const key = process.env.PLANET_API_KEY ?? '';
  if (!key) {
    return new NextResponse(null, { status: 404 });
  }

  const auth     = `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
  const thumbUrl = `https://tiles.planet.com/data/v1/item-types/${itemType}/items/${sceneId}/thumb`;

  try {
    const res = await fetch(thumbUrl, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return new NextResponse(null, { status: res.status });

    const imgBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? 'image/png';

    // Auto-save to local archive for future use
    try {
      fs.mkdirSync(THUMB_DIR, { recursive: true });
      fs.writeFileSync(localPath, Buffer.from(imgBuffer));
    } catch { /* best-effort save */ }

    return new NextResponse(imgBuffer, {
      status: 200,
      headers: {
        'Content-Type':  contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Source':      'planet-api',
      },
    });
  } catch (e: any) {
    return new NextResponse(null, { status: 502 });
  }
}
