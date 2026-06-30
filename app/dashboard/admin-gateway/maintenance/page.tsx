'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Wrench,
  Shield,
  Crown,
  FileText,
  ClipboardList,
  Settings,
  Users,
  Package,
  Activity,
  Sparkles,
  Send,
  Bot,
  Inbox,
  Droplets,
  Eye,
  Cpu,
  BarChart2,
  Calendar,
  AlertTriangle,
  Gauge,
  Radio,
  Waves,
  AlertCircle,
  Zap,
  ChevronLeft,
} from 'lucide-react';

const API_BASE = '/api/v1/dept-admin';

function getHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'x-tenant-id': tenantId } : {};
}

interface AdminStats {
  total: number;
  pending_action: number;
  inbox_count: number;
}

export default function MaintenanceHubPage() {
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/maintenance/stats`, { headers: getHeaders() })
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
    <div className="h-full bg-slate-950 text-slate-100 overflow-hidden flex flex-col" dir="rtl">
      <div className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full px-4 py-4 gap-4">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <Link
              href="/dashboard/admin-gateway"
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-1"
            >
              <ArrowRight className="w-4 h-4" />
              البوابة الإدارية
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">إدارة الهندسة والدعم الفني</h1>
          </div>
          <Link
            href="/dashboard/admin-gateway/maintenance/bot-control"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"
          >
            <Bot className="w-4 h-4" />
            إدارة البوت الموحد
          </Link>
        </div>

        {/* 4 Main Cards — 2×2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">

          {/* ── تخطيط الصيانة ── */}
          {/* ── تخطيط الصيانة ── */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl overflow-hidden flex flex-col hover:border-amber-500/50 transition-all">
            <Link href="/dashboard/admin-gateway/maintenance/planning" className="group flex-1 flex flex-col p-5 hover:bg-slate-800/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">تخطيط الصيانة</h2>
                  <p className="text-amber-400/70 text-xs">Maintenance Planning</p>
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">جدولة أوامر العمل، الصيانة الوقائية والدورية، وتخطيط المهام الميدانية.</p>
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {[
                  { icon: <ClipboardList className="w-3 h-3" />, label: 'أوامر العمل' },
                  { icon: <Settings className="w-3 h-3" />,      label: 'الصيانة الوقائية' },
                  { icon: <Calendar className="w-3 h-3" />,      label: 'الجدولة الدورية' },
                  { icon: <Users className="w-3 h-3" />,         label: 'الفرق التقنية' },
                  { icon: <Package className="w-3 h-3" />,       label: 'قطع الغيار' },
                  { icon: <Activity className="w-3 h-3" />,      label: 'لوحة العمليات' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <span className="text-amber-400 shrink-0">{f.icon}</span>{f.label}
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-800 mt-3">
                <span className="text-amber-400 font-semibold text-xs flex items-center gap-1">فتح تخطيط الصيانة <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
              </div>
            </Link>
          </div>

          {/* ── مراقبة الآبار ── */}
          <div className="bg-slate-900 border border-blue-500/30 rounded-2xl overflow-hidden flex flex-col hover:border-blue-500/50 transition-all">
            <Link href="/dashboard/admin-gateway/maintenance/wells" className="group flex-1 flex flex-col p-5 hover:bg-slate-800/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Droplets className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">مراقبة الآبار</h2>
                  <p className="text-blue-400/70 text-xs">Well Monitoring</p>
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">متابعة تشغيل الآبار، قراءات المناسيب، معدلات الضخ، وحالة المضخات.</p>
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {[
                  { icon: <Gauge className="w-3 h-3" />,         label: 'قراءات الضغط' },
                  { icon: <BarChart2 className="w-3 h-3" />,     label: 'معدلات الضخ' },
                  { icon: <AlertTriangle className="w-3 h-3" />, label: 'تنبيهات الأعطال' },
                  { icon: <Activity className="w-3 h-3" />,      label: 'حالة الآبار' },
                  { icon: <FileText className="w-3 h-3" />,      label: 'سجلات التشغيل' },
                  { icon: <Droplets className="w-3 h-3" />,      label: 'مناسيب المياه' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <span className="text-blue-400 shrink-0">{f.icon}</span>{f.label}
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-800 mt-3">
                <span className="text-blue-400 font-semibold text-xs flex items-center gap-1">فتح مراقبة الآبار <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
              </div>
            </Link>
          </div>

          {/* ── الدعم الفني + منصة التحليل الفني ── */}
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl overflow-hidden flex flex-col hover:border-emerald-500/50 transition-all">
            <Link href="/dashboard/admin-gateway/maintenance/admin" className="group flex-1 flex flex-col p-5 hover:bg-slate-800/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">الدعم الفني</h2>
                  <p className="text-emerald-400/70 text-xs">Technical Support</p>
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">تقديم الدعم الفني للوحدات، المراسلات التقنية، التقارير، وأذونات الخروج.</p>
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {[
                  { icon: <Inbox className="w-3 h-3" />,     label: 'مراسلات واردة' },
                  { icon: <Send className="w-3 h-3" />,       label: 'مراسلات صادرة' },
                  { icon: <Wrench className="w-3 h-3" />,     label: 'طلبات الدعم' },
                  { icon: <FileText className="w-3 h-3" />,   label: 'التقارير الدورية' },
                  { icon: <Shield className="w-3 h-3" />,     label: 'أذونات الخروج' },
                  { icon: <Sparkles className="w-3 h-3" />,   label: 'متابعة المراسلات' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <span className="text-emerald-400 shrink-0">{f.icon}</span>{f.label}
                  </div>
                ))}
              </div>
              {adminStats !== null && (
                <div className="flex gap-4 text-[11px] mt-3 bg-slate-800/60 rounded-lg px-3 py-1.5">
                  <span className="text-slate-400">الإجمالي: <span className="text-emerald-300 font-semibold">{adminStats.total}</span></span>
                  <span className="text-slate-400">بانتظار: <span className="text-yellow-300 font-semibold">{adminStats.pending_action}</span></span>
                  <span className="text-slate-400">الوارد: <span className="text-blue-300 font-semibold">{adminStats.inbox_count}</span></span>
                </div>
              )}
              <div className="pt-3 border-t border-slate-800 mt-3">
                <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1">فتح الدعم الفني <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
              </div>
            </Link>
            <Link href="/dashboard/admin-gateway/maintenance/fault-analysis" className="group border-t border-slate-700/60 px-5 py-2.5 hover:bg-red-950/20 transition-all flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-red-500/20 flex items-center justify-center shrink-0">
                  <Wrench className="w-3.5 h-3.5 text-red-400" />
                </div>
                <span className="text-xs font-semibold text-white">منصة التحليل الفني</span>
                <span className="text-[10px] text-slate-500">أعطال · مضخات · معدات</span>
              </div>
              <ChevronLeft className="w-3.5 h-3.5 text-red-400 group-hover:translate-x-[-2px] transition-transform" />
            </Link>
          </div>

          {/* ── مراقبة التشغيل + مركز التحكم التشغيلي ── */}
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl overflow-hidden flex flex-col hover:border-violet-500/50 transition-all">
            <Link href="/dashboard/admin-gateway/maintenance/preventive" className="group flex-1 flex flex-col p-5 hover:bg-slate-800/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">مراقبة التشغيل</h2>
                  <p className="text-violet-400/70 text-xs">Operations Monitoring</p>
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">متابعة العمليات اليومية، مراقبة الأداء، التنبيهات الحية، والتقارير التشغيلية.</p>
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {[
                  { icon: <Radio className="w-3 h-3" />,         label: 'المراقبة الحية' },
                  { icon: <BarChart2 className="w-3 h-3" />,     label: 'لوحة الأداء' },
                  { icon: <AlertTriangle className="w-3 h-3" />, label: 'التنبيهات' },
                  { icon: <Activity className="w-3 h-3" />,      label: 'سجل الأحداث' },
                  { icon: <FileText className="w-3 h-3" />,      label: 'التقارير اليومية' },
                  { icon: <Gauge className="w-3 h-3" />,         label: 'مؤشرات التشغيل' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <span className="text-violet-400 shrink-0">{f.icon}</span>{f.label}
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-800 mt-3">
                <span className="text-violet-400 font-semibold text-xs flex items-center gap-1">فتح مراقبة التشغيل <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
              </div>
            </Link>
            <Link href="/dashboard/admin-gateway/maintenance/control-center" className="group border-t border-slate-700/60 px-5 py-2.5 hover:bg-cyan-950/20 transition-all flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center shrink-0 relative">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
                <span className="text-xs font-semibold text-white">مركز التحكم التشغيلي</span>
                <span className="text-[10px] text-slate-500">شبكة · ضغوط · توازن مائي</span>
              </div>
              <ChevronLeft className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-[-2px] transition-transform" />
            </Link>
          </div>

        </div>

        {/* لوحة القيادة التنفيذية */}
        <div className="shrink-0">
          <Link href="/dashboard/admin-gateway/maintenance/executive" className="group block">
            <div className="relative overflow-hidden bg-slate-900 border border-rose-500/30 rounded-2xl px-5 py-4 hover:border-rose-500/60 hover:bg-slate-800/60 transition-all">
              <div className="absolute inset-0 bg-gradient-to-l from-rose-950/30 via-transparent to-amber-950/20 pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/30 to-amber-500/20 flex items-center justify-center ring-1 ring-rose-500/30 shrink-0">
                  <Crown className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white">لوحة القيادة التنفيذية</h2>
                    <span className="text-[10px] text-rose-400/70 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">Executive Command Center</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">رؤية استراتيجية: مؤشرات KPI · تحليل الفاقد · المخاطر الحرجة · التوصيات التنفيذية</p>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  {[
                    { icon: <Gauge className="w-3 h-3" />, label: 'KPI' },
                    { icon: <BarChart2 className="w-3 h-3" />, label: 'الاتجاهات' },
                    { icon: <AlertTriangle className="w-3 h-3" />, label: 'المخاطر' },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <span className="text-rose-400">{f.icon}</span>{f.label}
                    </div>
                  ))}
                  <span className="text-rose-400 font-semibold text-xs flex items-center gap-1">فتح لوحة القيادة <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* مسار الأوامر */}
        <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-400 font-medium shrink-0">مسار الأوامر:</span>
            <span className="rounded-full border border-amber-700/50 bg-amber-900/20 px-2.5 py-0.5 text-amber-300">الصيانة تُنشئ أمر</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="rounded-full border border-cyan-700/50 bg-cyan-900/20 px-2.5 py-0.5 text-cyan-300">وارد التآكل</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="rounded-full border border-indigo-700/50 bg-indigo-900/20 px-2.5 py-0.5 text-indigo-300">إحالة للفريق</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="rounded-full border border-emerald-700/50 bg-emerald-900/20 px-2.5 py-0.5 text-emerald-300">رد + تقرير</span>
          </div>
        </div>

      </div>
    </div>
  );
}
