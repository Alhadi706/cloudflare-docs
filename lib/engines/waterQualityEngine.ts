/**
 * waterQualityEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Extracts water quality measurements from the W.Q sheet in the monthly Excel
 * report.
 *
 * Sheet layout (by-day):
 *   Row 1:  Section title (Water Quality Control Dept. / قسم مراقبة جودة المياه)
 *   Row 2:  Parameter group headers, possibly merged:
 *             اليوم | تركيز النترات (Nitrates) | | تركيز الأملاح (TDS) | |
 *   Row 3:  Sub-column headers (location names):
 *             اليوم | صنبا | حايا | صنبا | حايا   (or other location names)
 *   Row 4+: Daily data rows — one row per day of the month.
 *
 * Sheet layout (by-location, legacy):
 *   Header row: الموقع/الاسم | TDS | نترات | pH | موصلية
 *   Data rows:  one row per measurement location.
 *
 * The engine auto-detects the layout, extracts structured data, and computes
 * per-location statistics (avg/min/max).
 */

import * as XLSX from 'xlsx';

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single location-parameter value for one day */
export interface WaterQualityPoint {
  location: string;
  nitrates:    number | null;
  tds:         number | null;
  ph:          number | null;
  conductivity: number | null;
}

/** All quality readings for one calendar day */
export interface WaterQualityDailyReading {
  dayNo:  number;
  points: WaterQualityPoint[];
}

/** Aggregated statistics per measurement location */
export interface WaterQualityLocationStat {
  location:       string;
  avgNitrates:    number | null;
  minNitrates:    number | null;
  maxNitrates:    number | null;
  avgTds:         number | null;
  minTds:         number | null;
  maxTds:         number | null;
  avgPh:          number | null;
  avgConductivity: number | null;
  /** WHO/standard thresholds: nitrates > 50 → fail, tds > 1500 → fail, else pass/warning */
  status: 'pass' | 'warning' | 'fail';
}

export type WaterQualityLayout = 'by-day' | 'by-location' | 'unknown';

export interface WaterQualityEngineOutput {
  filename:       string;
  sheetName:      string | null;
  layout:         WaterQualityLayout;
  dailyReadings:  WaterQualityDailyReading[];   // populated for 'by-day'
  locationStats:  WaterQualityLocationStat[];   // always populated
  locations:      string[];
  parameters:     ('nitrates' | 'tds' | 'ph' | 'conductivity')[];
  issues:         string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NITRATES_FAIL    = 50;    // mg/L  (WHO guideline)
const NITRATES_WARNING = 45;    // mg/L
const TDS_FAIL         = 1500;  // mg/L  (WHO: 1000 ideal, 1500 max)
const TDS_WARNING      = 1000;  // mg/L

// ─── Helpers ─────────────────────────────────────────────────────────────────

function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[,،\s]/g, ''));
  return isNaN(n) ? null : n;
}

function isNitrateHeader(s: string): boolean {
  return /نترات|nitrat/i.test(s);
}
function isTdsHeader(s: string): boolean {
  return /tds|أملاح|ملوحة|مواد ذائبة|dissolved|salinity/i.test(s);
}
function isPhHeader(s: string): boolean {
  return /\bph\b|حموضة/i.test(s);
}
function isConductivityHeader(s: string): boolean {
  return /موصلية|conductivity|\bec\b/i.test(s);
}
function isDayHeader(s: string): boolean {
  return /^اليوم$|^day$|^رقم/i.test(s.trim());
}

/** Detect a location name (Arabic >= 2 chars, or English >= 2 chars that are not a number) */
function isLocationName(s: string): boolean {
  if (!s || s.length < 2) return false;
  if (/^\d+(\.\d+)?$/.test(s)) return false;
  // Arabic text or Latin word
  return /[\u0600-\u06FF]{2,}|[a-zA-Z]{2,}/.test(s);
}

