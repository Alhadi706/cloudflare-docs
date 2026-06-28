import * as XLSX from 'xlsx';

export type MeasVal = number | string | null;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CrossConnectionsReading {
  openingValve1: MeasVal;
  openingValve2: MeasVal;
  openingValve3: MeasVal;
  totalFlow: MeasVal;
  outletPressure: MeasVal;
  inletPressure: MeasVal;
}

export interface SidiSiedRtReading {
  level: MeasVal;
  totalFlow: MeasVal;
}

export interface TarhunnahPsReading {
  level: MeasVal;
  outletPressure: MeasVal;
  noPumps: MeasVal;
  totalFlow: MeasVal;
}

export interface AshShwayrifCbFcsReading {
  inletPressure: MeasVal;
  outletPressure: MeasVal;
  openingValve4: MeasVal;
  openingValve3: MeasVal;
  openingValve2: MeasVal;
  openingValve1: MeasVal;
  totalFlow: MeasVal;
}

export interface CentralBranchReading {
  rowIndex: number;
  dayNo: number | null;
  dateLabel: string | null;
  crossConnections: CrossConnectionsReading;
  sidiSied: SidiSiedRtReading;
  tarhunah: TarhunnahPsReading;
  ashShwayrifFcs: AshShwayrifCbFcsReading;
}

export interface CentralBranchEngineOutput {
  filename: string;
  sheetName: string;
  readings: CentralBranchReading[];
  issues: string[];
  headerMap: Record<string, number | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s()&_%./-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/%/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Convert decimal valve % (0.35 → 35) or pass through string / integer %
function normPct(v: MeasVal): MeasVal {
  if (v === null || typeof v === 'string') return v;
  return v > 0 && v <= 1.0 ? Math.round(v * 100) : v;
}

function asNumOrText(value: unknown): MeasVal {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').replace(/%/g, '').replace(/\s+/g, '');
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  // Short text codes ≤12 chars (n/av, n/sv, pass…) – preserve as-is
  if (raw.length <= 12 && !/\s/.test(raw)) return raw.toLowerCase();
  return null;
}

function sheetToGridWithMergedHeaders(ws: XLSX.WorkSheet): unknown[][] {
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows = range.e.r + 1;
  const cols = range.e.c + 1;

  const grid: unknown[][] = Array.from({ length: rows }).map(() =>
    Array.from({ length: cols }).map(() => ''),
  );
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      grid[r][c] = cell?.v ?? '';
    }
  }

  const merges = (ws['!merges'] || []) as XLSX.Range[];
  for (const m of merges) {
    const topLeft = grid[m.s.r]?.[m.s.c];
    for (let r = m.s.r; r <= m.e.r; r += 1) {
      for (let c = m.s.c; c <= m.e.c; c += 1) {
        if (
          grid[r]?.[c] === '' ||
          grid[r]?.[c] === null ||
          grid[r]?.[c] === undefined
        ) {
          grid[r][c] = topLeft;
        }
      }
    }
  }
  return grid;
}

function detectDayColumnBySequence(grid: unknown[][], maxCols: number): number | null {
  let bestCol: number | null = null;
  let bestScore = -1;

  for (let c = 0; c < maxCols; c += 1) {
    let score = 0;
    let prev: number | null = null;
    let streak = 0;
    let repeats = 0;
    let totalInts = 0;
    const seen = new Set<number>();

    for (let r = 8; r < Math.min(grid.length, 90); r += 1) {
      const raw = grid[r]?.[c];
      const n = asNum(raw);
      if (n === null || !Number.isInteger(n) || n < 0 || n > 31) continue;
      totalInts += 1;
      seen.add(n);
      if (prev !== null && n === prev) repeats += 1;
      if (prev !== null && n === prev + 1) streak += 1;
      prev = n;
    }

    const uniqueCount = seen.size;
    const coverage = uniqueCount / 31;
    score += uniqueCount * 3;
    score += streak * 3;
    score -= repeats * 2;
    score += totalInts > 20 ? 8 : totalInts > 10 ? 4 : 0;
    if (seen.has(1)) score += 8;
    if (seen.has(29) || seen.has(30) || seen.has(31)) score += 8;
    if (coverage > 0.7) score += 10;

    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
  }

  return bestScore >= 28 ? bestCol : null;
}

