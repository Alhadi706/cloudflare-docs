'use client';

/**
 * Operations & Maintenance Dashboard
 * لوحة التحكم الخاصة بإدارة الصيانة والعمليات
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { FileUploadZone } from './components/FileUploadZone';
import { ProfileView } from './components/ProfileView';
import { AssetManagementTable } from './components/AssetManagementTable';
import { LinearAsset } from '@/lib/linear-referencing/types';

interface UploadSummary {
  total_rows: number;
  assets_created: number;
  geo_located: number;
  data_quality_score: number;
  quality: {
    duplicates_removed: number;
    rejected_rows: number;
    invalid_station_rows: number;
    invalid_invert_rows: number;
  };
  classification: {
    main: number;
    child: number;
  };
}

interface PageState {
  assets: LinearAsset[];
  isLoading: boolean;
  error: string | null;
  success: string | null;
  summary: UploadSummary | null;
  selectedAssetId: string | null;
  activeTab: 'profile' | 'table';
}

export default function OperationsMaintenancePage() {
  const [state, setState] = useState<PageState>({
    assets: [],
    isLoading: false,
    error: null,
    success: null,
    summary: null,
    selectedAssetId: null,
    activeTab: 'profile',
  });

  const persistAssets = useCallback(async (assets: LinearAsset[], summary: UploadSummary | null) => {
    try {
      await fetch('/api/maintenance/linear-assets/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets, summary: summary || {} }),
      });
    } catch {
      // Keep UI responsive even if persistence endpoint is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/maintenance/linear-assets/saved');
        const data = await response.json();
        if (!mounted || !response.ok || !data?.success) return;

        setState((prev) => ({
          ...prev,
          assets: Array.isArray(data.assets) ? data.assets : prev.assets,
          summary: data.summary || prev.summary,
        }));
      } catch {
        // Silent fallback to empty state when no saved data exists yet.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      success: null,
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/maintenance/linear-assets/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'فشل رفع الملف');
      }

      setState((prev) => ({
        ...prev,
        assets: data.assets || [],
        success: data.message,
        summary: data.summary || null,
        error: null,
        isLoading: false,
      }));

      await persistAssets(data.assets || [], data.summary || null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'حدث خطأ غير معروف';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        summary: null,
        isLoading: false,
      }));
    }
  }, []);

  const handleAssetClick = useCallback((asset: LinearAsset) => {
    setState((prev) => ({
      ...prev,
      selectedAssetId: asset.id,
      activeTab: 'table',
    }));
  }, []);

  const handleDeleteAsset = useCallback(async (assetId: string) => {
    const nextAssets = state.assets.filter((a) => a.id !== assetId);
    setState((prev) => ({
      ...prev,
      assets: nextAssets,
      selectedAssetId:
        prev.selectedAssetId === assetId ? null : prev.selectedAssetId,
    }));

    await persistAssets(nextAssets, state.summary);
  }, [persistAssets, state.assets, state.summary]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-lg p-6 border border-blue-800/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                🔧 إدارة الصيانة والعمليات
              </h1>
              <p className="text-blue-200 text-base mt-1">
                نظام البيانات الخطية (Linear Referencing System)
              </p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900/50 rounded-lg border border-blue-700">
                <span className="text-base text-blue-300">أصول مسجلة:</span>
                <span className="text-xl font-bold text-blue-100">
                  {state.assets.length}
                </span>
              </div>
            </div>
          </div>
          <p className="text-gray-300">
            📤 رفع ملفات CSV و Excel مع بيانات المحطات والارتفاعات • 📊 عرض خطي للبيانات
            • 🗺️ إعداد للربط الجغرافي المستقبلي
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            📤 رفع بيانات خطية جديدة
          </h2>
          <FileUploadZone
            onFileSelect={handleFileSelect}
            isLoading={state.isLoading}
            error={state.error}
            success={state.success}
          />

          {state.summary && (
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <QualityCard
                label="درجة جودة البيانات"
                value={`${state.summary.data_quality_score}%`}
                tone={state.summary.data_quality_score >= 80 ? 'good' : state.summary.data_quality_score >= 60 ? 'warn' : 'bad'}
              />
              <QualityCard
                label="صفوف مكررة"
                value={state.summary.quality.duplicates_removed.toString()}
                tone={state.summary.quality.duplicates_removed > 0 ? 'warn' : 'good'}
              />
              <QualityCard
                label="Station غير صالح"
                value={state.summary.quality.invalid_station_rows.toString()}
                tone={state.summary.quality.invalid_station_rows > 0 ? 'bad' : 'good'}
              />
              <QualityCard
                label="I.L غير صالح"
                value={state.summary.quality.invalid_invert_rows.toString()}
                tone={state.summary.quality.invalid_invert_rows > 0 ? 'bad' : 'good'}
              />
            </div>
          )}
        </div>

        {/* Data Display Section */}
        {state.assets.length > 0 && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2 bg-gray-900 rounded-lg p-1 border border-gray-800 w-fit">
              <button
                onClick={() => setState((prev) => ({ ...prev, activeTab: 'profile' }))}
                className={`px-4 py-2 rounded-md transition-all font-semibold text-base ${
                  state.activeTab === 'profile'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                📊 عرض البروفايل
              </button>
              <button
                onClick={() => setState((prev) => ({ ...prev, activeTab: 'table' }))}
                className={`px-4 py-2 rounded-md transition-all font-semibold text-base ${
                  state.activeTab === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                📋 جدول الأصول
              </button>
            </div>

            {/* Profile View Tab */}
            {state.activeTab === 'profile' && (
              <div>
                <ProfileView
                  assets={state.assets}
                  routeName="مسار النهر الصناعي"
                  onAssetClick={handleAssetClick}
                  selectedAssetId={state.selectedAssetId || undefined}
                />
              </div>
            )}

            {/* Table View Tab */}
            {state.activeTab === 'table' && (
              <div>
                <AssetManagementTable
                  assets={state.assets}
                  onAssetClick={handleAssetClick}
                  onDeleteClick={handleDeleteAsset}
                  selectedAssetId={state.selectedAssetId || undefined}
                />
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-lg p-4">
          <h3 className="font-semibold text-indigo-200 mb-2">ℹ️ معلومات النظام</h3>
          <ul className="text-base text-indigo-200 space-y-1 list-disc list-inside">
            <li>
              البيانات مخزنة حالياً على أساس النظام الخطي (محطات + ارتفاعات)
            </li>
            <li>
              عند توفر نقاط مرجعية GPS، سيتم التحويل التلقائي إلى إحداثيات جغرافية
            </li>
            <li>
              يمكن دمج البيانات تلقائياً مع نظام الخرائط الجغرافية (GIS)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function QualityCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'bad';
}) {
  const toneClasses =
    tone === 'good'
      ? 'border-emerald-700/40 bg-emerald-900/20 text-emerald-200'
      : tone === 'warn'
        ? 'border-amber-700/40 bg-amber-900/20 text-amber-200'
        : 'border-rose-700/40 bg-rose-900/20 text-rose-200';

  return (
    <div className={`rounded-lg border p-3 ${toneClasses}`}>
      <p className="text-base opacity-85">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
