'use client';

import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { extractWaterQualityEngine } from '@/lib/engines/waterQualityEngine';
import { extractWellFieldsPumpEngine } from '@/lib/engines/wellFieldsPumpEngine';
import { extractEasternBranchEngine } from '@/lib/engines/easternBranchEngine';
import { extractCentralBranchEngine } from '@/lib/engines/centralBranchEngine';
import { extractTazEngine } from '@/lib/engines/tazEngine';
import SCADAView from './SCADAView';
import PipelineSchematic from './PipelineSchematic';
import MotorStatusView from './MotorStatusView';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle,
  Activity, Droplets, TrendingDown, TrendingUp, Gauge, AlertCircle,
  ArrowRight, Target, Zap, RefreshCw, Building2, BookOpen, Database,
  Download, Waves,
} from 'lucide-react';
import Link from 'next/link';

// ─── Design Reference ────────────────────────────────────────────────────────
const DESIGN_STATIONS = [
  { key: 'nejh_n', name: 'NEJH(n)', nameAr: 'نجع جهمة شمالية', designP: 9.1, warnLow: 8.5, warnHigh: 10.0, maxPumps: 4 },
  { key: 'nejh_s', name: 'NEJH(s)', nameAr: 'نجع جهمة جنوبية', designP: 6.9, warnLow: 6.5, warnHigh: 7.5,  maxPumps: 2 },
  { key: 'ejh',    name: 'EJH',     nameAr: 'العجيلات',          designP: 6.9, warnLow: 6.5, warnHigh: 7.5,  maxPumps: 4 },
];
const TDS_MAX = 1097; // mg/L
const CONDUCTIVITY_MAX = 1620; // µS/cm
const DESIGN_CONSUMPTION = [
  { name: 'الشروق',        design: 20000  },
  { name: 'مصراتة',        design: 120000 },
  { name: 'زليتن',         design: 30000  },
  { name: 'الخمس',         design: 20000  },
  { name: 'القرو بولي',    design: 20000  },
  { name: 'طرابلس',        design: 430000 },
  { name: 'بني وليد',      design: 40000  },
  { name: 'ترهونة',        design: 20000  },
  { name: 'غريان',         design: 115200 },
  { name: 'سوق الخميس',   design: 20000  },
  { name: 'الرابطة',       design: 5000   },
];

function normalizeArabicText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDesignForArea(name: string): number {
  const n = normalizeArabicText(name);
  for (const d of DESIGN_CONSUMPTION) {
    const dn = normalizeArabicText(d.name);
    if (!dn) continue;
    if (n.includes(dn) || dn.includes(n)) return d.design;
  }
  return 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface SheetSummary { name: string; type: string; rows: number; }
interface StationRecord {
  name: string; flow: number; pressure: number;
  pumpsRunning: number; pumpsTotal: number; designP?: number;
  status: 'normal' | 'warning' | 'critical';
  flowCalculated?: boolean; valveOpeningPct?: number;
}
interface QualityRecord {
  location: string; tds: number; conductivity?: number; ph?: number; nitrates?: number;
  status: 'pass' | 'warning' | 'fail';
}
interface ConsumptionRecord { name: string; actual: number; design: number; coverage: number; }
interface ConsumptionDailyRow { dayNo: number; values: Record<string, number | null>; }
interface ConsumptionDailyMatrix { columns: string[]; rows: ConsumptionDailyRow[]; sourceSheet?: string; }
interface Anomaly {
  severity: 'critical' | 'warning' | 'info';
  type: string; location: string; description: string;
  value?: number; expected?: number;
}
interface KPIs {
  totalProduction: number; totalConsumption: number;
  waterBalance: number; nrw: number; avgPumpEfficiency: number;
  demandCoverage: number;
  anomalyCount: { critical: number; warning: number; info: number };
}
interface SavedReport {
  id: number; filename: string; report_date: string;
  total_production: number; total_consumption: number;
  nrw_percent: number; anomaly_critical: number; anomaly_warning: number;
  created_at: string;
}
interface SavedReportDetail extends SavedReport {
  stations_data: StationRecord[];
  quality_data: QualityRecord[];
  consumption_data: ConsumptionRecord[];
  anomalies_data: Anomaly[];
}
type RecordQualityLevel = 'clean' | 'warning' | 'critical';
interface AnalysisResult {
  filename: string; sheets: SheetSummary[];
  stations: StationRecord[]; quality: QualityRecord[];
  consumption: ConsumptionRecord[]; anomalies: Anomaly[];
  consumptionDaily?: ConsumptionDailyMatrix;
  kpis: KPIs; consumptionDataSuspect?: boolean; consumptionCorrectionNote?: string;
  chartData: { name: string; إنتاج: number; استهلاك: number; فاقد: number }[];
  report: string[];
  debugLog: string[]; // diagnostic messages for troubleshooting
}

// ─── Month helpers ────────────────────────────────────────────────────────────
const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function formatMonthAr(dateStr: string): string {
  try { const d = new Date(dateStr); return `${MONTH_NAMES_AR[d.getMonth()]} ${d.getFullYear()}`; }
  catch { return dateStr; }
}
function guessMonthFromFilename(filename: string): string {
  // Try to extract yyyy-mm or شهر N / year from filename
  const m1 = filename.match(/(\d{4})[._-](\d{1,2})/);
  if (m1) return `${m1[1]}-${String(m1[2]).padStart(2,'0')}-01`;
  const m2 = filename.match(/شهر\s*(\d{1,2}).*?(\d{4})/);
  if (m2) return `${m2[2]}-${String(m2[1]).padStart(2,'0')}-01`;
  const m3 = filename.match(/(\d{4}).*?شهر\s*(\d{1,2})/);
  if (m3) return `${m3[1]}-${String(m3[2]).padStart(2,'0')}-01`;
  return new Date().toISOString().slice(0,10);
}
function buildResultFromSaved(r: SavedReportDetail): AnalysisResult {
  const waterBalance = r.total_production - r.total_consumption;
  const totalDesign = DESIGN_CONSUMPTION.reduce((s, c) => s + c.design, 0);
  const stations: StationRecord[] = Array.isArray(r.stations_data) ? r.stations_data : [];
  const quality: QualityRecord[] = Array.isArray(r.quality_data) ? r.quality_data : [];
  const rawCons: ConsumptionRecord[] = Array.isArray(r.consumption_data) ? r.consumption_data : [];
  const consumption = rawCons.map(c => ({
    ...c,
    design: c.design || (DESIGN_CONSUMPTION.find(d => c.name.includes(d.name) || d.name.includes(c.name))?.design ?? 0),
    coverage: c.design > 0 ? (c.actual / c.design) * 100 : (c.coverage ?? 0),
  }));
  const anomalies: Anomaly[] = Array.isArray(r.anomalies_data) ? r.anomalies_data : [];
  const pumpsRunning = stations.reduce((s, st) => s + (st.pumpsRunning ?? 0), 0);
  const pumpsTotal = stations.reduce((s, st) => s + Math.max(st.pumpsTotal ?? 0, st.pumpsRunning ?? 0), 0);
  const avgPumpEfficiency = pumpsTotal > 0 ? (pumpsRunning / pumpsTotal) * 100 : 0;
  const demandCoverage = totalDesign > 0 ? (r.total_consumption / totalDesign) * 100 : 0;
  const sheets: SheetSummary[] = [];
  if (stations.length > 0) sheets.push({ name: 'محطات الضخ', type: 'محطات الضخ', rows: stations.length });
  if (quality.length > 0) sheets.push({ name: 'جودة المياه', type: 'جودة المياه', rows: quality.length });
  if (consumption.length > 0) sheets.push({ name: 'الاستهلاك', type: 'الاستهلاك', rows: consumption.length });
  const kpis: KPIs = {
    totalProduction: r.total_production, totalConsumption: r.total_consumption,
    waterBalance, nrw: r.nrw_percent, avgPumpEfficiency, demandCoverage,
    anomalyCount: { critical: r.anomaly_critical, warning: r.anomaly_warning, info: anomalies.filter(a => a.severity === 'info').length },
  };
  const nrwStr = r.nrw_percent.toFixed ? r.nrw_percent.toFixed(1) : String(r.nrw_percent);
  const report = [
    `تقرير تشغيلي هندسي — ${r.filename}`,
    `التاريخ: ${r.report_date}`,
    '',
    '📊 ملخص الإنتاج والاستهلاك:',
    `  • إجمالي الإنتاج:           ${r.total_production.toLocaleString('ar')} م³/يوم`,
    `  • إجمالي الاستهلاك:         ${r.total_consumption.toLocaleString('ar')} م³/يوم`,
    `  • الفاقد (NRW):              ${Math.round(waterBalance).toLocaleString('ar')} م³/يوم (${nrwStr}%)`,
    `  • كفاءة المضخات:             ${avgPumpEfficiency.toFixed(0)}%`,
    `  • تغطية الطلب:               ${demandCoverage.toFixed(0)}%`,
    ...(stations.length > 0 ? [
      '',
      '⚙️ حالة محطات الضخ:',
      ...stations.map(s =>
        `  • ${s.name}: تدفق ${s.flow.toLocaleString()} م³ | ضغط ${Number(s.pressure).toFixed(2)} بار | ${s.pumpsRunning}/${s.pumpsTotal} مضخة | ${s.status === 'normal' ? 'طبيعي ✓' : s.status === 'warning' ? 'تحذير ⚠' : 'حرج ✗'}`
      ),
    ] : []),
    ...(consumption.length > 0 ? [
      '',
      '💧 الاستهلاك حسب المنطقة (متوسط يومي):',
      ...consumption.map(c =>
        `  • ${c.name}: ${c.actual.toLocaleString()} م³/يوم${c.design > 0 ? ` (${c.coverage.toFixed(0)}% من التصميمي ${c.design.toLocaleString()})` : ''}`
      ),
    ] : []),
    ...(quality.length > 0 ? [
      '',
      '🔬 جودة المياه:',
      ...quality.map(q => `  • ${q.location}: TDS=${q.tds > 0 ? q.tds : '—'} mg/L${q.nitrates !== undefined ? ` | نترات=${q.nitrates.toFixed(1)} mg/L` : ''} (${q.status === 'pass' ? 'مقبول ✓' : q.status === 'warning' ? 'تحذير ⚠' : 'يتجاوز الحد ✗'})`),
    ] : []),
    '',
    `🚨 التنبيهات والشذوذات (${anomalies.length}):`,
    ...(anomalies.length > 0
      ? anomalies.map(a => `  [${a.severity === 'critical' ? 'حرج' : a.severity === 'warning' ? 'تحذير' : 'معلومة'}] ${a.location}: ${a.description}`)
      : ['  لا توجد انحرافات مسجّلة.']),
    '',
    '📋 التوصيات:',
    r.nrw_percent > 20
      ? '  ⚠ مراجعة فورية لمصادر الفاقد وإجراء اختبارات ضغط على الخطوط الرئيسية.'
      : '  ✓ نسبة الفاقد ضمن الحدود المقبولة.',
    anomalies.some(a => a.type === 'pressure')
      ? '  ⚠ فحص محطات الضخ التي تسجل انحرافاً في الضغط.'
      : '  ✓ ضغوط التشغيل ضمن النطاق التصميمي.',
    quality.some(q => q.status !== 'pass')
      ? '  ⚠ مراجعة جودة المياه في المواقع التي تتجاوز الحد المسموح.'
      : quality.length > 0
        ? '  ✓ جودة المياه ضمن المعايير المقررة.'
        : '  — لا توجد بيانات جودة في هذا التقرير.',
  ];
  return {
    filename: `${r.filename} ← من السجل (${r.report_date})`,
    sheets, stations, quality, consumption, anomalies, kpis,
    chartData: [{ name: formatMonthAr(r.report_date), إنتاج: Math.round(r.total_production), استهلاك: Math.round(r.total_consumption), فاقد: Math.round(waterBalance) }],
    report,
    debugLog: [`[SAVED REPORT] Loaded from database id=${r.id ?? '?'}, date=${r.report_date}`],
  };
}

function assessSavedReportQuality(r: SavedReport): { level: RecordQualityLevel; issues: string[] } {
  const issues: string[] = [];
  const prod = Number(r.total_production);
  const cons = Number(r.total_consumption);
  const nrw = Number(r.nrw_percent);

  if (!Number.isFinite(prod) || prod <= 0) issues.push('إنتاج غير صالح');
  if (!Number.isFinite(cons) || cons < 0) issues.push('استهلاك غير صالح');
  if (Number.isFinite(prod) && Number.isFinite(cons) && cons > prod) issues.push('الاستهلاك أكبر من الإنتاج');

  if (Number.isFinite(prod) && prod > 0 && Number.isFinite(cons) && Number.isFinite(nrw)) {
    const expectedNrw = ((prod - cons) / prod) * 100;
    if (Math.abs(expectedNrw - nrw) > 1.5) issues.push('عدم اتساق نسبة الفاقد');
  }

  if (Number.isFinite(nrw) && (nrw < -5 || nrw > 60)) issues.push('نسبة فاقد خارج النطاق المنطقي');

  if (issues.some((x) => x.includes('أكبر من الإنتاج') || x.includes('غير صالح'))) {
    return { level: 'critical', issues };
  }
  if (issues.length > 0) {
    return { level: 'warning', issues };
  }
  return { level: 'clean', issues };
}

// ─── XLSX Parsing Utilities ───────────────────────────────────────────────────
// Exact sheet name overrides — keyed on real file sheet names (case-insensitive trim)
const EXACT_SHEET_TYPE: Record<string, string> = {
  'اليومي':                               'الاستهلاك',
  'consumption':                          'الاستهلاك',
  'well fields & pump stations':          'محطات الضخ',
  'central branch-cross connection':      'محطات الضخ',
  'eastrern branch':                      'محطات الضخ',
  'eastern branch':                       'محطات الضخ',
  'taz':                                  'محطات الضخ',
  'حساب انتاج المضخات والابار':            'محطات الضخ',
  'حساب إنتاج المضخات والآبار':            'محطات الضخ',
  'w.q':                                  'جودة المياه',
  'wq':                                   'جودة المياه',
  'معدل الانتاج والاستهلاك الشهري':        'الاستهلاك',
  'معدل الإنتاج والاستهلاك الشهري':        'الاستهلاك',
  'وضعية الاستهلاك الشهري':               'الاستهلاك',
  'مقارنة الداخل والخارج الدوبريف':        'المقارنة',
  'remarks':                              'ملاحظات',
  'c.v-eastrern':                         'بيانات عامة',
  'c.v-eastern':                          'بيانات عامة',
  'data':                                 'بيانات عامة',
};

function detectSheetType(sheetName: string, headers: string[], rows: unknown[][]): string {
  // Check exact sheet name first — most reliable (real file names)
  const snKey = sheetName.toLowerCase().trim();
  if (EXACT_SHEET_TYPE[snKey]) return EXACT_SHEET_TYPE[snKey];
  const sn = snKey;
  // W.Q / WQ / water-quality tab names
  if (/جودة.*مياه|مياه.*جودة|water.*qual|qual.*water|quality|w\.q|wq\b|w_q/.test(sn)) return 'جودة المياه';
  if (/محطات.*ضخ|ضخ.*محطات|pump.*stat|station.*pump|محطات|مضخات.*آبار|آبار.*مضخات/.test(sn)) return 'محطات الضخ';
  if (/استهلاك|consumption/.test(sn)) return 'الاستهلاك';
  if (/آبار|بئر|well/.test(sn)) return 'الآبار';
  if (/مقارنة|compare/.test(sn)) return 'المقارنة';
  if (/تشغيل|operation/.test(sn)) return 'التشغيل اليومي';
  // Fallback: check headers and content
  const hStr = headers.join(' ').toLowerCase();
  const content = rows.slice(0, 20).flat().join(' ');
  if (/تدفق|ضخ|محطة|مضخة|pump|flow/.test(hStr) || /نجع جهمة|عجيلات/.test(content)) return 'محطات الضخ';
  if (/استهلاك|مدينة|منطقة|consumption/.test(hStr) || /طرابلس|مصراتة|زليتن/.test(content)) return 'الاستهلاك';
  if (/جودة|tds|موصلية|ملوحة|quality|dissolved|نترات|water quality/.test(hStr)) return 'جودة المياه';
  if (/water quality|جودة المياه|water qual/.test(content.toLowerCase())) return 'جودة المياه';
  if (/بئر|well|آبار/.test(hStr)) return 'الآبار';
  if (/مقارنة|compare|تصميم|design/.test(hStr)) return 'المقارنة';
  if (/ملاحظ|remark|note/.test(hStr)) return 'الملاحظات';
  if (/إنتاج|production|تشغيل|operation/.test(hStr)) return 'التشغيل اليومي';
  return 'بيانات عامة';
}

function isDailySheet(sheetName: string, sheetType: string): boolean {
  const sn = sheetName.toLowerCase().trim();
  // Exclude monthly/summary tabs from KPI sources.
  if (/شهري|monthly|month|معدل|وضعية|summary|ملخص|اجمالي|إجمالي/.test(sn)) return false;
  if (sheetType === 'بيانات عامة' || sheetType === 'ملاحظات' || sheetType === 'الملاحظات') return false;
  // Explicit daily/operations tabs allowed.
  if (/^اليومي(\b|\s|\()|daily/.test(sn)) return true;
  if (/well fields|pump stations|branch|taz|w\.q|\bwq\b|consumption|حساب إنتاج|حساب انتاج|مقارنة الداخل والخارج/.test(sn)) return true;
  // Operational data categories are daily by design in this workflow.
  if (sheetType === 'محطات الضخ' || sheetType === 'التشغيل اليومي' || sheetType === 'جودة المياه' || sheetType === 'الاستهلاك' || sheetType === 'المقارنة' || sheetType === 'الآبار') return true;
  return false;
}

function isMonthlyText(text: string): boolean {
  return /شهري|monthly|month/i.test(text);
}

function normalizeDailyConsumptionValue(value: number, design: number, monthlyHint = false): number | null {
  if (!(value > 0)) return null;
  let daily = value;

  if (monthlyHint) daily = value / 30;

  if (design > 0) {
    if (daily > design * 2.8) {
      const by30 = daily / 30;
      if (by30 >= design * 0.05 && by30 <= design * 2.8) daily = by30;
    }
    if (daily > design * 8) return null;
  } else if (daily > 2_000_000) {
    daily = daily / 30;
  }

  return daily > 0 ? Math.round(daily) : null;
}

function consumptionPlausibilityScore(c: ConsumptionRecord): number {
  const d = c.design;
  const a = c.actual;
  if (!(a > 0)) return 1e9;
  if (d <= 0) return a > 1_000_000 ? 1000 : 100;
  const ratio = a / d;
  if (ratio > 8 || ratio < 0.01) return 500;
  return Math.abs(ratio - 1);
}

function normalizeAggregateConsumptionDaily(value: number, totalDesign: number, production: number): number {
  if (!(value > 0)) return 0;
  let v = value;
  // Only trigger normalization for values that are clearly monthly totals (>> 3× system design or >> 2.5× production)
  const tooHighVsDesign = totalDesign > 0 && v > totalDesign * 3;
  const tooHighVsProd = production > 0 && v > production * 2.5;
  if (tooHighVsDesign || tooHighVsProd) {
    const by30 = Math.round(v / 30);
    const by31 = Math.round(v / 31);
    const candidates = [v, by30, by31].filter(x => x > 0);
    const score = (x: number) => {
      const s1 = totalDesign > 0 ? Math.abs((x / totalDesign) - 1) : 0;
      const s2 = production > 0 ? Math.abs((x / production) - 1) : 0;
      return s1 + s2;
    };
    v = candidates.sort((a, b) => score(a) - score(b))[0];
  }
  return Math.round(v);
}

function extractNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(/[,،\s]/g, ''));
  return isNaN(n) ? null : n;
}

