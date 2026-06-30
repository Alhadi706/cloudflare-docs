/**
 * /api/v1/corrosion/pipeline-map
 * Proxies to /api/v1/corrosion/cp-pipelines on the backend,
 * which has the real pipeline + sessions data.
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://127.0.0.1:7860';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';

function getTenantId(req: NextRequest): string {
  return (
    req.headers.get('x-tenant-id') ||
    req.headers.get('X-Tenant-ID') ||
    'aaaaaaaa-0000-4000-a000-000000000001'
  );
}

export async function GET(req: NextRequest) {
  const tenantId = getTenantId(req);
  try {
    const res = await fetch(`${BACKEND}/api/v1/corrosion/cp-pipelines?page=1&page_size=200&include_sessions=true`, {
      headers: {
        'X-Tenant-ID': tenantId,
        'X-Staff-Api-Key': STAFF_API_KEY,
        'X-Tenant-Code': 'INFRA_OPS',
      },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({ pipelines: [] }));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ pipelines: [] });
  }
}
