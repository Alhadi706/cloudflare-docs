import { NextRequest, NextResponse } from 'next/server';
import { getMaterialRequestById } from '@/lib/material-requests-store';

type RequestEvent = {
  at?: string;
  action?: string;
  by?: string;
  notes?: string;
  created_at?: string;
};

function normalizeRole(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

function normalizeEvents(events: unknown): Array<{ at: string; action: string; by: string; notes?: string }> {
  if (!Array.isArray(events)) return [];

  return events
    .map((ev) => {
      const e = (ev || {}) as RequestEvent;
      const at = e.at || e.created_at || '';
      return {
        at,
        action: String(e.action || ''),
        by: String(e.by || 'system'),
        notes: e.notes ? String(e.notes) : undefined,
      };
    })
    .filter((e) => e.at && e.action)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Tenant identity must come from middleware's verified JWT — never a client-supplied header/cookie.
  const tenantId = (req.headers.get('x-verified-tenant-id') || '').trim();
  if (!tenantId) {
    return NextResponse.json({ detail: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }

  const request = getMaterialRequestById(tenantId, params.id);
  if (!request) {
    return NextResponse.json({ detail: 'الطلب غير موجود' }, { status: 404 });
  }

  const events = normalizeEvents(request.events);
  return NextResponse.json({ request, timeline: events, events, source: 'gateway_store' });
}
