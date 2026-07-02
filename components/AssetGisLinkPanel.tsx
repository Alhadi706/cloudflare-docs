'use client';
/**
 * AssetGisLinkPanel — Phase 7 (Asset-GIS Integration)
 * ════════════════════════════════════════════════════════════════
 * Shows and manages GIS ↔ ERP asset links within Asset 360.
 *
 * Displayed in the "الموقع والخريطة" tab of the asset detail page.
 * Allows linking this ERP asset to one or more principal GIS assets.
 *
 * API used:
 *  GET  /api/v1/workspace/asset-gis-links?erp_asset_id=X
 *  GET  /api/v1/workspace/principal-assets  (to list available GIS assets)
 *  POST /api/v1/workspace/asset-gis-links
 *  DELETE /api/v1/workspace/asset-gis-links/[id]
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link2, Unlink, Plus, Loader2, AlertTriangle, MapPin, ChevronDown } from 'lucide-react';

type LinkType = 'physical_location' | 'part_of' | 'serves' | 'overlaps';

interface GisLink {
  id: string;
  principal_asset_id: string;
  principal_asset_name: string;
  link_type: LinkType;
  notes?: string;
  created_at: string;
}

interface PrincipalAsset {
  id: string;
  name?: string;
  asset_name?: string;
  classification?: string | null;
}

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  physical_location: 'موجود في هذا الموقع',
  part_of:           'جزء من هذا المنشأ',
  serves:            'يخدم هذا المقطع',
  overlaps:          'ضمن هذه المنطقة',
};

const LINK_TYPE_COLORS: Record<LinkType, string> = {
  physical_location: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  part_of:           'bg-blue-500/20 text-blue-300 border-blue-500/30',
  serves:            'bg-amber-500/20 text-amber-300 border-amber-500/30',
  overlaps:          'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId   = localStorage.getItem('tenant_id') || '';
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  return {
    'Content-Type': 'application/json',
    ...(tenantId   ? { 'X-Tenant-ID': tenantId }     : {}),
    ...(tenantCode ? { 'x-tenant-code': tenantCode } : {}),
  };
}

export default function AssetGisLinkPanel({
  erpAssetId,
  erpAssetName,
}: {
  erpAssetId: string;
  erpAssetName?: string;
}) {
  const [links, setLinks]           = useState<GisLink[]>([]);
  const [gisAssets, setGisAssets]   = useState<PrincipalAsset[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [error, setError]           = useState('');

  // Form state
  const [selectedGisId, setSelectedGisId]   = useState('');
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>('physical_location');
  const [linkNotes, setLinkNotes]   = useState('');

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [linksRes, gisRes] = await Promise.all([
        fetch(`/api/v1/workspace/asset-gis-links?erp_asset_id=${encodeURIComponent(erpAssetId)}`, {
          headers: getTenantHeaders(),
        }),
        fetch('/api/v1/workspace/principal-assets', {
          headers: getTenantHeaders(),
        }),
      ]);
      if (linksRes.ok) {
        const d = await linksRes.json();
        setLinks(d.links || []);
      }
      if (gisRes.ok) {
        const g = await gisRes.json();
        setGisAssets(Array.isArray(g) ? g : []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [erpAssetId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const handleCreate = async () => {
    if (!selectedGisId) return;
    setSaving(true);
    setError('');
    try {
      const gisAsset = gisAssets.find(a => a.id === selectedGisId);
      const res = await fetch('/api/v1/workspace/asset-gis-links', {
        method: 'POST',
        headers: getTenantHeaders(),
        body: JSON.stringify({
          erp_asset_id: erpAssetId,
          erp_asset_name: erpAssetName || erpAssetId,
          principal_asset_id: selectedGisId,
          principal_asset_name: gisAsset?.name || gisAsset?.asset_name || selectedGisId,
          link_type: selectedLinkType,
          notes: linkNotes,
        }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || 'فشل الحفظ');
      setShowForm(false);
      setSelectedGisId('');
      setLinkNotes('');
      await loadLinks();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (linkId: string) => {
    setDeleting(linkId);
    try {
      const res = await fetch(`/api/v1/workspace/asset-gis-links/${linkId}`, {
        method: 'DELETE',
        headers: getTenantHeaders(),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      await loadLinks();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const linkedIds = new Set(links.map(l => l.principal_asset_id));
  const availableGisAssets = gisAssets.filter(a => !linkedIds.has(a.id));

  return (
    <div className="space-y-4" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-200">الربط الجغرافي (GIS ↔ ERP)</h3>
          {links.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {links.length} ربط
            </span>
          )}
        </div>
        {availableGisAssets.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            ربط بأصل هندسي
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-900/20 border border-rose-500/30 text-xs text-rose-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Add Link Form */}
      {showForm && (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-4 space-y-3">
          <p className="text-xs font-semibold text-cyan-200">ربط هذا الأصل بأصل هندسي جغرافي</p>

          {/* GIS asset selector */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">الأصل الهندسي (من GIS Workspace)</label>
            <div className="relative">
              <select
                value={selectedGisId}
                onChange={e => setSelectedGisId(e.target.value)}
                className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-cyan-500"
              >
                <option value="">— اختر الأصل الهندسي —</option>
                {availableGisAssets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.asset_name || a.id}
                    {a.classification ? ` (${a.classification})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Link type */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">نوع الربط</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(LINK_TYPE_LABELS) as [LinkType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setSelectedLinkType(type)}
                  className={`text-left px-3 py-2 rounded-lg border text-[11px] transition-all ${
                    selectedLinkType === type
                      ? LINK_TYPE_COLORS[type]
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">ملاحظات (اختياري)</label>
            <input
              value={linkNotes}
              onChange={e => setLinkNotes(e.target.value)}
              placeholder="مثال: هذه المضخة موجودة عند km 47 من خط النهر"
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!selectedGisId || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              {saving ? 'جاري الحفظ...' : 'حفظ الربط'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs hover:bg-slate-800 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Links list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center">
          <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">لا يوجد ربط جغرافي بعد</p>
          <p className="text-[11px] text-slate-600 mt-1">
            اضغط "ربط بأصل هندسي" لتحديد موقع هذا الأصل على الخريطة
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map(link => (
            <div
              key={link.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/50 p-3"
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{link.principal_asset_name}</p>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border mt-0.5 ${LINK_TYPE_COLORS[link.link_type]}`}>
                    {LINK_TYPE_LABELS[link.link_type]}
                  </span>
                  {link.notes && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{link.notes}</p>
                  )}
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {new Date(link.created_at).toLocaleDateString('ar-LY')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(link.id)}
                disabled={deleting === link.id}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 transition-colors shrink-0"
                title="حذف الربط"
              >
                {deleting === link.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Unlink className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {gisAssets.length === 0 && !loading && (
        <p className="text-[11px] text-slate-600 text-center">
          لا توجد أصول هندسية في GIS Workspace بعد —{' '}
          <a href="/dashboard/gis-sovereignty/engineering-workspace" className="text-cyan-500 hover:underline">
            أضف أصولاً هندسية أولاً
          </a>
        </p>
      )}
    </div>
  );
}
