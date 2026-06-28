'use client';
import { buildClientTenantHeaders } from '@/lib/gis/clientTenantHeaders';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  Crown,
  Calculator,
  Database,
  FileSearch,
  FileText,
  Inbox,
  Layers,
  ShieldCheck,
  Shield,
  Sparkles,
  Send,
  Target,
  TrendingDown,
  Users,
  Zap,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

const API_BASE = '/api/v1/dept-admin';

function getHeaders(): Record<string, string> {
  const headers = buildClientTenantHeaders();
  if (typeof window === 'undefined') return headers;

  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

interface AdminStats {
  total: number;
  pending_action: number;
  inbox_count: number;
}

export default function CorrosionHubPage() {
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/corrosion/stats`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((d) =>
        setAdminStats({
          total: d.total ?? 0,
          pending_action: d.pending_action ?? 0,
          inbox_count: d.inbox_count ?? 0,
        })
      )
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <Link
            href="/dashboard/admin-gateway"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4"
          >
            <ArrowRight className="w-4 h-4" />
            البوابة الإدارية
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">إدارة التآكل</h1>
          <p className="text-slate-400 mt-2">اختر الواجهة المطلوبة للمتابعة</p>
        </div>

        <Link href="/dashboard/admin-gateway/corrosion/manager" className="group block">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 hover:border-rose-500/60 hover:bg-slate-800/70 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">مدير إدارة التآكل</h2>
                <p className="text-rose-400/70 text-xs mt-0.5">Executive Corrosion Management</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              صلاحيات إدارية كاملة: متابعة الأقسام، اعتماد الأولويات، مراقبة الدورة المستندية، والتصعيد بين التآكل الفنية والجهات الخارجية.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-4">
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-300">
                <Users className="w-3.5 h-3.5 text-rose-400 mb-1" />
                الإشراف على الأقسام
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-300">
                <Target className="w-3.5 h-3.5 text-rose-400 mb-1" />
                اعتماد الأولويات
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-300">
                <ClipboardList className="w-3.5 h-3.5 text-rose-400 mb-1" />
                تتبع مسارات الأوامر
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-400 mb-1" />
                اعتماد الإغلاق النهائي
              </div>
            </div>
            {adminStats !== null && (
              <div className="flex gap-5 text-xs bg-slate-800/60 rounded-xl px-4 py-2.5">
                <span className="text-slate-400">الإجمالي: <span className="text-emerald-300 font-semibold">{adminStats.total}</span></span>
                <span className="text-slate-400">بانتظار الإجراء: <span className="text-yellow-300 font-semibold">{adminStats.pending_action}</span></span>
                <span className="text-slate-400">الوارد: <span className="text-blue-300 font-semibold">{adminStats.inbox_count}</span></span>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="text-rose-400 font-semibold text-sm flex items-center gap-1.5">
                فتح لوحة المدير
                <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span>
              </span>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <Link href="/dashboard/admin-gateway/corrosion/monitoring" className="group block">
            <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم المراقبة الدورية والصيانة</h2>
                  <p className="text-cyan-400/70 text-xs mt-0.5">Periodic Monitoring & Maintenance</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                تنفيذ كشف المسارات، متابعة العوائق، إصدار أوامر بدء المسح، ومراقبة التنفيذ الدوري.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><Database className="w-3.5 h-3.5 text-cyan-400" /> جلسات المسح</div>
                <div className="flex items-center gap-2"><FileSearch className="w-3.5 h-3.5 text-cyan-400" /> كشف العوائق</div>
                <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-cyan-400" /> متابعة CIPS/DCVG</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-cyan-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/admin-gateway/corrosion/support" className="group block">
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 hover:border-emerald-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم الدعم الفني</h2>
                  <p className="text-emerald-400/70 text-xs mt-0.5">Technical Support Section</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                تحليل البيانات، إعداد التقرير الفني، توليد أوامر المتابعة، والتنسيق مع الصيانة بعد التحليل.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><Calculator className="w-3.5 h-3.5 text-emerald-400" /> الحسابات الهندسية</div>
                <div className="flex items-center gap-2"><TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> التنبؤ والتحليل</div>
                <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-emerald-400" /> التقارير الفنية</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-emerald-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/admin-gateway/corrosion/coating" className="group block">
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 hover:border-amber-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم المكونات الهندسية والطلاء</h2>
                  <p className="text-amber-400/70 text-xs mt-0.5">Components & Coating Section</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                متابعة مشاكل الطلاء والمكونات، إجراءات التصحيح، وإعداد أوامر العمل المعالجة داخلياً أو عبر الصيانة.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-amber-400" /> فحوص الطلاء والمكونات</div>
                <div className="flex items-center gap-2"><Inbox className="w-3.5 h-3.5 text-amber-400" /> إحالات تصحيحية واردة</div>
                <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-amber-400" /> اعتماد الإجراء العلاجي</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-amber-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

        </div>

        {/* المراسلات الإدارية الداخلية */}
        <div className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">المراسلات الإدارية الداخلية</h2>
          <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3">
            <p className="text-sm text-rose-200 font-semibold">تم توحيد مسارات المراسلات في قناة واحدة</p>
            <p className="text-xs text-slate-300 mt-1">
              الوارد والصادر والتعميمات والإجراءات الإدارية تُدار من نفس اللوحة لتقليل التشتت وتسريع المتابعة.
            </p>
          </div>
          <InternalMailTab department="corrosion_manager" title="نظام المراسلات الموحد - إدارة التآكل" />
        </div>
      </div>
    </div>
  );
}
