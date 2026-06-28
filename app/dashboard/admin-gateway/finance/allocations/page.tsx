'use client';

import React, { useState, useEffect } from 'react';
import { getUserAuthHeaders } from "@/store/useUserStore";
import { PieChart, Plus, DollarSign, Building2, Layers } from 'lucide-react';
import Link from 'next/link';

interface BudgetAllocation {
  id: number;
  budget_id: number;
  budget_name?: string;
  department_id?: number;
  department_name?: string;
  project_id?: number;
  project_name?: string;
  allocated_amount: number;
  consumed_amount: number;
  available_amount: number;
  allocation_date: string;
  fiscal_year: number;
  status: string;
}

interface Budget {
  id: number;
  budget_code: string;
  budget_name: string;
  budget_name_ar?: string;
  total_amount: number;
}

export default function BudgetAllocationsPage() {
  const [allocations, setAllocations] = useState<BudgetAllocation[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);

  useEffect(() => {
    fetchBudgets();
  }, []);

  useEffect(() => {
    if (selectedBudget) {
      fetchAllocations(selectedBudget);
    }
  }, [selectedBudget]);

  const fetchBudgets = async () => {
    try {
      const response = await fetch('/api/v1/finance/budgets', { headers: getUserAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setBudgets(data.budgets || []);
        if (data.budgets && data.budgets.length > 0) {
          setSelectedBudget(data.budgets[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
    }
  };

  const fetchAllocations = async (budgetId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/finance/budgets/${budgetId}/allocations`);
      if (response.ok) {
        const data = await response.json();
        setAllocations(data.allocations || []);
      }
    } catch (error) {
      console.error('Error fetching allocations:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + (a.allocated_amount || 0), 0);
  const totalConsumed = allocations.reduce((sum, a) => sum + (a.consumed_amount || 0), 0);
  const totalAvailable = allocations.reduce((sum, a) => sum + (a.available_amount || 0), 0);
  const selectedBudgetData = budgets.find(b => b.id === selectedBudget);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-500/10';
      case 'completed': return 'text-blue-400 bg-blue-500/10';
      case 'cancelled': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'completed': return 'مكتمل';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/admin-gateway" className="text-slate-400 hover:text-slate-300 transition-colors">
            البوابة الرئيسية
          </Link>
          <span className="text-slate-600">/</span>
          <Link href="/dashboard/admin-gateway/finance" className="text-slate-400 hover:text-slate-300 transition-colors">
            الإدارة المالية
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200">التخصيصات</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600/20 p-4 rounded-xl border border-emerald-500/50">
              <PieChart className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">تخصيصات الميزانية</h1>
              <p className="text-slate-400 mt-1">توزيع الميزانيات على الأقسام والمشاريع</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 transition-colors">
            <Plus className="w-5 h-5" />
            <span>إضافة تخصيص</span>
          </button>
        </div>

        {/* Budget Selector */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
          <label className="text-slate-400 text-sm mb-2 block">اختر الميزانية</label>
          <select
            value={selectedBudget || ''}
            onChange={(e) => setSelectedBudget(Number(e.target.value))}
            className="w-full md:w-96 bg-slate-800 border border-slate-700 text-slate-200 px-4 py-3 rounded-lg focus:outline-none focus:border-emerald-500"
          >
            <option value="">-- اختر ميزانية --</option>
            {budgets.map(budget => (
              <option key={budget.id} value={budget.id}>
                {budget.budget_code} - {budget.budget_name_ar || budget.budget_name}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        {selectedBudgetData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">إجمالي الميزانية</span>
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100">{formatCurrency(selectedBudgetData.total_amount)}</div>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">المخصص</span>
                <Layers className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalAllocated)}</div>
              <div className="text-xs text-slate-500 mt-1">
                {selectedBudgetData.total_amount > 0 
                  ? ((totalAllocated / selectedBudgetData.total_amount) * 100).toFixed(1) 
                  : 0}% من الميزانية
              </div>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">المستهلك</span>
                <DollarSign className="w-5 h-5 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalConsumed)}</div>
            </div>

            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">عدد التخصيصات</span>
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100">{allocations.length}</div>
            </div>
          </div>
        )}

        {/* Allocations Table */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {!selectedBudget ? (
              <div className="p-12 text-center">
                <PieChart className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">اختر ميزانية لعرض التخصيصات</p>
              </div>
            ) : loading ? (
              <div className="p-12 text-center text-slate-400">
                جاري التحميل...
              </div>
            ) : allocations.length === 0 ? (
              <div className="p-12 text-center">
                <PieChart className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد تخصيصات لهذه الميزانية</p>
                <p className="text-slate-500 text-sm mt-2">ابدأ بإضافة تخصيص جديد</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الجهة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">النوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المبلغ المخصص</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المستهلك</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المتبقي</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">نسبة الاستهلاك</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">التاريخ</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {allocations.map((allocation) => {
                    const consumption = allocation.allocated_amount > 0
                      ? (allocation.consumed_amount / allocation.allocated_amount) * 100
                      : 0;

                    return (
                      <tr key={allocation.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-200">
                          {allocation.department_name || allocation.project_name || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {allocation.department_id ? 'قسم' : allocation.project_id ? 'مشروع' : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                          {formatCurrency(allocation.allocated_amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-rose-400">
                          {formatCurrency(allocation.consumed_amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-emerald-400">
                          {formatCurrency(allocation.available_amount)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-700 rounded-full h-2 max-w-[100px]">
                              <div 
                                className={`h-2 rounded-full ${
                                  consumption > 90 ? 'bg-rose-500' :
                                  consumption > 70 ? 'bg-amber-500' :
                                  'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(consumption, 100)}%` }}
                              />
                            </div>
                            <span className="text-slate-400 text-xs">{consumption.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {new Date(allocation.allocation_date).toLocaleDateString('ar-LY')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(allocation.status)}`}>
                            {getStatusLabel(allocation.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
