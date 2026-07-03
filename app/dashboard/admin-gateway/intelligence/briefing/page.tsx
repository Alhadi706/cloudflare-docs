'use client';

/**
 * Executive Narrative Briefing — Phase 6 of Executive Intelligence
 * Route: /dashboard/admin-gateway/intelligence/briefing
 *
 * Generates a formal Arabic executive briefing entirely from live ERP data.
 * No hardcoded prose — all text built from real values.
 * "BRIEFING LIVE" verification marker.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { FileText, RefreshCw, ChevronLeft, AlertTriangle, Printer, Download } from 'lucide-react';
import GmOfficeTabBar from '@/components/GmOfficeTabBar';

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

interface OpsData {
  projects_breakdown: Array<{
    id: number; name: string; code: string; status: string;
    budget: number | null; contracts_total: number | null;
    vehicles_assigned: number; equipment_assigned: number;
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (v: number, unit = 'د.ل') => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} مليون ${unit}`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)} ألف ${unit}`;
  return `${v.toFixed(0)} ${unit}`;
};

const pct = (n: number, d: number) => d > 0 ? `${(n / d * 100).toFixed(1)}%` : 'غير محدد';

function arabicMonth(dateStr: string): string {
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  try { const d = new Date(dateStr); return `${months[d.getMonth()]} ${d.getFullYear()}`; }
  catch { return ''; }
}

// ── Generate narrative ─────────────────────────────────────────────────────────
function generateBriefing(exec: ExecData, ops: OpsData | null) {
  const collRate   = exec.revenue.total_invoiced > 0 ? exec.revenue.total_collected / exec.revenue.total_invoiced : 0;
  const budgetUtil = exec.projects.total_budget > 0 ? exec.journal_entries.total_debit / exec.projects.total_budget : 0;
  const maintRate  = exec.fleet.total_vehicles > 0 ? exec.fleet.maintenance_vehicles / exec.fleet.total_vehicles : 0;
  const approvalR  = (exec.approvals.approved + exec.approvals.rejected) > 0
    ? exec.approvals.approved / (exec.approvals.approved + exec.approvals.rejected) : 1;

  const date = exec.generated_at ? arabicMonth(exec.generated_at) : '';

  // ── Overall health ─────────────────────────────────────────────────────────
  let overallStatus = 'جيد';
  if (exec.revenue.overdue_invoices > 0 && exec.revenue.total_outstanding > 200_000) overallStatus = 'يستدعي الانتباه';
  if (budgetUtil > 0.9 || collRate < 0.4) overallStatus = 'حرج';

  // ── Paragraphs ─────────────────────────────────────────────────────────────
  const intro = `إحاطة تنفيذية: الوضع التشغيلي للشركة — ${date}` +
    `\n\nبناءً على البيانات المُستخرجة مباشرةً من النظام المتكامل لإدارة الموارد، ` +
    `يُقدَّم هذا الملخص التنفيذي للوضع الراهن للمنشأة في جميع المحاور الرئيسية.`;

  const projectsPara = (() => {
    const total = exec.projects.total;
    const active = exec.projects.active;
    const hold = exec.projects.on_hold;
    const budget = fmt(exec.projects.total_budget);
    let t = `أولاً - المشاريع والتنفيذ: يضم محفظة المشاريع حالياً ${total} مشروعاً، يشهد منها ${active} مشروعاً وضعاً نشطاً`;
    if (hold > 0) t += `، فيما يرزح ${hold} مشروع${hold > 1 ? 'اتٍ' : ''} تحت الإيقاف المؤقت`;
    t += `. وتبلغ الميزانية الإجمالية للمشاريع ${budget}`;
    if (exec.projects.total_budget > 0) {
      t += `، وقد بلغ إجمالي الإنفاق المسجّل في دفاتر القيود ${fmt(exec.journal_entries.total_debit)}، أي ما يعادل ${pct(exec.journal_entries.total_debit, exec.projects.total_budget)} من الميزانية المعتمدة`;
    }
    t += '.';
    if (ops?.projects_breakdown) {
      const activeProjects = ops.projects_breakdown.filter(p => p.status === 'active');
      if (activeProjects.length > 0) {
        t += ` وتشمل المشاريع النشطة: ${activeProjects.map(p => p.name).join('، ')}.`;
      }
    }
    return t;
  })();

  const financialPara = (() => {
    let t = `ثانياً - المركز المالي: بلغ إجمالي الفواتير الصادرة ${fmt(exec.revenue.total_invoiced)}`;
    t += `، تم تحصيل ${fmt(exec.revenue.total_collected)} منها`;
    t += `، بمعدل تحصيل يبلغ ${pct(exec.revenue.total_collected, exec.revenue.total_invoiced)}. `;
    if (exec.revenue.total_outstanding > 0) {
      t += `لا يزال هناك مبلغ ${fmt(exec.revenue.total_outstanding)} مستحقاً وغير محصَّل`;
      if (exec.revenue.overdue_invoices > 0) {
        t += `، منها ${exec.revenue.overdue_invoices} فاتورة متأخرة تستوجب المتابعة العاجلة`;
      }
      t += '.';
    }
    t += ` أما على صعيد العقود، `;
    if (exec.contracts.active > 0) {
      t += `فإن ${exec.contracts.active} عقداً نشطاً يجري تنفيذه بقيمة إجمالية تبلغ ${fmt(exec.contracts.total_value)}`;
    } else if (exec.contracts.draft > 0) {
      t += `لا توجد عقود نشطة في الوقت الراهن، وإن كان ثمة ${exec.contracts.draft} عقداً في طور المسودة`;
    }
    t += '.';
    return t;
  })();

  const procurementPara = (() => {
    let t = `ثالثاً - المشتريات: وردت خلال الفترة ${exec.procurement.pr_total} طلب شراء`;
    if (exec.procurement.pr_approved > 0) t += `، اعتُمد منها ${exec.procurement.pr_approved}`;
    if (exec.procurement.pr_pending > 0) t += `، فيما لا يزال ${exec.procurement.pr_pending} طلب${exec.procurement.pr_pending > 1 ? 'اً' : ''} قيد الانتظار`;
    t += `. وبلغ إجمالي أوامر الشراء الصادرة ${exec.procurement.po_total} أمراً بقيمة إجمالية ${fmt(exec.procurement.total_amount)}`;
    if (exec.procurement.po_completed > 0) {
      t += `، أُنجز منها ${exec.procurement.po_completed} أمراً`;
    }
    t += '.';
    return t;
  })();

  const operationsPara = (() => {
    let t = `رابعاً - العمليات والموارد: يضم أسطول الشركة ${exec.fleet.total_vehicles} مركبة، منها ${exec.fleet.active_vehicles} في الخدمة الفعلية`;
    if (exec.fleet.maintenance_vehicles > 0) {
      t += `، فيما تخضع ${exec.fleet.maintenance_vehicles} مركبة للصيانة حالياً (${pct(exec.fleet.maintenance_vehicles, exec.fleet.total_vehicles)} من الأسطول)`;
    }
    t += `. وفيما يخص المعدات، يبلغ عدد المعدات النشطة ${exec.fleet.active_equipment} وحدة من أصل ${exec.fleet.total_equipment}`;
    if (exec.fleet.total_fuel_cost > 0) {
      t += `، وبلغت تكلفة الوقود المسجّلة ${fmt(exec.fleet.total_fuel_cost)}`;
    }
    t += '.';
    if (exec.inventory.total_received_value > 0) {
      t += ` أما المخزون، فقد بلغت قيمة البضاعة الواردة ${fmt(exec.inventory.total_received_value)}`;
      if (exec.inventory.total_issued_value > 0) t += `، وصُرف منها ما قيمته ${fmt(exec.inventory.total_issued_value)}`;
      t += '.';
    }
    return t;
  })();

  const governancePara = (() => {
    let t = `خامساً - الحوكمة وسير الموافقات: بلغ إجمالي طلبات الاعتماد المُعالَجة ${exec.approvals.total}`;
    t += `، وافق عليها النظام بنسبة ${pct(exec.approvals.approved, exec.approvals.total)}`;
    if (exec.approvals.rejected > 0) t += `، ورُفض ${exec.approvals.rejected} منها`;
    if (exec.approvals.pending > 0) {
      t += `، ولا يزال ${exec.approvals.pending} طلب${exec.approvals.pending > 1 ? 'اً' : ''} في انتظار القرار`;
    } else {
      t += '، ولا توجد طلبات معلقة حالياً';
    }
    t += '.';
    return t;
  })();

  // ── Recommendations ────────────────────────────────────────────────────────
  const recommendations: string[] = [];
  if (exec.revenue.overdue_invoices > 0)
    recommendations.push(`متابعة تحصيل ${exec.revenue.overdue_invoices} فاتورة متأخرة وإصدار إشعارات رسمية للمدينين.`);
  if (collRate < 0.65 && exec.revenue.total_invoiced > 0)
    recommendations.push(`تفعيل آليات التحصيل للرفع من معدل التحصيل البالغ ${pct(exec.revenue.total_collected, exec.revenue.total_invoiced)}.`);
  if (budgetUtil > 0.8)
    recommendations.push(`مراجعة أوامر الصرف والتحقق من عدم تجاوز الميزانية (استهلاك حالي: ${pct(exec.journal_entries.total_debit, exec.projects.total_budget)}).`);
  if (exec.projects.on_hold > 0)
    recommendations.push(`إصدار قرار واضح بشأن ${exec.projects.on_hold} مشروع متوقف: استئناف أو إلغاء.`);
  if (exec.contracts.active === 0 && exec.contracts.draft > 0)
    recommendations.push(`تفعيل ${exec.contracts.draft} عقد مسودة لضمان التغطية التعاقدية للمشاريع النشطة.`);
  if (exec.approvals.pending > 3)
    recommendations.push(`البت في ${exec.approvals.pending} طلب اعتماد معلق لتجنب تعطيل دورة العمل.`);
  if (exec.employees.total === 0)
    recommendations.push('استيراد بيانات الموظفين لتمكين تقارير الأداء وقياس الكفاءة البشرية.');
  if (maintRate > 0.25)
    recommendations.push(`تسريع برنامج صيانة الأسطول لخفض نسبة المركبات المعطلة (${pct(exec.fleet.maintenance_vehicles, exec.fleet.total_vehicles)} حالياً).`);

  if (recommendations.length === 0)
    recommendations.push('يسير الوضع التشغيلي بصورة مُرضية. الإجراء الموصى به: الاستمرار في الرصد الدوري.');

  return { intro, projectsPara, financialPara, procurementPara, operationsPara, governancePara, recommendations, overallStatus, date };
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BriefingPage() {
  const [exec,    setExec]    = useState<ExecData | null>(null);
  const [ops,     setOps]     = useState<OpsData  | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');
  const [copied,  setCopied]  = useState(false);

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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const briefing = useMemo(() => exec ? generateBriefing(exec, ops) : null, [exec, ops]);

  const copyText = useCallback(() => {
    if (!briefing) return;
    const lines = [
      briefing.intro, '', briefing.projectsPara, '', briefing.financialPara,
      '', briefing.procurementPara, '', briefing.operationsPara, '', briefing.governancePara,
      '', 'التوصيات:', ...briefing.recommendations.map((r, i) => `${i + 1}. ${r}`),
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }, [briefing]);

  const statusColor = briefing?.overallStatus === 'جيد'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
    : briefing?.overallStatus === 'يستدعي الانتباه'
    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
    : 'bg-rose-500/15 text-rose-300 border-rose-500/40';

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col" dir="rtl">
      <GmOfficeTabBar />
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Verification Marker ─────────────────────────────────────────── */}
        <div className="bg-amber-900/30 border border-amber-500/40 rounded-lg px-4 py-2 text-amber-300 text-xs font-mono text-center">
          &#10003; BRIEFING LIVE &mdash; الإحاطة التنفيذية المُولَّدة من البيانات الحية | {new Date().toLocaleDateString('ar-LY')}
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
              <FileText className="w-5 h-5 text-amber-400" />
              الإحاطة التنفيذية
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {briefing && (
              <button onClick={copyText}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition">
                <Download className="w-3.5 h-3.5" />
                {copied ? 'تم النسخ ✓' : 'نسخ النص'}
              </button>
            )}
            <button onClick={fetchAll} disabled={loading}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {err && <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{err}</div>}

        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(6)].map((_, i) => <div key={i} className={`h-${i === 0 ? '16' : '28'} rounded-xl bg-slate-800/50`} />)}
          </div>
        )}

        {!loading && exec && briefing && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden print:border-none print:bg-white">

            {/* ── Document Header ──────────────────────────────────────── */}
            <div className="bg-gradient-to-l from-amber-950/40 to-slate-900 px-8 py-6 border-b border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">الإحاطة التنفيذية الشاملة</h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {exec.generated_at ? new Date(exec.generated_at).toLocaleDateString('ar-LY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                  </p>
                </div>
                <div className={`text-sm px-4 py-2 rounded-lg border font-semibold ${statusColor}`}>
                  الوضع العام: {briefing.overallStatus}
                </div>
              </div>
            </div>

            {/* ── Document Body ─────────────────────────────────────────── */}
            <div className="px-8 py-7 space-y-7 font-[system-ui,sans-serif] leading-relaxed" style={{fontFamily:"'Noto Kufi Arabic',system-ui,sans-serif"}}>

              {/* Intro */}
              <div>
                {briefing.intro.split('\n\n').map((para, i) => (
                  <p key={i} className={i === 0 ? 'text-base font-bold text-slate-100 mb-3' : 'text-sm text-slate-300'}>
                    {para}
                  </p>
                ))}
              </div>

              {/* Sections */}
              {[
                { text: briefing.projectsPara     },
                { text: briefing.financialPara    },
                { text: briefing.procurementPara  },
                { text: briefing.operationsPara   },
                { text: briefing.governancePara   },
              ].map((s, i) => (
                <div key={i} className="border-r-2 border-amber-500/40 pr-4">
                  <p className="text-sm text-slate-300 leading-7">{s.text}</p>
                </div>
              ))}

              {/* Recommendations */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center">!</span>
                  التوصيات التنفيذية
                </h3>
                <ol className="space-y-2">
                  {briefing.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                      <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {r}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <span>وُلِّدت هذه الإحاطة تلقائياً من نظام ERP المتكامل</span>
                <span>{exec.generated_at ? new Date(exec.generated_at).toLocaleString('ar-LY') : ''}</span>
              </div>
            </div>
          </div>
        )}

        {!loading && exec && (
          <div className="grid sm:grid-cols-3 gap-3">
            <Link href="/dashboard/admin-gateway/intelligence/command"
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:bg-slate-800/50 transition text-center">
              <div className="text-sm font-semibold text-slate-300">مركز القيادة</div>
              <div className="text-sm text-slate-600 mt-0.5">عرض موحد</div>
            </Link>
            <Link href="/dashboard/admin-gateway/intelligence/risk"
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:bg-slate-800/50 transition text-center">
              <div className="text-sm font-semibold text-slate-300">طبقة المخاطر</div>
              <div className="text-sm text-slate-600 mt-0.5">تفاصيل المخاطر</div>
            </Link>
            <Link href="/dashboard/admin-gateway/intelligence/forecast"
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:bg-slate-800/50 transition text-center">
              <div className="text-sm font-semibold text-slate-300">التوقعات</div>
              <div className="text-sm text-slate-600 mt-0.5">تحليل السيناريوهات</div>
            </Link>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
