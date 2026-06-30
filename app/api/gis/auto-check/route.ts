import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getPushSubsByRoles } from '@/lib/push-store';
import { sendPushToMany } from '@/lib/push-sender';
import {
  searchSTAC,
  polygonToBbox,
  expandBbox,
  computeChangeIndicators,
  today,
  daysAgo,
  type STACScene,
} from '@/lib/stac';

const CRON_SECRET = process.env.GIS_CRON_SECRET || 'gis-cron-2026';
const GIS_DIR         = path.join(process.cwd(), '.data', 'gis');
const MOBILE_DIR      = path.join(process.cwd(), '.data', 'mobile-field');
const REGISTRY_FILE   = path.join(GIS_DIR, 'alerts-registry.json');
const NOTIF_FILE      = path.join(GIS_DIR, 'notifications.json');
const SAT_STATE_FILE  = path.join(GIS_DIR, 'sat-state.json');

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson<T>(file: string, data: T) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

// ─── Satellite state store ────────────────────────────────────────────────────
// Persists last-checked scene per alert for comparison
interface SatAlertState {
  last_scene_id:   string;
  last_scene_date: string;
  last_checked:    string;     // ISO
  reference_stats: {
    vegetation_pct:    number | null;
    not_vegetated_pct: number | null;
    water_pct:         number | null;
    clouds_pct:        number | null;
  } | null;
}
type SatState = Record<string, SatAlertState>;

function readSatState(): SatState {
  return readJson<SatState>(SAT_STATE_FILE, {});
}
function writeSatState(state: SatState) {
  writeJson(SAT_STATE_FILE, state);
}

