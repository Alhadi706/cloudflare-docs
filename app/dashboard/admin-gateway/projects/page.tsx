'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, Briefcase, CheckSquare, Target, FileText,
  DollarSign, MapPin, Activity, Send, Inbox, Mail, Map, BarChart2,
  Calendar, AlertTriangle, TrendingUp, ChevronLeft, Users, Layers,
  Shield, Eye, Lock,
} from 'lucide-react';

const API_BASE = '/api/v1/dept-admin';
function getHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'x-tenant-id': tenantId } : {};
}

interface ProjectStats {
  total: number; active: number; completed: number; delayed: number;
  avg_progress: number; pending_tasks: number; inbox_count: number;
}

export default function ProjectsHubPage() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/projects/stats`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setStats({
        total: d.total ?? 0, active: d.active ?? 0, completed: d.completed ?? 0,
        delayed: d.delayed ?? 0, avg_progress: d.avg_progress ?? 0,
        pending_tasks: d.pending_tasks ?? 0, inbox_count: d.inbox_count ?? 0,
      })).catch(() => {});
  }, []);

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-hidden flex flex-col" dir="rtl">
      <div className="flex-1 min-h-0 flex flex-col max-w-5xl mx-auto w-full px-4 py-4 gap-4">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <Link href="/dashboard/admin-gateway"
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-1">
              <ArrowRight className="w-4 h-4" />البوابة الإدارية
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">إدارة المشاريع</h1>
            <p className="text-slate-400 text-xs mt-0.5">Project Management — Planning · Execution · Control</p>
          </div>
          <Link href="/dashboard/admin-gateway/projects/manager"
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/20 transition-colors">
            <Crown className="w-4 h-4" />لوحة مدير الإدارة
          </Link>
        </div>

        {/* Stats row */}
        {stats !== null && (
          <div className="grid grid-cols-4 gap-2 shrink-0">
            <div className="bg-slate-900 border border-purple-500/20 rounded-xl px-3 py-2 text-center">
              <p className="text-xl font-bold text-purple-400">{stats.active}</p>
              <p className="text-[11px] text-slate-500">مشاريع نشطة</p>
            </div>
            <div className="bg-slate-900 border border-emerald-500/20 rounded-xl px-3 py-2 text-center">
              <p className="text-xl font-bold text-emerald-400">{stats.completed}</p>
              <p className="text-[11px] text-slate-500">مكتملة</p>
            </div>
            <div className="bg-slate-900 border border-amber-500/20 rounded-xl px-3 py-2 text-center">
              <p className="text-xl font-bold text-amber-400">{stats.avg_progress}%</p>
              <p className="text-[11px] text-slate-500">متوسط الإنجاز</p>
            </div>
            <div className={`bg-slate-900 border rounded-xl px-3 py-2 text-center ${stats.delayed > 0 ? 'border-red-500/20' : 'border-slate-700/30'}`}>
              <p className={`text-xl font-bold ${stats.delayed > 0 ? 'text-red-400' : 'text-slate-400'}`}>{stats.delayed}</p>
              <p className="text-[11px] text-slate-500">متأخرة</p>
            </div>
          </div>
        )}

        {/* 4 Main Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">

          {/* قائمة المشاريع */}
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl overflow-hidden flex flex-col hover:border-purple-500/50 transition-all">
            <Link href="/dashboard/admin-gateway/projects/list" className="group flex-1 flex flex-col p-5 hover:bg-slate-800/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0"><Briefcase className="w-5 h-5 text-purple-400" /></div>
                <div><h2 className="text-base font-bold text-white">قائمة المشاريع</h2><p className="text-purple-400/70 text-xs">Projects List</p></div>
              </div>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">إنشاء المشاريع وتتبع تقدمها وإدارة دورة حياتها الكاملة.</p>
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {[{i:<Briefcase className="w-3 h-3"/>,l:'إنشاء مشروع'},{i:<Activity className="w-3 h-3"/>,l:'حالة المشاريع'},{i:<TrendingUp className="w-3 h-3"/>,l:'نسب الإنجاز'},{i:<Users className="w-3 h-3"/>,l:'فرق المشاريع'},{i:<Target className="w-3 h-3"/>,l:'الأهداف'},{i:<AlertTriangle className="w-3 h-3"/>,l:'المخاطر'}].map(f=>(
                  <div key={f.l} className="flex items-center gap-1.5 text-slate-400 text-[11px]"><span className="text-purple-400 shrink-0">{f.i}</span>{f.l}</div>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-800 mt-3">
                <span className="text-purple-400 font-semibold text-xs flex items-center gap-1">فتح قائمة المشاريع <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
              </div>
            </Link>
            <Link href="/dashboard/admin-gateway/projects/tasks" className="group border-t border-slate-700/60 px-5 py-2.5 hover:bg-blue-950/20 transition-all flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center shrink-0"><CheckSquare className="w-3.5 h-3.5 text-blue-400" /></div>
                <span className="text-xs font-semibold text-white">المهام والتسليمات</span>
                {stats && stats.pending_tasks > 0 && <span className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{stats.pending_tasks}</span>}
                <span className="text-[10px] text-slate-500">تتبع · تعيين · جدولة</span>
              </div>
              <ChevronLeft className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-[-2px] transition-transform" />
            </Link>
          </div>

          {/* الجداول الزمنية */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl overflow-hidden flex flex-col hover:border-amber-500/50 transition-all">
            <Link href="/dashboard/admin-gateway/projects/milestones" className="group flex-1 flex flex-col p-5 hover:bg-slate-800/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0"><Calendar className="w-5 h-5 text-amber-400" /></div>
                <div><h2 className="text-base font-bold text-white">الجداول الزمنية</h2><p className="text-amber-400/70 text-xs">Milestones & Schedules</p></div>
              </div>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">تحديد المعالم الرئيسية ومتابعة الجداول الزمنية.</p>
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {[{i:<Target className="w-3 h-3"/>,l:'المعالم الرئيسية'},{i:<Calendar className="w-3 h-3"/>,l:'الجداول الزمنية'},{i:<Activity className="w-3 h-3"/>,l:'تقارير الإنجاز'},{i:<AlertTriangle className="w-3 h-3"/>,l:'التنبيهات'},{i:<TrendingUp className="w-3 h-3"/>,l:'مؤشرات الأداء'},{i:<BarChart2 className="w-3 h-3"/>,l:'مقارنة الأداء'}].map(f=>(
                  <div key={f.l} className="flex items-center gap-1.5 text-slate-400 text-[11px]"><span className="text-amber-400 shrink-0">{f.i}</span>{f.l}</div>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-800 mt-3">
                <span className="text-amber-400 font-semibold text-xs flex items-center gap-1">فتح الجداول <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
              </div>
            </Link>
            <Link href="/dashboard/admin-gateway/projects/budget" className="group border-t border-slate-700/60 px-5 py-2.5 hover:bg-emerald-950/20 transition-all flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center shrink-0"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /></div>
                <span className="text-xs font-semibold text-white">ميزانية المشاريع</span>
                <span className="text-[10px] text-slate-500">تخطيط · صرف · تحليل</span>
              </div>
              <ChevronLeft className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-[-2px] transition-transform" />
            </Link>
          </div>

          {/* الوثائق */}
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl overflow-hidden flex flex-col hover:border-violet-500/50 transition-all">
            <Link href="/dashboard/admin-gateway/projects/documents" className="group flex-1 flex flex-col p-5 hover:bg-slate-800/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-violet-400" /></div>
                <div><h2 className="text-base font-bold text-white">الوثائق والتقارير</h2><p className="text-violet-400/70 text-xs">Documents & Reports</p></div>
              </div>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">رفع وتنظيم وأرشفة مستندات المشاريع والتقارير.</p>
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {[{i:<FileText className="w-3 h-3"/>,l:'رفع المستندات'},{i:<Layers className="w-3 h-3"/>,l:'التصنيف'},{i:<Activity className="w-3 h-3"/>,l:'تقارير الأداء'},{i:<Target className="w-3 h-3"/>,l:'مخططات المشروع'},{i:<BarChart2 className="w-3 h-3"/>,l:'الأرشيف'},{i:<TrendingUp className="w-3 h-3"/>,l:'المشاركة'}].map(f=>(
                  <div key={f.l} className="flex items-center gap-1.5 text-slate-400 text-[11px]"><span className="text-violet-400 shrink-0">{f.i}</span>{f.l}</div>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-800 mt-3">
                <span className="text-violet-400 font-semibold text-xs flex items-center gap-1">فتح الوثائق <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
              </div>
            </Link>
            <Link href="/dashboard/admin-gateway/projects/sites" className="group border-t border-slate-700/60 px-5 py-2.5 hover:bg-cyan-950/20 transition-all flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center shrink-0"><MapPin className="w-3.5 h-3.5 text-cyan-400" /></div>
                <span className="text-xs font-semibold text-white">المواقع الميدانية</span>
                <span className="text-[10px] text-slate-500">مواقع · وحدات · فرق</span>
              </div>
              <ChevronLeft className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-[-2px] transition-transform" />
            </Link>
          </div>

          {/* المراسلات */}
          <div className="bg-slate-900 border border-sky-500/30 rounded-2xl overflow-hidden flex flex-col hover:border-sky-500/50 transition-all">
            <Link href="/dashboard/admin-gateway/projects/correspondence" className="group flex-1 flex flex-col p-5 hover:bg-slate-800/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0"><Mail className="w-5 h-5 text-sky-400" /></div>
                <div><h2 className="text-base font-bold text-white">نظام المراسلات الموحد</h2><p className="text-sky-400/70 text-xs">Unified Correspondence</p></div>
              </div>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">إدارة جميع مراسلات إدارة المشاريع — الوارد والصادر والمذكرات.</p>
              <div className="grid grid-cols-3 gap-1.5 flex-1">
                {[{i:<Inbox className="w-3 h-3"/>,l:'الواردة'},{i:<Send className="w-3 h-3"/>,l:'الصادرة'},{i:<Mail className="w-3 h-3"/>,l:'الداخلية'},{i:<FileText className="w-3 h-3"/>,l:'الأرشيف'},{i:<Activity className="w-3 h-3"/>,l:'متابعة الردود'},{i:<AlertTriangle className="w-3 h-3"/>,l:'العاجلة'}].map(f=>(
                  <div key={f.l} className="flex items-center gap-1.5 text-slate-400 text-[11px]"><span className="text-sky-400 shrink-0">{f.i}</span>{f.l}</div>
                ))}
              </div>
              {stats && stats.inbox_count > 0 && (
                <div className="flex gap-4 text-[11px] mt-3 bg-slate-800/60 rounded-lg px-3 py-1.5">
                  <span className="text-slate-400">الوارد: <span className="text-sky-300 font-semibold">{stats.inbox_count}</span></span>
                </div>
              )}
              <div className="pt-3 border-t border-slate-800 mt-3">
                <span className="text-sky-400 font-semibold text-xs flex items-center gap-1">فتح المراسلات <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
              </div>
            </Link>
            <Link href="/dashboard/admin-gateway/correspondence/incoming" className="group border-t border-slate-700/60 px-5 py-2.5 hover:bg-emerald-950/20 transition-all flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center shrink-0"><Inbox className="w-3.5 h-3.5 text-emerald-400" /></div>
                <span className="text-xs font-semibold text-white">المراسلات العامة</span>
                <span className="text-[10px] text-slate-500">الوارد · الصادر · الأرشيف</span>
              </div>
              <ChevronLeft className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-[-2px] transition-transform" />
            </Link>
          </div>
        </div>

        {/* الخريطة */}
        <div className="shrink-0">
          <Link href="/dashboard/admin-gateway/projects/map" className="group block">
            <div className="relative overflow-hidden bg-slate-900 border border-cyan-500/30 rounded-2xl px-5 py-4 hover:border-cyan-500/60 hover:bg-slate-800/60 transition-all">
              <div className="absolute inset-0 bg-gradient-to-l from-cyan-950/30 via-transparent to-blue-950/20 pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center ring-1 ring-cyan-500/30 shrink-0">
                  <Map className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white">نظام عرض الخرائط والمواقع</h2>
                    <span className="text-[10px] text-cyan-400/70 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">Spatial View</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">عرض مواقع المشاريع الميدانية — حدود المشاريع — خطوط الأنابيب — طبقات GIS</p>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  {[{i:<MapPin className="w-3 h-3"/>,l:'المواقع'},{i:<Layers className="w-3 h-3"/>,l:'الطبقات'},{i:<Map className="w-3 h-3"/>,l:'GIS'}].map(f=>(
                    <div key={f.l} className="flex items-center gap-1 text-slate-400 text-[11px]"><span className="text-cyan-400">{f.i}</span>{f.l}</div>
                  ))}
                  <span className="text-cyan-400 font-semibold text-xs flex items-center gap-1">فتح الخرائط <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* التحكم في الطبقة */}
        <div className="shrink-0">
          <Link href="/dashboard/admin-gateway/projects/layer-access" className="group block">
            <div className="relative overflow-hidden bg-slate-900 border border-teal-500/30 rounded-2xl px-5 py-4 hover:border-teal-500/60 hover:bg-slate-800/60 transition-all">
              <div className="absolute inset-0 bg-gradient-to-l from-teal-950/20 via-transparent pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center ring-1 ring-teal-500/30 shrink-0">
                  <Shield className="w-5 h-5 text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white">التحكم في رؤية طبقة المشاريع</h2>
                    <span className="text-[10px] text-teal-400/70 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">Layer Access Control</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">منح أو سحب صلاحية الإدارات الأخرى لرؤية مشاريعك على الخريطة الموحدة</p>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  {[{i:<Lock className="w-3 h-3"/>,l:'التحكم'},{i:<Eye className="w-3 h-3"/>,l:'المنح'},{i:<Shield className="w-3 h-3"/>,l:'الأمان'}].map(f=>(
                    <div key={f.l} className="flex items-center gap-1 text-slate-400 text-[11px]"><span className="text-teal-400">{f.i}</span>{f.l}</div>
                  ))}
                  <span className="text-teal-400 font-semibold text-xs flex items-center gap-1">إدارة الصلاحيات <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* لوحة القيادة */}
        <div className="shrink-0">
          <Link href="/dashboard/admin-gateway/projects/dashboard" className="group block">
            <div className="relative overflow-hidden bg-slate-900 border border-rose-500/30 rounded-2xl px-5 py-4 hover:border-rose-500/60 hover:bg-slate-800/60 transition-all">
              <div className="absolute inset-0 bg-gradient-to-l from-rose-950/30 via-transparent to-amber-950/20 pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/30 to-amber-500/20 flex items-center justify-center ring-1 ring-rose-500/30 shrink-0">
                  <Crown className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white">لوحة القيادة التنفيذية</h2>
                    <span className="text-[10px] text-rose-400/70 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">Executive Dashboard</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">رؤية استراتيجية: مؤشرات KPI · الميزانيات · نسب الإنجاز · المشاريع المتأخرة</p>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  {[{i:<BarChart2 className="w-3 h-3"/>,l:'KPI'},{i:<TrendingUp className="w-3 h-3"/>,l:'الاتجاهات'},{i:<AlertTriangle className="w-3 h-3"/>,l:'المخاطر'}].map(f=>(
                    <div key={f.l} className="flex items-center gap-1 text-slate-400 text-[11px]"><span className="text-rose-400">{f.i}</span>{f.l}</div>
                  ))}
                  <span className="text-rose-400 font-semibold text-xs flex items-center gap-1">فتح لوحة القيادة <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* مسار سير العمل */}
        <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium shrink-0">مسار المشروع:</span>
            <span className="rounded-full border border-purple-700/50 bg-purple-900/20 px-2.5 py-0.5 text-purple-300">إنشاء المشروع</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="rounded-full border border-amber-700/50 bg-amber-900/20 px-2.5 py-0.5 text-amber-300">تحديد المعالم</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="rounded-full border border-blue-700/50 bg-blue-900/20 px-2.5 py-0.5 text-blue-300">توزيع المهام</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="rounded-full border border-emerald-700/50 bg-emerald-900/20 px-2.5 py-0.5 text-emerald-300">متابعة وإغلاق</span>
          </div>
        </div>

      </div>
    </div>
  );
}
