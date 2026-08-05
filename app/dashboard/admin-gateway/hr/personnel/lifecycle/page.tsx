'use client';

import Link from 'next/link';
import { ArrowRight, UserPlus, UserCheck, Repeat, UserX } from 'lucide-react';

const phases = [
  {
    title: 'الاستقطاب والتعيين',
    detail: 'ربط عملية التوظيف بإنشاء ملف موظف رسمي ومعتمد.',
    href: '/dashboard/admin-gateway/hr/employees',
    icon: UserPlus,
    tone: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  {
    title: 'الاعتماد والتثبيت',
    detail: 'التحقق من المستندات، اعتماد العقد، وتفعيل الحالة الوظيفية.',
    href: '/dashboard/admin-gateway/hr/contracts',
    icon: UserCheck,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  {
    title: 'الحركة الوظيفية',
    detail: 'الترقية والنقل والانتداب عبر إجراءات موثقة.',
    href: '/dashboard/admin-gateway/hr/assignments',
    icon: Repeat,
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  {
    title: 'إنهاء الخدمة',
    detail: 'إقفال ملف الموظف وإكمال إجراءات التسليم والإخلاء.',
    href: '/dashboard/admin-gateway/hr/contracts',
    icon: UserX,
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
];

export default function PersonnelLifecyclePage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr/personnel" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowRight className="h-4 w-4" /> شؤون الموظفين
        </Link>

        <section className="rounded-3xl border border-blue-500/20 bg-slate-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">دورة حياة الموظف</h1>
          <p className="mt-2 text-sm text-slate-300">خارطة تشغيل موحدة لدورة الموظف من الانضمام حتى إنهاء الخدمة.</p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {phases.map(({ title, detail, href, icon: Icon, tone }) => (
            <Link key={title} href={href} className="group rounded-2xl border border-white/10 bg-slate-900 p-5 hover:bg-slate-800/60 transition-all">
              <div className={`inline-flex rounded-xl border px-2.5 py-2 ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
              <p className="mt-2 text-sm text-slate-300 leading-6">{detail}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
