'use client';
/**
 * Asset Detail Page — Phase 4
 * ════════════════════════════════════════════════════════════════
 * Route: /dashboard/admin-gateway/assets/[id]
 *
 * This is the canonical Asset 360 workspace, now integrated directly
 * into the Assets department flow. Reached by clicking any asset in
 * the registry at /dashboard/admin-gateway/assets/registry.
 *
 * Reuses all Asset 360 components from their original location —
 * no duplication. Only the routing entry point has changed.
 *
 * Theme: dark slate (matches the rest of the platform).
 * The old Asset 360 pages now redirect here (Phase 1).
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';

// ── Reuse existing Asset 360 components ──────────────────────────────────────
import AssetSummaryPanel    from '@/app/dashboard/asset-360/components/AssetSummaryPanel';
import AssetGISPanel        from '@/app/dashboard/asset-360/components/AssetGISPanel';
import AssetMaintenancePanel from '@/app/dashboard/asset-360/components/AssetMaintenancePanel';
import AssetDocumentPanel   from '@/app/dashboard/asset-360/components/AssetDocumentPanel';
import AssetGovernancePanel from '@/app/dashboard/asset-360/components/AssetGovernancePanel';
import OperationalTimeline  from '@/app/dashboard/asset-360/components/OperationalTimeline';
import type { Asset360Response } from '@/app/dashboard/asset-360/components/types';

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
}

// ── Tab definition ────────────────────────────────────────────────────────────

type TabKey = 'summary' | 'gis' | 'maintenance' | 'documents' | 'governance' | 'timeline';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'summary',     label: 'ملخص الأصل'      },
  { key: 'gis',         label: 'الموقع والخريطة'  },
  { key: 'maintenance', label: 'الصيانة'          },
  { key: 'documents',   label: 'الوثائق'          },
  { key: 'governance',  label: 'الحوكمة'          },
  { key: 'timeline',    label: 'الجدول الزمني'    },
];

// ── Page component ────────────────────────────────────────────────────────────

export default function AssetDetailPage() {
  const params  = useParams<{ id: string }>();
  const router  = useRouter();
  const assetId = String(params?.id || '').trim();

  const [data,    setData]    = useState<Asset360Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  // ── Fetch 360 data ─────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!assetId) { setError('معرّف الأصل مفقود'); setLoading(false); return; }
      setLoading(true); setError('');
      try {
        const tid = getTenantId();
        const res = await fetch(
          `/api/v1/workspace/assets/${encodeURIComponent(assetId)}/asset-360`,
          { cache: 'no-store', headers: tid ? { 'X-Tenant-ID': tid } : {} },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(json?.detail || json?.error || `HTTP ${res.status}`));
        if (mounted) setData(json as Asset360Response);
      } catch (e: any) {
        if (mounted) setError(String(e?.message || e || 'فشل تحميل بيانات الأصل'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [assetId]);

  // ── Asset name for breadcrumb ──────────────────────────────────────────────
  const assetName: string =
    (data?.asset360?.asset_summary as any)?.asset_name ||
    (data?.asset360?.asset_summary as any)?.name ||
    assetId;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-4" dir="rtl">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-72 rounded bg-slate-800 animate-pulse" />
        {/* Tab bar skeleton */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <div key={t.key} className="h-8 w-24 rounded-lg bg-slate-800 animate-pulse" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-3 animate-pulse">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-5 rounded bg-slate-800" style={{ width: `${70 + i * 5}%` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-6" dir="rtl">
        <div className="rounded-xl border border-rose-500/30 bg-rose-900/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-300 text-sm">تعذّر تحميل بيانات الأصل</p>
            <p className="text-rose-400/70 text-xs mt-1">{error}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setError(''); setLoading(true); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
              >
                إعادة المحاولة
              </button>
              <Link
                href="/dashboard/admin-gateway/assets/registry"
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                العودة للسجل
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="breadcrumb">
          <Link href="/dashboard/admin-gateway/assets" className="hover:text-slate-300 transition-colors">
            الأصول
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/dashboard/admin-gateway/assets/registry" className="hover:text-slate-300 transition-colors">
            سجل الأصول
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-300 font-medium truncate max-w-[200px]">{assetName}</span>
        </nav>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">عرض الأصل 360°</p>
            <h1 className="text-xl font-bold text-slate-100 leading-tight">{assetName}</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{assetId}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setLoading(true); setData(null); }}
              className="p-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              رجوع
            </button>
          </div>
        </div>

        {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-slate-800 pb-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px
                ${activeTab === tab.key
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ──────────────────────────────────────────────────── */}
        <div className="min-h-[400px]">
          {activeTab === 'summary' && data?.asset360 && (
            <AssetSummaryPanel
              asset={data.asset360.asset_summary}
              completionScore={data.completion_score || null}
            />
          )}
          {activeTab === 'gis' && data?.asset360 && (
            <div className="space-y-4">
              <AssetGISPanel gis={data.asset360.gis} />

              {/* Relationships (GIS ↔ ERP linking will be implemented in Phase 4) */}
              <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">علاقات الأصل (رئيسي / فرعي)</h3>
                <div className="space-y-2 text-sm">
                  <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                    <span className="text-slate-500 text-xs">الأصل الرئيسي: </span>
                    <span className="font-semibold text-slate-200">
                      {data.asset360.relationships.parent_asset_name || data.asset360.relationships.parent_asset_id || '—'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                    <span className="text-slate-500 text-xs">عدد الأصول الفرعية: </span>
                    <span className="font-semibold text-slate-200">{data.asset360.relationships.total_children}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'maintenance' && data?.asset360 && (
            <AssetMaintenancePanel maintenance={data.asset360.maintenance} />
          )}
          {activeTab === 'documents' && data?.asset360 && (
            <AssetDocumentPanel documents={data.asset360.documents} />
          )}
          {activeTab === 'governance' && data?.asset360 && (
            <AssetGovernancePanel actions={data.asset360.governance_actions} />
          )}
          {activeTab === 'timeline' && data?.asset360 && (
            <OperationalTimeline events={data.asset360.operational_timeline} />
          )}
        </div>

      </div>
    </div>
  );
}
