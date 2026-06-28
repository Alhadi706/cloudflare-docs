'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Crown,
  ChevronLeft,
  ShoppingCart,
  Warehouse,
  Package,
  ClipboardList,
  BarChart2,
  Boxes,
  TrendingDown,
  TrendingUp,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

type SectionHeadCard = {
  title: string;
  subtitle: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  tone: string;
  bullets: string[];
};

export default function MaterialsCenterPage() {
  const sectionHeads: SectionHeadCard[] = [
    {
      title: 'رئيس قسم المشتريات',
      subtitle: 'Procurement Head',
      desc: 'مسؤول عن دورة الطلبات وأوامر الشراء وربطها بالمشاريع والمواقع.',
      href: '/dashboard/admin-gateway/materials/procurement',
      icon: ShoppingCart,
      tone: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
      bullets: ['طلبات الشراء', 'أوامر الشراء', 'متابعة حالة التوريد'],
    },
    {
      title: 'رئيس قسم الموردين والعقود',
      subtitle: 'Suppliers & Contracts Head',
      desc: 'مسؤول عن الموردين المعتمدين وتقييم الأداء والالتزام التعاقدي.',
      href: '/dashboard/admin-gateway/materials/procurement/suppliers',
      icon: Building2,
      tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      bullets: ['سجل الموردين', 'تقييم الموردين', 'إدارة العقود الشرائية'],
    },
    {
      title: 'رئيس قسم المخازن والمستودعات',
      subtitle: 'Warehousing Head',
      desc: 'مسؤول عن المستودعات والاستلام والصرف والانضباط التشغيلي للحركة.',
      href: '/dashboard/admin-gateway/materials/inventory/warehouses',
      icon: Warehouse,
      tone: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
      bullets: ['المستودعات', 'سندات الاستلام', 'سندات الصرف'],
    },
    {
      title: 'رئيس قسم المواد التشغيلية وقطع الغيار',
      subtitle: 'Operations Materials Head',
      desc: 'مسؤول عن تلبية طلبات الإدارات التشغيلية وربطها بالمخزون أو التوفير.',
      href: '/dashboard/admin-gateway/materials/requests',
      icon: ClipboardList,
      tone: 'border-teal-500/40 bg-teal-500/10 text-teal-300',
      bullets: ['طلبات المواد بين الإدارات', 'تحديد نمط التوفير', 'جاهزية الاستلام'],
    },
    {
      title: 'رئيس قسم الرقابة على المخزون',
      subtitle: 'Inventory Control Head',
      desc: 'مسؤول عن كتالوج الأصناف، حدود المخزون، والانحرافات التشغيلية.',
      href: '/dashboard/admin-gateway/materials/inventory/items',
      icon: Boxes,
      tone: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
      bullets: ['كتالوج الأصناف', 'مستويات الحد الأدنى', 'ضبط حركات المخزون'],
    },
    {
      title: 'رئيس قسم التقارير والتكامل',
      subtitle: 'Reporting & Integration Head',
      desc: 'مسؤول عن مؤشرات الأداء وتكامل المالية والصيانة والأصول.',
      href: '/dashboard/admin-gateway/reports/procurement',
      icon: BarChart2,
      tone: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
      bullets: ['تقارير الإنفاق', 'مؤشرات التوريد', 'خرائط التكامل المؤسسي'],
    },
  ];

  return (
    <div className="min-h-full w-full bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-4 w-full">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link
            href="/dashboard/admin-gateway"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            البوابة الإدارية
          </Link>
        </div>

        <Link href="/dashboard/admin-gateway/materials/manager" className="group block">
          <section className="rounded-2xl border border-teal-500/30 bg-slate-900 p-6 hover:border-teal-500/60 hover:bg-slate-800/70 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-teal-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">مدير إدارة المواد</h1>
                <p className="text-teal-300/80 text-xs mt-0.5">Materials Department Director</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              صلاحيات شاملة: الإشراف على رؤساء الأقسام، اعتماد المسارات الحرجة، متابعة المخزون والتوريد، وضبط تكامل المواد مع المالية والصيانة.
            </p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {[
                'اعتماد الطلبات الحرجة',
                'متابعة سلسلة التوريد',
                'حوكمة المخزون',
                'مؤشرات الأداء التنفيذية',
              ].map((line) => (
                <div key={line} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-300">
                  {line}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="text-teal-300 font-semibold text-sm inline-flex items-center gap-1.5">
                فتح لوحة المدير
                <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span>
              </span>
            </div>
          </section>
        </Link>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-100">رؤساء أقسام إدارة المواد</h2>
          <p className="text-xs text-slate-400">تم اعتماد نفس نمط التقسيم الإداري: مدير إدارة + رؤساء أقسام تشغيلية.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectionHeads.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-2xl border border-white/10 bg-slate-900 p-5 hover:bg-slate-800/60 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.tone}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{item.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-300 leading-5">{item.desc}</p>
                  <div className="mt-3 space-y-1.5">
                    {item.bullets.map((bullet) => (
                      <div key={bullet} className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-slate-500" />
                        {bullet}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 group-hover:text-slate-200 transition-colors inline-flex items-center gap-1">
                    فتح القسم
                    <ChevronLeft className="w-3.5 h-3.5 group-hover:translate-x-[-2px] transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium">التكامل التنفيذي:</span>
            <span className="rounded-full border border-amber-700/50 bg-amber-900/20 px-2.5 py-0.5 text-amber-300">مالية</span>
            <span className="rounded-full border border-rose-700/50 bg-rose-900/20 px-2.5 py-0.5 text-rose-300">صيانة</span>
            <span className="rounded-full border border-indigo-700/50 bg-indigo-900/20 px-2.5 py-0.5 text-indigo-300">أصول</span>
            <span className="rounded-full border border-cyan-700/50 bg-cyan-900/20 px-2.5 py-0.5 text-cyan-300">مشاريع</span>
            <span className="rounded-full border border-violet-700/50 bg-violet-900/20 px-2.5 py-0.5 text-violet-300">حوكمة</span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-bold text-slate-100">الوحدات التنفيذية السريعة</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { title: 'طلبات المواد', href: '/dashboard/admin-gateway/materials/requests', icon: ClipboardList },
              { title: 'أوامر الشراء', href: '/dashboard/admin-gateway/materials/procurement/orders', icon: ShoppingCart },
              { title: 'حركات المخزون', href: '/dashboard/admin-gateway/materials/inventory', icon: TrendingDown },
              { title: 'التقارير', href: '/dashboard/admin-gateway/reports/procurement', icon: BarChart2 },
            ].map((entry) => (
              <Link
                key={entry.title}
                href={entry.href}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <span className="inline-flex items-center gap-1.5">
                  <entry.icon className="w-3.5 h-3.5 text-slate-400" />
                  {entry.title}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* المراسلات الإدارية الداخلية */}
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">المراسلات الإدارية الداخلية</h2>
          <div className="mb-4 rounded-xl border border-teal-500/25 bg-teal-500/5 px-4 py-3">
            <p className="text-sm text-teal-200 font-semibold">تم توحيد مسارات المراسلات في قناة واحدة</p>
            <p className="text-xs text-slate-300 mt-1">
              الوارد والصادر والتعميمات والإجراءات الإدارية تُدار من نفس اللوحة لتقليل التشتت وتسريع المتابعة.
            </p>
          </div>
          <InternalMailTab department="procurement_manager" title="نظام المراسلات الموحد - إدارة المواد" />
        </section>
      </div>
    </div>
  );
}
