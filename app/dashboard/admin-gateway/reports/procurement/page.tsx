'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ShoppingCart } from 'lucide-react';
import ReportLayout, {
  ExecutiveSummary, KpiItem, SmartInsight, fmt, StatusBadge,
} from '@/components/reports/ReportLayout';
import {
  C, compactNum,
  DonutChart, VarianceBarChart, HorizontalBarChart, ChartEmpty,
} from '@/components/reports/ReportCharts';
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters';
import { getClientTenantId } from '@/lib/getClientTenantId';

interface POByProject    { project_name: string; project_id: number; po_count: number; total_value: number; }
interface ContractByProj { project_name: string; project_id: number; count: number; total_value: number; earliest_start: string|null; latest_end: string|null; }
interface PendingPO      { po_number: string; title: string; total_amount: number; status: string; issued_date: string|null; project_name: string|null; }

interface ProcData {
  generated_at: string;
  suppliers:    { active: number; inactive: number; total: number; };
  purchase_requests: { pending: number; approved: number; rejected: number; po_issued: number; total: number; };
  purchase_orders:   { draft: number; issued: number; delivered: number; completed: number; total: number; total_value: number; committed_value: number; };
  purchase_orders_by_project: POByProject[];
  contracts: { active: number; draft: number; completed: number; terminated: number; total: number; total_value: number; active_value: number; };
  contracts_by_project: ContractByProj[];
  contractors: { active: number; inactive: number; blacklisted: number; total: number; };
  recent_pending_pos: PendingPO[];
}

const short = (s: string, max = 16) => s && s.length > max ? s.slice(0, max) + '…' : (s ?? '—');