function computeStatus(
  avgNitrates: number | null,
  avgTds:      number | null,
): 'pass' | 'warning' | 'fail' {
  if (avgNitrates !== null && avgNitrates > NITRATES_FAIL) return 'fail';
  if (avgTds      !== null && avgTds      > TDS_FAIL)      return 'fail';
  if (avgNitrates !== null && avgNitrates > NITRATES_WARNING) return 'warning';
  if (avgTds      !== null && avgTds      > TDS_WARNING)      return 'warning';
  return 'pass';
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
}

// ─── Sheet finder ─────────────────────────────────────────────────────────────

function findWqSheet(wb: XLSX.WorkBook): { name: string; ws: XLSX.WorkSheet } | null {
  for (const name of wb.SheetNames) {
    const n = name.trim().toLowerCase();
    if (/^w\.q$|^wq$|جودة.*مياه|مياه.*جودة|water.*qual/i.test(n)) {
      const ws = wb.Sheets[name];
      if (ws) return { name, ws };
    }
  }
  return null;
}

// ─── By-day layout parser ─────────────────────────────────────────────────────

/**
 * Parses the by-day layout where:
 *   - Row i   : parameter group headers (possibly merged)
 *   - Row i+1 : sub-column headers (location names) OR location names are in row i
 *   - Row i+2+: daily data rows
 */
