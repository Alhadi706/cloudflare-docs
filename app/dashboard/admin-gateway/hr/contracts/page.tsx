'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, ChevronLeft, AlertTriangle } from 'lucide-react';
import ImportButton from '@/components/ImportButton';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const BASE = '/api/v1/hr-structure';
interface Contract {
  id: number;
  employee_id: number;
  employee_name?: string;
  employee_name_ar?: string;
  contract_number?: string;
  contract_type: string;
  start_date: string;
  end_date?: string;
  base_salary: number;
  currency: string;
  is_active: boolean;
  signed_date?: string;
  notes?: string;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    contract_type: 'permanent',
    start_date: '',
    end_date: '',
    salary: '',
    terms: ''
  });

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const response = await fetch(`${BASE}/contracts`, { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        employee_id: Number(formData.employee_id),
        contract_type: formData.contract_type,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        base_salary: Number(formData.salary) || 0,
        notes: formData.terms,
      };
      const response = await fetch(`${BASE}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        fetchContracts();
        setShowForm(false);
        setFormData({
          employee_id: '',
          contract_type: 'permanent',
          start_date: '',
          end_date: '',
          salary: '',
          terms: ''
        });
      }
    } catch (error) {
      console.error('Error creating contract:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'text-emerald-400 bg-emerald-500/10';
      case 'expired': return 'text-rose-400 bg-rose-500/10';
      case 'pending': return 'text-amber-400 bg-amber-500/10';
      case 'terminated': return 'text-slate-400 bg-slate-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'permanent': return 'text-blue-400 bg-blue-500/10';
      case 'temporary': return 'text-amber-400 bg-amber-500/10';
      case 'contract': return 'text-violet-400 bg-violet-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const activeCount = contracts.filter(c => c.is_active).length;
  const expiringCount = contracts.filter(c => {
    if (!c.end_date) return false;
    const daysLeft = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 30;
  }).length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr">الموارد البشرية</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">العقود</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600/20 p-4 rounded-xl border border-indigo-500/50">
              <FileText className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">عقود الموظفين</h1>
              <p className="text-slate-400 mt-1">إدارة العقود والاتفاقيات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="contracts" onSuccess={fetchContracts} />
            <button 
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>عقد جديد</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي العقود</span>
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{contracts.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">عقود نشطة</span>
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{activeCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قرب الانتهاء</span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{expiringCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">منتهية</span>
              <FileText className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {contracts.filter(c => c.status === 'expired').length}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : contracts.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد عقود بعد</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموظف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">نوع العقد</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ البدء</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الانتهاء</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الراتب</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {contracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-200">
                        {contract.employee?.full_name_ar || contract.employee?.full_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(contract.contract_type)}`}>
                          {contract.contract_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(contract.start_date).toLocaleDateString('ar-LY')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar-LY') : 'غير محدد'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-medium">
                        {contract.salary.toLocaleString('ar-LY')} دينار
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                          {contract.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="px-3 py-1 bg-indigo-600/20 text-indigo-400 rounded-lg text-xs hover:bg-indigo-600/30 transition-colors">
                          عرض
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
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-slate-100">عقد جديد</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">رقم الموظف *</label>
                <input
                  type="number"
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">نوع العقد *</label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => setFormData({...formData, contract_type: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="permanent">دائم</option>
                    <option value="temporary">مؤقت</option>
                    <option value="contract">تعاقد</option>
                    <option value="part_time">دوام جزئي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الراتب *</label>
                  <input
                    type="number"
                    required
                    value={formData.salary}
                    onChange={(e) => setFormData({...formData, salary: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">تاريخ البدء *</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">الشروط والأحكام</label>
                <textarea
                  value={formData.terms}
                  onChange={(e) => setFormData({...formData, terms: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  rows={4}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
                >
                  إنشاء العقد
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
