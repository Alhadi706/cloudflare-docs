'use client';
/**
 * SICLayerEditorPanel
 * ══════════════════════════════════════════════════════════════════
 * Full-screen overlay panel that brings the Engineering Workspace
 * layer-editing tools INTO the Satellite Intelligence Center.
 *
 * Tools included (SCADA excluded per spec):
 *   • Drawing: select / polygon / line / point / delete
 *   • File upload: GeoJSON, KML, SHP, Excel, DXF…
 *   • Map digitization: TIF / PDF → layers
 *   • Layer decomposition (tafkik): by polygon or municipality
 *   • Layer tree: show/hide, rename, color, delete, hierarchy
 *   • Feature properties drawer
 *
 * Implemented by mounting the existing Engineering Workspace
 * components (AssetTopBar, AssetLeftPanel, MapCenterCanvas,
 * AssetCenterPanel, CreatePrincipalAssetModal, AddChildAssetModal)
 * with all extraction / upload event wiring — SCADA props omitted.
 */
import React, {
  useEffect, useMemo, useState, useCallback,
} from 'react';
import { X, Layers } from 'lucide-react';
import { GisErrorBoundary } from '@/app/dashboard/gis-sovereignty/components/GisErrorBoundary';
import { useGisEngine } from '@/store/gisEngine';
import { workspaceApi } from '@/store/apiService';
import { useUserStore } from '@/store/useUserStore';
import { getAssetCapabilities } from '@/lib/gis/assetGovernance';
import AssetTopBar from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/AssetTopBar';
import AssetLeftPanel, { type PrincipalAsset } from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/AssetLeftPanel';
import CreatePrincipalAssetModal from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/CreatePrincipalAssetModal';
import AddChildAssetModal from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/AddChildAssetModal';
import AssetCenterPanel from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/AssetCenterPanel';
import ExtractionCatalog from '@/components/ExtractionCatalog';
import MapCenterCanvas from '@/app/dashboard/gis-sovereignty/components/MapCenterCanvas';

// ── Constants ─────────────────────────────────────────────────────────────────
const getTenantId = () =>
  typeof window !== 'undefined'
    ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
    : '';

const getAuthToken = () =>
  typeof window !== 'undefined'
    ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '')
    : '';

const EXTRACTION_RUN_ENDPOINTS = [
  '/api/engineering/workspace/layer-extraction/run',
  '/api/v1/workspace/layer-extraction/run',
];
const EXTRACTION_SAVE_ENDPOINTS = [
  '/api/engineering/workspace/layer-extraction/save',
  '/api/v1/workspace/layer-extraction/save',
];

// ── Utility helpers (identical to engineering workspace page) ─────────────────
async function readApiPayload(res: Response): Promise<any> {
  const raw = await res.text();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { detail: raw }; }
}

function toApiErrorMessage(res: Response, payload: any, fallback = 'فشل تنفيذ الطلب'): string {
  const detail = payload?.detail || payload?.error || payload?.message;
  if (typeof detail === 'string' && detail.trim()) {
    if (detail.trim().startsWith('<')) return `${fallback}: الخادم أعاد HTML بدلاً من JSON (HTTP ${res.status})`;
    return `${fallback}: ${detail}`;
  }
  return `${fallback}: HTTP ${res.status}`;
}

async function postJsonWithFallback(endpoints: string[], body: any, headers: Record<string, string>, label: string, timeoutMs = 20_000): Promise<any> {
  // أضف Authorization header تلقائياً من auth_token
  const token = getAuthToken();
  const enrichedHeaders = { ...headers };
  if (token && !enrichedHeaders['Authorization']) {
    enrichedHeaders['Authorization'] = `Bearer ${token}`;
  }
  let lastErr: Error | null = null;
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { method: 'POST', headers: enrichedHeaders, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
      const pl = await readApiPayload(res);
      if (!res.ok) { lastErr = new Error(toApiErrorMessage(res, pl, label)); continue; }
      return pl;
    } catch (e) { lastErr = e instanceof Error ? e : new Error(String(e)); }
  }
  throw lastErr || new Error(label);
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxAttempts = 3, onProgress?: (m: string) => void): Promise<T> {
  let lastErr: Error | null = null;
  for (let i = 1; i <= maxAttempts; i++) {
    try { onProgress?.(`محاولة ${i} من ${maxAttempts}...`); return await fn(); }
    catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < maxAttempts) {
        const ms = Math.min(1000 * 2 ** (i - 1), 10000);
        onProgress?.(`فشلت المحاولة ${i}، إعادة في ${Math.round(ms / 1000)}ث...`);
        await new Promise(r => setTimeout(r, ms));
      }
    }
  }
  throw lastErr || new Error('فشلت جميع المحاولات');
}

