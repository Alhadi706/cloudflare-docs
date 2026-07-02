/**
 * GET /api/v1/satellite/fire-archive
 * ──────────────────────────────────────────────────────────────────────────
 * تحليل تاريخي للحرائق في منطقة محددة وفترة زمنية محددة
 *
 * أمثلة:
 *   الجبل الأخضر (10 سنوات):
 *     ?min_lon=20.5&min_lat=32.0&max_lon=22.5&max_lat=33.0&date_from=2016-01-01&date_to=2026-12-31
 *
 *   القطرون (آخر شهر):
 *     ?lat=24.93&lon=14.58&radius_km=30&date_from=2026-06-01&date_to=2026-07-01
 *
 *   طرابلس (خلال 2023):
 *     ?lat=32.90&lon=13.18&radius_km=50&date_from=2023-01-01&date_to=2023-12-31
 *
 * Sources:
 *   - محلي: أرشيف JSON يومي يتراكم تلقائياً مع كل استدعاء
 *   - FIRMS API: مع FIRMS_MAP_KEY في .env.local (مجاني: https://firms.modaps.eosdis.nasa.gov/api/)
 *     الـ API key يُمكّن تحليل حتى 10 سنوات (VIIRS منذ 2018، MODIS منذ 2000)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  queryLocalArchive, queryFIRMSapi, listArchivedDates,
  FIRMS_MAP_KEY, type ArchivedHotspot,
} from '@/lib/firms-archive';

const MONTH_AR = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                       'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function distKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dLat = (la2-la1)*Math.PI/180, dLon = (lo2-lo1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function computeBbox(
  p: URLSearchParams,
): { bbox: { min_lon: number; min_lat: number; max_lon: number; max_lat: number }; center: [number,number] | null } {
  if (p.has('lat') && p.has('lon')) {
    const lat = parseFloat(p.get('lat')!);
    const lon = parseFloat(p.get('lon')!);
    const r   = parseFloat(p.get('radius_km') ?? '30');
    const pad = r / 111;
    return {
      bbox:   { min_lon: lon-pad, min_lat: lat-pad, max_lon: lon+pad, max_lat: lat+pad },
      center: [lat, lon],
    };
  }
  return {
    bbox: {
      min_lon: parseFloat(p.get('min_lon') ?? '9.5'),
      min_lat: parseFloat(p.get('min_lat') ?? '19.5'),
      max_lon: parseFloat(p.get('max_lon') ?? '25.5'),
      max_lat: parseFloat(p.get('max_lat') ?? '33.5'),
    },
    center: null,
  };
}

function analyzeSpots(spots: ArchivedHotspot[], dateFrom: string, dateTo: string) {
  // By year
  const byYear: Record<number, { count: number; max_frp: number; dates: Set<string>; months: Set<number> }> = {};
  // By month (across all years)
  const byMonth: Record<number, number> = {};
  // Daily timeline
  const byDate: Record<string, { count: number; max_frp: number; sensors: Set<string> }> = {};

  for (const s of spots) {
    const year  = parseInt(s.acq_date.slice(0, 4));
    const month = parseInt(s.acq_date.slice(5, 7));

    if (!byYear[year]) byYear[year] = { count: 0, max_frp: 0, dates: new Set(), months: new Set() };
    byYear[year].count++;
    byYear[year].max_frp = Math.max(byYear[year].max_frp, s.frp);
    byYear[year].dates.add(s.acq_date);
    byYear[year].months.add(month);

    byMonth[month] = (byMonth[month] || 0) + 1;

    if (!byDate[s.acq_date]) byDate[s.acq_date] = { count: 0, max_frp: 0, sensors: new Set() };
    byDate[s.acq_date].count++;
    byDate[s.acq_date].max_frp = Math.max(byDate[s.acq_date].max_frp, s.frp);
    byDate[s.acq_date].sensors.add(s.sensor);
  }

  const yearList = Object.entries(byYear).sort(([a],[b]) => +a - +b).map(([yr, d]) => ({
    year:       +yr,
    detections: d.count,
    active_days: d.dates.size,
    max_frp_mw: Math.round(d.max_frp * 10) / 10,
    active_months: [...d.months].sort((a,b)=>a-b).map(m => MONTH_AR[m]),
  }));

  const peakMonthNum = Object.entries(byMonth).sort(([,a],[,b]) => b-a)[0]?.[0];
  const peakMonth = peakMonthNum ? MONTH_AR[+peakMonthNum] : null;

  const timeline = Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, d]) => ({
    date,
    detections: d.count,
    max_frp_mw: Math.round(d.max_frp * 10) / 10,
    sensors:    [...d.sensors],
  }));

  const uniqueDates = [...new Set(spots.map(s => s.acq_date))].sort();
  const maxFrp      = spots.length ? Math.max(...spots.map(s => s.frp)) : 0;
  const avgFrp      = spots.length ? spots.reduce((sum,s) => sum+s.frp, 0) / spots.length : 0;
  const activeYears = yearList.filter(y => y.detections > 0).length;

  return {
    total_detections: spots.length,
    active_days:      uniqueDates.length,
    active_years:     activeYears,
    years_with_fire:  yearList.filter(y=>y.detections>0).map(y=>y.year),
    max_frp_mw:       Math.round(maxFrp * 10) / 10,
    avg_frp_mw:       Math.round(avgFrp * 10) / 10,
    peak_month:       peakMonth,
    repeat_location:  uniqueDates.length >= 5,
    risk_level:       activeYears >= 3 ? 'high' : uniqueDates.length >= 7 ? 'medium' : spots.length > 0 ? 'low' : 'none',
    by_year:          yearList,
    by_month:         Object.fromEntries(Object.entries(byMonth).map(([m,n]) => [MONTH_AR[+m] || m, n])),
    timeline,
    interpretation:
      activeYears >= 5 ? `موقع متكرر للحرائق جداً — نشط في ${activeYears} سنوات` :
      activeYears >= 3 ? `موقع يميل للاشتعال — نشط في ${activeYears} سنوات` :
      activeYears >= 2 ? `حريق متكرر — ظهر في ${activeYears} سنوات` :
      uniqueDates.length >= 5 ? `حريق مستمر — ${uniqueDates.length} أيام في الفترة المطلوبة` :
      spots.length > 0 ? `${spots.length} رصد في الفترة المطلوبة` :
      'لا حرائق مرصودة في هذا الموقع خلال الفترة المحددة',
  };
}

export async function GET(req: NextRequest) {
  const p         = req.nextUrl.searchParams;
  const { bbox, center } = computeBbox(p);
  const dateFrom  = p.get('date_from') || new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const dateTo    = p.get('date_to')   || new Date().toISOString().slice(0, 10);
  const radiusKm  = parseFloat(p.get('radius_km') ?? '30');
  const t0        = Date.now();

  // Validate
  if (dateFrom > dateTo) {
    return NextResponse.json({ ok: false, error: 'date_from يجب أن يكون قبل date_to' }, { status: 400 });
  }

  // 1. Try FIRMS API first (if key configured)
  let spots: ArchivedHotspot[] = [];
  let dataSource = 'local';

  if (FIRMS_MAP_KEY) {
    const apiResult = await queryFIRMSapi(bbox, dateFrom, dateTo);
    if (apiResult.spots.length > 0) {
      spots      = apiResult.spots;
      dataSource = 'firms_api';
    }
  }

  // 2. Fall back to local archive
  if (spots.length === 0) {
    spots      = queryLocalArchive(bbox, dateFrom, dateTo);
    dataSource = 'local_archive';
  }

  // 3. If querying recent dates and local is empty, pull from NRT
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  if (spots.length === 0 && dateTo >= sevenDaysAgo) {
    try {
      const res = await fetch(
        'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv',
        { signal: AbortSignal.timeout(18_000), next: { revalidate: 1800 } }
      );
      if (res.ok) {
        const { parseFIRMScsv } = await import('@/lib/firms-archive');
        const nrtSpots = parseFIRMScsv(await res.text(), 'VIIRS_NOAA20', bbox)
          .filter(s => s.acq_date >= dateFrom && s.acq_date <= dateTo);
        spots = nrtSpots;
        dataSource = 'nrt_7d';
      }
    } catch { /* ignore */ }
  }

  // Apply center/radius filter if lat/lon was provided
  if (center) {
    const [clat, clon] = center;
    spots = spots.filter(s => distKm(clat, clon, s.lat, s.lon) <= radiusKm);
  }

  const analysis  = analyzeSpots(spots, dateFrom, dateTo);
  const archivedDates = listArchivedDates();

  return NextResponse.json({
    ok: true,
    query_ms:     Date.now() - t0,
    bbox,
    center,
    radius_km:    center ? radiusKm : null,
    date_from:    dateFrom,
    date_to:      dateTo,
    data_source:  dataSource,
    has_api_key:  !!FIRMS_MAP_KEY,
    local_archive: {
      available_dates: archivedDates.length,
      oldest_date:     archivedDates[0]  || null,
      newest_date:     archivedDates[archivedDates.length - 1] || null,
    },

    api_key_guide: FIRMS_MAP_KEY ? null : {
      message: 'لتفعيل التحليل التاريخي الكامل (حتى 10 سنوات):',
      steps: [
        '1. سجّل مجاناً في: https://firms.modaps.eosdis.nasa.gov/api/',
        '2. احصل على MAP_KEY',
        '3. أضف إلى .env.local: FIRMS_MAP_KEY=your_key',
        '4. أعد تشغيل الخادم',
      ],
      covers: 'VIIRS NOAA-20 (منذ 2018) + MODIS Terra/Aqua (منذ 2000)',
    },

    ...analysis,
  });
}
