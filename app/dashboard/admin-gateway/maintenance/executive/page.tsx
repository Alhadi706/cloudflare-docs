'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  ArrowRight, TrendingDown, TrendingUp, AlertTriangle, Crown,
  Zap, Droplets, Target, Activity, Shield, BarChart2,
  RefreshCw, AlertCircle, ArrowUpRight, CheckCircle2, FileText,
  Server, Cpu, Bell, Database, Mail,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedReport {
  id: number; filename: string; report_date: string;
  total_production: number; total_consumption: number;
  nrw_percent: number; anomaly_critical: number; anomaly_warning: number;
  created_at: string;
}

type RecordQualityLevel = 'clean' | 'warning' | 'critical';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type ExecTab =
  | 'overview' | 'health' | 'kpis' | 'risks'
  | 'assets' | 'water' | 'demand' | 'alerts'
  | 'infrastructure' | 'performance' | 'correspondence';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeHealthScore(r: SavedReport): number {
  let score = 100;
  const nrw = Number(r.nrw_percent);
  if (nrw > 30) score -= 35; else if (nrw > 25) score -= 25;
  else if (nrw > 20) score -= 15; else if (nrw > 15) score -= 8;
  if (r.anomaly_critical > 0) score -= Math.min(r.anomaly_critical * 12, 36);
  if (r.anomaly_warning > 3) score -= 10; else if (r.anomaly_warning > 0) score -= 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}
function computeRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'low'; if (score >= 60) return 'medium';
  if (score >= 40) return 'high'; return 'critical';
}
function calcTrend(arr: SavedReport[], key: keyof SavedReport): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (arr.length < 2) return { pct: 0, dir: 'flat' };
  const latest = Number(arr[0][key]); const prev = Number(arr[1][key]);
  if (prev === 0) return { pct: 0, dir: 'flat' };
  const pct = ((latest - prev) / prev) * 100;
  return { pct: Math.abs(pct), dir: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
}
function generateRecommendations(r: SavedReport): { priority: 'high' | 'medium' | 'low'; text: string; link: string }[] {
  const recs: { priority: 'high' | 'medium' | 'low'; text: string; link: string }[] = [];
  const nrw = Number(r.nrw_percent);
  if (nrw > 25) recs.push({ priority: 'high', text: 'إجراء تحقيق فوري لتحديد مصادر الفاقد — نسبة الفاقد تتجاوز الحد الحرج (25%).', link: '/dashboard/admin-gateway/maintenance/preventive' });
  else if (nrw > 15) recs.push({ priority: 'medium', text: 'مراجعة شبكة التوزيع واستهداف المناطق الأعلى فاقداً للوصول إلى ما دون 15%.', link: '/dashboard/admin-gateway/maintenance/preventive' });
  if (r.anomaly_critical > 0) recs.push({ priority: 'high', text: `${r.anomaly_critical} انحراف حرج يستوجب التدخل الفوري من فريق الدعم الفني.`, link: '/dashboard/admin-gateway/maintenance/fault-analysis' });
  if (r.anomaly_warning > 2) recs.push({ priority: 'medium', text: `${r.anomaly_warning} تحذيرات تشغيلية — جدولة صيانة وقائية خلال هذا الأسبوع.`, link: '/dashboard/admin-gateway/maintenance/preventive' });
  const prod = Number(r.total_production); const cons = Number(r.total_consumption);
  if (prod > 0 && cons / prod < 0.7) recs.push({ priority: 'medium', text: 'تغطية الطلب منخفضة — مراجعة توزيع الطاقة الإنتاجية بين المحطات.', link: '/dashboard/admin-gateway/maintenance/control-center' });
  if (recs.length === 0) recs.push({ priority: 'low', text: 'المنظومة تعمل بشكل مرضٍ — الاستمرار في متابعة المؤشرات الأسبوعية.', link: '/dashboard/admin-gateway/maintenance/preventive' });
  return recs.slice(0, 4);
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

// ─── Risk colour map ──────────────────────────────────────────────────────────

const RC: Record<RiskLevel, { text: string; bg: string; border: string; label: string; dot: string }> = {
  low:      { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', label: 'منخفض', dot: 'bg-emerald-400' },
  medium:   { text: 'text-yellow-400',  bg: 'bg-yellow-500/20',  border: 'border-yellow-500/30',  label: 'متوسط', dot: 'bg-yellow-400'  },
  high:     { text: 'text-orange-400',  bg: 'bg-orange-500/20',  border: 'border-orange-500/30',  label: 'مرتفع', dot: 'bg-orange-400'  },
  critical: { text: 'text-red-400',     bg: 'bg-red-500/20',     border: 'border-red-500/30',     label: 'حرج',   dot: 'bg-red-400'     },
};

// ─── Health Gauge ─────────────────────────────────────────────────────────────

function HealthGauge({ score, level, size = 'md' }: { score: number; level: RiskLevel; size?: 'sm' | 'md' }) {
  const r = size === 'sm' ? 28 : 38; const dim = size === 'sm' ? 80 : 112;
  const circ = 2 * Math.PI * r;
  const stroke = level === 'low' ? '#34d399' : level === 'medium' ? '#facc15' : level === 'high' ? '#fb923c' : '#f87171';
  const labels: Record<RiskLevel, string> = { low: 'ممتازة', medium: 'جيدة', high: 'مراجعة', critical: 'حرجة' };
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`${size === 'sm' ? 'text-xl' : 'text-3xl'} font-bold ${RC[level].text}`}>{score}</span>
          <span className="text-slate-500 text-[10px]">/100</span>
        </div>
      </div>
      <p className={`${size === 'sm' ? 'text-sm' : 'text-lg'} font-bold mt-1 ${RC[level].text}`}>{labels[level]}</p>
      <p className="text-slate-500 text-xs">صحة المنظومة</p>
    </div>
  );
}

// ─── Demo data (بيانات تجريبية) ───────────────────────────────────────────────

