/**
 * /api/v1/workspace/work-orders/import
 * POST → import work orders from Excel file (proxy to backend)
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://127.0.0.1:7860';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';

export async function POST(req: NextRequest) {
  const tenantId = req.headers.get('x-tenant-id') || req.headers.get('X-Tenant-ID') || '';

  try {
    const formData = await req.formData();
    const res = await fetch(`${BACKEND}/api/v1/workspace/work-orders/import`, {
      method: 'POST',
      headers: {
        'X-Tenant-ID': tenantId,
        'X-Staff-Api-Key': STAFF_API_KEY,
        'X-Tenant-Code': 'INFRA_OPS',
      },
      body: formData,
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: 'تعذر الاتصال بالخادم' }, { status: 503 });
  }
}
