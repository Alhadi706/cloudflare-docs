'use client';
import Link from 'next/link';
import {
  Bot, Newspaper, Command, TrendingUp, Activity, AlertTriangle,
  BarChart2, TestTube2, Brain,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

// ── الذكاء العملياتي
const opsLinks = [
  { href: '/dashboard/ai-assistant',                                        icon: Bot,        label: 'المساعد الذكي',       desc: 'محادثات ذكاء اصطناعي وتحليل البيانات',   color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' },
  { href: '/dashboard/admin-gateway/intelligence/briefing',                 icon: Newspaper,  label: 'الإحاطة الذكية',     desc: 'التقارير التنفيذية المدعومة بالذكاء',     color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { href: '/dashboard/admin-gateway/intelligence/command',                  icon: Command,    label: 'مركز القيادة الذكي', desc: 'لوحة الذكاء التشغيلي الموحدة',           color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
];

// ── التحليلات والتوقعات
const analyticsLinks = [
  { href: '/dashboard/admin-gateway/intelligence/forecast',                          icon: TrendingUp,  label: 'التوقعات',              desc: 'نماذج التوقع والسيناريوهات المستقبلية', color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  { href: '/dashboard/admin-gateway/intelligence/performance',                       icon: Activity,    label: 'تحليل الأداء',          desc: 'مؤشرات الأداء والمقارنة المرجعية',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { href: '/dashboard/admin-gateway/platform-intelligence/predictive-analytics',     icon: Brain,       label: 'التحليلات التنبؤية',    desc: 'نماذج ML والتنبؤ بالصيانة والمخاطر',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { href: '/dashboard/admin-gateway/platform-intelligence/scenario-simulation',      icon: TestTube2,   label: 'محاكاة السيناريوهات',   desc: 'محاكاة قرارات تشغيلية واستراتيجية',   color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
];

// ── إدارة المخاطر
const riskLinks = [
  { href: '/dashboard/admin-gateway/intelligence/risk',                       icon: AlertTriangle, label: 'المخاطر',              desc: 'تصنيف المخاطر وتقييم الأولويات',        color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  { href: '/dashboard/admin-gateway/platform-intelligence/risk-management',   icon: BarChart2,     label: 'إدارة المخاطر',        desc: 'خطط الاستجابة وخرائط المخاطر',          color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
];

type CardDef = { href: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string; color: string; bg: string; border: string };

function CardGrid({ title, items }: { title: string; items: CardDef[] }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 px-1">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(({ href, icon: Icon, label, desc, color, bg, border }) => (
          <Link key={href} href={href}
            className={`group flex flex-col gap-3 p-4 rounded-xl border ${border} ${bg} hover:scale-[1.02] transition-transform`}>
            <div className={`w-9 h-9 rounded-lg bg-slate-900 border ${border} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${color}`}>{label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function IntelligencePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-fuchsia-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">الذكاء والتحليلات</h1>
              <p className="text-sm text-slate-500">الذكاء الاصطناعي — التحليلات التنبؤية — إدارة المخاطر</p>
            </div>
          </div>
          <div className="h-px bg-slate-800 mt-4" />
        </div>

        <CardGrid title="الذكاء العملياتي" items={opsLinks} />
        <CardGrid title="التحليلات والتوقعات" items={analyticsLinks} />
        <CardGrid title="إدارة المخاطر" items={riskLinks} />

        <div className="mt-6">
          <InternalMailTab department="intelligence_manager" title="نظام المراسلات الموحد - إدارة الذكاء" />
        </div>
      </div>
    </div>
  );
}
