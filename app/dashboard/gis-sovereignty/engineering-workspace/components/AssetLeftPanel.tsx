'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Hexagon, Route, ChevronDown, ChevronRight, Plus,
  RefreshCw, Loader2, MapPin, Building2, AlertCircle,
  Layers, Trash2,
} from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';
import { useToast } from '@/components/ToastProvider';
import { resolveTenantContext, tenantHeaders } from '@/lib/gis/tenantContext';
import { workspaceApi } from '@/store/apiService';

export type PrincipalAsset = {
  id: string; name: string; geometry_type: 'polygon' | 'path' | string;
  classification: string | null; owner_department: string | null;
  status: string | null; geometry: any; geometry_json?: any; coordinates?: any;
  lon?: number | string | null; lat?: number | string | null;
  created_at: string | null; tenant_id: string | null;
};
export type ChildAsset = {
  id: string; name: string; asset_type: string; owner_department: string;
  status: string; geometry: any; created_at: string | null;
};

const DEPT_LABELS: Record<string, string> = {
  services:'الخدمات', electricity:'الكهرباء', maintenance:'الصيانة',
  communications:'الاتصالات', hr:'الموارد البشرية', engineering:'الهندسة',
  technical:'التقني', facilities:'المرافق',
};

function deptLabel(key: string | null): string {
  if (!key) return 'غير محدد';
  return DEPT_LABELS[key.toLowerCase()] ?? key;
}
function geomIcon(type: string) {
  if (type === 'path' || type === 'line' || type === 'linestring')
    return <Route className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  return <Hexagon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
}

function normalizeGeometry(input: any): any | null {
  if (!input) return null;
  if (typeof input === 'string') {
    try {
      return normalizeGeometry(JSON.parse(input));
    } catch {
      return null;
    }
  }
  if (input?.type === 'Feature' && input?.geometry) return normalizeGeometry(input.geometry);
  if (typeof input?.type === 'string' && Array.isArray(input?.coordinates)) return input;
  if (input?.geometry) return normalizeGeometry(input.geometry);

  const lon = Number(input?.lon ?? input?.longitude);
  const lat = Number(input?.lat ?? input?.latitude);
  if (Number.isFinite(lon) && Number.isFinite(lat)) {
    return { type: 'Point', coordinates: [lon, lat] };
  }
  return null;
}

type Props = {
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  onCreatePrincipal: () => void;
  refreshKey?: number;
  mode?: 'engineering' | 'general';
};

