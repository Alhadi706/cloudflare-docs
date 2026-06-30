'use client';
import Link from 'next/link';
import { Package, Wrench, Shield, RotateCcw, Activity, Heart, DollarSign, Settings, BarChart2, Brain, Crown } from 'lucide-react';
import DepartmentAssetInbox from '@/components/DepartmentAssetInbox';

// ── الأصل 360° والسجل
const coreLinks = [
  { href: '/dashboard/asset-360',                     icon: RotateCcw,  label: 'أصل 360°',            desc: 'عرض شامل لدورة حياة كل أصل',            color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  { href: '/dashboard/admin-gateway/assets/registry', icon: Shield,     label: 'سجل الأصول',          desc: 'السجل الرسمي لجميع أصول المؤسسة',        color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { href: '/dashboard/admin-gateway/assets/list',     icon: Package,    label: 'قائمة الأصول',        desc: 'استعراض وبحث في الأصول',                color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { href: '/dashboard/admin-gateway/assets/types',    icon: Settings,   label: 'أنواع وفئات الأصول',  desc: 'التصنيفات والأنواع المعتمدة',            color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20' },
];

// ── الصحة والقيمة والصيانة
const healthLinks = [
  { href: '/dashboard/admin-gateway/assets/health',      icon: Heart,      label: 'صحة الأصول',          desc: 'مؤشرات الحالة والتنبيهات الحرجة',        color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  { href: '/dashboard/admin-gateway/assets/valuations',  icon: DollarSign, label: 'تقييم الأصول',        desc: 'القيمة المالية والاستهلاك',              color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { href: '/dashboard/admin-gateway/assets/maintenance', icon: Wrench,     label: 'صيانة الأصول',        desc: 'أوامر صيانة الأصول',                    color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
];

// ── الذكاء والتقارير
const analyticsLinks = [
  { href: '/dashboard/admin-gateway/platform-intelligence/asset-intelligence', icon: Brain,     label: 'ذكاء الأصول (AI)',    desc: 'التنبؤ بالأعطال ومؤشرات الأداء',       color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' },
  { href: '/dashboard/admin-gateway/assets/reviews',                           icon: Activity,  label: 'مراجعة البيانات',    desc: 'مراجعة واعتماد البيانات الجغرافية',    color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  { href: '/dashboard/admin-gateway/reports/operations',                        icon: BarChart2, label: 'تقرير العمليات',     desc: 'ملخص أداء الأصول والعمليات',           color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
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

export default function DigitalAssetsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Package className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">إدارة الأصول</h1>
              <p className="text-sm text-slate-500">الأصل 360° — السجل — الصحة والقيمة — الذكاء والتحليل</p>
            </div>
          </div>
          <div className="h-px bg-slate-800 mt-4" />
        </div>

        {/* Manager Card */}
        <Link href="/dashboard/digital-assets/manager" className="group block mb-8">
          <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-5 hover:border-violet-500/60 hover:bg-slate-800/70 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-white">مدير إدارة الأصول</h2>
                <p className="text-violet-400/70 text-xs mt-0.5">لوحة المدير — الأقسام والمراسلات الإدارية</p>
              </div>
              <span className="text-violet-400 text-xs font-semibold flex items-center gap-1">فتح لودة المدير <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
            </div>
          </div>
        </Link>

        <CardGrid title="الأصل 360° والسجل الرسمي" items={coreLinks} />
        <CardGrid title="الصحة والقيمة والصيانة" items={healthLinks} />
        <CardGrid title="الذكاء والتقارير" items={analyticsLinks} />

        <div className="mt-4">
          <DepartmentAssetInbox department="assets" title="أصول إدارة الأصول" />
        </div>
      </div>
    </div>
  );
}
