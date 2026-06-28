'use client';

/**
 * Unified Intelligence Command Center — Phase 4
 * Route: /dashboard/admin-gateway/intelligence/command
 *
 * Aggregates data from ALL working APIs into a single mission-control view.
 * Links to all 6 intelligence phases + 4 source reports.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Cpu, RefreshCw, ChevronLeft, Shield, Activity, TrendingUp,
  TrendingDown, BarChart3, DollarSign, Truck, ShoppingBag,
  CheckCircle, AlertTriangle, Clock, Layers, ExternalLink,
  FileText, Zap,
} from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};
// ── Types ──────────────────────────────────────────────────────────────────────
interface ExecData {
  generated_at:    string;
  projects:        { active: number; planning: number; completed: number; on_hold: number; total: number; total_budget: number; };
  employees:       { total: number; };
  journal_entries: { posted: number; draft: number; total: number; total_debit: number; total_credit: number; };
  contracts:       { active: number; completed: number; draft: number; total: number; total_value: number; };
  procurement:     { pr_pending: number; pr_approved: number; pr_total: number; po_issued: number; po_completed: number; po_total: number; total_amount: number; };
  revenue:         { paid_invoices: number; unpaid_invoices: number; overdue_invoices: number; total_invoiced: number; total_collected: number; total_outstanding: number; };
  fleet:           { active_vehicles: number; maintenance_vehicles: number; total_vehicles: number; active_equipment: number; total_equipment: number; total_fuel_cost: number; };
  approvals:       { pending: number; approved: number; rejected: number; total: number; };
  inventory:       { total_received_value: number; total_issued_value: number; };
}

interface OpsProject {
  id: number; name: string; code: string; status: string;
  budget: number | null; contracts_total: number | null;
  vehicles_assigned: number; equipment_assigned: number;
}

interface OpsData {
  projects_breakdown: OpsProject[];
}

// ── Risk derivation (same logic as risk page) ──────────────────────────────────
type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
interface RiskItem { id: string; severity: RiskSeverity; title: string; detail: string; href?: string; }

function deriveTopRisks(exec: ExecData): RiskItem[] {
  const risks: RiskItem[] = [];
  const collRate = exec.revenue.total_invoiced > 0 ? exec.revenue.total_collected / exec.revenue.total_invoiced : 1;
  const budgetUtil = exec.projects.total_budget > 0 ? exec.journal_entries.total_debit / exec.projects.total_budget : 0;

  if (exec.revenue.overdue_invoices > 0) {
    const sev: RiskSeverity = exec.revenue.total_outstanding > 500_000 ? 'critical' : exec.revenue.total_outstanding > 100_000 ? 'high' : 'medium';
    risks.push({ id: 'fin-overdue', severity: sev, title: 'فواتير متأخرة التحصيل',
      detail: `${exec.revenue.overdue_invoices} فاتورة — مستحق: ${compact(exec.revenue.total_outstanding)} د.ل`,
      href: '/dashboard/admin-gateway/intelligence/risk' });
  }
  if (collRate < 0.5 && exec.revenue.total_invoiced > 0)
    risks.push({ id: 'fin-coll', severity: 'high', title: 'نسبة تحصيل منخفضة',
      detail: `${(collRate * 100).toFixed(1)}% فقط من الفواتير محصّل`, href: '/dashboard/admin-gateway/intelligence/risk' });
  if (budgetUtil > 0.9)
    risks.push({ id: 'fin-budget', severity: 'critical', title: 'تجاوز ميزانية وشيك',
      detail: `استهلاك ${(budgetUtil * 100).toFixed(1)}% من الميزانية`, href: '/dashboard/admin-gateway/intelligence/risk' });
  if (exec.projects.on_hold > 0)
    risks.push({ id: 'ops-hold', severity: exec.projects.on_hold >= 2 ? 'high' : 'medium',
      title: 'مشاريع متوقفة', detail: `${exec.projects.on_hold} مشروع في وضع الإيقاف`, href: '/dashboard/admin-gateway/intelligence/risk' });
  if (exec.approvals.pending > 5)
    risks.push({ id: 'gov-appr', severity: 'high', title: 'تراكم موافقات',
      detail: `${exec.approvals.pending} طلب معلق`, href: '/dashboard/admin-gateway/intelligence/risk' });
  if (exec.contracts.draft > 0 && exec.contracts.active === 0)
    risks.push({ id: 'gov-nocon', severity: 'high', title: 'لا عقود نشطة',
      detail: `${exec.contracts.draft} عقد مسودة فقط`, href: '/dashboard/admin-gateway/intelligence/risk' });
  if (exec.employees.total === 0)
    risks.push({ id: 'data-emp', severity: 'medium', title: 'بيانات الموظفين مفقودة',
      detail: 'لا سجل موظفين في النظام', href: '/dashboard/admin-gateway/intelligence/risk' });

  const order: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return risks.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 4);
}

// ── Overall health score (0-100) ───────────────────────────────────────────────
function calcHealthScore(exec: ExecData): { score: number; label: string; color: string } {
  let score = 100;
  const collRate = exec.revenue.total_invoiced > 0 ? exec.revenue.total_collected / exec.revenue.total_invoiced : 1;
  const budgetUtil = exec.projects.total_budget > 0 ? exec.journal_entries.total_debit / exec.projects.total_budget : 0;
  const maintRate  = exec.fleet.total_vehicles > 0 ? exec.fleet.maintenance_vehicles / exec.fleet.total_vehicles : 0;

  if (exec.revenue.overdue_invoices > 0)    score -= exec.revenue.total_outstanding > 500_000 ? 25 : 15;
  if (collRate < 0.5)                        score -= 20;
  else if (collRate < 0.7)                   score -= 10;
  if (budgetUtil > 0.9)                      score -= 25;
  else if (budgetUtil > 0.75)                score -= 10;
  if (exec.projects.on_hold > 0)             score -= exec.projects.on_hold * 5;
  if (exec.approvals.pending > 5)            score -= 15;
  if (exec.contracts.active === 0 && exec.contracts.draft > 0) score -= 15;
  if (maintRate > 0.3)                       score -= 10;
  if (exec.employees.total === 0)            score -= 5;
  score = Math.max(0, Math.min(100, score));

  const label = score >= 80 ? 'جيد' : score >= 60 ? 'مقبول' : score >= 40 ? 'يحتاج انتباه' : 'حرج';
  const color = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : score >= 40 ? 'text-orange-400' : 'text-rose-400';
  return { score, label, color };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const compact = (v: number) => {
  if (!v && v !== 0) return '0';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(0) + 'K';
  return v.toFixed(0);
};

const SEV_BADGE: Record<RiskSeverity, string> = {
  critical: 'bg-rose-500/20   text-rose-300   border-rose-500/40',
  high:     'bg-orange-500/20 text-orange-300 border-orange-500/40',
  medium:   'bg-amber-500/20  text-amber-300  border-amber-500/40',
  low:      'bg-blue-500/20   text-blue-300   border-blue-500/40',
};
const SEV_AR: Record<RiskSeverity, string> = { critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض' };

const STATUS_AR: Record<string, string> = { active: 'نشط', on_hold: 'متوقف', planning: 'تخطيط', completed: 'مكتمل' };

// ── Metric Cell ────────────────────────────────────────────────────────────────
function MetCell({ v, label, hi, warn }: { v: number | string; label: string; hi?: boolean; warn?: boolean }) {
  const cls = hi ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-slate-200';
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${cls}`}>{v}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

// ── Intelligence Nav Card ──────────────────────────────────────────────────────
function IntelCard({ href, icon, title, desc, accent }: {
  href: string; icon: React.ReactNode; title: string; desc: string; accent: string;
}) {
  return (
    <Link href={href}
      className={`group block bg-slate-900/60 border ${accent} rounded-xl p-4 hover:bg-slate-800/60 transition`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-200 group-hover:text-white transition">{title}</div>
          <div className="text-sm text-slate-500 mt-0.5">{desc}</div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-0.5 transition" />
      </div>
    </Link>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const [exec,    setExec]    = useState<ExecData | null>(null);
  const [ops,     setOps]     = useState<OpsData  | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const h = { 'X-Tenant-ID': getTenantId() || '' };
      const [er, or] = await Promise.all([
        fetch('/api/v1/gov-reports/executive',  { headers: h }),
        fetch('/api/v1/gov-reports/operations', { headers: h }),
      ]);
      const [ed, od] = await Promise.all([er.json(), or.json()]);
      if (!er.ok) throw new Error(ed.detail ?? 'error');
      setExec(ed);
      setOps(or.ok ? od : null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 120_000); return () => clearInterval(t); }, [fetchAll]);

  const health   = useMemo(() => exec ? calcHealthScore(exec)    : null, [exec]);
  const topRisks = useMemo(() => exec ? deriveTopRisks(exec)     : [],   [exec]);
  const projects = useMemo(() => ops?.projects_breakdown?.slice(0, 5) ?? [], [ops]);

  const collRate    = exec ? (exec.revenue.total_invoiced > 0 ? (exec.revenue.total_collected / exec.revenue.total_invoiced * 100) : 0) : 0;
  const budgetUtil  = exec ? (exec.projects.total_budget > 0 ? (exec.journal_entries.total_debit / exec.projects.total_budget * 100) : 0) : 0;
  const maintRate   = exec ? (exec.fleet.total_vehicles > 0 ? (exec.fleet.maintenance_vehicles / exec.fleet.total_vehicles * 100) : 0) : 0;
  const approvalPct = exec ? ((exec.approvals.approved + exec.approvals.rejected) > 0 ? (exec.approvals.approved / (exec.approvals.approved + exec.approvals.rejected) * 100) : 0) : 0;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Verification Marker ─────────────────────────────────────────── */}
        <div className="bg-violet-900/30 border border-violet-500/40 rounded-lg px-4 py-2 text-violet-300 text-xs font-mono text-center">
          &#10003; COMMAND CENTER LIVE &mdash; مركز القيادة الذكي الموحد | {new Date().toLocaleDateString('ar-LY')}
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/command-center"
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-base transition">
              <ChevronLeft className="w-4 h-4" />
              اللوحة التنفيذية
            </Link>
            <span className="text-slate-700">/</span>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-violet-400" />
              مركز القيادة الذكي
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {exec?.generated_at && (
              <span className="text-sm text-slate-600">
                آخر تحديث: {new Date(exec.generated_at).toLocaleTimeString('ar-LY')}
              </span>
            )}
            <button onClick={fetchAll} disabled={loading}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {err && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {err.includes('503') || err.includes('unavailable')
              ? 'الخدمة غير متاحة حالياً — يرجى المحاولة لاحقاً'
              : err.includes('500') || err.includes('Failed')
              ? 'حدث خطأ في النظام — يرجى المحاولة لاحقاً'
              : err}
          </div>
        )}

        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-28 rounded-xl bg-slate-800/50" />
            <div className="grid md:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-52 rounded-xl bg-slate-800/50" />)}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {[1,2].map(i => <div key={i} className="h-40 rounded-xl bg-slate-800/50" />)}
            </div>
          </div>
        )}

        {!loading && exec && health && (
          <>
            {/* ── Zone 1: Health Banner ─────────────────────────────────── */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <div className="flex flex-wrap items-center gap-6">
                {/* Health gauge */}
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(30,41,59)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none"
                        stroke={health.score >= 80 ? '#10b981' : health.score >= 60 ? '#f59e0b' : health.score >= 40 ? '#f97316' : '#ef4444'}
                        strokeWidth="3" strokeDasharray={`${health.score * 0.94} 94`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-sm font-bold ${health.color}`}>{health.score}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">الصحة التشغيلية</div>
                    <div className={`text-lg font-bold ${health.color}`}>{health.label}</div>
                  </div>
                </div>
                {/* Divider */}
                <div className="h-12 w-px bg-slate-800 hidden md:block" />
                {/* Quick KPIs */}
                <div className="flex flex-wrap gap-6 flex-1">
                  <MetCell v={exec.projects.active}                         label="مشاريع نشطة"    hi={exec.projects.active > 0}   />
                  <MetCell v={compact(exec.projects.total_budget) + ' د.ل'} label="إجمالي الميزانية"                                />
                  <MetCell v={collRate.toFixed(1) + '%'}                    label="معدل التحصيل"   hi={collRate >= 70} warn={collRate < 70 && collRate >= 50} />
                  <MetCell v={budgetUtil.toFixed(1) + '%'}                  label="استهلاك الميزانية" warn={budgetUtil > 75}         />
                  <MetCell v={exec.fleet.active_vehicles + '/' + exec.fleet.total_vehicles} label="الأسطول النشط" hi={maintRate < 15} warn={maintRate >= 30} />
                  <MetCell v={approvalPct.toFixed(0) + '%'}                 label="معدل الموافقة"  hi={approvalPct >= 80}            />
                  <MetCell v={exec.approvals.pending}                       label="موافقات معلقة"  warn={exec.approvals.pending > 0}  />
                  <MetCell v={exec.contracts.active}                        label="عقود نشطة"      hi={exec.contracts.active > 0}    />
                </div>
              </div>
            </div>

            {/* ── Zone 2: Three Columns ─────────────────────────────────── */}
            <div className="grid md:grid-cols-3 gap-4">

              {/* Col 1: Top Risks */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-orange-400" />
                    إشارات المخاطر
                  </h3>
                  <Link href="/dashboard/admin-gateway/intelligence/risk"
                    className="text-sm text-orange-400 hover:text-orange-300 transition">
                    كل المخاطر →
                  </Link>
                </div>
                <div className="p-3 space-y-2">
                  {topRisks.length === 0 ? (
                    <div className="p-4 text-center">
                      <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                      <p className="text-sm text-emerald-400">لا مخاطر مكتشفة</p>
                    </div>
                  ) : topRisks.map(r => (
                    <Link key={r.id} href={r.href ?? '/dashboard/admin-gateway/intelligence/risk'}
                      className="block bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 hover:bg-slate-800 transition">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-semibold ${SEV_BADGE[r.severity]}`}>
                          {SEV_AR[r.severity]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-200">{r.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{r.detail}</p>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Col 2: Project Execution */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    تنفيذ المشاريع
                  </h3>
                  <Link href="/dashboard/admin-gateway/reports/operations"
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition">
                    التقرير →
                  </Link>
                </div>
                <div className="p-3 space-y-2">
                  {projects.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-slate-500">لا توجد مشاريع نشطة حالياً</p>
                    </div>
                  ) : projects.map(p => {
                    const budget   = p.budget ?? 0;
                    const contract = p.contracts_total ?? 0;
                    const coverage = budget > 0 ? Math.min(Math.round(contract / budget * 100), 100) : 0;
                    const statusClass =
                      p.status === 'active'   ? 'bg-emerald-500' :
                      p.status === 'on_hold'  ? 'bg-orange-500'  :
                      p.status === 'planning' ? 'bg-blue-500'    : 'bg-slate-500';
                    return (
                      <div key={p.id} className="bg-slate-800/40 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-200 font-medium truncate max-w-[65%]">{p.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full text-white ${statusClass}`}>
                            {STATUS_AR[p.status] ?? p.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${coverage}%` }} />
                          </div>
                          <span className="text-sm text-slate-500">{coverage}%</span>
                        </div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          {budget > 0 ? compact(budget) + ' د.ل' : 'بلا ميزانية'} &bull;
                          🚗{p.vehicles_assigned} 🔧{p.equipment_assigned}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Col 3: Financial snapshot */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    الصحة المالية
                  </h3>
                  <Link href="/dashboard/admin-gateway/reports/financial"
                    className="text-sm text-emerald-400 hover:text-emerald-300 transition">
                    التقرير →
                  </Link>
                </div>
                <div className="p-4 space-y-3">
                  {/* Revenue bar */}
                  {[
                    { label: 'الإيرادات المُفوترة', val: exec.revenue.total_invoiced, max: exec.revenue.total_invoiced, color: 'bg-blue-500' },
                    { label: 'المحصّل',             val: exec.revenue.total_collected, max: exec.revenue.total_invoiced, color: 'bg-emerald-500' },
                    { label: 'المتأخر',             val: exec.revenue.total_outstanding, max: exec.revenue.total_invoiced, color: 'bg-rose-500' },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400">{r.label}</span>
                        <span className="text-slate-300">{compact(r.val)} د.ل</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${r.color}`}
                          style={{ width: r.max > 0 ? `${Math.min((r.val / r.max) * 100, 100)}%` : '0%' }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
                    <div className="text-center">
                      <div className="text-base font-bold text-slate-100">{compact(exec.journal_entries.total_debit)} <span className="text-sm text-slate-500">د.ل</span></div>
                      <div className="text-sm text-slate-500">إجمالي الإنفاق</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-bold text-slate-100">{compact(exec.contracts.total_value)} <span className="text-sm text-slate-500">د.ل</span></div>
                      <div className="text-sm text-slate-500">قيمة العقود</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Zone 3: Ops + Procurement ─────────────────────────────── */}
            <div className="grid md:grid-cols-2 gap-4">

              {/* Fleet + Inventory */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-violet-400" />
                    العمليات والموارد
                  </h3>
                  <Link href="/dashboard/admin-gateway/reports/operations"
                    className="text-sm text-violet-400 hover:text-violet-300 transition">
                    التقرير →
                  </Link>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3">
                  <MetCell v={exec.fleet.active_vehicles}    label="مركبات نشطة"   hi={exec.fleet.active_vehicles > 0} />
                  <MetCell v={exec.fleet.maintenance_vehicles} label="في الصيانة" warn={exec.fleet.maintenance_vehicles > 0} />
                  <MetCell v={exec.fleet.total_vehicles}     label="إجمالي"     />
                  <MetCell v={exec.fleet.active_equipment}   label="معدات نشطة"  hi={exec.fleet.active_equipment > 0} />
                  <MetCell v={compact(exec.fleet.total_fuel_cost)} label="تكلفة الوقود" />
                  <MetCell v={compact(exec.inventory.total_received_value)} label="مخزون وارد" />
                </div>
              </div>

              {/* Procurement + Approvals */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-purple-400" />
                    المشتريات والاعتمادات
                  </h3>
                  <Link href="/dashboard/admin-gateway/reports/procurement"
                    className="text-sm text-purple-400 hover:text-purple-300 transition">
                    التقرير →
                  </Link>
                </div>
                <div className="p-4 grid grid-cols-3 gap-3">
                  <MetCell v={exec.procurement.pr_total}    label="طلبات شراء"                                          />
                  <MetCell v={exec.procurement.pr_pending}  label="معلق"   warn={exec.procurement.pr_pending > 0}        />
                  <MetCell v={exec.procurement.pr_approved} label="معتمد"  hi={exec.procurement.pr_approved > 0}         />
                  <MetCell v={exec.approvals.pending}       label="اعتمادات معلقة" warn={exec.approvals.pending > 0}     />
                  <MetCell v={exec.approvals.approved}      label="معتمدة"  hi={exec.approvals.approved > 0}             />
                  <MetCell v={exec.approvals.rejected}      label="مرفوض"  warn={exec.approvals.rejected > 0}            />
                </div>
              </div>
            </div>

            {/* ── Zone 4: Intelligence Layer Navigation ─────────────────── */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                طبقات الذكاء التنفيذي
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <IntelCard href="/dashboard/command-center"
                  icon={<BarChart3 className="w-4 h-4 text-indigo-400" />}
                  title="اللوحة التنفيذية"
                  desc="مؤشرات KPI + رسوم بيانية تفاعلية"
                  accent="border-indigo-500/30 hover:border-indigo-400/50"
                />
                <IntelCard href="/dashboard/admin-gateway/intelligence/risk"
                  icon={<Shield className="w-4 h-4 text-orange-400" />}
                  title="طبقة المخاطر"
                  desc="اكتشاف مخاطر تلقائي + إنذار مبكر"
                  accent="border-orange-500/30 hover:border-orange-400/50"
                />
                <IntelCard href="/dashboard/admin-gateway/intelligence/performance"
                  icon={<Activity className="w-4 h-4 text-teal-400" />}
                  title="ذكاء الأداء"
                  desc="تحليل أداء المشاريع والدورات"
                  accent="border-teal-500/30 hover:border-teal-400/50"
                />
                <IntelCard href="/dashboard/admin-gateway/intelligence/forecast"
                  icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
                  title="التوقعات الذكية"
                  desc="استشراف مستند إلى بيانات حقيقية"
                  accent="border-blue-500/30 hover:border-blue-400/50"
                />
                <IntelCard href="/dashboard/admin-gateway/intelligence/briefing"
                  icon={<FileText className="w-4 h-4 text-amber-400" />}
                  title="الإحاطة التنفيذية"
                  desc="ملخص تنفيذي نصي باللغة العربية"
                  accent="border-amber-500/30 hover:border-amber-400/50"
                />
                <IntelCard href="/dashboard/admin-gateway/reports/executive"
                  icon={<Cpu className="w-4 h-4 text-violet-400" />}
                  title="تقرير القيادة"
                  desc="تقرير موحد للمسؤولين التنفيذيين"
                  accent="border-violet-500/30 hover:border-violet-400/50"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
