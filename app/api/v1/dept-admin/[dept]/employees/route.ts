/**
 * /api/v1/dept-admin/[dept]/employees
 * GET → proxy to backend at port 7860, returns employees from HR
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://127.0.0.1:7860';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';

async function fetchEmployees(dept: string, tenantId: string, query: string) {
  const url = `${BACKEND}/api/v1/dept-admin/${dept}/employees${query}`;
  const res = await fetch(url, {
    headers: {
      'x-tenant-id': tenantId,
      'X-Staff-Api-Key': STAFF_API_KEY,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });
  return res;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { dept: string } }
) {
  const { dept } = params;
  const url = new URL(req.url);
  const query = url.search;

  // Tenant identity must come from middleware's verified JWT — never a client-supplied
  // header, and never a "system tenant" fallback (removed: it previously let any
  // caller with an invalid/missing tenant fall through to a fixed tenant's HR data).
  const tenantId = (req.headers.get('x-verified-tenant-id') || '').trim();
  if (!tenantId) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  try {
    const res = await fetchEmployees(dept, tenantId, query);
    if (!res.ok) {
      return NextResponse.json({ error: 'فشل جلب الموظفين' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'تعذر الاتصال بخادم الموارد البشرية' }, { status: 503 });
  }
}
