/**
 * /api/control-center/readings
 * Multi-action proxy for readings workflow:
 *
 * GET ?mode=pending&level=supervisor   → /api/v1/ctrl/readings/pending?level=supervisor
 * GET ?mode=pending&level=dept         → /api/v1/ctrl/readings/pending?level=dept
 * GET ?mode=latest                     → /api/v1/ctrl/readings/latest
 * GET ?mode=list&...filters            → /api/v1/ctrl/readings?...filters
 *
 * POST action=submit    → /api/v1/ctrl/readings/submit
 * POST action=approve   → /api/v1/ctrl/readings/{id}/approve
 * POST action=reject    → /api/v1/ctrl/readings/{id}/reject
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const B = process.env.BACKEND_URL ?? 'http://localhost:7860';

async function backendFetch(path: string, options?: RequestInit) {
  return fetch(`${B}${path}`, {
    ...options,
    signal: AbortSignal.timeout(10000),
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get('mode') || 'pending';
  const level     = searchParams.get('level') || 'supervisor';
  const stationId = searchParams.get('station_id');
  const fromDate  = searchParams.get('from_date');
  const toDate    = searchParams.get('to_date');

  try {
    if (mode === 'pending') {
      const p = new URLSearchParams({ level });
      if (stationId) p.set('station_id', stationId);
      if (fromDate)  p.set('from_date', fromDate);
      if (toDate)    p.set('to_date', toDate);
      const res = await backendFetch(`/api/v1/ctrl/readings/pending?${p}`);
      const data = await res.json();
      return NextResponse.json(data, { status: res.ok ? 200 : res.status });
    }

    if (mode === 'latest') {
      const dateParam = searchParams.get('reading_date');
      const path = dateParam
        ? `/api/v1/ctrl/readings/latest?reading_date=${dateParam}`
        : '/api/v1/ctrl/readings/latest';
      const res = await backendFetch(path);
      const data = await res.json();
      return NextResponse.json(data, { status: res.ok ? 200 : res.status });
    }

    if (mode === 'list') {
      const p = new URLSearchParams();
      if (stationId)                        p.set('station_id', stationId);
      if (searchParams.get('status'))       p.set('status', searchParams.get('status')!);
      if (searchParams.get('submitted_by')) p.set('submitted_by', searchParams.get('submitted_by')!);
      if (fromDate)                         p.set('from_date', fromDate);
      if (toDate)                           p.set('to_date', toDate);
      if (searchParams.get('limit'))        p.set('limit', searchParams.get('limit')!);
      const res = await backendFetch(`/api/v1/ctrl/readings?${p}`);
      const data = await res.json();
      return NextResponse.json(data, { status: res.ok ? 200 : res.status });
    }

    return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const action = String(body.action || 'submit');

  try {
    if (action === 'submit') {
      const res = await backendFetch('/api/v1/ctrl/readings/submit', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    if (action === 'approve') {
      const readingId = Number(body.reading_id);
      if (!readingId) return NextResponse.json({ error: 'reading_id required' }, { status: 400 });
      const res = await backendFetch(`/api/v1/ctrl/readings/${readingId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approver_id: body.approver_id ?? 0, note: body.note, level: body.level ?? 'supervisor' }),
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.ok ? 200 : res.status });
    }

    if (action === 'reject') {
      const readingId = Number(body.reading_id);
      if (!readingId) return NextResponse.json({ error: 'reading_id required' }, { status: 400 });
      const res = await backendFetch(`/api/v1/ctrl/readings/${readingId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ approver_id: body.approver_id ?? 0, reason: body.reason ?? '' }),
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.ok ? 200 : res.status });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}
