import * as XLSX from 'xlsx';

export type MeasVal = number | string | null;

export interface AenZaraValveReading {
  outletPressure: MeasVal;
  inletPressure: MeasVal;
  openingValvePct: MeasVal;
}

export interface AirportValveReading {
  dailyFlow: MeasVal;
  intentFlow2: MeasVal;
  intentFlow1: MeasVal;
  intentFlow3: MeasVal;
  outletPressure: MeasVal;
  inletPressure: MeasVal;
  openingValvePct: MeasVal;
}

export interface SidiSaiahFcsReading {
  rtLevel: MeasVal;
  dailyFlow: MeasVal;
  openingValve2: MeasVal;
  openingValve3: MeasVal;
  outletPressure: MeasVal;
  inletPressure: MeasVal;
}

export interface GarabulliRtReading {
  dailyFlow: MeasVal;
  level: MeasVal;
}

export interface WadiTumallahFcsReading {
  dailyFlow: MeasVal;
  openingValve3: MeasVal;
  openingValve2: MeasVal;
  openingValve1: MeasVal;
  outletPressure: MeasVal;
  inletPressure: MeasVal;
}

export interface AshShwayrifFcsReading {
  dailyFlow: MeasVal;
  openingValve8: MeasVal;
  openingValve7: MeasVal;
  openingValve6: MeasVal;
  openingValve5: MeasVal;
  outletPressure: MeasVal;
  inletPressure: MeasVal;
}

export interface EasternBranchReading {
  rowIndex: number;
  dayNo: number | null;
  dateLabel: string | null;
  aenZara: AenZaraValveReading;
  airport: AirportValveReading;
  sidiSaiah: SidiSaiahFcsReading;
  garabulli: GarabulliRtReading;
  wadiTumallah: WadiTumallahFcsReading;
  ashShwayrifRtLevel: MeasVal;
  ashShwayrifFcs: AshShwayrifFcsReading;
}

export interface EasternBranchEngineOutput {
  filename: string;
  sheetName: string;
  readings: EasternBranchReading[];
  issues: string[];
  headerMap: Record<string, number | null>;
}

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

// Returns a parsed number, or the original short text code (n/av, n/sv, pass…), or null.
function asNumOrText(value: unknown): MeasVal {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').replace(/%/g, '').replace(/\s+/g, '');
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  // Short text codes (≤12 chars, no whitespace) – preserve as-is
  if (raw.length <= 12 && !/\s/.test(raw)) return raw.toLowerCase();
  return null;
}

function pickColumn(
  profiles: string[],
  groupRe: RegExp | null,
  fieldRe: RegExp,
): number | null {
  let bestIdx: number | null = null;
  let bestScore = -1;
  for (let i = 0; i < profiles.length; i += 1) {
    const p = profiles[i] || '';
    if (!p) continue;
    if (!fieldRe.test(p)) continue;
    const hasGroup = groupRe ? groupRe.test(p) : true;
    let score = 2;
    if (hasGroup) score += 3;
    if (p.length < 220) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
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
    if (seen.has(29) || seen.has(30) || seen.has(31)) score += 8;  // last day of month (0-based or 1-based)
    if (coverage > 0.7) score += 10;

    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
  }

  return bestScore >= 28 ? bestCol : null;
}

