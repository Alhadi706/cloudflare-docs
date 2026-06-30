/**
 * /api/control-center/employees
 * Proxy → GET /api/v1/ctrl/employees (hr_core.employees الموظفون النشطون)
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

export async function GET() {
  try {
    const res = await fetch(`${B}/api/v1/ctrl/employees`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 502 });
  }
}
