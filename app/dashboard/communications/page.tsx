'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Mail, Send, MessageSquare, Archive, Bell } from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

type MailTab = 'inbox' | 'outbox' | 'compose';

type CardDef = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
  internalTab?: MailTab;
};

const links: CardDef[] = [
  { href: '/dashboard/admin-gateway/correspondence/incoming', icon: Mail,          label: 'الوارد',             desc: 'المعاملات والمراسلات الواردة',           color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20', internalTab: 'inbox' },
  { href: '/dashboard/admin-gateway/correspondence/outgoing', icon: Send,          label: 'الصادر',             desc: 'المعاملات الصادرة والمرسلة',             color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', internalTab: 'outbox' },
  { href: '/dashboard/admin-gateway/correspondence/internal', icon: MessageSquare, label: 'الداخلية',           desc: 'المذكرات والمراسلات الداخلية',           color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20', internalTab: 'compose' },
  { href: '/dashboard/admin-gateway/correspondence/archive',  icon: Archive,       label: 'الأرشيف',            desc: 'الأرشيف الرقمي لجميع المعاملات',        color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { href: '/dashboard/admin-gateway/notifications',           icon: Bell,          label: 'مركز الإشعارات',     desc: 'التنبيهات العاجلة والمهام المعلقة',     color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
];

export default function CommunicationsPage() {
  const [activeInternalTab, setActiveInternalTab] = useState<MailTab>('inbox');
  const cards = useMemo(() => links, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <Mail className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">الاتصالات والمراسلات</h1>
              <p className="text-sm text-slate-500">الوارد والصادر والداخلية والأرشيف</p>
            </div>
          </div>
          <div className="h-px bg-slate-800 mt-4" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map(({ href, icon: Icon, label, desc, color, bg, border, internalTab }) => (
            internalTab ? (
              <button
                key={href}
                type="button"
                onClick={() => setActiveInternalTab(internalTab)}
                className={`group text-right flex flex-col gap-3 p-4 rounded-xl border ${border} ${bg} hover:scale-[1.02] transition-transform`}
              >
                <div className={`w-9 h-9 rounded-lg bg-slate-900 border ${border} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${color}`}>{label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </button>
            ) : (
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
            )
          ))}
        </div>
        <div className="mt-6">
          <InternalMailTab
            department="communications_manager"
            title="نظام المراسلات الموحد - إدارة الاتصالات"
            initialTab={activeInternalTab}
          />
        </div>
      </div>
    </div>
  );
}
