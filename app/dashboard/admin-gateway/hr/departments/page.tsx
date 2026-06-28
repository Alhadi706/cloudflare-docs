'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, Users, ChevronLeft } from 'lucide-react';
import ImportButton from '@/components/ImportButton';
import Link from 'next/link';


const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


interface Department {
  id: number;
  dept_code?: string;
  name: string;
  name_ar?: string;
  description?: string;
  manager_id?: number;
  manager?: { full_name: string; full_name_ar?: string };
  parent_dept_id?: number;
  created_at?: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    dept_code: '',
    name: '',
    name_ar: '',
    description: '',
    manager_id: '',
    parent_dept_id: ''
  });
  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/v1/workspace/departments', {
        headers: { 'X-Tenant-ID': getTenantId() || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : (data.departments || []));
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editDepartment 
        ? `/api/v1/workspace/departments/${editDepartment.id}`
        : '/api/v1/workspace/departments';
      
      const response = await fetch(url, {
        method: editDepartment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        fetchDepartments();
        setShowForm(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving department:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      dept_code: '',
      name: '',
      name_ar: '',
      description: '',
      manager_id: '',
      parent_dept_id: ''
    });
    setEditDepartment(null);
  };

  const handleEdit = (dept: Department) => {
    setEditDepartment(dept);
    setFormData({
      dept_code: dept.dept_code || '',
      name: dept.name || '',
      name_ar: dept.name_ar || '',
      description: dept.description || '',
      manager_id: dept.manager_id?.toString() || '',
      parent_dept_id: dept.parent_dept_id?.toString() || ''
    });
    setShowForm(true);
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.name_ar?.includes(searchTerm) ||
    dept.dept_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200 transition-colors">
            بوابة النظام
          </Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr" className="hover:text-slate-200 transition-colors">
            الموارد البشرية
          </Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">الإدارات</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-violet-600/20 p-4 rounded-xl border border-violet-500/50">
              <Building2 className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">الإدارات والأقسام</h1>
              <p className="text-slate-400 mt-1">الهيكل التنظيمي للمؤسسة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton moduleKey="departments" onSuccess={fetchDepartments} />
            <button 
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>إدارة جديدة</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الإدارات</span>
              <Building2 className="w-5 h-5 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{departments.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إدارات رئيسية</span>
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {departments.filter(d => !d.parent_dept_id).length}
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إدارات فرعية</span>
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {departments.filter(d => d.parent_dept_id).length}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الرمز..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Departments Table */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredDepartments.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد إدارات بعد'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">رمز الإدارة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الاسم</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المدير</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">النوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الوصف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">تاريخ الإنشاء</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredDepartments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                        {dept.dept_code || dept.id}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-200">
                        {dept.name_ar || dept.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {dept.manager?.full_name_ar || dept.manager?.full_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          dept.parent_dept_id 
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-blue-400 bg-blue-500/10'
                        }`}>
                          {dept.parent_dept_id ? 'فرعية' : 'رئيسية'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {dept.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {dept.created_at 
                          ? new Date(dept.created_at).toLocaleDateString('ar-LY')
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleEdit(dept)}
                          className="px-3 py-1 bg-violet-600/20 text-violet-400 rounded-lg text-xs hover:bg-violet-600/30 transition-colors"
                        >
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-slate-100">
                {editDepartment ? 'تعديل إدارة' : 'إدارة جديدة'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">رمز الإدارة</label>
                  <input
                    type="text"
                    value={formData.dept_code}
                    onChange={(e) => setFormData({...formData, dept_code: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder="DEPT-001"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الإدارة الرئيسية</label>
                  <input
                    type="number"
                    value={formData.parent_dept_id}
                    onChange={(e) => setFormData({...formData, parent_dept_id: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder="اختياري"
                  />
                </div>
              </div>

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

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
                >
                  {editDepartment ? 'حفظ التعديلات' : 'إضافة إدارة'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
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
