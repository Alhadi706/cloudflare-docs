'use client';
import React from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutGrid, GitBranch, ShieldCheck, BarChart2, Briefcase } from 'lucide-react';

const links = [
  { href: '/dashboard/admin-gateway/org-structure',          icon: GitBranch,   label: 'هيكل الإدارات',             desc: 'شجرة التبعية الإدارية وخريطة الوحدات التنظيمية',  color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  { href: '/dashboard/admin-gateway/hr/positions',           icon: Briefcase,   label: 'الملاك الوظيفي والشغور',    desc: 'الوظائف المعتمدة ونسبة الشغور الوظيفي لكل قسم', color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20' },
  { href: '/dashboard/admin-gateway/hr/departments',         icon: BarChart2,   label: 'الأقسام الإدارية',           desc: 'إحصاءات الأقسام وتوزيع الموظفين والكثافة',      color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  { href: '/dashboard/admin-gateway/hr/assignments',         icon: ShieldCheck, label: 'التعيينات التنظيمية',        desc: 'ربط الموظفين بالأدوار والوظائف الرسمية',         color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { href: '/dashboard/admin-gateway/hr/sub-departments',     icon: LayoutGrid,  label: 'الأقسام الفرعية والوحدات',  desc: 'هيكلة الأقسام الداخلية وتعريف الوحدات التنظيمية', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
];

export default function StaffingSection() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard/hr-center" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            إدارة الموارد البشرية
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">قسم النظم والملاكات</h1>
              <p className="text-slate-400 text-sm">Organizational Design & Staffing — ISO 30400-2</p>
            </div>
          </div>
        </div>
        <div className="h-px bg-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map(({ href, icon: Icon, label, desc, color, bg, border }) => (
            <Link key={href} href={href}
              className={`group flex flex-col gap-3 p-5 rounded-2xl border ${border} ${bg} hover:scale-[1.01] transition-transform bg-slate-900`}>
              <div className={`w-10 h-10 rounded-xl bg-slate-800 border ${border} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className={`font-bold text-sm ${color}`}>{label}</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
