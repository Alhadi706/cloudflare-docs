// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// نموذج المراسلات - Correspondence Form
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Mail, Upload, Building2 } from 'lucide-react';

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  const headers: Record<string, string> = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
  return headers;
}

interface CorrespondenceFormData {
  subject: string;
  subject_ar: string;
  sender?: string;
  recipient?: string;
  department_id?: number;
  priority: string;
  category?: string;
  notes?: string;
}

interface Department {
  id: number;
  department_name: string;
  department_name_ar: string;
}

interface CorrespondenceFormProps {
  onClose: () => void;
  onSuccess: () => void;
  type: 'incoming' | 'outgoing' | 'internal';
  editData?: any;
}

export default function CorrespondenceForm({ onClose, onSuccess, type, editData }: CorrespondenceFormProps) {
  const [formData, setFormData] = useState<CorrespondenceFormData>({
    subject: editData?.subject || '',
    subject_ar: editData?.subject_ar || '',
    sender: editData?.sender || '',
    recipient: editData?.recipient || '',
    department_id: editData?.department_id || undefined,
    priority: editData?.priority || 'normal',
    category: editData?.category || '',
    notes: editData?.notes || ''
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/v1/correspondence/departments', {
        headers: getTenantHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Map form type to API endpoint
      const endpointMap = {
        incoming: '/api/v1/correspondence/incoming-letters',
        outgoing: '/api/v1/correspondence/outgoing-letters',
        internal: '/api/v1/correspondence/internal-memos'
      };

      const url = editData 
        ? `${endpointMap[type]}/${editData.id}`
        : endpointMap[type];
      
      const method = editData ? 'PUT' : 'POST';

      console.log(`[CorrespondenceForm] ${method} ${url}`, formData);

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
        console.log('[CorrespondenceForm] Success:', result);
        // TODO: Upload file if any
        if (uploadedFile) {
          // Handle file upload to server
          console.log('File upload pending:', uploadedFile.name);
        }
        onSuccess();
        onClose();
      } else {
        const data = await response.json().catch(() => ({ detail: 'خطأ غير معروف' }));
        console.error('[CorrespondenceForm] Error:', response.status, data);
        setError(
          data.detail || 
          data.message || 
          `خطأ ${response.status}: حدث خطأ أثناء حفظ المراسلة`
        );
      }
    } catch (err) {
      console.error('[CorrespondenceForm] Network error:', err);
      setError(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'department_id' ? (value ? Number(value) : undefined) : value
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'normal': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'low': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'incoming': return 'كتاب وارد';
      case 'outgoing': return 'كتاب صادر';
      case 'internal': return 'مذكرة داخلية';
      default: return 'مراسلة';
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'incoming': return 'bg-green-600/20 border-green-500/50 text-green-400';
      case 'outgoing': return 'bg-blue-600/20 border-blue-500/50 text-blue-400';
      case 'internal': return 'bg-purple-600/20 border-purple-500/50 text-purple-400';
      default: return 'bg-slate-600/20 border-slate-500/50 text-slate-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${getTypeColor()}`}>
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {editData ? 'تعديل مراسلة' : getTypeLabel()}
              </h2>
              <p className="text-sm text-slate-400">
                {type === 'incoming' && 'كتاب وارد من جهة خارجية'}
                {type === 'outgoing' && 'كتاب صادر إلى جهة خارجية'}
                {type === 'internal' && 'مذكرة داخلية بين الأقسام'}
              </p>
            </div>
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

          {/* Subject */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              الموضوع
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الموضوع (إنجليزي) *
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Letter Subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الموضوع (عربي) *
                </label>
                <input
                  type="text"
                  name="subject_ar"
                  value={formData.subject_ar}
                  onChange={handleChange}
                  required
                  dir="rtl"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="موضوع الكتاب"
                />
              </div>
            </div>
          </div>

          {/* Sender/Recipient */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              الأطراف
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {(type === 'incoming' || type === 'internal') && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    المرسل {type === 'incoming' && '*'}
                  </label>
                  <input
                    type="text"
                    name="sender"
                    value={formData.sender}
                    onChange={handleChange}
                    required={type === 'incoming'}
                    dir="rtl"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder={type === 'incoming' ? 'الجهة المرسلة' : 'القسم المرسل'}
                  />
                </div>
              )}

              {(type === 'outgoing' || type === 'internal') && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    المستلم {type === 'outgoing' && '*'}
                  </label>
                  <input
                    type="text"
                    name="recipient"
                    value={formData.recipient}
                    onChange={handleChange}
                    required={type === 'outgoing'}
                    dir="rtl"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder={type === 'outgoing' ? 'الجهة المستلمة' : 'القسم المستلم'}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  القسم المسؤول *
                </label>
                <select
                  name="department_id"
                  value={formData.department_id || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- اختر قسماً --</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.department_name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الأولوية *
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  required
                  className={`w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 focus:ring-cyan-500 ${getPriorityColor(formData.priority)}`}
                >
                  <option value="low">عادية</option>
                  <option value="normal">متوسطة</option>
                  <option value="high">عالية</option>
                  <option value="urgent">عاجلة</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                التصنيف
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                dir="rtl"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="مثال: إداري، مالي، فني، قانوني"
              />
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              ملاحظات
            </h3>
            
            <div>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                dir="rtl"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              المرفق
            </h3>
            
            <div>
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                id="correspondence-file"
              />
              <label
                htmlFor="correspondence-file"
                className="flex items-center justify-center gap-2 w-full bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg px-4 py-6 text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors cursor-pointer"
              >
                <Upload className="w-5 h-5" />
                <span>{uploadedFile ? uploadedFile.name : 'رفع صورة مسح ضوئية أو ملف PDF'}</span>
              </label>
            </div>

            {uploadedFile && (
              <div className="bg-slate-800 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{uploadedFile.name}</p>
                    <p className="text-xs text-slate-400">
                      {(uploadedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  className="text-rose-400 hover:text-rose-300 text-sm font-medium"
                >
                  إزالة
                </button>
              </div>
            )}
          </div>

          {/* Informational Note */}
          <div className={`border rounded-lg p-4 text-sm ${getTypeColor()}`}>
            <p className="font-medium mb-1">
              {type === 'incoming' && '📥 سيتم توليد رقم مرجعي تلقائياً للكتاب الوارد'}
              {type === 'outgoing' && '📤 سيتم توليد رقم مرجعي تلقائياً للكتاب الصادر'}
              {type === 'internal' && '📨 سيتم توليد رقم مرجعي تلقائياً للمذكرة الداخلية'}
            </p>
            <p className="text-xs opacity-80">
              يمكنك تتبع حالة المراسلة وإضافة ردود وتعليقات لاحقاً
            </p>
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
              className="flex-1 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {editData ? 'تحديث' : 'تسجيل'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
