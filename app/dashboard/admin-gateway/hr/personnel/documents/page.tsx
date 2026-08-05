'use client';

import Link from 'next/link';
import { ArrowRight, FolderOpen, FileSignature, BadgeAlert, Archive } from 'lucide-react';

const docs = [
  {
    title: 'ملف الموظف',
    detail: 'هوية، شهادات، بيانات التعيين، والمستندات الأساسية.',
    href: '/dashboard/admin-gateway/hr/employees',
    icon: FolderOpen,
    tone: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  {
    title: 'العقود والقرارات',
    detail: 'العقود المعتمدة وقرارات الترقية أو النقل أو التكليف.',
    href: '/dashboard/admin-gateway/hr/contracts',
    icon: FileSignature,
    tone: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },
  {
    title: 'النواقص والإنذارات',
    detail: 'المستندات الناقصة والمنتهية مع تنبيهات معالجة.',
    href: '/dashboard/admin-gateway/hr/contracts',
    icon: BadgeAlert,
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
  {
    title: 'الأرشفة طويلة الأجل',
    detail: 'سياسة حفظ وإتلاف المستندات حسب الامتثال.',
    href: '/dashboard/admin-gateway/hr/assignments',
    icon: Archive,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
];

export default function PersonnelDocumentsPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr/personnel" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowRight className="h-4 w-4" /> شؤون الموظفين
        </Link>

        <section className="rounded-3xl border border-violet-500/20 bg-slate-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">الوثائق والأرشفة</h1>
          <p className="mt-2 text-sm text-slate-300">حوكمة مستندات الموظفين مع تتبع الصلاحيات وسجل التدقيق.</p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {docs.map(({ title, detail, href, icon: Icon, tone }) => (
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
