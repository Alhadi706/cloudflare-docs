'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, DollarSign, BarChart2, FileText,
  ShieldCheck, Activity, TrendingUp, PieChart, Receipt, Settings,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

const sections = [
  {
    href: '/dashboard/admin-gateway/finance/budgets',
    label: 'الميزانيات والاعتمادات',
    en: 'Budgets & Appropriations',
    color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/20',
    icon: DollarSign,
    items: ['الميزانية السنوية', 'الاعتمادات المالية', 'التحويلات'],
  },
  {
    href: '/dashboard/admin-gateway/finance/expenses',
    label: 'المصروفات والمدفوعات',
    en: 'Expenses & Payments',
    color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/20',
    icon: Receipt,
    items: ['مدفوعات الموردين', 'المصروفات التشغيلية', 'السلف'],
  },
  {
    href: '/dashboard/admin-gateway/finance/reports',
    label: 'التقارير المالية',
    en: 'Financial Reports',
    color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/20',
    icon: BarChart2,
    items: ['التقارير الشهرية', 'ربع السنوية', 'الختامية'],
  },
  {
    href: '/dashboard/admin-gateway/finance/allocations',
    label: 'تخصيص الموارد',
    en: 'Resource Allocations',
    color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/20',
    icon: PieChart,
    items: ['توزيع الميزانية', 'مراكز التكلفة', 'الإدارات'],
  },
  {
    href: '/dashboard/admin-gateway/finance/transfers',
    label: 'التحويلات والتسويات',
    en: 'Transfers & Settlements',
    color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/20',
    icon: TrendingUp,
    items: ['تحويلات بنكية', 'التسويات الداخلية', 'المراجعة'],
  },
];

const mgmtLinks = [
  { href: '/dashboard/admin-gateway/finance/budgets',    icon: DollarSign,  label: 'الميزانية السنوية' },
  { href: '/dashboard/admin-gateway/finance/expenses',   icon: Receipt,     label: 'المصروفات التفصيلية' },
  { href: '/dashboard/admin-gateway/finance/reports',    icon: FileText,    label: 'التقارير المالية' },
  { href: '/dashboard/admin-gateway/workflow/approvals?role=finance_controller', icon: ShieldCheck, label: 'الموافقات المالية' },
  { href: '/dashboard/admin-gateway/finance/allocations', icon: PieChart,   label: 'تخصيص الميزانية' },
  { href: '/dashboard/admin-gateway/finance/asset-tracking', icon: Settings, label: 'تتبع الأصول المالية' },
];

const monitoringLinks = [
  {
    href: '/dashboard/admin-gateway/platform-intelligence/monitoring',
    icon: Activity,
    label: 'مراقبة المنصة والأداء التشغيلي',
    hint: 'لوحة مراقبة مركزية عبر الإدارات',
  },
  {
    href: '/dashboard/admin-gateway/finance/reports',
    icon: BarChart2,
    label: 'مؤشرات الأداء المالي',
    hint: 'متابعة الإنفاق والإيرادات والفجوات',
  },
];

export default function FinanceManagerPage() {
  const [activeTab, setActiveTab] = useState<'sections' | 'monitoring' | 'correspondence'>('sections');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <Link href="/dashboard/admin-gateway/finance" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            الإدارة المالية
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة مدير الإدارة المالية</h1>
              <p className="text-slate-400 text-sm mt-0.5">نظرة شاملة على الصلاحيات والمؤشرات المالية</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
          <button onClick={() => setActiveTab('sections')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'sections' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800/60'}`}>
            أقسام الإدارة
          </button>
          <button onClick={() => setActiveTab('monitoring')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'monitoring' ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800/60'}`}>
            المؤشرات والمراقبة
          </button>
          <button onClick={() => setActiveTab('correspondence')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'correspondence' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800/60'}`}>
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
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">أدوات الإدارة</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {mgmtLinks.map(({ href, icon: Icon, label }) => (
                  <Link key={href} href={href}
                    className="group flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 hover:border-emerald-500/40 hover:bg-slate-800/60 transition-all">
                    <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors truncate">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">المؤشرات والمراقبة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {monitoringLinks.map(({ href, icon: Icon, label, hint }) => (
                <Link key={href} href={href}
                  className="group bg-slate-900 border border-blue-500/25 rounded-2xl p-5 hover:bg-slate-800/70 hover:border-blue-500/40 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-blue-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{label}</p>
                      <p className="text-xs text-slate-400 mt-1">{hint}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-blue-300 font-semibold">
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
                الوارد والصادر والتعميمات والإجراءات الإدارية تُدار من نفس اللوحة — هذا التبويب مخصص لمدير الإدارة فقط.
              </p>
            </div>
            <InternalMailTab department="finance" title="نظام المراسلات الموحد - الإدارة المالية" />
          </div>
        )}

      </div>
    </div>
  );
}
