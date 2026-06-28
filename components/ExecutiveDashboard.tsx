'use client';

/**
 * ExecutiveDashboard — مركز القيادة التنفيذي
 * Uses: /api/v1/gov-reports/executive + /api/v1/gov-reports/operations
 * Phase 1 of Executive Intelligence Layer
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  RefreshCw, AlertTriangle, CheckCircle, Clock, Briefcase,
  DollarSign, Shield, BarChart2, ArrowLeft, Truck, FileText,
  TrendingUp, Activity,
} from 'lucide-react';
import {
  BarChart as RBarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const TENANT =
  typeof window !== 'undefined'
    ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
    : '';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = 2,
  delayMs = 500
): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(url, { headers, cache: 'no-store' });
    lastRes = res;
    if (res.ok) return res;
    if (attempt < retries) await wait(delayMs * (attempt + 1));
  }
  return lastRes as Response;
}

// ── Types based on actual API responses ────────────────────────────────────────
interface ExecData {
  generated_at: string;
  projects:  { active: number; planning: number; completed: number; on_hold: number; total: number; total_budget: number; };
  employees: { total: number; };
  journal_entries: { posted: number; draft: number; total: number; total_debit: number; total_credit: number; };
  contracts: { active: number; completed: number; draft: number; total: number; total_value: number; };
  procurement: { pr_pending: number; pr_approved: number; pr_total: number; po_issued: number; po_completed: number; po_total: number; total_amount: number; };
  revenue: { paid_invoices: number; unpaid_invoices: number; overdue_invoices: number; total_invoiced: number; total_collected: number; total_outstanding: number; };
  fleet: { active_vehicles: number; maintenance_vehicles: number; total_vehicles: number; active_equipment: number; total_equipment: number; total_fuel_cost: number; };
  approvals: { pending: number; approved: number; rejected: number; total: number; };
  inventory: { total_received_value: number; total_issued_value: number; };
}

interface OpsProject {
  id: number;
  name: string;
  code: string;
  status: string;
  budget: number | null;
  contracts_total: number;
  vehicles_assigned: number;
  equipment_assigned: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const compact = (v: number | null | undefined): string => {
  if (!v) return '0';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(0)     + 'K';
  return v.toFixed(0);
};

// ── Color palette ──────────────────────────────────────────────────────────────
const C = {
  primary: '#6366f1', success: '#10b981', warning: '#f59e0b',
  danger:  '#ef4444', info:    '#3b82f6', teal:    '#14b8a6',
  neutral: '#475569', orange:  '#f97316',
};

// ── Drill-down link color map (static strings = Tailwind-safe) ─────────────────
const LINK_COLORS: Record<string, string> = {
  indigo: 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30',
  green:  'bg-green-600/20  text-green-300  border-green-500/30  hover:bg-green-600/30',
  rose:   'bg-rose-600/20   text-rose-300   border-rose-500/30   hover:bg-rose-600/30',
  amber:  'bg-amber-600/20  text-amber-300  border-amber-500/30  hover:bg-amber-600/30',
  teal:   'bg-teal-600/20   text-teal-300   border-teal-500/30   hover:bg-teal-600/30',
  blue:   'bg-blue-600/20   text-blue-300   border-blue-500/30   hover:bg-blue-600/30',
  violet: 'bg-violet-600/20 text-violet-300 border-violet-500/30 hover:bg-violet-600/30',
  orange: 'bg-orange-600/20 text-orange-300 border-orange-500/30 hover:bg-orange-600/30',
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
type KpiCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
  link?: string;
  alert?: boolean;
};

function KpiCard({ label, value, sub, color, icon, link, alert }: KpiCardProps) {
  const borderCls = alert
    ? 'border-rose-500/50 ring-1 ring-rose-500/20'
    : 'border-slate-800 hover:border-slate-600';
  const inner = (
    <div className={`bg-slate-900/60 p-5 rounded-xl border ${borderCls} transition-colors h-full`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: color + '25' }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-sm text-slate-400 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-100 leading-tight">{value}</div>
      {sub && <div className="text-sm text-slate-500 mt-1">{sub}</div>}
    </div>
  );
  return link
    ? <Link href={link} className="block h-full">{inner}</Link>
    : inner;
}

// ── Chart Tooltip ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTip({ active, payload, label, unit = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm shadow-xl">
      {label && <div className="text-slate-400 mb-1.5">{label}</div>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300">{p.name}: <strong>{compact(p.value)}</strong>{unit}</span>
        </div>
      ))}
    </div>
  );
}

// ── Small donut chart wrapper ──────────────────────────────────────────────────
type DonutEntry = { name: string; value: number; color: string };
function MiniDonut({ data, label }: { data: DonutEntry[]; label: string }) {
  if (!data.length || data.every(d => d.value === 0)) {
    return (
      <div className="h-[170px] flex items-center justify-center text-slate-500 text-sm">
        لا توجد بيانات
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={170}>
      <PieChart>
        <Pie data={data} cx="50%" cy="45%" innerRadius={42} outerRadius={65}
          dataKey="value" paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip content={<ChartTip />} />
        <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} iconSize={8} />
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
          className="fill-slate-100" style={{ fill: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>
          {data.reduce((s, d) => s + d.value, 0)}
        </text>
        <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle"
          style={{ fill: '#64748b', fontSize: 9 }}>
          {label}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Signal row ─────────────────────────────────────────────────────────────────
const SIGNAL_STYLES = {
  critical: 'bg-rose-900/30   border-rose-500/30   text-rose-300',
  high:     'bg-orange-900/30 border-orange-500/30 text-orange-300',
  medium:   'bg-amber-900/30  border-amber-500/30  text-amber-300',
  info:     'bg-blue-900/30   border-blue-500/30   text-blue-300',
  ok:       'bg-green-900/30  border-green-500/30  text-green-300',
};

type SignalLevel = keyof typeof SIGNAL_STYLES;

// ── Main export ────────────────────────────────────────────────────────────────
export default function ExecutiveDashboard() {
  const [exec,    setExec]    = useState<ExecData | null>(null);
  const [ops,     setOps]     = useState<OpsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');
  const fetchAbortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async (attempt = 0) => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true); setErr('');
    try {
      const headers: Record<string, string> = {};
      if (TENANT) headers['X-Tenant-ID'] = TENANT;
      const [er, or] = await Promise.all([
        fetch('/api/v1/gov-reports/executive',  { headers, signal: controller.signal }),
        fetch('/api/v1/gov-reports/operations', { headers, signal: controller.signal }),
      ]);
      const [ed, od] = await Promise.all([er.json(), or.json()]);
      if (!er.ok) throw new Error(ed.detail ?? 'executive report error');
      setExec(ed);
      setOps(od.projects_breakdown ?? []);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        return;
      }
      // Retry once after 3 seconds on first failure (backend cold start)
      if (attempt === 0) {
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
        }
        retryTimerRef.current = setTimeout(() => fetchAll(1), 3000);
        return;
      }
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAll(0);
    const t = setInterval(() => fetchAll(0), 60_000);
    return () => {
      clearInterval(t);
      fetchAbortRef.current?.abort();
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [fetchAll]);

  // ── Derived chart data ──────────────────────────────────────────────────────
  const budgetChartData = useMemo(() =>
    ops
      .filter(p => p.budget && p.budget > 0)
      .slice(0, 8)
      .map(p => ({
        name:    p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name,
        'الميزانية': p.budget ?? 0,
        'العقود':    p.contracts_total ?? 0,
      }))
  , [ops]);

  const revenueDonut = useMemo(() => exec ? [
    { name: 'محصّل',  value: exec.revenue.total_collected,  color: C.success },
    { name: 'مستحق',  value: exec.revenue.total_outstanding, color: C.warning },
  ].filter(d => d.value > 0) : [], [exec]);

  const projectsDonut = useMemo(() => exec ? [
    { name: 'نشط',   value: exec.projects.active,    color: C.success },
    { name: 'متوقف',  value: exec.projects.on_hold,   color: C.warning },
    { name: 'مكتمل',  value: exec.projects.completed, color: C.info    },
    { name: 'تخطيط',  value: exec.projects.planning,  color: C.neutral },
  ].filter(d => d.value > 0) : [], [exec]);

  const approvalsDonut = useMemo(() => exec ? [
    { name: 'مُعتمَد', value: exec.approvals.approved, color: C.success },
    { name: 'معلق',   value: exec.approvals.pending,  color: C.warning },
    { name: 'مرفوض',  value: exec.approvals.rejected, color: C.danger  },
  ].filter(d => d.value > 0) : [], [exec]);

  // ── Computed KPIs ────────────────────────────────────────────────────────────
  const budgetUtilPct = exec && exec.projects.total_budget > 0
    ? ((exec.journal_entries.total_debit / exec.projects.total_budget) * 100).toFixed(1)
    : null;

  const collectionRatePct = exec && exec.revenue.total_invoiced > 0
    ? ((exec.revenue.total_collected / exec.revenue.total_invoiced) * 100).toFixed(1)
    : null;

  // ── Risk level (derived from real data signals) ────────────────────────────────
  const riskLevel = useMemo((): SignalLevel => {
    if (!exec) return 'ok';
    const issues = [
      exec.revenue.overdue_invoices > 0,
      exec.projects.on_hold > 0,
      exec.approvals.pending > 5,
      exec.fleet.maintenance_vehicles > exec.fleet.total_vehicles * 0.3,
      exec.contracts.draft > 0 && exec.contracts.active === 0,
    ].filter(Boolean).length;
    return issues >= 3 ? 'critical' : issues >= 2 ? 'high' : issues >= 1 ? 'medium' : 'ok';
  }, [exec]);

  const riskCls = SIGNAL_STYLES[riskLevel];
  const riskLabels: Record<string, string> = { ok: 'منخفض', medium: 'متوسط', high: 'مرتفع', critical: 'حرج' };

  // ── Signals ──────────────────────────────────────────────────────────────────
  const signals = useMemo(() => {
    if (!exec) return [];
    return [
      {
        show:  exec.revenue.overdue_invoices > 0,
        level: 'high' as SignalLevel,
        text:  `${exec.revenue.overdue_invoices} فاتورة متأخرة — مستحق ${compact(exec.revenue.total_outstanding)} د.ل`,
        href:  '/dashboard/admin-gateway/revenue/invoices',
      },
      {
        show:  exec.projects.on_hold > 0,
        level: 'medium' as SignalLevel,
        text:  `${exec.projects.on_hold} مشروع متوقف يحتاج قراراً تشغيلياً`,
        href:  '/dashboard/admin-gateway/projects/list',
      },
      {
        show:  exec.approvals.pending > 0,
        level: 'medium' as SignalLevel,
        text:  `${exec.approvals.pending} طلب اعتماد معلق`,
        href:  '/dashboard/admin-gateway/workflow/approvals',
      },
      {
        show:  exec.fleet.maintenance_vehicles > 0,
        level: 'info' as SignalLevel,
        text:  `${exec.fleet.maintenance_vehicles} مركبة في الصيانة حالياً`,
        href:  '/dashboard/admin-gateway/vehicles/vehicles',
      },
      {
        show:  exec.contracts.draft > 0,
        level: 'info' as SignalLevel,
        text:  `${exec.contracts.draft} عقد مسودة لم يُفعّل بعد`,
        href:  '/dashboard/admin-gateway/contracts/list',
      },
      {
        show:  exec.procurement.pr_pending > 0,
        level: 'medium' as SignalLevel,
        text:  `${exec.procurement.pr_pending} طلب شراء معلق`,
        href:  '/dashboard/admin-gateway/materials/procurement/requests',
      },
      {
        show:  exec.approvals.approved > 0,
        level: 'ok' as SignalLevel,
        text:  `${exec.approvals.approved} موافقة مُعتمَدة من إجمالي ${exec.approvals.total}`,
        href:  '/dashboard/admin-gateway/workflow/approvals',
      },
    ].filter(s => s.show);
  }, [exec]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Verification Marker ─────────────────────────────────────────── */}
        <div className="bg-emerald-900/30 border border-emerald-500/40 rounded-lg px-4 py-2 text-emerald-300 text-xs font-mono text-center tracking-wide">
          &#10003; EXECUTIVE DASHBOARD LIVE | TYPOGRAPHY UPDATED &mdash; مركز القيادة التنفيذي | {new Date().toLocaleDateString('ar-LY')}
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600/20 p-3 rounded-xl border border-indigo-500/30">
                <BarChart2 className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100">مركز القيادة التنفيذي</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {exec ? `آخر تحديث: ${new Date(exec.generated_at).toLocaleString('ar-LY')}` : 'جاري التحميل...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {exec && (
                <div className={`px-4 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 ${riskCls}`}>
                  <Shield className="w-4 h-4" />
                  مستوى المخاطر: {riskLabels[riskLevel]}
                </div>
              )}
              <button onClick={fetchAll} disabled={loading}
                className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
                <RefreshCw className={`w-5 h-5 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Link href="/dashboard/admin-gateway"
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition">
                <ArrowLeft className="w-4 h-4" />
                البوابة
              </Link>
            </div>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {err && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {err}
          </div>
        )}

        {/* ── Loading Skeleton ─────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-800/50" />)}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 h-64 rounded-2xl bg-slate-800/40" />
              <div className="h-64 rounded-2xl bg-slate-800/40" />
            </div>
          </div>
        )}

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        {!loading && exec && (
          <>
            {/* ── 8 KPI Cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="الميزانية الكلية"
                value={compact(exec.projects.total_budget) + ' د.ل'}
                sub={`${exec.projects.total} مشروع`}
                color={C.primary}
                icon={<DollarSign className="w-4 h-4" />}
                link="/dashboard/admin-gateway/reports/financial"
              />
              <KpiCard
                label="الإنفاق المُرحّل"
                value={compact(exec.journal_entries.total_debit) + ' د.ل'}
                sub={budgetUtilPct ? `استخدام: ${budgetUtilPct}%` : undefined}
                color={C.warning}
                icon={<TrendingUp className="w-4 h-4" />}
                link="/dashboard/admin-gateway/reports/financial"
              />
              <KpiCard
                label="معدل التحصيل"
                value={collectionRatePct ? collectionRatePct + '%' : '—'}
                sub={`محصّل: ${compact(exec.revenue.total_collected)} د.ل`}
                color={C.success}
                icon={<CheckCircle className="w-4 h-4" />}
                link="/dashboard/admin-gateway/reports/financial"
              />
              <KpiCard
                label="فواتير متأخرة"
                value={exec.revenue.overdue_invoices}
                sub={`مستحق: ${compact(exec.revenue.total_outstanding)} د.ل`}
                color={exec.revenue.overdue_invoices > 0 ? C.danger : C.success}
                icon={<AlertTriangle className="w-4 h-4" />}
                link="/dashboard/admin-gateway/revenue/invoices"
                alert={exec.revenue.overdue_invoices > 0}
              />
              <KpiCard
                label="مشاريع نشطة"
                value={exec.projects.active}
                sub={`${exec.projects.on_hold} متوقف · ${exec.projects.total} إجمالي`}
                color={C.teal}
                icon={<Briefcase className="w-4 h-4" />}
                link="/dashboard/admin-gateway/projects/list"
              />
              <KpiCard
                label="عقود نشطة"
                value={exec.contracts.active}
                sub={`قيمة: ${compact(exec.contracts.total_value)} د.ل`}
                color={C.info}
                icon={<FileText className="w-4 h-4" />}
                link="/dashboard/admin-gateway/contracts/list"
              />
              <KpiCard
                label="موافقات معلقة"
                value={exec.approvals.pending}
                sub={`معتمد: ${exec.approvals.approved} · إجمالي: ${exec.approvals.total}`}
                color={exec.approvals.pending > 5 ? C.danger : C.neutral}
                icon={<Clock className="w-4 h-4" />}
                link="/dashboard/admin-gateway/workflow/approvals"
                alert={exec.approvals.pending > 5}
              />
              <KpiCard
                label="مركبات نشطة"
                value={exec.fleet.active_vehicles}
                sub={`صيانة: ${exec.fleet.maintenance_vehicles} · إجمالي: ${exec.fleet.total_vehicles}`}
                color={C.orange}
                icon={<Truck className="w-4 h-4" />}
                link="/dashboard/admin-gateway/reports/operations"
              />
            </div>

            {/* ── Charts Row 1: Budget Chart + Revenue Donut ───────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Budget vs Contracts */}
              <div className="lg:col-span-2 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-200">الميزانية مقابل قيمة العقود لكل مشروع</h3>
                  <Link href="/dashboard/admin-gateway/reports/financial"
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition">
                    تفاصيل ←
                  </Link>
                </div>
                {budgetChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <RBarChart data={budgetChartData} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={compact} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip unit=" د.ل" />} />
                      <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} iconSize={8} />
                      <Bar dataKey="الميزانية" fill={C.info}  radius={[4,4,0,0]} maxBarSize={32} />
                      <Bar dataKey="العقود"    fill={C.teal} radius={[4,4,0,0]} maxBarSize={32} />
                    </RBarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[230px] flex items-center justify-center text-slate-500 text-sm">
                    لا توجد بيانات ميزانية للمشاريع
                  </div>
                )}
              </div>

              {/* Revenue donut */}
              <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-200">التحصيل مقابل المستحقات</h3>
                  <Link href="/dashboard/admin-gateway/revenue/collections"
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition">الكل ←</Link>
                </div>
                <MiniDonut data={revenueDonut} label="د.ل" />
                <div className="text-center text-sm text-slate-500 mt-1">
                  مفوتر: {compact(exec.revenue.total_invoiced)} د.ل
                </div>
              </div>
            </div>

            {/* ── Charts Row 2: Projects + Approvals + Signals ─────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Projects Donut */}
              <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-200">حالة المشاريع</h3>
                  <Link href="/dashboard/admin-gateway/projects/list"
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition">الكل ←</Link>
                </div>
                <MiniDonut data={projectsDonut} label="مشروع" />
              </div>

              {/* Approvals Donut */}
              <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-200">حالة طلبات الاعتماد</h3>
                  <Link href="/dashboard/admin-gateway/workflow/approvals"
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition">الكل ←</Link>
                </div>
                <MiniDonut data={approvalsDonut} label="طلب" />
              </div>

              {/* Operational Signals */}
              <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  <Activity className="w-4 h-4 inline-block ml-1 text-slate-400" />
                  إشارات تشغيلية
                </h3>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {signals.length === 0 && (
                    <p className="text-sm text-slate-500">لا تنبيهات حالية</p>
                  )}
                  {signals.map((s, i) => (
                    <Link key={i} href={s.href}
                      className={`block text-sm px-3 py-2 rounded-lg border ${SIGNAL_STYLES[s.level]} hover:opacity-80 transition`}>
                      {s.text}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Drill-Down Report Links ─────────────────────────────── */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">روابط التقارير التفصيلية</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'التقرير التنفيذي',   href: '/dashboard/admin-gateway/reports/executive',   color: 'indigo' },
                  { label: 'التقرير المالي',      href: '/dashboard/admin-gateway/reports/financial',   color: 'green'  },
                  { label: 'تقرير العمليات',    href: '/dashboard/admin-gateway/reports/operations',  color: 'rose'   },
                  { label: 'تقرير المشتريات',   href: '/dashboard/admin-gateway/reports/procurement', color: 'amber'  },
                  { label: 'المشاريع',      href: '/dashboard/admin-gateway/projects/list',       color: 'teal'   },
                  { label: 'العقود',        href: '/dashboard/admin-gateway/contracts/list',       color: 'blue'   },
                  { label: 'طلبات الاعتماد',  href: '/dashboard/admin-gateway/workflow/approvals',  color: 'violet' },
                  { label: 'الإيرادات',       href: '/dashboard/admin-gateway/revenue/invoices',    color: 'orange' },
                ].map(({ label, href, color }) => (
                  <Link key={href} href={href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${LINK_COLORS[color]}`}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-slate-600 pb-2">
          مركز القيادة التنفيذي &mdash; منصة الإدارة الرقمية السيادية
        </p>
      </div>
    </div>
  );
}
