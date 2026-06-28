'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import ReportLayout, {
  ExecutiveSummary, KpiItem, SmartInsight, fmt, PercentBar, StatusBadge,
} from '@/components/reports/ReportLayout';
import {
  C, compactNum,
  DonutChart, VarianceBarChart, StackedBarChart, ChartEmpty,
} from '@/components/reports/ReportCharts';
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters';
import { getClientTenantId } from '@/lib/getClientTenantId';

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

export default function ExecutiveReportPage() {
  const [data,    setData]    = useState<ExecData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');
  const [filters, setFilters] = useState<ReportFilterValues>({ projectId: null, siteId: null });

  const fetchData = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.set('project_id', String(filters.projectId));
      const q = params.toString() ? `?${params}` : '';
      const r = await fetch(`/api/v1/gov-reports/executive${q}`, {
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

  /** Radar: 5 محاور أداء (0-100%) */
  const radarData = useMemo(() => {
    if (!data) return [];
    const rev   = data.revenue;
    const fleet = data.fleet;
    const collRate     = rev.total_invoiced  > 0 ? (rev.total_collected / rev.total_invoiced) * 100 : 0;
    const fleetRate    = fleet.total_vehicles > 0 ? (fleet.active_vehicles / fleet.total_vehicles) * 100 : 0;
    const apprRate     = data.approvals.total > 0 ? (data.approvals.approved / data.approvals.total) * 100 : 0;
    const projRate     = data.projects.total  > 0 ? (data.projects.active   / data.projects.total)  * 100 : 0;
    const contractRate = data.contracts.total > 0 ? (data.contracts.active  / data.contracts.total) * 100 : 0;
    return [
      { subject: 'التحصيل',   A: Math.round(collRate)     },
      { subject: 'الأسطول',   A: Math.round(fleetRate)    },
      { subject: 'الموافقات', A: Math.round(apprRate)     },
      { subject: 'المشاريع',  A: Math.round(projRate)     },
      { subject: 'العقود',    A: Math.round(contractRate) },
    ];
  }, [data]);

  /** variance: إيرادات — مفوتر مقابل محصّل */
  const revenueVariance = useMemo(() => {
    if (!data) return [];
    const rev = data.revenue;
    return [
      { label: 'الفواتير المسدودة',    planned: rev.paid_invoices * 1000, actual: rev.paid_invoices * 1000 },  // مجرد مرجع
      { label: 'إجمالي المفوتر',       planned: rev.total_invoiced,  actual: 0  },
      { label: 'إجمالي المحصّل',       planned: rev.total_invoiced,  actual: rev.total_collected        },
      { label: 'المستحق غير المحصّل',  planned: rev.total_invoiced,  actual: rev.total_invoiced - rev.total_outstanding },
    ].filter(r => r.planned > 0);
  }, [data]);

  /** توزيع حالة العقود — donut */
  const contractsDonut = useMemo(() => {
    if (!data) return [];
    const con = data.contracts;
    return [
      { name: 'نشطة',    value: con.active    ?? 0, color: C.success },
      { name: 'مكتملة',  value: con.completed ?? 0, color: C.info    },
      { name: 'مسودة',   value: con.draft     ?? 0, color: C.neutral },
    ].filter(d => d.value > 0);
  }, [data]);

  /** stacked: مشاريع حسب الحالة */
  const projectsStack = useMemo(() => {
    if (!data) return [];
    const proj = data.projects;
    return [{
      name:   'المشاريع',
      نشطة:   proj.active    ?? 0,
      تخطيط:  proj.planning  ?? 0,
      مكتملة: proj.completed ?? 0,
      متوقفة: proj.on_hold   ?? 0,
    }];
  }, [data]);

  // ── ملخص تنفيذي ────────────────────────────────────────────────────────────
  const execSummary = useMemo<ExecutiveSummary | undefined>(() => {
    if (!data) return undefined;
    const rev   = data.revenue;
    const fleet = data.fleet;
    const collRate = rev.total_invoiced  > 0 ? (rev.total_collected / rev.total_invoiced) * 100 : 0;
    const oosRate  = fleet.total_vehicles > 0 ? ((fleet.total_vehicles - fleet.active_vehicles) / fleet.total_vehicles) * 100 : 0;
    const statusLevel = collRate > 60 && oosRate < 20 && data.approvals.pending < 10
      ? 'good' : collRate < 30 || oosRate > 30 ? 'critical' : 'warning';
    return {
      status: {
        level:  statusLevel,
        label:  statusLevel === 'good' ? 'المؤشرات العامة إيجابية'
              : statusLevel === 'warning' ? 'بعض المؤشرات تحتاج متابعة'
              : 'تحذير: مؤشرات حرجة',
        detail: `مشاريع نشطة: ${data.projects.active} · تحصيل: ${fmt(collRate, 1)}% · موافقات معلقة: ${data.approvals.pending}`,
      },
      risk: {
        label:  rev.total_outstanding > 0 ? `مستحقات غير محصّلة: ${compactNum(rev.total_outstanding)} د.ل` : 'لا توجد مستحقات كبيرة',
        detail: `فواتير متأخرة: ${rev.overdue_invoices} · صيانة مركبات: ${fleet.maintenance_vehicles}`,
      },
      opportunity: {
        label:  data.projects.planning > 0 ? `${data.projects.planning} مشروع في التخطيط` : 'تحسين دورة الموافقات',
        detail: data.procurement.pr_pending > 0
          ? `${data.procurement.pr_pending} طلب شراء معلق`
          : `مشتريات مكتملة: ${data.procurement.po_completed}`,
      },
    };
  }, [data]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo<KpiItem[]>(() => {
    if (!data) return [];
    return [
      { label: 'مشاريع نشطة',    value: data.projects.active,                               color: 'green'  },
      { label: 'إجمالي المفوتر',  value: compactNum(data.revenue.total_invoiced)   + ' د.ل', color: 'blue'   },
      { label: 'إجمالي المحصّل',  value: compactNum(data.revenue.total_collected)  + ' د.ل', color: 'teal'   },
      { label: 'موافقات معلقة',   value: data.approvals.pending,
        color: data.approvals.pending > 5 ? 'rose' : 'blue' },
    ];
  }, [data]);

  // ── ملاحظات ذكية ──────────────────────────────────────────────────────────
  const insights = useMemo<SmartInsight[]>(() => {
    if (!data) return [];
    const list: SmartInsight[] = [];
    const rev = data.revenue;
    if (rev.overdue_invoices > 0)
      list.push({ type: 'warning', text: `${rev.overdue_invoices} فاتورة متأخرة — مستحقات: ${compactNum(rev.total_outstanding)} د.ل` });
    if (data.approvals.pending > 5)
      list.push({ type: 'warning', text: `تراكم ${data.approvals.pending} موافقة معلقة — يُوصى بمراجعة فورية` });
    if (data.fleet.maintenance_vehicles > data.fleet.total_vehicles * 0.3)
      list.push({ type: 'warning', text: `${data.fleet.maintenance_vehicles} مركبة في الصيانة (${fmt((data.fleet.maintenance_vehicles / Math.max(data.fleet.total_vehicles, 1)) * 100, 0)}% من الأسطول)` });
    if (data.projects.on_hold > 0)
      list.push({ type: 'info', text: `${data.projects.on_hold} مشروع متوقف — يحتاج قرار تشغيلي` });
    if (data.projects.completed > 0)
      list.push({ type: 'success', text: `${data.projects.completed} مشروع مكتمل · ميزانية كلية: ${compactNum(data.projects.total_budget)} د.ل` });
    return list;
  }, [data]);

  // ── تعريف أقسام الصفحة ────────────────────────────────────────────────────

  /** Radar: مؤشرات الأداء الموحّدة */
  const mainSection = radarData.length ? (
    <>
      <p className="text-xs text-slate-400 mb-4">
        نسبة الأداء الفعلي لكل محور من 100% — تكشف نقاط القوة والضعف دفعة واحدة
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={radarData}>
          <PolarGrid stroke={C.grid} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: C.axis, fontSize: 13, fontFamily: 'inherit' }}
          />
          <Radar
            name="الأداء"
            dataKey="A"
            stroke={C.primary}
            fill={C.primary}
            fillOpacity={0.3}
            dot={{ r: 5, fill: C.primary, strokeWidth: 0 }}
            animationDuration={700}
          />
        </RadarChart>
      </ResponsiveContainer>
    </>
  ) : <ChartEmpty />;

  /** مقارنة الإيرادات — variance */
  const secondaryLeft = (
    <VarianceBarChart
      data={[
        { label: 'المفوتر',   planned: data?.revenue.total_invoiced  ?? 0, actual: 0 },
        { label: 'المحصّل',   planned: data?.revenue.total_invoiced  ?? 0, actual: data?.revenue.total_collected ?? 0 },
        { label: 'المستحق',  planned: data?.revenue.total_invoiced  ?? 0, actual: (data?.revenue.total_invoiced ?? 0) - (data?.revenue.total_outstanding ?? 0) },
      ].filter(r => r.planned > 0)}
      plannedLabel="الهدف"
      actualLabel="المنجز"
      unit="د.ل"
      compact
      height={260}
    />
  );

  /** توزيع حالة العقود — donut */
  const secondaryRight = <DonutChart data={contractsDonut} height={260} />;

  /** توزيع المشاريع — stacked */
  const extraSection = projectsStack.length ? (
    <StackedBarChart
      data={projectsStack}
      xKey="name"
      series={[
        { key: 'نشطة',   label: 'نشطة',   color: C.success },
        { key: 'تخطيط',  label: 'تخطيط',  color: C.info    },
        { key: 'مكتملة', label: 'مكتملة', color: C.teal    },
        { key: 'متوقفة', label: 'متوقفة', color: C.warning  },
      ]}
      height={200}
      angle={false}
    />
  ) : <ChartEmpty />;

  /** جدول ملخص المؤشرات */
  const dataTable = data ? (() => {
    const rows = [
      { domain: 'الإيرادات',   key: 'إجمالي المفوتر',          val: compactNum(data.revenue.total_invoiced)    + ' د.ل', status: 'active'     },
      { domain: 'الإيرادات',   key: 'إجمالي المحصّل',          val: compactNum(data.revenue.total_collected)   + ' د.ل', status: 'completed'  },
      { domain: 'الإيرادات',   key: 'المستحق غير المحصّل',      val: compactNum(data.revenue.total_outstanding) + ' د.ل', status: data.revenue.total_outstanding > 0 ? 'pending' : 'completed' },
      { domain: 'المشتريات',  key: 'إجمالي إنفاق المشتريات',  val: compactNum(data.procurement.total_amount)  + ' د.ل', status: 'active'     },
      { domain: 'المشتريات',  key: 'أوامر شراء صادرة',         val: String(data.procurement.po_issued),                  status: 'issued'     },
      { domain: 'العقود',     key: 'قيمة العقود الكلية',       val: compactNum(data.contracts.total_value)    + ' د.ل', status: 'active'     },
      { domain: 'الأسطول',    key: 'تكلفة الوقود',             val: compactNum(data.fleet.total_fuel_cost)    + ' د.ل', status: 'active'     },
      { domain: 'المخزون',    key: 'قيمة ما تم استلامه',        val: compactNum(data.inventory.total_received_value) + ' د.ل', status: 'completed' },
    ];
    return (
      <table className="w-full text-sm">
        <thead className="bg-slate-800/60">
          <tr>
            {['القطاع','البند','القيمة',''].map(h => (
              <th key={h} className="px-4 py-3 text-right text-slate-300 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
              <td className="px-4 py-3 text-slate-400 text-xs font-medium">{row.domain}</td>
              <td className="px-4 py-3 text-slate-200">{row.key}</td>
              <td className="px-4 py-3 text-slate-300 font-medium">{row.val}</td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  })() : null;

  return (
    <ReportLayout
      title="التقرير التنفيذي"
      icon={<BarChart2 className="w-8 h-8" />}
      iconBg="bg-violet-600/20"
      iconBorder="border-violet-500/50"
      iconColor="text-violet-400"
      breadcrumb={[{ label: 'التقرير التنفيذي', href: '#' }]}
      generatedAt={data?.generated_at}
      loading={loading}
      error={err}
      onRefresh={fetchData}
      filterBar={
        <ReportFilters
          values={filters}
          onChange={setFilters}
          loading={loading}
        />
      }
      executiveSummary={execSummary}
      kpis={kpis}
      mainSection={mainSection}
      secondaryLeft={secondaryLeft}
      secondaryRight={secondaryRight}
      secondaryLeftTitle="تحليل الإيرادات (هدف مقابل منجز)"
      secondaryRightTitle="توزيع حالة العقود"
      extraSection={extraSection}
      extraSectionTitle="توزيع المشاريع حسب الحالة"
      tableTitle="ملخص المؤشرات المالية والتشغيلية"
      dataTable={dataTable}
      insights={insights}
    />
  );
}
