'use client';

import React from 'react';
import { FileText, Mail, Send, Inbox, Archive, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CorrespondencePage() {
  const submodules = [
    {
      title: 'الصادر',
      titleEn: 'Outgoing Letters',
      icon: <Send className="w-8 h-8 text-blue-400" />,
      color: 'bg-blue-600/20 border-blue-500/50',
      description: 'إدارة الخطابات الصادرة والموافقة عليها وإرسالها',
      href: '/dashboard/admin-gateway/correspondence/outgoing',
      features: ['إنشاء خطاب', 'الموافقة', 'الإرسال', 'التتبع']
    },
    {
      title: 'الوارد',
      titleEn: 'Incoming Letters',
      icon: <Inbox className="w-8 h-8 text-emerald-400" />,
      color: 'bg-emerald-600/20 border-emerald-500/50',
      description: 'استقبال وتوجيه ومتابعة الخطابات الواردة',
      href: '/dashboard/admin-gateway/correspondence/incoming',
      features: ['الاستلام', 'التوجيه', 'المتابعة', 'الرد']
    },
    {
      title: 'المذكرات الداخلية',
      titleEn: 'Internal Memos',
      icon: <Mail className="w-8 h-8 text-purple-400" />,
      color: 'bg-purple-600/20 border-purple-500/50',
      description: 'التواصل الداخلي بين الأقسام والموظفين',
      href: '/dashboard/admin-gateway/correspondence/internal',
      features: ['إنشاء مذكرة', 'الإرسال', 'الإشعارات']
    },
    {
      title: 'الأرشيف',
      titleEn: 'Archive',
      icon: <Archive className="w-8 h-8 text-amber-400" />,
      color: 'bg-amber-600/20 border-amber-500/50',
      description: 'أرشفة وبحث جميع المراسلات السابقة',
      href: '/dashboard/admin-gateway/correspondence/archive',
      features: ['البحث المتقدم', 'التصنيف', 'التصدير']
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumb */}
        <div className="space-y-4">
          <Link 
            href="/dashboard/admin-gateway" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى البوابة الرئيسية</span>
          </Link>
          
          {/* Header */}
          <div className="flex items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <div className="bg-cyan-600/20 p-4 rounded-xl border border-cyan-500/50">
              <FileText className="w-10 h-10 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">الاتصالات الإدارية</h1>
              <p className="text-slate-400 mt-2 text-lg">
                نظام شامل لإدارة الصادر والوارد والمراسلات الداخلية
              </p>
            </div>
          </div>
        </div>

        {/* Submodules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {submodules.map((submodule, index) => (
            <Link 
              key={index} 
              href={submodule.href}
              className={`block p-6 rounded-2xl border ${submodule.color} bg-slate-900/40 hover:bg-slate-800/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/50 group`}
            >
              <div className="flex flex-col h-full gap-4">
                {/* Icon */}
                <div className="bg-slate-900/50 w-16 h-16 rounded-xl flex items-center justify-center border border-slate-700/50 group-hover:border-slate-600 transition-colors">
                  {submodule.icon}
                </div>
                
                {/* Title */}
                <div>
                  <h3 className="text-xl font-bold text-slate-200 mb-1">{submodule.title}</h3>
                  <p className="text-slate-500 text-sm font-mono">{submodule.titleEn}</p>
                </div>
                
                {/* Description */}
                <p className="text-slate-400 leading-relaxed text-sm flex-grow">
                  {submodule.description}
                </p>
                
                {/* Features */}
                <div className="pt-4 border-t border-slate-700/50">
                  <ul className="space-y-1">
                    {submodule.features.map((feature, idx) => (
                      <li key={idx} className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
