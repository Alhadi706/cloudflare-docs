/**
 * buildResultFromEngines.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the canonical AnalysisResult object consumed by all business-facing
 * tabs (Overview, Stations, Consumption, Quality, Anomalies, Report) using ONLY
 * the structured outputs of the five extraction engines.
 *
 * Engine mapping:
 *   Engine1 (Well Fields & Pump Stations) → stations[] + totalProduction
 *   Engine5 (Consumption Openings)         → consumption[] + totalConsumption
 *   Quality records (extracted separately) → quality[]
 *   All engines combined                   → anomalies[], kpis, chartData, report
 */

import type { WellFieldsPumpReading } from './engines/wellFieldsPumpEngine';
import type { ConsumptionReading, ConsumptionArea } from './engines/consumptionEngine';
import type { WaterQualityEngineOutput, WaterQualityDailyReading } from './engines/waterQualityEngine';

// ─── Types (mirror page.tsx interfaces) ──────────────────────────────────────

export interface StationRecord {
  name: string;
  flow: number;
  pressure: number;
  pumpsRunning: number;
  pumpsTotal: number;
  designP?: number;
  status: 'normal' | 'warning' | 'critical';
  flowCalculated?: boolean;
  valveOpeningPct?: number;
}

export interface QualityRecord {
  location: string;
  tds: number;
  conductivity?: number;
  ph?: number;
  nitrates?: number;
  status: 'pass' | 'warning' | 'fail';
}

export interface ConsumptionRecord {
  name: string;
  actual: number;
  design: number;
  coverage: number;
}

export interface Anomaly {
  severity: 'critical' | 'warning' | 'info';
  type: string;
  location: string;
  description: string;
  value?: number;
  expected?: number;
}

export interface KPIs {
  totalProduction: number;
  totalConsumption: number;
  waterBalance: number;
  nrw: number;
  avgPumpEfficiency: number;
  demandCoverage: number;
  anomalyCount: { critical: number; warning: number; info: number };
}

export interface EngineAnalysisResult {
  filename: string;
  sheets: { name: string; type: string; rows: number }[];
  stations: StationRecord[];
  quality: QualityRecord[];
  qualityDailyReadings: WaterQualityDailyReading[];
  consumption: ConsumptionRecord[];
  anomalies: Anomaly[];
  schematicImage?: string;
  kpis: KPIs;
  consumptionDataSuspect?: boolean;
  consumptionCorrectionNote?: string;
  chartData: { name: string; إنتاج: number; استهلاك: number; فاقد: number }[];
  report: string[];
  debugLog: string[];
}

// ─── Reference data ───────────────────────────────────────────────────────────

const DESIGN_CONSUMPTION = [
  { name: 'الشروق',       design: 20000  },
  { name: 'مصراتة',       design: 120000 },
  { name: 'زليتن',        design: 30000  },
  { name: 'الخمس',        design: 20000  },
  { name: 'القرو بولي',   design: 20000  },
  { name: 'طرابلس',       design: 430000 },
  { name: 'بني وليد',     design: 40000  },
  { name: 'ترهونة',       design: 20000  },
  { name: 'غريان',        design: 115200 },
  { name: 'سوق الخميس',  design: 20000  },
  { name: 'الرابطة',      design: 5000   },
  { name: 'الشويرف',      design: 116560 },
] as const;

const TOTAL_DESIGN = DESIGN_CONSUMPTION.reduce((s, c) => s + c.design, 0); // 840,200 م³/يوم

const STATION_CFG = [
  { key: 'ejh'   as const, nameAr: 'EJH',     designP: 6.9, warnLow: 6.5, warnHigh: 7.5,  maxPumps: 4 },
  { key: 'nejhS' as const, nameAr: 'NEJH(s)', designP: 6.9, warnLow: 6.5, warnHigh: 7.5,  maxPumps: 2 },
  { key: 'nejhN' as const, nameAr: 'NEJH(n)', designP: 9.1, warnLow: 8.5, warnHigh: 10.0, maxPumps: 4 },
] as const;

