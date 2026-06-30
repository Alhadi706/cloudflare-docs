/**
 * /api/control-center/alarms
 * GET → /api/v1/ctrl/alarms (with optional filters)
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const p = new URLSearchParams();
    if (searchParams.get('state'))      p.set('state', searchParams.get('state')!);
    if (searchParams.get('severity'))   p.set('severity', searchParams.get('severity')!);
    if (searchParams.get('station_id')) p.set('station_id', searchParams.get('station_id')!);
    if (searchParams.get('limit'))      p.set('limit', searchParams.get('limit')!);
    const res = await fetch(`${B}/api/v1/ctrl/alarms?${p}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}
