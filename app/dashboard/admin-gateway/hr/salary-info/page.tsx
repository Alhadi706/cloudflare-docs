'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, Search, ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface SalaryInfo {
  employee_id: number;
  employee?: { full_name: string; full_name_ar?: string; position?: { title_ar: string } };
  base_salary: number;
  allowances?: number;
  deductions?: number;
  net_salary?: number;
  payment_method?: string;
  bank_account?: string;
}

export default function SalaryInfoPage() {
  const [salaries, setSalaries] = useState<SalaryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSalaries();
  }, []);
  const fetchSalaries = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/salary-info', {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (response.ok) {
        const data = await response.json();
        const mapped = (data.salaries || []).map((s: any) => ({
          employee_id: s.employee_id,
          base_salary: parseFloat(s.base_salary) || 0,
          net_salary: parseFloat(s.base_salary) || 0,
          allowances: 200,
          deductions: Math.round(parseFloat(s.base_salary) * 0.05),
          employee: {
            full_name: s.full_name,
            full_name_ar: s.full_name_ar,
            position: { title_ar: s.grade_name || s.contract_type },
          },
          payment_method: 'bank_transfer',
        }));
        setSalaries(mapped);
      }
    } catch (error) {
      console.error('Error fetching salaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSalaries = salaries.filter(s =>
    s.employee?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.employee?.full_name_ar?.includes(searchTerm)
  );

  const totalSalaries = salaries.reduce((sum, s) => sum + (s.base_salary || 0), 0);
  const totalAllowances = salaries.reduce((sum, s) => sum + (s.allowances || 0), 0);
  const totalDeductions = salaries.reduce((sum, s) => sum + (s.deductions || 0), 0);
  const netPayroll = salaries.reduce((sum, s) => sum + (s.net_salary || s.base_salary || 0), 0);

  const formatCurrency = (amount?: number) => {
    if (!amount) return '0 دينار';
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr">الموارد البشرية</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">معلومات الرواتب</span>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600/20 p-4 rounded-xl border border-emerald-500/50">
              <DollarSign className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">معلومات الرواتب</h1>
              <p className="text-slate-400 mt-1">تفاصيل رواتب الموظفين والأجور</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الرواتب الأساسية</span>
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalSalaries)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي البدلات</span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalAllowances)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الاستقطاعات</span>
              <TrendingDown className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalDeductions)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">صافي الرواتب</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(netPayroll)}</div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالموظف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredSalaries.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد نتائج</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموظف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الوظيفة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الراتب الأساسي</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">البدلات</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الاستقطاعات</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">صافي الراتب</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">طريقة الدفع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredSalaries.map((salary) => (
                    <tr key={salary.employee_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-200">
                        {salary.employee?.full_name_ar || salary.employee?.full_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {salary.employee?.position?.title_ar || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-medium">
                        {formatCurrency(salary.base_salary)}
                      </td>
                      <td className="px-6 py-4 text-sm text-emerald-400">
                        +{formatCurrency(salary.allowances || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-rose-400">
                        -{formatCurrency(salary.deductions || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-100 font-bold">
                        {formatCurrency(salary.net_salary || salary.base_salary)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {salary.payment_method || 'تحويل بنكي'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
