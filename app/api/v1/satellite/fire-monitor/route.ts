/**
 * GET /api/v1/satellite/fire-monitor — v3 (ثلاثة أقمار صناعية + أرشيف محلي)
 * رصد الحرائق: NOAA-20 + SNPP + MODIS — 6 مرورات يومياً
 *
 * التحسينات في v3:
 * + SNPP VIIRS: مدار مختلف (~01:30+~01:05 UTC offset) — يكشف ما تفوته NOAA-20
 * + MODIS Terra/Aqua: مرورَان إضافيَان — أساسي للحرائق تحت الدخان الكثيف
 * + أرشيف محلي: يتراكم تلقائياً مع كل استدعاء → ينمو إلى سجل تاريخي
 * + تصنيف urban_incident للحوادث الأمنية الحضرية
 * فلاتر: ?no_flares=true، ?fresh_only=true، ?urban_only=true
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchAndStore, parseFIRMScsv } from '@/lib/firms-archive';

const FIRMS_48H_SNPP = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_48h.csv';
const FIRMS_7D_SNPP  = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_7d.csv';
const FIRMS_48H = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_48h.csv';
const FIRMS_7D  = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv';
const MODIS_7D  = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_7d.csv';
const MODIS_48H = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_48h.csv';

const GRID = 0.025; // 2.8km grid — slightly larger to merge adjacent pixels

// ── Libyan cities (26 cities with urban fire detection radius) ────────────────
const LIBYA_CITIES = [
  { name: 'طرابلس',    lat: 32.90, lon: 13.18, r: 40 },
  { name: 'بنغازي',   lat: 32.11, lon: 20.07, r: 35 },
  { name: 'مصراتة',   lat: 32.37, lon: 15.09, r: 25 },
  { name: 'الزاوية',  lat: 32.75, lon: 12.72, r: 20 },
  { name: 'العجيلات', lat: 32.76, lon: 12.72, r: 15 },
  { name: 'الخمس',    lat: 32.65, lon: 14.27, r: 20 },
  { name: 'زليتن',    lat: 32.47, lon: 14.57, r: 18 },
  { name: 'سرت',      lat: 31.20, lon: 16.59, r: 20 },
  { name: 'أجدابيا',  lat: 30.75, lon: 20.23, r: 18 },
  { name: 'البيضاء',  lat: 32.76, lon: 21.75, r: 18 },
  { name: 'درنة',     lat: 32.76, lon: 22.64, r: 15 },
  { name: 'طبرق',     lat: 32.08, lon: 23.98, r: 15 },
  { name: 'غريان',    lat: 32.17, lon: 13.01, r: 18 },
  { name: 'ترهونة',   lat: 32.46, lon: 13.64, r: 15 },
  { name: 'بني وليد', lat: 31.75, lon: 13.99, r: 12 },
  { name: 'سبها',     lat: 27.03, lon: 14.43, r: 20 },
  { name: 'مرزق',     lat: 25.90, lon: 13.89, r: 15 },
  { name: 'القطرون',  lat: 24.93, lon: 14.59, r: 12 },
  { name: 'الكفرة',   lat: 24.18, lon: 23.31, r: 15 },
  { name: 'أوباري',   lat: 27.78, lon: 12.77, r: 12 },
  { name: 'غدامس',    lat: 30.13, lon:  9.50, r: 10 },
  { name: 'تاجوراء',  lat: 32.88, lon: 13.35, r: 12 },
  { name: 'جنزور',    lat: 32.90, lon: 13.02, r: 12 },
  { name: 'البريقة',  lat: 30.40, lon: 19.57, r: 12 },
  { name: 'ودان',     lat: 29.16, lon: 16.14, r: 10 },
  { name: 'نالوت',    lat: 31.87, lon: 10.99, r: 10 },
];

// ── Known industrial flare sites (suppress false alerts) ─────────────────────
const FLARE_SITES = [
  { lat: 28.90, lon: 19.77, name: 'حقل وافا/رمله',   r: 20 },
  { lat: 29.07, lon: 19.18, name: 'حقل اللهيب',      r: 20 },
  { lat: 28.65, lon: 22.54, name: 'حقل السرير',       r: 20 },
  { lat: 27.90, lon: 12.88, name: 'حقل الشرارة',     r: 25 },
  { lat: 27.25, lon: 14.35, name: 'حقل الحساونة',    r: 20 },
  { lat: 30.50, lon: 20.00, name: 'ميناء رأس لانوف', r: 15 },
  { lat: 30.05, lon: 20.07, name: 'ميناء السدرة',    r: 15 },
  { lat: 29.02, lon: 21.20, name: 'حقل نافورة',      r: 20 },
  { lat: 29.55, lon: 21.38, name: 'حقل نافورة شمال', r: 15 },
];

function distKm(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371;
  const dLat = (la2-la1)*Math.PI/180, dLon = (lo2-lo1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function nearestCity(lat: number, lon: number) {
  let best: { name: string; km: number } | null = null;
  for (const c of LIBYA_CITIES) {
    const km = distKm(lat, lon, c.lat, c.lon);
    if (km <= c.r && (!best || km < best.km)) best = { name: c.name, km: Math.round(km) };
  }
  return best;
}

function nearestFlare(lat: number, lon: number): string | null {
  for (const f of FLARE_SITES) {
    if (distKm(lat, lon, f.lat, f.lon) <= f.r) return f.name;
  }
  return null;
}

interface Hotspot {
  lat: number; lon: number;
  frp: number; bright_ti4: number;
  acq_date: string; acq_time: string;
  satellite: string; confidence: string; daynight: string;
  pass_type: 'AM' | 'PM' | 'other'; // AM≈0000-0600UTC, PM≈1200-1800UTC
}

interface FireCluster {
  lat: number; lon: number;
  observation_count: number;
  days_active: number;
  passes_detected: string[];
  both_passes: boolean;
  max_frp_mw: number;
  avg_frp_mw: number;
  total_frp_mw: number;
  first_detected: string;
  last_detected: string;
  dates_active: string[];
  confidences: string[];
  classification: 'gas_flare' | 'confirmed_fire' | 'urban_incident' | 'recurring_anomaly' | 'single_detection';
  alert_worthy: boolean;
  alert_reason: string;
  color: string;
  urban: boolean;
  nearest_city: string | null;
  nearest_city_km: number | null;
  known_flare_site: string | null;
  fresh_24h: boolean;
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

function hoursAgoDate(n: number) {
  const d = new Date(Date.now() - n * 3600_000);
  return d.toISOString().slice(0, 10);
}
function hoursAgoTime(n: number) {
  const d = new Date(Date.now() - n * 3600_000);
  return d.getUTCHours() * 100 + d.getUTCMinutes();
}

async function fetchAndCluster(
  primaryUrl: string,
  snppUrl:    string,
  modisUrl:   string,
  bbox: { min_lon: number; min_lat: number; max_lon: number; max_lat: number },
  fresh24hDate: string,
  fresh24hTime: number,
): Promise<{ raw: Hotspot[]; clusters: FireCluster[]; sensors_active: string[] }> {
  // Fetch all 3 sensors in parallel — resilient (ok if some fail)
  const [primaryText, snppText, modisText] = await Promise.all([
    fetch(primaryUrl, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(20_000) }).then(r => r.ok ? r.text() : '').catch(() => ''),
    fetch(snppUrl,    { next: { revalidate: 1800 }, signal: AbortSignal.timeout(20_000) }).then(r => r.ok ? r.text() : '').catch(() => ''),
    fetch(modisUrl,   { next: { revalidate: 1800 }, signal: AbortSignal.timeout(20_000) }).then(r => r.ok ? r.text() : '').catch(() => ''),
  ]);
  if (!primaryText) throw new Error('FIRMS primary (NOAA-20) feed failed');

  const sensorsActive: string[] = ['NOAA-20'];
  if (snppText)  sensorsActive.push('SNPP');
  if (modisText) sensorsActive.push('MODIS');

  function parseCSV(text: string, sensorLabel: string): Hotspot[] {
    const lines  = text.trim().split('\n');
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map(h => h.trim());
    const out: Hotspot[] = [];
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const h = parseRow(header, line);
      if (!h) continue;
      if (h.lat >= bbox.min_lat && h.lat <= bbox.max_lat &&
          h.lon >= bbox.min_lon && h.lon <= bbox.max_lon) {
        out.push({ ...h, satellite: sensorLabel });
      }
    }
    return out;
  }

  const raw: Hotspot[] = [
    ...parseCSV(primaryText, 'NOAA-20'),
    ...parseCSV(snppText,    'SNPP'),
    ...parseCSV(modisText,   'MODIS'),
  ];

  // ── Cluster by 2km grid ──────────────────────────────────────────────────
  const map = new Map<string, Hotspot[]>();
  for (const h of raw) {
    const key = `${snap(h.lat).toFixed(3)},${snap(h.lon).toFixed(3)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(h);
  }

  const clusters: FireCluster[] = [];
  for (const [key, pts] of map.entries()) {
    const [latS, lonS] = key.split(',').map(Number);
    const dates   = [...new Set(pts.map(p => p.acq_date))].sort();
    const passes  = [...new Set(pts.map(p => p.pass_type))];
    const confs   = [...new Set(pts.map(p => p.confidence))];
    const both    = passes.includes('AM') && passes.includes('PM');
    const maxFrp  = Math.max(...pts.map(p => p.frp));
    const totFrp  = pts.reduce((s, p) => s + p.frp, 0);
    const avgFrp  = totFrp / pts.length;
    const daysN   = dates.length;
    const firstDetected = dates[0];
    const lastDetected  = dates[dates.length - 1];

    // Fresh: at least one detection on/after 24h-ago timestamp
    const fresh24h = pts.some(p =>
      p.acq_date > fresh24hDate ||
      (p.acq_date === fresh24hDate && parseInt(p.acq_time) >= fresh24hTime)
    );

    const city  = nearestCity(latS, lonS);
    const urban = city !== null;
    const flare = nearestFlare(latS, lonS);
    const hasHighConf = confs.includes('high') || confs.includes('h');
    const hasNomConf  = confs.includes('nominal') || confs.includes('n');

    let cls: FireCluster['classification'] = 'single_detection';
    let alertReason = '';

    if (urban && daysN >= 2) {
      cls = 'urban_incident';
      alertReason = `حريق متكرر في ${city!.name} (${city!.km} كم) — ${daysN} أيام`;
    } else if (urban && fresh24h && (hasHighConf || hasNomConf)) {
      cls = 'urban_incident';
      alertReason = `حريق جديد في ${city!.name} — FRP=${maxFrp.toFixed(1)} MW`;
    } else if (daysN >= 5 && both && maxFrp >= 5 && (flare || maxFrp >= 20)) {
      cls = 'gas_flare';
      alertReason = flare ? `حرق غاز — ${flare}` : `حرق غاز مستمر FRP=${maxFrp.toFixed(0)} MW`;
    } else if (both && daysN <= 3) {
      cls = 'confirmed_fire';
      alertReason = `مؤكد AM+PM — FRP=${maxFrp.toFixed(1)} MW`;
    } else if (daysN >= 3) {
      cls = 'recurring_anomaly';
      alertReason = `شذوذ متكرر ${daysN} أيام`;
    } else if (hasHighConf) {
      alertReason = 'رصد مفرد ثقة عالية';
    }

    const alertWorthy =
      cls === 'urban_incident'                          ||
      cls === 'confirmed_fire'                          ||
      (cls === 'recurring_anomaly' && maxFrp >= 30)     ||
      (cls === 'recurring_anomaly' && urban)            ||
      (cls === 'single_detection'  && hasHighConf)      ||
      (cls === 'single_detection'  && urban && maxFrp >= 5);

    const color =
      cls === 'urban_incident'    ? '#f43f5e' :  // وردي-أحمر = حادث حضري
      cls === 'confirmed_fire'    ? '#ef4444' :  // أحمر = حريق مؤكد
      cls === 'gas_flare'         ? '#6366f1' :  // بنفسجي = حرق غاز
      cls === 'recurring_anomaly' ? '#f97316' :  // برتقالي = شذوذ متكرر
                                    '#facc15';   // أصفر = رصد فردي

    clusters.push({
      lat: latS, lon: lonS,
      observation_count: pts.length, days_active: daysN,
      passes_detected: passes, both_passes: both,
      max_frp_mw: Math.round(maxFrp*10)/10, avg_frp_mw: Math.round(avgFrp*10)/10,
      total_frp_mw: Math.round(totFrp*10)/10,
      first_detected: firstDetected, last_detected: lastDetected,
      dates_active: dates, confidences: confs,
      classification: cls, alert_worthy: alertWorthy, alert_reason: alertReason,
      color, urban, nearest_city: city?.name ?? null, nearest_city_km: city?.km ?? null,
      known_flare_site: flare, fresh_24h: fresh24h,
    });
  }

  clusters.sort((a, b) => {
    const p: Record<string,number> = { urban_incident:0, confirmed_fire:1, recurring_anomaly:2, single_detection:3, gas_flare:4 };
    return (p[a.classification]??5) - (p[b.classification]??5) || b.max_frp_mw - a.max_frp_mw;
  });
  return { raw, clusters, sensors_active: sensorsActive };
}

function overallRisk(clusters: FireCluster[]): string {
  const urban   = clusters.filter(c => c.classification === 'urban_incident').length;
  const real    = clusters.filter(c => c.classification === 'confirmed_fire').length;
  const highFrp = clusters.filter(c => c.max_frp_mw >= 100).length;
  if (urban >= 3 || real >= 10 || highFrp >= 5) return 'critical';
  if (urban >= 1 || real >= 3  || highFrp >= 2) return 'high';
  if (real >= 1  || clusters.filter(c=>c.alert_worthy).length >= 5) return 'medium';
  if (clusters.length > 0) return 'low';
  return 'none';
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const min_lon = parseFloat(p.get('min_lon') ?? '9.5');
  const min_lat = parseFloat(p.get('min_lat') ?? '19.5');
  const max_lon = parseFloat(p.get('max_lon') ?? '25.5');
  const max_lat = parseFloat(p.get('max_lat') ?? '33.5');
  const days      = parseInt(p.get('days')        ?? '7');
  const urbanOnly = p.get('urban_only')  === 'true';
  const freshOnly = p.get('fresh_only')  === 'true';
  const noFlares  = p.get('no_flares')  !== 'false'; // default: hide industrial flares from default view
  const bbox      = { min_lon, min_lat, max_lon, max_lat };
  const t0        = Date.now();
  const fresh24hDate = hoursAgoDate(24);
  const fresh24hTime = hoursAgoTime(24);

  // Background: store to local archive (non-blocking)
  fetchAndStore().catch(() => {});

  try {
    const use48h = days <= 2;
    const { raw, clusters, sensors_active } = await fetchAndCluster(
      use48h ? FIRMS_48H      : FIRMS_7D,
      use48h ? FIRMS_48H_SNPP : FIRMS_7D_SNPP,
      use48h ? MODIS_48H      : MODIS_7D,
      bbox, fresh24hDate, fresh24hTime,
    );

    let filtered = clusters;
    if (urbanOnly) filtered = filtered.filter(c => c.urban);
    if (freshOnly) filtered = filtered.filter(c => c.fresh_24h);
    if (noFlares)  filtered = filtered.filter(c => c.classification !== 'gas_flare');

    const byClass = {
      urban_incident:    clusters.filter(c => c.classification === 'urban_incident').length,
      gas_flare:         clusters.filter(c => c.classification === 'gas_flare').length,
      confirmed_fire:    clusters.filter(c => c.classification === 'confirmed_fire').length,
      recurring_anomaly: clusters.filter(c => c.classification === 'recurring_anomaly').length,
      single_detection:  clusters.filter(c => c.classification === 'single_detection').length,
    };

    const alertWorthy = filtered.filter(c => c.alert_worthy);
    const urbanFires  = clusters.filter(c => c.classification === 'urban_incident');
    const freshFires  = clusters.filter(c => c.fresh_24h && c.classification !== 'gas_flare');

    return NextResponse.json({
      ok: true, data_real: true,
      source: 'NASA_FIRMS_VIIRS_NOAA20',
      query_ms: Date.now() - t0,
      period_days: days,
      bbox: [min_lon, min_lat, max_lon, max_lat],
      filters_applied: { urban_only: urbanOnly, fresh_only: freshOnly, no_flares: noFlares },

      sensor_info: {
        satellites:  sensors_active,
        passes_per_day: sensors_active.length * 2,
        revisit_note: `${sensors_active.length} أقمار × مرورين/يوم = ${sensors_active.length * 2} مرورات يومياً (نافذة 3-4 ساعات بين كل مرور)`,
        detection_limit: '~0.5-1.0 MW FRP — حرق الإطارات (1-10 MW) يُرصد إذا استمر >15 دقيقة',
        smoke_note: 'الدخان الكثيف قد يُخفي الإشارة الحرارية — MODIS أقل تأثراً بالدخان من VIIRS',
        blind_spots: 'حرائق <0.3 MW أو أقل من 15 دقيقة بين المرورَين',
      },

      summary: {
        raw_detections:   raw.length,
        total_clusters:   clusters.length,
        filtered_clusters: filtered.length,
        alert_worthy:     alertWorthy.length,
        urban_incidents:  urbanFires.length,
        fresh_24h_fires:  freshFires.length,
        by_classification: byClass,
        risk_level:       overallRisk(clusters),
        urban_cities:     [...new Set(urbanFires.map(c => c.nearest_city).filter(Boolean))],
      },

      alert_clusters: alertWorthy.map(c => ({
        lat: c.lat, lon: c.lon,
        classification: c.classification,
        alert_reason:   c.alert_reason,
        days_active:    c.days_active,
        observations:   c.observation_count,
        both_passes:    c.both_passes,
        max_frp_mw:     c.max_frp_mw,
        first_detected: c.first_detected,
        last_detected:  c.last_detected,
        dates_active:   c.dates_active,
        urban:          c.urban,
        nearest_city:   c.nearest_city,
        nearest_city_km: c.nearest_city_km,
        fresh_24h:      c.fresh_24h,
        color:          c.color,
      })),

      all_clusters: filtered.map(c => ({
        lat: c.lat, lon: c.lon,
        classification:  c.classification,
        days_active:     c.days_active,
        observations:    c.observation_count,
        both_passes:     c.both_passes,
        max_frp_mw:      c.max_frp_mw,
        avg_frp_mw:      c.avg_frp_mw,
        alert_worthy:    c.alert_worthy,
        alert_reason:    c.alert_reason,
        urban:           c.urban,
        nearest_city:    c.nearest_city,
        nearest_city_km: c.nearest_city_km,
        known_flare_site: c.known_flare_site,
        first_detected:  c.first_detected,
        last_detected:   c.last_detected,
        dates_active:    c.dates_active,
        confidences:     c.confidences,
        fresh_24h:       c.fresh_24h,
        color:           c.color,
      })),

      geojson: {
        type: 'FeatureCollection',
        features: filtered.slice(0, 400).map(c => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
          properties: {
            classification: c.classification,
            label: c.classification === 'urban_incident'    ? `🔴 حادث حضري — ${c.nearest_city}`
                 : c.classification === 'confirmed_fire'    ? '🔥 حريق مؤكد (AM+PM)'
                 : c.classification === 'gas_flare'         ? '🟣 حرق غاز'
                 : c.classification === 'recurring_anomaly' ? '🟠 شذوذ متكرر'
                 :                                            '🟡 رصد فردي',
            detail: `FRP: ${c.max_frp_mw} MW | ${c.days_active} أيام | ${c.dates_active.join(', ')}`,
            days_active:  c.days_active,
            observations: c.observation_count,
            max_frp_mw:   c.max_frp_mw,
            alert_worthy: c.alert_worthy,
            alert_reason: c.alert_reason,
            color:        c.color,
            radius: c.classification === 'urban_incident' ? Math.min(6 + c.max_frp_mw/3, 18)
                  : c.classification === 'confirmed_fire'  ? Math.min(5 + c.max_frp_mw/5, 15)
                  : Math.min(3 + c.observation_count/3, 10),
            urban:     c.urban,
            city:      c.nearest_city,
            fresh_24h: c.fresh_24h,
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

