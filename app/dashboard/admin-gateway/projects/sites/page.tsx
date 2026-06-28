'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { MapPin, Plus, Edit2, Trash2, ChevronLeft, Save, X, Loader2, Crosshair } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { workspaceApi } from '@/store/apiService';
import { useErpContextStore } from '@/store/erpContextStore';
import MapLocationPicker from '@/components/MapLocationPicker';
import { useToast } from '@/components/ToastProvider';

// ─── أنواع المواقع ───────────────────────────────────────────
const SITE_TYPES = [
  { value: 'administrative', label: 'إداري',   color: '#3B82F6' },
  { value: 'operational',    label: 'تشغيلي',  color: '#10B981' },
  { value: 'field',          label: 'ميداني',  color: '#F59E0B' },
  { value: 'storage',        label: 'مخزن',    color: '#8B5CF6' },
  { value: 'maintenance',    label: 'صيانة',   color: '#EF4444' },
];

const SITE_STATUSES = [
  { value: 'active',    label: 'نشط' },
  { value: 'inactive',  label: 'غير نشط' },
  { value: 'pending',   label: 'قيد الإعداد' },
];

interface Site {
  id: number;
  project_id: number;
  name: string;
  code: string | null;
  site_type: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  parent_site_id: number | null;
  created_at: string;
}

const emptyForm = {
  name: '',
  code: '',
  site_type: 'field',
  description: '',
  latitude: '',
  longitude: '',
  status: 'active',
  parent_site_id: '',
};

export default function ProjectSitesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-400" /></div>}>
      <ProjectSitesContent />
    </Suspense>
  );
}

