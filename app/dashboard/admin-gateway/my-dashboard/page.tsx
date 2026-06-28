'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  User, Bell, CheckSquare, Zap, Clock, AlertTriangle, TrendingUp,
  FileText, ShoppingCart, Wrench, Briefcase, DollarSign, Users,
  BarChart3, ArrowLeft, RefreshCw, CheckCircle, XCircle,
} from 'lucide-react';
import { useUserStore, getUserAuthHeaders, WorkspaceRole } from '@/store/useUserStore';

// ─── Role classification ─────────────────────────────────────────────────────

type RoleGroup = 'executive' | 'manager' | 'employee';

function getRoleGroup(role: WorkspaceRole): RoleGroup {
  if (role === 'super_admin') return 'executive';
  if (role === 'project_admin' || role === 'site_manager') return 'manager';
  return 'employee';
}

const ROLE_LABEL: Record<RoleGroup, string> = {
  executive: 'تنفيذي',
  manager: 'مدير قسم',
  employee: 'موظف',
};

const ROLE_COLOR: Record<RoleGroup, string> = {
  executive: 'text-amber-400 bg-amber-900/30 border-amber-500/40',
  manager: 'text-blue-400 bg-blue-900/30 border-blue-500/40',
  employee: 'text-emerald-400 bg-emerald-900/30 border-emerald-500/40',
};

// ─── Quick actions per role group ────────────────────────────────────────────

