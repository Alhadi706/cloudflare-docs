'use client';

import React, { useEffect, useMemo, useState, useCallback, Suspense, useRef } from 'react';
import { useGisEngine } from '@/store/gisEngine';
import { GisErrorBoundary } from '../components/GisErrorBoundary';
import { workspaceApi } from '@/store/apiService';
import { useSearchParams, usePathname } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import AssetTopBar from './components/AssetTopBar';
import AssetLeftPanel, { type PrincipalAsset } from './components/AssetLeftPanel';
import CreatePrincipalAssetModal from './components/CreatePrincipalAssetModal';
import { useUserStore } from '@/store/useUserStore';
import { getAssetCapabilities } from '@/lib/gis/assetGovernance';
import AddChildAssetModal from './components/AddChildAssetModal';
import AssetCenterPanel from './components/AssetCenterPanel';
import IntelligencePanel from './components/IntelligencePanel';
import ExtractionCatalog from '@/components/ExtractionCatalog';
// LinearAssetImporter removed in Phase 1 — LRS will be rebuilt in Phase 5 as proper backend integration
import MapCenterCanvas from '../components/MapCenterCanvas';

const TENANT_ID =
  typeof window !== 'undefined'
    ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
    : '';
const EXTRACTION_RUN_ENDPOINTS = [
  '/api/engineering/workspace/layer-extraction/run',
  '/api/v1/workspace/layer-extraction/run',
];
const EXTRACTION_SAVE_ENDPOINTS = [
  '/api/engineering/workspace/layer-extraction/save',
  '/api/v1/workspace/layer-extraction/save',
];

const MUNICIPALITY_LABELS: Record<string, string> = {
  libya: 'ليبيا بالكامل',
  tripoli: 'منطقة طرابلس',
  jafara: 'منطقة الجفارة',
  zawiya: 'منطقة الزاوية',
  murqub: 'منطقة المرقب',
  misrata: 'منطقة مصراتة',
  zliten: 'منطقة زليتن',
  nalut: 'منطقة نالوت',
  jabal_gharbi: 'منطقة الجبل الغربي',
  sirte: 'منطقة سرت',
  jufra: 'منطقة الجفرة',
  benghazi: 'منطقة بنغازي',
  marj: 'منطقة المرج',
  jabal_akhdar: 'منطقة الجبل الأخضر',
  beida: 'منطقة البيضاء',
  derna: 'منطقة درنة',
  tobruk: 'منطقة طبرق',
  wahat: 'منطقة الواحات',
  kufra: 'منطقة الكفرة',
  sebha: 'منطقة سبها',
  ubari: 'منطقة أوباري',
  murzuq: 'منطقة مرزق',
  ghat: 'منطقة غات',
  wadi_shati: 'منطقة وادي الشاطئ',
};

type ExtractedLayer = {
  layer_key: string;
  layer_name: string;
  color: string;
  feature_count: number;
  virtual?: boolean;
  geojson: { type: 'FeatureCollection'; features: any[] };
};

type GeoScadaTool = 'idle' | 'path' | 'tank' | 'valve' | 'pump' | 'delete';
type QuickDocType = 'financial' | 'admin' | 'technical' | 'photo' | 'drawing';

type AssetContextMenuState = {
  assetId: string;
  clientX: number;
  clientY: number;
};

type AssetDocsPopupState = {
  assetId: string;
  title: string;
  clientX: number;
  clientY: number;
  docs: Array<{
    id: string;
    title: string;
    doc_type: string;
    file_url?: string;
    created_at?: string;
  }>;
};

function mapQuickDocType(value: QuickDocType): { docType: string; department: string } {
  if (value === 'financial') return { docType: 'financial', department: 'finance' };
  if (value === 'admin') return { docType: 'admin', department: 'administration' };
  if (value === 'technical') return { docType: 'technical', department: 'technical' };
  if (value === 'photo') return { docType: 'photo', department: 'engineering' };
  return { docType: 'drawing', department: 'engineering' };
}

async function readApiPayload(res: Response): Promise<any> {
  const raw = await res.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { detail: raw };
  }
}

function toApiErrorMessage(res: Response, payload: any, fallback = 'فشل تنفيذ الطلب'): string {
  const detail = payload?.detail || payload?.error || payload?.message;
  if (typeof detail === 'string' && detail.trim()) {
    // Normalize noisy HTML bodies to a concise message for the user.
    if (detail.trim().startsWith('<')) {
      return `${fallback}: الخادم أعاد HTML بدلاً من JSON (HTTP ${res.status})`;
    }
    return `${fallback}: ${detail}`;
  }
  return `${fallback}: HTTP ${res.status}`;
}

function isRiverRouteFeature(feature: any): boolean {
  const props = feature?.properties || {};
  const text = [
    props?.asset_type,
    props?.layer_type,
    props?.feature_type,
    props?.category,
    props?.name,
    props?.name_ar,
    props?.ref,
    props?.route,
    props?.route_name,
    props?.operator,
    props?.source,
  ]
    .map((v: any) => String(v ?? '').toLowerCase())
    .join(' ');

  const routeKey = String(props?.route_key ?? '').toLowerCase();
  const routeCtx = String(props?.route_context ?? '').toLowerCase();

  // Exclude natural wadis/canals unless there is an explicit GMMR/river-route marker.
  const hasWadiOnly = /(wadi|وادي|stream|مجرى|canal|قناة|waterway)/i.test(text);
  const explicitRiverRoute = /(gmmr|great man[- ]made river|manmade river|nahr|river route|طريق النهر|النهر الصناعي|النهر)/i.test(
    `${text} ${routeKey} ${routeCtx}`
  );
  const hasRouteSignal = /(route|path|line|corridor|pipeline|مسار|طريق|خط|ممر)/i.test(text);

  if (explicitRiverRoute) return true;
  if (hasWadiOnly) return false;
  return hasRouteSignal && /(nahr|river|النهر|طريق النهر)/i.test(text);
}

function enrichWithRiverRouteLayer(inputLayers: ExtractedLayer[]): ExtractedLayer[] {
  if (!Array.isArray(inputLayers) || inputLayers.length === 0) return [];

  // Strip any existing virtual river route layer so we always rebuild it with the latest filter.
  const realLayers = inputLayers.filter(
    (layer) => layer.layer_key !== '__virtual_river_route__'
  );

  // Only skip enrichment if a non-virtual backend river layer already exists.
  const alreadyHasRiverLayer = realLayers.some((layer) => {
    if (layer.virtual || String(layer.layer_key || '').startsWith('__virtual_')) return false;
    const key = String(layer.layer_key || '').toLowerCase();
    const name = String(layer.layer_name || '').toLowerCase();
    return /(river route|river|nahr|gmmr|great man[- ]made river|manmade river|طريق النهر|النهر الصناعي|النهر)/i.test(`${key} ${name}`);
  });
  if (alreadyHasRiverLayer) return realLayers;

  // Scan only real (non-virtual) layers to build the river route virtual layer.
  const riverFeatures = realLayers
    .filter((layer) => !layer.virtual && !String(layer.layer_key || '').startsWith('__virtual_'))
    .flatMap((layer) =>
      (layer.geojson?.features || []).filter((f: any) => isRiverRouteFeature(f)).map((f: any) => ({
        ...f,
        properties: {
          ...(f?.properties || {}),
          __derived_from_extraction: true,
        },
      }))
    );

  if (riverFeatures.length === 0) return realLayers;

  const riverLayer: ExtractedLayer = {
    layer_key: '__virtual_river_route__',
    layer_name: 'طريق النهر الصناعي ومنشآته',
    color: '#22d3ee',
    feature_count: riverFeatures.length,
    virtual: true,
    geojson: {
      type: 'FeatureCollection',
      features: riverFeatures,
    },
  };

  return [...realLayers, riverLayer];
}

