'use client';

import Link from 'next/link';
import { ArrowRight, BarChart3, Clock, DollarSign, FileText, Activity } from 'lucide-react';

const cards = [
  {
    title: 'الحضور والانصراف',
    description: 'الدوام اليومي، الغياب، التأخر، والالتزام الزمني.',
    href: '/dashboard/admin-gateway/hr/attendance',
    icon: Clock,
    tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  {
    title: 'معلومات الرواتب',
    description: 'الرواتب الأساسية، البدلات، الاستقطاعات، وصافي الأجر.',
    href: '/dashboard/admin-gateway/hr/salary-info',
    icon: DollarSign,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  {
    title: 'التحليلات والإحصاءات',
    description: 'قراءات إحصائية مجمعة تساعد الإدارة على اتخاذ القرار.',
    href: '/dashboard/admin-gateway/hr/attendance',
    icon: BarChart3,
    tone: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },
  {
    title: 'التقارير الدورية',
    description: 'ملخصات دورية عن التشغيل وقوة العمل وملف الرواتب.',
    href: '/dashboard/admin-gateway/hr/salary-info',
    icon: FileText,
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  {
    title: 'مؤشرات الأداء',
    description: 'مؤشرات تشغيلية بسيطة حول الحضور والانضباط والكتلة البشرية.',
    href: '/dashboard/admin-gateway/hr/attendance',
    icon: Activity,
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
];

function Card({ title, description, href, icon: Icon, tone }: (typeof cards)[number]) {
  return (
    <Link href={href} className="group rounded-2xl border border-white/10 bg-slate-900 p-5 transition-all hover:bg-slate-800/60">
      <div className={`inline-flex rounded-xl border px-2.5 py-2 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
      <div className="mt-5 border-t border-slate-800 pt-3 text-xs font-semibold text-slate-300 group-hover:text-white">
        فتح اللوحة <span className="inline-block transition-transform group-hover:-translate-x-1">←</span>
      </div>
    </Link>
  );
}

export default function DataPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowRight className="h-4 w-4" /> إدارة الموارد البشرية
        </Link>

        <section className="rounded-3xl border border-cyan-500/20 bg-slate-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">قسم البيانات والإحصاء</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            هذا القسم يختص بالإحصاءات والمؤشرات ولوحات المتابعة وليس بمسميات أو هيكل تنظيمي.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.title} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}
