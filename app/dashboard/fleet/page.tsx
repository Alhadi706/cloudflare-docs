'use client';
import Link from 'next/link';
import { Truck, Fuel, Settings2, BarChart2 } from 'lucide-react';
import DepartmentAssetInbox from '@/components/DepartmentAssetInbox';
import InternalMailTab from '@/components/InternalMailTab';

type CardDef = { href: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string; color: string; bg: string; border: string };

const links: CardDef[] = [
  { href: '/dashboard/admin-gateway/vehicles/vehicles',  icon: Truck,     label: 'سجل المركبات',     desc: 'الأسطول والبيانات التشغيلية لكل مركبة',  color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { href: '/dashboard/admin-gateway/vehicles/equipment', icon: Settings2, label: 'المعدات',           desc: 'المعدات الثقيلة والآليات الميدانية',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { href: '/dashboard/admin-gateway/vehicles/fuel',      icon: Fuel,      label: 'الوقود',            desc: 'استهلاك الوقود وسجل التزود',             color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { href: '/dashboard/admin-gateway/reports/operations', icon: BarChart2, label: 'تقرير العمليات',   desc: 'أداء الأسطول والاستخدام التشغيلي',       color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
];

export default function FleetPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
              <Truck className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">إدارة الخدمات</h1>
              <p className="text-sm text-slate-500">المركبات والمعدات والوقود</p>
            </div>
          </div>
          <div className="h-px bg-slate-800 mt-4" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
        <div className="mt-6">
          <InternalMailTab department="fleet_manager" title="نظام المراسلات الموحد - إدارة الخدمات" />
        </div>
        <div className="mt-6">
          <DepartmentAssetInbox department="fleet" title="أصول إدارة الخدمات" />
        </div>
      </div>
    </div>
  );
}
