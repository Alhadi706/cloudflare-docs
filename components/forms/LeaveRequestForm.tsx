// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// نموذج طلب إجازة - Leave Request Form
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useState } from 'react';
import { X, Save, Calendar } from 'lucide-react';

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  const headers: Record<string, string> = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
  return headers;
}

interface LeaveRequestFormData {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
  covering_employee_id?: number;
}

interface LeaveRequestFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function LeaveRequestForm({ onClose, onSuccess }: LeaveRequestFormProps) {
  const [formData, setFormData] = useState<LeaveRequestFormData>({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
    covering_employee_id: undefined
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate dates
    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      setError('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/hr/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTenantHeaders(),
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        setError(data.detail || 'حدث خطأ أثناء إرسال طلب الإجازة');
      }
    } catch (err) {
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'covering_employee_id' ? (value ? Number(value) : undefined) : value
    }));
  };

  // Calculate days
  const calculateDays = () => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600/20 p-3 rounded-xl border border-emerald-500/50">
              <Calendar className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              طلب إجازة جديد
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

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              نوع الإجازة *
            </label>
            <select
              name="leave_type"
              value={formData.leave_type}
              onChange={handleChange}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="annual">إجازة سنوية</option>
              <option value="sick">إجازة مرضية</option>
              <option value="emergency">إجازة طارئة</option>
              <option value="unpaid">إجازة بدون راتب</option>
              <option value="maternity">إجازة أمومة</option>
              <option value="paternity">إجازة أبوة</option>
              <option value="study">إجازة دراسية</option>
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                تاريخ البداية *
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                تاريخ النهاية *
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                required
                min={formData.start_date || new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Duration Display */}
          {formData.start_date && formData.end_date && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">مدة الإجازة:</span>
                <span className="text-2xl font-bold text-emerald-400">
                  {calculateDays()} يوم
                </span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              السبب (اختياري)
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows={4}
              dir="rtl"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="اكتب سبب الإجازة..."
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-slate-300">
            <p className="font-medium text-blue-400 mb-2">ملاحظة:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>سيتم إرسال طلبك إلى قسم الموارد البشرية للمراجعة</li>
              <li>سيتم إشعارك بحالة الطلب عبر البريد الإلكتروني</li>
              <li>تأكد من توفر رصيد إجازات كافٍ</li>
            </ul>
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
              className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  إرسال الطلب
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
