'use client';

import Link from 'next/link';
import { ArrowRight, Users, FileText, UserCheck, CalendarDays, ClipboardList, ShieldCheck, FolderKanban, CheckSquare, ShoppingCart } from 'lucide-react';

const operationModules = [
  {
    title: 'دورة حياة الموظف',
    description: 'من التعيين وحتى إنهاء الخدمة مع نقاط تحكم واضحة لكل مرحلة.',
    href: '/dashboard/admin-gateway/hr/personnel/lifecycle',
    icon: FolderKanban,
    tone: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  {
    title: 'طلبات ومعاملات الموظفين',
    description: 'طلبات الإجازات، الشهادات، والتحديثات مع مسارات اعتماد قياسية.',
    href: '/dashboard/admin-gateway/hr/personnel/requests',
    icon: CheckSquare,
    tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  {
    title: 'الوثائق والأرشفة',
    description: 'عقود، هويات، قرارات، ومستندات الموظف مع تتبع الصلاحيات.',
    href: '/dashboard/admin-gateway/hr/personnel/documents',
    icon: FileText,
    tone: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },
  {
    title: 'الحوكمة والامتثال',
    description: 'سجل التدقيق، السياسات، مؤشرات الالتزام، وضبط صلاحيات الوصول.',
    href: '/dashboard/admin-gateway/hr/personnel/compliance',
    icon: ShieldCheck,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  {
    title: 'طلبات المواد',
    description: 'طلب مستلزمات الموظفين والقرطاسية والأدوات المرتبطة بالتشغيل الإداري.',
    href: '/dashboard/admin-gateway/materials/requests?source_dept=admin-affairs',
    icon: ShoppingCart,
    tone: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  },
];

const coreServices = [
  {
    title: 'الموظفون',
    description: 'الملفات الأساسية، البيانات الشخصية، الحالة الوظيفية، وربط الموظف بالدرجة والمنصب.',
    href: '/dashboard/admin-gateway/hr/employees',
    icon: Users,
    tone: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  {
    title: 'العقود',
    description: 'العقود، التجديد، الانتهاء، والالتزام بالشروط التعاقدية.',
    href: '/dashboard/admin-gateway/hr/contracts',
    icon: FileText,
    tone: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },
  {
    title: 'الترقيات',
    description: 'سجلات الترقيات والقرارات الإدارية والانتقال بين الدرجات.',
    href: '/dashboard/admin-gateway/hr/promotions',
    icon: UserCheck,
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  {
    title: 'الإجازات الإدارية',
    description: 'الطلبات الإدارية والإجازات المستحقة؛ تبقى هنا لأنها جزء من مسار الموظف وليست شؤونًا طبية.',
    href: '/dashboard/admin-gateway/hr/leave-management',
    icon: CalendarDays,
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
  {
    title: 'سجل الحركة الوظيفية',
    description: 'التعيين والنقل والانتداب وربط الموظفين بالوظائف المعتمدة.',
    href: '/dashboard/admin-gateway/hr/assignments',
    icon: ClipboardList,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
];

function Card({ title, description, href, icon: Icon, tone }: (typeof operationModules)[number]) {
  return (
    <Link href={href} className="group rounded-2xl border border-white/10 bg-slate-900 p-5 transition-all hover:bg-slate-800/60">
      <div className={`inline-flex rounded-xl border px-2.5 py-2 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
      <div className="mt-5 border-t border-slate-800 pt-3 text-xs font-semibold text-slate-300 group-hover:text-white">
        فتح القسم <span className="inline-block transition-transform group-hover:-translate-x-1">←</span>
      </div>
    </Link>
  );
}

export default function PersonnelPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard/admin-gateway/hr" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <ArrowRight className="h-4 w-4" /> إدارة الموارد البشرية
        </Link>

        <section className="rounded-3xl border border-blue-500/20 bg-slate-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">قسم شؤون الموظفين</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            مركز تشغيل متكامل لإدارة دورة حياة الموظف وفق معايير عالمية: عمليات واضحة، امتثال، خدمة ذاتية، وأثر قابل للقياس.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['SLA إنجاز الطلبات', '48h'],
            ['اكتمال ملفات الموظفين', '100%'],
            ['الطلبات المؤرشفة', 'Audit'],
            ['الامتثال للسياسات', 'ISO-Style'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-bold text-white">{value}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-100">وحدات التشغيل الأساسية</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
            {operationModules.map((card) => (
              <Card key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-100">الخدمات التنفيذية الحالية</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coreServices.map((card) => (
              <Card key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-sm leading-6 text-slate-300">
          المعيار العالمي هنا: كل إجراء موظف يجب أن يمر عبر
          ملف موظف موثق، سبب قرار واضح، مسار موافقة، وسجل تدقيق.
        </section>

        <section className="rounded-3xl border border-teal-500/20 bg-teal-500/5 p-5">
          <div className="flex items-center justify-between gap-3 flex-col md:flex-row md:items-center">
            <div>
              <h2 className="text-sm font-bold text-white">نموذج طلب المواد داخل شؤون الموظفين</h2>
              <p className="mt-1 text-xs text-slate-300 leading-5">
                للوصول المباشر لنموذج الطلب، مع أخذ الإدارة الطالبة تلقائيًا من سياق HR.
              </p>
            </div>
            <Link
              href="/dashboard/admin-gateway/materials/requests?source_dept=admin-affairs"
              className="inline-flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-200 hover:bg-teal-500/20"
            >
              <ShoppingCart className="w-4 h-4" />
              فتح طلب المواد
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
