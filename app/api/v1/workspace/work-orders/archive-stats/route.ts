/**
 * /api/v1/workspace/work-orders/archive-stats
 * GET → return work order archive statistics
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://127.0.0.1:7860';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';

export async function GET(req: NextRequest) {
  const tenantId = req.headers.get('x-verified-tenant-id') || req.headers.get('x-tenant-id') || req.headers.get('X-Tenant-ID') || '';

  // Try backend
  try {
    const res = await fetch(`${BACKEND}/api/v1/workspace/work-orders/archive-stats`, {
      headers: { 'X-Tenant-ID': tenantId, 'X-Staff-Api-Key': STAFF_API_KEY, 'X-Tenant-Code': 'INFRA_OPS' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return NextResponse.json(await res.json());
  } catch { /* fall through */ }

  // Also try legacy path
  try {
    const res = await fetch(`${BACKEND}/work-orders/archive-stats`, {
      headers: { 'X-Tenant-ID': tenantId, 'X-Staff-Api-Key': STAFF_API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return NextResponse.json(await res.json());
  } catch { /* fall through */ }

  return NextResponse.json({ success: false, total: 0, archived: 0, count: 0 });
}
