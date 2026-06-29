import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getPushSubsByRoles } from '@/lib/push-store';
import { sendPushToMany } from '@/lib/push-sender';

const CRON_SECRET = process.env.GIS_CRON_SECRET || 'gis-cron-2026';
const GIS_DIR     = path.join(process.cwd(), '.data', 'gis');
const REGISTRY_FILE   = path.join(GIS_DIR, 'alerts-registry.json');
const NOTIF_FILE      = path.join(GIS_DIR, 'notifications.json');

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson<T>(file: string, data: T) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

export async function GET(_req: NextRequest) {
  const alerts = readJson<any[]>(REGISTRY_FILE, []);
  const notifs  = readJson<any[]>(NOTIF_FILE, []);
  const active  = alerts.filter(a => a.active !== false);
  return NextResponse.json({
    ok: true,
    alerts_count:       active.length,
    notifications_count: notifs.length,
    last_check:          notifs.length ? notifs[notifs.length - 1]?.created_at : null,
  });
}

// Default tenant for GIS cron (configurable via env)
const DEFAULT_TENANT_ID = process.env.GIS_TENANT_ID || 'aaaaaaaa-0000-4000-a000-000000000001';
const NOTIFY_ROLES      = ['supervisor', 'manager', 'dept_manager', 'admin', 'founder'];

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret') || req.headers.get('X-Cron-Secret');
  if (cronSecret !== CRON_SECRET) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const body   = await req.json().catch(() => ({}));
  const alerts = readJson<any[]>(REGISTRY_FILE, []);

  const targets = body.alert_id
    ? alerts.filter(a => a.id === body.alert_id)
    : alerts.filter(a => a.active !== false);

  if (!targets.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No active alerts' });
  }

  const notifs     = readJson<any[]>(NOTIF_FILE, []);
  const newNotifs: any[] = [];

  for (const alert of targets) {
    const severity = alert.severity || 'warning';
    const notif = {
      id:          `gis-notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at:  new Date().toISOString(),
      alert_id:    alert.id,
      type:        alert.alert_type || 'gis_alert',
      title:       alert.title || 'تنبيه GIS',
      description: alert.description || '',
      severity,
      lat:         alert.lat ?? null,
      lng:         alert.lng ?? null,
      location:    alert.location || '',
      source:      alert.source || '',
      tenant_id:   DEFAULT_TENANT_ID,
      notified:    false,
    };
    newNotifs.push(notif);
  }

  writeJson(NOTIF_FILE, [...notifs, ...newNotifs].slice(-1000));

  // Push notifications to supervisors
  try {
    const subs = getPushSubsByRoles(DEFAULT_TENANT_ID, NOTIFY_ROLES);
    if (subs.length > 0 && newNotifs.length > 0) {
      const latest = newNotifs[0];
      await sendPushToMany(DEFAULT_TENANT_ID, subs, {
        title: `⚠️ ${latest.title}`,
        body:  latest.description || `${newNotifs.length} تنبيه GIS جديد`,
        tag:   'gis-alert',
        url:   `/m?tab=gis-alerts&notif_id=${latest.id}`,
        urgency: latest.severity === 'critical' ? 'high' : 'normal',
      });
    }
  } catch (_e) {
    // Push failures are non-fatal
  }

  return NextResponse.json({ ok: true, processed: newNotifs.length, notifications: newNotifs });
}
