'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, Radio, Activity, Bell, MonitorDot, Gauge,
  Users, MapPin, ClipboardList, BarChart3, Settings,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

const sections = [
  {
    href: '/dashboard/control-center/scada',
    label: 'قسم تشغيل المنظومة',
    en: 'System Operations',
    color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/20',
    icon: MonitorDot,
    items: ['SCADA P&ID الكامل', 'التقارير اليومية', 'حالة المضخات والمحركات'],
  },
  {
    href: '/dashboard/control-center/production-schedule',
    label: 'قسم التحليل والجدولة',
    en: 'Analysis & Scheduling',
    color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/20',
    icon: BarChart3,
    items: ['جدولة الإنتاج اليومي', 'تحليل مناطق الضغط', 'صمامات PRV والشبكة'],
  },
  {
    href: '/dashboard/control-center/alarm-management',
    label: 'قسم الإنذارات والنوبات',
    en: 'Alarms & Shift Management',
    color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/20',
    icon: Bell,
    items: ['تصنيف الإنذارات', 'سجل تسليم النوبات', 'أوامر الصيانة الطارئة'],
  },
  {
    href: '/dashboard/control-center/monitoring-teams',
    label: 'فرق الرصد الميداني',
    en: 'Field Monitoring Teams',
    color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/20',
    icon: Users,
    items: ['تكوين الفرق', 'مواقع المحطات', 'جداول الرصد'],
  },
  {
    href: '/dashboard/control-center/field-readings',
    label: 'تسجيل القراءات الميدانية',
    en: 'Field Data Entry',
    color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/20',
    icon: ClipboardList,
    items: ['قراءات المحطات', '4 ورديات', 'حفظ المسودة'],
  },
  {
    href: '/dashboard/control-center/real-time',
    label: 'المراقبة الآنية الكاملة',
    en: 'Live SCADA Dashboard',
    color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/20',
    icon: Activity,
    items: ['P&ID ميميك', 'الضغوط الآنية', 'إنذارات فورية', 'بيانات لحظية'],
  },
];

const monitoringLinks = [
  {
    href: '/dashboard/control-center/real-time',
    icon: Activity,
    label: 'لوحة المراقبة الآنية',
    hint: 'SCADA مباشر — مراقبة 24/7 للشبكة',
  },
  {
    href: '/dashboard/control-center/readings-approval',
    icon: Settings,
    label: 'اعتماد القراءات',
    hint: 'مراجعة وموافقة قراءات الرصاد',
  },
  {
    href: '/dashboard/control-center/pressure-zones',
    icon: Gauge,
    label: 'مناطق الضغط',
    hint: 'خريطة ضغوط الشبكة وتحليل الفاقد',
  },
  {
    href: '/dashboard/control-center/alarm-management',
    icon: Bell,
    label: 'إدارة الإنذارات',
    hint: 'تصنيف وإدارة التنبيهات الحرجة',
  },
];

export default function ControlCenterManagerPage() {
  const [activeTab, setActiveTab] = useState<'sections' | 'monitoring' | 'correspondence'>('sections');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <Link href="/dashboard/control-center" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            إدارة التحكم
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة مدير إدارة التحكم</h1>
              <p className="text-slate-400 text-sm mt-0.5">نظرة شاملة على أقسام مركز التحكم الشبكي والصلاحيات الإدارية</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('sections')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'sections'
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            أقسام الإدارة
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'monitoring'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            المؤشرات والمراقبة
          </button>
          <button
            onClick={() => setActiveTab('correspondence')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'correspondence'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            المراسلات الإدارية الداخلية
          </button>
        </div>

        {activeTab === 'sections' && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">الأقسام التابعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sections.map(({ href, label, en, color, border, bg, icon: Icon, items }) => (
                <Link key={href} href={href} className="group block">
                  <div className={`bg-slate-900 border ${border} rounded-2xl p-5 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{label}</p>
                        <p className={`text-[10px] ${color} opacity-70 mt-0.5`}>{en}</p>
                      </div>
                    </div>
                    <div className="space-y-1 flex-1">
                      {items.map(i => (
                        <div key={i} className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span className={`w-1 h-1 rounded-full ${bg} inline-block shrink-0`} />
                          {i}
                        </div>
                      ))}
                    </div>
                    <div className={`mt-3 pt-3 border-t border-slate-800 ${color} text-xs font-semibold flex items-center gap-1`}>
                      دخول القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">المؤشرات والمراقبة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {monitoringLinks.map(({ href, icon: Icon, label, hint }) => (
                <Link
                  key={href}
                  href={href}
                  className="group bg-slate-900 border border-emerald-500/25 rounded-2xl p-5 hover:bg-slate-800/70 hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{label}</p>
                      <p className="text-xs text-slate-400 mt-1">{hint}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-emerald-300 font-semibold">
                    فتح لوحة المراقبة
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'correspondence' && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">المراسلات الإدارية الداخلية</h2>
            <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
              <p className="text-sm text-amber-200 font-semibold">تم توحيد مسارات المراسلات في قناة واحدة</p>
              <p className="text-xs text-slate-300 mt-1">
                الوارد والصادر والتعميمات والإجراءات الإدارية تُدار من نفس اللوحة لتقليل التشتت وتسريع المتابعة.
              </p>
            </div>
            <div className="mb-4">
              <InternalMailTab department="control_manager" title="نظام المراسلات الموحد - إدارة التحكم" />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
