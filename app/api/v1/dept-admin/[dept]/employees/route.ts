/**
 * /api/v1/dept-admin/[dept]/employees
 * GET → proxy to backend at port 7860, returns employees from HR
 *       Falls back to system tenant if user's tenant is not registered in dept-admin.
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://127.0.0.1:7860';
const STAFF_API_KEY = process.env.STAFF_API_KEY || '';
/** System-level tenant that always has HR data in the backend */
const SYSTEM_TENANT_ID = 'aaaaaaaa-0000-4000-a000-000000000001';

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

  const requestedTenantId =
    req.headers.get('x-tenant-id') ||
    req.headers.get('X-Tenant-ID') ||
    SYSTEM_TENANT_ID;

  try {
    // First try with the user's tenant ID
    let res = await fetchEmployees(dept, requestedTenantId, query);

    // If tenant not found or any 4xx error, retry with system tenant
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({})) as any;
      if (
        errorBody?.error === 'tenant_not_found' ||
        res.status === 404 ||
        res.status === 400
      ) {
        res = await fetchEmployees(dept, SYSTEM_TENANT_ID, query);
      }
      if (!res.ok) {
        return NextResponse.json({ error: 'فشل جلب الموظفين' }, { status: res.status });
      }
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'تعذر الاتصال بخادم الموارد البشرية' }, { status: 503 });
  }
}
