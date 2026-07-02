'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench, Plus, Search, Filter, AlertCircle, ChevronLeft,
  User, Clock, CheckCircle, XCircle, RefreshCw, Activity,
  ChevronDown, X, Send, Settings2, Users, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import WorkOrderDispatchModal, { type DispatchConfig } from '@/app/dashboard/shared/components/WorkOrderDispatchModal';
import RoutingRulesModal from '@/app/dashboard/shared/components/RoutingRulesModal';
import AssignIncomingModal, { type IncomingWO } from '@/app/dashboard/shared/components/AssignIncomingModal';

// ── CMMS Work Order (work-orders) ───────────────────────────────────────────────
interface WorkOrder {
  id: number;
  work_order_number?: string;
  title: string;
  title_ar?: string;
  description?: string;
  asset_id?: string;
  asset_name?: string;
  work_type: string;
  priority: string;
  status: string;
  scheduled_date?: string;
  start_date?: string;
  completion_date?: string;
  estimated_cost?: number;
  actual_cost?: number;
  assigned_to?: string;
  assigned_team?: string;
  target_department?: string;
  source_dept?: string;
  routing_type?: string;
  acknowledged_at?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  age_hours?: number;
  sla_state?: string;
  document_cycle_complete?: boolean;
}

// ── Arabic label maps ──────────────────────────────────────────────────────────
const STATUS_AR: Record<string, string> = {
  pending:     'معلق',
  open:        'مفتوح',
  in_progress: 'قيد التنفيذ',
  on_hold:     'موقوف',
  completed:   'مكتمل',
  closed:      'مغلق',
  cancelled:   'ملغى',
};
const PRIORITY_AR: Record<string, string> = {
  urgent:   'عاجل',
  normal:   'عادي',
  low:      'منخفض',
  critical: 'حرج',
  high:     'عالي',
};
const TYPE_AR: Record<string, string> = {
  inspection: 'فحص وتفتيش',
  preventive: 'صيانة وقائية',
  corrective: 'صيانة تصحيحية',
  emergency:  'طارئة',
  predictive: 'تنبؤية',
};
const SLA_AR: Record<string, { label: string; color: string }> = {
  on_time:   { label: 'في الوقت',  color: 'text-emerald-400' },
  at_risk:   { label: 'على الحد',  color: 'text-amber-400'   },
  overdue:   { label: 'متأخر',     color: 'text-rose-400'    },
};
const NEXT_STATUS: Record<string, string> = {
  pending:     'in_progress',
  open:        'in_progress',
  in_progress: 'completed',
  on_hold:     'in_progress',
  completed:   'closed',
};
const NEXT_STATUS_AR: Record<string, string> = {
  pending:     'بدء التنفيذ',
  open:        'بدء التنفيذ',
  in_progress: 'تحديد كمكتمل',
  on_hold:     'استئناف',
  completed:   'إغلاق',
};