// Retry with exponential backoff for layer extraction
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  onProgress?: (msg: string) => void
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      onProgress?.(`محاولة ${attempt} من ${maxAttempts}...`);
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        onProgress?.(`فشلت المحاولة ${attempt}، إعادة محاولة في ${Math.round(delayMs / 1000)}ث...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError || new Error('فشلت جميع محاولات التفكيك');
}


function geometryToFeatureCollection(label: string, geometry: any) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {
          __scope_preview: true,
          __layer_key: '__municipality_scope__',
          __layer_name: label,
          __layer_color: '#38bdf8',
          name_ar: label,
        },
        geometry,
      },
    ],
  };
}

function normalizeZoomGeometry(input: any): any | null {
  if (!input) return null;

  if (typeof input === 'string') {
    try {
      return normalizeZoomGeometry(JSON.parse(input));
    } catch {
      return null;
    }
  }

  if (input?.type === 'Feature' && input?.geometry) {
    return normalizeZoomGeometry(input.geometry);
  }

  if (typeof input?.type === 'string' && Array.isArray(input?.coordinates)) {
    return input;
  }

  if (input?.geometry) {
    return normalizeZoomGeometry(input.geometry);
  }

  const lon = Number(input?.lon ?? input?.longitude);
  const lat = Number(input?.lat ?? input?.latitude);
  if (Number.isFinite(lon) && Number.isFinite(lat)) {
    return { type: 'Point', coordinates: [lon, lat] };
  }

  return null;
}

function mergeLayerGeometry(featureCollection: { type: 'FeatureCollection'; features: any[] } | null | undefined): any | null {
  const geoms = (featureCollection?.features || []).map((f: any) => f?.geometry).filter(Boolean);
  if (geoms.length === 0) return null;
  if (geoms.length === 1) return geoms[0];
  return { type: 'GeometryCollection', geometries: geoms };
}

function inferPrincipalGeometryType(geometry: any): 'polygon' | 'path' {
  const t = String(geometry?.type || '').toLowerCase();
  if (t.includes('polygon')) return 'polygon';
  return 'path';
}

async function postJsonWithFallbackEndpoints(
  endpoints: string[],
  body: any,
  requestHeaders: Record<string, string>,
  errorFallbackLabel: string
): Promise<any> {
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(body),
      });
      const payload = await readApiPayload(res);
      if (!res.ok) {
        lastError = new Error(toApiErrorMessage(res, payload, errorFallbackLabel));
        continue;
      }
      return payload;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error(errorFallbackLabel);
}

type AssetAskReference = {
  ref: string;
  source_id: string;
  title: string;
  file_url: string;
  doc_type: string;
  extraction_status: string;
};

type AssetAssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  references?: AssetAskReference[];
};

type AssetAssistantState = {
  assetId: string;
  assetName: string;
  input: string;
  loading: boolean;
  err: string;
  messages: AssetAssistantMessage[];
};

/** Route-aware title strip: shows registry context or standalone engineering context */
function TitleStrip() {
  const pathname = usePathname();
  const isRegistry = pathname?.includes('/assets/registry');
  return (
    <div className="h-9 shrink-0 border-b border-slate-800 bg-slate-900/80 px-4 flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.7)]">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      {isRegistry ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-cyan-300 tracking-wide">سجل الأصول</span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-[10px] text-slate-500">الإدارة الهندسية</span>
          <a
            href="/dashboard/admin-gateway"
            className="mr-auto text-[10px] text-slate-600 hover:text-slate-400 transition flex items-center gap-1"
          >
            ← بوابة النظام
          </a>
        </div>
      ) : (
        <span className="text-xs font-bold text-cyan-300 tracking-wide">وحدة الإدارة الهندسية السيادية</span>
      )}
    </div>
  );
}

function EngineeringWorkspaceInner() {
  const searchParams   = useSearchParams();
  const setWorkspace   = useGisEngine(s => s.setWorkspace);
  const selectEntity   = useGisEngine(s => s.selectEntity);
  const setDrawingMode = useGisEngine(s => s.setDrawingMode);
  const selectedEntityType = useGisEngine(s => s.selectedEntityType);
  const selectedEntityId   = useGisEngine(s => s.selectedEntityId);
  const { showToast }  = useToast();

  const currentUser   = useUserStore(s => s.current);
  const storedDept    = typeof window !== 'undefined' ? localStorage.getItem('user_department') : null;
  const caps          = getAssetCapabilities(currentUser, storedDept);
  const panelMode     = caps.canCreateMainAsset ? 'engineering' : 'general';

  // Asset-centric UI state
  const [selectedAssetId, setSelectedAssetId]   = useState<string | null>(null);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(300);
  const [assetContextMenu, setAssetContextMenu] = useState<AssetContextMenuState | null>(null);
  const [assetDocsPopup, setAssetDocsPopup] = useState<AssetDocsPopupState | null>(null);
  const [quickUpload, setQuickUpload] = useState<{ assetId: string; kind: QuickDocType } | null>(null);
  const [assetAssistant, setAssetAssistant] = useState<AssetAssistantState | null>(null);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);

  // Create principal asset modal
  const [showCreateModal, setShowCreateModal]       = useState(false);
  const [pendingGeometry, setPendingGeometry]       = useState<any>(null);
  const [pendingGeometryType, setPendingGeometryType] = useState<'polygon' | 'path' | null>(null);
  const [pendingDefaults, setPendingDefaults] = useState<{
    name?: string;
    classification?: string;
    ownerDept?: string;
    status?: string;
  } | null>(null);

  // Uploaded file features processing
  const [uploadedFeatures, setUploadedFeatures] = useState<any[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Child asset modal
  const [showChildModal, setShowChildModal]   = useState(false);
  const [principalAssets, setPrincipalAssets] = useState<PrincipalAsset[]>([]);

  // Phase 5 placeholder: LRS importer state removed — will be rebuilt with backend integration

  // Redraw principal geometry flow
  const [redrawTarget, setRedrawTarget] = useState<{ assetId: string; geometryType: string | null } | null>(null);

  // Layer extraction flow
  const [extractBusy, setExtractBusy] = useState(false);
  const [extractMode, setExtractMode] = useState<'idle' | 'polygon'>('idle');
  const [extractPanelOpen, setExtractPanelOpen] = useState(false);
  const [extractJobId, setExtractJobId] = useState<string | null>(null);
  const [extractedLayers, setExtractedLayers] = useState<ExtractedLayer[]>([]);
  const [selectedLayerKeys, setSelectedLayerKeys] = useState<string[]>([]);
  const [extractScopeLabel, setExtractScopeLabel] = useState<string>('');
  const [extractSaveName, setExtractSaveName] = useState<string>('');
  const [savingExtracted, setSavingExtracted] = useState(false);
  const [extractProgress, setExtractProgress] = useState<string>('');
  const [extractGeometry, setExtractGeometry] = useState<any>(null);
  const [extractionTab, setExtractionTab] = useState<'results' | 'catalog'>('results');

  const municipalityGeometryCacheRef = React.useRef<Record<string, any>>({});

  const resolveMunicipalityGeometry = async (municipalityKey: string): Promise<{ label: string; geometry: any } | null> => {
    const cached = municipalityGeometryCacheRef.current[municipalityKey];
    if (cached) {
      return {
        label: MUNICIPALITY_LABELS[municipalityKey] || `المنطقة ${municipalityKey}`,
        geometry: cached,
      };
    }

    const res = await fetch(`/api/geo/admin-boundary?key=${encodeURIComponent(municipalityKey)}`, {
      headers: { 'X-Tenant-ID': TENANT_ID },
      cache: 'no-store',
    });
    const data = await readApiPayload(res);
    if (!res.ok || !data?.geometry) return null;

    municipalityGeometryCacheRef.current[municipalityKey] = data.geometry;
    return {
      label: MUNICIPALITY_LABELS[municipalityKey] || data?.name || `المنطقة ${municipalityKey}`,
      geometry: data.geometry,
    };
  };

  const previewMunicipalityScope = async (municipalityKey: string) => {
    setExtractProgress('جارٍ جلب الحدود الإدارية الحقيقية...');
    try {
      const resolved = await resolveMunicipalityGeometry(municipalityKey);
      if (!resolved?.geometry) {
        setExtractProgress('');
        alert('تعذر تحميل الحدود الإدارية الحقيقية لهذه المنطقة');
        return;
      }

      const fc = geometryToFeatureCollection(resolved.label, resolved.geometry);
      setExtractScopeLabel(resolved.label);
      setExtractSaveName(resolved.label);
      window.dispatchEvent(new CustomEvent('engineering:preview-geojson', {
        detail: { featureCollection: fc },
      }));
      window.dispatchEvent(new CustomEvent('engineering:highlight-boundary', {
        detail: { geometry: resolved.geometry, name: resolved.label },
      }));
      setExtractProgress('');
    } catch {
      setExtractProgress('');
      alert('فشل جلب الحدود الإدارية الحقيقية');
    }
  };

  const loadPrincipalAssets = useCallback(async () => {
    try {
      const r = await fetch('/api/engineering/workspace/principal-assets', {
        headers: { 'X-Tenant-ID': TENANT_ID },
      });
      if (!r.ok) return;
      const rows = await r.json();
      setPrincipalAssets(Array.isArray(rows) ? rows : []);
    } catch {
      // Best-effort refresh; failure is non-blocking.
    }
  }, []);

  // Load principal assets for child modal, catalog actions, and after any save.
  useEffect(() => {
    if (!showChildModal && !(extractPanelOpen && extractionTab === 'catalog')) return;
    void loadPrincipalAssets();
  }, [showChildModal, extractPanelOpen, extractionTab, loadPrincipalAssets]);

  // Also reload principal assets whenever a new asset is saved (refresh-principal-layer event).
  useEffect(() => {
    const handler = () => void loadPrincipalAssets();
    window.addEventListener('engineering:refresh-principal-layer', handler);
    return () => window.removeEventListener('engineering:refresh-principal-layer', handler);
  }, [loadPrincipalAssets]);

  // Listen for path extension request — activate draw mode so user can draw the extension
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ assetId: string }>;
      if (!ev.detail?.assetId) return;
      // Start line draw mode — when done, AssetCenterPanel picks up the feature-drawn event
      setDrawingMode('line');
      (window as any).__extendingAssetId = ev.detail.assetId;
    };
    window.addEventListener('engineering:start-extend', handler);
    return () => window.removeEventListener('engineering:start-extend', handler);
  }, [setDrawingMode]);

  // Forward engineering:show-toast → useToast (for extend/merge feedback)
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ message: string; type?: string }>;
      const { message, type } = ev.detail ?? {};
      if (message) showToast(message, (type as any) ?? 'info');
    };
    window.addEventListener('engineering:show-toast', handler);
    return () => window.removeEventListener('engineering:show-toast', handler);
  }, [showToast]);

  // Refresh key for left panel — increment to force reload
  const [leftPanelRefreshKey, setLeftPanelRefreshKey] = useState(0);
  const [geoScadaTool, setGeoScadaTool] = useState<GeoScadaTool>('idle');

  const startResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = panelWidth;
    const minWidth = 280;
    const maxWidth = 640;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
      setPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('engineering:scada-geo-tool', {
      detail: { tool: geoScadaTool },
    }));
  }, [geoScadaTool]);

  useEffect(() => {
    setWorkspace('engineering');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyExtractionResult = (data: any, scopeLabelOverride?: string, geometry?: any) => {
    const backendLayers: ExtractedLayer[] = Array.isArray(data?.layers) ? data.layers : [];
    const layers = enrichWithRiverRouteLayer(backendLayers);
    setExtractJobId(data?.job_id || null);
    setExtractedLayers(layers);
    setSelectedLayerKeys(layers.filter(l => l.feature_count > 0).map(l => l.layer_key));
    setExtractScopeLabel(scopeLabelOverride || data?.scope_label || 'نطاق مخصص');
    setExtractSaveName(scopeLabelOverride || data?.scope_label || 'نطاق مخصص');
    setExtractGeometry(geometry || null);
    setExtractionTab('results');
    setExtractPanelOpen(true);
  };

  const saveExtractionToCatalog = useCallback(async (
    targetLayers: ExtractedLayer[],
    options?: {
      jobId?: string | null;
      scopeLabel?: string;
      geometry?: any;
      notify?: boolean;
    }
  ) => {
    if (targetLayers.length === 0) return;

    const effectiveJobId = options?.jobId ?? extractJobId;
    const effectiveScope = options?.scopeLabel ?? (extractSaveName.trim() || extractScopeLabel || 'نطاق مخصص');

    await fetch('/api/extraction-catalog/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
      },
      body: JSON.stringify({
        jobId: effectiveJobId,
        regionKey: effectiveScope.toLowerCase().replace(/\s+/g, '_'),
        scopeLabel: effectiveScope,
        geometry: options?.geometry ?? extractGeometry,
        layerData: targetLayers.map((layer) => ({
          layer_key: layer.layer_key,
          layer_name: layer.layer_name,
          feature_count: layer.feature_count,
          color: layer.color,
          geojson: layer.geojson,
          virtual: Boolean(layer.virtual),
        })),
        backendJobId: effectiveJobId,
        createdBy: currentUser?.email || 'system',
      }),
    });

    if (options?.notify) {
      alert('تم حفظ التفكيك في المكتبة بنجاح');
    }
  }, [
    currentUser?.email,
    extractGeometry,
    extractJobId,
    extractSaveName,
    extractScopeLabel,
  ]);

  const saveLayersAsPrincipal = useCallback(async (
    targetLayers: ExtractedLayer[],
    options?: {
      jobId?: string | null;
      scopeLabel?: string;
      geometry?: any;
      closePanel?: boolean;
    }
  ) => {
    const backendLayerKeys = targetLayers
      .map((l) => l.layer_key)
      .filter((k) => !String(k).startsWith('__virtual_'));

    if (targetLayers.length === 0) {
      alert('اختر طبقة واحدة على الأقل للحفظ');
      return;
    }

    setSavingExtracted(true);
    try {
      const effectiveJobId = options?.jobId ?? extractJobId;
      const effectiveScope = options?.scopeLabel ?? (extractSaveName.trim() || extractScopeLabel);
      let backendSaveFailed = false;

      if (effectiveJobId && backendLayerKeys.length > 0) {
        try {
          await postJsonWithFallbackEndpoints(
            EXTRACTION_SAVE_ENDPOINTS,
            {
              job_id: effectiveJobId,
              layer_keys: backendLayerKeys,
              name_prefix: effectiveScope,
            },
            {
              'Content-Type': 'application/json',
              'X-Tenant-ID': TENANT_ID,
            },
            'فشل الحفظ'
          );
        } catch (saveErr) {
          backendSaveFailed = true;
          console.warn('Backend extraction save failed, using direct fallback save', saveErr);
        }
      } else {
        backendSaveFailed = true;
      }

      if (backendSaveFailed) {
        const createOps = targetLayers.map(async (layer) => {
          const geometry = mergeLayerGeometry(layer.geojson);
          if (!geometry) return;

          await fetch('/api/engineering/workspace/principal-assets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': TENANT_ID,
            },
            body: JSON.stringify({
              name: `${effectiveScope} — ${layer.layer_name}`,
              geometry_type: inferPrincipalGeometryType(geometry),
              classification: layer.layer_key,
              owner_department: 'engineering',
              status: 'active',
              geometry,
              properties: {
                source: 'layer_extraction_fallback',
                extract_job_id: effectiveJobId,
                virtual: Boolean(layer.virtual),
              },
              tenant_id: TENANT_ID,
            }),
          });
        });
        await Promise.allSettled(createOps);
      }

      await saveExtractionToCatalog(targetLayers, {
        jobId: effectiveJobId,
        scopeLabel: effectiveScope,
        geometry: options?.geometry ?? extractGeometry,
      }).catch((err) => {
        console.warn('Failed to save to catalog:', err);
      });

      if (options?.closePanel !== false) {
        setExtractPanelOpen(false);
      }
      setExtractedLayers([]);
      setSelectedLayerKeys([]);
      setExtractJobId(null);
      setExtractGeometry(null);
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
      setLeftPanelRefreshKey((k) => k + 1);
      alert('تم حفظ الطبقات بنجاح وإضافتها إلى المكتبة');
    } catch (err) {
      alert(`فشل الحفظ: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    } finally {
      setSavingExtracted(false);
    }
  }, [
    extractGeometry,
    extractJobId,
    extractSaveName,
    extractScopeLabel,
    saveExtractionToCatalog,
  ]);

  const runLayerExtraction = async (
    payload: { scope_type: 'polygon' | 'municipality'; geometry?: any; municipality?: string; },
    options?: { scopeLabel?: string }
  ) => {
    setExtractBusy(true);
    setExtractProgress('جاري تحضير التفكيك...');

    try {
      const data = await retryWithBackoff(
        async () => {
          return await postJsonWithFallbackEndpoints(
            EXTRACTION_RUN_ENDPOINTS,
            payload,
            {
              'Content-Type': 'application/json',
              'X-Tenant-ID': TENANT_ID,
            },
            'فشل التفكيك'
          );
        },
        3,
        (msg) => {
          setExtractProgress(msg);
        }
      );

      const scopeLabel = options?.scopeLabel || data?.scope_label || 'نطاق مخصص';
      const enrichedLayers = enrichWithRiverRouteLayer(Array.isArray(data?.layers) ? data.layers : []);

      setExtractProgress('جاري حفظ نتيجة التفكيك في المكتبة...');
      try {
        await saveExtractionToCatalog(enrichedLayers, {
          jobId: data?.job_id || null,
          scopeLabel,
          geometry: payload.geometry,
        });
        setExtractProgress('تم حفظ التفكيك تلقائيًا في المكتبة');
      } catch (catalogErr) {
        console.warn('Auto-save extraction to catalog failed:', catalogErr);
        setExtractProgress('تم التفكيك، لكن الحفظ التلقائي في المكتبة فشل');
      }

      applyExtractionResult({ ...data, layers: enrichedLayers }, scopeLabel, payload.geometry);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'خطأ غير معروف';
      console.error('Extraction failed', err);
      setExtractProgress('');
      alert(`فشل التفكيك الحقيقي: ${errorMsg}`);
    } finally {
      setExtractBusy(false);
      setExtractMode('idle');
      setDrawingMode('idle');
    }
  };

  const previewFeatureCollection = useMemo(() => {
    const selected = new Set(selectedLayerKeys);
    const features = extractedLayers
      .filter(layer => selected.has(layer.layer_key))
      .flatMap(layer => (layer.geojson?.features || []).map((f: any) => ({
        ...f,
        properties: {
          ...(f.properties || {}),
          __layer_key: layer.layer_key,
          __layer_name: layer.layer_name,
          __layer_color: layer.color,
        },
      })));
    return { type: 'FeatureCollection', features } as { type: 'FeatureCollection'; features: any[] };
  }, [extractedLayers, selectedLayerKeys]);

  useEffect(() => {
    if (!extractPanelOpen) return;
    window.dispatchEvent(new CustomEvent('engineering:preview-geojson', {
      detail: { featureCollection: previewFeatureCollection },
    }));
  }, [extractPanelOpen, previewFeatureCollection]);

  // Listen for drawing-complete event from MapCenterCanvas
  useEffect(() => {
    const handler = async (e: Event) => {
      // When child modal is open, drawing belongs to child flow and must not create principal assets.
      if (showChildModal) return;
      // Skip if child asset geometry picking is active
      if ((window as any).__childGeometryPicking) return;

      // Extension flow — append new segment to existing asset
      const extendingId = (window as any).__extendingAssetId;
      const ev = e as CustomEvent<{ geometry: any; mode: string }>;
      const { geometry, mode } = ev.detail ?? {};
      if (!geometry) return;

      if (extendingId) {
        (window as any).__extendingAssetId = null;
        setDrawingMode('idle');
        const newCoords = geometry.type === 'LineString' ? geometry.coordinates : null;
        if (!newCoords) return;
        try {
          const r = await fetch(`/api/v1/workspace/assets/${extendingId}/extend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
            body: JSON.stringify({ new_coordinates: newCoords }),
          });
          const result = await r.json().catch(() => ({}));
          if (r.ok) {
            const km = result.length_km ? `${result.length_km} كم` : '';
            window.dispatchEvent(new CustomEvent('engineering:show-toast', { detail: { message: `✅ تم تمديد المسار${km ? ` — الطول: ${km}` : ''}`, type: 'success' } }));
            window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
            window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
            setLeftPanelRefreshKey(k => k + 1);
          } else {
            window.dispatchEvent(new CustomEvent('engineering:show-toast', { detail: { message: `فشل تمديد المسار: ${result.detail || result.error || r.status}`, type: 'error' } }));
            console.warn('Extend failed:', result);
          }
        } catch { /* ignore */ }
        return;
      }

      // Extraction flow (polygon scope)
      if (extractMode === 'polygon') {
        await runLayerExtraction({ scope_type: 'polygon', geometry });
        return;
      }

      // Geometry redraw flow for an existing principal asset.
      if (redrawTarget?.assetId) {
        try {
          const res = await fetch(`/api/engineering/workspace/principal-assets/${redrawTarget.assetId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': TENANT_ID,
            },
            body: JSON.stringify({ geometry }),
          });
          if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
          window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
          window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
          setLeftPanelRefreshKey(k => k + 1);
        } finally {
          setRedrawTarget(null);
          setDrawingMode('idle');
        }
        return;
      }

      const gType: 'polygon' | 'path' =
        mode === 'polygon' || mode === 'orthogonal-polygon' ? 'polygon' : 'path';
      setPendingGeometry(geometry);
      setPendingGeometryType(gType);
      setShowCreateModal(true);
    };
    window.addEventListener('engineering:feature-drawn', handler as EventListener);
    return () => window.removeEventListener('engineering:feature-drawn', handler as EventListener);
  }, [extractMode, redrawTarget, setDrawingMode, showChildModal]);

  // Listen for uploaded file features and start creation flow
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ features: Array<{ geometry: any; properties?: Record<string, any> }>; fileName: string }>;
      const { features, fileName } = ev.detail ?? {};
      if (!features || features.length === 0) return;
      
      // Extract geometry from features and determine types
      const geoms = features.map(f => ({
        geometry: f.geometry,
        type: f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon' ? 'polygon' : 'path',
      }));
      
      setUploadedFeatures(features);
      setUploadedFileName(fileName);
      setCurrentUploadIndex(0);
      
      // Open modal for first feature
      if (geoms.length > 0) {
        setPendingGeometry(geoms[0].geometry);
        setPendingGeometryType(geoms[0].type as 'polygon' | 'path');
        const p = features[0]?.properties || {};
        setPendingDefaults({
          name: typeof p.asset_name === 'string' ? p.asset_name : undefined,
          classification: typeof p.asset_type === 'string' ? p.asset_type : undefined,
          ownerDept: typeof p.owner_department === 'string' ? p.owner_department : undefined,
          status: typeof p.status === 'string' ? p.status : undefined,
        });
        setShowCreateModal(true);
      }
    };
    window.addEventListener('engineering:process-uploaded-features', handler as EventListener);
    return () => window.removeEventListener('engineering:process-uploaded-features', handler as EventListener);
  }, []);

  // Keep selectedAssetId in sync with gisEngine
  useEffect(() => {
    if (selectedEntityType === 'asset' && selectedEntityId) {
      setSelectedAssetId(String(selectedEntityId));
    } else if (!selectedEntityType) {
      setSelectedAssetId(null);
    }
  }, [selectedEntityType, selectedEntityId]);

  // Deep-link support from admin-gateway shared panel:
  // /engineering-workspace?asset=<id>&child=<id>
  useEffect(() => {
    const assetId = searchParams?.get('asset');
    const childId = searchParams?.get('child');
    const targetId = childId || assetId;
    if (!targetId) return;

    setSelectedAssetId(targetId);
    selectEntity('asset', targetId);
  }, [searchParams, selectEntity]);

  // Ensure map zoom works for asset selection regardless of source
  // (left list, map click, center panel child navigation, etc.).
  useEffect(() => {
    if (selectedEntityType !== 'asset' || !selectedEntityId) return;
    let cancelled = false;

    (async () => {
      try {
        const center = await workspaceApi.getAssetCenter(String(selectedEntityId));
        if (cancelled) return;

        // Guard against null/undefined responses
        if (!center) return;

        const geometry =
          normalizeZoomGeometry(center?.asset?.geometry) ??
          normalizeZoomGeometry(center?.asset?.geometry_json) ??
          normalizeZoomGeometry(center?.geometry) ??
          normalizeZoomGeometry(center?.coordinates);

        if (!geometry) return;
        window.dispatchEvent(
          new CustomEvent('engineering:zoom-to-asset', { detail: { geometry } })
        );
      } catch {
        // Non-blocking: panel can still open even if zoom data fetch fails.
      }
    })();

    return () => { cancelled = true; };
  }, [selectedEntityType, selectedEntityId]);

  const handleSelectAsset = (id: string | null) => {
    setSelectedAssetId(id);
    if (id) selectEntity('asset', id);
    else selectEntity(null, null);
  };

  const handleCreateSaved = (asset: { id: string; name: string }) => {
    const nextIndex = currentUploadIndex + 1;
    if (uploadedFeatures.length > 0 && nextIndex < uploadedFeatures.length) {
      const next = uploadedFeatures[nextIndex];
      const nextType: 'polygon' | 'path' =
        next?.geometry?.type === 'Polygon' || next?.geometry?.type === 'MultiPolygon' ? 'polygon' : 'path';
      const p = next?.properties || {};
      setCurrentUploadIndex(nextIndex);
      setPendingGeometry(next?.geometry || null);
      setPendingGeometryType(nextType);
      setPendingDefaults({
        name: typeof p.asset_name === 'string' ? p.asset_name : undefined,
        classification: typeof p.asset_type === 'string' ? p.asset_type : undefined,
        ownerDept: typeof p.owner_department === 'string' ? p.owner_department : undefined,
        status: typeof p.status === 'string' ? p.status : undefined,
      });
      setShowCreateModal(true);
    } else {
      setShowCreateModal(false);
      setPendingGeometry(null);
      setPendingGeometryType(null);
      setPendingDefaults(null);
      setUploadedFeatures([]);
      setUploadedFileName('');
      setCurrentUploadIndex(0);
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      setLeftPanelRefreshKey(k => k + 1);
      window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
    }
  };

  const handleChildSaved = () => {
    setShowChildModal(false);
    setLeftPanelRefreshKey(k => k + 1);
    // Refresh child assets layer on map
    window.dispatchEvent(new CustomEvent('engineering:refresh-child-layer'));
  };

  useEffect(() => {
    const redrawHandler = (e: Event) => {
      const ev = e as CustomEvent<{ assetId: string; geometryType: string | null }>;
      const target = ev.detail;
      if (!target?.assetId) return;
      setRedrawTarget(target);
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      setGeoScadaTool('idle');
      const gt = (target.geometryType || '').toLowerCase();
      if (gt.includes('line') || gt === 'path') setDrawingMode('line');
      else setDrawingMode('polygon');
    };
    window.addEventListener('engineering:redraw-asset', redrawHandler as EventListener);
    return () => window.removeEventListener('engineering:redraw-asset', redrawHandler as EventListener);
  }, [setDrawingMode]);

  useEffect(() => {
    const openContextMenu = (e: Event) => {
      const ev = e as CustomEvent<{ assetId: string; clientX: number; clientY: number }>;
      const assetId = String(ev.detail?.assetId || '').trim();
      if (!assetId) return;
      setSelectedAssetId(assetId);
      selectEntity('asset', assetId);
      setAssetDocsPopup(null);
      setAssetContextMenu({
        assetId,
        clientX: Number(ev.detail?.clientX || 0),
        clientY: Number(ev.detail?.clientY || 0),
      });
    };

    const closeContextMenu = () => setAssetContextMenu(null);
    window.addEventListener('engineering:asset-context-menu', openContextMenu as EventListener);
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('scroll', closeContextMenu, true);
    return () => {
      window.removeEventListener('engineering:asset-context-menu', openContextMenu as EventListener);
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('scroll', closeContextMenu, true);
    };
  }, [selectEntity]);

  const openAssetDocsPopup = useCallback(async (assetId: string, x: number, y: number) => {
    try {
      const center = await workspaceApi.getAssetCenter(assetId);
      const docs = Array.isArray(center?.documents) ? center.documents : [];
      setAssetDocsPopup({
        assetId,
        title: String(center?.asset?.asset_name || 'وثائق الأصل'),
        clientX: x,
        clientY: y,
        docs: docs.slice(0, 15),
      });
    } catch (e: any) {
      showToast(`تعذر تحميل المرفقات: ${e?.message || 'خطأ غير معروف'}`, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ assetId: string; clientX: number; clientY: number }>;
      const assetId = String(ev.detail?.assetId || '').trim();
      if (!assetId) return;
      void openAssetDocsPopup(assetId, Number(ev.detail?.clientX || 80), Number(ev.detail?.clientY || 120));
    };

    window.addEventListener('engineering:open-asset-doc-popup', handler as EventListener);
    return () => window.removeEventListener('engineering:open-asset-doc-popup', handler as EventListener);
  }, [openAssetDocsPopup]);

  useEffect(() => {
    let cancelled = false;

    const publishAssetDocsOverlay = async () => {
      if (!selectedAssetId) {
        window.dispatchEvent(new CustomEvent('engineering:clear-asset-doc-overlay'));
        return;
      }

      try {
        const center = await workspaceApi.getAssetCenter(selectedAssetId);
        if (cancelled) return;
        const docs = Array.isArray(center?.documents) ? center.documents : [];
        window.dispatchEvent(new CustomEvent('engineering:show-asset-doc-overlay', {
          detail: {
            assetId: selectedAssetId,
            assetName: String(center?.asset?.asset_name || ''),
            geometry: center?.asset?.geometry || center?.asset?.geometry_json || center?.geometry || null,
            docs,
          },
        }));
      } catch {
        if (!cancelled) {
          window.dispatchEvent(new CustomEvent('engineering:clear-asset-doc-overlay'));
        }
      }
    };

    void publishAssetDocsOverlay();
    return () => { cancelled = true; };
  }, [selectedAssetId]);

  const startQuickUpload = useCallback((kind: QuickDocType) => {
    if (!assetContextMenu?.assetId) return;
    setQuickUpload({ assetId: assetContextMenu.assetId, kind });
    setAssetContextMenu(null);
    setTimeout(() => quickFileInputRef.current?.click(), 0);
  }, [assetContextMenu]);

  const triggerAssetKnowledgeIngest = useCallback(async (assetId: string) => {
    try {
      const res = await fetch(`/api/knowledge/assets/${encodeURIComponent(assetId)}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(TENANT_ID ? { 'X-Tenant-ID': TENANT_ID } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await readApiPayload(res);
      if (!res.ok || !data?.ok) return null;
      return {
        linked: Number(data?.stats?.linked_sources || 0),
        ingested: Number(data?.stats?.ingested_sources || 0),
        needsOcr: Number(data?.stats?.needs_ocr_sources || 0),
      };
    } catch {
      return null;
    }
  }, []);

  const openAssetAssistant = useCallback(async (assetId: string) => {
    try {
      const center = await workspaceApi.getAssetCenter(assetId);
      const assetName = String(center?.asset?.asset_name || 'الأصل');
      setAssetAssistant({
        assetId,
        assetName,
        input: '',
        loading: false,
        err: '',
        messages: [
          {
            id: `assistant:init:${Date.now()}`,
            role: 'assistant',
            text: 'أنا مساعد هذا الأصل. اسأل بأي صيغة تريد، وسأجيب فقط من المعرفة المفهرسة الخاصة بهذا الأصل مع المراجع. إذا لم توجد بيانات كافية سأخبرك بذلك.',
          },
        ],
      });
    } catch (e: any) {
      showToast(`تعذر فتح مساعد الأصل: ${e?.message || 'خطأ غير معروف'}`, 'error');
    }
  }, [showToast]);

  const sendAssistantQuestion = useCallback(async () => {
    const st = assetAssistant;
    if (!st) return;

    const q = st.input.trim();
    if (!q || st.loading) return;

    const userMsg: AssetAssistantMessage = {
      id: `user:${Date.now()}`,
      role: 'user',
      text: q,
    };

    setAssetAssistant((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        input: '',
        loading: true,
        err: '',
        messages: [...prev.messages, userMsg],
      };
    });

    try {
      const res = await fetch(`/api/knowledge/assets/${encodeURIComponent(st.assetId)}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(TENANT_ID ? { 'X-Tenant-ID': TENANT_ID } : {}),
        },
        body: JSON.stringify({ question: q }),
      });

      const data = await readApiPayload(res);
      if (!res.ok || !data?.ok) {
        throw new Error(toApiErrorMessage(res, data, 'تعذر استدعاء مساعد الأصل'));
      }

      const refs: AssetAskReference[] = Array.isArray(data?.references) ? data.references : [];
      const assistantMsg: AssetAssistantMessage = {
        id: `assistant:${Date.now()}`,
        role: 'assistant',
        text: String(data?.answer || 'لا توجد إجابة متاحة.'),
        references: refs,
      };

      setAssetAssistant((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          loading: false,
          messages: [...prev.messages, assistantMsg],
        };
      });
    } catch (e: any) {
      setAssetAssistant((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          loading: false,
          err: String(e?.message || 'تعذر إرسال السؤال'),
        };
      });
    }
  }, [assetAssistant]);

  const handleQuickFilePicked = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
    e.target.value = '';
    if (!file || !quickUpload) return;

    try {
      const mapped = mapQuickDocType(quickUpload.kind);
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      uploadForm.append('docType', mapped.docType);

      const uploadRes = await fetch('/api/engineering/workspace/uploads', {
        method: 'POST',
        headers: {
          ...(TENANT_ID ? { 'X-Tenant-ID': TENANT_ID } : {}),
        },
        body: uploadForm,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData?.fileUrl) {
        throw new Error(uploadData?.error || `Upload failed (${uploadRes.status})`);
      }

      await workspaceApi.addAssetDocument(quickUpload.assetId, {
        doc_type: mapped.docType,
        title: file.name,
        file_url: String(uploadData.fileUrl),
        file_size: Number(uploadData.fileSize) || undefined,
        department: mapped.department,
        notes: '[source:context-menu-upload]',
      });

      window.dispatchEvent(new CustomEvent('engineering:asset-doc-updated', {
        detail: { assetId: quickUpload.assetId, delta: 1 },
      }));

      const ingestStats = await triggerAssetKnowledgeIngest(quickUpload.assetId);
      const center = await workspaceApi.getAssetCenter(quickUpload.assetId);
      const docs = Array.isArray(center?.documents) ? center.documents : [];
      window.dispatchEvent(new CustomEvent('engineering:show-asset-doc-overlay', {
        detail: {
          assetId: quickUpload.assetId,
          assetName: String(center?.asset?.asset_name || ''),
          geometry: center?.asset?.geometry || center?.asset?.geometry_json || center?.geometry || null,
          docs,
        },
      }));

      showToast('تم رفع الوثيقة وربطها بالأصل', 'success');
      if (ingestStats) {
        showToast(`تم تحديث معرفة الأصل: ${ingestStats.ingested} معالجة نصية، ${ingestStats.needsOcr} تحتاج OCR`, 'info');
      }

      setSelectedAssetId(quickUpload.assetId);
      await openAssetDocsPopup(quickUpload.assetId, 64, 120);
    } catch (err: any) {
      showToast(`فشل رفع الوثيقة: ${err?.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setQuickUpload(null);
    }
  }, [openAssetDocsPopup, quickUpload, showToast, triggerAssetKnowledgeIngest]);

  return (
    <GisErrorBoundary title="تعذر تحميل مساحة العمل الهندسية">
      <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-200 overflow-hidden relative" dir="rtl">

        {/* Title strip — route-aware */}
        <TitleStrip />

        {/* Asset-centric toolbar */}
        <AssetTopBar
          onAddChildAsset={() => setShowChildModal(true)}
          onOpenIntelligence={() => setIntelligenceOpen(v => !v)}
          intelligenceOpen={intelligenceOpen}
          geoScadaTool={geoScadaTool}
          onSelectGeoScadaTool={(tool) => {
            window.dispatchEvent(new CustomEvent('engineering:scada-geo-tool', {
              detail: { tool },
            }));
            setGeoScadaTool(tool);
            if (tool === 'path') {
              setDrawingMode('line');
              return;
            }
            if (tool === 'tank') {
              setDrawingMode('polygon');
              return;
            }
            if (tool === 'pump' || tool === 'valve') {
              setDrawingMode('point');
              return;
            }
            if (tool === 'delete') {
              setDrawingMode('delete');
              return;
            }
            setDrawingMode('idle');
          }}
          onClearGeoScada={() => {
            setGeoScadaTool('idle');
            setDrawingMode('idle');
            window.dispatchEvent(new CustomEvent('engineering:scada-geo-clear'));
          }}
          extractionBusy={extractBusy}
          onStartLayerExtractionPolygon={() => {
            setGeoScadaTool('idle');
            setExtractMode('polygon');
            setDrawingMode('polygon');
            window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
          }}
          onRunMunicipalityExtraction={async (municipalityKey) => {
            const resolved = await resolveMunicipalityGeometry(municipalityKey);
            const scopeLabel = resolved?.label || MUNICIPALITY_LABELS[municipalityKey] || `المنطقة ${municipalityKey}`;

            if (!resolved?.geometry) {
              alert('تعذر تحميل الحدود الإدارية الحقيقية، لذلك تم إيقاف التفكيك (بدون محاكاة).');
              return;
            }

            // Real extraction only: run by actual administrative polygon geometry.
            await runLayerExtraction(
              { scope_type: 'polygon', geometry: resolved.geometry },
              { scopeLabel }
            );
          }}
          onMunicipalityChange={(municipalityKey) => {
            void previewMunicipalityScope(municipalityKey);
          }}
        />

        <div className="flex flex-1 overflow-hidden relative z-0">
          {/* Sidebar: asset list OR asset detail panel — never both at once */}
          {selectedAssetId ? (
            <AssetCenterPanel
              assetId={selectedAssetId}
              panelWidth={panelWidth}
              onClose={() => handleSelectAsset(null)}
              onSelectChild={(childId) => handleSelectAsset(childId)}
              onRedrawGeometry={(geometryType) => {
                if (!selectedAssetId) return;
                window.dispatchEvent(new CustomEvent('engineering:redraw-asset', {
                  detail: { assetId: selectedAssetId, geometryType },
                }));
              }}
            />
          ) : (
            <AssetLeftPanel
              selectedAssetId={selectedAssetId}
              onSelectAsset={handleSelectAsset}
              onCreatePrincipal={() => { setPendingGeometry(null); setPendingGeometryType(null); setShowCreateModal(true); }}
              refreshKey={leftPanelRefreshKey}
              mode={panelMode}
            />
          )}

          {/* Resize handle — drag to widen/narrow the detail panel */}
          {selectedAssetId && (
            <div
              onMouseDown={startResize}
              className="w-1.5 shrink-0 cursor-col-resize bg-slate-800 hover:bg-cyan-500/50 active:bg-cyan-400 transition-colors z-20 select-none"
              title="اسحب لتغيير عرض اللوحة"
            />
          )}

          {/* Map — always takes remaining space */}
          <main className="flex flex-1 relative">
            <MapCenterCanvas hideControls={true} />

            {assetContextMenu && (
              <div
                className="fixed z-[9300] min-w-[220px] rounded-xl border border-slate-600 bg-slate-900/95 shadow-2xl backdrop-blur p-1"
                style={{ top: assetContextMenu.clientY, left: assetContextMenu.clientX }}
                onClick={(evt) => evt.stopPropagation()}
              >
                <button onClick={() => startQuickUpload('financial')} className="w-full text-right px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/15 rounded-lg">إضافة ملف مالي</button>
                <button onClick={() => startQuickUpload('admin')} className="w-full text-right px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/15 rounded-lg">إضافة ملف إداري</button>
                <button onClick={() => startQuickUpload('technical')} className="w-full text-right px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/15 rounded-lg">إضافة ملف فني</button>
                <button onClick={() => startQuickUpload('photo')} className="w-full text-right px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-500/15 rounded-lg">إضافة صورة</button>
                <button onClick={() => startQuickUpload('drawing')} className="w-full text-right px-3 py-2 text-xs text-sky-300 hover:bg-sky-500/15 rounded-lg">إضافة خريطة/رسم</button>
                <div className="my-1 border-t border-slate-700" />
                <button
                  onClick={() => {
                    const st = assetContextMenu;
                    setAssetContextMenu(null);
                    if (st?.assetId) void openAssetAssistant(st.assetId);
                  }}
                  className="w-full text-right px-3 py-2 text-xs text-fuchsia-300 hover:bg-fuchsia-500/15 rounded-lg"
                >
                  فتح مساعد الأصل الذكي
                </button>
                <button
                  onClick={() => {
                    const st = assetContextMenu;
                    setAssetContextMenu(null);
                    void openAssetDocsPopup(st.assetId, st.clientX, st.clientY);
                  }}
                  className="w-full text-right px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/60 rounded-lg"
                >
                  عرض المرفقات
                </button>
              </div>
            )}

            {assetDocsPopup && (
              <div
                className="fixed z-[9300] w-[360px] max-w-[92vw] rounded-2xl border border-slate-600 bg-slate-950/95 shadow-2xl backdrop-blur"
                style={{ top: assetDocsPopup.clientY + 8, left: assetDocsPopup.clientX + 8 }}
                onClick={(evt) => evt.stopPropagation()}
              >
                <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-300 font-semibold">مرفقات الأصل</p>
                    <p className="text-[11px] text-slate-500 truncate">{assetDocsPopup.title}</p>
                  </div>
                  <button onClick={() => setAssetDocsPopup(null)} className="text-slate-400 hover:text-white text-xs">إغلاق</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-800">
                  {assetDocsPopup.docs.length === 0 ? (
                    <p className="px-3 py-5 text-center text-xs text-slate-500">لا توجد مرفقات بعد</p>
                  ) : (() => {
                    const groups: Array<{ key: string; label: string; docs: typeof assetDocsPopup.docs }> = [
                      { key: 'financial', label: 'وثائق مالية', docs: assetDocsPopup.docs.filter((d) => d.doc_type === 'financial') },
                      { key: 'admin', label: 'وثائق إدارية', docs: assetDocsPopup.docs.filter((d) => ['admin', 'contract'].includes(d.doc_type)) },
                      { key: 'technical', label: 'وثائق فنية', docs: assetDocsPopup.docs.filter((d) => ['technical', 'manual'].includes(d.doc_type)) },
                      { key: 'photos', label: 'الصور', docs: assetDocsPopup.docs.filter((d) => d.doc_type === 'photo') },
                      { key: 'maps', label: 'خرائط ورسومات', docs: assetDocsPopup.docs.filter((d) => d.doc_type === 'drawing') },
                      { key: 'other', label: 'أخرى', docs: assetDocsPopup.docs.filter((d) => !['financial', 'admin', 'contract', 'technical', 'manual', 'photo', 'drawing'].includes(d.doc_type)) },
                    ];

                    return groups.filter((g) => g.docs.length > 0).map((g) => (
                      <div key={g.key} className="px-3 py-2">
                        <p className="text-[11px] font-semibold text-slate-300 mb-1.5">{g.label}</p>
                        <div className="space-y-1.5">
                          {g.docs.map((d) => (
                            <div key={d.id} className="px-2 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800">
                              <p className="text-xs text-slate-100 truncate">{d.title}</p>
                              <div className="flex items-center justify-between mt-1 gap-2">
                                <span className="text-[10px] text-slate-500">{d.doc_type}</span>
                                <div className="flex items-center gap-2">
                                  {d.file_url ? (
                                    <>
                                      <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-300 hover:text-cyan-200">فتح</a>
                                      <a href={`${d.file_url}${d.file_url.includes('?') ? '&' : '?'}download=1`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-300 hover:text-emerald-200">تنزيل</a>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">بدون رابط ملف</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                      {assetAssistant && (
                        <div
                          className="fixed z-[9400] right-6 bottom-6 w-[460px] max-w-[95vw] max-h-[78vh] rounded-2xl border border-slate-600 bg-slate-950/95 shadow-2xl backdrop-blur flex flex-col"
                          onClick={(evt) => evt.stopPropagation()}
                        >
                          <div className="px-4 py-3 border-b border-slate-700 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-fuchsia-300">مساعد الأصل الذكي</p>
                              <p className="text-[11px] text-slate-400 truncate">{assetAssistant.assetName}</p>
                              <p className="text-[10px] text-amber-300 mt-1">الإجابة مقيدة ببيانات هذا الأصل المفهرسة فقط.</p>
                            </div>
                            <button
                              onClick={() => setAssetAssistant(null)}
                              className="text-slate-400 hover:text-white text-xs"
                            >
                              إغلاق
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {assetAssistant.messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`rounded-xl border px-3 py-2 ${msg.role === 'assistant' ? 'bg-slate-800/80 border-slate-700 text-slate-100' : 'bg-cyan-900/25 border-cyan-700/40 text-cyan-100'}`}
                              >
                                <p className="text-xs whitespace-pre-line leading-relaxed">{msg.text}</p>
                                {msg.references && msg.references.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {msg.references.map((r) => (
                                      <a
                                        key={`${msg.id}:${r.ref}:${r.source_id}`}
                                        href={r.file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block text-[10px] text-cyan-300 hover:text-cyan-200 truncate"
                                        title={`${r.title} (${r.doc_type})`}
                                      >
                                        [{r.ref}] {r.title}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="p-3 border-t border-slate-700 space-y-2">
                            <textarea
                              value={assetAssistant.input}
                              onChange={(e) => setAssetAssistant((prev) => prev ? { ...prev, input: e.target.value } : prev)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  void sendAssistantQuestion();
                                }
                              }}
                              rows={2}
                              placeholder="اسأل بحرية: تاريخ الصيانة، وضع الأصل، المخاطر، الإجراءات..."
                              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100"
                            />

                            {assetAssistant.err && (
                              <p className="text-[11px] text-red-300">{assetAssistant.err}</p>
                            )}

                            <div className="flex items-center justify-between">
                              <p className="text-[10px] text-slate-500">Enter للإرسال • Shift+Enter لسطر جديد</p>
                              <button
                                onClick={() => void sendAssistantQuestion()}
                                disabled={assetAssistant.loading || !assetAssistant.input.trim()}
                                className="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-semibold disabled:opacity-50"
                              >
                                {assetAssistant.loading ? 'جارٍ التحليل...' : 'إرسال'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
              </div>
            )}

            <input
              ref={quickFileInputRef}
              type="file"
              className="hidden"
              onChange={handleQuickFilePicked}
            />
          </main>
        </div>

        {/* Intelligence overlay */}
        {intelligenceOpen && (
          <IntelligencePanel onClose={() => setIntelligenceOpen(false)} />
        )}

        {/* Create Principal Asset Modal */}
        {showCreateModal && (
          <CreatePrincipalAssetModal
            geometry={pendingGeometry}
            geometryType={pendingGeometryType}
            defaultName={pendingDefaults?.name}
            defaultClassification={pendingDefaults?.classification}
            defaultOwnerDepartment={pendingDefaults?.ownerDept}
            defaultStatus={pendingDefaults?.status}
            uploadProgress={uploadedFeatures.length > 0 ? {
              fileName: uploadedFileName,
              index: currentUploadIndex,
              total: uploadedFeatures.length,
            } : undefined}
            onSaved={handleCreateSaved}
            onClose={() => {
              setShowCreateModal(false);
              setPendingGeometry(null);
              setPendingGeometryType(null);
              setPendingDefaults(null);
              setUploadedFeatures([]);
              setUploadedFileName('');
              setCurrentUploadIndex(0);
              window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
            }}
            onStartDrawing={(mode) => {
              setShowCreateModal(false);
              setPendingGeometry(null);
              setPendingGeometryType(null);
              setPendingDefaults(null);
              setGeoScadaTool('idle');
              setDrawingMode(mode === 'polygon' ? 'polygon' : 'line');
            }}
          />
        )}

        {!extractPanelOpen && (
          <button
            onClick={() => {
              setExtractionTab('catalog');
              setExtractPanelOpen(true);
            }}
            className="fixed top-24 left-8 z-[9000] rounded-xl border border-cyan-500/40 bg-slate-900/90 px-3 py-2 text-xs text-cyan-200 hover:bg-slate-800"
          >
            مكتبة التفكيكات
          </button>
        )}

        {/* Layer extraction result panel */}
        {extractPanelOpen && (
          <div className="fixed top-20 bottom-4 left-8 z-[9100] w-[760px] max-w-[96vw] rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur flex flex-col" dir="rtl">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex gap-3 items-start justify-between">
                  <div>
                    <h3 className="text-sm text-cyan-300 font-bold">
                      {extractionTab === 'results' ? 'نتيجة تفكيك الطبقات' : 'مكتبة التفكيكات'}
                    </h3>
                    {extractionTab === 'results' && (
                      <p className="text-xs text-slate-400 mt-0.5">النطاق: {extractScopeLabel}</p>
                    )}
                  </div>
                </div>
                {extractProgress && (
                  <p className="text-xs text-amber-300 mt-2 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
                    {extractProgress}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setExtractPanelOpen(false);
                  setExtractProgress('');
                  window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700 bg-slate-800/50">
              <button
                onClick={() => setExtractionTab('results')}
                className={`flex-1 px-3 py-2 text-xs font-medium transition ${
                  extractionTab === 'results'
                    ? 'text-cyan-300 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                النتائج
              </button>
              <button
                onClick={() => setExtractionTab('catalog')}
                className={`flex-1 px-3 py-2 text-xs font-medium transition ${
                  extractionTab === 'catalog'
                    ? 'text-cyan-300 border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                المكتبة
              </button>
            </div>

            <div className="p-3 space-y-2 flex-1 min-h-0 overflow-auto">
              {extractionTab === 'results' ? (
                <>
                  {extractedLayers.length === 0 && !extractProgress ? (
                    <div className="text-center py-4 text-slate-400 text-xs">لا توجد طبقات محملة</div>
                  ) : extractProgress ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                      <p className="text-xs text-slate-300">{extractProgress}</p>
                    </div>
                  ) : (
                    extractedLayers.map(layer => (
                      <label key={layer.layer_key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 px-3 py-2 bg-slate-800/60">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-100 truncate">{layer.layer_name}</div>
                          <div className="text-xs text-slate-400">{layer.feature_count} عنصر{layer.virtual ? ' (افتراضي)' : ''}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedLayerKeys.includes(layer.layer_key)}
                          onChange={(e) => {
                            setSelectedLayerKeys(prev => e.target.checked
                              ? [...new Set([...prev, layer.layer_key])]
                              : prev.filter(k => k !== layer.layer_key)
                            );
                          }}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                    ))
                  )}
                </>
              ) : (
                <ExtractionCatalog
                  tenantId={TENANT_ID}
                  principalAssets={principalAssets.map((a) => ({ id: a.id, name: a.name }))}
                  onLoadExtraction={(extraction) => {
                    const loadedLayers = Array.isArray(extraction.layers)
                      ? extraction.layers
                          .filter((l: any) => l.layer_key !== '__virtual_river_route__')
                          .map((l: any) => ({
                            layer_key: l.layer_key,
                            layer_name: l.layer_name,
                            feature_count: Number(l.feature_count || 0),
                            color: l.color || '#38bdf8',
                            virtual: Boolean(l.virtual),
                            geojson: l.geojson || { type: 'FeatureCollection', features: [] },
                          }))
                      : [];
                    applyExtractionResult(
                      { job_id: extraction.job_id, scope_label: extraction.scope_label, layers: loadedLayers },
                      extraction.scope_label
                    );
                    setExtractionTab('results');
                  }}
                  onSelectLayers={(layers) => {
                    setSelectedLayerKeys(layers.map(l => l.layer_key));
                  }}
                  onPromoteToPrincipal={async (extraction, layerKeys) => {
                    const loadedLayers = Array.isArray(extraction.layers)
                      ? extraction.layers.map((l: any) => ({
                          layer_key: l.layer_key, layer_name: l.layer_name,
                          feature_count: Number(l.feature_count || 0),
                          color: l.color || '#38bdf8', virtual: Boolean(l.virtual),
                          geojson: l.geojson || { type: 'FeatureCollection', features: [] },
                        }))
                      : [];
                    const selected = loadedLayers.filter((l) => layerKeys.includes(l.layer_key));
                    await saveLayersAsPrincipal(selected, {
                      jobId: extraction.job_id, scopeLabel: extraction.scope_label, closePanel: false,
                    });
                  }}
                  onSaveAsBranches={async (extraction, layerKeys) => {
                    // Auto-create a principal group asset from the scope label,
                    // then save each selected layer as a child under it.
                    const loadedLayers = Array.isArray(extraction.layers)
                      ? extraction.layers.map((l: any) => ({
                          layer_key: l.layer_key, layer_name: l.layer_name,
                          feature_count: Number(l.feature_count || 0),
                          color: l.color || '#38bdf8', virtual: Boolean(l.virtual),
                          geojson: l.geojson || { type: 'FeatureCollection', features: [] },
                        }))
                      : [];
                    const selected = loadedLayers.filter((l) => layerKeys.includes(l.layer_key));
                    if (selected.length === 0) { alert('لا توجد طبقات للحفظ'); return; }

                    // Step 1: create or reuse a principal asset for the scope group
                    let parentId: string | null = null;
                    try {
                      const groupGeom = mergeLayerGeometry({
                        type: 'FeatureCollection',
                        features: selected.flatMap(l => l.geojson?.features || []),
                      });
                      const r = await fetch('/api/engineering/workspace/principal-assets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
                        body: JSON.stringify({
                          name: extraction.scope_label,
                          geometry_type: groupGeom ? inferPrincipalGeometryType(groupGeom) : 'polygon',
                          classification: 'extraction_group',
                          owner_department: 'engineering',
                          status: 'active',
                          geometry: groupGeom,
                          properties: { source: 'extraction_catalog', extraction_id: extraction.id },
                          tenant_id: TENANT_ID,
                        }),
                      });
                      if (r.ok) { const d = await r.json(); parentId = d?.id || d?.asset_id || null; }
                    } catch { /* ignore, will save as principal fallback */ }

                    if (!parentId) {
                      // Fallback: save each as standalone principal
                      await saveLayersAsPrincipal(selected, {
                        jobId: extraction.job_id, scopeLabel: extraction.scope_label, closePanel: false,
                      });
                      return;
                    }

                    // Step 2: save each layer as child under parentId
                    const ops = selected.map(async (layer) => {
                      const geometry = mergeLayerGeometry(layer.geojson);
                      if (!geometry) return;
                      const res = await fetch(`/api/engineering/workspace/principal-assets/${parentId}/children`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
                        body: JSON.stringify({
                          name: `${extraction.scope_label} — ${layer.layer_name}`,
                          asset_type: layer.layer_key,
                          owner_department: 'engineering', status: 'active', geometry,
                          properties: { source: 'extraction_catalog', extraction_id: extraction.id, layer_key: layer.layer_key },
                          tenant_id: TENANT_ID,
                        }),
                      });
                      if (!res.ok) {
                        const pl = await readApiPayload(res).catch(() => ({}));
                        throw new Error(toApiErrorMessage(res, pl, `فشل حفظ ${layer.layer_name}`));
                      }
                    });
                    await Promise.all(ops);
                    alert(`تم حفظ ${selected.length} طبقة كفروع تحت "${extraction.scope_label}"`);
                    window.dispatchEvent(new CustomEvent('engineering:refresh-child-layer'));
                    setLeftPanelRefreshKey((k) => k + 1);
                  }}
                />
              )}
            </div>
            {!extractProgress && extractedLayers.length > 0 && extractionTab === 'results' && (
              <>
                {/* Name input for saving */}
                <div className="px-3 pt-3 pb-1 border-t border-slate-700">
                  <label className="text-xs text-slate-400 block mb-1">اسم النطاق (يُستخدم في تسمية الطبقات المحفوظة)</label>
                  <input
                    type="text"
                    value={extractSaveName}
                    onChange={e => setExtractSaveName(e.target.value)}
                    placeholder={extractScopeLabel}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="px-3 py-3 flex gap-2">
                  <button
                    onClick={async () => {
                      const selectedLayers = extractedLayers.filter(l => selectedLayerKeys.includes(l.layer_key));
                      if (selectedLayers.length === 0) return;
                      setSavingExtracted(true);
                      try {
                        await saveExtractionToCatalog(selectedLayers, { notify: true });
                        setExtractionTab('catalog');
                      } catch (err) {
                        alert(`فشل حفظ المكتبة: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
                      } finally {
                        setSavingExtracted(false);
                      }
                    }}
                    disabled={savingExtracted || selectedLayerKeys.length === 0}
                    className="flex-1 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 text-sm disabled:opacity-40"
                  >
                    {savingExtracted ? 'جاري الحفظ...' : 'حفظ في المكتبة'}
                  </button>
                  <button
                    onClick={() => {
                      setExtractPanelOpen(false);
                      setExtractProgress('');
                      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-700/70 text-slate-200 text-sm"
                  >
                    إغلاق
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Add Child Asset Modal */}
        {showChildModal && (
          <AddChildAssetModal
            principalAssets={principalAssets}
            preselectedParentId={selectedAssetId}
            onSaved={handleChildSaved}
            onClose={() => setShowChildModal(false)}
          />
        )}

        {/* LRS importer removed in Phase 1 — Phase 5 will add proper backend-integrated LRS import */}

      </div>
    </GisErrorBoundary>
  );
}

export default function EngineeringWorkspace() {
  return (
    <Suspense fallback={null}>
      <EngineeringWorkspaceInner />
    </Suspense>
  );
}

