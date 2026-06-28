'use client';

/**
 * Predictive Insights — Phase 5 of Executive Intelligence
 * Route: /dashboard/admin-gateway/intelligence/forecast
 *
 * Scenario analysis and forward projections derived entirely from real ERP data.
 * All projections are clearly labeled as "توقع" — no fake historical data.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { TrendingUp, RefreshCw, ChevronLeft, AlertTriangle, Info, Zap, DollarSign, Layers, Truck, ShoppingBag } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


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

interface FinProject {
  project_name:  string | null;
  project_id:    number | null;
  entries:       number;
  total_debit:   number;
  total_credit:  number;
}

interface FinData {
  grand_totals:           { total_debits: number; total_invoiced: number; total_collected: number; total_po_spend: number; total_fuel_cost: number; };
  journal_entries_by_project: FinProject[];
  invoices_by_project:   Array<{ project_name: string | null; project_id: number | null; total_invoiced: number; total_collected: number; invoice_count: number; }>;
}

const compact = (v: number) => {
  if (!v && v !== 0) return '0';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
};

// ── Scenario bar ──────────────────────────────────────────────────────────────
function ScenarioBar({ label, value, max, color, tag }: {
  label: string; value: number; max: number; color: string; tag?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          {tag && <span className="text-xs text-slate-600 italic">{tag}</span>}
          <span className="text-slate-200 font-medium">{compact(value)} د.ل</span>
        </div>
      </div>
      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Insight Card ───────────────────────────────────────────────────────────────
function InsightCard({ icon, title, value, sub, context, accent, hint }: {
  icon: React.ReactNode; title: string; value: string;
  sub?: string; context?: string; accent: string; hint?: string;
}) {
  return (
    <div className={`bg-slate-900/60 border ${accent} rounded-xl p-5`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-500 mb-1">{title}</p>
          <p className="text-xl font-bold text-slate-100">{value}</p>
          {sub     && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
          {context && <p className="text-sm text-slate-600 mt-1 italic">{context}</p>}
          {hint    && <p className="text-xs text-amber-500/80 mt-1 border-t border-amber-500/20 pt-1">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [exec,    setExec]    = useState<ExecData | null>(null);
  const [fin,     setFin]     = useState<FinData  | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const h = { 'X-Tenant-ID': getTenantId() || '' };
      const [er, fr] = await Promise.all([
        fetch('/api/v1/gov-reports/executive',  { headers: h }),
        fetch('/api/v1/gov-reports/financial',  { headers: h }),
      ]);
      const [ed, fd] = await Promise.all([er.json(), fr.json()]);
      if (!er.ok) throw new Error(ed.detail ?? 'error');
      setExec(ed);
      setFin(fr.ok ? fd : null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── All computed forecasts ─────────────────────────────────────────────────
  const forecasts = useMemo(() => {
    if (!exec) return null;

    const b     = exec.projects.total_budget;
    const spent = exec.journal_entries.total_debit;
    const remaining = b - spent;
    const utilRate  = b > 0 ? spent / b : 0;

    // Revenue scenarios
    const collected   = exec.revenue.total_collected;
    const outstanding = exec.revenue.total_outstanding;
    const invoiced    = exec.revenue.total_invoiced;
    const collPct     = invoiced > 0 ? collected / invoiced : 0;

    const revOptimistic  = collected + outstanding * 0.85;  // collect 85% of outstanding
    const revBase        = collected + outstanding * 0.55;  // collect 55%
    const revPessimistic = collected + outstanding * 0.20;  // collect 20%

    // Procurement pipeline
    const avgPoVal  = exec.procurement.po_total > 0 ? exec.procurement.total_amount / exec.procurement.po_total : 0;
    const pipelineVal = avgPoVal * exec.procurement.pr_approved;

    // Budget runway: if spent at linear rate, remaining capacity
    // Can't know exact time period, but show "if spending continues at current rate"
    const projectedSpend = b; // worst case: all budget gets consumed
    const budgetGap      = remaining < 0 ? Math.abs(remaining) : 0;

    // Contract coverage gap
    const contractCoverage = b > 0 ? exec.contracts.total_value / b : 0;
    const contractGap      = b > exec.contracts.total_value ? b - exec.contracts.total_value : 0;

    // Project-level budget risk (from fin data)
    const projectBudgetRisks: Array<{ name: string; debit: number; pct: number }> = [];
    if (fin?.journal_entries_by_project) {
      const invoiceMap = new Map((fin.invoices_by_project ?? []).map(p => [p.project_id, p]));
      for (const p of fin.journal_entries_by_project.filter(p => p.project_name)) {
        const inv = invoiceMap.get(p.project_id);
        const totalInv = inv?.total_invoiced ?? 0;
        const collE    = inv?.total_collected ?? 0;
        const collR    = totalInv > 0 ? collE / totalInv : 1;
        projectBudgetRisks.push({ name: p.project_name!, debit: p.total_debit, pct: Math.round(collR * 100) });
      }
    }

    return { b, spent, remaining, utilRate, revOptimistic, revBase, revPessimistic,
             invoiced, collected, outstanding, pipelineVal, avgPoVal,
             projectedSpend, budgetGap, contractCoverage, contractGap, projectBudgetRisks };
  }, [exec, fin]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Verification Marker ─────────────────────────────────────────── */}
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-lg px-4 py-2 text-blue-300 text-xs font-mono text-center">
          &#10003; FORECAST LIVE &mdash; التوقعات الذكية المستندة إلى البيانات | {new Date().toLocaleDateString('ar-LY')}
        </div>

        {/* ── Disclaimer ──────────────────────────────────────────────────── */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-slate-500">
          <Info className="w-3.5 h-3.5 flex-shrink-0 text-slate-600" />
          جميع التوقعات محسوبة من البيانات الفعلية للنظام باستخدام تحليل سيناريو — وليست بيانات تاريخية مُدخلة يدوياً
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin-gateway/intelligence/command"
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-base transition">
              <ChevronLeft className="w-4 h-4" />
              مركز القيادة
            </Link>
            <span className="text-slate-700">/</span>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              التوقعات الذكية
            </h1>
          </div>
          <button onClick={fetchAll} disabled={loading}
            className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {err && <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{err.includes('503') || err.includes('unavailable') ? 'الخدمة غير متاحة حالياً — يرجى المحاولة لاحقاً' : err.includes('500') || err.includes('Failed') ? 'حدث خطأ في النظام — يرجى المحاولة لاحقاً' : err}</div>}

        {loading && (
          <div className="space-y-4 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-slate-800/50" />)}
          </div>
        )}

        {!loading && exec && forecasts && (
          <>
            {/* ── Key Forecast Metrics ──────────────────────────────────── */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <InsightCard
                accent="border-slate-700"
                icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                title="الميزانية المتبقية (توقع)"
                value={compact(forecasts.remaining) + ' د.ل'}
                sub={`${(forecasts.utilRate * 100).toFixed(1)}% مُستخدم`}
                context={forecasts.remaining < 0 ? 'تجاوز الميزانية!' : 'المتاح للصرف'}
                hint={exec.projects.total_budget === 0 ? 'لا توجد ميزانية مسجلة' : undefined}
              />
              <InsightCard
                accent="border-slate-700"
                icon={<Zap className="w-4 h-4 text-blue-400" />}
                title="توقع الإيرادات (سيناريو متوسط)"
                value={compact(forecasts.revBase) + ' د.ل'}
                sub={`بافتراض تحصيل 55% من المتأخر`}
                context="توقع"
                hint={exec.revenue.total_invoiced === 0 ? 'لا تتوفر بيانات إيرادات كافية للتنبؤ' : undefined}
              />
              <InsightCard
                accent="border-slate-700"
                icon={<Layers className="w-4 h-4 text-indigo-400" />}
                title="فجوة تغطية العقود"
                value={forecasts.contractGap > 0 ? compact(forecasts.contractGap) + ' د.ل' : 'لا فجوة'}
                sub={`تغطية ${(forecasts.contractCoverage * 100).toFixed(1)}% من الميزانية`}
                context="مخاطرة تعاقدية"
                hint={exec.contracts.total === 0 ? 'لا توجد عقود مسجلة' : undefined}
              />
              <InsightCard
                accent="border-slate-700"
                icon={<ShoppingBag className="w-4 h-4 text-purple-400" />}
                title="خط أنابيب المشتريات"
                value={compact(forecasts.pipelineVal) + ' د.ل'}
                sub={`${exec.procurement.pr_approved} طلب شراء معتمد`}
                context="قد تتحول إلى أوامر شراء"
                hint={exec.procurement.pr_approved === 0 ? 'لا توجد طلبات شراء معتمدة حالياً' : undefined}
              />
            </div>

            {/* ── Revenue Scenario Analysis ─────────────────────────────── */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                تحليل سيناريو الإيرادات
                <span className="text-xs text-blue-400 border border-blue-500/30 rounded px-1.5">توقع</span>
              </h2>
              {exec.revenue.total_invoiced === 0 ? (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-sm">لا تتوفر بيانات كافية للتنبؤ</p>
                  <p className="text-slate-600 text-xs mt-1">يتطلب إصدار فواتير مسجلة في النظام لحساب السيناريوهات</p>
                </div>
              ) : (
              <>
              <div className="space-y-3">
                <ScenarioBar label="فعلي محصّل (الآن)"
                  value={forecasts.collected} max={forecasts.invoiced}
                  color="bg-emerald-500" tag="فعلي" />
                <ScenarioBar label="سيناريو متفائل (تحصيل 85% من المتأخر)"
                  value={forecasts.revOptimistic} max={forecasts.invoiced}
                  color="bg-blue-500" tag="توقع متفائل" />
                <ScenarioBar label="سيناريو أساسي (تحصيل 55% من المتأخر)"
                  value={forecasts.revBase} max={forecasts.invoiced}
                  color="bg-indigo-500" tag="توقع أساسي" />
                <ScenarioBar label="سيناريو متحفظ (تحصيل 20% من المتأخر)"
                  value={forecasts.revPessimistic} max={forecasts.invoiced}
                  color="bg-amber-500" tag="توقع متحفظ" />
                <ScenarioBar label="إجمالي مُفوتَر (السقف الأقصى)"
                  value={forecasts.invoiced} max={forecasts.invoiced}
                  color="bg-slate-500" tag="سقف" />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <div className="text-emerald-400 font-bold">{compact(forecasts.collected)} د.ل</div>
                  <div className="text-slate-500">محصّل فعلاً</div>
                </div>
                <div>
                  <div className="text-amber-400 font-bold">{compact(forecasts.outstanding)} د.ل</div>
                  <div className="text-slate-500">مستحق غير محصّل</div>
                </div>
                <div>
                  <div className="text-blue-400 font-bold">{exec.revenue.overdue_invoices}</div>
                  <div className="text-slate-500">فاتورة متأخرة</div>
                </div>
              </div>
              </>
              )}
            </div>

            {/* ── Budget Forecast ───────────────────────────────────────── */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                توقع الميزانية والإنفاق
                <span className="text-xs text-blue-400 border border-blue-500/30 rounded px-1.5">توقع</span>
              </h2>
              <div className="space-y-3">
                <ScenarioBar label="إنفاق فعلي حتى اللحظة"
                  value={forecasts.spent} max={forecasts.b}
                  color={forecasts.utilRate > 0.9 ? 'bg-rose-500' : forecasts.utilRate > 0.75 ? 'bg-amber-500' : 'bg-indigo-500'}
                  tag="فعلي" />
                <ScenarioBar label="قيمة العقود الإجمالية"
                  value={exec.contracts.total_value} max={forecasts.b}
                  color="bg-violet-500" tag="تعاقدي" />
                <ScenarioBar label="الميزانية الكاملة (100%)"
                  value={forecasts.b} max={forecasts.b}
                  color="bg-slate-600" tag="سقف" />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <div className="text-indigo-400 font-bold">{compact(forecasts.spent)} د.ل</div>
                  <div className="text-slate-500">منفق فعلاً</div>
                </div>
                <div>
                  <div className={`font-bold ${forecasts.remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {compact(Math.abs(forecasts.remaining))} د.ل
                  </div>
                  <div className="text-slate-500">{forecasts.remaining >= 0 ? 'متبقي' : 'تجاوز'}</div>
                </div>
                <div>
                  <div className="text-violet-400 font-bold">{compact(exec.contracts.total_value)} د.ل</div>
                  <div className="text-slate-500">قيمة العقود</div>
                </div>
              </div>
            </div>

            {/* ── Project-Level Financial Outlook ──────────────────────── */}
            {forecasts.projectBudgetRisks.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-400" />
                  معدل تحصيل الفواتير بحسب المشروع
                </h2>
                <div className="space-y-3">
                  {forecasts.projectBudgetRisks.map(p => (
                    <div key={p.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400 truncate max-w-[60%]">{p.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{compact(p.debit)} د.ل إنفاق</span>
                          <span className={`font-semibold ${p.pct >= 80 ? 'text-emerald-400' : p.pct >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {p.pct}% تحصيل
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${p.pct >= 80 ? 'bg-emerald-500' : p.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${p.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Procurement Pipeline ──────────────────────────────────── */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-purple-400" />
                توقع خط أنابيب المشتريات
                <span className="text-xs text-blue-400 border border-blue-500/30 rounded px-1.5">توقع</span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Funnel */}
                <div className="space-y-2">
                  <p className="text-sm text-slate-500 mb-2">مسار التحويل</p>
                  {[
                    { label: 'طلبات شراء إجمالي',   val: exec.procurement.pr_total,    color: 'bg-slate-500' },
                    { label: 'طلبات معتمدة',          val: exec.procurement.pr_approved, color: 'bg-blue-500' },
                    { label: 'أوامر شراء صادرة',     val: exec.procurement.po_total,    color: 'bg-violet-500' },
                    { label: 'أوامر مكتملة',          val: exec.procurement.po_completed,color: 'bg-emerald-500' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-3 text-sm">
                      <div className={`w-1 h-6 rounded-full flex-shrink-0 ${r.color}`} />
                      <span className="text-slate-400 w-36">{r.label}</span>
                      <span className="text-slate-200 font-semibold">{r.val}</span>
                    </div>
                  ))}
                </div>
                {/* Spend forecast */}
                <div className="space-y-3">
                  <p className="text-sm text-slate-500 mb-2">توقع الإنفاق على المشتريات</p>
                  <div>
                    <div className="text-sm text-slate-400 mb-0.5">إنفاق فعلي على المشتريات</div>
                    <div className="text-lg font-bold text-slate-100">{compact(exec.procurement.total_amount)} <span className="text-sm text-slate-500">د.ل</span></div>
                  </div>
                  {forecasts.pipelineVal > 0 && (
                    <div>
                      <div className="text-sm text-slate-400 mb-0.5">توقع: طلبات معتمدة → أوامر شراء</div>
                      <div className="text-lg font-bold text-blue-400">{compact(forecasts.pipelineVal)} <span className="text-sm text-slate-500">د.ل إضافية</span></div>
                      <div className="text-xs text-slate-600">مبني على متوسط قيمة أوامر الشراء الحالية</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-slate-400 mb-0.5">الإجمالي المتوقع</div>
                    <div className="text-lg font-bold text-violet-400">
                      {compact(exec.procurement.total_amount + forecasts.pipelineVal)} <span className="text-sm text-slate-500">د.ل</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Fleet Forecast ────────────────────────────────────────── */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                توقعات الأسطول والوقود
              </h2>
              <div className="grid sm:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-amber-400">{compact(exec.fleet.total_fuel_cost)} <span className="text-sm text-slate-500">د.ل</span></div>
                  <div className="text-sm text-slate-500 mt-1">تكلفة الوقود الفعلية</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-300">{compact(exec.fleet.total_fuel_cost * 12 / Math.max(1, 1))} <span className="text-sm text-slate-500">د.ل</span></div>
                  <div className="text-sm text-slate-500 mt-1">توقع سنوي (× 12)</div>
                  <div className="text-xs text-slate-600 mt-0.5">توقع — إذا استمر المعدل الحالي</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${exec.fleet.maintenance_vehicles > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                    {exec.fleet.maintenance_vehicles > 0
                      ? (exec.fleet.maintenance_vehicles / exec.fleet.total_vehicles * 100).toFixed(0) + '%'
                      : '0%'}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">معدل الأسطول في الصيانة</div>
                </div>
              </div>
            </div>

            {exec.generated_at && (
              <p className="text-sm text-slate-600 text-center pb-2">
                بيانات مرجعية من: {new Date(exec.generated_at).toLocaleString('ar-LY')} — جميع الأرقام المستقبلية هي تقديرات تحليلية
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
