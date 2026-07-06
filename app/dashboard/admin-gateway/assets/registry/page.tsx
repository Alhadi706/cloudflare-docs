'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Search, Filter, MapPin, ChevronLeft, Calendar, MapIcon, Upload, Layers, GitBranch } from 'lucide-react';
import Link from 'next/link';
import AssetMapPanel from '@/components/AssetMapPanel';
import { useMapNavigation, useAssetSpatial } from '@/hooks/useErpSpatial';
import CsvUploader from '@/components/CsvUploader';
import ContextualImportModal from '@/components/ContextualImportModal';
import LocationPickerModal, { SelectedLocation } from '../../components/LocationPickerModal';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

interface Asset {
  id: number;
  asset_id?: string;
  asset_name: string;
  asset_type: string;
  location?: string;
  status: string;
  acquisition_date?: string;
  acquisition_value?: number;
  current_value?: number;
  condition?: string;
  responsible_person?: string;
  last_maintenance?: string;
  // Phase 4A additions
  asset_class?: string;
  parent_asset_id?: number | string | null;
  parent_asset_name?: string | null;
}

// Phase 4A: Asset classification types
const ASSET_CLASS_OPTIONS = [
  { value: 'site_asset',    label: 'أصل موقع (محطة / مبنى / خزان)',    desc: 'أصل ثابت مرتبط بموقع تشغيلي' },
  { value: 'compound',      label: 'منظومة مركبة (Compound)',      desc: 'يحتوي أصولاً فرعية (مبانٍ داخل منظومة)' },
  { value: 'linear',        label: 'أصل خطي (Linear)',          desc: 'خط أنابيب / طريق / خط كهرباء (له مكونات على مساره)' },
  { value: 'component_slot',label: 'مكوّن تشغيلي (Component)',      desc: 'جزء قابل للاستبدال داخل أصل أكبر (مضخة / صمام / عداد)' },
  { value: 'vehicle',       label: 'مركبة / معدة متنقلة',         desc: 'أصل متحرك مستقل (مركبات، آليات)' },
  { value: 'it_asset',      label: 'أصل تقني معلوماتي',             desc: 'أجهزة تقنية، خوادم' },
];

const ASSET_CLASS_LABELS: Record<string, string> = {
  site_asset:     'أصل موقع',
  compound:       'منظومة مركبة',
  linear:         'أصل خطي',
  component_slot: 'مكوّن تشغيلي',
  vehicle:        'مركبة/معدة',
  it_asset:       'تقني معلوماتي',
};

const ASSET_CLASS_COLORS: Record<string, string> = {
  site_asset:     'bg-blue-500/15 text-blue-300 border-blue-500/25',
  compound:       'bg-violet-500/15 text-violet-300 border-violet-500/25',
  linear:         'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  component_slot: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  vehicle:        'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  it_asset:       'bg-slate-500/15 text-slate-300 border-slate-500/25',
};

