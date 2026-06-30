'use client';
import Link from 'next/link';
import { FolderOpen, MapPin, CheckSquare, DollarSign, FileText, Flag, BarChart2, Map, RotateCcw, Activity } from 'lucide-react';
import DepartmentAssetInbox from '@/components/DepartmentAssetInbox';
import InternalMailTab from '@/components/InternalMailTab';

// ── المشروع 360° والقائمة الرئيسية
const coreLinks = [
  { href: '/dashboard/admin-gateway/projects/list', icon: FolderOpen,  label: 'قائمة المشاريع',  desc: 'جميع المشاريع وحالتها التشغيلية',    color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { href: '/dashboard/project-360',                 icon: RotateCcw,   label: 'مشروع 360°',      desc: 'عرض شامل لدورة حياة المشروع',        color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
];

// ── التخطيط والتنفيذ
const planLinks = [
  { href: '/dashboard/admin-gateway/projects/sites',      icon: MapPin,      label: 'مواقع المشاريع',   desc: 'المواقع الجغرافية والإحداثيات',       color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { href: '/dashboard/admin-gateway/projects/tasks',      icon: CheckSquare, label: 'مهام المشاريع',    desc: 'تتبع المهام والمسؤوليات',            color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { href: '/dashboard/admin-gateway/projects/milestones', icon: Flag,        label: 'معالم المشاريع',   desc: 'الإنجازات والمحطات المستهدفة',       color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  { href: '/dashboard/admin-gateway/project-control',     icon: Activity,    label: 'مراقبة التقدم',    desc: 'نسب الإنجاز الفعلية مقابل المخططة', color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
];

// ── المالية والوثائق والتقارير
const finLinks = [
  { href: '/dashboard/admin-gateway/projects/budget',     icon: DollarSign,  label: 'ميزانية المشاريع', desc: 'تخصيص الميزانيات ومتابعتها',         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { href: '/dashboard/admin-gateway/projects/documents',  icon: FileText,    label: 'وثائق المشاريع',   desc: 'الوثائق الرسمية والمرفقات',          color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  { href: '/dashboard/admin-gateway/reports/executive',   icon: BarChart2,   label: 'التقرير التنفيذي', desc: 'ملخص أداء المشاريع الاستراتيجية',   color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
  { href: '/dashboard/gis-sovereignty/engineering-workspace', icon: Map,     label: 'خريطة المشاريع',   desc: 'عرض المشاريع على الخريطة الجغرافية',color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20' },
];

export default function ProjectsControlPage() {
  const Section = ({ title, items }: { title: string; items: typeof coreLinks }) => (
    <div className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 px-1">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(({ href, icon: Icon, label, desc, color, bg, border }) => (
          <Link key={href} href={href}
            className={`group flex flex-col gap-3 p-4 rounded-xl border ${border} ${bg} hover:scale-[1.02] transition-transform`}>
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">إدارة المشاريع</h1>
              <p className="text-sm text-slate-500">المشاريع الاستراتيجية — التخطيط والتنفيذ والتقارير</p>
            </div>
          </div>
          <div className="h-px bg-slate-800 mt-4" />
        </div>

        <Section title="عرض المشروع 360° والقائمة الرئيسية" items={coreLinks} />
        <Section title="التخطيط والتنفيذ الميداني" items={planLinks} />
        <Section title="الميزانية والوثائق والتقارير" items={finLinks} />

        <div className="mb-6">
          <InternalMailTab department="projects_manager" title="نظام المراسلات الموحد - إدارة المشاريع" />
        </div>

        <div className="mt-4">
          <DepartmentAssetInbox department="technical" title="أصول الإدارة الفنية" />
        </div>
      </div>
    </div>
  );
}
