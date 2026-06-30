/**
 * GET /api/v1/satellite/mobile-alerts
 * إشعارات الأقمار الصناعية للتطبيق المحمول
 * يُرجع آخر التنبيهات للـ Flutter app
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorize } from '@/lib/authorize';
import fs from 'fs';
import path from 'path';

const GIS_DIR   = path.join(process.cwd(), '.data', 'gis');
const NOTIF_FILE = path.join(GIS_DIR, 'notifications.json');

export async function GET(req: NextRequest) {
  const auth = authorize(req, 'workorder.view');
  if (auth instanceof NextResponse) return auth;

  const limit     = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20'), 50);
  const unreadOnly = req.nextUrl.searchParams.get('unread_only') === 'true';
  const since     = req.nextUrl.searchParams.get('since'); // ISO date string

  let notifs: any[] = [];
  try {
    notifs = JSON.parse(fs.readFileSync(NOTIF_FILE, 'utf8'));
  } catch { /* no file yet */ }

  if (since) {
    const sinceDate = new Date(since);
    notifs = notifs.filter(n => new Date(n.created_at) > sinceDate);
  }
  if (unreadOnly) {
    notifs = notifs.filter(n => !n.read);
  }

  const slice = notifs.slice(-limit).reverse();

  // تنسيق مبسط للموبايل
  const mobile = slice.map(n => ({
    id:         n.id,
    created_at: n.created_at,
    read:       n.read,
    title:      `🛰️ ${n.alert_name || n.title || 'تنبيه فضائي'}`,
    body:       n.summary || n.description || '',
    severity:   n.severity || 'info',
    alert_id:   n.alert_id,
    corridor:   n.corridor,
    url:        `/dashboard/gis-sovereignty`,
    urgency:    n.severity === 'critical' ? 'critical' : n.severity === 'warning' ? 'high' : 'normal',
    type:       'satellite_alert',
    broadcast:  true,
  }));

  return NextResponse.json({
    ok:          true,
    total:       mobile.length,
    unread:      mobile.filter(n => !n.read).length,
    alerts:      mobile,
    source:      'satellite_intelligence_center',
    data_real:   true,
  });
}
