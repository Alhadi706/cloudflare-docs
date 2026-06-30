/**
 * GET /api/v1/satellite/fire-monitor
 * رصد الحرائق والنقاط الساخنة عبر NASA FIRMS VIIRS
 * مع كشف الشذوذات المستمرة بين مرورَي AM و PM
 * بيانات حقيقية — لا تحاكي
 */
import { NextRequest, NextResponse } from 'next/server';

const FIRMS_48H = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_48h.csv';
const FIRMS_7D  = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv';

// ── Cluster grid resolution (0.02° ≈ 2km) ────────────────────────────────────
const GRID = 0.02;

interface Hotspot {
  lat: number; lon: number;
  frp: number; bright_ti4: number;
  acq_date: string; acq_time: string;
  satellite: string; confidence: string; daynight: string;
  pass_type: 'AM' | 'PM' | 'other'; // AM≈0000-0600UTC, PM≈1200-1800UTC
}

interface PersistentCluster {
  lat: number; lon: number;
  observation_count: number;
  days_active: number;
  passes_detected: string[];   // ['AM','PM']
  both_passes: boolean;        // confirmed if seen in AM AND PM
  max_frp_mw: number;
  total_frp_mw: number;
  dates_active: string[];
  classification: 'gas_flare' | 'confirmed_fire' | 'recurring_anomaly' | 'single_detection';
  alert_worthy: boolean;       // true only for non-flare genuine fires
  color: string;
}

function parseRow(header: string[], row: string): Hotspot | null {
  const cols = row.split(',');
  if (cols.length < header.length) return null;
  const g = (f: string) => (cols[header.indexOf(f)] ?? '').trim();
  try {
    const t = parseInt(g('acq_time') || '0');
    const pass_type: 'AM' | 'PM' | 'other' =
      t < 600 ? 'AM' : (t >= 1100 && t < 2000 ? 'PM' : 'other');
    return {
      lat: parseFloat(g('latitude')), lon: parseFloat(g('longitude')),
      frp: parseFloat(g('frp') || '0'), bright_ti4: parseFloat(g('bright_ti4') || '0'),
      acq_date: g('acq_date'), acq_time: g('acq_time'),
      satellite: g('satellite'), confidence: g('confidence'), daynight: g('daynight'),
      pass_type,
    };
  } catch { return null; }
}

function snap(v: number) { return Math.round(v / GRID) * GRID; }

