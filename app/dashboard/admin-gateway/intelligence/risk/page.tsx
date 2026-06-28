'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Shield, AlertTriangle, RefreshCw, ChevronLeft,
  DollarSign, Activity, Users, Database,
  CheckCircle, Info, Filter, TrendingDown,
} from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};
// ── Types (matching actual API) ────────────────────────────────────────────────
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

interface FinJEProject {
  project_name:  string | null;
  project_id:    number | null;
  entries:       number;
  total_debit:   number;
  total_credit:  number;
}

interface FinData {
  grand_totals: { total_debits: number; total_invoiced: number; total_collected: number; total_po_spend: number; total_fuel_cost: number; };
  journal_entries_by_project: FinJEProject[];
}

// ── Risk engine types ──────────────────────────────────────────────────────────
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type RiskCategory = 'financial' | 'operational' | 'governance' | 'data';

export interface RiskItem {
  id:         string;
  category:   RiskCategory;
  severity:   RiskSeverity;
  title:      string;
  detail:     string;
  entity:     string;
  department: string;
  action:     string;
  href?:      string;
}

// ── Helper ─────────────────────────────────────────────────────────────────────
const compact = (v: number): string => {
  if (!v) return '0';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(0) + 'K';
  return v.toFixed(0);
};

// ── Risk derivation engine (pure function, frontend-only) ──────────────────────
function deriveRisks(exec: ExecData, fin: FinData | null): RiskItem[] {
  const risks: RiskItem[] = [];

  /* ── FINANCIAL ───────────────────────────────────────────────────────────── */

  // Overdue invoices
  if (exec.revenue.overdue_invoices > 0) {
    const outstanding = exec.revenue.total_outstanding;
    const sev: RiskSeverity = outstanding > 500_000 ? 'critical' : outstanding > 100_000 ? 'high' : 'medium';
    risks.push({
      id: 'fin-overdue', category: 'financial', severity: sev,
      title:      'فواتير متأخرة التحصيل',
      detail:     `${exec.revenue.overdue_invoices} فاتورة متأخرة — مستحق غير محصّل: ${compact(outstanding)} د.ل`,
      entity:     'إدارة الإيرادات',
      department: 'الإدارة المالية',
      action:     'مراجعة قوائم المدينين وإصدار إشعارات تحصيل عاجلة',
      href:       '/dashboard/admin-gateway/revenue/invoices',
    });
  }

  // Low collection rate
  const collRate = exec.revenue.total_invoiced > 0
    ? exec.revenue.total_collected / exec.revenue.total_invoiced : 1;
  if (collRate < 0.5 && exec.revenue.total_invoiced > 0) {
    risks.push({
      id: 'fin-low-coll', category: 'financial', severity: 'high',
      title:      'نسبة تحصيل منخفضة',
      detail:     `معدل التحصيل: ${(collRate * 100).toFixed(1)}% — محصّل ${compact(exec.revenue.total_collected)} من ${compact(exec.revenue.total_invoiced)} د.ل`,
      entity:     'دورة التحصيل',
      department: 'الإدارة المالية',
      action:     'مراجعة أسباب تأخر التحصيل وتفعيل إجراءات المتابعة',
      href:       '/dashboard/admin-gateway/revenue/collections',
    });
  }

  // Budget utilization
  const budgetUtil = exec.projects.total_budget > 0
    ? exec.journal_entries.total_debit / exec.projects.total_budget : 0;
  if (budgetUtil > 0.9) {
    risks.push({
      id: 'fin-budget-overrun', category: 'financial', severity: 'critical',
      title:      'تجاوز ميزانية وشيك',
      detail:     `نسبة استخدام الميزانية: ${(budgetUtil * 100).toFixed(1)}% — إنفاق: ${compact(exec.journal_entries.total_debit)} من ${compact(exec.projects.total_budget)} د.ل`,
      entity:     'الميزانية الكلية',
      department: 'الإدارة المالية',
      action:     'وقف أوامر الصرف غير الضرورية وإعادة تقييم الميزانية',
      href:       '/dashboard/admin-gateway/finance/budgets',
    });
  } else if (budgetUtil > 0.75) {
    risks.push({
      id: 'fin-budget-high', category: 'financial', severity: 'medium',
      title:      'استخدام مرتفع للميزانية',
      detail:     `نسبة الاستخدام: ${(budgetUtil * 100).toFixed(1)}%`,
      entity:     'الميزانية الكلية',
      department: 'الإدارة المالية',
      action:     'مراجعة توزيع الإنفاق وإعداد توقعات للفترة المتبقية',
      href:       '/dashboard/admin-gateway/reports/financial',
    });
  }

  // Journal entries without project link
  if (fin) {
    const unlinked = (fin.journal_entries_by_project ?? []).filter(p => !p.project_name);
    if (unlinked.length > 0) {
      const unlinkedDebit = unlinked.reduce((s, p) => s + p.total_debit, 0);
      risks.push({
        id: 'fin-unlinked-je', category: 'financial', severity: 'low',
        title:      'قيود محاسبية بدون مشروع',
        detail:     `${unlinked.length} مجموعة قيود غير مرتبطة بمشروع — إجمالي: ${compact(unlinkedDebit)} د.ل`,
        entity:     'القيود المحاسبية',
        department: 'الإدارة المالية',
        action:     'ربط القيود المحاسبية بمشاريعها المعنية',
        href:       '/dashboard/admin-gateway/accounting/journal-entries',
      });
    }
  }

  /* ── OPERATIONAL ─────────────────────────────────────────────────────────── */

  if (exec.projects.on_hold > 0) {
    risks.push({
      id: 'ops-on-hold', category: 'operational',
      severity: exec.projects.on_hold >= 2 ? 'high' : 'medium',
      title:      'مشاريع متوقفة',
      detail:     `${exec.projects.on_hold} مشروع في وضع الإيقاف — يسبب تأخيرات تراكمية`,
      entity:     'إدارة المشاريع',
      department: 'مكتب إدارة المشاريع',
      action:     'مراجعة أسباب الإيقاف وإصدار قرار بالاستئناف أو الإلغاء',
      href:       '/dashboard/admin-gateway/projects/list',
    });
  }

  const maintRate = exec.fleet.total_vehicles > 0
    ? exec.fleet.maintenance_vehicles / exec.fleet.total_vehicles : 0;
  if (exec.fleet.maintenance_vehicles > 0) {
    const sev: RiskSeverity = maintRate > 0.3 ? 'high' : maintRate > 0.15 ? 'medium' : 'low';
    risks.push({
      id: 'ops-fleet', category: 'operational', severity: sev,
      title:      'ضغط صيانة الأسطول',
      detail:     `${exec.fleet.maintenance_vehicles}/${exec.fleet.total_vehicles} مركبة في الصيانة (${(maintRate * 100).toFixed(0)}%)`,
      entity:     'أسطول المركبات',
      department: 'إدارة العمليات',
      action:     'تسريع دورة الصيانة وتقييم إمكانية الاستعانة بأسطول إضافي',
      href:       '/dashboard/admin-gateway/vehicles/vehicles',
    });
  }

  if (exec.procurement.pr_pending > 0) {
    risks.push({
      id: 'ops-pr-pending', category: 'operational',
      severity: exec.procurement.pr_pending > 5 ? 'high' : 'medium',
      title:      'طلبات شراء متوقفة',
      detail:     `${exec.procurement.pr_pending} طلب شراء معلق لم يُعتمد`,
      entity:     'دورة المشتريات',
      department: 'إدارة المشتريات',
      action:     'مراجعة طلبات الشراء المعلقة وتحديد أسباب التوقف',
      href:       '/dashboard/admin-gateway/procurement/requests',
    });
  }

  if (exec.procurement.po_total > 0 && exec.procurement.po_issued === 0 && exec.procurement.po_completed === 0) {
    risks.push({
      id: 'ops-po-stalled', category: 'operational', severity: 'medium',
      title:      'أوامر شراء بدون حركة',
      detail:     `${exec.procurement.po_total} أمر شراء لا موقّع ولا منجز`,
      entity:     'دورة المشتريات',
      department: 'إدارة المشتريات',
      action:     'مراجعة حالة أوامر الشراء وتحديث الوضع الفعلي في النظام',
      href:       '/dashboard/admin-gateway/procurement/orders',
    });
  }

  /* ── GOVERNANCE ──────────────────────────────────────────────────────────── */

  if (exec.approvals.pending > 5) {
    risks.push({
      id: 'gov-approval-backlog', category: 'governance', severity: 'high',
      title:      'تراكم في الموافقات',
      detail:     `${exec.approvals.pending} طلب اعتماد معلق — يعيق دورة العمل`,
      entity:     'نظام الاعتمادات',
      department: 'الإدارة العليا',
      action:     'تعيين معتمدين إضافيين أو اتخاذ قرار خلال 48 ساعة',
      href:       '/dashboard/admin-gateway/workflow/approvals',
    });
  } else if (exec.approvals.pending > 0) {
    risks.push({
      id: 'gov-approval-pending', category: 'governance', severity: 'medium',
      title:      'موافقات معلقة',
      detail:     `${exec.approvals.pending} طلب اعتماد ينتظر القرار`,
      entity:     'نظام الاعتمادات',
      department: 'الإدارة العليا',
      action:     'مراجعة الطلبات المعلقة واتخاذ القرار المناسب',
      href:       '/dashboard/admin-gateway/workflow/approvals',
    });
  }

  if (exec.contracts.draft > 0 && exec.contracts.active === 0) {
    risks.push({
      id: 'gov-no-contracts', category: 'governance', severity: 'high',
      title:      'لا عقود نشطة',
      detail:     `${exec.contracts.draft} عقد مسودة — لا عقود نشطة مما يزيد المخاطر التعاقدية`,
      entity:     'إدارة العقود',
      department: 'الإدارة القانونية',
      action:     'تفعيل العقود الجاهزة واستكمال إجراءات توقيع العقود',
      href:       '/dashboard/admin-gateway/contracts/list',
    });
  } else if (exec.contracts.draft > 0) {
    risks.push({
      id: 'gov-draft-contracts', category: 'governance', severity: 'low',
      title:      'عقود في مرحلة المسودة',
      detail:     `${exec.contracts.draft} عقد مسودة يستحق المتابعة`,
      entity:     'إدارة العقود',
      department: 'الإدارة القانونية',
      action:     'متابعة استكمال إجراءات توقيع العقود',
      href:       '/dashboard/admin-gateway/contracts/list',
    });
  }

  if (exec.approvals.rejected > 0) {
    risks.push({
      id: 'gov-rejections', category: 'governance', severity: 'medium',
      title:      'طلبات مرفوضة',
      detail:     `${exec.approvals.rejected} طلب اعتماد مرفوض — يستحق تحليل الأسباب`,
      entity:     'نظام الاعتمادات',
      department: 'الإدارة العليا',
      action:     'تحليل أسباب الرفض وتحديد ما إذا كان ناتجاً عن قصور في البيانات أو قرار موضوعي',
      href:       '/dashboard/admin-gateway/workflow/approvals',
    });
  }

  /* ── DATA RISKS ──────────────────────────────────────────────────────────── */

  if (exec.employees.total === 0) {
    risks.push({
      id: 'data-no-employees', category: 'data', severity: 'medium',
      title:      'بيانات الموظفين غير مكتملة',
      detail:     'لا يوجد سجل للموظفين — يؤثر على تقارير الأداء والكفاءة',
      entity:     'إدارة الموارد البشرية',
      department: 'الموارد البشرية',
      action:     'استيراد بيانات الموظفين أو التحقق من إعداد النظام',
      href:       '/dashboard/admin-gateway/hr/employees',
    });
  }

  if (exec.inventory.total_received_value > 0 && exec.inventory.total_issued_value === 0) {
    risks.push({
      id: 'data-inventory-no-issues', category: 'data', severity: 'low',
      title:      'مخزون بدون صرفيات',
      detail:     `مستلم ${compact(exec.inventory.total_received_value)} د.ل ولا يوجد صرف مسجّل`,
      entity:     'إدارة المخزون',
      department: 'إدارة العمليات',
      action:     'تحقق من تسجيل الصرفيات أو مراجعة إعدادات المخزن',
      href:       '/dashboard/admin-gateway/inventory/issues',
    });
  }

  if (exec.projects.total > 0 && exec.projects.completed === 0 && exec.projects.planning === 0) {
    risks.push({
      id: 'data-no-completions', category: 'data', severity: 'low',
      title:      'لا مشاريع مكتملة',
      detail:     `جميع المشاريع (${exec.projects.total}) نشطة أو متوقفة — لا اكتمالات مسجّلة`,
      entity:     'تقدم المشاريع',
      department: 'مكتب إدارة المشاريع',
      action:     'تحديث نسب إنجاز المشاريع في النظام',
      href:       '/dashboard/admin-gateway/project-control/progress',
    });
  }

  return risks;
}

