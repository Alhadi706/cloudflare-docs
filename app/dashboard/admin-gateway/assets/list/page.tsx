'use client';

import React, { useState, useEffect } from 'react';
import { Package, Search, ChevronLeft, MapPin, Calendar, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

interface Asset {
  id: number;
  asset_id?: string;
  asset_name: string;
  asset_type?: string;
  location?: string;
  status?: string;
  acquisition_date?: string;
  acquisition_value?: number;
  condition?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active:           'bg-green-500/20  text-green-300  border-green-500/30',
  operational:      'bg-green-500/20  text-green-300  border-green-500/30',
  maintenance:      'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  inactive:         'bg-slate-500/20  text-slate-400  border-slate-500/30',
  decommissioned:   'bg-red-500/20    text-red-300    border-red-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'نشط', operational: 'تشغيلي', maintenance: 'صيانة',
  inactive: 'غير نشط', decommissioned: 'مسحوب',
};

export default function AssetListPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const tid = getTenantId() || localStorage.getItem('active_tenant_id') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tid) headers['X-Tenant-ID'] = tid;
      // جمع الأصول من مصدرين
      const [maintRes, workspaceRes] = await Promise.all([
        fetch('/api/v1/maintenance/assets', { headers }),
        fetch('/api/v1/workspace/assets',   { headers }),
      ]);
      const combined: Asset[] = [];
      if (maintRes.ok) {
        const d = await maintRes.json();
        const list = Array.isArray(d) ? d : (d.assets ?? []);
        list.forEach((a: any) => combined.push({
          id: a.id,
          asset_id: a.asset_code,
          asset_name: a.name,
          asset_type: a.category,
          location: a.location,
          status: a.status ?? 'operational',
          acquisition_date: a.last_maintenance_date,
          condition: a.status,
        }));
      }
      if (workspaceRes.ok) {
        const d = await workspaceRes.json();
        const list = Array.isArray(d) ? d : (d.assets ?? []);
        list.forEach((a: any) => combined.push({
          id: a.id,
          asset_id: a.asset_code ?? a.code,
          asset_name: a.name ?? a.asset_name,
          asset_type: a.asset_type ?? a.category,
          location: a.location,
          status: a.status ?? 'active',
          acquisition_date: a.acquisition_date,
          acquisition_value: a.acquisition_value,
          condition: a.condition,
        }));
      }
      setAssets(combined);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = assets.filter(a =>
    !searchTerm ||
    a.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.asset_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/digital-assets" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">قائمة الأصول</h1>
            <p className="text-sm text-slate-500">جميع أصول المؤسسة ومواقعها</p>
          </div>
          <div className="mr-auto">
            <span className="text-sm text-slate-500">
              {loading ? '...' : `${filtered.length} أصل`}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="البحث في الأصول..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin ml-3" />
            جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
            <AlertCircle className="w-10 h-10 text-slate-600" />
            <p>{searchTerm ? 'لا توجد نتائج مطابقة' : 'لا توجد أصول مسجلة'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(asset => (
              <div key={asset.id} className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 hover:border-slate-600 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 truncate">{asset.asset_name}</p>
                    {asset.asset_id && (
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{asset.asset_id}</p>
                    )}
                  </div>
                  {asset.status && (
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[asset.status] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                      {STATUS_LABELS[asset.status] ?? asset.status}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  {asset.asset_type && (
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 shrink-0" />
                      <span>{asset.asset_type}</span>
                    </div>
                  )}
                  {asset.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{asset.location}</span>
                    </div>
                  )}
                  {asset.acquisition_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{new Date(asset.acquisition_date).toLocaleDateString('ar-SA')}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <Link
                    href={`/dashboard/asset-360/${asset.id}`}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-cyan-950/40 border border-cyan-700/40 px-3 py-1.5 text-[11px] font-semibold text-cyan-400 hover:bg-cyan-900/50 hover:border-cyan-500/60 transition-colors"
                  >
                    360°
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
