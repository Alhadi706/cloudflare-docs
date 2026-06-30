'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Crown,
  ClipboardList,
  ShoppingCart,
  Warehouse,
  Building2,
  BarChart2,
  ShieldCheck,
  Mail,
  LayoutGrid,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

type ManagerModule = {
  title: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  tone: string;
};

export default function MaterialsManagerPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'correspondence'>('overview');

  const modules: ManagerModule[] = [
    {
      title: 'طلبات المواد بين الإدارات',
      desc: 'المتابعة العليا لمسار الاعتماد والتنفيذ والصرف.',
      href: '/dashboard/admin-gateway/materials/requests',
      icon: ClipboardList,
      tone: 'border-teal-500/40 bg-teal-500/10 text-teal-300',
    },
    {
      title: 'المشتريات وأوامر الشراء',
      desc: 'مراقبة دورة الشراء والالتزام بالمواعيد والكلفة.',
      href: '/dashboard/admin-gateway/materials/procurement',
      icon: ShoppingCart,
      tone: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    },
    {
      title: 'المخازن والمستودعات',
      desc: 'الإشراف على المستودعات وحركات الاستلام والصرف.',
      href: '/dashboard/admin-gateway/materials/inventory',
      icon: Warehouse,
      tone: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    },
    {
      title: 'الموردون والعقود',
      desc: 'متابعة كفاءة الموردين والالتزامات التعاقدية.',
      href: '/dashboard/admin-gateway/materials/procurement/suppliers',
      icon: Building2,
      tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    },
    {
      title: 'التقارير والتحليلات',
      desc: 'مؤشرات الأداء، الإنفاق، ومخاطر سلسلة التوريد.',
      href: '/dashboard/admin-gateway/reports/procurement',
      icon: BarChart2,
      tone: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    },
    {
      title: 'الموافقات والحوكمة',
      desc: 'إدارة الموافقات عالية التأثير ومسار الامتثال.',
      href: '/dashboard/admin-gateway/workflow/approvals?role=supervisor&dept=materials',
      icon: ShieldCheck,
      tone: 'border-lime-500/40 bg-lime-500/10 text-lime-300',
    },
  ];

  const TABS = [
    { key: 'overview' as const, label: 'لوحات المتابعة', icon: <LayoutGrid className="w-4 h-4" /> },
    { key: 'correspondence' as const, label: 'المراسلات الداخلية', icon: <Mail className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Breadcrumb & Title ── */}
        <div>
          <Link
            href="/dashboard/admin-gateway/materials"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-2"
          >
            <ArrowRight className="w-4 h-4" />
            إدارة المواد
          </Link>
          <h1 className="text-2xl font-bold text-white">لوحة مدير إدارة المواد</h1>
        </div>

        {/* ── Manager Header ── */}
        <section className="rounded-2xl border border-teal-500/30 bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">صلاحيات المدير</h2>
              <p className="text-xs text-teal-300/80 mt-0.5">Oversight, approvals, and executive controls</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-300">
            {[
              'اعتماد الحالات الحرجة',
              'مراجعة مؤشرات الأداء',
              'حوكمة التوريد والمخزون',
              'متابعة التكامل مع الإدارات',
            ].map((line) => (
              <div key={line} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2">
                {line}
              </div>
            ))}
          </div>
        </section>

        {/* ── Tab Bar ── */}
        <div className="flex gap-2 border-b border-slate-800 pb-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-all ${
                activeTab === t.key
                  ? 'border-teal-500 text-teal-300 bg-teal-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 'overview' && (
          <section className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="rounded-2xl border border-white/10 bg-slate-900 p-4 hover:bg-slate-800/60 transition-all"
                  >
                    <div className={`inline-flex rounded-xl border px-2.5 py-2 ${item.tone}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-400 leading-5">{item.desc}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'correspondence' && (
          <InternalMailTab
            department="procurement_manager"
            title="نظام المراسلات الموحد - إدارة المواد"
          />
        )}

      </div>
    </div>
  );
}
