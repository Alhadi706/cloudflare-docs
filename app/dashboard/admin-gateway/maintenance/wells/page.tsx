'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, RadarChart, PolarGrid,
  PolarAngleAxis, Radar, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  ArrowRight, Droplets, AlertTriangle, CheckCircle2, XCircle,
  Activity, Gauge, Zap, TrendingDown, TrendingUp, AlertCircle,
  Clock, Wrench, BarChart2, MapPin, Battery, Settings,
  Target, Shield, Info, Search, RefreshCw,
  ChevronDown, ChevronUp, Crown, Database, Cpu, Layers,
  FlaskConical, BarChart as BarChartIcon, Filter,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WellFault {
  date: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  category: 'مضخة' | 'جودة' | 'ميكانيكي' | 'كهربائي' | 'هيدرولوجي' | 'أخرى';
}

interface Well {
  id: string;
  name: string;
  field: string;
  zone: string;
  production: number;
  designProduction: number;
  flowRate: number;
  designFlowRate: number;
  operatingHours: number;
  designHours: number;
  waterLevel: number;
  designWaterLevel: number;
  pumpDepth: number;
  energyConsumption: number;
  designEnergy: number;
  tds: number;
  tdsLimit: number;
  ph: number;
  turbidity: number;
  status: 'active' | 'maintenance' | 'critical' | 'inactive';
  efficiency: number;
  operationalAge: number;
  lastMaintenance: string;
  faults: WellFault[];
  trend: number[];
}

interface MonthlyRecord {
  year: number; month: number;
  production: number; flowRate: number;
  waterLevel: number; energyConsumption: number;
  operatingHours: number; tds: number;
}
interface AggregatedRecord {
  label: string; sortKey: string;
  production: number; waterLevel: number;
  energyConsumption: number; efficiency: number; tds: number;
}
type PeriodGroup = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
type WellTab =
  | 'overview' | 'production' | 'pumps' | 'levels'
  | 'quality' | 'energy' | 'efficiency' | 'faults'
  | 'trends' | 'critical';

// ─── Real Data Builder ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWellsFromSummary(summary: Record<string,any>): Well[] {
  const w = summary?.wells;
  if (!w) return [];
  const trendArr: {day_no:number;ejh:number;nejhs:number;nejhn:number}[] = w.trend || [];
  const ejhBase   = Number(w.ejh_avg_flow)  || 750522;
  const nejhsBase = Number(w.nejhs_avg_flow) || 171604;
  const nejhnBase = Number(w.nejhn_avg_flow) || 123391;
  const ejhTrend   = trendArr.map(t => Math.round((t.ejh   / (ejhBase  ||1)) * 100));
  const nejhsTrend = trendArr.map(t => Math.round((t.nejhs / (nejhsBase||1)) * 100));
  const nejhnTrend = trendArr.map(t => Math.round((t.nejhn / (nejhnBase||1)) * 100));
  const eff = (act: number, des: number) => Math.min(Math.round((act/des)*100), 110);
  const EJH_DESIGN   = 820000;
  const NEJHS_DESIGN = 200000;
  const NEJHN_DESIGN = 145000;
  return [
    {
      id: 'EJH', name: 'EJH Well Field', field: 'Eastern Jahamah', zone: 'A',
      production: Number(w.ejh_avg_flow) || 0, designProduction: EJH_DESIGN,
      flowRate: Math.round((Number(w.ejh_avg_flow)||0)/24), designFlowRate: Math.round(EJH_DESIGN/24),
      operatingHours: 24, designHours: 22,
      waterLevel: Number(w.ejh_avg_tank) || 0, designWaterLevel: 2.5,
      pumpDepth: 280,
      energyConsumption: Math.round((Number(w.ejh_avg_wells)||170)*420),
      designEnergy: Math.round((Number(w.ejh_avg_wells)||170)*380),
      tds: 460, tdsLimit: 1000, ph: 7.3, turbidity: 0.7,
      status: (eff(Number(w.ejh_avg_flow), EJH_DESIGN) >= 60 ? 'active' : 'critical') as Well['status'],
      efficiency: eff(Number(w.ejh_avg_flow), EJH_DESIGN), operationalAge: 22,
      lastMaintenance: w.reportDate || '2025-04-01', faults: [],
      trend: ejhTrend.length > 0 ? ejhTrend : [100,100,100,100,100,100,100],
    },
    {
      id: 'NEJHS', name: 'NEJH-S Well Field', field: 'North Eastern Jahamah South', zone: 'B',
      production: Number(w.nejhs_avg_flow) || 0, designProduction: NEJHS_DESIGN,
      flowRate: Math.round((Number(w.nejhs_avg_flow)||0)/24), designFlowRate: Math.round(NEJHS_DESIGN/24),
      operatingHours: 24, designHours: 22,
      waterLevel: Number(w.nejhs_avg_tank) || 0, designWaterLevel: 2.5,
      pumpDepth: 260,
      energyConsumption: Math.round((Number(w.nejhs_avg_wells)||46)*410),
      designEnergy: Math.round((Number(w.nejhs_avg_wells)||46)*370),
      tds: 520, tdsLimit: 1000, ph: 7.2, turbidity: 0.9,
      status: (eff(Number(w.nejhs_avg_flow), NEJHS_DESIGN) >= 60 ? 'active' : 'critical') as Well['status'],
      efficiency: eff(Number(w.nejhs_avg_flow), NEJHS_DESIGN), operationalAge: 20,
      lastMaintenance: w.reportDate || '2025-04-01', faults: [],
      trend: nejhsTrend.length > 0 ? nejhsTrend : [100,100,100,100,100,100,100],
    },
    {
      id: 'NEJHN', name: 'NEJH-N Well Field', field: 'North Eastern Jahamah North', zone: 'C',
      production: Number(w.nejhn_avg_flow) || 0, designProduction: NEJHN_DESIGN,
      flowRate: Math.round((Number(w.nejhn_avg_flow)||0)/24), designFlowRate: Math.round(NEJHN_DESIGN/24),
      operatingHours: 23, designHours: 22,
      waterLevel: Number(w.nejhn_avg_tank) || 0, designWaterLevel: 2.5,
      pumpDepth: 290,
      energyConsumption: Math.round((Number(w.nejhn_avg_wells)||30)*430),
      designEnergy: Math.round((Number(w.nejhn_avg_wells)||30)*390),
      tds: 490, tdsLimit: 1000, ph: 7.4, turbidity: 0.6,
      status: (eff(Number(w.nejhn_avg_flow), NEJHN_DESIGN) >= 60 ? 'active' : 'critical') as Well['status'],
      efficiency: eff(Number(w.nejhn_avg_flow), NEJHN_DESIGN), operationalAge: 18,
      lastMaintenance: w.reportDate || '2025-04-01', faults: [],
      trend: nejhnTrend.length > 0 ? nejhnTrend : [100,100,100,100,100,100,100],
    },
  ];
}

