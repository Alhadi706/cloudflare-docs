'use client';
/**
 * Generic Department Shell
 * ────────────────────────────────────────────────────────────────────────────
 * Renders for any activated department that does not have a dedicated page.
 * Route: /dashboard/departments/[departmentCode]
 *
 * Shows:
 *  - Department name + category badge
 *  - Manager status (assigned / pending)
 *  - Pending tasks count (from workflow pending endpoint)
 *  - Quick action links: AI assistant, Command Center, Admin Gateway
 *  - Related info from operationalContext
 *
 * For departments WITH a dedicated page (frontend_route set in catalog),
 * the sidebar link goes directly there and this shell never renders.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Clock, Bot, Activity, ArrowLeft,
  Building2, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useActivatedDepartments, type ActivatedDept } from '@/store/activatedDepartments';
import { useOperationalContext } from '@/store/operationalContext';

// ── Pending task count (lightweight poll once) ─────────────────────────────

async function fetchPendingCount(): Promise<number> {
  try {
    const res = await fetch('/api/v1/workflows/steps/pending?limit=10');
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

// ── Category badge colors ──────────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, string> = {
  administrative: 'bg-blue-900/40 text-blue-300 border-blue-500/30',
  financial:      'bg-green-900/40 text-green-300 border-green-500/30',
  technical:      'bg-yellow-900/40 text-yellow-300 border-yellow-500/30',
  legal:          'bg-red-900/40 text-red-300 border-red-500/30',
  social:         'bg-emerald-900/40 text-emerald-300 border-emerald-500/30',
  hr:             'bg-teal-900/40 text-teal-300 border-teal-500/30',
  it:             'bg-indigo-900/40 text-indigo-300 border-indigo-500/30',
  oversight:      'bg-rose-900/40 text-rose-300 border-rose-500/30',
  operational:    'bg-orange-900/40 text-orange-300 border-orange-500/30',
  strategic:      'bg-purple-900/40 text-purple-300 border-purple-500/30',
};

const CATEGORY_AR: Record<string, string> = {
  administrative: 'إداري', financial: 'مالي', technical: 'فني',
  legal: 'قانوني', social: 'اجتماعي', hr: 'موارد بشرية',
  it: 'تقنية معلومات', oversight: 'رقابي', operational: 'تشغيلي',
  strategic: 'استراتيجي',
};

// ── Main page ──────────────────────────────────────────────────────────────

export default function GenericDepartmentShell() {
  const params = useParams();
  // departmentCode from URL is the code without "DEPT_" prefix, lowercased
  const codeParam = (params?.departmentCode as string ?? '').toUpperCase();
  const fullCode = `DEPT_${codeParam}`;

  const { departments } = useActivatedDepartments();
  const { pending_workflow_count } = useOperationalContext();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const dept: ActivatedDept | undefined = useMemo(
    () => departments.find(
      (d) => d.department_code === fullCode || d.department_code.toLowerCase() === `dept_${codeParam.toLowerCase()}`
    ),
    [departments, fullCode, codeParam]
  );

  useEffect(() => {
    fetchPendingCount().then((n) => { setPendingCount(n); setLoaded(true); });
  }, []);

  // Case 1: department not found in activated list
  if (departments.length > 0 && !dept) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-center p-8">
        <AlertTriangle className="w-12 h-12 text-yellow-400" />
        <h2 className="text-xl font-bold text-white">هذه الإدارة غير مفعلة</h2>
        <p className="text-slate-400 max-w-sm">
          الإدارة <code className="text-yellow-300">{fullCode}</code> غير مفعلة لهذه المنشأة.
          تحقق من قائمة الإدارات المفعلة.
        </p>
        <Link href="/dashboard/admin-gateway" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          العودة لبوابة الإدارة
        </Link>
      </div>
    );
  }

  // Case 2: still loading (departments store is loading)
  if (!dept && departments.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
          <div className="h-8 bg-slate-800 rounded-xl w-1/2" />
          <div className="h-4 bg-slate-800 rounded-xl w-1/3" />
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-slate-800 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const displayName = dept!.custom_name_ar ?? dept!.name_ar;
  const badgeClass = CATEGORY_BADGE[dept!.category] ?? 'bg-slate-700 text-slate-300 border-slate-600';

  return (
    <div className="min-h-screen bg-slate-950 p-6" dir="rtl">
      {/* Back + breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/admin-gateway" className="hover:text-slate-300 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          بوابة الإدارة
        </Link>
        <span>/</span>
        <span className="text-slate-300">{displayName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
          style={{ backgroundColor: dept!.ui_color + '33', border: `1px solid ${dept!.ui_color}55` }}
        >
          <Building2 className="w-7 h-7" style={{ color: dept!.ui_color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${badgeClass}`}>
              {CATEGORY_AR[dept!.category] ?? dept!.category}
            </span>
          </div>
          {dept!.name_en && (
            <p className="text-slate-400 text-sm mt-1">{dept!.name_en}</p>
          )}
          {dept!.department_code && (
            <code className="text-xs text-slate-600 mt-1 block">{dept!.department_code}</code>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Manager status */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
            <Users className="w-4 h-4" />
            <span>المدير المسؤول</span>
          </div>
          {dept!.manager_user_id ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-white font-medium text-sm truncate">{dept!.manager_user_id}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className="text-yellow-400 text-sm">في انتظار التعيين</span>
            </div>
          )}
        </div>

        {/* Pending tasks */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
            <Clock className="w-4 h-4" />
            <span>المهام المعلقة</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">
            {loaded ? (pendingCount ?? pending_workflow_count) : '—'}
          </div>
        </div>

        {/* Activation status */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
            <LayoutDashboard className="w-4 h-4" />
            <span>حالة التفعيل</span>
          </div>
          <div className={`text-sm font-medium ${dept!.status === 'active' ? 'text-green-400' : dept!.status === 'pending_manager' ? 'text-yellow-400' : 'text-red-400'}`}>
            {dept!.status === 'active' ? 'مفعّل' : dept!.status === 'pending_manager' ? 'قيد التفعيل' : 'معلق'}
          </div>
          {dept!.is_mandatory && (
            <div className="text-xs text-slate-500 mt-1">إلزامي حسب إطار العمل التنظيمي</div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-widest">إجراءات سريعة</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href={`/dashboard/ai-assistant?context=${encodeURIComponent(displayName)}`}
            className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-blue-500/50 hover:bg-blue-900/10 transition-all group"
          >
            <Bot className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
            <div>
              <p className="text-white text-sm font-medium">استشارة المساعد الذكي</p>
              <p className="text-slate-500 text-xs">اسأل عن {displayName}</p>
            </div>
          </Link>

          <Link
            href="/dashboard/command-center"
            className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-purple-500/50 hover:bg-purple-900/10 transition-all group"
          >
            <Activity className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
            <div>
              <p className="text-white text-sm font-medium">مركز القيادة</p>
              <p className="text-slate-500 text-xs">التقارير والمهام</p>
            </div>
          </Link>

          <Link
            href="/dashboard/admin-gateway"
            className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all group"
          >
            <Building2 className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
            <div>
              <p className="text-white text-sm font-medium">بوابة الإدارة</p>
              <p className="text-slate-500 text-xs">جميع الوحدات</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
