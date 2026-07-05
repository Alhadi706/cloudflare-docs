'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, BarChart2, TrendingUp, TrendingDown, Activity,
  Briefcase, CheckCircle, Clock, AlertTriangle, DollarSign, Users,
  Target, Calendar, FileText, RefreshCw, ChevronLeft,
} from 'lucide-react';

function getHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'x-tenant-id': tenantId } : {};
}

interface DashStats {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  delayed_projects: number;
  avg_progress: number;
  total_budget: number;
  spent_budget: number;
  pending_tasks: number;
  overdue_tasks: number;
}

const DEFAULT_STATS: DashStats = {
  total_projects: 0, active_projects: 0, completed_projects: 0, delayed_projects: 0,
  avg_progress: 0, total_budget: 0, spent_budget: 0, pending_tasks: 0, overdue_tasks: 0,
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}ك`;
  return String(n);
}

export default function ProjectsDashboardPage() {
  const [stats, setStats] = useState<DashStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  function load() {
    setLoading(true);
    fetch('/api/v1/dept-admin/projects/dashboard-stats', { headers: getHeaders() })
      .then((r) => r.json())
      .then((d) => setStats({ ...DEFAULT_STATS, ...d }))
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setLastRefresh(new Date());
      });
  }

  useEffect(() => { load(); }, []);

  const budgetPct = stats.total_budget > 0
    ? Math.min(100, Math.round((stats.spent_budget / stats.total_budget) * 100))
    : 0;

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col" dir="rtl">
      <div className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full px-4 py-4 gap-4 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <Link
              href="/dashboard/admin-gateway/projects"
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-1"
            >
              <ArrowRight className="w-4 h-4" />
              إدارة المشاريع
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">لوحة القيادة التنفيذية</h1>
            <p className="text-slate-400 text-xs mt-0.5">Executive Dashboard — Projects Management</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          {[
            { label: 'مشاريع نشطة', value: stats.active_projects, icon: Briefcase, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
            { label: 'مكتملة', value: stats.completed_projects, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'متأخرة', value: stats.delayed_projects, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
            { label: 'متوسط الإنجاز', value: `${stats.avg_progress}%`, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          ].map((kpi) => {
            const K = kpi.icon;
            return (
              <div key={kpi.label} className={`bg-slate-900 border ${kpi.border} rounded-2xl p-4`}>
                <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
                  <K className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{kpi.label}</p>
              </div>
            );
          })}
        </div>

        {/* Budget + Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">

          {/* Budget card */}
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white">الميزانية والصرف</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">الميزانية الإجمالية</span>
                <span className="text-amber-300 font-semibold">{fmt(stats.total_budget)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">المصروف الفعلي</span>
                <span className="text-white font-semibold">{fmt(stats.spent_budget)}</span>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">نسبة الصرف</span>
                  <span className={`font-bold ${budgetPct > 90 ? 'text-red-400' : budgetPct > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {budgetPct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${budgetPct > 90 ? 'bg-red-500' : budgetPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tasks card */}
          <div className="bg-slate-900 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="text-sm font-bold text-white">المهام والتسليمات</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs">المهام المعلقة</span>
                <span className="text-blue-300 font-bold text-lg">{stats.pending_tasks}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs">مهام متأخرة</span>
                <span className={`font-bold text-lg ${stats.overdue_tasks > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {stats.overdue_tasks}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs">إجمالي المشاريع</span>
                <span className="text-slate-300 font-bold text-lg">{stats.total_projects}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="shrink-0">
          <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">وصول سريع</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { href: '/dashboard/admin-gateway/projects/list', icon: Briefcase, label: 'قائمة المشاريع', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
              { href: '/dashboard/admin-gateway/projects/tasks', icon: CheckCircle, label: 'المهام', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
              { href: '/dashboard/admin-gateway/projects/milestones', icon: Target, label: 'المعالم', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
              { href: '/dashboard/admin-gateway/projects/budget', icon: DollarSign, label: 'الميزانية', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
              { href: '/dashboard/admin-gateway/projects/correspondence', icon: FileText, label: 'المراسلات', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
              { href: '/dashboard/admin-gateway/projects/map', icon: Target, label: 'الخرائط', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
            ].map((item) => {
              const I = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 bg-slate-900 border ${item.border} rounded-xl px-3 py-2.5 hover:bg-slate-800/60 transition-all`}
                >
                  <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
                    <I className={`w-3.5 h-3.5 ${item.color}`} />
                  </div>
                  <span className="text-xs font-medium text-slate-300">{item.label}</span>
                  <ChevronLeft className="w-3 h-3 text-slate-600 mr-auto" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Last updated */}
        <div className="shrink-0 text-center text-xs text-slate-600">
          آخر تحديث: {lastRefresh.toLocaleTimeString('ar-LY')}
        </div>
      </div>
    </div>
  );
}