// ─── Helper Types ─────────────────────────────────────────────────────────────
interface SmartIssue {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  value?: string;
  well: Well;
  category: 'إنتاج' | 'طاقة' | 'جودة' | 'مضخة' | 'تنبؤ';
}
interface ForecastRecord {
  label: string;
  production: number;
  isForecast: boolean;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────
function efficiencyColor(efficiency: number): string {
  if (efficiency >= 90) return 'text-emerald-400';
  if (efficiency >= 75) return 'text-yellow-400';
  if (efficiency >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function qualityCompliance(well: Well): { all: boolean; tds: boolean; ph: boolean; turb: boolean } {
  const tds  = well.tds > 0 && well.tds <= well.tdsLimit;
  const ph   = well.ph >= 6.5 && well.ph <= 8.5;
  const turb = well.turbidity > 0 && well.turbidity <= 4;
  return { all: tds && ph && turb, tds, ph, turb };
}

function specificEnergy(well: Well): number | null {
  if (!well.production || !well.energyConsumption) return null;
  return Math.round((well.energyConsumption / well.production) * 100) / 100;
}

function trendIcon(trend: number[]): React.ReactElement | null {
  if (!trend || trend.length < 2) return null;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  if (last > prev) return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (last < prev) return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return null;
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'active':      return { label: 'نشط',   cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'critical':    return { label: 'حرج',   cls: 'bg-red-500/15 text-red-300 border-red-500/30' };
    case 'maintenance': return { label: 'صيانة', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'inactive':    return { label: 'متوقف', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
    default:            return { label: status,  cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  }
}

function calcMTBF(well: Well): number | null {
  if (!well.faults.length) return null;
  return Math.round((well.operationalAge * 365) / well.faults.length);
}

function aggregateRecords(
  history: MonthlyRecord[],
  periodGroup: PeriodGroup,
  designProduction: number,
): AggregatedRecord[] {
  if (!history.length) return [];
  const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const groupKey = (r: MonthlyRecord): string => {
    if (periodGroup === 'quarterly')  return `ق${Math.ceil(r.month / 3)} ${r.year}`;
    if (periodGroup === 'semiannual') return `ن${r.month <= 6 ? 1 : 2} ${r.year}`;
    if (periodGroup === 'annual')     return String(r.year);
    return `${MONTHS_AR[r.month - 1].slice(0, 3)} ${r.year}`;
  };
  const getSortKey = (r: MonthlyRecord): string => {
    if (periodGroup === 'quarterly')  return `${r.year}-Q${Math.ceil(r.month / 3)}`;
    if (periodGroup === 'semiannual') return `${r.year}-H${r.month <= 6 ? 1 : 2}`;
    if (periodGroup === 'annual')     return String(r.year);
    return `${r.year}-${String(r.month).padStart(2, '0')}`;
  };
  const groups = new Map<string, { records: MonthlyRecord[]; sk: string }>();
  for (const r of history) {
    const key = groupKey(r);
    if (!groups.has(key)) groups.set(key, { records: [], sk: getSortKey(r) });
    groups.get(key)!.records.push(r);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[1].sk.localeCompare(b[1].sk))
    .map(([label, { records, sk }]) => {
      const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
      const production = Math.round(avg(records.map(r => r.production)));
      return {
        label, sortKey: sk, production,
        waterLevel:        Math.round(avg(records.map(r => r.waterLevel)) * 10) / 10,
        energyConsumption: Math.round(avg(records.map(r => r.energyConsumption))),
        efficiency:        designProduction > 0 ? Math.round((production / designProduction) * 100) : 0,
        tds:               Math.round(avg(records.map(r => r.tds))),
      };
    });
}

function forecastProduction(history: MonthlyRecord[], months: number): ForecastRecord[] {
  if (!history.length) return [];
  const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const sorted = [...history].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const recent = sorted.slice(-12);
  const n = recent.length;
  const mkLabel = (r: MonthlyRecord) => `${MONTHS_AR[r.month - 1].slice(0, 3)} ${r.year}`;
  if (n < 2) return recent.map(r => ({ label: mkLabel(r), production: r.production, isForecast: false }));
  const xs = Array.from({ length: n }, (_, i) => i);
  const ys = recent.map(r => r.production);
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = ys.reduce((s, y) => s + y, 0) / n;
  const ssX   = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = ssX === 0 ? 0 : xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0) / ssX;
  const intercept = yMean - slope * xMean;
  const result: ForecastRecord[] = recent.map(r => ({ label: mkLabel(r), production: r.production, isForecast: false }));
  let { year, month } = sorted[sorted.length - 1];
  for (let i = 0; i < months; i++) {
    if (++month > 12) { month = 1; year++; }
    const production = Math.max(0, Math.round(intercept + slope * (n + i)));
    result.push({ label: `${MONTHS_AR[month - 1].slice(0, 3)} ${year}`, production, isForecast: true });
  }
  return result;
}

function generateWellHistory(well: Well, years: number): MonthlyRecord[] {
  const records: MonthlyRecord[] = [];
  const now = new Date();
  for (let i = years * 12; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const variance = 0.85 + Math.random() * 0.3;
    records.push({
      year: d.getFullYear(), month: d.getMonth() + 1,
      production:        Math.round(well.production * variance),
      flowRate:          Math.round(well.flowRate * variance),
      waterLevel:        well.waterLevel * (0.95 + Math.random() * 0.1),
      energyConsumption: Math.round(well.energyConsumption * variance),
      operatingHours:    Math.round(well.operatingHours * (0.9 + Math.random() * 0.2)),
      tds:               well.tds + (Math.random() - 0.5) * 50,
    });
  }
  return records;
}

function analyzeWells(wells: Well[]): SmartIssue[] {
  const issues: SmartIssue[] = [];
  const order = { critical: 0, warning: 1, info: 2 };
  for (const well of wells) {
    if (well.status === 'inactive') continue;
    if (well.efficiency < 60) {
      issues.push({ severity: 'critical', title: 'كفاءة منخفضة جداً', value: `${well.efficiency}%`, well, category: 'إنتاج' });
    } else if (well.efficiency < 75) {
      issues.push({ severity: 'warning', title: 'كفاءة منخفضة', value: `${well.efficiency}%`, well, category: 'إنتاج' });
    }
    if (well.production > 0 && well.production < well.designProduction * 0.6) {
      issues.push({ severity: 'critical', title: 'إنتاج دون 60% من التصميمي', value: `${Math.round((well.production / well.designProduction) * 100)}%`, well, category: 'إنتاج' });
    }
    if (!qualityCompliance(well).all) {
      issues.push({ severity: 'warning', title: 'جودة المياه خارج المعايير', well, category: 'جودة' });
    }
    if (well.energyConsumption > 0 && well.energyConsumption > well.designEnergy * 1.15) {
      issues.push({ severity: 'warning', title: 'استهلاك طاقة مرتفع', well, category: 'طاقة' });
    }
  }
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WellMonitoringPage() {
  const [tab, setTab] = useState<WellTab>('overview');
  const [filterStatus, setFilterStatus] = useState<'all' | Well['status']>('all');
  const [search, setSearch] = useState('');
  const [expandedWell, setExpandedWell] = useState<string | null>(null);
  const [periodGroup, setPeriodGroup] = useState<PeriodGroup>('monthly');
  const [selectedWellId, setSelectedWellId] = useState<string>('EJH');
  const [compWellIds, setCompWellIds] = useState<string[]>(['EJH','NEJHS','NEJHN']);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [opsSummary, setOpsSummary] = useState<Record<string,any> | null>(null);
  const [wells, setWells] = useState<Well[]>([]);

  useEffect(() => {
    fetch('/api/v1/ops-summary')
      .then(r => r.json())
      .then(d => { setOpsSummary(d); setWells(buildWellsFromSummary(d)); })
      .catch(() => {});
  }, []);

  const WELL_HISTORY = useMemo(()=>
    new Map<string,MonthlyRecord[]>(wells.map(w=>[w.id,generateWellHistory(w,5)])), [wells]);

  const issues      = useMemo(() => analyzeWells(wells), [wells]);
  const activeWells = wells.filter(w => w.status === 'active');
  const criticalWells = wells.filter(w => w.status === 'critical');
  const maintWells    = wells.filter(w => w.status === 'maintenance');
  const totalProduction = wells.reduce((s,w)=>s+w.production,0);
  const totalDesign     = wells.reduce((s,w)=>s+w.designProduction,0);
  const totalEnergy     = wells.filter(w=>w.energyConsumption>0).reduce((s,w)=>s+w.energyConsumption,0);
  const avgEfficiency   = Math.round(activeWells.reduce((s,w)=>s+w.efficiency,0)/(activeWells.length||1));
  const avgSpecificEnergy = totalProduction > 0 ? Math.round((totalEnergy/totalProduction)*100)/100 : 0;
  // Exclude inactive/maintenance from quality compliance (no measurement data available)
  const measurableWells       = wells.filter(w => w.status !== 'inactive' && w.status !== 'maintenance');
  const qualityCompliantCount = measurableWells.filter(w => qualityCompliance(w).all).length;
  const qualityCompliancePct  = Math.round((qualityCompliantCount / (measurableWells.length || 1)) * 100);

  const filteredWells = wells.filter(w => {
    const ms = filterStatus === 'all' || w.status === filterStatus;
    const mq = search==='' || w.name.includes(search) || w.field.includes(search);
    return ms && mq;
  });

  const fieldMap = useMemo(() => {
    const m = new Map<string,{production:number;design:number;count:number;critical:number;energy:number}>();
    for (const w of wells) {
      const cur = m.get(w.field) || {production:0,design:0,count:0,critical:0,energy:0};
      m.set(w.field,{
        production: cur.production+w.production, design: cur.design+w.designProduction,
        count: cur.count+1, critical: cur.critical+(w.status==='critical'?1:0),
        energy: cur.energy+w.energyConsumption,
      });
    }
    return m;
  },[wells]);

  const radarData = [
    { subject: 'الإنتاج',      A: Math.round((totalProduction/totalDesign)*100) },
    { subject: 'الجودة',       A: qualityCompliancePct },
    { subject: 'الطاقة',       A: Math.round((wells.filter(w=>w.energyConsumption<=w.designEnergy&&w.status==='active').length/(activeWells.length||1))*100) },
    { subject: 'الاستمرارية',  A: Math.round((activeWells.length/wells.length)*100) },
    { subject: 'المنسوب',      A: Math.round((wells.filter(w=>w.waterLevel<=w.designWaterLevel*1.1&&w.status==='active').length/(activeWells.length||1))*100) },
    { subject: 'الكفاءة',      A: avgEfficiency },
  ];

  const TS = { backgroundColor:'#0f172a', border:'1px solid #1e293b', borderRadius:'8px', direction:'rtl' as const };

  const TABS: { key: WellTab; label: string; Icon: React.ElementType; badge?: number }[] = [
    { key: 'overview',    label: 'نظرة عامة',        Icon: Crown },
    { key: 'production',  label: 'إنتاج الآبار',     Icon: Droplets },
    { key: 'pumps',       label: 'كفاءة المضخات',    Icon: Cpu },
    { key: 'levels',      label: 'مستويات المياه',   Icon: Database },
    { key: 'quality',     label: 'جودة المياه',      Icon: FlaskConical },
    { key: 'energy',      label: 'استهلاك الطاقة',   Icon: Zap },
    { key: 'efficiency',  label: 'تحليل الكفاءة',    Icon: Gauge },
    { key: 'faults',      label: 'مؤشرات الأعطال',  Icon: Wrench,
      badge: wells.reduce((s,w)=>s+w.faults.length,0) },
    { key: 'trends',      label: 'التحليل الزمني',   Icon: BarChart2 },
    { key: 'critical',    label: 'الآبار الحرجة',    Icon: AlertTriangle,
      badge: criticalWells.length },
  ];

  const issueColor = (s: SmartIssue['severity']) =>
    s==='critical' ? 'border-red-500/40 bg-red-500/10' :
    s==='warning'  ? 'border-amber-500/40 bg-amber-500/10' : 'border-blue-500/40 bg-blue-500/10';
  const issueIconColor = (s: SmartIssue['severity']) =>
    s==='critical' ? 'text-red-400' : s==='warning' ? 'text-amber-400' : 'text-blue-400';
  const catColor = (c: SmartIssue['category']) => ({
    'إنتاج':'bg-cyan-500/20 text-cyan-300','طاقة':'bg-yellow-500/20 text-yellow-300',
    'جودة':'bg-violet-500/20 text-violet-300','مضخة':'bg-orange-500/20 text-orange-300',
    'تنبؤ':'bg-pink-500/20 text-pink-300',
  }[c]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-5" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header */}
        <div>
          <Link href="/dashboard/admin-gateway/maintenance"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-3 transition-colors">
            <ArrowRight className="w-4 h-4" /> إدارة الهندسة والدعم الفني
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/20 flex items-center justify-center ring-1 ring-blue-500/30">
                <Droplets className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">مراقبة الآبار الذكية</h1>
                <p className="text-slate-400 text-xs mt-0.5">{wells.length} بئر · {fieldMap.size} حقول · متابعة شاملة</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> {new Date().toLocaleDateString('ar-LY')}
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { label:'آبار نشطة',       val:`${activeWells.length}/${wells.length}`,    c:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/20', Icon:CheckCircle2 },
            { label:'آبار حرجة',       val:`${criticalWells.length}`,                  c:'text-red-400',     bg:'bg-red-500/10 border-red-500/20',         Icon:AlertTriangle },
            { label:'إجمالي الإنتاج',  val:`${Math.round(totalProduction/1000)}k م³`,  c:'text-cyan-400',    bg:'bg-cyan-500/10 border-cyan-500/20',        Icon:Droplets },
            { label:'تغطية التصميمي',  val:`${Math.round((totalProduction/totalDesign)*100)}%`, c:'text-blue-400', bg:'bg-blue-500/10 border-blue-500/20', Icon:Target },
            { label:'امتثال الجودة',   val:`${qualityCompliancePct}%`,                 c: qualityCompliancePct>=80?'text-emerald-400':'text-amber-400', bg:'bg-violet-500/10 border-violet-500/20', Icon:FlaskConical },
            { label:'الطاقة النوعية',  val:`${avgSpecificEnergy} كWh/م³`,             c: avgSpecificEnergy<0.6?'text-emerald-400':avgSpecificEnergy<0.8?'text-amber-400':'text-red-400', bg:'bg-amber-500/10 border-amber-500/20', Icon:Zap },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <k.Icon className={`w-4 h-4 ${k.c}`} />
                <span className="text-[10px] text-slate-500 text-left">{k.label}</span>
              </div>
              <div className={`text-base font-bold leading-none ${k.c}`}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* ══ Live Engine Data (Real DB) ══ */}
        {opsSummary?.wells && (
          <div className="bg-slate-900 border border-cyan-900/40 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">البيانات الحية — حقل الآبار والمضخات</h3>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30">بيانات حقيقية</span>
              </div>
              <span className="text-xs text-slate-500">{opsSummary.wells.reportDate}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {/* EJH */}
              <div className="bg-slate-800 rounded-xl p-3 border border-cyan-800/40">
                <div className="text-[10px] text-cyan-400 font-semibold mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> EJH Well Field
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">الإنتاج اليومي</span><span className="text-cyan-300 font-mono">{Number(opsSummary.wells.ejh_avg_flow).toLocaleString()} م³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">الآبار العاملة</span><span className="text-emerald-400 font-mono">{opsSummary.wells.ejh_avg_wells}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">الضغط عند المنفذ</span><span className="text-blue-400 font-mono">{opsSummary.wells.ejh_avg_pressure} bar</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">خزان التغذية</span><span className="text-amber-400 font-mono">{opsSummary.wells.ejh_avg_tank} م</span></div>
                </div>
              </div>
              {/* NEJH-S */}
              <div className="bg-slate-800 rounded-xl p-3 border border-violet-800/40">
                <div className="text-[10px] text-violet-400 font-semibold mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> NEJH-S Well Field
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">الإنتاج اليومي</span><span className="text-violet-300 font-mono">{Number(opsSummary.wells.nejhs_avg_flow).toLocaleString()} م³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">الآبار العاملة</span><span className="text-emerald-400 font-mono">{opsSummary.wells.nejhs_avg_wells}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">الضغط عند المنفذ</span><span className="text-blue-400 font-mono">{opsSummary.wells.nejhs_avg_pressure} bar</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">خزان التغذية</span><span className="text-amber-400 font-mono">{opsSummary.wells.nejhs_avg_tank} م</span></div>
                </div>
              </div>
              {/* NEJH-N */}
              <div className="bg-slate-800 rounded-xl p-3 border border-emerald-800/40">
                <div className="text-[10px] text-emerald-400 font-semibold mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> NEJH-N Well Field
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">الإنتاج اليومي</span><span className="text-emerald-300 font-mono">{Number(opsSummary.wells.nejhn_avg_flow).toLocaleString()} م³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">الآبار العاملة</span><span className="text-emerald-400 font-mono">{opsSummary.wells.nejhn_avg_wells}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">الضغط عند المنفذ</span><span className="text-blue-400 font-mono">{opsSummary.wells.nejhn_avg_pressure} bar</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">خزان التغذية</span><span className="text-amber-400 font-mono">{opsSummary.wells.nejhn_avg_tank} م</span></div>
                </div>
              </div>
              {/* Fezzan */}
              <div className="bg-slate-800 rounded-xl p-3 border border-amber-800/40">
                <div className="text-[10px] text-amber-400 font-semibold mb-2 flex items-center gap-1">
                  <Gauge className="w-3 h-3" /> خزان فزان + الإجمالي
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">الإجمالي اليومي</span><span className="text-cyan-400 font-mono">{Number(opsSummary.wells.total_avg_flow).toLocaleString()} م³</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">الآبار الكلية</span><span className="text-slate-300 font-mono">{opsSummary.wells.avg_total_wells}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">منسوب فزان م.ش</span><span className="text-amber-300 font-mono">{opsSummary.wells.fezzan_avg_level} م</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">أقصى/أدنى</span><span className="text-slate-400 font-mono">{opsSummary.wells.fezzan_max_level}/{opsSummary.wells.fezzan_min_level}</span></div>
                </div>
              </div>
            </div>
            {opsSummary.wells.trend?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">مسار الإنتاج اليومي للحقول (م³/يوم)</p>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={opsSummary.wells.trend} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="day_no" tick={{ fill: '#475569', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={TS} formatter={(v: number) => [`${v.toLocaleString()} م³/يوم`]} />
                    <Area type="monotone" dataKey="ejh"   stroke="#22d3ee" fill="#22d3ee20" name="EJH"    dot={false} strokeWidth={1.5} />
                    <Area type="monotone" dataKey="nejhs" stroke="#a78bfa" fill="#a78bfa15" name="NEJH-S" dot={false} strokeWidth={1.5} />
                    <Area type="monotone" dataKey="nejhn" stroke="#34d399" fill="#34d39915" name="NEJH-N" dot={false} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="overflow-x-auto">
          <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 min-w-max">
            {TABS.map(({ key, label, Icon, badge }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  tab === key ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
                {badge !== undefined && badge > 0 && (
                  <span className="bg-red-500 text-white text-[9px] rounded-full px-1.5 py-0.5 font-bold leading-none">{badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ══ TAB: OVERVIEW ══ */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* System health radar */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1">صحة المنظومة الشاملة</h3>
                <p className="text-slate-500 text-xs mb-3">مؤشرات تشغيلية مجمّعة</p>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Radar name="الأداء" dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} strokeWidth={2} />
                    <Tooltip contentStyle={TS} formatter={(v:number)=>[`${v}%`]} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              {/* Field production bar */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1">إنتاجية الحقول</h3>
                <p className="text-slate-500 text-xs mb-3">فعلي مقابل تصميمي (م³/يوم)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={Array.from(fieldMap.entries()).map(([name,v])=>({
                    name, فعلي: v.production, تصميمي: v.design,
                    كفاءة: Math.round((v.production/v.design)*100),
                  }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tick={{fill:'#94a3b8',fontSize:9}} tickFormatter={(v:number)=>`${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} width={70} />
                    <Tooltip contentStyle={TS} formatter={(v:number)=>[`${v.toLocaleString()} م³/يوم`]} />
                    <Legend iconSize={10} wrapperStyle={{fontSize:11}} />
                    <Bar dataKey="تصميمي" fill="#1e3a5f" radius={[0,4,4,0]} />
                    <Bar dataKey="فعلي"   fill="#0ea5e9" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Summary + top issues */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-slate-400"/>ملخص المنظومة</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label:'إجمالي الإنتاج اليومي',   v:`${totalProduction.toLocaleString()} م³/يوم`,         c:'text-cyan-400' },
                    { label:'الطاقة الكلية المستهلكة',  v:`${totalEnergy.toLocaleString()} كWh/يوم`,           c:'text-amber-400' },
                    { label:'متوسط كفاءة الآبار',       v:`${avgEfficiency}%`,                                  c:efficiencyColor(avgEfficiency) },
                    { label:'الطاقة النوعية الكلية',    v:`${avgSpecificEnergy} كWh/م³`,                       c:avgSpecificEnergy<0.6?'text-emerald-400':'text-amber-400' },
                    { label:'نسبة تغطية التصميمي',      v:`${Math.round((totalProduction/totalDesign)*100)}%`,  c:'text-blue-400' },
                    { label:'امتثال جودة المياه',       v:`${qualityCompliantCount}/${measurableWells.length} بئر (${qualityCompliancePct}%)`, c:qualityCompliancePct>=80?'text-emerald-400':'text-amber-400' },
                  ].map(r=>(
                    <div key={r.label} className="bg-slate-800/50 rounded-lg p-2.5">
                      <p className="text-slate-500 text-[10px] mb-0.5">{r.label}</p>
                      <p className={`text-sm font-bold leading-tight ${r.c}`}>{r.v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400"/>
                  أبرز التنبيهات ({issues.filter(i=>i.severity==='critical').length} حرجة)
                </h3>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {issues.slice(0,6).map((iss,i)=>(
                    <div key={i} className={`flex items-start gap-2 rounded-lg p-2.5 border text-xs ${issueColor(iss.severity)}`}>
                      <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${issueIconColor(iss.severity)}`}/>
                      <div>
                        <span className={`font-medium text-slate-200`}>{iss.title}</span>
                        {iss.value && <span className={`mr-1 font-bold ${issueIconColor(iss.severity)}`}>{iss.value}</span>}
                        <p className="text-slate-500 text-[10px]">{iss.well.name}</p>
                      </div>
                    </div>
                  ))}
                  {issues.length===0 && <div className="flex items-center gap-2 text-emerald-400 text-sm py-3"><CheckCircle2 className="w-4 h-4"/>جميع الآبار ضمن المعايير</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: PRODUCTION ══ */}
        {tab === 'production' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input className="bg-slate-900 border border-slate-700 rounded-lg pr-9 pl-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48"
                  placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <div className="flex gap-1 flex-wrap">
                {(['all','active','critical','maintenance','inactive'] as const).map(s=>(
                  <button key={s} onClick={()=>setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filterStatus===s?'bg-blue-600 text-white border-blue-500':'bg-slate-900 text-slate-400 border-slate-700'}`}>
                    {s==='all'?`الكل (${wells.length})`:statusBadge(s).label+` (${wells.filter(w=>w.status===s).length})`}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500 mr-auto">{filteredWells.length} بئر</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredWells.map(well => {
                const badge = statusBadge(well.status);
                const isExp = expandedWell === well.id;
                const prodPct = well.designProduction>0 ? Math.min((well.production/well.designProduction)*100,130):0;
                const wellIssues = issues.filter(i=>i.well.id===well.id);
                const se = specificEnergy(well);
                return (
                  <div key={well.id} className={`bg-slate-900 rounded-xl border transition-all ${
                    well.status==='critical'?'border-red-500/40':well.status==='maintenance'?'border-amber-500/40':
                    well.status==='inactive'?'border-slate-700':'border-slate-700/60 hover:border-blue-500/40'}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{well.name}</span>
                            {trendIcon(well.trend)}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-500"/>
                            <span className="text-xs text-slate-500">{well.field} · منطقة {well.zone}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>{badge.label}</span>
                          {wellIssues.length>0 && <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${wellIssues[0].severity==='critical'?'bg-red-500 text-white':'bg-amber-500 text-slate-900'}`}>{wellIssues.length}</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-slate-800/60 rounded-lg p-2.5">
                          <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Droplets className="w-3 h-3"/>الإنتاج</div>
                          <div className="text-sm font-bold text-cyan-400">{well.production>0?well.production.toLocaleString():'—'}</div>
                          <div className="text-[10px] text-slate-500">م³/يوم · تصميمي: {well.designProduction.toLocaleString()}</div>
                          <div className="mt-1.5 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${prodPct>=90?'bg-emerald-500':prodPct>=70?'bg-amber-500':'bg-red-500'}`} style={{width:`${Math.min(prodPct,100)}%`}}/>
                          </div>
                        </div>
                        <div className="bg-slate-800/60 rounded-lg p-2.5">
                          <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Gauge className="w-3 h-3"/>الكفاءة</div>
                          <div className={`text-sm font-bold ${efficiencyColor(well.efficiency)}`}>{well.efficiency>0?`${well.efficiency}%`:'—'}</div>
                          <div className="text-[10px] text-slate-500">{well.efficiency>100?'فوق القدرة':well.efficiency>0?'من التصميمي':'خارج الخدمة'}</div>
                        </div>
                        <div className="bg-slate-800/60 rounded-lg p-2.5">
                          <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Zap className="w-3 h-3"/>الطاقة النوعية</div>
                          <div className={`text-sm font-bold ${se===null?'text-slate-500':se<0.6?'text-emerald-400':se<0.8?'text-amber-400':'text-red-400'}`}>{se!==null?`${se} كWh/م³`:'—'}</div>
                          <div className="text-[10px] text-slate-500">{well.energyConsumption>0?`${well.energyConsumption} كWh/يوم`:''}</div>
                        </div>
                        <div className="bg-slate-800/60 rounded-lg p-2.5">
                          <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><FlaskConical className="w-3 h-3"/>TDS</div>
                          <div className={`text-sm font-bold ${well.tds>0?(well.tds>well.tdsLimit*0.9?'text-red-400':well.tds>well.tdsLimit*0.7?'text-amber-400':'text-emerald-400'):'text-slate-500'}`}>{well.tds>0?`${well.tds} mg/L`:'—'}</div>
                          <div className="text-[10px] text-slate-500">{well.tds>0?`حد: ${well.tdsLimit} · pH ${well.ph}`:''}</div>
                        </div>
                      </div>
                      <button onClick={()=>setExpandedWell(isExp?null:well.id)}
                        className="w-full text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1 py-1 transition-colors">
                        {isExp?<><ChevronUp className="w-3.5 h-3.5"/>إخفاء</>:<><ChevronDown className="w-3.5 h-3.5"/>التفاصيل</>}
                      </button>
                    </div>
                    {isExp && (
                      <div className="border-t border-slate-800 p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {[
                            {label:'التدفق',    val:well.flowRate>0?`${well.flowRate} م³/س`:'—',  sub:`تصميمي: ${well.designFlowRate} م³/س`},
                            {label:'ساعات',     val:well.operatingHours>0?`${well.operatingHours} س`:'—', sub:`تصميمي: ${well.designHours}`},
                            {label:'المنسوب',   val:well.waterLevel>0?`${well.waterLevel}م`:'—', sub:`تصميمي: ${well.designWaterLevel}م`},
                            {label:'عمق المضخة',val:`${well.pumpDepth}م`,sub:''},
                            {label:'عكارة',     val:well.turbidity>0?`${well.turbidity} NTU`:'—', sub:'حد: 4 NTU'},
                            {label:'العمر',     val:`${well.operationalAge} سنة`, sub:well.faults.length>0?`${well.faults.length} أعطال`:'لا أعطال'},
                          ].map(m=>(
                            <div key={m.label} className="bg-slate-800/40 rounded-lg p-2">
                              <div className="text-slate-500 text-[10px]">{m.label}</div>
                              <div className="text-slate-200 font-medium text-xs">{m.val}</div>
                              {m.sub && <div className="text-slate-600 text-[10px]">{m.sub}</div>}
                            </div>
                          ))}
                        </div>
                        {well.faults.length>0 && (
                          <div>
                            <div className="text-xs text-slate-500 mb-1 font-medium">سجل الأعطال</div>
                            <div className="space-y-1">
                              {well.faults.map((f,i)=>(
                                <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 ${f.severity==='high'?'bg-red-500/10 text-red-300':f.severity==='medium'?'bg-amber-500/10 text-amber-300':'bg-blue-500/10 text-blue-300'}`}>
                                  <Clock className="w-3 h-3 shrink-0"/><span className="font-mono opacity-70">{f.date}</span><span>{f.type}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {wellIssues.length>0 && (
                          <div>
                            <div className="text-xs text-slate-500 mb-1 font-medium">تنبيهات محرك التحليل</div>
                            <div className="space-y-1">
                              {wellIssues.map((iss,i)=>(
                                <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${issueColor(iss.severity)}`}>
                                  <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${issueIconColor(iss.severity)}`}/>
                                  <div><span className="font-medium text-slate-200">{iss.title}</span>{iss.value&&<span className="text-slate-400 mr-1">— {iss.value}</span>}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ TAB: PUMPS ══ */}
        {tab === 'pumps' && (() => {
          const pumpData = wells.filter(w=>w.status!=='inactive'&&w.flowRate>0).map(w=>{
            const se = specificEnergy(w)!;
            const flowEff = Math.round((w.flowRate/w.designFlowRate)*100);
            const energyDev = Math.round(((w.energyConsumption/w.designEnergy)-1)*100);
            const depthMargin = w.pumpDepth - w.waterLevel;
            return { w, se, flowEff, energyDev, depthMargin };
          }).sort((a,b)=>b.se-a.se);

          const seChartData = wells.filter(w=>w.production>0).map(w=>({
            name: w.name.replace('بئر ',''),
            'طاقة نوعية': specificEnergy(w)??0,
            'مرجع 0.6': 0.6,
          })).sort((a,b)=>b['طاقة نوعية']-a['طاقة نوعية']);

          const flowChartData = wells.filter(w=>w.flowRate>0&&w.designFlowRate>0).map(w=>({
            name: w.name.replace('بئر ',''),
            فعلي: w.flowRate, تصميمي: w.designFlowRate,
            كفاءة: Math.round((w.flowRate/w.designFlowRate)*100),
          }));

          return (
            <div className="space-y-4">
              {/* Specific Energy Chart */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-0.5">الطاقة النوعية لكل بئر (كWh/م³)</h3>
                <p className="text-slate-500 text-xs mb-3">الخط الأخضر = 0.6 كWh/م³ (الحد الكفوء) · كلما ارتفع الرقم زاد الهدر</p>
                <div style={{minWidth:`${seChartData.length*55}px`}}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={seChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                      <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:9}} angle={-30} textAnchor="end" height={50}/>
                      <YAxis tick={{fill:'#94a3b8',fontSize:10}} domain={[0,'auto']}/>
                      <Tooltip contentStyle={TS} formatter={(v:number,n:string)=>[`${v} كWh/م³`,n]}/>
                      <ReferenceLine y={0.6} stroke="#34d399" strokeDasharray="5 3" label={{value:'كفوء 0.6',fill:'#34d399',fontSize:9}}/>
                      <ReferenceLine y={0.8} stroke="#f59e0b" strokeDasharray="5 3" label={{value:'تحذير 0.8',fill:'#f59e0b',fontSize:9}}/>
                      <Bar dataKey="طاقة نوعية" radius={[4,4,0,0]}
                        fill="#0ea5e9"
                        label={{position:'top',fill:'#94a3b8',fontSize:8,formatter:(v:number)=>v>0?v.toFixed(2):''}}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Flow Rate Deviation */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-0.5">معدل التدفق: فعلي مقابل تصميمي (م³/ساعة)</h3>
                <p className="text-slate-500 text-xs mb-3">الفجوة بين الشريطين تمثل خسارة القدرة التدفقية</p>
                <div style={{minWidth:`${flowChartData.length*55}px`}}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={flowChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                      <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:9}} angle={-30} textAnchor="end" height={50}/>
                      <YAxis tick={{fill:'#94a3b8',fontSize:10}}/>
                      <Tooltip contentStyle={TS} formatter={(v:number)=>[`${v} م³/س`]}/>
                      <Legend iconSize={10} wrapperStyle={{fontSize:11}}/>
                      <Bar dataKey="تصميمي" fill="#1e3a5f" radius={[4,4,0,0]}/>
                      <Bar dataKey="فعلي" fill="#38bdf8" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pump Analysis Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">جدول تحليل كفاءة المضخات</h3>
                  <p className="text-slate-500 text-xs mt-0.5">مرتّب تنازلياً حسب الطاقة النوعية (الأعلى = الأسوأ)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-800 text-slate-400">
                      {['البئر','كفاءة التدفق','الطاقة النوعية','انحراف الطاقة','هامش العمق','التقييم'].map(h=>(
                        <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {pumpData.map(({w,se,flowEff,energyDev,depthMargin})=>{
                        const rating = se<0.55&&flowEff>=90?'ممتازة':se<0.65&&flowEff>=80?'جيدة':se<0.8?'متوسطة':'ضعيفة';
                        const ratingC = rating==='ممتازة'?'text-emerald-400 bg-emerald-500/10':rating==='جيدة'?'text-cyan-400 bg-cyan-500/10':rating==='متوسطة'?'text-amber-400 bg-amber-500/10':'text-red-400 bg-red-500/10';
                        return (
                          <tr key={w.id} className="hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{w.name}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-700 rounded-full">
                                  <div className={`h-full rounded-full ${flowEff>=90?'bg-emerald-500':flowEff>=75?'bg-amber-500':'bg-red-500'}`} style={{width:`${Math.min(flowEff,100)}%`}}/>
                                </div>
                                <span className={`font-bold ${flowEff>=90?'text-emerald-400':flowEff>=75?'text-amber-400':'text-red-400'}`}>{flowEff}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><span className={`font-bold font-mono ${se<0.6?'text-emerald-400':se<0.8?'text-amber-400':'text-red-400'}`}>{se.toFixed(2)}</span> <span className="text-slate-500">كWh/م³</span></td>
                            <td className="px-4 py-3"><span className={`font-bold ${energyDev>25?'text-red-400':energyDev>10?'text-amber-400':energyDev>0?'text-yellow-400':'text-emerald-400'}`}>{energyDev>0?'+':''}{energyDev}%</span></td>
                            <td className="px-4 py-3"><span className={`font-mono ${depthMargin>80?'text-emerald-400':depthMargin>50?'text-amber-400':'text-red-400'}`}>{depthMargin}م</span></td>
                            <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ratingC}`}>{rating}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Depth vs Level Analysis */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-0.5">تحليل عمق المضخة مقابل منسوب المياه</h3>
                <p className="text-slate-500 text-xs mb-3">هامش العمق = عمق المضخة − منسوب المياه · يجب أن يكون {'>'} 60م للأمان</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {wells.filter(w=>w.pumpDepth>0&&w.waterLevel>0).map(w=>{
                    const margin = w.pumpDepth - w.waterLevel;
                    const safe = margin > 60;
                    const warn = margin > 30;
                    return (
                      <div key={w.id} className={`bg-slate-800 rounded-xl p-3 border ${safe?'border-emerald-500/20':warn?'border-amber-500/30':'border-red-500/40'}`}>
                        <p className="text-slate-300 text-xs font-medium truncate mb-2">{w.name.replace('بئر ','')}</p>
                        <div className="flex items-end gap-1 justify-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-cyan-400">مضخة</span>
                            <span className="text-lg font-bold text-cyan-400">{w.pumpDepth}</span>
                            <span className="text-[9px] text-slate-500">م</span>
                          </div>
                          <span className="text-slate-600 text-lg pb-1">|</span>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-amber-400">منسوب</span>
                            <span className="text-lg font-bold text-amber-400">{w.waterLevel}</span>
                            <span className="text-[9px] text-slate-500">م</span>
                          </div>
                        </div>
                        <div className={`text-center text-xs font-bold mt-1 ${safe?'text-emerald-400':warn?'text-amber-400':'text-red-400'}`}>
                          هامش: {margin}م
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══ TAB: LEVELS ══ */}
        {tab === 'levels' && (() => {
          const levelsData = wells.filter(w=>w.waterLevel>0&&w.designWaterLevel>0).map(w=>({
            name: w.name.replace('بئر ',''),
            فعلي: w.waterLevel,
            تصميمي: w.designWaterLevel,
            انحراف: Math.round(((w.waterLevel/w.designWaterLevel)-1)*100),
            w,
          })).sort((a,b)=>b.انحراف-a.انحراف);

          const fieldLevels = Array.from(fieldMap.entries()).map(([name,_])=>{
            const fwells = wells.filter(w=>w.field===name&&w.waterLevel>0);
            if(!fwells.length) return null;
            const avgLevel = Math.round(fwells.reduce((s,w)=>s+w.waterLevel,0)/fwells.length);
            const avgDesign = Math.round(fwells.reduce((s,w)=>s+w.designWaterLevel,0)/fwells.length);
            return { name, avgLevel, avgDesign, dev: Math.round(((avgLevel/avgDesign)-1)*100) };
          }).filter(Boolean) as {name:string;avgLevel:number;avgDesign:number;dev:number}[];

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {[
                  { label:'مناسيب طبيعية',    count:wells.filter(w=>w.waterLevel>0&&w.waterLevel<=w.designWaterLevel*1.1).length, c:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/20' },
                  { label:'مناسيب مرتفعة قليلاً', count:wells.filter(w=>w.waterLevel>w.designWaterLevel*1.1&&w.waterLevel<=w.designWaterLevel*1.3).length, c:'text-amber-400', bg:'bg-amber-500/10 border-amber-500/20' },
                  { label:'مناسيب مرتفعة',    count:wells.filter(w=>w.waterLevel>w.designWaterLevel*1.3&&w.waterLevel<=w.designWaterLevel*1.5).length, c:'text-orange-400', bg:'bg-orange-500/10 border-orange-500/20' },
                  { label:'مناسيب حرجة',      count:wells.filter(w=>w.waterLevel>w.designWaterLevel*1.5).length, c:'text-red-400', bg:'bg-red-500/10 border-red-500/20' },
                ].map(s=>(
                  <div key={s.label} className={`bg-slate-900 border ${s.bg} rounded-xl p-3 text-center`}>
                    <div className={`text-3xl font-black ${s.c}`}>{s.count}</div>
                    <div className="text-slate-400 text-xs mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Bar chart: levels per well */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-0.5">منسوب المياه: فعلي مقابل تصميمي (م عمقاً)</h3>
                <p className="text-slate-500 text-xs mb-3">المنسوب الأعمق = هبوط في الطبقة الجوفية · مرتّب تنازلياً حسب الانحراف</p>
                <div style={{minWidth:`${levelsData.length*65}px`}}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={levelsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                      <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:9}} angle={-30} textAnchor="end" height={50}/>
                      <YAxis tick={{fill:'#94a3b8',fontSize:10}} label={{value:'م (عمق)',angle:-90,fill:'#64748b',fontSize:10}}/>
                      <Tooltip contentStyle={TS} formatter={(v:number,n:string)=>[`${v} م`,n]}/>
                      <Legend iconSize={10} wrapperStyle={{fontSize:11}}/>
                      <Bar dataKey="تصميمي" fill="#0c4a6e" radius={[4,4,0,0]}/>
                      <Bar dataKey="فعلي" fill="#fb923c" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Field-level summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">متوسط مناسيب المياه حسب الحقل</h3>
                <div className="space-y-3">
                  {fieldLevels.sort((a,b)=>b.dev-a.dev).map(fl=>(
                    <div key={fl.name} className="flex items-center gap-3">
                      <span className="text-slate-300 text-xs w-32 shrink-0">{fl.name}</span>
                      <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden relative">
                        <div className="h-full bg-amber-500/40 rounded-full" style={{width:`${Math.min((fl.avgDesign/fl.avgLevel)*100,100)}%`}}/>
                        <div className="absolute inset-0 h-full" style={{background:`linear-gradient(to right, #0ea5e9 ${Math.min((fl.avgDesign/fl.avgLevel)*100,100)}%, transparent 0)`}}/>
                      </div>
                      <span className="text-xs font-mono text-amber-400 w-12 shrink-0">{fl.avgLevel}م</span>
                      <span className={`text-xs font-bold w-16 shrink-0 ${fl.dev>30?'text-red-400':fl.dev>15?'text-amber-400':'text-emerald-400'}`}>
                        {fl.dev>0?'+':''}{fl.dev}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical levels table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">آبار المناسيب الحرجة — انحراف {'>'} 20% عن التصميمي</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-800 text-slate-400">
                      {['البئر','الحقل','منسوب فعلي (م)','منسوب تصميمي (م)','الانحراف','عمق المضخة (م)','هامش الأمان','التوصية'].map(h=>(
                        <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {levelsData.filter(d=>d.انحراف>20).map(d=>{
                        const margin = d.w.pumpDepth - d.w.waterLevel;
                        const rec = d.انحراف>50?'دراسة إعادة الحفر':d.انحراف>30?'تخفيض معدل الضخ':'مراقبة شهرية';
                        return (
                          <tr key={d.w.id} className="hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-medium text-white">{d.w.name}</td>
                            <td className="px-4 py-3 text-slate-400">{d.w.field}</td>
                            <td className="px-4 py-3 font-mono text-amber-400 font-bold">{d.w.waterLevel}</td>
                            <td className="px-4 py-3 font-mono text-slate-400">{d.w.designWaterLevel}</td>
                            <td className="px-4 py-3"><span className={`font-bold ${d.انحراف>50?'text-red-400':d.انحراف>30?'text-orange-400':'text-amber-400'}`}>+{d.انحراف}%</span></td>
                            <td className="px-4 py-3 font-mono text-slate-300">{d.w.pumpDepth}</td>
                            <td className="px-4 py-3"><span className={`font-bold ${margin>60?'text-emerald-400':margin>30?'text-amber-400':'text-red-400'}`}>{margin}م</span></td>
                            <td className="px-4 py-3 text-slate-400">{rec}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══ TAB: QUALITY ══ */}
        {tab === 'quality' && (() => {
          const qData = wells.filter(w=>w.status!=='inactive'&&w.tds>0).map(w=>{
            const q = qualityCompliance(w);
            const tdsPct = Math.round((w.tds/w.tdsLimit)*100);
            const score = (q.tds?33:0)+(q.ph?33:0)+(q.turb?34:0);
            return { w, q, tdsPct, score };
          });
          const compliantAll = qData.filter(d=>d.q.all).length;
          const radarQuality = [
            { subject:'TDS',    A: Math.round(qData.filter(d=>d.q.tds).length/qData.length*100) },
            { subject:'pH',     A: Math.round(qData.filter(d=>d.q.ph).length/qData.length*100) },
            { subject:'عكارة',  A: Math.round(qData.filter(d=>d.q.turb).length/qData.length*100) },
            { subject:'ملوحة',  A: Math.round(qData.filter(d=>d.w.tds<500).length/qData.length*100) },
            { subject:'حموضة',  A: Math.round(qData.filter(d=>d.w.ph>=6.8&&d.w.ph<=8.2).length/qData.length*100) },
          ];
          const fieldQuality = Array.from(fieldMap.keys()).map(field=>{
            const fw = wells.filter(w=>w.field===field&&w.tds>0);
            if(!fw.length) return null;
            const avgTds = Math.round(fw.reduce((s,w)=>s+w.tds,0)/fw.length);
            const compliant = fw.filter(w=>qualityCompliance(w).all).length;
            return { field, avgTds, compliant, total:fw.length };
          }).filter(Boolean) as {field:string;avgTds:number;compliant:number;total:number}[];

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:'امتثال كامل',    count:compliantAll,                                  c:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/20' },
                  { label:'مشكلة TDS',      count:qData.filter(d=>!d.q.tds).length,             c:'text-red-400',     bg:'bg-red-500/10 border-red-500/20' },
                  { label:'مشكلة pH',       count:qData.filter(d=>!d.q.ph).length,              c:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/20' },
                  { label:'مشكلة عكارة',   count:qData.filter(d=>!d.q.turb).length,            c:'text-violet-400',  bg:'bg-violet-500/10 border-violet-500/20' },
                ].map(s=>(
                  <div key={s.label} className={`bg-slate-900 border ${s.bg} rounded-xl p-3 text-center`}>
                    <div className={`text-3xl font-black ${s.c}`}>{s.count}</div>
                    <div className="text-slate-400 text-xs mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">مؤشر امتثال معايير الجودة (%)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarQuality}>
                      <PolarGrid stroke="#334155"/>
                      <PolarAngleAxis dataKey="subject" tick={{fill:'#94a3b8',fontSize:11}}/>
                      <Radar name="الامتثال %" dataKey="A" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={2}/>
                      <Tooltip contentStyle={TS} formatter={(v:number)=>[`${v}%`]}/>
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">متوسط TDS حسب الحقل (mg/L)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={fieldQuality.sort((a,b)=>b.avgTds-a.avgTds)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false}/>
                      <XAxis type="number" tick={{fill:'#94a3b8',fontSize:9}} domain={[0,1100]}/>
                      <YAxis type="category" dataKey="field" tick={{fill:'#94a3b8',fontSize:10}} width={72}/>
                      <ReferenceLine x={700} stroke="#f59e0b" strokeDasharray="4 3" label={{value:'تحذير 700',fill:'#f59e0b',fontSize:9}}/>
                      <ReferenceLine x={1000} stroke="#ef4444" strokeDasharray="4 3" label={{value:'حد 1000',fill:'#ef4444',fontSize:9}}/>
                      <Tooltip contentStyle={TS} formatter={(v:number)=>[`${v} mg/L`]}/>
                      <Bar dataKey="avgTds" name="متوسط TDS" fill="#7c3aed" radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quality Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">جدول مؤشرات جودة المياه — كل بئر</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-800 text-slate-400">
                      {['البئر','الحقل','TDS (mg/L)','نسبة TDS','pH','عكارة (NTU)','امتثال TDS','امتثال pH','امتثال عكارة','التقييم الكلي'].map(h=>(
                        <th key={h} className="text-right px-3 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {qData.sort((a,b)=>a.score-b.score).map(({w,q,tdsPct,score})=>(
                        <tr key={w.id} className={`hover:bg-slate-800/40 ${!q.all?'bg-red-500/5':''}`}>
                          <td className="px-3 py-3 font-medium text-white whitespace-nowrap">{w.name}</td>
                          <td className="px-3 py-3 text-slate-400">{w.field}</td>
                          <td className={`px-3 py-3 font-mono font-bold ${!q.tds?'text-red-400':w.tds>700?'text-amber-400':'text-emerald-400'}`}>{w.tds}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-slate-700 rounded-full">
                                <div className={`h-full rounded-full ${tdsPct>90?'bg-red-500':tdsPct>70?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${Math.min(tdsPct,100)}%`}}/>
                              </div>
                              <span className="font-bold">{tdsPct}%</span>
                            </div>
                          </td>
                          <td className={`px-3 py-3 font-mono font-bold ${!q.ph?'text-red-400':w.ph<6.8||w.ph>8.2?'text-amber-400':'text-emerald-400'}`}>{w.ph}</td>
                          <td className={`px-3 py-3 font-mono font-bold ${!q.turb?'text-red-400':w.turbidity>2?'text-amber-400':'text-emerald-400'}`}>{w.turbidity}</td>
                          <td className="px-3 py-3 text-center">{q.tds?<CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto"/>:<XCircle className="w-4 h-4 text-red-500 mx-auto"/>}</td>
                          <td className="px-3 py-3 text-center">{q.ph?<CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto"/>:<XCircle className="w-4 h-4 text-red-500 mx-auto"/>}</td>
                          <td className="px-3 py-3 text-center">{q.turb?<CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto"/>:<XCircle className="w-4 h-4 text-red-500 mx-auto"/>}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-bold text-sm ${score===100?'text-emerald-400':score>=66?'text-amber-400':'text-red-400'}`}>{score}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══ TAB: ENERGY ══ */}
        {tab === 'energy' && (() => {
          const energyData = wells.filter(w=>w.energyConsumption>0).map(w=>{
            const se = specificEnergy(w)!;
            const dev = Math.round(((w.energyConsumption/w.designEnergy)-1)*100);
            return { name:w.name.replace('بئر ',''), w, se, dev,
              فعلي:w.energyConsumption, تصميمي:w.designEnergy };
          }).sort((a,b)=>b.dev-a.dev);

          const fieldEnergy = Array.from(fieldMap.entries()).map(([name,v])=>({
            name, طاقة:v.energy, إنتاج:v.production,
            نوعية: v.production>0?Math.round((v.energy/v.production)*100)/100:0,
          })).filter(d=>d.طاقة>0);

          const overConsuming = energyData.filter(d=>d.dev>10);

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:'إجمالي استهلاك الطاقة',  v:`${totalEnergy.toLocaleString()} كWh/يوم`,     c:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/20' },
                  { label:'الطاقة النوعية الكلية',  v:`${avgSpecificEnergy} كWh/م³`,                c:avgSpecificEnergy<0.6?'text-emerald-400':'text-orange-400', bg:'bg-yellow-500/10 border-yellow-500/20' },
                  { label:'آبار تستهلك فوق التصميمي', v:`${overConsuming.length} بئر`,             c:overConsuming.length>3?'text-red-400':'text-amber-400', bg:'bg-red-500/10 border-red-500/20' },
                  { label:'أعلى استهلاك نوعي',      v:energyData.length>0?`${energyData[0].se.toFixed(2)} كWh/م³`:'—', c:'text-red-400', bg:'bg-slate-800 border-slate-700' },
                ].map(k=>(
                  <div key={k.label} className={`bg-slate-900 border ${k.bg} rounded-xl p-3`}>
                    <p className="text-slate-500 text-[10px] mb-1">{k.label}</p>
                    <p className={`text-base font-bold ${k.c}`}>{k.v}</p>
                  </div>
                ))}
              </div>

              {/* Energy deviation chart */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-0.5">استهلاك الطاقة: فعلي مقابل تصميمي (كWh/يوم)</h3>
                <p className="text-slate-500 text-xs mb-3">الأعمدة الحمراء = استهلاك فوق التصميمي بأكثر من 10%</p>
                <div style={{minWidth:`${energyData.length*60}px`}}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={energyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                      <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:9}} angle={-30} textAnchor="end" height={50}/>
                      <YAxis tick={{fill:'#94a3b8',fontSize:10}} tickFormatter={(v:number)=>`${v}`}/>
                      <Tooltip contentStyle={TS} formatter={(v:number,n:string)=>[`${v} كWh/يوم`,n]}/>
                      <Legend iconSize={10} wrapperStyle={{fontSize:11}}/>
                      <Bar dataKey="تصميمي" fill="#1e3a5f" radius={[4,4,0,0]}/>
                      <Bar dataKey="فعلي" fill="#f59e0b" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Specific energy per field */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-0.5">الطاقة النوعية حسب الحقل (كWh/م³)</h3>
                <p className="text-slate-500 text-xs mb-3">الحقل الأكفأ = أقل طاقة لكل م³ منتج</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={fieldEnergy.sort((a,b)=>b.نوعية-a.نوعية)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false}/>
                    <XAxis type="number" tick={{fill:'#94a3b8',fontSize:9}} domain={[0,1.2]}/>
                    <YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} width={72}/>
                    <ReferenceLine x={0.6} stroke="#34d399" strokeDasharray="4 3" label={{value:'كفوء 0.6',fill:'#34d399',fontSize:9}}/>
                    <Tooltip contentStyle={TS} formatter={(v:number)=>[`${v} كWh/م³`]}/>
                    <Bar dataKey="نوعية" name="طاقة نوعية" fill="#f59e0b" radius={[0,4,4,0]}
                      label={{position:'right',fill:'#94a3b8',fontSize:9,formatter:(v:number)=>v>0?v.toFixed(2):''}}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Over-consuming wells */}
              {overConsuming.length>0 && (
                <div className="bg-slate-900 border border-amber-500/20 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400"/>
                    <h3 className="text-sm font-semibold text-white">آبار استهلاك الطاقة فوق التصميمي (+10%)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-slate-800 text-slate-400">
                        {['البئر','استهلاك فعلي','استهلاك تصميمي','الانحراف','طاقة نوعية','السبب المحتمل'].map(h=>(
                          <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800">
                        {overConsuming.map(d=>{
                          const cause = d.se>0.9?'ضعف كفاءة المضخة':d.w.waterLevel>d.w.designWaterLevel*1.3?'انخفاض منسوب المياه':d.w.efficiency<70?'انسداد أو تآكل':d.dev>30?'عطل في المحرك':'مراقبة مطلوبة';
                          return (
                            <tr key={d.w.id} className="hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-medium text-white">{d.w.name}</td>
                              <td className="px-4 py-3 font-mono text-amber-400 font-bold">{d.w.energyConsumption.toLocaleString()}</td>
                              <td className="px-4 py-3 font-mono text-slate-400">{d.w.designEnergy.toLocaleString()}</td>
                              <td className="px-4 py-3"><span className={`font-bold ${d.dev>30?'text-red-400':'text-amber-400'}`}>+{d.dev}%</span></td>
                              <td className="px-4 py-3 font-mono"><span className={d.se>0.8?'text-red-400':d.se>0.6?'text-amber-400':'text-emerald-400'}>{d.se.toFixed(2)} كWh/م³</span></td>
                              <td className="px-4 py-3 text-slate-400">{cause}</td>
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
        })()}

        {/* ══ TAB: EFFICIENCY ══ */}
        {tab === 'efficiency' && (() => {
          const effData = wells.filter(w=>w.efficiency>0&&w.designProduction>0).map(w=>({
            name: w.name.replace('بئر ',''),
            كفاءة: w.efficiency, تصميمية: 100, w,
          })).sort((a,b)=>a.كفاءة-b.كفاءة);

          const histogram = [
            { range:'< 60%',  count:wells.filter(w=>w.efficiency>0&&w.efficiency<60).length,  fill:'#ef4444' },
            { range:'60–74%', count:wells.filter(w=>w.efficiency>=60&&w.efficiency<75).length, fill:'#f59e0b' },
            { range:'75–89%', count:wells.filter(w=>w.efficiency>=75&&w.efficiency<90).length, fill:'#38bdf8' },
            { range:'90–99%', count:wells.filter(w=>w.efficiency>=90&&w.efficiency<100).length, fill:'#34d399' },
            { range:'≥ 100%', count:wells.filter(w=>w.efficiency>=100).length,               fill:'#a78bfa' },
          ];

          const activeEff = wells.filter(w=>w.efficiency>0);
          const sortedEff = [...activeEff].sort((a,b)=>a.efficiency-b.efficiency);
          const median = sortedEff.length>0?sortedEff[Math.floor(sortedEff.length/2)].efficiency:0;
          const stdev = activeEff.length>0?Math.round(Math.sqrt(activeEff.reduce((s,w)=>s+Math.pow(w.efficiency-avgEfficiency,2),0)/activeEff.length)):0;

          const ageBuckets = [
            { range:'0–5 سنوات',  wells:activeEff.filter(w=>w.operationalAge<=5) },
            { range:'6–10 سنوات', wells:activeEff.filter(w=>w.operationalAge>5&&w.operationalAge<=10) },
            { range:'11–15 سنة',  wells:activeEff.filter(w=>w.operationalAge>10&&w.operationalAge<=15) },
            { range:'> 15 سنة',  wells:activeEff.filter(w=>w.operationalAge>15) },
          ].map(b=>({
            range: b.range,
            متوسط: b.wells.length>0?Math.round(b.wells.reduce((s,w)=>s+w.efficiency,0)/b.wells.length):0,
            عدد: b.wells.length,
          }));

          return (
            <div className="space-y-4">
              {/* Stats strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:'متوسط الكفاءة',  v:`${avgEfficiency}%`, c:efficiencyColor(avgEfficiency) },
                  { label:'الوسيط',          v:`${median}%`,        c:efficiencyColor(median) },
                  { label:'الانحراف المعياري', v:`± ${stdev}%`,      c:'text-slate-300' },
                  { label:'فوق 100%',         v:`${wells.filter(w=>w.efficiency>100).length} بئر`, c:'text-violet-400' },
                ].map(k=>(
                  <div key={k.label} className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-center">
                    <p className="text-slate-500 text-[10px] mb-1">{k.label}</p>
                    <p className={`text-xl font-black ${k.c}`}>{k.v}</p>
                  </div>
                ))}
              </div>

              {/* Efficiency per well vs design */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-0.5">كفاءة كل بئر مقارنةً بالتصميمي (100%)</h3>
                <p className="text-slate-500 text-xs mb-3">مرتّب تصاعدياً · الأحمر = أقل من 75% · الأخضر = مطابق أو أعلى</p>
                <div style={{minWidth:`${effData.length*55}px`}}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={effData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                      <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:9}} angle={-30} textAnchor="end" height={50}/>
                      <YAxis tick={{fill:'#94a3b8',fontSize:10}} domain={[0,130]}/>
                      <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="5 3" label={{value:'تصميمي 100%',fill:'#22c55e',fontSize:9}}/>
                      <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="5 3" label={{value:'75%',fill:'#f59e0b',fontSize:9}}/>
                      <Tooltip contentStyle={TS} formatter={(v:number,n:string)=>[`${v}%`,n]}/>
                      <Bar dataKey="كفاءة" radius={[4,4,0,0]}
                        label={{position:'top',fill:'#94a3b8',fontSize:8,formatter:(v:number)=>v>0?`${v}%`:''}}
                        isAnimationActive={false}>
                        {effData.map((d,i)=>(
                          <rect key={i} fill={d.كفاءة>=100?'#a78bfa':d.كفاءة>=90?'#34d399':d.كفاءة>=75?'#38bdf8':d.كفاءة>=60?'#f59e0b':'#ef4444'}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Histogram */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">توزيع الكفاءة (عدد الآبار لكل فئة)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={histogram}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                      <XAxis dataKey="range" tick={{fill:'#94a3b8',fontSize:10}}/>
                      <YAxis allowDecimals={false} tick={{fill:'#94a3b8',fontSize:10}}/>
                      <Tooltip contentStyle={TS} formatter={(v:number)=>[`${v} بئر`]}/>
                      <Bar dataKey="count" name="عدد الآبار" radius={[4,4,0,0]} isAnimationActive={false}>
                        {histogram.map((h,i)=>(
                          <rect key={i} fill={h.fill}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Age vs efficiency */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">متوسط الكفاءة حسب العمر التشغيلي</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ageBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                      <XAxis dataKey="range" tick={{fill:'#94a3b8',fontSize:10}}/>
                      <YAxis tick={{fill:'#94a3b8',fontSize:10}} domain={[0,120]}/>
                      <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="5 3"/>
                      <Tooltip contentStyle={TS} formatter={(v:number,n:string)=>[`${v}${n==='متوسط'?'%':' بئر'}`,n]}/>
                      <Bar dataKey="متوسط" fill="#38bdf8" radius={[4,4,0,0]}
                        label={{position:'top',fill:'#94a3b8',fontSize:9,formatter:(v:number)=>v>0?`${v}%`:''}}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detail table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">جدول الكفاءة التفصيلي</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-800 text-slate-400">
                      {['البئر','الحقل','الكفاءة (%)','إنتاج فعلي','إنتاج تصميمي','العمر (سنة)','التدفق الفعلي','التدفق التصميمي','ساعات التشغيل','التقييم'].map(h=>(
                        <th key={h} className="text-right px-3 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {wells.filter(w=>w.status!=='inactive').sort((a,b)=>a.efficiency-b.efficiency).map(w=>(
                        <tr key={w.id} className="hover:bg-slate-800/40">
                          <td className="px-3 py-3 font-medium text-white whitespace-nowrap">{w.name}</td>
                          <td className="px-3 py-3 text-slate-400">{w.field}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 bg-slate-700 rounded-full">
                                <div className={`h-full rounded-full ${efficiencyColor(w.efficiency).replace('text-','bg-').replace('-400','-500')}`} style={{width:`${Math.min(w.efficiency,100)}%`}}/>
                              </div>
                              <span className={`font-bold ${efficiencyColor(w.efficiency)}`}>{w.efficiency}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono text-cyan-400">{w.production>0?w.production.toLocaleString():'—'}</td>
                          <td className="px-3 py-3 font-mono text-slate-400">{w.designProduction.toLocaleString()}</td>
                          <td className="px-3 py-3 text-slate-300">{w.operationalAge}</td>
                          <td className="px-3 py-3 font-mono text-slate-300">{w.flowRate}</td>
                          <td className="px-3 py-3 font-mono text-slate-400">{w.designFlowRate}</td>
                          <td className="px-3 py-3 text-slate-300">{w.operatingHours}/{w.designHours}</td>
                          <td className="px-3 py-3">{statusBadge(w.status).label && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(w.status).cls}`}>{statusBadge(w.status).label}</span>
                          )}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══ TAB: FAULTS ══ */}
        {tab === 'faults' && (() => {
          const allFaults = wells.flatMap(w=>w.faults.map(f=>({...f,well:w}))).sort((a,b)=>b.date.localeCompare(a.date));
          const mtbfData = wells.filter(w=>w.faults.length>0).map(w=>({
            name:w.name.replace('بئر ',''), mtbf:calcMTBF(w)!, count:w.faults.length, w,
          })).sort((a,b)=>a.mtbf-b.mtbf);
          const noFaults = wells.filter(w=>w.faults.length===0);

          const catCount: Record<string,number> = {};
          allFaults.forEach(f=>{ catCount[f.category]=(catCount[f.category]||0)+1; });
          const catData = Object.entries(catCount).map(([cat,count])=>({cat,count})).sort((a,b)=>b.count-a.count);

          const fieldFaultData = Array.from(fieldMap.keys()).map(field=>{
            const fw = wells.filter(w=>w.field===field);
            const faultCount = fw.reduce((s,w)=>s+w.faults.length,0);
            return { name:field, أعطال:faultCount };
          }).filter(d=>d.أعطال>0).sort((a,b)=>b.أعطال-a.أعطال);

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:'إجمالي الأعطال المسجّلة', v:`${allFaults.length}`,  c:'text-red-400',   bg:'bg-red-500/10 border-red-500/20' },
                  { label:'أعطال عالية الخطورة',     v:`${allFaults.filter(f=>f.severity==='high').length}`, c:'text-orange-400', bg:'bg-orange-500/10 border-orange-500/20' },
                  { label:'آبار بدون أعطال',         v:`${noFaults.length}`,   c:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/20' },
                  { label:'أقل MTBF (آبار حرجة)',   v:mtbfData.length>0?`${mtbfData[0].mtbf} شهر`:'—', c:'text-amber-400', bg:'bg-amber-500/10 border-amber-500/20' },
                ].map(k=>(
                  <div key={k.label} className={`bg-slate-900 border ${k.bg} rounded-xl p-3 text-center`}>
                    <p className="text-slate-500 text-[10px] mb-1">{k.label}</p>
                    <p className={`text-xl font-black ${k.c}`}>{k.v}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Category distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">توزيع الأعطال حسب الفئة</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={catData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false}/>
                      <XAxis type="number" allowDecimals={false} tick={{fill:'#94a3b8',fontSize:10}}/>
                      <YAxis type="category" dataKey="cat" tick={{fill:'#94a3b8',fontSize:10}} width={60}/>
                      <Tooltip contentStyle={TS} formatter={(v:number)=>[`${v} عطل`]}/>
                      <Bar dataKey="count" name="الأعطال" fill="#f87171" radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Field fault count */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">الأعطال حسب الحقل</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={fieldFaultData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false}/>
                      <XAxis type="number" allowDecimals={false} tick={{fill:'#94a3b8',fontSize:10}}/>
                      <YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:10}} width={72}/>
                      <Tooltip contentStyle={TS} formatter={(v:number)=>[`${v} عطل`]}/>
                      <Bar dataKey="أعطال" fill="#fb923c" radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MTBF table */}
              {mtbfData.length>0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-white">جدول MTBF — متوسط الفترة بين الأعطال</h3>
                    <p className="text-slate-500 text-xs mt-0.5">كلما ارتفع MTBF كانت الموثوقية أعلى · مرتّب تصاعدياً (الأسوأ أولاً)</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-slate-800 text-slate-400">
                        {['البئر','الحقل','عدد الأعطال','MTBF (شهر)','آخر عطل','فئة أكثر الأعطال','الموثوقية'].map(h=>(
                          <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800">
                        {mtbfData.map(({w,mtbf,count})=>{
                          const lastFault = w.faults.sort((a,b)=>b.date.localeCompare(a.date))[0];
                          const faultCats: Record<string,number> = {};
                          w.faults.forEach(f=>{ faultCats[f.category]=(faultCats[f.category]||0)+1; });
                          const topCat = Object.entries(faultCats).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
                          const reliability = mtbf>=24?'عالية':mtbf>=12?'متوسطة':'منخفضة';
                          const reliabilityC = mtbf>=24?'text-emerald-400 bg-emerald-500/10':mtbf>=12?'text-amber-400 bg-amber-500/10':'text-red-400 bg-red-500/10';
                          return (
                            <tr key={w.id} className="hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-medium text-white">{w.name}</td>
                              <td className="px-4 py-3 text-slate-400">{w.field}</td>
                              <td className="px-4 py-3 text-center font-bold text-red-400">{count}</td>
                              <td className="px-4 py-3 font-mono font-bold">
                                <span className={mtbf>=24?'text-emerald-400':mtbf>=12?'text-amber-400':'text-red-400'}>{mtbf}</span>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-400">{lastFault?.date||'—'}</td>
                              <td className="px-4 py-3 text-slate-300">{topCat}</td>
                              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reliabilityC}`}>{reliability}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No-fault wells */}
              {noFaults.length>0 && (
                <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4"/>آبار بدون أعطال مسجّلة ({noFaults.length} بئر)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {noFaults.map(w=>(
                      <span key={w.id} className="bg-emerald-500/10 text-emerald-300 text-xs px-3 py-1.5 rounded-full border border-emerald-500/20">{w.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fault timeline */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">الجدول الزمني للأعطال (أحدث أولاً)</h3>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
                  {allFaults.map((f,i)=>(
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${f.severity==='high'?'bg-red-500/20 text-red-300':f.severity==='medium'?'bg-amber-500/20 text-amber-300':'bg-blue-500/20 text-blue-300'}`}>{f.severity==='high'?'حرج':f.severity==='medium'?'متوسط':'منخفض'}</span>
                      <span className="font-mono text-[10px] text-slate-500 pt-0.5 shrink-0">{f.date}</span>
                      <span className="text-sm text-slate-200">{f.type}</span>
                      <span className="text-xs text-slate-500 mr-auto shrink-0">{f.well.name}</span>
                      <span className="text-xs text-violet-400 shrink-0">{f.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
        {tab === 'trends' && (() => {
          const well = wells.find(w => w.id === selectedWellId) || wells[0];
          const history = WELL_HISTORY.get(well.id) || [];
          const aggregated = aggregateRecords(history, periodGroup, well.designProduction);
          const forecast = forecastProduction(history, 6);
          const compData = compWellIds.map(id => {
            const w = wells.find(x => x.id === id)!;
            if (!w) return null;
            const recs = WELL_HISTORY.get(id) || [];
            const agg = aggregateRecords(recs, periodGroup, w.designProduction);
            return { well: w, agg };
          }).filter(Boolean) as Array<{ well: Well; agg: AggregatedRecord[] }>;

          // Build multi-well comparison chart data (by label)
          const allLabels = Array.from(new Set(compData.flatMap(d => d.agg.map(r => r.label)))).slice(-12);
          const multiChart = allLabels.map(label => {
            const point: Record<string, number | string> = { label };
            for (const cd of compData) {
              const rec = cd.agg.find(r => r.label === label);
              point[cd.well.name.replace('بئر ', '')] = rec ? rec.production : 0;
            }
            return point;
          });

          const WELL_COLORS = ['#38bdf8','#fb923c','#a78bfa','#34d399','#f472b6','#facc15'];

          const periodBtns: Array<{ key: PeriodGroup; label: string }> = [
            { key: 'monthly',    label: 'شهري' },
            { key: 'quarterly',  label: 'ربع سنوي' },
            { key: 'semiannual', label: 'نصف سنوي' },
            { key: 'annual',     label: 'سنوي' },
          ];

          // Year-on-year comparison (annual view)
          const annualComp = (() => {
            const byYear = new Map<number, number[]>();
            for (const r of history) {
              if (!byYear.has(r.year)) byYear.set(r.year, []);
              byYear.get(r.year)!.push(r.production);
            }
            return Array.from(byYear.entries())
              .sort((a,b) => a[0] - b[0])
              .map(([year, vals]) => ({
                year: String(year),
                avg: Math.round(vals.reduce((s,v) => s+v,0) / vals.length),
                total: vals.reduce((s,v) => s+v,0),
                months: vals.length,
              }));
          })();

          return (
            <div className="space-y-5">

              {/* ── Controls ── */}
              <div className="flex flex-wrap gap-3 items-center bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                {/* Period group */}
                <div className="flex gap-1">
                  {periodBtns.map(b => (
                    <button key={b.key} onClick={() => setPeriodGroup(b.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        periodGroup === b.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                      {b.label}
                    </button>
                  ))}
                </div>
                {/* Well selector */}
                <select value={selectedWellId} onChange={e => setSelectedWellId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5">
                  {wells.map(w => <option key={w.id} value={w.id}>{w.name} — {w.field}</option>)}
                </select>
                <span className="text-xs text-slate-500">البيانات: 5 سنوات ({history.length} شهر)</span>
              </div>

              {/* ── Production Time-Series ── */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">{well.name} — منحنى الإنتاج</h3>
                    <p className="text-xs text-slate-500 mt-0.5">التغيير عبر الفترة المحددة · م³/يوم</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />الإنتاج الفعلي</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-500 border border-dashed border-slate-400 inline-block" />التصميمي: {well.designProduction} م³</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={aggregated} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <defs>
                      <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={periodGroup === 'monthly' ? 2 : 0} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#94a3b8' }} />
                    <ReferenceLine y={well.designProduction} stroke="#475569" strokeDasharray="6 3" label={{ value: 'تصميمي', fill: '#64748b', fontSize: 10 }} />
                    <Area type="monotone" dataKey="production" name="إنتاج م³/يوم" stroke="#38bdf8" fill="url(#prodGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* ── Two charts row: Efficiency + Water Level ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-white mb-3">كفاءة الإنتاج % (مقارنة بالتصميمي)</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={aggregated} margin={{ top: 2, right: 5, bottom: 2, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} interval={periodGroup === 'monthly' ? 2 : 0} />
                      <YAxis domain={[0, 130]} tick={{ fontSize: 9, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
                      <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="4 2" />
                      <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="efficiency" name="الكفاءة %" stroke="#a78bfa" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-white mb-3">منسوب المياه (م) — الانخفاض تحذير</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={aggregated} margin={{ top: 2, right: 5, bottom: 2, left: 5 }}>
                      <defs>
                        <linearGradient id="wlGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#fb923c" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} interval={periodGroup === 'monthly' ? 2 : 0} />
                      <YAxis reversed tick={{ fontSize: 9, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
                      <Area type="monotone" dataKey="waterLevel" name="العمق م" stroke="#fb923c" fill="url(#wlGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── Forecast Chart ── */}
              <div className="bg-slate-900 border border-violet-500/30 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                      تنبؤ الإنتاج — الـ 6 أشهر القادمة
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">يعتمد على الانحدار الخطي للـ 12 شهر الماضية</p>
                  </div>
                  <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-1 rounded-full">تحليل اتجاه</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={forecast} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      formatter={(val: number, _name: string, props: { payload: { isForecast: boolean } }) => [
                        `${val} م³/يوم`, props.payload.isForecast ? 'تنبؤ' : 'فعلي'
                      ]} />
                    <ReferenceLine x={forecast.find(f => f.isForecast)?.label} stroke="#7c3aed" strokeDasharray="6 3"
                      label={{ value: 'التنبؤ', fill: '#a78bfa', fontSize: 10 }} />
                    <Line type="monotone" dataKey="production" stroke="#a78bfa" strokeWidth={2.5}
                      dot={(props: { cx: number; cy: number; payload: { isForecast: boolean } }) =>
                        props.payload.isForecast
                          ? <circle key={`${props.cx}-${props.cy}`} cx={props.cx} cy={props.cy} r={4} fill="#7c3aed" stroke="#a78bfa" strokeWidth={2} />
                          : <circle key={`${props.cx}-${props.cy}`} cx={props.cx} cy={props.cy} r={3} fill="#38bdf8" stroke="none" />
                      }
                    />
                  </LineChart>
                </ResponsiveContainer>
                {/* Forecast summary */}
                <div className="grid grid-cols-3 gap-3 mt-4 border-t border-slate-800 pt-4">
                  {forecast.filter(f => f.isForecast).slice(0, 3).map(f => (
                    <div key={f.label} className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3 text-center">
                      <div className="text-[10px] text-violet-400 mb-1">{f.label}</div>
                      <div className="text-lg font-bold text-white">{f.production.toLocaleString('ar')}</div>
                      <div className="text-[10px] text-slate-500">م³/يوم</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Multi-Well Comparison ── */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="text-sm font-bold text-white">مقارنة متعددة الآبار</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {wells.slice(0, 8).map((w, idx) => (
                      <button key={w.id}
                        onClick={() => setCompWellIds(prev =>
                          prev.includes(w.id) ? prev.filter(id => id !== w.id) : [...prev, w.id]
                        )}
                        className={`text-[11px] px-2.5 py-1 rounded-lg transition-all border ${
                          compWellIds.includes(w.id)
                            ? 'border-transparent text-white'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        style={compWellIds.includes(w.id) ? { background: WELL_COLORS[idx % WELL_COLORS.length] + '33', borderColor: WELL_COLORS[idx % WELL_COLORS.length] + '80', color: WELL_COLORS[idx % WELL_COLORS.length] } : {}}
                      >
                        {w.name.replace('بئر ', '')}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={multiChart} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} interval={periodGroup === 'monthly' ? 2 : 0} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {compData.map((cd, idx) => (
                      <Line key={cd.well.id} type="monotone"
                        dataKey={cd.well.name.replace('بئر ', '')}
                        stroke={WELL_COLORS[idx % WELL_COLORS.length]}
                        strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* ── Year-on-Year Comparison Table ── */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">المقارنة السنوية — {well.name}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {['السنة','متوسط الإنتاج اليومي','إجمالي الأشهر المرصودة','الكفاءة vs التصميمي','التغيير YoY'].map(h => (
                          <th key={h} className="text-right pb-2 px-3 text-slate-400 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {annualComp.map((row, idx) => {
                        const prev = annualComp[idx - 1];
                        const change = prev ? Math.round(((row.avg - prev.avg) / prev.avg) * 100) : null;
                        const eff = Math.round((row.avg / well.designProduction) * 100);
                        return (
                          <tr key={row.year} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all">
                            <td className="py-2.5 px-3 font-bold text-white">{row.year}</td>
                            <td className="py-2.5 px-3 text-cyan-300 font-mono">{row.avg.toLocaleString('ar')} م³</td>
                            <td className="py-2.5 px-3 text-slate-400">{row.months} شهر</td>
                            <td className="py-2.5 px-3">
                              <span className={`font-bold ${eff >= 90 ? 'text-emerald-400' : eff >= 75 ? 'text-amber-400' : 'text-red-400'}`}>{eff}%</span>
                            </td>
                            <td className="py-2.5 px-3">
                              {change === null ? <span className="text-slate-600">—</span> : (
                                <span className={`flex items-center gap-1 font-bold ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          );
        })()}

        {tab === 'critical' && (
          <div className="space-y-4">
            {/* Priority list */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-200">قائمة الأولويات — الآبار التي تستلزم تدخلاً عاجلاً</h3>
              </div>
              {(() => {
                // Score wells by number of critical issues and operational age
                const scored = wells.filter(w => w.status !== 'active' || issues.filter(i => i.well.id === w.id).length > 0)
                  .map(w => {
                    const wIssues = issues.filter(i => i.well.id === w.id);
                    const critCount = wIssues.filter(i => i.severity === 'critical').length;
                    const warnCount = wIssues.filter(i => i.severity === 'warning').length;
                    const score = critCount * 10 + warnCount * 3 + (w.status === 'critical' ? 20 : 0) + (w.status === 'maintenance' ? 10 : 0) + (w.status === 'inactive' ? 5 : 0) + Math.min(w.faults.length * 2, 10);
                    const failPct = Math.min(score * 2, 95);
                    return { w, score, critCount, warnCount, failPct };
                  })
                  .sort((a, b) => b.score - a.score);

                return (
                  <div className="divide-y divide-slate-800">
                    {scored.map(({ w, score, critCount, warnCount, failPct }, idx) => {
                      const badge = statusBadge(w.status);
                      const recs = [
                        critCount > 0 ? 'فحص ميداني عاجل' : null,
                        w.energyConsumption > w.designEnergy * 1.2 ? 'فحص المضخة والمحرك' : null,
                        w.tds > w.tdsLimit * 0.9 ? 'أخذ عينات مياه وتحليل معملي' : null,
                        w.waterLevel > w.designWaterLevel * 1.4 ? 'دراسة منسوب الطبقة الجوفية' : null,
                        w.operationalAge > 15 ? 'تقييم إعادة التأهيل أو إعادة الحفر' : null,
                        w.faults.length >= 3 ? 'مراجعة سجل الأعطال والصيانة الشاملة' : null,
                        w.status === 'inactive' ? 'قرار إعادة التفعيل أو الإغلاق' : null,
                      ].filter(Boolean);

                      return (
                        <div key={w.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                idx === 0 ? 'bg-red-500 text-white' : idx < 3 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300'
                              }`}>
                                {idx + 1}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm">{w.name}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>{badge.label}</span>
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">{w.field} · العمر: {w.operationalAge} سنة · آخر صيانة: {w.lastMaintenance}</div>
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              <div className="text-xs text-slate-500">احتمالية العطل</div>
                              <div className={`text-lg font-bold ${failPct > 70 ? 'text-red-400' : failPct > 40 ? 'text-amber-400' : 'text-slate-300'}`}>{failPct}%</div>
                            </div>
                          </div>

                          {/* issues summary */}
                          <div className="flex gap-3 mt-3 text-xs">
                            {critCount > 0 && <span className="bg-red-500/20 text-red-300 border border-red-500/30 rounded-full px-2 py-0.5">{critCount} حرجة</span>}
                            {warnCount > 0 && <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5">{warnCount} تحذير</span>}
                            <span className="text-slate-500">{w.faults.length} عطل مسجل</span>
                          </div>

                          {/* recommendations */}
                          {recs.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <div className="text-xs text-slate-500 font-medium">التوصيات:</div>
                              {recs.map((r, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300">
                                  <Shield className="w-3 h-3 text-blue-400 shrink-0" />
                                  {r}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {scored.length === 0 && (
                      <div className="p-8 text-center text-slate-500">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                        لا توجد آبار تستلزم تدخلاً عاجلاً
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: COMPARISON ══════════════════ */}

      </div>
    </div>
  );
}
