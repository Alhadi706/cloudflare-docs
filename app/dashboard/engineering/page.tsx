'use client';
import Link from 'next/link';
import {
  HardHat, Map, RotateCcw, Shield, Wrench, Activity,
} from 'lucide-react';
import DepartmentAssetInbox from '@/components/DepartmentAssetInbox';
import InternalMailTab from '@/components/InternalMailTab';

// ── مساحة العمل الهندسية
const workspaceLinks = [
  { href: '/dashboard/gis-sovereignty/engineering-workspace', icon: Map,       label: 'مساحة العمل الهندسية', desc: 'الأصول الهندسية — الطبقات — المواقع على الخريطة', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { href: '/dashboard/asset-360',                             icon: RotateCcw, label: 'أصل 360°',            desc: 'عرض شامل لدورة حياة الأصل الهندسي',            color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
];

// ── الأصول والموارد
const assetLinks = [
  { href: '/dashboard/admin-gateway/assets/registry', icon: Shield,    label: 'سجل الأصول الرئيسية', desc: 'الأصول الهندسية المدرجة بالمنظومة',              color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20' },
  { href: '/dashboard/admin-gateway/assets/registry', icon: HardHat,   label: 'سجل الأصول',        desc: 'استعراض الأصول وتفاصيلها',                      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
];

// ── الدعم الفني والتحليل
const supportLinks = [
  { href: '/dashboard/admin-gateway/maintenance/fault-analysis', icon: Activity, label: 'تحليل الأعطال الفنية', desc: 'تشخيص الأعطال وجذور الإخفاقات',              color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  { href: '/dashboard/admin-gateway/maintenance/technical',       icon: Wrench,   label: 'الجانب الفني',         desc: 'الإجراءات التقنية والمعايير الهندسية',       color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
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

export default function EngineeringPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <HardHat className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">الهندسة والدعم الفني</h1>
              <p className="text-sm text-slate-500">مساحة العمل الهندسية — الأصول — الدعم الفني والتحليل</p>
            </div>
          </div>
          <div className="h-px bg-slate-800 mt-4" />
        </div>

        <CardGrid title="مساحة العمل الهندسية" items={workspaceLinks} />
        <CardGrid title="الأصول والموارد الهندسية" items={assetLinks} />
        <CardGrid title="الدعم الفني والتحليل" items={supportLinks} />

        <div className="mt-4">
          <DepartmentAssetInbox department="technical" title="أصول إدارة الهندسة" />
        </div>

        <div className="mt-6">
          <InternalMailTab department="engineering_manager" title="نظام المراسلات الموحد - الإدارة الهندسية" />
        </div>
      </div>
    </div>
  );
}
