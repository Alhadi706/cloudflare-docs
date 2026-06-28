'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Plus, TrendingDown, Calendar, Tag, Filter } from 'lucide-react';
import ImportButton from '@/components/ImportButton';
import Link from 'next/link';
import ExpenseForm from '@/components/forms/ExpenseForm';

interface Expense {
  id: number;
  asset_id?: number;
  amount: number;
  expense_date: string;
  description: string;
  status: string;
  category_name?: string;
  budget_name?: string;
}

interface ExpenseCategory {
  id: number;
  category_code: string;
  category_name: string;
  category_name_ar?: string;
  description?: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await fetch('/api/v1/finance/expenses?limit=100');
      if (response.ok) {
        const data = await response.json();
        setExpenses(data.expenses || []);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/v1/finance/expense-categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Calculate summary stats
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const approvedExpenses = expenses.filter(e => e.status === 'approved').length;
  const pendingExpenses = expenses.filter(e => e.status === 'pending').length;
  const thisMonthExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.expense_date);
    const now = new Date();
    return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
  }).reduce((sum, e) => sum + e.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-emerald-400 bg-emerald-500/10';
      case 'pending': return 'text-amber-400 bg-amber-500/10';
      case 'rejected': return 'text-rose-400 bg-rose-500/10';
      case 'posted': return 'text-blue-400 bg-blue-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'معتمد';
      case 'pending': return 'معلق';
      case 'rejected': return 'مرفوض';
      case 'posted': return 'مرحل';
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
          <span className="text-slate-200">النفقات</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-rose-600/20 p-4 rounded-xl border border-rose-500/50">
              <FileText className="w-8 h-8 text-rose-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">إدارة النفقات</h1>
              <p className="text-slate-400 mt-1">تسجيل النفقات والموافقة عليها وربطها بالميزانيات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="expenses" onSuccess={fetchExpenses} />
            <button 
              onClick={() => setShowExpenseForm(true)}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>إضافة نفقة</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي النفقات</span>
              <TrendingDown className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(totalExpenses)}</div>
            <div className="text-xs text-slate-500 mt-1">{expenses.length} نفقة</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">نفقات هذا الشهر</span>
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(thisMonthExpenses)}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">معتمدة</span>
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{approvedExpenses}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">معلقة</span>
              <Tag className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{pendingExpenses}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'expenses'
                ? 'text-rose-400 border-b-2 border-rose-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            النفقات ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'categories'
                ? 'text-rose-400 border-b-2 border-rose-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            الفئات ({categories.length})
          </button>
        </div>

        {/* Content */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          
          {/* Expenses Table */}
          {activeTab === 'expenses' && (
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  جاري التحميل...
                </div>
              ) : expenses.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">لا توجد نفقات مسجلة</p>
                  <p className="text-slate-500 text-sm mt-2">ابدأ بإضافة نفقة جديدة</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">التاريخ</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الوصف</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الأصل المرتبط</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الفئة</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الميزانية</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المبلغ</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {new Date(expense.expense_date).toLocaleDateString('ar-LY')}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-200">{expense.description}</td>
                        <td className="px-6 py-4 text-sm">
                          {expense.asset_id ? (
                            <span className="px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
                              #{expense.asset_id}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs">
                              غير مربوط
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">{expense.category_name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-400">{expense.budget_name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-200 font-medium">{formatCurrency(expense.amount)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                            {getStatusLabel(expense.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-blue-400 hover:text-blue-300 text-sm">
                            عرض
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Categories Table */}
          {activeTab === 'categories' && (
            <div className="overflow-x-auto">
              {categories.length === 0 ? (
                <div className="p-12 text-center">
                  <Tag className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">لا توجد فئات بعد</p>
                  <p className="text-slate-500 text-sm mt-2">ابدأ بإضافة فئات للنفقات</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">رمز الفئة</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم الفئة</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الوصف</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {categories.map((category) => (
                      <tr key={category.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-300 font-mono">{category.category_code}</td>
                        <td className="px-6 py-4 text-sm text-slate-200">{category.category_name_ar || category.category_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-400">{category.description || '-'}</td>
                        <td className="px-6 py-4">
                          <button className="text-blue-400 hover:text-blue-300 text-sm">
                            تعديل
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expense Form */}
      {showExpenseForm && (
        <ExpenseForm
          onClose={() => setShowExpenseForm(false)}
          onSuccess={() => {
            fetchExpenses();
            setShowExpenseForm(false);
          }}
        />
      )}
    </div>
  );
}
