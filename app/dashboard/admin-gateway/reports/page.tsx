'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardList, BarChart3, ShoppingCart, Wrench, TrendingUp, ChevronLeft, FolderOpen, MapPin } from 'lucide-react';
import { useErpContextStore } from '@/store/erpContextStore';

const submodules = [
  {
    title: 'التقرير التنفيذي',
    href: '/dashboard/admin-gateway/reports/executive',
    icon: TrendingUp,
    description: 'ملخص شامل عبر جميع وحدات المنظومة — المشاريع والعقود والمالية والأسطول',
    features: ['إجمالي المشاريع', 'العقود النشطة', 'القيود المحاسبية', 'حالة الموافقات'],
    color: 'indigo',
  },
  {
    title: 'التقرير المالي',
    href: '/dashboard/admin-gateway/reports/financial',
    icon: BarChart3,
    description: 'تفاصيل القيود والفواتير والتحصيلات ومصروفات المشتريات والوقود',
    features: ['القيود المحاسبية', 'الفواتير والتحصيل', 'مصروفات المشتريات', 'تصدير CSV'],
    color: 'emerald',
  },
  {
    title: 'تقرير المشتريات والعقود',
    href: '/dashboard/admin-gateway/reports/procurement',
    icon: ShoppingCart,
    description: 'الموردون وأوامر الشراء وطلبات الشراء والعقود حسب المشروع',
    features: ['حالة طلبات الشراء', 'أوامر الشراء', 'العقود النشطة', 'قيمة العقود'],
    color: 'amber',
  },
  {
    title: 'تقرير العمليات',
    href: '/dashboard/admin-gateway/reports/operations',
    icon: Wrench,
    description: 'الأسطول والمخزون وطلبات الاعتماد وتفاصيل المشاريع الميدانية',
    features: ['حالة المركبات', 'استهلاك الوقود', 'حركة المخزون', 'الموافقات المعلقة'],
    color: 'rose',
  },
];

const colorMap: Record<string, { bg: string; border: string; icon: string; tag: string }> = {
  indigo:  { bg: 'bg-indigo-600/20',  border: 'border-indigo-500/50',  icon: 'text-indigo-400',  tag: 'bg-indigo-500/10 text-indigo-300' },
  emerald: { bg: 'bg-emerald-600/20', border: 'border-emerald-500/50', icon: 'text-emerald-400', tag: 'bg-emerald-500/10 text-emerald-300' },
  amber:   { bg: 'bg-amber-600/20',   border: 'border-amber-500/50',   icon: 'text-amber-400',   tag: 'bg-amber-500/10 text-amber-300' },
  rose:    { bg: 'bg-rose-600/20',    border: 'border-rose-500/50',    icon: 'text-rose-400',    tag: 'bg-rose-500/10 text-rose-300' },
};

export default function ReportsIndexPage() {
  const ctx     = useErpContextStore();
  const project = ctx.getActiveProject();
  const site    = ctx.getActiveSite();

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200 transition-colors">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">التقارير الرسمية</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="bg-indigo-600/20 p-4 rounded-xl border border-indigo-500/50">
            <ClipboardList className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-100">التقارير الرسمية</h1>
            <p className="text-slate-400 mt-1">التنفيذية — المالية — المشتريات — العمليات</p>
          </div>
          {(project || site) && (
            <div className="flex items-center gap-3 text-sm">
              {project && (
                <div className="flex items-center gap-1.5 bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 rounded-lg">
                  <FolderOpen className="w-4 h-4 text-indigo-400" />
                  <span className="text-indigo-300">{project.name}</span>
                </div>
              )}
              {site && (
                <div className="flex items-center gap-1.5 bg-purple-600/20 border border-purple-500/30 px-3 py-1.5 rounded-lg">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-300">{site.name}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submodule grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {submodules.map((mod) => {
            const c   = colorMap[mod.color];
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className={`group p-6 rounded-2xl border ${c.bg} ${c.border} hover:scale-[1.02] transition-all duration-200 block`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${c.bg} border ${c.border}`}>
                    <Icon className={`w-6 h-6 ${c.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-slate-100 group-hover:text-white transition-colors">
                      {mod.title}
                    </h2>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">{mod.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {mod.features.map((f) => (
                        <span key={f} className={`text-xs px-2 py-1 rounded-full border ${c.tag} border-transparent`}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Info banner */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 text-sm text-slate-400 text-center">
          جميع التقارير تعتمد على بيانات حيّة من قاعدة البيانات — لا بيانات وهمية
        </div>
      </div>
    </div>
  );
}
