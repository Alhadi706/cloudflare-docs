'use client';

/**
 * مكتب المدير العام — GM Strategic Command Center v2
 * ─────────────────────────────────────────────────────────────
 * يعتمد على TenantFetchGuard (في layout) لحقن X-Tenant-ID تلقائياً.
 * يقرأ auth_token من localStorage لإرسال Authorization header.
 *
 * الأقسام (بالترتيب):
 *  0. شريط الحالة اللحظية (مؤشر الخطر + صحة المنظومة + إشعار)
 *  1. بطاقات KPI الرئيسية (6 بطاقات كبيرة)
 *  2. تصعيد الموافقات (فقط عند وجود موافقات متأخرة)
 *  3. بطاقة الأداء المتوازن BSC (4 منظورات)
 *  4. لوحة صحة الإدارات (6 بطاقات)
 *  5. الأداء مقابل الأهداف MBO
 *  6. الإحاطة الذكية + التقارير
 *  7. مركز الأدوات الاستراتيجية
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Crown, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Minus, DollarSign, Briefcase,
  Users, Wrench, Shield, BarChart3, Brain, MapPin,
  ChevronLeft, ExternalLink, Activity, Zap, Bell,
  FileText, Target, Building2, Truck, ShoppingCart,
  Gauge, Newspaper, Timer, ArrowRight, Flame, HeartPulse,
  CircleDot, Calendar, Package, ChevronRight,
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const h: Record<string, string> = {};
  const token = localStorage.getItem('auth_token');
  const tid   = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id');
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (tid)   h['X-Tenant-ID'] = tid;
  return h;
}

const fmt = (v: number | null | undefined, unit = ''): string => {
  if (v == null || v === 0) return '0' + (unit ? ` ${unit}` : '');
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + ` م ${unit}`.trim();
  if (v >= 1_000)     return (v / 1_000).toFixed(0) + ` ك ${unit}`.trim();
  return v.toFixed(0) + (unit ? ` ${unit}` : '');
};

const pctNum = (n: number, d: number): number =>
  d > 0 ? (n / d) * 100 : 0;

const pct = (n: number, d: number): string =>
  d > 0 ? (n / d * 100).toFixed(0) + '%' : '—';

function hoursAgo(dateStr?: string): number {
  if (!dateStr) return 0;
  return (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
}

function formatAge(dateStr?: string): string {
  const h = hoursAgo(dateStr);
  if (h < 1)  return 'أقل من ساعة';
  if (h < 24) return `${Math.floor(h)} ساعة`;
  return `${Math.floor(h / 24)} يوم`;
}

// ─── types ────────────────────────────────────────────────────────────────────

interface ExecData {
  generated_at: string;
  projects:        { active: number; planning: number; completed: number; on_hold: number; total: number; total_budget: number };
  employees:       { total: number };
  journal_entries: { posted: number; draft: number; total: number; total_debit: number; total_credit: number };
  contracts:       { active: number; completed: number; draft: number; total: number; total_value: number };
  procurement:     { pr_pending: number; pr_approved: number; pr_total: number; po_issued: number; po_completed: number; po_total: number; total_amount: number };
  revenue:         { paid_invoices: number; unpaid_invoices: number; overdue_invoices: number; total_invoiced: number; total_collected: number; total_outstanding: number };
  fleet:           { active_vehicles: number; maintenance_vehicles: number; total_vehicles: number; active_equipment: number; total_equipment: number; total_fuel_cost: number };
  approvals:       { pending: number; approved: number; rejected: number; total: number };
  inventory:       { total_received_value: number; total_issued_value: number };
}

interface OpsProject {
  id: number; name: string; code: string; status: string;
  budget: number | null; contracts_total: number | null;
  vehicles_assigned: number; equipment_assigned: number;
}

interface ApprovalItem {
  id: string; entity_type: string; title: string; status: string;
  created_at?: string; requester_name?: string;
}

type Signal = 'green' | 'amber' | 'red' | 'grey';

// ─── Signal helpers ───────────────────────────────────────────────────────────

function sig(val: number, goodAbove: number, warnAbove: number): Signal {
  if (val >= goodAbove)  return 'green';
  if (val >= warnAbove)  return 'amber';
  return 'red';
}

function sigBelow(val: number, goodBelow: number, warnBelow: number): Signal {
  if (val === 0)        return 'green';
  if (val <= goodBelow) return 'amber';
  if (val <= warnBelow) return 'amber';
  return 'red';
}

const RING: Record<Signal, string> = {
  green: 'border-emerald-500/40 bg-emerald-900/15',
  amber: 'border-amber-500/40  bg-amber-900/15',
  red:   'border-rose-500/40   bg-rose-900/15',
  grey:  'border-slate-700     bg-slate-800/30',
};

const DOT: Record<Signal, string> = {
  green: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.6)]',
  amber: 'bg-amber-400  shadow-[0_0_6px_rgba(251,191,36,.6)]',
  red:   'bg-rose-500   shadow-[0_0_6px_rgba(239,68,68,.7)]',
  grey:  'bg-slate-500',
};

const TEXT: Record<Signal, string> = {
  green: 'text-emerald-400', amber: 'text-amber-400',
  red: 'text-rose-400',      grey: 'text-slate-400',
};

// ─── Hero KPI Card ────────────────────────────────────────────────────────────

function HeroKpi({ label, value, sub, signal, href, icon: Icon, trend }: {
  label: string; value: string; sub?: string; signal: Signal;
  href?: string; icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'flat';
}) {
  const TIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const tColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-600';

  const inner = (
    <div className={`relative flex flex-col gap-3 p-5 rounded-2xl border h-full transition-all hover:scale-[1.01] ${RING[signal]}`}>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${RING[signal]}`}>
          <Icon className={`w-4 h-4 ${TEXT[signal]}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <TIcon className={`w-3.5 h-3.5 ${tColor}`} />
          <span className={`w-2 h-2 rounded-full ${DOT[signal]}`} />
        </div>
      </div>
      <div>
        <div className={`text-3xl font-black leading-none ${TEXT[signal]}`}>{value}</div>
        <div className="text-xs text-slate-400 mt-1.5 font-medium">{label}</div>
        {sub && <div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

// ─── BSC Metric Cell ──────────────────────────────────────────────────────────

function BscCell({ label, value, sub, signal, href }: {
  label: string; value: string; sub?: string; signal: Signal; href?: string;
}) {
  const inner = (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:brightness-110 ${RING[signal]}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[signal]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-100 truncate">{value}</div>
        <div className="text-[11px] text-slate-500 truncate">{label}</div>
        {sub && <div className="text-[10px] text-slate-600 truncate">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ─── MBO Gauge ────────────────────────────────────────────────────────────────

function MboGauge({ label, actual, target, invert = false, href }: {
  label: string; actual: number; target: number; invert?: boolean; href?: string;
}) {
  const ratio = target > 0 ? Math.min(actual / target, 1.5) : 0;
  const barW  = Math.min(ratio * 100, 100);
  const isGood = invert ? actual <= target : actual >= target;
  const over   = actual > target * 1.1;

  const barCls  = over && !invert ? 'bg-amber-500' : isGood ? 'bg-emerald-500' : ratio > 0.75 ? 'bg-amber-500' : 'bg-rose-500';
  const textCls = over && !invert ? 'text-amber-400' : isGood ? 'text-emerald-400' : ratio > 0.75 ? 'text-amber-400' : 'text-rose-400';

  const inner = (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <span className={`text-sm font-bold ${textCls}`}>
          {actual.toFixed(1)}%
          <span className="text-slate-600 font-normal text-[10px]">/{target}%</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barCls}`} style={{ width: `${barW}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px]">
        <span className="text-slate-700">0%</span>
        <span className={`font-semibold ${textCls}`}>
          {isGood ? '✓ تجاوز الهدف' : `${(barW).toFixed(0)}% من الهدف`}
        </span>
        <span className="text-slate-700">{target * 1.5}%</span>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ─── Dept Health Card ─────────────────────────────────────────────────────────

function DeptCard({ name, score, details, href, accent, icon: Icon }: {
  name: string; score: number; details: string[]; href: string;
  accent: string; icon: React.ComponentType<{ className?: string }>;
}) {
  const s   = Math.round(score);
  const clr = s >= 75 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-rose-400';
  const bar = s >= 75 ? 'bg-emerald-500'   : s >= 50 ? 'bg-amber-500'   : 'bg-rose-500';
  const rng = s >= 75 ? 'border-emerald-500/25 bg-emerald-900/8'
            : s >= 50 ? 'border-amber-500/25  bg-amber-900/8'
            :            'border-rose-500/25   bg-rose-900/8';

  return (
    <Link href={href} className={`rounded-xl border p-4 block hover:brightness-110 transition-all ${rng}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${accent} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-slate-300 flex-1 leading-tight">{name}</span>
        <span className={`text-xl font-black tabular-nums ${clr}`}>{s}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2.5">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${s}%` }} />
      </div>
      {details.slice(0, 2).map((d, i) => (
        <p key={i} className="text-[10px] text-slate-600 truncate">{d}</p>
      ))}
    </Link>
  );
}

// ─── Escalation Row ───────────────────────────────────────────────────────────

const ENTITY_AR: Record<string, string> = {
  purchase_request: 'طلب شراء', purchase_order: 'أمر شراء',
  contract: 'عقد', work_order: 'أمر عمل', leave_request: 'طلب إجازة',
  expense: 'مصروف', project: 'مشروع', invoice: 'فاتورة',
};

function EscRow({ item }: { item: ApprovalItem }) {
  const h = hoursAgo(item.created_at);
  const isCrit = h >= 72;
  const isHigh = h >= 24 && h < 72;
  const rowCls = isCrit ? 'border-rose-500/30 bg-rose-900/15'
               : isHigh ? 'border-amber-500/30 bg-amber-900/15'
               :           'border-slate-700 bg-slate-800/40';
  const ageCls = isCrit ? 'text-rose-400 font-bold' : isHigh ? 'text-amber-400 font-semibold' : 'text-slate-500';
  const badge  = isCrit ? { txt: '+72h', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' }
               : isHigh  ? { txt: 'يحتاج قراراً', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
               :            { txt: 'جديد', cls: 'bg-slate-700 text-slate-400 border-slate-600' };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${rowCls}`}>
      {isCrit ? <Flame   className="w-4 h-4 text-rose-400  shrink-0" />
      : isHigh ? <Timer  className="w-4 h-4 text-amber-400 shrink-0" />
      :          <CircleDot className="w-4 h-4 text-slate-500 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
          {item.title || ENTITY_AR[item.entity_type] || item.entity_type}
        </p>
        {item.requester_name && (
          <p className="text-[11px] text-slate-500">{item.requester_name}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.txt}</span>
        <span className={`text-[10px] ${ageCls}`}>{formatAge(item.created_at)}</span>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SHead({ icon: Icon, title, sub, accent, count }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; sub?: string; accent: string; count?: number;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${accent}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <h2 className="text-sm font-bold text-slate-100">{title}</h2>
        {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
      </div>
      {!!count && (
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">{count}</span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

export default function GMOfficePage() {
  const [exec,      setExec]      = useState<ExecData | null>(null);
  const [ops,       setOps]       = useState<OpsProject[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true); setErr('');

    try {
      const h = getAuthHeaders();
      const [er, or, ar] = await Promise.allSettled([
        fetch('/api/v1/gov-reports/executive',     { headers: h, signal: ctrl.signal }),
        fetch('/api/v1/gov-reports/operations',    { headers: h, signal: ctrl.signal }),
        fetch('/api/v1/approval/requests/pending', { headers: h, signal: ctrl.signal }),
      ]);

      if (er.status === 'fulfilled') {
        if (er.value.ok) {
          setExec(await er.value.json());
        } else {
          const d = await er.value.json().catch(() => ({}));
          throw new Error(d?.detail ?? d?.message ?? `خطأ ${er.value.status}`);
        }
      }
      if (or.status === 'fulfilled' && or.value.ok) {
        const d = await or.value.json();
        setOps(d?.projects_breakdown ?? []);
      }
      if (ar.status === 'fulfilled' && ar.value.ok) {
        const d = await ar.value.json();
        setApprovals(d?.pending ?? (Array.isArray(d) ? d : []));
      }

      setUpdatedAt(new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }));
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120_000);
    return () => { clearInterval(t); abort.current?.abort(); };
  }, [load]);

  // ── derived data ───────────────────────────────────────────────────────────

  const { critApprovals, highApprovals, normApprovals } = useMemo(() => ({
    critApprovals: approvals.filter(a => hoursAgo(a.created_at) >= 72),
    highApprovals: approvals.filter(a => hoursAgo(a.created_at) >= 24 && hoursAgo(a.created_at) < 72),
    normApprovals: approvals.filter(a => hoursAgo(a.created_at) < 24),
  }), [approvals]);

  const atRisk = useMemo(() =>
    ops.filter(p => p.status === 'on_hold' || p.status === 'delayed').slice(0, 3),
  [ops]);

  // ── Risk signal (ISO 31000) ────────────────────────────────────────────────
  const { riskSig, riskItems } = useMemo(() => {
    if (!exec) return { riskSig: 'grey' as Signal, riskItems: [] as string[] };
    const items: string[] = [];
    const cr = exec.revenue.total_invoiced > 0
      ? exec.revenue.total_collected / exec.revenue.total_invoiced : 1;
    const bu = exec.projects.total_budget > 0
      ? exec.journal_entries.total_debit / exec.projects.total_budget : 0;

    if (exec.revenue.overdue_invoices > 0)   items.push(`${exec.revenue.overdue_invoices} فاتورة متأخرة`);
    if (cr < 0.5)                            items.push(`تحصيل ${(cr*100).toFixed(0)}% فقط`);
    if (exec.projects.on_hold > 0)           items.push(`${exec.projects.on_hold} مشروع متوقف`);
    if (bu > 0.9)                            items.push(`استنزاف ميزانية ${(bu*100).toFixed(0)}%`);
    if (critApprovals.length > 0)            items.push(`${critApprovals.length} موافقة متأخرة +72h`);
    if (exec.fleet.total_vehicles > 0 &&
        exec.fleet.maintenance_vehicles / exec.fleet.total_vehicles > 0.35)
                                             items.push('أسطول: صيانة عالية');

    const s: Signal = items.length >= 4 ? 'red' : items.length >= 1 ? 'amber' : 'green';
    return { riskSig: s, riskItems: items };
  }, [exec, critApprovals]);

  // ── Overall health ────────────────────────────────────────────────────────
  const overallHealth = useMemo(() => {
    if (!exec) return null;
    const cr  = exec.revenue.total_invoiced > 0 ? pctNum(exec.revenue.total_collected, exec.revenue.total_invoiced) : 100;
    const fl  = exec.fleet.total_vehicles > 0  ? pctNum(exec.fleet.active_vehicles, exec.fleet.total_vehicles)     : 100;
    const apr = (exec.approvals.approved + exec.approvals.rejected) > 0
      ? pctNum(exec.approvals.approved, exec.approvals.approved + exec.approvals.rejected) : 100;
    const noOvd = exec.revenue.overdue_invoices === 0 ? 100 : Math.max(0, 100 - exec.revenue.overdue_invoices * 20);
    const proj  = exec.projects.total > 0
      ? pctNum(exec.projects.active + exec.projects.completed, exec.projects.total) : 100;
    return Math.round((cr * 0.25 + fl * 0.20 + apr * 0.20 + noOvd * 0.20 + proj * 0.15));
  }, [exec]);

  // ── Hero KPIs ─────────────────────────────────────────────────────────────
  const heroKpis = useMemo(() => {
    if (!exec) return [];
    const cr = exec.revenue.total_invoiced > 0
      ? pctNum(exec.revenue.total_collected, exec.revenue.total_invoiced) : 0;
    const fl = exec.fleet.total_vehicles > 0
      ? pctNum(exec.fleet.active_vehicles, exec.fleet.total_vehicles) : 100;
    return [
      {
        label: 'المشاريع النشطة',
        value: String(exec.projects.active),
        sub:   `إجمالي ${exec.projects.total} | ميزانية ${fmt(exec.projects.total_budget, 'د.ل')}`,
        signal: (exec.projects.active > 0 ? 'green' : 'grey') as Signal,
        href: '/dashboard/admin-gateway/projects/list',
        icon: Briefcase,
        trend: 'up' as const,
      },
      {
        label: 'معدل التحصيل',
        value: pct(exec.revenue.total_collected, exec.revenue.total_invoiced),
        sub:   `محصّل ${fmt(exec.revenue.total_collected, 'د.ل')} من ${fmt(exec.revenue.total_invoiced, 'د.ل')}`,
        signal: sig(cr, 75, 50),
        href: '/dashboard/admin-gateway/revenue',
        icon: DollarSign,
        trend: cr >= 70 ? 'up' as const : 'down' as const,
      },
      {
        label: 'قيمة العقود النشطة',
        value: fmt(exec.contracts.total_value, 'د.ل'),
        sub:   `${exec.contracts.active} عقد نشط من ${exec.contracts.total}`,
        signal: (exec.contracts.active > 0 ? 'green' : 'grey') as Signal,
        href: '/dashboard/admin-gateway/contracts',
        icon: FileText,
        trend: 'flat' as const,
      },
      {
        label: 'الموظفون',
        value: String(exec.employees.total),
        sub:   'إجمالي القوى العاملة المسجّلة',
        signal: (exec.employees.total > 0 ? 'green' : 'grey') as Signal,
        href: '/dashboard/admin-gateway/hr/employees',
        icon: Users,
        trend: 'flat' as const,
      },
      {
        label: 'توافر الأسطول',
        value: pct(exec.fleet.active_vehicles, exec.fleet.total_vehicles),
        sub:   `${exec.fleet.active_vehicles} نشط | ${exec.fleet.maintenance_vehicles} صيانة`,
        signal: exec.fleet.total_vehicles === 0 ? 'grey' as Signal : sig(fl, 75, 50),
        href: '/dashboard/admin-gateway/vehicles',
        icon: Truck,
        trend: fl >= 70 ? 'up' as const : 'down' as const,
      },
      {
        label: 'الفواتير المتأخرة',
        value: String(exec.revenue.overdue_invoices),
        sub:   exec.revenue.overdue_invoices > 0
          ? `مستحق ${fmt(exec.revenue.total_outstanding, 'د.ل')}`
          : 'لا توجد فواتير متأخرة',
        signal: sigBelow(exec.revenue.overdue_invoices, 2, 5),
        href: '/dashboard/admin-gateway/revenue',
        icon: AlertTriangle,
        trend: exec.revenue.overdue_invoices === 0 ? 'up' as const : 'down' as const,
      },
    ];
  }, [exec]);

  // ── BSC perspectives ───────────────────────────────────────────────────────
  const bsc = useMemo(() => {
    if (!exec) return null;
    const cr  = exec.revenue.total_invoiced > 0 ? pctNum(exec.revenue.total_collected, exec.revenue.total_invoiced) : 0;
    const bu  = exec.projects.total_budget > 0  ? pctNum(exec.journal_entries.total_debit, exec.projects.total_budget) : 0;
    const apr = (exec.approvals.approved + exec.approvals.rejected) > 0
      ? pctNum(exec.approvals.approved, exec.approvals.approved + exec.approvals.rejected) : 100;
    const fl  = exec.fleet.total_vehicles > 0 ? pctNum(exec.fleet.active_vehicles, exec.fleet.total_vehicles) : 100;

    return [
      {
        perspective: '① المالي',
        color: 'text-amber-400',
        border: 'border-amber-900/30',
        cells: [
          { label: 'معدل التحصيل',      value: pct(exec.revenue.total_collected, exec.revenue.total_invoiced), sub: `${fmt(exec.revenue.total_collected,'د.ل')} محصّل`,   signal: sig(cr, 75, 50),   href: '/dashboard/admin-gateway/revenue'           },
          { label: 'استخدام الميزانية', value: bu > 0 ? `${bu.toFixed(0)}%` : 'لم يُسجَّل بعد',               sub: `ميزانية ${fmt(exec.projects.total_budget,'د.ل')}`, signal: bu===0?'grey' as Signal : bu<=80?'green' as Signal : bu<=95?'amber' as Signal : 'red' as Signal, href: '/dashboard/admin-gateway/finance/budgets' },
          { label: 'قيمة العقود',        value: fmt(exec.contracts.total_value,'د.ل'),                          sub: `${exec.contracts.active} عقد نشط`,                  signal: (exec.contracts.active>0?'green':'grey') as Signal, href: '/dashboard/admin-gateway/contracts' },
          { label: 'فواتير متأخرة',      value: String(exec.revenue.overdue_invoices),                          sub: exec.revenue.overdue_invoices>0 ? `${fmt(exec.revenue.total_outstanding,'د.ل')} مستحق` : 'لا متأخرات', signal: sigBelow(exec.revenue.overdue_invoices, 1, 3), href: '/dashboard/admin-gateway/revenue' },
        ],
      },
      {
        perspective: '② التشغيلي',
        color: 'text-cyan-400',
        border: 'border-cyan-900/30',
        cells: [
          { label: 'مشاريع نشطة',  value: String(exec.projects.active),    sub: `${exec.projects.completed} مكتمل`,     signal: (exec.projects.active>0?'green':'grey') as Signal,  href: '/dashboard/admin-gateway/projects/list'         },
          { label: 'متوقف',        value: String(exec.projects.on_hold),    sub: exec.projects.on_hold>0?'تحتاج تدخلاً':'لا مشاريع متوقفة', signal: sigBelow(exec.projects.on_hold, 1, 3), href: '/dashboard/admin-gateway/projects/list'         },
          { label: 'توافر الأسطول', value: exec.fleet.total_vehicles>0 ? pct(exec.fleet.active_vehicles,exec.fleet.total_vehicles) : '—', sub: `${exec.fleet.maintenance_vehicles} في صيانة`, signal: exec.fleet.total_vehicles===0?'grey' as Signal : sig(fl,75,50), href: '/dashboard/admin-gateway/vehicles' },
          { label: 'المخزون',       value: fmt(exec.inventory.total_received_value,'د.ل'), sub: `صادر ${fmt(exec.inventory.total_issued_value,'د.ل')}`, signal: 'green' as Signal, href: '/dashboard/admin-gateway/inventory' },
        ],
      },
      {
        perspective: '③ الحوكمة',
        color: 'text-violet-400',
        border: 'border-violet-900/30',
        cells: [
          { label: 'موافقات معلقة', value: String(exec.approvals.pending),  sub: approvals.length>0?`أقدمها ${formatAge(approvals.reduce((a,b)=>hoursAgo(a.created_at)>hoursAgo(b.created_at)?a:b).created_at)}`:'لا موافقات معلقة', signal: sigBelow(exec.approvals.pending,3,8), href: '/dashboard/admin-gateway/workflow/approvals' },
          { label: 'معدل الاعتماد', value: (exec.approvals.approved+exec.approvals.rejected)>0 ? pct(exec.approvals.approved,exec.approvals.approved+exec.approvals.rejected) : '—', sub: `${exec.approvals.approved} معتمد / ${exec.approvals.rejected} مرفوض`, signal: apr>=0&&(exec.approvals.approved+exec.approvals.rejected)===0?'grey' as Signal : sig(apr,70,50), href: '/dashboard/admin-gateway/workflow' },
          { label: 'عقود في صياغة', value: String(exec.contracts.draft),    sub: exec.contracts.draft>0?'تحتاج اعتماداً':'لا عقود معلقة',   signal: sigBelow(exec.contracts.draft,1,3),  href: '/dashboard/admin-gateway/contracts'           },
          { label: 'قيود مسودة',    value: String(exec.journal_entries.draft), sub: `${exec.journal_entries.posted} مرحّل`,                  signal: sigBelow(exec.journal_entries.draft,5,10), href: '/dashboard/admin-gateway/accounting'       },
        ],
      },
      {
        perspective: '④ الموارد والنمو',
        color: 'text-emerald-400',
        border: 'border-emerald-900/30',
        cells: [
          { label: 'الموظفون',         value: String(exec.employees.total),            sub: 'إجمالي القوى العاملة',            signal: (exec.employees.total>0?'green':'grey') as Signal, href: '/dashboard/admin-gateway/hr/employees'  },
          { label: 'أوامر شراء منجزة', value: exec.procurement.po_total>0 ? pct(exec.procurement.po_completed,exec.procurement.po_total) : '—', sub: exec.procurement.po_total>0 ? `${exec.procurement.po_completed}/${exec.procurement.po_total}` : 'لا بيانات',                                       signal: exec.procurement.po_total===0?'grey' as Signal : sig(pctNum(exec.procurement.po_completed,exec.procurement.po_total),70,50), href: '/dashboard/admin-gateway/procurement' },
          { label: 'طلبات شراء معلقة', value: exec.procurement.pr_total>0 ? String(exec.procurement.pr_pending) : '—',       sub: exec.procurement.pr_total>0 ? `من ${exec.procurement.pr_total} طلب` : 'لا بيانات',   signal: exec.procurement.pr_total===0?'grey' as Signal : sigBelow(exec.procurement.pr_pending,3,8), href: '/dashboard/admin-gateway/procurement'    },
          { label: 'المعدات النشطة',   value: exec.fleet.total_equipment>0 ? `${exec.fleet.active_equipment}/${exec.fleet.total_equipment}` : '—', sub: exec.fleet.total_equipment>0?'معدات بحالة التشغيل':'لا بيانات معدات', signal: exec.fleet.total_equipment===0?'grey' as Signal : sig(pctNum(exec.fleet.active_equipment,exec.fleet.total_equipment),70,50), href: '/dashboard/admin-gateway/vehicles'  },
        ],
      },
    ];
  }, [exec, approvals]);

  // ── Dept health ────────────────────────────────────────────────────────────
  const deptHealth = useMemo(() => {
    if (!exec) return [];
    const cr  = exec.revenue.total_invoiced>0 ? exec.revenue.total_collected/exec.revenue.total_invoiced : 1;
    const bu  = exec.projects.total_budget>0  ? exec.journal_entries.total_debit/exec.projects.total_budget : 0;
    const apr = (exec.approvals.approved+exec.approvals.rejected)>0
      ? exec.approvals.approved/(exec.approvals.approved+exec.approvals.rejected) : 1;
    const fl  = exec.fleet.total_vehicles>0 ? (exec.fleet.total_vehicles-exec.fleet.maintenance_vehicles)/exec.fleet.total_vehicles : 1;
    const noOvd = exec.revenue.overdue_invoices===0?1:Math.max(0,1-exec.revenue.overdue_invoices*0.15);

    return [
      { name:'الشؤون الإدارية', icon:Shield,      score:Math.min(100,Math.round(apr*40 + (exec.contracts.draft===0?1:.6)*30 + (exec.approvals.pending<=5?1:.5)*30)), details:[`اعتماد ${(apr*100).toFixed(0)}%`,`موافقات معلقة: ${exec.approvals.pending}`], href:'/dashboard/admin-gateway',                  accent:'border-blue-500/40 bg-blue-900/20 text-blue-400' },
      { name:'المالية',          icon:DollarSign,  score:Math.min(100,Math.round(cr*.40*100 + (1-Math.min(bu,1))*.35*100 + noOvd*.25*100)), details:[`تحصيل ${(cr*100).toFixed(0)}%`,`ميزانية ${(bu*100).toFixed(0)}% مستخدمة`], href:'/dashboard/admin-gateway/finance/budgets', accent:'border-amber-500/40 bg-amber-900/20 text-amber-400' },
      { name:'المشاريع',         icon:Briefcase,   score:Math.min(100,Math.round((exec.projects.total>0?(exec.projects.active/exec.projects.total):1)*.45*100 + (exec.projects.on_hold===0?1:Math.max(0,1-exec.projects.on_hold*.2))*.35*100 + (exec.projects.completed/Math.max(exec.projects.total,1))*.2*100)), details:[`${exec.projects.active}/${exec.projects.total} نشط`,`متوقف: ${exec.projects.on_hold}`], href:'/dashboard/admin-gateway/projects/list', accent:'border-purple-500/40 bg-purple-900/20 text-purple-400' },
      { name:'الأسطول',          icon:Truck,       score:exec.fleet.total_vehicles===0?70:Math.min(100,Math.round(fl*.5*100 + (exec.fleet.active_equipment/Math.max(exec.fleet.total_equipment,1))*.5*100)),             details:[`توافر ${(fl*100).toFixed(0)}%`,`صيانة: ${exec.fleet.maintenance_vehicles}`],                                                                                                                                                                                            href:'/dashboard/admin-gateway/vehicles',          accent:'border-cyan-500/40 bg-cyan-900/20 text-cyan-400' },
      { name:'المشتريات',        icon:ShoppingCart,score:exec.procurement.po_total===0?75:Math.min(100,Math.round((exec.procurement.po_completed/Math.max(exec.procurement.po_total,1))*.4*100 + (exec.procurement.pr_pending===0?1:Math.max(0,1-exec.procurement.pr_pending*.1))*.6*100)), details:exec.procurement.po_total>0?[`معلق ${exec.procurement.pr_pending}`,`منجز ${exec.procurement.po_completed}/${exec.procurement.po_total}`]:['لا بيانات مشتريات'],                                       href:'/dashboard/admin-gateway/procurement',       accent:'border-orange-500/40 bg-orange-900/20 text-orange-400' },
      { name:'الموارد البشرية',  icon:Users,       score:Math.min(100, (exec.employees.total>0?70:30) + (exec.approvals.pending===0?20:Math.max(0,20-exec.approvals.pending)) + 10),                                     details:[`${exec.employees.total} موظف`],                                                                                                                                                                                                                                              href:'/dashboard/admin-gateway/hr/employees',      accent:'border-emerald-500/40 bg-emerald-900/20 text-emerald-400' },
    ];
  }, [exec]);

  // ── MBO targets ────────────────────────────────────────────────────────────
  const mboItems = useMemo(() => {
    if (!exec) return [];
    return [
      { label:'معدل التحصيل',         actual:exec.revenue.total_invoiced>0?pctNum(exec.revenue.total_collected,exec.revenue.total_invoiced):0,    target:80, href:'/dashboard/admin-gateway/revenue' },
      { label:'توافر الأسطول',         actual:exec.fleet.total_vehicles>0?pctNum(exec.fleet.active_vehicles,exec.fleet.total_vehicles):100,         target:80, href:'/dashboard/admin-gateway/vehicles' },
      { label:'كفاءة الموافقات',       actual:(exec.approvals.approved+exec.approvals.rejected)>0?pctNum(exec.approvals.approved,exec.approvals.approved+exec.approvals.rejected):100, target:85, href:'/dashboard/admin-gateway/workflow/approvals' },
      { label:'استخدام الميزانية',     actual:exec.projects.total_budget>0?pctNum(exec.journal_entries.total_debit,exec.projects.total_budget):0,    target:85, invert:true, href:'/dashboard/admin-gateway/finance/budgets' },
      { label:'إنجاز أوامر الشراء',    actual:exec.procurement.po_total>0?pctNum(exec.procurement.po_completed,exec.procurement.po_total):100,       target:75, href:'/dashboard/admin-gateway/procurement' },
      { label:'المشاريع النشطة/الكلي', actual:exec.projects.total>0?pctNum(exec.projects.active,exec.projects.total):0,                              target:60, href:'/dashboard/admin-gateway/projects/list' },
    ] as { label: string; actual: number; target: number; invert?: boolean; href?: string }[];
  }, [exec]);

  // ─────────────────────────────────────────────────────────────────────────────
  const RISK_LABEL = { green:'مستقر', amber:'يحتاج متابعة', red:'حرج', grey:'...' };

  return (
    <div className="min-h-screen bg-[#06091a] text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/25 via-amber-700/15 to-transparent border border-amber-500/35 flex items-center justify-center shadow-lg shadow-amber-900/20">
              <Crown className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-amber-500/70 tracking-widest uppercase">الإدارة العليا</p>
              <h1 className="text-2xl font-black text-white leading-tight">مكتب المدير العام</h1>
              <p className="text-[11px] text-slate-600">مركز القيادة الاستراتيجي — BSC · ISO 31000 · MBO</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* overall health pill */}
            {overallHealth !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/50 text-xs font-semibold">
                <HeartPulse className={`w-3.5 h-3.5 ${overallHealth>=70?'text-emerald-400':overallHealth>=50?'text-amber-400':'text-rose-400'}`} />
                <span className="text-slate-400">صحة المنظومة:</span>
                <strong className={overallHealth>=70?'text-emerald-400':overallHealth>=50?'text-amber-400':'text-rose-400'}>{overallHealth}%</strong>
              </div>
            )}
            {/* risk pill */}
            {exec && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${RING[riskSig]}`}>
                <span className={`w-2 h-2 rounded-full ${DOT[riskSig]}`} />
                <span className={TEXT[riskSig]}>المخاطر: {RISK_LABEL[riskSig]}</span>
              </div>
            )}
            {/* critical approvals badge */}
            {critApprovals.length > 0 && (
              <Link href="/dashboard/admin-gateway/workflow/approvals"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-500/40 bg-rose-900/20 text-xs font-semibold text-rose-300 animate-pulse hover:animate-none hover:bg-rose-900/30">
                <Bell className="w-3.5 h-3.5" />
                {critApprovals.length} قرار متأخر
              </Link>
            )}
            {/* refresh */}
            <button onClick={load} disabled={loading}
              className="p-2 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-700 transition-colors">
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading?'animate-spin':''}`} />
            </button>
            {updatedAt && <span className="text-[10px] text-slate-700 hidden sm:block">تحديث: {updatedAt}</span>}
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {err && (
          <div className="flex items-start gap-3 p-4 bg-rose-900/20 border border-rose-500/30 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-300">تعذّر تحميل البيانات</p>
              <p className="text-xs text-rose-500 mt-0.5">{err}</p>
              <button onClick={load} className="mt-2 text-xs text-rose-400 underline hover:text-rose-300">إعادة المحاولة</button>
            </div>
          </div>
        )}

        {/* ── Risk factors bar ─────────────────────────────────────────── */}
        {riskItems.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 py-3 bg-amber-900/10 border border-amber-500/20 rounded-xl">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 ml-1">
              <AlertTriangle className="w-3.5 h-3.5" /> عوامل المخاطرة النشطة:
            </span>
            {riskItems.map((r, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-900/20 text-amber-300">{r}</span>
            ))}
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────── */}
        {loading && !exec && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({length:6}).map((_,i) => (
              <div key={i} className="h-32 rounded-2xl bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 1. HERO KPIs                                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {heroKpis.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {heroKpis.map((k, i) => <HeroKpi key={i} {...k} />)}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 2. ESCALATION PANEL (only when there are issues)               */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {(approvals.length > 0 || atRisk.length > 0) && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5">
            <SHead icon={Flame} title="قائمة التصعيد"
              sub="مرتبة حسب العمر — يستوجب قراراً"
              accent="border-rose-500/40 bg-rose-900/20 text-rose-400"
              count={critApprovals.length + highApprovals.length || undefined} />

            <div className="grid md:grid-cols-2 gap-4">
              {/* Approvals list */}
              <div>
                <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider mb-2">
                  الموافقات المعلقة ({approvals.length})
                </p>
                {approvals.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/10 border border-emerald-500/20 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" /><span>لا توجد موافقات معلقة</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {[...critApprovals, ...highApprovals, ...normApprovals].slice(0, 8).map(a => (
                      <EscRow key={a.id} item={a} />
                    ))}
                    {approvals.length > 8 && (
                      <Link href="/dashboard/admin-gateway/workflow/approvals"
                        className="flex items-center justify-center gap-2 p-2 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800">
                        عرض الكل ({approvals.length}) <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* At-risk projects */}
              <div>
                <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider mb-2">
                  مشاريع تحتاج تدخلاً
                </p>
                {atRisk.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/10 border border-emerald-500/20 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" /><span>كل المشاريع تسير بشكل طبيعي</span>
                  </div>
                ) : atRisk.map(p => (
                  <Link key={p.id} href="/dashboard/admin-gateway/projects/list"
                    className="flex items-center justify-between p-3 mb-2 rounded-xl bg-rose-900/10 border border-rose-500/20 hover:bg-rose-900/20 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                      <p className="text-[11px] text-slate-500">{p.code}</p>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-rose-500/30 text-rose-400 bg-rose-900/20">
                      {p.status === 'on_hold' ? 'متوقف' : 'متأخر'}
                    </span>
                  </Link>
                ))}
                <Link href="/dashboard/admin-gateway/workflow/approvals"
                  className="flex items-center justify-between w-full p-3 rounded-xl border border-amber-500/25 bg-amber-900/10 hover:bg-amber-900/20 text-amber-300 text-sm font-semibold transition-colors mt-2">
                  <span>فتح لوحة الموافقات</span><ChevronLeft className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 3. BALANCED SCORECARD                                          */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {bsc && (
          <div>
            <SHead icon={BarChart3} title="بطاقة الأداء المتوازن (BSC)"
              sub="4 منظورات استراتيجية — إشارات ضوئية مباشرة من البيانات"
              accent="border-indigo-500/40 bg-indigo-900/20 text-indigo-400" />
            <div className="space-y-3">
              {bsc.map(({ perspective, color, border, cells }) => (
                <div key={perspective} className={`p-4 rounded-xl border bg-slate-900/30 ${border}`}>
                  <p className={`text-xs font-bold mb-3 ${color}`}>{perspective}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {cells.map((c, i) => <BscCell key={i} {...c} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 4. DEPARTMENT HEALTH                                           */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {deptHealth.length > 0 && (
          <div>
            <SHead icon={HeartPulse} title="صحة الإدارات"
              sub="درجة 0-100 محسوبة من مؤشرات أداء حقيقية"
              accent="border-teal-500/40 bg-teal-900/20 text-teal-400" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {deptHealth.map((d, i) => <DeptCard key={i} {...d} />)}
            </div>
            <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-700">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥75 ممتاز</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500  inline-block" /> 50-74 مقبول</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500   inline-block" /> &lt;50 يحتاج تدخل</span>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 5. MBO — PERFORMANCE VS TARGET                                */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {mboItems.length > 0 && exec && (
          <div>
            <SHead icon={Gauge} title="الأداء مقابل الأهداف (MBO)"
              sub="الأهداف القياسية للمؤسسة — يمكن تعديلها من إعدادات النظام"
              accent="border-sky-500/40 bg-sky-900/20 text-sky-400" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {mboItems.map((m, i) => (
                <MboGauge key={i} label={m.label}
                  actual={parseFloat(m.actual.toFixed(1))}
                  target={m.target} invert={m.invert} href={m.href} />
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 6. DAILY BRIEFING                                             */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-5">
          <SHead icon={Newspaper} title="الإحاطة الذكية اليومية"
            sub="ملخص تنفيذي مولّد آلياً من البيانات الحية"
            accent="border-fuchsia-500/40 bg-fuchsia-900/20 text-fuchsia-400" />
          <div className="grid md:grid-cols-3 gap-3">
            <Link href="/dashboard/admin-gateway/intelligence/briefing"
              className="md:col-span-2 flex items-start gap-4 p-5 rounded-xl border border-fuchsia-500/20 bg-fuchsia-900/10 hover:bg-fuchsia-900/20 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center shrink-0">
                <Newspaper className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <p className="font-bold text-slate-200 mb-1">فتح الإحاطة التنفيذية الكاملة</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  تقرير سردي عربي شامل — يغطي المالية، المشاريع، المخاطر والتوصيات.
                  مولّد تلقائياً من البيانات بدون نصوص مكتوبة مسبقاً.
                </p>
                <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-fuchsia-400">
                  اقرأ الإحاطة <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
            <div className="space-y-2">
              {[
                { href:'/dashboard/admin-gateway/intelligence/risk',        icon:AlertTriangle, label:'تقرير المخاطر',  cls:'border-rose-500/20 bg-rose-900/10 hover:bg-rose-900/20 text-rose-300' },
                { href:'/dashboard/admin-gateway/intelligence/forecast',    icon:TrendingUp,    label:'التوقعات',       cls:'border-cyan-500/20 bg-cyan-900/10 hover:bg-cyan-900/20 text-cyan-300' },
                { href:'/dashboard/admin-gateway/intelligence/performance', icon:Activity,      label:'تحليل الأداء',  cls:'border-emerald-500/20 bg-emerald-900/10 hover:bg-emerald-900/20 text-emerald-300' },
              ].map(({ href, icon: Icon, label, cls }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-sm transition-colors ${cls}`}>
                  <Icon className="w-4 h-4 shrink-0" /><span>{label}</span>
                  <ChevronLeft className="w-3.5 h-3.5 mr-auto" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 7. STRATEGIC TOOLS HUB                                        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div>
          <SHead icon={Brain} title="مركز الأدوات الاستراتيجية"
            sub="وصول سريع لجميع الوحدات"
            accent="border-indigo-500/40 bg-indigo-900/20 text-indigo-400" />

          {/* Top tool links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
            {[
              { href:'/dashboard/command-center',                           label:'مركز القيادة',        icon:BarChart3,    color:'border-indigo-500/35 bg-indigo-900/15 text-indigo-300'  },
              { href:'/dashboard/admin-gateway/intelligence/briefing',      label:'الإحاطة الذكية',      icon:FileText,     color:'border-violet-500/35 bg-violet-900/15 text-violet-300'  },
              { href:'/dashboard/admin-gateway/intelligence/risk',          label:'إدارة المخاطر',       icon:AlertTriangle,color:'border-rose-500/35 bg-rose-900/15 text-rose-300',     extra: riskItems.length },
              { href:'/dashboard/admin-gateway/intelligence/command',       label:'القيادة الذكية',      icon:Zap,          color:'border-amber-500/35 bg-amber-900/15 text-amber-300'    },
              { href:'/dashboard/admin-gateway/intelligence/forecast',      label:'التوقعات',            icon:TrendingUp,   color:'border-cyan-500/35 bg-cyan-900/15 text-cyan-300'       },
              { href:'/dashboard/admin-gateway/platform-intelligence',      label:'الذكاء التنبؤي',     icon:Brain,        color:'border-fuchsia-500/35 bg-fuchsia-900/15 text-fuchsia-300' },
              { href:'/dashboard/admin-gateway/reports/executive',          label:'التقارير التنفيذية',  icon:BarChart3,    color:'border-sky-500/35 bg-sky-900/15 text-sky-300'          },
              { href:'/dashboard/admin-gateway/workflow/approvals',         label:'الموافقات',           icon:CheckCircle2, color:'border-green-500/35 bg-green-900/15 text-green-300',  extra: approvals.length },
              { href:'/dashboard/ai-assistant',                             label:'المساعد الذكي',       icon:Brain,        color:'border-purple-500/35 bg-purple-900/15 text-purple-300' },
              { href:'/dashboard/gis-sovereignty/engineering-workspace',    label:'السيادة الجغرافية',   icon:MapPin,       color:'border-teal-500/35 bg-teal-900/15 text-teal-300'       },
              { href:'/dashboard/admin-gateway/intelligence/performance',   label:'تحليل الأداء',        icon:Target,       color:'border-emerald-500/35 bg-emerald-900/15 text-emerald-300' },
              { href:'/dashboard/admin-gateway/org-structure',              label:'الهيكل التنظيمي',     icon:Building2,    color:'border-slate-600/35 bg-slate-800/50 text-slate-300'    },
            ].map(({ href, label, icon: Icon, color, extra }) => (
              <Link key={href} href={href}
                className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all hover:scale-[1.02] ${color}`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="leading-tight text-xs">{label}</span>
                {!!extra && (
                  <span className="absolute -top-1.5 -left-1.5 bg-rose-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                    {extra}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Secondary nav */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { href:'/dashboard/admin-gateway/hr/employees',            label:'الموارد البشرية', icon:Users,        color:'border-blue-500/35 bg-blue-900/15 text-blue-300'     },
              { href:'/dashboard/admin-gateway/projects/list',           label:'المشاريع',         icon:Briefcase,    color:'border-purple-500/35 bg-purple-900/15 text-purple-300' },
              { href:'/dashboard/admin-gateway/finance/budgets',         label:'الميزانية',        icon:DollarSign,   color:'border-amber-500/35 bg-amber-900/15 text-amber-300'   },
              { href:'/dashboard/admin-gateway/contracts',               label:'العقود',           icon:FileText,     color:'border-indigo-500/35 bg-indigo-900/15 text-indigo-300' },
              { href:'/dashboard/admin-gateway/maintenance/work-orders', label:'الصيانة',          icon:Wrench,       color:'border-rose-500/35 bg-rose-900/15 text-rose-300'      },
              { href:'/dashboard/admin-gateway/assets/registry',         label:'الأصول',           icon:Package,      color:'border-teal-500/35 bg-teal-900/15 text-teal-300'      },
              { href:'/dashboard/admin-gateway/procurement',             label:'المشتريات',        icon:ShoppingCart, color:'border-orange-500/35 bg-orange-900/15 text-orange-300' },
              { href:'/dashboard/admin-gateway/vehicles',                label:'الأسطول',          icon:Truck,        color:'border-cyan-500/35 bg-cyan-900/15 text-cyan-300'       },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link key={href} href={href}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all hover:scale-[1.02] ${color}`}>
                <Icon className="w-4 h-4 shrink-0" /><span>{label}</span>
                <ExternalLink className="w-3 h-3 opacity-30 mr-auto" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/60 text-[10px] text-slate-700">
          <span>معايير: BSC · ISO 31000 · ISO 55001 · PMBOK 7th Ed. · IFRS · MBO</span>
          <span>تحديث تلقائي كل 120 ثانية</span>
          {exec?.generated_at && (
            <span>بيانات بتاريخ: {new Date(exec.generated_at).toLocaleString('ar-LY', { dateStyle:'short', timeStyle:'short' })}</span>
          )}
        </div>

      </div>
    </div>
  );
}