function ProjectSitesContent() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  // استخدام السياق من erpContextStore كـfallback إذا لم يُمرَّر query param
  const erpCtx = useErpContextStore();
  const projectId = searchParams.get('project_id') || (erpCtx.activeProjectId ? String(erpCtx.activeProjectId) : '');
  const { getActiveProject } = erpCtx;
  const activeProject = getActiveProject();
  const projectName = searchParams.get('project_name') || activeProject?.project_name || activeProject?.name || 'المشروع';

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editSite, setEditSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [error, setError] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  const fetchSites = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await workspaceApi.getSites(projectId);
      setSites(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchSites error:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  const openCreate = () => {
    setEditSite(null);
    setFormData({ ...emptyForm });
    setError('');
    setShowForm(true);
  };

  const openEdit = (site: Site) => {
    setEditSite(site);
    setFormData({
      name: site.name,
      code: site.code || '',
      site_type: site.site_type,
      description: site.description || '',
      latitude: site.latitude?.toString() || '',
      longitude: site.longitude?.toString() || '',
      status: site.status,
      parent_site_id: site.parent_site_id?.toString() || '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { setError('اسم الموقع مطلوب'); return; }
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        site_type: formData.site_type,
        description: formData.description.trim() || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        status: formData.status,
        parent_site_id: formData.parent_site_id ? parseInt(formData.parent_site_id) : null,
      };

      if (editSite) {
        const res = await workspaceApi.updateSite(editSite.id, payload);
        if (!res.success) throw new Error(res.detail || 'فشل التحديث');
        showToast('تم تحديث الموقع بنجاح', 'success');
      } else {
        const res = await workspaceApi.createSite(projectId, payload);
        if (!res.success) throw new Error(res.detail || 'فشل الإنشاء');
        showToast('تم إنشاء الموقع بنجاح', 'success');
      }
      setShowForm(false);
      await fetchSites();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
      showToast(err.message || 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (site: Site) => {
    if (!confirm(`هل تريد حذف الموقع "${site.name}"؟`)) return;
    try {
      await workspaceApi.deleteSite(site.id);
      showToast(`تم حذف الموقع "${site.name}"`, 'warning');
      await fetchSites();
    } catch (e: any) {
      console.error('deleteSite error:', e);
      showToast(e.message || 'فشل حذف الموقع', 'error');
    }
  };

  const getSiteType = (val: string) => SITE_TYPES.find(t => t.value === val) || SITE_TYPES[2];

  if (!projectId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p>لم يتم تحديد المشروع. <Link href="/dashboard/admin-gateway/projects/list" className="underline text-blue-400">العودة للمشاريع</Link></p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin-gateway/projects/list"
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
            <ChevronLeft size={20} className="rotate-180" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin size={24} className="text-blue-400" />
              إدارة المواقع
            </h1>
            <p className="text-gray-400 text-sm mt-1">{projectName}</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          إضافة موقع
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {SITE_TYPES.slice(0, 4).map(type => {
          const count = sites.filter(s => s.site_type === type.value).length;
          return (
            <div key={type.value} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
              <div className="text-xs text-gray-400">{type.label}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: type.color }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Sites Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-blue-400" />
        </div>
      ) : sites.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <MapPin size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">لا توجد مواقع لهذا المشروع</p>
          <p className="text-sm mt-1">اضغط "إضافة موقع" لإنشاء أول موقع</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map(site => {
            const typeInfo = getSiteType(site.site_type);
            return (
              <div key={site.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors">
                {/* Type badge */}
                <div className="flex items-start justify-between mb-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: typeInfo.color + '20', color: typeInfo.color, border: `1px solid ${typeInfo.color}40` }}>
                    {typeInfo.label}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(site)}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(site)}
                      className="p-1.5 rounded hover:bg-red-900/40 text-gray-400 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-white mb-1">{site.name}</h3>
                {site.code && <p className="text-xs text-gray-400 mb-2 font-mono">{site.code}</p>}
                {site.description && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{site.description}</p>
                )}

                {(site.latitude && site.longitude) && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                    <MapPin size={12} />
                    <span>{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    site.status === 'active'
                      ? 'bg-green-500/10 text-green-400'
                      : site.status === 'inactive'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {SITE_STATUSES.find(s => s.value === site.status)?.label || site.status}
                  </span>
                  <span className="text-xs text-gray-600">#{site.id}</span>
                </div>

                {site.parent_site_id && (
                  <p className="text-xs text-gray-600 mt-1">
                    تابع للموقع #{site.parent_site_id}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Map Preview (if any sites have coordinates) */}
      {sites.some(s => s.latitude && s.longitude) && (
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <MapPin size={14} />
            مواقع جغرافية ({sites.filter(s => s.latitude && s.longitude).length} موقع)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sites.filter(s => s.latitude && s.longitude).map(site => {
              const typeInfo = getSiteType(site.site_type);
              return (
                <div key={site.id} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: typeInfo.color }} />
                  <span className="text-white">{site.name}</span>
                  <span className="text-gray-500 text-xs mr-auto">{site.latitude?.toFixed(4)}, {site.longitude?.toFixed(4)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Map Location Picker */}
      <MapLocationPicker
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onLocationSelect={(lat, lng) => {
          setFormData(p => ({ ...p, latitude: lat.toString(), longitude: lng.toString() }));
        }}
        initialLatitude={formData.latitude ? parseFloat(formData.latitude) : 32.8}
        initialLongitude={formData.longitude ? parseFloat(formData.longitude) : 13.18}
        title="اختر موقع الموقع على الخريطة"
      />

      {/* Slide-in Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-lg font-bold">{editSite ? 'تعديل موقع' : 'إضافة موقع جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">اسم الموقع *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="مثال: الموقع الإداري المركزي"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">كود الموقع</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                    placeholder="SITE-001"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">نوع الموقع</label>
                  <select
                    value={formData.site_type}
                    onChange={e => setFormData(p => ({ ...p, site_type: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                  >
                    {SITE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="وصف مختصر للموقع..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none resize-none"
                />
              </div>

              {/* Coordinates Row with Map Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">الإحداثيات الجغرافية</label>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 text-green-400 rounded-lg text-xs transition-colors"
                  >
                    <Crosshair size={12} />
                    {formData.latitude && formData.longitude ? 'تعديل الموقع على الخريطة' : 'اختر من الخريطة'}
                  </button>
                </div>
                {formData.latitude && formData.longitude && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
                    <MapPin size={12} />
                    <span>{parseFloat(formData.latitude).toFixed(6)}, {parseFloat(formData.longitude).toFixed(6)}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">خط العرض (يدوي)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.latitude}
                      onChange={e => setFormData(p => ({ ...p, latitude: e.target.value }))}
                      placeholder="32.8800"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">خط الطول (يدوي)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.longitude}
                      onChange={e => setFormData(p => ({ ...p, longitude: e.target.value }))}
                      placeholder="13.1800"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">الحالة</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                  >
                    {SITE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">موقع أب (اختياري)</label>
                  <select
                    value={formData.parent_site_id}
                    onChange={e => setFormData(p => ({ ...p, parent_site_id: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                  >
                    <option value="">— لا يوجد —</option>
                    {sites
                      .filter(s => !editSite || s.id !== editSite.id)
                      .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                    }
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editSite ? 'حفظ التعديلات' : 'إنشاء الموقع'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors"
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
