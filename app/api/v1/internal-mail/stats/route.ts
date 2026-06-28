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

export async function GET(req: NextRequest) {
  const headers = forwardHeaders(req);
  try {
    const res = await fetch(`${BACKEND}/api/v1/correspondence/statistics`, { headers });
    if (!res.ok) return NextResponse.json({ data: { inbox_total: 0, inbox_unread: 0, outbox_total: 0 } });
    const raw = await res.json();
    // Normalize to what InternalMailTab expects: { inbox_total, inbox_unread, outbox_total }
    const stats = {
      inbox_total:   (raw.incoming_letters?.total  || 0) + (raw.internal_memos?.total || 0),
      inbox_unread:  raw.incoming_letters?.pending || 0,
      outbox_total:  (raw.outgoing_letters?.total  || 0) + (raw.internal_memos?.sent  || 0),
      incoming:      raw.incoming_letters || {},
      outgoing:      raw.outgoing_letters || {},
      memos:         raw.internal_memos   || {},
    };
    return NextResponse.json({ data: stats });
  } catch {
    return NextResponse.json({ data: { inbox_total: 0, inbox_unread: 0, outbox_total: 0 } });
  }
}
