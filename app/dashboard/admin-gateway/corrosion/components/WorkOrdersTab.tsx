'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, RefreshCw, Search, Wrench, Settings, Send, Settings2, Users, ArrowDownLeft, ArrowUpRight, GitBranch, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import SharingSettingsPanel from './SharingSettingsPanel';
import WorkOrderDispatchModal, { type DispatchConfig } from '@/app/dashboard/shared/components/WorkOrderDispatchModal';
import RoutingRulesModal from '@/app/dashboard/shared/components/RoutingRulesModal';
import AssignIncomingModal, { type IncomingWO } from '@/app/dashboard/shared/components/AssignIncomingModal';
import WOCloseModal from './WOCloseModal';
import DualWOCreator from './DualWOCreator';
import ObstacleReportModal from './ObstacleReportModal';
import CPInstallWOCreator from './CPInstallWOCreator';

type WorkOrder = {
  id: number;
  // API field names (workspace.work_orders)
  work_order_number?: string;
  work_type?: string;
  title?: string;
  title_ar?: string;
  description?: string;
  notes?: string;
  created_by?: string;
  priority?: string;
  status?: string;
  asset_name?: string;
  asset_id?: string;
  assigned_to?: string | number;
  assigned_team?: string;
  created_at?: string;
  scheduled_date?: string;
  start_date?: string;
  completion_date?: string;
  age_hours?: number;
  sla_state?: string;
  document_cycle_complete?: boolean;
  source_dept?: string;
  routing_type?: string;
  acknowledged_at?: string;
};

type Props = {
  onGoToAnalysis: () => void;
  onGoToPrediction: () => void;
  userDepartment?: string;
};

