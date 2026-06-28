'use client';

import React from 'react';
import { BookOpen, Building2, FileText, BarChart2 } from 'lucide-react';
import Link from 'next/link';

export default function AccountingOverview() {
  const modules = [
    {
      title: 'دليل الحسابات',
      icon: <BookOpen className="w-8 h-8 text-indigo-400" />,
      color: 'bg-indigo-600/20 border-indigo-500/50',
      description: 'شجرة الحسابات الكاملة (أصول، خصوم، حقوق، إيرادات، مصروفات)',
      href: '/dashboard/admin-gateway/accounting/chart-of-accounts',
      badge: 'الأساس',
    },
    {
      title: 'مراكز التكلفة',
      icon: <Building2 className="w-8 h-8 text-teal-400" />,
      color: 'bg-teal-600/20 border-teal-500/50',
      description: 'مراكز تكلفة مرتبطة بمشاريع ومواقع للرقابة المالية',
      href: '/dashboard/admin-gateway/accounting/cost-centers',
      badge: 'هيكلي',
    },
    {
      title: 'القيود اليومية',
      icon: <FileText className="w-8 h-8 text-amber-400" />,
      color: 'bg-amber-600/20 border-amber-500/50',
      description: 'إدخال وترحيل القيود المحاسبية مع فرض التوازن المدين=الدائن',
      href: '/dashboard/admin-gateway/accounting/journal-entries',
      badge: 'تشغيلي',
    },
    {
      title: 'ملخص مالي',
      icon: <BarChart2 className="w-8 h-8 text-rose-400" />,
      color: 'bg-rose-600/20 border-rose-500/50',
      description: 'إجماليات القيود والحسابات ومراكز التكلفة لذكاء الأعمال',
      href: '/dashboard/admin-gateway/accounting/journal-entries',
      badge: 'ذكاء',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="bg-slate-900/60 border border-indigo-800/40 rounded-2xl p-6 flex items-center gap-5">
          <div className="bg-indigo-900/50 p-4 rounded-xl">
            <BookOpen className="w-10 h-10 text-indigo-400" />
          </div>
          <div>
            <div className="text-xs text-indigo-400 font-mono mb-1">PHASE ACCOUNTING-CORE-01</div>
            <h1 className="text-2xl font-bold text-slate-100">النواة المالية المحاسبية</h1>
            <p className="text-slate-400 mt-1 text-sm">
              دليل الحسابات · مراكز التكلفة · القيود اليومية — مُدمج مع المشتريات والمخزون والمشاريع
            </p>
          </div>
        </div>

        {/* breadcrumb */}
        <nav className="text-sm text-slate-500 flex items-center gap-2">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-300 transition-colors">بوابة الإدارة</Link>
          <span>/</span>
          <span className="text-slate-300">المحاسبة المالية</span>
        </nav>

        {/* Modules grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`group relative rounded-2xl border p-6 transition-all hover:scale-[1.02] hover:shadow-xl ${m.color}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-slate-900/40 p-3 rounded-xl">{m.icon}</div>
                <span className="text-xs font-mono bg-slate-900/50 text-slate-400 px-2 py-0.5 rounded">{m.badge}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1">{m.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{m.description}</p>
            </Link>
          ))}
        </div>

        {/* Government-ready banner */}
        <div className="bg-indigo-950/40 border border-indigo-700/30 rounded-xl p-4 text-sm text-indigo-300 flex items-start gap-3">
          <span className="text-indigo-500 text-lg mt-0.5">⚖</span>
          <div>
            <span className="font-semibold text-indigo-200">حاهزية حكومية:</span>{' '}
            النظام مُصمَّم وفق متطلبات القطاع العام الليبي — قيود متوازنة، ترحيل مُقفَل، مراكز تكلفة مرتبطة بمشاريع البنية التحتية.
          </div>
        </div>
      </div>
    </div>
  );
}