function isStationLikeName(name: string): boolean {
  const n = String(name || '').trim();
  if (!n) return false;
  if (/^(day|date|total|bar)$/i.test(n)) return false;
  if (/^\d{1,5}$/.test(n)) return false;
  return /[\u0600-\u06FF]|[a-zA-Z]{2,}/.test(n);
}

function sanitizeNonNegative(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return value > 0 ? value : 0;
}
function findHeaderRow(rows: unknown[][]): { headerIdx: number; headers: string[] } {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const nonEmpty = row.filter(c => c !== null && c !== undefined && c !== '');
    if (nonEmpty.length >= 3) return { headerIdx: i, headers: row.map(c => String(c ?? '').trim()) };
  }
  return { headerIdx: 0, headers: [] };
}
function matchField(h: string): string {
  h = h.toLowerCase().trim();
  if (/تدفق|flow|كمية يومية|الكمية|م3\/يوم|m3\/d|إنتاج يومي|انتاج يومي|الإنتاج اليومي|الانتاج اليومي|ضخ يومي|كمية ضخ|م3$|m3$/.test(h)) return 'flow';
  if (/ضغط|pressure|bar|بار/.test(h)) return 'pressure';
  if (/عدد.*عامل|عامل.*عدد|مضخ.*عامل|عامل.*مضخ|عدد المضخات|pump.*run|running|no.*pump|عمل/.test(h)) return 'pumps';
  if (/اسم|محطة|موقع|name|location|المنطقة|المدينة|المحطة|الموقع|البئر|الحقل/.test(h)) return 'name';
  // TDS: extended variants including Arabic salt/salinity terms
  if (/نترات|nitrat/.test(h)) return 'nitrates';
  if (/tds|الأملاح|أملاح|ملوحة|مواد ذائبة|إجمالي المواد|dissolved|salinity|total dissolved/.test(h)) return 'tds';
  if (/موصلية|conductivity|ec\b/.test(h)) return 'conductivity';
  if (/درجة حموضة|\bph\b/.test(h)) return 'ph';
  if (/استهلاك الفعل|الفعل|actual|consumption/.test(h)) return 'actual';
  if (/تصميم|design|الكمية التصميم|مخصص/.test(h)) return 'design';
  if (/تاريخ|date/.test(h)) return 'date';
  if (/نسبة.*فتح|فتح.*صمام|opening.*valve|valve.*open/.test(h)) return 'valveOpening';
  if (/قطر.*أنبوب|أنبوب.*قطر|pipe.*diam|diameter\b|قطر\b/.test(h)) return 'pipeDiameter';
  if (/ضغط.*دخل|upstream.*press|مدخل|دخول/.test(h)) return 'pressureUpstream';
  if (/ضغط.*خرج|downstream.*press|مخرج|خروج/.test(h)) return 'pressureDownstream';
  return h;
}

// ─── Grid Scanners (for complex/visual sheet layouts like "اليومي") ──────────
const CITY_KEYWORDS = [
  'طرابلس','مصراتة','زليتن','الخمس','غريان','بني وليد','ترهونة','الشروق',
  'سرت','القرابولي','قرابولي','سوق الخميس','الرابطة','الشويرف','شويرف',
  'طيبة','مدق','التبة','القبليات','العلوس','الفروج','مسلاتة',
];

function scanGridForConsumption(rows: unknown[][]): ConsumptionRecord[] {
  const seen = new Set<string>();
  const results: ConsumptionRecord[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '').trim();
      if (!cell || cell.length > 45 || cell.length < 2) continue;
      const matched = CITY_KEYWORDS.some(kw => cell.includes(kw) || kw.includes(cell));
      if (!matched || seen.has(cell)) continue;
      let qty: number | null = null;
      // Scan positive direction first (right in memory = left visually in Arabic RTL)
      // then negative — prioritises the consumption column over row-index columns
      const scanOrder = [1,2,3,4,5,6,-1,-2,-3,-4,-5,-6];
      for (const dc of scanOrder) {
        const idx = c + dc;
        if (idx < 0 || idx >= row.length) continue;
        const n = extractNumber(row[idx]);
        if (n !== null && n > 0 && n <= 2_000_000) { qty = n; break; }
      }
      if (qty !== null) {
        seen.add(cell);
        const design = findDesignForArea(cell);
        const normalized = normalizeDailyConsumptionValue(qty, design, false);
        if (normalized === null) continue;
        results.push({ name: cell, actual: normalized, design,
          coverage: design > 0 ? (normalized / design) * 100 : 0 });
      }
    }
  }
  return results;
}

function scanGridForTotals(rows: unknown[][]): { production: number; consumption: number } {
  let production = 0, consumption = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '').trim();
      if (!cell) continue;
      const isProd = /الإنتاج|الانتاج/.test(cell) && !/الآبار|نسبة/.test(cell);
      const isCons = /الاستهلاك/.test(cell) && !/التصميمي|نسبة/.test(cell);
      if (!isProd && !isCons) continue;
      const candidates: number[] = [];
      // Scan both directions — Arabic RTL files may have value to the LEFT of the label
      // Range: 200 (captures thousands-unit values like "1182") to 40M (monthly totals)
      for (let dc = -8; dc <= 8; dc++) {
        if (dc === 0) continue;
        const idx = c + dc;
        if (idx < 0 || idx >= row.length) continue;
        const n = extractNumber(row[idx]);
        if (n && n > 50_000 && n < 40_000_000) candidates.push(n);
      }
      // Also scan 1 row below (value may appear directly below a label/title cell)
      if (r + 1 < rows.length && rows[r + 1]) {
        const n = extractNumber((rows[r + 1] as unknown[])[c]);
        if (n && n > 50_000 && n < 40_000_000) candidates.push(n);
      }
      const best = candidates.length > 0 ? Math.max(...candidates) : 0;
      if (isProd && best > production) production = best;
      if (isCons && best > consumption) consumption = best;
    }
  }
  return { production, consumption };
}

function extractDayNo(cell: unknown): number | null {
  const n = extractNumber(cell);
  if (n === null) return null;
  const day = Math.round(n);
  return day >= 1 && day <= 31 ? day : null;
}