// ── SiteSelector — dropdown of all operational sites (Phase 2) ───────────────
function SiteSelector({ value, onChange }: {
  value: string | number;
  onChange: (siteId: string | number, siteName: string) => void;
}) {
  const [sites, setSites] = React.useState<Array<{ id: number; name: string; project_name: string }>>([]);
  React.useEffect(() => {
    fetch('/api/v1/workspace/all-sites', { headers: getClientTenantHeaders() })
      .then(r => r.ok ? r.json() : { sites: [] })
      .then(d => setSites(d.sites || []))
      .catch(() => {});
  }, []);
  const byProject = React.useMemo(() =>
    sites.reduce((acc, s) => { if (!acc[s.project_name]) acc[s.project_name] = []; acc[s.project_name].push(s); return acc; }, {} as Record<string, typeof sites>),
  [sites]);
  return (
    <select
      value={value}
      onChange={e => { const s = sites.find(x => String(x.id) === e.target.value); onChange(e.target.value, s?.name || ''); }}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
    >
      <option value="">— اختر موقعاً تشغيلياً (اختياري) —</option>
      {Object.entries(byProject).map(([proj, projSites]) => (
        <optgroup key={proj} label={proj}>
          {projSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export default function AssetRegistryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  // Phase 4A: parent assets for selector
  const [parentAssets, setParentAssets] = useState<Asset[]>([]);
  
  // تكامل مكاني
  const { showMapPanel, selectedAssetId, showAssetOnMap, closeMapPanel } = useMapNavigation();
  const { syncAssetToMap, isLoading: isSyncing } = useAssetSpatial();
  
  const [formData, setFormData] = useState({
    asset_name: '',
    asset_type: '',
    location: '',
    status: 'active',
    acquisition_date: '',
    acquisition_value: '',
    condition: 'good',
    responsible_person: '',
    // Phase 4A: classification + hierarchy
    asset_class: 'site_asset' as string,
    parent_asset_id: '' as string | number,
    component_slot_name: '',  // for component_slot type
    // location fields (all optional — site OR lat/lng OR parent gives context)
    project_id: '' as string | number,
    project_name: '',
    site_id: '' as string | number,
    site_name: '',
    latitude: '',
    longitude: '',
    health_score: '100'
  });

  useEffect(() => {
    fetchAssets();
    fetchParentAssets();
  }, []);

  // Phase 4A: load assets that can serve as parents (compound or linear)
  const fetchParentAssets = async () => {
    try {
      const r = await fetch('/api/v1/workspace/assets/all?limit=500', { headers: getClientTenantHeaders() });
      if (r.ok) {
        const d = await r.json();
        const all: Asset[] = d.assets || [];
        setParentAssets(all.filter(a => 
          a.asset_class === 'compound' || a.asset_class === 'linear' || a.asset_class === 'site_asset'
        ));
      }
    } catch {/* silent */}
  };

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/v1/workspace/assets/all?limit=1000', {
        headers: {
          ...getClientTenantHeaders(),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      } else {
        console.error('Failed to fetch assets:', response.status);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Phase 4A: component_slot requires a parent
    if (formData.asset_class === 'component_slot' && !formData.parent_asset_id) {
      alert('المكوّن التشغيلي يجب أن يكون مرتبطاً بأصل رئيسي');
      return;
    }
    // Location is optional — asset can exist without coordinates initially
    try {
      const url = editAsset 
        ? `/api/v1/workspace/assets/${editAsset.id}`
        : '/api/v1/workspace/assets';
      const method = editAsset ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const savedAsset = await response.json();
        
        // مزامنة مع قاعدة البيانات المكانية
        if (formData.latitude && formData.longitude) {
          await syncAssetToMap({
            asset_id: savedAsset.asset?.id || savedAsset.id,
            asset_name: formData.asset_name,
            asset_type: formData.asset_type,
            latitude: parseFloat(formData.latitude),
            longitude: parseFloat(formData.longitude),
            status: formData.status,
            health_score: parseFloat(formData.health_score),
            location: formData.location
          });
        }
        
        fetchAssets();
        setShowForm(false);
        setEditAsset(null);
        setFormData({
          asset_name: '',
          asset_type: '',
          location: '',
          status: 'active',
          acquisition_date: '',
          acquisition_value: '',
          condition: 'good',
          responsible_person: '',
          asset_class: 'site_asset',
          parent_asset_id: '',
          component_slot_name: '',
          project_id: '',
          project_name: '',
          site_id: '',
          site_name: '',
          latitude: '',
          longitude: '',
          health_score: '100'
        });
      }
    } catch (error) {
      console.error('Error saving asset:', error);
    }
  };

  const handleEdit = (asset: Asset) => {
    setEditAsset(asset);
    setFormData({
      asset_name: asset.asset_name,
      asset_type: asset.asset_type,
      location: asset.location || '',
      status: asset.status,
      acquisition_date: asset.acquisition_date || '',
      acquisition_value: asset.acquisition_value?.toString() || '',
      condition: asset.condition || 'good',
      responsible_person: asset.responsible_person || '',
      latitude: '',
      longitude: '',
      health_score: '100'
    });
    setShowForm(true);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'text-emerald-400 bg-emerald-500/10';
      case 'inactive': return 'text-slate-400 bg-slate-500/10';
      case 'maintenance': return 'text-amber-400 bg-amber-500/10';
      case 'retired': return 'text-rose-400 bg-rose-500/10';
      case 'disposed': return 'text-red-400 bg-red-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition?.toLowerCase()) {
      case 'excellent': return 'text-emerald-400 bg-emerald-500/10';
      case 'good': return 'text-blue-400 bg-blue-500/10';
      case 'fair': return 'text-amber-400 bg-amber-500/10';
      case 'poor': return 'text-orange-400 bg-orange-500/10';
      case 'critical': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD',
      minimumFractionDigits: 0
    }).format(value);
  };

  const filteredAssets = assets.filter(asset =>
    asset.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.asset_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.asset_id?.includes(searchTerm)
  );

  const activeCount = assets.filter(a => a.status === 'active').length;
  const maintenanceCount = assets.filter(a => a.status === 'maintenance').length;
  const totalValue = assets.reduce((sum, a) => sum + (a.current_value || a.acquisition_value || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/assets">الأصول</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">سجل الأصول</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/50">
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">سجل الأصول</h1>
              <p className="text-slate-400 mt-1">إدارة قاعدة بيانات الأصول المؤسسية</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CsvUploader module="assets" />
            <button
              onClick={() => setShowImportModal(true)}
              className="px-5 py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span>رفع ملف الأصول</span>
            </button>
            <button 
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>أصل جديد</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الأصول</span>
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{assets.length}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">نشط</span>
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{activeCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">قيد الصيانة</span>
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{maintenanceCount}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">القيمة الإجمالية</span>
              <Building2 className="w-5 h-5 text-violet-400" />
            </div>
            <div className="text-lg font-bold text-slate-100">{formatCurrency(totalValue)}</div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم، النوع، أو الموقع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="px-6 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800/50 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <span>تصفية</span>
          </button>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : filteredAssets.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">
                  {searchTerm ? 'لا توجد نتائج' : 'لا توجد أصول مسجلة بعد'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">معرف الأصل</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">اسم الأصل</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">النوع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموقع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الوضع</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">القيمة</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">GIS</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">المسؤول</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                        {asset.asset_id || `AST-${asset.id}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-200 font-medium">
                        {asset.asset_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {asset.asset_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {asset.location || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {asset.condition ? (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getConditionColor(asset.condition)}`}>
                            {asset.condition}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {asset.current_value || asset.acquisition_value 
                          ? formatCurrency(asset.current_value || asset.acquisition_value || 0)
                          : '-'}
                      </td>
                      
                      {/* عمود GIS */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => showAssetOnMap(asset.id)}
                          className="p-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors group"
                          title="عرض على الخريطة"
                        >
                          <MapIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>
                      </td>
                      
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {asset.responsible_person || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/admin-gateway/assets/${asset.id}`}
                            className="px-3 py-1 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs hover:bg-cyan-600/30 transition-colors font-semibold"
                            title="عرض الأصل 360°"
                          >
                            360°
                          </Link>
                          <button 
                            onClick={() => handleEdit(asset)}
                            className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-colors"
                          >
                            تعديل
                          </button>
                        </div>
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
          <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-slate-100">
                {editAsset ? 'تعديل الأصل' : 'أصل جديد'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Phase 4A: Asset Classification */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  تصنيف الأصل *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ASSET_CLASS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({...formData, asset_class: opt.value, parent_asset_id: ''})}
                      className={`text-right p-2.5 rounded-xl border text-xs transition-all ${
                        formData.asset_class === opt.value
                          ? (ASSET_CLASS_COLORS[opt.value] || 'border-violet-500/50 bg-violet-900/20 text-violet-300')
                          : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* الأصل الرئيسي — فقط للمكوّنات القابلة للاستبدال */}
              {formData.asset_class === 'component_slot' && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-3 space-y-2">
                  <label className="block text-sm font-medium text-amber-300 flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    الأصل الذي يحتوي هذا المكوّن *
                  </label>
                  <select
                    value={formData.parent_asset_id}
                    onChange={e => setFormData({...formData, parent_asset_id: e.target.value})}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">— اختر الأصل الرئيسي —</option>
                    {parentAssets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.asset_name} ({ASSET_CLASS_LABELS[a.asset_class || ''] || a.asset_class})
                      </option>
                    ))}
                  </select>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">
                      اسم الـ Slot — الفتحة الثابتة في الأصل (مثال: المضخة الرئيسية، صمام التحكم A)
                    </label>
                    <input
                      value={formData.component_slot_name}
                      onChange={e => setFormData({...formData, component_slot_name: e.target.value})}
                      placeholder="مثال: المضخة الرئيسية"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-600"
                    />
                    <p className="text-[10px] text-slate-600 mt-1">
                      هذا الاسم يبقى ثابتاً عند استبدال المكوّن — التاريخ يُسجَّل على الـ Slot لا على القطعة
                    </p>
                  </div>
                </div>
              )}

              {/* اسم الأصل + نوع تفصيلي */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">اسم الأصل *</label>
                  <input
                    type="text"
                    required
                    value={formData.asset_name}
                    onChange={(e) => setFormData({...formData, asset_name: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder={
                      formData.asset_class === 'compound' ? 'مثال: منظومة الحساونة' :
                      formData.asset_class === 'linear' ? 'مثال: خط النهر الرئيسي' :
                      formData.asset_class === 'component_slot' ? 'مثال: مضخة رقم 5' :
                      formData.asset_class === 'vehicle' ? 'مثال: شاحنة F-450' :
                      'اسم الأصل التشغيلي'
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">النوع التفصيلي</label>
                  <input
                    type="text"
                    value={formData.asset_type}
                    onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                    placeholder={
                      formData.asset_class === 'compound' ? 'منظومة ضخ، محطة تحكم...' :
                      formData.asset_class === 'site_asset' ? 'مبنى، خزان، ورشة...' :
                      formData.asset_class === 'linear' ? 'خط مياه، خط غاز...' :
                      formData.asset_class === 'component_slot' ? 'مضخة طاردة مركزية، صمام بوابة...' :
                      formData.asset_class === 'vehicle' ? 'شاحنة، حفارة...' :
                      'النوع التفصيلي للأصل'
                    }
                  />
                </div>
              </div>

              {/* المسؤول */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">المسؤول التشغيلي</label>
                <input
                  type="text"
                  value={formData.responsible_person}
                  onChange={(e) => setFormData({...formData, responsible_person: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  placeholder="اسم المسؤول أو الجهة"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الحالة</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                    <option value="maintenance">صيانة</option>
                    <option value="retired">متقاعد</option>
                    <option value="disposed">مستبعد</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">الوضع</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({...formData, condition: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  >
                    <option value="excellent">ممتاز</option>
                    <option value="good">جيد</option>
                    <option value="fair">مقبول</option>
                    <option value="poor">ضعيف</option>
                    <option value="critical">حرج</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      تاريخ الاقتناء
                    </div>
                  </label>
                  <input
                    type="date"
                    value={formData.acquisition_date}
                    onChange={(e) => setFormData({...formData, acquisition_date: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">قيمة الاقتناء (ريال)</label>
                <input
                  type="number"
                  value={formData.acquisition_value}
                  onChange={(e) => setFormData({...formData, acquisition_value: e.target.value})}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* الموقع — اختياري بالكامل */}
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  الموقع التشغيلي
                  <span className="text-[11px] text-slate-600 font-normal">— اختياري، يمكن تحديده لاحقاً من GIS</span>
                </div>

                {/* Dropdown مواقع من Phase 2 */}
                <SiteSelector
                  value={formData.site_id}
                  onChange={(siteId, siteName) => setFormData({...formData, site_id: siteId, site_name: siteName})}
                />

                {/* إحداثيات دقيقة — اختيارية */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">خط العرض</label>
                    <input
                      type="number" step="0.000001"
                      value={formData.latitude}
                      onChange={e => setFormData({...formData, latitude: e.target.value})}
                      placeholder="32.XXXXXX"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">خط الطول</label>
                    <input
                      type="number" step="0.000001"
                      value={formData.longitude}
                      onChange={e => setFormData({...formData, longitude: e.target.value})}
                      placeholder="13.XXXXXX"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-700"
                    />
                  </div>
                </div>

                {/* ملخص الموقع المُختار */}
                {(formData.site_name || (formData.latitude && formData.longitude)) && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/10 border border-emerald-700/30 rounded-lg px-3 py-1.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {formData.site_name && <span>{formData.site_name}</span>}
                    {formData.latitude && formData.longitude && (
                      <span className="font-mono text-slate-500">
                        {Number(formData.latitude).toFixed(4)}°N, {Number(formData.longitude).toFixed(4)}°E
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors"
                >
                  {isSyncing ? 'جاري المزامنة...' : (editAsset ? 'تحديث' : 'حفظ')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditAsset(null);
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
      
      {/* لوحة الخريطة العائمة */}
      {showMapPanel && selectedAssetId && (
        <AssetMapPanel
          assetId={selectedAssetId}
          assetName={assets.find(a => a.id === selectedAssetId)?.asset_name}
          onClose={closeMapPanel}
        />
      )}

      {/* مودال اختيار الموقع من الخريطة */}
      <LocationPickerModal
        open={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={(loc: SelectedLocation) => {
          setFormData(prev => ({
            ...prev,
            project_id: loc.project_id,
            project_name: loc.project_name,
            site_id: loc.site_id ?? '',
            site_name: loc.site_name ?? '',
            latitude: loc.latitude.toString(),
            longitude: loc.longitude.toString(),
            location: loc.site_name || prev.location,
          }));
          setShowMapPicker(false);
        }}
        title="اختر موقع الأصل"
        initialValue={formData.project_id ? {
          project_id: formData.project_id,
          project_name: formData.project_name,
          site_id: formData.site_id ? Number(formData.site_id) : undefined,
          site_name: formData.site_name,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude ? Number(formData.longitude) : undefined,
        } : undefined}
      />

      {/* مودال استيراد الأصول */}
      {showImportModal && (
        <ContextualImportModal
          moduleKey="assets"
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            fetchAssets();
          }}
        />
      )}
    </div>
  );
}
