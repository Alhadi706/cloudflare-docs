/**
 * /api/v1/intelligence/degradation-zones
 * GET → degradation zone analysis (tries backend, graceful fallback)
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://127.0.0.1:7860';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';

export async function GET(req: NextRequest) {
  // Tenant identity must come from middleware's verified JWT — never a client-supplied header.
  const tenantId = (req.headers.get('x-verified-tenant-id') || '').trim();
  if (!tenantId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${BACKEND}/api/v1/intelligence/degradation-zones`,
      {
        headers: { 'X-Tenant-ID': tenantId, 'X-Staff-Api-Key': STAFF_API_KEY, 'X-Tenant-Code': 'INFRA_OPS' },
        signal: AbortSignal.timeout(12000),
      }
    );
    if (res.ok) return NextResponse.json(await res.json());
  } catch { /* fall through */ }

  return NextResponse.json({ zones: [], total: 0 });
}
