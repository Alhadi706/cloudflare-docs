import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:7860';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TENANT = 'aaaaaaaa-0000-4000-a000-000000000001';

function forwardHeaders(req: NextRequest): Record<string, string> {
  const rawTenant = (req.headers.get('x-tenant-id') || req.cookies.get('tenant_id')?.value || '').trim();
  return {
    'Content-Type':  'application/json',
    'X-Tenant-ID':   UUID_RE.test(rawTenant) ? rawTenant : DEFAULT_TENANT,
    'X-Tenant-Code': req.headers.get('x-tenant-code')  || req.cookies.get('tenant_code')?.value || '',
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
