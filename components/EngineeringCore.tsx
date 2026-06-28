'use client';
/**
 * EngineeringCore — وحدة الإدارة الهندسية السيادية
 * ══════════════════════════════════════════════════════════
 * الطبقة الوسيطة الملتصقة بالخريطة الأساسية.
 * تشمل: رسم · استخراج OSM · مخزن الأصول · رفع ملفات · فحص التقاطعات
 */

import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Layers, ChevronDown, ChevronUp, ChevronLeft,
  MapPin, Minus, Pentagon, Pencil, Trash2, Check, X, Route, Building2,
  Download, Upload, Search, Satellite, AlertTriangle, Info,
  Globe, Lock, Eye, Zap, RefreshCw, Package, FileText, Moon,
  Shield, Crosshair, Activity,
} from 'lucide-react';
import { useGisEngine, type DrawingMode } from '@/store/gisEngine';

// ── Constants ─────────────────────────────────────────────────────────────────
const TENANT =
  typeof window !== 'undefined'
    ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
    : '';

const DEPT_COLORS: Record<string, string> = {
  engineering_backbone: '#06b6d4',
  engineering:          '#3b82f6',
  electrical:           '#f59e0b',
  hr:                   '#8b5cf6',
  finance:              '#10b981',
  maintenance:          '#f97316',
  executive:            '#e11d48',
  logistics:            '#22d3ee',
  general:              '#94a3b8',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface AssetType {
  key: string;
  label: string;
  category: string;
  color: string;
  geometry_type: string;
}

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  category: string;
  geometry: Record<string, unknown>;
  geometry_type: string;
  source: string;
  satellite_monitoring: boolean;
  monitoring_frequency: string;
  status: string;
  created_at: string;
  color: string;
}

interface IntersectionConflict {
  id: string;
  name: string;
  asset_type: string;
  category: string;
  severity: 'critical' | 'warning';
  message: string;
  color: string;
}

interface SovereignLayer {
  id: string;
  name: string;
  layer_dept_type: string;
  owner_department: string;
  visibility_scope: string;
  is_base_layer: boolean;
  can_edit: boolean;
}

interface AdoptCandidate {
  name: string;
  geometry: Record<string, unknown>;
  geometry_type: string;
  asset_type: string;
  category: string;
  source: string;
  source_ref?: string | null;
  properties?: Record<string, unknown>;
}

interface EngineeringCoreProps {
  userDepartment?: string;
  variant?: 'floating' | 'docked';
}

type TabId = 'draw' | 'extract' | 'assets' | 'upload' | 'layers';