export default function WorkOrdersTab({ 
  onGoToAnalysis, 
  onGoToPrediction,
  userDepartment = 'corrosion'
}: Props) {
  const statusLabel = (statusRaw?: string) => {
    const status = String(statusRaw ?? '').toLowerCase();
    const labels: Record<string, string> = {
      open: 'مفتوح',
      pending: 'قيد الانتظار',
      in_progress: 'قيد التنفيذ',
      completed: 'مكتمل',
      closed: 'مغلق',
      cancelled: 'ملغي',
      received: 'وارد',
      classified: 'مصنف',
      obstacle_survey: 'كشف العوائق',
      obstacle_removal_requested: 'تقرير عوائق — بانتظار الإزالة',
      obstacle_team_removal: 'إزالة بالفريق — جارٍ',
      obstacle_external_removal: 'إزالة بإدارة خارجية — بانتظار التأكيد',
      obstacle_removed_confirmed: 'تمت إزالة العوائق',
      survey_authorized: 'مأذون بالمسح',
      survey_in_progress: 'المسح جارٍ',
      data_submitted: 'بيانات المسح مستلمة',
      technical_analysis: 'تحت التحليل الفني',
      maintenance_escalated: 'محال للصيانة',
      closed_no_issue: 'مغلق بلا ملاحظات',
    };
    return labels[status] ?? statusRaw ?? '—';
  };

  const priorityLabel = (priorityRaw?: string) => {
    const p = String(priorityRaw ?? '').toLowerCase();
    const labels: Record<string, string> = {
      emergency: 'طارئة',
      critical: 'حرجة',
      urgent: 'عاجلة',
      high: 'عالية',
      corrective: 'تصحيحية',
      periodic: 'دورية',
      normal: 'عادية',
      low: 'منخفضة',
    };
    return labels[p] ?? priorityRaw ?? '—';
  };
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [message, setMessage] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAssetName, setManualAssetName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualType, setManualType] = useState('inspection');
  const [manualPriority, setManualPriority] = useState('normal');
  const [manualDate, setManualDate] = useState('');
  const [manualDepartment, setManualDepartment] = useState('admin');
  const [manualTeam, setManualTeam] = useState('');
  const [manualLocationLabel, setManualLocationLabel] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualTelegramChatId, setManualTelegramChatId] = useState('');
  const [sharingSettingsOpen, setSharingSettingsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showDispatch, setShowDispatch] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'outbound_internal' | 'outbound_external' | 'incoming'>('outbound_internal');
  const [showRoutingRules, setShowRoutingRules] = useState(false);
  const [assigningWO, setAssigningWO] = useState<IncomingWO | null>(null);
  const [closingWO, setClosingWO] = useState<WorkOrder | null>(null);
  const [showDualWO, setShowDualWO] = useState(false);
  const [dualWOPrefill, setDualWOPrefill] = useState<{ location?: string; pipeline?: string; chainage?: string; finding?: string } | undefined>();
  const [obstacleWO, setObstacleWO] = useState<WorkOrder | null>(null);
  const [showCPInstall, setShowCPInstall] = useState(false);
  const [cpInstallPrefill, setCpInstallPrefill] = useState<{ location?: string; pipeline?: string; chainage?: string; finding?: string } | undefined>();

  const loadWorkOrders = async () => {
    setMessage(null);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/v1/workflow/work-orders?tab=${activeTab}&dept=corrosion&limit=200`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setRows([]);
        setMessage(data?.detail ?? data?.message ?? 'تعذر جلب أوامر العمل');
        return;
      }
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.work_orders)
          ? data.work_orders
          : Array.isArray(data?.data)
            ? data.data
            : [];
      setRows(list);
    } catch (error: any) {
      setRows([]);
      setMessage(error?.message ?? 'تعذر جلب أوامر العمل');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkOrders();
  }, [activeTab]);

  const transitionStatus = async (row: WorkOrder, newStatus: string, actionLabel: string) => {
    setActionBusyId(row.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/workspace/workflow-orders/${row.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_status: newStatus,
          note: `${actionLabel} عبر لوحة التآكل`,
          actor: 'admin_gateway',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) {
        setMessage(data?.detail ?? data?.error ?? 'تعذر تحديث حالة أمر العمل');
        return;
      }
      setMessage(`تم تنفيذ الإجراء: ${actionLabel}`);
      await loadWorkOrders();
    } catch (error: any) {
      setMessage(error?.message ?? 'تعذر تحديث حالة أمر العمل');
    } finally {
      setActionBusyId(null);
    }
  };

  const getRowActions = (statusRaw?: string) => {
    const status = String(statusRaw ?? '').toLowerCase();
    if (['closed', 'cancelled'].includes(status)) {
      return [] as Array<{ label: string; status: string }>;
    }
    if (status === 'received') {
      return [{ label: 'تصنيف إداري', status: 'classified' }];
    }
    if (status === 'classified' || status === 'open') {
      return [{ label: 'إطلاق كشف العوائق', status: 'obstacle_survey' }];
    }
    if (status === 'obstacle_survey') {
      return [
        { label: 'لا توجد عوائق — بدء المسح', status: 'survey_authorized' },
        { label: 'رفع تقرير العوائق', status: '__obstacle_report__' },
      ];
    }
    // After obstacle report filed — two paths
    if (status === 'obstacle_removal_requested') {
      return [
        { label: 'الفريق أزال العوائق', status: 'obstacle_team_removal' },
        { label: 'تأكيد إزالة الإدارة الخارجية', status: 'obstacle_removed_confirmed' },
      ];
    }
    if (status === 'obstacle_team_removal') {
      return [{ label: 'تأكيد الإزالة — إصدار أمر المسح', status: 'survey_authorized' }];
    }
    if (status === 'obstacle_external_removal') {
      return [{ label: 'الإدارة الخارجية أتمت الإزالة — إصدار أمر المسح', status: 'survey_authorized' }];
    }
    if (status === 'obstacle_removed_confirmed') {
      return [{ label: 'إصدار أمر بدء المسح', status: 'survey_authorized' }];
    }
    if (status === 'survey_authorized' || status === 'pending') {
      return [{ label: 'بدء المسح', status: 'survey_in_progress' }];
    }
    if (status === 'survey_in_progress' || status === 'in_progress') {
      return [{ label: 'استلام بيانات المسح', status: 'data_submitted' }];
    }
    if (status === 'data_submitted') {
      return [{ label: 'بدء التحليل الفني', status: 'technical_analysis' }];
    }
    if (status === 'technical_analysis') {
      return [
        { label: 'إحالة للصيانة', status: 'maintenance_escalated' },
        { label: 'إغلاق بلا مشاكل', status: 'closed_no_issue' },
      ];
    }
    if (status === 'maintenance_escalated' || status === 'completed') {
      return [{ label: 'إغلاق الدورة', status: 'closed' }];
    }
    if (status === 'open') {
      return [{ label: 'تأكيد الاستلام', status: 'pending' }];
    }
    if (status === 'pending') {
      return [{ label: 'بدء التنفيذ', status: 'in_progress' }];
    }
    if (status === 'in_progress') {
      return [{ label: 'إنهاء التنفيذ', status: 'completed' }];
    }
    if (status === 'completed') {
      return [{ label: 'إغلاق الدورة', status: 'closed' }];
    }
      return [{ label: 'تصنيف إداري', status: 'classified' }];
  };

  const createManualWorkOrder = async () => {
    if (!manualTitle.trim()) {
      setMessage('عنوان الأمر مطلوب لإصدار أمر يدوي');
      return;
    }
    setManualBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/workspace/workflow-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle.trim(),
          asset_name: manualAssetName.trim() || null,
          description: manualDescription.trim() || null,
          work_type: manualType,
          priority: manualPriority,
          scheduled_date: manualDate || null,
          created_by: 'admin_gateway',
          target_department: manualDepartment,
          target_team: manualTeam.trim() || null,
          location_label: manualLocationLabel.trim() || null,
          latitude: manualLat.trim() ? Number(manualLat) : null,
          longitude: manualLon.trim() ? Number(manualLon) : null,
          telegram_chat_id: manualTelegramChatId.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) {
        setMessage(data?.detail ?? data?.error ?? 'تعذر إصدار أمر العمل اليدوي');
        return;
      }
      setMessage('تم إصدار أمر عمل يدوي بنجاح');
      setManualTitle('');
      setManualAssetName('');
      setManualDescription('');
      setManualType('inspection');
      setManualPriority('normal');
      setManualDate('');
      setManualDepartment('admin');
      setManualTeam('');
      setManualLocationLabel('');
      setManualLat('');
      setManualLon('');
      setManualTelegramChatId('');
      setManualOpen(false);
      await loadWorkOrders();
    } catch (error: any) {
      setMessage(error?.message ?? 'تعذر إصدار أمر العمل اليدوي');
    } finally {
      setManualBusy(false);
    }
  };

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !term || [
        row.wo_number,
        row.title,
        row.description,
        row.priority,
        row.status,
        row.wo_type,
        row.asset_name,
        row.requested_by,
        row.assigned_to,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'all' || String(row.status ?? '').toLowerCase() === statusFilter;
      const matchesPriority = priorityFilter === 'all' || String(row.priority ?? '').toLowerCase() === priorityFilter;
      const matchesType = typeFilter === 'all' || String(row.wo_type ?? '').toLowerCase() === typeFilter;
      return matchesQuery && matchesStatus && matchesPriority && matchesType;
    });
  }, [priorityFilter, query, rows, statusFilter, typeFilter]);

  const statusOptions = useMemo(() => {
    const defaults = [
      'received',
      'classified',
      'obstacle_survey',
      'obstacle_removal_requested',
      'obstacle_team_removal',
      'obstacle_external_removal',
      'obstacle_removed_confirmed',
      'survey_authorized',
      'survey_in_progress',
      'data_submitted',
      'technical_analysis',
      'maintenance_escalated',
      'closed_no_issue',
      'pending',
      'in_progress',
      'completed',
      'cancelled',
      'closed',
    ];
    return Array.from(new Set([...defaults, ...rows.map((row) => String(row.status ?? '').toLowerCase()).filter(Boolean)])).filter(Boolean);
  }, [rows]);

  const priorityOptions = useMemo(() => {
    const defaults = ['critical', 'high', 'normal', 'low'];
    return Array.from(new Set([...defaults, ...rows.map((row) => String(row.priority ?? '').toLowerCase()).filter(Boolean)])).filter(Boolean);
  }, [rows]);

  const typeOptions = useMemo(() => {
    const defaults = ['corrective', 'preventive', 'predictive', 'inspection', 'emergency'];
    return Array.from(new Set([...defaults, ...rows.map((row) => String(row.wo_type ?? '').toLowerCase()).filter(Boolean)])).filter(Boolean);
  }, [rows]);

  const total = rows.length;
  const openCount = rows.filter((row) => !['completed', 'closed', 'cancelled'].includes(String(row.status ?? '').toLowerCase())).length;
  const criticalCount = rows.filter((row) => ['critical', 'high'].includes(String(row.priority ?? '').toLowerCase())).length;
  const filteredOpenCount = filteredRows.filter((row) => !['completed', 'closed', 'cancelled'].includes(String(row.status ?? '').toLowerCase())).length;
  const bySection = useMemo(() => {
    const sections = {
      adminOffice: 0,
      periodicMaintenance: 0,
      technicalSupport: 0,
      componentsCoating: 0,
    };
    rows.forEach((row) => {
      const team = String(row.assigned_team ?? '').toLowerCase();
      if (!team) return;
      if (team.includes('إدارية') || team.includes('admin')) sections.adminOffice += 1;
      else if (team.includes('مراقبة') || team.includes('ut') || team.includes('cp') || team.includes('دورية')) sections.periodicMaintenance += 1;
      else if (team.includes('دعم') || team.includes('integrity') || team.includes('nde')) sections.technicalSupport += 1;
      else if (team.includes('طلاء') || team.includes('مكونات') || team.includes('coating')) sections.componentsCoating += 1;
    });
    return sections;
  }, [rows]);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-rose-400" /> أوامر العمل
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              هذه الواجهة محايدة ومخصصة لعرض أوامر العمل التشغيلية بغض النظر عن مصدرها: تحليل، تنبؤ، أو تشغيل مباشر.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSharingSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-900/20 px-3 py-1.5 text-xs text-blue-200 hover:bg-blue-900/40"
            >
              <Settings className="w-3.5 h-3.5" /> مشاركة البيانات
            </button>
            <button
              onClick={() => setManualOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-900/20 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-900/40"
            >
              <Wrench className="w-3.5 h-3.5" /> إصدار أمر يدوي
            </button>
            <button
              onClick={onGoToAnalysis}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              الرجوع للتحليل
            </button>
            <button
              onClick={onGoToPrediction}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-900/30 px-3 py-1.5 text-xs text-purple-200 hover:bg-purple-900/50"
            >
              الذهاب للتنبؤ
            </button>
            <button
              onClick={() => setShowRoutingRules(true)}
              title="إعدادات قواعد التوزيع"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-indigo-300 hover:bg-slate-700"
            >
              <Settings2 className="w-3.5 h-3.5" /> قواعد التوزيع
            </button>
            <button
              onClick={loadWorkOrders}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> تحديث
            </button>
            <button
              onClick={() => setShowDispatch(true)}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-900/30 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-900/50 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> اعتماد وإرسال
            </button>
          </div>
        </div>

        {/* ── 3 Tabs ── */}
        <div className="flex gap-1 bg-slate-900/60 border border-slate-700 rounded-xl p-1">
          {([
            { key: 'outbound_internal', label: 'صادرة داخلية',  icon: ArrowUpRight,  desc: 'فرق التآكل' },
            { key: 'outbound_external', label: 'صادرة خارجية',  icon: ArrowUpRight,  desc: 'إلى الصيانة / العمليات' },
            { key: 'incoming',          label: 'واردة',          icon: ArrowDownLeft, desc: 'من الصيانة / العمليات' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? tab.key === 'incoming'
                    ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                    : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className="text-[10px] opacity-60 hidden md:inline">({tab.desc})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <p className="text-[10px] text-slate-500">إجمالي الأوامر</p>
            <p className="text-xl font-bold text-white">{total}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <p className="text-[10px] text-slate-500">الأوامر المفتوحة</p>
            <p className="text-xl font-bold text-amber-400">{openCount}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <p className="text-[10px] text-slate-500">عالية الأولوية</p>
            <p className="text-xl font-bold text-rose-300">{criticalCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-violet-500/25 bg-violet-900/10 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-xs font-semibold text-violet-200">نموذج تنظيم إدارة التآكل</p>
            <span className="text-[10px] text-slate-400">مدير الإدارة + الإدارية + 3 أقسام</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-200">
              <div className="text-slate-400 mb-1">الإدارية (وسيط التوجيه)</div>
              <div className="text-base font-bold text-indigo-300">{bySection.adminOffice}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-200">
              <div className="text-slate-400 mb-1">المراقبة الدورية والصيانة</div>
              <div className="text-base font-bold text-cyan-300">{bySection.periodicMaintenance}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-200">
              <div className="text-slate-400 mb-1">الدعم الفني</div>
              <div className="text-base font-bold text-emerald-300">{bySection.technicalSupport}</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-200">
              <div className="text-slate-400 mb-1">المكونات الهندسية والطلاء</div>
              <div className="text-base font-bold text-amber-300">{bySection.componentsCoating}</div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            المسار المعتمد: وارد/دوري → الإدارية للتصنيف → إحالة فنية حسب الأولوية (طارئة/حرجة/تصحيحية/دورية) → تنفيذ → تحقق وإغلاق.
          </p>
        </div>

        {manualOpen && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-3 space-y-3">
            <p className="text-xs text-emerald-200">إصدار أمر يدوي من لوحة التآكل (خارج المسار الآلي للتنبؤ)</p>
            <p className="text-[11px] text-slate-300">عنوان الأمر = اسم المهمة المطلوب تنفيذها، وليس معرف تيليجرام.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="عنوان الأمر (اسم المهمة)"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              />
              <input
                value={manualAssetName}
                onChange={(e) => setManualAssetName(e.target.value)}
                placeholder="اسم الأصل (اختياري)"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              />
              <input
                value={manualTeam}
                onChange={(e) => setManualTeam(e.target.value)}
                placeholder="الفريق المستهدف (اختياري)"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              />
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              >
                <option value="inspection">inspection</option>
                <option value="preventive">preventive</option>
                <option value="periodic">periodic</option>
                <option value="corrective">corrective</option>
                <option value="emergency">emergency</option>
                <option value="predictive">predictive</option>
              </select>
              <select
                value={manualPriority}
                onChange={(e) => setManualPriority(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              >
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
                <option value="urgent">urgent</option>
                <option value="emergency">emergency</option>
                <option value="corrective">corrective-profile</option>
                <option value="periodic">periodic-profile</option>
              </select>
              <select
                value={manualDepartment}
                onChange={(e) => setManualDepartment(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              >
                <option value="admin">admin</option>
                <option value="gis">gis</option>
                <option value="finance">finance</option>
                <option value="operations">operations</option>
              </select>
              <input
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                type="date"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              />
              <input
                value={manualLocationLabel}
                onChange={(e) => setManualLocationLabel(e.target.value)}
                placeholder="وصف الموقع المستهدف (اختياري)"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              />
              <input
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                type="number"
                step="any"
                placeholder="Latitude (اختياري)"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              />
              <input
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                type="number"
                step="any"
                placeholder="Longitude (اختياري)"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              />
              <input
                value={manualTelegramChatId}
                onChange={(e) => setManualTelegramChatId(e.target.value)}
                placeholder="Telegram Chat ID (اختياري)"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none md:col-span-2"
              />
              <button
                onClick={createManualWorkOrder}
                disabled={manualBusy}
                className="rounded-lg border border-emerald-500/50 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-50"
              >
                {manualBusy ? 'جاري الإصدار...' : 'إصدار الأمر'}
              </button>
            </div>
            <textarea
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              rows={2}
              placeholder="وصف مختصر للأمر (اختياري)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 md:col-span-1">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث برقم الأمر أو العنوان أو الأصل أو الحالة"
            className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
          />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 outline-none"
          >
            <option value="all">كل الحالات</option>
            {statusOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 outline-none"
          >
            <option value="all">كل الأولويات</option>
            {priorityOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 outline-none"
          >
            <option value="all">كل الأنواع</option>
            {typeOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1">المصدر: workspace.work_orders</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1">المعروض بعد الفلترة: {filteredRows.length}</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1">المفتوح بعد الفلترة: {filteredOpenCount}</span>
        </div>

        {message && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {message}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-right">
            <thead className="bg-slate-900">
              <tr className="text-xs text-slate-400">
                <th className="px-4 py-3 font-medium">رقم</th>
                <th className="px-4 py-3 font-medium">العنوان</th>
                <th className="px-4 py-3 font-medium">الأصل</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">الأولوية</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-400" colSpan={8}>
                    جارٍ تحميل أوامر العمل...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-400" colSpan={8}>
                    لا توجد أوامر عمل مطابقة للفلاتر الحالية.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr
                      className="hover:bg-slate-800/60 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    >
                      <td className="px-4 py-3 text-sm text-slate-300 font-mono">{row.work_order_number ?? row.id}</td>
                      <td className="px-4 py-3 text-sm text-white max-w-xs">
                        <div className="font-medium leading-snug">{row.title ?? 'بدون عنوان'}</div>
                        {row.title_ar && row.title_ar !== row.title && (
                          <div className="mt-0.5 text-xs text-slate-400">{row.title_ar}</div>
                        )}
                        {activeTab === 'incoming' && row.source_dept && (
                          <div className="mt-0.5 text-[10px] text-amber-400/70">↓ وارد من: {row.source_dept === 'maintenance' ? 'إدارة الصيانة' : row.source_dept}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <div>{row.asset_name ?? '—'}</div>
                        {row.created_by && (
                          <div className="mt-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 inline-block">{row.created_by}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{row.work_type ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{priorityLabel(row.priority)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <div>{statusLabel(row.status)}</div>
                        {row.sla_state && (
                          <div className="mt-1 text-[10px] text-amber-300">SLA: {row.sla_state}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleDateString('ar-LY')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-2">
                          {activeTab === 'incoming' ? (
                            <button
                              onClick={() => setAssigningWO(row as IncomingWO)}
                              className="rounded-md border border-amber-600/40 bg-amber-900/20 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/40 flex items-center gap-1">
                              <Users className="w-3 h-3" /> توزيع على فرقة
                            </button>
                          ) : (
                            <>
                              {getRowActions(row.status).map((action) => (
                                action.status === '__obstacle_report__' ? (
                                  // Special: open obstacle report modal instead of direct status change
                                  <button
                                    key={`${row.id}-obstacle`}
                                    onClick={() => setObstacleWO(row)}
                                    disabled={actionBusyId === row.id}
                                    className="rounded-md border border-amber-600/40 bg-amber-900/20 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/40 flex items-center gap-1"
                                  >
                                    <AlertTriangle className="w-3 h-3" /> {action.label}
                                  </button>
                                ) : (
                                  <button
                                    key={`${row.id}-${action.status}`}
                                    onClick={() => transitionStatus(row, action.status, action.label)}
                                    disabled={actionBusyId === row.id}
                                    className="rounded-md border border-cyan-600/40 bg-cyan-900/20 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-50"
                                  >
                                    {action.label}
                                  </button>
                                )
                              ))}
                              {/* CP Installation button for technical_analysis results */}
                              {['technical_analysis', 'data_submitted'].includes(String(row.status ?? '').toLowerCase()) &&
                               !row.notes?.includes('[DUAL_WO]') && !row.notes?.includes('[CP_INSTALL]') && (
                                <button
                                  onClick={() => {
                                    setCpInstallPrefill({
                                      location: row.asset_name ?? '',
                                      finding: row.description?.slice(0, 100) ?? '',
                                    });
                                    setShowCPInstall(true);
                                  }}
                                  className="rounded-md border border-cyan-600/40 bg-cyan-900/20 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-900/40 flex items-center gap-1"
                                >
                                  <ShieldCheck className="w-3 h-3" /> أمر CP
                                </button>
                              )}
                              {/* Close button for non-closed WOs */}
                              {!['closed', 'cancelled', 'closed_no_issue'].includes(String(row.status ?? '').toLowerCase()) && (
                                <button
                                  onClick={() => setClosingWO(row)}
                                  className="rounded-md border border-rose-600/40 bg-rose-900/20 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-900/40 flex items-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" /> إغلاق
                                </button>
                              )}
                              {/* Dual WO button for internal corrosion findings */}
                              {row.notes?.includes('[DUAL_WO]') ? null : (
                                ['technical_analysis', 'data_submitted'].includes(String(row.status ?? '').toLowerCase()) && (
                                  <button
                                    onClick={() => {
                                      setDualWOPrefill({
                                        location: row.asset_name ?? '',
                                        finding: row.description?.slice(0, 80) ?? '',
                                      });
                                      setShowDualWO(true);
                                    }}
                                    className="rounded-md border border-orange-600/40 bg-orange-900/20 px-2 py-1 text-[11px] text-orange-200 hover:bg-orange-900/40 flex items-center gap-1"
                                  >
                                    <GitBranch className="w-3 h-3" /> أمر مزدوج
                                  </button>
                                )
                              )}
                              {getRowActions(row.status).length === 0 && (
                                <span className="text-[11px] text-emerald-300">مغلقة</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === row.id && (
                      <tr className="bg-slate-800/40">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {row.description && (
                              <div>
                                <p className="text-[10px] text-slate-500 mb-1">الوصف</p>
                                <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{row.description}</p>
                              </div>
                            )}
                            <div className="space-y-2">
                              {row.notes && (
                                <div>
                                  <p className="text-[10px] text-slate-500 mb-1">الملاحظات / المصدر</p>
                                  <p className="font-mono text-xs text-cyan-300 bg-slate-900 rounded px-2 py-1">{row.notes}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                                {row.created_by && <span>أنشأه: <span className="text-slate-200">{row.created_by}</span></span>}
                                {row.scheduled_date && <span>موعد التنفيذ: <span className="text-slate-200">{row.scheduled_date}</span></span>}
                                {row.assigned_team && <span>الفريق: <span className="text-slate-200">{row.assigned_team}</span></span>}
                                {row.age_hours != null && <span>العمر: <span className="text-slate-200">{row.age_hours} ساعة</span></span>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SharingSettingsPanel
        open={sharingSettingsOpen}
        onClose={() => setSharingSettingsOpen(false)}
        userDepartment={userDepartment}
      />

      {/* ── Dispatch Modal ── */}
      {showDispatch && (
        <WorkOrderDispatchModal
          workOrders={rows.map(w => ({
            id: w.id,
            title: w.title,
            title_ar: w.title_ar,
            work_type: w.work_type,
            priority: w.priority,
            status: w.status,
            department: 'corrosion',
          }))}
          context="corrosion"
          onConfirm={async (config: DispatchConfig) => {
            const BATCH = 5;
            if (config.channel === 'cmms' || config.channel === 'all') {
              for (let i = 0; i < rows.length; i += BATCH) {
                await Promise.allSettled(
                  rows.slice(i, i + BATCH).map(wo =>
                    fetch('/api/v1/workspace/work-orders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: wo.title || wo.title_ar || 'أمر تآكل',
                        title_ar: wo.title_ar || wo.title || 'أمر تآكل',
                        asset_name: wo.asset_name || '',
                        description: wo.description || '',
                        work_type: wo.work_type || 'inspection',
                        priority: wo.priority || 'normal',
                        target_department: config.externalDepts[0] || 'maintenance',
                        target_team: config.internalTeams[0] || 'team_ut',
                        created_by: 'corrosion_dept',
                        notes: `مرسل من إدارة التآكل | الفرق: ${config.internalTeams.join(', ')}`,
                      }),
                    }),
                  ),
                );
              }
            }
            setShowDispatch(false);
            setToastMsg(`✅ أُرسلت ${rows.length} أمر عمل لـ ${config.internalTeams.length + config.externalDepts.length} جهة`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          onClose={() => setShowDispatch(false)}
        />
      )}

      {/* ── Routing Rules Modal ── */}
      {showRoutingRules && (
        <RoutingRulesModal dept="corrosion" onClose={() => setShowRoutingRules(false)} />
      )}

      {/* ── Assign Incoming WO Modal ── */}
      {assigningWO && (
        <AssignIncomingModal
          workOrder={assigningWO}
          dept="corrosion"
          onConfirm={async (id, team, notes) => {
            await fetch(`/api/v1/workflow/work-orders/${id}/assign`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assigned_team: team, assigned_by: 'corrosion_admin', notes }),
            });
            setAssigningWO(null);
            setToastMsg(`✅ تم توزيع الأمر على ${team}`);
            setTimeout(() => setToastMsg(''), 4000);
            loadWorkOrders();
          }}
          onClose={() => setAssigningWO(null)}
        />
      )}

      {/* ── WO Close Modal ── */}
      {closingWO && (
        <WOCloseModal
          workOrder={closingWO}
          onClose={() => setClosingWO(null)}
          onSuccess={() => {
            setClosingWO(null);
            setToastMsg('✅ تم إغلاق أمر العمل بنجاح');
            setTimeout(() => setToastMsg(''), 4000);
            loadWorkOrders();
          }}
        />
      )}

      {/* ── Dual WO Creator ── */}
      {showDualWO && (
        <DualWOCreator
          prefill={dualWOPrefill}
          onClose={() => setShowDualWO(false)}
          onSuccess={() => {
            setShowDualWO(false);
            setToastMsg('✅ تم إنشاء الأمر المزدوج وإرساله للمدير');
            setTimeout(() => setToastMsg(''), 5000);
            loadWorkOrders();
          }}
        />
      )}

      {/* ── Obstacle Report Modal ── */}
      {obstacleWO && (
        <ObstacleReportModal
          workOrder={obstacleWO}
          onClose={() => setObstacleWO(null)}
          onSuccess={(newStatus) => {
            setObstacleWO(null);
            const label = newStatus === 'obstacle_team_removal' ? 'الفريق يتولى الإزالة' : 'طلب إزالة خارجية مُرسَل';
            setToastMsg(`✅ تم رفع تقرير العوائق — ${label}`);
            setTimeout(() => setToastMsg(''), 5000);
            loadWorkOrders();
          }}
        />
      )}

      {/* ── CP Installation WO Creator ── */}
      {showCPInstall && (
        <CPInstallWOCreator
          prefill={cpInstallPrefill}
          onClose={() => setShowCPInstall(false)}
          onSuccess={() => {
            setShowCPInstall(false);
            setToastMsg('✅ تم إصدار أمر تركيب الحماية الكاثودية وإحالته لقسم المراقبة');
            setTimeout(() => setToastMsg(''), 5000);
            loadWorkOrders();
          }}
        />
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-900/90 border border-emerald-500/30 text-emerald-300 px-6 py-3 rounded-2xl text-sm shadow-2xl">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
