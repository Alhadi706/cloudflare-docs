'use client';
/**
 * CommandCenterLive
 * ─────────────────────────────────────────────────────────────────────────────
 * Operational dashboard that reflects real-time shared context.
 * Phase C additions:
 *   - Activated departments summary strip (count by status)
 *   - Institution/supervised entities count (from institution_relationships API)
 *   - GIS location badge in context banner
 *   - Pending navigation chip in context banner
 *
 * Reads from:
 *   - operationalContext (project, location, alerts, AI intent, pending counts)
 *   - activatedDepartments store (dept summary)
 *   - ExecutiveDashboard data (project KPIs)
 *   - Backend polls: workflow pending steps + conversation analytics
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MapPin, FolderOpen, Brain, AlertTriangle, CheckCircle2,
  RefreshCw, ArrowRight, Bell, Activity, Clock,
  Building2, Users, LayoutDashboard, Network,
} from 'lucide-react';
import { useOperationalContext } from '@/store/operationalContext';
import { useUserStore } from '@/store/useUserStore';
import { useActivatedDepartments, deptStatusSummary } from '@/store/activatedDepartments';
import ExecutiveDashboard from '@/components/ExecutiveDashboard';

// ── Backend polling helpers ──────────────────────────────────────────────────

async function fetchPendingWorkflowCount(signal?: AbortSignal): Promise<number> {
  try {
    const res = await fetch('/api/v1/workflows/steps/pending?limit=1', { signal });
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data) ? data.length : 0;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    return 0;
  }
}

async function fetchPendingReportCount(signal?: AbortSignal): Promise<number> {
  try {
    const res = await fetch('/api/v1/conversation/analytics', { signal });
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.total_sessions ?? 0;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    return 0;
  }
}

async function fetchSupervisedCount(registryEntityId: string | null, signal?: AbortSignal): Promise<number> {
  if (!registryEntityId) return 0;
  try {
    const res = await fetch(
      `/api/v1/tenants/institution/${registryEntityId}/relationships?type=supervises`,
      { signal }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data) ? data.length : (data?.total ?? 0);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    return 0;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContextBanner() {
  const {
    selected_project_name,
    selected_location,
    last_ai_question,
    pending_navigation,
    clearPendingNavigation,
    entity_type,
  } = useOperationalContext();

  const hasContext = selected_project_name || selected_location || entity_type;
  if (!hasContext && !pending_navigation && !last_ai_question) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center text-sm">
      {entity_type && (
        <span className="flex items-center gap-1.5 bg-slate-700/50 border border-slate-600/40 rounded-lg px-3 py-1.5 text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          {entity_type}
        </span>
      )}
      {selected_project_name && (
        <span className="flex items-center gap-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg px-3 py-1.5 text-indigo-300">
          <FolderOpen className="w-3.5 h-3.5" />
          {selected_project_name}
        </span>
      )}
      {selected_location && (
        <span className="flex items-center gap-1.5 bg-emerald-600/20 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-emerald-300">
          <MapPin className="w-3.5 h-3.5" />
          {selected_location.name ?? `${selected_location.lat.toFixed(4)}, ${selected_location.lon.toFixed(4)}`}
        </span>
      )}
      {last_ai_question && (
        <span className="flex items-center gap-1.5 bg-purple-600/20 border border-purple-500/30 rounded-lg px-3 py-1.5 text-purple-300">
          <Brain className="w-3.5 h-3.5" />
          <span className="truncate max-w-[180px]">{last_ai_question}</span>
        </span>
      )}
      {pending_navigation && (
        <Link
          href={pending_navigation.route}
          onClick={clearPendingNavigation}
          className="flex items-center gap-1.5 bg-yellow-600/20 border border-yellow-500/40 rounded-lg px-3 py-1.5 text-yellow-300 hover:bg-yellow-600/30 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          انتقل إلى: {pending_navigation.labelAr}
        </Link>
      )}
    </div>
  );
}

function AlertsStrip() {
  const { live_alerts } = useOperationalContext();
  if (!live_alerts.length) return null;

  const icon = {
    warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
    error:   <AlertTriangle className="w-4 h-4 text-red-400" />,
    info:    <Bell className="w-4 h-4 text-blue-400" />,
    success: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  };

  return (
    <div className="flex flex-col gap-2 mb-4">
      {live_alerts.slice(0, 3).map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/40 rounded-lg px-4 py-2.5 text-sm"
        >
          {icon[a.type] ?? icon.info}
          <span className="flex-1 text-slate-200">{a.message}</span>
          {a.action_url && (
            <Link href={a.action_url} className="text-blue-400 hover:text-blue-300 text-xs shrink-0">
              تفاصيل
            </Link>
          )}
          <span className="text-slate-500 text-xs">
            {new Date(a.timestamp).toLocaleTimeString('ar-SA')}
          </span>
        </div>
      ))}
    </div>
  );
}

function LiveCounterStrip({ supervisedCount }: { supervisedCount: number }) {
  const { pending_workflow_count, pending_report_count, live_alerts } = useOperationalContext();
  const { departments } = useActivatedDepartments();
  const summary = deptStatusSummary(departments);

  const counters = [
    { label: 'مهام معلقة',       value: pending_workflow_count,                              color: 'text-orange-400', href: '/dashboard/admin-gateway/maintenance', icon: <Clock className="w-4 h-4" /> },
    { label: 'بلاغات نشطة',      value: pending_report_count,                                color: 'text-blue-400',   href: '/dashboard/command-center',            icon: <Activity className="w-4 h-4" /> },
    { label: 'تنبيهات',           value: live_alerts.filter(a => a.type !== 'success').length, color: 'text-yellow-400', href: '#alerts',                              icon: <Bell className="w-4 h-4" /> },
    { label: 'إدارات مفعلة',     value: summary.total,                                       color: 'text-emerald-400', href: '/dashboard/admin-gateway',            icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'جهات مشرف عليها',  value: supervisedCount,                                     color: 'text-cyan-400',   href: '/dashboard/admin-gateway',             icon: <Network className="w-4 h-4" /> },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
      {counters.map((c) => (
        <Link key={c.label} href={c.href} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all group">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            {c.icon}
            <span className="truncate">{c.label}</span>
          </div>
          <div className={`text-2xl font-bold ${c.color} group-hover:scale-105 transition-transform`}>
            {c.value}
          </div>
        </Link>
      ))}
    </div>
  );
}

function DepartmentSummaryStrip() {
  const { departments } = useActivatedDepartments();
  const summary = deptStatusSummary(departments);
  if (summary.total === 0) return null;

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          الإدارات المفعلة
        </h3>
        <Link href="/dashboard/admin-gateway" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          عرض الكل
        </Link>
      </div>
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-slate-400 text-xs">مفعّل:</span>
          <span className="text-green-400 font-bold">{summary.active}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-slate-400 text-xs">قيد التفعيل:</span>
          <span className="text-yellow-400 font-bold">{summary.pending_manager}</span>
        </div>
        {summary.suspended > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-slate-400 text-xs">معلق:</span>
            <span className="text-red-400 font-bold">{summary.suspended}</span>
          </div>
        )}
        <div className="mr-auto flex items-center gap-1.5 text-xs text-slate-500">
          المجموع: {summary.total}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommandCenterLive() {
  const { setPendingCounts, addAlert, registry_entity_id } = useOperationalContext();
  const { current: currentUser } = useUserStore();

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [supervisedCount, setSupervisedCount] = useState(0);
  const previousWorkflowCountRef = useRef<number | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const [wf, rp, sup] = await Promise.all([
        fetchPendingWorkflowCount(signal),
        fetchPendingReportCount(signal),
        fetchSupervisedCount(registry_entity_id, signal),
      ]);
      if (signal?.aborted) {
        return;
      }
      setPendingCounts(wf, rp);
      setSupervisedCount(sup);
      setLastRefresh(new Date());
      const previousWorkflowCount = previousWorkflowCountRef.current;
      if (wf > 0 && wf !== previousWorkflowCount) {
        addAlert({ type: 'warning', message: `${wf} مهمة تنتظر الإنجاز`, source: 'workflow' });
      }
      previousWorkflowCountRef.current = wf;
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        console.error('Command center refresh failed:', err);
      }
    } finally {
      if (!signal?.aborted) {
        setRefreshing(false);
      }
    }
  }, [setPendingCounts, addAlert, registry_entity_id]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    const t = setInterval(() => refresh(controller.signal), 60_000);
    return () => {
      clearInterval(t);
      controller.abort();
    };
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">مركز القيادة التشغيلي</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {currentUser?.full_name_ar || currentUser?.full_name || currentUser?.name || 'المستخدم'} · {currentUser?.role ?? currentUser?.roles?.[0] ?? ''}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg px-3 py-2 text-slate-300 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {lastRefresh.toLocaleTimeString('ar-SA')}
        </button>
      </div>

      {/* Live operational strips */}
      <ContextBanner />
      <AlertsStrip />
      <LiveCounterStrip supervisedCount={supervisedCount} />
      <DepartmentSummaryStrip />

      {/* Full executive dashboard below */}
      <div className="mt-6">
        <ExecutiveDashboard />
      </div>
    </div>
  );
}
