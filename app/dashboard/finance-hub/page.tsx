'use client';

import Link from 'next/link';
import {
  DollarSign,
  PieChart,
  BarChart2,
  FileText,
  ArrowLeftRight,
  Wallet,
  Receipt,
  TrendingUp,
  Package,
  Banknote,
  UserCheck,
  ShieldCheck,
  ClipboardCheck,
  Layers3,
  Building2,
  Wrench,
  Boxes,
  Landmark,
  Link2,
} from 'lucide-react';
import DepartmentAssetInbox from '@/components/DepartmentAssetInbox';
import InternalMailTab from '@/components/InternalMailTab';

type HubItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  tone: string;
  integrationOnly?: boolean;
};

type HubSectionLink = {
  id: string;
  title: string;
  count: number;
};

const accountingItems: HubItem[] = [
  {
    href: '/dashboard/admin-gateway/accounting/chart-of-accounts',
    icon: BarChart2,
    label: 'دليل الحسابات',
    desc: 'شجرة الحسابات المعتمدة للتصنيف المحاسبي.',
    tone: 'indigo',
  },
  {
    href: '/dashboard/admin-gateway/accounting/cost-centers',
    icon: Wallet,
    label: 'مراكز التكلفة',
    desc: 'ربط التكاليف بالمشاريع والمواقع.',
    tone: 'cyan',
  },
  {
    href: '/dashboard/admin-gateway/accounting/journal-entries',
    icon: FileText,
    label: 'القيود اليومية',
    desc: 'إدخال وترحيل القيود المحاسبية.',
    tone: 'amber',
  },
];

const budgetControlItems: HubItem[] = [
  {
    href: '/dashboard/admin-gateway/finance/budgets',
    icon: PieChart,
    label: 'الميزانيات',
    desc: 'خطط الميزانية والاعتمادات السنوية.',
    tone: 'emerald',
  },
  {
    href: '/dashboard/admin-gateway/finance/allocations',
    icon: Layers3,
    label: 'التخصيصات',
    desc: 'توزيع الميزانية على الجهات والبنود.',
    tone: 'blue',
  },
  {
    href: '/dashboard/admin-gateway/finance/transfers',
    icon: ArrowLeftRight,
    label: 'التحويلات',
    desc: 'تحويلات الاعتماد بين الميزانيات.',
    tone: 'orange',
  },
  {
    href: '/dashboard/admin-gateway/finance/expenses',
    icon: Receipt,
    label: 'المصروفات',
    desc: 'تسجيل ومتابعة المصروفات الفعلية.',
    tone: 'rose',
  },
];

const revenueItems: HubItem[] = [
  {
    href: '/dashboard/admin-gateway/revenue/customers',
    icon: Building2,
    label: 'العملاء',
    desc: 'إدارة الجهات والعملاء المرتبطين بالإيراد.',
    tone: 'teal',
  },
  {
    href: '/dashboard/admin-gateway/revenue/invoices',
    icon: FileText,
    label: 'الفواتير',
    desc: 'إصدار ومتابعة الفواتير.',
    tone: 'lime',
  },
  {
    href: '/dashboard/admin-gateway/revenue/collections',
    icon: Banknote,
    label: 'التحصيلات',
    desc: 'تسجيل التحصيلات وتسوية حالات الدفع.',
    tone: 'green',
  },
];

const payrollItems: HubItem[] = [
  {
    href: '/dashboard/admin-gateway/hr/salary-info',
    icon: UserCheck,
    label: 'معلومات الرواتب',
    desc: 'عرض الرواتب الناتجة من إدارة الموارد البشرية.',
    tone: 'sky',
    integrationOnly: true,
  },
  {
    href: '/dashboard/admin-gateway/hr/payroll-config',
    icon: Banknote,
    label: 'إعداد الرواتب',
    desc: 'قواعد الرواتب والبدلات من إدارة الموارد البشرية.',
    tone: 'amber',
    integrationOnly: true,
  },
];

