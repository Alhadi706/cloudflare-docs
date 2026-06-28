'use client';

import React from 'react';
import Link from 'next/link';
import { Truck, Wrench, Fuel, ChevronLeft, MapPin, FolderOpen } from 'lucide-react';
import { useErpContextStore } from '@/store/erpContextStore';

const submodules = [
  {
    title: 'المركبات',
    href: '/dashboard/admin-gateway/vehicles/vehicles',
    icon: Truck,
    description: 'سجل المركبات الميدانية المرتبطة بالمشاريع والمواقع',
    features: ['تسجيل مركبة', 'التعيين لمشروع', 'الحالة التشغيلية', 'الاستيراد'],
    color: 'blue',
  },
  {
    title: 'المعدات والآلات',
    href: '/dashboard/admin-gateway/vehicles/equipment',
    icon: Wrench,
    description: 'سجل المعدات والآلات الميدانية وتعيينها للمواقع',
    features: ['تسجيل معدة', 'ربط بموقع', 'رقم السيريال', 'الاستيراد'],
    color: 'violet',
  },
  {
    title: 'سجلات الوقود',
    href: '/dashboard/admin-gateway/vehicles/fuel',
    icon: Fuel,
    description: 'تسجيل استهلاك الوقود للمركبات والمعدات الميدانية',
    features: ['تسجيل تعبئة', 'ربط بمركبة/معدة', 'التكلفة', 'التقارير'],
    color: 'amber',
  },
];

const colorMap: Record<string, { bg: string; border: string; icon: string; tag: string }> = {
  blue:   { bg: 'bg-blue-600/20',   border: 'border-blue-500/50',   icon: 'text-blue-400',   tag: 'bg-blue-500/10 text-blue-300' },
  violet: { bg: 'bg-violet-600/20', border: 'border-violet-500/50', icon: 'text-violet-400', tag: 'bg-violet-500/10 text-violet-300' },
  amber:  { bg: 'bg-amber-600/20',  border: 'border-amber-500/50',  icon: 'text-amber-400',  tag: 'bg-amber-500/10 text-amber-300' },
};

export default function VehiclesIndexPage() {
  const ctx     = useErpContextStore();
  const project = ctx.getActiveProject();
  const site    = ctx.getActiveSite();

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200 transition-colors">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">المركبات والمعدات</span>
        </div>

        <div className="flex items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/50">
            <Truck className="w-8 h-8 text-blue-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-100">المركبات والمعدات الميدانية</h1>
            <p className="text-slate-400 mt-1">المركبات — المعدات — استهلاك الوقود</p>
          </div>
          {(project || site) && (
            <div className="flex items-center gap-3 text-sm">
              {project && (
                <div className="flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/30 px-3 py-1.5 rounded-lg">
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-300">{project.name}</span>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {submodules.map((m) => {
            const c    = colorMap[m.color];
            const Icon = m.icon;
            return (
              <Link key={m.href} href={m.href}
                className="block p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/50 group">
                <div className={`inline-flex p-3 rounded-xl ${c.bg} border ${c.border} mb-4`}>
                  <Icon className={`w-6 h-6 ${c.icon}`} />
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-white">{m.title}</h3>
                <p className="text-slate-400 text-sm mb-4">{m.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {m.features.map((f) => (
                    <span key={f} className={`text-xs px-2 py-0.5 rounded-full ${c.tag}`}>{f}</span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </div>
  );
}