function parseByDay(
  rows:  unknown[][],
  merges: XLSX.Range[],
  issues: string[],
): { dailyReadings: WaterQualityDailyReading[]; locationStats: WaterQualityLocationStat[]; locations: string[]; parameters: ('nitrates' | 'tds' | 'ph' | 'conductivity')[] } {

  // ── Step 1: Build a "filled" header matrix respecting merged cells ──────────
  // Expand merges: copy the top-left cell value across all merged cells
  const maxRow = Math.min(rows.length, 8);
  const filled: string[][] = Array.from({ length: maxRow }, (_, r) =>
    Array.from({ length: (rows[r] ?? []).length }, (_, c) => norm((rows[r] ?? [])[c]))
  );

  // Apply horizontal merges in header rows
  for (const m of merges) {
    if (m.s.r >= maxRow) continue;
    const val = filled[m.s.r]?.[m.s.c] ?? '';
    for (let r = m.s.r; r <= Math.min(m.e.r, maxRow - 1); r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (!filled[r]) filled[r] = [];
        if ((r !== m.s.r || c !== m.s.c) && (!filled[r][c] || filled[r][c] === '')) {
          filled[r][c] = val;
        }
      }
    }
  }

  // ── Step 2: Find the parameter header row and location header row ───────────
  // Strategy: scan rows looking for "اليوم" or a known parameter keyword
  let paramRowIdx  = -1;
  let locRowIdx    = -1;
  let dataStartIdx = -1;
  let dayColIdx    = -1;

  for (let r = 0; r < maxRow; r++) {
    const row = filled[r] ?? [];
    const hasParam = row.some(c => isNitrateHeader(c) || isTdsHeader(c) || isPhHeader(c) || isConductivityHeader(c));
    const hasDayCol = row.findIndex(c => isDayHeader(c));
    if (hasParam || hasDayCol >= 0) {
      paramRowIdx = r;
      if (hasDayCol >= 0) dayColIdx = hasDayCol;
      break;
    }
  }

  if (paramRowIdx < 0) {
    issues.push('لم يُعثر على صف رؤوس المعاملات في الورقة (تركيز النترات / تركيز الأملاح)');
    return { dailyReadings: [], locationStats: [], locations: [], parameters: [] };
  }

  // Check if next row has location sub-headers
  const nextRow = filled[paramRowIdx + 1] ?? [];
  const hasLocationsInNext = nextRow.some(c => isLocationName(c));
  if (hasLocationsInNext) {
    locRowIdx    = paramRowIdx + 1;
    dataStartIdx = paramRowIdx + 2;
    if (dayColIdx < 0) dayColIdx = (filled[locRowIdx] ?? []).findIndex(c => isDayHeader(c));
    if (dayColIdx < 0) dayColIdx = 0; // fallback: first col
  } else {
    // Param row also has location names (single header row)
    locRowIdx    = paramRowIdx;
    dataStartIdx = paramRowIdx + 1;
    if (dayColIdx < 0) dayColIdx = 0;
  }

  // ── Step 3: Build column map ─────────────────────────────────────────────
  type ColDef = { location: string; parameter: 'nitrates' | 'tds' | 'ph' | 'conductivity' };
  const colMap: Record<number, ColDef> = {};
  const paramRow = filled[paramRowIdx] ?? [];
  const locRow   = filled[locRowIdx]   ?? [];
  const maxCols  = Math.max(paramRow.length, locRow.length);

  let currentParam: 'nitrates' | 'tds' | 'ph' | 'conductivity' | null = null;

  for (let c = 0; c < maxCols; c++) {
    if (c === dayColIdx) continue;

    const pCell = paramRow[c] ?? '';
    const lCell = locRow[c]   ?? '';

    // Update current parameter group (from param row)
    if (isNitrateHeader(pCell)) currentParam = 'nitrates';
    else if (isTdsHeader(pCell)) currentParam = 'tds';
    else if (isPhHeader(pCell)) currentParam = 'ph';
    else if (isConductivityHeader(pCell)) currentParam = 'conductivity';

    // If loc row has a parameter header directly (single-row mode), override
    let param = currentParam;
    if (isNitrateHeader(lCell)) param = 'nitrates';
    else if (isTdsHeader(lCell)) param = 'tds';
    else if (isPhHeader(lCell)) param = 'ph';
    else if (isConductivityHeader(lCell)) param = 'conductivity';

    // Location name: prefer loc row, fallback to "موقع {c}"
    let location = isLocationName(lCell) ? lCell : (isLocationName(pCell) ? pCell : '');
    if (!location && param) location = `موقع-${c}`;

    if (param && location) {
      colMap[c] = { location, parameter: param };
    }
  }

  if (Object.keys(colMap).length === 0) {
    issues.push('لم يُعثر على أعمدة بيانات معروفة في ورقة جودة المياه');
    return { dailyReadings: [], locationStats: [], locations: [], parameters: [] };
  }

  // ── Step 4: Extract daily data rows ──────────────────────────────────────
  const locationMap: Record<string, { n: number[]; t: number[]; p: number[]; cond: number[] }> = {};
  const dailyReadings: WaterQualityDailyReading[] = [];

  for (let r = dataStartIdx; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (row.every(c => c === null || c === undefined || c === '')) continue;

    const rawDay = toNum(row[dayColIdx]);
    if (rawDay === null || rawDay < 1 || rawDay > 31) continue; // not a data row

    const pointMap: Record<string, WaterQualityPoint> = {};

    for (const [colStr, def] of Object.entries(colMap)) {
      const c   = Number(colStr);
      const val = toNum(row[c]);

      const loc = def.location;
      if (!pointMap[loc]) {
        pointMap[loc] = { location: loc, nitrates: null, tds: null, ph: null, conductivity: null };
      }
      if (def.parameter === 'nitrates' && val !== null) pointMap[loc].nitrates = val;
      else if (def.parameter === 'tds'  && val !== null) pointMap[loc].tds  = val;
      else if (def.parameter === 'ph'   && val !== null) pointMap[loc].ph   = val;
      else if (def.parameter === 'conductivity' && val !== null) pointMap[loc].conductivity = val;

      // Accumulate for stats
      if (!locationMap[loc]) locationMap[loc] = { n: [], t: [], p: [], cond: [] };
      if (def.parameter === 'nitrates'    && val !== null) locationMap[loc].n.push(val);
      else if (def.parameter === 'tds'    && val !== null) locationMap[loc].t.push(val);
      else if (def.parameter === 'ph'     && val !== null) locationMap[loc].p.push(val);
      else if (def.parameter === 'conductivity' && val !== null) locationMap[loc].cond.push(val);
    }

    dailyReadings.push({ dayNo: Math.round(rawDay), points: Object.values(pointMap) });
  }

  // ── Step 5: Compute location statistics ───────────────────────────────────
  const locationStats: WaterQualityLocationStat[] = Object.entries(locationMap).map(([loc, acc]) => {
    const an = avg(acc.n);
    const at = avg(acc.t);
    return {
      location:       loc,
      avgNitrates:    an,
      minNitrates:    acc.n.length > 0 ? Math.min(...acc.n) : null,
      maxNitrates:    acc.n.length > 0 ? Math.max(...acc.n) : null,
      avgTds:         at,
      minTds:         acc.t.length > 0 ? Math.min(...acc.t) : null,
      maxTds:         acc.t.length > 0 ? Math.max(...acc.t) : null,
      avgPh:          avg(acc.p),
      avgConductivity: avg(acc.cond),
      status:         computeStatus(an, at),
    };
  });

  const locations  = [...new Set(locationStats.map(s => s.location))];
  const paramSet   = new Set<'nitrates' | 'tds' | 'ph' | 'conductivity'>();
  for (const def of Object.values(colMap)) paramSet.add(def.parameter);
  const parameters = [...paramSet];

  return { dailyReadings, locationStats, locations, parameters };
}

