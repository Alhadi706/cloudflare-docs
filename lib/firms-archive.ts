/**
 * lib/firms-archive.ts
 * ──────────────────────────────────────────────────────────────────────────
 * نظام أرشفة بيانات الحرائق المحلية
 *
 * يعمل بثلاث طبقات:
 * 1. NRT (7 أيام):  NOAA-20 + SNPP + MODIS من NASA FIRMS (بدون مفتاح)
 * 2. محلي (365 يوم+):  أرشيف JSON يومي يتراكم مع تشغيل الخادم
 * 3. FIRMS API (10 سنوات): مع MAP_KEY مجاني من https://firms.modaps.eosdis.nasa.gov/api/
 *
 * كل استدعاء لـ fetchAndStore() يُنزّل بيانات FIRMS ويحفظها محلياً
 * هكذا يتراكم الأرشيف تلقائياً مع كل طلب من الواجهة
 */
import fs   from 'fs';
import path from 'path';

const ARCHIVE_DIR = path.join(process.cwd(), '.data', 'firms-archive');
const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || '';

// Libya bbox
const LIBYA_BBOX = { min_lon: 9.5, min_lat: 19.5, max_lon: 25.5, max_lat: 33.5 };

export interface ArchivedHotspot {
  lat:        number;
  lon:        number;
  frp:        number;
  confidence: string;
  acq_date:   string;
  acq_time:   string;
  sensor:     'VIIRS_NOAA20' | 'VIIRS_SNPP' | 'MODIS';
}

// NRT feed URLs
const FEEDS = [
  { name: 'VIIRS_NOAA20' as const, url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv' },
  { name: 'VIIRS_SNPP'   as const, url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_7d.csv' },
  { name: 'MODIS'        as const, url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_7d.csv' },
];

// FIRMS API (when MAP_KEY is set)
function firmsApiUrl(bbox: string, days: number, date?: string): string {
  const base = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/VIIRS_NOAA20_NRT/${bbox}/${days}`;
  return date ? `${base}/${date}` : base;
}
function firmsArchiveUrl(bbox: string, days: number, date: string): string {
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/VIIRS_NOAA20_SP/${bbox}/${days}/${date}`;
}

function archiveFile(date: string): string {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  return path.join(ARCHIVE_DIR, `${date}.json`);
}

function readArchiveDay(date: string): ArchivedHotspot[] {
  try {
    const f = archiveFile(date);
    if (!fs.existsSync(f)) return [];
    return JSON.parse(fs.readFileSync(f, 'utf8')) as ArchivedHotspot[];
  } catch { return []; }
}

function writeArchiveDay(date: string, spots: ArchivedHotspot[]): void {
  try {
    fs.writeFileSync(archiveFile(date), JSON.stringify(spots));
  } catch { /* ignore write errors */ }
}

/** Parse a FIRMS CSV and extract Libya hotspots */
export function parseFIRMScsv(
  csv: string,
  sensor: ArchivedHotspot['sensor'],
  bbox = LIBYA_BBOX,
): ArchivedHotspot[] {
  const lines  = csv.split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const idx = (f: string) => header.indexOf(f);
  const latI  = idx('latitude');
  const lonI  = idx('longitude');
  const frpI  = idx('frp');
  const dateI = idx('acq_date');
  const timeI = idx('acq_time');
  const confI = idx('confidence');

  const spots: ArchivedHotspot[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(',');
    const lat = parseFloat(c[latI]);
    const lon = parseFloat(c[lonI]);
    if (isNaN(lat) || isNaN(lon)) continue;
    if (lat < bbox.min_lat || lat > bbox.max_lat || lon < bbox.min_lon || lon > bbox.max_lon) continue;
    spots.push({
      lat, lon,
      frp:        parseFloat(c[frpI]  || '0'),
      confidence: (c[confI]  ?? '').trim(),
      acq_date:   (c[dateI]  ?? '').trim(),
      acq_time:   (c[timeI]  ?? '').trim(),
      sensor,
    });
  }
  return spots;
}

/**
 * Fetch all 3 NRT feeds, store new dates to local archive, return current hotspots.
 * Call this from fire-monitor to accumulate history automatically.
 */
export async function fetchAndStore(): Promise<ArchivedHotspot[]> {
  const allSpots: ArchivedHotspot[] = [];

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(20_000),
        next:   { revalidate: 1800 },
      });
      if (!res.ok) continue;
      const csv   = await res.text();
      const spots = parseFIRMScsv(csv, feed.name);
      allSpots.push(...spots);
    } catch { /* skip failed feed */ }
  }

  // Store by date into local archive
  const byDate = new Map<string, ArchivedHotspot[]>();
  for (const s of allSpots) {
    if (!s.acq_date) continue;
    if (!byDate.has(s.acq_date)) byDate.set(s.acq_date, []);
    byDate.get(s.acq_date)!.push(s);
  }
  for (const [date, spots] of byDate.entries()) {
    // Merge with existing (avoid duplicate sensors/times)
    const existing = readArchiveDay(date);
    if (existing.length === 0) {
      writeArchiveDay(date, spots);
    } else {
      // Add only spots not already stored (by lat/lon/time/sensor)
      const keys = new Set(existing.map(s => `${s.lat},${s.lon},${s.acq_time},${s.sensor}`));
      const toAdd = spots.filter(s => !keys.has(`${s.lat},${s.lon},${s.acq_time},${s.sensor}`));
      if (toAdd.length > 0) writeArchiveDay(date, [...existing, ...toAdd]);
    }
  }

  return allSpots;
}

