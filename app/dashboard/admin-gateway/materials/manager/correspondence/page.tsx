'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Mail,
  Inbox,
  Send,
  MessageSquare,
  Megaphone,
  Building2,
  Users,
  ShieldCheck,
} from 'lucide-react';

type CommunicationCard = {
  title: string;
  subtitle: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  tone: string;
  bullets: string[];
};

export default function MaterialsManagerCorrespondencePage() {
  const communicationCards: CommunicationCard[] = [
    {
      title: 'بريد وارد الإدارة',
      subtitle: 'Incoming Mail',
      desc: 'استلام الخطابات والمكاتبات الواردة ومتابعة الإحالات والردود.',
      href: '/dashboard/admin-gateway/correspondence/incoming',
      icon: Inbox,
      tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      bullets: ['استلام الوارد', 'توجيه المعاملات', 'متابعة الرد'],
    },
    {
      title: 'بريد صادر الإدارة',
      subtitle: 'Outgoing Mail',
      desc: 'إرسال مخاطبات رسمية إلى الإدارات الأخرى والجهات الداخلية.',
      href: '/dashboard/admin-gateway/correspondence/outgoing',
      icon: Send,
      tone: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
      bullets: ['إنشاء خطاب', 'إرسال رسمي', 'تتبع الإرسال'],
    },
    {
      title: 'المذكرات الداخلية بين الإدارات',
      subtitle: 'Internal Memos',
      desc: 'التواصل السريع بين إدارة المواد والمالية والصيانة والمشاريع والأصول.',
      href: '/dashboard/admin-gateway/correspondence/internal',
      icon: MessageSquare,
      tone: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300',
      bullets: ['من إدارة إلى إدارة', 'إشعارات داخلية', 'متابعة التنفيذ'],
    },
    {
      title: 'تعميم على موظفي الإدارة',
      subtitle: 'Department Broadcasts',
      desc: 'نشر تعميم داخلي أو إشعار أو سياسة إلى موظفي إدارة المواد حسب الفئة أو الإدارة.',
      href: '/dashboard/admin-gateway/circulars',
      icon: Megaphone,
      tone: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      bullets: ['إرسال تعميم', 'استهداف موظفي الإدارة', 'إرفاق ملفات وتعليمات'],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <Link
            href="/dashboard/admin-gateway/materials/manager"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-2"
          >
            <ArrowRight className="w-4 h-4" />
            مدير إدارة المواد
          </Link>
          <h1 className="text-2xl font-bold text-white">مراسلات مدير إدارة المواد</h1>
        </div>

        <section className="rounded-2xl border border-fuchsia-500/30 bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-fuchsia-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">التواصل مع بقية الإدارات</h2>
              <p className="text-xs text-fuchsia-200/80 mt-0.5">مربوط بالنظام الحالي للوارد والصادر والمذكرات الداخلية والتعاميم</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-2 text-xs text-slate-300">
            {['المالية', 'الصيانة', 'المشاريع', 'الأصول', 'الموارد البشرية'].map((dept) => (
              <div key={dept} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 inline-flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {dept}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-100">تبويبات المراسلات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {communicationCards.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-2xl border border-white/10 bg-slate-900 p-5 hover:bg-slate-800/60 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.tone}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{item.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-300 leading-5">{item.desc}</p>
                  <div className="mt-3 space-y-1.5">
                    {item.bullets.map((bullet) => (
                      <div key={bullet} className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-slate-500" />
                        {bullet}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 group-hover:text-slate-200 transition-colors inline-flex items-center gap-1">
                    فتح التبويب
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-bold text-slate-100">ربط النظام مع بقية الإدارات</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
              <div className="inline-flex items-center gap-2 font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                المالية
              </div>
              <p className="mt-2 text-slate-400 leading-5">اعتمادات الشراء، الالتزامات المالية، ومخاطبات الميزانية.</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
              <div className="inline-flex items-center gap-2 font-semibold text-white">
                <Users className="w-4 h-4 text-rose-300" />
                الصيانة والمشاريع
              </div>
              <p className="mt-2 text-slate-400 leading-5">طلبات المواد، التنسيق للتسليم، وجدولة الاحتياجات التشغيلية.</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
              <div className="inline-flex items-center gap-2 font-semibold text-white">
                <Building2 className="w-4 h-4 text-cyan-300" />
                الأصول والموارد البشرية
              </div>
              <p className="mt-2 text-slate-400 leading-5">تحويل المواد للأصول عند الحاجة، وإرسال تعاميم داخلية لموظفي الإدارة.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}