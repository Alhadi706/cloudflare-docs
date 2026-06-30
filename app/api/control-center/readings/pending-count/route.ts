/**
 * /api/control-center/readings/pending-count
 * GET → badge counts for supervisor and dept pending approvals
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(`${B}/api/v1/ctrl/readings/pending-count`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, supervisor: 0, dept: 0, total: 0, error: String(e) }, { status: 200 });
  }
}
