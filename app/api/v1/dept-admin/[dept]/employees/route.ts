/**
 * /api/v1/dept-admin/[dept]/employees
 * GET → proxy to backend at port 7860, returns employees from HR
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://127.0.0.1:7860';

export async function GET(
  req: NextRequest,
  { params }: { params: { dept: string } }
) {
  const { dept } = params;
  const url = new URL(req.url);
  const query = url.search; // preserve ?limit= ?q= etc.

  const tenantId =
    req.headers.get('x-tenant-id') ||
    req.headers.get('X-Tenant-ID') ||
    'aaaaaaaa-0000-4000-a000-000000000001';

  try {
    const backendUrl = `${BACKEND}/api/v1/dept-admin/${dept}/employees${query}`;
    const res = await fetch(backendUrl, {
      headers: {
        'x-tenant-id': tenantId,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'تعذر الاتصال بخادم الموارد البشرية' }, { status: 503 });
  }
}
