'use client';
import Link from 'next/link';
import { FileSignature, Users2, FileText, Crown } from 'lucide-react';

type CardDef = { href: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string; color: string; bg: string; border: string };

const links: CardDef[] = [
  { href: '/dashboard/admin-gateway/contracts/list',        icon: FileSignature, label: 'قائمة العقود',   desc: 'جميع العقود وحالتها الحالية',           color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20' },
  { href: '/dashboard/admin-gateway/contracts/contractors', icon: Users2,        label: 'المقاولون',       desc: 'سجل المقاولين والموردين المعتمدين',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { href: '/dashboard/admin-gateway/workflow/approvals',    icon: FileText,      label: 'موافقات العقود',  desc: 'الاعتمادات والتوقيعات المعلقة',         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
];

export default function ContractsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">إدارة العقود</h1>
              <p className="text-sm text-slate-500">العقود، المقاولون، والموافقات</p>
            </div>
          </div>
          <div className="h-px bg-slate-800 mt-4" />
        </div>

        {/* Manager Card */}
        <Link href="/dashboard/contracts/manager" className="group block mb-8">
          <div className="bg-slate-900 border border-green-500/30 rounded-2xl p-5 hover:border-green-500/60 hover:bg-slate-800/70 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-white">مدير إدارة العقود</h2>
                <p className="text-green-400/70 text-xs mt-0.5">لوحة المدير — الأقسام والمراسلات الإدارية</p>
              </div>
              <span className="text-green-400 text-xs font-semibold flex items-center gap-1">فتح لوحة المدير <span className="group-hover:translate-x-[-3px] transition-transform inline-block">←</span></span>
            </div>
          </div>
        </Link>

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
      </div>
    </div>
  );
}
