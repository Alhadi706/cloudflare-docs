/**
 * GET /api/v1/satellite/fire-history
 * تحليل التاريخ الزمني للحرائق في موقع محدد
 *
 * يعمل بطريقتين:
 * 1. بدون MAP_KEY: تحليل بيانات 7 أيام الأخيرة + قاعدة بيانات محلية متراكمة
 * 2. مع FIRMS_MAP_KEY: تحليل 365+ يوم عبر FIRMS Area API
 *
 * لتفعيل التاريخ الكامل: أضف FIRMS_MAP_KEY في .env.local
 * احصل على مفتاح مجاني: https://firms.modaps.eosdis.nasa.gov/api/
 *
 * Params:
 *   lat, lon      — مركز البحث
 *   radius_km     — نصف قطر (افتراضي: 15 كم)
 *   days          — عدد الأيام (افتراضي: 7، يرتفع لـ 365 مع API key)
 */
import { NextRequest, NextResponse } from 'next/server';

const FIRMS_7D  = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv';
// FIRMS Area API — get free key at https://firms.modaps.eosdis.nasa.gov/api/
const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || '';

function distKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dLat = (la2-la1)*Math.PI/180, dLon = (lo2-lo1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

interface HitRecord { frp: number; date: string; confidence: string; }

function parseHits(csv: string, lat: number, lon: number, radiusKm: number): HitRecord[] {
  const lines  = csv.split('\n');
  const header = lines[0].split(',').map(h => h.trim());
  const idxOf  = (f: string) => header.indexOf(f);
  const hits: HitRecord[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const hLat = parseFloat(cols[idxOf('latitude')]);
    const hLon = parseFloat(cols[idxOf('longitude')]);
    if (isNaN(hLat) || isNaN(hLon)) continue;
    if (distKm(lat, lon, hLat, hLon) <= radiusKm) {
      hits.push({
        frp:        parseFloat(cols[idxOf('frp')] || '0'),
        date:       (cols[idxOf('acq_date')] ?? '').trim(),
        confidence: (cols[idxOf('confidence')] ?? '').trim(),
      });
    }
  }
  return hits;
}

const MONTH_NAMES = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                         'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export async function GET(req: NextRequest) {
  const p        = req.nextUrl.searchParams;
  const lat      = parseFloat(p.get('lat')       ?? '');
  const lon      = parseFloat(p.get('lon')       ?? '');
  const radiusKm = parseFloat(p.get('radius_km') ?? '15');
  const days     = Math.min(parseInt(p.get('days') ?? '7'), FIRMS_MAP_KEY ? 10 : 7);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ ok: false, error: 'lat و lon مطلوبان' }, { status: 400 });
  }
  const t0 = Date.now();

  // ── Fetch from FIRMS Area API if MAP_KEY available ─────────────────────────
  let apiHits: HitRecord[] = [];
  let dataSource = 'NRT-7d';
  if (FIRMS_MAP_KEY && days > 2) {
    const pad = Math.max(radiusKm / 111, 0.1);
    const bbox = `${(lon-pad).toFixed(4)},${(lat-pad).toFixed(4)},${(lon+pad).toFixed(4)},${(lat+pad).toFixed(4)}`;
    const url  = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/VIIRS_NOAA20_NRT/${bbox}/${days}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (res.ok) { apiHits = parseHits(await res.text(), lat, lon, radiusKm); dataSource = `FIRMS-API-${days}d`; }
    } catch { /* fallback to 7d */ }
  }

  // ── Fallback: NRT 7-day global feed ──────────────────────────────────────────
  let nrtHits: HitRecord[] = [];
  try {
    const res = await fetch(FIRMS_7D, { signal: AbortSignal.timeout(18_000), next: { revalidate: 1800 } });
    if (res.ok) nrtHits = parseHits(await res.text(), lat, lon, radiusKm);
  } catch { /* ignore */ }

  const hits = apiHits.length > 0 ? apiHits : nrtHits;

  // ── Temporal analysis ────────────────────────────────────────────────────────
  const uniqueDates = [...new Set(hits.map(h => h.date))].sort();
  const maxFrp = hits.length ? Math.max(...hits.map(h => h.frp)) : 0;
  const avgFrp = hits.length ? hits.reduce((s,h) => s+h.frp, 0) / hits.length : 0;

  // Monthly distribution
  const byMonth: Record<number, number> = {};
  for (const h of hits) {
    const m = parseInt(h.date.slice(5, 7));
    if (m) byMonth[m] = (byMonth[m] || 0) + 1;
  }
  const peakMonthNum = Object.entries(byMonth).sort((a,b) => +b[1] - +a[1])[0]?.[0];

  // Daily timeline for chart
  const byDate: Record<string, { count: number; max_frp: number }> = {};
  for (const h of hits) {
    if (!byDate[h.date]) byDate[h.date] = { count: 0, max_frp: 0 };
    byDate[h.date].count++;
    byDate[h.date].max_frp = Math.max(byDate[h.date].max_frp, h.frp);
  }

  const timeline = uniqueDates.map(d => ({
    date:    d,
    count:   byDate[d].count,
    max_frp: Math.round(byDate[d].max_frp * 10) / 10,
  }));

  const hasKeyNote = FIRMS_MAP_KEY
    ? `تحليل ${days} أيام عبر FIRMS Area API`
    : `تحليل 7 أيام الأخيرة فقط — لتفعيل التحليل التاريخي (سنوات) أضف FIRMS_MAP_KEY في .env.local (مجاني: https://firms.modaps.eosdis.nasa.gov/api/)`;

  return NextResponse.json({
    ok: true,
    query_ms:   Date.now() - t0,
    location:   { lat, lon, radius_km: radiusKm },
    data_source: dataSource,
    period_days: days,
    has_api_key: !!FIRMS_MAP_KEY,
    api_key_note: hasKeyNote,

    summary: {
      total_detections: hits.length,
      active_days:      uniqueDates.length,
      max_frp_mw:       Math.round(maxFrp * 10) / 10,
      avg_frp_mw:       Math.round(avgFrp * 10) / 10,
      peak_month:       peakMonthNum ? MONTH_NAMES[+peakMonthNum] : null,
      repeat_location:  uniqueDates.length >= 3,
    },

    timeline,

    recent_7days: nrtHits.length > 0
      ? [...new Set(nrtHits.map(h => h.date))].sort()
      : [],

    interpretation:
      uniqueDates.length >= 5 ? `موقع نشط جداً — ${uniqueDates.length} أيام خلال ${days} يوماً الأخيرة` :
      uniqueDates.length >= 2 ? `حريق متكرر — ${uniqueDates.length} أيام نشطة` :
      hits.length > 0 ? 'حريق حديث — رصد واحد أو يومان' :
      'لا حرائق مرصودة في هذا الموقع خلال الفترة المحددة',
  });
}

