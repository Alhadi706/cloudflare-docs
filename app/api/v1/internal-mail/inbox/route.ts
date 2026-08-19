import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:7860';

// Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
function resolveTenantId(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

function forwardHeaders(req: NextRequest): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'X-Tenant-ID':   resolveTenantId(req),
    'X-Tenant-Code': req.headers.get('x-verified-tenant-code') || '',
    'Authorization': req.headers.get('authorization')  || `Bearer ${req.cookies.get('auth_token')?.value || ''}`,
  };
}

function normalizeIncoming(item: Record<string, unknown>) {
  return {
    id:           item.id,
    ref:          item.reference_number,
    subject:      item.subject,
    from:         item.sender_name,
    from_org:     item.sender_organization,
    department:   item.department_name,
    priority:     item.priority || 'normal',
    status:       item.status,
    date:         item.received_date || item.created_at,
    created_at:   item.created_at,
    type:         'incoming',
  };
}

function normalizeMemo(item: Record<string, unknown>) {
  return {
    id:           item.id,
    ref:          item.reference_number,
    subject:      item.subject,
    from:         item.sender_dept_name || 'داخلي',
    from_org:     null,
    department:   item.recipient_dept_name,
    priority:     item.priority || 'normal',
    status:       item.status,
    date:         item.sent_date || item.created_at,
    created_at:   item.created_at,
    type:         'memo',
  };
}

export async function GET(req: NextRequest) {
  if (!resolveTenantId(req)) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const headers = forwardHeaders(req);
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') || '40';

  try {
    const [incRes, memoRes] = await Promise.all([
      fetch(`${BACKEND}/api/v1/correspondence/incoming-letters?limit=${limit}`, { headers }),
      fetch(`${BACKEND}/api/v1/correspondence/internal-memos?limit=${limit}`, { headers }),
    ]);

    const incoming = incRes.ok  ? await incRes.json()  : [];
    const memos    = memoRes.ok ? await memoRes.json() : [];

    const incList  = Array.isArray(incoming) ? incoming : (incoming.items || incoming.data || []);
    const memoList = Array.isArray(memos)    ? memos    : (memos.items    || memos.data    || []);

    const combined = [
      ...incList.map((x: Record<string, unknown>) => normalizeIncoming(x)),
      ...memoList.map((x: Record<string, unknown>) => normalizeMemo(x)),
    ].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());

    return NextResponse.json({ data: combined });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
