/**
 * /api/control-center/live-status
 * Proxy → GET /api/v1/ctrl/live-status
 * Used by: real-time SCADA page for live network summary
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

export async function GET() {
  try {
    const res = await fetch(`${B}/api/v1/ctrl/live-status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 503 });
  }
}
