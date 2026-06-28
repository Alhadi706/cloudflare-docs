import * as XLSX from 'xlsx';

export type MeasVal = number | string | null;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Ps1StationReading {
  inletPressure: MeasVal;        // ضغط الدخول bar
  outletPressure: MeasVal;       // ضغط الخروج bar
  activePumpNo: MeasVal;         // رقم المضخة العاملة
  operationTime: MeasVal;        // زمن تشغيل  HH:MM
  stopTime: MeasVal;             // زمن الإيقاف  HH:MM
  totalOperationHours: MeasVal;  // فترة التشغيل الكلي hr
  pumpingVolume: MeasVal;        // كمية الضخ M3
}

export interface Ps2StationReading {
  inletPressure: MeasVal;        // ضغط الدخول bar
  outletPressure: MeasVal;       // ضغط الخروج bar
  activePumpNo: MeasVal;         // رقم المضخة العاملة
  operationTime: MeasVal;        // زمن تشغيل  HH:MM
  stopTime: MeasVal;             // زمن الإيقاف  HH:MM
  totalOperationHours: MeasVal;  // فترة التشغيل الكلي hr
  pumpingToTank: MeasVal;        // كمية الضخ للخزان M3
}

export interface TankLevelReading {
  cellA: MeasVal;   // الخلية (A) m
  cellB: MeasVal;   // الخلية (B) m
  cellC: MeasVal;   // الخلية (C) m
  cellD: MeasVal;   // الخلية (D) m
  cellE: MeasVal;   // الخلية (E) m
}

export interface TazReading {
  rowIndex: number;
  dayNo: number | null;
  ps1: Ps1StationReading;
  ps2: Ps2StationReading;
  tankLevel: TankLevelReading;
  gharyanConsumption: MeasVal;   // كمية المياه المستهلكة لمدينة غريان M3/day
}

export interface TazEngineOutput {
  filename: string;
  sheetName: string;
  readings: TazReading[];
  issues: string[];
  headerMap: Record<string, number | null>;
}

// ─── Column offsets from Day column (verified from Excel column headers) ──────
// dayCol+0  : اليوم (Day 1-31)
//
// محطة الضخ (PS1) — pumps from Tarhunah source to PS2
// dayCol+1  : PS1 ضغط الدخول bar
// dayCol+2  : PS1 ضغط الخروج bar
// dayCol+3  : PS1 رقم المضخة العاملة
// dayCol+4  : PS1 زمن تشغيل HH:MM
// dayCol+5  : PS1 زمن الإيقاف HH:MM
// dayCol+6  : PS1 فترة التشغيل الكلي hr
// dayCol+7  : PS1 كمية الضخ M3
//
// محطة الضخ (PS2) — pumps to Abu Zayan reservoir
// dayCol+8  : PS2 ضغط الدخول bar
// dayCol+9  : PS2 ضغط الخروج bar
// dayCol+10 : PS2 رقم المضخة العاملة
// dayCol+11 : PS2 زمن تشغيل HH:MM
// dayCol+12 : PS2 زمن الإيقاف HH:MM
// dayCol+13 : PS2 فترة التشغيل الكلي hr
// dayCol+14 : PS2 كمية الضخ للخزان M3
//
// منسوب الخزان
// dayCol+15 : Tank Cell A m
// dayCol+16 : Tank Cell B m
// dayCol+17 : Tank Cell C m
// dayCol+18 : Tank Cell D m
// dayCol+19 : Tank Cell E m
//
// dayCol+20 : كمية المياه المستهلكة لمدينة غريان M3/day

const REQUIRED_OFFSET = 20;

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

function asNumOrText(value: unknown): MeasVal {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').replace(/%/g, '').replace(/\s+/g, '');
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  // Short text codes ≤12 chars without spaces (NAV, N/AV, pass, 0:00, 12:30…)
  if (raw.length <= 12 && !/\s/.test(raw)) return raw.toLowerCase();
  return null;
}

