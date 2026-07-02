'use client';

/**
 * مكتب المدير العام — GM Strategic Command Center
 * ═══════════════════════════════════════════════════════════════
 * المعايير الدولية المطبّقة:
 *   • BSC  (Balanced Scorecard)    — 4 منظورات استراتيجية
 *   • ISO 31000                    — إدارة المخاطر وعوامل التصعيد
 *   • ISO 55001                    — إدارة الأصول
 *   • PMBOK 7th Ed.                — KPIs إدارة المشاريع
 *   • IFRS                         — التقارير المالية
 *   • KPIs vs Targets (MBO)        — الأداء مقابل الأهداف
 *
 * الميزات بالترتيب حسب الأهمية:
 *   1. تصعيد الموافقات
 *   2. بطاقة الأداء المتوازن BSC
 *   3. لوحة صحة الإدارات
 *   4. مؤشر الأداء مقابل الأهداف (MBO)
 *   5. الإحاطة الذكية اليومية
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Crown, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Minus, DollarSign, Briefcase,
  Users, Wrench, Shield, BarChart3, Brain, MapPin,
  ChevronLeft, ExternalLink, Activity, Zap, Bell,
  FileText, Target, Building2, Truck, ShoppingCart,
  Gauge, Newspaper, Timer, ArrowRight, Flame,
  HeartPulse, CircleDot,
} from 'lucide-react';

const getTenantId = () =>
  typeof window !== 'undefined' ? (localStorage.getItem('tenant_id') ?? '') : '';

const compact = (v: number | null | undefined): string => {
  if (!v) return '0';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K';
  return String(v);
};

const pct = (n: number, d: number): string =>
  d > 0 ? (n / d * 100).toFixed(0) + '%' : '—';

function hoursAgo(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  return (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
}

function formatAge(dateStr: string | undefined): string {
  const h = hoursAgo(dateStr);
  if (h < 1) return 'أقل من ساعة';
  if (h < 24) return `${Math.floor(h)} ساعة`;
  return `${Math.floor(h / 24)} يوم`;
}

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
  created_at?: string; requester_name?: string; current_level?: number;
}

type Signal = 'green' | 'amber' | 'red' | 'grey';

const SIGNAL_DOT: Record<Signal, string> = {
  green: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
  amber: 'bg-amber-400  shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  red:   'bg-rose-500   shadow-[0_0_8px_rgba(239,68,68,0.7)]',
  grey:  'bg-slate-500',
};

const SIGNAL_RING: Record<Signal, string> = {
  green: 'border-emerald-500/40 bg-emerald-900/20',
  amber: 'border-amber-500/40  bg-amber-900/20',
  red:   'border-rose-500/40   bg-rose-900/20',
  grey:  'border-slate-700     bg-slate-800/40',
};

function TrafficDot({ s }: { s: Signal }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${SIGNAL_DOT[s]}`} />;
}

function SectionHead({ icon: Icon, title, sub, accent, badge }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; sub?: string; accent: string; badge?: string | number;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${accent}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <h2 className="text-sm font-bold text-slate-100">{title}</h2>
        {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
      </div>
      {badge !== undefined && badge !== 0 && (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">{badge}</span>
      )}
    </div>
  );
}

interface BscMetric { label: string; value: string; sub?: string; signal: Signal; href?: string; trend?: 'up' | 'down' | 'flat'; }

function BscCard({ metric }: { metric: BscMetric }) {
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor = metric.trend === 'up' ? 'text-emerald-400' : metric.trend === 'down' ? 'text-rose-400' : 'text-slate-500';
  const inner = (
    <div className={`rounded-xl border p-4 h-full transition-all hover:scale-[1.01] ${SIGNAL_RING[metric.signal]}`}>
      <div className="flex items-start justify-between mb-2">
        <TrafficDot s={metric.signal} />
        <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
      </div>
      <div className="text-xl font-bold text-slate-100 leading-tight">{metric.value}</div>
      <div className="text-xs text-slate-400 mt-1 leading-relaxed">{metric.label}</div>
      {metric.sub && <div className="text-[10px] text-slate-500 mt-0.5">{metric.sub}</div>}
    </div>
  );
  return metric.href ? <Link href={metric.href} className="block h-full">{inner}</Link> : inner;
}

function KpiGauge({ label, actual, target, unit = '%', invert = false, href }: {
  label: string; actual: number; target: number; unit?: string; invert?: boolean; href?: string;
}) {
  const ratio = target > 0 ? Math.min(actual / target, 1.5) : 0;
  const pctBar = Math.min(ratio * 100, 100);
  const isGood = invert ? actual <= target : actual >= target;
  const barColor = isGood ? 'bg-emerald-500' : ratio > 0.75 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = isGood ? 'text-emerald-400' : ratio > 0.75 ? 'text-amber-400' : 'text-rose-400';
  const inner = (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>
          {actual.toFixed(1)}{unit}
          <span className="text-slate-600 font-normal text-[10px]"> / {target}{unit}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pctBar}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-slate-600">
        <span>0</span>
        <span className="text-slate-500">الهدف: {target}{unit}</span>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

interface DeptHealth { name: string; score: number; icon: React.ComponentType<{ className?: string }>; details: string[]; href: string; accent: string; }

function HealthCard({ dept }: { dept: DeptHealth }) {
  const s = dept.score;
  const color = s >= 75 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-rose-400';
  const ring  = s >= 75 ? 'border-emerald-500/30 bg-emerald-900/10' : s >= 50 ? 'border-amber-500/30 bg-amber-900/10' : 'border-rose-500/30 bg-rose-900/10';
  const bar   = s >= 75 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  const Icon = dept.icon;
  return (
    <Link href={dept.href} className={`rounded-xl border p-4 block hover:scale-[1.01] transition-transform ${ring}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${dept.accent}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-semibold text-slate-200 flex-1 truncate">{dept.name}</span>
        <span className={`text-lg font-black ${color}`}>{s}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${s}%` }} />
      </div>
      <div className="space-y-0.5">
        {dept.details.map((d, i) => <p key={i} className="text-[10px] text-slate-500 leading-relaxed">{d}</p>)}
      </div>
    </Link>
  );
}

function QuickLink({ href, label, icon: Icon, color, badge }: {
  href: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string; badge?: number;
}) {
  return (
    <Link href={href} className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all hover:scale-[1.02] ${color}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="leading-tight">{label}</span>
      {(badge ?? 0) > 0 && (
        <span className="absolute -top-1.5 -left-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{badge}</span>
      )}
    </Link>
  );
}

function EscalationRow({ item }: { item: ApprovalItem }) {
  const h = hoursAgo(item.created_at);
  const isCritical = h >= 72;
  const isHigh = h >= 24 && h < 72;
  const levelCls = isCritical ? 'border-rose-500/30 bg-rose-900/15 text-rose-300' : isHigh ? 'border-amber-500/30 bg-amber-900/15 text-amber-300' : 'border-slate-700 bg-slate-800/50 text-slate-300';
  const ageCls = isCritical ? 'text-rose-400 font-bold' : isHigh ? 'text-amber-400 font-semibold' : 'text-slate-500';
  const ageBadge = isCritical ? '⚠ متأخر جداً' : isHigh ? 'يحتاج قراراً' : 'جديد';
  const badgeCls = isCritical ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : isHigh ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-700 text-slate-400 border-slate-600';
  const ENTITY_AR: Record<string, string> = { purchase_request: 'طلب شراء', purchase_order: 'أمر شراء', contract: 'عقد', work_order: 'أمر عمل', leave_request: 'طلب إجازة', expense: 'مصروف', project: 'مشروع', invoice: 'فاتورة' };
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${levelCls}`}>
      {isCritical && <Flame className="w-4 h-4 text-rose-400 shrink-0" />}
      {isHigh && !isCritical && <Timer className="w-4 h-4 text-amber-400 shrink-0" />}
      {!isCritical && !isHigh && <CircleDot className="w-4 h-4 text-slate-500 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{item.title || ENTITY_AR[item.entity_type] || item.entity_type}</p>
        <p className="text-[11px] text-slate-500">{item.requester_name && <span>{item.requester_name} · </span>}{ENTITY_AR[item.entity_type] || item.entity_type}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badgeCls}`}>{ageBadge}</span>
        <span className={`text-[10px] ${ageCls}`}>{formatAge(item.created_at)}</span>
      </div>
    </div>
  );
}

export default function GMOfficePage() {
  const [exec, setExec]         = useState<ExecData | null>(null);
  const [ops, setOps]           = useState<OpsProject[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [lastRefresh, setLastRefresh] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setErr('');
    try {
      const tid = getTenantId();
      const h: Record<string, string> = tid ? { 'X-Tenant-ID': tid } : {};
      const [er, or, ar] = await Promise.allSettled([
        fetch('/api/v1/gov-reports/executive',     { headers: h, signal: ctrl.signal }),
        fetch('/api/v1/gov-reports/operations',    { headers: h, signal: ctrl.signal }),
        fetch('/api/v1/approval/requests/pending', { headers: h, signal: ctrl.signal }),
      ]);
      if (er.status === 'fulfilled' && er.value.ok) { setExec(await er.value.json()); }
      else if (er.status === 'fulfilled') { const d = await er.value.json().catch(() => ({})); throw new Error(d?.detail ?? 'تعذّر تحميل البيانات'); }
      if (or.status === 'fulfilled' && or.value.ok) { const d = await or.value.json(); setOps(d?.projects_breakdown ?? []); }
      if (ar.status === 'fulfilled' && ar.value.ok) { const d = await ar.value.json(); setApprovals(d?.pending ?? (Array.isArray(d) ? d : [])); }
      setLastRefresh(new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }));
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setErr(e instanceof Error ? e.message : String(e));
    } finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 90_000);
    return () => { clearInterval(t); abortRef.current?.abort(); };
  }, [refresh]);

  // ── 1. escalation buckets ─────────────────────────────────────────────────
  const { criticalApprovals, highApprovals, normalApprovals } = useMemo(() => ({
    criticalApprovals: approvals.filter(a => hoursAgo(a.created_at) >= 72),
    highApprovals:     approvals.filter(a => hoursAgo(a.created_at) >= 24 && hoursAgo(a.created_at) < 72),
    normalApprovals:   approvals.filter(a => hoursAgo(a.created_at) < 24),
  }), [approvals]);

  // ── Risk (ISO 31000) ───────────────────────────────────────────────────────
  const { riskLevel, riskFactors } = useMemo(() => {
    if (!exec) return { riskLevel: 'grey' as Signal, riskFactors: [] };
    const factors: string[] = [];
    const collRate   = exec.revenue.total_invoiced > 0 ? exec.revenue.total_collected / exec.revenue.total_invoiced : 1;
    const budgetUtil = exec.projects.total_budget > 0 ? exec.journal_entries.total_debit / exec.projects.total_budget : 0;
    if (exec.revenue.overdue_invoices > 0)  factors.push(`${exec.revenue.overdue_invoices} فاتورة متأخرة`);
    if (collRate < 0.5)                     factors.push(`تحصيل ${(collRate * 100).toFixed(0)}% فقط`);
    if (exec.projects.on_hold > 0)          factors.push(`${exec.projects.on_hold} مشروع متوقف`);
    if (budgetUtil > 0.9)                   factors.push(`استنزاف ميزانية ${(budgetUtil * 100).toFixed(0)}%`);
    if (criticalApprovals.length > 0)       factors.push(`${criticalApprovals.length} موافقة متأخرة +72h`);
    if (exec.fleet.maintenance_vehicles > exec.fleet.total_vehicles * 0.35) factors.push('أسطول صيانة عالية');
    const lvl: Signal = factors.length >= 4 ? 'red' : factors.length >= 1 ? 'amber' : 'green';
    return { riskLevel: lvl, riskFactors: factors };
  }, [exec, criticalApprovals]);

  // ── 2. BSC ────────────────────────────────────────────────────────────────
  const bsc = useMemo(() => {
    if (!exec) return null;
    const collRate   = exec.revenue.total_invoiced > 0 ? exec.revenue.total_collected / exec.revenue.total_invoiced : 0;
    const budgetUtil = exec.projects.total_budget > 0 ? exec.journal_entries.total_debit / exec.projects.total_budget : 0;
    const approvalR  = (exec.approvals.approved + exec.approvals.rejected) > 0 ? exec.approvals.approved / (exec.approvals.approved + exec.approvals.rejected) : 1;
    const fleetAvail = exec.fleet.total_vehicles > 0 ? (exec.fleet.total_vehicles - exec.fleet.maintenance_vehicles) / exec.fleet.total_vehicles : 1;
    const oldestPending = approvals.length > 0 ? approvals.reduce((a, b) => hoursAgo(a.created_at) > hoursAgo(b.created_at) ? a : b) : null;
    return {
      financial: [
        { label: 'معدل التحصيل',       value: pct(exec.revenue.total_collected, exec.revenue.total_invoiced), sub: `محصّل: ${compact(exec.revenue.total_collected)} د.ل`, signal: (collRate >= 0.75 ? 'green' : collRate >= 0.5 ? 'amber' : 'red') as Signal, href: '/dashboard/admin-gateway/revenue', trend: collRate >= 0.7 ? 'up' as const : 'down' as const },
        { label: 'استخدام الميزانية',   value: pct(exec.journal_entries.total_debit, exec.projects.total_budget), sub: `إجمالي: ${compact(exec.projects.total_budget)} د.ل`, signal: (budgetUtil <= 0.8 ? 'green' : budgetUtil <= 0.95 ? 'amber' : 'red') as Signal, href: '/dashboard/admin-gateway/finance/budgets', trend: budgetUtil <= 0.8 ? 'flat' as const : 'down' as const },
        { label: 'قيمة العقود النشطة',  value: compact(exec.contracts.total_value), sub: `${exec.contracts.active} عقد نشط`, signal: (exec.contracts.active > 0 ? 'green' : 'grey') as Signal, href: '/dashboard/admin-gateway/contracts', trend: 'flat' as const },
        { label: 'مشتريات معلقة',        value: String(exec.procurement.pr_pending), sub: `من أصل ${exec.procurement.pr_total} طلب`, signal: (exec.procurement.pr_pending === 0 ? 'green' : exec.procurement.pr_pending <= 5 ? 'amber' : 'red') as Signal, href: '/dashboard/admin-gateway/procurement', trend: exec.procurement.pr_pending === 0 ? 'up' as const : 'down' as const },
      ] as BscMetric[],
      operations: [
        { label: 'مشاريع نشطة',         value: String(exec.projects.active), sub: `إجمالي: ${exec.projects.total} | مكتمل: ${exec.projects.completed}`, signal: (exec.projects.active > 0 ? 'green' : 'grey') as Signal, href: '/dashboard/admin-gateway/projects/list', trend: 'up' as const },
        { label: 'توافر الأسطول',        value: pct(exec.fleet.active_vehicles, exec.fleet.total_vehicles), sub: `${exec.fleet.maintenance_vehicles} في الصيانة`, signal: (fleetAvail >= 0.75 ? 'green' : fleetAvail >= 0.5 ? 'amber' : 'red') as Signal, href: '/dashboard/admin-gateway/vehicles', trend: fleetAvail >= 0.7 ? 'up' as const : 'down' as const },
        { label: 'مشاريع متوقفة',        value: String(exec.projects.on_hold), sub: exec.projects.on_hold > 0 ? '⚠ تحتاج تدخلاً' : 'لا مشاريع متوقفة', signal: (exec.projects.on_hold === 0 ? 'green' : exec.projects.on_hold <= 2 ? 'amber' : 'red') as Signal, href: '/dashboard/admin-gateway/projects/list', trend: exec.projects.on_hold === 0 ? 'up' as const : 'down' as const },
        { label: 'قيمة المستودعات',      value: compact(exec.inventory.total_received_value), sub: `صادر: ${compact(exec.inventory.total_issued_value)} د.ل`, signal: 'green' as Signal, href: '/dashboard/admin-gateway/inventory', trend: 'flat' as const },
      ] as BscMetric[],
      governance: [
        { label: 'موافقات معلقة',        value: String(exec.approvals.pending), sub: oldestPending ? `أقدمها: ${formatAge(oldestPending.created_at)}` : 'لا موافقات', signal: (exec.approvals.pending === 0 ? 'green' : exec.approvals.pending <= 5 ? 'amber' : 'red') as Signal, href: '/dashboard/admin-gateway/workflow/approvals', trend: exec.approvals.pending === 0 ? 'up' as const : 'down' as const },
        { label: 'معدل الاعتماد',         value: pct(exec.approvals.approved, exec.approvals.approved + exec.approvals.rejected), sub: `معتمد: ${exec.approvals.approved} | مرفوض: ${exec.approvals.rejected}`, signal: (approvalR >= 0.7 ? 'green' : 'amber') as Signal, href: '/dashboard/admin-gateway/workflow', trend: approvalR >= 0.7 ? 'up' as const : 'flat' as const },
        { label: 'فواتير متأخرة',         value: String(exec.revenue.overdue_invoices), sub: `مستحق: ${compact(exec.revenue.total_outstanding)} د.ل`, signal: (exec.revenue.overdue_invoices === 0 ? 'green' : exec.revenue.overdue_invoices <= 3 ? 'amber' : 'red') as Signal, href: '/dashboard/admin-gateway/revenue', trend: exec.revenue.overdue_invoices === 0 ? 'up' as const : 'down' as const },
        { label: 'عقود في الصياغة',       value: String(exec.contracts.draft), sub: exec.contracts.draft > 0 ? 'تحتاج اعتماداً' : 'لا عقود معلقة', signal: (exec.contracts.draft === 0 ? 'green' : 'amber') as Signal, href: '/dashboard/admin-gateway/contracts', trend: exec.contracts.draft === 0 ? 'up' as const : 'flat' as const },
      ] as BscMetric[],
      people: [
        { label: 'إجمالي الموظفين',      value: String(exec.employees.total), sub: 'القوى العاملة الكاملة', signal: 'green' as Signal, href: '/dashboard/admin-gateway/hr/employees', trend: 'up' as const },
        { label: 'أوامر شراء منجزة',     value: pct(exec.procurement.po_completed, exec.procurement.po_total), sub: `${exec.procurement.po_completed} من ${exec.procurement.po_total}`, signal: (exec.procurement.po_completed / Math.max(exec.procurement.po_total, 1) >= 0.7 ? 'green' : 'amber') as Signal, href: '/dashboard/admin-gateway/procurement', trend: 'up' as const },
        { label: 'المعدات النشطة',        value: `${exec.fleet.active_equipment}/${exec.fleet.total_equipment}`, sub: 'معدات بحالة التشغيل', signal: (exec.fleet.active_equipment / Math.max(exec.fleet.total_equipment, 1) >= 0.7 ? 'green' : 'amber') as Signal, href: '/dashboard/admin-gateway/vehicles', trend: 'flat' as const },
        { label: 'تكلفة الوقود',          value: compact(exec.fleet.total_fuel_cost), sub: 'إجمالي الصرف', signal: 'grey' as Signal, href: '/dashboard/admin-gateway/vehicles', trend: 'flat' as const },
      ] as BscMetric[],
    };
  }, [exec, approvals]);

  // ── 3. Department health scores ───────────────────────────────────────────
  const deptHealth = useMemo((): DeptHealth[] => {
    if (!exec) return [];
    const collRate   = exec.revenue.total_invoiced > 0 ? exec.revenue.total_collected / exec.revenue.total_invoiced : 1;
    const budgetUtil = exec.projects.total_budget > 0 ? exec.journal_entries.total_debit / exec.projects.total_budget : 0;
    const approvalR  = (exec.approvals.approved + exec.approvals.rejected) > 0 ? exec.approvals.approved / (exec.approvals.approved + exec.approvals.rejected) : 1;
    const fleetR     = exec.fleet.total_vehicles > 0 ? (exec.fleet.total_vehicles - exec.fleet.maintenance_vehicles) / exec.fleet.total_vehicles : 1;
    const projActive = exec.projects.total > 0 ? exec.projects.active / exec.projects.total : 1;
    const noOverdue  = exec.revenue.overdue_invoices === 0 ? 1 : Math.max(0, 1 - exec.revenue.overdue_invoices * 0.15);
    return [
      { name: 'الشؤون الإدارية', icon: Shield, score: Math.round((approvalR * 40 + (exec.contracts.draft === 0 ? 1 : 0.6) * 30 + (exec.approvals.pending <= 5 ? 1 : 0.5) * 30) * 100), details: [`معدل اعتماد: ${(approvalR * 100).toFixed(0)}%`, `موافقات معلقة: ${exec.approvals.pending}`, `عقود في صياغة: ${exec.contracts.draft}`], href: '/dashboard/admin-gateway', accent: 'border-blue-500/40 bg-blue-900/20 text-blue-400' },
      { name: 'المالية والإيرادات', icon: DollarSign, score: Math.round((collRate * 0.4 + (1 - Math.min(budgetUtil, 1)) * 0.35 + noOverdue * 0.25) * 100), details: [`تحصيل: ${(collRate * 100).toFixed(0)}%`, `استخدام الميزانية: ${(budgetUtil * 100).toFixed(0)}%`, `فواتير متأخرة: ${exec.revenue.overdue_invoices}`], href: '/dashboard/admin-gateway/finance/budgets', accent: 'border-amber-500/40 bg-amber-900/20 text-amber-400' },
      { name: 'المشاريع والتنفيذ', icon: Briefcase, score: Math.round((projActive * 0.45 + (exec.projects.on_hold === 0 ? 1 : Math.max(0, 1 - exec.projects.on_hold * 0.2)) * 0.35 + (exec.projects.completed / Math.max(exec.projects.total, 1)) * 0.2) * 100), details: [`نشطة: ${exec.projects.active} من ${exec.projects.total}`, `متوقفة: ${exec.projects.on_hold}`, `مكتملة: ${exec.projects.completed}`], href: '/dashboard/admin-gateway/projects/list', accent: 'border-purple-500/40 bg-purple-900/20 text-purple-400' },
      { name: 'الأسطول والمعدات', icon: Truck, score: Math.round((fleetR * 0.5 + (exec.fleet.active_equipment / Math.max(exec.fleet.total_equipment, 1)) * 0.5) * 100), details: [`توافر: ${(fleetR * 100).toFixed(0)}%`, `معدات نشطة: ${exec.fleet.active_equipment}/${exec.fleet.total_equipment}`, `في صيانة: ${exec.fleet.maintenance_vehicles}`], href: '/dashboard/admin-gateway/vehicles', accent: 'border-cyan-500/40 bg-cyan-900/20 text-cyan-400' },
      { name: 'المشتريات والمخزون', icon: ShoppingCart, score: Math.round(((exec.procurement.po_completed / Math.max(exec.procurement.po_total, 1)) * 0.4 + (exec.procurement.pr_pending === 0 ? 1 : Math.max(0, 1 - exec.procurement.pr_pending * 0.1)) * 0.6) * 100), details: [`طلبات معلقة: ${exec.procurement.pr_pending}`, `أوامر منجزة: ${exec.procurement.po_completed}/${exec.procurement.po_total}`, `قيمة المخزون: ${compact(exec.inventory.total_received_value)}`], href: '/dashboard/admin-gateway/procurement', accent: 'border-orange-500/40 bg-orange-900/20 text-orange-400' },
      { name: 'الموارد البشرية', icon: Users, score: Math.min(100, Math.round((exec.employees.total > 0 ? 70 : 30) + (exec.approvals.pending === 0 ? 20 : Math.max(0, 20 - exec.approvals.pending)) + 10)), details: [`إجمالي الموظفين: ${exec.employees.total}`, `موافقات HR: ${exec.approvals.pending}`], href: '/dashboard/admin-gateway/hr/employees', accent: 'border-emerald-500/40 bg-emerald-900/20 text-emerald-400' },
    ];
  }, [exec]);

  // ── 4. KPI vs Target (MBO) ────────────────────────────────────────────────
  const kpiTargets = useMemo(() => {
    if (!exec) return null;
    return [
      { label: 'معدل التحصيل المالي',     actual: exec.revenue.total_invoiced > 0 ? (exec.revenue.total_collected / exec.revenue.total_invoiced) * 100 : 0, target: 80,  href: '/dashboard/admin-gateway/revenue' },
      { label: 'استخدام الميزانية',        actual: exec.projects.total_budget > 0 ? (exec.journal_entries.total_debit / exec.projects.total_budget) * 100 : 0, target: 85, href: '/dashboard/admin-gateway/finance/budgets', invert: true },
      { label: 'كفاءة الموافقات',         actual: (exec.approvals.approved + exec.approvals.rejected) > 0 ? (exec.approvals.approved / (exec.approvals.approved + exec.approvals.rejected)) * 100 : 100, target: 85, href: '/dashboard/admin-gateway/workflow/approvals' },
      { label: 'توافر الأسطول',            actual: exec.fleet.total_vehicles > 0 ? ((exec.fleet.total_vehicles - exec.fleet.maintenance_vehicles) / exec.fleet.total_vehicles) * 100 : 100, target: 80, href: '/dashboard/admin-gateway/vehicles' },
      { label: 'إنجاز أوامر الشراء',       actual: exec.procurement.po_total > 0 ? (exec.procurement.po_completed / exec.procurement.po_total) * 100 : 100, target: 75, href: '/dashboard/admin-gateway/procurement' },
      { label: 'المشاريع النشطة من الكلي', actual: exec.projects.total > 0 ? (exec.projects.active / exec.projects.total) * 100 : 0, target: 60, href: '/dashboard/admin-gateway/projects/list' },
    ] as { label: string; actual: number; target: number; href: string; invert?: boolean }[];
  }, [exec]);

  // ── overall health ─────────────────────────────────────────────────────────
  const overallHealth = useMemo(() =>
    deptHealth.length > 0 ? Math.round(deptHealth.reduce((s, d) => s + d.score, 0) / deptHealth.length) : null,
  [deptHealth]);

  const atRiskProjects = useMemo(() =>
    ops.filter(p => p.status === 'on_hold' || p.status === 'delayed').slice(0, 3), [ops]);

  const riskLabel: Record<Signal, string> = { green: 'مستقر', amber: 'يحتاج متابعة', red: 'حرج', grey: '...' };
  const riskTextColor: Record<Signal, string> = { green: 'text-emerald-400', amber: 'text-amber-400', red: 'text-rose-400', grey: 'text-slate-400' };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/40 flex items-center justify-center shadow-lg">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 leading-tight">مكتب المدير العام</h1>
              <p className="text-xs text-slate-500 mt-0.5">الإدارة العليا — مركز القيادة الاستراتيجي</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exec && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${SIGNAL_RING[riskLevel]}`}>
                <TrafficDot s={riskLevel} /><span className={riskTextColor[riskLevel]}>المخاطر: {riskLabel[riskLevel]}</span>
              </div>
            )}
            {overallHealth !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700 bg-slate-800/50 text-xs font-semibold">
                <HeartPulse className={`w-3.5 h-3.5 ${overallHealth >= 70 ? 'text-emerald-400' : overallHealth >= 50 ? 'text-amber-400' : 'text-rose-400'}`} />
                <span className="text-slate-300">صحة المنظومة: <strong className={overallHealth >= 70 ? 'text-emerald-400' : overallHealth >= 50 ? 'text-amber-400' : 'text-rose-400'}>{overallHealth}%</strong></span>
              </div>
            )}
            {criticalApprovals.length > 0 && (
              <Link href="/dashboard/admin-gateway/workflow/approvals" className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-rose-500/40 bg-rose-900/20 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 animate-pulse transition-colors">
                <Bell className="w-3.5 h-3.5" /><span>{criticalApprovals.length} قرار متأخر +72h</span>
              </Link>
            )}
            <button onClick={refresh} disabled={loading} className="p-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 transition-colors">
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {lastRefresh && <span className="text-[11px] text-slate-600 hidden sm:block">آخر تحديث: {lastRefresh}</span>}
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-2 p-3 bg-rose-900/20 border border-rose-500/30 rounded-xl text-sm text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0" /><span>{err}</span>
          </div>
        )}

        {riskFactors.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-amber-900/10 border border-amber-500/20 rounded-xl">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1 ml-2"><AlertTriangle className="w-3.5 h-3.5" /> عوامل خطر نشطة:</span>
            {riskFactors.map((f, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-900/20 text-amber-300">{f}</span>)}
          </div>
        )}

        {loading && !exec && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-800/60 animate-pulse" />)}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 1. تصعيد الموافقات — HIGHEST PRIORITY                       */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {(approvals.length > 0 || atRiskProjects.length > 0) && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5">
            <SectionHead icon={Flame} title="قائمة التصعيد — يستوجب قراراً"
              sub="مرتبة حسب العمر: +72h حرجة · 24-72h عالية · أقل من 24h عادية"
              accent="border-rose-500/40 bg-rose-900/20 text-rose-400"
              badge={criticalApprovals.length + highApprovals.length} />
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">الموافقات المعلقة ({approvals.length})</p>
                {approvals.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-900/15 border border-emerald-500/20 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" /><span>لا توجد موافقات معلقة</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {[...criticalApprovals, ...highApprovals, ...normalApprovals].slice(0, 8).map(a => <EscalationRow key={a.id} item={a} />)}
                    {approvals.length > 8 && (
                      <Link href="/dashboard/admin-gateway/workflow/approvals" className="flex items-center justify-center gap-2 p-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800">
                        عرض جميع الموافقات ({approvals.length}) <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">مشاريع تحتاج تدخلاً</p>
                {atRiskProjects.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-900/15 border border-emerald-500/20 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" /><span>جميع المشاريع تسير بشكل طبيعي</span>
                  </div>
                ) : atRiskProjects.map(p => (
                  <Link key={p.id} href="/dashboard/admin-gateway/projects/list" className="flex items-center justify-between p-3 rounded-lg bg-rose-900/15 border border-rose-500/20 hover:bg-rose-900/25 transition-colors">
                    <div><p className="text-sm font-medium text-slate-200">{p.name}</p><p className="text-[11px] text-slate-500">{p.code}</p></div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-rose-500/30 text-rose-400 bg-rose-900/30">{p.status === 'on_hold' ? 'متوقف' : 'متأخر'}</span>
                  </Link>
                ))}
                <Link href="/dashboard/admin-gateway/workflow/approvals" className="flex items-center justify-between w-full p-3 rounded-lg border border-amber-500/30 bg-amber-900/15 hover:bg-amber-900/25 text-amber-300 text-sm font-semibold transition-colors">
                  <span>فتح لوحة الموافقات الكاملة</span><ChevronLeft className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 2. بطاقة الأداء المتوازن — BSC                              */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {bsc && (
          <div>
            <SectionHead icon={BarChart3} title="بطاقة الأداء المتوازن (BSC)"
              sub="4 منظورات استراتيجية — إشارات ضوئية مباشرة من البيانات"
              accent="border-indigo-500/40 bg-indigo-900/20 text-indigo-400" />
            {[
              { title: '① المنظور المالي',           sub: 'تحصيل · ميزانية · عقود · مشتريات', items: bsc.financial,  accent: 'text-amber-400',   border: 'border-amber-900/30' },
              { title: '② المنظور التشغيلي',         sub: 'مشاريع · أسطول · مخزون · تنفيذ',  items: bsc.operations, accent: 'text-cyan-400',    border: 'border-cyan-900/30' },
              { title: '③ منظور الحوكمة والامتثال', sub: 'موافقات · اعتماد · فواتير · عقود', items: bsc.governance, accent: 'text-violet-400',  border: 'border-violet-900/30' },
              { title: '④ منظور الموارد والنمو',     sub: 'موظفون · معدات · مشتريات منجزة',   items: bsc.people,     accent: 'text-emerald-400', border: 'border-emerald-900/30' },
            ].map(({ title, sub, items, accent, border }) => (
              <div key={title} className={`mb-4 p-4 rounded-xl border ${border} bg-slate-900/30`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-sm font-bold ${accent}`}>{title}</span>
                  <span className="text-[11px] text-slate-500">{sub}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {items.map((m, i) => <BscCard key={i} metric={m} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 3. لوحة صحة الإدارات                                        */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {deptHealth.length > 0 && (
          <div>
            <SectionHead icon={HeartPulse} title="لوحة صحة الإدارات"
              sub="درجة صحة 0-100 محسوبة من مؤشرات أداء حقيقية لكل قطاع"
              accent="border-teal-500/40 bg-teal-900/20 text-teal-400" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {deptHealth.map((d, i) => <HealthCard key={i} dept={d} />)}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-600">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥ 75 ممتاز</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 50-74 يقبل</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> &lt; 50 يحتاج تدخلاً</span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 4. الأداء مقابل الأهداف — MBO                               */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {kpiTargets && (
          <div>
            <SectionHead icon={Gauge} title="الأداء مقابل الأهداف (MBO)"
              sub="مقارنة المؤشرات الفعلية بالمستهدفات المؤسسية — خط التقدم المرئي"
              accent="border-sky-500/40 bg-sky-900/20 text-sky-400" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {kpiTargets.map((k, i) => (
                <KpiGauge key={i} label={k.label} actual={parseFloat(k.actual.toFixed(1))} target={k.target} invert={k.invert} href={k.href} />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-600">الأهداف مبنية على معايير الأداء القياسية — يمكن تعديلها من إعدادات النظام.</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 5. الإحاطة الذكية اليومية                                   */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-5">
          <SectionHead icon={Newspaper} title="الإحاطة الذكية اليومية"
            sub="ملخص تنفيذي مولّد آلياً من بيانات المنظومة الحية"
            accent="border-fuchsia-500/40 bg-fuchsia-900/20 text-fuchsia-400" />
          <div className="grid md:grid-cols-3 gap-3">
            <Link href="/dashboard/admin-gateway/intelligence/briefing"
              className="md:col-span-2 flex items-start gap-4 p-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-900/10 hover:bg-fuchsia-900/20 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center shrink-0">
                <Newspaper className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-200 mb-1">فتح الإحاطة التنفيذية الكاملة</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">تقرير سردي باللغة العربية يغطي المالية والمشاريع والمخاطر والتوصيات — مولّد تلقائياً من البيانات الحية.</p>
                <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-fuchsia-400">اقرأ الإحاطة <ArrowRight className="w-3 h-3" /></span>
              </div>
            </Link>
            <div className="space-y-2">
              <Link href="/dashboard/admin-gateway/intelligence/risk" className="flex items-center gap-3 p-3 rounded-xl border border-rose-500/20 bg-rose-900/10 hover:bg-rose-900/20 text-sm text-rose-300 transition-colors">
                <AlertTriangle className="w-4 h-4 shrink-0" /><span>تقرير المخاطر</span><ChevronLeft className="w-3.5 h-3.5 mr-auto" />
              </Link>
              <Link href="/dashboard/admin-gateway/intelligence/forecast" className="flex items-center gap-3 p-3 rounded-xl border border-cyan-500/20 bg-cyan-900/10 hover:bg-cyan-900/20 text-sm text-cyan-300 transition-colors">
                <TrendingUp className="w-4 h-4 shrink-0" /><span>التوقعات</span><ChevronLeft className="w-3.5 h-3.5 mr-auto" />
              </Link>
              <Link href="/dashboard/admin-gateway/intelligence/performance" className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-900/10 hover:bg-emerald-900/20 text-sm text-emerald-300 transition-colors">
                <Activity className="w-4 h-4 shrink-0" /><span>تحليل الأداء</span><ChevronLeft className="w-3.5 h-3.5 mr-auto" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── أدوات استراتيجية ────────────────────────────────────────── */}
        <div>
          <SectionHead icon={Brain} title="مركز الأدوات الاستراتيجية"
            sub="وصول سريع لجميع الوحدات التحليلية والتشغيلية"
            accent="border-indigo-500/40 bg-indigo-900/20 text-indigo-400" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <QuickLink href="/dashboard/command-center"                         label="مركز القيادة"        icon={BarChart3}    color="border-indigo-500/40  bg-indigo-900/20  text-indigo-300  hover:bg-indigo-900/30"   />
            <QuickLink href="/dashboard/admin-gateway/intelligence/briefing"    label="الإحاطة الذكية"     icon={FileText}     color="border-violet-500/40  bg-violet-900/20 text-violet-300  hover:bg-violet-900/30"   />
            <QuickLink href="/dashboard/admin-gateway/intelligence/risk"        label="إدارة المخاطر"      icon={AlertTriangle} color="border-rose-500/40   bg-rose-900/20   text-rose-300    hover:bg-rose-900/30"   badge={riskFactors.length} />
            <QuickLink href="/dashboard/admin-gateway/intelligence/command"     label="القيادة الذكية"     icon={Zap}          color="border-amber-500/40   bg-amber-900/20  text-amber-300   hover:bg-amber-900/30"    />
            <QuickLink href="/dashboard/admin-gateway/intelligence/forecast"    label="التوقعات"           icon={TrendingUp}   color="border-cyan-500/40    bg-cyan-900/20   text-cyan-300    hover:bg-cyan-900/30"     />
            <QuickLink href="/dashboard/admin-gateway/platform-intelligence"    label="الذكاء التنبؤي"    icon={Brain}        color="border-fuchsia-500/40 bg-fuchsia-900/20 text-fuchsia-300 hover:bg-fuchsia-900/30"  />
            <QuickLink href="/dashboard/admin-gateway/reports/executive"        label="التقارير التنفيذية" icon={BarChart3}    color="border-sky-500/40     bg-sky-900/20    text-sky-300     hover:bg-sky-900/30"      />
            <QuickLink href="/dashboard/admin-gateway/workflow/approvals"       label="الموافقات"          icon={CheckCircle2} color="border-green-500/40  bg-green-900/20  text-green-300   hover:bg-green-900/30" badge={approvals.length} />
            <QuickLink href="/dashboard/ai-assistant"                           label="المساعد الذكي"      icon={Brain}        color="border-purple-500/40  bg-purple-900/20 text-purple-300  hover:bg-purple-900/30"   />
            <QuickLink href="/dashboard/gis-sovereignty/engineering-workspace"  label="السيادة الجغرافية"  icon={MapPin}       color="border-teal-500/40    bg-teal-900/20   text-teal-300    hover:bg-teal-900/30"     />
            <QuickLink href="/dashboard/admin-gateway/intelligence/performance" label="تحليل الأداء"       icon={Target}       color="border-emerald-500/40 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-900/30"  />
            <QuickLink href="/dashboard/admin-gateway/org-structure"            label="الهيكل التنظيمي"    icon={Building2}    color="border-slate-500/40   bg-slate-800/60  text-slate-300   hover:bg-slate-700/60"    />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: '/dashboard/admin-gateway/hr/employees',            label: 'الموارد البشرية',  icon: Users,         color: 'border-blue-500/40   bg-blue-900/20   text-blue-300'   },
            { href: '/dashboard/admin-gateway/projects/list',           label: 'المشاريع',          icon: Briefcase,     color: 'border-purple-500/40 bg-purple-900/20 text-purple-300' },
            { href: '/dashboard/admin-gateway/finance/budgets',         label: 'الميزانية',         icon: DollarSign,    color: 'border-amber-500/40  bg-amber-900/20  text-amber-300'  },
            { href: '/dashboard/admin-gateway/contracts',               label: 'العقود',            icon: FileText,      color: 'border-indigo-500/40 bg-indigo-900/20 text-indigo-300' },
            { href: '/dashboard/admin-gateway/maintenance/work-orders', label: 'الصيانة',           icon: Wrench,        color: 'border-rose-500/40   bg-rose-900/20   text-rose-300'   },
            { href: '/dashboard/admin-gateway/assets/registry',         label: 'الأصول',            icon: Shield,        color: 'border-teal-500/40   bg-teal-900/20   text-teal-300'   },
            { href: '/dashboard/admin-gateway/procurement',             label: 'المشتريات',         icon: ShoppingCart,  color: 'border-orange-500/40 bg-orange-900/20 text-orange-300' },
            { href: '/dashboard/admin-gateway/vehicles',                label: 'الأسطول',           icon: Truck,         color: 'border-cyan-500/40   bg-cyan-900/20   text-cyan-300'   },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href} className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all hover:scale-[1.02] ${color}`}>
              <Icon className="w-4 h-4 shrink-0" /><span>{label}</span><ExternalLink className="w-3 h-3 opacity-40 mr-auto" />
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-600">
          <span>معايير: BSC · ISO 31000 · ISO 55001 · PMBOK 7th · IFRS · MBO</span>
          <span>تحديث تلقائي كل 90 ثانية</span>
          {exec?.generated_at && <span>بيانات بتاريخ: {new Date(exec.generated_at).toLocaleDateString('ar-LY')}</span>}
        </div>

      </div>
    </div>
  );
}
