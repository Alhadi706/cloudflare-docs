/**
 * Tile Proxy — طبقة تسميات ESRI (أسماء المدن والشوارع)
 * URL: /api/tiles/labels/{z}/{y}/{x}
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { coords: string[] } }
) {
  const [z, y, x] = params.coords;

  if (!z || !y || !x) {
    return new NextResponse('Bad request', { status: 400 });
  }

  const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`;

  try {
    const res = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TileProxy/1.0)',
        'Referer': 'https://dev.d-me.ly/',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const imageBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/png';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
