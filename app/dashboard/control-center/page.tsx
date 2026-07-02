'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Crown, ArrowRight, Activity, Bell, MonitorDot,
  BarChart3, Gauge, BookOpen, Users, Radio,
  PenLine, CheckSquare, MapPin, Zap, Shield,
  ChevronRight,
} from 'lucide-react';

export default function ControlCenterPage() {
  const [pendingSup, setPendingSup] = useState(0);
  const [pendingDept, setPendingDept] = useState(0);
  const [alarms, setAlarms]         = useState(0);

  useEffect(() => {
    fetch('/api/control-center/readings/pending-count').then(r => r.json())
      .then(d => { if (d.success) { setPendingSup(d.supervisor); setPendingDept(d.dept); } })
      .catch(() => {});
    fetch('/api/control-center/alarms?state=active&limit=1').then(r => r.json())
      .then(d => { if (d.success) setAlarms(d.count ?? 0); })
      .catch(() => {});
  }, []);

  const totalPending = pendingSup + pendingDept;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-7">

        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-3">
            <ArrowRight className="w-4 h-4"/>الداشبورد الرئيسي
          </Link>
          <h1 className="text-2xl font-bold text-white">إدارة التحكم</h1>
          <p className="text-slate-400 text-sm mt-1">مركز التحكم الشبكي — مراقبة 24/7 لمنظومة الحساوات</p>
        </div>

        {/* ══ 1. مدير الإدارة ════════════════════════════════════════════ */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">الإدارة العليا</p>
          <Link href="/dashboard/control-center/manager" className="group block">
            <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 hover:border-cyan-500/60 hover:bg-slate-800/60 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Crown className="w-6 h-6 text-cyan-400"/>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-white">لوحة مدير إدارة التحكم</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse font-bold">LIVE</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">KPIs حية · موافقات مباشرة · تنبيهات · حالة 14 محطة · تحديث تلقائي</p>
                </div>
                {/* Live badges */}
                <div className="flex items-center gap-2 shrink-0">
                  {totalPending > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                      {totalPending} معلق
                    </span>
                  )}
                  {alarms > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500 text-white font-bold">
                      {alarms} إنذار
                    </span>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors shrink-0"/>
              </div>
              {/* Quick tools row inside manager card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-[11px]">
                {[
                  { icon: Activity,  label: 'SCADA المباشر',       href: '/dashboard/control-center/real-time' },
                  { icon: Shield,    label: 'اعتماد القراءات',      href: '/dashboard/control-center/readings-approval' },
                  { icon: Bell,      label: 'إدارة الإنذارات',      href: '/dashboard/control-center/alarm-management' },
                  { icon: BookOpen,  label: 'سجل النوبات',          href: '/dashboard/control-center/shift-log' },
                ].map(({ icon: Icon, label, href }) => (
                  <Link key={href} href={href} onClick={e => e.stopPropagation()}
                    className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/30 transition-colors">
                    <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0"/>{label}
                  </Link>
                ))}
              </div>
            </div>
          </Link>
        </section>

        {/* ══ 2. الأقسام التشغيلية ═══════════════════════════════════════ */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">الأقسام التشغيلية</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* قسم تشغيل المنظومة */}
            <Link href="/dashboard/control-center/scada" className="group">
              <div className="bg-slate-900 border border-rose-500/25 rounded-2xl p-5 hover:border-rose-500/50 hover:bg-slate-800/60 transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                    <MonitorDot className="w-5 h-5 text-rose-400"/>
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">قسم تشغيل المنظومة</p>
                    <p className="text-[10px] text-rose-400/70">System Operations</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-400 flex-1">
                  <div className="flex items-center gap-2"><MonitorDot className="w-3 h-3 text-rose-400"/>SCADA P&ID الكامل</div>
                  <div className="flex items-center gap-2"><Zap className="w-3 h-3 text-rose-400"/>حالة المضخات والمحركات</div>
                  <div className="flex items-center gap-2"><Activity className="w-3 h-3 text-rose-400"/>التقارير اليومية (Excel)</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-rose-400 font-semibold flex items-center gap-1">
                  دخول القسم<ChevronRight className="w-3.5 h-3.5"/>
                </div>
              </div>
            </Link>

            {/* قسم التحليل والجدولة */}
            <Link href="/dashboard/control-center/production-schedule" className="group">
              <div className="bg-slate-900 border border-emerald-500/25 rounded-2xl p-5 hover:border-emerald-500/50 hover:bg-slate-800/60 transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-5 h-5 text-emerald-400"/>
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">قسم التحليل والجدولة</p>
                    <p className="text-[10px] text-emerald-400/70">Analysis & Scheduling</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-400 flex-1">
                  <div className="flex items-center gap-2"><BarChart3 className="w-3 h-3 text-emerald-400"/>جدولة الإنتاج اليومي</div>
                  <div className="flex items-center gap-2"><Gauge className="w-3 h-3 text-emerald-400"/>تحليل مناطق الضغط</div>
                  <div className="flex items-center gap-2"><Activity className="w-3 h-3 text-emerald-400"/>تحليل الفاقد NRW</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  دخول القسم<ChevronRight className="w-3.5 h-3.5"/>
                </div>
              </div>
            </Link>

            {/* قسم الإنذارات والنوبات */}
            <Link href="/dashboard/control-center/alarm-management" className="group">
              <div className="bg-slate-900 border border-amber-500/25 rounded-2xl p-5 hover:border-amber-500/50 hover:bg-slate-800/60 transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-amber-400"/>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">قسم الإنذارات والنوبات</p>
                    <p className="text-[10px] text-amber-400/70">Alarms & Shift Management</p>
                  </div>
                  {alarms > 0 && <span className="text-[10px] px-2 py-0.5 bg-rose-500 text-white font-bold rounded-full">{alarms}</span>}
                </div>
                <div className="space-y-1.5 text-xs text-slate-400 flex-1">
                  <div className="flex items-center gap-2"><Bell className="w-3 h-3 text-amber-400"/>تصنيف الإنذارات (حرج/تحذير)</div>
                  <div className="flex items-center gap-2"><BookOpen className="w-3 h-3 text-amber-400"/>سجل تسليم النوبات</div>
                  <div className="flex items-center gap-2"><CheckSquare className="w-3 h-3 text-amber-400"/>أوامر الصيانة الطارئة</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-amber-400 font-semibold flex items-center gap-1">
                  دخول القسم<ChevronRight className="w-3.5 h-3.5"/>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* ══ 3. العمليات الميدانية ════════════════════════════════════════ */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">العمليات الميدانية — الراصدون</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* فرق الرصد */}
            <Link href="/dashboard/control-center/monitoring-teams" className="group">
              <div className="bg-slate-900 border border-violet-500/25 rounded-2xl p-5 hover:border-violet-500/50 hover:bg-slate-800/60 transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-violet-400"/>
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">فرق الرصد الميداني</p>
                    <p className="text-[10px] text-violet-400/70">Field Monitoring Teams</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-400 flex-1">
                  <div className="flex items-center gap-2"><Users className="w-3 h-3 text-violet-400"/>تكوين فرق الراصدين</div>
                  <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-violet-400"/>تخصيص المحطات</div>
                  <div className="flex items-center gap-2"><Radio className="w-3 h-3 text-violet-400"/>ربط التطبيق المحمول</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-violet-400 font-semibold flex items-center gap-1">
                  إدارة الفرق<ChevronRight className="w-3.5 h-3.5"/>
                </div>
              </div>
            </Link>

            {/* تسجيل القراءات */}
            <Link href="/dashboard/control-center/field-readings" className="group">
              <div className="bg-slate-900 border border-teal-500/25 rounded-2xl p-5 hover:border-teal-500/50 hover:bg-slate-800/60 transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center shrink-0">
                    <PenLine className="w-5 h-5 text-teal-400"/>
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">تسجيل القراءات</p>
                    <p className="text-[10px] text-teal-400/70">Field Data Entry — الراصد</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-400 flex-1">
                  <div className="flex items-center gap-2"><PenLine className="w-3 h-3 text-teal-400"/>تدفق · ضغط · منسوب · كلور</div>
                  <div className="flex items-center gap-2"><Activity className="w-3 h-3 text-teal-400"/>14 محطة · 4 ورديات</div>
                  <div className="flex items-center gap-2"><CheckSquare className="w-3 h-3 text-teal-400"/>إرسال للمشرف للاعتماد</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-teal-400 font-semibold flex items-center gap-1">
                  نموذج الإدخال<ChevronRight className="w-3.5 h-3.5"/>
                </div>
              </div>
            </Link>

            {/* اعتماد القراءات */}
            <Link href="/dashboard/control-center/readings-approval" className="group">
              <div className="bg-slate-900 border border-indigo-500/25 rounded-2xl p-5 hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-indigo-400"/>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">اعتماد القراءات</p>
                    <p className="text-[10px] text-indigo-400/70">Approval Workflow</p>
                  </div>
                  {totalPending > 0 && (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-500 text-white font-bold rounded-full animate-pulse shrink-0">{totalPending}</span>
                  )}
                </div>
                <div className="space-y-1.5 text-xs text-slate-400 flex-1">
                  {pendingSup > 0 && <div className="text-amber-300 font-medium">{pendingSup} قراءة بانتظار المشرف</div>}
                  {pendingDept > 0 && <div className="text-blue-300 font-medium">{pendingDept} قراءة بانتظار إدارة التحكم</div>}
                  {totalPending === 0 && <div className="text-emerald-400">✓ لا توجد قراءات معلقة</div>}
                  <div className="flex items-center gap-2 text-slate-400"><Activity className="w-3 h-3 text-indigo-400"/>موافقة → SCADA مباشرة</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-indigo-400 font-semibold flex items-center gap-1">
                  لوحة الاعتماد<ChevronRight className="w-3.5 h-3.5"/>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* ══ 4. روابط سريعة ════════════════════════════════════════════ */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">وصول سريع</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {[
              { href: '/dashboard/control-center/manager',            icon: Crown,        label: 'لوحة المدير',     color: 'border-cyan-500/20 text-cyan-400 bg-cyan-500/10' },
              { href: '/dashboard/control-center/real-time',          icon: Activity,     label: 'SCADA مباشر',    color: 'border-sky-500/20 text-sky-400 bg-sky-500/10' },
              { href: '/dashboard/control-center/alarm-management',   icon: Bell,         label: 'الإنذارات',       color: 'border-rose-500/20 text-rose-400 bg-rose-500/10' },
              { href: '/dashboard/control-center/shift-log',          icon: BookOpen,     label: 'سجل النوبات',    color: 'border-violet-500/20 text-violet-400 bg-violet-500/10' },
              { href: '/dashboard/control-center/monitoring-teams',   icon: Users,        label: 'فرق الرصد',       color: 'border-indigo-500/20 text-indigo-400 bg-indigo-500/10' },
              { href: '/dashboard/control-center/pressure-zones',     icon: Gauge,        label: 'مناطق الضغط',    color: 'border-amber-500/20 text-amber-400 bg-amber-500/10' },
              { href: '/dashboard/control-center/production-schedule',icon: BarChart3,    label: 'الإنتاج',         color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' },
              { href: '/dashboard/control-center/scada',              icon: MonitorDot,   label: 'SCADA كامل',     color: 'border-rose-500/20 text-rose-400 bg-rose-500/10' },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link key={href} href={href}
                className={`border rounded-xl p-2.5 flex flex-col items-center gap-1.5 text-center hover:opacity-80 transition-opacity ${color}`}>
                <Icon className="w-4 h-4"/>
                <span className="text-[10px] font-semibold leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
