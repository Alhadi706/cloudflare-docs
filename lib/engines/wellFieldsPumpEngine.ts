import * as XLSX from 'xlsx';

export interface PumpFieldGroupReading {
  dailyFlowPump: number | null;
  operatingPumps: number | null;
  outletPressure: number | null;
  forebayTankLevel: number | null;
  wellFieldDailyFlow: number | null;
  workingWells: number | null;
}

export interface WellFieldsPumpReading {
  rowIndex: number;
  dayNo: number | null;
  dateLabel: string | null;
  fezzanTankLevel: number | null;
  ejh: PumpFieldGroupReading;
  nejhS: PumpFieldGroupReading;
  nejhN: PumpFieldGroupReading;
}

export interface WellFieldsPumpEngineOutput {
  filename: string;
  sheetName: string;
  readings: WellFieldsPumpReading[];
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
    .replace(/[^\u0600-\u06FFa-z0-9\s()&_-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();
  // Accept only strict numeric cells; reject unit strings like m3/day.
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
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
    const hasField = fieldRe.test(p);
    if (!hasField) continue;
    const hasGroup = groupRe ? groupRe.test(p) : true;
    let score = hasField ? 2 : 0;
    if (hasGroup) score += 3;
    if (p.length < 180) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function detectSheetName(wb: XLSX.WorkBook): string | null {
  const names = wb.SheetNames || [];
  const target = names.find((name) => {
    const n = normalizeText(name);
    return /well fields|pump station|محطات الضخ|الابار|محطه ضخ/.test(n);
  });
  return target || null;
}

export function extractWellFieldsPumpEngine(
  wb: XLSX.WorkBook,
  filename: string,
): WellFieldsPumpEngineOutput {
  const issues: string[] = [];
  const sheetName = detectSheetName(wb);
  if (!sheetName) {
    return {
      filename,
      sheetName: '',
      readings: [],
      issues: ['لم يتم العثور على ورقة Well fields & Pump Stations في الملف.'],
      headerMap: {},
    };
  }

  const ws = wb.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
  if (!Array.isArray(grid) || grid.length === 0) {
    return { filename, sheetName, readings: [], issues: ['الورقة فارغة.'], headerMap: {} };
  }

  const maxCols = grid.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);
  const profileRows = Math.min(14, grid.length);
  const profiles = Array.from({ length: maxCols }).map((_, c) => {
    const parts: string[] = [];
    for (let r = 0; r < profileRows; r += 1) {
      parts.push(normalizeText(grid[r]?.[c]));
    }
    return parts.join(' | ');
  });

  const group = {
    ejh: /ejh|الشرقي|شرق/,
    nejhS: /nejh\s*\(s\)|جنوبي|south|الجنوبي/,
    nejhN: /nejh\s*\(n\)|شمالي|north|الشمالي/,
  };

  const field = {
    day: /\bday\b|\bdate\b|اليوم|التاريخ/,
    fezzan: /fezzan|فزان.*tank|منسوب.*فزان/,
    dailyFlowPump: /daily flow.*pump|معدل.*تدفق|كمية.*ضخ|ضخ.*يومي/,
    operatingPumps: /operating.*pump|مضخات.*عامله|عدد.*المضخات/,
    outletPressure: /outlet.*pressure|ضغط.*خروج/,
    forebayTankLevel: /forebay.*tank.*level|منسوب.*خزان|tank level/,
    wellFieldDailyFlow: /well field.*daily flow|انتاج.*ابار|well field.*flow/,
    workingWells: /working wells|الابار.*عامله|عدد.*الابار/,
  };

  const col = {
    day: pickColumn(profiles, null, field.day),
    fezzan: pickColumn(profiles, null, field.fezzan),
    ejh: {
      dailyFlowPump: pickColumn(profiles, group.ejh, field.dailyFlowPump),
      operatingPumps: pickColumn(profiles, group.ejh, field.operatingPumps),
      outletPressure: pickColumn(profiles, group.ejh, field.outletPressure),
      forebayTankLevel: pickColumn(profiles, group.ejh, field.forebayTankLevel),
      wellFieldDailyFlow: pickColumn(profiles, group.ejh, field.wellFieldDailyFlow),
      workingWells: pickColumn(profiles, group.ejh, field.workingWells),
    },
    nejhS: {
      dailyFlowPump: pickColumn(profiles, group.nejhS, field.dailyFlowPump),
      operatingPumps: pickColumn(profiles, group.nejhS, field.operatingPumps),
      outletPressure: pickColumn(profiles, group.nejhS, field.outletPressure),
      forebayTankLevel: pickColumn(profiles, group.nejhS, field.forebayTankLevel),
      wellFieldDailyFlow: pickColumn(profiles, group.nejhS, field.wellFieldDailyFlow),
      workingWells: pickColumn(profiles, group.nejhS, field.workingWells),
    },
    nejhN: {
      dailyFlowPump: pickColumn(profiles, group.nejhN, field.dailyFlowPump),
      operatingPumps: pickColumn(profiles, group.nejhN, field.operatingPumps),
      outletPressure: pickColumn(profiles, group.nejhN, field.outletPressure),
      forebayTankLevel: pickColumn(profiles, group.nejhN, field.forebayTankLevel),
      wellFieldDailyFlow: pickColumn(profiles, group.nejhN, field.wellFieldDailyFlow),
      workingWells: pickColumn(profiles, group.nejhN, field.workingWells),
    },
  };

  const headerMap: Record<string, number | null> = {
    day: col.day,
    fezzan: col.fezzan,
    ejh_dailyFlowPump: col.ejh.dailyFlowPump,
    ejh_operatingPumps: col.ejh.operatingPumps,
    ejh_outletPressure: col.ejh.outletPressure,
    ejh_forebayTankLevel: col.ejh.forebayTankLevel,
    ejh_wellFieldDailyFlow: col.ejh.wellFieldDailyFlow,
    ejh_workingWells: col.ejh.workingWells,
    nejhS_dailyFlowPump: col.nejhS.dailyFlowPump,
    nejhS_operatingPumps: col.nejhS.operatingPumps,
    nejhS_outletPressure: col.nejhS.outletPressure,
    nejhS_forebayTankLevel: col.nejhS.forebayTankLevel,
    nejhS_wellFieldDailyFlow: col.nejhS.wellFieldDailyFlow,
    nejhS_workingWells: col.nejhS.workingWells,
    nejhN_dailyFlowPump: col.nejhN.dailyFlowPump,
    nejhN_operatingPumps: col.nejhN.operatingPumps,
    nejhN_outletPressure: col.nejhN.outletPressure,
    nejhN_forebayTankLevel: col.nejhN.forebayTankLevel,
    nejhN_wellFieldDailyFlow: col.nejhN.wellFieldDailyFlow,
    nejhN_workingWells: col.nejhN.workingWells,
  };

  if (col.day === null) issues.push('لم يتم التعرف على عمود اليوم بشكل واضح.');

  const layoutAnchoredByDay =
    col.day !== null &&
    col.day + 19 < maxCols;

  const readGroupByOffsets = (row: unknown[], base: number): PumpFieldGroupReading => ({
    // In this sheet the group is ordered from right to left near Day:
    // working wells, well field daily flow, forebay tank level, outlet pressure, operating pump, daily flow pump.
    workingWells: asNum(row[base + 1]),
    wellFieldDailyFlow: asNum(row[base + 2]),
    forebayTankLevel: asNum(row[base + 3]),
    outletPressure: asNum(row[base + 4]),
    operatingPumps: asNum(row[base + 5]),
    dailyFlowPump: asNum(row[base + 6]),
  });

  const firstCandidateRow = Math.max(0, Math.min(8, grid.length - 1));
  const readings: WellFieldsPumpReading[] = [];
  let reachedMonthEnd = false;
  for (let r = firstCandidateRow; r < grid.length; r += 1) {
    if (reachedMonthEnd) break;
    const row = grid[r] || [];
    const dayNo = col.day !== null ? asNum(row[col.day]) : null;

    let ejh: PumpFieldGroupReading;
    let nejhS: PumpFieldGroupReading;
    let nejhN: PumpFieldGroupReading;
    let fezzanTankLevel: number | null;

    if (layoutAnchoredByDay && col.day !== null) {
      // A:day, B..G:EJH, H..M:NEJH(s), N..S:NEJH(n), T:Fezzan level
      ejh = readGroupByOffsets(row, col.day);
      nejhS = readGroupByOffsets(row, col.day + 6);
      nejhN = readGroupByOffsets(row, col.day + 12);
      fezzanTankLevel = asNum(row[col.day + 19]);
    } else {
      const ejhFlow = col.ejh.wellFieldDailyFlow !== null ? asNum(row[col.ejh.wellFieldDailyFlow]) : null;
      const sFlow = col.nejhS.wellFieldDailyFlow !== null ? asNum(row[col.nejhS.wellFieldDailyFlow]) : null;
      const nFlow = col.nejhN.wellFieldDailyFlow !== null ? asNum(row[col.nejhN.wellFieldDailyFlow]) : null;

      ejh = {
        dailyFlowPump: col.ejh.dailyFlowPump !== null ? asNum(row[col.ejh.dailyFlowPump]) : null,
        operatingPumps: col.ejh.operatingPumps !== null ? asNum(row[col.ejh.operatingPumps]) : null,
        outletPressure: col.ejh.outletPressure !== null ? asNum(row[col.ejh.outletPressure]) : null,
        forebayTankLevel: col.ejh.forebayTankLevel !== null ? asNum(row[col.ejh.forebayTankLevel]) : null,
        wellFieldDailyFlow: ejhFlow,
        workingWells: col.ejh.workingWells !== null ? asNum(row[col.ejh.workingWells]) : null,
      };
      nejhS = {
        dailyFlowPump: col.nejhS.dailyFlowPump !== null ? asNum(row[col.nejhS.dailyFlowPump]) : null,
        operatingPumps: col.nejhS.operatingPumps !== null ? asNum(row[col.nejhS.operatingPumps]) : null,
        outletPressure: col.nejhS.outletPressure !== null ? asNum(row[col.nejhS.outletPressure]) : null,
        forebayTankLevel: col.nejhS.forebayTankLevel !== null ? asNum(row[col.nejhS.forebayTankLevel]) : null,
        wellFieldDailyFlow: sFlow,
        workingWells: col.nejhS.workingWells !== null ? asNum(row[col.nejhS.workingWells]) : null,
      };
      nejhN = {
        dailyFlowPump: col.nejhN.dailyFlowPump !== null ? asNum(row[col.nejhN.dailyFlowPump]) : null,
        operatingPumps: col.nejhN.operatingPumps !== null ? asNum(row[col.nejhN.operatingPumps]) : null,
        outletPressure: col.nejhN.outletPressure !== null ? asNum(row[col.nejhN.outletPressure]) : null,
        forebayTankLevel: col.nejhN.forebayTankLevel !== null ? asNum(row[col.nejhN.forebayTankLevel]) : null,
        wellFieldDailyFlow: nFlow,
        workingWells: col.nejhN.workingWells !== null ? asNum(row[col.nejhN.workingWells]) : null,
      };
      fezzanTankLevel = col.fezzan !== null ? asNum(row[col.fezzan]) : null;
    }

    const ejhFlow = ejh.wellFieldDailyFlow;
    const sFlow = nejhS.wellFieldDailyFlow;
    const nFlow = nejhN.wellFieldDailyFlow;

    const hasDay = dayNo !== null && Number.isInteger(dayNo) && dayNo >= 0 && dayNo <= 31;
    const hasAnyFlow = (ejhFlow ?? 0) > 0 || (sFlow ?? 0) > 0 || (nFlow ?? 0) > 0;
    if (!hasDay && !hasAnyFlow) continue;
    if (!hasDay) continue;

    readings.push({
      rowIndex: r,
      dayNo,
      dateLabel: col.day !== null ? String(row[col.day] ?? '') : null,
      fezzanTankLevel,
      ejh,
      nejhS,
      nejhN,
    });

    if (dayNo === 31) {
      reachedMonthEnd = true;
    }
  }

  if (readings.length === 0) {
    issues.push('لم يتم استخراج قراءات يومية من الورقة. راجع شكل الأعمدة.');
  }

  return { filename, sheetName, readings, issues, headerMap };
}