const QUICK_ACTIONS: Record<RoleGroup, { label: string; icon: React.ReactNode; href: string; color: string }[]> = {
  executive: [
    { label: 'التقارير التنفيذية',   icon: <BarChart3 className="w-5 h-5" />,    href: '/dashboard/admin-gateway/reports/executive',  color: 'border-amber-500/40 text-amber-400 bg-amber-900/20' },
    { label: 'مراقبة تنفيذ المشاريع', icon: <TrendingUp className="w-5 h-5" />, href: '/dashboard/admin-gateway/project-control',     color: 'border-cyan-500/40 text-cyan-400 bg-cyan-900/20' },
    { label: 'الميزانية والمصروفات',  icon: <DollarSign className="w-5 h-5" />,  href: '/dashboard/admin-gateway/finance/budgets',     color: 'border-green-500/40 text-green-400 bg-green-900/20' },
    { label: 'الموافقات المعلقة',    icon: <CheckSquare className="w-5 h-5" />, href: '/dashboard/admin-gateway/workflow/approvals',  color: 'border-violet-500/40 text-violet-400 bg-violet-900/20' },
    { label: 'إدارة الموارد البشرية', icon: <Users className="w-5 h-5" />,       href: '/dashboard/admin-gateway/hr/employees',        color: 'border-blue-500/40 text-blue-400 bg-blue-900/20' },
    { label: 'منصة الذكاء الرقمي',  icon: <Zap className="w-5 h-5" />,          href: '/dashboard/admin-gateway/platform-intelligence', color: 'border-fuchsia-500/40 text-fuchsia-400 bg-fuchsia-900/20' },
  ],
  manager: [
    { label: 'اعتماد الطلبات',       icon: <CheckSquare className="w-5 h-5" />, href: '/dashboard/admin-gateway/workflow/approvals',  color: 'border-violet-500/40 text-violet-400 bg-violet-900/20' },
    { label: 'قائمة المشاريع',       icon: <Briefcase className="w-5 h-5" />,   href: '/dashboard/admin-gateway/projects/list',       color: 'border-purple-500/40 text-purple-400 bg-purple-900/20' },
    { label: 'أوامر العمل',          icon: <Wrench className="w-5 h-5" />,       href: '/dashboard/admin-gateway/maintenance/work-orders', color: 'border-rose-500/40 text-rose-400 bg-rose-900/20' },
    { label: 'طلبات المشتريات',      icon: <ShoppingCart className="w-5 h-5" />, href: '/dashboard/admin-gateway/procurement/requests', color: 'border-orange-500/40 text-orange-400 bg-orange-900/20' },
    { label: 'تقارير العمليات',      icon: <BarChart3 className="w-5 h-5" />,    href: '/dashboard/admin-gateway/reports/operations',  color: 'border-cyan-500/40 text-cyan-400 bg-cyan-900/20' },
    { label: 'الاتصالات الإدارية',   icon: <FileText className="w-5 h-5" />,     href: '/dashboard/admin-gateway/correspondence/incoming', color: 'border-sky-500/40 text-sky-400 bg-sky-900/20' },
  ],
  employee: [
    { label: 'طلباتي',               icon: <FileText className="w-5 h-5" />,     href: '/dashboard/admin-gateway/workflow/requests',   color: 'border-blue-500/40 text-blue-400 bg-blue-900/20' },
    { label: 'طلب إجازة',            icon: <Clock className="w-5 h-5" />,         href: '/dashboard/admin-gateway/hr/leave-management', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-900/20' },
    { label: 'الاتصالات الإدارية',   icon: <FileText className="w-5 h-5" />,     href: '/dashboard/admin-gateway/correspondence/incoming', color: 'border-sky-500/40 text-sky-400 bg-sky-900/20' },
    { label: 'أوامر العمل',          icon: <Wrench className="w-5 h-5" />,        href: '/dashboard/admin-gateway/maintenance/work-orders', color: 'border-rose-500/40 text-rose-400 bg-rose-900/20' },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalItem {
  id: string;
  entity_type: string;
  title: string;
  status: string;
  created_at?: string;
  requester_name?: string;
}

interface RequestItem {
  id: string;
  entity_type: string;
  title: string;
  status: string;
  current_level?: number;
  created_at?: string;
}

interface WorkflowSummary {
  totals?: { pending?: number; approved?: number; rejected?: number; total?: number };
  by_entity_type?: { entity_type: string; total: number; pending: number }[];
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) {
  return (
    <div className={`bg-slate-900 border rounded-xl p-4 flex items-center gap-3 ${color}`}>
      <span>{icon}</span>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: 'قيد الانتظار', cls: 'text-amber-400 bg-amber-900/30',  icon: <Clock className="w-3 h-3" /> },
  approved:  { label: 'معتمد',        cls: 'text-green-400 bg-green-900/30',  icon: <CheckCircle className="w-3 h-3" /> },
  rejected:  { label: 'مرفوض',       cls: 'text-red-400 bg-red-900/30',      icon: <XCircle className="w-3 h-3" /> },
  in_review: { label: 'قيد المراجعة', cls: 'text-blue-400 bg-blue-900/30',   icon: <RefreshCw className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'text-slate-400 bg-slate-800', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function MyDashboard() {
  const currentUser = useUserStore((s) => s.current);
  const currentRole: WorkspaceRole = (currentUser?.role as WorkspaceRole) ?? 'employee';
  const roleGroup = getRoleGroup(currentRole);

  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [myRequests, setMyRequests] = useState<RequestItem[]>([]);
  const [summary, setSummary] = useState<WorkflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const headers = getUserAuthHeaders();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, pendingRes, requestsRes] = await Promise.allSettled([
        fetch('/api/v1/approval/summary', { headers }),
        fetch('/api/v1/approval/requests/pending', { headers }),
        fetch('/api/v1/approval/requests?limit=10', { headers }),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const d = await summaryRes.value.json();
        // approval/summary returns {totals:{total,pending,approved,...}}
        setSummary({ totals: d.totals, by_entity_type: d.by_entity_type });
      }
      if (pendingRes.status === 'fulfilled' && pendingRes.value.ok) {
        const d = await pendingRes.value.json();
        setApprovals(d.pending || []);
      }
      if (requestsRes.status === 'fulfilled' && requestsRes.value.ok) {
        const d = await requestsRes.value.json();
        setMyRequests(Array.isArray(d) ? d : (d.requests || []));
      }
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [headers]);

  useEffect(() => { loadData(); }, [loadData]);

  const pendingCount = approvals.length;
  const totals = summary?.totals ?? {};

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 p-3 rounded-xl">
              <User className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">{currentUser?.name ?? 'مستخدم النظام'}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ROLE_COLOR[roleGroup]}`}>
                  {ROLE_LABEL[roleGroup]}
                </span>
                <span className="text-xs text-slate-500 font-mono">{currentRole}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">
              آخر تحديث: {lastRefresh.toLocaleTimeString('ar')}
            </span>
            <button
              onClick={loadData}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/dashboard/admin-gateway"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              بوابة النظام
            </Link>
          </div>
        </div>

        {/* ── Stats bar (managers & executives) ── */}
        {roleGroup !== 'employee' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="موافقات معلقة"
              value={pendingCount}
              color={pendingCount > 0 ? 'border-amber-500/40' : 'border-slate-700'}
              icon={<AlertTriangle className={`w-6 h-6 ${pendingCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />}
            />
            <StatCard
              label="إجمالي الطلبات"
              value={totals.total ?? 0}
              color="border-slate-700"
              icon={<FileText className="w-6 h-6 text-slate-400" />}
            />
            <StatCard
              label="معتمدة"
              value={totals.approved ?? 0}
              color="border-green-500/30"
              icon={<CheckCircle className="w-6 h-6 text-green-400" />}
            />
            <StatCard
              label="مرفوضة"
              value={totals.rejected ?? 0}
              color="border-red-500/30"
              icon={<XCircle className="w-6 h-6 text-red-400" />}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Quick Actions ── */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> الإجراءات السريعة
            </h2>
            <div className="space-y-2">
              {QUICK_ACTIONS[roleGroup].map((action, i) => (
                <Link
                  key={i}
                  href={action.href}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${action.color} hover:brightness-110 transition-all`}
                >
                  {action.icon}
                  <span className="text-sm font-medium">{action.label}</span>
                  <ArrowLeft className="w-4 h-4 mr-auto opacity-40 rotate-180" />
                </Link>
              ))}
            </div>
          </div>

          {/* ── Pending Approvals (manager/executive) OR My Requests (employee) ── */}
          <div className="lg:col-span-2 space-y-6">

            {roleGroup !== 'employee' ? (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-violet-400" />
                    الموافقات المعلقة
                    {pendingCount > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-500/40">
                        {pendingCount}
                      </span>
                    )}
                  </h2>
                  <Link href="/dashboard/admin-gateway/workflow/approvals" className="text-xs text-slate-500 hover:text-slate-300">
                    عرض الكل ←
                  </Link>
                </div>

                {loading ? (
                  <div className="py-8 text-center text-slate-500 text-sm">جاري التحميل...</div>
                ) : approvals.length === 0 ? (
                  <div className="py-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
                    <CheckCircle className="w-10 h-10 text-green-500/40 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">لا توجد موافقات معلقة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvals.slice(0, 6).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3 transition-colors">
                        <div className="shrink-0 w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                          <FileText className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">
                            {item.title || `طلب #${item.id}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.entity_type}
                            {item.requester_name && ` — ${item.requester_name}`}
                            {item.created_at && ` — ${new Date(item.created_at).toLocaleDateString('ar')}`}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    ))}
                    {approvals.length > 6 && (
                      <Link
                        href="/dashboard/admin-gateway/workflow/approvals"
                        className="block text-center py-2 text-xs text-slate-500 hover:text-slate-300 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
                      >
                        و {approvals.length - 6} طلب إضافي...
                      </Link>
                    )}
                  </div>
                )}
              </section>
            ) : null}

            {/* ── My Requests / My Tasks ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  {roleGroup === 'employee' ? 'طلباتي وأنشطتي' : 'آخر الطلبات المقدمة'}
                </h2>
                <Link href="/dashboard/admin-gateway/workflow/requests" className="text-xs text-slate-500 hover:text-slate-300">
                  عرض الكل ←
                </Link>
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-500 text-sm">جاري التحميل...</div>
              ) : myRequests.length === 0 ? (
                <div className="py-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">لا توجد طلبات حديثة</p>
                  <Link
                    href="/dashboard/admin-gateway/workflow/requests"
                    className="mt-3 inline-block text-xs px-4 py-2 bg-blue-700/30 text-blue-400 border border-blue-500/40 rounded-lg hover:bg-blue-700/50 transition-colors"
                  >
                    تقديم طلب جديد
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {myRequests.slice(0, 6).map((req) => (
                    <div key={req.id} className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3 transition-colors">
                      <div className="shrink-0 w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {req.title || `طلب #${req.id}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {req.entity_type}
                          {req.current_level !== undefined && ` — المرحلة ${req.current_level}`}
                          {req.created_at && ` — ${new Date(req.created_at).toLocaleDateString('ar')}`}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Notifications shortcut ── */}
            <Link
              href="/dashboard/admin-gateway/notifications"
              className="flex items-center gap-3 p-4 bg-slate-900/40 border border-violet-500/30 hover:border-violet-500/60 rounded-xl transition-colors group"
            >
              <div className="bg-violet-900/30 p-2 rounded-lg">
                <Bell className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">مركز الإشعارات</p>
                <p className="text-xs text-slate-500">التنبيهات العاجلة والمهام المعلقة</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-violet-400 mr-auto rotate-180 transition-colors" />
            </Link>

          </div>
        </div>
      </div>
    </div>
  );
}