// ── Severity config ────────────────────────────────────────────────────────────
const SEV_CONFIG: Record<RiskSeverity, { label: string; cls: string; badge: string; order: number }> = {
  critical: { label: 'حرج',   cls: 'border-rose-500/40   bg-rose-950/30',   badge: 'bg-rose-500/20   text-rose-300   border border-rose-500/40',   order: 0 },
  high:     { label: 'عالي',   cls: 'border-orange-500/40 bg-orange-950/20', badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/40', order: 1 },
  medium:   { label: 'متوسط', cls: 'border-amber-500/40  bg-amber-950/20',  badge: 'bg-amber-500/20  text-amber-300  border border-amber-500/40',  order: 2 },
  low:      { label: 'منخفض', cls: 'border-blue-500/40   bg-blue-950/20',   badge: 'bg-blue-500/20   text-blue-300   border border-blue-500/40',   order: 3 },
};

const CAT_CONFIG: Record<RiskCategory, { label: string; icon: React.ReactNode }> = {
  financial:   { label: 'مالي',      icon: <DollarSign className="w-3.5 h-3.5" /> },
  operational: { label: 'تشغيلي',  icon: <Activity    className="w-3.5 h-3.5" /> },
  governance:  { label: 'حوكمة',  icon: <Shield      className="w-3.5 h-3.5" /> },
  data:        { label: 'بيانات',   icon: <Database    className="w-3.5 h-3.5" /> },
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function RiskLayerPage() {
  const [exec,    setExec]    = useState<ExecData | null>(null);
  const [fin,     setFin]     = useState<FinData  | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');
  const [filterSev,  setFilterSev]  = useState<RiskSeverity | 'all'>('all');
  const [filterCat,  setFilterCat]  = useState<RiskCategory | 'all'>('all');

  const fetchAll = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const h = { 'X-Tenant-ID': getTenantId() || '' };
      const [er, fr] = await Promise.all([
        fetch('/api/v1/gov-reports/executive',  { headers: h }),
        fetch('/api/v1/gov-reports/financial',  { headers: h }),
      ]);
      const [ed, fd] = await Promise.all([er.json(), fr.json()]);
      if (!er.ok) throw new Error(ed.detail ?? 'executive error');
      setExec(ed);
      setFin(fr.ok ? fd : null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const allRisks = useMemo(() => {
    if (!exec) return [];
    return deriveRisks(exec, fin).sort(
      (a, b) => SEV_CONFIG[a.severity].order - SEV_CONFIG[b.severity].order
    );
  }, [exec, fin]);

  const filtered = useMemo(() =>
    allRisks.filter(r =>
      (filterSev === 'all' || r.severity === filterSev) &&
      (filterCat === 'all' || r.category === filterCat)
    ), [allRisks, filterSev, filterCat]);

  // Summary counts
  const counts = useMemo(() => ({
    critical: allRisks.filter(r => r.severity === 'critical').length,
    high:     allRisks.filter(r => r.severity === 'high').length,
    medium:   allRisks.filter(r => r.severity === 'medium').length,
    low:      allRisks.filter(r => r.severity === 'low').length,
  }), [allRisks]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Verification Marker ─────────────────────────────────────────── */}
        <div className="bg-orange-900/30 border border-orange-500/40 rounded-lg px-4 py-2 text-orange-300 text-xs font-mono text-center">
          &#10003; RISK LAYER LIVE &mdash; طبقة المخاطر والإنذار المبكر | {new Date().toLocaleDateString('ar-LY')}
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
              <Shield className="w-6 h-6 text-orange-400" />
              طبقة المخاطر والإنذار المبكر
            </h1>
          </div>
          <div className="flex items-center gap-2">
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
            <AlertTriangle className="w-4 h-4" />
            {err.includes('503') || err.includes('unavailable') || err.includes('not available')
              ? 'الخدمة غير متاحة حالياً — يرجى المحاولة لاحقاً'
              : err.includes('500') || err.includes('Failed')
              ? 'حدث خطأ في النظام — يرجى المحاولة لاحقاً'
              : err}
          </div>
        )}

        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-800/50" />)}
          </div>
        )}

        {!loading && exec && (
          <>
            {/* ── Summary Counts ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['critical', 'high', 'medium', 'low'] as RiskSeverity[]).map(sev => (
                <button key={sev} onClick={() => setFilterSev(filterSev === sev ? 'all' : sev)}
                  className={`p-4 rounded-xl border transition text-right ${
                    filterSev === sev ? SEV_CONFIG[sev].cls + ' ring-1 ring-inset ring-current' : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'
                  }`}>
                  <div className="text-3xl font-bold text-slate-100">{counts[sev]}</div>
                  <div className={`text-sm font-semibold mt-1 ${SEV_CONFIG[sev].badge.split(' ').find(c => c.startsWith('text-')) ?? ''}`}>
                    {SEV_CONFIG[sev].label}
                  </div>
                  {counts[sev] === 0 && (
                    <div className="text-xs text-slate-600 mt-1">القيمة الفعلية: 0</div>
                  )}
                </button>
              ))}
            </div>

            {/* ── Filters ───────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-500">تصفية:</span>
              {(['all', 'financial', 'operational', 'governance', 'data'] as const).map(cat => (
                <button key={cat} onClick={() => setFilterCat(cat as RiskCategory | 'all')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition border ${
                    filterCat === cat
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}>
                  {cat === 'all' ? 'الكل' : CAT_CONFIG[cat as RiskCategory].label}
                </button>
              ))}
              <span className="text-sm text-slate-600 mr-2">— {filtered.length} مخاطرة</span>
            </div>

            {/* ── Risk Items ────────────────────────────────────────────── */}
            {filtered.length === 0 ? (
              <div className="bg-green-950/30 border border-green-500/30 rounded-xl p-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-300 font-medium">لا مخاطر في الفئة المحددة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(risk => {
                  const sevCfg = SEV_CONFIG[risk.severity];
                  const catCfg = CAT_CONFIG[risk.category];
                  return (
                    <div key={risk.id}
                      className={`rounded-xl border p-5 ${sevCfg.cls}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        {/* Left: title + badges */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`text-sm px-2.5 py-0.5 rounded-full font-semibold ${sevCfg.badge}`}>
                              {sevCfg.label}
                            </span>
                            <span className="flex items-center gap-1 text-sm px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700">
                              {catCfg.icon}
                              {catCfg.label}
                            </span>
                          </div>
                          <h3 className="text-slate-100 font-semibold mb-1">{risk.title}</h3>
                          <p className="text-base text-slate-400">{risk.detail}</p>
                        </div>
                        {/* Right: entity + dept */}
                        <div className="text-right text-sm space-y-1.5 flex-shrink-0">
                          <div className="text-slate-500">الجهة: <span className="text-slate-300">{risk.entity}</span></div>
                          <div className="text-slate-500">القسم: <span className="text-slate-300">{risk.department}</span></div>
                        </div>
                      </div>
                      {/* Action + link */}
                      <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span>الإجراء الموصى به: {risk.action}</span>
                        </div>
                        {risk.href && (
                          <Link href={risk.href}
                            className="text-sm text-indigo-400 hover:text-indigo-300 border-b border-indigo-400/30 hover:border-indigo-300 transition whitespace-nowrap">
                            الذهاب للصفحة ←
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Last generated ──────────────────────────────────────── */}
            <p className="text-sm text-slate-600 text-center pb-2">
              البيانات من: {exec.generated_at ? new Date(exec.generated_at).toLocaleString('ar-LY') : '—'} &mdash; تحليل آلي للمخاطر
            </p>
          </>
        )}
      </div>
    </div>
  );
}
