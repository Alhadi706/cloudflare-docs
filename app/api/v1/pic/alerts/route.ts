/**
 * GET  /api/v1/pic/alerts           — list alerts
 * POST /api/v1/pic/alerts?ack=id    — acknowledge alert
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractTenantId } from '@/lib/backendProxy';
import { listAlerts, acknowledgeAlert } from '@/lib/picDB';

export async function GET(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const unreadOnly = req.nextUrl.searchParams.get('unread') === '1';
  try {
    const alerts = await listAlerts(tenantId, unreadOnly);
    return NextResponse.json({ ok: true, alerts, total: alerts.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const alertId = req.nextUrl.searchParams.get('ack');
  if (!alertId) return NextResponse.json({ ok: false, error: 'ack=id required' }, { status: 400 });

  let body: any = {};
  try { body = await req.json(); } catch { /* optional */ }

  try {
    await acknowledgeAlert(alertId, body.user_id ?? 'system');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
