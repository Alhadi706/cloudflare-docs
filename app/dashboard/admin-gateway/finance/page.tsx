'use client';

import React from 'react';
import { Wallet, DollarSign, FileText, TrendingUp, ArrowLeftRight, PieChart, BarChart3, ArrowRight, Building2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useErpContextStore } from '@/store/erpContextStore';
import DepartmentAssetInbox from '@/components/DepartmentAssetInbox';
import InternalMailTab from '@/components/InternalMailTab';

export default function FinancePage() {
  const erpCtx = useErpContextStore();
  const activeProject = erpCtx.getActiveProject();
  const activeSite    = erpCtx.getActiveSite();
  const submodules = [
    {
      title: 'الميزانيات',
      titleEn: 'Budgets',
      icon: <DollarSign className="w-8 h-8 text-blue-400" />,
      color: 'bg-blue-600/20 border-blue-500/50',
      description: 'إدارة الميزانيات السنوية والموافقة عليها ومتابعة الاستهلاك',
      href: '/dashboard/admin-gateway/finance/budgets',
      features: ['إنشاء ميزانيات', 'الموافقة على الميزانيات', 'تقارير الاستهلاك']
    },
    {
      title: 'النفقات',
      titleEn: 'Expenses',
      icon: <FileText className="w-8 h-8 text-rose-400" />,
      color: 'bg-rose-600/20 border-rose-500/50',
      description: 'تسجيل النفقات والموافقة عليها وربطها بالميزانيات والفئات',
      href: '/dashboard/admin-gateway/finance/expenses',
      features: ['تسجيل نفقات', 'فئات النفقات', 'الموافقة والترحيل']
    },
    {
      title: 'التخصيصات',
      titleEn: 'Budget Allocations',
      icon: <PieChart className="w-8 h-8 text-emerald-400" />,
      color: 'bg-emerald-600/20 border-emerald-500/50',
      description: 'توزيع الميزانيات على الأقسام والمشاريع والبنود',
      href: '/dashboard/admin-gateway/finance/allocations',
      features: ['توزيع الميزانية', 'تخصيص الأقسام', 'متابعة التوزيع']
    },
    {
      title: 'النقل بين الميزانيات',
      titleEn: 'Budget Transfers',
      icon: <ArrowLeftRight className="w-8 h-8 text-purple-400" />,
      color: 'bg-purple-600/20 border-purple-500/50',
      description: 'نقل المبالغ بين الميزانيات والموافقة على عمليات النقل',
      href: '/dashboard/admin-gateway/finance/transfers',
      features: ['طلب نقل', 'الموافقة على النقل', 'سجل التحويلات']
    },
    {
      title: 'التتبع المالي للأصول',
      titleEn: 'Asset Financial Tracking',
      icon: <TrendingUp className="w-8 h-8 text-amber-400" />,
      color: 'bg-amber-600/20 border-amber-500/50',
      description: 'تقييمات الأصول وتسجيل الاستبعادات المالية وتتبع القيمة',
      href: '/dashboard/admin-gateway/finance/asset-tracking',
      features: ['تقييم الأصول', 'سجل الاستبعاد', 'تاريخ القيمة']
    },
    {
      title: 'التقارير المالية',
      titleEn: 'Financial Reports',
      icon: <BarChart3 className="w-8 h-8 text-cyan-400" />,
      color: 'bg-cyan-600/20 border-cyan-500/50',
      description: 'تنبيهات تجاوز الميزانية وتقارير تحليلية وملخصات مالية',
      href: '/dashboard/admin-gateway/finance/reports',
      features: ['تنبيهات التجاوز', 'التحليل المالي', 'الملخصات']
    }
  ];

  return (
    <div className="min-h-full bg-transparent p-3 md:p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        
        {/* Header with Breadcrumb */}
        <div className="space-y-4">
          <Link 
            href="/dashboard/admin-gateway" 
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى البوابة الرئيسية</span>
          </Link>
          
          <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl">
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 p-4">
              <Wallet className="w-10 h-10 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">الإدارة المالية</h1>
              <p className="mt-2 text-white/75">
                نظام شامل لإدارة الميزانيات والنفقات والتقارير المالية
              </p>
              {activeProject && (
                <div className="flex items-center gap-2 mt-2 text-[11px]">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-indigo-300">{activeProject.project_name || activeProject.name}</span>
                  {activeSite && (<><span className="text-gray-600">›</span><MapPin className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-300">{activeSite.name}</span></>)}
                  {!activeSite && <span className="text-gray-500">— كل المواقع</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unified shared assets inbox for finance */}
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-xl">
          <DepartmentAssetInbox department="finance" title="الأصول الموحدة - الإدارة المالية" compact />
        </div>

        <InternalMailTab
          department="finance"
          title="المراسلات الداخلية - مدير الإدارة المالية"
        />

        {/* Submodules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {submodules.map((submodule, index) => (
            <Link 
              key={index} 
              href={submodule.href}
              className={`block rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/40 group`}
            >
              <div className="flex flex-col h-full gap-4">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center border ${submodule.color}`}>
                  {submodule.icon}
                </div>
                
                {/* Title */}
                <div>
                  <h3 className="mb-1 text-lg font-bold text-white">{submodule.title}</h3>
                  <p className="text-xs font-mono text-white/60">{submodule.titleEn}</p>
                </div>
                
                {/* Description */}
                <p className="flex-grow text-sm leading-relaxed text-white/75">
                  {submodule.description}
                </p>
                
                {/* Features */}
                <div className="pt-4 border-t border-white/10">
                  <ul className="space-y-1">
                    {submodule.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-white/70">
                        <span className="w-1 h-1 rounded-full bg-white/50"></span>
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
