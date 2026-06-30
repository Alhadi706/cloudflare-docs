'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, Package, RotateCcw, Shield, Settings,
  Heart, DollarSign, Wrench, Brain, Activity, BarChart2,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

const sections = [
  {
    href: '/dashboard/asset-360',
    label: 'أصل 360°',
    en: 'Asset 360°',
    color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/20',
    icon: RotateCcw,
    items: ['دورة حياة الأصل', 'GIS والصيانة', 'المستندات المالية'],
  },
  {
    href: '/dashboard/admin-gateway/assets/registry',
    label: 'سجل الأصول',
    en: 'Assets Registry',
    color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/20',
    icon: Shield,
    items: ['السجل الرسمي', 'جميع أصول المؤسسة', 'الوثائق والتقارير'],
  },
  {
    href: '/dashboard/admin-gateway/assets/list',
    label: 'قائمة الأصول',
    en: 'Assets List',
    color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/20',
    icon: Package,
    items: ['استعراض الأصول', 'البحث والتصفية', 'التفاصيل'],
  },
  {
    href: '/dashboard/admin-gateway/assets/types',
    label: 'أنواع وفئات الأصول',
    en: 'Asset Types & Categories',
    color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/20',
    icon: Settings,
    items: ['التصنيفات المعتمدة', 'الأنواع والفئات', 'معايير التسجيل'],
  },
  {
    href: '/dashboard/admin-gateway/assets/health',
    label: 'صحة الأصول',
    en: 'Asset Health',
    color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/20',
    icon: Heart,
    items: ['مؤشرات الحالة', 'التنبيهات الحرجة', 'متابعة التدهور'],
  },
  {
    href: '/dashboard/admin-gateway/assets/valuations',
    label: 'تقييم الأصول',
    en: 'Asset Valuations',
    color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/20',
    icon: DollarSign,
    items: ['القيمة المالية', 'الاستهلاك', 'إعادة التقييم'],
  },
  {
    href: '/dashboard/admin-gateway/assets/maintenance',
    label: 'صيانة الأصول',
    en: 'Asset Maintenance',
    color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/20',
    icon: Wrench,
    items: ['أوامر الصيانة', 'الجدولة الوقائية', 'سجل التدخلات'],
  },
  {
    href: '/dashboard/admin-gateway/platform-intelligence/asset-intelligence',
    label: 'ذكاء الأصول (AI)',
    en: 'Asset Intelligence AI',
    color: 'text-fuchsia-400', border: 'border-fuchsia-500/30', bg: 'bg-fuchsia-500/20',
    icon: Brain,
    items: ['التنبؤ بالأعطال', 'مؤشرات الأداء', 'التحليل الذكي'],
  },
];

const monitoringLinks = [
  {
    href: '/dashboard/admin-gateway/assets/reviews',
    icon: Activity,
    label: 'مراجعة البيانات الجغرافية للأصول',
    hint: 'مراجعة واعتماد بيانات الأصول المكانية',
  },
  {
    href: '/dashboard/admin-gateway/reports/operations',
    icon: BarChart2,
    label: 'تقرير العمليات والأداء',
    hint: 'ملخص أداء الأصول والعمليات الميدانية',
  },
  {
    href: '/dashboard/admin-gateway/platform-intelligence/monitoring',
    icon: Activity,
    label: 'مراقبة صحة الأصول الحية',
    hint: 'لوحة مراقبة مركزية لحالة جميع الأصول',
  },
];

export default function DigitalAssetsManagerPage() {
  const [activeTab, setActiveTab] = useState<'sections' | 'monitoring' | 'correspondence'>('sections');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <Link href="/dashboard/digital-assets" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            إدارة الأصول
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة مدير إدارة الأصول</h1>
              <p className="text-slate-400 text-sm mt-0.5">Digital Assets Management — Department Manager</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { key: 'sections',        label: 'أقسام الإدارة',                  active: 'bg-violet-500/20 border-violet-500/40 text-violet-300' },
            { key: 'monitoring',      label: 'المؤشرات والمراقبة',             active: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
            { key: 'correspondence',  label: 'المراسلات الإدارية الداخلية',    active: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors border ${activeTab === t.key ? t.active : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'sections' && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">الأقسام التابعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sections.map(({ href, label, en, color, border, bg, icon: Icon, items }) => (
                <Link key={href} href={href} className="group block">
                  <div className={`rounded-2xl border ${border} bg-slate-900 p-5 hover:bg-slate-800/70 transition-all h-full flex flex-col`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{label}</h3>
                        <p className={`text-[11px] ${color} mt-0.5 opacity-70`}>{en}</p>
                      </div>
                    </div>
                    <ul className="text-xs text-slate-400 space-y-1 flex-1">
                      {items.map(item => (
                        <li key={item} className="flex items-center gap-1.5">
                          <span className={`w-1 h-1 rounded-full inline-block shrink-0 ${bg}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <span className={`${color} text-xs font-semibold flex items-center gap-1`}>فتح القسم <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">المؤشرات والروابط التنفيذية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {monitoringLinks.map(({ href, icon: Icon, label, hint }) => (
                <Link key={href} href={href} className="group flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:border-emerald-500/30 hover:bg-slate-800/60 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'correspondence' && (
          <InternalMailTab department="assets_manager" title="نظام المراسلات الموحد - إدارة الأصول" />
        )}

      </div>
    </div>
  );
}
