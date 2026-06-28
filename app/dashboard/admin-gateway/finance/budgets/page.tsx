'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, FileText, Plus, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import ImportButton from '@/components/ImportButton';
import Link from 'next/link';
import BudgetForm from '@/components/forms/BudgetForm';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface Budget {
  id?: number;
  project_name?: string;
  budget?: number;
  status?: string;
  organization?: string;
  start_date?: string;
  end_date?: string;
  // Legacy fields for compatibility
  budget_code?: string;
  budget_name?: string;
  budget_name_ar?: string;
  budget_type?: string;
  budget_year?: number;
  total_amount?: number;
  consumed_amount?: number;
  available_amount?: number;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editBudget, setEditBudget] = useState<any>(null);

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    try {
      const res = await fetch('/api/v1/finance/budgets', {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (res.ok) {
        const data = await res.json();
        setBudgets(data.budgets || []);
      } else {
        setBudgets([]);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary stats
  const totalBudget = budgets.reduce((sum, b) => sum + (b.budget || b.total_amount || 0), 0);
  const totalConsumed = budgets.reduce((sum, b) => sum + (b.consumed_amount || 0), 0);
  const totalAvailable = totalBudget - totalConsumed;
  const consumptionRate = totalBudget > 0 ? (totalConsumed / totalBudget) * 100 : 0;
  const activeBudgets = budgets.filter(b => b.status === 'active' || b.status === 'in_progress').length;

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
      case 'draft': return 'text-slate-400 bg-slate-500/10';
      case 'approved': return 'text-blue-400 bg-blue-500/10';
      case 'closed': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'نشطة';
      case 'draft': return 'مسودة';
      case 'approved': return 'معتمدة';
      case 'closed': return 'مغلقة';
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
          <span className="text-slate-200">الميزانيات</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/50">
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">إدارة الميزانيات</h1>
              <p className="text-slate-400 mt-1">إنشاء الميزانيات السنوية والموافقة عليها ومتابعة الاستهلاك</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="budgets" onSuccess={fetchBudgets} />
            <button 
              onClick={() => setShowBudgetForm(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>إضافة ميزانية</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الميزانية</span>
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalBudget)}</div>
            <div className="text-xs text-slate-500 mt-1">{budgets.length} ميزانية</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">المنصرف</span>
              <TrendingDown className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalConsumed)}</div>
            <div className="text-xs text-slate-500 mt-1">{consumptionRate.toFixed(1)}% من الميزانية</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">المتاح</span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalAvailable)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">الميزانيات النشطة</span>
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{activeBudgets}</div>
          </div>
        </div>

        {/* Budgets Table */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                جاري التحميل...
              </div>
            ) : budgets.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد ميزانيات بعد</p>
                <p className="text-slate-500 text-sm mt-2">ابدأ بإضافة ميزانية جديدة</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">رمز الميزانية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم الميزانية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">النوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">السنة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المبلغ الكلي</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المنصرف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المتاح</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">نسبة الاستهلاك</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {budgets.map((budget) => {
                    const consumption = budget.total_amount > 0 
                      ? (budget.consumed_amount / budget.total_amount) * 100 
                      : 0;
                    
                    return (
                      <tr key={budget.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-300 font-mono">{budget.budget_code}</td>
                        <td className="px-6 py-4 text-sm text-slate-200">{budget.budget_name_ar || budget.budget_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-400">{budget.budget_type}</td>
                        <td className="px-6 py-4 text-sm text-slate-400">{budget.budget_year}</td>
                        <td className="px-6 py-4 text-sm text-slate-200 font-medium">{formatCurrency(budget.total_amount)}</td>
                        <td className="px-6 py-4 text-sm text-rose-400">{formatCurrency(budget.consumed_amount)}</td>
                        <td className="px-6 py-4 text-sm text-emerald-400">{formatCurrency(budget.available_amount)}</td>
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
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                            {getStatusLabel(budget.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => {
                              setEditBudget(budget);
                              setShowBudgetForm(true);
                            }}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            تعديل
                          </button>
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

      {/* Budget Form */}
      {showBudgetForm && (
        <BudgetForm
          onClose={() => {
            setShowBudgetForm(false);
            setEditBudget(null);
          }}
          onSuccess={() => {
            fetchBudgets();
            setShowBudgetForm(false);
            setEditBudget(null);
          }}
          editData={editBudget}
        />
      )}
    </div>
  );
}
