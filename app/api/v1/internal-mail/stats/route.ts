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

export async function GET(req: NextRequest) {
  if (!resolveTenantId(req)) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
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