export default function AssetLeftPanel({ selectedAssetId, onSelectAsset, onCreatePrincipal, refreshKey = 0, mode = 'engineering' }: Props) {
  const selectEntity = useGisEngine(s => s.selectEntity);
  const { showToast } = useToast();
  const isEngineeringMode = mode === 'engineering';
  const [assets, setAssets]                   = useState<PrincipalAsset[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [expanded, setExpanded]               = useState<Record<string, boolean>>({});
  const [children, setChildren]               = useState<Record<string, ChildAsset[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete]     = useState<string | null>(null);
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [selectionMode, setSelectionMode]     = useState(false);
  const [selectedIds, setSelectedIds]         = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting]       = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const deleteAssetRecord = async (assetId: string) => {
    try {
      await workspaceApi.deleteAsset(assetId);
      return;
    } catch {
      const tenant = resolveTenantContext();
      const res = await fetch(`/api/engineering/workspace/principal-assets/${assetId}`, {
        method: 'DELETE',
        headers: tenantHeaders(tenant),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.detail || `خطأ ${res.status}`);
      }
    }
  };

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const tenant = resolveTenantContext();
      const res = await fetch('/api/engineering/workspace/principal-assets', {
        headers: tenantHeaders(tenant),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: PrincipalAsset[] = await res.json();
      setAssets(data);
    } catch (e: any) { showToast(`فشل تحميل الأصول: ${e.message}`, 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadAssets(); }, [loadAssets, refreshKey]);

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => assets.some(asset => asset.id === id)));
  }, [assets]);

  const loadChildren = async (assetId: string) => {
    if (children[assetId]) return;
    setLoadingChildren(p => ({ ...p, [assetId]: true }));
    try {
      const tenant = resolveTenantContext();
      const res = await fetch(`/api/engineering/workspace/principal-assets/${assetId}/children`, {
        headers: tenantHeaders(tenant),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: ChildAsset[] = await res.json();
      setChildren(p => ({ ...p, [assetId]: data }));
    } catch { setChildren(p => ({ ...p, [assetId]: [] })); }
    finally { setLoadingChildren(p => ({ ...p, [assetId]: false })); }
  };

  const toggleExpand = (id: string) => {
    const next = !expanded[id];
    setExpanded(p => ({ ...p, [id]: next }));
    if (next) loadChildren(id);
  };

  const handleDeleteAsset = async (assetId: string) => {
    setDeletingId(assetId);
    try {
      await deleteAssetRecord(assetId);
      setAssets(prev => prev.filter(a => a.id !== assetId));
      setConfirmDelete(null);
      window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
      showToast('تم حذف الأصل بنجاح', 'success');
      if (selectedAssetId === assetId) onSelectAsset(null);
    } catch (e: any) { showToast(`فشل الحذف: ${e.message}`, 'error'); }
    finally { setDeletingId(null); }
  };

  const toggleSelection = (assetId: string) => {
    setSelectedIds(prev => prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]);
  };

  const handleSelectAll = () => {
    setSelectedIds(assets.map(asset => asset.id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      let deletedCount = 0;
      try {
        const tenant = resolveTenantContext();
        const res = await fetch('/api/engineering/workspace/principal-assets/bulk-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...tenantHeaders(tenant),
          },
          body: JSON.stringify({ asset_ids: selectedIds }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.detail || `${res.status}`);
        deletedCount = selectedIds.length;
      } catch {
        await Promise.allSettled(selectedIds.map((id) => deleteAssetRecord(id).then(() => { deletedCount += 1; })));
      }
      setAssets(prev => prev.filter(asset => !selectedIds.includes(asset.id)));
      if (selectedAssetId && selectedIds.includes(selectedAssetId)) onSelectAsset(null);
      setSelectedIds([]);
      setConfirmBulkDelete(false);
      setSelectionMode(false);
      window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
      showToast(`تم حذف ${deletedCount || selectedIds.length} أصل`, 'success');
    } catch (e: any) {
      showToast(`فشل الحذف الجماعي: ${e.message}`, 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSelectAsset = async (asset: PrincipalAsset) => {
    onSelectAsset(asset.id);
    selectEntity('asset', asset.id);

    const localGeometry =
      normalizeGeometry(asset.geometry) ??
      normalizeGeometry(asset.geometry_json) ??
      normalizeGeometry(asset.coordinates) ??
      normalizeGeometry({ lon: asset.lon, lat: asset.lat });

    if (localGeometry) {
      window.dispatchEvent(new CustomEvent('engineering:preview-geojson', {
        detail: { featureCollection: { type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: localGeometry, properties: { name: asset.name } }] } },
      }));
      window.dispatchEvent(new CustomEvent('engineering:zoom-to-asset', {
        detail: { geometry: localGeometry },
      }));
      return;
    }

    try {
      const center = await workspaceApi.getAssetCenter(asset.id);
      const fetchedGeometry =
        normalizeGeometry(center?.asset?.geometry) ??
        normalizeGeometry(center?.asset?.geometry_json) ??
        normalizeGeometry(center?.geometry) ??
        normalizeGeometry(center?.coordinates);

      if (fetchedGeometry) {
        window.dispatchEvent(new CustomEvent('engineering:preview-geojson', {
          detail: { featureCollection: { type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: fetchedGeometry, properties: { name: asset.name } }] } },
        }));
        window.dispatchEvent(new CustomEvent('engineering:zoom-to-asset', {
          detail: { geometry: fetchedGeometry },
        }));
        return;
      }
    } catch {
      // Keep UX responsive; the panel can still open even if center API fails.
    }

    showToast('تعذر قراءة هندسة الأصل أو تحديد موقعه على الخريطة', 'warning');
  };

  const childrenByDept = (list: ChildAsset[]) => {
    const map: Record<string, ChildAsset[]> = {};
    for (const c of list) {
      const d = c.owner_department || 'unknown';
      if (!map[d]) map[d] = [];
      map[d].push(c);
    }
    return map;
  };

  return (
    <aside className="w-64 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col overflow-hidden" dir="rtl">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-gray-200">الأصول المكانية</span>
          {!loading && <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">{assets.length}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={loadAssets} disabled={loading} title="تحديث"
            className="p-1 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isEngineeringMode && (
            <>
              <button
                onClick={() => {
                  setSelectionMode(prev => !prev);
                  setSelectedIds([]);
                  setConfirmBulkDelete(false);
                }}
                title="تحديد متعدد"
                className={`p-1 rounded transition ${selectionMode ? 'text-red-300 bg-red-900/30' : 'text-gray-500 hover:text-red-300 hover:bg-red-900/20'}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onCreatePrincipal} title="إنشاء أصل رئيسي جديد"
                className="p-1 rounded text-gray-500 hover:text-cyan-300 hover:bg-cyan-900/30 transition">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {isEngineeringMode && selectionMode && (
        <div className="mx-3 mt-2 rounded-lg border border-red-900/40 bg-red-950/20 p-2 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-red-200">
            <span>تم تحديد {selectedIds.length} من {assets.length}</span>
            <button
              onClick={() => {
                setSelectionMode(false);
                setSelectedIds([]);
                setConfirmBulkDelete(false);
              }}
              className="text-gray-400 hover:text-white"
            >
              إلغاء
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSelectAll}
              disabled={assets.length === 0}
              className="flex-1 rounded bg-gray-800 px-2 py-1 text-[11px] text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            >
              تحديد الكل
            </button>
            <button
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="flex-1 rounded bg-gray-800 px-2 py-1 text-[11px] text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            >
              تصفير
            </button>
          </div>
          {!confirmBulkDelete ? (
            <button
              onClick={() => setConfirmBulkDelete(true)}
              disabled={selectedIds.length === 0}
              className="w-full rounded bg-red-600/80 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-40"
            >
              مسح المحدد
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[11px] text-red-200">سيتم حذف {selectedIds.length} أصل مع أصوله التابعة. هل تؤكد؟</div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex-1 rounded bg-red-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkDeleting ? 'جاري الحذف...' : 'تأكيد المسح'}
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  disabled={bulkDeleting}
                  className="flex-1 rounded bg-gray-700 px-2 py-1.5 text-[11px] text-gray-200 hover:bg-gray-600 disabled:opacity-50"
                >
                  رجوع
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isEngineeringMode && (
        <button onClick={onCreatePrincipal}
          className="mx-3 my-2 px-3 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-700/40 text-cyan-300 text-xs font-semibold flex items-center gap-2 transition">
          <Plus className="w-3.5 h-3.5" />
          إنشاء أصل رئيسي
        </button>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-xs">جاري التحميل...</span>
          </div>
        )}
        {!loading && assets.length === 0 && (
          <div className="text-center py-8 px-4">
            <AlertCircle className="w-6 h-6 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-600">لا توجد أصول رئيسية بعد</p>
            <p className="text-[11px] text-gray-700 mt-1">ارسم مضلعاً أو مساراً على الخريطة لإنشاء أصل</p>
          </div>
        )}
        {!loading && assets.map(asset => {
          const isSelected = selectedAssetId === asset.id;
          const isMarked   = selectedIds.includes(asset.id);
          const isExpanded = expanded[asset.id];
          const childList  = children[asset.id] ?? [];
          const isLoadingC = loadingChildren[asset.id];
          const byDept     = childrenByDept(childList);
          return (
            <div key={asset.id} className="border-b border-gray-800/60">
              <div
                className={`flex items-center gap-1.5 px-2 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-cyan-900/30 border-r-2 border-cyan-500' : 'hover:bg-gray-800/40'}`}
                onClick={() => selectionMode ? toggleSelection(asset.id) : handleSelectAsset(asset)}
              >
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={isMarked}
                    onChange={() => toggleSelection(asset.id)}
                    onClick={e => e.stopPropagation()}
                    className="h-3.5 w-3.5 accent-red-500"
                  />
                )}
                <button onClick={e => { e.stopPropagation(); toggleExpand(asset.id); }}
                  className="text-gray-600 hover:text-gray-300 p-0.5 shrink-0">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {geomIcon(asset.geometry_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-200 truncate">{asset.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {asset.classification && <span>{asset.classification} · </span>}
                    {deptLabel(asset.owner_department)}
                  </p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${asset.status === 'active' || asset.status === 'نشط' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                  {asset.status ?? 'نشط'}
                </span>
                <a
                  href={`/dashboard/asset-360/${asset.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="أصل 360°"
                  onClick={e => e.stopPropagation()}
                  className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-700/40 text-cyan-400 hover:bg-cyan-900/60 hover:border-cyan-500/60 transition-colors"
                >
                  360°
                </a>
                {isEngineeringMode && !selectionMode && (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(confirmDelete === asset.id ? null : asset.id); }}
                    title="حذف الأصل"
                    className="p-0.5 rounded text-gray-700 hover:text-red-400 transition shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {isEngineeringMode && confirmDelete === asset.id && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 border-t border-red-900/40">
                  <span className="text-[11px] text-red-300 flex-1">حذف الأصل نهائياً؟</span>
                  <button onClick={e => { e.stopPropagation(); handleDeleteAsset(asset.id); }}
                    disabled={deletingId === asset.id}
                    className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded transition disabled:opacity-50">
                    {deletingId === asset.id ? '...' : 'نعم'}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                    className="text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-0.5 rounded transition">
                    لا
                  </button>
                </div>
              )}

              {isExpanded && (
                <div className="pr-7 pb-1">
                  {isLoadingC && (
                    <div className="text-[10px] text-gray-600 py-2 text-center flex items-center justify-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> تحميل...
                    </div>
                  )}
                  {!isLoadingC && childList.length === 0 && (
                    <p className="text-[10px] text-gray-700 py-1.5 text-center">لا توجد أصول بنت بعد</p>
                  )}
                  {!isLoadingC && Object.entries(byDept).map(([dept, items]) => (
                    <div key={dept} className="mb-1">
                      <div className="text-[10px] text-gray-500 font-semibold px-2 py-0.5 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {deptLabel(dept)}
                      </div>
                      {items.map(child => (
                        <div key={child.id}
                          className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-800/40 cursor-pointer rounded text-[11px] text-gray-300"
                          onClick={() => selectEntity('asset', child.id)}>
                          <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate">{child.name}</span>
                          <span className="text-gray-600 text-[9px] ml-auto shrink-0">{child.asset_type}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
