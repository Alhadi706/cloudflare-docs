'use client';
import Link from 'next/link';
import { Shield, Users, Settings, Search, Key, Activity } from 'lucide-react';

const links = [
  {
    href: '/dashboard/admin-gateway/system/users',
    icon: Users,
    label: 'إدارة المستخدمين',
    desc: 'إضافة المستخدمين وإدارة الحسابات',
    color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
  },
  {
    href: '/dashboard/admin-gateway/system',
    icon: Settings,
    label: 'إعدادات النظام',
    desc: 'إعدادات النظام والتكوين العام',
    color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20',
  },
  {
    href: '/dashboard/system-explorer',
    icon: Search,
    label: 'مستكشف النظام',
    desc: 'استكشاف بنية النظام والبيانات',
    color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20',
  },
  {
    href: '/dashboard/admin-gateway/workflow/approvals',
    icon: Shield,
    label: 'الموافقات والصلاحيات',
    desc: 'إدارة مستويات الوصول وقواعد الموافقة',
    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20',
  },
  {
    href: '/dashboard/admin-gateway/workflow/templates',
    icon: Key,
    label: 'قوالب سير العمل',
    desc: 'تعريف قوالب الموافقات وتدفقات العمل',
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
  },
  {
    href: '/dashboard/admin-gateway/notifications',
    icon: Activity,
    label: 'مركز الإشعارات',
    desc: 'التنبيهات العاجلة وإشعارات النظام',
    color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20',
  },
];

export default function AdminControlPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-slate-500/20 border border-slate-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">التحكم بالنظام</h1>
              <p className="text-sm text-slate-500">إدارة المستخدمين والصلاحيات وإعدادات النظام</p>
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
