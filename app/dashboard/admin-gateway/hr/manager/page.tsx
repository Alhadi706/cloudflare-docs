'use client';

import Link from 'next/link';
import { ArrowRight, Crown, Users, HeartPulse, GraduationCap, BarChart3, Layers3, Mail, FileText, ShieldCheck, Award, Building2 } from 'lucide-react';

type ManagerArea = {
  title: string;
  subtitle: string;
  description: string;
  href: string;
  icon: React.ElementType;
  tone: string;
  actions: string[];
};

const AREAS: ManagerArea[] = [
  {
    title: 'قسم شؤون الموظفين',
    subtitle: 'Personnel Affairs',
    description: 'الإشراف على ملفات الموظفين، التعيين، النقل، العقود، والإجازات الإدارية.',
    href: '/dashboard/admin-gateway/hr/personnel',
    icon: Users,
    tone: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    actions: ['ملفات الموظفين', 'التعيين والنقل', 'العقود والترقيات'],
  },
  {
    title: 'قسم الشؤون الطبية',
    subtitle: 'Medical Affairs',
    description: 'متابعة الجوانب الصحية الوظيفية، الجاهزية الطبية، والفحوصات الدورية دون خلطه بالإجازات.',
    href: '/dashboard/admin-gateway/hr/medical',
    icon: HeartPulse,
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    actions: ['الجاهزية الصحية', 'الملف الطبي', 'الفحوصات الدورية'],
  },
  {
    title: 'قسم التدريب والتطوير',
    subtitle: 'Training & Development',
    description: 'بناء خطط التدريب، تقييم الأثر، تطوير المهارات، وربط الاحتياج التدريبي بالوظائف المعتمدة.',
    href: '/dashboard/admin-gateway/hr/training',
    icon: GraduationCap,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    actions: ['الخطة التدريبية', 'تقييم الأثر', 'تنمية الكفاءات'],
  },
  {
    title: 'قسم البيانات والإحصاء',
    subtitle: 'Data & Statistics',
    description: 'إنتاج المؤشرات، التحديثات الدورية، لوحات القياس، ومتابعة قوة العمل والغياب والحضور.',
    href: '/dashboard/admin-gateway/hr/data',
    icon: BarChart3,
    tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    actions: ['مؤشرات الأداء', 'التحليلات', 'التقارير الدورية'],
  },
  {
    title: 'قسم النظم والملاكات',
    subtitle: 'Structure & Staffing',
    description: 'الهيكل التنظيمي، الملاكات، الوظائف، الدرجات، والفجوات بين الملاك والإشغال الفعلي.',
    href: '/dashboard/admin-gateway/hr/structure',
    icon: Layers3,
    tone: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    actions: ['الهيكل التنظيمي', 'الوظائف والدرجات', 'الشواغر والملاك'],
  },
];

const QUICK_LINKS = [
  { href: '/dashboard/admin-gateway/hr/personnel', icon: Users, label: 'شؤون الموظفين' },
  { href: '/dashboard/admin-gateway/hr/medical', icon: HeartPulse, label: 'الشؤون الطبية' },
  { href: '/dashboard/admin-gateway/hr/training', icon: GraduationCap, label: 'التدريب والتطوير' },
  { href: '/dashboard/admin-gateway/hr/data', icon: BarChart3, label: 'البيانات والإحصاء' },
  { href: '/dashboard/admin-gateway/materials/requests?source_dept=admin-affairs', icon: FileText, label: 'طلبات المواد' },
  { href: '/dashboard/admin-gateway/hr/structure', icon: Layers3, label: 'النظم والملاكات' },
  { href: '/dashboard/admin-gateway/workflow/approvals?role=admin_officer&dept=admin-affairs', icon: ShieldCheck, label: 'الموافقات' },
  { href: '/dashboard/admin-gateway/materials/manager/correspondence', icon: Mail, label: 'المراسلات' },
];

function AreaCard({ area }: { area: ManagerArea }) {
  const Icon = area.icon;

  return (
    <Link href={area.href} className="group rounded-2xl border border-white/10 bg-slate-900 p-5 transition-all hover:bg-slate-800/60">
      <div className={`inline-flex rounded-xl border px-2.5 py-2 ${area.tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-white">{area.title}</h2>
      <p className="mt-0.5 text-xs text-slate-400 font-mono">{area.subtitle}</p>
      <p className="mt-3 text-sm leading-6 text-slate-300">{area.description}</p>
      <div className="mt-4 space-y-1.5">
        {area.actions.map((action) => (
          <div key={action} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
            {action}
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-slate-800 pt-3 text-xs font-semibold text-slate-300 group-hover:text-white">
        فتح اللوحة <span className="inline-block transition-transform group-hover:-translate-x-1">←</span>
      </div>
    </Link>
  );
}

export default function HRManagerPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-300">
          <ArrowRight className="h-4 w-4" />
          إدارة الموارد البشرية
        </Link>

        <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10">
                <Crown className="h-7 w-7 text-cyan-300" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">لوحة مدير إدارة الموارد البشرية</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  هذه اللوحة تجمع الأقسام الخمسة المعتمدة فقط، بحيث يكون لكل قسم مدخل واضح ومحتوى يطابق وظيفته وتسميته.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {['شؤون الموظفين', 'التدريب والتطوير', 'الملاكات'].map((item) => (
                <div key={item} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-center text-xs text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-900 p-5">
          <h2 className="text-sm font-bold text-white">نقاط التحكم السريعة</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {QUICK_LINKS.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300 transition-colors hover:border-cyan-500/30 hover:bg-slate-800/60 hover:text-white">
                <Icon className="h-4 w-4 text-cyan-300" />
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AREAS.map((area) => (
            <AreaCard key={area.title} area={area} />
          ))}
        </section>
      </div>
    </div>
  );
}