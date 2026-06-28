// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// نموذج إنشاء مشروع - Project Form
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useState } from 'react';
import { X, Save, Briefcase, Upload, MapPin } from 'lucide-react';

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  const headers: Record<string, string> = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
  return headers;
}

interface ProjectFormData {
  project_id: string;
  project_name: string;
  project_name_ar: string;
  description?: string;
  status: string;
  budget?: number;
  start_date?: string;
  end_date?: string;
  completion_percentage?: number;
  project_manager?: string;
  location_description?: string;
}

interface ProjectFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editData?: any;
}

export default function ProjectForm({ onClose, onSuccess, editData }: ProjectFormProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    project_id: editData?.project_id || '',
    project_name: editData?.project_name || '',
    project_name_ar: editData?.project_name_ar || '',
    description: editData?.description || '',
    status: editData?.status || 'planning',
    budget: editData?.budget || undefined,
    start_date: editData?.start_date || '',
    end_date: editData?.end_date || '',
    completion_percentage: editData?.completion_percentage || 0,
    project_manager: editData?.project_manager || '',
    location_description: editData?.location_description || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editData 
        ? `/api/v1/workspace/projects/${editData.id}`
        : '/api/v1/workspace/projects';
      
      const method = editData ? 'PUT' : 'POST';

      console.log(`[ProjectForm] ${method} ${url}`, formData);

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
        console.log('[ProjectForm] Success:', result);
        // TODO: Upload files if any
        onSuccess();
        onClose();
      } else {
        const data = await response.json().catch(() => ({ detail: 'خطأ غير معروف' }));
        console.error('[ProjectForm] Error:', response.status, data);
        setError(
          data.detail || 
          data.message || 
          `خطأ ${response.status}: حدث خطأ أثناء حفظ المشروع`
        );
      }
    } catch (err) {
      console.error('[ProjectForm] Network error:', err);
      setError(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['budget', 'completion_percentage'].includes(name) 
        ? (value ? Number(value) : undefined) 
        : value
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'in_progress': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'on_hold': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-600/20 p-3 rounded-xl border border-cyan-500/50">
              <Briefcase className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {editData ? 'تعديل مشروع' : 'إنشاء مشروع جديد'}
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
              معلومات المشروع
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                معرّف المشروع *
              </label>
              <input
                type="text"
                name="project_id"
                value={formData.project_id}
                onChange={handleChange}
                required
                disabled={!!editData}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                placeholder="PRJ-2026-001"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  اسم المشروع (إنجليزي) *
                </label>
                <input
                  type="text"
                  name="project_name"
                  value={formData.project_name}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Project Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  اسم المشروع (عربي) *
                </label>
                <input
                  type="text"
                  name="project_name_ar"
                  value={formData.project_name_ar}
                  onChange={handleChange}
                  required
                  dir="rtl"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="اسم المشروع"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                الوصف
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                dir="rtl"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                placeholder="وصف تفصيلي للمشروع..."
              />
            </div>
          </div>

          {/* Project Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              تفاصيل التنفيذ
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الحالة *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className={`w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 focus:ring-cyan-500 ${getStatusColor(formData.status)}`}
                >
                  <option value="planning">تخطيط</option>
                  <option value="in_progress">قيد التنفيذ</option>
                  <option value="on_hold">معلق</option>
                  <option value="completed">مكتمل</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الميزانية (ريال)
                </label>
                <input
                  type="number"
                  name="budget"
                  value={formData.budget || ''}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  نسبة الإنجاز (%)
                </label>
                <input
                  type="number"
                  name="completion_percentage"
                  value={formData.completion_percentage}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  تاريخ البداية
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  تاريخ النهاية المتوقع
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  min={formData.start_date}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                مدير المشروع
              </label>
              <input
                type="text"
                name="project_manager"
                value={formData.project_manager}
                onChange={handleChange}
                dir="rtl"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="اسم مدير المشروع"
              />
            </div>
          </div>

          {/* GIS Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              الموقع الجغرافي
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                وصف الموقع
              </label>
              <input
                type="text"
                name="location_description"
                value={formData.location_description}
                onChange={handleChange}
                dir="rtl"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="مثال: حي الورود، شمال المدينة"
              />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-slate-300">
              <p className="font-medium text-blue-400 mb-1">💡 ربط مع GIS</p>
              <p>يمكنك رسم حدود المشروع على الخريطة لاحقاً من خلال نظام GIS</p>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              المرفقات
            </h3>
            
            <div>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                className="hidden"
                id="project-files"
              />
              <label
                htmlFor="project-files"
                className="flex items-center justify-center gap-2 w-full bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg px-4 py-6 text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors cursor-pointer"
              >
                <Upload className="w-5 h-5" />
                <span>رفع ملفات المشروع (وثائق، تصاميم، صور)</span>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2">
                    <span className="text-sm text-slate-300">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-rose-400 hover:text-rose-300 text-sm"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                  {editData ? 'تحديث' : 'إنشاء'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