function mergeLayerGeometry(fc: { features: any[] } | null | undefined): any | null {
  const geoms = (fc?.features || []).map((f: any) => f?.geometry).filter(Boolean);
  if (!geoms.length) return null;
  if (geoms.length === 1) return geoms[0];
  return { type: 'GeometryCollection', geometries: geoms };
}

function inferGeomType(geom: any): 'polygon' | 'path' {
  return String(geom?.type || '').toLowerCase().includes('polygon') ? 'polygon' : 'path';
}

function isRiverFeature(f: any): boolean {
  const t = Object.values(f?.properties || {}).map(v => String(v ?? '').toLowerCase()).join(' ');
  const explicitRiver = /(gmmr|great man[- ]made river|nahr|river route|النهر الصناعي|النهر)/i.test(t);
  const hasWadi = /(wadi|وادي|stream|waterway)/i.test(t);
  const hasRoute = /(route|path|line|pipeline|مسار|خط)/i.test(t);
  if (explicitRiver) return true;
  if (hasWadi) return false;
  return hasRoute && /(nahr|river|النهر)/i.test(t);
}

type ExtractedLayer = {
  layer_key: string; layer_name: string; color: string;
  feature_count: number; virtual?: boolean;
  stats?: {
    total?: number;
    total_km?: number;
    poles_towers?: number;
    tower_count?: number;
    building_polygons?: number;
    by_type?: Record<string, number>;
    [k: string]: any;
  };
  geojson: { type: 'FeatureCollection'; features: any[] };
};

function layerStatsLabel(layer: ExtractedLayer): string {
  const s = layer.stats;
  if (!s) return `${layer.feature_count} معلم`;
  const parts: string[] = [];
  if (s.total_km !== undefined && s.total_km > 0)
    parts.push(`${s.total_km} كم`);
  if (s.poles_towers !== undefined)
    parts.push(`${s.poles_towers} عمود/برج`);
  if (s.tower_count !== undefined)
    parts.push(`${s.tower_count} برج`);
  if (s.building_polygons !== undefined)
    parts.push(`${s.building_polygons} مبنى`);
  parts.unshift(`${layer.feature_count} معلم`);
  return parts.join(' · ');
}

function enrichLayers(layers: ExtractedLayer[]): ExtractedLayer[] {
  if (!layers.length) return layers;
  const real = layers.filter(l => l.layer_key !== '__virtual_river_route__');
  if (real.some(l => !l.virtual && /(river|nahr|النهر)/i.test(l.layer_key + l.layer_name))) return real;
  const riverFeats = real.filter(l => !l.virtual).flatMap(l =>
    (l.geojson?.features || []).filter(isRiverFeature).map((f: any) => ({
      ...f, properties: { ...(f.properties || {}), __derived_from_extraction: true },
    }))
  );
  if (!riverFeats.length) return real;
  return [...real, {
    layer_key: '__virtual_river_route__', layer_name: 'طريق النهر الصناعي ومنشآته',
    color: '#22d3ee', feature_count: riverFeats.length, virtual: true,
    geojson: { type: 'FeatureCollection', features: riverFeats },
  }];
}

