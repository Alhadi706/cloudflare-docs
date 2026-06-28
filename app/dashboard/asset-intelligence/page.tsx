'use client';
import Link from 'next/link';
import { Brain, Activity, DollarSign, BarChart2, AlertTriangle, Cpu, RotateCcw } from 'lucide-react';

const links = [
  {
    href: '/dashboard/asset-360',
    icon: RotateCcw,
    label: 'أصل 360°',
    desc: 'عرض شامل لدورة حياة الأصل: GIS، صيانة، مالية، مستندات',
    color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20',
  },
  {
    href: '/dashboard/admin-gateway/assets/health',
    icon: Activity,
    label: 'صحة الأصول',
    desc: 'مؤشرات حالة الأصول والتنبيهات الحرجة',
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
  },
  {
    href: '/dashboard/admin-gateway/assets/valuations',
    icon: DollarSign,
    label: 'تقييم الأصول',
    desc: 'القيمة المالية والاستهلاك والإعادة التقييم',
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
  },
  {
    href: '/dashboard/admin-gateway/platform-intelligence/asset-intelligence',
    icon: Brain,
    label: 'ذكاء الأصول (AI)',
    desc: 'تحليل التنبؤ بالأعطال ومؤشرات الأداء',
    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20',
  },
  {
    href: '/dashboard/admin-gateway/assets/categories',
    icon: Cpu,
    label: 'فئات الأصول',
    desc: 'تصنيف الأصول حسب النوع والأولوية',
    color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
  },
  {
    href: '/dashboard/admin-gateway/reports/operations',
    icon: BarChart2,
    label: 'تقارير العمليات',
    desc: 'ملخص أداء الأصول والعمليات',
    color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20',
  },
  {
    href: '/dashboard/admin-gateway/corrosion',
    icon: AlertTriangle,
    label: 'رصد التآكل',
    desc: 'تحليل التدهور والتنبؤ بالعمر المتبقي',
    color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20',
  },
];

export default function AssetIntelligencePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">ذكاء الأصول</h1>
              <p className="text-sm text-slate-500">تتبع الأصول ومؤشرات الصحة والتنبؤ بالأعطال</p>
            </div>
          </div>
          <div className="h-px bg-slate-800 mt-4" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {links.map(({ href, icon: Icon, label, desc, color, bg, border }) => (
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
    </div>
  );
}