const planningItems: HubItem[] = [
  {
    href: '/dashboard/admin-gateway/finance/budgets',
    icon: TrendingUp,
    label: 'الموازنات السنوية',
    desc: 'تخطيط واعتماد الموازنات السنوية.',
    tone: 'violet',
  },
  {
    href: '/dashboard/admin-gateway/finance/allocations',
    icon: PieChart,
    label: 'تحليل الانحرافات',
    desc: 'مقارنة المعتمد مقابل المنفذ على مستوى التخصيص.',
    tone: 'fuchsia',
  },
  {
    href: '/dashboard/admin-gateway/reports/financial',
    icon: BarChart2,
    label: 'التوقعات والسيناريوهات',
    desc: 'تحليل الاتجاهات المالية عبر التقارير المركزية.',
    tone: 'indigo',
  },
];

const complianceItems: HubItem[] = [
  {
    href: '/dashboard/admin-gateway/finance/expenses',
    icon: ClipboardCheck,
    label: 'مراجعة الصرف',
    desc: 'مراجعة القيود والمصروفات وتوثيقها.',
    tone: 'cyan',
  },
  {
    href: '/dashboard/admin-gateway/finance/transfers',
    icon: ShieldCheck,
    label: 'الاعتمادات والموافقات',
    desc: 'متابعة طلبات التحويل ومسارات الاعتماد.',
    tone: 'orange',
  },
  {
    href: '/dashboard/admin-gateway/reports/financial',
    icon: Landmark,
    label: 'الرقابة المالية',
    desc: 'مراقبة التجاوزات والالتزام المالي المؤسسي.',
    tone: 'emerald',
  },
];

const reportingItems: HubItem[] = [
  {
    href: '/dashboard/admin-gateway/reports/financial',
    icon: DollarSign,
    label: 'التقرير المالي المركزي',
    desc: 'المرجع الرئيسي للتقارير والتحليلات المالية.',
    tone: 'green',
  },
];

const integrationItems: HubItem[] = [
  {
    href: '/dashboard/admin-gateway/assets/valuations',
    icon: Package,
    label: 'تكامل الأصول',
    desc: 'القيمة الدفترية والإهلاك والأثر المالي للأصل.',
    tone: 'cyan',
    integrationOnly: true,
  },
  {
    href: '/dashboard/admin-gateway/projects/budget',
    icon: Building2,
    label: 'تكامل المشاريع',
    desc: 'ميزانية المشروع والصرف والانحرافات.',
    tone: 'violet',
    integrationOnly: true,
  },
  {
    href: '/dashboard/admin-gateway/maintenance/planning',
    icon: Wrench,
    label: 'تكامل الصيانة',
    desc: 'تكلفة الصيانة والتشغيل المرتبطة بالأعمال.',
    tone: 'amber',
    integrationOnly: true,
  },
  {
    href: '/dashboard/admin-gateway/hr/salary-info',
    icon: UserCheck,
    label: 'تكامل الموارد البشرية',
    desc: 'مخرجات الرواتب دون نقل ملكية بيانات HR.',
    tone: 'sky',
    integrationOnly: true,
  },
  {
    href: '/dashboard/admin-gateway/procurement',
    icon: Boxes,
    label: 'تكامل إدارة المواد',
    desc: 'قيم الشراء والالتزامات وأثر الإنفاق المالي.',
    tone: 'orange',
    integrationOnly: true,
  },
  {
    href: '/dashboard/admin-gateway/workflow/approvals?role=finance_controller&dept=finance',
    icon: Landmark,
    label: 'تكامل الحوكمة',
    desc: 'الاعتمادات والرقابة ومسارات الامتثال المالي.',
    tone: 'emerald',
    integrationOnly: true,
  },
];

const toneMap: Record<string, string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  fuchsia: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
  indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  teal: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  lime: 'text-lime-400 bg-lime-500/10 border-lime-500/20',
  green: 'text-green-400 bg-green-500/10 border-green-500/20',
  sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