function detectAshFcsByValuePattern(
  grid: unknown[][],
  maxCols: number,
  dayCol: number,
): {
  dailyFlow: number;
  openingValve8: number;
  openingValve7: number;
  openingValve6: number;
  openingValve5: number;
  outletPressure: number;
  inletPressure: number;
  score: number;
} | null {
  const dayRows: number[] = [];
  for (let r = 8; r < Math.min(grid.length, 90); r += 1) {
    const d = asNum(grid[r]?.[dayCol]);
    if (d !== null && Number.isInteger(d) && d >= 1 && d <= 31) dayRows.push(r);
  }
  if (dayRows.length < 4) return null;

  const scoreCols = (idx: number[]) => {
    const vals = idx.map(() => [] as number[]);
    for (const r of dayRows) {
      for (let i = 0; i < idx.length; i += 1) {
        const v = asNum(grid[r]?.[idx[i]]);
        if (v !== null) vals[i].push(v);
      }
    }

    const ratio = vals.map((a) => a.length / dayRows.length);
    const avg = vals.map((a) => (a.length > 0 ? a.reduce((s, x) => s + x, 0) / a.length : 0));
    const inRangeRatio = (arr: number[], min: number, max: number) => {
      if (arr.length === 0) return 0;
      const ok = arr.filter((v) => v >= min && v <= max).length;
      return ok / arr.length;
    };

    // [flow, open8, open7, open6, open5, outlet, inlet]
    const flowScore = ratio[0] * 4 + (avg[0] > 300 ? 3 : avg[0] > 30 ? 1 : 0);
    const openScore =
      inRangeRatio(vals[1], 0, 100) * 2 +
      inRangeRatio(vals[2], 0, 100) * 2 +
      inRangeRatio(vals[3], 0, 100) * 2 +
      inRangeRatio(vals[4], 0, 100) * 2;
    const pressureScore =
      inRangeRatio(vals[5], 0, 40) * 2 +
      inRangeRatio(vals[6], 0, 40) * 2;
    const density = ratio.reduce((s, x) => s + x, 0);
    return flowScore + openScore + pressureScore + density;
  };

  let best: {
    dailyFlow: number;
    openingValve8: number;
    openingValve7: number;
    openingValve6: number;
    openingValve5: number;
    outletPressure: number;
    inletPressure: number;
    score: number;
  } | null = null;

  for (let start = 0; start <= maxCols - 7; start += 1) {
    const cols = [start, start + 1, start + 2, start + 3, start + 4, start + 5, start + 6];
    if (cols.includes(dayCol)) continue;

    const sForward = scoreCols(cols);
    if (!best || sForward > best.score) {
      best = {
        dailyFlow: cols[0],
        openingValve8: cols[1],
        openingValve7: cols[2],
        openingValve6: cols[3],
        openingValve5: cols[4],
        outletPressure: cols[5],
        inletPressure: cols[6],
        score: sForward,
      };
    }

    const rev = [...cols].reverse();
    const sReverse = scoreCols(rev);
    if (!best || sReverse > best.score) {
      best = {
        dailyFlow: rev[0],
        openingValve8: rev[1],
        openingValve7: rev[2],
        openingValve6: rev[3],
        openingValve5: rev[4],
        outletPressure: rev[5],
        inletPressure: rev[6],
        score: sReverse,
      };
    }
  }

  return best && best.score >= 10 ? best : null;
}

function detectSheetName(wb: XLSX.WorkBook): string | null {
  const names = wb.SheetNames || [];
  const byName = names.find((name) => {
    const n = normalizeText(name);
    return /eastren branch|eastern branch|eastrern branch|الفرع الشرقي|eastern|eastren/.test(n);
  });
  if (byName) return byName;

  // Fallback: find sheet containing several Eastern-branch station signatures.
  const signatures = [/aen zara|عين زاره/, /air ?port|المطار/, /sidi saiah|سيدي السايح/, /garabulli|القربولي/, /wadi tumallah|وادي تماله/, /ash shwayrif|الشويرف/];
  let bestSheet: string | null = null;
  let bestScore = -1;
  for (const name of names) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    const sample = grid.slice(0, 14).flat().map((v) => normalizeText(v)).join(' | ');
    let score = 0;
    for (const re of signatures) if (re.test(sample)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestSheet = name;
    }
  }
  return bestScore >= 2 ? bestSheet : null;
}

function sheetToGridWithMergedHeaders(ws: XLSX.WorkSheet): unknown[][] {
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows = range.e.r + 1;
  const cols = range.e.c + 1;

  const grid: unknown[][] = Array.from({ length: rows }).map(() => Array.from({ length: cols }).map(() => ''));
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
        if (grid[r]?.[c] === '' || grid[r]?.[c] === null || grid[r]?.[c] === undefined) {
          grid[r][c] = topLeft;
        }
      }
    }
  }

  return grid;
}

