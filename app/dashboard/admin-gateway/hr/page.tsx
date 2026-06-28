'use client';

import React from 'react';
import { Users, UserCheck, Building2, Award, Calendar, Clock, FileText, DollarSign, TrendingUp, ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useErpContextStore } from '@/store/erpContextStore';

export default function HRPage() {
  const erpCtx = useErpContextStore();
  const activeProject = erpCtx.getActiveProject();
  const activeSite    = erpCtx.getActiveSite();
  const submodules = [
    {
      title: 'الموظفون',
      titleEn: 'Employees',
      icon: <Users className="w-8 h-8 text-blue-400" />,
      color: 'bg-blue-600/20 border-blue-500/50',
      description: 'إدارة بيانات الموظفين الشخصية والوظيفية والتواصل',
      href: '/dashboard/admin-gateway/hr/employees',
      features: ['إضافة موظف', 'تعديل البيانات', 'حالة التوظيف']
    },
    {
      title: 'الأقسام والوحدات',
      titleEn: 'Departments',
      icon: <Building2 className="w-8 h-8 text-emerald-400" />,
      color: 'bg-emerald-600/20 border-emerald-500/50',
      description: 'إدارة الهيكل التنظيمي للأقسام والوحدات والأقسام الفرعية',
      href: '/dashboard/admin-gateway/hr/departments',
      features: ['إضافة قسم', 'الهيكل التنظيمي', 'مدراء الأقسام']
    },
    {
      title: 'المناصب الوظيفية',
      titleEn: 'Positions',
      icon: <Award className="w-8 h-8 text-purple-400" />,
      color: 'bg-purple-600/20 border-purple-500/50',
      description: 'إدارة المناصب والمسميات الوظيفية والمهام والمسؤوليات',
      href: '/dashboard/admin-gateway/hr/positions',
      features: ['إضافة منصب', 'الوصف الوظيفي', 'المتطلبات']
    },
    {
      title: 'الدرجات الوظيفية',
      titleEn: 'Grades',
      icon: <TrendingUp className="w-8 h-8 text-cyan-400" />,
      color: 'bg-cyan-600/20 border-cyan-500/50',
      description: 'إدارة الدرجات والمستويات الوظيفية وسلالم الرواتب',
      href: '/dashboard/admin-gateway/hr/grades',
      features: ['إضافة درجة', 'نطاق الرواتب', 'الترقيات']
    },
    {
      title: 'طلبات الإجازات',
      titleEn: 'Leave Management',
      icon: <Calendar className="w-8 h-8 text-rose-400" />,
      color: 'bg-rose-600/20 border-rose-500/50',
      description: 'إدارة طلبات الإجازات والموافقة عليها ومتابعة الأرصدة',
      href: '/dashboard/admin-gateway/hr/leave-management',
      features: ['طلب إجازة', 'الموافقة', 'رصيد الإجازات']
    },
    {
      title: 'الحضور والانصراف',
      titleEn: 'Attendance',
      icon: <Clock className="w-8 h-8 text-amber-400" />,
      color: 'bg-amber-600/20 border-amber-500/50',
      description: 'تسجيل الحضور والانصراف ومتابعة التأخير والغياب',
      href: '/dashboard/admin-gateway/hr/attendance',
      features: ['تسجيل الحضور', 'التقارير', 'الاستثناءات']
    },
    {
      title: 'العقود',
      titleEn: 'Contracts',
      icon: <FileText className="w-8 h-8 text-indigo-400" />,
      color: 'bg-indigo-600/20 border-indigo-500/50',
      description: 'إدارة عقود العمل والتجديدات والشروط والأحكام',
      href: '/dashboard/admin-gateway/hr/contracts',
      features: ['إضافة عقد', 'التجديد', 'الإنهاء']
    },
    {
      title: 'إعدادات الرواتب',
      titleEn: 'Payroll Configuration',
      icon: <DollarSign className="w-8 h-8 text-emerald-400" />,
      color: 'bg-emerald-600/20 border-emerald-500/50',
      description: 'إدارة قواعد البدلات والاستقطاعات والمعادلات الخاصة',
      href: '/dashboard/admin-gateway/hr/payroll-config',
      features: ['قواعد البدلات', 'الاستقطاعات', 'الاستثناءات']
    },
    {
      title: 'معلومات الرواتب',
      titleEn: 'Salary Information',
      icon: <UserCheck className="w-8 h-8 text-blue-400" />,
      color: 'bg-blue-600/20 border-blue-500/50',
      description: 'عرض تفاصيل رواتب الموظفين والبدلات والاستقطاعات',
      href: '/dashboard/admin-gateway/hr/salary-info',
      features: ['الراتب الأساسي', 'البدلات', 'الاستقطاعات', 'الصافي']
    },
    {
      title: 'المسميات الوظيفية الرسمية',
      titleEn: 'Job Titles',
      icon: <FileText className="w-8 h-8 text-indigo-400" />,
      color: 'bg-indigo-600/20 border-indigo-500/50',
      description: 'المسميات الوظيفية الرسمية المعتمدة — الأكواد والتصنيفات',
      href: '/dashboard/admin-gateway/hr/job-titles',
      features: ['إضافة مسمى', 'التصنيف', 'الحالة']
    },
    {
      title: 'تعيين على المناصب',
      titleEn: 'Position Assignments',
      icon: <UserCheck className="w-8 h-8 text-teal-400" />,
      color: 'bg-teal-600/20 border-teal-500/50',
      description: 'ربط الموظفين بالمناصب المعتمدة مع تتبع الطاقة الاستيعابية',
      href: '/dashboard/admin-gateway/hr/assignments',
      features: ['تعيين موظف', 'ربط بمشروع', 'الطاقة الاستيعابية']
    },
    {
      title: 'سجلات الترقيات',
      titleEn: 'Promotions',
      icon: <TrendingUp className="w-8 h-8 text-amber-400" />,
      color: 'bg-amber-600/20 border-amber-500/50',
      description: 'توثيق الترقيات بأرقام القرارات والدرجات المرتبطة',
      href: '/dashboard/admin-gateway/hr/promotions',
      features: ['تسجيل ترقية', 'رقم القرار', 'من/إلى درجة']
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
            <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/50">
              <Users className="w-10 h-10 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">إدارة الموارد البشرية</h1>
              <p className="text-slate-400 mt-2 text-lg">
                نظام شامل لإدارة الموظفين والرواتب والحضور والإجازات
              </p>
              {activeProject && (
                <div className="flex items-center gap-2 mt-2 text-[11px]">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-indigo-300">{activeProject.project_name || activeProject.name}</span>
                  {activeSite && (
                    <><span className="text-gray-600">›</span><MapPin className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-300">{activeSite.name}</span></>
                  )}
                  {!activeSite && <span className="text-gray-500">— كل المواقع</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submodules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