export default function ProcurementReportPage() {
  const [data,    setData]    = useState<ProcData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');
  const [filters, setFilters] = useState<ReportFilterValues>({ projectId: null, siteId: null });

  const fetchData = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.set('project_id', String(filters.projectId));
      const q = params.toString() ? `?${params}` : '';
      const r = await fetch(`/api/v1/gov-reports/procurement${q}`, {
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

  /** variance: أوامر الشراء مقابل قيمة العقود لكل مشروع */
  const varianceData = useMemo(() => {
    if (!data) return [];
    const poMap  = new Map((data.purchase_orders_by_project ?? []).map(r => [r.project_name, r.total_value]));
    const conMap = new Map((data.contracts_by_project ?? []).map(r => [r.project_name, r.total_value]));
    const allProj = new Set([...poMap.keys(), ...conMap.keys()]);
    return Array.from(allProj)
      .map(name => ({
        label:   short(name),
        planned: poMap.get(name)  ?? 0,
        actual:  conMap.get(name) ?? 0,
      }))
      .filter(r => r.planned > 0 || r.actual > 0);
  }, [data]);

  /** توزيع حالة أوامر الشراء — donut */
  const poStatusDonut = useMemo(() => {
    if (!data) return [];
    const po = data.purchase_orders;
    return [
      { name: 'مسودة',   value: po.draft     ?? 0, color: C.neutral  },
      { name: 'صادرة',   value: po.issued    ?? 0, color: C.purple   },
      { name: 'مستلمة',  value: po.delivered ?? 0, color: C.teal     },
      { name: 'مكتملة',  value: po.completed ?? 0, color: C.success  },
    ];
  }, [data]);

  /** توزيع حالة العقود — donut */
  const contractStatusDonut = useMemo(() => {
    if (!data) return [];
    const con = data.contracts;
    return [
      { name: 'نشطة',    value: con.active     ?? 0, color: C.success },
      { name: 'مسودة',    value: con.draft      ?? 0, color: C.neutral },
      { name: 'مكتملة',  value: con.completed  ?? 0, color: C.info    },
      { name: 'منتهية',  value: con.terminated ?? 0, color: C.danger  },
    ];
  }, [data]);

  /** أعلى مشاريع بقيمة العقود — horizontal */
  const topContracts = useMemo(() => {
    if (!data) return [];
    return [...(data.contracts_by_project ?? [])]
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, 8)
      .map((r, i) => ({
        label: short(r.project_name),
        value: r.total_value,
        color: [C.primary, C.success, C.warning, C.teal, C.purple,
                C.orange, C.info, C.danger][i % 8],
      }));
  }, [data]);

  // ── ملخص تنفيذي ────────────────────────────────────────────────────────────
  const execSummary = useMemo<ExecutiveSummary | undefined>(() => {
    if (!data) return undefined;
    const pr  = data.purchase_requests;
    const po  = data.purchase_orders;
    const con = data.contracts;
    const pendingRate  = pr.total > 0 ? (pr.pending / pr.total) * 100 : 0;
    const statusLevel  = pendingRate > 40 ? 'critical' : pendingRate > 20 ? 'warning' : 'good';
    const topConProj   = [...(data.contracts_by_project ?? [])].sort((a, b) => b.total_value - a.total_value)[0];
    return {
      status: {
        level: statusLevel,
        label: statusLevel === 'good' ? 'دورة المشتريات سليمة'
             : statusLevel === 'warning' ? 'تراكم في الطلبات المعلقة'
             : 'تحذير: نسبة عالية من الطلبات المعلقة',
        detail: `${pr.pending} طلب شراء معلق · عقود نشطة: ${con.active} بـ ${compactNum(con.active_value ?? 0)} د.ل`,
      },
      risk: {
        label:  data.contractors.blacklisted > 0 ? `${data.contractors.blacklisted} مقاول في القائمة السوداء` : 'لا مخاطر فورية',
        detail: po.draft > 0 ? `${po.draft} أمر شراء لم يُصدر بعد` : '',
      },
      opportunity: {
        label:  topConProj ? `أعلى تركّز — ${topConProj.project_name}` : 'توحيد الموردين',
        detail: topConProj ? `قيمة عقوده: ${compactNum(topConProj.total_value)} د.ل` : `موردون نشطون: ${data.suppliers.active}`,
      },
    };
  }, [data]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo<KpiItem[]>(() => {
    if (!data) return [];
    return [
      { label: 'قيمة أوامر الشراء',  value: compactNum(data.purchase_orders.total_value)   + ' د.ل', color: 'blue'   },
      { label: 'عقود نشطة',           value: data.contracts.active,                                    color: 'green'  },
      { label: 'قيمة العقود النشطة',  value: compactNum(data.contracts.active_value)       + ' د.ل', color: 'teal'   },
      { label: 'طلبات شراء معلقة',    value: data.purchase_requests.pending, color: data.purchase_requests.pending > 0 ? 'amber' : 'blue' },
    ];
  }, [data]);

  // ── ملاحظات ذكية ──────────────────────────────────────────────────────────
  const insights = useMemo<SmartInsight[]>(() => {
    if (!data) return [];
    const list: SmartInsight[] = [];
    const pr = data.purchase_requests;
    const po = data.purchase_orders;
    const con = data.contracts;
    if (data.contractors.blacklisted > 0)
      list.push({ type: 'warning', text: `${data.contractors.blacklisted} مقاول في القائمة السوداء — راجع العقود المرتبطة` });
    if (pr.pending > 0)
      list.push({ type: 'warning', text: `${pr.pending} طلب شراء معلق يحتاج اعتماد` });
    if (po.draft > 0)
      list.push({ type: 'info', text: `${po.draft} أمر شراء مسودة — لم يُصدر بعد` });
    if (con.terminated > 0)
      list.push({ type: 'warning', text: `${con.terminated} عقد تم إنهاؤه — تحقق من الأثر المالي` });
    if (pr.approved > 0)
      list.push({ type: 'success', text: `${pr.approved} طلب شراء معتمد · ${pr.po_issued} تحوّل لأمر شراء فعلي` });
    const topPO = [...(data.purchase_orders_by_project ?? [])].sort((a, b) => b.total_value - a.total_value)[0];
    if (topPO)
      list.push({ type: 'info', text: `أعلى إنفاق: "${topPO.project_name}" — ${topPO.po_count} أوامر بـ ${compactNum(topPO.total_value)} د.ل` });
    return list;
  }, [data]);

  // ── تعريف أقسام الصفحة ────────────────────────────────────────────────────

  const mainSection = varianceData.length ? (
    <>
      <p className="text-sm text-slate-400 mb-4">
        مقارنة بين قيمة أوامر الشراء وقيمة العقود المبرمة لكل مشروع — يكشف الفجوة بين الإنفاق التشغيلي والعقدي
      </p>
      <VarianceBarChart
        data={varianceData}
        plannedLabel="أوامر الشراء"
        actualLabel="العقود"
        unit="د.ل"
        compact
      />
    </>
  ) : <ChartEmpty />;

  const secondaryLeft  = <DonutChart data={poStatusDonut}       height={260} />;
  const secondaryRight = <DonutChart data={contractStatusDonut} height={260} />;

  const extraSection = topContracts.length
    ? <HorizontalBarChart data={topContracts} unit="د.ل" compact />
    : <ChartEmpty />;

  const dataTable = data?.recent_pending_pos?.length ? (
    <table className="w-full text-sm">
      <thead className="bg-slate-800/60">
        <tr>
          {['رقم الأمر','العنوان','المشروع','المبلغ (د.ل)','الحالة','التاريخ'].map(h => (
            <th key={h} className="px-4 py-3 text-right text-slate-300 font-semibold whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.recent_pending_pos.map((row, i) => (
          <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
            <td className="px-4 py-3 text-slate-400 font-mono text-sm">{row.po_number ?? '—'}</td>
            <td className="px-4 py-3 text-slate-200 max-w-[180px] truncate">{row.title ?? '—'}</td>
            <td className="px-4 py-3 text-slate-400">{row.project_name ?? '—'}</td>
            <td className="px-4 py-3 text-slate-300">{fmt(row.total_amount)}</td>
            <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            <td className="px-4 py-3 text-slate-500 text-sm">
              {row.issued_date ? new Date(row.issued_date).toLocaleDateString('ar-LY') : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : null;

  return (
    <ReportLayout
      title="تقرير المشتريات والعقود"
      icon={<ShoppingCart className="w-8 h-8" />}
      iconBg="bg-amber-600/20"
      iconBorder="border-amber-500/50"
      iconColor="text-amber-400"
      breadcrumb={[{ label: 'المشتريات والعقود', href: '#' }]}
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
      secondaryLeftTitle="حالة أوامر الشراء"
      secondaryRightTitle="حالة العقود"
      extraSection={extraSection}
      extraSectionTitle="أعلى المشاريع بقيمة العقود (د.ل)"
      tableTitle="أوامر الشراء المعلقة مؤخراً"
      dataTable={dataTable}
      insights={insights}
    />
  );
}
