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

function normalizeOutgoing(item: Record<string, unknown>) {
  return {
    id:           item.id,
    ref:          item.reference_number,
    subject:      item.subject,
    to:           item.recipient_name,
    to_org:       item.recipient_organization,
    department:   item.department_name,
    priority:     item.priority || 'normal',
    status:       item.status,
    date:         item.sent_date || item.created_at,
    created_at:   item.created_at,
    type:         'outgoing',
  };
}

function normalizeMemoOut(item: Record<string, unknown>) {
  return {
    id:           item.id,
    ref:          item.reference_number,
    subject:      item.subject,
    to:           item.recipient_dept_name || 'داخلي',
    to_org:       null,
    department:   item.sender_dept_name,
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
    const [outRes, memoRes] = await Promise.all([
      fetch(`${BACKEND}/api/v1/correspondence/outgoing-letters?limit=${limit}`, { headers }),
      fetch(`${BACKEND}/api/v1/correspondence/internal-memos?limit=${limit}`, { headers }),
    ]);

    const outgoing = outRes.ok  ? await outRes.json()  : [];
    const memos    = memoRes.ok ? await memoRes.json() : [];

    const outList  = Array.isArray(outgoing) ? outgoing : (outgoing.items || outgoing.data || []);
    const memoList = Array.isArray(memos)    ? memos    : (memos.items    || memos.data    || []);

    const combined = [
      ...outList.map((x: Record<string, unknown>) => normalizeOutgoing(x)),
      ...memoList.map((x: Record<string, unknown>) => normalizeMemoOut(x)),
    ].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());

    return NextResponse.json({ data: combined });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
