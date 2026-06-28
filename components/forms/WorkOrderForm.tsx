// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// نموذج أمر عمل صيانة - Work Order Form
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Wrench, Upload } from 'lucide-react';

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  const headers: Record<string, string> = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
  return headers;
}

interface WorkOrderFormData {
  asset_id?: string;
  asset_name?: string;
  title: string;
  title_ar?: string;
  description?: string;
  work_type: string;
  priority: string;
  scheduled_date?: string;
  estimated_hours?: number;
  estimated_cost?: number;
  assigned_team?: string;
  notes?: string;
}

interface WorkOrderFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editData?: any;
  preselectedAssetId?: string;
}

interface Asset {
  id: string;
  asset_name: string;
  asset_type: string;
}

export default function WorkOrderForm({ onClose, onSuccess, editData, preselectedAssetId }: WorkOrderFormProps) {
  const [formData, setFormData] = useState<WorkOrderFormData>({
    asset_id: preselectedAssetId || editData?.asset_id || '',
    asset_name: editData?.asset_name || '',
    title: editData?.title || '',
    title_ar: editData?.title_ar || '',
    description: editData?.description || '',
    work_type: editData?.work_type || 'corrective',
    priority: editData?.priority || 'medium',
    scheduled_date: editData?.scheduled_date || '',
    estimated_hours: editData?.estimated_hours || undefined,
    estimated_cost: editData?.estimated_cost || undefined,
    assigned_team: editData?.assigned_team || '',
    notes: editData?.notes || ''
  });

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/v1/workspace/assets', {
        headers: getTenantHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editData 
        ? `/api/v1/workspace/maintenance/${editData.id}`
        : '/api/v1/workspace/maintenance';
      
      const method = editData ? 'PUT' : 'POST';

      console.log(`[WorkOrderForm] ${method} ${url}`, formData);

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
        console.log('[WorkOrderForm] Success:', result);
        onSuccess();
        onClose();
      } else {
        const data = await response.json().catch(() => ({ detail: 'خطأ غير معروف' }));
        console.error('[WorkOrderForm] Error:', response.status, data);
        setError(
          data.detail || 
          data.message || 
          `خطأ ${response.status}: حدث خطأ أثناء حفظ أمر العمل`
        );
      }
    } catch (err) {
      console.error('[WorkOrderForm] Network error:', err);
      setError(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['estimated_hours', 'estimated_cost'].includes(name) 
        ? (value ? Number(value) : undefined) 
        : value
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600/20 p-3 rounded-xl border border-orange-500/50">
              <Wrench className="w-6 h-6 text-orange-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {editData ? 'تعديل أمر عمل' : 'إنشاء أمر عمل جديد'}
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

          {/* Asset Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              الأصل/المعدة (اختياري)
            </label>
            <select
              name="asset_id"
              value={formData.asset_id}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">-- بدون أصل محدد --</option>
              {assets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.asset_name} ({asset.asset_type})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              💡 يمكنك ربط أمر العمل بأصل من نظام GIS
            </p>
          </div>

          {/* Title */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                العنوان (إنجليزي) *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Work Order Title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                العنوان (عربي)
              </label>
              <input
                type="text"
                name="title_ar"
                value={formData.title_ar}
                onChange={handleChange}
                dir="rtl"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="عنوان أمر العمل"
              />
            </div>
          </div>

          {/* Description */}
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              placeholder="وصف تفصيلي للعمل المطلوب..."
            />
          </div>

          {/* Type & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                نوع العمل *
              </label>
              <select
                name="work_type"
                value={formData.work_type}
                onChange={handleChange}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="preventive">صيانة وقائية</option>
                <option value="corrective">صيانة تصحيحية</option>
                <option value="inspection">فحص</option>
                <option value="emergency">طارئ</option>
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
                className={`w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 focus:ring-orange-500 ${getPriorityColor(formData.priority)}`}
              >
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
                <option value="critical">حرجة</option>
              </select>
            </div>
          </div>

          {/* Schedule & Estimates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                تاريخ الجدولة
              </label>
              <input
                type="date"
                name="scheduled_date"
                value={formData.scheduled_date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                الساعات المقدرة
              </label>
              <input
                type="number"
                name="estimated_hours"
                value={formData.estimated_hours || ''}
                onChange={handleChange}
                min="0"
                step="0.5"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                التكلفة المقدرة (ريال)
              </label>
              <input
                type="number"
                name="estimated_cost"
                value={formData.estimated_cost || ''}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Team */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              الفريق المسؤول
            </label>
            <input
              type="text"
              name="assigned_team"
              value={formData.assigned_team}
              onChange={handleChange}
              dir="rtl"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="اسم الفريق أو القسم..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              ملاحظات
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              dir="rtl"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              placeholder="ملاحظات إضافية..."
            />
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
              className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