// ─── By-location layout parser (legacy) ───────────────────────────────────────

/**
 * Parses a flat location-per-row sheet:
 *   Header row: اسم الموقع | TDS | نترات | pH | موصلية
 *   Data row:   طرابلس     | 950 | 30    | 7.2| 1600
 */
function parseByLocation(
  rows:   unknown[][],
  issues: string[],
): { locationStats: WaterQualityLocationStat[]; locations: string[]; parameters: ('nitrates' | 'tds' | 'ph' | 'conductivity')[] } {

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const r = rows[i] ?? [];
    const nonEmpty = r.filter(c => c !== '' && c !== null && c !== undefined);
    if (nonEmpty.length >= 2) { headerIdx = i; break; }
  }
  if (headerIdx < 0) {
    issues.push('لم يُعثر على صف رؤوس في ورقة جودة المياه (layout: by-location)');
    return { locationStats: [], locations: [], parameters: [] };
  }

  const headers = (rows[headerIdx] ?? []).map(c => norm(c));
  const nameCol  = headers.findIndex(h => /اسم|موقع|location|name/i.test(h));
  const nitrCol  = headers.findIndex(h => isNitrateHeader(h));
  const tdsCol   = headers.findIndex(h => isTdsHeader(h));
  const phCol    = headers.findIndex(h => isPhHeader(h));
  const condCol  = headers.findIndex(h => isConductivityHeader(h));

  const effectiveNameCol = nameCol >= 0 ? nameCol : 0;

  const locationStats: WaterQualityLocationStat[] = [];
  const paramSet = new Set<'nitrates' | 'tds' | 'ph' | 'conductivity'>();
  if (nitrCol >= 0) paramSet.add('nitrates');
  if (tdsCol  >= 0) paramSet.add('tds');
  if (phCol   >= 0) paramSet.add('ph');
  if (condCol >= 0) paramSet.add('conductivity');

  for (const row of rows.slice(headerIdx + 1)) {
    if (!row || (row as unknown[]).every(c => c === '')) continue;
    const name = String((row as unknown[])[effectiveNameCol] ?? '').trim();
    if (!isLocationName(name)) continue;

    const nitrates    = nitrCol >= 0 ? toNum((row as unknown[])[nitrCol]) : null;
    const tds         = tdsCol  >= 0 ? toNum((row as unknown[])[tdsCol])  : null;
    const ph          = phCol   >= 0 ? toNum((row as unknown[])[phCol])   : null;
    const conductivity = condCol >= 0 ? toNum((row as unknown[])[condCol]) : null;

    locationStats.push({
      location:       name,
      avgNitrates:    nitrates,
      minNitrates:    nitrates,
      maxNitrates:    nitrates,
      avgTds:         tds,
      minTds:         tds,
      maxTds:         tds,
      avgPh:          ph,
      avgConductivity: conductivity,
      status:         computeStatus(nitrates, tds),
    });
  }

  return {
    locationStats,
    locations:  locationStats.map(s => s.location),
    parameters: [...paramSet],
  };
}