// ── helpers ───────────────────────────────────────────────────────────────────
function statusColor(s: string) {
  if (s === 'in_progress') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  if (s === 'completed')   return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (s === 'closed')      return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  if (s === 'cancelled')   return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  if (s === 'on_hold')     return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  return 'text-amber-400 bg-amber-500/10 border-amber-500/20'; // pending / open
}
function priorityColor(p: string) {
  if (p === 'urgent' || p === 'critical') return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  if (p === 'high')   return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  if (p === 'normal') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
}
function typeColor(t: string) {
  if (t === 'preventive') return 'text-emerald-400 bg-emerald-500/10';
  if (t === 'inspection') return 'text-sky-400 bg-sky-500/10';
  if (t === 'emergency')  return 'text-red-400 bg-red-500/10';
  if (t === 'predictive') return 'text-violet-400 bg-violet-500/10';
  return 'text-slate-400 bg-slate-500/10';
}
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detailWO, setDetailWO] = useState<WorkOrder | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [showDispatch, setShowDispatch] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'outbound_internal' | 'outbound_external' | 'incoming'>('outbound_internal');
  const [showRoutingRules, setShowRoutingRules] = useState(false);
  const [assigningWO, setAssigningWO] = useState<IncomingWO | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    title_ar: '',
    description: '',
    asset_name: '',
    work_type: 'inspection',
    priority: 'normal',
    target_department: 'maintenance',
    target_team: '',
    assigned_to: '',
    scheduled_date: '',
    notes: '',
    created_by: 'maintenance_dept',
  });

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/v1/workflow/work-orders?tab=${activeTab}&dept=maintenance&limit=200`;
      const res = await fetch(url);
      const data = await res.json();
      const list: WorkOrder[] = Array.isArray(data?.data) ? data.data
        : Array.isArray(data) ? data : [];
      setWorkOrders(list);
    } catch {
      setWorkOrders([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchWorkOrders(); }, [fetchWorkOrders]);

  // ── Status update (PATCH /workflow/work-orders/[id]/status) ─────────────────
  const advanceStatus = async (wo: WorkOrder) => {
    const next = NEXT_STATUS[wo.status];
    if (!next) return;
    setUpdatingId(wo.id);
    try {
      await fetch(`/api/v1/workflow/work-orders/${wo.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      await fetchWorkOrders();
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Create new WO via CMMS ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/workspace/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          title: '', title_ar: '', description: '', asset_name: '',
          work_type: 'inspection', priority: 'normal',
          target_department: 'maintenance', target_team: '',
          assigned_to: '', scheduled_date: '', notes: '', created_by: 'maintenance_dept',
        });
        await fetchWorkOrders();
      }
    } catch { /* silent */ }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = workOrders.filter(wo => {
    const q = searchTerm.toLowerCase();
    const matchQ = !q ||
      wo.title?.toLowerCase().includes(q) ||
      wo.title_ar?.includes(searchTerm) ||
      wo.work_order_number?.includes(searchTerm) ||
      wo.asset_name?.toLowerCase().includes(q) ||
      wo.assigned_team?.includes(searchTerm);
    const matchStatus = !filterStatus || wo.status === filterStatus;
    const matchPriority = !filterPriority || wo.priority === filterPriority;
    return matchQ && matchStatus && matchPriority;
  });

  // ── KPI counts ────────────────────────────────────────────────────────────
  const kpi = {
    total:      workOrders.length,
    pending:    workOrders.filter(w => w.status === 'pending' || w.status === 'open').length,
    inProgress: workOrders.filter(w => w.status === 'in_progress').length,
    completed:  workOrders.filter(w => w.status === 'completed' || w.status === 'closed').length,
    overdue:    workOrders.filter(w => w.sla_state === 'overdue').length,
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-300">بوابة النظام</Link>
          <ChevronLeft className="w-3 h-3" />
          <Link href="/dashboard/admin-gateway/maintenance" className="hover:text-slate-300">الصيانة</Link>
          <ChevronLeft className="w-3 h-3" />
          <Link href="/dashboard/admin-gateway/maintenance/technical" className="hover:text-slate-300">الواجهة الفنية</Link>
          <ChevronLeft className="w-3 h-3" />
          <span className="text-slate-200">أوامر العمل</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
              <Wrench className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">أوامر العمل — CMMS</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                مرتبط بـ نظام إدارة الصيانة المحوسب (CMMS)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRoutingRules(true)}
              title="إعدادات قواعد التوزيع"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition-colors">
              <Settings2 className="w-4 h-4" />
            </button>
            <button onClick={fetchWorkOrders} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDispatch(true)}
              disabled={workOrders.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl flex items-center gap-2 text-sm transition-colors">
              <Send className="w-4 h-4" /> اعتماد وإرسال
            </button>
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center gap-2 text-sm transition-colors">
              <Plus className="w-4 h-4" /> أمر عمل جديد
            </button>
          </div>
        </div>

        {/* ── 3 Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1">
          {([
            { key: 'outbound_internal', label: 'صادرة داخلية',  icon: ArrowUpRight,  desc: 'فرق الصيانة' },
            { key: 'outbound_external', label: 'صادرة خارجية',  icon: ArrowUpRight,  desc: 'إلى التآكل / العمليات' },
            { key: 'incoming',          label: 'واردة',          icon: ArrowDownLeft, desc: 'من التآكل / العمليات' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? tab.key === 'incoming'
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                    : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className="text-xs opacity-60 hidden md:inline">({tab.desc})</span>
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'إجمالي', val: kpi.total, icon: Activity, color: 'text-slate-300' },
            { label: 'معلق / مفتوح', val: kpi.pending, icon: Clock, color: 'text-amber-400' },
            { label: 'قيد التنفيذ', val: kpi.inProgress, icon: Wrench, color: 'text-blue-400' },
            { label: 'مكتمل', val: kpi.completed, icon: CheckCircle, color: 'text-emerald-400' },
            { label: 'متأخر (SLA)', val: kpi.overdue, icon: AlertCircle, color: 'text-rose-400' },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
              <Icon className={`w-5 h-5 shrink-0 ${color}`} />
              <div>
                <div className={`text-xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="بحث بالعنوان، الرقم، الأصل..."
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2 pr-9 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500">
            <option value="">كل الأولويات</option>
            {Object.entries(PRIORITY_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800">
          {loading ? (
            <div className="p-14 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p>جاري التحميل...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-14 text-center">
              <Wrench className="w-14 h-14 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">{searchTerm ? 'لا توجد نتائج' : 'لا توجد أوامر عمل بعد'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/60 text-slate-400 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">رقم الأمر</th>
                    <th className="px-4 py-3 text-right font-medium">العنوان</th>
                    <th className="px-4 py-3 text-right font-medium">الأصل</th>
                    <th className="px-4 py-3 text-right font-medium">النوع</th>
                    <th className="px-4 py-3 text-right font-medium">الأولوية</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium">الفريق</th>
                    <th className="px-4 py-3 text-right font-medium">الموعد</th>
                    <th className="px-4 py-3 text-right font-medium">SLA</th>
                    <th className="px-4 py-3 text-right font-medium">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map(wo => (
                    <tr key={wo.id} className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => setDetailWO(wo)}>
                      <td className="px-4 py-3 font-mono text-slate-400 text-xs whitespace-nowrap">
                        {wo.work_order_number || `WO-${wo.id}`}
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <div className="text-slate-200 font-medium truncate">{wo.title_ar || wo.title}</div>
                        {wo.title_ar && wo.title !== wo.title_ar &&
                          <div className="text-slate-500 text-xs truncate">{wo.title}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{wo.asset_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${typeColor(wo.work_type)}`}>
                          {TYPE_AR[wo.work_type] || wo.work_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${priorityColor(wo.priority)}`}>
                          {PRIORITY_AR[wo.priority] || wo.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {/* Source badge for incoming tab */}
                        {activeTab === 'incoming' && wo.source_dept && (
                          <div className="text-xs text-amber-300/70 mb-1">
                            ↓ وارد من: {wo.source_dept === 'corrosion' ? 'إدارة التآكل' : wo.source_dept}
                          </div>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${statusColor(wo.status)}`}>
                          {STATUS_AR[wo.status] || wo.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {wo.assigned_team ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {wo.assigned_team}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(wo.scheduled_date)}</td>
                      <td className="px-4 py-3">
                        {wo.sla_state ? (
                          <span className={`text-xs font-medium ${SLA_AR[wo.sla_state]?.color || 'text-slate-400'}`}>
                            {SLA_AR[wo.sla_state]?.label || wo.sla_state}
                            {wo.age_hours != null && ` (${Math.round(wo.age_hours)}س)`}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {activeTab === 'incoming' ? (
                          <button
                            onClick={() => setAssigningWO(wo as IncomingWO)}
                            className="px-2 py-1 bg-amber-600/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs hover:bg-amber-600/30 transition-colors whitespace-nowrap flex items-center gap-1">
                            <Users className="w-3 h-3" /> توزيع على فرقة
                          </button>
                        ) : NEXT_STATUS[wo.status] ? (
                          <button
                            onClick={() => advanceStatus(wo)}
                            disabled={updatingId === wo.id}
                            className="px-2 py-1 bg-amber-600/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs hover:bg-amber-600/30 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {updatingId === wo.id ? '...' : NEXT_STATUS_AR[wo.status]}
                          </button>
                        ) : (
                          <span className="text-slate-600 text-xs">مكتمل</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail drawer ── */}
      {detailWO && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-end" onClick={() => setDetailWO(null)}>
          <div className="bg-slate-900 border-l border-slate-700 w-full max-w-md h-full overflow-y-auto p-6 space-y-4"
            dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">تفاصيل أمر العمل</h2>
              <button onClick={() => setDetailWO(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <Row label="رقم الأمر" val={detailWO.work_order_number || `WO-${detailWO.id}`} mono />
              <Row label="العنوان (عربي)" val={detailWO.title_ar || detailWO.title} />
              <Row label="العنوان (إنجليزي)" val={detailWO.title} />
              <Row label="الأصل" val={detailWO.asset_name} />
              <Row label="النوع" val={TYPE_AR[detailWO.work_type] || detailWO.work_type} />
              <Row label="الأولوية" val={PRIORITY_AR[detailWO.priority] || detailWO.priority} />
              <Row label="الحالة" val={STATUS_AR[detailWO.status] || detailWO.status} />
              <Row label="الإدارة المستهدفة" val={detailWO.target_department} />
              <Row label="الفريق المكلف" val={detailWO.assigned_team} />
              <Row label="المنفذ" val={detailWO.assigned_to} />
              <Row label="الموعد المجدول" val={fmtDate(detailWO.scheduled_date)} />
              <Row label="تاريخ البدء" val={fmtDate(detailWO.start_date)} />
              <Row label="تاريخ الإنهاء" val={fmtDate(detailWO.completion_date)} />
              <Row label="حالة SLA" val={SLA_AR[detailWO.sla_state || '']?.label} />
              <Row label="العمر (ساعة)" val={detailWO.age_hours != null ? String(Math.round(detailWO.age_hours)) : undefined} />
              <Row label="التكلفة التقديرية" val={detailWO.estimated_cost != null ? `${detailWO.estimated_cost} د.ل` : undefined} />
              <Row label="التكلفة الفعلية" val={detailWO.actual_cost != null ? `${detailWO.actual_cost} د.ل` : undefined} />
              {detailWO.description && (
                <div>
                  <div className="text-slate-500 text-xs mb-1">الوصف</div>
                  <div className="text-slate-300 bg-slate-800/50 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {detailWO.description}
                  </div>
                </div>
              )}
              {detailWO.notes && (
                <div>
                  <div className="text-slate-500 text-xs mb-1">ملاحظات</div>
                  <div className="text-slate-300 bg-slate-800/50 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {detailWO.notes}
                  </div>
                </div>
              )}
            </div>
            {NEXT_STATUS[detailWO.status] && (
              <button
                onClick={() => { advanceStatus(detailWO); setDetailWO(null); }}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium text-sm transition-colors"
              >
                {NEXT_STATUS_AR[detailWO.status]}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">أمر عمل جديد</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="العنوان (عربي) *" required>
                  <input required value={formData.title_ar}
                    onChange={e => setFormData({ ...formData, title_ar: e.target.value })}
                    className={inputCls} placeholder="وصف العمل بالعربية" />
                </Field>
                <Field label="العنوان (إنجليزي)">
                  <input value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className={inputCls} placeholder="English title" />
                </Field>
              </div>
              <Field label="الوصف التفصيلي">
                <textarea value={formData.description} rows={3}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className={inputCls} placeholder="تفاصيل المهمة..." />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="اسم الأصل">
                  <input value={formData.asset_name}
                    onChange={e => setFormData({ ...formData, asset_name: e.target.value })}
                    className={inputCls} placeholder="مثال: خط أنبوب A-12" />
                </Field>
                <Field label="نوع العمل">
                  <select value={formData.work_type}
                    onChange={e => setFormData({ ...formData, work_type: e.target.value })}
                    className={inputCls}>
                    <option value="inspection">فحص وتفتيش</option>
                    <option value="preventive">صيانة وقائية</option>
                    <option value="corrective">صيانة تصحيحية</option>
                    <option value="emergency">طارئة</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="الأولوية">
                  <select value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className={inputCls}>
                    <option value="low">منخفض</option>
                    <option value="normal">عادي</option>
                    <option value="urgent">عاجل</option>
                  </select>
                </Field>
                <Field label="الإدارة المستهدفة">
                  <select value={formData.target_department}
                    onChange={e => setFormData({ ...formData, target_department: e.target.value })}
                    className={inputCls}>
                    <option value="maintenance">الصيانة</option>
                    <option value="corrosion">التآكل</option>
                    <option value="operations">العمليات</option>
                  </select>
                </Field>
                <Field label="الفريق">
                  <input value={formData.target_team}
                    onChange={e => setFormData({ ...formData, target_team: e.target.value })}
                    className={inputCls} placeholder="اسم الفريق" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="الموعد المجدول">
                  <input type="date" value={formData.scheduled_date}
                    onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className={inputCls} />
                </Field>
                <Field label="المنفذ المكلف">
                  <input value={formData.assigned_to}
                    onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                    className={inputCls} placeholder="اسم الموظف أو الفريق" />
                </Field>
              </div>
              <Field label="ملاحظات">
                <textarea value={formData.notes} rows={2}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className={inputCls} placeholder="ملاحظات إضافية..." />
              </Field>
              <div className="flex gap-3 pt-2">
                <button type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors">
                  إنشاء أمر العمل
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dispatch Modal ── */}
      {showDispatch && (
        <WorkOrderDispatchModal
          workOrders={workOrders.map(w => ({
            id: w.id,
            title: w.title,
            title_ar: w.title_ar,
            work_type: w.work_type,
            priority: w.priority,
            status: w.status,
            department: w.target_department,
            estimated_hours: w.age_hours,
          }))}
          context="maintenance"
          onConfirm={async (config: DispatchConfig) => {
            const BATCH = 5;
            const wos = workOrders;
            if (config.channel === 'cmms' || config.channel === 'all') {
              for (let i = 0; i < wos.length; i += BATCH) {
                await Promise.allSettled(
                  wos.slice(i, i + BATCH).map(wo =>
                    fetch(`/api/v1/workflow/work-orders/${wo.id}/status`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        status: 'dispatched',
                        dispatched_to: config.externalDepts,
                        dispatched_teams: config.internalTeams,
                        notes: 'تم الإرسال عبر CMMS',
                      }),
                    }),
                  ),
                );
              }
            }
            setShowDispatch(false);
            setToastMsg(`✅ أُرسلت ${wos.length} أمر عمل لـ ${config.internalTeams.length + config.externalDepts.length} جهة`);
            setTimeout(() => setToastMsg(''), 4000);
            fetchWorkOrders();
          }}
          onClose={() => setShowDispatch(false)}
        />
      )}

      {/* ── Routing Rules Modal ── */}
      {showRoutingRules && (
        <RoutingRulesModal dept="maintenance" onClose={() => setShowRoutingRules(false)} />
      )}

      {/* ── Assign Incoming WO Modal ── */}
      {assigningWO && (
        <AssignIncomingModal
          workOrder={assigningWO}
          dept="maintenance"
          onConfirm={async (id, team, notes) => {
            await fetch(`/api/v1/workflow/work-orders/${id}/assign`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assigned_team: team, assigned_by: 'maintenance_admin', notes }),
            });
            setAssigningWO(null);
            setToastMsg(`✅ تم توزيع الأمر على ${team}`);
            setTimeout(() => setToastMsg(''), 4000);
            fetchWorkOrders();
          }}
          onClose={() => setAssigningWO(null)}
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

// ── tiny helpers ───────────────────────────────────────────────────────────────
const inputCls = 'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}{required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ label, val, mono }: { label: string; val?: string; mono?: boolean }) {
  if (!val) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-slate-200 text-right ${mono ? 'font-mono' : ''}`}>{val}</span>
    </div>
  );
}
