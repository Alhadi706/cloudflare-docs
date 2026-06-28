'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import ReportLayout, {
  ExecutiveSummary, KpiItem, SmartInsight, fmt,
} from '@/components/reports/ReportLayout';
import {
  C, compactNum,
  DonutChart, VarianceBarChart, StackedBarChart, HorizontalBarChart, ChartEmpty,
} from '@/components/reports/ReportCharts';
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters';
import { getClientTenantId } from '@/lib/getClientTenantId';

interface JEByProject   { project_name: string; project_id: number; entries: number; total_debit: number; total_credit: number; }
interface InvByProject  { project_name: string; project_id: number; invoice_count: number; total_invoiced: number; paid_amount: number; unpaid_amount: number; overdue_amount: number; }
interface FuelByProject { project_name: string; project_id: number; total_liters: number; total_cost: number; }
interface ProcByProject { project_name: string; project_id: number; po_count: number; total_spent: number; }

interface FinData {
  generated_at: string;
  grand_totals: { total_debits: number; total_invoiced: number; total_collected: number; total_po_spend: number; total_fuel_cost: number; };
  journal_entries_by_project: JEByProject[];
  invoices_by_project:        InvByProject[];
  collections: { count: number; total_collected: number; confirmed: number; };
  procurement_spend_by_project: ProcByProject[];
  fuel_cost_by_project:         FuelByProject[];
}

const short = (s: string, max = 15) => s && s.length > max ? s.slice(0, max) + '…' : (s ?? '—');