function pickHeaderLabel(rows: unknown[][], baseRow: number, col: number): string {
  for (let r = baseRow; r >= Math.max(0, baseRow - 4); r--) {
    for (let c = col; c >= Math.max(0, col - 3); c--) {
      const v = String(rows[r]?.[c] ?? '').trim();
      if (!v) continue;
      const n = normalizeArabicText(v);
      if (!n) continue;
      if (/^(day|date|bar|total|sum|id|#)$/i.test(n)) continue;
      if (/اليوم|التاريخ|اجمالي|مجموع|المجموع|نسبة|تصميم|تصميمي|موازنه|balance|ratio/.test(n)) continue;
      return v;
    }
  }
  return '';
}

function scanGridForDailyConsumption(rows: unknown[][]): ConsumptionDailyMatrix | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const maxCols = rows.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);
  if (maxCols === 0) return null;

  // Find the column that behaves like "day of month" (1..31).
  let dayCol = -1;
  let bestCount = 0;
  for (let c = 0; c < maxCols; c++) {
    let cnt = 0;
    let prevDay = 0;
    let sequenceScore = 0;
    for (let r = 0; r < rows.length; r++) {
      const day = extractDayNo(rows[r]?.[c]);
      if (day !== null) {
        cnt++;
        if (prevDay === 0 || day === prevDay + 1 || day === 1) sequenceScore += 1;
        prevDay = day;
      }
    }
    const score = cnt + sequenceScore * 2;
    if (score > bestCount) {
      bestCount = score;
      dayCol = c;
    }
  }
  if (dayCol < 0 || bestCount < 14) return null;

  const dayRows = rows
    .map((row, rowIdx) => ({ rowIdx, dayNo: extractDayNo(row?.[dayCol]) }))
    .filter((x): x is { rowIdx: number; dayNo: number } => x.dayNo !== null);
  if (dayRows.length < 7) return null;

  const firstDayRow = dayRows[0].rowIdx;
  const headerRow = Math.max(0, firstDayRow - 1);

  const usedNames = new Set<string>();
  const columns: Array<{ idx: number; name: string }> = [];

  for (let c = 0; c < maxCols; c++) {
    if (c === dayCol) continue;
    const rawName = pickHeaderLabel(rows, headerRow, c);
    if (!rawName) continue;
    const n = normalizeArabicText(rawName);
    if (!n) continue;
    if (/^(day|date|bar|total)$/i.test(n)) continue;
    if (/اليوم|التاريخ|اجمالي|مجموع|المجموع|ضغط|نسبه|تصميم|تصميمي|موازنه|balance|ratio/.test(n)) continue;
    if (/^\d+$/.test(n)) continue;

    let valueCount = 0;
    for (const dr of dayRows) {
      const v = extractNumber(rows[dr.rowIdx]?.[c]);
      if (v !== null && v >= 0 && v <= 5_000_000) valueCount++;
    }
    if (valueCount < 2) continue;

    const name = rawName.trim();
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    columns.push({ idx: c, name });
  }

  if (columns.length === 0) return null;

  const byDay = new Map<number, number>();
  for (const dr of dayRows) {
    if (!byDay.has(dr.dayNo)) byDay.set(dr.dayNo, dr.rowIdx);
  }

  const rowsOut: ConsumptionDailyRow[] = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayNo, rowIdx]) => {
      const values: Record<string, number | null> = {};
      for (const col of columns) {
        const v = extractNumber(rows[rowIdx]?.[col.idx]);
        values[col.name] = v !== null && v >= 0 ? Math.round(v) : null;
      }
      return { dayNo, values };
    });

  return rowsOut.length > 0 ? { columns: columns.map(c => c.name), rows: rowsOut } : null;
}

// Orifice/valve flow reconstruction for broken sensors
// Q (m³/day) = Cd × A_eff × √(2ΔP/ρ) × 86400
function calcMissingFlow(pUpBar: number, pDownBar: number, openingPct: number, diamMm: number, Cd = 0.61): number {
  const dP = Math.abs(pUpBar - pDownBar) * 1e5;
  if (dP <= 0 || openingPct <= 0 || diamMm <= 0) return 0;
  const r = (diamMm / 1000) / 2;
  const Aeff = Math.PI * r * r * (openingPct / 100);
  const v = Math.sqrt(2 * dP / 1000);
  return Math.round(Cd * Aeff * v * 86400);
}

