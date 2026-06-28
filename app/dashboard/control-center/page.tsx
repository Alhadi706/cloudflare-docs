'use client';

/**
 * إدارة التحكم — Network Control Department Hub
 * هيكل تنظيمي: مدير الإدارة → أقسام متخصصة → فرق الرصد
 */

import React from 'react';
import Link from 'next/link';
import {
  Radio, Activity, BarChart3, Bell, BookOpen,
  MonitorDot, Gauge, Users, Crown, ArrowRight,
  MapPin, ClipboardList, Zap, Settings,
  PenLine, CheckSquare,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

export default function ControlCenterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Breadcrumb ── */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4"
          >
            <ArrowRight className="w-4 h-4" />
            الداشبورد الرئيسي
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">إدارة التحكم</h1>
          <p className="text-slate-400 mt-2">مركز التحكم الشبكي — مراقبة 24/7 لمنظومة الحساوات</p>
        </div>

        {/* ══ مدير الإدارة ══════════════════════════════════════════════════ */}
        <Link href="/dashboard/control-center/real-time" className="group block">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-500/60 hover:bg-slate-800/70 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">مدير إدارة التحكم</h2>
                <p className="text-cyan-400/70 text-xs mt-0.5">Network Control Manager</p>
              </div>
              <span className="mr-auto text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30 animate-pulse">
                LIVE
              </span>
            </div>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              لوحة المراقبة الآنية الكاملة: P&ID ميميك، حالة المحطات، الضغوط، التدفق، وتنبيهات الشبكة في الوقت الفعلي.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-4">
              {[
                { icon: Activity,   label: 'مراقبة الشبكة' },
                { icon: Gauge,      label: 'الضغوط الآنية' },
                { icon: Bell,       label: 'إنذارات فورية' },
                { icon: MonitorDot, label: 'لوحة SCADA' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-300 flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="text-cyan-400 font-semibold text-sm flex items-center gap-1.5">
                فتح لوحة المدير
                <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span>
              </span>
            </div>
          </div>
        </Link>

        {/* ══ الأقسام الثلاثة ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* قسم تشغيل المنظومة */}
          <Link href="/dashboard/control-center/scada" className="group block">
            <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 hover:border-rose-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                  <MonitorDot className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم تشغيل المنظومة</h2>
                  <p className="text-rose-400/70 text-xs mt-0.5">System Operations</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                رفع وتحليل تقارير التشغيل اليومية، عرض P&ID الكامل، مخطط المضخات، جودة المياه.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><MonitorDot className="w-3.5 h-3.5 text-rose-400" /> SCADA P&ID الكامل</div>
                <div className="flex items-center gap-2"><ClipboardList className="w-3.5 h-3.5 text-rose-400" /> التقارير اليومية (Excel)</div>
                <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-rose-400" /> حالة المضخات والمحركات</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-rose-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          {/* قسم التحليل والجدولة */}
          <Link href="/dashboard/control-center/production-schedule" className="group block">
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 hover:border-emerald-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم التحليل والجدولة</h2>
                  <p className="text-emerald-400/70 text-xs mt-0.5">Analysis & Scheduling</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                جدولة الإنتاج، تحليل الفاقد NRW، مناطق الضغط، تخصيص المصادر اليومي.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5 text-emerald-400" /> جدولة الإنتاج اليومي</div>
                <div className="flex items-center gap-2"><Gauge className="w-3.5 h-3.5 text-emerald-400" /> تحليل مناطق الضغط</div>
                <div className="flex items-center gap-2"><Settings className="w-3.5 h-3.5 text-emerald-400" /> صمامات PRV والشبكة</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-emerald-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          {/* قسم الإنذارات والنوبات */}
          <Link href="/dashboard/control-center/alarm-management" className="group block">
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 hover:border-amber-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم الإنذارات والنوبات</h2>
                  <p className="text-amber-400/70 text-xs mt-0.5">Alarms & Shift Management</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                إدارة الإنذارات والتنبيهات، سجل النوبات الرقمي، تسليم الوردية والملاحظات.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><Bell className="w-3.5 h-3.5 text-amber-400" /> تصنيف الإنذارات (حرج/تحذير)</div>
                <div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-amber-400" /> سجل تسليم النوبات</div>
                <div className="flex items-center gap-2"><ClipboardList className="w-3.5 h-3.5 text-amber-400" /> أوامر الصيانة الطارئة</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-amber-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>
        </div>

        {/* ══ فرق الرصد الميداني ══════════════════════════════════════════ */}
        <Link href="/dashboard/control-center/monitoring-teams" className="group block">
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-6 hover:border-violet-500/60 hover:bg-slate-800/70 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">فرق الرصد الميداني</h2>

            <InternalMailTab
              department="control_manager"
              title="نظام المراسلات الموحد - إدارة التحكم"
            />
                <p className="text-violet-400/70 text-xs mt-0.5">Field Monitoring Teams</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              تكوين فرق الراصدين حسب المحطات، تحديد مواقعهم على الخريطة الأساسية، متابعة المهام الميدانية وجداول الرصد.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-4">
              {[
                { icon: Users,        label: 'تكوين الفرق' },
                { icon: MapPin,       label: 'مواقع المحطات' },
                { icon: Radio,        label: 'تخصيص الراصدين' },
                { icon: ClipboardList,label: 'جداول الرصد' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-300 flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="text-violet-400 font-semibold text-sm flex items-center gap-1.5">
                فتح إدارة الفرق
                <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span>
              </span>
            </div>
          </div>
        </Link>

        {/* ══ تسجيل القراءات واعتمادها ═══════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* تسجيل القراءات الميدانية */}
          <Link href="/dashboard/control-center/field-readings" className="group block">
            <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-6 hover:border-teal-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-teal-500/20 flex items-center justify-center shrink-0">
                  <PenLine className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">تسجيل القراءات الميدانية</h2>
                  <p className="text-teal-400/70 text-xs mt-0.5">Field Data Entry — الراصد</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                الراصد يُعبئ قراءات المحطة أو الخزان يومياً — التدفق، الضغط، المنسوب، الكلور — ويُرسلها للمشرف.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-4">
                <span className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">14 محطة</span>
                <span className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">4 ورديات</span>
                <span className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">حفظ مسودة</span>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-teal-400 font-semibold text-sm flex items-center gap-1.5">
                  فتح نموذج الإدخال
                  <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span>
                </span>
              </div>
            </div>
          </Link>

          {/* اعتماد القراءات */}
          <Link href="/dashboard/control-center/readings-approval" className="group block">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 hover:border-indigo-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <CheckSquare className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">مراجعة واعتماد القراءات</h2>
                  <p className="text-indigo-400/70 text-xs mt-0.5">Approval Workflow — المشرف & الإدارة</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                مراجعة القراءات المُرسلة من الرصاد وموافقة المشرف ثم إدارة التحكم لإدراجها في النظام المباشر.
              </p>
              <div className="flex flex-wrap gap-2 text-xs mb-4">
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg px-2 py-1">مشرف</span>
                <span className="bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg px-2 py-1">إدارة التحكم</span>
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg px-2 py-1">→ النظام المباشر</span>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-indigo-400 font-semibold text-sm flex items-center gap-1.5">
                  فتح لوحة الاعتماد
                  <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span>
                </span>
              </div>
            </div>
          </Link>

        </div>

        {/* ══ روابط سريعة ══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/control-center/field-readings',      label: 'تسجيل القراءات',   color: 'border-teal-500/20 text-teal-300 bg-teal-500/5' },
            { href: '/dashboard/control-center/readings-approval',   label: 'اعتماد القراءات',   color: 'border-indigo-500/20 text-indigo-300 bg-indigo-500/5' },
            { href: '/dashboard/control-center/real-time',           label: 'المراقبة الآنية',   color: 'border-cyan-500/20 text-cyan-300 bg-cyan-500/5' },
            { href: '/dashboard/control-center/shift-log',           label: 'سجل النوبات',       color: 'border-violet-500/20 text-violet-300 bg-violet-500/5' },
            { href: '/dashboard/control-center/alarm-management',    label: 'إدارة الإنذارات',   color: 'border-amber-500/20 text-amber-300 bg-amber-500/5' },
            { href: '/dashboard/control-center/pressure-zones',      label: 'مناطق الضغط',       color: 'border-blue-500/20 text-blue-300 bg-blue-500/5' },
            { href: '/dashboard/control-center/production-schedule', label: 'جدولة الإنتاج',     color: 'border-emerald-500/20 text-emerald-300 bg-emerald-500/5' },
            { href: '/dashboard/control-center/scada',               label: 'SCADA الكامل',       color: 'border-rose-500/20 text-rose-300 bg-rose-500/5' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${item.color} hover:opacity-80 transition-opacity text-center`}>
              {item.label}
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
