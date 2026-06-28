'use client';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

import React, { useState, useEffect } from 'react';
import { Settings, Plus, Search, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface PayrollRule {
  id: number;
  rule_type: 'allowance' | 'deduction';
  name: string;
  name_ar?: string;
  amount_type: 'fixed' | 'percentage';
  amount: number;
  is_taxable?: boolean;
  is_active?: boolean;
}

export default function PayrollConfigPage() {
  const [allowances, setAllowances] = useState<PayrollRule[]>([]);
  const [deductions, setDeductions] = useState<PayrollRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'allowances' | 'deductions'>('allowances');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    rule_type: 'allowance' as 'allowance' | 'deduction',
    name: '',
    name_ar: '',
    amount_type: 'fixed' as 'fixed' | 'percentage',
    amount: '',
    is_taxable: false
  });

  useEffect(() => {
    fetchRules();
  }, []);


  const fetchRules = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/payroll-config', {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (response.ok) {
        const data = await response.json();
        const rules: PayrollRule[] = data.rules || [];
        setAllowances(rules.filter((r: PayrollRule) => r.rule_type === 'allowance').map((r: any) => ({
          ...r, amount_type: r.amount_type as 'fixed' | 'percentage'
        })));
        setDeductions(rules.filter((r: PayrollRule) => r.rule_type === 'deduction').map((r: any) => ({
          ...r, amount_type: r.amount_type as 'fixed' | 'percentage'
        })));
      }
    } catch (error) {
      console.error('Error fetching payroll rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Config is derived from grades — just refresh
    fetchRules();
    setShowForm(false);
    setFormData({
      rule_type: 'allowance',
      name: '',
      name_ar: '',
      amount_type: 'fixed',
      amount: '',
      is_taxable: false
    });
  };

  const currentData = activeTab === 'allowances' ? allowances : deductions;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr">الموارد البشرية</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">إعدادات الرواتب</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-cyan-600/20 p-4 rounded-xl border border-cyan-500/50">
              <Settings className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">إعدادات الرواتب</h1>
              <p className="text-slate-400 mt-1">إدارة البدلات والاستقطاعات</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setFormData({...formData, rule_type: activeTab === 'allowances' ? 'allowance' : 'deduction'});
              setShowForm(true);
            }}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>إضافة {activeTab === 'allowances' ? 'بدل' : 'استقطاع'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">البدلات</span>
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{allowances.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">الاستقطاعات</span>
              <Settings className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{deductions.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قواعد نشطة</span>
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {[...allowances, ...deductions].filter(r => r.is_active).length}
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">خاضعة للضريبة</span>
              <Settings className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {[...allowances, ...deductions].filter(r => r.is_taxable).length}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('allowances')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'allowances'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            البدلات
          </button>
          <button
            onClick={() => setActiveTab('deductions')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'deductions'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            الاستقطاعات
          </button>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : currentData.length === 0 ? (
              <div className="p-12 text-center">
                <Settings className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  لا توجد {activeTab === 'allowances' ? 'بدلات' : 'استقطاعات'} بعد
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الاسم</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">النوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">القيمة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">خاضع للضريبة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {currentData.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-200">
                        {rule.name_ar || rule.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                          {rule.amount_type === 'fixed' ? 'ثابت' : 'نسبة مئوية'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-medium">
                        {rule.amount_type === 'percentage' ? `${rule.amount}%` : `${rule.amount} ريال`}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {rule.is_taxable ? 'نعم' : 'لا'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          rule.is_active 
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-slate-400 bg-slate-500/10'
                        }`}>
                          {rule.is_active ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="px-3 py-1 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs hover:bg-cyan-600/30 transition-colors">
                          تعديل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-xl w-full">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-slate-100">
                {formData.rule_type === 'allowance' ? 'بدل جديد' : 'استقطاع جديد'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الاسم (EN) *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الاسم (AR)</label>
                  <input
                    type="text"
                    value={formData.name_ar}
                    onChange={(e) => setFormData({...formData, name_ar: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">النوع *</label>
                  <select
                    value={formData.amount_type}
                    onChange={(e) => setFormData({...formData, amount_type: e.target.value as 'fixed' | 'percentage'})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="fixed">ثابت</option>
                    <option value="percentage">نسبة مئوية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">القيمة *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="taxable"
                  checked={formData.is_taxable}
                  onChange={(e) => setFormData({...formData, is_taxable: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="taxable" className="text-sm text-slate-300">خاضع للضريبة</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-colors"
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