export default function FinancialReportPage() {
  const [data,    setData]    = useState<FinData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');
  const [filters, setFilters] = useState<ReportFilterValues>({ projectId: null, siteId: null });

  const fetchData = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.set('project_id', String(filters.projectId));
      if (filters.siteId)    params.set('site_id',    String(filters.siteId));
      const q = params.toString() ? `?${params}` : '';
      const r = await fetch(`/api/v1/gov-reports/financial${q}`, {
        headers: { 'X-Tenant-ID': getClientTenantId() },
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.detail ?? JSON.stringify(json));
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── بيانات المخططات ─────────────────────────────────────────────────────────

  /** stacked: مسدّد + غير مسدّد + متأخر لكل مشروع */
  const invoiceStackData = useMemo(() => {
    if (!data) return [];
    return (data.invoices_by_project ?? []).map(r => ({
      name:     short(r.project_name),
      مسدّد:    r.paid_amount    ?? 0,
      معلق:     r.unpaid_amount  ?? 0,
      متأخر:    r.overdue_amount ?? 0,
    }));
  }, [data]);

  /** grand totals donut */
  const grandTotalsDonut = useMemo(() => {
    if (!data) return [];
    const gt = data.grand_totals;
    return [
      { name: 'إجمالي المدينون',  value: gt.total_debits   ?? 0, color: C.info    },
      { name: 'إجمالي الفوترة',   value: gt.total_invoiced ?? 0, color: C.primary },
      { name: 'إجمالي المحصّل',   value: gt.total_collected ?? 0, color: C.success },
      { name: 'إنفاق المشتريات', value: gt.total_po_spend  ?? 0, color: C.warning },
      { name: 'تكلفة الوقود',    value: gt.total_fuel_cost ?? 0, color: C.orange  },
    ].filter(d => d.value > 0);
  }, [data]);

  /** variance: مفوتر مقابل محصّل لكل مشروع */
  const collectionVariance = useMemo(() => {
    if (!data) return [];
    return (data.invoices_by_project ?? [])
      .filter(r => (r.total_invoiced ?? 0) > 0)
      .map(r => ({
        label:   short(r.project_name),
        planned: r.total_invoiced ?? 0,
        actual:  r.paid_amount    ?? 0,
      }));
  }, [data]);

  /** horizontal: إنفاق المشتريات لكل مشروع */
  const procSpendHBar = useMemo(() => {
    if (!data) return [];
    return [...(data.procurement_spend_by_project ?? [])]
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 8)
      .map((r, i) => ({
        label: short(r.project_name),
        value: r.total_spent,
        color: [C.purple, C.info, C.teal, C.success, C.orange,
                C.warning, C.primary, C.danger][i % 8],
      }));
  }, [data]);

  // ── ملخص تنفيذي ────────────────────────────────────────────────────────────
  const execSummary = useMemo<ExecutiveSummary | undefined>(() => {
    if (!data) return undefined;
    const gt = data.grand_totals;
    const collRate = gt.total_invoiced > 0 ? (gt.total_collected / gt.total_invoiced) * 100 : 0;
    const statusLevel = collRate > 70 ? 'good' : collRate > 40 ? 'warning' : 'critical';
    const worstInv = [...(data.invoices_by_project ?? [])].sort((a, b) => b.overdue_amount - a.overdue_amount)[0];
    const bestProc = [...(data.procurement_spend_by_project ?? [])].sort((a, b) => a.total_spent - b.total_spent)[0];
    return {
      status: {
        level:  statusLevel,
        label:  statusLevel === 'good' ? 'التحصيل في المستوى الجيد'
              : statusLevel === 'warning' ? 'نسبة التحصيل تحتاج تحسين'
              : 'تحذير: مشكلة في التحصيل',
        detail: `مفوتر: ${compactNum(gt.total_invoiced)} · محصّل: ${compactNum(gt.total_collected)} د.ل (${fmt(collRate, 1)}%)`,
      },
      risk: {
        label:  worstInv ? `فواتير متأخرة — ${worstInv.project_name}` : 'لا توجد فواتير متأخرة',
        detail: worstInv ? `متأخر: ${compactNum(worstInv.overdue_amount)} · غير مسدد: ${compactNum(worstInv.unpaid_amount)} د.ل` : '',
      },
      opportunity: {
        label:  bestProc ? `ترشيد الإنفاق — ${bestProc.project_name}` : 'مراجعة هيكل التكاليف',
        detail: bestProc ? `أقل إنفاق مشتريات: ${compactNum(bestProc.total_spent)} د.ل` : '',
      },
    };
  }, [data]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo<KpiItem[]>(() => {
    if (!data) return [];
    const gt = data.grand_totals;
    return [
      { label: 'إجمالي الفوترة',     value: compactNum(gt.total_invoiced)  + ' د.ل', color: 'indigo' },
      { label: 'إجمالي المحصّل',     value: compactNum(gt.total_collected) + ' د.ل', color: 'green'  },
      { label: 'إنفاق المشتريات',   value: compactNum(gt.total_po_spend)  + ' د.ل', color: 'amber'  },
      { label: 'تكلفة الوقود',       value: compactNum(gt.total_fuel_cost) + ' د.ل', color: 'orange' },
    ];
  }, [data]);

  // ── ملاحظات ذكية ──────────────────────────────────────────────────────────
  const insights = useMemo<SmartInsight[]>(() => {
    if (!data) return [];
    const list: SmartInsight[] = [];
    const gt = data.grand_totals;
    const collRate = gt.total_invoiced > 0 ? (gt.total_collected / gt.total_invoiced) * 100 : 0;
    if (collRate < 50)
      list.push({ type: 'warning', text: `نسبة التحصيل منخفضة: ${fmt(collRate, 1)}% — يلزم متابعة الفواتير المعلقة` });
    const overdueTotal = (data.invoices_by_project ?? []).reduce((s, r) => s + (r.overdue_amount ?? 0), 0);
    if (overdueTotal > 0)
      list.push({ type: 'warning', text: `إجمالي الفواتير المتأخرة: ${compactNum(overdueTotal)} د.ل — يحتاج إجراءً فورياً` });
    const topFuel = [...(data.fuel_cost_by_project ?? [])].sort((a, b) => b.total_cost - a.total_cost)[0];
    if (topFuel)
      list.push({ type: 'info', text: `أعلى تكلفة وقود: "${topFuel.project_name}" — ${compactNum(topFuel.total_cost)} د.ل` });
    if (gt.total_collected > 0)
      list.push({ type: 'success', text: `تم تحصيل ${compactNum(gt.total_collected)} د.ل من أصل ${compactNum(gt.total_invoiced)} د.ل مفوتر` });
    return list;
  }, [data]);

  // ── تعريف أقسام الصفحة ────────────────────────────────────────────────────

  /** stacked: تحلّل الفواتير */
  const mainSection = invoiceStackData.length ? (
    <>
      <p className="text-sm text-slate-400 mb-4">
        تحليل مكوّنات الفواتير لكل مشروع: المسدّد (أخضر) + المعلق (بنفسجي) + المتأخر (أحمر)
      </p>
      <StackedBarChart
        data={invoiceStackData}
        xKey="name"
        series={[
          { key: 'مسدّد', label: 'مسدّد',  color: C.success },
          { key: 'معلق',  label: 'معلق',   color: C.purple  },
          { key: 'متأخر', label: 'متأخر',  color: C.danger  },
        ]}
        compact
        unit="د.ل"
      />
    </>
  ) : <ChartEmpty />;

  const secondaryLeft  = <DonutChart data={grandTotalsDonut} height={260} unit="د.ل" />;

  const secondaryRight = collectionVariance.length ? (
    <VarianceBarChart
      data={collectionVariance}
      plannedLabel="المفوتر"
      actualLabel="المحصّل"
      unit="د.ل"
      compact
      height={260}
    />
  ) : <ChartEmpty />;

  const extraSection = procSpendHBar.length
    ? <HorizontalBarChart data={procSpendHBar} unit="د.ل" compact />
    : <ChartEmpty />;

  const dataTable = data?.journal_entries_by_project?.length ? (
    <table className="w-full text-sm">
      <thead className="bg-slate-800/60">
        <tr>
          {['المشروع','عدد القيود','إجمالي المدين (د.ل)','إجمالي الدائن (د.ل)','الفارق'].map(h => (
            <th key={h} className="px-4 py-3 text-right text-slate-300 font-semibold whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.journal_entries_by_project.map((row, i) => {
          const diff = (row.total_debit ?? 0) - (row.total_credit ?? 0);
          return (
            <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
              <td className="px-4 py-3 text-slate-200 font-medium max-w-[160px] truncate">{row.project_name}</td>
              <td className="px-4 py-3 text-slate-400">{row.entries ?? 0}</td>
              <td className="px-4 py-3 text-slate-300">{fmt(row.total_debit)}</td>
              <td className="px-4 py-3 text-slate-300">{fmt(row.total_credit)}</td>
              <td className={`px-4 py-3 font-medium ${diff > 0 ? 'text-amber-400' : diff < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {diff === 0 ? 'متوازن' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  ) : null;

  return (
    <ReportLayout
      title="التقرير المالي"
      icon={<DollarSign className="w-8 h-8" />}
      iconBg="bg-green-600/20"
      iconBorder="border-green-500/50"
      iconColor="text-green-400"
      breadcrumb={[{ label: 'التقرير المالي', href: '#' }]}
      generatedAt={data?.generated_at}
      loading={loading}
      error={err}
      onRefresh={fetchData}
      filterBar={
        <ReportFilters
          values={filters}
          onChange={setFilters}
          showSite
          loading={loading}
        />
      }
      executiveSummary={execSummary}
      kpis={kpis}
      mainSection={mainSection}
      secondaryLeft={secondaryLeft}
      secondaryRight={secondaryRight}
      secondaryLeftTitle="توزيع المؤشرات المالية الكلية"
      secondaryRightTitle="مقارنة المفوتر بالمحصّل (د.ل)"
      extraSection={extraSection}
      extraSectionTitle="إنفاق المشتريات حسب المشروع (تصنيف تنازلي)"
      tableTitle="القيود المحاسبية حسب المشروع"
      dataTable={dataTable}
      insights={insights}
    />
  );
}