// ─── Layout detector ──────────────────────────────────────────────────────────

function detectLayout(rows: unknown[][]): WaterQualityLayout {
  // Look at first ~5 non-empty data rows (after headers)
  let headersPassed = 0;
  let dayLike = 0, locLike = 0;

  for (const row of rows) {
    const cells = (row as unknown[]).filter(c => c !== '' && c !== null && c !== undefined);
    if (cells.length < 2) continue;

    const first = norm(cells[0]);
    if (isDayHeader(first) || isNitrateHeader(first) || isTdsHeader(first)) {
      headersPassed++;
      continue;
    }
    if (headersPassed === 0) continue; // skip title rows

    // Is the first cell a day number?
    const n = toNum(cells[0]);
    if (n !== null && n >= 1 && n <= 31) dayLike++;
    else if (isLocationName(first)) locLike++;

    if (dayLike + locLike >= 5) break;
  }

  if (dayLike > locLike) return 'by-day';
  if (locLike > dayLike) return 'by-location';
  return 'unknown';
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function extractWaterQualityEngine(
  wb:       XLSX.WorkBook,
  filename: string,
): WaterQualityEngineOutput {

  const issues: string[] = [];
  const empty: WaterQualityEngineOutput = {
    filename, sheetName: null, layout: 'unknown',
    dailyReadings: [], locationStats: [], locations: [], parameters: [], issues,
  };

  const found = findWqSheet(wb);
  if (!found) {
    issues.push('لم يُعثر على ورقة جودة المياه (W.Q / WQ / جودة المياه) في الملف');
    return empty;
  }

  const { name: sheetName, ws } = found;
  const rows    = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
  const merges  = (ws['!merges'] ?? []) as XLSX.Range[];

  if (rows.length < 3) {
    issues.push(`ورقة ${sheetName} فارغة أو تحتوي بيانات غير كافية`);
    return { ...empty, sheetName };
  }

  const layout = detectLayout(rows);

  if (layout === 'by-day') {
    const result = parseByDay(rows, merges, issues);
    return {
      filename,
      sheetName,
      layout: 'by-day',
      dailyReadings:  result.dailyReadings,
      locationStats:  result.locationStats,
      locations:      result.locations,
      parameters:     result.parameters,
      issues,
    };
  }

  if (layout === 'by-location') {
    const result = parseByLocation(rows, issues);
    return {
      filename,
      sheetName,
      layout: 'by-location',
      dailyReadings:  [],
      locationStats:  result.locationStats,
      locations:      result.locations,
      parameters:     result.parameters,
      issues,
    };
  }

  // ── Unknown layout: try by-day first, then by-location ───────────────────
  const r1 = parseByDay(rows, merges, []);
  if (r1.dailyReadings.length > 0) {
    return {
      filename,
      sheetName,
      layout: 'by-day',
      dailyReadings:  r1.dailyReadings,
      locationStats:  r1.locationStats,
      locations:      r1.locations,
      parameters:     r1.parameters,
      issues,
    };
  }

  const r2 = parseByLocation(rows, issues);
  return {
    filename,
    sheetName,
    layout: 'by-location',
    dailyReadings:  [],
    locationStats:  r2.locationStats,
    locations:      r2.locations,
    parameters:     r2.parameters,
    issues,
  };
}
