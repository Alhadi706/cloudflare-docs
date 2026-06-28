'use client';

import React, { useState, useEffect } from 'react';
import { FolderTree, Search, ChevronLeft, Tag, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function getTenantHeader(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

interface AssetType {
  id: number;
  category_name: string;
  category_code?: string;
  description?: string;
  parent_category_id?: number;
  depreciation_rate?: number;
  useful_life_years?: number;
  asset_count?: number;
  is_active?: boolean;
}

export default function AssetTypesPage() {
  const [types, setTypes]         = useState<AssetType[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      const response = await fetch('/api/v1/hr-structure/asset-categories', {
        headers: getTenantHeader(),
      });
      if (response.ok) {
        const data = await response.json();
        const cats = (data.categories || []).map((c: any) => ({
          id: c.id,
          category_name: c.type_name_ar || c.type_name || c.category_name || c.category || `نوع #${c.id}`,
          category_code: c.type_code || c.category_code,
          description: c.description,
          parent_category_id: c.parent_category_id,
          depreciation_rate: c.depreciation_rate,
          useful_life_years: c.expected_lifetime_years || c.useful_life_years,
          asset_count: c.asset_count,
          is_active: c.is_active !== false,
        }));
        setTypes(cats);
      }
    } catch (error) {
      console.error('Error fetching asset types:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = types.filter(t =>
    !searchTerm ||
    t.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.category_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mainTypes = types.filter(t => !t.parent_category_id).length;
  const subTypes  = types.filter(t => !!t.parent_category_id).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200 transition-colors">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/digital-assets" className="hover:text-slate-200 transition-colors">الأصول والعمليات</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">أنواع الأصول</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-teal-600/20 p-4 rounded-xl border border-teal-500/50">
              <FolderTree className="w-8 h-8 text-teal-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">أنواع الأصول</h1>
              <p className="text-slate-400 mt-1">تصنيف وأنواع الأصول المعتمدة</p>
            </div>
          </div>
          <Link
            href="/dashboard/admin-gateway/assets/categories"
            className="px-5 py-2.5 bg-teal-600/20 border border-teal-500/30 text-teal-300 rounded-xl text-sm font-medium hover:bg-teal-600/30 transition-colors"
          >
            إدارة الفئات ←
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">إجمالي الأنواع</span>
              <FolderTree className="w-5 h-5 text-teal-400" />
            </div>
            <p className="text-2xl font-bold text-slate-100">{loading ? '...' : types.length}</p>
          </div>
          <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">أنواع رئيسية</span>
              <FolderTree className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-slate-100">{loading ? '...' : mainTypes}</p>
          </div>
          <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">أنواع فرعية</span>
              <Tag className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-slate-100">{loading ? '...' : subTypes}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="البحث في أنواع الأصول..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <div className="w-6 h-6 border-2 border-slate-600 border-t-teal-400 rounded-full animate-spin ml-3" />
            جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
            <AlertCircle className="w-10 h-10 text-slate-600" />
            <p>{searchTerm ? 'لا توجد نتائج مطابقة' : 'لا توجد أنواع مسجلة'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(t => (
              <div key={t.id}
                className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 hover:border-teal-500/40 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                    {t.parent_category_id
                      ? <Tag className="w-4 h-4 text-teal-400" />
                      : <FolderTree className="w-4 h-4 text-teal-400" />}
                  </div>
                  {t.is_active === false && (
                    <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded-full border border-slate-600">
                      غير نشط
                    </span>
                  )}
                </div>
                <p className="font-semibold text-sm text-slate-200 mb-1">{t.category_name}</p>
                {t.category_code && (
                  <p className="text-xs text-slate-500 font-mono mb-2">{t.category_code}</p>
                )}
                {t.description && (
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{t.description}</p>
                )}
                {(t.useful_life_years || t.asset_count !== undefined) && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    {t.useful_life_years && <span>العمر: {t.useful_life_years} سنة</span>}
                    {t.asset_count !== undefined && <span>{t.asset_count} أصل</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
