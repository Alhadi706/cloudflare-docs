'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
}
import AssetSummaryPanel from '@/app/dashboard/asset-360/components/AssetSummaryPanel';
import AssetGISPanel from '@/app/dashboard/asset-360/components/AssetGISPanel';
import AssetMaintenancePanel from '@/app/dashboard/asset-360/components/AssetMaintenancePanel';
import AssetDocumentPanel from '@/app/dashboard/asset-360/components/AssetDocumentPanel';
import AssetGovernancePanel from '@/app/dashboard/asset-360/components/AssetGovernancePanel';
import OperationalTimeline from '@/app/dashboard/asset-360/components/OperationalTimeline';
import type { Asset360Response } from '@/app/dashboard/asset-360/components/types';

export default function Asset360WorkspacePage() {
  const params = useParams<{ id: string }>();
  const assetId = String(params?.id || '').trim();

  const [data, setData] = useState<Asset360Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!assetId) {
        setError('Missing asset id');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const tenantId = getTenantId();
        const headers: Record<string, string> = {};
        if (tenantId) headers['X-Tenant-ID'] = tenantId;
        const res = await fetch(`/api/v1/workspace/assets/${encodeURIComponent(assetId)}/asset-360`, {
          cache: 'no-store',
          headers,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(json?.detail || json?.error || `HTTP ${res.status}`));
        }
        if (!mounted) return;
        setData(json as Asset360Response);
      } catch (err: any) {
        if (!mounted) return;
        setError(String(err?.message || err || 'Failed to load Asset 360'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [assetId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-6 w-56 rounded bg-slate-200" />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-20 rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !data?.asset360) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-900">Asset 360 Workspace</h1>
          <p className="mt-3 text-sm text-red-700">{error || 'بيانات الأصل غير متاحة'}</p>
          <a href="/dashboard/asset-360" className="mt-4 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            العودة لقائمة الأصول
          </a>
        </div>
      </main>
    );
  }

  const payload = data.asset360;
  const integrationStatus = data.integration_status || payload.integration_status;
  const failedSources = integrationStatus?.sources?.filter((source) => !source.ok) || [];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">المرحلة التنفيذية 4B</p>
              <h1 className="text-2xl font-semibold text-slate-900">مساحة عمل الأصل 360</h1>
              <p className="mt-1 text-sm text-slate-600">عرض تشغيلي موحد: الأصل، GIS، الصيانة، الوثائق، والحوكمة.</p>
            </div>
            <a href="/dashboard/asset-360" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              تغيير الأصل
            </a>
          </div>
        </header>

          {integrationStatus?.degraded && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-amber-900">حالة التكامل: منخفضة</h2>
              <p className="mt-1 text-xs text-amber-800">
                فشل {integrationStatus.failed_sources} من أصل {integrationStatus.total_sources} مصادر بيانات أثناء التجميع.
              </p>
              <div className="mt-2 max-h-28 space-y-1 overflow-auto pr-1 text-xs text-amber-900">
                {failedSources.map((source) => (
                  <p key={`${source.source}:${source.path}`}>
                    {source.source} ({source.http_status || 'ERR'}): {source.error || source.path}
                  </p>
                ))}
              </div>
            </section>
          )}

        <AssetSummaryPanel asset={payload.asset_summary} completionScore={data.completion_score || null} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AssetGISPanel gis={payload.gis} />
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">علاقات الأصل (رئيسي / فرعي)</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">الأصل الرئيسي: </span>
                <span className="font-semibold">{payload.relationships.parent_asset_name || payload.relationships.parent_asset_id || '-'}</span>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">عدد الأصول الفرعية: </span>
                <span className="font-semibold">{payload.relationships.total_children}</span>
              </div>
              {payload.relationships.children.length > 0 && (
                <div className="max-h-56 space-y-1 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                  {payload.relationships.children.slice(0, 40).map((child) => (
                    <div key={String(child.id)} className="rounded-md bg-slate-50 px-2 py-1.5 text-xs">
                      <span className="font-semibold text-slate-800">{String(child.asset_name || child.name || child.id)}</span>
                      <span className="ml-2 text-slate-500">{String(child.status || '-')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AssetMaintenancePanel maintenance={payload.maintenance} />
          <AssetDocumentPanel documents={payload.documents} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AssetGovernancePanel actions={payload.governance_actions} />
          <OperationalTimeline events={payload.operational_timeline} />
        </div>
      </div>
    </main>
  );
}