// Build grid using cell.w (formatted text) preferring over cell.v so that
// time values stored as numeric fractions (e.g. 0 → "0:00") are preserved.
function sheetToGrid(ws: XLSX.WorkSheet): unknown[][] {
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
      // Prefer formatted string (cell.w) to keep time format "0:00" etc.
      grid[r][c] = cell?.w ?? cell?.v ?? '';
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

    for (let r = 3; r < Math.min(grid.length, 90); r += 1) {
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

  // 1. Direct TAZ match (exact or contains)
  const byName = names.find((name) => {
    const n = normalizeText(name);
    return (
      n === 'taz' ||
      n.includes('taz') ||
      /abu zayan|ابو زيان|ابوزيان/.test(n) ||
      /tarhunah.*zayan|zayan.*tarhunah/.test(n)
    );
  });
  if (byName) return byName;

  // 2. Content signatures: look for PS2 / غريان / أبو زيان keywords in sheet
  const signatures = [
    /ps2|محطه الضخ|محطة الضخ/,
    /gharyan|غريان/,
    /abu zayan|ابو زيان/,
    /منسوب الخزان|خزان ابو زيان/,
  ];

  let bestSheet: string | null = null;
  let bestScore = -1;

  for (const name of names) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const range = ws['!ref'];
    if (!range) continue;
    const r = XLSX.utils.decode_range(range);
    const checkRows = Math.min(r.e.r + 1, 15);
    const checkCols = Math.min(r.e.c + 1, 30);
    let score = 0;
    const cellTexts: string[] = [];

    for (let row = 0; row < checkRows; row += 1) {
      for (let col = 0; col < checkCols; col += 1) {
        const addr = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = ws[addr];
        if (cell?.v) cellTexts.push(normalizeText(String(cell.v)));
      }
    }

    const combined = cellTexts.join(' ');
    for (const sig of signatures) {
      if (sig.test(combined)) score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSheet = name;
    }
  }

  return bestScore >= 6 ? bestSheet : null;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function extractTazEngine(wb: XLSX.WorkBook, filename: string): TazEngineOutput {
  const out: TazEngineOutput = {
    filename,
    sheetName: '',
    readings: [],
    issues: [],
    headerMap: {},
  };

  const sheetName = detectSheetName(wb);
  if (!sheetName) {
    out.issues.push('لم يتم العثور على ورقة TAZ (ترهونة - أبو زيان) في الملف.');
    return out;
  }
  out.sheetName = sheetName;

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    out.issues.push(`ورقة "${sheetName}" غير موجودة.`);
    return out;
  }

  const grid = sheetToGrid(ws);
  const maxCols = Math.max(...grid.map((r) => r.length), 0);

  const dayCol = detectDayColumnBySequence(grid, maxCols);
  if (dayCol === null) {
    out.issues.push('لم يتم اكتشاف عمود اليوم (تسلسل 1-31).');
    return out;
  }

  if (dayCol + REQUIRED_OFFSET >= maxCols) {
    out.issues.push(
      `عمود اليوم=${dayCol}، الأعمدة المطلوبة تصل إلى ${dayCol + REQUIRED_OFFSET}، ` +
      `لكن الورقة تحتوي على ${maxCols} عمود فقط.`,
    );
    return out;
  }

  out.headerMap = {
    day:                       dayCol,
    ps1_inlet_pressure:        dayCol + 1,
    ps1_outlet_pressure:       dayCol + 2,
    ps1_active_pump_no:        dayCol + 3,
    ps1_operation_time:        dayCol + 4,
    ps1_stop_time:             dayCol + 5,
    ps1_total_operation_hours: dayCol + 6,
    ps1_pumping_volume:        dayCol + 7,
    ps2_inlet_pressure:        dayCol + 8,
    ps2_outlet_pressure:       dayCol + 9,
    ps2_active_pump_no:        dayCol + 10,
    ps2_operation_time:        dayCol + 11,
    ps2_stop_time:             dayCol + 12,
    ps2_total_operation_hours: dayCol + 13,
    ps2_pumping_to_tank:       dayCol + 14,
    tank_cell_a:               dayCol + 15,
    tank_cell_b:               dayCol + 16,
    tank_cell_c:               dayCol + 17,
    tank_cell_d:               dayCol + 18,
    tank_cell_e:               dayCol + 19,
    gharyan_consumption:       dayCol + 20,
  };

  // DEBUG: log first data row (show 22 offsets to cover full width)
  const firstDataRow = grid.findIndex(
    (row, idx) => idx > 3 && asNum(row[dayCol]) !== null && Number.isInteger(asNum(row[dayCol])),
  );
  if (firstDataRow >= 0) {
    const dbg = Array.from(
      { length: Math.min(22, maxCols - dayCol) },
      (_, i) => `[+${i}]=${grid[firstDataRow][dayCol + i]}`,
    ).join(', ');
    out.issues.push(`DEBUG TAZ first data row=${firstDataRow}: ${dbg}`);
  }

  // Extract readings
  for (let r = 3; r < grid.length; r += 1) {
    const row = grid[r];
    const dayRaw = row[dayCol];
    const dayNum = asNum(dayRaw);
    if (dayNum === null || !Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) continue;

    out.readings.push({
      rowIndex: r,
      dayNo: dayNum,
      ps1: {
        inletPressure:        asNumOrText(row[dayCol + 1]),
        outletPressure:       asNumOrText(row[dayCol + 2]),
        activePumpNo:         asNumOrText(row[dayCol + 3]),
        operationTime:        asNumOrText(row[dayCol + 4]),
        stopTime:             asNumOrText(row[dayCol + 5]),
        totalOperationHours:  asNumOrText(row[dayCol + 6]),
        pumpingVolume:        asNumOrText(row[dayCol + 7]),
      },
      ps2: {
        inletPressure:        asNumOrText(row[dayCol + 8]),
        outletPressure:       asNumOrText(row[dayCol + 9]),
        activePumpNo:         asNumOrText(row[dayCol + 10]),
        operationTime:        asNumOrText(row[dayCol + 11]),
        stopTime:             asNumOrText(row[dayCol + 12]),
        totalOperationHours:  asNumOrText(row[dayCol + 13]),
        pumpingToTank:        asNumOrText(row[dayCol + 14]),
      },
      tankLevel: {
        cellA: asNumOrText(row[dayCol + 15]),
        cellB: asNumOrText(row[dayCol + 16]),
        cellC: asNumOrText(row[dayCol + 17]),
        cellD: asNumOrText(row[dayCol + 18]),
        cellE: asNumOrText(row[dayCol + 19]),
      },
      gharyanConsumption: asNumOrText(row[dayCol + 20]),
    });
  }

  if (out.readings.length === 0) {
    out.issues.push('لم يتم استخراج أي قراءات من الورقة.');
  }

  return out;
}