export function extractEasternBranchEngine(
  wb: XLSX.WorkBook,
  filename: string,
): EasternBranchEngineOutput {
  const issues: string[] = [];
  const sheetName = detectSheetName(wb);
  if (!sheetName) {
    return {
      filename,
      sheetName: '',
      readings: [],
      issues: ['لم يتم العثور على ورقة Eastern Branch في الملف.'],
      headerMap: {},
    };
  }

  const ws = wb.Sheets[sheetName];

  const grid = sheetToGridWithMergedHeaders(ws);
  if (!Array.isArray(grid) || grid.length === 0) {
    return { filename, sheetName, readings: [], issues: [...issues, 'الورقة فارغة.'], headerMap: {} };
  }

  const maxCols = grid.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);

  const profileRows = Math.min(16, grid.length);
  const profiles = Array.from({ length: maxCols }).map((_, c) => {
    const parts: string[] = [];
    for (let r = 0; r < profileRows; r += 1) {
      parts.push(normalizeText(grid[r]?.[c]));
    }
    return parts.join(' | ');
  });

  const group = {
    day: /\bday\b|\bdate\b|اليوم|التاريخ/,
    aenZara: /aen zara|ain zara|عين زاره|عين زارة/,
    airport: /air ?port|airport|المطار/,
    sidiSaiah: /sidi saiah|sidi sayah|سيدي السايح/,
    garabulli: /garabulli|قارابولي|قربولي|القربولي/,
    wadiTumallah: /wadi tumallah|تماله|وادي/,
    ashShwayrifRt: /ash\s*shwayrif\s*r\.?t|الشويرف\s*r\.?t|ash shwayrif r t/,
    ashShwayrifFcs: /ash\s*shwayrif\s*flow control station|ash\s*shwayrif\s*fcs|محطه\s*الشويرف|الشويرف\s*flow/,
  };

  const field = {
    dailyFlow: /daily\s*flow|m3\/?day|معدل\s*تدفق|التدفق\s*اليومي/,
    outletPressure: /outlet\s*press|outlet\s*pressure|ضغط\s*الخروج/,
    inletPressure: /inlet\s*press|inlet\s*pressure|ضغط\s*الدخول/,
    openingValve: /opening\s*valve|opening|نسبة\s*الفتح|فتح\s*الصمام|%/,
    level: /\blevel\b|منسوب/,
    intentFlow: /intent\s*flow|instant\s*flow|intent flow|\bflow\b.*\b1\b|\bflow\b.*\b2\b|\bflow\b.*\b3\b/,
  };

  let col = {
    day: pickColumn(profiles, null, group.day),

    aenZara: {
      outletPressure: pickColumn(profiles, group.aenZara, field.outletPressure),
      inletPressure: pickColumn(profiles, group.aenZara, field.inletPressure),
      openingValvePct: pickColumn(profiles, group.aenZara, field.openingValve),
    },

    airport: {
      dailyFlow: pickColumn(profiles, group.airport, field.dailyFlow),
      intentFlow2: pickColumn(profiles, group.airport, /intent.*\b2\b|\b2\b.*intent|\b2\b/),
      intentFlow1: pickColumn(profiles, group.airport, /intent.*\b1\b|\b1\b.*intent|\b1\b/),
      intentFlow3: pickColumn(profiles, group.airport, /intent.*\b3\b|\b3\b.*intent|\b3\b/),
      outletPressure: pickColumn(profiles, group.airport, field.outletPressure),
      inletPressure: pickColumn(profiles, group.airport, field.inletPressure),
      openingValvePct: pickColumn(profiles, group.airport, field.openingValve),
    },

    sidiSaiah: {
      rtLevel: pickColumn(profiles, group.sidiSaiah, /\br\.?t\b|level|منسوب/),
      dailyFlow: pickColumn(profiles, group.sidiSaiah, field.dailyFlow),
      openingValve2: pickColumn(profiles, group.sidiSaiah, /opening.*\b2\b|\b2\b.*opening|\b2\b/),
      openingValve3: pickColumn(profiles, group.sidiSaiah, /opening.*\b3\b|\b3\b.*opening|\b3\b/),
      outletPressure: pickColumn(profiles, group.sidiSaiah, field.outletPressure),
      inletPressure: pickColumn(profiles, group.sidiSaiah, field.inletPressure),
    },

    garabulli: {
      dailyFlow: pickColumn(profiles, group.garabulli, field.dailyFlow),
      level: pickColumn(profiles, group.garabulli, field.level),
    },

    wadiTumallah: {
      dailyFlow: pickColumn(profiles, group.wadiTumallah, field.dailyFlow),
      openingValve3: pickColumn(profiles, group.wadiTumallah, /opening.*\b3\b|\b3\b.*opening|\b3\b/),
      openingValve2: pickColumn(profiles, group.wadiTumallah, /opening.*\b2\b|\b2\b.*opening|\b2\b/),
      openingValve1: pickColumn(profiles, group.wadiTumallah, /opening.*\b1\b|\b1\b.*opening|\b1\b/),
      outletPressure: pickColumn(profiles, group.wadiTumallah, field.outletPressure),
      inletPressure: pickColumn(profiles, group.wadiTumallah, field.inletPressure),
    },

    ashShwayrifRtLevel: pickColumn(profiles, group.ashShwayrifRt, /level|منسوب/),

    ashShwayrifFcs: {
      dailyFlow: pickColumn(profiles, group.ashShwayrifFcs, field.dailyFlow),
      openingValve8: pickColumn(profiles, group.ashShwayrifFcs, /opening.*\b8\b|\b8\b.*opening|\b8\b/),
      openingValve7: pickColumn(profiles, group.ashShwayrifFcs, /opening.*\b7\b|\b7\b.*opening|\b7\b/),
      openingValve6: pickColumn(profiles, group.ashShwayrifFcs, /opening.*\b6\b|\b6\b.*opening|\b6\b/),
      openingValve5: pickColumn(profiles, group.ashShwayrifFcs, /opening.*\b5\b|\b5\b.*opening|\b5\b/),
      outletPressure: pickColumn(profiles, group.ashShwayrifFcs, field.outletPressure),
      inletPressure: pickColumn(profiles, group.ashShwayrifFcs, field.inletPressure),
    },
  };

  const dayBySequence = detectDayColumnBySequence(grid, maxCols);
  if (dayBySequence !== null) {
    col.day = dayBySequence;
    issues.push(`تم تحديد عمود اليوم من تسلسل البيانات: col=${dayBySequence}`);
  }

  // value-pattern detection disabled – explicit offset map is authoritative.

  // Explicit mapping from Day column outward to the LEFT in display (= higher indices in XLSX RTL sheet).
  // Excel RTL: Day is at col 0 (rightmost display), data groups extend to higher col indices.
  // Offsets derived from the actual Eastern Branch daily report structure.
  const applyExplicitMap = (dayCol: number) => {
    if (dayCol + 32 >= maxCols) return false;

    // Ash Shwayrif Flow Control Station (7 cols)
    col.ashShwayrifFcs.inletPressure  = dayCol + 1;
    col.ashShwayrifFcs.outletPressure = dayCol + 2;
    col.ashShwayrifFcs.openingValve5  = dayCol + 3;
    col.ashShwayrifFcs.openingValve6  = dayCol + 4;
    col.ashShwayrifFcs.openingValve7  = dayCol + 5;
    col.ashShwayrifFcs.openingValve8  = dayCol + 6;
    col.ashShwayrifFcs.dailyFlow      = dayCol + 7;

    // Ash Shwayrif R.T (1 col)
    col.ashShwayrifRtLevel = dayCol + 8;

    // Wadi Tumallah FCS (6 cols)
    col.wadiTumallah.inletPressure  = dayCol + 9;
    col.wadiTumallah.outletPressure = dayCol + 10;
    col.wadiTumallah.openingValve1  = dayCol + 11;
    col.wadiTumallah.openingValve2  = dayCol + 12;
    col.wadiTumallah.openingValve3  = dayCol + 13;
    col.wadiTumallah.dailyFlow      = dayCol + 14;

    // Garabulli R.T (2 cols)
    col.garabulli.level     = dayCol + 15;
    col.garabulli.dailyFlow = dayCol + 16;

    // Sidi Saiah: header-based detection (pickColumn) is used – not overridden here.
    // The explicit offset for Sidi Saiah is uncertain; let the header scanner handle it.

    // Airport FCS: confirmed column layout from data inspection
    // outletPressure | openingValvePct(decimal 0.70) | inletPressure | intentFlow1 | intentFlow2 | intentFlow3 | dailyFlow
    col.airport.outletPressure  = dayCol + 23;
    col.airport.openingValvePct = dayCol + 24;  // stored as decimal (0.70 → normPct → 70)
    col.airport.inletPressure   = dayCol + 25;
    col.airport.intentFlow1     = dayCol + 26;
    col.airport.intentFlow2     = dayCol + 27;
    col.airport.intentFlow3     = dayCol + 28;
    col.airport.dailyFlow       = dayCol + 29;

    // Aen Zara FCS: openingValvePct | inletPressure | outletPressure
    // openingValvePct may be text "19%" (asNum strips % → 19) or decimal 0.19 (normPct → 19)
    col.aenZara.openingValvePct = dayCol + 30;
    col.aenZara.inletPressure   = dayCol + 31;
    col.aenZara.outletPressure  = dayCol + 32;
    return true;
  };

  if (col.day !== null) {
    if (applyExplicitMap(col.day)) {
      issues.push(`تم اعتماد خريطة Eastern Branch (يوم+offset) col=${col.day}`);
    } else {
      issues.push(`فشل تطبيق الخريطة الصريحة: dayCol=${col.day} maxCols=${maxCols}`);
    }
    // Diagnostic: log raw values at cols 7-17 for first actual data row
    let dbgDataRow: unknown[] = [];
    let dbgRowIdx = -1;
    for (let ri = 8; ri < Math.min(grid.length, 30); ri++) {
      const dayVal = asNum(grid[ri]?.[col.day ?? 0]);
      if (dayVal !== null && Number.isInteger(dayVal) && dayVal >= 0 && dayVal <= 31) {
        dbgDataRow = (grid[ri] as unknown[]) || [];
        dbgRowIdx = ri;
        break;
      }
    }
    if (dbgRowIdx >= 0) {
      const dbgVals = Array.from({ length: 11 }, (_, i) => `c${7 + i}='${String(dbgDataRow[7 + i] ?? '')}'`).join(' ');
      issues.push(`DEBUG row${dbgRowIdx} cols 7-17: ${dbgVals}`);
    }
  }

  const buildAnchoredCols = (day: number, dir: 1 | -1, nearDayFirst: boolean) => {
    const idx = (off: number) => day + (dir * off);
    if (idx(33) < 0 || idx(33) >= maxCols) return null;

    // Block A (3): Aen Zara
    // Block B (7): Airport
    // Block C (6): Sidi Saiah FCS
    // Block D (2): Garabulli RT
    // Block E (6): Wadi Tumallah FCS
    // Block F (1): Ash Shwayrif RT
    // Block G (7): Ash Shwayrif FCS
    // Two possible orders are observed across files.
    const order = nearDayFirst
      ? ['A', 'B', 'C', 'D', 'E', 'F', 'G']
      : ['G', 'F', 'E', 'D', 'C', 'B', 'A'];

    let p = 1;
    const ranges: Record<string, number[]> = {};
    for (const b of order) {
      const len = b === 'A' ? 3 : b === 'B' ? 7 : b === 'C' ? 6 : b === 'D' ? 2 : b === 'E' ? 6 : b === 'F' ? 1 : 7;
      ranges[b] = Array.from({ length: len }).map((_, i) => idx(p + i));
      p += len;
    }

    const A = ranges.A;
    const B = ranges.B;
    const C = ranges.C;
    const D = ranges.D;
    const E = ranges.E;
    const F = ranges.F;
    const G = ranges.G;

    return {
      day,
      aenZara: {
        outletPressure: A[0],
        inletPressure: A[1],
        openingValvePct: A[2],
      },
      airport: {
        dailyFlow: B[0],
        intentFlow2: B[1],
        intentFlow1: B[2],
        intentFlow3: B[3],
        outletPressure: B[4],
        inletPressure: B[5],
        openingValvePct: B[6],
      },
      sidiSaiah: {
        rtLevel: C[0],
        dailyFlow: C[1],
        openingValve2: C[2],
        openingValve3: C[3],
        outletPressure: C[4],
        inletPressure: C[5],
      },
      garabulli: {
        dailyFlow: D[0],
        level: D[1],
      },
      wadiTumallah: {
        dailyFlow: E[0],
        openingValve3: E[1],
        openingValve2: E[2],
        openingValve1: E[3],
        outletPressure: E[4],
        inletPressure: E[5],
      },
      ashShwayrifRtLevel: F[0],
      ashShwayrifFcs: {
        dailyFlow: G[0],
        openingValve8: G[1],
        openingValve7: G[2],
        openingValve6: G[3],
        openingValve5: G[4],
        outletPressure: G[5],
        inletPressure: G[6],
      },
    };
  };

  const scoreAnchoredCols = (candidate: ReturnType<typeof buildAnchoredCols>): number => {
    if (!candidate) return -1;
    let score = 0;
    for (let r = 8; r < Math.min(grid.length, 46); r += 1) {
      const row = grid[r] || [];
      const d = asNum(row[candidate.day]);
      if (d === null || !Number.isInteger(d) || d < 1 || d > 31) continue;

      const vals = [
        asNum(row[candidate.aenZara.inletPressure]),
        asNum(row[candidate.airport.dailyFlow]),
        asNum(row[candidate.sidiSaiah.dailyFlow]),
        asNum(row[candidate.garabulli.dailyFlow]),
        asNum(row[candidate.wadiTumallah.dailyFlow]),
        asNum(row[candidate.ashShwayrifRtLevel]),
        asNum(row[candidate.ashShwayrifFcs.dailyFlow]),
      ];
      score += vals.filter((v) => v !== null).length;
    }
    return score;
  };

  const ashMappingReady =
    col.ashShwayrifFcs.dailyFlow !== null ||
    col.ashShwayrifFcs.inletPressure !== null ||
    col.ashShwayrifFcs.outletPressure !== null;

  if (col.day !== null && !ashMappingReady) {
    const candidates = [
      { id: 'dir+1_nearAen', c: buildAnchoredCols(col.day, 1, true) },
      { id: 'dir+1_nearAsh', c: buildAnchoredCols(col.day, 1, false) },
      { id: 'dir-1_nearAen', c: buildAnchoredCols(col.day, -1, true) },
      { id: 'dir-1_nearAsh', c: buildAnchoredCols(col.day, -1, false) },
    ];
    let best = { id: 'fuzzy', c: null as ReturnType<typeof buildAnchoredCols>, score: -1 };
    for (const x of candidates) {
      const s = scoreAnchoredCols(x.c);
      if (s > best.score) best = { id: x.id, c: x.c, score: s };
    }
    if (best.c && best.score >= 3) {
      col = {
        day: best.c.day,
        aenZara: best.c.aenZara,
        airport: best.c.airport,
        sidiSaiah: best.c.sidiSaiah,
        garabulli: best.c.garabulli,
        wadiTumallah: best.c.wadiTumallah,
        ashShwayrifRtLevel: best.c.ashShwayrifRtLevel,
        ashShwayrifFcs: best.c.ashShwayrifFcs,
      };
      issues.push(`Anchored layout selected: ${best.id} (score=${best.score})`);
    } else {
      issues.push('لم يتم اعتماد التخطيط الثابت للأعمدة، تم الرجوع إلى مطابقة العناوين.');
    }
  }

  const headerMap: Record<string, number | null> = {
    day: col.day,

    aenZara_outletPressure: col.aenZara.outletPressure,
    aenZara_inletPressure: col.aenZara.inletPressure,
    aenZara_openingValvePct: col.aenZara.openingValvePct,

    airport_dailyFlow: col.airport.dailyFlow,
    airport_intentFlow2: col.airport.intentFlow2,
    airport_intentFlow1: col.airport.intentFlow1,
    airport_intentFlow3: col.airport.intentFlow3,
    airport_outletPressure: col.airport.outletPressure,
    airport_inletPressure: col.airport.inletPressure,
    airport_openingValvePct: col.airport.openingValvePct,

    sidiSaiah_rtLevel: col.sidiSaiah.rtLevel,
    sidiSaiah_dailyFlow: col.sidiSaiah.dailyFlow,
    sidiSaiah_openingValve2: col.sidiSaiah.openingValve2,
    sidiSaiah_openingValve3: col.sidiSaiah.openingValve3,
    sidiSaiah_outletPressure: col.sidiSaiah.outletPressure,
    sidiSaiah_inletPressure: col.sidiSaiah.inletPressure,

    garabulli_dailyFlow: col.garabulli.dailyFlow,
    garabulli_level: col.garabulli.level,

    wadiTumallah_dailyFlow: col.wadiTumallah.dailyFlow,
    wadiTumallah_openingValve3: col.wadiTumallah.openingValve3,
    wadiTumallah_openingValve2: col.wadiTumallah.openingValve2,
    wadiTumallah_openingValve1: col.wadiTumallah.openingValve1,
    wadiTumallah_outletPressure: col.wadiTumallah.outletPressure,
    wadiTumallah_inletPressure: col.wadiTumallah.inletPressure,

    ashShwayrif_rtLevel: col.ashShwayrifRtLevel,

    ashShwayrifFcs_dailyFlow: col.ashShwayrifFcs.dailyFlow,
    ashShwayrifFcs_openingValve8: col.ashShwayrifFcs.openingValve8,
    ashShwayrifFcs_openingValve7: col.ashShwayrifFcs.openingValve7,
    ashShwayrifFcs_openingValve6: col.ashShwayrifFcs.openingValve6,
    ashShwayrifFcs_openingValve5: col.ashShwayrifFcs.openingValve5,
    ashShwayrifFcs_outletPressure: col.ashShwayrifFcs.outletPressure,
    ashShwayrifFcs_inletPressure: col.ashShwayrifFcs.inletPressure,
  };

  if (col.day === null) issues.push('لم يتم التعرف على عمود اليوم بشكل واضح في Eastern Branch.');

  // Excel stores opening percentages as decimals (0.40 = 40%). Normalize to whole numbers.
  const normPct = (v: MeasVal): MeasVal => {
    if (v === null || typeof v === 'string') return v;
    return v > 0 && v <= 1.0 ? Math.round(v * 100) : v;
  };

  const readings: EasternBranchReading[] = [];
  let reachedMonthEnd = false;

  for (let r = 8; r < grid.length; r += 1) {
    if (reachedMonthEnd) break;
    const row = grid[r] || [];
    const dayNo = col.day !== null ? asNum(row[col.day]) : null;

    const reading: EasternBranchReading = {
      rowIndex: r,
      dayNo,
      dateLabel: col.day !== null ? String(row[col.day] ?? '') : null,
      aenZara: {
        outletPressure: col.aenZara.outletPressure !== null ? asNumOrText(row[col.aenZara.outletPressure]) : null,
        inletPressure: col.aenZara.inletPressure !== null ? asNumOrText(row[col.aenZara.inletPressure]) : null,
        openingValvePct: col.aenZara.openingValvePct !== null ? normPct(asNumOrText(row[col.aenZara.openingValvePct])) : null,
      },
      airport: {
        dailyFlow: col.airport.dailyFlow !== null ? asNumOrText(row[col.airport.dailyFlow]) : null,
        intentFlow2: col.airport.intentFlow2 !== null ? asNumOrText(row[col.airport.intentFlow2]) : null,
        intentFlow1: col.airport.intentFlow1 !== null ? asNumOrText(row[col.airport.intentFlow1]) : null,
        intentFlow3: col.airport.intentFlow3 !== null ? asNumOrText(row[col.airport.intentFlow3]) : null,
        outletPressure: col.airport.outletPressure !== null ? asNumOrText(row[col.airport.outletPressure]) : null,
        inletPressure: col.airport.inletPressure !== null ? asNumOrText(row[col.airport.inletPressure]) : null,
        openingValvePct: col.airport.openingValvePct !== null ? normPct(asNumOrText(row[col.airport.openingValvePct])) : null,
      },
      sidiSaiah: {
        rtLevel: col.sidiSaiah.rtLevel !== null ? asNumOrText(row[col.sidiSaiah.rtLevel]) : null,
        dailyFlow: col.sidiSaiah.dailyFlow !== null ? asNumOrText(row[col.sidiSaiah.dailyFlow]) : null,
        openingValve2: col.sidiSaiah.openingValve2 !== null ? normPct(asNumOrText(row[col.sidiSaiah.openingValve2])) : null,
        openingValve3: col.sidiSaiah.openingValve3 !== null ? normPct(asNumOrText(row[col.sidiSaiah.openingValve3])) : null,
        outletPressure: col.sidiSaiah.outletPressure !== null ? asNumOrText(row[col.sidiSaiah.outletPressure]) : null,
        inletPressure: col.sidiSaiah.inletPressure !== null ? asNumOrText(row[col.sidiSaiah.inletPressure]) : null,
      },
      garabulli: {
        dailyFlow: col.garabulli.dailyFlow !== null ? asNumOrText(row[col.garabulli.dailyFlow]) : null,
        level: col.garabulli.level !== null ? asNumOrText(row[col.garabulli.level]) : null,
      },
      wadiTumallah: {
        dailyFlow: col.wadiTumallah.dailyFlow !== null ? asNumOrText(row[col.wadiTumallah.dailyFlow]) : null,
        openingValve3: col.wadiTumallah.openingValve3 !== null ? normPct(asNumOrText(row[col.wadiTumallah.openingValve3])) : null,
        openingValve2: col.wadiTumallah.openingValve2 !== null ? normPct(asNumOrText(row[col.wadiTumallah.openingValve2])) : null,
        openingValve1: col.wadiTumallah.openingValve1 !== null ? normPct(asNumOrText(row[col.wadiTumallah.openingValve1])) : null,
        outletPressure: col.wadiTumallah.outletPressure !== null ? asNumOrText(row[col.wadiTumallah.outletPressure]) : null,
        inletPressure: col.wadiTumallah.inletPressure !== null ? asNumOrText(row[col.wadiTumallah.inletPressure]) : null,
      },
      ashShwayrifRtLevel: col.ashShwayrifRtLevel !== null ? asNumOrText(row[col.ashShwayrifRtLevel]) : null,
      ashShwayrifFcs: {
        dailyFlow: col.ashShwayrifFcs.dailyFlow !== null ? asNumOrText(row[col.ashShwayrifFcs.dailyFlow]) : null,
        openingValve8: col.ashShwayrifFcs.openingValve8 !== null ? normPct(asNumOrText(row[col.ashShwayrifFcs.openingValve8])) : null,
        openingValve7: col.ashShwayrifFcs.openingValve7 !== null ? normPct(asNumOrText(row[col.ashShwayrifFcs.openingValve7])) : null,
        openingValve6: col.ashShwayrifFcs.openingValve6 !== null ? normPct(asNumOrText(row[col.ashShwayrifFcs.openingValve6])) : null,
        openingValve5: col.ashShwayrifFcs.openingValve5 !== null ? normPct(asNumOrText(row[col.ashShwayrifFcs.openingValve5])) : null,
        outletPressure: col.ashShwayrifFcs.outletPressure !== null ? asNumOrText(row[col.ashShwayrifFcs.outletPressure]) : null,
        inletPressure: col.ashShwayrifFcs.inletPressure !== null ? asNumOrText(row[col.ashShwayrifFcs.inletPressure]) : null,
      },
    };

    const hasDay = dayNo !== null && Number.isInteger(dayNo) && dayNo >= 0 && dayNo <= 31;
    const hasSignal =
      (reading.aenZara.inletPressure ?? 0) > 0 ||
      (reading.airport.outletPressure ?? 0) > 0 ||
      (reading.airport.dailyFlow ?? 0) > 0 ||
      (reading.sidiSaiah.dailyFlow ?? 0) > 0 ||
      (reading.garabulli.dailyFlow ?? 0) > 0 ||
      (reading.wadiTumallah.dailyFlow ?? 0) > 0 ||
      (reading.ashShwayrifRtLevel ?? 0) > 0 ||
      (reading.ashShwayrifFcs.dailyFlow ?? 0) > 0 ||
      (reading.ashShwayrifFcs.inletPressure ?? 0) > 0 ||
      (reading.ashShwayrifFcs.outletPressure ?? 0) > 0 ||
      (reading.ashShwayrifFcs.openingValve5 ?? 0) > 0 ||
      (reading.ashShwayrifFcs.openingValve6 ?? 0) > 0 ||
      (reading.ashShwayrifFcs.openingValve7 ?? 0) > 0 ||
      (reading.ashShwayrifFcs.openingValve8 ?? 0) > 0;

    if (!hasDay && !hasSignal) continue;
    if (!hasDay) continue;

    readings.push(reading);
    if (dayNo === 31) reachedMonthEnd = true;
  }

  if (readings.length === 0) {
    issues.push('لم يتم استخراج قراءات يومية من Eastern Branch. راجع عناوين الأعمدة.');
  }

  return { filename, sheetName, readings, issues, headerMap };
}