const TDS_LIMIT = 1097; // mg/L

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeAr(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDesign(name: string): number {
  const n = normalizeAr(name);
  for (const d of DESIGN_CONSUMPTION) {
    const dn = normalizeAr(d.name);
    if (dn && (n.includes(dn) || dn.includes(n))) return d.design;
  }
  return 0;
}

function safeAvg(vals: (number | null | undefined)[]): number {
  const nums = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function guessMonthLabel(filename: string): string {
  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const m1 = filename.match(/(\d{4})[._\-](\d{1,2})/);
  if (m1) return `${MONTHS[Number(m1[2]) - 1] ?? m1[2]} ${m1[1]}`;
  const m2 = filename.match(/شهر\s*(\d{1,2}).*?(\d{4})/);
  if (m2) return `${MONTHS[Number(m2[1]) - 1] ?? m2[1]} ${m2[2]}`;
  return filename.replace(/\.xlsx?$/i, '').slice(0, 25);
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildResultFromEngines(
  filename:        string,
  engine1Readings: WellFieldsPumpReading[],
  engine5Areas:    ConsumptionArea[],
  engine5Readings: ConsumptionReading[],
  qualityEngineOut?: WaterQualityEngineOutput,
): EngineAnalysisResult {

  // Map engine output → backwards-compatible QualityRecord[]
  const qualityRecords: QualityRecord[] = (qualityEngineOut?.locationStats ?? []).map(stat => ({
    location:     stat.location,
    tds:          stat.avgTds         ?? 0,
    conductivity: stat.avgConductivity ?? undefined,
    ph:           stat.avgPh           ?? undefined,
    nitrates:     stat.avgNitrates     ?? undefined,
    status:       stat.status,
  }));
  const qualityDailyReadings: WaterQualityDailyReading[] = qualityEngineOut?.dailyReadings ?? [];

  const log: string[] = [];
  log.push(`[buildResultFromEngines] e1=${engine1Readings.length} readings | e5=${engine5Readings.length} readings | areas=${engine5Areas.length} | quality=${qualityRecords.length}`);

  // ── Stations from Engine1 ───────────────────────────────────────────────
  const stations: StationRecord[] = [];

  if (engine1Readings.length > 0) {
    for (const cfg of STATION_CFG) {
      const g = cfg.key;

      // Collect per-day values (skip nulls and zeros)
      const flows     = engine1Readings.map(r => r[g].dailyFlowPump).filter((v): v is number => v !== null && v > 0);
      const pressures = engine1Readings.map(r => r[g].outletPressure).filter((v): v is number => v !== null && v > 0);
      const pumps     = engine1Readings.map(r => r[g].operatingPumps).filter((v): v is number => v !== null && v >= 0);

      const avgFlow  = Math.round(safeAvg(flows));
      const avgP     = Math.round(safeAvg(pressures) * 100) / 100;
      const avgPumps = Math.round(safeAvg(pumps));

      const status: StationRecord['status'] =
        avgP > 0 && avgP < cfg.warnLow * 0.9 ? 'critical' :
        avgP > 0 && (avgP < cfg.warnLow || avgP > cfg.warnHigh) ? 'warning' :
        'normal';

      stations.push({
        name: cfg.nameAr,
        flow: avgFlow,
        pressure: avgP,
        pumpsRunning: avgPumps,
        pumpsTotal: cfg.maxPumps,
        designP: cfg.designP,
        status,
        flowCalculated: false,
      });

      log.push(`  [station] ${cfg.nameAr}: avgFlow=${avgFlow.toLocaleString()} avgP=${avgP} avgPumps=${avgPumps}/${cfg.maxPumps} days=${flows.length} status=${status}`);
    }
  }

  // ── Total production from Engine1 well-field flows ──────────────────────
  // Well-field daily flows represent ground-water extracted.
  // Fall back to pump outlet flows if well-field column is empty.
  const dailyProd: number[] = engine1Readings
    .map(r => {
      const well = (r.ejh.wellFieldDailyFlow ?? 0)
                 + (r.nejhS.wellFieldDailyFlow ?? 0)
                 + (r.nejhN.wellFieldDailyFlow ?? 0);
      const pump = (r.ejh.dailyFlowPump ?? 0)
                 + (r.nejhS.dailyFlowPump ?? 0)
                 + (r.nejhN.dailyFlowPump ?? 0);
      return well > 0 ? well : pump;
    })
    .filter(v => v > 0);

  const avgProd = dailyProd.length > 0
    ? Math.round(dailyProd.reduce((a, b) => a + b, 0) / dailyProd.length)
    : 0;

  log.push(`  [production] avgDaily=${avgProd.toLocaleString()} (${dailyProd.length} days; min=${Math.min(...dailyProd.concat(0)).toLocaleString()} max=${Math.max(...dailyProd.concat(0)).toLocaleString()})`);

  // ── Consumption from Engine5 areas ──────────────────────────────────────
  const consumption: ConsumptionRecord[] = [];

  for (const area of engine5Areas) {
    const vals = engine5Readings
      .map(r => r.areaValues[area.key])
      .filter((v): v is number => v !== null && v > 0);

    if (vals.length === 0) continue;

    const actual   = Math.round(safeAvg(vals));
    const design   = findDesign(area.name);
    const coverage = design > 0 ? (actual / design) * 100 : 0;

    consumption.push({ name: area.name, actual, design, coverage });
    log.push(`  [consumption] "${area.name}": avg=${actual.toLocaleString()} design=${design.toLocaleString()} n=${vals.length}`);
  }

  // Engine5 daily total column is the authoritative system consumption.
  // Area averages can sum to more than the total (different areas report on
  // different days), so we scale each area’s actual proportionally so that
  // sum(area actuals) == avgDailyTotal exactly — consistency check passes.
  const dailyCons: number[] = engine5Readings
    .map(r => r.total)
    .filter((v): v is number => v !== null && v > 0);
  const avgDailyTotal = dailyCons.length > 0
    ? Math.round(dailyCons.reduce((a, b) => a + b, 0) / dailyCons.length)
    : 0;

  const rawSumAreas = consumption.reduce((s, c) => s + c.actual, 0);
  if (rawSumAreas > 0 && avgDailyTotal > 0 && rawSumAreas !== avgDailyTotal) {
    const scale = avgDailyTotal / rawSumAreas;
    for (const c of consumption) {
      c.actual   = Math.round(c.actual * scale);
      c.coverage = c.design > 0 ? Math.round((c.actual / c.design) * 1000) / 10 : 0;
    }
    log.push(`  [consumption] scaled areas by ${scale.toFixed(4)} (rawSum=${rawSumAreas.toLocaleString()} → ${avgDailyTotal.toLocaleString()})`);
  }

  // Use sum of (now-scaled) area actuals as totalConsumption so the two are identical.
  const avgCons = consumption.length > 0
    ? consumption.reduce((s, c) => s + c.actual, 0)
    : avgDailyTotal;

  log.push(`  [consumption] avgDailyTotal=${avgDailyTotal.toLocaleString()} finalConsumption=${avgCons.toLocaleString()} areas=${consumption.length}`);
  // ── KPIs ────────────────────────────────────────────────────────────────
  const totalProduction   = avgProd;
  const totalConsumption  = avgCons;
  const waterBalance      = totalProduction - totalConsumption;
  const nrw               = totalProduction > 0 ? (waterBalance / totalProduction) * 100 : 0;
  const pumpsRunning      = stations.reduce((s, st) => s + st.pumpsRunning, 0);
  const pumpsTotal        = stations.reduce((s, st) => s + st.pumpsTotal, 0);
  const avgPumpEfficiency = pumpsTotal > 0 ? (pumpsRunning / pumpsTotal) * 100 : 0;
  const demandCoverage    = TOTAL_DESIGN > 0 ? (totalConsumption / TOTAL_DESIGN) * 100 : 0;

  log.push(`  [kpis] prod=${totalProduction.toLocaleString()} cons=${totalConsumption.toLocaleString()} balance=${waterBalance.toLocaleString()} nrw=${nrw.toFixed(1)}% pumps=${pumpsRunning}/${pumpsTotal}`);

  // ── Anomaly detection ───────────────────────────────────────────────────
  const anomalies: Anomaly[] = [];

  for (const st of stations) {
    if (st.designP && st.pressure > 0) {
      const dev = Math.abs(st.pressure - st.designP) / st.designP * 100;
      if (dev > 20) {
        anomalies.push({
          severity: dev > 35 ? 'critical' : 'warning',
          type: 'pressure', location: st.name,
          description: `انحراف ضغط: ${st.pressure.toFixed(2)} بار (تصميمي: ${st.designP} بار)`,
          value: st.pressure, expected: st.designP,
        });
      }
    }
    if (st.pumpsTotal > 0 && st.pumpsRunning > 0 && st.pumpsRunning < st.pumpsTotal * 0.5) {
      anomalies.push({
        severity: 'warning', type: 'pumps', location: st.name,
        description: `مضخات منخفضة: ${st.pumpsRunning}/${st.pumpsTotal} تعمل`,
        value: st.pumpsRunning, expected: st.pumpsTotal,
      });
    }
  }

  for (const q of qualityRecords) {
    if (q.tds > TDS_LIMIT) {
      anomalies.push({
        severity: q.tds > TDS_LIMIT * 1.15 ? 'critical' : 'warning',
        type: 'quality', location: q.location,
        description: `TDS يتجاوز الحد المسموح: ${q.tds} mg/L (الحد: ${TDS_LIMIT} mg/L)`,
        value: q.tds, expected: TDS_LIMIT,
      });
    }
    if (q.nitrates !== undefined && q.nitrates > 50) {
      anomalies.push({
        severity: 'fail' === q.status ? 'critical' : 'warning',
        type: 'quality', location: q.location,
        description: `نترات تتجاوز الحد: ${q.nitrates} mg/L (الحد: 50 mg/L)`,
        value: q.nitrates, expected: 50,
      });
    }
  }

  if (waterBalance < 0) {
    anomalies.push({
      severity: 'critical', type: 'balance', location: 'المنظومة الكلية',
      description: `عجز مائي: الاستهلاك أعلى من الإنتاج بـ ${Math.abs(waterBalance).toLocaleString('ar')} م³/يوم`,
      value: totalConsumption, expected: totalProduction,
    });
  } else if (nrw > 30) {
    anomalies.push({
      severity: 'critical', type: 'balance', location: 'المنظومة الكلية',
      description: `نسبة الفاقد عالية جداً: ${nrw.toFixed(1)}%`,
      value: nrw, expected: 20,
    });
  } else if (nrw > 20) {
    anomalies.push({
      severity: 'warning', type: 'balance', location: 'المنظومة الكلية',
      description: `نسبة الفاقد مرتفعة: ${nrw.toFixed(1)}% (المقبول: < 20%)`,
      value: nrw, expected: 20,
    });
  }

  for (const c of consumption) {
    if (c.design > 0 && c.actual > 0) {
      if (c.coverage > 120) {
        anomalies.push({
          severity: 'warning', type: 'consumption', location: c.name,
          description: `استهلاك يتجاوز التصميم بـ ${(c.coverage - 100).toFixed(0)}%`,
          value: c.actual, expected: c.design,
        });
      } else if (c.coverage < 50 && c.design > 5000) {
        anomalies.push({
          severity: 'info', type: 'consumption', location: c.name,
          description: `تغطية منخفضة: ${c.coverage.toFixed(0)}% من التصميمي`,
          value: c.actual, expected: c.design,
        });
      }
    }
  }

  const anomalyCount = {
    critical: anomalies.filter(a => a.severity === 'critical').length,
    warning:  anomalies.filter(a => a.severity === 'warning').length,
    info:     anomalies.filter(a => a.severity === 'info').length,
  };

  // ── Report text ─────────────────────────────────────────────────────────
  const report = [
    `تقرير تشغيلي هندسي — ${new Date().toLocaleDateString('ar-LY')}`,
    `الملف: ${filename}`,
    '',
    '📊 ملخص الإنتاج والاستهلاك:',
    `  • متوسط الإنتاج اليومي:     ${totalProduction.toLocaleString('ar')} م³/يوم`,
    `  • متوسط الاستهلاك اليومي:   ${totalConsumption.toLocaleString('ar')} م³/يوم`,
    `  • الفاقد (NRW):              ${waterBalance.toLocaleString('ar')} م³/يوم (${nrw.toFixed(1)}%)`,
    `  • كفاءة المضخات:             ${avgPumpEfficiency.toFixed(0)}%`,
    `  • تغطية الطلب:               ${demandCoverage.toFixed(0)}%`,
    '',
    '⚙️ حالة محطات الضخ (متوسط الشهر):',
    ...stations.map(s =>
      `  • ${s.name}: تدفق ${s.flow.toLocaleString()} م³ | ضغط ${s.pressure.toFixed(2)} بار | ${s.pumpsRunning}/${s.pumpsTotal} مضخة | ${s.status === 'normal' ? 'طبيعي ✓' : s.status === 'warning' ? 'تحذير ⚠' : 'حرج ✗'}`
    ),
    '',
    '💧 الاستهلاك حسب المنطقة (متوسط يومي):',
    ...consumption.map(c =>
      `  • ${c.name}: ${c.actual.toLocaleString()} م³/يوم${c.design > 0 ? ` (${c.coverage.toFixed(0)}% من التصميمي ${c.design.toLocaleString()})` : ''}`
    ),
    ...(qualityRecords.length > 0 ? [
      '',
      '🔬 جودة المياه:',
      ...qualityRecords.map(q => `  • ${q.location}: TDS=${q.tds} mg/L (${q.status === 'pass' ? 'مقبول ✓' : q.status === 'warning' ? 'تحذير ⚠' : 'يتجاوز الحد ✗'})`),
    ] : []),
    '',
    `🚨 التنبيهات والشذوذات (${anomalies.length}):`,
    ...anomalies.map(a =>
      `  [${a.severity === 'critical' ? 'حرج' : a.severity === 'warning' ? 'تحذير' : 'معلومة'}] ${a.location}: ${a.description}`
    ),
    '',
    '📋 التوصيات:',
    nrw > 20
      ? '  ⚠ مراجعة فورية لمصادر الفاقد وإجراء اختبارات ضغط على الخطوط الرئيسية.'
      : '  ✓ نسبة الفاقد ضمن الحدود المقبولة.',
    anomalies.filter(a => a.type === 'pressure').length > 0
      ? '  ⚠ فحص محطات الضخ التي تسجل انحرافاً في الضغط.'
      : '  ✓ ضغوط التشغيل ضمن النطاق التصميمي.',
    qualityRecords.some(q => q.status !== 'pass')
      ? '  ⚠ مراجعة جودة المياه في المواقع التي تتجاوز الحد المسموح.'
      : qualityRecords.length > 0
        ? '  ✓ جودة المياه ضمن المعايير المقررة.'
        : '  — لا توجد بيانات جودة في هذا التقرير.',
  ];

  // ── Sheets summary ──────────────────────────────────────────────────────
  const sheets = [
    ...(engine1Readings.length > 0 ? [{ name: 'Well Fields & Pump Stations', type: 'محطات الضخ',  rows: engine1Readings.length }] : []),
    ...(engine5Readings.length > 0 ? [{ name: 'Consumption',                  type: 'الاستهلاك',  rows: engine5Readings.length }] : []),
    ...(qualityRecords.length  > 0 ? [{ name: 'W.Q',                          type: 'جودة المياه', rows: qualityEngineOut?.dailyReadings.length ?? qualityRecords.length }] : []),
  ];

  return {
    filename,
    sheets,
    stations,
    quality: qualityRecords,
    qualityDailyReadings,
    consumption,
    anomalies,
    kpis: {
      totalProduction, totalConsumption, waterBalance,
      nrw, avgPumpEfficiency, demandCoverage, anomalyCount,
    },
    chartData: [{
      name: guessMonthLabel(filename),
      إنتاج: totalProduction,
      استهلاك: totalConsumption,
      فاقد: Math.max(0, waterBalance),
    }],
    report,
    debugLog: log,
  };
}
