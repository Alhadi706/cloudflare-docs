'use client';
import React from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, Wrench,
  ClipboardList, Brain, CalendarClock,
  BarChart2, Bot, MapPin, Users, PackageOpen, Activity,
  Settings, Zap,
} from 'lucide-react';

export default function MaintenanceHubPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            لوحة التحكم
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">إدارة الهندسة والدعم الفني</h1>
          <p className="text-slate-400 mt-2">Engineering & Technical Support Management</p>
        </div>

        {/* Manager Card */}
        <Link href="/dashboard/maintenance/manager" className="group block">
          <div className="bg-slate-900 border border-orange-500/30 rounded-2xl p-6 hover:border-orange-500/60 hover:bg-slate-800/70 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">مدير إدارة الهندسة والدعم الفني</h2>
                <p className="text-orange-400/70 text-xs mt-0.5">Engineering & Technical Support Manager</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              صلاحيات إدارية كاملة: الإشراف على الأقسام الثلاثة، اعتماد أوامر العمل، متابعة التخطيط الوقائي، والتقارير التنفيذية.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-4">
              {[
                { icon: Wrench,        text: 'الإشراف على العمليات' },
                { icon: ClipboardList, text: 'اعتماد أوامر العمل' },
                { icon: CalendarClock, text: 'التخطيط الوقائي' },
                { icon: BarChart2,     text: 'التقارير التنفيذية' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-orange-400 mb-1" />
                  {text}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="text-orange-400 font-semibold text-sm flex items-center gap-1.5">
                فتح لوحة المدير
                <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span>
              </span>
            </div>
          </div>
        </Link>

        {/* Section Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* 1 — العمليات الميدانية */}
          <Link href="/dashboard/maintenance/operations" className="group block">
            <div className="bg-slate-900 border border-orange-500/30 rounded-2xl p-6 hover:border-orange-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم العمليات الميدانية</h2>
                  <p className="text-orange-400/70 text-xs mt-0.5">Field Operations</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                أوامر العمل الميدانية، جداول الصيانة الوقائية، ومراقبة الآبار.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><ClipboardList className="w-3.5 h-3.5 text-orange-400" /> إنشاء وتتبع أوامر العمل</div>
                <div className="flex items-center gap-2"><Settings className="w-3.5 h-3.5 text-orange-400" /> جداول الصيانة الوقائية</div>
                <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-orange-400" /> مراقبة وصيانة الآبار</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-orange-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          {/* 2 — الدعم الفني والتحليل */}
          <Link href="/dashboard/maintenance/technical" className="group block">
            <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 hover:border-blue-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Brain className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم الدعم الفني والتحليل</h2>
                  <p className="text-blue-400/70 text-xs mt-0.5">Technical Support & Analysis</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                تحليل الأعطال، المعايير الفنية، ومساحة العمل الهندسية على الخريطة.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-blue-400" /> تحليل الأعطال وأنماطها</div>
                <div className="flex items-center gap-2"><Wrench className="w-3.5 h-3.5 text-blue-400" /> المعايير والإجراءات الفنية</div>
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-blue-400" /> مساحة العمل الهندسية GIS</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-blue-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          {/* 3 — التخطيط والموارد */}
          <Link href="/dashboard/maintenance/planning" className="group block">
            <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-6 hover:border-violet-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم التخطيط والموارد</h2>
                  <p className="text-violet-400/70 text-xs mt-0.5">Planning & Resources</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                فرق العمل، مخزون قطع الغيار، والتحكم الآلي بالصيانة الذكية.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-violet-400" /> فرق الصيانة والكوادر</div>
                <div className="flex items-center gap-2"><PackageOpen className="w-3.5 h-3.5 text-violet-400" /> مخزون قطع الغيار</div>
                <div className="flex items-center gap-2"><Bot className="w-3.5 h-3.5 text-violet-400" /> التحكم الآلي الذكي</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-violet-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

        </div>

      </div>
    </div>
  );
}
