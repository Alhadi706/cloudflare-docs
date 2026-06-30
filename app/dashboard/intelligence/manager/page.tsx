'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, Bot, Newspaper, Command, TrendingUp, Activity,
  AlertTriangle, BarChart2, TestTube2, Brain,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

const sections = [
  {
    href: '/dashboard/ai-assistant',
    label: 'المساعد الذكي',
    en: 'AI Assistant',
    color: 'text-fuchsia-400', border: 'border-fuchsia-500/30', bg: 'bg-fuchsia-500/20',
    icon: Bot,
    items: ['محادثات الذكاء الاصطناعي', 'تحليل البيانات', 'الاستفسارات الذكية'],
  },
  {
    href: '/dashboard/admin-gateway/intelligence/briefing',
    label: 'الإحاطة الذكية',
    en: 'Intelligence Briefing',
    color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/20',
    icon: Newspaper,
    items: ['التقارير التنفيذية', 'الملخصات الذكية', 'تحليل المؤشرات'],
  },
  {
    href: '/dashboard/admin-gateway/intelligence/command',
    label: 'مركز القيادة الذكي',
    en: 'Smart Command Center',
    color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/20',
    icon: Command,
    items: ['لوحة الذكاء التشغيلي', 'القرارات الموحدة', 'مراقبة الأداء'],
  },
  {
    href: '/dashboard/admin-gateway/platform-intelligence/predictive-analytics',
    label: 'التحليلات التنبؤية',
    en: 'Predictive Analytics',
    color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/20',
    icon: Brain,
    items: ['نماذج ML', 'التنبؤ بالصيانة', 'تحليل المخاطر'],
  },
  {
    href: '/dashboard/admin-gateway/platform-intelligence/scenario-simulation',
    label: 'محاكاة السيناريوهات',
    en: 'Scenario Simulation',
    color: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/20',
    icon: TestTube2,
    items: ['قرارات تشغيلية', 'قرارات استراتيجية', 'تحليل العواقب'],
  },
  {
    href: '/dashboard/admin-gateway/platform-intelligence/risk-management',
    label: 'إدارة المخاطر',
    en: 'Risk Management',
    color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/20',
    icon: AlertTriangle,
    items: ['تصنيف المخاطر', 'خطط الاستجابة', 'خرائط المخاطر'],
  },
];

const monitoringLinks = [
  {
    href: '/dashboard/admin-gateway/intelligence/performance',
    icon: Activity,
    label: 'تحليل الأداء الذكي',
    hint: 'مؤشرات الأداء والمقارنة المرجعية عبر الإدارات',
  },
  {
    href: '/dashboard/admin-gateway/intelligence/forecast',
    icon: TrendingUp,
    label: 'التوقعات والسيناريوهات المستقبلية',
    hint: 'نماذج التوقع وتحليل الاتجاهات المستقبلية',
  },
  {
    href: '/dashboard/admin-gateway/intelligence/risk',
    icon: BarChart2,
    label: 'لوحة المخاطر التشغيلية',
    hint: 'تصنيف المخاطر وأولويات التدخل',
  },
];

export default function IntelligenceManagerPage() {
  const [activeTab, setActiveTab] = useState<'sections' | 'monitoring' | 'correspondence'>('sections');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <Link href="/dashboard/intelligence" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            الذكاء والتحليلات
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة مدير إدارة الذكاء والتحليلات</h1>
              <p className="text-slate-400 text-sm mt-0.5">Intelligence & Analytics — Department Manager</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { key: 'sections',        label: 'أقسام الإدارة',                  active: 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300' },
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
          <InternalMailTab department="intelligence_manager" title="نظام المراسلات الموحد - إدارة الذكاء والتحليلات" />
        )}

      </div>
    </div>
  );
}
