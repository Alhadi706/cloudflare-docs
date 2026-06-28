// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// نموذج تسجيل أصل - Asset Registration Form
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import React, { useState } from 'react';
import { X, Save, Package, MapPin, Upload } from 'lucide-react';
import { validatePrincipalAssetCreatePayload } from '@/lib/gis/assetGovernanceRules';

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  const headers: Record<string, string> = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
  return headers;
}

interface AssetFormData {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  status: string;
  health_score?: number;
  installation_date?: string;
  department_owner?: string;
  location_description?: string;
  latitude?: number;
  longitude?: number;
  properties?: any;
}

interface AssetFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editData?: any;
}

export default function AssetForm({ onClose, onSuccess, editData }: AssetFormProps) {
  const [formData, setFormData] = useState<AssetFormData>({
    asset_id: editData?.asset_id || '',
    asset_name: editData?.asset_name || '',
    asset_type: editData?.asset_type || 'infrastructure',
    status: editData?.status || 'operational',
    health_score: editData?.health_score || 100,
    installation_date: editData?.installation_date || '',
    department_owner: editData?.department_owner || '',
    location_description: editData?.location_description || '',
    latitude: editData?.latitude || undefined,
    longitude: editData?.longitude || undefined,
    properties: editData?.properties || {}
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Prepare geometry if coordinates provided
      let geometry = null;
      if (formData.latitude && formData.longitude) {
        geometry = {
          type: 'Point',
          coordinates: [formData.longitude, formData.latitude]
        };
      }

      const payload = {
        ...formData,
        geometry,
        properties: {
          ...formData.properties,
          location_description: formData.location_description
        }
      };

      const check = validatePrincipalAssetCreatePayload(payload);
      if (!check.ok) {
        setError(check.error || 'فشل تحقق حوكمة الأصل');
        setLoading(false);
        return;
      }

      const url = editData 
        ? `/api/v1/workspace/assets/${editData.id}`
        : '/api/v1/workspace/assets';
      
      const method = editData ? 'PUT' : 'POST';

      console.log(`[AssetForm] ${method} ${url}`, payload);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getTenantHeaders(),
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[AssetForm] Success:', result);
        onSuccess();
        onClose();
      } else {
        const data = await response.json().catch(() => ({ detail: 'خطأ غير معروف' }));
        console.error('[AssetForm] Error:', response.status, data);
        setError(
          data.detail || 
          data.message || 
          `خطأ ${response.status}: حدث خطأ أثناء حفظ الأصل`
        );
      }
    } catch (err) {
      console.error('[AssetForm] Network error:', err);
      setError(`فشل الاتصال بالخادم: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['health_score', 'latitude', 'longitude'].includes(name) 
        ? (value ? Number(value) : undefined) 
        : value
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // TODO: Implement actual file upload to server
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'maintenance': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'decommissioned': return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600/20 p-3 rounded-xl border border-purple-500/50">
              <Package className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {editData ? 'تعديل أصل' : 'تسجيل أصل جديد'}
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
              معلومات الأصل
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  معرّف الأصل *
                </label>
                <input
                  type="text"
                  name="asset_id"
                  value={formData.asset_id}
                  onChange={handleChange}
                  required
                  disabled={!!editData}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  placeholder="ASSET-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  اسم الأصل *
                </label>
                <input
                  type="text"
                  name="asset_name"
                  value={formData.asset_name}
                  onChange={handleChange}
                  required
                  dir="rtl"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="اسم الأصل"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  نوع الأصل *
                </label>
                <select
                  name="asset_type"
                  value={formData.asset_type}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="infrastructure">بنية تحتية</option>
                  <option value="building">مبنى</option>
                  <option value="equipment">معدات</option>
                  <option value="vehicle">مركبة</option>
                  <option value="network">شبكة</option>
                  <option value="water">مياه</option>
                  <option value="power">كهرباء</option>
                  <option value="road">طريق</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الحالة *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className={`w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 focus:ring-purple-500 ${getStatusColor(formData.status)}`}
                >
                  <option value="operational">تشغيلي</option>
                  <option value="maintenance">صيانة</option>
                  <option value="critical">حرج</option>
                  <option value="decommissioned">خارج الخدمة</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الحالة الصحية (%)
                </label>
                <input
                  type="number"
                  name="health_score"
                  value={formData.health_score}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  تاريخ التركيب
                </label>
                <input
                  type="date"
                  name="installation_date"
                  value={formData.installation_date}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الجهة المالكة
                </label>
                <input
                  type="text"
                  name="department_owner"
                  value={formData.department_owner}
                  onChange={handleChange}
                  dir="rtl"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="اسم الجهة أو القسم"
                />
              </div>
            </div>
          </div>

          {/* GIS Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" />
              الموقع الجغرافي (GIS)
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="مثال: شارع الملك فهد، حي النزهة"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  خط العرض (Latitude)
                </label>
                <input
                  type="number"
                  name="latitude"
                  value={formData.latitude || ''}
                  onChange={handleChange}
                  step="0.000001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="24.7136"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  خط الطول (Longitude)
                </label>
                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude || ''}
                  onChange={handleChange}
                  step="0.000001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="46.6753"
                />
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-slate-300">
              <p className="font-medium text-blue-400 mb-1">💡 نصيحة:</p>
              <p>يمكنك استخدام نظام GIS لتحديد الموقع على الخريطة بدقة</p>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">
              المرفقات
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                رفع ملف (دليل، صور، KMZ)
              </label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.kmz,.kml,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  id="asset-file-upload"
                />
                <label
                  htmlFor="asset-file-upload"
                  className="flex items-center justify-center gap-2 w-full bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg px-4 py-6 text-slate-400 hover:border-purple-500 hover:text-purple-400 transition-colors cursor-pointer"
                >
                  <Upload className="w-5 h-5" />
                  <span>{uploadedFile ? uploadedFile.name : 'اختر ملف أو اسحبه هنا'}</span>
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                الصيغ المدعومة: PDF, KMZ, KML, DOCX, Images
              </p>
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
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
