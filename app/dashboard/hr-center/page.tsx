'use client';
import React from 'react';
import Link from 'next/link';
import {
  ArrowRight, Crown, Calendar,
  Users, GraduationCap, BarChart2, LayoutGrid, HeartPulse,
  ClipboardList, Target, TrendingUp, ShieldCheck,
  Clock, FileText, Award, Briefcase, GitBranch, UserCircle,
  Building2, PieChart, Receipt, FileBarChart,
} from 'lucide-react';

export default function HRCenterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            لوحة التحكم
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">إدارة الموارد البشرية</h1>
          <p className="text-slate-400 mt-2">اختر القسم أو الواجهة المطلوبة للمتابعة</p>
        </div>

        {/* Manager Card */}
        <Link href="/dashboard/hr-center/manager" className="group block">
          <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 hover:border-blue-500/60 hover:bg-slate-800/70 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">مدير إدارة الموارد البشرية</h2>
                <p className="text-blue-400/70 text-xs mt-0.5">HR Department Manager Dashboard</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              صلاحيات إدارية كاملة: الإشراف على الأقسام الخمسة، اعتماد الترقيات، تعيين الموظفين على الوظائف القيادية، ومراسلة الإدارات الأخرى.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-4">
              {[
                { icon: Users,        text: 'الإشراف على الأقسام' },
                { icon: Target,       text: 'اعتماد قرارات التوظيف' },
                { icon: ClipboardList,text: 'متابعة مسارات الأوامر' },
                { icon: ShieldCheck,  text: 'التقارير التنفيذية' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-blue-400 mb-1" />
                  {text}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="text-blue-400 font-semibold text-sm flex items-center gap-1.5">
                فتح لوحة المدير
                <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span>
              </span>
            </div>
          </div>
        </Link>

        {/* Section Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* 1 — شؤون الموظفين */}
          <Link href="/dashboard/hr-center/personnel" className="group block">
            <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم شؤون الموظفين</h2>
                  <p className="text-cyan-400/70 text-xs mt-0.5">Personnel Administration</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                سجلات الموظفين، عقود العمل، الحضور والانصراف، الإجازات، الترقيات والدرجات.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-cyan-400" /> سجل الموظفين وعقود العمل</div>
                <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-cyan-400" /> الحضور والانصراف والإجازات</div>
                <div className="flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> الترقيات والدرجات الوظيفية</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-cyan-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          {/* 2 — التدريب والتطوير */}
          <Link href="/dashboard/hr-center/training" className="group block">
            <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-6 hover:border-teal-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col relative">
              <span className="absolute top-3 left-3 text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-400 border border-teal-700/50">قيد الإنشاء</span>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-teal-500/20 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم التدريب والتطوير</h2>
                  <p className="text-teal-400/70 text-xs mt-0.5">Competence Development — ISO 10015</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                خطط التدريب السنوية، تنسيق الدورات، وتحليل الاحتياجات التدريبية للأقسام.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><ClipboardList className="w-3.5 h-3.5 text-teal-400" /> خطط التدريب السنوية</div>
                <div className="flex items-center gap-2"><GraduationCap className="w-3.5 h-3.5 text-teal-400" /> الدورات الداخلية والخارجية</div>
                <div className="flex items-center gap-2"><Target className="w-3.5 h-3.5 text-teal-400" /> تحليل الاحتياجات التدريبية</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-teal-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          {/* 3 — البيانات والإحصاء */}
          <Link href="/dashboard/hr-center/data" className="group block">
            <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-6 hover:border-sky-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
                  <BarChart2 className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم البيانات والإحصاء</h2>
                  <p className="text-sky-400/70 text-xs mt-0.5">Workforce Analytics — ISO 30405</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                الدراسات والبحوث التحليلية وتقارير تقييم الأداء المؤسسي.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><BarChart2 className="w-3.5 h-3.5 text-sky-400" /> الدراسات والبحوث التحليلية</div>
                <div className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-sky-400" /> تقييم الأداء المؤسسي</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-sky-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          {/* 3 — النظم والملاكات */}
          <Link href="/dashboard/hr-center/staffing" className="group block">
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 hover:border-amber-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم النظم والملاكات</h2>
                  <p className="text-amber-400/70 text-xs mt-0.5">Organizational Design & Staffing</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                الهيكل التنظيمي، الأقسام الإدارية، الملاك الوظيفي والشغور، والأقسام الفرعية.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><GitBranch className="w-3.5 h-3.5 text-amber-400" /> هيكل الإدارات والتبعية التنظيمية</div>
                <div className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-amber-400" /> الملاك الوظيفي والشغور</div>
                <div className="flex items-center gap-2"><LayoutGrid className="w-3.5 h-3.5 text-amber-400" /> الأقسام الإدارية والأقسام الفرعية</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-amber-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          {/* 4 — البيانات والإحصاء */}
          <Link href="/dashboard/hr-center/data" className="group block">
            <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-6 hover:border-sky-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
                  <BarChart2 className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم البيانات والإحصاء</h2>
                  <p className="text-sky-400/70 text-xs mt-0.5">Workforce Analytics — ISO 30405</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                إحصائيات القوى العاملة، الدراسات والبحوث، وتقارير الشغور الوظيفي.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><BarChart2 className="w-3.5 h-3.5 text-sky-400" /> إحصائيات القوى العاملة</div>
                <div className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-sky-400" /> بيانات الأقسام والشغور</div>
                <div className="flex items-center gap-2"><Award className="w-3.5 h-3.5 text-sky-400" /> الدراسات والبحوث التحليلية</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-sky-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

          {/* 5 — الشؤون الطبية */}
          <Link href="/dashboard/hr-center/medical" className="group block">
            <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 hover:border-rose-500/60 hover:bg-slate-800/70 transition-all duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">قسم الشؤون الطبية</h2>
                  <p className="text-rose-400/70 text-xs mt-0.5">Occupational Health — ISO 45001</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                السجلات الطبية، شهادات اللياقة الوظيفية، عقود المصحات، واسترجاعات العلاج.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 flex-1">
                <div className="flex items-center gap-2"><HeartPulse className="w-3.5 h-3.5 text-rose-400" /> السجلات وشهادات اللياقة</div>
                <div className="flex items-center gap-2"><UserCircle className="w-3.5 h-3.5 text-rose-400" /> عقود المصحات والعيادات</div>
                <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-rose-400" /> استرجاعات العلاج</div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800">
                <span className="text-rose-400 font-semibold text-sm flex items-center gap-1.5">فتح القسم <span className="group-hover:translate-x-[-4px] transition-transform inline-block">←</span></span>
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}


/**
 * HR Center — إدارة الموارد البشرية
 * Sections aligned with ISO 30400 series (HR Management Vocabulary)
 * & ISO 10015 (Competence Development / Training)
 */

// ── 1. شؤون الموظفين — ISO 30400: Personnel Administration
const personnelLinks = [
  { href: '/dashboard/admin-gateway/hr/employees',        icon: Users,        label: 'سجل الموظفين',        desc: 'بيانات الموظفين وملفاتهم الوظيفية الرسمية',    color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { href: '/dashboard/admin-gateway/hr/contracts',        icon: FileText,     label: 'عقود العمل',          desc: 'العقود الوظيفية ومدد الخدمة والتجديد',         color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { href: '/dashboard/admin-gateway/hr/attendance',       icon: Clock,        label: 'الحضور والانصراف',   desc: 'سجلات الحضور اليومي والتأخر والغياب',          color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  { href: '/dashboard/admin-gateway/hr/leave-management', icon: Calendar,     label: 'الإجازات',            desc: 'طلبات الإجازة السنوية والاعتيادية والطارئة',    color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
  { href: '/dashboard/admin-gateway/hr/promotions',       icon: TrendingUp,   label: 'الترقيات',            desc: 'مسارات الترقية وقرارات الدرجات الوظيفية',      color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20' },
  { href: '/dashboard/admin-gateway/hr/grades',           icon: Award,        label: 'الدرجات الوظيفية',   desc: 'سلّم الدرجات والفئات الوظيفية المعتمدة',       color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
];

// ── 2. التدريب والتطوير — ISO 10015: Competence Development
const trainingLinks = [
  { href: '/dashboard/hr-center/training/plans',          icon: ClipboardList,label: 'خطط التدريب السنوية', desc: 'خطط التدريب بحسب احتياجات الأقسام والكوادر',   color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20', badge: 'قيد الإنشاء' },
  { href: '/dashboard/hr-center/training/courses',        icon: GraduationCap,label: 'الدورات التدريبية',  desc: 'تنسيق الدورات الداخلية والخارجية وتوثيقها',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20', badge: 'قيد الإنشاء' },
  { href: '/dashboard/hr-center/training/needs',          icon: Target,       label: 'الاحتياجات التدريبية',desc: 'تحليل فجوات الكفاءات واحتياجات الأقسام',       color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20', badge: 'قيد الإنشاء' },
];

// ── 3. النظم والملاكات — ISO 30400-2: Organizational Design & Staffing
const staffingLinks = [
  { href: '/dashboard/admin-gateway/org-structure',       icon: GitBranch,    label: 'الهيكل التنظيمي',    desc: 'خرائط التبعية والهيكل الإداري للمؤسسة',        color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
  { href: '/dashboard/admin-gateway/hr/job-titles',       icon: Briefcase,    label: 'المسميات الوظيفية',  desc: 'المسميات والتصنيفات الوظيفية المعتمدة',         color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' },
  { href: '/dashboard/admin-gateway/hr/positions',        icon: LayoutGrid,   label: 'الملاك الوظيفي',      desc: 'الوظائف المعتمدة ومؤشرات الشغور',              color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { href: '/dashboard/admin-gateway/org-sections',        icon: Building2,    label: 'الأقسام الفرعية',    desc: 'الوحدات والشعب والأقسام الفرعية للإدارات',      color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
];

// ── 4. البيانات والإحصاء — ISO 30405: Workforce Analytics
const analyticsLinks = [
  { href: '/dashboard/hr-center/data',                    icon: BarChart2,    label: 'إحصائيات القوى العاملة', desc: 'توزيع الموظفين وعدد الأقسام والشغور الوظيفي', color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  { href: '/dashboard/admin-gateway/hr/departments',      icon: PieChart,     label: 'بيانات الأقسام',      desc: 'الهيكل القسمي وعدد الموظفين لكل وحدة',         color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  { href: '/dashboard/hr-center/data/studies',            icon: FileBarChart, label: 'الدراسات والبحوث',    desc: 'تقارير الأداء المؤسسي والدراسات التحليلية',     color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20', badge: 'قيد الإنشاء' },
];

// ── 5. الشؤون الطبية — ISO 45001: Occupational Health
const medicalLinks = [
  { href: '/dashboard/admin-gateway/hr/medical',          icon: HeartPulse,   label: 'السجلات الطبية',      desc: 'سجلات الموظفين الطبية وشهادات اللياقة الوظيفية', color: 'text-rose-400',   bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  { href: '/dashboard/hr-center/medical/providers',       icon: Building2,    label: 'المصحات والعيادات',   desc: 'عقود مزودي الخدمة الطبية والمصحات المتعاقدة',   color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/20', badge: 'قيد الإنشاء' },
  { href: '/dashboard/hr-center/medical/reimbursements',  icon: Receipt,      label: 'استرجاعات العلاج',    desc: 'طلبات الاسترجاع وتتبع حالة صرف العلاج',         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20', badge: 'قيد الإنشاء' },
];

type CardDef = { href: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string; color: string; bg: string; border: string; badge?: string };

function Section({ title, subtitle, items }: { title: string; subtitle: string; items: CardDef[] }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-2 mb-3 px-1">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h2>
        <span className="text-[10px] text-slate-600 normal-case tracking-normal">{subtitle}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(({ href, icon: Icon, label, desc, color, bg, border, badge }) => (
          <Link key={href} href={href}
            className={`group flex flex-col gap-3 p-4 rounded-xl border ${border} ${bg} hover:scale-[1.02] transition-transform relative`}>
            {badge && (
              <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600">{badge}</span>
            )}
            <div className={`w-9 h-9 rounded-lg bg-slate-900 border ${border} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${color}`}>{label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

