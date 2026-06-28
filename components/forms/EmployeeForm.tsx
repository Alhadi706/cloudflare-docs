// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// نموذج إضافة موظف - Employee Form
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, User } from 'lucide-react';

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  const headers: Record<string, string> = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
  return headers;
}

interface EmployeeFormData {
  employee_number: string;
  user_id: string;
  first_name: string;
  last_name: string;
  first_name_ar: string;
  last_name_ar: string;
  email: string;
  phone?: string;
  national_id?: string;
  date_of_birth?: string;
  gender?: string;
  hire_date: string;
  position_id?: number;
  grade_id?: number;
  manager_id?: number;
  address?: string;
}

interface EmployeeFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editData?: any;
}

interface Position {
  id: number;
  position_name: string;
  position_name_ar?: string;
}

interface Grade {
  id: number;
  grade_name: string;
  grade_name_ar?: string;
}

export default function EmployeeForm({ onClose, onSuccess, editData }: EmployeeFormProps) {
  const [formData, setFormData] = useState<EmployeeFormData>({
    employee_number: editData?.employee_number || '',
    user_id: editData?.user_id || '',
    first_name: editData?.first_name || '',
    last_name: editData?.last_name || '',
    first_name_ar: editData?.first_name_ar || '',
    last_name_ar: editData?.last_name_ar || '',
    email: editData?.email || '',
    phone: editData?.phone || '',
    national_id: editData?.national_id || '',
    date_of_birth: editData?.date_of_birth || '',
    gender: editData?.gender || 'male',
    hire_date: editData?.hire_date || new Date().toISOString().split('T')[0],
    position_id: editData?.position_id || undefined,
    grade_id: editData?.grade_id || undefined,
    manager_id: editData?.manager_id || undefined,
    address: editData?.address || ''
  });

  const [positions, setPositions] = useState<Position[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPositions();
    fetchGrades();
  }, []);

  const fetchPositions = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/positions', {
        headers: getTenantHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const fetchGrades = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/grades', {
        headers: getTenantHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setGrades(data.grades || []);
      }
    } catch (error) {
      console.error('Error fetching grades:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editData 
        ? `/api/v1/workspace/employees/${editData.id}`
        : '/api/v1/workspace/employees';
      
      const method = editData ? 'PUT' : 'POST';

      console.log(`[EmployeeForm] ${method} ${url}`, formData);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getTenantHeaders(),
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[EmployeeForm] Success:', result);
        onSuccess();
        onClose();
      } else {
        const data = await response.json().catch(() => ({ detail: 'خطأ غير معروف' }));
        console.error('[EmployeeForm] Error:', response.status, data);
        setError(
          data.detail || 
          data.message || 
          `خطأ ${response.status}: حدث خطأ أثناء حفظ بيانات الموظف`
        );
      }
    } catch (err) {
      console.error('[EmployeeForm] Network error:', err);
      setError(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['position_id', 'grade_id', 'manager_id'].includes(name) 
        ? (value ? Number(value) : undefined) 
        : value
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-3 rounded-xl border border-blue-500/50">
              <User className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {editData ? 'تعديل بيانات موظف' : 'إضافة موظف جديد'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Error Message */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/50 rounded-lg p-4 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              المعلومات الأساسية
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  رقم الموظف *
                </label>
                <input
                  type="text"
                  name="employee_number"
                  value={formData.employee_number}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="EMP-0001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  معرف المستخدم *
                </label>
                <input
                  type="text"
                  name="user_id"
                  value={formData.user_id}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user_123"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الاسم الأول (إنجليزي) *
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="First Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  اسم العائلة (إنجليزي) *
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Last Name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الاسم الأول (عربي) *
                </label>
                <input
                  type="text"
                  name="first_name_ar"
                  value={formData.first_name_ar}
                  onChange={handleChange}
                  required
                  dir="rtl"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="الاسم الأول"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  اسم العائلة (عربي) *
                </label>
                <input
                  type="text"
                  name="last_name_ar"
                  value={formData.last_name_ar}
                  onChange={handleChange}
                  required
                  dir="rtl"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="اسم العائلة"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              معلومات الاتصال
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  البريد الإلكتروني *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="employee@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  رقم الجوال
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+966 5X XXX XXXX"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                العنوان
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                dir="rtl"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="العنوان الكامل..."
              />
            </div>
          </div>

          {/* Personal Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              المعلومات الشخصية
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  رقم الهوية الوطنية
                </label>
                <input
                  type="text"
                  name="national_id"
                  value={formData.national_id}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1XXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  تاريخ الميلاد
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الجنس
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            </div>
          </div>

          {/* Job Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              المعلومات الوظيفية
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  تاريخ التعيين *
                </label>
                <input
                  type="date"
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  المنصب
                </label>
                <select
                  name="position_id"
                  value={formData.position_id || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- اختر المنصب --</option>
                  {positions.map(pos => (
                    <option key={pos.id} value={pos.id}>
                      {pos.position_name_ar || pos.position_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                الدرجة الوظيفية
              </label>
              <select
                name="grade_id"
                value={formData.grade_id || ''}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- اختر الدرجة --</option>
                {grades.map(grade => (
                  <option key={grade.id} value={grade.id}>
                    {grade.grade_name_ar || grade.grade_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {editData ? 'تحديث' : 'حفظ'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
