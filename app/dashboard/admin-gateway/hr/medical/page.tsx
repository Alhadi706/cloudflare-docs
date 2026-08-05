'use client';

import Link from 'next/link';
import { ArrowRight, HeartPulse, ClipboardCheck, ShieldPlus, ScanFace } from 'lucide-react';

const cards = [
  {
    title: 'الملف الطبي الوظيفي',
    description: 'التقارير الصحية الأساسية، الحساسية، والملاحظات الطبية المؤثرة على العمل.',
    icon: ClipboardCheck,
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
  {
    title: 'اللياقة والجاهزية الصحية',
    description: 'الجاهزية الصحية قبل التعيين وأثناء الخدمة والمتابعة الدورية.',
    icon: HeartPulse,
    tone: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  {
    title: 'الفحوصات الدورية',
    description: 'الفحوصات المجدولة والنتائج والتنبيه على الحالات التي تحتاج متابعة.',
    icon: ScanFace,
    tone: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  },
  {
    title: 'السلامة والوقاية الصحية',
    description: 'التثقيف الصحي، الوقاية، والإجراءات اللازمة في البيئات الميدانية.',
    icon: ShieldPlus,
    tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
];

function Card({ title, description, icon: Icon, tone }: (typeof cards)[number]) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
      <div className={`inline-flex rounded-xl border px-2.5 py-2 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
      <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-500">
        لا توجد صفحة تنفيذية هنا بعد، وهذا القسم مخصص للملف الطبي والمتابعة الصحية فقط.
      </div>
    </div>
  );
}

export default function MedicalPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowRight className="h-4 w-4" /> إدارة الموارد البشرية
        </Link>

        <section className="rounded-3xl border border-rose-500/20 bg-slate-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">قسم الشؤون الطبية</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            هذا القسم لا ينبغي أن يحمل واجهة الإجازات الإدارية؛ دوره الطبي هو المتابعة الصحية والجاهزية والفحوصات.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
          {cards.map((card) => (
            <Card key={card.title} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}