const DEMO_STATIONS = [
  { id: 'S1', name: 'محطة نجع جهمة', status: 'normal'   as const, pumps: 4, active: 4, flow: 8200,  design: 9100,  bar: 5.8 },
  { id: 'S2', name: 'محطة العجيلات', status: 'warning'  as const, pumps: 4, active: 3, flow: 6900,  design: 6900,  bar: 6.2 },
  { id: 'S3', name: 'محطة مصراتة',   status: 'critical' as const, pumps: 3, active: 2, flow: 3800,  design: 6000,  bar: 4.2 },
  { id: 'S4', name: 'محطة طرابلس',   status: 'normal'   as const, pumps: 6, active: 6, flow: 22000, design: 24000, bar: 5.5 },
  { id: 'S5', name: 'محطة غريان',    status: 'normal'   as const, pumps: 3, active: 3, flow: 4400,  design: 5000,  bar: 5.0 },
];
const DEMO_TANKS = [
  { id: 'T1', name: 'خزان الجنوب الرئيسي', cap: 50000, level: 38000, status: 'normal'   as const },
  { id: 'T2', name: 'خزان طرابلس الشرقي',  cap: 80000, level: 28000, status: 'warning'  as const },
  { id: 'T3', name: 'خزان مصراتة',          cap: 30000, level: 7500,  status: 'critical' as const },
  { id: 'T4', name: 'خزان غريان الجبلي',    cap: 40000, level: 34000, status: 'normal'   as const },
  { id: 'T5', name: 'خزان زليتن',            cap: 20000, level: 14000, status: 'normal'   as const },
];
const DEMO_ASSETS = [
  { id: 'A1', name: 'مضخة مصراتة P-3',     type: 'مضخة رئيسية',   loc: 'محطة مصراتة',       health: 28, last: '2026-03-25', action: 'استبدال فوري' },
  { id: 'A2', name: 'لوحة MCC نجع جهمة-1', type: 'تحكم كهربائي', loc: 'محطة نجع جهمة',     health: 42, last: '2026-01-12', action: 'فحص وصيانة'   },
  { id: 'A3', name: 'خزان طرابلس الشرقي',  type: 'خزان تخزين',   loc: 'طرابلس',             health: 35, last: '2026-02-28', action: 'مراقبة مستوى' },
  { id: 'A4', name: 'خط P-3 مصراتة',        type: 'خط أنابيب',    loc: 'خط مصراتة الرئيسي', health: 51, last: '2025-11-14', action: 'فحص ميداني'   },
  { id: 'A5', name: 'مضخة العجيلات P-2',    type: 'مضخة ثانوية',  loc: 'محطة العجيلات',     health: 55, last: '2026-04-10', action: 'متابعة'         },
];
const DEMO_ZONES = [
  { zone: 'طرابلس',   cons: 415000, demand: 430000, cov: 96.5, status: 'warning'  as const },
  { zone: 'مصراتة',   cons: 88000,  demand: 120000, cov: 73.3, status: 'critical' as const },
  { zone: 'غريان',    cons: 108000, demand: 115200, cov: 93.8, status: 'normal'   as const },
  { zone: 'بني وليد', cons: 37000,  demand: 40000,  cov: 92.5, status: 'normal'   as const },
  { zone: 'زليتن',    cons: 28000,  demand: 30000,  cov: 93.3, status: 'normal'   as const },
  { zone: 'الخمس',    cons: 19500,  demand: 20000,  cov: 97.5, status: 'normal'   as const },
  { zone: 'ترهونة',   cons: 18500,  demand: 20000,  cov: 92.5, status: 'normal'   as const },
  { zone: 'الشروق',   cons: 19000,  demand: 20000,  cov: 95.0, status: 'normal'   as const },
];
const DEMO_ALERTS = [
  { id: 'EA1', time: '07:22', sev: 'critical' as const, mod: 'التشغيل',      msg: 'انخفاض التدفق في خط مصراتة إلى 63% من التصميمي', ack: false },
  { id: 'EA2', time: '07:30', sev: 'critical' as const, mod: 'الأعطال',      msg: 'توقف المضخة رقم 3 — لوحة تحكم مصراتة', ack: false },
  { id: 'EA3', time: '08:45', sev: 'critical' as const, mod: 'الخزانات',     msg: 'منسوب خزان مصراتة 25% — خطر انقطاع الخدمة', ack: false },
  { id: 'EA4', time: '08:15', sev: 'warning'  as const, mod: 'الخزانات',     msg: 'خزان طرابلس الشرقي في هبوط — 35% وتراجع 1.5%/ساعة', ack: false },
  { id: 'EA5', time: '09:45', sev: 'warning'  as const, mod: 'جودة المياه',  msg: 'ارتفاع طفيف في العكارة 2.1 NTU — مراقبة مطلوبة', ack: true },
  { id: 'EA6', time: '06:00', sev: 'info'     as const, mod: 'الآبار',       msg: 'جميع آبار نجع جهمة تعمل بكفاءة 94%', ack: true },
];

function DemoBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl p-3">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      <p className="text-amber-300 text-xs">{text}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExecutiveDashboardPage() {
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab, setTab] = useState<ExecTab>('overview');

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/v1/ops-reports', { cache: 'no-store' });
      if (res.ok) { const data = await res.json(); setHistory(Array.isArray(data) ? data : []); }
      else setError('فشل تحميل البيانات من قاعدة البيانات.');
    } catch { setError('خطأ في الاتصال بالخادم.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const latest      = history[0] ?? null;
  const healthScore = latest ? computeHealthScore(latest) : 72;
  const riskLevel   = computeRiskLevel(healthScore);
  const latestQuality = latest ? assessSavedReportQuality(latest) : null;
  const recs        = latest ? generateRecommendations(latest) : [];
  const prodTrend   = calcTrend(history, 'total_production');
  const nrwTrend    = calcTrend(history, 'nrw_percent');

  const trendData = [...history].slice(0, 14).reverse().map(r => ({
    date: r.report_date.slice(5),
    إنتاج:    Math.round(Number(r.total_production)),
    استهلاك:  Math.round(Number(r.total_consumption)),
    'فاقد %': Math.round(Number(r.nrw_percent) * 10) / 10,
    صحة:      computeHealthScore(r),
  }));

  const TABS: { key: ExecTab; label: string; Icon: React.ElementType; alert?: boolean }[] = [
    { key: 'overview',        label: 'نظرة عامة',           Icon: Activity },
    { key: 'health',          label: 'صحة المنظومة',         Icon: Shield },
    { key: 'kpis',            label: 'مؤشرات KPI',           Icon: BarChart2 },
    { key: 'risks',           label: 'مراقبة المخاطر',       Icon: AlertTriangle,
      alert: latest !== null && (Number(latest.nrw_percent) > 25 || latest.anomaly_critical > 0) },
    { key: 'assets',          label: 'الأصول الحرجة',        Icon: Cpu },
    { key: 'water',           label: 'توازن المياه',          Icon: Droplets },
    { key: 'demand',          label: 'الطلب والاستهلاك',     Icon: Target },
    { key: 'alerts',          label: 'التنبيهات التنفيذية',  Icon: Bell,
      alert: DEMO_ALERTS.filter(a => !a.ack && a.sev === 'critical').length > 0 },
    { key: 'infrastructure',  label: 'البنية التحتية',       Icon: Server },
    { key: 'performance',     label: 'الأداء التشغيلي',      Icon: Zap },
    { key: 'correspondence',   label: 'المراسلات الداخلية',   Icon: Mail },
  ];

  const TS = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', direction: 'rtl' as const };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-5" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard/admin-gateway/maintenance" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-3 transition-colors">
              <ArrowRight className="w-4 h-4" /> إدارة الهندسة والدعم الفني
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500/30 to-amber-500/20 flex items-center justify-center ring-1 ring-rose-500/30">
                <Crown className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">مركز القيادة التنفيذية</h1>
                <p className="text-slate-400 text-xs mt-0.5">رؤية استراتيجية شاملة — مدير الإدارة</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-auto">
            <span className="text-xs text-slate-500">{new Date().toLocaleDateString('ar-LY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <button onClick={loadData} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>
          </div>
        </div>

        {/* Status strip */}
        <div className={`rounded-xl px-4 py-2.5 border ${RC[riskLevel].border} ${RC[riskLevel].bg} flex items-center gap-3 flex-wrap text-xs`}>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full animate-pulse ${RC[riskLevel].dot}`} />
            <span className={`font-bold ${RC[riskLevel].text}`}>مستوى المخاطر: {RC[riskLevel].label}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 flex-wrap">
            <span>الصحة: <strong className={RC[riskLevel].text}>{healthScore}/100</strong></span>
            {latest && <>
              <span>NRW: <strong className={Number(latest.nrw_percent) > 25 ? 'text-red-400' : 'text-yellow-400'}>{Number(latest.nrw_percent).toFixed(1)}%</strong></span>
              <span>
                جودة البيانات:
                {' '}
                <strong
                  className={
                    latestQuality?.level === 'critical'
                      ? 'text-red-400'
                      : latestQuality?.level === 'warning'
                      ? 'text-yellow-400'
                      : 'text-emerald-400'
                  }
                  title={latestQuality?.issues?.join(' | ') || 'لا توجد ملاحظات'}
                >
                  {latestQuality?.level === 'critical' ? 'حرج' : latestQuality?.level === 'warning' ? 'تحذير' : 'سليم'}
                </strong>
              </span>
              <span>تنبيهات حرجة: <strong className={latest.anomaly_critical > 0 ? 'text-red-400' : 'text-emerald-400'}>{latest.anomaly_critical}</strong></span>
              <span>آخر تقرير: <strong className="text-slate-300">{latest.report_date}</strong></span>
            </>}
            {!latest && !loading && <span className="text-slate-500">لا توجد تقارير محفوظة</span>}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="overflow-x-auto">
          <div className="flex gap-1 bg-slate-900 rounded-xl p-1 min-w-max">
            {TABS.map(({ key, label, Icon, alert }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${tab === key ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
                {alert && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-slate-900" />}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="flex items-center justify-center py-20"><RefreshCw className="w-7 h-7 text-rose-400 animate-spin" /><span className="mr-3 text-slate-400">جاري التحميل...</span></div>}
        {!loading && error && (
          <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" /><p className="text-red-300">{error}</p>
            <button onClick={loadData} className="mr-auto text-xs text-red-400 hover:text-red-200 underline">إعادة المحاولة</button>
          </div>
        )}

        {/* ═══ TAB: نظرة عامة ═══════════════════════════════════════════════ */}
        {!loading && tab === 'overview' && (
          <div className="space-y-5">
            <div className={`rounded-2xl p-5 border ${RC[riskLevel].border} ${RC[riskLevel].bg}`}>
              <div className="flex flex-wrap items-center gap-6">
                <HealthGauge score={healthScore} level={riskLevel} />
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {([
                    { label: 'الإنتاج اليومي',       v: latest ? Math.round(Number(latest.total_production)).toLocaleString('ar') : '—',                                                        u: 'م³/يوم', c: 'text-indigo-300', tr: prodTrend as { pct: number; dir: 'up' | 'down' | 'flat' } | null, inv: false },
                    { label: 'الاستهلاك الفعلي',      v: latest ? Math.round(Number(latest.total_consumption)).toLocaleString('ar') : '—',                                                       u: 'م³/يوم', c: 'text-cyan-300',   tr: null,       inv: false },
                    { label: 'نسبة الفاقد (NRW)',     v: latest ? `${Number(latest.nrw_percent).toFixed(1)}%` : '—',                                                                              u: '',       c: latest && Number(latest.nrw_percent) > 25 ? 'text-red-400' : 'text-yellow-400', tr: nrwTrend as { pct: number; dir: 'up' | 'down' | 'flat' } | null, inv: true },
                    { label: 'الفاقد المطلق',          v: latest ? Math.round(Number(latest.total_production) - Number(latest.total_consumption)).toLocaleString('ar') : '—',                     u: 'م³/يوم', c: 'text-amber-400', tr: null,       inv: false },
                    { label: 'تنبيهات حرجة',           v: latest ? `${latest.anomaly_critical}` : '0',                                                                                            u: 'تنبيه',  c: latest && latest.anomaly_critical > 0 ? 'text-red-400' : 'text-emerald-400', tr: null, inv: false },
                    { label: 'تغطية الطلب',             v: latest && Number(latest.total_production) > 0 ? `${Math.round(Number(latest.total_consumption) / Number(latest.total_production) * 100)}%` : '—', u: '', c: 'text-violet-400', tr: null, inv: false },
                  ] as { label: string; v: string; u: string; c: string; tr: { pct: number; dir: 'up' | 'down' | 'flat' } | null; inv: boolean }[]).map(k => (
                    <div key={k.label} className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                      <p className="text-slate-500 text-xs mb-1">{k.label}</p>
                      <p className={`font-bold text-base leading-none ${k.c}`}>{k.v} <span className="text-xs font-normal text-slate-500">{k.u}</span></p>
                      {k.tr && k.tr.dir !== 'flat' && (
                        <span className={`inline-flex items-center gap-0.5 text-xs mt-1 ${k.inv ? (k.tr.dir === 'up' ? 'text-red-400' : 'text-emerald-400') : (k.tr.dir === 'up' ? 'text-emerald-400' : 'text-red-400')}`}>
                          {k.tr.dir === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{k.tr.pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className={`shrink-0 flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl ${RC[riskLevel].bg} border ${RC[riskLevel].border}`}>
                  <Shield className={`w-6 h-6 ${RC[riskLevel].text}`} />
                  <span className="text-xs text-slate-400">مستوى المخاطر</span>
                  <span className={`text-2xl font-black ${RC[riskLevel].text}`}>{RC[riskLevel].label}</span>
                </div>
              </div>
            </div>
            {trendData.length > 1 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-white font-semibold text-sm mb-0.5">اتجاه الإنتاج والاستهلاك</h3>
                  <p className="text-slate-500 text-xs mb-3">آخر {trendData.length} تقارير (م³/يوم)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 9 }} />
                      <YAxis stroke="#475569" tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                      <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [`${v.toLocaleString()} م³`, n]} />
                      <Legend />
                      <Line type="monotone" dataKey="إنتاج"   stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="استهلاك" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-white font-semibold text-sm mb-0.5">اتجاه الفاقد المائي (NRW %)</h3>
                  <p className="text-slate-500 text-xs mb-3">الأحمر 25% حرج · الأصفر 15% هدف</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 9 }} />
                      <YAxis stroke="#475569" tick={{ fontSize: 9 }} unit="%" domain={[0, 'auto']} />
                      <ReferenceLine y={25} stroke="#f87171" strokeDasharray="4 3" strokeWidth={1} />
                      <ReferenceLine y={15} stroke="#facc15" strokeDasharray="4 3" strokeWidth={1} />
                      <Tooltip contentStyle={TS} formatter={(v: number) => [`${v.toFixed(1)}%`, 'الفاقد']} />
                      <Line type="monotone" dataKey="فاقد %" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
                <BarChart2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">ارفع تقارير التشغيل من صفحة مراقبة التشغيل لعرض الرسوم البيانية</p>
                <Link href="/dashboard/admin-gateway/maintenance/preventive" className="inline-flex items-center gap-1 mt-3 text-xs text-violet-400 hover:text-violet-300">
                  انتقل لمراقبة التشغيل <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm"><Target className="w-4 h-4 text-rose-400" /> التوصيات الاستراتيجية</h3>
                <div className="space-y-2.5">
                  {recs.map((rec, i) => (
                    <div key={i} className={`flex gap-2.5 p-2.5 rounded-xl ${rec.priority === 'high' ? 'bg-red-900/20 border border-red-700/30' : rec.priority === 'medium' ? 'bg-yellow-900/20 border border-yellow-700/30' : 'bg-emerald-900/20 border border-emerald-700/30'}`}>
                      <span className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full h-fit mt-0.5 ${rec.priority === 'high' ? 'bg-red-900/60 text-red-300' : rec.priority === 'medium' ? 'bg-yellow-900/60 text-yellow-300' : 'bg-emerald-900/60 text-emerald-300'}`}>
                        {rec.priority === 'high' ? 'عاجل' : rec.priority === 'medium' ? 'مهم' : 'متابعة'}
                      </span>
                      <div className="flex-1">
                        <p className="text-slate-300 text-xs leading-relaxed">{rec.text}</p>
                        <Link href={rec.link} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5 mt-1">فتح الوحدة المعنية <ArrowUpRight className="w-2.5 h-2.5" /></Link>
                      </div>
                    </div>
                  ))}
                  {recs.length === 0 && <p className="text-slate-500 text-sm text-center py-4">ارفع تقرير تشغيل لعرض التوصيات</p>}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium px-1">الوصول السريع</p>
                {[
                  { href: '/dashboard/admin-gateway/maintenance/preventive',    label: 'مراقبة التشغيل',     sub: 'تحليل يومي تفصيلي',   color: 'border-violet-500/30 hover:border-violet-500/60' },
                  { href: '/dashboard/admin-gateway/maintenance/wells',         label: 'مراقبة الآبار',      sub: 'قراءات وحالة الآبار', color: 'border-blue-500/30 hover:border-blue-500/60'    },
                  { href: '/dashboard/admin-gateway/maintenance/fault-analysis',label: 'منصة التحليل الفني', sub: 'تشخيص الأعطال',       color: 'border-rose-500/30 hover:border-rose-500/60'    },
                  { href: '/dashboard/admin-gateway/maintenance/technical',     label: 'تخطيط الصيانة',      sub: 'الجدولة والأولويات',  color: 'border-amber-500/30 hover:border-amber-500/60'  },
                ].map(({ href, label, sub, color }) => (
                  <Link key={href} href={href} className={`bg-slate-900 border ${color} rounded-xl p-2.5 flex items-center gap-2.5 transition-colors group`}>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 shrink-0" />
                    <div><p className="text-white text-sm font-medium leading-none">{label}</p><p className="text-slate-500 text-xs mt-0.5">{sub}</p></div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: صحة المنظومة ════════════════════════════════════════════ */}
        {!loading && tab === 'health' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {([
                { label: 'شبكة الآبار',  Icon: Droplets, score: Math.min(100, healthScore + 8),  note: '15 بئر — 12 نشط' },
                { label: 'محطات الضخ',   Icon: Zap,      score: Math.min(100, healthScore - 5),  note: '5 محطات — 1 حرج'  },
                { label: 'شبكة التوزيع', Icon: Activity, score: Math.min(100, healthScore + 2),  note: '8 خطوط رئيسية'    },
                { label: 'الخزانات',     Icon: Database, score: Math.min(100, healthScore - 10), note: '5 خزانات — 1 حرج' },
                { label: 'جودة المياه',  Icon: Shield,   score: Math.min(100, healthScore + 15), note: 'TDS ضمن المعايير'  },
              ] as { label: string; Icon: React.ElementType; score: number; note: string }[]).map(sub => {
                const lv = computeRiskLevel(sub.score);
                return (
                  <div key={sub.label} className={`bg-slate-900 border ${RC[lv].border} rounded-2xl p-4 flex flex-col items-center gap-2`}>
                    <div className={`w-9 h-9 rounded-xl ${RC[lv].bg} flex items-center justify-center`}><sub.Icon className={`w-4 h-4 ${RC[lv].text}`} /></div>
                    <HealthGauge score={sub.score} level={lv} size="sm" />
                    <p className="text-white text-sm font-semibold text-center">{sub.label}</p>
                    <p className="text-slate-500 text-xs text-center">{sub.note}</p>
                  </div>
                );
              })}
            </div>
            {trendData.length > 2 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-white font-semibold text-sm mb-0.5">مؤشر الصحة الكلية عبر الزمن</h3>
                <p className="text-slate-500 text-xs mb-3">80+ ممتازة · 60-79 جيدة · 40-59 مراجعة · أقل من 40 حرجة</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#475569" tick={{ fontSize: 9 }} domain={[0, 100]} />
                    <ReferenceLine y={80} stroke="#34d399" strokeDasharray="4 3" strokeWidth={1} />
                    <ReferenceLine y={60} stroke="#facc15" strokeDasharray="4 3" strokeWidth={1} />
                    <Tooltip contentStyle={TS} formatter={(v: number) => [`${v}/100`, 'الصحة']} />
                    <Bar dataKey="صحة" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: مؤشرات KPI ══════════════════════════════════════════════ */}
        {!loading && tab === 'kpis' && (
          <div className="space-y-4">
            {([
              { group: 'الإنتاج والتوزيع', color: 'text-cyan-400', kpis: [
                { label: 'الإنتاج اليومي',          v: latest ? Math.round(Number(latest.total_production)).toLocaleString('ar') : '—', u: 'م³/يوم', target: '1,200,000', st: 'normal'   as const },
                { label: 'الاستهلاك الفعلي',         v: latest ? Math.round(Number(latest.total_consumption)).toLocaleString('ar') : '—', u: 'م³/يوم', target: '—',         st: 'normal'   as const },
                { label: 'نسبة الفاقد المائي (NRW)', v: latest ? `${Number(latest.nrw_percent).toFixed(1)}%` : '—', u: '', target: '< 15%', st: (latest && Number(latest.nrw_percent) > 25 ? 'critical' : latest && Number(latest.nrw_percent) > 15 ? 'warning' : 'normal') as 'normal'|'warning'|'critical' },
                { label: 'تغطية الطلب',               v: latest && Number(latest.total_production) > 0 ? `${Math.round(Number(latest.total_consumption) / Number(latest.total_production) * 100)}%` : '—', u: '', target: '> 90%', st: 'normal' as const },
              ]},
              { group: 'جودة الخدمة', color: 'text-violet-400', kpis: [
                { label: 'تغطية ضغط الخدمة',           v: '—',  u: '%',         target: '> 95%',    st: 'normal'  as const },
                { label: 'ساعات الخدمة المتواصلة',       v: '—',  u: 'ساعة/يوم', target: '24 ساعة',  st: 'normal'  as const },
                { label: 'الامتثال لمعايير جودة المياه',  v: '—',  u: '%',         target: '100%',     st: 'normal'  as const },
                { label: 'مدن بضغط أقل من التصميمي',    v: '2',  u: 'مدينة',     target: '0',        st: 'warning' as const },
              ]},
              { group: 'كفاءة التشغيل', color: 'text-amber-400', kpis: [
                { label: 'إنجاز أوامر العمل',           v: '—',   u: '%',         target: '> 85%',     st: 'normal'  as const },
                { label: 'متوسط وقت الإصلاح (MTTR)',    v: '8.5', u: 'ساعة',      target: '< 12 ساعة', st: 'normal'  as const },
                { label: 'كفاءة المضخات',               v: '74',  u: '%',         target: '> 80%',     st: 'warning' as const },
                { label: 'الالتزام بـ SLA',               v: '—',   u: '%',         target: '> 90%',     st: 'normal'  as const },
              ]},
            ] as { group: string; color: string; kpis: { label: string; v: string; u: string; target: string; st: 'normal'|'warning'|'critical' }[] }[]).map(g => (
              <div key={g.group} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <h3 className={`text-sm font-bold mb-3 ${g.color}`}>{g.group}</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {g.kpis.map(k => (
                    <div key={k.label} className={`rounded-xl p-3 border ${k.st === 'critical' ? 'bg-red-900/20 border-red-700/30' : k.st === 'warning' ? 'bg-yellow-900/20 border-yellow-700/30' : 'bg-slate-800/50 border-slate-700'}`}>
                      <p className="text-slate-400 text-xs mb-1 leading-tight">{k.label}</p>
                      <p className={`text-lg font-bold ${k.st === 'critical' ? 'text-red-400' : k.st === 'warning' ? 'text-yellow-400' : 'text-white'}`}>{k.v} <span className="text-xs font-normal text-slate-500">{k.u}</span></p>
                      <p className="text-slate-600 text-[10px] mt-1">الهدف: {k.target}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-600 text-center">المؤشرات الفارغة تتطلب ربط بيانات من أوامر العمل والآبار والجودة</p>
          </div>
        )}

        {/* ═══ TAB: مراقبة المخاطر ══════════════════════════════════════════ */}
        {!loading && tab === 'risks' && (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm"><Shield className={`w-4 h-4 ${RC[riskLevel].text}`} /> تقييم المخاطر الشامل</h3>
              <div className="space-y-3">
                {([
                  { label: 'مخاطر الفاقد المائي',   level: (latest && Number(latest.nrw_percent) > 25 ? 'critical' : latest && Number(latest.nrw_percent) > 15 ? 'high' : 'low') as RiskLevel, detail: latest ? `نسبة الفاقد: ${Number(latest.nrw_percent).toFixed(1)}% — الحد الحرج: 25%` : 'لا توجد بيانات', impact: 'مرتفع جداً', link: '/dashboard/admin-gateway/maintenance/preventive' },
                  { label: 'مخاطر الأعطال الحرجة', level: (latest && latest.anomaly_critical > 2 ? 'critical' : latest && latest.anomaly_critical > 0 ? 'high' : 'low') as RiskLevel,           detail: latest ? `${latest.anomaly_critical} انحراف حرج مسجل` : 'لا توجد بيانات',              impact: 'مرتفع',      link: '/dashboard/admin-gateway/maintenance/fault-analysis'  },
                  { label: 'استقرار التشغيل',        level: (latest && latest.anomaly_warning > 5 ? 'high' : latest && latest.anomaly_warning > 2 ? 'medium' : 'low') as RiskLevel,              detail: latest ? `${latest.anomaly_warning} تحذيرات تشغيلية` : 'لا توجد بيانات',               impact: 'متوسط',      link: '/dashboard/admin-gateway/maintenance/control-center'  },
                  { label: 'توازن الإنتاج والطلب',  level: (latest && Number(latest.total_production) > 0 && Number(latest.total_consumption) / Number(latest.total_production) < 0.65 ? 'medium' : 'low') as RiskLevel, detail: latest && Number(latest.total_production) > 0 ? `${Math.round(Number(latest.total_consumption) / Number(latest.total_production) * 100)}% نسبة الاستهلاك/الإنتاج` : 'لا توجد بيانات', impact: 'متوسط', link: '/dashboard/admin-gateway/maintenance/preventive' },
                  { label: 'الأصول الحرجة',          level: 'high'     as RiskLevel, detail: '2 أصول بصحة أقل من 50% — تدخل فوري مطلوب (بيانات تجريبية)',              impact: 'مرتفع',      link: '/dashboard/admin-gateway/maintenance/fault-analysis'  },
                  { label: 'مستوى الخزانات',         level: 'critical' as RiskLevel, detail: 'خزان مصراتة 25% — خطر انقطاع الخدمة (بيانات تجريبية)',                   impact: 'عالي جداً',  link: '/dashboard/admin-gateway/maintenance/control-center'  },
                ] as { label: string; level: RiskLevel; detail: string; impact: string; link: string }[]).map(risk => {
                  const rc = RC[risk.level];
                  return (
                    <div key={risk.label} className={`flex items-center gap-3 p-3 rounded-xl ${rc.bg} border ${rc.border}`}>
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${rc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{risk.label}</p>
                        <p className={`text-xs mt-0.5 ${rc.text}`}>{risk.detail}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500 text-xs hidden sm:block">التأثير: {risk.impact}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rc.bg} ${rc.text} border ${rc.border}`}>{rc.label}</span>
                        <Link href={risk.link} className="text-slate-500 hover:text-slate-200 transition-colors"><ArrowUpRight className="w-3.5 h-3.5" /></Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: الأصول الحرجة ═══════════════════════════════════════════ */}
        {!loading && tab === 'assets' && (
          <div className="space-y-4">
            <DemoBadge text="بيانات تجريبية — ستُربط بمنصة التحليل الفني عند اكتمال التكامل." />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">الأصول الحرجة — صحة أقل من 60%</h3>
                <Link href="/dashboard/admin-gateway/maintenance/fault-analysis" className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1">منصة التحليل الفني <ArrowUpRight className="w-3 h-3" /></Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-400 text-xs border-b border-slate-800">{['الأصل', 'النوع', 'الموقع', 'الصحة', 'آخر صيانة', 'الإجراء'].map(h => <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {DEMO_ASSETS.map(a => {
                      const lv = computeRiskLevel(a.health);
                      return (
                        <tr key={a.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-white">{a.name}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{a.type}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{a.loc}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-14 h-1.5 bg-slate-700 rounded-full"><div className={`h-full rounded-full ${a.health < 40 ? 'bg-red-500' : a.health < 60 ? 'bg-orange-500' : 'bg-yellow-500'}`} style={{ width: `${a.health}%` }} /></div><span className={`text-xs font-bold ${RC[lv].text}`}>{a.health}%</span></div></td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{a.last}</td>
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${a.health < 40 ? 'bg-red-900/40 text-red-300' : 'bg-amber-900/40 text-amber-300'}`}>{a.action}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: توازن المياه ════════════════════════════════════════════ */}
        {!loading && tab === 'water' && (
          <div className="space-y-5">
            {latest ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {([
                    { label: 'إجمالي الإنتاج',     v: Math.round(Number(latest.total_production)).toLocaleString('ar'),                                                        u: 'م³/يوم', c: 'text-indigo-400', bar: 'bg-indigo-500',   pct: 100, Icon: Zap },
                    { label: 'الاستهلاك الفعلي',    v: Math.round(Number(latest.total_consumption)).toLocaleString('ar'),                                                       u: 'م³/يوم', c: 'text-cyan-400',   bar: 'bg-cyan-500',     pct: Number(latest.total_production) > 0 ? Math.round(Number(latest.total_consumption) / Number(latest.total_production) * 100) : 0, Icon: Target },
                    { label: 'الفاقد المائي (NRW)', v: Math.round(Number(latest.total_production) - Number(latest.total_consumption)).toLocaleString('ar'),                     u: 'م³/يوم', c: 'text-amber-400', bar: 'bg-amber-500',    pct: Math.round(Number(latest.nrw_percent)), Icon: TrendingDown },
                  ] as { label: string; v: string; u: string; c: string; bar: string; pct: number; Icon: React.ElementType }[]).map(b => (
                    <div key={b.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2"><b.Icon className={`w-4 h-4 ${b.c}`} /><p className="text-slate-400 text-xs">{b.label}</p></div>
                      <p className={`text-2xl font-black ${b.c}`}>{b.v} <span className="text-sm font-normal text-slate-500">{b.u}</span></p>
                      <div className="mt-3 h-2 bg-slate-800 rounded-full"><div className={`h-full rounded-full ${b.bar}`} style={{ width: `${Math.min(b.pct, 100)}%` }} /></div>
                      <p className={`text-xs mt-1 ${b.c}`}>{b.pct}% من الإنتاج</p>
                    </div>
                  ))}
                </div>
                {trendData.length > 1 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <h3 className="text-white font-semibold text-sm mb-3">توازن المياه اليومي (م³/يوم)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 9 }} />
                        <YAxis stroke="#475569" tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                        <Tooltip contentStyle={TS} formatter={(v: number, n: string) => [`${v.toLocaleString()} م³`, n]} />
                        <Legend />
                        <Area type="monotone" dataKey="إنتاج"   stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                        <Area type="monotone" dataKey="استهلاك" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Droplets className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">لا توجد بيانات — ارفع تقارير التشغيل أولاً</p>
                <Link href="/dashboard/admin-gateway/maintenance/preventive" className="inline-flex items-center gap-1.5 mt-3 text-xs text-violet-400 hover:text-violet-300">مراقبة التشغيل <ArrowUpRight className="w-3.5 h-3.5" /></Link>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: الطلب والاستهلاك ════════════════════════════════════════ */}
        {!loading && tab === 'demand' && (
          <div className="space-y-5">
            <DemoBadge text="بيانات تجريبية — ستُربط بمراقبة التشغيل عند توفر بيانات المدن." />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800"><h3 className="text-white font-semibold text-sm">الطلب والاستهلاك حسب المنطقة</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-400 text-xs border-b border-slate-800">{['المنطقة', 'الاستهلاك (م³/يوم)', 'الطلب (م³/يوم)', 'التغطية', 'الحالة'].map(h => <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {DEMO_ZONES.map(z => {
                      const rc = z.status === 'critical' ? RC.critical : z.status === 'warning' ? RC.high : RC.low;
                      return (
                        <tr key={z.zone} className={`hover:bg-slate-800/40 ${z.status === 'critical' ? 'bg-red-500/5' : ''}`}>
                          <td className="px-4 py-3 font-medium text-white">{z.zone}</td>
                          <td className="px-4 py-3 font-mono text-cyan-400">{z.cons.toLocaleString()}</td>
                          <td className="px-4 py-3 font-mono text-slate-400">{z.demand.toLocaleString()}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-20 h-1.5 bg-slate-700 rounded-full"><div className={`h-full rounded-full ${z.cov >= 95 ? 'bg-emerald-500' : z.cov >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${z.cov}%` }} /></div><span className={`text-xs font-bold ${z.cov >= 95 ? 'text-emerald-400' : z.cov >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>{z.cov}%</span></div></td>
                          <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rc.bg} ${rc.text} border ${rc.border}`}>{rc.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3">تغطية الطلب حسب المنطقة</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={DEMO_ZONES.map(z => ({ zone: z.zone, طلب: z.demand, استهلاك: z.cons }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="zone" tick={{ fill: '#94a3b8', fontSize: 10 }} width={65} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11, direction: 'rtl' as const }} formatter={(v: number) => [`${v.toLocaleString()} م³/يوم`]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="طلب"     fill="#1e3a5f" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="استهلاك" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ TAB: التنبيهات التنفيذية ════════════════════════════════════ */}
        {!loading && tab === 'alerts' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'حرجة',      count: DEMO_ALERTS.filter(a => a.sev === 'critical' && !a.ack).length, c: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20'     },
                { label: 'تحذيرية',   count: DEMO_ALERTS.filter(a => a.sev === 'warning'  && !a.ack).length, c: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'معلوماتية', count: DEMO_ALERTS.filter(a => a.sev === 'info').length,                c: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20'   },
              ].map(s => (
                <div key={s.label} className={`bg-slate-900 border ${s.bg} rounded-xl p-3 text-center`}>
                  <p className={`text-3xl font-black ${s.c}`}>{s.count}</p>
                  <p className="text-slate-400 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {DEMO_ALERTS.map(a => (
                <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${a.sev === 'critical' ? 'bg-red-900/20 border-red-700/30' : a.sev === 'warning' ? 'bg-yellow-900/20 border-yellow-700/30' : 'bg-slate-800/50 border-slate-700'} ${a.ack ? 'opacity-50' : ''}`}>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${a.sev === 'critical' ? 'bg-red-900/60 text-red-300' : a.sev === 'warning' ? 'bg-yellow-900/60 text-yellow-300' : 'bg-blue-900/60 text-blue-300'}`}>
                    {a.sev === 'critical' ? 'حرج' : a.sev === 'warning' ? 'تحذير' : 'معلومة'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-snug">{a.msg}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{a.mod} · {a.time} · {a.ack ? 'تمت المعالجة' : 'يتطلب إجراءً'}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 text-center">التنبيهات تجريبية — ستُجمَع تلقائياً من جميع الوحدات عند اكتمال التكامل</p>
          </div>
        )}

        {/* ═══ TAB: البنية التحتية ══════════════════════════════════════════ */}
        {!loading && tab === 'infrastructure' && (
          <div className="space-y-5">
            <DemoBadge text="بيانات البنية التحتية تجريبية — ستُربط بمركز التحكم التشغيلي." />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">محطات الضخ</h3>
                <Link href="/dashboard/admin-gateway/maintenance/control-center" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">مركز التحكم <ArrowUpRight className="w-3 h-3" /></Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-400 text-xs border-b border-slate-800">{['المحطة', 'المضخات النشطة', 'التدفق (م³/س)', 'التصميمي', 'التحميل', 'الحالة'].map(h => <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {DEMO_STATIONS.map(s => {
                      const load = Math.round(s.flow / s.design * 100);
                      const rc = s.status === 'critical' ? RC.critical : s.status === 'warning' ? RC.medium : RC.low;
                      return (
                        <tr key={s.id} className={`hover:bg-slate-800/40 ${s.status === 'critical' ? 'bg-red-500/5' : ''}`}>
                          <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                          <td className="px-4 py-3 text-center"><span className={`text-sm font-bold ${s.active === s.pumps ? 'text-emerald-400' : 'text-amber-400'}`}>{s.active}/{s.pumps}</span></td>
                          <td className="px-4 py-3 font-mono text-cyan-400">{s.flow.toLocaleString()}</td>
                          <td className="px-4 py-3 font-mono text-slate-400">{s.design.toLocaleString()}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-slate-700 rounded-full"><div className={`h-full rounded-full ${load >= 90 ? 'bg-red-500' : load >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(load, 100)}%` }} /></div><span className="text-xs font-mono">{load}%</span></div></td>
                          <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rc.bg} ${rc.text} border ${rc.border}`}>{rc.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3">مستويات الخزانات</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {DEMO_TANKS.map(t => {
                  const pct = Math.round(t.level / t.cap * 100);
                  const rc  = t.status === 'critical' ? RC.critical : t.status === 'warning' ? RC.high : RC.low;
                  return (
                    <div key={t.id} className={`bg-slate-800 border ${rc.border} rounded-xl p-3`}>
                      <p className="text-slate-300 text-xs font-medium mb-2 leading-tight">{t.name}</p>
                      <div className="relative h-20 bg-slate-700 rounded-lg overflow-hidden">
                        <div className={`absolute bottom-0 w-full transition-all ${t.status === 'critical' ? 'bg-red-500/40' : t.status === 'warning' ? 'bg-amber-500/40' : 'bg-cyan-500/40'}`} style={{ height: `${pct}%` }} />
                        <div className="absolute inset-0 flex items-center justify-center"><span className={`text-xl font-black ${rc.text}`}>{pct}%</span></div>
                      </div>
                      <p className="text-slate-500 text-[10px] mt-1 text-center">{(t.level / 1000).toFixed(0)}k / {(t.cap / 1000).toFixed(0)}k م³</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: الأداء التشغيلي ════════════════════════════════════════ */}
        {!loading && tab === 'performance' && (
          <div className="space-y-5">
            {history.length > 1 ? (
              <>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" /> مقارنة الأداء التاريخي
                    <span className="text-slate-500 text-xs font-normal mr-auto">آخر {Math.min(history.length, 14)} تقرير</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-800 text-slate-400 text-xs">{['التاريخ', 'الإنتاج (م³)', 'الاستهلاك (م³)', 'الفاقد %', 'الانحرافات', 'درجة الصحة'].map(h => <th key={h} className="text-right py-3 px-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                      <tbody>
                        {history.slice(0, 14).map((r, idx) => {
                          const hs = computeHealthScore(r); const rl = computeRiskLevel(hs);
                          return (
                            <tr key={r.id} className={`border-b border-slate-800/50 ${idx === 0 ? 'bg-slate-800/30' : 'hover:bg-slate-800/20'}`}>
                              <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{idx === 0 && <span className="text-[10px] bg-rose-900/40 text-rose-300 px-1.5 py-0.5 rounded-full ml-1.5">أحدث</span>}{r.report_date}</td>
                              <td className="py-3 px-3 text-indigo-300 font-medium">{Math.round(Number(r.total_production)).toLocaleString()}</td>
                              <td className="py-3 px-3 text-cyan-300 font-medium">{Math.round(Number(r.total_consumption)).toLocaleString()}</td>
                              <td className={`py-3 px-3 font-bold ${Number(r.nrw_percent) > 25 ? 'text-red-400' : Number(r.nrw_percent) > 15 ? 'text-yellow-400' : 'text-emerald-400'}`}>{Number(r.nrw_percent).toFixed(1)}%</td>
                              <td className="py-3 px-3">
                                {r.anomaly_critical > 0 && <span className="text-[10px] bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded-full ml-1">{r.anomaly_critical} حرج</span>}
                                {r.anomaly_warning  > 0 && <span className="text-[10px] bg-yellow-900/40 text-yellow-300 px-1.5 py-0.5 rounded-full">{r.anomaly_warning} تحذير</span>}
                                {r.anomaly_critical === 0 && r.anomaly_warning === 0 && <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> طبيعي</span>}
                              </td>
                              <td className="py-3 px-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${RC[rl].bg} ${RC[rl].text} border ${RC[rl].border}`}>{hs}/100</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {trendData.length > 2 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <h3 className="text-white font-semibold text-sm mb-0.5">مؤشر الصحة الكلية عبر الزمن</h3>
                    <p className="text-slate-500 text-xs mb-3">80+ ممتازة · 60-79 جيدة · 40-59 مراجعة · أقل من 40 حرجة</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 9 }} />
                        <YAxis stroke="#475569" tick={{ fontSize: 9 }} domain={[0, 100]} />
                        <ReferenceLine y={80} stroke="#34d399" strokeDasharray="4 3" strokeWidth={1} />
                        <ReferenceLine y={60} stroke="#facc15" strokeDasharray="4 3" strokeWidth={1} />
                        <Tooltip contentStyle={TS} formatter={(v: number) => [`${v}/100`, 'الصحة']} />
                        <Bar dataKey="صحة" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Database className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">لا توجد بيانات تاريخية — ارفع تقارير التشغيل أولاً</p>
                <Link href="/dashboard/admin-gateway/maintenance/preventive" className="inline-flex items-center gap-1.5 mt-3 text-xs text-violet-400 hover:text-violet-300">مراقبة التشغيل <ArrowUpRight className="w-3.5 h-3.5" /></Link>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: المراسلات الداخلية ═════════════════════════════════════ */}
        {tab === 'correspondence' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3">
              <p className="text-sm text-rose-200 font-semibold">تم توحيد مسارات المراسلات في قناة واحدة</p>
              <p className="text-xs text-slate-300 mt-1">الوارد والصادر والتعميمات والإجراءات الإدارية تُدار من نفس اللوحة — هذا التبويب مخصص لمدير الإدارة فقط.</p>
            </div>
            <InternalMailTab department="maintenance" title="نظام المراسلات الموحد - إدارة الهندسة والدعم الفني" />
          </div>
        )}

      </div>
    </div>
  );
}
