'use client';

import React from 'react';
import Link from 'next/link';
import { Database, Package, Activity, FileText, ChevronLeft, Building2, MapPin, Crown } from 'lucide-react';
import { useErpContextStore } from '@/store/erpContextStore';

const submodules = [
  {
    title: 'سجل الأصول (Asset Registry)',
    href: '/dashboard/admin-gateway/assets/registry',
    icon: Database,
    description: 'إدارة وتتبع الأصول والمعدات',
    features: ['إضافة أصل', 'تعديل بيانات', 'البحث', 'التصنيف'],
    color: 'emerald'
  },
  {
    title: 'تصنيف الأصول (Asset Categories)',
    href: '/dashboard/admin-gateway/assets/categories',
    icon: Package,
    description: 'تصنيف وتنظيم أنواع الأصول',
    features: ['إدارة الفئات', 'التصنيف', 'الخصائص'],
    color: 'blue'
  },
  {
    title: 'صحة الأصول (Asset Health)',
    href: '/dashboard/admin-gateway/assets/health',
    icon: Activity,
    description: 'تتبع حالة وصحة الأصول',
    features: ['مؤشرات الصحة', 'التحليل الزمني', 'الأحداث', 'التنبؤ'],
    color: 'amber'
  },
  {
    title: 'التقييمات المالية (Asset Valuations)',
    href: '/dashboard/admin-gateway/assets/valuations',
    icon: FileText,
    description: 'متابعة القيمة والإهلاك المالي',
    features: ['التقييم المالي', 'الإهلاك', 'إلغاء التشغيل'],
    color: 'violet'
  }
];

const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    emerald: {
      bg: 'bg-emerald-600/20',
      border: 'border-emerald-500/50',
      icon: 'text-emerald-400',
      text: 'text-emerald-400'
    },
    blue: {
      bg: 'bg-blue-600/20',
      border: 'border-blue-500/50',
      icon: 'text-blue-400',
      text: 'text-blue-400'
    },
    amber: {
      bg: 'bg-amber-600/20',
      border: 'border-amber-500/50',
      icon: 'text-amber-400',
      text: 'text-amber-400'
    },
    violet: {
      bg: 'bg-violet-600/20',
      border: 'border-violet-500/50',
      icon: 'text-violet-400',
      text: 'text-violet-400'
    }
  };
  return colors[color] || colors.emerald;
};

export default function AssetsPage() {
  const erpCtx = useErpContextStore();
  const activeProject = erpCtx.getActiveProject();
  const activeSite    = erpCtx.getActiveSite();
  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200 transition-colors">
            بوابة النظام
          </Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">إدارة الأصول</span>
        </div>

        {/* Header */}
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600/20 p-4 rounded-xl border border-emerald-500/50">
              <Database className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-3xl font-bold text-slate-100">إدارة الأصول</h1>
                <Link href="/dashboard/admin-gateway/assets/manager" className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 transition-colors shrink-0">
                  <Crown className="w-3.5 h-3.5" />
                  لوحة مدير الإدارة
                </Link>
              </div>
              <p className="text-slate-400 mt-1">جرد وإدارة وتتبع الأصول والمعدات</p>
              {activeProject && (
                <div className="flex items-center gap-2 mt-2 text-[11px]">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-indigo-300">{activeProject.project_name || activeProject.name}</span>
                  {activeSite && (<><span className="text-gray-600">›</span><MapPin className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-300">{activeSite.name}</span></>)}
                  {!activeSite && <span className="text-gray-500">— كل المواقع</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submodules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {submodules.map((submodule, index) => {
            const Icon = submodule.icon;
            const colors = getColorClasses(submodule.color);
            return (
              <Link
                key={index}
                href={submodule.href}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:bg-slate-800/50 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className={`${colors.bg} p-3 rounded-lg border ${colors.border}`}>
                    <Icon className={`w-6 h-6 ${colors.icon}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors mb-1">
                      {submodule.title}
                    </h3>
                    <p className="text-slate-400 text-sm mb-3">{submodule.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {submodule.features.map((feature, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-slate-800/50 text-slate-400 rounded text-xs"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