// ── Drawing tools config ──────────────────────────────────────────────────────
const DRAW_TOOLS: { mode: DrawingMode; icon: React.ReactNode; label: string }[] = [
  { mode: 'point',   icon: <MapPin   size={15} />, label: 'نقطة' },
  { mode: 'line',    icon: <Minus    size={15} />, label: 'خط' },
  { mode: 'polygon', icon: <Pentagon size={15} />, label: 'مضلع' },
  { mode: 'trace', icon: <Route size={15} />, label: 'تتبع ذكي' },
  { mode: 'orthogonal-polygon', icon: <Building2 size={15} />, label: 'مبنى 90°' },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function EngineeringCore({ userDepartment = 'engineering', variant = 'floating' }: EngineeringCoreProps) {
  const drawingMode    = useGisEngine(s => s.drawingMode);
  const setDrawingMode = useGisEngine(s => s.setDrawingMode);
  const drawnFeatures  = useGisEngine(s => s.drawnFeatures);
  const clearDrawn     = useGisEngine(s => s.clearDrawnFeatures);
  const center         = useGisEngine(s => s.center);
  const zoom           = useGisEngine(s => s.zoom);
  const basemap        = useGisEngine(s => s.basemap);
  const setBasemap     = useGisEngine(s => s.setBasemap);
  const aoi            = useGisEngine(s => s.aoi);
  const docked         = variant === 'docked';

  const isEngineer = userDepartment === 'engineering';

  // ── Panel state ──────────────────────────────────────────────────────────
  const [panelOpen,    setPanelOpen]    = useState(true);
  const [activeTab,    setActiveTab]    = useState<TabId>('draw');
  const [minimized,    setMinimized]    = useState(false);

  // ── Draw tab state ────────────────────────────────────────────────────────
  const [featureName,    setFeatureName]    = useState('');
  const [savingFeature,  setSavingFeature]  = useState(false);
  const [saveProgress,   setSaveProgress]   = useState(0);
  const [savedCount,     setSavedCount]     = useState(0);
  const [bootstrappingRiver, setBootstrappingRiver] = useState(false);

  // ── Extract tab state ─────────────────────────────────────────────────────
  const [assetTypes,     setAssetTypes]     = useState<AssetType[]>([]);
  const [selectedType,   setSelectedType]   = useState('wadi');
  const [extracting,     setExtracting]     = useState(false);
  const [extractedGeo,   setExtractedGeo]   = useState<{ count: number; label: string } | null>(null);
  const [extractedFeatures, setExtractedFeatures] = useState<Array<{ geometry: Record<string, unknown>; properties?: Record<string, unknown>; id?: string }>>([]);
  const [extractError,   setExtractError]   = useState('');
  const [savingPreview,  setSavingPreview]  = useState(false);
  const [saveToDB,       setSaveToDB]       = useState(false);
  const [clipToSelectedBoundary, setClipToSelectedBoundary] = useState(true);

  // ── Assets tab state ──────────────────────────────────────────────────────
  const [assets,         setAssets]         = useState<Asset[]>([]);
  const [assetsLoading,  setAssetsLoading]  = useState(false);
  const [assetFilter,    setAssetFilter]    = useState('');
  const [adoptCandidate, setAdoptCandidate] = useState<AdoptCandidate | null>(null);
  const [adoptingFeature, setAdoptingFeature] = useState(false);

  // ── Upload tab state ──────────────────────────────────────────────────────
  const [uploadType,     setUploadType]     = useState('manual');
  const [uploading,      setUploading]      = useState(false);
  const [uploadResult,   setUploadResult]   = useState<{ saved: number; errors: number; filename: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  // ── Layers tab state ──────────────────────────────────────────────────────
  const [sovereignLayers, setSovereignLayers] = useState<SovereignLayer[]>([]);
  const [layersLoading,   setLayersLoading]   = useState(false);

  // ── Intersection badge (always visible) ──────────────────────────────────
  const [conflicts,    setConflicts]    = useState<IntersectionConflict[]>([]);

  const showNotice = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setNotice({ type, text });
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  // ── Load asset types on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/v1/engineering/asset-types', { headers: { 'X-Tenant-ID': TENANT } })
      .then(r => r.json())
      .then(d => setAssetTypes(d.types ?? []))
      .catch(() => {});
  }, []);

  // ── Load assets when tab opens ────────────────────────────────────────────
  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const r = await fetch(`/api/v1/engineering/assets?tenant_id=${TENANT}&limit=100`, {
        headers: { 'X-Tenant-ID': TENANT },
      });
      const d = await r.json();
      setAssets(d.assets ?? []);
    } catch { /* silent */ }
    setAssetsLoading(false);
  }, []);
    // show notice on error instead of silent fail

  useEffect(() => {
    if (activeTab === 'assets') loadAssets();
  }, [activeTab, loadAssets]);

  useEffect(() => {
    const onAdoptFeature = (ev: Event) => {
      const custom = ev as CustomEvent<AdoptCandidate>;
      if (!custom.detail?.geometry) return;
      setPanelOpen(true);
      setMinimized(false);
      setActiveTab('draw');
      setAdoptCandidate(custom.detail);
      showNotice('info', `تم تحديد ${custom.detail.name} من الخريطة المحلية للمراجعة والاعتماد`);
    };

    window.addEventListener('engineering:adopt-feature', onAdoptFeature as EventListener);
    return () => {
      window.removeEventListener('engineering:adopt-feature', onAdoptFeature as EventListener);
    };
  }, [showNotice]);

  // ── Load sovereign layers ─────────────────────────────────────────────────
  const loadSovereignLayers = useCallback(async () => {
    setLayersLoading(true);
    try {
      const r = await fetch(
        `/api/v1/map/sovereign-layers?tenant_id=${TENANT}&requesting_dept=${userDepartment}`,
        { headers: { 'X-Tenant-ID': TENANT } },
      );
      const d = await r.json();
      setSovereignLayers(d.layers ?? []);
    } catch { /* silent */ }
    setLayersLoading(false);
  }, [userDepartment]);

  useEffect(() => {
    if (activeTab === 'layers') loadSovereignLayers();
  }, [activeTab, loadSovereignLayers]);

  // ── Compute bbox from center + zoom ──────────────────────────────────────
  const getBbox = (): [number, number, number, number] => {
    // Clamp to a sensible Libya-region bbox when zoomed too far out
    const deg = Math.min(360 / Math.pow(2, zoom) * 2, 8);
    const [lon, lat] = center;
    return [lon - deg, lat - deg * 0.6, lon + deg, lat + deg * 0.6];
  };

  // ── Draw: save drawn features ─────────────────────────────────────────────
  const handleSaveDrawn = async () => {
    if (!featureName.trim() || !drawnFeatures.length) return;
    setSavingFeature(true);
    setSaveProgress(0);
    const isRiverTrace = drawingMode === 'trace' || /نهر|pipeline|canal|river/i.test(featureName);
    let ok = 0;
    let fail = 0;
    for (const feat of drawnFeatures) {
      const geom = (feat.geojson as { geometry?: unknown })?.geometry ?? feat.geojson;
      const rawType = (geom as { type?: string })?.type?.toLowerCase() ?? feat.type;
      const geomType = rawType.includes('point') ? 'point' : rawType.includes('line') ? 'line' : 'polygon';
      try {
        const res = await fetch('/api/v1/engineering/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT },
          body: JSON.stringify({
            name: featureName.trim(),
            asset_type: 'manual',
            category: 'infrastructure',
            geometry: geom,
            geometry_type: geomType,
            source: 'manual',
            tenant_id: TENANT,
            created_by: userDepartment,
          }),
        });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
      setSaveProgress(Math.round(((ok + fail) / drawnFeatures.length) * 100));
    }
    setSavingFeature(false);
    if (ok > 0) {
      setSavedCount(c => c + ok);
      clearDrawn();
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      setDrawingMode('idle');
      setFeatureName('');
      await loadAssets();
      setActiveTab('assets');
      showNotice('success', isRiverTrace
        ? 'تم تأمين مسار النهر في قاعدة البيانات السيادية'
        : 'تم حفظ الأصل بنجاح في قاعدة البيانات السيادية ✓');
    }
    if (fail > 0) {
      showNotice('error', `تعذر حفظ ${fail} عنصر`);
    }
    setSaveProgress(0);
  };

  const handleBootstrapRiverProject = async () => {
    setBootstrappingRiver(true);
    try {
      if (zoom < 6 && !aoi) {
        throw new Error('حدّد نطاق التحليل أولاً (زر النطاق) ثم استجالب مسار النهر');
      }
      const bbox = aoi?.bbox ?? getBbox();
      const res = await fetch('/api/v1/engineering/river-project/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT },
        body: JSON.stringify({ tenant_id: TENANT, bbox, limit: 15000 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'فشل استجالب مسار النهر');
      setDrawingMode('trace');
      await loadAssets();
      showNotice('success', `تم استجالب ${data.inserted ?? 0} مسار من مشروع النهر، ويمكنك التتبع المغناطيسي الآن`);
    } catch (err: unknown) {
      showNotice('error', err instanceof Error ? err.message : 'تعذر استجالب مسارات النهر');
    }
    setBootstrappingRiver(false);
  };

  const handleAdoptFeature = async () => {
    if (!adoptCandidate) return;
    setAdoptingFeature(true);
    try {
      const res = await fetch('/api/v1/engineering/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT },
        body: JSON.stringify({
          name: adoptCandidate.name,
          asset_type: adoptCandidate.asset_type,
          category: adoptCandidate.category,
          geometry: adoptCandidate.geometry,
          geometry_type: adoptCandidate.geometry_type,
          source: adoptCandidate.source,
          source_ref: adoptCandidate.source_ref ?? null,
          properties: adoptCandidate.properties ?? {},
          tenant_id: TENANT,
          created_by: userDepartment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'تعذر اعتماد المعلم المحلي');
      setAdoptCandidate(null);
      await loadAssets();
      setActiveTab('assets');
      showNotice('success', `تم اعتماد ${data.name ?? 'المعلم'} كأصل سيادي`);
    } catch (err: unknown) {
      showNotice('error', err instanceof Error ? err.message : 'تعذر اعتماد المعلم المحلي');
    }
    setAdoptingFeature(false);
  };

  // ── Extract: call Overpass API ────────────────────────────────────────────
  const handleExtract = async () => {
    if (selectedType === 'wadi' && basemap !== 'terrain') {
      showNotice('info', 'لضمان دقة مسار الأودية، فعّل طبقة التضاريس أولاً');
      return;
    }
    setExtracting(true);
    setExtractError('');
    setExtractedGeo(null);
    setExtractedFeatures([]);
    try {
      const bbox = getBbox();
      if (clipToSelectedBoundary && !aoi?.geometry) {
        throw new Error('فعّل نطاق التحليل أولاً عبر أداة النطاق (هدف) في شريط الخريطة السفلي');
      }
      const res = await fetch('/api/v1/engineering/extract-from-osm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT },
        body: JSON.stringify({
          asset_type: selectedType,
          bbox,
          limit: 50,
          tenant_id: TENANT,
          save_to_db: saveToDB,
          active_layer: basemap,
          terrain_validation: selectedType === 'wadi' && basemap === 'terrain',
          clip_to_selected_boundary: clipToSelectedBoundary,
          clip_geometry: clipToSelectedBoundary ? aoi?.geometry : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'فشل الاستخراج');
      setExtractedGeo({ count: data.count, label: data.label });
      const features = (data.geojson?.features ?? []) as Array<{ geometry: Record<string, unknown>; properties?: Record<string, unknown>; id?: string }>;
      setExtractedFeatures(features);
      window.dispatchEvent(new CustomEvent('engineering:preview-geojson', {
        detail: { featureCollection: data.geojson },
      }));
      if (saveToDB) {
        await loadAssets();
        setActiveTab('assets');
      }
      showNotice('success', saveToDB
        ? `تم استخراج ${data.count} عنصر وحفظه مباشرة`
        : `تم استخراج ${data.count} عنصر ومعاينته على الخريطة`);
    } catch (e: unknown) {
      setExtractError(e instanceof Error ? e.message : 'خطأ في الاتصال');
      showNotice('error', e instanceof Error ? e.message : 'خطأ في الاتصال');
    }
    setExtracting(false);
  };

  const saveExtractPreviewToDb = async () => {
    if (!extractedFeatures.length) return;
    setSavingPreview(true);
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < extractedFeatures.length; i += 1) {
      const feat = extractedFeatures[i];
      const geom = feat.geometry;
      const rawType = (geom as { type?: string })?.type?.toLowerCase() ?? 'point';
      const geomType = rawType.includes('point') ? 'point' : rawType.includes('line') ? 'line' : 'polygon';
      const p = feat.properties ?? {};
      const name = String(p.name ?? p._label ?? `${selectedType}-${i + 1}`);
      const selectedMeta = assetTypes.find((a) => a.key === selectedType);
      const category = String(p._category ?? selectedMeta?.category ?? 'infrastructure');

      try {
        const res = await fetch('/api/v1/engineering/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT },
          body: JSON.stringify({
            name,
            asset_type: selectedType,
            category,
            geometry: geom,
            geometry_type: geomType,
            source: 'osm',
            source_ref: feat.id ?? null,
            properties: p,
            tenant_id: TENANT,
            created_by: userDepartment,
          }),
        });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    setSavingPreview(false);
    if (ok > 0) {
      await loadAssets();
      setActiveTab('assets');
      showNotice('success', `تم حفظ ${ok} عنصر من معاينة الاستخراج`);
    }
    if (fail > 0) showNotice('error', `فشل حفظ ${fail} عنصر من المعاينة`);
  };

  // ── Upload: submit file ───────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    const form = new FormData();
    form.append('file', file);
    form.append('tenant_id', TENANT);
    form.append('asset_type', uploadType);
    form.append('created_by', userDepartment);
    try {
      const res = await fetch('/api/v1/engineering/bulk-ingest', {
        method: 'POST',
        headers: { 'X-Tenant-ID': TENANT },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'فشل معالجة الملف');
      setUploadResult({ saved: data.saved, errors: data.errors, filename: data.filename });
      if (data.saved > 0) {
        await loadAssets();
        setActiveTab('assets');
        showNotice('success', `تم حفظ ${data.saved} أصل من الملف ${data.filename}`);
      } else {
        showNotice('error', 'لم يتم حفظ أي أصل من الملف');
      }
    } catch (err: unknown) {
      showNotice('error', err instanceof Error ? err.message : 'تعذر رفع الملف');
    }
    setUploading(false);
    e.target.value = '';
  };

  // ── Intersection check when drawing active ────────────────────────────────
  useEffect(() => {
    if (drawnFeatures.length === 0) { setConflicts([]); return; }
    const last = drawnFeatures[drawnFeatures.length - 1];
    const geom = (last.geojson as { geometry?: unknown })?.geometry ?? last.geojson;
    if (!geom) return;
    fetch('/api/v1/engineering/intersection-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT },
      body: JSON.stringify({
        geometry: geom,
        check_types: ['wadi', 'power_line', 'pipeline'],
        tenant_id: TENANT,
        buffer_meters: 10,
        selected_layer: basemap,
      }),
    })
      .then(r => r.json())
      .then(d => setConflicts(d.conflicts ?? []))
      .catch(() => {});
  }, [drawnFeatures, basemap]);

  // ── Tab labels ────────────────────────────────────────────────────────────
  const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
    { id: 'draw',    icon: <Pencil  size={13} />, label: 'رسم' },
    { id: 'extract', icon: <Search  size={13} />, label: 'استخراج' },
    { id: 'assets',  icon: <Package size={13} />, label: 'أصول' },
    { id: 'upload',  icon: <Upload  size={13} />, label: 'رفع' },
    { id: 'layers',  icon: <Layers  size={13} />, label: 'طبقات' },
  ];

  const VIEW_LAYERS: Array<{ key: 'satellite' | 'terrain' | 'ndvi' | 'dark'; label: string; icon: React.ReactNode }> = [
    { key: 'satellite', label: 'قمر صناعي', icon: <Satellite size={11} /> },
    { key: 'terrain', label: 'تضاريس', icon: <Globe size={11} /> },
    { key: 'ndvi', label: 'NDVI', icon: <Eye size={11} /> },
    { key: 'dark', label: 'ليلي', icon: <Moon size={11} /> },
  ];

  // ── Collapsed pill ────────────────────────────────────────────────────────
  if (!panelOpen) {
    return (
      <div className="flex flex-col items-start gap-1">
        {/* Intersection alert badge */}
        {conflicts.length > 0 && (
          <div className="flex items-center gap-1.5 bg-red-900/90 border border-red-500 rounded-xl px-2.5 py-1 text-[11px] text-red-200 shadow-lg backdrop-blur-md animate-pulse">
            <AlertTriangle size={12} className="text-red-400" />
            <span>{conflicts.length} تقاطع مكتشف</span>
          </div>
        )}
        {/* Saved count badge */}
        {savedCount > 0 && (
          <div className="flex items-center gap-1 bg-emerald-900/90 border border-emerald-600 rounded-xl px-2.5 py-1 text-[11px] text-emerald-200">
            <Check size={11} />
            <span>{savedCount} محفوظ</span>
          </div>
        )}
        {/* Active drawing indicator */}
        {drawingMode !== 'idle' && (
          <div className="flex items-center gap-1.5 bg-cyan-900/90 border border-cyan-500 rounded-xl px-2.5 py-1 text-[11px] text-cyan-200">
            <Activity size={12} className="animate-pulse text-cyan-400" />
            <span>رسم نشط · {drawnFeatures.length} معلم</span>
          </div>
        )}
        {/* Open button */}
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-cyan-500/60 rounded-2xl px-3 py-2 shadow-xl hover:border-cyan-400 transition-all group"
        >
          <Shield size={14} className="text-cyan-400 group-hover:scale-110 transition-transform" />
          <span className="text-[12px] text-cyan-300 font-semibold">الإدارة الهندسية</span>
          <ChevronLeft size={13} className="text-slate-400" />
        </button>
      </div>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" dir="rtl" style={{ direction: 'rtl' }}>
      {/* Intersection alerts above panel */}
      {conflicts.length > 0 && (
        <div className="mb-1 flex flex-col gap-0.5 max-w-xs">
          {conflicts.slice(0, 3).map(c => (
            <div
              key={c.id}
              className={`flex items-start gap-2 rounded-xl px-2.5 py-1.5 text-[11px] backdrop-blur-md border ${
                c.severity === 'critical'
                  ? 'bg-red-900/90 border-red-500 text-red-200'
                  : 'bg-amber-900/90 border-amber-500 text-amber-200'
              }`}
            >
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{c.message}</span>
            </div>
          ))}
          {conflicts.length > 3 && (
            <div className="text-[10px] text-slate-400 text-left px-1">
              +{conflicts.length - 3} تقاطعات أخرى
            </div>
          )}
        </div>
      )}

      {/* Panel */}
      <div className={`bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden ${docked ? 'w-[min(92vw,980px)]' : 'w-80'}`}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60 bg-slate-800/60">
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-cyan-400" />
            <span className="text-[12px] font-bold text-cyan-300">الإدارة الهندسية السيادية</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(v => !v)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              {minimized ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
            <button
              onClick={() => { setPanelOpen(false); setDrawingMode('idle'); }}
              className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            <div className={`border-b border-slate-700/60 bg-slate-950/35 px-3 py-2 ${docked ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}`}>
              <div className={`flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] ${aoi ? 'border border-emerald-600/40 bg-emerald-900/20 text-emerald-200' : 'border border-dashed border-slate-600/50 bg-slate-800/30 text-slate-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${aoi ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className="truncate">{aoi ? `النطاق الحالي: ${aoi.name}` : 'لم يُحدد نطاق تحليل بعد'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('extract');
                    window.dispatchEvent(new CustomEvent('engineering:toggle-aoi-popover'));
                  }}
                  className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  {aoi ? 'تعديل النطاق' : 'تحديد النطاق'}
                </button>
                {drawingMode === 'aoi-rectangle' && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
                    انقر واسحب على الخريطة لرسم نطاق العمل
                  </div>
                )}
              </div>
            </div>

            {notice && (
              <div className={`mx-3 mt-3 rounded-lg px-2.5 py-2 text-[11px] border ${
                notice.type === 'success'
                  ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
                  : notice.type === 'error'
                    ? 'bg-red-900/40 border-red-700 text-red-300'
                    : 'bg-cyan-900/30 border-cyan-700 text-cyan-300'
              }`}>
                {notice.text}
              </div>
            )}

            {/* ── Tabs ── */}
            <div className={`border-b border-slate-700/60 bg-slate-800/40 ${docked ? 'flex flex-wrap gap-1 px-2 py-1.5' : 'flex'}`}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${docked ? 'flex-none rounded-xl px-3.5' : 'flex-1'} flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-all ${
                    activeTab === tab.id
                      ? 'text-cyan-300 border-b-2 border-cyan-400 bg-slate-700/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ── Tab content ── */}
            <div className={`overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600 ${docked ? 'max-h-[320px]' : 'max-h-[420px]'}`}>

              {/* ════ DRAW TAB ════ */}
              {activeTab === 'draw' && (
                <div className="space-y-2">
                  {adoptCandidate && (
                    <div className="bg-amber-900/20 border border-amber-600/40 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[12px] font-semibold text-amber-200">اعتماد من الخريطة المحلية</div>
                          <div className="text-[11px] text-amber-300/90">{adoptCandidate.name}</div>
                        </div>
                        <button
                          onClick={() => setAdoptCandidate(null)}
                          className="text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
                        <div className="rounded-lg bg-slate-800/60 px-2 py-1.5">النوع: {adoptCandidate.asset_type}</div>
                        <div className="rounded-lg bg-slate-800/60 px-2 py-1.5">التصنيف: {adoptCandidate.category}</div>
                      </div>
                      <button
                        onClick={handleAdoptFeature}
                        disabled={adoptingFeature}
                        className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[12px] font-medium rounded-lg py-2 transition-colors"
                      >
                        {adoptingFeature ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                        {adoptingFeature ? 'جارٍ اعتماد المعلم...' : 'اعتماد كأصل'}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleBootstrapRiverProject}
                    disabled={bootstrappingRiver}
                    className="w-full flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[12px] font-medium rounded-xl py-2.5 transition-colors"
                  >
                    {bootstrappingRiver
                      ? <><RefreshCw size={13} className="animate-spin" /> جارٍ استجالب مشروع النهر...</>
                      : <><Route size={13} /> استجالب مشروع النهر (Pipeline/Canal)</>
                    }
                  </button>

                  {/* Draw tools moved to FloatingMapToolbar — status indicator only */}
                  <div className="flex items-start gap-2 bg-slate-800/60 rounded-xl p-2.5 text-[11px] text-slate-400">
                    <Lock size={11} className="mt-0.5 text-cyan-500 shrink-0" />
                    <span>أدوات الرسم متاحة في شريط الأدوات السفلي (زر <b className="text-slate-200">رسم</b>) — الرسم يتم على الطبقة الهندسية فوق الخريطة الأساسية</span>
                  </div>

                  {drawingMode !== 'idle' && (
                    <div className="flex items-center justify-between bg-cyan-900/30 border border-cyan-500/30 rounded-xl px-3 py-2 text-[11px]">
                      <span className="text-cyan-300 font-medium">وضع الرسم النشط: {drawingMode}</span>
                      <button
                        onClick={() => { setDrawingMode('idle'); clearDrawn(); window.dispatchEvent(new CustomEvent('engineering:clear-preview')); }}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      ><X size={12} /></button>
                    </div>
                  )}

                  {/* Drawn features + save */}
                  {drawnFeatures.length > 0 && (
                    <div className="bg-slate-800/60 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-300 font-medium">{drawnFeatures.length} معلم جديد غير محفوظ</span>
                        <button
                          onClick={() => {
                            clearDrawn();
                            setDrawingMode('idle');
                            window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
                          }}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={featureName}
                        onChange={e => setFeatureName(e.target.value)}
                        placeholder="اسم الأصل الهندسي..."
                        className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        onKeyDown={e => e.key === 'Enter' && handleSaveDrawn()}
                      />
                      <button
                        onClick={handleSaveDrawn}
                        disabled={!featureName.trim() || savingFeature}
                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[12px] font-medium rounded-lg py-2 transition-colors"
                      >
                        {savingFeature ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                        {savingFeature ? 'جارٍ تأمين المسار...' : 'حفظ في الطبقة الهندسية'}
                      </button>

                      {savingFeature && (
                        <div className="space-y-1">
                          <div className="h-1.5 w-full rounded bg-slate-700 overflow-hidden">
                            <div
                              className="h-full bg-cyan-400 transition-all duration-200"
                              style={{ width: `${saveProgress}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-cyan-300 text-left">{saveProgress}%</div>
                        </div>
                      )}
                    </div>
                  )}

                  {savedCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-900/30 rounded-xl px-3 py-2">
                      <Check size={12} />
                      <span>تم حفظ {savedCount} أصل هندسي</span>
                    </div>
                  )}
                </div>
              )}

              {/* ════ EXTRACT TAB ════ */}
              {activeTab === 'extract' && (
                <div className="space-y-2.5">
                  {/* ── AOI status badge ── */}
                  {aoi ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-900/20 px-2.5 py-2 text-[11px] text-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="flex-1 font-medium truncate">النطاق: {aoi.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-600/50 bg-slate-800/30 px-2.5 py-2 text-[11px] text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                      <span>لم يُحدد نطاق — استخدم أداة النطاق (◎) في شريط الخريطة</span>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-2.5">
                    <div className="mb-2 text-[11px] text-slate-300">الطبقة النشطة (Layers Control)</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {VIEW_LAYERS.map(layer => (
                        <button
                          key={layer.key}
                          onClick={() => setBasemap(layer.key)}
                          className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] transition-colors ${
                            basemap === layer.key
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {layer.icon}
                          <span>{layer.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    استخراج مكونات من الخريطة العالمية (OSM) داخل نطاق العرض الحالي وإضافتها إلى الطبقة الهندسية.
                  </p>

                  {/* Type selector */}
                  <div className="grid grid-cols-3 gap-1">
                    {assetTypes.map(at => (
                      <button
                        key={at.key}
                        onClick={() => setSelectedType(at.key)}
                        className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-all ${
                          selectedType === at.key
                            ? 'bg-slate-600 text-white ring-1 ring-cyan-500'
                            : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: at.color }}
                        />
                        <span className="text-center leading-tight">{at.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Save to DB option */}
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToDB}
                      onChange={e => setSaveToDB(e.target.checked)}
                      className="rounded accent-cyan-500"
                    />
                    حفظ النتائج في قاعدة البيانات الهندسية
                  </label>

                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clipToSelectedBoundary}
                      onChange={e => setClipToSelectedBoundary(e.target.checked)}
                      className="rounded accent-cyan-500"
                    />
                    استخراج داخل الحدود المختارة فقط (Spatial Clipping)
                  </label>

                  {/* Extract button */}
                  <button
                    onClick={handleExtract}
                    disabled={extracting}
                    className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[12px] font-medium rounded-xl py-2.5 transition-colors"
                  >
                    {extracting
                      ? <><RefreshCw size={13} className="animate-spin" /> جارٍ الاستخراج...</>
                      : <><Download size={13} /> تفكيك / استخراج من الخريطة</>
                    }
                  </button>

                  {extractedGeo && (
                    <div className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-700 rounded-xl px-3 py-2 text-[11px] text-emerald-300">
                      <Check size={12} />
                      <span>تم استخراج {extractedGeo.count} {extractedGeo.label} من المنطقة</span>
                    </div>
                  )}

                  {extractedFeatures.length > 0 && !saveToDB && (
                    <button
                      onClick={saveExtractPreviewToDb}
                      disabled={savingPreview}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[12px] font-medium rounded-xl py-2.5 transition-colors"
                    >
                      {savingPreview
                        ? <><RefreshCw size={13} className="animate-spin" /> جارٍ حفظ المعاينة...</>
                        : <><Check size={13} /> اعتماد المعاينة وحفظها</>
                      }
                    </button>
                  )}

                  {extractError && (
                    <div className="flex items-start gap-2 bg-red-900/40 border border-red-700 rounded-xl px-3 py-2 text-[11px] text-red-300">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>{extractError}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 bg-slate-800/40 rounded-lg p-2">
                    نطاق الاستخراج: {clipToSelectedBoundary && aoi ? `داخل ${aoi.name} فقط` : 'بناءً على منطقة العرض الحالية'}.
                  </div>
                </div>
              )}

              {/* ════ ASSETS TAB ════ */}
              {activeTab === 'assets' && (
                <div className="space-y-2">
                  {/* Filter */}
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={assetFilter}
                      onChange={e => setAssetFilter(e.target.value)}
                      placeholder="بحث في الأصول..."
                      className="flex-1 bg-slate-800/60 border border-slate-600 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={loadAssets}
                      className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
                    >
                      <RefreshCw size={13} className={assetsLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {assetsLoading && (
                    <div className="text-center text-[11px] text-slate-400 py-4">
                      <RefreshCw size={16} className="animate-spin mx-auto mb-1" />
                      تحميل الأصول...
                    </div>
                  )}

                  {!assetsLoading && assets.length === 0 && (
                    <div className="text-center text-[11px] text-slate-500 py-6">
                      <Package size={24} className="mx-auto mb-2 opacity-40" />
                      لا توجد أصول هندسية محفوظة
                    </div>
                  )}

                  <div className="space-y-1">
                    {assets
                      .filter(a =>
                        !assetFilter ||
                        a.name.includes(assetFilter) ||
                        a.asset_type.includes(assetFilter),
                      )
                      .map(asset => (
                        <div
                          key={asset.id}
                          className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-2.5 py-2 hover:bg-slate-700/60 transition-colors group"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: asset.color || '#94a3b8' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-slate-200 truncate">{asset.name}</div>
                            <div className="text-[10px] text-slate-500">
                              {asset.asset_type} · {asset.source} · {asset.geometry_type}
                            </div>
                          </div>
                          {asset.satellite_monitoring && (
                            <Satellite size={11} className="text-cyan-400 shrink-0" title="مراقبة فضائية" />
                          )}
                        </div>
                      ))}
                  </div>

                  {assets.length > 0 && (
                    <div className="text-[10px] text-slate-500 text-center">
                      {assets.length} أصل هندسي في قاعدة المرجع
                    </div>
                  )}
                </div>
              )}

              {/* ════ UPLOAD TAB ════ */}
              {activeTab === 'upload' && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-400">
                    رفع ملفات البيانات الجغرافية وتحويلها إلى أصول في الطبقة الهندسية.
                  </p>

                  {/* Asset type for upload */}
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">نوع الأصل:</label>
                    <select
                      value={uploadType}
                      onChange={e => setUploadType(e.target.value)}
                      className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="manual">يدوي</option>
                      {assetTypes.map(at => (
                        <option key={at.key} value={at.key}>{at.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Drop zone */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-600 hover:border-cyan-500 rounded-xl p-5 flex flex-col items-center gap-2 transition-colors group"
                  >
                    <Upload size={20} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                    <span className="text-[12px] text-slate-400 group-hover:text-slate-200 transition-colors">
                      انقر لاختيار ملف
                    </span>
                    <span className="text-[10px] text-slate-600">KML · GeoJSON · Excel · CSV</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".kml,.geojson,.json,.xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleUpload}
                  />

                  {uploading && (
                    <div className="flex items-center gap-2 text-[11px] text-cyan-300">
                      <RefreshCw size={12} className="animate-spin" />
                      جارٍ تحليل الملف وتحويله...
                    </div>
                  )}

                  {uploadResult && (
                    <div className={`rounded-xl p-3 text-[11px] space-y-0.5 ${
                      uploadResult.saved > 0 ? 'bg-emerald-900/40 border border-emerald-700 text-emerald-300' : 'bg-amber-900/40 border border-amber-700 text-amber-300'
                    }`}>
                      <div className="font-semibold">{uploadResult.filename}</div>
                      <div>✅ محفوظ: {uploadResult.saved} أصل</div>
                      {uploadResult.errors > 0 && <div>⚠️ أخطاء: {uploadResult.errors}</div>}
                    </div>
                  )}

                  <div className="bg-slate-800/40 rounded-xl p-2.5 text-[10px] text-slate-500 space-y-1">
                    <div className="font-semibold text-slate-400">تنسيقات مدعومة:</div>
                    <div>• <b>KML</b>: Placemarks مع إحداثيات</div>
                    <div>• <b>GeoJSON</b>: FeatureCollection/Feature</div>
                    <div>• <b>Excel/CSV</b>: أعمدة lat/lon/name</div>
                  </div>
                </div>
              )}

              {/* ════ LAYERS TAB ════ */}
              {activeTab === 'layers' && (
                <div className="space-y-2">
                  {isEngineer && (
                    <div className="flex items-center gap-2 bg-cyan-900/30 border border-cyan-700/50 rounded-xl px-3 py-2 text-[11px] text-cyan-300">
                      <Shield size={11} />
                      <span>الإدارة الهندسية: صلاحية رؤية وتحرير جميع الطبقات السيادية</span>
                    </div>
                  )}

                  {layersLoading && (
                    <div className="text-center text-[11px] text-slate-400 py-4">
                      <RefreshCw size={14} className="animate-spin mx-auto mb-1" />
                      تحميل الطبقات...
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {sovereignLayers.map(layer => (
                      <div
                        key={layer.id}
                        className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: DEPT_COLORS[layer.layer_dept_type] || '#94a3b8' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] text-slate-200">{layer.name}</div>
                          <div className="text-[10px] text-slate-500">{layer.owner_department} · {layer.visibility_scope}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {layer.is_base_layer && (
                            <span className="text-[9px] bg-cyan-900/60 text-cyan-400 border border-cyan-700 rounded px-1">أساس</span>
                          )}
                          {layer.can_edit && (
                            <Pencil size={10} className="text-emerald-400" title="قابل للتحرير" />
                          )}
                          {layer.visibility_scope === 'organization_wide' && <Globe size={10} className="text-slate-400" />}
                          {layer.visibility_scope === 'private' && <Lock size={10} className="text-slate-500" />}
                          {layer.visibility_scope === 'shared_selected' && <Eye size={10} className="text-slate-400" />}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!layersLoading && sovereignLayers.length === 0 && (
                    <div className="text-center text-[11px] text-slate-500 py-4">لا توجد طبقات سيادية</div>
                  )}

                  <button
                    onClick={loadSovereignLayers}
                    className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 py-1.5 transition-colors"
                  >
                    <RefreshCw size={11} className={layersLoading ? 'animate-spin' : ''} />
                    تحديث
                  </button>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
}
