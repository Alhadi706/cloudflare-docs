'use client';
import Link from 'next/link';
import {
  ShoppingCart, Package, Warehouse, ClipboardList, Truck, BarChart2, FileText, CheckCircle,
} from 'lucide-react';
import DepartmentAssetInbox from '@/components/DepartmentAssetInbox';
import InternalMailTab from '@/components/InternalMailTab';

// ── المشتريات
const procLinks = [
  { href: '/dashboard/admin-gateway/procurement/requests',  icon: ShoppingCart,  label: 'طلبات الشراء',    desc: 'طلبات الشراء وحالة الموافقة',          color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { href: '/dashboard/admin-gateway/procurement/orders',    icon: CheckCircle,   label: 'أوامر الشراء',    desc: 'أوامر الشراء المعتمدة والمنفذة',        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { href: '/dashboard/admin-gateway/procurement/suppliers', icon: Truck,         label: 'الموردون',         desc: 'قاعدة بيانات الموردين والمقاولين',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
];

// ── المستودعات والمخزون
const warehouseLinks = [
  { href: '/dashboard/admin-gateway/inventory/warehouses', icon: Warehouse,     label: 'المستودعات',       desc: 'إدارة المستودعات والمواقع التخزينية',   color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  { href: '/dashboard/admin-gateway/inventory/items',      icon: Package,       label: 'الأصناف',          desc: 'قائمة الأصناف والرموز التعريفية',       color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { href: '/dashboard/admin-gateway/inventory/receipts',   icon: ClipboardList, label: 'استلام البضاعة',   desc: 'سجل استلام المواد والأصناف',            color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20' },
  { href: '/dashboard/admin-gateway/inventory/issues',     icon: FileText,      label: 'إصدار البضاعة',    desc: 'سجل صرف المواد للأقسام والمشاريع',     color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
];

// ── التقارير
const reportLinks = [
  { href: '/dashboard/admin-gateway/reports/procurement', icon: BarChart2, label: 'تقرير المشتريات', desc: 'ملخص المشتريات والإنفاق والموردين', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
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

export default function ProcurementPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">المشتريات والمستودعات</h1>
              <p className="text-sm text-slate-500">طلبات الشراء — الموردون — المستودعات والمخزون</p>
            </div>
          </div>
          <div className="h-px bg-slate-800 mt-4" />
        </div>

        <CardGrid title="المشتريات والموردون" items={procLinks} />
        <CardGrid title="المستودعات والمخزون" items={warehouseLinks} />
        <CardGrid title="التقارير" items={reportLinks} />

        <div className="mb-6">
          <InternalMailTab department="procurement_manager" title="نظام المراسلات الموحد - إدارة المشتريات" />
        </div>

        <div className="mt-4">
          <DepartmentAssetInbox department="procurement" title="أصول إدارة المشتريات" />
        </div>
      </div>
    </div>
  );
}