// ─── Compute bbox from alert ──────────────────────────────────────────────────
function alertBbox(alert: Record<string, unknown>): [number, number, number, number] | null {
  try {
    if (Array.isArray(alert.polygon) && alert.polygon.length >= 3) {
      return polygonToBbox(alert.polygon as [number, number][]);
    }
    if (Array.isArray(alert.bbox) && alert.bbox.length === 4) {
      return alert.bbox as [number, number, number, number];
    }
    // Point fallback (lat/lng fields)
    if (typeof alert.lat === 'number' && typeof alert.lng === 'number') {
      const delta = 0.05; // ~5km buffer
      return [alert.lng - delta, alert.lat - delta, alert.lng + delta, alert.lat + delta];
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Minimum hours between satellite checks per alert ─────────────────────────
const MIN_CHECK_INTERVAL_H = 12;

export async function GET(_req: NextRequest) {
  const alerts = readJson<any[]>(REGISTRY_FILE, []);
  const notifs  = readJson<any[]>(NOTIF_FILE, []);
  const satState = readSatState();
  const active  = alerts.filter(a => a.active !== false);

  // Build per-alert satellite status
  const sat_status = active.map(a => {
    const st = satState[a.id];
    return {
      alert_id:        a.id,
      name:            a.name || a.corridor_name || '',
      has_bbox:        !!alertBbox(a as Record<string, unknown>),
      last_scene_date: st?.last_scene_date ?? null,
      last_checked:    st?.last_checked    ?? null,
    };
  });

  return NextResponse.json({
    ok:                  true,
    alerts_count:        active.length,
    notifications_count: notifs.length,
    last_check:          notifs.length ? notifs[notifs.length - 1]?.created_at : null,
    satellite_enabled:   true,
    sat_status,
  });
}

// Default tenant for GIS cron (configurable via env)
const DEFAULT_TENANT_ID = process.env.GIS_TENANT_ID || 'aaaaaaaa-0000-4000-a000-000000000001';
const NOTIFY_ROLES      = ['supervisor', 'manager', 'dept_manager', 'admin', 'founder'];

// ─── Satellite-powered check for a single alert ───────────────────────────────
async function runSatelliteCheck(
  alert: Record<string, unknown>,
  satState: SatState,
  force: boolean,
): Promise<{
  notif:    Record<string, unknown> | null;
  newState: SatAlertState | null;
  reason:   string;
}> {
  const alertId = alert.id as string;

  const bbox = alertBbox(alert);
  if (!bbox) return { notif: null, newState: null, reason: 'no_bbox' };

  // Rate-limit: skip if checked recently
  const existing = satState[alertId];
  if (!force && existing?.last_checked) {
    const hoursSince = (Date.now() - new Date(existing.last_checked).getTime()) / 3600000;
    if (hoursSince < MIN_CHECK_INTERVAL_H) {
      return { notif: null, newState: null, reason: `checked_recently_${hoursSince.toFixed(1)}h_ago` };
    }
  }

  // Search for latest Sentinel-2 scene (last 7 days, cloud < 40%)
  const searchBbox = expandBbox(bbox, 0.05);
  let latestScene: STACScene | null = null;
  try {
    const scenes = await searchSTAC({
      bbox:        searchBbox,
      date_from:   daysAgo(7),
      date_to:     today(),
      collections: ['sentinel-2-l2a'],
      max_cloud:   40,
      limit:       5,
    });
    if (scenes.length > 0) {
      latestScene = scenes.reduce((a, b) =>
        (a.cloud_cover ?? 100) < (b.cloud_cover ?? 100) ? a : b
      );
    }
  } catch {
    return { notif: null, newState: null, reason: 'stac_error' };
  }

  if (!latestScene) {
    return { notif: null, newState: null, reason: 'no_scene_last_7_days' };
  }

  // Same scene as last check → nothing new
  if (!force && existing?.last_scene_id === latestScene.id) {
    return { notif: null, newState: null, reason: 'same_scene_no_update' };
  }

  const newState: SatAlertState = {
    last_scene_id:   latestScene.id,
    last_scene_date: latestScene.date,
    last_checked:    new Date().toISOString(),
    reference_stats: latestScene.statistics ? {
      vegetation_pct:    latestScene.statistics.vegetation_pct,
      not_vegetated_pct: latestScene.statistics.not_vegetated_pct,
      water_pct:         latestScene.statistics.water_pct,
      clouds_pct:        latestScene.statistics.clouds_pct,
    } : null,
  };

  // First-time baseline: store, do NOT notify yet
  if (!existing?.reference_stats) {
    return {
      notif: null,
      newState,
      reason: `baseline_stored_scene:${latestScene.id}_date:${latestScene.date}`,
    };
  }

  // Compare current scene statistics vs stored reference
  const refScene: STACScene = {
    id: existing.last_scene_id, collection: 'sentinel-2-l2a',
    date: existing.last_scene_date, cloud_cover: null,
    bbox: searchBbox, thumbnail_url: null, platform: 'sentinel-2',
    source: 'cdse', data_real: true,
    statistics: existing.reference_stats ? {
      vegetation_pct:    existing.reference_stats.vegetation_pct,
      not_vegetated_pct: existing.reference_stats.not_vegetated_pct,
      water_pct:         existing.reference_stats.water_pct,
      cloud_shadow_pct:  null,
      clouds_pct:        existing.reference_stats.clouds_pct,
    } : null,
  };

  const change = computeChangeIndicators(refScene, latestScene);

  // Only notify if real change detected above minimum threshold
  const alertTypes = (alert.alert_types as string[]) ?? [];
  const sensitivity = (alert.sensitivity as string) ?? 'medium';
  const minRisk = sensitivity === 'high' ? 'low' : sensitivity === 'low' ? 'high' : 'medium';
  const riskOrder = { none: 0, low: 1, medium: 2, high: 3 };
  const shouldNotify = riskOrder[change.risk_level] >= riskOrder[minRisk];

  if (!shouldNotify || change.detected_changes.length === 0) {
    return {
      notif: null,
      newState,
      reason: `no_significant_change_risk:${change.risk_level}_sensitivity:${sensitivity}`,
    };
  }

  // Build notification from real satellite evidence
  const changeText = change.detected_changes.join(' | ');
  const notif: Record<string, unknown> = {
    id:           `sat-notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at:   new Date().toISOString(),
    alert_id:     alertId,
    type:         alertTypes[0] ?? 'satellite_change',
    title:        `رصد تغيير: ${(alert.corridor_name as string) ?? (alert.name as string) ?? alertId}`,
    description:  changeText,
    severity:     change.risk_level === 'high' ? 'critical' : change.risk_level === 'medium' ? 'warning' : 'info',
    lat:          typeof alert.lat === 'number' ? alert.lat : ((bbox[1] + bbox[3]) / 2),
    lng:          typeof alert.lng === 'number' ? alert.lng : ((bbox[0] + bbox[2]) / 2),
    location:     (alert.location as string) ?? (alert.corridor_name as string) ?? '',
    source:       'real_sentinel2_stac',
    source_scene: latestScene.id,
    scene_date:   latestScene.date,
    confidence:   change.confidence,
    risk_level:   change.risk_level,
    change_indicators: {
      vegetation_delta:    change.vegetation_delta,
      not_vegetated_delta: change.not_vegetated_delta,
      water_delta:         change.water_delta,
    },
    tenant_id:    DEFAULT_TENANT_ID,
    notified:     false,
  };

  return { notif, newState, reason: `change_detected:${change.risk_level}` };
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret') || req.headers.get('X-Cron-Secret');
  if (cronSecret !== CRON_SECRET) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const body   = await req.json().catch(() => ({}));
  const force  = body.force === true;
  const alerts = readJson<any[]>(REGISTRY_FILE, []);

  const targets = body.alert_id
    ? alerts.filter(a => a.id === body.alert_id)
    : alerts.filter(a => a.active !== false);

  if (!targets.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No active alerts' });
  }

  const notifs   = readJson<any[]>(NOTIF_FILE, []);
  const satState = readSatState();
  const newNotifs: any[]  = [];
  const satLog:   any[]   = [];

  // ── Satellite-powered check per alert ─────────────────────────────────
  for (const alert of targets) {
    try {
      const { notif, newState, reason } = await runSatelliteCheck(
        alert as Record<string, unknown>,
        satState,
        force,
      );

      satLog.push({ alert_id: alert.id, reason });

      if (newState) {
        satState[alert.id] = newState;
      }
      if (notif) {
        newNotifs.push(notif);
      }
    } catch (err) {
      satLog.push({ alert_id: alert.id, reason: `error: ${err instanceof Error ? err.message : err}` });
    }
  }

  // Persist satellite state + notifications
  writeSatState(satState);
  if (newNotifs.length > 0) {
    writeJson(NOTIF_FILE, [...notifs, ...newNotifs].slice(-1000));
  }

  // ── Fire monitoring check (NASA FIRMS VIIRS) ─────────────────────────
  let fireNotif: any = null;
  try {
    const FIRE_STATE_FILE = path.join(GIS_DIR, 'fire-state.json');
    interface FireState { last_check: string; last_count: number; last_max_frp: number; }
    const fireState = readJson<FireState>(FIRE_STATE_FILE, { last_check: '', last_count: 0, last_max_frp: 0 });

    // Rate-limit: check every 6 hours
    const hrsSinceFireCheck = fireState.last_check
      ? (Date.now() - new Date(fireState.last_check).getTime()) / 3_600_000
      : 999;

    if (hrsSinceFireCheck >= 6 || force) {
      const firmsUrl = new URL(`http://localhost:${process.env.PORT || 3000}/api/v1/satellite/fire-monitor`);
      firmsUrl.searchParams.set('days', '2');
      const fireRes = await fetch(firmsUrl.toString(), { signal: AbortSignal.timeout(20_000) });

      if (fireRes.ok) {
        const fireData = await fireRes.json();
        const summary  = fireData.summary ?? {};
        const count    = summary.total_hotspots ?? 0;
        const maxFrp   = summary.max_frp_mw ?? 0;
        const risk     = summary.risk_level ?? 'none';
        const highConf = summary.high_confidence ?? 0;

        // Only alert if high-confidence fires increased significantly OR very high FRP
        const countDelta = count - fireState.last_count;
        const shouldAlert =
          (highConf >= 5 && (countDelta > 50 || fireState.last_count === 0)) ||
          (maxFrp >= 200) ||
          (risk === 'critical' && countDelta > 100);

        writeJson(FIRE_STATE_FILE, { last_check: new Date().toISOString(), last_count: count, last_max_frp: maxFrp });

        satLog.push({ alert_id: 'fire-monitor', reason: `${count} hotspots, ${highConf} high-conf, FRP=${maxFrp}MW, risk=${risk}` });

        if (shouldAlert) {
          fireNotif = {
            id:          `fire-${Date.now()}`,
            created_at:  new Date().toISOString(),
            read:        false,
            alert_id:    'fire-monitor',
            alert_name:  '🔥 رصد الحرائق',
            corridor:    'Libya Wide',
            severity:    maxFrp >= 200 || highConf >= 20 ? 'critical' : 'warning',
            summary:     `رُصد ${count} نقطة حرارية في ليبيا خلال 48 ساعة — ${highConf} بثقة عالية | Max FRP: ${maxFrp} MW`,
            description: `بيانات NOAA-20 VIIRS: إجمالي ${count} نقطة، أعلى طاقة إشعاعية ${maxFrp} MW. النقاط العالية الثقة: ${highConf}. مستوى الخطر: ${risk}`,
            total_events:   count,
            critical_count: highConf,
            warning_count:  count - highConf,
            events:         fireData.hotspots?.slice(0, 10) ?? [],
            geojson:        fireData.geojson ?? null,
            image_source:   'NASA_FIRMS_VIIRS_NOAA20',
            checked_at:     new Date().toISOString(),
            triggered_by:   'cron',
          };
          newNotifs.push(fireNotif);
          writeJson(NOTIF_FILE, [...notifs, ...newNotifs].slice(-1000));
        }
      }
    } else {
      satLog.push({ alert_id: 'fire-monitor', reason: `rate-limited (${hrsSinceFireCheck.toFixed(1)}h ago)` });
    }
  } catch (fireErr) {
    satLog.push({ alert_id: 'fire-monitor', reason: `error: ${fireErr instanceof Error ? fireErr.message : fireErr}` });
  }

  // ── Push notifications for significant detections ─────────────────────
  try {
    const criticalNotifs = newNotifs.filter(n => n.severity === 'critical' || n.severity === 'warning');
    if (criticalNotifs.length > 0) {
      const subs = getPushSubsByRoles(DEFAULT_TENANT_ID, NOTIFY_ROLES);
      if (subs.length > 0) {
        const latest = criticalNotifs[0];
        await sendPushToMany(DEFAULT_TENANT_ID, subs, {
          title: `🛰️ ${latest.title}`,
          body:  latest.description || `رُصد تغيير فضائي جديد (${criticalNotifs.length} تنبيه)`,
          tag:   'sat-alert',
          url:   `/m?tab=gis-alerts&notif_id=${latest.id}`,
          urgency: latest.severity === 'critical' ? 'high' : 'normal',
        });
      }

      // ── Broadcast to mobile polling channel (Flutter app) ────────────────
      try {
        fs.mkdirSync(MOBILE_DIR, { recursive: true });
        const mobileFile = path.join(MOBILE_DIR, `notifications_${DEFAULT_TENANT_ID}.json`);
        let mobileNotifs: any[] = [];
        try { mobileNotifs = JSON.parse(fs.readFileSync(mobileFile, 'utf8')); } catch { /* new file */ }

        for (const cn of criticalNotifs) {
          mobileNotifs.push({
            id:         `mob-${cn.id}-${Date.now()}`,
            created_at: new Date().toISOString(),
            read:       false,
            broadcast:  true,
            employee_no: null,
            title:   `🛰️ ${cn.title || cn.alert_name}`,
            body:    cn.summary || cn.description || `رُصد تغيير فضائي جديد`,
            url:     `/dashboard/gis-sovereignty`,
            urgency: cn.severity === 'critical' ? 'critical' : 'high',
            type:    'satellite_alert',
          });
        }
        fs.writeFileSync(mobileFile, JSON.stringify(mobileNotifs.slice(-500), null, 0));
      } catch { /* non-fatal */ }
    }
  } catch { /* Push failures are non-fatal */ }

  return NextResponse.json({
    ok:              true,
    processed:       targets.length,
    new_detections:  newNotifs.length,
    notifications:   newNotifs,
    satellite_log:   satLog,
    data_real:       true,
  });
}
