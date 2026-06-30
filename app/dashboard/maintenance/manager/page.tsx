'use client';
import React from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, Wrench, Brain, CalendarClock,
  ClipboardList, BarChart2, Users, PackageOpen, Activity, Bot, MapPin,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

const sections = [
  {
    href: '/dashboard/maintenance/operations',
    label: 'قسم العمليات الميدانية',
    en: 'Field Operations',
    color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/20',
    icon: Wrench,
    items: ['أوامر العمل', 'الصيانة الوقائية', 'الآبار'],
  },
  {
    href: '/dashboard/maintenance/technical',
    label: 'قسم الدعم الفني والتحليل',
    en: 'Technical Support & Analysis',
    color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/20',
    icon: Brain,
    items: ['تحليل الأعطال', 'المعايير الفنية', 'مساحة العمل GIS'],
  },
  {
    href: '/dashboard/maintenance/planning',
    label: 'قسم التخطيط والموارد',
    en: 'Planning & Resources',
    color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/20',
    icon: CalendarClock,
    items: ['فرق الصيانة', 'قطع الغيار', 'التحكم الآلي'],
  },
];

const mgmtLinks = [
  { href: '/dashboard/admin-gateway/maintenance/executive',  icon: BarChart2,   label: 'التقرير التنفيذي' },
  { href: '/dashboard/admin-gateway/maintenance/work-orders', icon: ClipboardList, label: 'اعتماد أوامر العمل' },
  { href: '/dashboard/admin-gateway/maintenance/teams',      icon: Users,       label: 'فرق الصيانة' },
  { href: '/dashboard/admin-gateway/maintenance/spare-parts', icon: PackageOpen, label: 'مخزون قطع الغيار' },
  { href: '/dashboard/admin-gateway/maintenance/fault-analysis', icon: Activity, label: 'تحليل الأعطال' },
  { href: '/dashboard/admin-gateway/maintenance/bot-control', icon: Bot,         label: 'التحكم الآلي الذكي' },
];

export default function MaintenanceManagerPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <Link href="/dashboard/maintenance" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            إدارة الهندسة والدعم الفني
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة مدير الهندسة والدعم الفني</h1>
              <p className="text-slate-400 text-sm mt-0.5">نظرة شاملة على الأقسام الثلاثة والصلاحيات الإدارية</p>
            </div>
          </div>
        </div>

        {/* Sections Overview */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">الأقسام التابعة</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <InternalMailTab
          department="maint_manager"
          title="نظام المراسلات الموحد - الهندسة والدعم الفني"
        />

        {/* Management Tools */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">أدوات الإدارة</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {mgmtLinks.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href}
                className="group flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 hover:border-orange-500/40 hover:bg-slate-800/60 transition-all">
                <Icon className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors truncate">{label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