function parseWorkbook(wb: XLSX.WorkBook, filename: string): AnalysisResult {
  const sheets: SheetSummary[] = [];
  const stations: StationRecord[] = [];
  const quality: QualityRecord[] = [];
  const consumption: ConsumptionRecord[] = [];
  const anomalies: Anomaly[] = [];
  const debugLog: string[] = [];
  // Container for daily quality readings from the engine (populated if standard parsing yields nothing)
  const qualityEngineDaily: { value: unknown[] } = { value: [] };
  const dailyConsumptionCandidates: ConsumptionDailyMatrix[] = [];
  let masterProduction = 0, masterConsumption = 0; // authoritative totals from "اليومي"

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    if (rows.length === 0) continue;
    const snKey = sheetName.toLowerCase().trim();
    const { headerIdx, headers } = findHeaderRow(rows);
    const dataRows = rows.slice(headerIdx + 1);
    const sheetType = detectSheetType(sheetName, headers, dataRows);
    const dailySource = isDailySheet(sheetName, sheetType);
    if (!dailySource) {
      debugLog.push(`[SKIP] "${sheetName}" → type=${sheetType} → filtered by isDailySheet`);
      continue;
    }
    sheets.push({ name: sheetName, type: sheetType, rows: dataRows.length });
    debugLog.push(`[PROCESS] "${sheetName}" → type=${sheetType} | rows=${dataRows.length} | headerIdx=${headerIdx}`);

    // Capture day x region matrix from any operational daily sheet.
    // Some files store daily city consumption inside "Well fields & Pump Stations"
    // instead of a dedicated "consumption" sheet.
    const dailyMatrixAny = scanGridForDailyConsumption(rows);
    if (dailyMatrixAny && dailyMatrixAny.columns.length > 0 && dailyMatrixAny.rows.length > 0) {
      dailyMatrixAny.sourceSheet = sheetName;
      dailyConsumptionCandidates.push(dailyMatrixAny);
      debugLog.push(`  [daily-consumption:any] sheet="${sheetName}" → days=${dailyMatrixAny.rows.length} cols=${dailyMatrixAny.columns.length}`);
    }

    // Extract official production/consumption totals from "اليومي" summary boxes
    if (snKey === 'اليومي' || /^اليومي[\s(]/.test(snKey)) {
      const { production, consumption: cons } = scanGridForTotals(rows);
      debugLog.push(`  [scanGridForTotals on "${sheetName}"] prod=${production.toLocaleString()} | cons=${cons.toLocaleString()}`);
      if (production > 0) masterProduction = production;
      if (cons > 0) masterConsumption = cons;
    }

    const fieldMap: Record<string, number> = {};
    headers.forEach((h, i) => { const f = matchField(h); if (f && !(f in fieldMap)) fieldMap[f] = i; });
    debugLog.push(`  fieldMap: ${JSON.stringify(fieldMap)}`);

    if (sheetType === 'محطات الضخ' || sheetType === 'التشغيل اليومي') {
      // Detect time-series layout (day-indexed rows 0-31 repeated per station/month)
      const tsRowCount = dataRows.filter(r => {
        const n = String(r?.[0] ?? '').trim().toLowerCase();
        return /^\d{1,2}$/.test(n) || n === 'day';
      }).length;
      const isTimeSeries = tsRowCount > 20;
      debugLog.push(`  [محطات] tsRowCount=${tsRowCount} isTimeSeries=${isTimeSeries}`);

      if (isTimeSeries) {
        // Aggregate: scan all rows, group consecutive day-rows into sections, compute avg daily flow

        // Detect best flow column: ALWAYS scan day-rows to find which column has the highest average.
        // This correctly handles BOTH layouts:
        //   • Section-based (stations stacked in rows): picks the single flow column.
        //   • Wide multi-column (all stations as columns): picks the "Total" column (highest avg).
        // Relying on fieldMap['flow'] alone is wrong for wide layouts where the first matching
        // header is an individual station column, not the system total.
        const pressCol = fieldMap['pressure'] ?? 2;
        const colSums: Map<number, number> = new Map();
        const colCounts: Map<number, number> = new Map();
        for (const row of rows) {
          if (!row) continue;
          const col0 = String(row[0] ?? '').trim();
          if (!/^\d{1,2}$/.test(col0)) continue; // only day rows
          for (let ci = 1; ci < row.length; ci++) {
            if (ci === pressCol) continue;
            const n = extractNumber(row[ci]);
            if (n && n > 0 && n < 5_000_000) {
              colSums.set(ci, (colSums.get(ci) ?? 0) + n);
              colCounts.set(ci, (colCounts.get(ci) ?? 0) + 1);
            }
          }
        }
        // Pick the column with the highest average value
        let flowCol = fieldMap['flow'] ?? 1; // fallback only when no day rows exist
        let bestAvg = 0;
        for (const [ci, s] of colSums) {
          const cnt = colCounts.get(ci) ?? 1;
          const avg = s / cnt;
          if (avg > bestAvg) { bestAvg = avg; flowCol = ci; }
        }
        debugLog.push(`  [timeseries] auto-detect: flowCol=${flowCol} bestAvg=${Math.round(bestAvg).toLocaleString()} pressCol=${pressCol} fieldMapFlow=${fieldMap['flow'] ?? 'none'} colsScanned=${colSums.size}`);
        let secLabel = '';
        let secFlows: number[] = [], secPressures: number[] = [];
        let secIdx = 0;
        const flushSec = () => {
          if (secFlows.length < 5) {
            debugLog.push(`    [flush SKIP] "${secLabel}" — only ${secFlows.length} day-rows`);
            secFlows = []; secPressures = []; return;
          }
          secIdx++;
          const avgFlow = Math.round(secFlows.reduce((a, b) => a + b, 0) / secFlows.length);
          const avgP = secPressures.length > 0 ? secPressures.reduce((a, b) => a + b, 0) / secPressures.length : 0;
          const stName = secLabel || `${sheetName} — قطاع ${secIdx}`;
          // If section label is a generic column-header (Date, اليوم, day…) rather than an
          // actual station name, fall back to the sheet name as the station identifier.
          const genericLabelRe = /^(day|date|date\s*\d*|اليوم|bar|total|مجموع|average|#)$/i;
          const effectiveName = (secLabel && !genericLabelRe.test(secLabel.trim()))
            ? stName
            : `${sheetName}`;
          if (!isStationLikeName(effectiveName)) {
            debugLog.push(`    [flush SKIP] "${stName}" — not station-like`);
            secFlows = []; secPressures = []; return;
          }
          // Skip duplicate section (same name + similar flow = same month repeated)
          if (stations.some(s => s.name === effectiveName && Math.abs(s.flow - avgFlow) < avgFlow * 0.05)) {
            debugLog.push(`    [flush SKIP] "${effectiveName}" — duplicate`);
            secFlows = []; secPressures = []; return;
          }
          debugLog.push(`    [flush OK] "${effectiveName}" (label="${secLabel}") → avgFlow=${avgFlow.toLocaleString()} | days=${secFlows.length} | flowCol=${flowCol}`);
          const ds = DESIGN_STATIONS.find(s => effectiveName.includes(s.name) || effectiveName.includes(s.nameAr));
          const stSt: 'normal' | 'warning' | 'critical' = (ds && avgP > 0)
            ? (avgP < ds.warnLow * 0.9 ? 'critical' : (avgP < ds.warnLow || avgP > ds.warnHigh) ? 'warning' : 'normal')
            : 'normal';
          stations.push({
            name: effectiveName,
            flow: sanitizeNonNegative(avgFlow),
            pressure: sanitizeNonNegative(avgP),
            pumpsRunning: 0,
            pumpsTotal: ds?.maxPumps ?? 0,
            designP: ds?.designP,
            status: stSt,
            flowCalculated: false,
          });
          secFlows = []; secPressures = [];
        };
        for (const row of rows) {
          if (!row || row.every(c => c === '')) continue;
          const col0 = String(row[0] ?? '').trim();
          if (/^\d{1,2}$/.test(col0)) {
            const f = extractNumber(row[flowCol]);
            const p = extractNumber(row[pressCol]);
            if (f !== null && f > 0 && f < 5_000_000) secFlows.push(f);
            if (p !== null && p > 0 && p < 200) secPressures.push(p);
          } else if (/^(day|bar)$/i.test(col0) || /^ضغط/.test(col0) || /^\d{5,}$/.test(col0)) {
            // Sub-headers, unit labels, Excel date serials → skip
          } else if (col0) {
            flushSec();
            secLabel = col0;
          }
        }
        flushSec();
      } else {
        // Standard mode: one row = one station
        for (const row of dataRows) {
          if (!row || row.every(c => c === '')) continue;
          const name = String(row[fieldMap['name'] ?? 0] ?? '').trim();
          if (!name) continue;
          // Skip day-index / label rows that sneak into standard sheets
          if (!/[\u0600-\u06FF]|[a-zA-Z]{2,}/.test(name) || /^(day|bar)$/i.test(name) || /^ضغط/.test(name)) continue;
          const flow = sanitizeNonNegative(extractNumber(row[fieldMap['flow']]));
          const pressure = sanitizeNonNegative(extractNumber(row[fieldMap['pressure']]));
          const pumps = sanitizeNonNegative(extractNumber(row[fieldMap['pumps']]));
          const ds = DESIGN_STATIONS.find(s =>
            name.toLowerCase().includes(s.name.toLowerCase()) || name.includes(s.nameAr)
          );
          let status: 'normal' | 'warning' | 'critical' = 'normal';
          if (ds) {
            if (pressure > 0 && (pressure < ds.warnLow || pressure > ds.warnHigh)) status = 'warning';
            if (pressure > 0 && pressure < ds.warnLow * 0.9) status = 'critical';
          }
          const valveOpeningPct = extractNumber(row[fieldMap['valveOpening']]);
          const pipeDiamMm = extractNumber(row[fieldMap['pipeDiameter']]);
          const pDown = extractNumber(row[fieldMap['pressureDownstream']]) ?? 0;
          let resolvedFlow = flow;
          let flowCalculated = false;
          if (resolvedFlow === 0 && pressure > 0 && valveOpeningPct !== null && pipeDiamMm !== null) {
            resolvedFlow = calcMissingFlow(pressure, pDown, valveOpeningPct, pipeDiamMm);
            flowCalculated = resolvedFlow > 0;
          }
          stations.push({
            name,
            flow: sanitizeNonNegative(resolvedFlow),
            pressure: sanitizeNonNegative(pressure),
            pumpsRunning: sanitizeNonNegative(pumps),
            pumpsTotal: ds?.maxPumps ?? 0,
            designP: ds?.designP,
            status,
            flowCalculated,
            valveOpeningPct: valveOpeningPct ?? undefined,
          });
        }
      }
    }

    if (sheetType === 'جودة المياه') {
      for (const row of dataRows) {
        if (!row || row.every(c => c === '')) continue;
        const name = String(row[fieldMap['name'] ?? 0] ?? '').trim();
        if (!name) continue;
        // Skip numeric sample/day indices from time-series quality sheets
        if (!/[\u0600-\u06FF]|[a-zA-Z]{2,}/.test(name) || /^(day|bar)$/i.test(name)) continue;
        const tds = extractNumber(row[fieldMap['tds']]) ?? 0;
        const conductivity = extractNumber(row[fieldMap['conductivity']]) ?? undefined;
        const ph = extractNumber(row[fieldMap['ph']]) ?? undefined;
        const nitrates = extractNumber(row[fieldMap['nitrates']]) ?? undefined;
        const status: 'pass' | 'warning' | 'fail' =
          tds > TDS_MAX * 1.1 ? 'fail' :
          tds > TDS_MAX ? 'warning' :
          (nitrates !== undefined && nitrates > 50) ? 'fail' :
          (nitrates !== undefined && nitrates > 45) ? 'warning' :
          'pass';
        quality.push({ location: name, tds, conductivity, ph, nitrates, status });
      }
    }

    if (sheetType === 'الاستهلاك' || sheetType === 'المقارنة') {
      const prevConsLen = consumption.length;
      for (const row of dataRows) {
        if (!row || row.every(c => c === '')) continue;
        const name = String(row[fieldMap['name'] ?? 0] ?? '').trim();
        if (!name) continue;
        // Skip summary/total rows and reconciliation/balance rows — they cause double-counting
        if (/إجمالي|مجموع|total|grand|موازنة/i.test(name)) continue;
        const designRaw = extractNumber(row[fieldMap['design']]);
        const design = designRaw ?? findDesignForArea(name);
        const actualCandidates: number[] = [];
        const idxActual = fieldMap['actual'];
        const idxFlow = fieldMap['flow'];
        if (idxActual !== undefined) actualCandidates.push(idxActual);
        if (idxFlow !== undefined && idxFlow !== idxActual) actualCandidates.push(idxFlow);

        let actual = 0;
        for (const idx of actualCandidates) {
          const raw = extractNumber(row[idx]);
          if (raw === null) continue;
          const headerText = String(headers[idx] ?? '');
          const monthlyHint = isMonthlyText(headerText) || isMonthlyText(name);
          const normalized = normalizeDailyConsumptionValue(raw, design, monthlyHint);
          if (normalized !== null) {
            actual = normalized;
            break;
          }
        }
        const coverage = design > 0 ? (actual / design) * 100 : 0;
        if (actual > 0 || design > 0) consumption.push({ name, actual, design, coverage });
      }
      // Fallback: visual/complex layouts (e.g. "اليومي") — scan entire 2D grid for city names
      if (consumption.length === prevConsLen) {
        const fallback = scanGridForConsumption(rows);
        for (const fc of fallback) {
          if (!consumption.find(x => x.name === fc.name)) consumption.push(fc);
        }
      }

    }
  }

  // Remove polluted station rows that can leak from spreadsheet labels/serials.
  // Fallback: if standard quality parsing found nothing, try the dedicated engine
  // (handles by-day W.Q layouts where headers are group/sub-headers not matched by fieldMap)
  if (quality.length === 0) {
    try {
      const qe = extractWaterQualityEngine(wb, filename);
      if (qe.locationStats.length > 0) {
        debugLog.push(`[QUALITY ENGINE] layout=${qe.layout} sheet="${qe.sheetName}" → ${qe.locationStats.length} locations, ${qe.dailyReadings.length} daily readings`);
        for (const stat of qe.locationStats) {
          const tds = stat.avgTds ?? 0;
          const nitrates = stat.avgNitrates ?? undefined;
          const ph = stat.avgPh ?? undefined;
          const conductivity = stat.avgConductivity ?? undefined;
          const status: 'pass' | 'warning' | 'fail' =
            (tds > TDS_MAX * 1.1 || (nitrates !== undefined && nitrates > 50)) ? 'fail' :
            (tds > TDS_MAX || (nitrates !== undefined && nitrates > 45)) ? 'warning' : 'pass';
          quality.push({ location: stat.location, tds, conductivity, ph, nitrates, status });
        }
        qualityEngineDaily.value = qe.dailyReadings;
      } else if (qe.issues.length > 0) {
        debugLog.push(`[QUALITY ENGINE] no locations found — issues: ${qe.issues.join('; ')}`);
      }
    } catch (e) { debugLog.push(`[QUALITY ENGINE ERROR] ${e}`); }
  }

  { const valid = stations.filter((s) => isStationLikeName(s.name) && s.flow >= 0 && s.pressure >= 0);
    stations.length = 0; stations.push(...valid); }

  // Deduplicate consumption — prefer the most plausible daily candidate for each city
  { const seen = new Map<string, ConsumptionRecord>();
    for (const c of consumption) {
      const ex = seen.get(c.name);
      if (!ex) { seen.set(c.name, c); continue; }
      if (consumptionPlausibilityScore(c) < consumptionPlausibilityScore(ex)) seen.set(c.name, c);
    }
    consumption.length = 0; consumption.push(...seen.values()); }

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const totalDesign = DESIGN_CONSUMPTION.reduce((s, c) => s + c.design, 0); // 840,200 م³/يوم

  // Auto-scale production: if sum appears to be in thousands (< 0.5% of total system design),
  // values are stored in 1000 م³/day units — multiply by 1000.
  const totalProductionRaw = stations.reduce((s, st) => s + st.flow, 0);
  const prodScale = totalProductionRaw > 0 && totalProductionRaw < totalDesign * 0.005 ? 1000 : 1;
  const totalProduction = Math.round(totalProductionRaw * prodScale);
  if (prodScale > 1) stations.forEach(s => { s.flow = Math.round(s.flow * prodScale); });
  debugLog.push(`[PROD-SCALE] stations=${stations.length} | totalProductionRaw=${totalProductionRaw.toLocaleString()} | prodScale=${prodScale} | totalProduction=${totalProduction.toLocaleString()}`);
  stations.slice(0, 20).forEach(s => debugLog.push(`  station: "${s.name}" flow=${s.flow.toLocaleString()} pressure=${s.pressure}`));
  if (stations.length > 20) debugLog.push(`  ... +${stations.length - 20} more stations`);

  // Auto-scale consumption: same logic
  const rawConsumptionRaw = consumption.reduce((s, c) => s + c.actual, 0);
  const consScale = rawConsumptionRaw > 0 && rawConsumptionRaw < totalDesign * 0.005 ? 1000 : 1;
  const rawConsumption = Math.round(rawConsumptionRaw * consScale);
  if (consScale > 1) {
    consumption.forEach(c => {
      c.actual  = Math.round(c.actual  * consScale);
      c.design  = c.design  > 0 ? Math.round(c.design  * consScale) : c.design;
      c.coverage = c.design > 0 ? (c.actual / c.design) * 100 : 0;
    });
  }

  // Prefer authoritative totals from "اليومي" summary over computed sums.
  // Normalize masterProduction: scale from thousands if tiny, convert monthly→daily if huge.
  let masterProdNorm = masterProduction;
  if (masterProdNorm > 0 && masterProdNorm < totalDesign * 0.005) {
    debugLog.push(`[PROD] masterProduction=${masterProduction} → scaling ×1000 (stored in thousands)`);
    masterProdNorm = Math.round(masterProdNorm * 1000); // values stored in 1000 م3/day units
  }
  if (masterProdNorm > totalDesign * 2) {
    debugLog.push(`[PROD] masterProduction=${masterProdNorm} → dividing by 30 (monthly→daily)`);
    masterProdNorm = Math.round(masterProdNorm / 30); // monthly total → daily average
  }
  debugLog.push(`[PROD] masterProduction(raw)=${masterProduction} | masterProdNorm=${masterProdNorm} | totalProductionRaw=${totalProductionRaw} | totalProduction=${totalProduction}`);
  // Only use masterProduction as override if it is:
  //   (a) plausibly a system-level total (>= 50% of totalDesign) AND
  //   (b) actually larger than what time-series computed.
  // This prevents a wrong small city-level value from overriding the time-series sum.
  const masterIsSystemLevel = masterProdNorm > totalDesign * 0.5;
  const masterIsHigher = masterProdNorm > totalProduction;
  const resolvedProduction = (masterProdNorm > 0 && masterIsSystemLevel && masterIsHigher)
    ? masterProdNorm
    : totalProduction;
  const productionSource = (masterProdNorm > 0 && masterIsSystemLevel && masterIsHigher)
    ? 'masterProduction'
    : (masterProdNorm > 0 && !masterIsSystemLevel
        ? `time-series (master ${masterProdNorm.toLocaleString()} rejected: too small for system total)`
        : (masterProdNorm > 0 && !masterIsHigher
            ? `time-series (master ${masterProdNorm.toLocaleString()} rejected: less than time-series ${totalProduction.toLocaleString()})`
            : 'time-series sum'));
  debugLog.push(`[PROD] resolvedProduction=${resolvedProduction} (source: ${productionSource})`);
  // If master consumption looks monthly/cumulative, normalize it to daily first.
  const masterConsDaily = masterConsumption > totalDesign * 2
    ? Math.round(masterConsumption / 30)
    : masterConsumption;
  const validMasterCons = masterConsDaily > 0 && masterConsDaily <= totalDesign * 2;
  const rawResolvedConsumption = validMasterCons ? masterConsDaily
    : (rawConsumption > 0 ? rawConsumption : 0);
  debugLog.push(`[CONS] masterConsumption=${masterConsumption} | masterConsDaily=${masterConsDaily} | rawConsumption=${rawConsumption} | rawResolvedConsumption=${rawResolvedConsumption}`);
  const resolvedConsumption = normalizeAggregateConsumptionDaily(rawResolvedConsumption, totalDesign, resolvedProduction);
  debugLog.push(`[CONS] resolvedConsumption=${resolvedConsumption.toLocaleString()}`);

  // Final plausibility guard: handle consumption > production scenarios
  let totalConsumption = resolvedConsumption;
  let consumptionCorrectionNote = '';
  if (resolvedProduction > 0 && totalConsumption > resolvedProduction * 1.3) {
    const byMonth = Math.round(totalConsumption / 30);
    const byMonthPlausible = byMonth > resolvedProduction * 0.05 && byMonth <= resolvedProduction * 1.1;
    if (byMonthPlausible) {
      // Consumption looks like a monthly total — divide by 30 and sync individual items
      totalConsumption = byMonth;
      consumptionCorrectionNote = 'تم تطبيع الاستهلاك من قيمة شهرية/تراكمية إلى تقدير يومي بقسمة 30.';
      const sumBefore = consumption.reduce((s, c) => s + c.actual, 0);
      if (sumBefore > 0) {
        const itemScale = totalConsumption / sumBefore;
        debugLog.push(`[CONS-ADJUST] monthly→daily items scale ×${itemScale.toFixed(4)}`);
        consumption.forEach(c => { c.actual = Math.max(1, Math.round(c.actual * itemScale)); c.coverage = c.design > 0 ? (c.actual / c.design) * 100 : 0; });
      }
    } else {
      // Can't determine source — cap at 90% of production and scale items proportionally
      totalConsumption = Math.round(resolvedProduction * 0.9);
      consumptionCorrectionNote = 'الاستهلاك الظاهري يتجاوز الإنتاج — تم تطبيق 90% من الإنتاج كتقدير احترازي (قد تكون مصادر إنتاج غير مُرصدة).';
      const sumBefore = consumption.reduce((s, c) => s + c.actual, 0);
      if (sumBefore > 0) {
        const itemScale = totalConsumption / sumBefore;
        debugLog.push(`[CONS-ADJUST] cap-90pct items scale ×${itemScale.toFixed(4)}`);
        consumption.forEach(c => { c.actual = Math.max(1, Math.round(c.actual * itemScale)); c.coverage = c.design > 0 ? (c.actual / c.design) * 100 : 0; });
      }
    }
  }

  // After scaling/correction — check data plausibility
  const consumptionDataSuspect = !!consumptionCorrectionNote || (totalConsumption > 0 && resolvedProduction > 0 && totalConsumption > resolvedProduction * 1.3);
  const waterBalance = resolvedProduction - totalConsumption;
  const nrw = resolvedProduction > 0 ? (waterBalance / resolvedProduction) * 100 : 0;
  const pumpsRunning = stations.reduce((s, st) => s + st.pumpsRunning, 0);
  const pumpsTotal = stations.reduce((s, st) => s + Math.max(st.pumpsTotal, st.pumpsRunning), 0);
  const avgPumpEfficiency = pumpsTotal > 0 ? (pumpsRunning / pumpsTotal) * 100 : 0;
  const demandCoverage = totalDesign > 0 ? (totalConsumption / totalDesign) * 100 : 0;

  // Anomaly Detection
  for (const st of stations) {
    if (st.designP && st.pressure > 0) {
      const dev = Math.abs(st.pressure - st.designP) / st.designP * 100;
      if (dev > 20) anomalies.push({ severity: dev > 35 ? 'critical' : 'warning', type: 'pressure', location: st.name, description: `انحراف ضغط: ${st.pressure.toFixed(2)} بار (تصميمي: ${st.designP} بار)`, value: st.pressure, expected: st.designP });
    }
    if (st.pumpsTotal > 0 && st.pumpsRunning < st.pumpsTotal * 0.5) anomalies.push({ severity: 'warning', type: 'pumps', location: st.name, description: `مضخات منخفضة: ${st.pumpsRunning}/${st.pumpsTotal} تعمل`, value: st.pumpsRunning, expected: st.pumpsTotal });
  }
  for (const q of quality) {
    if (q.tds > TDS_MAX) anomalies.push({ severity: q.tds > TDS_MAX * 1.15 ? 'critical' : 'warning', type: 'quality', location: q.location, description: `TDS يتجاوز الحد: ${q.tds} mg/L (الحد: ${TDS_MAX} mg/L)`, value: q.tds, expected: TDS_MAX });
  }
  if (consumptionDataSuspect) anomalies.push({ severity: 'warning', type: 'balance', location: 'المنظومة الكلية', description: consumptionCorrectionNote || 'مجموع الاستهلاك يتجاوز الإنتاج بأكثر من 30% — يُرجى مراجعة أعمدة الاستهلاك في ملف Excel', value: rawResolvedConsumption, expected: resolvedProduction });
  if (waterBalance < 0) anomalies.push({ severity: 'critical', type: 'balance', location: 'المنظومة الكلية', description: `عجز مائي: الاستهلاك أعلى من الإنتاج بمقدار ${Math.abs(waterBalance).toLocaleString('ar')} م³/يوم`, value: totalConsumption, expected: resolvedProduction });
  if (nrw > 30) anomalies.push({ severity: 'critical', type: 'balance', location: 'المنظومة الكلية', description: `نسبة الفاقد عالية جداً: ${nrw.toFixed(1)}%`, value: nrw, expected: 20 });
  else if (nrw > 20) anomalies.push({ severity: 'warning', type: 'balance', location: 'المنظومة الكلية', description: `نسبة الفاقد مرتفعة: ${nrw.toFixed(1)}% (المقبول: < 20%)`, value: nrw, expected: 20 });
  for (const c of consumption) {
    if (c.design > 0 && c.actual > 0) {
      if (c.coverage > 120) anomalies.push({ severity: 'warning', type: 'consumption', location: c.name, description: `استهلاك يتجاوز التصميم بـ ${(c.coverage - 100).toFixed(0)}%`, value: c.actual, expected: c.design });
      else if (c.coverage < 50 && c.design > 5000) anomalies.push({ severity: 'info', type: 'consumption', location: c.name, description: `تغطية منخفضة: ${c.coverage.toFixed(0)}% من التصميمي`, value: c.actual, expected: c.design });
    }
  }

  // Single-month chart — no fabricated historical data
  const chartData = [
    { name: 'الشهر الحالي', إنتاج: resolvedProduction, استهلاك: totalConsumption, فاقد: waterBalance },
  ];

  const report = [
    `تقرير تشغيلي هندسي — ${new Date().toLocaleDateString('ar-LY')}`,
    `الملف: ${filename}`,
    '',
    '📊 ملخص الإنتاج:',
    `  • إجمالي الإنتاج: ${resolvedProduction.toLocaleString('ar')} م³/يوم`,
    `  • إجمالي الاستهلاك: ${totalConsumption.toLocaleString('ar')} م³/يوم`,
    ...(consumptionCorrectionNote ? [`  • ملاحظة تصحيح: ${consumptionCorrectionNote}`] : []),
    `  • ${waterBalance >= 0 ? 'الفاقد (NRW)' : 'العجز الصافي'}: ${waterBalance.toLocaleString('ar')} م³/يوم (${nrw.toFixed(1)}%)`,
    `  • كفاءة المضخات: ${avgPumpEfficiency.toFixed(0)}%`,
    '',
    '⚙️ حالة المحطات:',
    ...stations.map(s => `  • ${s.name}: تدفق ${s.flow.toLocaleString()} م³ | ضغط ${s.pressure.toFixed(2)} بار | ${s.pumpsRunning} مضخة تعمل`),
    '',
    `🚨 التنبيهات (${anomalies.length}):`,
    ...anomalies.map(a => `  [${a.severity === 'critical' ? 'حرج' : a.severity === 'warning' ? 'تحذير' : 'معلومة'}] ${a.location}: ${a.description}`),
    '',
    '💧 جودة المياه:',
    quality.length > 0
      ? quality.map(q => `  • ${q.location}: TDS=${q.tds} mg/L (${q.status === 'pass' ? 'مقبول ✓' : q.status === 'warning' ? 'تحذير ⚠' : 'يتجاوز الحد ✗'})`).join('\n')
      : '  • لا توجد بيانات جودة',
    '',
    '📋 التوصيات:',
    nrw > 20 ? '  ⚠ مراجعة فورية لمصادر الفاقد وإجراء اختبارات ضغط على الخطوط الرئيسية.' : '  ✓ نسبة الفاقد ضمن الحدود المقبولة.',
    anomalies.filter(a => a.type === 'pressure').length > 0 ? '  ⚠ فحص محطات الضخ التي تسجل انحرافاً في الضغط.' : '  ✓ ضغوط التشغيل ضمن النطاق التصميمي.',
    quality.some(q => q.status !== 'pass') ? '  ⚠ مراجعة جودة المياه في المواقع التي تتجاوز الحد المسموح.' : '  ✓ جودة المياه ضمن المعايير المقررة.',
  ];

  const anomalyCount = {
    critical: anomalies.filter(a => a.severity === 'critical').length,
    warning: anomalies.filter(a => a.severity === 'warning').length,
    info: anomalies.filter(a => a.severity === 'info').length,
  };

  const bestDailyConsumption = dailyConsumptionCandidates
    .slice()
    .sort((a, b) => (b.rows.length * b.columns.length) - (a.rows.length * a.columns.length))[0];

  return Object.assign(
    {
      filename,
      sheets,
      stations,
      quality,
      consumption,
      anomalies,
      consumptionDataSuspect,
      consumptionCorrectionNote: consumptionCorrectionNote || undefined,
      kpis: { totalProduction: resolvedProduction, totalConsumption, waterBalance, nrw, avgPumpEfficiency, demandCoverage, anomalyCount },
      chartData,
      report,
      debugLog,
    },
    qualityEngineDaily.value.length > 0 ? { qualityDailyReadings: qualityEngineDaily.value } : {},
    bestDailyConsumption ? { consumptionDaily: bestDailyConsumption } : {}
  ) as AnalysisResult;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OperationsMonitoringPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [tab, setTab] = useState<'overview' | 'stations' | 'consumption' | 'quality' | 'anomalies' | 'report' | 'history' | 'scada' | 'pipeline'>('history');
  const [scadaEngines, setScadaEngines] = useState<{ e1: unknown; e2: unknown; e3: unknown; e4: unknown } | null>(null);
  const [scadaSourceReportDate, setScadaSourceReportDate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingReportId, setLoadingReportId] = useState<number | null>(null);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setIsLoading(true);
    setError(null);
    setSaveSuccess(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let wb: XLSX.WorkBook;
        if (file.name.endsWith('.csv')) {
          wb = XLSX.read(e.target?.result as string, { type: 'string' });
        } else {
          wb = XLSX.read(e.target?.result as ArrayBuffer, { type: 'array' });
        }
        setResult(parseWorkbook(wb, file.name));
        // Run SCADA engines in the background (non-blocking)
        try {
          const e1 = extractWellFieldsPumpEngine(wb, file.name);
          const e2 = extractEasternBranchEngine(wb, file.name);
          const e3 = extractCentralBranchEngine(wb, file.name);
          const e4 = extractTazEngine(wb, file.name);
          setScadaEngines({ e1, e2, e3, e4 });
          setScadaSourceReportDate(null);
        } catch { setScadaEngines(null); }
        setTab('overview');
      } catch (err) {
        setError('فشل تحليل الملف. تأكد من أن الملف بصيغة Excel أو CSV صحيحة.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    if (file.name.endsWith('.csv')) reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
    // Auto-guess report date from filename
    setReportDate(guessMonthFromFilename(file.name));
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/v1/ops-reports');
      if (res.ok) {
        const data = await res.json();
        const sorted = Array.isArray(data)
          ? [...data].sort((a, b) => {
              const da = String(a.report_date || '');
              const db = String(b.report_date || '');
              return da > db ? -1 : da < db ? 1 : 0;
            })
          : [];
        setHistory(sorted);
      }
    } catch { /* silent fail */ }
    finally { setHistoryLoading(false); }
  }, []);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  React.useEffect(() => {
    if (tab !== 'scada') return;

    let cancelled = false;
    const pullScadaLive = async () => {
      try {
        const q = scadaSourceReportDate ? `?reportDate=${encodeURIComponent(scadaSourceReportDate)}` : '';
        const res = await fetch(`/api/v1/engines/scada-live${q}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.ok) return;

        const next = {
          e1: data.e1 ?? null,
          e2: data.e2 ?? null,
          e3: data.e3 ?? null,
          e4: data.e4 ?? null,
        };

        if (next.e1 || next.e2 || next.e3 || next.e4) {
          setScadaEngines(next);
        }
      } catch {
        // Keep the last good snapshot if live fetch fails.
      }
    };

    void pullScadaLive();
    const timer = window.setInterval(() => { void pullScadaLive(); }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tab, scadaSourceReportDate]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const body = {
        filename: result.filename,
        report_date: reportDate,
        total_production: result.kpis.totalProduction,
        total_consumption: result.kpis.totalConsumption,
        nrw_percent: result.kpis.nrw,
        anomaly_critical: result.kpis.anomalyCount.critical,
        anomaly_warning: result.kpis.anomalyCount.warning,
        stations_data: result.stations,
        quality_data: result.quality,
        consumption_data: result.consumption,
        anomalies_data: result.anomalies,
      };
      const res = await fetch('/api/v1/ops-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        const errBody = await res.json().catch(() => null);
        const details = Array.isArray(errBody?.details) ? errBody.details.join(' | ') : '';
        if (res.status === 409) {
          setError(`التقرير مكرر ولن يتم حفظه.${details ? ` ${details}` : ''}`);
        } else if (res.status === 422) {
          setError(`فشل التحقق من البيانات قبل الحفظ.${details ? ` ${details}` : ''}`);
        } else {
          setError('فشل حفظ التقرير. تأكد من اتصال قاعدة البيانات.');
        }
      }
    } catch { setError('خطأ في الاتصال بالخادم.'); }
    finally { setIsSaving(false); }
  }, [result, reportDate]);

  const loadHistoryReport = useCallback(async (id: number) => {
    setLoadingReportId(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/ops-reports/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail: SavedReportDetail = await res.json();
      const loaded = buildResultFromSaved(detail);
      setScadaSourceReportDate(detail.report_date || null);

      // Preload SCADA engines snapshot for this saved report date.
      try {
        const sRes = await fetch(`/api/v1/engines/scada-live?reportDate=${encodeURIComponent(detail.report_date)}`, { cache: 'no-store' });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData?.ok) {
            setScadaEngines({
              e1: sData.e1 ?? null,
              e2: sData.e2 ?? null,
              e3: sData.e3 ?? null,
              e4: sData.e4 ?? null,
            });
          }
        }
      } catch {
        // Silent fallback to existing engines if this lookup fails.
      }

      // Fetch daily quality readings from DB for full 31-day breakdown
      try {
        const qRes = await fetch('/api/v1/quality-daily');
        if (qRes.ok) {
          const qData = await qRes.json();
          (loaded as { qualityDailyReadings?: unknown }).qualityDailyReadings = qData.dailyReadings ?? [];
        }
      } catch { /* silent — daily readings are supplemental */ }
      setResult(loaded);
      setTab('overview');
    } catch {
      setError('فشل تحميل التقرير من السجل. تأكد من اتصال الخادم.');
    } finally {
      setLoadingReportId(null);
    }
  }, []);

  const TABS = [
    { id: 'overview',     label: 'الملخص',           icon: Activity },
    { id: 'stations',     label: 'المحطات',           icon: Building2 },
    { id: 'consumption',  label: 'الاستهلاك',         icon: Droplets },
    { id: 'quality',      label: 'جودة المياه',       icon: Waves },
    { id: 'anomalies',    label: 'التنبيهات',         icon: AlertTriangle },
    { id: 'report',       label: 'التقرير الهندسي',   icon: BookOpen },
    { id: 'scada',        label: 'السكادا المتكاملة',  icon: Zap },
    { id: 'pipeline',     label: 'الجودة التقنية',    icon: Gauge },
    { id: 'history',      label: 'السجل التاريخي',    icon: Database },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">

        <div>
          <Link href="/dashboard/admin-gateway/maintenance" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-4 transition-colors">
            <ArrowRight className="w-4 h-4" /> إدارة الهندسة والدعم الفني
          </Link>
          <h1 className="text-3xl font-bold text-white">مراقبة التشغيل</h1>
          <p className="text-slate-400 mt-1">تحليل بيانات التشغيل اليومية ومقارنتها بالبيانات التصميمية</p>
        </div>

        {/* Upload Zone (always available) */}
        <div
          className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all duration-200 cursor-pointer
            ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 hover:border-slate-600 hover:bg-slate-900/50'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          {isLoading ? (
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
              <p className="text-slate-300 text-sm font-medium">جاري تحليل الملف...</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Upload className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-slate-300 text-sm">رفع تقرير تشغيل جديد (Excel/CSV)</p>
              <span className="text-slate-500 text-xs">انقر أو اسحب الملف هنا</span>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 rounded-xl p-4">
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <>
            {/* File info bar */}
            {result && (
              <div className="flex flex-wrap items-center gap-3 bg-slate-900 rounded-xl p-4 border border-slate-800">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-white font-medium">{result.filename}</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400 text-sm">{result.sheets.length} ورقة بيانات</span>
                <div className="flex flex-wrap gap-1.5">
                  {result.sheets.map(s => (
                    <span key={s.name} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {s.name} ({s.type})
                    </span>
                  ))}
                </div>
                <button onClick={() => { setResult(null); setError(null); setSaveSuccess(false); setTab('history'); }}
                  className="mr-auto text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> إغلاق التقرير الحالي
                </button>
                {!result.filename.includes('\u2190 \u0645\u0646 \u0627\u0644\u0633\u062c\u0644') && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-xs">\u0634\u0647\u0631 \u0627\u0644\u062a\u0642\u0631\u064a\u0631:</span>
                      <input type="month"
                        value={reportDate.slice(0, 7)}
                        onChange={(e) => setReportDate((e.target.value || new Date().toISOString().slice(0,7)) + '-01')}
                        className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-indigo-500" />
                    </div>
                    <button onClick={handleSave} disabled={isSaving || saveSuccess}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium
                        ${saveSuccess ? 'bg-emerald-700/40 text-emerald-300 cursor-default' :
                          'bg-indigo-600/70 hover:bg-indigo-600 text-white'}`}>
                      {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> :
                        saveSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Database className="w-3.5 h-3.5" />}
                      {isSaving ? '\u062c\u0627\u0631\u064a \u0627\u0644\u062d\u0641\u0638...' : saveSuccess ? '\u062a\u0645 \u0627\u0644\u062d\u0641\u0638 \u2713' : '\u062d\u0641\u0638 \u0641\u064a \u0627\u0644\u0633\u062c\u0644'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Debug Panel — collapsible diagnostic log */}
            {result?.debugLog && result.debugLog.length > 0 && (
              <div className="bg-slate-950 border border-slate-700/60 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowDebug(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-colors text-xs font-mono"
                >
                  <span>🔍 تشخيص التحليل ({result.debugLog.length} رسالة)</span>
                  <span className="text-slate-600">{showDebug ? '▲ إخفاء' : '▼ إظهار'}</span>
                </button>
                {showDebug && (
                  <div className="px-4 pb-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
                      {result.debugLog.join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setTab(id); if (id === 'history') loadHistory(); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                    ${tab === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                  <Icon className="w-4 h-4" />
                  {label}
                  {id === 'anomalies' && result && (result.kpis.anomalyCount.critical + result.kpis.anomalyCount.warning) > 0 && (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {result.kpis.anomalyCount.critical + result.kpis.anomalyCount.warning}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {tab === 'overview'    && (result ? <OverviewTab result={result} /> : <EmptyState message="لا يوجد تقرير محمّل" hint="حمّل ملف Excel/CSV أو افتح تقريرًا من السجل التاريخي" />)}
            {tab === 'stations'    && (result ? <StationsTab result={result} /> : <EmptyState message="لا يوجد تقرير محمّل" hint="حمّل ملف Excel/CSV أو افتح تقريرًا من السجل التاريخي" />)}
            {tab === 'consumption' && (result ? <ConsumptionTab result={result} /> : <EmptyState message="لا يوجد تقرير محمّل" hint="حمّل ملف Excel/CSV أو افتح تقريرًا من السجل التاريخي" />)}
            {tab === 'quality'     && (result ? <QualityTab result={result} /> : <EmptyState message="لا يوجد تقرير محمّل" hint="حمّل ملف Excel/CSV أو افتح تقريرًا من السجل التاريخي" />)}
            {tab === 'anomalies'   && (result ? <AnomaliesTab result={result} /> : <EmptyState message="لا يوجد تقرير محمّل" hint="حمّل ملف Excel/CSV أو افتح تقريرًا من السجل التاريخي" />)}
            {tab === 'report'      && (result ? <ReportTab result={result} /> : <EmptyState message="لا يوجد تقرير محمّل" hint="حمّل ملف Excel/CSV أو افتح تقريرًا من السجل التاريخي" />)}
            {tab === 'history'     && <HistoryTab history={history} loading={historyLoading} onLoad={loadHistory} onViewReport={loadHistoryReport} loadingId={loadingReportId} />}
            {tab === 'scada'       && <SCADAView engine1={scadaEngines?.e1 as never ?? null} engine2={scadaEngines?.e2 as never ?? null} engine3={scadaEngines?.e3 as never ?? null} engine4={scadaEngines?.e4 as never ?? null} />}
            {tab === 'pipeline'    && <MotorStatusView engine1={scadaEngines?.e1 as never ?? null} engine3={scadaEngines?.e3 as never ?? null} engine4={scadaEngines?.e4 as never ?? null} />}
          </>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ result }: { result: AnalysisResult }) {
  const { kpis } = result;
  const cards = [
    { label: 'إجمالي الإنتاج',      value: kpis.totalProduction.toLocaleString(),  unit: 'م³/يوم', Icon: Zap,          color: 'text-indigo-400', bg: 'bg-indigo-500/20', border: 'border-indigo-500/30' },
    { label: 'إجمالي الاستهلاك',    value: kpis.totalConsumption.toLocaleString(), unit: 'م³/يوم', Icon: Droplets,     color: 'text-cyan-400',   bg: 'bg-cyan-500/20',   border: 'border-cyan-500/30' },
    { label: 'نسبة الفاقد (NRW)',   value: kpis.nrw.toFixed(1),                   unit: '%',       Icon: TrendingDown, color: kpis.nrw > 25 ? 'text-red-400' : kpis.nrw > 15 ? 'text-yellow-400' : 'text-emerald-400', bg: kpis.nrw > 25 ? 'bg-red-500/20' : kpis.nrw > 15 ? 'bg-yellow-500/20' : 'bg-emerald-500/20', border: kpis.nrw > 25 ? 'border-red-500/30' : kpis.nrw > 15 ? 'border-yellow-500/30' : 'border-emerald-500/30' },
    { label: 'الفاقد اليومي',        value: kpis.waterBalance.toLocaleString(),     unit: 'م³/يوم', Icon: Target,       color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
    { label: 'كفاءة المضخات',        value: kpis.avgPumpEfficiency.toFixed(0),      unit: '%',       Icon: Gauge,        color: kpis.avgPumpEfficiency >= 75 ? 'text-emerald-400' : 'text-yellow-400', bg: kpis.avgPumpEfficiency >= 75 ? 'bg-emerald-500/20' : 'bg-yellow-500/20', border: kpis.avgPumpEfficiency >= 75 ? 'border-emerald-500/30' : 'border-yellow-500/30' },
    { label: 'تغطية الطلب',          value: kpis.demandCoverage.toFixed(0),         unit: '%',       Icon: TrendingUp,   color: 'text-violet-400', bg: 'bg-violet-500/20', border: 'border-violet-500/30' },
  ];
  return (
    <div className="space-y-6">
      {result.consumptionDataSuspect && (
        <div className="flex items-start gap-3 bg-amber-900/30 border border-amber-600/50 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-semibold text-sm">تحذير: بيانات الاستهلاك قد تكون غير دقيقة</p>
            <p className="text-amber-400/80 text-xs mt-0.5">{result.consumptionCorrectionNote || 'تم اكتشاف أن مجموع الاستهلاك يتجاوز الإنتاج بأكثر من 30%، وهو أمر غير ممكن فيزيائياً. يُرجى مراجعة أعمدة الاستهلاك في ملف Excel.'}</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((k) => (
          <div key={k.label} className={`bg-slate-900 border ${k.border} rounded-2xl p-4`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
                <k.Icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <p className="text-slate-400 text-sm leading-tight">{k.label}</p>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value} <span className="text-sm font-normal text-slate-400">{k.unit}</span></p>
          </div>
        ))}
      </div>

      {result.chartData.some(d => d.إنتاج > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">الإنتاج مقابل الاستهلاك (م³/يوم)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={result.chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number, n: string) => [`${v.toLocaleString()} م³`, n]}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', direction: 'rtl' }} />
              <Legend />
              <Bar dataKey="إنتاج"    fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="استهلاك"  fill="#22d3ee" radius={[4,4,0,0]} />
              <Bar dataKey="فاقد"     fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {result.anomalies.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400" /> ملخص التنبيهات
          </h3>
          <div className="flex gap-3 flex-wrap mb-4">
            {kpis.anomalyCount.critical > 0 && <span className="px-4 py-2 rounded-xl bg-red-900/30 border border-red-700/50 text-red-300 font-semibold">{kpis.anomalyCount.critical} حرجة</span>}
            {kpis.anomalyCount.warning  > 0 && <span className="px-4 py-2 rounded-xl bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 font-semibold">{kpis.anomalyCount.warning} تحذير</span>}
            {kpis.anomalyCount.info     > 0 && <span className="px-4 py-2 rounded-xl bg-blue-900/30 border border-blue-700/50 text-blue-300 font-semibold">{kpis.anomalyCount.info} معلومة</span>}
          </div>
          <div className="space-y-2">
            {result.anomalies.slice(0, 4).map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl
                ${a.severity === 'critical' ? 'bg-red-900/20 border border-red-700/30' :
                  a.severity === 'warning'  ? 'bg-yellow-900/20 border border-yellow-700/30' :
                  'bg-blue-900/20 border border-blue-700/30'}`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${a.severity === 'critical' ? 'text-red-400' : a.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'}`} />
                <p className="text-sm text-slate-300">{a.location}: {a.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stations Tab ─────────────────────────────────────────────────────────────
function StationsTab({ result }: { result: AnalysisResult }) {
  if (result.stations.length === 0) return <EmptyState message="لا توجد بيانات محطات في هذا الملف" hint="تأكد أن الملف يحتوي ورقة تشغيل محطات بعناوين واضحة" />;
  return (
    <div className="space-y-5">
      <div className="overflow-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs">
              {['المحطة', 'التدفق (م³/يوم)', 'الضغط (بار)', 'التصميمي (بار)', 'المضخات', 'الحالة'].map(h => (
                <th key={h} className="text-right px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.stations.map((s, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                <td className="px-4 py-3">
                  <span className="text-cyan-300">{s.flow > 0 ? s.flow.toLocaleString() : '—'}</span>
                  {s.flowCalculated && (
                    <span className="mr-2 px-1.5 py-0.5 rounded text-xs bg-amber-900/40 text-amber-300 border border-amber-700/40" title="محسوب رياضياً من الضغط + نسبة فتح الصمام + قطر الأنبوب">
                      محسوب
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={s.status === 'critical' ? 'text-red-400' : s.status === 'warning' ? 'text-yellow-400' : 'text-emerald-400'}>
                    {s.pressure > 0 ? s.pressure.toFixed(2) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{s.designP ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">{s.pumpsRunning}{s.pumpsTotal > 0 ? `/${s.pumpsTotal}` : ''}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                    ${s.status === 'critical' ? 'bg-red-900/40 text-red-300' :
                      s.status === 'warning'  ? 'bg-yellow-900/40 text-yellow-300' :
                      'bg-emerald-900/40 text-emerald-300'}`}>
                    {s.status === 'critical' ? 'حرج' : s.status === 'warning' ? 'تحذير' : 'طبيعي'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.stations.some(s => s.pressure > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">ضغط التشغيل مقابل التصميمي (بار)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={result.stations.filter(s => s.pressure > 0)} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit=" بار" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="pressure" name="ضغط التشغيل" fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="designP"  name="التصميمي"    fill="#334155" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Consumption Tab ──────────────────────────────────────────────────────────
function ConsumptionTab({ result }: { result: AnalysisResult }) {
  if (result.consumption.length === 0) return <EmptyState message="لا توجد بيانات استهلاك في هذا الملف" hint="تأكد أن الملف يحتوي ورقة استهلاك بمناطق ومدن" />;
  const sorted = [...result.consumption].sort((a, b) => b.actual - a.actual);
  const dailyMatrix = result.consumptionDaily;
  const hasDesign = sorted.some(c => c.design > 0);
  // Build chart data for areas that have both actual and design
  const chartItems = sorted.filter(c => c.design > 0 && (c.actual > 0 || c.design > 0)).slice(0, 12);
  return (
    <div className="space-y-5">
      {dailyMatrix && dailyMatrix.columns.length > 0 && dailyMatrix.rows.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300">الاستهلاك اليومي حسب المنطقة — {dailyMatrix.rows.length} يوم</h3>
            <span className="text-xs text-slate-500">المصدر: {dailyMatrix.sourceSheet || 'الملف المحمّل'}</span>
          </div>
          <div className="overflow-auto max-h-[460px]">
            <table className="w-full text-xs text-right" dir="rtl">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="px-3 py-2 font-medium whitespace-nowrap">اليوم</th>
                  {dailyMatrix.columns.map((col) => (
                    <th key={col} className="px-3 py-2 font-medium whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyMatrix.rows.map((row, i) => (
                  <tr key={row.dayNo} className={`border-b border-slate-800/50 ${i % 2 === 1 ? 'bg-slate-800/20' : ''}`}>
                    <td className="px-3 py-1.5 text-slate-300 font-semibold">{row.dayNo}</td>
                    {dailyMatrix.columns.map((col) => {
                      const v = row.values[col];
                      return (
                        <td key={`${row.dayNo}-${col}`} className={`px-3 py-1.5 font-mono ${v === null ? 'text-slate-500' : 'text-cyan-300'}`}>
                          {v === null ? 'N/A' : v.toLocaleString()}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Design comparison chart */}
      {hasDesign && chartItems.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1 text-sm">الاستهلاك الفعلي مقابل التصميمي (م³/يوم)</h3>
          <p className="text-slate-500 text-xs mb-4">الأعمدة الزرقاء = فعلي • الرمادية = تصميمي. تجاوز التصميمي يعني زيادة الطلب</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartItems} margin={{ top: 5, right: 20, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-30} textAnchor="end" interval={0} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number, n: string) => [`${v.toLocaleString()} م³`, n]}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', direction: 'rtl' }} />
              <Legend />
              <Bar dataKey="actual" name="فعلي" fill="#22d3ee" radius={[4,4,0,0]} />
              <Bar dataKey="design" name="تصميمي" fill="#334155" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="overflow-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs">
              {['المنطقة', 'الفعلي (م³/يوم)', 'التصميمي (م³/يوم)', 'التغطية', 'الحالة'].map(h => (
                <th key={h} className="text-right px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const over = c.coverage > 120; const under = c.coverage < 60 && c.design > 0;
              return (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                  <td className="px-4 py-3 text-cyan-300">{c.actual.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-400">{c.design > 0 ? c.design.toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    {c.design > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-800 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${over ? 'bg-yellow-400' : under ? 'bg-red-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(c.coverage, 150) / 1.5}%` }} />
                        </div>
                        <span className={`text-xs font-medium ${over ? 'text-yellow-400' : under ? 'text-red-400' : 'text-emerald-400'}`}>{c.coverage.toFixed(0)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                      ${over ? 'bg-yellow-900/40 text-yellow-300' : under ? 'bg-red-900/40 text-red-300' : 'bg-emerald-900/40 text-emerald-300'}`}>
                      {over ? 'تجاوز' : under ? 'منخفض' : 'طبيعي'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Quality Tab ──────────────────────────────────────────────────────────────
function QualityTab({ result }: { result: AnalysisResult }) {
  if (result.quality.length === 0) return <EmptyState message="لا توجد بيانات جودة مياه في هذا الملف" hint="تأكد أن الملف يحتوي ورقة بها TDS أو نترات أو أملاح أو pH — أو ورقة باسم W.Q" />;
  const hasNitrates = result.quality.some(q => q.nitrates !== undefined);
  const dailyReadings = (result as { qualityDailyReadings?: { dayNo: number; points: { location: string; tds: number|null; ph: number|null; nitrates: number|null; conductivity: number|null }[] }[] }).qualityDailyReadings ?? [];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
        {[
          { label: 'حد TDS / الأملاح', value: `${TDS_MAX} mg/L` },
          { label: 'حد النترات (WHO)', value: '50 mg/L' },
          { label: 'حد الموصلية', value: `${CONDUCTIVITY_MAX} µS/cm` },
          { label: 'نطاق pH', value: '6.5 – 8.5' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs">{s.label}</p>
            <p className="text-lg font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="overflow-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs">
              {['الموقع / اليوم', 'TDS / الأملاح (mg/L)', ...(hasNitrates ? ['النترات (mg/L)'] : []), 'الموصلية (µS/cm)', 'pH', 'الحالة'].map(h => (
                <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.quality.map((q, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{q.location}</td>
                <td className={`px-4 py-3 font-medium ${q.tds > TDS_MAX ? 'text-red-400' : q.tds > TDS_MAX * 0.9 ? 'text-yellow-400' : q.tds > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {q.tds > 0 ? q.tds.toLocaleString() : '—'}
                </td>
                {hasNitrates && (
                  <td className={`px-4 py-3 font-medium ${
                    q.nitrates !== undefined && q.nitrates > 50 ? 'text-red-400' :
                    q.nitrates !== undefined && q.nitrates > 45 ? 'text-yellow-400' :
                    q.nitrates !== undefined ? 'text-emerald-400' : 'text-slate-500'
                  }`}>
                    {q.nitrates !== undefined ? q.nitrates.toFixed(1) : '—'}
                  </td>
                )}
                <td className="px-4 py-3 text-slate-300">{q.conductivity ? q.conductivity.toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-slate-300">{q.ph ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit
                    ${q.status === 'fail'    ? 'bg-red-900/40 text-red-300' :
                      q.status === 'warning' ? 'bg-yellow-900/40 text-yellow-300' :
                      'bg-emerald-900/40 text-emerald-300'}`}>
                    {q.status === 'fail'    ? <><XCircle className="w-3 h-3" /> يتجاوز الحد</> :
                     q.status === 'warning' ? <><AlertTriangle className="w-3 h-3" /> تحذير</> :
                     <><CheckCircle2 className="w-3 h-3" /> مقبول</>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    {/* ── Daily Readings Table ─────────────────────────────────────────────── */}
    {dailyReadings.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300">القراءات اليومية — {dailyReadings.length} يوم</h3>
            <span className="text-xs text-slate-500">البيانات الفعلية المُسجَّلة يوميًا</span>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="w-full text-xs text-right" dir="rtl">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="px-4 py-2 font-medium">يوم</th>
                  <th className="px-4 py-2 font-medium">TDS (mg/L)</th>
                  <th className="px-4 py-2 font-medium">نترات (mg/L)</th>
                  <th className="px-4 py-2 font-medium">pH</th>
                  <th className="px-4 py-2 font-medium">موصلية (µS/cm)</th>
                  <th className="px-4 py-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {dailyReadings.map((dr, i) => {
                  const tdsVal  = dr.points.find(p => p.tds  !== null)?.tds  ?? null;
                  const nitVal  = dr.points.find(p => p.nitrates !== null)?.nitrates ?? null;
                  const phVal   = dr.points.find(p => p.ph   !== null)?.ph   ?? null;
                  const condVal = dr.points.find(p => p.conductivity !== null)?.conductivity ?? null;
                  const dayStatus =
                    (tdsVal !== null && tdsVal > TDS_MAX) || (nitVal !== null && nitVal > 50) ? 'fail' :
                    (tdsVal !== null && tdsVal > TDS_MAX * 0.9) || (nitVal !== null && nitVal > 45) ? 'warning' : 'pass';
                  return (
                    <tr key={i} className={`border-b border-slate-800/40 ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                      <td className="px-4 py-1.5 text-slate-300 font-mono font-semibold">{dr.dayNo}</td>
                      <td className={`px-4 py-1.5 font-mono ${tdsVal === null ? 'text-slate-600' : tdsVal > TDS_MAX ? 'text-red-400' : tdsVal > TDS_MAX * 0.9 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {tdsVal !== null ? tdsVal.toLocaleString() : '—'}
                      </td>
                      <td className={`px-4 py-1.5 font-mono ${nitVal === null ? 'text-slate-600' : nitVal > 50 ? 'text-red-400' : nitVal > 45 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {nitVal !== null ? nitVal.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-1.5 font-mono text-slate-400">{phVal !== null ? phVal.toFixed(2) : '—'}</td>
                      <td className="px-4 py-1.5 font-mono text-slate-400">{condVal !== null ? condVal.toLocaleString() : '—'}</td>
                      <td className="px-4 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          dayStatus === 'fail'    ? 'bg-red-900/40 text-red-300' :
                          dayStatus === 'warning' ? 'bg-yellow-900/40 text-yellow-300' :
                          'bg-emerald-900/40 text-emerald-300'}`}>
                          {dayStatus === 'fail' ? 'يتجاوز الحد' : dayStatus === 'warning' ? 'تحذير' : 'مقبول'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
    )}
    </div>
  );
}

// ─── Anomalies Tab ────────────────────────────────────────────────────────────
function AnomaliesTab({ result }: { result: AnalysisResult }) {
  if (result.anomalies.length === 0) return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-10 text-center">
      <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
      <p className="text-emerald-300 font-semibold">لا توجد انحرافات أو مشاكل مكتشفة</p>
      <p className="text-slate-400 text-sm mt-1">جميع القيم ضمن النطاق التصميمي المقبول</p>
    </div>
  );
  const typeLabels: Record<string, string> = { pressure: 'الضغط', flow: 'التدفق', quality: 'الجودة', consumption: 'الاستهلاك', balance: 'الموازنة', efficiency: 'الكفاءة', pumps: 'المضخات' };
  const sorted = [...result.anomalies].sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - { critical: 0, warning: 1, info: 2 }[b.severity]));
  return (
    <div className="space-y-3">
      {sorted.map((a, i) => (
        <div key={i} className={`rounded-2xl p-4 border flex gap-4
          ${a.severity === 'critical' ? 'bg-red-900/20 border-red-700/40' :
            a.severity === 'warning'  ? 'bg-yellow-900/20 border-yellow-700/40' :
            'bg-blue-900/20 border-blue-700/40'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
            ${a.severity === 'critical' ? 'bg-red-500/20' : a.severity === 'warning' ? 'bg-yellow-500/20' : 'bg-blue-500/20'}`}>
            <AlertTriangle className={`w-5 h-5 ${a.severity === 'critical' ? 'text-red-400' : a.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                ${a.severity === 'critical' ? 'bg-red-900/60 text-red-300' :
                  a.severity === 'warning'  ? 'bg-yellow-900/60 text-yellow-300' :
                  'bg-blue-900/60 text-blue-300'}`}>
                {a.severity === 'critical' ? 'حرج' : a.severity === 'warning' ? 'تحذير' : 'معلومة'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{typeLabels[a.type] ?? a.type}</span>
              <span className="text-sm font-semibold text-white">{a.location}</span>
            </div>
            <p className="text-sm text-slate-300">{a.description}</p>
            {a.value !== undefined && a.expected !== undefined && (
              <p className="text-xs text-slate-500 mt-1">القيمة الفعلية: {typeof a.value === 'number' ? a.value.toFixed(2) : a.value} — المتوقع: {a.expected}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Report Tab ───────────────────────────────────────────────────────────────
function ReportTab({ result }: { result: AnalysisResult }) {
  const text = result.report.join('\n');
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `تقرير_تشغيلي_${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm transition-colors">
          <Download className="w-4 h-4" /> تنزيل التقرير
        </button>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ history, loading, onLoad, onViewReport, loadingId }: {
  history: SavedReport[]; loading: boolean; onLoad: () => void;
  onViewReport: (id: number) => void; loadingId: number | null;
}) {
  const [histTab, setHistTab] = React.useState<'records'|'trend'|'compare'>('records');
  const [recordsFilter, setRecordsFilter] = React.useState<'all' | 'critical'>('all');
  React.useEffect(() => { if (history.length === 0) onLoad(); }, []); // eslint-disable-line

  const n = history.length;
  const avgProd = n > 0 ? history.reduce((s, r) => s + Number(r.total_production), 0) / n : 0;
  const avgCons = n > 0 ? history.reduce((s, r) => s + Number(r.total_consumption), 0) / n : 0;
  const avgNrw  = n > 0 ? history.reduce((s, r) => s + Number(r.nrw_percent), 0) / n : 0;
  const maxNrw  = n > 0 ? Math.max(...history.map(r => Number(r.nrw_percent))) : 0;
  const minNrw  = n > 0 ? Math.min(...history.map(r => Number(r.nrw_percent))) : 0;
  const latest  = history[0];

  const trendData = history.slice().reverse().map(r => ({
    label: formatMonthAr(r.report_date),
    'إنتاج (ألف م³)': parseFloat((Number(r.total_production)/1000).toFixed(1)),
    'استهلاك (ألف م³)': parseFloat((Number(r.total_consumption)/1000).toFixed(1)),
    'فاقد %': parseFloat(Number(r.nrw_percent).toFixed(1)),
  }));

  const qualityById = new Map<number, { level: RecordQualityLevel; issues: string[] }>(
    history.map((r) => [r.id, assessSavedReportQuality(r)])
  );
  const qualityCounts = history.reduce(
    (acc, r) => {
      const q = qualityById.get(r.id);
      if (q?.level === 'critical') acc.critical += 1;
      else if (q?.level === 'warning') acc.warning += 1;
      else acc.clean += 1;
      return acc;
    },
    { clean: 0, warning: 0, critical: 0 }
  );
  const recordsRows = history.filter((r) => {
    if (recordsFilter === 'critical') return qualityById.get(r.id)?.level === 'critical';
    return true;
  });

  const totalDesign = DESIGN_CONSUMPTION.reduce((s, d) => s + d.design, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-white font-semibold text-lg">السجل التاريخي — {n > 0 ? `${n} تقرير` : 'فارغ'}</h3>
        <div className="flex gap-2 flex-wrap">
          {(['records', 'trend', 'compare'] as const).map(id => (
            <button key={id} onClick={() => setHistTab(id)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${histTab === id ? 'bg-indigo-600 text-white' : 'text-slate-400 bg-slate-800 hover:text-slate-200'}`}>
              {id === 'records' ? 'السجلات' : id === 'trend' ? 'تطور شهري' : 'مقارنة بالتصميمي'}
            </button>
          ))}
          <button onClick={onLoad} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-slate-400">جاري التحميل...</div>}
      {!loading && n === 0 && <EmptyState message="لا توجد تقارير محفوظة بعد" hint="حمّل ملف Excel ثم اضغط «حفظ في السجل» لحفظ بيانات الشهر" />}

      {!loading && n > 0 && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'متوسط الإنتاج',        value: `${(avgProd/1000).toFixed(0)}ك`, unit: 'ألف م³/يوم', color: 'text-indigo-400', border: 'border-indigo-500/20' },
              { label: 'متوسط الاستهلاك',      value: `${(avgCons/1000).toFixed(0)}ك`, unit: 'ألف م³/يوم', color: 'text-cyan-400',   border: 'border-cyan-500/20' },
              { label: 'متوسط الفاقد',          value: `${avgNrw.toFixed(1)}%`, unit: `نطاق: ${minNrw.toFixed(1)}–${maxNrw.toFixed(1)}%`, color: avgNrw > 25 ? 'text-red-400' : avgNrw > 15 ? 'text-yellow-400' : 'text-emerald-400', border: avgNrw > 25 ? 'border-red-500/20' : 'border-yellow-500/20' },
              { label: 'الشهور المحفوظة', value: `${n}`, unit: `آخر: ${latest ? formatMonthAr(latest.report_date) : '—'}`, color: 'text-violet-400', border: 'border-violet-500/20' },
            ].map(k => (
              <div key={k.label} className={`bg-slate-900 border ${k.border} rounded-xl p-4`}>
                <p className="text-slate-400 text-xs mb-1">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{k.unit}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-900/30 border border-emerald-700/40 text-emerald-300">
              سليم: {qualityCounts.clean}
            </span>
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-900/30 border border-yellow-700/40 text-yellow-300">
              تحذير: {qualityCounts.warning}
            </span>
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/30 border border-red-700/40 text-red-300">
              حرج: {qualityCounts.critical}
            </span>
          </div>

          {/* ── TREND TAB ── */}
          {histTab === 'trend' && (
            <div className="space-y-5">
              {trendData.length > 1 ? (
                <>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h4 className="text-white font-semibold mb-1 text-sm">تطور الإنتاج والاستهلاك (ألف م³)</h4>
                    <p className="text-slate-500 text-xs mb-4">الخط البياني عبر جميع الشهور المحفوظة — يوضح اتجاه المنظومة</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="k" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', direction: 'rtl' }}
                          formatter={(v: number) => [`${v}ك م³`, '']} />
                        <Legend />
                        <Line type="monotone" dataKey="إنتاج (ألف م³)"    stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="استهلاك (ألف م³)"  stroke="#22d3ee" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h4 className="text-white font-semibold mb-1 text-sm">تطور نسبة الفاقد % (NRW)</h4>
                    <p className="text-slate-500 text-xs mb-4">الخط الأحمر = حد تحذير (25%) • الأصفر = إشعار (15%)</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" domain={[0, Math.max(maxNrw * 1.2, 30)]} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', direction: 'rtl' }}
                          formatter={(v: number) => [`${v}%`, 'فاقد']} />
                        <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '25% حرج', fill: '#ef4444', fontSize: 10 }} />
                        <ReferenceLine y={15} stroke="#eab308" strokeDasharray="4 4" label={{ value: '15% تحذير', fill: '#eab308', fontSize: 10 }} />
                        <Line type="monotone" dataKey="فاقد %" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">تحتاج شهرين على الأقل لعرض مخطط التطور</div>
              )}
            </div>
          )}

          {/* ── COMPARE TAB ── */}
          {histTab === 'compare' && latest && (
            <div className="space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h4 className="text-white font-semibold mb-1 text-sm">مقارنة آخر شهر بالطاقة التصميمية</h4>
                <p className="text-slate-500 text-xs mb-4">آخر تقرير: {formatMonthAr(latest.report_date)} — {latest.filename.replace(/\.xlsx?$/,'')}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  {[
                    { label: 'الإنتاج الفعلي',   value: Math.round(Number(latest.total_production)).toLocaleString(),   pct: ((Number(latest.total_production)/totalDesign)*100).toFixed(0),   color: 'text-indigo-400', fill: '#6366f1' },
                    { label: 'الاستهلاك الفعلي', value: Math.round(Number(latest.total_consumption)).toLocaleString(), pct: ((Number(latest.total_consumption)/totalDesign)*100).toFixed(0), color: 'text-cyan-400',   fill: '#22d3ee' },
                    { label: 'الطاقة التصميمية', value: totalDesign.toLocaleString(), pct: '100', color: 'text-slate-400', fill: '#64748b' },
                  ].map(k => (
                    <div key={k.label} className="bg-slate-800 rounded-xl p-4">
                      <p className="text-slate-400 text-xs mb-1">{k.label}</p>
                      <p className={`text-xl font-bold ${k.color}`}>{k.value} <span className="text-sm font-normal text-slate-400">م³</span></p>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-500 mb-1"><span>من التصميمي</span><span>{k.pct}%</span></div>
                        <div className="w-full bg-slate-700 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(Number(k.pct), 100)}%`, backgroundColor: k.fill }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Month by month comparison table */}
                <div className="overflow-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-slate-400 text-xs">
                        {['الشهر', 'الإنتاج', 'الاستهلاك', 'فاقد %', 'تغطية التصميمي', 'مقارنة بمتوسط الفاقد'].map(h => (
                          <th key={h} className="text-right px-3 py-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(r => {
                        const nrw = Number(r.nrw_percent);
                        const diff = nrw - avgNrw;
                        const coverage = ((Number(r.total_consumption)/totalDesign)*100).toFixed(0);
                        return (
                          <tr key={r.id} className="border-t border-slate-700/50 hover:bg-slate-800/50">
                            <td className="px-3 py-2 text-white font-medium whitespace-nowrap">{formatMonthAr(r.report_date)}</td>
                            <td className="px-3 py-2 text-indigo-300 text-xs">{(Number(r.total_production)/1000).toFixed(0)}ك م³</td>
                            <td className="px-3 py-2 text-cyan-300 text-xs">{(Number(r.total_consumption)/1000).toFixed(0)}ك م³</td>
                            <td className={`px-3 py-2 font-semibold text-xs ${nrw > 25 ? 'text-red-400' : nrw > 15 ? 'text-yellow-400' : 'text-emerald-400'}`}>{nrw.toFixed(1)}%</td>
                            <td className="px-3 py-2 text-slate-300 text-xs">{coverage}%</td>
                            <td className={`px-3 py-2 text-xs ${diff > 2 ? 'text-red-400' : diff < -2 ? 'text-emerald-400' : 'text-slate-400'}`}>
                              {diff > 0 ? `▲ +${diff.toFixed(1)}%` : diff < 0 ? `▼ ${diff.toFixed(1)}%` : '≈ متوسط'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── RECORDS TAB ── */}
          {histTab === 'records' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2">
                  <button
                    onClick={() => setRecordsFilter('all')}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${recordsFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-slate-100'}`}
                  >
                    كل السجلات
                  </button>
                  <button
                    onClick={() => setRecordsFilter('critical')}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${recordsFilter === 'critical' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-slate-100'}`}
                  >
                    حرج فقط
                  </button>
                </div>
                <p className="text-xs text-slate-500">المعروض: {recordsRows.length} من {history.length}</p>
              </div>

              <div className="overflow-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs">
                    {['الشهر', 'اسم الملف', 'الإنتاج (م³)', 'الاستهلاك (م³)', 'فاقد %', 'حالة الجودة', 'مقارنة المتوسط', 'التنبيهات', 'إجراء'].map(h => (
                      <th key={h} className="text-right px-3 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recordsRows.map((r) => {
                    const nrw = Number(r.nrw_percent);
                    const diff = nrw - avgNrw;
                    const q = qualityById.get(r.id) || { level: 'warning' as RecordQualityLevel, issues: ['غير محدد'] };
                    return (
                      <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                        <td className="px-3 py-3 text-white font-medium whitespace-nowrap">{formatMonthAr(r.report_date)}</td>
                        <td className="px-3 py-3 text-slate-400 text-xs max-w-[140px] truncate">{r.filename.replace(/\.xlsx?$/,'')}</td>
                        <td className="px-3 py-3 text-indigo-300">{Math.round(Number(r.total_production)).toLocaleString()}</td>
                        <td className="px-3 py-3 text-cyan-300">{Math.round(Number(r.total_consumption)).toLocaleString()}</td>
                        <td className={`px-3 py-3 font-semibold ${nrw > 25 ? 'text-red-400' : nrw > 15 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                          {nrw.toFixed(1)}%
                        </td>
                        <td className="px-3 py-3">
                          <span
                            title={q.issues.length > 0 ? q.issues.join(' | ') : 'لا توجد ملاحظات'}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              q.level === 'critical'
                                ? 'bg-red-900/40 text-red-300 border border-red-700/40'
                                : q.level === 'warning'
                                ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40'
                                : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                            }`}
                          >
                            {q.level === 'critical' ? 'حرج' : q.level === 'warning' ? 'تحذير' : 'سليم'}
                          </span>
                        </td>
                        <td className={`px-3 py-3 text-xs ${diff > 2 ? 'text-red-400' : diff < -2 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {diff > 0 ? `▲ +${diff.toFixed(1)}%` : diff < 0 ? `▼ ${Math.abs(diff).toFixed(1)}%` : '≈'}
                        </td>
                        <td className="px-3 py-3">
                          {r.anomaly_critical > 0 && <span className="text-xs bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded-full mr-1">{r.anomaly_critical}●</span>}
                          {r.anomaly_warning  > 0 && <span className="text-xs bg-yellow-900/40 text-yellow-300 px-1.5 py-0.5 rounded-full">{r.anomaly_warning}▲</span>}
                          {r.anomaly_critical === 0 && r.anomaly_warning === 0 && <span className="text-xs text-emerald-500">✓</span>}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => onViewReport(r.id)}
                            disabled={loadingId === r.id}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600/70 hover:bg-indigo-600 text-white transition-colors disabled:opacity-60">
                            {loadingId === r.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                            {loadingId === r.id ? '...' : 'عرض'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {recordsRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">
                        لا توجد سجلات مطابقة للفلاتر الحالية.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
      <Database className="w-10 h-10 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-400 font-medium">{message}</p>
      <p className="text-slate-600 text-sm mt-1">{hint}</p>
    </div>
  );
}