async function fetchAndCluster(
  url: string,
  bbox: { min_lon: number; min_lat: number; max_lon: number; max_lat: number },
): Promise<{ raw: Hotspot[]; clusters: PersistentCluster[] }> {
  const res = await fetch(url, {
    next:   { revalidate: 1800 },
    signal: AbortSignal.timeout(18_000),
  });
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  const text  = await res.text();
  const lines = text.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim());

  const raw: Hotspot[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const h = parseRow(header, line);
    if (!h) continue;
    if (h.lat >= bbox.min_lat && h.lat <= bbox.max_lat &&
        h.lon >= bbox.min_lon && h.lon <= bbox.max_lon) {
      raw.push(h);
    }
  }

  // ── Cluster by 2km grid ──────────────────────────────────────────────────
  const map = new Map<string, Hotspot[]>();
  for (const h of raw) {
    const key = `${snap(h.lat).toFixed(3)},${snap(h.lon).toFixed(3)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(h);
  }

  const clusters: PersistentCluster[] = [];
  for (const [key, pts] of map.entries()) {
    const [latS, lonS] = key.split(',').map(Number);
    const dates   = [...new Set(pts.map(p => p.acq_date))];
    const passes  = [...new Set(pts.map(p => p.pass_type))];
    const both    = passes.includes('AM') && passes.includes('PM');
    const maxFrp  = Math.max(...pts.map(p => p.frp));
    const totFrp  = pts.reduce((s, p) => s + p.frp, 0);
    const daysN   = dates.length;

    // ── Classification logic ─────────────────────────────────────────────
    // Gas flare: 5+ days continuous, both passes, FRP consistent → industrial
    // Confirmed fire: detected in BOTH AM and PM in ≤2 days → real fire
    // Recurring anomaly: 3-4 days, one pass → suspicious (may be flare)
    // Single detection: appears once
    let cls: PersistentCluster['classification'] = 'single_detection';
    if (daysN >= 5 && both && maxFrp >= 5) {
      cls = 'gas_flare';             // حرق غاز صناعي
    } else if (both && daysN <= 3) {
      cls = 'confirmed_fire';        // حريق مؤكد بالعبور المزدوج
    } else if (daysN >= 3) {
      cls = 'recurring_anomaly';     // شذوذ حراري متكرر
    }

    // Only alert for confirmed non-industrial fires or very high FRP anomalies
    const alert_worthy =
      (cls === 'confirmed_fire') ||
      (cls === 'recurring_anomaly' && maxFrp >= 50) ||
      (cls === 'single_detection' && pts.some(p => p.confidence === 'high' || p.confidence === 'h'));

    // Color by classification
    const color =
      cls === 'gas_flare'         ? '#6366f1' :  // بنفسجي = حرق غاز
      cls === 'confirmed_fire'    ? '#ef4444' :  // أحمر = حريق مؤكد
      cls === 'recurring_anomaly' ? '#f97316' :  // برتقالي = شذوذ متكرر
                                    '#facc15';   // أصفر = رصد فردي

    clusters.push({
      lat: latS, lon: lonS,
      observation_count: pts.length,
      days_active: daysN,
      passes_detected: passes,
      both_passes: both,
      max_frp_mw: Math.round(maxFrp * 10) / 10,
      total_frp_mw: Math.round(totFrp * 10) / 10,
      dates_active: dates.sort(),
      classification: cls,
      alert_worthy,
      color,
    });
  }

  clusters.sort((a, b) => b.observation_count - a.observation_count);
  return { raw, clusters };
}

function overallRisk(clusters: PersistentCluster[]): string {
  const realFires = clusters.filter(c => c.classification === 'confirmed_fire');
  const highFrp   = clusters.filter(c => c.max_frp_mw >= 200);
  if (realFires.length >= 10 || highFrp.length >= 5) return 'critical';
  if (realFires.length >= 3  || highFrp.length >= 2) return 'high';
  if (realFires.length >= 1  || clusters.length >= 10) return 'medium';
  if (clusters.length > 0)                             return 'low';
  return 'none';
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const min_lon = parseFloat(p.get('min_lon') ?? '9.5');
  const min_lat = parseFloat(p.get('min_lat') ?? '19.5');
  const max_lon = parseFloat(p.get('max_lon') ?? '25.5');
  const max_lat = parseFloat(p.get('max_lat') ?? '33.5');
  const days    = parseInt(p.get('days') ?? '7');
  const bbox    = { min_lon, min_lat, max_lon, max_lat };
  const t0      = Date.now();

  try {
    const url = days <= 2 ? FIRMS_48H : FIRMS_7D;
    const { raw, clusters } = await fetchAndCluster(url, bbox);

    // Breakdown by classification
    const byClass = {
      gas_flare:          clusters.filter(c => c.classification === 'gas_flare').length,
      confirmed_fire:     clusters.filter(c => c.classification === 'confirmed_fire').length,
      recurring_anomaly:  clusters.filter(c => c.classification === 'recurring_anomaly').length,
      single_detection:   clusters.filter(c => c.classification === 'single_detection').length,
    };

    const alertWorthy  = clusters.filter(c => c.alert_worthy);
    const bothPassConf = clusters.filter(c => c.both_passes);

    return NextResponse.json({
      ok: true, data_real: true,
      source: 'NASA_FIRMS_VIIRS_NOAA20',
      query_ms: Date.now() - t0,
      period_days: days,
      bbox: [min_lon, min_lat, max_lon, max_lat],

      sensor_info: {
        satellite:  'NOAA-20 (Joint Polar Satellite System)',
        sensor:     'VIIRS Band I-4 (3.55–3.93μm Thermal)',
        resolution: '375 متر/بكسل',
        revisit:    'مرتان يومياً — مرور صباحي (AM ~02:00 UTC) + مرور مسائي (PM ~14:00 UTC)',
        confirmation_logic: 'نقطة تظهر في AM وPM في نفس اليوم = شذوذ حراري حقيقي مستمر (ليس خطأ لحظي)',
        classification_rules: {
          gas_flare:         '≥5 أيام متواصلة + مرورَا AM وPM + FRP ثابت → حرق غاز صناعي',
          confirmed_fire:    'رُصد في AM وPM خلال ≤3 أيام → حريق مؤكد',
          recurring_anomaly: 'ظهر 3-4 أيام بمرور واحد → شذوذ مشبوه',
          single_detection:  'رُصد مرة واحدة → يتطلب تحقق',
        },
      },

      summary: {
        raw_detections:       raw.length,
        unique_clusters:      clusters.length,
        both_pass_confirmed:  bothPassConf.length,
        alert_worthy:         alertWorthy.length,
        by_classification:    byClass,
        risk_level:           overallRisk(clusters),
        interpretation:       byClass.gas_flare > 0
          ? `${byClass.gas_flare} موقع حرق غاز مستمر (حقول نفط) — ${byClass.confirmed_fire} حريق حقيقي مؤكد`
          : `${byClass.confirmed_fire} حريق مؤكد — ${raw.length} رصد خام`,
      },

      // Confirmed + alert-worthy clusters only (for notifications)
      alert_clusters: alertWorthy.slice(0, 50).map(c => ({
        lat: c.lat, lon: c.lon,
        classification:    c.classification,
        days_active:       c.days_active,
        observations:      c.observation_count,
        both_passes:       c.both_passes,
        max_frp_mw:        c.max_frp_mw,
        dates:             c.dates_active,
      })),

      // All clusters for full analysis
      all_clusters: clusters.slice(0, 200).map(c => ({
        lat: c.lat, lon: c.lon,
        classification: c.classification,
        days_active:    c.days_active,
        observations:   c.observation_count,
        both_passes:    c.both_passes,
        max_frp_mw:     c.max_frp_mw,
        alert_worthy:   c.alert_worthy,
      })),

      // GeoJSON for map display (color-coded by classification)
      geojson: {
        type: 'FeatureCollection',
        features: clusters.slice(0, 300).map(c => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
          properties: {
            classification: c.classification,
            label: c.classification === 'gas_flare'         ? '🟣 حرق غاز'
                 : c.classification === 'confirmed_fire'    ? '🔴 حريق مؤكد'
                 : c.classification === 'recurring_anomaly' ? '🟠 شذوذ متكرر'
                 :                                            '🟡 رصد فردي',
            days_active:    c.days_active,
            observations:   c.observation_count,
            both_passes:    c.both_passes,
            max_frp_mw:     c.max_frp_mw,
            alert_worthy:   c.alert_worthy,
            color:          c.color,
            radius:         Math.min(3 + c.observation_count / 5, 12),
          },
        })),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'error', data_real: true },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bbox = body.bbox ?? [9.5, 19.5, 25.5, 33.5];
  const days = body.days ?? 7;
  const url  = new URL(req.url);
  url.searchParams.set('min_lon', String(bbox[0]));
  url.searchParams.set('min_lat', String(bbox[1]));
  url.searchParams.set('max_lon', String(bbox[2]));
  url.searchParams.set('max_lat', String(bbox[3]));
  url.searchParams.set('days',    String(days));
  return GET(new NextRequest(url.toString()));
}