function detectSheetName(wb: XLSX.WorkBook): string | null {
  const names = wb.SheetNames || [];

  // 1. Direct name match
  const byName = names.find((name) => {
    const n = normalizeText(name);
    return /central branch|الفرع المركزي|central|cross connection/.test(n);
  });
  if (byName) return byName;

  // 2. Content signatures
  const signatures = [
    /cross connection|تقاطع/,
    /tarhunah|ترهونه|تارهونه/,
    /sidi sied|سيدي السيد|sidi sied r\.?t/,
    /central branch|الفرع المركزي/,
  ];

  let bestSheet: string | null = null;
  let bestScore = -1;
  for (const name of names) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const grid = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
    }) as unknown[][];
    const sample = grid
      .slice(0, 14)
      .flat()
      .map((v) => normalizeText(v))
      .join(' | ');
    let score = 0;
    for (const re of signatures) if (re.test(sample)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestSheet = name;
    }
  }
  return bestScore >= 2 ? bestSheet : null;
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

export function extractCentralBranchEngine(
  wb: XLSX.WorkBook,
  filename: string,
): CentralBranchEngineOutput {
  const issues: string[] = [];

  const sheetName = detectSheetName(wb);
  if (!sheetName) {
    return {
      filename,
      sheetName: '',
      readings: [],
      issues: ['لم يتم العثور على ورقة Central Branch في الملف.'],
      headerMap: {},
    };
  }

  const ws = wb.Sheets[sheetName];
  const grid = sheetToGridWithMergedHeaders(ws);
  if (!Array.isArray(grid) || grid.length === 0) {
    return {
      filename,
      sheetName,
      readings: [],
      issues: [...issues, 'الورقة فارغة.'],
      headerMap: {},
    };
  }

  const maxCols = grid.reduce(
    (m, r) => Math.max(m, Array.isArray(r) ? r.length : 0),
    0,
  );

  // Detect day column
  const dayCol = detectDayColumnBySequence(grid, maxCols);
  if (dayCol === null) {
    return {
      filename,
      sheetName,
      readings: [],
      issues: [...issues, 'تعذر تحديد عمود اليوم في الورقة.'],
      headerMap: {},
    };
  }
  issues.push(`عمود اليوم: col=${dayCol}`);

  // ── Explicit offset map ────────────────────────────────────────────────────
  // RTL sheet: Day is at lowest col index (col A). Groups extend to higher indices.
  //
  // dayCol+0 : Day
  // dayCol+1 : Date  (usually blank / serial date)
  //
  // ── Ash Shwayrif FCS (7 cols) ──────────────────────────────────────────────
  // dayCol+2 : Inlet Pressure (bar)
  // dayCol+3 : Outlet Pressure (bar)
  // dayCol+4 : Opening Valve 4 (%)
  // dayCol+5 : Opening Valve 3 (%)
  // dayCol+6 : Opening Valve 2 (%)
  // dayCol+7 : Opening Valve 1 (%)
  // dayCol+8 : Daily Flow (m3/Day)
  //
  // ── Tarhunah R.T & Pump Station (4 cols) ───────────────────────────────────
  // dayCol+9  : Level (m)
  // dayCol+10 : Outlet Pressure (bar)
  // dayCol+11 : No. of Pumps
  // dayCol+12 : Daily Flow (m3/Day)
  //
  // ── Sidi Sied R.T (2 cols) ─────────────────────────────────────────────────
  // dayCol+13 : Level (m)
  // dayCol+14 : Daily Flow (m3/Day)
  //
  // ── Cross Connections Flow Control (6 cols) ─────────────────────────────────
  // dayCol+15 : Outlet Pressure (bar)
  // dayCol+16 : Inlet Pressure (bar)
  // dayCol+17 : Total Flow (m3/Day)
  // dayCol+18 : Opening Valve 1 (%)
  // dayCol+19 : Opening Valve 2 (%)
  // dayCol+20 : Opening Valve 3 (%)

  const REQUIRED_OFFSET = 19;
  if (dayCol + REQUIRED_OFFSET >= maxCols) {
    issues.push(
      `تحذير: عدد الأعمدة (${maxCols}) أقل من المطلوب (dayCol+${REQUIRED_OFFSET}). سيتم محاولة الاستخراج بالأعمدة المتاحة.`,
    );
  }

  // ── Explicit offset map (no separate Date column — Inlet Pressure starts at +1) ──
  //
  // dayCol+0 : Day
  //
  // ── Ash Shwayrif FCS (7 cols) ──────────────────────────────────────────────
  // dayCol+1 : Inlet Pressure (bar)   ~18–19
  // dayCol+2 : Outlet Pressure (bar)  ~2–3
  // dayCol+3 : Opening Valve 1 (%)   stored as decimal 0.30 → normPct → 30
  // dayCol+4 : Opening Valve 2 (%)
  // dayCol+5 : Opening Valve 3 (%)
  // dayCol+6 : Opening Valve 4 (%)
  // dayCol+7 : Total Flow (m³/Day)
  //
  // ── Tarhunah R.T & Pump Station (4 cols) ───────────────────────────────────
  // dayCol+8  : Level (m)
  // dayCol+9  : Outlet Pressure (bar)
  // dayCol+10 : No. of Pumps
  // dayCol+11 : Total Flow (m³/Day)
  //
  // ── Sidi Sied R.T (2 cols) ─────────────────────────────────────────────────
  // dayCol+12 : Level (m)
  // dayCol+13 : Total Flow (m³/Day)
  //
  // ── Cross Connections Flow Control (6 cols) ─────────────────────────────────
  // dayCol+14 : Outlet Pressure (bar)
  // dayCol+15 : Inlet Pressure (bar)
  // dayCol+16 : Total Flow (m³/Day)
  // dayCol+17 : Opening Valve 1 (%)
  // dayCol+18 : Opening Valve 2 (%)
  // dayCol+19 : Opening Valve 3 (%)

  const col = {
    day: dayCol,
    ashShwayrifFcs: {
      inletPressure:  dayCol + 1,
      outletPressure: dayCol + 2,
      openingValve1:  dayCol + 3,
      openingValve2:  dayCol + 4,
      openingValve3:  dayCol + 5,
      openingValve4:  dayCol + 6,
      totalFlow:      dayCol + 7,
    },
    tarhunah: {
      level:          dayCol + 8,
      outletPressure: dayCol + 9,
      noPumps:        dayCol + 10,
      totalFlow:      dayCol + 11,
    },
    sidiSied: {
      level:     dayCol + 12,
      totalFlow: dayCol + 13,
    },
    crossConnections: {
      outletPressure: dayCol + 14,
      inletPressure:  dayCol + 15,
      totalFlow:      dayCol + 16,
      openingValve1:  dayCol + 17,
      openingValve2:  dayCol + 18,
      openingValve3:  dayCol + 19,
    },
  };

  issues.push(`تم اعتماد خريطة Central Branch (يوم+offset) col=${dayCol}`);

  // ── Diagnostic: first real data row ───────────────────────────────────────
  let dbgRowIdx = -1;
  let dbgDataRow: unknown[] = [];
  for (let ri = 8; ri < Math.min(grid.length, 30); ri += 1) {
    const dayVal = asNum(grid[ri]?.[dayCol]);
    if (
      dayVal !== null &&
      Number.isInteger(dayVal) &&
      dayVal >= 0 &&
      dayVal <= 31
    ) {
      dbgDataRow = (grid[ri] as unknown[]) || [];
      dbgRowIdx = ri;
      break;
    }
  }
  if (dbgRowIdx >= 0) {
    const dbgVals = Array.from(
      { length: 22 },
      (_, i) => `c${dayCol + i}='${String(dbgDataRow[dayCol + i] ?? '')}'`,
    ).join(' ');
    issues.push(`DEBUG row${dbgRowIdx}: ${dbgVals}`);
  }

  // ── Extract readings ───────────────────────────────────────────────────────
  const readings: CentralBranchReading[] = [];

  for (let ri = 8; ri < grid.length; ri += 1) {
    const row = grid[ri] as unknown[];
    const dayVal = asNum(row?.[col.day]);
    if (dayVal === null || !Number.isInteger(dayVal) || dayVal < 0 || dayVal > 31) continue;

    // Date label
    const rawDate = row?.[col.date];
    let dateLabel: string | null = null;
    if (rawDate !== null && rawDate !== undefined && rawDate !== '') {
      const asN = asNum(rawDate);
      if (asN !== null) {
        // Excel serial date
        const d = new Date(Math.round((asN - 25569) * 86400 * 1000));
        if (!isNaN(d.getTime())) dateLabel = d.toISOString().slice(0, 10);
      } else {
        const s = String(rawDate).trim();
        if (s) dateLabel = s;
      }
    }

    const r = (c: number): unknown => row?.[c] ?? null;

    readings.push({
      rowIndex: ri,
      dayNo: dayVal,
      dateLabel,
      crossConnections: {
        openingValve1:  normPct(asNumOrText(r(col.crossConnections.openingValve1))),
        openingValve2:  normPct(asNumOrText(r(col.crossConnections.openingValve2))),
        openingValve3:  normPct(asNumOrText(r(col.crossConnections.openingValve3))),
        totalFlow:      asNumOrText(r(col.crossConnections.totalFlow)),
        outletPressure: asNumOrText(r(col.crossConnections.outletPressure)),
        inletPressure:  asNumOrText(r(col.crossConnections.inletPressure)),
      },
      sidiSied: {
        level:     asNumOrText(r(col.sidiSied.level)),
        totalFlow: asNumOrText(r(col.sidiSied.totalFlow)),
      },
      tarhunah: {
        level:          asNumOrText(r(col.tarhunah.level)),
        outletPressure: asNumOrText(r(col.tarhunah.outletPressure)),
        noPumps:        asNumOrText(r(col.tarhunah.noPumps)),
        totalFlow:      asNumOrText(r(col.tarhunah.totalFlow)),
      },
      ashShwayrifFcs: {
        inletPressure:  asNumOrText(r(col.ashShwayrifFcs.inletPressure)),
        outletPressure: asNumOrText(r(col.ashShwayrifFcs.outletPressure)),
        openingValve4:  normPct(asNumOrText(r(col.ashShwayrifFcs.openingValve4))),
        openingValve3:  normPct(asNumOrText(r(col.ashShwayrifFcs.openingValve3))),
        openingValve2:  normPct(asNumOrText(r(col.ashShwayrifFcs.openingValve2))),
        openingValve1:  normPct(asNumOrText(r(col.ashShwayrifFcs.openingValve1))),
        totalFlow:      asNumOrText(r(col.ashShwayrifFcs.totalFlow)),
      },
    });
  }

  const headerMap: Record<string, number | null> = {
    day: col.day,
    ash_shwayrif_fcs_inlet_pressure:  col.ashShwayrifFcs.inletPressure,
    ash_shwayrif_fcs_outlet_pressure: col.ashShwayrifFcs.outletPressure,
    ash_shwayrif_fcs_opening_valve_1: col.ashShwayrifFcs.openingValve1,
    ash_shwayrif_fcs_opening_valve_2: col.ashShwayrifFcs.openingValve2,
    ash_shwayrif_fcs_opening_valve_3: col.ashShwayrifFcs.openingValve3,
    ash_shwayrif_fcs_opening_valve_4: col.ashShwayrifFcs.openingValve4,
    ash_shwayrif_fcs_total_flow:      col.ashShwayrifFcs.totalFlow,
    tarhunah_level:                   col.tarhunah.level,
    tarhunah_outlet_pressure:         col.tarhunah.outletPressure,
    tarhunah_no_pumps:                col.tarhunah.noPumps,
    tarhunah_total_flow:              col.tarhunah.totalFlow,
    sidi_sied_level:                  col.sidiSied.level,
    sidi_sied_total_flow:             col.sidiSied.totalFlow,
    cross_connections_outlet_pressure: col.crossConnections.outletPressure,
    cross_connections_inlet_pressure:  col.crossConnections.inletPressure,
    cross_connections_total_flow:      col.crossConnections.totalFlow,
    cross_connections_opening_valve_1: col.crossConnections.openingValve1,
    cross_connections_opening_valve_2: col.crossConnections.openingValve2,
    cross_connections_opening_valve_3: col.crossConnections.openingValve3,
  };

  issues.push(`تم استخراج ${readings.length} قراءة من الورقة "${sheetName}".`);

  return { filename, sheetName, readings, issues, headerMap };
}