/** List all archived dates (YYYY-MM-DD), sorted ascending */
export function listArchivedDates(): string[] {
  try {
    return fs.readdirSync(ARCHIVE_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => f.replace('.json', ''))
      .sort();
  } catch { return []; }
}

/** Query local archive for a bbox and date range */
export function queryLocalArchive(
  bbox: { min_lon: number; min_lat: number; max_lon: number; max_lat: number },
  dateFrom: string,
  dateTo:   string,
): ArchivedHotspot[] {
  const dates = listArchivedDates().filter(d => d >= dateFrom && d <= dateTo);
  const results: ArchivedHotspot[] = [];
  for (const date of dates) {
    const spots = readArchiveDay(date);
    for (const s of spots) {
      if (s.lat >= bbox.min_lat && s.lat <= bbox.max_lat &&
          s.lon >= bbox.min_lon && s.lon <= bbox.max_lon) {
        results.push(s);
      }
    }
  }
  return results;
}

/**
 * Query FIRMS API for a specific bbox + date range (requires MAP_KEY).
 * Falls back gracefully if no key configured.
 */
export async function queryFIRMSapi(
  bbox:     { min_lon: number; min_lat: number; max_lon: number; max_lat: number },
  dateFrom: string,
  dateTo:   string,
): Promise<{ spots: ArchivedHotspot[]; source: 'firms_api' | 'local' | 'none' }> {
  if (!FIRMS_MAP_KEY) return { spots: [], source: 'none' };

  const bboxStr = `${bbox.min_lon},${bbox.min_lat},${bbox.max_lon},${bbox.max_lat}`;

  // Compute days between dates
  const from = new Date(dateFrom);
  const to   = new Date(dateTo);
  const days = Math.min(Math.ceil((to.getTime() - from.getTime()) / 86400_000) + 1, 500);

  // Use NRT for recent (≤10 days), Archive for historical
  const isRecent = (Date.now() - from.getTime()) / 86400_000 <= 10;
  const url = isRecent
    ? firmsApiUrl(bboxStr, Math.min(days, 10), dateFrom)
    : firmsArchiveUrl(bboxStr, days, dateFrom);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { spots: [], source: 'none' };
    const csv   = await res.text();
    const spots = parseFIRMScsv(csv, 'VIIRS_NOAA20', bbox);
    // Cache into local archive
    const byDate = new Map<string, ArchivedHotspot[]>();
    for (const s of spots) {
      if (!s.acq_date) continue;
      if (!byDate.has(s.acq_date)) byDate.set(s.acq_date, []);
      byDate.get(s.acq_date)!.push(s);
    }
    for (const [date, ds] of byDate.entries()) {
      writeArchiveDay(date, ds);
    }
    return { spots, source: 'firms_api' };
  } catch {
    return { spots: [], source: 'none' };
  }
}

export { FIRMS_MAP_KEY };
