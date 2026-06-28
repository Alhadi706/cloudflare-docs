/**
 * ⚠️ هذا الملف لا يُستخدَم — مسار ميت
 * ─────────────────────────────────────────────────────────────────
 * nginx يُوجِّه /api/* إلى FastAPI (port 8000)، لذا هذا الكود
 * لا يصل إليه أي طلب من المتصفح.
 *
 * المسار الصحيح لـ Tile Proxy هو:
 *   /tiles/satellite/{z}/{y}/{x}  →  app/tiles/satellite/[...coords]/route.ts
 *   /tiles/labels/{z}/{y}/{x}     →  app/tiles/labels/[...coords]/route.ts
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { coords: string[] } }
) {
  // Redirect to the correct working path
  const [z, y, x] = params.coords;
  return NextResponse.redirect(
    new URL(`/tiles/satellite/${z}/${y}/${x}`, _req.url),
    { status: 301 }
  );
}
