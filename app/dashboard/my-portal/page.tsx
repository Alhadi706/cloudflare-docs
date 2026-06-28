'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UserCircle, Wrench, Calendar, CheckCircle2, Clock, AlertTriangle,
  ChevronLeft, MapPin, ClipboardList, LogOut, RefreshCw, FileText,
  ArrowUpRight, Shield, Activity, Bell, Users,
} from 'lucide-react';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getClientTenantHeaders(),
  };
  return headers;
}

interface WorkOrder {
  id: number;
  work_order_number?: string;
  wo_number?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  wo_type?: string;
  assigned_to?: string;
  scheduled_date?: string;
  created_at?: string;
  asset_name?: string;
  asset_location?: string;
}

interface LeaveRequest {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  days_requested?: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'مفتوح',        color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30' },
  pending:     { label: 'معلّق',         color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30' },
  in_progress: { label: 'جارٍ التنفيذ', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
  completed:   { label: 'مكتمل',        color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30' },
  closed:      { label: 'مغلق',         color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/30' },
  cancelled:   { label: 'ملغى',         color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
  approved:    { label: 'معتمد',        color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30' },
  rejected:    { label: 'مرفوض',        color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  critical:  { label: '🔴 حرج',    color: 'text-red-400' },
  high:      { label: '🟠 عالية',  color: 'text-orange-400' },
  normal:    { label: '🟡 عادية',  color: 'text-yellow-400' },
  medium:    { label: '🟡 متوسطة', color: 'text-yellow-400' },
  low:       { label: '🟢 منخفضة', color: 'text-green-400' },
};

function Badge({ status }: { status: string }) {
  const s = STATUS_LABELS[status?.toLowerCase()] ?? { label: status, color: 'text-slate-400', bg: 'bg-slate-700/40 border-slate-600' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.color} ${s.bg}`}>
      {s.label}
    </span>
  );
}

export default function MyPortalPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'work-orders' | 'leaves' | 'profile'>('overview');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [woRes, leaveRes] = await Promise.allSettled([
        fetch('/api/v1/workspace/work-orders?limit=50', { headers: getHeaders() }),
        fetch('/api/v1/hr/leave-requests?limit=20', { headers: getHeaders() }),
      ]);

      if (woRes.status === 'fulfilled' && woRes.value.ok) {
        const d = await woRes.value.json();
        const list: WorkOrder[] = Array.isArray(d) ? d : Array.isArray(d?.work_orders) ? d.work_orders : Array.isArray(d?.data) ? d.data : [];
        setWorkOrders(list);
      }
      if (leaveRes.status === 'fulfilled' && leaveRes.value.ok) {
        const d = await leaveRes.value.json();
        const list: LeaveRequest[] = Array.isArray(d) ? d : Array.isArray(d?.leave_requests) ? d.leave_requests : Array.isArray(d?.data) ? d.data : [];
        setLeaveRequests(list);
      }
    } catch {
      // silent — show whatever loaded
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/v1/workspace/work-orders/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setWorkOrders((prev) => prev.map((wo) => wo.id === id ? { ...wo, status: newStatus } : wo));
      }
    } catch { /* noop */ } finally {
      setUpdatingId(null);
    }
  };

  const myOrders   = workOrders; // TODO: filter by current employee once auth links to employee_id
  const openOrders = myOrders.filter((w) => !['completed', 'closed', 'cancelled'].includes(w.status?.toLowerCase()));
  const doneOrders = myOrders.filter((w) => ['completed', 'closed'].includes(w.status?.toLowerCase()));
  const urgentOrders = openOrders.filter((w) => ['critical', 'high'].includes(w.priority?.toLowerCase()));

  const tabs = [
    { id: 'overview',     label: 'نظرة عامة',      icon: Activity },
    { id: 'work-orders',  label: 'أوامر العمل',    icon: ClipboardList },
    { id: 'leaves',       label: 'الإجازات',        icon: Calendar },
    { id: 'profile',      label: 'ملفي الشخصي',   icon: UserCircle },
  ] as const;

  return (
    <div dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_30%),linear-gradient(135deg,#020617,#0f172a)] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30">
              <UserCircle className="h-8 w-8 text-amber-300" />
            </div>
            <div>
              <p className="text-xs text-amber-300 font-semibold">بوابة الموظف — أوامري</p>
              <h1 className="text-xl font-black text-white">لوحتي الشخصية</h1>
              <p className="text-xs text-slate-400">المهام · الإجازات · أوامر العمل</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>
            <Link href="/m"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all">
              📱 الجوّال
            </Link>
            <Link href="/dashboard"
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all">
              <ChevronLeft className="h-3.5 w-3.5" /> الرئيسية
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-1.5 backdrop-blur-xl">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
                  activeTab === t.id
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                <Icon className="h-4 w-4" />{t.label}
              </button>
            );
          })}
        </div>

        {/* ── Overview ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'أوامر مفتوحة',  value: openOrders.length,    color: 'border-amber-500/30 text-amber-400',   icon: Clock },
                { label: 'عاجلة',          value: urgentOrders.length,  color: 'border-red-500/30 text-red-400',       icon: AlertTriangle },
                { label: 'مكتملة',         value: doneOrders.length,    color: 'border-green-500/30 text-green-400',   icon: CheckCircle2 },
                { label: 'إجازات معلّقة',  value: leaveRequests.filter((l) => l.status === 'pending').length, color: 'border-blue-500/30 text-blue-400', icon: Calendar },
              ].map((k) => {
                const Icon = k.icon;
                return (
                  <div key={k.label} className={`rounded-2xl border bg-slate-900/60 p-4 text-center ${k.color.split(' ')[0]}`}>
                    <Icon className={`mx-auto mb-2 h-5 w-5 ${k.color.split(' ')[1]}`} />
                    <p className={`text-3xl font-black ${k.color.split(' ')[1]}`}>{k.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{k.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Urgent orders */}
            {urgentOrders.length > 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-red-300">
                  <AlertTriangle className="h-4 w-4" /> أوامر عاجلة تحتاج اهتمامك
                </p>
                <div className="space-y-2">
                  {urgentOrders.slice(0, 3).map((wo) => (
                    <div key={wo.id} className="flex items-center justify-between gap-3 rounded-xl border border-red-500/10 bg-slate-900/50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{wo.title}</p>
                        <p className="text-xs text-slate-400">{wo.wo_number || wo.work_order_number || `#${wo.id}`}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge status={wo.status} />
                        {wo.status !== 'in_progress' && (
                          <button onClick={() => updateStatus(wo.id, 'in_progress')} disabled={updatingId === wo.id}
                            className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-all disabled:opacity-50">
                            {updatingId === wo.id ? '...' : 'ابدأ'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {[
                { label: 'طلب إجازة',         href: '/dashboard/admin-gateway/hr/attendance',   icon: Calendar,      color: 'border-blue-500/30 text-blue-300 bg-blue-500/10' },
                { label: 'أوامر العمل',        href: '/dashboard/admin-gateway/maintenance/work-orders', icon: Wrench, color: 'border-orange-500/30 text-orange-300 bg-orange-500/10' },
                { label: 'التقارير',           href: '/dashboard/admin-gateway/reports',          icon: FileText,     color: 'border-violet-500/30 text-violet-300 bg-violet-500/10' },
                { label: 'إدارة التآكل',       href: '/dashboard/admin-gateway/corrosion',        icon: Shield,       color: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10' },
                { label: 'واجهة الجوّال',      href: '/m',                                        icon: Activity,     color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' },
                { label: 'الإشعارات',          href: '/dashboard/admin-gateway/notifications',    icon: Bell,         color: 'border-slate-500/30 text-slate-300 bg-slate-500/10' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 rounded-2xl border p-4 font-bold text-sm transition-all hover:opacity-80 ${item.color}`}>
                    <Icon className="h-5 w-5 shrink-0" /> {item.label}
                    <ArrowUpRight className="ml-auto h-4 w-4" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Work Orders ───────────────────────────────────────────────── */}
        {activeTab === 'work-orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-slate-300">{myOrders.length} أمر عمل</p>
              <Link href="/dashboard/admin-gateway/maintenance/work-orders"
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all">
                عرض الكل <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">جارٍ التحميل...</div>
            ) : myOrders.length === 0 ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/50 py-12 text-center">
                <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                <p className="text-slate-400">لا توجد أوامر عمل مخصصة لك</p>
              </div>
            ) : (
              myOrders.map((wo) => {
                const priority = PRIORITY_LABELS[wo.priority?.toLowerCase()] ?? { label: wo.priority, color: 'text-slate-400' };
                return (
                  <div key={wo.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 hover:border-slate-600 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-500 font-mono">{wo.wo_number || wo.work_order_number || `#${wo.id}`}</span>
                          <span className={`text-xs font-semibold ${priority.color}`}>{priority.label}</span>
                        </div>
                        <p className="font-bold text-white truncate">{wo.title}</p>
                        {wo.description && <p className="mt-1 text-xs text-slate-400 line-clamp-1">{wo.description}</p>}
                        {wo.asset_location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="h-3 w-3" /> {wo.asset_location}
                          </p>
                        )}
                      </div>
                      <Badge status={wo.status} />
                    </div>
                    {/* Action buttons */}
                    {!['completed', 'closed', 'cancelled'].includes(wo.status?.toLowerCase()) && (
                      <div className="mt-3 flex gap-2 pt-3 border-t border-slate-800">
                        {wo.status !== 'in_progress' && (
                          <button onClick={() => updateStatus(wo.id, 'in_progress')} disabled={updatingId === wo.id}
                            className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-all disabled:opacity-50">
                            <Clock className="h-3.5 w-3.5" /> {updatingId === wo.id ? '...' : 'بدء التنفيذ'}
                          </button>
                        )}
                        {wo.status === 'in_progress' && (
                          <button onClick={() => updateStatus(wo.id, 'completed')} disabled={updatingId === wo.id}
                            className="flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/20 transition-all disabled:opacity-50">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {updatingId === wo.id ? '...' : 'إغلاق وإنجاز'}
                          </button>
                        )}
                        <Link href="/m"
                          className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all">
                          📍 الموقع على الجوّال
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Leave Requests ───────────────────────────────────────────── */}
        {activeTab === 'leaves' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-300">{leaveRequests.length} طلب إجازة</p>
              <Link href="/dashboard/admin-gateway/hr/attendance"
                className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-all">
                + طلب جديد <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">جارٍ التحميل...</div>
            ) : leaveRequests.length === 0 ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/50 py-12 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                <p className="text-slate-400">لا توجد طلبات إجازة</p>
              </div>
            ) : (
              leaveRequests.map((lr) => (
                <div key={lr.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
                  <div>
                    <p className="font-bold text-white">{lr.leave_type}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(lr.start_date).toLocaleDateString('ar-SA')} — {new Date(lr.end_date).toLocaleDateString('ar-SA')}
                      {lr.days_requested && ` · ${lr.days_requested} أيام`}
                    </p>
                  </div>
                  <Badge status={lr.status} />
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Profile ─────────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
              <div className="flex items-center gap-5 mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30">
                  <UserCircle className="h-12 w-12 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">الموظف</h2>
                  <p className="text-sm text-slate-400">لم يتم ربط حساب موظف بعد</p>
                  <p className="mt-1 text-xs text-amber-400/80">
                    يتطلب ربط حساب الدخول مع سجل الموظف في الشؤون الإدارية
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-sm text-amber-200">
                <p className="font-bold mb-2">⚠️ خطوة مطلوبة لاكتمال الدورة</p>
                <p className="text-xs text-slate-300 leading-6">
                  لربط هذه الصفحة بأوامر العمل المخصصة لك شخصياً، يحتاج مدير الشؤون الإدارية إلى:
                </p>
                <ol className="mt-2 text-xs text-slate-400 space-y-1 list-decimal list-inside">
                  <li>إدخال بيانات الموظفين مع أرقام هواتفهم</li>
                  <li>تحديد رقم الموظف في إعدادات حساب الدخول</li>
                  <li>ستظهر هنا أوامرك وإجازاتك تلقائياً</li>
                </ol>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link href="/dashboard/admin-gateway/hr/employees"
                  className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-3 text-sm font-bold text-blue-200 hover:bg-blue-500/20 transition-all">
                  <Users className="h-4 w-4" /> ملف الموظفين
                </Link>
                <Link href="/m"
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-bold text-emerald-200 hover:bg-emerald-500/20 transition-all">
                  📱 واجهة الجوّال
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


