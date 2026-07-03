'use client';

/**
 * Performance Intelligence Layer — Phase 3 of Executive Intelligence
 * Route: /dashboard/admin-gateway/intelligence/performance
 *
 * Measures: project execution, approval workflow, procurement cycle, financial health
 * All data derived from existing working APIs (no fake data).
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity, RefreshCw, ChevronLeft, TrendingUp, TrendingDown,
  CheckCircle, Clock, XCircle, BarChart3, Truck, ShoppingBag,
  DollarSign, Layers, AlertTriangle,
} from 'lucide-react';
import GmOfficeTabBar from '@/components/GmOfficeTabBar';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};
// ── API types ──────────────────────────────────────────────────────────────────
interface ExecData {
  generated_at: string;
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
  id:                 number;
  name:               string;
  code:               string;
  status:             string;
  budget:             number | null;
  contracts_total:    number | null;
  vehicles_assigned:  number;
  equipment_assigned: number;
}

interface OpsData {
  projects_breakdown: OpsProject[];
  fleet_status:       { total: number; active: number; maintenance: number; };
  approvals:          { by_status: Record<string,number>; };
}

interface ApprovalByType {
  entity_type: string;
  total:       number;
  pending:     number;
  approved:    number;
  rejected:    number;
}

interface ApprovalSummary {
  totals: { total: number; pending: number; approved: number; rejected: number; returned: number; cancelled: number; };
  by_entity_type: ApprovalByType[];
  pending_by_role: Array<{ role: string; count: number }>;
}

interface ProcData {
  suppliers:         { total: number; active: number; };
  purchase_requests: { total: number; pending: number; approved: number; rejected: number; };
  purchase_orders:   { total: number; draft: number; issued: number; completed: number; cancelled: number; total_amount: number; };
  contracts:         { total: number; active: number; total_value: number; };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const compact = (v: number) => {
  if (!v && v !== 0) return '—';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(0) + 'K';
  return v.toFixed(0);
};

const pct = (n: number, d: number) => d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—';

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-rose-400';
}

function scoreBar(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-rose-500';
}

function statusBadge(status: string): string {
  const s = status?.toLowerCase() ?? '';
  if (s === 'active'   || s === 'نشط')    return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
  if (s === 'on_hold'  || s === 'متوقف')  return 'bg-orange-500/15  text-orange-300  border border-orange-500/30';
  if (s === 'planning' || s === 'تخطيط') return 'bg-blue-500/15    text-blue-300    border border-blue-500/30';
  if (s === 'completed')                   return 'bg-slate-500/15   text-slate-300   border border-slate-500/30';
  return 'bg-slate-700/50 text-slate-400 border border-slate-600';
}

const STATUS_AR: Record<string,string> = {
  active: 'نشط', on_hold: 'متوقف', planning: 'تخطيط', completed: 'مكتمل',
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, trend, hint }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; trend?: 'up' | 'down' | 'neutral';
  hint?: string; // shown when value may be misleading (e.g. true zero vs no data)
}) {
  const trendIcon = trend === 'up'
    ? <TrendingUp   className="w-4 h-4 text-emerald-400" />
    : trend === 'down'
    ? <TrendingDown className="w-4 h-4 text-rose-400"    />
    : null;
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex gap-3 items-start">
      <div className="mt-0.5 w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-100">{value}</span>
          {trendIcon}
        </div>
        {sub  && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
        {hint && <p className="text-xs text-amber-500/80 mt-1 border-t border-amber-500/20 pt-1">{hint}</p>}
      </div>
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHead({ title, icon, href }: { title: string; icon: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        {icon}{title}
      </h2>
      {href && (
        <Link href={href} className="text-sm text-indigo-400 hover:text-indigo-300 transition border-b border-indigo-400/30">
          التفاصيل ←
        </Link>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const [exec,  setExec]  = useState<ExecData | null>(null);
  const [ops,   setOps]   = useState<OpsData  | null>(null);
  const [appr,  setAppr]  = useState<ApprovalSummary | null>(null);
  const [proc,  setProc]  = useState<ProcData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const h = { 'X-Tenant-ID': getTenantId() || '' };
      const [er, or, ar, pr] = await Promise.all([
        fetch('/api/v1/gov-reports/executive',  { headers: h }),
        fetch('/api/v1/gov-reports/operations', { headers: h }),
        fetch('/api/v1/approval/summary',       { headers: h }),
        fetch('/api/v1/gov-reports/procurement',{ headers: h }),
      ]);
      const [ed, od, ad, pd] = await Promise.all([er.json(), or.json(), ar.json(), pr.json()]);
      if (!er.ok) throw new Error(ed.detail ?? 'executive api error');
      setExec(ed);
      setOps(or.ok ? od : null);
      setAppr(ar.ok ? ad : null);
      setProc(pr.ok ? pd : null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Computed KPIs ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!exec) return null;

    const collRate    = exec.revenue.total_invoiced > 0
      ? (exec.revenue.total_collected / exec.revenue.total_invoiced * 100) : 0;
    const approvalRate = (exec.approvals.approved + exec.approvals.rejected) > 0
      ? (exec.approvals.approved / (exec.approvals.approved + exec.approvals.rejected) * 100) : 0;
    const fleetUtil   = exec.fleet.total_vehicles > 0
      ? (exec.fleet.active_vehicles / exec.fleet.total_vehicles * 100) : 0;
    const budgetUtil  = exec.projects.total_budget > 0
      ? (exec.journal_entries.total_debit / exec.projects.total_budget * 100) : 0;

    return {
      collRate, approvalRate, fleetUtil, budgetUtil,
      collHint:     exec.revenue.total_invoiced    === 0 ? 'لا توجد بيانات إيرادات' : undefined,
      approvalHint: exec.approvals.total            === 0 ? 'لا توجد موافقات مسجلة' : undefined,
      fleetHint:    exec.fleet.total_vehicles       === 0 ? 'لا توجد مركبات مسجلة'  : undefined,
      budgetHint:   exec.projects.total_budget      === 0 ? 'لا توجد ميزانية مسجلة' : undefined,
    };
  }, [exec]);

  // ── Project performance table ──────────────────────────────────────────────
  const projectRows = useMemo(() => {
    if (!ops?.projects_breakdown) return [];
    return ops.projects_breakdown.map(p => {
      const budget   = p.budget ?? 0;
      const contract = p.contracts_total ?? 0;
      const coverage = budget > 0 ? Math.min((contract / budget) * 100, 100) : 0;
      const score    = Math.round(
        (p.status === 'active' ? 30 : p.status === 'completed' ? 40 : p.status === 'planning' ? 15 : 0) +
        Math.min(coverage * 0.4, 40) +
        ((p.vehicles_assigned + p.equipment_assigned) > 0 ? 30 : 0)
      );
      return { ...p, coverage, score };
    });
  }, [ops]);

  // ── Approval type performance ──────────────────────────────────────────────
  const approvalRows = useMemo(() => {
    if (!appr?.by_entity_type) return [];
    return appr.by_entity_type
      .filter(r => r.total > 0)
      .map(r => ({
        ...r,
        rateNum: (r.approved + r.rejected) > 0
          ? Math.round(r.approved / (r.approved + r.rejected) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [appr]);

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col" dir="rtl">
      <GmOfficeTabBar />
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Verification Marker ─────────────────────────────────────────── */}
        <div className="bg-teal-900/30 border border-teal-500/40 rounded-lg px-4 py-2 text-teal-300 text-xs font-mono text-center">
          &#10003; PERFORMANCE LIVE &mdash; ذكاء الأداء التنفيذي | {new Date().toLocaleDateString('ar-LY')}
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin-gateway"
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-base transition">
              <ChevronLeft className="w-4 h-4" />
              البوابة
            </Link>
            <span className="text-slate-700">/</span>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-400" />
              ذكاء الأداء التنفيذي
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/admin-gateway/intelligence/risk"
              className="px-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition">
              طبقة المخاطر
            </Link>
            <Link href="/dashboard/command-center"
              className="px-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition">
              لوحة القيادة
            </Link>
            <button onClick={fetchAll} disabled={loading}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {err && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />{err}
          </div>
        )}

        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-800/50" />)}
            </div>
            <div className="h-48 rounded-xl bg-slate-800/50" />
            <div className="h-36 rounded-xl bg-slate-800/50" />
          </div>
        )}

        {!loading && exec && kpis && (
          <>
            {/* ── KPI Row ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="معدل التحصيل"
                value={kpis.collRate.toFixed(1) + '%'}
                sub={`محصّل ${compact(exec.revenue.total_collected)} د.ل`}
                icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                trend={kpis.collRate >= 70 ? 'up' : 'down'}
                hint={kpis.collHint}
              />
              <KpiCard
                label="معدل الموافقة"
                value={kpis.approvalRate.toFixed(1) + '%'}
                sub={`${exec.approvals.approved} موافقة / ${exec.approvals.total} إجمالي`}
                icon={<CheckCircle className="w-4 h-4 text-blue-400" />}
                trend={kpis.approvalRate >= 80 ? 'up' : 'neutral'}
                hint={kpis.approvalHint}
              />
              <KpiCard
                label="كفاءة الأسطول"
                value={kpis.fleetUtil.toFixed(1) + '%'}
                sub={`${exec.fleet.active_vehicles} نشطة من ${exec.fleet.total_vehicles}`}
                icon={<Truck className="w-4 h-4 text-violet-400" />}
                trend={kpis.fleetUtil >= 70 ? 'up' : 'down'}
                hint={kpis.fleetHint}
              />
              <KpiCard
                label="استهلاك الميزانية"
                value={kpis.budgetUtil.toFixed(1) + '%'}
                sub={`${compact(exec.journal_entries.total_debit)} من ${compact(exec.projects.total_budget)} د.ل`}
                icon={<BarChart3 className="w-4 h-4 text-amber-400" />}
                trend={kpis.budgetUtil > 90 ? 'down' : 'neutral'}
                hint={kpis.budgetHint}
              />
            </div>

            {/* ── Project Execution Table ───────────────────────────────── */}
            {projectRows.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center">
                <p className="text-slate-500 text-sm">لا توجد بيانات مشاريع حالياً</p>
                <p className="text-slate-600 text-xs mt-1">سيظهر هنا أداء المشاريع فور تسجيلها في النظام</p>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800">
                  <SectionHead
                    title="أداء تنفيذ المشاريع"
                    icon={<Layers className="w-4 h-4 text-indigo-400" />}
                    href="/dashboard/admin-gateway/reports/operations"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-sm text-slate-500 border-b border-slate-800">
                        <th className="text-right px-5 py-3 font-medium">المشروع</th>
                        <th className="text-right px-4 py-3 font-medium">الحالة</th>
                        <th className="text-right px-4 py-3 font-medium">الميزانية</th>
                        <th className="text-right px-4 py-3 font-medium">تغطية العقود</th>
                        <th className="text-right px-4 py-3 font-medium">المعدات</th>
                        <th className="text-right px-4 py-3 font-medium">نقاط الأداء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {projectRows.map(p => (
                        <tr key={p.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-200">{p.name}</div>
                            <div className="text-sm text-slate-500">{p.code}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm px-2.5 py-0.5 rounded-full ${statusBadge(p.status)}`}>
                              {STATUS_AR[p.status] ?? p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {p.budget ? compact(p.budget) + ' د.ل' : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${p.coverage >= 80 ? 'bg-emerald-500' : p.coverage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${Math.min(p.coverage, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-400">{p.coverage.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-sm">
                            {p.vehicles_assigned}🚗 {p.equipment_assigned}🔧
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${scoreBar(p.score)}`}
                                  style={{ width: `${p.score}%` }} />
                              </div>
                              <span className={`text-sm font-semibold ${scoreColor(p.score)}`}>{p.score}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Approval Workflow Performance ─────────────────────────── */}
            <div className="grid md:grid-cols-2 gap-4">
              {approvalRows.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800">
                    <SectionHead
                      title="أداء سير الاعتمادات"
                      icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}
                      href="/dashboard/admin-gateway/workflow/approvals"
                    />
                  </div>
                  <div className="p-4 space-y-3">
                    {approvalRows.map(r => (
                      <div key={r.entity_type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-300 truncate max-w-[60%]">{r.entity_type}</span>
                          <div className="flex items-center gap-3 text-slate-500">
                            <span className="text-emerald-400">{r.approved}✓</span>
                            {r.rejected > 0 && <span className="text-rose-400">{r.rejected}✗</span>}
                            {r.pending  > 0 && <span className="text-amber-400">{r.pending}⏳</span>}
                            <span className={`font-semibold ${scoreColor(r.rateNum)}`}>{r.rateNum}%</span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scoreBar(r.rateNum)}`}
                            style={{ width: `${r.rateNum}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {appr?.pending_by_role && appr.pending_by_role.length > 0 && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />معلق بحسب الدور:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {appr.pending_by_role.map(r => (
                          <span key={r.role} className="text-sm bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            {r.role}: {r.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Procurement cycle */}
              {proc && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800">
                    <SectionHead
                      title="أداء دورة المشتريات"
                      icon={<ShoppingBag className="w-4 h-4 text-purple-400" />}
                      href="/dashboard/admin-gateway/reports/procurement"
                    />
                  </div>
                  <div className="p-4 space-y-4">
                    {/* PR conversion funnel */}
                    <div>
                      <p className="text-sm text-slate-500 mb-2">قمع طلبات الشراء</p>
                      <div className="space-y-1.5">
                        {[
                          { label: 'إجمالي الطلبات',  val: proc.purchase_requests.total,    pctVal: 100               },
                          { label: 'معتمدة',          val: proc.purchase_requests.approved,  pctVal: proc.purchase_requests.total > 0 ? proc.purchase_requests.approved / proc.purchase_requests.total * 100 : 0 },
                          { label: 'أوامر شراء صادرة', val: proc.purchase_orders.total,      pctVal: proc.purchase_requests.total > 0 ? proc.purchase_orders.total    / proc.purchase_requests.total * 100 : 0 },
                          { label: 'مكتملة',          val: proc.purchase_orders.completed,   pctVal: proc.purchase_orders.total > 0  ? proc.purchase_orders.completed / proc.purchase_orders.total  * 100 : 0 },
                        ].map(row => (
                          <div key={row.label} className="flex items-center gap-2 text-sm">
                            <span className="w-32 text-slate-400 flex-shrink-0">{row.label}</span>
                            <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
                              <div className="h-full bg-violet-600/60 rounded flex items-center px-1.5"
                                style={{ width: `${Math.max(row.pctVal, 4)}%` }}>
                                <span className="text-white font-semibold text-xs">{row.val}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Supplier health */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-100">{proc.suppliers.active}</div>
                        <div className="text-sm text-slate-500">موردون نشطون</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-400">{proc.purchase_requests.pending}</div>
                        <div className="text-sm text-slate-500">طلبات معلقة</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-100">{compact(proc.purchase_orders.total_amount)}</div>
                        <div className="text-sm text-slate-500">إجمالي الشراء</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Financial Cycle Performance ───────────────────────────── */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="mb-4">
                <SectionHead
                  title="أداء الدورة المالية"
                  icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                  href="/dashboard/admin-gateway/reports/financial"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {/* Revenue cycle */}
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">دورة الإيرادات</p>
                  <div className="space-y-1.5">
                    {[
                      { label: 'مُفوتَر',   val: exec.revenue.total_invoiced,  color: 'bg-blue-500' },
                      { label: 'محصَّل',   val: exec.revenue.total_collected, color: 'bg-emerald-500' },
                      { label: 'متأخر',    val: exec.revenue.total_outstanding, color: exec.revenue.total_outstanding > 0 ? 'bg-rose-500' : 'bg-slate-700' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.color}`} />
                        <span className="text-slate-400 w-14">{row.label}</span>
                        <span className="text-slate-200 font-medium">{compact(row.val)} د.ل</span>
                      </div>
                    ))}
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-emerald-500 rounded-full"
                      style={{ width: pct(exec.revenue.total_collected, exec.revenue.total_invoiced) }} />
                  </div>
                  <p className="text-sm text-slate-500">معدل التحصيل: <span className="text-emerald-400">{pct(exec.revenue.total_collected, exec.revenue.total_invoiced)}</span></p>
                </div>

                {/* Contract coverage */}
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">تغطية العقود</p>
                  <div className="space-y-1.5">
                    {[
                      { label: 'إجمالي',   val: exec.contracts.total,     color: 'bg-slate-500' },
                      { label: 'نشطة',     val: exec.contracts.active,    color: 'bg-emerald-500' },
                      { label: 'مسودة',    val: exec.contracts.draft,     color: 'bg-amber-500' },
                      { label: 'مكتملة',   val: exec.contracts.completed, color: 'bg-blue-500' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.color}`} />
                        <span className="text-slate-400 w-14">{row.label}</span>
                        <span className="text-slate-200 font-medium">{row.val}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">قيمة العقود: <span className="text-slate-200">{compact(exec.contracts.total_value)} د.ل</span></p>
                </div>

                {/* Inventory cycle */}
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">دورة المخزون</p>
                  <div className="space-y-1.5">
                    {[
                      { label: 'واردات',  val: exec.inventory.total_received_value, color: 'bg-blue-500' },
                      { label: 'صادرات', val: exec.inventory.total_issued_value,    color: 'bg-violet-500' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.color}`} />
                        <span className="text-slate-400 w-14">{row.label}</span>
                        <span className="text-slate-200 font-medium">{compact(row.val)} د.ل</span>
                      </div>
                    ))}
                  </div>
                  {exec.inventory.total_received_value > 0 && (
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-violet-500 rounded-full"
                        style={{ width: pct(exec.inventory.total_issued_value, exec.inventory.total_received_value) }} />
                    </div>
                  )}
                  <p className="text-sm text-slate-500">
                    معدل الصرف: <span className="text-violet-400">
                      {pct(exec.inventory.total_issued_value, exec.inventory.total_received_value)}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {exec.generated_at && (
              <p className="text-sm text-slate-600 text-center pb-2">
                البيانات من: {new Date(exec.generated_at).toLocaleString('ar-LY')} — تحليل أداء في الوقت الفعلي
              </p>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
