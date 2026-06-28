'use client';
import React from 'react';
import Link from 'next/link';
import { ArrowRight, Users, FileText, Clock, Calendar, ClipboardList } from 'lucide-react';

const links = [
  { href: '/dashboard/admin-gateway/hr/employees',        icon: Users,         label: 'سجل الموظفين',       desc: 'جميع بيانات الموظفين الوظيفية والشخصية', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { href: '/dashboard/admin-gateway/hr/contracts',         icon: FileText,      label: 'عقود العمل',         desc: 'العقود الوظيفية ومدد الخدمة والتجديد',   color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { href: '/dashboard/admin-gateway/hr/attendance',        icon: Clock,         label: 'الحضور والانصراف',   desc: 'سجلات الحضور اليومي والغياب والتأخر',     color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { href: '/dashboard/admin-gateway/hr/leave-management',  icon: Calendar,      label: 'الإجازات',           desc: 'طلبات الإجازة السنوية والاعتيادية والطارئة', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
];

export default function PersonnelSection() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard/hr-center" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" />
            إدارة الموارد البشرية
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">قسم شؤون المستخدمين</h1>
              <p className="text-slate-400 text-sm">Personnel Administration</p>
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