const sectionLinks: HubSectionLink[] = [
  { id: 'accounting', title: '1) المحاسبة', count: accountingItems.length },
  { id: 'budget-control', title: '2) الميزانية والرقابة', count: budgetControlItems.length },
  { id: 'revenue', title: '3) الإيرادات والتحصيل', count: revenueItems.length },
  { id: 'payroll', title: '4) الرواتب والمستحقات', count: payrollItems.length },
  { id: 'planning', title: '5) التخطيط المالي', count: planningItems.length },
  { id: 'compliance', title: '6) الرقابة والالتزام المالي', count: complianceItems.length },
  { id: 'reporting', title: '7) التقارير والتحليلات المالية', count: reportingItems.length },
  { id: 'integration', title: '8) التكامل المالي', count: integrationItems.length },
];

function Section({
  id,
  title,
  subtitle,
  items,
}: {
  id: string;
  title: string;
  subtitle: string;
  items: HubItem[];
}) {
  return (
    <section id={id} className="space-y-3 scroll-mt-24">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-200">{title}</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-300">
              {items.length} شاشة
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(({ href, icon: Icon, label, desc, tone, integrationOnly }) => {
          const classes = toneMap[tone] || toneMap.emerald;
          return (
            <Link
              key={`${title}-${href}-${label}`}
              href={href}
              className={`group rounded-xl border p-4 transition-all hover:scale-[1.01] hover:bg-slate-900/80 ${classes}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-9 h-9 rounded-lg border border-current/30 bg-slate-950/50 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                {integrationOnly && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-current/30 bg-slate-950/50">
                    شاشة تكامل
                  </span>
                )}
              </div>
              <p className="mt-3 font-semibold text-sm">{label}</p>
              <p className="text-[11px] text-slate-300/80 mt-1 leading-relaxed">{desc}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function FinanceHubPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">مدير الإدارة المالية</p>
              <h1 className="text-2xl font-bold text-slate-100">Finance Hub — الإدارة المالية</h1>
              <p className="text-sm text-slate-400 mt-1">
                تنظيم مالي مؤسسي: أقسام واضحة، تنقل موحّد، وتكامل مع الإدارات المالكة للبيانات.
              </p>
            </div>
          </div>

          <div className="mt-4 h-px bg-slate-800" />
          <p className="text-xs text-slate-500 mt-4">
            المدير → الأقسام → الشاشات → التقارير
          </p>
        </header>

        <nav className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-400 mb-3">مسارات سريعة داخل الصفحة</p>
          <div className="flex flex-wrap gap-2">
            {sectionLinks.map(({ id, title, count }) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-slate-100 hover:border-slate-500 transition-colors"
              >
                {title} ({count})
              </a>
            ))}
          </div>
        </nav>

        <Section
          id="accounting"
          title="1) المحاسبة"
          subtitle="المعالجة المحاسبية الأساسية"
          items={accountingItems}
        />

        <Section
          id="budget-control"
          title="2) الميزانية والرقابة"
          subtitle="التخطيط التنفيذي للميزانية ومراقبة الصرف"
          items={budgetControlItems}
        />

        <Section
          id="revenue"
          title="3) الإيرادات والتحصيل"
          subtitle="سلسلة الإيراد من العميل حتى التحصيل"
          items={revenueItems}
        />

        <Section
          id="payroll"
          title="4) الرواتب والمستحقات"
          subtitle="عرض مالي لبيانات الرواتب من الموارد البشرية"
          items={payrollItems}
        />

        <Section
          id="planning"
          title="5) التخطيط المالي"
          subtitle="الموازنات السنوية والتوقعات وتحليل الانحراف"
          items={planningItems}
        />

        <Section
          id="compliance"
          title="6) الرقابة والالتزام المالي"
          subtitle="مراجعة الصرف والاعتمادات والامتثال"
          items={complianceItems}
        />

        <Section
          id="reporting"
          title="7) التقارير والتحليلات المالية"
          subtitle="مرجع مركزي واحد للتقارير المالية"
          items={reportingItems}
        />

        <Section
          id="integration"
          title="8) التكامل المالي"
          subtitle="روابط تكامل مع الإدارات المالكة للبيانات"
          items={integrationItems}
        />

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <DepartmentAssetInbox department="finance" title="أصول الإدارة المالية" />
        </div>

        <InternalMailTab department="finance" title="المراسلات الداخلية - مدير الإدارة المالية" />
      </div>
    </div>
  );
}