function normalizeGeometry(input: any): any | null {
  if (!input) return null;
  if (typeof input === 'string') { try { return normalizeGeometry(JSON.parse(input)); } catch { return null; } }
  if (input?.type === 'Feature') return normalizeGeometry(input.geometry);
  if (typeof input?.type === 'string' && Array.isArray(input?.coordinates)) return input;
  const lon = Number(input?.lon ?? input?.longitude), lat = Number(input?.lat ?? input?.latitude);
  if (isFinite(lon) && isFinite(lat)) return { type: 'Point', coordinates: [lon, lat] };
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  /** When true, renders inline (no fixed overlay, no header bar, no inner toolbar) */
  embedded?: boolean;
}

export default function SICLayerEditorPanel({ onClose, embedded = false }: Props) {
  const setWorkspace   = useGisEngine(s => s.setWorkspace);
  const selectEntity   = useGisEngine(s => s.selectEntity);
  const setDrawingMode = useGisEngine(s => s.setDrawingMode);
  const selectedEntityType = useGisEngine(s => s.selectedEntityType);
  const selectedEntityId   = useGisEngine(s => s.selectedEntityId);

  const currentUser = useUserStore(s => s.current);
  const storedDept  = typeof window !== 'undefined' ? localStorage.getItem('user_department') : null;
  const caps        = getAssetCapabilities(currentUser, storedDept);
  const panelMode   = caps.canCreateMainAsset ? 'engineering' : 'general';

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingGeometry, setPendingGeometry] = useState<any>(null);
  const [pendingGeometryType, setPendingGeometryType] = useState<'polygon' | 'path' | null>(null);
  const [pendingDefaults, setPendingDefaults] = useState<any>(null);
  const [uploadedFeatures, setUploadedFeatures] = useState<any[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadIndex, setUploadIndex] = useState(0);
  const [showChildModal, setShowChildModal] = useState(false);
  const [principalAssets, setPrincipalAssets] = useState<PrincipalAsset[]>([]);
  const [redrawTarget, setRedrawTarget] = useState<{ assetId: string; geometryType: string | null } | null>(null);
  const [extractBusy, setExtractBusy] = useState(false);
  const [extractMode, setExtractMode] = useState<'idle' | 'polygon'>('idle');
  const [extractPanelOpen, setExtractPanelOpen] = useState(false);
  const [extractJobId, setExtractJobId] = useState<string | null>(null);
  const [extractedLayers, setExtractedLayers] = useState<ExtractedLayer[]>([]);
  const [selectedLayerKeys, setSelectedLayerKeys] = useState<string[]>([]);
  const [extractScopeLabel, setExtractScopeLabel] = useState('');
  const [extractSaveName, setExtractSaveName] = useState('');
  const [savingExtracted, setSavingExtracted] = useState(false);
  const [extractProgress, setExtractProgress] = useState('');
  const [extractGeometry, setExtractGeometry] = useState<any>(null);
  const [extractionTab, setExtractionTab] = useState<'results' | 'catalog'>('results');
  const [leftPanelRefreshKey, setLeftPanelRefreshKey] = useState(0);
  const municipalityCache = React.useRef<Record<string, any>>({});

  // Set workspace to engineering on mount, restore satellite on close
  useEffect(() => {
    setWorkspace('engineering');
    return () => { setWorkspace('satellite'); };
  }, [setWorkspace]);

  // Sync selected asset
  useEffect(() => {
    if (selectedEntityType === 'asset' && selectedEntityId) setSelectedAssetId(String(selectedEntityId));
    else if (!selectedEntityType) setSelectedAssetId(null);
  }, [selectedEntityType, selectedEntityId]);

  // Zoom to selected asset
  useEffect(() => {
    if (selectedEntityType !== 'asset' || !selectedEntityId) return;
    let cancelled = false;
    (async () => {
      try {
        const center = await workspaceApi.getAssetCenter(String(selectedEntityId));
        if (cancelled) return;
        const geom = normalizeGeometry(center?.asset?.geometry) ?? normalizeGeometry(center?.geometry);
        if (!geom) return;
        window.dispatchEvent(new CustomEvent('engineering:zoom-to-asset', { detail: { geometry: geom } }));
      } catch { /* non-blocking */ }
    })();
    return () => { cancelled = true; };
  }, [selectedEntityType, selectedEntityId]);

  const loadPrincipalAssets = useCallback(async () => {
    try {
      const token = getAuthToken();
      const hdrs: Record<string,string> = { 'X-Tenant-ID': getTenantId() };
      if (token) hdrs['Authorization'] = `Bearer ${token}`;
      const r = await fetch('/api/engineering/workspace/principal-assets', { headers: hdrs });
      if (r.ok) { const rows = await r.json(); setPrincipalAssets(Array.isArray(rows) ? rows : []); }
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    if (showChildModal || (extractPanelOpen && extractionTab === 'catalog')) loadPrincipalAssets();
  }, [showChildModal, extractPanelOpen, extractionTab, loadPrincipalAssets]);

  const resolveMunicipality = async (key: string): Promise<{ label: string; geometry: any } | null> => {
    if (municipalityCache.current[key]) return { label: key, geometry: municipalityCache.current[key] };
    const _aToken = getAuthToken();
    const _aHdrs: Record<string,string> = { 'X-Tenant-ID': getTenantId() };
    if (_aToken) _aHdrs['Authorization'] = `Bearer ${_aToken}`;
    const res = await fetch(`/api/geo/admin-boundary?key=${encodeURIComponent(key)}`, { headers: _aHdrs });
    const data = await readApiPayload(res);
    if (!res.ok || !data?.geometry) return null;
    municipalityCache.current[key] = data.geometry;
    return { label: data?.name || key, geometry: data.geometry };
  };

  const saveExtractionToCatalog = useCallback(async (layers: ExtractedLayer[], opts?: { jobId?: string | null; scopeLabel?: string; geometry?: any }) => {
    if (!layers.length) return;
    const TENANT_ID = getTenantId();
    await fetch('/api/extraction-catalog/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
      body: JSON.stringify({
        jobId: opts?.jobId ?? extractJobId,
        regionKey: (opts?.scopeLabel || extractScopeLabel).toLowerCase().replace(/\s+/g, '_'),
        scopeLabel: opts?.scopeLabel ?? extractScopeLabel,
        geometry: opts?.geometry ?? extractGeometry,
        layerData: layers.map(l => ({ layer_key: l.layer_key, layer_name: l.layer_name, feature_count: l.feature_count, color: l.color, stats: l.stats, geojson: l.geojson, virtual: Boolean(l.virtual) })),
        backendJobId: opts?.jobId ?? extractJobId,
        createdBy: currentUser?.email || 'system',
      }),
    });
  }, [currentUser?.email, extractGeometry, extractJobId, extractSaveName, extractScopeLabel]);

  const applyExtractionResult = (data: any, scopeOverride?: string, geom?: any) => {
    const layers = enrichLayers(Array.isArray(data?.layers) ? data.layers : []);
    setExtractJobId(data?.job_id || null);
    setExtractedLayers(layers);
    setSelectedLayerKeys(layers.filter(l => l.feature_count > 0).map(l => l.layer_key));
    setExtractScopeLabel(scopeOverride || data?.scope_label || 'نطاق مخصص');
    setExtractSaveName(scopeOverride || data?.scope_label || 'نطاق مخصص');
    setExtractGeometry(geom || null);
    setExtractionTab('results');
    setExtractPanelOpen(true);
  };

  const runLayerExtraction = async (payload: { scope_type: 'polygon' | 'municipality'; geometry?: any; municipality?: string }, opts?: { scopeLabel?: string }) => {
    const TENANT_ID = getTenantId();
    setExtractBusy(true);
    setExtractProgress('جاري تحضير التفكيك...');
    try {
      const data = await retryWithBackoff(
        () => postJsonWithFallback(EXTRACTION_RUN_ENDPOINTS, payload, { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID }, 'فشل التفكيك', 180_000),
        3, (m) => setExtractProgress(m)
      );
      const scopeLabel = opts?.scopeLabel || data?.scope_label || 'نطاق مخصص';
      const enriched = enrichLayers(Array.isArray(data?.layers) ? data.layers : []);
      setExtractProgress('جاري حفظ نتيجة التفكيك...');
      await saveExtractionToCatalog(enriched, { jobId: data?.job_id, scopeLabel, geometry: payload.geometry }).catch(() => {});
      applyExtractionResult({ ...data, layers: enriched }, scopeLabel, payload.geometry);
    } catch (err) {
      alert(`فشل التفكيك: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    } finally {
      setExtractBusy(false);
      setExtractMode('idle');
      setDrawingMode('idle');
      setExtractProgress('');
    }
  };

  const saveLayersAsPrincipal = useCallback(async (layers: ExtractedLayer[], opts?: { jobId?: string | null; scopeLabel?: string; geometry?: any }) => {
    const TENANT_ID = getTenantId();
    if (!layers.length) { alert('اختر طبقة على الأقل'); return; }
    setSavingExtracted(true);
    const scopeLabel = opts?.scopeLabel ?? (extractSaveName.trim() || extractScopeLabel);
    const effectiveJobId = opts?.jobId ?? extractJobId;
    try {
      const backendKeys = layers.map(l => l.layer_key).filter(k => !k.startsWith('__virtual_'));
      let failed = false;
      if (effectiveJobId && backendKeys.length) {
        try {
          await postJsonWithFallback(EXTRACTION_SAVE_ENDPOINTS, { job_id: effectiveJobId, layer_keys: backendKeys, name_prefix: scopeLabel }, { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID }, 'فشل الحفظ');
        } catch { failed = true; }
      } else { failed = true; }
      if (failed) {
        const authToken = getAuthToken();
        const fallbackHeaders: Record<string,string> = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID };
        if (authToken) fallbackHeaders['Authorization'] = `Bearer ${authToken}`;
        await Promise.allSettled(layers.map(async (l) => {
          const geom = mergeLayerGeometry(l.geojson);
          if (!geom) return;
          await fetch('/api/engineering/workspace/principal-assets', {
            method: 'POST',
            headers: fallbackHeaders,
            body: JSON.stringify({ name: `${scopeLabel} — ${l.layer_name}`, geometry_type: inferGeomType(geom), classification: l.layer_key, owner_department: 'engineering', status: 'active', geometry: geom, properties: { source: 'layer_extraction_fallback', virtual: Boolean(l.virtual) }, tenant_id: TENANT_ID }),
          });
        }));
      }
      await saveExtractionToCatalog(layers, { jobId: effectiveJobId, scopeLabel, geometry: opts?.geometry ?? extractGeometry }).catch(() => {});
      setExtractPanelOpen(false);
      setExtractedLayers([]);
      setSelectedLayerKeys([]);
      setExtractJobId(null);
      setExtractGeometry(null);
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
      setLeftPanelRefreshKey(k => k + 1);
      alert('تم حفظ الطبقات بنجاح');
    } catch (e) { alert(`فشل الحفظ: ${e instanceof Error ? e.message : 'خطأ'}`); }
    finally { setSavingExtracted(false); }
  }, [extractGeometry, extractJobId, extractSaveName, extractScopeLabel, saveExtractionToCatalog]);

  const previewFeatureCollection = useMemo(() => {
    const sel = new Set(selectedLayerKeys);
    return {
      type: 'FeatureCollection',
      features: extractedLayers.filter(l => sel.has(l.layer_key)).flatMap(l =>
        (l.geojson?.features || []).map((f: any) => ({ ...f, properties: { ...(f.properties || {}), __layer_key: l.layer_key, __layer_name: l.layer_name, __layer_color: l.color } }))
      ),
    } as { type: 'FeatureCollection'; features: any[] };
  }, [extractedLayers, selectedLayerKeys]);

  useEffect(() => {
    if (!extractPanelOpen) return;
    window.dispatchEvent(new CustomEvent('engineering:preview-geojson', { detail: { featureCollection: previewFeatureCollection } }));
  }, [extractPanelOpen, previewFeatureCollection]);

  // Drawing complete event
  useEffect(() => {
    const handler = async (e: Event) => {
      if (showChildModal || (window as any).__childGeometryPicking) return;
      const { geometry, mode } = (e as CustomEvent<{ geometry: any; mode: string }>).detail ?? {};
      if (!geometry) return;
      if (extractMode === 'polygon') { await runLayerExtraction({ scope_type: 'polygon', geometry }); return; }
      if (redrawTarget?.assetId) {
        try {
          const _pToken = getAuthToken();
          const _pHdrs: Record<string,string> = { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() };
          if (_pToken) _pHdrs['Authorization'] = `Bearer ${_pToken}`;
          const res = await fetch(`/api/engineering/workspace/principal-assets/${redrawTarget.assetId}`, { method: 'PATCH', headers: _pHdrs, body: JSON.stringify({ geometry }) });
          if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
          window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
          window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
          setLeftPanelRefreshKey(k => k + 1);
        } finally { setRedrawTarget(null); setDrawingMode('idle'); }
        return;
      }
      setPendingGeometry(geometry);
      setPendingGeometryType(mode === 'polygon' || mode === 'orthogonal-polygon' ? 'polygon' : 'path');
      setShowCreateModal(true);
    };
    window.addEventListener('engineering:feature-drawn', handler as EventListener);
    return () => window.removeEventListener('engineering:feature-drawn', handler as EventListener);
  }, [extractMode, redrawTarget, setDrawingMode, showChildModal]);

  // Uploaded file features
  useEffect(() => {
    const handler = (e: Event) => {
      const { features, fileName } = (e as CustomEvent<any>).detail ?? {};
      if (!features?.length) return;
      setUploadedFeatures(features);
      setUploadedFileName(fileName);
      setUploadIndex(0);
      const f0 = features[0];
      setPendingGeometry(f0?.geometry || null);
      setPendingGeometryType(inferGeomType(f0?.geometry));
      const p = f0?.properties || {};
      setPendingDefaults({ name: p.asset_name, classification: p.asset_type, ownerDept: p.owner_department, status: p.status });
      setShowCreateModal(true);
    };
    window.addEventListener('engineering:process-uploaded-features', handler as EventListener);
    return () => window.removeEventListener('engineering:process-uploaded-features', handler as EventListener);
  }, []);

  // Redraw asset geometry
  useEffect(() => {
    const handler = (e: Event) => {
      const { assetId, geometryType } = (e as CustomEvent<any>).detail ?? {};
      if (!assetId) return;
      setRedrawTarget({ assetId, geometryType });
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      const gt = (geometryType || '').toLowerCase();
      setDrawingMode(gt.includes('line') || gt === 'path' ? 'line' : 'polygon');
    };
    window.addEventListener('engineering:redraw-asset', handler as EventListener);
    return () => window.removeEventListener('engineering:redraw-asset', handler as EventListener);
  }, [setDrawingMode]);

  const handleSelectAsset = (id: string | null) => {
    setSelectedAssetId(id);
    if (id) selectEntity('asset', id); else selectEntity(null, null);
  };

  const handleCreateSaved = (asset: { id: string; name: string }) => {
    const next = uploadIndex + 1;
    if (uploadedFeatures.length > 0 && next < uploadedFeatures.length) {
      const f = uploadedFeatures[next];
      setUploadIndex(next);
      setPendingGeometry(f?.geometry || null);
      setPendingGeometryType(inferGeomType(f?.geometry));
      const p = f?.properties || {};
      setPendingDefaults({ name: p.asset_name, classification: p.asset_type, ownerDept: p.owner_department, status: p.status });
      setShowCreateModal(true);
    } else {
      setShowCreateModal(false);
      setPendingGeometry(null); setPendingGeometryType(null); setPendingDefaults(null);
      setUploadedFeatures([]); setUploadedFileName(''); setUploadIndex(0);
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      setLeftPanelRefreshKey(k => k + 1);
      window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={embedded
        ? 'flex flex-col flex-1 overflow-hidden bg-slate-950 text-slate-200'
        : 'fixed inset-0 z-[9000] flex flex-col bg-slate-950 text-slate-200'}
      dir="rtl"
    >
      <GisErrorBoundary title="تعذر تحميل محرر الطبقات">

        {/* Header bar — hidden in embedded mode (ribbon takes over) */}
        {!embedded && (
          <div className="h-10 shrink-0 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center gap-3">
            <Layers size={14} className="text-cyan-400" />
            <span className="text-[12px] font-bold text-cyan-300 tracking-wide flex-1">
              محرر طبقات الخدمات — مركز الاستخبارات الفضائية
            </span>
            {extractProgress && (
              <span className="text-[10px] text-amber-300 bg-amber-950/40 border border-amber-700/40 rounded px-2 py-0.5">
                {extractProgress}
              </span>
            )}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors"
            >
              <X size={13} />
              إغلاق المحرر
            </button>
          </div>
        )}

        {/* Toolbar (AssetTopBar WITHOUT scada props) — hidden in embedded mode (ribbon handles it) */}
        {!embedded && (
        <AssetTopBar
          onAddChildAsset={() => setShowChildModal(true)}
          extractionBusy={extractBusy}
          onStartLayerExtractionPolygon={() => {
            setExtractMode('polygon');
            setDrawingMode('polygon');
            window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
          }}
          onRunMunicipalityExtraction={async (municipalityKey) => {
            const resolved = await resolveMunicipality(municipalityKey);
            if (!resolved?.geometry) { alert('تعذر تحميل الحدود الإدارية'); return; }
            await runLayerExtraction({ scope_type: 'polygon', geometry: resolved.geometry }, { scopeLabel: resolved.label });
          }}
          onMunicipalityChange={async (key) => {
            const resolved = await resolveMunicipality(key);
            if (!resolved) return;
            window.dispatchEvent(new CustomEvent('engineering:preview-geojson', {
              detail: { featureCollection: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { __scope_preview: true, name_ar: resolved.label }, geometry: resolved.geometry }] } },
            }));
          }}
          // SCADA intentionally omitted
        />
        )}

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: asset list */}
          <AssetLeftPanel
            selectedAssetId={selectedAssetId}
            onSelectAsset={handleSelectAsset}
            onCreatePrincipal={() => { setPendingGeometry(null); setPendingGeometryType(null); setShowCreateModal(true); }}
            refreshKey={leftPanelRefreshKey}
            mode={panelMode}
          />

          {/* Center: map */}
          <main className="flex flex-1 relative overflow-hidden">
            <MapCenterCanvas hideControls />

            {/* Asset detail panel */}
            <AssetCenterPanel
              assetId={selectedAssetId}
              onClose={() => handleSelectAsset(null)}
              onSelectChild={handleSelectAsset}
              onRedrawGeometry={(geometryType) => {
                if (!selectedAssetId) return;
                window.dispatchEvent(new CustomEvent('engineering:redraw-asset', {
                  detail: { assetId: selectedAssetId, geometryType },
                }));
              }}
            />
          </main>
        </div>

        {/* Extraction results panel */}
        {extractPanelOpen && (
          <div className="absolute bottom-0 right-0 left-0 z-50 bg-slate-900/95 border-t border-slate-700 shadow-2xl max-h-[55vh] flex flex-col" dir="rtl">
            {/* Tabs */}
            <div className="flex items-center border-b border-slate-800 px-3 py-2 gap-3 shrink-0">
              <button
                onClick={() => setExtractionTab('results')}
                className={`text-[11px] font-semibold px-3 py-1 rounded-md ${extractionTab === 'results' ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'}`}
              >نتيجة التفكيك</button>
              <button
                onClick={() => setExtractionTab('catalog')}
                className={`text-[11px] font-semibold px-3 py-1 rounded-md ${extractionTab === 'catalog' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'}`}
              >مكتبة التفكيكات</button>
              <button onClick={() => setExtractPanelOpen(false)} className="mr-auto text-slate-500 hover:text-slate-300"><X size={14} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {extractionTab === 'results' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300">{extractScopeLabel || 'نتيجة التفكيك'}</span>
                    <div className="flex gap-2">
                      <input
                        value={extractSaveName}
                        onChange={e => setExtractSaveName(e.target.value)}
                        className="h-7 px-2 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200 w-40"
                        placeholder="اسم الحفظ..."
                      />
                      <button
                        onClick={() => saveLayersAsPrincipal(extractedLayers.filter(l => selectedLayerKeys.includes(l.layer_key)), { scopeLabel: extractSaveName })}
                        disabled={savingExtracted || !selectedLayerKeys.length}
                        className="h-7 px-3 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold disabled:opacity-40"
                      >{savingExtracted ? 'جاري الحفظ...' : 'حفظ المحدد'}</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {extractedLayers.map(layer => (
                      <label key={layer.layer_key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedLayerKeys.includes(layer.layer_key) ? 'border-cyan-500/60 bg-cyan-950/30' : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'}`}>
                        <input
                          type="checkbox"
                          checked={selectedLayerKeys.includes(layer.layer_key)}
                          onChange={e => {
                            setSelectedLayerKeys(prev =>
                              e.target.checked ? [...prev, layer.layer_key] : prev.filter(k => k !== layer.layer_key)
                            );
                          }}
                          className="accent-cyan-500"
                        />
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: layer.color }} />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-200 font-semibold truncate">{layer.layer_name}</p>
                          <p className="text-[9px] text-slate-500 leading-snug">{layerStatsLabel(layer)}</p>
                          {layer.stats?.by_type && (
                            <p className="text-[8px] text-slate-600 truncate">
                              {Object.entries(layer.stats.by_type).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <ExtractionCatalog
                  tenantId={getTenantId()}
                  principalAssets={principalAssets}
                  onLoadExtraction={(extraction) => {
                    const layers = enrichLayers(Array.isArray(extraction.layers) ? extraction.layers : []);
                    applyExtractionResult({ layers, job_id: extraction.job_id }, extraction.scope_label, extraction.geometry);
                  }}
                  onPromoteToPrincipal={async (extraction, layerKeys) => {
                    const layers = enrichLayers(Array.isArray(extraction.layers) ? extraction.layers : []).filter(l => layerKeys.includes(l.layer_key));
                    await saveLayersAsPrincipal(layers, { jobId: extraction.job_id, scopeLabel: extraction.scope_label, geometry: extraction.geometry });
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Extraction catalog quick access button */}
        {!extractPanelOpen && (
          <button
            onClick={() => { setExtractionTab('catalog'); setExtractPanelOpen(true); }}
            className="fixed bottom-4 left-4 z-[9001] rounded-xl border border-cyan-500/40 bg-slate-900/90 px-3 py-2 text-[11px] text-cyan-200 hover:bg-slate-800 shadow-lg"
          >
            📚 مكتبة التفكيكات
          </button>
        )}

        {/* Create principal asset modal */}
        {showCreateModal && (
          <CreatePrincipalAssetModal
            geometry={pendingGeometry}
            geometryType={pendingGeometryType}
            defaultName={pendingDefaults?.name}
            defaultClassification={pendingDefaults?.classification}
            defaultOwnerDepartment={pendingDefaults?.ownerDept}
            defaultStatus={pendingDefaults?.status}
            uploadProgress={uploadedFeatures.length > 0 ? { fileName: uploadedFileName, index: uploadIndex, total: uploadedFeatures.length } : undefined}
            onSaved={handleCreateSaved}
            onClose={() => {
              setShowCreateModal(false);
              setPendingGeometry(null); setPendingGeometryType(null); setPendingDefaults(null);
              setUploadedFeatures([]); setUploadedFileName(''); setUploadIndex(0);
              window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
            }}
            onStartDrawing={(mode) => {
              setShowCreateModal(false);
              setPendingGeometry(null); setPendingGeometryType(null); setPendingDefaults(null);
              setDrawingMode(mode === 'polygon' ? 'polygon' : 'line');
            }}
          />
        )}

        {/* Add child asset modal */}
        {showChildModal && (
          <AddChildAssetModal
            principalAssets={principalAssets}
            onSaved={() => { setShowChildModal(false); setLeftPanelRefreshKey(k => k + 1); window.dispatchEvent(new CustomEvent('engineering:refresh-child-layer')); }}
            onClose={() => setShowChildModal(false)}
          />
        )}

      </GisErrorBoundary>
    </div>
  );
}
