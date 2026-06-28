'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Search, ChevronLeft, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface ProjectBudget {
  id: number;
  project_id?: number;
  project_name: string;
  total_budget: number;
  allocated_budget?: number;
  spent_amount: number;
  remaining_budget: number;
  budget_utilization: number;
  cost_categories?: {
    labor?: number;
    materials?: number;
    equipment?: number;
    overhead?: number;
  };
  expenses?: ProjectExpense[];
  fiscal_year?: string;
  status: string;
  last_updated?: string;
}

interface ProjectExpense {
  id: number;
  expense_name: string;
  category: string;
  amount: number;
  expense_date?: string;
  description?: string;
}

export default function ProjectBudgetPage() {
  const [budgets, setBudgets] = useState<ProjectBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [expenseFormData, setExpenseFormData] = useState({
    expense_name: '',
    category: 'labor',
    amount: '',
    expense_date: '',
    description: ''
  });

  useEffect(() => {
    fetchBudgets();
  }, []);
  const fetchBudgets = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/project-budgets', {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (response.ok) {
        const data = await response.json();
        const processedBudgets = (data.budgets || []).map((b: any) => ({
          id: b.id,
          project_id: b.entity_id,
          project_name: b.project_name || b.budget_name_ar || b.budget_name,
          total_budget: parseFloat(b.total_amount) || 0,
          allocated_budget: parseFloat(b.allocated_amount) || 0,
          spent_amount: parseFloat(b.consumed_amount) || 0,
          remaining_budget: parseFloat(b.available_amount) || 0,
          budget_utilization: b.total_amount > 0
            ? ((b.consumed_amount || 0) / b.total_amount) * 100
            : 0,
          status: b.status || 'active',
          fiscal_year: b.budget_year?.toString(),
        }));
        setBudgets(processedBudgets);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    
    try {
      const response = await fetch(`/api/v1/projects/${selectedProjectId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseFormData)
      });
      
      if (response.ok) {
        fetchBudgets();
        setShowExpenseForm(false);
        setSelectedProjectId(null);
        setExpenseFormData({
          expense_name: '',
          category: 'labor',
          amount: '',
          expense_date: '',
          description: ''
        });
      }
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'on_track': return 'text-emerald-400 bg-emerald-500/10';
      case 'at_risk': return 'text-amber-400 bg-amber-500/10';
      case 'over_budget': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization < 70) return 'bg-emerald-500';
    if (utilization < 90) return 'bg-blue-500';
    if (utilization < 100) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD',
      minimumFractionDigits: 0
    }).format(value);
  };

  const calculateBurnRate = (budget: ProjectBudget) => {
    // Simplified burn rate calculation (monthly average)
    if (!budget.spent_amount || budget.spent_amount === 0) return 0;
    return budget.spent_amount / 12; // Assuming annual budget
  };

  const filteredBudgets = budgets.filter(budget =>
    budget.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBudget = budgets.reduce((sum, b) => sum + b.total_budget, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent_amount, 0);
  const totalRemaining = budgets.reduce((sum, b) => sum + b.remaining_budget, 0);
  const overBudgetCount = budgets.filter(b => b.budget_utilization > 100).length;
  const avgUtilization = budgets.length > 0 
    ? budgets.reduce((sum, b) => sum + b.budget_utilization, 0) / budgets.length 
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/projects">المشاريع</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">ميزانية المشاريع</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <DollarSign className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">ميزانية المشاريع</h1>
              <p className="text-slate-400 mt-1">مراقبة مالية المشاريع والمصروفات</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الميزانيات</span>
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalBudget)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي المنصرف</span>
              <TrendingDown className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalSpent)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">المتبقي</span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalRemaining)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">تجاوزت الميزانية</span>
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{overBudgetCount}</div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالمشروع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredBudgets.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد ميزانيات مسجلة'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المشروع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الميزانية الكلية</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المنصرف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المتبقي</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">نسبة الاستخدام</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">معدل الحرق</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredBudgets.map((budget) => {
                    const burnRate = calculateBurnRate(budget);
                    const variance = budget.remaining_budget;
                    
                    return (
                      <tr key={budget.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-200 font-medium">
                            {budget.project_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300 font-medium">
                          {formatCurrency(budget.total_budget)}
                        </td>
                        <td className="px-6 py-4 text-sm text-rose-400">
                          {formatCurrency(budget.spent_amount)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-medium ${
                            variance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {formatCurrency(Math.abs(variance))}
                            {variance < 0 && ' -'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className={`font-medium ${
                                budget.budget_utilization > 100 ? 'text-rose-400' :
                                budget.budget_utilization > 90 ? 'text-amber-400' : 'text-emerald-400'
                              }`}>
                                {budget.budget_utilization.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${getUtilizationColor(budget.budget_utilization)}`}
                                style={{ width: `${Math.min(budget.budget_utilization, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {formatCurrency(burnRate)}/شهر
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                            {budget.status === 'on_track' ? 'على المسار' :
                             budget.status === 'at_risk' ? 'معرض للخطر' : 'تجاوز الميزانية'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => {
                              setSelectedProjectId(budget.project_id || budget.id);
                              setShowExpenseForm(true);
                            }}
                            className="px-3 py-1 bg-violet-600/20 text-violet-400 rounded-lg text-xs hover:bg-violet-600/30 transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            مصروف
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-300 font-medium mb-4">توزيع التكاليف</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">العمالة</span>
                <span className="text-slate-200 font-medium">40%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">المواد</span>
                <span className="text-slate-200 font-medium">35%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">المعدات</span>
                <span className="text-slate-200 font-medium">15%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">النفقات العامة</span>
                <span className="text-slate-200 font-medium">10%</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-300 font-medium mb-4">متوسط الاستخدام</h3>
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-slate-800"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - avgUtilization / 100)}`}
                    className={`${
                      avgUtilization > 90 ? 'text-amber-500' : 'text-violet-500'
                    } transition-all duration-1000`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-100">
                    {avgUtilization.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <h3 className="text-slate-300 font-medium mb-4">ملخص الميزانية</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">إجمالي المشاريع</span>
                <span className="text-slate-200 font-medium">{budgets.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">على المسار</span>
                <span className="text-emerald-400 font-medium">
                  {budgets.filter(b => b.status === 'on_track').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">معرض للخطر</span>
                <span className="text-amber-400 font-medium">
                  {budgets.filter(b => b.status === 'at_risk').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">تجاوز الميزانية</span>
                <span className="text-rose-400 font-medium">{overBudgetCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showExpenseForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-slate-100">إضافة مصروف</h2>
            </div>
            
            <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">اسم المصروف *</label>
                <input
                  type="text"
                  required
                  value={expenseFormData.expense_name}
                  onChange={(e) => setExpenseFormData({...expenseFormData, expense_name: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الفئة *</label>
                  <select
                    required
                    value={expenseFormData.category}
                    onChange={(e) => setExpenseFormData({...expenseFormData, category: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="labor">عمالة</option>
                    <option value="materials">مواد</option>
                    <option value="equipment">معدات</option>
                    <option value="overhead">نفقات عامة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">المبلغ (ريال) *</label>
                  <input
                    type="number"
                    required
                    value={expenseFormData.amount}
                    onChange={(e) => setExpenseFormData({...expenseFormData, amount: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">تاريخ المصروف</label>
                <input
                  type="date"
                  value={expenseFormData.expense_date}
                  onChange={(e) => setExpenseFormData({...expenseFormData, expense_date: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">الوصف</label>
                <textarea
                  value={expenseFormData.description}
                  onChange={(e) => setExpenseFormData({...expenseFormData, description: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
                >
                  إضافة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseForm(false);
                    setSelectedProjectId(null);
                  }}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
