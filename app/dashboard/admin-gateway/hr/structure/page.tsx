'use client';

import Link from 'next/link';
import { ArrowRight, Building2, Briefcase, Layers3, Award, UserCheck } from 'lucide-react';

const cards = [
  {
    title: 'الإدارات والأقسام',
    description: 'الهيكل التنظيمي العام وربط الإدارات الرئيسية والفرعية.',
    href: '/dashboard/admin-gateway/hr/departments',
    icon: Building2,
    tone: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },
  {
    title: 'الوظائف',
    description: 'المناصب الوظيفية المعتمدة والطاقة الاستيعابية.',
    href: '/dashboard/admin-gateway/hr/positions',
    icon: Briefcase,
    tone: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  {
    title: 'الدرجات',
    description: 'السلم الوظيفي ونطاقات الراتب والترتيب الوظيفي.',
    href: '/dashboard/admin-gateway/hr/grades',
    icon: Award,
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  {
    title: 'التعيينات على الوظائف',
    description: 'ربط الموظفين بالوظائف المعتمدة وتتبع الإشغال.',
    href: '/dashboard/admin-gateway/hr/assignments',
    icon: UserCheck,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  {
    title: 'الملاك التنظيمي',
    description: 'المنظور البنيوي الذي يوضح ما هو معتمد وما هو مشغول.',
    href: '/dashboard/admin-gateway/hr/positions',
    icon: Layers3,
    tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
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

export default function StructurePage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowRight className="h-4 w-4" /> إدارة الموارد البشرية
        </Link>

        <section className="rounded-3xl border border-violet-500/20 bg-slate-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">قسم النظم والملاكات</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            هذا القسم يعالج البنية التنظيمية، الوظائف، الدرجات، والملاك الوظيفي، وليس الجوانب الطبية أو التدريبية.
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
