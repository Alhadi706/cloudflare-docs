import * as XLSX from 'xlsx';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ConsumptionArea {
  key: string;     // sequential key: area_1, area_2, ...
  name: string;    // original Arabic name from header row
  colIdx: number;  // physical column index in the sheet
}

export interface ConsumptionReading {
  rowIndex: number;
  dayNo: number | null;
  areaValues: Record<string, number | null>; // area_key → M3 value
  total: number | null;                       // sum of all individual area values
}

export interface ConsumptionEngineOutput {
  filename: string;
  sheetName: string;
  readings: ConsumptionReading[];
  issues: string[];
  areas: ConsumptionArea[];
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
    .replace(/\s+/g, ' ')
    .trim();
}

function asNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/,/g, '').replace(/%/g, '').replace(/\s+/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

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

function detectDayColumn(grid: unknown[][], maxCols: number): number | null {
  let bestCol: number | null = null;
  let bestScore = -1;

  for (let c = 0; c < maxCols; c += 1) {
    let score = 0;
    let prev: number | null = null;
    let streak = 0;
    let repeats = 0;
    let totalInts = 0;
    const seen = new Set<number>();

    for (let r = 3; r < Math.min(grid.length, 60); r += 1) {
      const n = asNum(grid[r]?.[c]);
      if (n === null || !Number.isInteger(n) || n < 1 || n > 31) continue;
      totalInts += 1;
      seen.add(n);
      if (prev !== null && n === prev) repeats += 1;
      if (prev !== null && n === prev + 1) streak += 1;
      prev = n;
    }

    const uniqueCount = seen.size;
    score += uniqueCount * 3;
    score += streak * 3;
    score -= repeats * 2;
    score += totalInts > 20 ? 8 : totalInts > 10 ? 4 : 0;
    if (seen.has(1)) score += 8;
    if (seen.has(29) || seen.has(30) || seen.has(31)) score += 8;
    if (uniqueCount / 31 > 0.7) score += 10;

    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
  }
  return bestScore >= 28 ? bestCol : null;
}

// Keywords that identify subtotal / group-header / production columns (not individual consumption areas)
const SUBTOTAL_RE = /إجمالي|اجمالي|مجموع|total|الاجمالي|الإجمالي|إنتاج|انتاج|الإنتاج|الانتاج/;
// Keywords that identify non-area label columns
const LABEL_RE = /^(الغرض|المدينه|المدينة|اليوم|التاريخ|ملاحظات|رقم|الرقم)$/;

function findHeaderRow(grid: unknown[][], maxCols: number): number {
  // Look for the row with 5+ Arabic area-name cells (ignore subtotals)
  const AREA_HINTS = /طرابلس|غريان|بني وليد|بنى وليد|زليتن|ترهون|مصراته|الخمس|شويرف|مصانع|علوس|قصر/;

  let bestRow = -1;
  let bestScore = -1;

  for (let r = 0; r < Math.min(10, grid.length); r += 1) {
    const row = grid[r];
    let score = 0;
    for (let c = 0; c < maxCols; c += 1) {
      const s = normalizeText(String(row[c] ?? ''));
      if (s.length < 2) continue;
      if (AREA_HINTS.test(s)) score += 5;
      else if (/[\u0600-\u06FF]/.test(s) && s.length > 3) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

function detectSheetName(wb: XLSX.WorkBook): string | null {
  const names = wb.SheetNames || [];

  // 1. Exact "consumption" match
  const exact = names.find((n) => n.toLowerCase().trim() === 'consumption');
  if (exact) return exact;

  // 2. Contains "consumption"
  const partial = names.find((n) => n.toLowerCase().includes('consumption'));
  if (partial) return partial;

  // 3. Arabic: استهلاك but NOT وضعية
  const arabic = names.find((n) => /استهلاك|تغذيه|تغذية/.test(n) && !/وضعيه|وضعية/.test(n));
  if (arabic) return arabic;

  return null;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function extractConsumptionEngine(wb: XLSX.WorkBook, filename: string): ConsumptionEngineOutput {
  const out: ConsumptionEngineOutput = {
    filename,
    sheetName: '',
    readings: [],
    issues: [],
    areas: [],
    headerMap: {},
  };

  const sheetName = detectSheetName(wb);
  if (!sheetName) {
    out.issues.push('لم يتم العثور على ورقة الاستهلاك (consumption) في الملف.');
    return out;
  }
  out.sheetName = sheetName;

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    out.issues.push(`ورقة "${sheetName}" غير موجودة.`);
    return out;
  }

  const grid = sheetToGrid(ws);
  const numRows = grid.length;
  const maxCols = Math.max(...grid.map((r) => r.length), 0);

  // Detect header row
  const headerRow = findHeaderRow(grid, maxCols);
  if (headerRow === -1) {
    out.issues.push('لم يتم العثور على صف الترويسة.');
    return out;
  }

  // Build area column map (exclude subtotals and label columns)
  let areaSeq = 1;
  for (let c = 0; c < maxCols; c += 1) {
    const rawName = String(grid[headerRow]?.[c] ?? '').trim();
    if (rawName.length < 2) continue;
    if (!/[\u0600-\u06FF]/.test(rawName)) continue;
    const norm = normalizeText(rawName);
    if (SUBTOTAL_RE.test(norm)) continue;
    if (LABEL_RE.test(norm)) continue;
    out.areas.push({ key: `area_${areaSeq++}`, name: rawName, colIdx: c });
  }

  if (out.areas.length === 0) {
    out.issues.push('لم يتم اكتشاف أعمدة مناطق الاستهلاك.');
    return out;
  }

  // Detect day column
  const dayCol = detectDayColumn(grid, maxCols);

  // Find first data row (after header, first row with numeric area values)
  let startRow = headerRow + 1;
  while (startRow < numRows) {
    const hasData = out.areas.some((a) => asNum(grid[startRow]?.[a.colIdx]) !== null);
    if (hasData) break;
    startRow += 1;
  }

  // DEBUG: log first data row
  if (startRow < numRows) {
    const dbg = out.areas.slice(0, 8).map((a) => `${a.name.slice(0, 8)}=${grid[startRow]?.[a.colIdx]}`).join(', ');
    out.issues.push(`DEBUG consumption: headerRow=${headerRow}, startRow=${startRow}, dayCol=${dayCol}, areas=${out.areas.length} — ${dbg}`);
  }

  out.headerMap = {
    header_row: headerRow,
    day_col: dayCol,
    start_row: startRow,
    ...Object.fromEntries(out.areas.map((a) => [a.key, a.colIdx])),
  };

  // Extract readings — stop on duplicate day (column-number rows and totals rows both repeat day 1)
  const seenDays = new Set<number>();
  for (let r = startRow; r < numRows; r += 1) {
    const row = grid[r];

    // Determine day number
    let dayNo: number | null = null;
    if (dayCol !== null) {
      const n = asNum(row[dayCol]);
      if (n !== null && Number.isInteger(n) && n >= 1 && n <= 31) dayNo = n;
      else continue; // skip non-day rows
    } else {
      dayNo = r - startRow + 1;
      if (dayNo > 31) break;
    }

    // Stop as soon as a day number repeats — marks the start of totals / column-number rows
    if (seenDays.has(dayNo)) break;
    seenDays.add(dayNo);

    // Hard safety cap: a month has at most 31 days
    if (out.readings.length >= 31) break;

    const areaValues: Record<string, number | null> = {};
    let total = 0;
    let hasAny = false;

    for (const area of out.areas) {
      const v = asNum(row[area.colIdx]);
      areaValues[area.key] = v;
      if (v !== null) { total += v; hasAny = true; }
    }

    if (!hasAny) continue;

    out.readings.push({ rowIndex: r, dayNo, areaValues, total: hasAny ? total : null });
  }

  if (out.readings.length === 0) {
    out.issues.push('لم يتم استخراج أي قراءات من الورقة.');
  }

  return out;
}
