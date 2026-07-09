'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useGisEngine } from '@/store/gisEngine';
import {
  getSceneSummary,
  listScenes,
  listWorkflows,
  type SceneListItem,
  type SceneSummaryContract,
  type WorkflowInfo,
} from '@/lib/satelliteIntelAPI';
import { useSatelliteRefresh } from '@/lib/useSatelliteRefresh';
import { computeAreaStats, type AreaIntelResult } from '@/lib/areaIntelEngine';
import { fetchAreaReport, type AreaReport } from '@/lib/areaReportAPI';
import { fetchMultiSourceArea, type MultiSourceResponse } from '@/lib/multiSourceAPI';
import { fetchZonalStats, type ZonalStatsResult } from '@/lib/zonalStatsAPI';
import { fetchObjectExtraction, type ObjectExtractionResult } from '@/lib/objectExtractionAPI';
import { fetchGeoprocessing, type GeoprocessingResult } from '@/lib/geoprocessingAPI';
import { fetchTopologyQa, type TopologyQaResult } from '@/lib/topologyQaAPI';
import type { SmartArea } from '@/lib/s12API';
import { syncClientTenantFromEnv } from '@/lib/gis/clientTenantHeaders';
import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';
import SICHeader from './SICHeader';
import SatIntelTopBar from './SatIntelTopBar';
import SICRibbon, { DEFAULT_RIBBON_STATE, type RibbonState, type RibbonGroup } from './SICRibbon';
import SatIntelLeftPanel from './SatIntelLeftPanel';
import SatIntelRightPanel from './SatIntelRightPanel';
import SatIntelBottomBar from './SatIntelBottomBar';
import { SceneMapPanel, type BaseStyle, type DrawMode, type ServiceLayerMapEntry } from './SceneMapPanel';
import ServiceLayerCreateDialog, { LAYER_TEMPLATES, type LayerTemplate } from './ServiceLayerCreateDialog';
import ServiceLayerFeaturesPanel, { type AddPointModePayload } from './ServiceLayerFeaturesPanel';
import SICLayerEditorPanel from './SICLayerEditorPanel';
import SmartAlertsPanel from './SmartAlertsPanel';
import WaterScannerPanel from './WaterScannerPanel';
import TaskLaunchPanel, { TaskGuideBar, TASKS, type TaskMode } from './TaskLaunchPanel';
import AssetLeftPanel, { type PrincipalAsset } from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/AssetLeftPanel';
import AssetCenterPanel from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/AssetCenterPanel';
import CreatePrincipalAssetModal from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/CreatePrincipalAssetModal';
import AddChildAssetModal from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/AddChildAssetModal';
import ExtractionCatalog from '@/components/ExtractionCatalog';
import {
  listServiceLayers,
  createServiceLayer,
  updateServiceLayer,
  deleteServiceLayer,
  reorderServiceLayers,
  type ServiceLayerRecord,
} from '@/lib/serviceLayersAPI';
import {
  getStudyLayer,
  addFeatureToStudyLayer,
  type StudyLayerSummary,
  type StudyLayerFeature,
} from '@/lib/studyLayersAPI';

function polygonToBbox(polygon: [number, number][] | null): [number, number, number, number] | null {
  if (!polygon || polygon.length === 0) return null;
  return [
    Math.min(...polygon.map(c => c[0])),
    Math.min(...polygon.map(c => c[1])),
    Math.max(...polygon.map(c => c[0])),
    Math.max(...polygon.map(c => c[1])),
  ];
}

/** Extract flat [lon,lat][] from a GeoJSON geometry (LineString or Polygon) */
function extractCoords(geometry: any): [number, number][] {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return (geometry.coordinates ?? []).map((c: number[]) => [c[0], c[1]] as [number, number]);
  if (geometry.type === 'Polygon')    return (geometry.coordinates?.[0] ?? []).map((c: number[]) => [c[0], c[1]] as [number, number]);
  if (geometry.type === 'MultiLineString') return (geometry.coordinates?.[0] ?? []).map((c: number[]) => [c[0], c[1]] as [number, number]);
  return [];
}

export default function SatelliteIntelLegacyShell() {
  const CHUNK_RECOVERY_KEY = 'sic_chunk_recovery_once';
  const setWorkspace      = useGisEngine(s => s.setWorkspace);
  const refreshAll         = useGisEngine(s => s.refreshAll);
  const projects           = useGisEngine(s => s.projects);
  const gisDrawingMode     = useGisEngine(s => s.drawingMode);
  const setGisDrawingMode  = useGisEngine(s => s.setDrawingMode);
  const selectEntity       = useGisEngine(s => s.selectEntity);

  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [activeSceneUid, setActiveSceneUid] = useState<string | null>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<string>('environment_summary');
  // Archive year control
  const [archiveYear, setArchiveYear] = useState<number>(new Date().getFullYear());
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [summary, setSummary] = useState<SceneSummaryContract | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('off');
  // baseStyle is derived from gisEngine.basemap (single source of truth shared with AssetTopBar)
  const gisEngineBasemap = useGisEngine(s => s.basemap);
  const setGisEngineBasemap = useGisEngine(s => s.setBasemap);
  const baseStyle: BaseStyle = gisEngineBasemap === 'road' ? 'voyager' : (gisEngineBasemap as BaseStyle);
  const setBaseStyle = (style: BaseStyle) => setGisEngineBasemap(style === 'voyager' ? 'road' : style);
  const [drawnPolygon, setDrawnPolygon] = useState<[number, number][] | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areaLoading, setAreaLoading] = useState(false);
  const [areaResult, setAreaResult] = useState<AreaIntelResult | null>(null);
  const [areaReport, setAreaReport] = useState<AreaReport | null>(null);
  const [areaReportLoading, setAreaReportLoading] = useState(false);
  const [areaReportError, setAreaReportError] = useState<string | null>(null);
  const [multiSourceData, setMultiSourceData] = useState<MultiSourceResponse | null>(null);
  const [zonalStats, setZonalStats] = useState<ZonalStatsResult | null>(null);
  const [objectExtraction, setObjectExtraction] = useState<ObjectExtractionResult | null>(null);
  const [geoprocessing, setGeoprocessing] = useState<GeoprocessingResult | null>(null);
  const [topologyQa, setTopologyQa] = useState<TopologyQaResult | null>(null);
  const [multiSourceLoading, setMultiSourceLoading] = useState(false);
  const [dataSyncWarning, setDataSyncWarning] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<SmartArea | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  const systemOnline = workflows.length > 0;
  const hasResult = !!summary || !!areaReport || !!areaResult;

  // ── Service layers state ─────────────────────────────────────────────────
  const [serviceLayers, setServiceLayers] = useState<ServiceLayerRecord[]>([]);
  const [serviceLayersLoading, setServiceLayersLoading] = useState(false);
  const [serviceLayersError, setServiceLayersError] = useState<string | null>(null);
  const [svcLayerFeatures, setSvcLayerFeatures] = useState<Record<string, any[]>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDialogMunicipalities, setCreateDialogMunicipalities] = useState<{ key: string; labelAr: string }[]>([]);
  const [activeLayerPanel, setActiveLayerPanel] = useState<ServiceLayerRecord | null>(null);
  const [addPointMode, setAddPointMode] = useState<AddPointModePayload | null>(null);
  const [layerEditorOpen, setLayerEditorOpen] = useState(false);

  // ── Ribbon state ──────────────────────────────────────────────────────────
  const [ribbonState, setRibbonState] = useState<RibbonState>(DEFAULT_RIBBON_STATE);
  const patchRibbon = useCallback((patch: Partial<RibbonState>) => setRibbonState(s => ({ ...s, ...patch })), []);

  // ── Task Mode: guides user through a specific workflow ──────────────────
  const [taskMode,    setTaskMode]    = useState<TaskMode | null>(null);
  const [taskStep,    setTaskStep]    = useState(0);

  // ── Layer editor inline state (no separate map — uses SceneMapPanel) ──────
  const [layerSelectedAssetId, setLayerSelectedAssetId] = useState<string | null>(null);
  const [layerShowCreateModal, setLayerShowCreateModal] = useState(false);
  const [layerPendingGeometry, setLayerPendingGeometry] = useState<any>(null);
  const [layerPendingGeomType, setLayerPendingGeomType] = useState<'polygon' | 'path' | null>(null);
  const [layerPendingDefaults, setLayerPendingDefaults] = useState<any>(null);
  const [layerShowChildModal, setLayerShowChildModal] = useState(false);
  const [layerPrincipalAssets, setLayerPrincipalAssets] = useState<PrincipalAsset[]>([]);
  const [layerRefreshKey, setLayerRefreshKey] = useState(0);
  // Multi-feature upload queue (for file uploads with multiple features)
  const [layerUploadedFeatures, setLayerUploadedFeatures] = useState<any[]>([]);
  const [layerUploadIndex, setLayerUploadIndex] = useState(0);

  // ── Extraction result state ───────────────────────────────────────────────
  const [layerExtractionResult, setLayerExtractionResult] = useState<any>(null);
  const [layerExtractionScopeLabel, setLayerExtractionScopeLabel] = useState<string>('');
  const [layerExtractSelectedKeys, setLayerExtractSelectedKeys] = useState<string[]>([]);
  const [layerExtractSaving, setLayerExtractSaving] = useState(false);
  const [layerExtractCollapsed, setLayerExtractCollapsed] = useState(false);

  // ── Layer extraction state ────────────────────────────────────────────────
  const muniGeomCache = React.useRef<Record<string, any>>({});
  const [extractMuniGeom, setExtractMuniGeom] = useState<any>(null);

  // ── Derive polygon from municipality boundary as fallback when no drawn polygon ──
  const extractedMuniPolygon = useMemo<[number, number][] | null>(() => {
    if (!extractMuniGeom) return null;
    try {
      const t = extractMuniGeom.type;
      if (t === 'Polygon') return extractMuniGeom.coordinates[0]?.map((c: number[]) => [c[0], c[1]] as [number, number]) ?? null;
      if (t === 'MultiPolygon') return extractMuniGeom.coordinates[0]?.[0]?.map((c: number[]) => [c[0], c[1]] as [number, number]) ?? null;
    } catch { /* ignore */ }
    return null;
  }, [extractMuniGeom]);
  const effectivePolygon = drawnPolygon ?? extractedMuniPolygon;
  const currentBbox = useMemo(() => activeArea?.bbox ?? polygonToBbox(effectivePolygon), [activeArea, drawnPolygon, extractedMuniPolygon]);
  const [extractBusy, setExtractBusy] = useState(false);
  const [extractProgress, setExtractProgress] = useState('');
  // selectedMuniKey: last municipality key selected from AssetTopBar
  const [selectedMuniKey, setSelectedMuniKey] = useState<string>('');

  const isLayersMode      = ribbonState.activeGroup === 'layers';
  const isMonitoringMode  = ribbonState.activeGroup === 'monitoring';
  const isPipelineMode    = false; // pipeline group removed — kept for compatibility
  const focusMode         = false; // legacy focus mode — kept for compatibility

  // Bridge gisEngine.drawingMode → SceneMapPanel drawMode when in layers mode
  const effectiveDrawMode = useMemo<DrawMode>(() => {
    if (!isLayersMode) return drawMode;
    if (gisDrawingMode === 'polygon' || gisDrawingMode === 'line') return 'polygon';
    return 'off';
  }, [isLayersMode, drawMode, gisDrawingMode]);

  // Listen for engineering:feature-drawn (fired by file upload / other tools)
  useEffect(() => {
    const handler = (e: Event) => {
      if (!isLayersMode) return;
      const { geometry } = (e as CustomEvent).detail ?? {};
      if (!geometry) return;
      const type = String(geometry.type ?? '').toLowerCase().includes('polygon') ? 'polygon' : 'path';
      setLayerPendingGeometry(geometry);
      setLayerPendingGeomType(type);
      setLayerPendingDefaults(null);
      setLayerShowCreateModal(true);
    };
    window.addEventListener('engineering:feature-drawn', handler as EventListener);
    return () => window.removeEventListener('engineering:feature-drawn', handler as EventListener);
  }, [isLayersMode]);

  // Listen for engineering:process-uploaded-features (fired by file upload via AssetTopBar)
  useEffect(() => {
    const handler = (e: Event) => {
      if (!isLayersMode) return;
      const { features, fileName } = (e as CustomEvent<any>).detail ?? {};
      if (!features?.length) return;
      // Queue all features; show modal for first one
      setLayerUploadedFeatures(features);
      setLayerUploadIndex(0);
      const f0 = features[0];
      const geom = f0?.geometry || null;
      const type = String(geom?.type ?? '').toLowerCase().includes('polygon') ? 'polygon' : 'path';
      setLayerPendingGeometry(geom);
      setLayerPendingGeomType(type);
      const p = f0?.properties || {};
      setLayerPendingDefaults({ name: p.asset_name || fileName?.split('.')[0] || '', classification: p.asset_type, ownerDept: p.owner_department, status: p.status });
      setLayerShowCreateModal(true);
    };
    window.addEventListener('engineering:process-uploaded-features', handler as EventListener);
    return () => window.removeEventListener('engineering:process-uploaded-features', handler as EventListener);
  }, [isLayersMode]);

  // Listen for engineering:extraction-complete (fired by handleRunMunicipalityExtraction)
  useEffect(() => {
    const handler = (e: Event) => {
      if (!isLayersMode) return;
      const detail = (e as CustomEvent).detail ?? {};
      setLayerExtractionResult(detail);
      setLayerExtractionScopeLabel(detail?.scope_label || selectedMuniKey || '');
    };
    window.addEventListener('engineering:extraction-complete', handler as EventListener);
    return () => window.removeEventListener('engineering:extraction-complete', handler as EventListener);
  }, [isLayersMode, selectedMuniKey]);

  // ── forcedTab: maps ribbon group → RightPanel tab ─────────────────────────
  const [rightPanelSize, setRightPanelSize] = useState<'normal' | 'wide' | 'half' | 'full'>('normal');

  const forcedTab = useMemo(() => {
    const g = ribbonState.activeGroup;
    if (g === 'terrain') return 'terrain3d' as const;
    if (g === 'suitability') return 'suitability' as const;
    if (g === 'routing') return 'routing' as const;
    if (g === 'compliance') return 'compliance' as const;
    if (g === 'change_detection') return 'change_detection' as const;
    if (g === 'risk') return 'risk' as const;
    // monitoring mode: don't force satellite_trend — let the panel show freely
    // (fire/leak/gas monitoring tabs handle their own display via the ribbon sub-bar)
    if (g === 'detection') return 'object_detection' as const;
    if (g === 'insar')     return 'insar' as const;
    if (g === 'cva')       return 'change_detection' as const;
    if (g === 'spatial_analyst') return 'spatial_analyst' as const;
    if (g === 'image_analyst')   return 'image_analyst' as const;
    if (g === '3d_analyst')      return '3d_analyst' as const;
    if (g === 'report') return (ribbonState.reportSubTab ?? 'report') as 'report' | 'chat' | 'temporal' | 'simulation' | 'areas';
    return null;
  }, [ribbonState.activeGroup, ribbonState.reportSubTab]);

  // ── Auto-manage right panel size based on ribbon group ────────────────────
  // Groups where the right panel (SatIntelRightPanel) is the MAIN interface
  //   → keep it open at normal/wide width
  // Monitoring groups → right panel has no dedicated tool, collapse to free map space
  useEffect(() => {
    const g = ribbonState.activeGroup;
    const analyticalGroups = new Set(['insar','cva','detection','spatial_analyst','image_analyst','3d_analyst','suitability','routing','terrain','compliance','report','pipeline']);
    const monitoringGroups = new Set(['monitoring']);
    if (monitoringGroups.has(g)) {
      // Monitoring: map should dominate, right panel minimized to normal (user can expand)
      setRightPanelSize(prev => prev === 'full' || prev === 'half' ? 'normal' : prev);
    } else if (analyticalGroups.has(g)) {
      // Analytical: keep panel at least normal
      setRightPanelSize(prev => prev === 'full' ? 'wide' : prev);
    }
    // For 'scenes', 'layers', 'draw': keep current preference
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ribbonState.activeGroup]);

  // ── Sync workspace when layers group active ───────────────────────────────
  useEffect(() => {
    if (ribbonState.activeGroup === 'layers') {
      setWorkspace('engineering');
    } else {
      setWorkspace('satellite');
    }
  }, [ribbonState.activeGroup, setWorkspace]);

  // ── Municipality geometry → drawnPolygon sync ────────────────────────────
  // When a municipality is selected in layers mode, expose its boundary as the
  // active analysis area so the right-panel analysis tools can use it.
  useEffect(() => {
    if (!extractMuniGeom) return;
    try {
      let ring: [number, number][] | null = null;
      const t = extractMuniGeom.type;
      if (t === 'Polygon') ring = extractMuniGeom.coordinates[0]?.map((c: number[]) => [c[0], c[1]] as [number, number]);
      else if (t === 'MultiPolygon') ring = extractMuniGeom.coordinates[0]?.[0]?.map((c: number[]) => [c[0], c[1]] as [number, number]);
      if (ring && ring.length > 2) setDrawnPolygon(ring);
    } catch { /* ignore malformed */ }
  }, [extractMuniGeom]);

  // ── Suitability pins (shown on map when suitability analysis runs) ────────
  const [suitabilityPins, setSuitabilityPins] = useState<{ lon: number; lat: number; score: number; label: string }[]>([]);
  const [flyToPin, setFlyToPin] = useState<{ lon: number; lat: number } | null>(null);

  // ── Municipality highlight + extraction handlers ──────────────────────────
  const handleMunicipalityChange = useCallback(async (key: string) => {
    setSelectedMuniKey(key);
    if (!key) { setExtractMuniGeom(null); return; }
    if (muniGeomCache.current[key]) { setExtractMuniGeom(muniGeomCache.current[key]); return; }
    try {
      const res = await fetchWithClientTenantRetry(`/api/geo/admin-boundary?key=${encodeURIComponent(key)}`);
      const data = await res.json().catch(() => ({}));
      if (data?.geometry) {
        muniGeomCache.current[key] = data.geometry;
        setExtractMuniGeom(data.geometry);
      }
    } catch { /* ignore */ }
  }, []);

  const handleRunMunicipalityExtraction = useCallback(async (key: string) => {
    const TENANT_ID = (typeof window !== 'undefined' && window.localStorage.getItem('tenant_id')) || 'aaaaaaaa-0000-4000-a000-000000000001';
    setExtractBusy(true);
    setExtractProgress('جاري تحضير التفكيك...');
    const endpoints = ['/api/engineering/workspace/layer-extraction/run', '/api/v1/workspace/layer-extraction/run'];
    const MAX_ATTEMPTS = 3;
    const body = JSON.stringify({ scope_type: 'municipality', municipality: key });
    const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID };

    const attempt = async (): Promise<any> => {
      let lastErr: Error | null = null;
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep, { method: 'POST', headers, body });
          const raw = await r.text().catch(() => '');
          // Detect nginx/proxy HTML error pages
          if (raw.trim().startsWith('<')) {
            lastErr = new Error(`الخادم أعاد HTML بدلاً من JSON (HTTP ${r.status}) — الخدمة غير متاحة حالياً`);
            continue;
          }
          const pl = raw ? JSON.parse(raw) : {};
          if (!r.ok) { lastErr = new Error(pl?.detail || pl?.error || `HTTP ${r.status}`); continue; }
          return pl;
        } catch (e) { lastErr = e instanceof Error ? e : new Error(String(e)); }
      }
      throw lastErr || new Error('فشل التفكيك');
    };

    try {
      let result: any = null;
      for (let i = 1; i <= MAX_ATTEMPTS; i++) {
        try {
          setExtractProgress(`محاولة ${i} من ${MAX_ATTEMPTS}...`);
          result = await attempt();
          break;
        } catch (e) {
          if (i < MAX_ATTEMPTS) {
            const ms = 1000 * (2 ** (i - 1));
            setExtractProgress(`فشلت المحاولة ${i}، إعادة في ${ms / 1000}ث...`);
            await new Promise(r => setTimeout(r, ms));
          } else { throw e; }
        }
      }
      // Success — dispatch event so ExtractionCatalog / AssetTopBar can show results
      const eventDetail = { ...result, scope_label: result?.scope_label || key };
      window.dispatchEvent(new CustomEvent('engineering:extraction-complete', { detail: eventDetail }));
      // Also update local state directly (no need to wait for event listener)
      setLayerExtractionResult(eventDetail);
      setLayerExtractionScopeLabel(eventDetail.scope_label || key);
      setLayerExtractSelectedKeys((Array.isArray(eventDetail.layers) ? eventDetail.layers : []).filter((l: any) => l.feature_count > 0).map((l: any) => l.layer_key));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
      setError(`فشل التفكيك: ${msg}`);
    } finally {
      setExtractBusy(false);
      setExtractProgress('');
    }
  }, []);

  // ── Optimal path routing state ────────────────────────────────────────────
  const [routingPickMode, setRoutingPickMode] = useState<'idle' | 'picking_start' | 'picking_end'>('idle');
  const [routingStartPoint, setRoutingStartPoint] = useState<[number, number] | null>(null);
  const [routingEndPoint, setRoutingEndPoint] = useState<[number, number] | null>(null);
  const [routingPath, setRoutingPath] = useState<[number, number][] | null>(null);
  const [routingEditMode, setRoutingEditMode] = useState<'off' | 'modify' | 'draw'>('off');
  const [manualPathForPanel, setManualPathForPanel] = useState<[number, number][] | null>(null);

  // ── Network design state ──────────────────────────────────────────────────
  const [networkPickMode, setNetworkPickMode] = useState<'idle' | 'picking_node'>('idle');
  const [networkPickedPoint, setNetworkPickedPoint] = useState<[number, number] | null>(null);
  // Auto-network from polygon
  const [autoNetworkPolygon, setAutoNetworkPolygon] = useState<[number,number][] | null>(null);
  const [autoNetworkDrawing, setAutoNetworkDrawing] = useState(false);
  const [autoNetworkGeojson, setAutoNetworkGeojson] = useState<any | null>(null);

  // ── RSC merged module state ───────────────────────────────────────────────
  const [rscActiveTool, setRscActiveTool] = useState<string>('sa_none');
  const [rscProcessing,  setRscProcessing]  = useState(false);
  const [rscResult,      setRscResult]      = useState<any>(null);

  // ── Change Detection overlay ──────────────────────────────────────────────
  const [changeDetectionGeojson, setChangeDetectionGeojson] = useState<any | null>(null);

  // ── Risk Assessment overlay ───────────────────────────────────────────────
  const [riskGeojson, setRiskGeojson] = useState<any | null>(null);

  // ── Satellite overlay layers: fire + leak + urban + encroach ─────────────
  const [showFireLayer,      setShowFireLayer]      = useState(false);
  const [showLeakLayer,      setShowLeakLayer]      = useState(false);
  const [showUrbanLeakLayer, setShowUrbanLeakLayer] = useState(false);
  const [showEncroachLayer,  setShowEncroachLayer]  = useState(false);
  const [fireMarkers,        setFireMarkers]        = useState<any[]>([]);
  const [leakMarkers,        setLeakMarkers]        = useState<any[]>([]);
  const [urbanLeakMarkers,   setUrbanLeakMarkers]   = useState<any[]>([]);
  const [encroachMarkers,    setEncroachMarkers]    = useState<any[]>([]);
  const [leakRouteLines,     setLeakRouteLines]     = useState<{ coords: [number,number][]; color: string; width?: number; label?: string; layerKey: string }[]>([]);
  const [fireLoading,        setFireLoading]        = useState(false);
  const [leakLoading,        setLeakLoading]        = useState(false);
  const [urbanLeakLoading,   setUrbanLeakLoading]   = useState(false);
  const [encroachLoading,    setEncroachLoading]    = useState(false);
  // ── Water scanner state ──────────────────────────────────────────────────
  const [waterScanMarkers,   setWaterScanMarkers]   = useState<any[]>([]);
  const [waterScanDrawing,   setWaterScanDrawing]   = useState(false);
  // ── Study layers (طبقات الدراسة الخاصة) ───────────────────────────────────
  const [activeStudyLayer,         setActiveStudyLayer]         = useState<StudyLayerSummary | null>(null);
  const [studyLayerFeatures,       setStudyLayerFeatures]       = useState<StudyLayerFeature[]>([]);
  const [studyLayersList,          setStudyLayersList]          = useState<StudyLayerSummary[]>([]);
  // ── Registered assets overlay ─────────────────────────────────────────────
  const [showAssetsOverlay,        setShowAssetsOverlay]        = useState(true); // افتراضياً: الأصول مرئية
  const [assetsOverlayMarkers,     setAssetsOverlayMarkers]     = useState<any[]>([]);
  const [assetsOverlayLoading,     setAssetsOverlayLoading]     = useState(false);
  // ── Map marker popup state ────────────────────────────────────────────────
  const [mapPopup, setMapPopup] = useState<{ label: string; tooltip: string; layerKey: string; lon: number; lat: number } | null>(null);
  // ── Full fire API data for the report panel ───────────────────────────────
  const [fireApiData, setFireApiData] = useState<any>(null);
  // ── Use ref for loading guard (avoids stale-closure bug with useCallback) ─
  const fireLoadingRef = useRef(false);

  const loadFireLayer = useCallback(async () => {
    if (fireLoadingRef.current) return;
    fireLoadingRef.current = true;
    setFireLoading(true);
    try {
      // Fetch ALL clusters including gas flares for the full report
      const res = await fetch('/api/v1/satellite/fire-monitor?days=7&no_flares=false');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Use all_clusters so gas flares appear in report, alert_clusters for map markers
      const mapClusters: any[] = data.alert_clusters ?? [];
      const reportData = { ...data, all_for_report: data.all_clusters ?? [] };

      const colorMap: Record<string, string> = {
        urban_incident:    '#f43f5e',
        confirmed_fire:    '#ef4444',
        gas_flare:         '#a855f7',
        recurring_anomaly: '#f97316',
        single_detection:  '#facc15',
      };

      const markers = mapClusters
        .filter((c: any) => c.lon != null && c.lat != null)
        .map((c: any) => {
          const city  = c.nearest_city   ? `${c.nearest_city}(${c.nearest_city_km}كم)` : '';
          const days  = c.days_active    ? `${c.days_active}أيام` : '';
          const frp   = c.max_frp_mw     ? `FRP:${c.max_frp_mw}MW` : '';
          const label =
            c.classification === 'urban_incident'    ? `🔴 حادث حضري${city ? ` — ${c.nearest_city}` : ''}` :
            c.classification === 'confirmed_fire'    ? `🔥 حريق مؤكد${city ? ` ${city}` : ''}` :
            c.classification === 'gas_flare'         ? `🟣 حرق غاز صناعي` :
            c.classification === 'recurring_anomaly' ? `🟠 شذوذ متكرر ${days}` :
                                                       `🟡 رصد فردي`;
          const alertReason = c.alert_reason ?? '';
          const dates       = (c.dates_active ?? []).slice(-3).join('، ');
          const cityInfo    = c.nearest_city ? `📍 ${c.nearest_city} (${c.nearest_city_km ?? '?'} كم)` : '';
          const flareInfo   = c.known_flare_site ? `⚗️ موقع صناعي: ${c.known_flare_site}` : '';
          const tooltip =
            `${label}\n` +
            `${frp ? `🔥 ${frp}` : ''}${frp && days ? '  |  ' : ''}${days ? `📅 ${days}` : ''}\n` +
            `${cityInfo ? `${cityInfo}\n` : ''}` +
            `${alertReason ? `ℹ️ ${alertReason}\n` : ''}` +
            `${flareInfo ? `${flareInfo}\n` : ''}` +
            `${dates ? `🗓️ آخر رصد: ${dates}` : ''}`;
          return {
            lon:      c.lon,
            lat:      c.lat,
            color:    colorMap[c.classification] ?? '#94a3b8',
            radius:   c.classification === 'urban_incident' ? Math.min(22, 8 + (c.max_frp_mw ?? 1) / 2) :
                      c.classification === 'confirmed_fire' ? Math.min(18, 7 + (c.max_frp_mw ?? 1) / 3) :
                      Math.min(12, 4 + (c.observations ?? c.total_count ?? 1) * 0.4),
            label,
            tooltip:  tooltip.trim(),
            layerKey: 'fire_viirs',
          };
        });
      setFireMarkers(markers);
      setFireApiData(reportData);
    } catch (e: any) {
      console.warn('Fire layer load failed:', e.message);
      setFireMarkers([]);
    } finally {
      fireLoadingRef.current = false;
      setFireLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLeakLayer = useCallback(async () => {
    if (leakLoading) return;
    setLeakLoading(true);
    try {
      const res = await fetch('/api/v1/satellite/leak-detector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const colorMap: Record<string, string> = {
        confirmed: '#ef4444',
        high:      '#f97316',
        medium:    '#facc15',
        low:       '#34d399',
        none:      '#6b7280',
      };
      const markers = (data.segments ?? [])
        .filter((s: any) => s.leak_probability !== 'none')
        .map((s: any) => ({
          lon:      s.center[0],
          lat:      s.center[1],
          color:    colorMap[s.leak_probability] ?? '#6b7280',
          radius:   8 + Math.floor(s.confidence_pct / 12),
          label:    `${s.segment_name} (${s.confidence_pct}%)`,
          layerKey: 'gmr_leak',
        }));
      setLeakMarkers(markers);

      // رسم خط المسار على الخريطة
      if (data.route_waypoints?.length > 1) {
        setLeakRouteLines([{
          coords:   data.route_waypoints,
          color:    '#60a5fa',
          width:    3,
          label:    data.corridor_name ?? 'النهر الصناعي',
          layerKey: 'gmr_route',
        }]);
      }
    } catch (e: any) {
      console.warn('Leak layer load failed:', e.message);
      setLeakMarkers([]);
      setLeakRouteLines([]);
    } finally {
      setLeakLoading(false);
    }
  }, [leakLoading]);

  const loadUrbanLeakLayer = useCallback(async () => {
    if (urbanLeakLoading) return;
    setUrbanLeakLoading(true);
    try {
      const res = await fetch('/api/v1/satellite/urban-leak-detector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const colorMap: Record<string, string> = {
        confirmed: '#3b82f6',
        high:      '#60a5fa',
        medium:    '#93c5fd',
        low:       '#bfdbfe',
      };
      const markers = (data.zones ?? [])
        .filter((z: any) => z.leak_probability !== 'none')
        .map((z: any) => {
          const prob    = z.leak_probability ?? 'low';
          const conf    = z.confidence_pct   ?? 0;
          const probLabel = prob === 'confirmed' ? '🔵 مؤكد'   :
                            prob === 'high'      ? '🔴 عالٍ'   :
                            prob === 'medium'    ? '🟠 متوسط'  : '🟡 منخفض';
          const evidence = (z.evidence ?? []).slice(0, 3).join('\n');
          const tooltip  = [
            `احتمال التسرب: ${probLabel} (${conf}%)`,
            evidence,
            z.zone_type ? `نوع الشبكة: ${z.zone_type}` : '',
          ].filter(Boolean).join('\n');
          return {
            lon:      z.center[0],
            lat:      z.center[1],
            color:    colorMap[prob] ?? '#60a5fa',
            radius:   prob === 'confirmed' ? 12 : prob === 'high' ? 10 : 8,
            label:    `🏙️ ${z.zone_name ?? z.city} (${conf}%)`,
            tooltip,
            layerKey: 'urban_leak',
          };
        });
      setUrbanLeakMarkers(markers);
    } catch (e: any) {
      console.warn('Urban leak layer load failed:', e.message);
      setUrbanLeakMarkers([]);
    } finally {
      setUrbanLeakLoading(false);
    }
  }, [urbanLeakLoading]);

  const loadEncroachLayer = useCallback(async () => {
    if (encroachLoading) return;
    setEncroachLoading(true);
    try {
      const res = await fetch('/api/engineering/workspace/principal-assets?limit=200', {
        headers: { 'X-Tenant-ID': (typeof window !== 'undefined' && window.localStorage.getItem('tenant_id')) || 'aaaaaaaa-0000-4000-a000-000000000001' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const assets: any[] = data.assets ?? data.data ?? [];
      const markers = assets
        .filter((a: any) => a.geometry?.coordinates)
        .map((a: any) => {
          // Extract centroid from GeoJSON geometry
          const geom = a.geometry;
          let lon = 0, lat = 0;
          if (geom.type === 'Point') { [lon, lat] = geom.coordinates; }
          else if (geom.type === 'LineString') { [lon, lat] = geom.coordinates[Math.floor(geom.coordinates.length / 2)]; }
          else if (geom.type === 'Polygon') { [lon, lat] = geom.coordinates[0][0]; }
          if (!lon && !lat) return null;
          return {
            lon, lat,
            color:    '#f43f5e',
            radius:   7,
            label:    `🚧 ${a.name ?? 'أصل مراقب'}`,
            layerKey: 'encroach',
          };
        })
        .filter(Boolean);
      setEncroachMarkers(markers);
    } catch (e: any) {
      console.warn('Encroach layer load failed:', e.message);
      setEncroachMarkers([]);
    } finally {
      setEncroachLoading(false);
    }
  }, [encroachLoading]);

  useEffect(() => {
    if (showFireLayer && fireMarkers.length === 0) loadFireLayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFireLayer]);

  // ── Auto-load registered assets overlay on first mount ────────────────────
  // الأصول المسجلة هي الطبقة الافتراضية عند فتح مركز الاستشعار
  useEffect(() => {
    setShowAssetsOverlay(true);
    loadAssetsOverlay();

    // Load operational assets with FULL GEOMETRY into the principal layer
    // so they render as actual polygons/lines, not just point markers
    const TENANT_ID = (typeof window !== 'undefined' && window.localStorage.getItem('tenant_id')) || '';
    fetch('/api/engineering/workspace/principal-assets', {
      headers: TENANT_ID ? { 'X-Tenant-ID': TENANT_ID } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then((assets: any[]) => {
        const principalList = assets.map((a: any) => ({
          id:               a.id,
          name:             a.name,
          geometry_type:    a.geometry?.type === 'LineString' || a.geometry?.type === 'MultiLineString' ? 'path' : 'polygon',
          classification:   a.classification ?? null,
          owner_department: a.owner_department ?? null,
          status:           a.status ?? 'active',
          health_score:     a.health_score ?? null,
          geometry:         a.geometry ?? null,
          geometry_json:    a.geometry ?? null,
          created_at:       a.created_at ?? null,
          tenant_id:        a.tenant_id ?? null,
          site_id:          null,
          length_km:        null,
          description:      null,
        }));
        setLayerPrincipalAssets(principalList);
      })
      .catch(() => {});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showLeakLayer && leakMarkers.length === 0) loadLeakLayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLeakLayer]);

  useEffect(() => {
    if (showUrbanLeakLayer && urbanLeakMarkers.length === 0) loadUrbanLeakLayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUrbanLeakLayer]);

  useEffect(() => {
    if (showEncroachLayer && encroachMarkers.length === 0) loadEncroachLayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEncroachLayer]);

  // ── Assets overlay loader ─────────────────────────────────────────────────
  const loadAssetsOverlay = useCallback(async () => {
    if (assetsOverlayLoading) return;
    setAssetsOverlayLoading(true);
    try {
      const TENANT_ID = (typeof window !== 'undefined' && window.localStorage.getItem('tenant_id')) || 'aaaaaaaa-0000-4000-a000-000000000001';
      const res = await fetch(`/api/v1/satellite/registered-assets?limit=500&tenant_id=${TENANT_ID}`, {
        headers: { 'X-Tenant-ID': TENANT_ID },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const assets: any[] = data.assets ?? [];
      const markers = assets
        .filter((a: any) => a.geometry?.coordinates)
        .map((a: any) => {
          const geom = a.geometry;
          let lon = 0, lat = 0;
          if (geom.type === 'Point')           { [lon, lat] = geom.coordinates; }
          else if (geom.type === 'LineString') { [lon, lat] = geom.coordinates[Math.floor(geom.coordinates.length / 2)]; }
          else if (geom.type === 'Polygon')    { [lon, lat] = geom.coordinates[0][0]; }
          if (!lon && !lat) return null;
          const typeIcon =
            geom.type === 'LineString' ? '〰️' :
            geom.type === 'Polygon'    ? '⬡' : '📍';
          return {
            lon, lat,
            color:    '#14b8a6',
            radius:   6,
            label:    `${typeIcon} ${a.name ?? 'أصل'}`,
            tooltip:  [
              a.name,
              a.asset_type ? `النوع: ${a.asset_type}` : '',
              a.status     ? `الحالة: ${a.status}` : '',
            ].filter(Boolean).join('\n'),
            layerKey: 'registered_assets',
          };
        })
        .filter(Boolean);
      setAssetsOverlayMarkers(markers);
    } catch (e: any) {
      console.warn('Assets overlay load failed:', e.message);
      setAssetsOverlayMarkers([]);
    } finally {
      setAssetsOverlayLoading(false);
    }
  }, [assetsOverlayLoading]);

  useEffect(() => {
    if (showAssetsOverlay && assetsOverlayMarkers.length === 0) loadAssetsOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAssetsOverlay]);

  // ── Study layer: open / close / save feature ──────────────────────────────
  const handleOpenStudyLayer = useCallback(async (layer: StudyLayerSummary) => {
    setActiveStudyLayer(layer);
    try {
      const full = await getStudyLayer(layer.id);
      setStudyLayerFeatures(full.features ?? []);
    } catch {
      setStudyLayerFeatures([]);
    }
  }, []);

  const handleCloseStudyLayer = useCallback(() => {
    setActiveStudyLayer(null);
    setStudyLayerFeatures([]);
    // Don't clear drawn polygon — keep it usable for analysis
  }, []);

  // Auto-save drawn polygon/line to active study layer
  const handleStudyLayerFeatureSave = useCallback(async (
    geometry: any,
    name?: string,
  ) => {
    if (!activeStudyLayer) return;
    try {
      const feature = await addFeatureToStudyLayer(activeStudyLayer.id, geometry, name);
      setStudyLayerFeatures(prev => [...prev, feature]);
      // Update feature count in active layer summary
      setActiveStudyLayer(prev => prev ? { ...prev, feature_count: (prev.feature_count ?? 0) + 1 } : prev);
    } catch (e: any) {
      console.warn('Failed to save study layer feature:', e.message);
    }
  }, [activeStudyLayer]);

  const satelliteOverlayMarkers = useMemo(() => [
    ...(showFireLayer      ? fireMarkers      : []),
    ...(showLeakLayer      ? leakMarkers      : []),
    ...(showUrbanLeakLayer ? urbanLeakMarkers : []),
    ...(showEncroachLayer  ? encroachMarkers  : []),
    ...(showAssetsOverlay  ? assetsOverlayMarkers : []),
    // Water scanner results always shown when available
    ...waterScanMarkers,
  ], [showFireLayer, showLeakLayer, showUrbanLeakLayer, showEncroachLayer, showAssetsOverlay, fireMarkers, leakMarkers, urbanLeakMarkers, encroachMarkers, assetsOverlayMarkers, waterScanMarkers]);

  // Study layer features → route lines + highlight polygons for the map
  const studyLayerRouteLines = useMemo(() => {
    if (!activeStudyLayer || studyLayerFeatures.length === 0) return [];
    return studyLayerFeatures
      .filter(f => f.type === 'line')
      .map(f => ({
        coords:   extractCoords(f.geometry),
        color:    activeStudyLayer.color,
        width:    3,
        label:    f.name,
        layerKey: `study_layer_${activeStudyLayer.id}`,
      }))
      .filter(r => r.coords.length >= 2);
  }, [activeStudyLayer, studyLayerFeatures]);

  const satelliteRouteLines = useMemo(() => [
    ...(showLeakLayer ? leakRouteLines : []),
    ...studyLayerRouteLines,
  ], [showLeakLayer, leakRouteLines, studyLayerRouteLines]);


  const refreshAreaProducts = useCallback(async (options?: { requireNative?: boolean; bbox?: [number, number, number, number] | null; polygon?: [number, number][] | null }) => {
    const bbox = options?.bbox ?? currentBbox;
    const polygon = options?.polygon ?? activeArea?.polygon ?? effectivePolygon;
    if (!bbox && !polygon) {
      return {
        report: null as AreaReport | null,
        multi: null as MultiSourceResponse | null,
        zonal: null as ZonalStatsResult | null,
        objects: null as ObjectExtractionResult | null,
        geoprocessing: null as GeoprocessingResult | null,
        topologyQa: null as TopologyQaResult | null,
      };
    }

    setAreaReportLoading(true);
    setMultiSourceLoading(true);
    setAreaReportError(null);

    try {
      const [report, multi, zonal, objects, geoprocessing, topologyQa] = await Promise.all([
        fetchAreaReport({
          ...(bbox ? { bbox } : {}),
          ...(polygon ? { polygon } : {}),
          ...(activeSceneUid ? { scene_uid: activeSceneUid } : {}),
        }),
        fetchMultiSourceArea({
          bbox: bbox ?? polygonToBbox(polygon)!,
        }),
        fetchZonalStats({
          ...(bbox ? { bbox } : {}),
          ...(polygon ? { polygon } : {}),
          ...(activeSceneUid ? { scene_uid: activeSceneUid } : {}),
          ...(options?.requireNative ? { require_native: true } : {}),
        }).catch(() => null),
        fetchObjectExtraction({
          ...(bbox ? { bbox } : {}),
          ...(polygon ? { polygon } : {}),
          ...(activeSceneUid ? { scene_uid: activeSceneUid } : {}),
          ...(options?.requireNative ? { require_native: true } : {}),
        }).catch(() => null),
        fetchGeoprocessing({
          ...(bbox ? { bbox } : {}),
          ...(polygon ? { polygon } : {}),
          ...(activeSceneUid ? { scene_uid: activeSceneUid } : {}),
          ...(options?.requireNative ? { require_native: true } : {}),
        }).catch(() => null),
        fetchTopologyQa({
          ...(bbox ? { bbox } : {}),
          ...(polygon ? { polygon } : {}),
          ...(activeSceneUid ? { scene_uid: activeSceneUid } : {}),
          ...(options?.requireNative ? { require_native: true } : {}),
        }).catch(() => null),
      ]);

      setAreaReport(report);
      setMultiSourceData(multi);
      setZonalStats(zonal);
      setObjectExtraction(objects);
      setGeoprocessing(geoprocessing);
      setTopologyQa(topologyQa);

      const multiSceneCount = multi?.result?.scene_count ?? 0;
      if (scenes.length === 0 && multiSceneCount > 0) {
        try {
          const refreshedScenes = await listScenes();
          if (refreshedScenes.length > 0) {
            setScenes(refreshedScenes);
            setActiveSceneUid(prev => prev ?? refreshedScenes[0]?.scene_uid ?? null);
            setDataSyncWarning(null);
          } else {
            setDataSyncWarning('تم رصد مصادر صور متعددة لكن قائمة المشاهد المحلية لم تتزامن بعد. جارٍ المزامنة.');
          }
        } catch {
          setDataSyncWarning('تعذر مزامنة قائمة المشاهد حالياً. أعد التحديث بعد قليل.');
        }
      } else {
        setDataSyncWarning(null);
      }

      return { report, multi, zonal, objects, geoprocessing, topologyQa };
    } catch (e: any) {
      setAreaReportError(e?.message ?? 'فشل إنشاء تقرير المنطقة');
      setMultiSourceData(null);
      setZonalStats(null);
      setObjectExtraction(null);
      setGeoprocessing(null);
      setTopologyQa(null);
      setDataSyncWarning(null);
      throw e;
    } finally {
      setAreaReportLoading(false);
      setMultiSourceLoading(false);
    }
  }, [activeArea, activeSceneUid, currentBbox, drawnPolygon, scenes.length]);

  const loadContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const [sceneList, workflowRes] = await Promise.all([
        listScenes(),
        listWorkflows(),
      ]);
      setScenes(sceneList);
      setWorkflows(workflowRes.workflows ?? []);
      setActiveSceneUid(prev => prev ?? sceneList[0]?.scene_uid ?? null);
      setActiveWorkflow(prev => prev !== 'environment_summary' ? prev : (workflowRes.workflows?.[0]?.workflow_key ?? 'environment_summary'));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'فشل تحميل بيانات مركز الاستخبارات الفضائية');
    } finally {
      setLoadingContext(false);
    }
  }, []);

  const handleLoadArchiveYear = useCallback(async (year: number) => {
    setArchiveLoading(true);
    setArchiveYear(year);
    try {
      const res = await fetch(`/api/satellite/scenes-archive?year=${year}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { scenes: any[] };
      if (data.scenes?.length > 0) {
        const mapped: SceneListItem[] = data.scenes.map((s: any) => ({
          scene_uid:        s.scene_uid,
          acquisition_date: s.acquisition_date,
          data_is_real:     s.data_is_real,
          pixel_type:       'L2A',
        }));
        setScenes(mapped);
        setActiveSceneUid(mapped[0]?.scene_uid ?? null);
      }
    } catch (e: any) {
      setError(`فشل تحميل أرشيف سنة ${year}: ${e?.message}`);
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  const reloadServiceLayers = useCallback(async () => {
    setServiceLayersLoading(true);
    setServiceLayersError(null);
    try {
      const res = await listServiceLayers();
      const items = res.items ?? [];
      setServiceLayers(items);
      // load feature counts
      const counts: Record<string, any[]> = {};
      await Promise.all(items.map(async (layer) => {
        try {
          const r = await fetchWithClientTenantRetry(`/api/gis/service-layers/${layer.id}/features`);
          if (r.ok) { const d = await r.json(); counts[layer.id] = d.items ?? []; }
        } catch { /* non-blocking */ }
      }));
      setSvcLayerFeatures(counts);
    } catch (e: any) {
      setServiceLayersError(e?.message ?? 'فشل تحميل طبقات الخدمات');
    } finally {
      setServiceLayersLoading(false);
    }
  }, []);

  const handleCreateServiceLayer = useCallback(async () => {
    try {
      const muniRes = await fetchWithClientTenantRetry('/api/geo/municipalities');
      const muniData = muniRes.ok ? await muniRes.json() : {};
      setCreateDialogMunicipalities(Array.isArray(muniData.municipalities) ? muniData.municipalities.map((m: any) => ({ key: m.key || String(m), labelAr: m.labelAr || m.label_ar || m.name_ar || m.key || String(m) })) : []);
    } catch { setCreateDialogMunicipalities([]); }
    setShowCreateDialog(true);
  }, []);

  const handleCreateConfirmed = useCallback(async (payload: { name: string; template: LayerTemplate; municipality_key?: string | null }) => {
    setShowCreateDialog(false);
    try {
      await createServiceLayer({
        name: payload.name,
        type: payload.template.layer_type,
        geometry_type: payload.template.geometry_type,
        municipality_key: payload.municipality_key,
      });
      await reloadServiceLayers();
    } catch (e: any) { alert(`فشل إنشاء الطبقة: ${e.message}`); }
  }, [reloadServiceLayers]);

  const handleToggleServiceLayer = useCallback(async (layerId: string, visible: boolean) => {
    setServiceLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible } : l));
    try { await updateServiceLayer(layerId, { visible }); } catch { /* non-blocking */ }
  }, []);

  const handleDeleteServiceLayer = useCallback(async (layerId: string) => {
    if (!confirm('هل تريد حذف هذه الطبقة؟')) return;
    try { await deleteServiceLayer(layerId); await reloadServiceLayers(); } catch (e: any) { alert(`فشل الحذف: ${e.message}`); }
  }, [reloadServiceLayers]);

  const handleReorderServiceLayer = useCallback(async (layerId: string, direction: 'up' | 'down') => {
    const idx = serviceLayers.findIndex(l => l.id === layerId);
    if (idx < 0) return;
    const newOrder = [...serviceLayers];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setServiceLayers(newOrder);
    try { await reorderServiceLayers(newOrder.map(l => l.id)); } catch { /* non-blocking */ }
  }, [serviceLayers]);

  const svcLayerFeatureCounts = useMemo(() =>
    Object.fromEntries(Object.entries(svcLayerFeatures).map(([id, feats]) => [id, feats.length])),
  [svcLayerFeatures]);

  const serviceLayerMapEntries = useMemo((): ServiceLayerMapEntry[] =>
    serviceLayers.map(layer => {
      const tmpl = LAYER_TEMPLATES.find(t => t.type === (layer as any).layer_type);
      return {
        layerId: layer.id,
        visible: layer.visible !== false,
        color: (layer as any).color || tmpl?.color || '#60a5fa',
        emoji: tmpl?.emoji || '📍',
        features: (svcLayerFeatures[layer.id] ?? []).map((f: any) => ({
          id: f.id,
          name: f.name,
          geometry: f.geometry,
          facility_type: f.facility_type,
        })),
      };
    }),
  [serviceLayers, svcLayerFeatures]);

  // Extraction layers for map rendering (per-layer color-coded)
  const extractionLayerEntries = useMemo(() => {
    const baseEntries = !layerExtractionResult || !Array.isArray(layerExtractionResult.layers)
      ? []
      : layerExtractionResult.layers.map((l: any) => ({
          layerKey: l.layer_key,
          layerName: l.layer_name,
          color: l.color || '#38bdf8',
          geojson: l.geojson || { type: 'FeatureCollection', features: [] },
          visible: layerExtractSelectedKeys.includes(l.layer_key),
        }));

    // ── الأصول التشغيلية — تُعرض كأشكالها الحقيقية (مضلع / مسار) ──────────
    if (layerPrincipalAssets.length > 0) {
      const assetFeatures = layerPrincipalAssets
        .filter((a: any) => a.geometry && a.geometry.type && a.geometry.coordinates)
        .map((a: any) => ({
          type: 'Feature',
          geometry: a.geometry,
          properties: { name: a.name, asset_id: a.id },
        }));
      if (assetFeatures.length > 0) {
        baseEntries.push({
          layerKey:  'operational_assets',
          layerName: 'الأصول التشغيلية',
          color:     '#10b981', // emerald — same as engineering workspace
          geojson:   { type: 'FeatureCollection' as const, features: assetFeatures },
          visible:   true,
        });
      }
    }

    // Also show study layer polygons as extraction-style overlay
    if (activeStudyLayer && studyLayerFeatures.length > 0) {
      const polygonFeatures = studyLayerFeatures
        .filter(f => f.type === 'polygon')
        .map(f => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: { name: f.name },
        }));
      if (polygonFeatures.length > 0) {
        baseEntries.push({
          layerKey:  `study_layer_${activeStudyLayer.id}`,
          layerName: activeStudyLayer.name,
          color:     activeStudyLayer.color,
          geojson:   { type: 'FeatureCollection' as const, features: polygonFeatures },
          visible:   true,
        });
      }
    }
    return baseEntries;
  }, [layerExtractionResult, layerExtractSelectedKeys, activeStudyLayer, studyLayerFeatures, layerPrincipalAssets]);

  useEffect(() => {
    syncClientTenantFromEnv();
    setWorkspace('satellite');
    refreshAll();
    loadContext();
    reloadServiceLayers();
  }, [setWorkspace, refreshAll, loadContext, reloadServiceLayers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onWindowError = (event: ErrorEvent) => {
      const msg = event?.message || '';
      const details = typeof event?.error?.message === 'string' ? event.error.message : '';
      const looksLikeChunk =
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        details.includes('Loading chunk') ||
        details.includes('ChunkLoadError');

      if (!looksLikeChunk) return;

      const alreadyRecovered = window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) === '1';
      if (!alreadyRecovered) {
        window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');
        const url = new URL(window.location.href);
        url.searchParams.set('_chunk_recover', String(Date.now()));
        window.location.replace(url.toString());
        return;
      }

      setError('حدث خطأ في تحميل ملفات الواجهة. حدّث الصفحة تحديثًا كاملًا (Ctrl+Shift+R).');
    };

    window.addEventListener('error', onWindowError);
    return () => window.removeEventListener('error', onWindowError);
  }, []);

  const { isRefreshing, triggerRefresh, freshnessLabel } = useSatelliteRefresh({
    enabled: true,
    intervalMs: 30_000,
    onRefresh: loadContext,
  });

  useEffect(() => {
    if (!drawnPolygon) {
      setAreaResult(null);
      setAreaReport(null);
      setAreaReportError(null);
      setMultiSourceData(null);
      setZonalStats(null);
      setObjectExtraction(null);
      setGeoprocessing(null);
      setTopologyQa(null);
      setDataSyncWarning(null);
      return;
    }

    setAreaLoading(true);
    try {
      setAreaResult(computeAreaStats(drawnPolygon, summary, activeSceneUid, areaReport, zonalStats, objectExtraction));
    } finally {
      setAreaLoading(false);
    }
  }, [drawnPolygon, summary, activeSceneUid, areaReport, zonalStats, objectExtraction]);

  useEffect(() => {
    const bbox = currentBbox;
    const polygon = activeArea?.polygon ?? drawnPolygon;
    if (!bbox && !polygon) return;
    refreshAreaProducts().catch(() => {
      // Error state is handled inside refreshAreaProducts.
    });
  }, [currentBbox, activeArea, drawnPolygon, refreshAreaProducts]);

  const handleRunAnalysis = useCallback(async () => {
    if (!activeSceneUid) return;
    setRunning(true);
    setError(null);
    try {
      const res = await getSceneSummary(activeSceneUid, activeWorkflow || 'environment_summary');
      setSummary(res.summary);
    } catch (e: any) {
      setSummary(null);
      setError(e?.message ?? 'فشل تشغيل تحليل المشهد');
    } finally {
      setRunning(false);
    }
  }, [activeSceneUid, activeWorkflow]);

  // Auto-rerun analysis when workflow changes (if a scene is already selected and result exists)
  useEffect(() => {
    if (!activeSceneUid || !systemOnline || !summary) return;
    handleRunAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkflow]);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden" dir="rtl">
      <SICHeader systemOnline={systemOnline} activeSceneUid={activeSceneUid} />

      {/* Task Guide Bar — shown when a task mode is active */}
      {taskMode && taskMode !== 'custom' && (
        <TaskGuideBar
          taskId={taskMode}
          currentStep={taskStep}
          onStepClick={(idx, group) => {
            setTaskStep(idx);
            patchRibbon({ activeGroup: group as any });
          }}
          onClearTask={() => { setTaskMode(null); setTaskStep(0); }}
        />
      )}

      {/* Create layer dialog */}
      {showCreateDialog && (
        <ServiceLayerCreateDialog
          municipalities={createDialogMunicipalities}
          onConfirm={handleCreateConfirmed}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      <SICRibbon
        scenes={scenes}
        workflows={workflows}
        activeSceneUid={activeSceneUid}
        activeWorkflow={activeWorkflow}
        drawMode={drawMode}
        baseStyle={baseStyle}
        running={running}
        systemOnline={systemOnline}
        isRefreshing={isRefreshing || loadingContext}
        hasResult={hasResult}
        archiveYear={archiveYear}
        archiveLoading={archiveLoading}
        onSceneChange={setActiveSceneUid}
        onWorkflowChange={setActiveWorkflow}
        onDrawModeChange={setDrawMode}
        onBaseStyleChange={setBaseStyle}
        onLoadArchiveYear={handleLoadArchiveYear}
        onRunAnalysis={handleRunAnalysis}
        onRefresh={triggerRefresh}
        ribbonState={ribbonState}
        onRibbonChange={(patch) => {
            patchRibbon(patch);
            // Advance task step when user switches to the next group
            if (taskMode && taskMode !== 'custom' && patch.activeGroup) {
              const task = TASKS.find(t => t.id === taskMode);
              if (task) {
                const nextIdx = task.steps.findIndex(s => s.ribbonGroup === patch.activeGroup);
                if (nextIdx >= 0 && nextIdx >= taskStep) setTaskStep(nextIdx);
              }
            }
          }}
        onRscToolChange={(tool) => {
          setRscActiveTool(tool);
          patchRibbon({ rscActiveTool: tool });
        }}
        routingPickMode={routingPickMode}
        routingStartPoint={routingStartPoint}
        routingEndPoint={routingEndPoint}
        onStartRoutingPick={(which) => setRoutingPickMode(which === 'start' ? 'picking_start' : 'picking_end')}
        onClearRoutingPoints={() => { setRoutingStartPoint(null); setRoutingEndPoint(null); setRoutingPath(null); setRoutingPickMode('idle'); }}
        onAddChildAsset={() => setLayerShowChildModal(true)}
        onStartLayerExtractionPolygon={() => {
          setGisDrawingMode('polygon');
          window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
        }}
        onMunicipalityChange={handleMunicipalityChange}
        onRunMunicipalityExtraction={handleRunMunicipalityExtraction}
        extractionBusy={extractBusy}
        drawnPolygon={effectivePolygon}
        showFireLayer={showFireLayer}
        showLeakLayer={showLeakLayer}
        showUrbanLeakLayer={showUrbanLeakLayer}
        showEncroachLayer={showEncroachLayer}
        fireLoading={fireLoading}
        leakLoading={leakLoading}
        urbanLeakLoading={urbanLeakLoading}
        encroachLoading={encroachLoading}
        fireCount={fireMarkers.length}
        leakCount={leakMarkers.length}
        urbanLeakCount={urbanLeakMarkers.length}
        encroachCount={encroachMarkers.length}
        onToggleFireLayer={() => {
          const next = !showFireLayer;
          setShowFireLayer(next);
          if (next && fireMarkers.length === 0) loadFireLayer();
          patchRibbon({ activeGroup: 'monitoring' });
        }}
        onToggleLeakLayer={() => {
          const next = !showLeakLayer;
          setShowLeakLayer(next);
          if (next && leakMarkers.length === 0) loadLeakLayer();
          patchRibbon({ activeGroup: 'monitoring' });
        }}
        onToggleUrbanLeakLayer={() => {
          const next = !showUrbanLeakLayer;
          setShowUrbanLeakLayer(next);
          if (next && urbanLeakMarkers.length === 0) loadUrbanLeakLayer();
          patchRibbon({ activeGroup: 'monitoring' });
        }}
        onToggleEncroachLayer={() => {
          const next = !showEncroachLayer;
          setShowEncroachLayer(next);
          if (next && encroachMarkers.length === 0) loadEncroachLayer();
          patchRibbon({ activeGroup: 'monitoring' });
        }}
        showAssetsOverlay={showAssetsOverlay}
        assetsOverlayCount={assetsOverlayMarkers.length}
        onToggleAssetsOverlay={() => {
          const next = !showAssetsOverlay;
          setShowAssetsOverlay(next);
          if (next && assetsOverlayMarkers.length === 0) loadAssetsOverlay();
        }}
        activeStudyLayer={activeStudyLayer}
        onOpenStudyLayer={handleOpenStudyLayer}
        onCloseStudyLayer={handleCloseStudyLayer}
        onStudyLayersChange={setStudyLayersList}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left panel: scenes list OR asset tree ────────────────────── */}
        {isLayersMode ? (
          <AssetLeftPanel
            selectedAssetId={layerSelectedAssetId}
            onSelectAsset={(id) => {
              setLayerSelectedAssetId(id);
              if (id) selectEntity('asset', id); else selectEntity(null, null);
            }}
            onCreatePrincipal={() => {
              setLayerPendingGeometry(null);
              setLayerPendingGeomType(null);
              setLayerShowCreateModal(true);
            }}
            refreshKey={layerRefreshKey}
            mode="engineering"
          />
        ) : isMonitoringMode ? (
          /* Monitoring Report Panel — single wide scrollable panel */
          <div className="w-96 shrink-0 border-l border-slate-800 bg-slate-900/80 flex flex-col overflow-hidden" dir="rtl">
            {/* Header */}
            <div className="shrink-0 px-3 py-2.5 bg-gradient-to-l from-orange-950/40 to-slate-900 border-b border-orange-800/30">
              <div className="flex items-center gap-2">
                <span className="text-base">🛰️</span>
                <div>
                  <p className="text-xs font-bold text-orange-200">تقرير الاستخبارات الفضائية</p>
                  <p className="text-[10px] text-slate-500">VIIRS + MODIS — {new Date().toLocaleDateString('ar-LY',{day:'numeric',month:'short'})}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* Fire section */}
              {showFireLayer ? (
                fireLoading ? (
                  <div className="px-3 py-4 flex flex-col items-center gap-2 border-b border-slate-800">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center animate-pulse"><span className="text-lg">🔥</span></div>
                    <p className="text-xs text-slate-400 text-center">جاري تحميل بيانات الحرائق…</p>
                    <p className="text-[10px] text-slate-600">NASA FIRMS VIIRS — قد يستغرق 10–30 ثانية</p>
                  </div>
                ) : fireMarkers.length > 0 ? (() => {
                  const s   = (fireApiData?.summary) ?? {};
                  // Use all_for_report (includes gas flares) for accurate counts
                  const allForReport: any[] = fireApiData?.all_for_report ?? [];
                  const countByCls = (cls: string) =>
                    allForReport.filter((c:any) => c.classification === cls).length;
                  const urbanCount   = countByCls('urban_incident')    || fireMarkers.filter((m:any)=>m.label?.includes('حضري')).length;
                  const fireCount    = countByCls('confirmed_fire')    || fireMarkers.filter((m:any)=>m.label?.includes('مؤكد')).length;
                  const recurCount   = countByCls('recurring_anomaly') || fireMarkers.filter((m:any)=>m.label?.includes('شذوذ')).length;
                  const flareCount   = countByCls('gas_flare')         || 0;
                  const singleCount  = countByCls('single_detection')  || 0;
                  const totalAll     = allForReport.length || fireMarkers.length;
                  const alerts: any[] = (fireApiData?.alert_clusters ?? []).slice(0,5);
                  const riskLevel   = s.risk_level ?? (urbanCount>5?'critical':urbanCount>0?'high':'medium');
                  const riskColor   = riskLevel==='critical'?'text-red-300':riskLevel==='high'?'text-orange-300':'text-amber-300';
                  const riskBg      = riskLevel==='critical'?'bg-red-500/10 border-red-500/30':riskLevel==='high'?'bg-orange-500/10 border-orange-500/30':'bg-amber-500/10 border-amber-500/30';
                  const totalAlerts = s.alert_worthy ?? (urbanCount + fireCount);
                  const cities      = (s.urban_cities as string[] | undefined) ?? [];
                  return (
                  <div className="border-b border-slate-800">
                    <div className={`mx-3 mt-2.5 mb-2 px-3 py-2 rounded-xl border ${riskBg}`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${riskColor}`}>
                          {riskLevel==='critical'?'🔴 مستوى حرج':riskLevel==='high'?'🟠 مستوى عالٍ':'🟡 متوسط'}
                        </span>
                        <span className="text-[10px] text-slate-500">{totalAlerts} تنبيه | {totalAll} رصد</span>
                      </div>
                      {cities.length>0&&<p className="text-[10px] text-slate-400 mt-0.5">مدن: {cities.slice(0,3).join('، ')}</p>}
                    </div>
                    {/* Classification table */}
                    <div className="px-3 pb-2">
                      <table className="w-full text-[11px]">
                        <tbody className="divide-y divide-slate-800">
                          {([
                            {icon:'🔴',lbl:'حوادث حضرية',   val:urbanCount,  c:'text-pink-300',   desc:'حريق قرب مدينة مأهولة'},
                            {icon:'🔥',lbl:'حرائق مؤكدة',   val:fireCount,   c:'text-red-300',    desc:'رُصد في AM + PM'},
                            {icon:'🟣',lbl:'حرق صناعي',      val:flareCount,  c:'text-purple-300', desc:'حقول نفط وتصفية — طبيعي'},
                            {icon:'🟠',lbl:'شذوذ حراري متكرر',val:recurCount, c:'text-orange-300', desc:'3+ أيام — مراقبة'},
                            {icon:'🟡',lbl:'رصد فردي',        val:singleCount, c:'text-yellow-300', desc:'مرة واحدة — يحتاج تأكيد'},
                          ] as any[]).filter(x=>x.val>0).map(({icon,lbl,val,c,desc})=>(
                            <tr key={lbl} className="hover:bg-slate-800/40">
                              <td className="py-1.5 pr-1"><span className={`font-medium ${c}`}>{icon} {lbl}</span></td>
                              <td className={`py-1.5 font-bold text-center w-8 ${c}`}>{val}</td>
                              <td className="py-1.5 pl-1 text-slate-600 text-[9px]">{desc}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-700">
                            <td className="py-1 text-slate-400 font-semibold">الإجمالي</td>
                            <td className="py-1 font-bold text-center text-slate-300">{totalAll}</td>
                            <td className="py-1 text-slate-600 text-[9px]">7 أيام الأخيرة</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {alerts.length>0&&(
                    <div className="px-3 pb-2.5">
                      <p className="text-[10px] font-bold text-slate-400 mb-1.5">⚡ أبرز التهديدات</p>
                      <div className="space-y-1">
                        {alerts.map((c:any,i:number)=>{
                          const isUrban=c.classification==='urban_incident', isFire=c.classification==='confirmed_fire', isFlare=c.classification==='gas_flare';
                          const clr=isUrban?'text-pink-300':isFire?'text-red-300':isFlare?'text-purple-300':'text-orange-300';
                          const bg2=isUrban?'bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20':isFire?'bg-red-500/10 border-red-500/20 hover:bg-red-500/20':'bg-slate-800/40 border-slate-700/30 hover:bg-slate-700/50';
                          const title=isUrban?`🔴 ${c.nearest_city??'مدينة'}`:isFire?'🔥 حريق مؤكد':isFlare?`🟣 ${c.known_flare_site??'حقل غاز'}`:'🟠 شذوذ';
                          return(
                            <button key={i} className={`w-full text-right px-2 py-1.5 rounded-lg text-[10px] border transition-colors ${bg2}`}
                              onClick={()=>c.lat&&c.lon&&setMapPopup({lat:c.lat,lon:c.lon,layerKey:'fire_viirs',label:title,
                                tooltip:[`القوة الحرارية: ${c.max_frp_mw??'?'} MW`,c.days_active?`${c.days_active} أيام نشطة`:'',c.alert_reason??'',c.nearest_city?`أقرب مدينة: ${c.nearest_city}`:'']
                                  .filter(Boolean).join('\n')})}>
                              <div className="flex items-center justify-between"><span className={`font-semibold ${clr}`}>{title}</span><span className="text-slate-500">{c.max_frp_mw??'?'} MW</span></div>
                              <p className="text-slate-500 truncate">{(c.alert_reason??'').slice(0,55)}</p>
                            </button>);
                        })}
                      </div>
                    </div>
                    )}
                    <div className="px-3 pb-3">
                      <details className="text-[10px] text-slate-500"><summary className="cursor-pointer hover:text-slate-400 mb-1">📖 دليل التصنيف</summary>
                        <div className="space-y-1 bg-slate-800/40 rounded-lg p-2">
                          <p>🔴 <strong className="text-pink-400">حادث حضري</strong>: حريق قرب مدينة — تحقق</p>
                          <p>🔥 <strong className="text-red-400">حريق مؤكد</strong>: AM + PM — نار حقيقية</p>
                          <p>🟠 <strong className="text-orange-400">شذوذ متكرر</strong>: 3+ أيام — نار بدوية</p>
                          <p>🟣 <strong className="text-purple-400">حرق صناعي</strong>: حقول نفط — طبيعي</p>
                        </div>
                      </details>
                    </div>
                  </div>);
                })() : (
                  <div className="px-3 py-3 border-b border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-500">لا توجد بيانات حرائق في الفترة الحالية</p>
                    <button
                      onClick={() => { setFireMarkers([]); loadFireLayer(); }}
                      className="px-3 py-1 text-[10px] bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg border border-orange-500/30 transition-colors"
                    >
                      🔄 إعادة المحاولة
                    </button>
                  </div>
                )
              ) : (
                <div className="px-3 py-4 flex flex-col items-center gap-2 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center"><span className="text-lg">🔥</span></div>
                  <p className="text-xs text-slate-400 text-center">انقر على <strong className="text-orange-300">حرائق VIIRS</strong> في الشريط العلوي لتفعيل الطبقة</p>
                </div>
              )}
              {/* Water Anomaly Scanner — ماسح الشذوذات المائية */}
              <WaterScannerPanel
                drawnPolygon={effectivePolygon}
                onStartDraw={() => { setDrawMode('polygon'); setWaterScanDrawing(true); }}
                onCancelDraw={() => { setDrawMode('off'); setWaterScanDrawing(false); }}
                onClearDraw={() => { setDrawnPolygon(null); setDrawMode('off'); setWaterScanDrawing(false); }}
                isDrawing={waterScanDrawing}
                onResultReady={(markers) => setWaterScanMarkers(markers)}
                onFlyTo={(lon, lat) => setFlyToPin({ lon, lat, zoom: 12 })}
              />
              {showEncroachLayer && encroachMarkers.length>0 && (
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-xs font-semibold text-rose-300">🚧 اعتداءات الحرم ({encroachMarkers.length})</p>
              </div>)}

            </div>
            <div className="shrink-0 px-3 py-2 border-t border-slate-800 bg-slate-900/80">
              <p className="text-[10px] text-slate-600">NOAA-20 + SNPP + MODIS | ≥0.5MW | 375م</p>
            </div>
          </div>
        ) : (
          <SatIntelLeftPanel
            scenes={scenes}
            activeSceneUid={activeSceneUid}
            onSelectScene={setActiveSceneUid}
            serviceLayers={serviceLayers}
            serviceLayersLoading={serviceLayersLoading}
            serviceLayersError={serviceLayersError}
            onReloadServiceLayers={reloadServiceLayers}
            onCreateServiceLayer={handleCreateServiceLayer}
            onToggleServiceLayer={handleToggleServiceLayer}
            onOpenLayerPanel={setActiveLayerPanel}
            svcLayerFeatureCounts={svcLayerFeatureCounts}
            drawnPolygon={effectivePolygon}
            areaResult={areaResult}
            areaLoading={areaLoading}
          />
        )}

        <div className={`min-w-0 relative transition-all duration-300 ${rightPanelSize === 'full' ? 'w-0 overflow-hidden flex-none' : 'flex-1'}`}>

          {/* Task Launch Panel — absolute overlay, only when NOT in monitoring/pipeline mode */}
          {taskMode === null && !isMonitoringMode && !isPipelineMode && (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
              <TaskLaunchPanel
                onSelectTask={(mode) => {
                setTaskMode(mode);
                setTaskStep(0);
                if (mode !== 'custom') {
                  const task = TASKS.find(t => t.id === mode);
                  if (task && task.steps.length > 0) {
                    patchRibbon({ activeGroup: task.steps[0].ribbonGroup as any });
                  }
                }
              }}
            />
            </div>
          )}

          <SceneMapPanel
            scenes={scenes}
            projects={projects}
            activeScene={activeSceneUid}
            drawMode={effectiveDrawMode}
            baseStyle={baseStyle}
            onSelectScene={isLayersMode ? undefined : setActiveSceneUid}
            onAreaDrawn={(coords) => {
              if (isLayersMode) {
                // Close the polygon ring and create GeoJSON geometry
                const ring = [...coords.map(c => [c[0], c[1]]), [coords[0][0], coords[0][1]]];
                const geom = { type: 'Polygon', coordinates: [ring] };
                const type = gisDrawingMode === 'line' ? 'path' : 'polygon';
                setLayerPendingGeometry(geom);
                setLayerPendingGeomType(type);
                setLayerShowCreateModal(true);
                setGisDrawingMode('idle');
              } else if (autoNetworkDrawing) {
                setAutoNetworkPolygon(coords as [number,number][]);
                setAutoNetworkDrawing(false);
              } else {
                setDrawnPolygon(coords);
                setActiveArea(null);
                // If a study layer is active, auto-save this feature to it
                if (activeStudyLayer) {
                  const isModePolygon = drawMode === 'polygon' || drawMode === 'box';
                  const geomType = isModePolygon ? 'Polygon' : 'LineString';
                  const geometry = isModePolygon
                    ? { type: 'Polygon', coordinates: [[...coords.map(c => [c[0], c[1]] as [number,number]), [coords[0][0], coords[0][1]]]] }
                    : { type: 'LineString', coordinates: coords.map(c => [c[0], c[1]]) };
                  handleStudyLayerFeatureSave(geometry);
                }
              }
            }}
            onDrawEnd={() => { setDrawMode('off'); if (isLayersMode) setGisDrawingMode('idle'); }}
            onCoordsChange={(nextLon, nextLat) => {
              setLon(nextLon);
              setLat(nextLat);
            }}
            onZoomChange={setZoom}
            serviceLayerFeatures={serviceLayerMapEntries}
            addPointMode={addPointMode ? { layerId: addPointMode.layerId, color: addPointMode.color, onPointPicked: addPointMode.onPointPicked } : null}
            onExitAddPointMode={() => setAddPointMode(null)}
            suitabilityPins={suitabilityPins}
            flyToPin={flyToPin}
            routingPickMode={routingPickMode}
            routingStartPoint={routingStartPoint}
            routingEndPoint={routingEndPoint}
            onRoutingPointPicked={(which, lon, lat) => {
              if (which === 'start') {
                setRoutingStartPoint([lon, lat]);
                setRoutingPickMode('idle');
              } else {
                setRoutingEndPoint([lon, lat]);
                setRoutingPickMode('idle');
              }
            }}
            routingPath={routingPath}
            routingEditMode={routingEditMode}
            onRoutingPathEdited={(coords) => {
              setRoutingPath(coords);
              setManualPathForPanel(coords.slice()); // trigger effect in OptimalPathPanel
            }}
            highlightBoundary={extractMuniGeom}
            onBaseStyleChange={setBaseStyle}
            extractionLayers={extractionLayerEntries}
            networkPickMode={networkPickMode}
            onNetworkPointPicked={(lon, lat) => {
              setNetworkPickedPoint([lon, lat]);
              setNetworkPickMode('idle');
            }}
            autoNetworkGeojson={autoNetworkGeojson}
            changeDetectionGeojson={changeDetectionGeojson}
            riskGeojson={riskGeojson}
            satelliteOverlayMarkers={satelliteOverlayMarkers.length > 0 ? satelliteOverlayMarkers : undefined}
            satelliteRouteLines={satelliteRouteLines.length > 0 ? satelliteRouteLines : undefined}
            onOverlayMarkerClick={(m) => {
                setMapPopup(m);
                // Fly map to the clicked marker location
                setFlyToPin({ lon: m.lon, lat: m.lat, zoom: 13 });
              }}
          />

          {/* ── Fire/satellite marker popup ─────────────────────────────── */}
          {mapPopup && (
            <div
              className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto min-w-[320px] max-w-[420px]"
              dir="rtl"
            >
              <div className={`rounded-2xl border shadow-2xl text-sm overflow-hidden ${
                mapPopup.layerKey === 'fire_viirs'   ? 'bg-slate-950 border-orange-400/60' :
                mapPopup.layerKey === 'urban_leak'   ? 'bg-slate-950 border-blue-400/60' :
                mapPopup.layerKey === 'gas_monitor'  ? 'bg-slate-950 border-violet-400/60' :
                                                       'bg-slate-950 border-cyan-400/60'
              }`}>
                {/* ── Header ──────────────────────────────── */}
                <div className={`flex items-center justify-between px-4 py-3 border-b ${
                  mapPopup.layerKey === 'fire_viirs' ? 'border-orange-500/30 bg-orange-500/15' :
                  mapPopup.layerKey === 'urban_leak' ? 'border-blue-500/30 bg-blue-500/15' :
                                                       'border-cyan-500/30 bg-cyan-500/15'
                }`}>
                  <span className="font-bold text-white text-base leading-tight">{mapPopup.label}</span>
                  <button onClick={() => setMapPopup(null)} className="text-slate-400 hover:text-white text-xl leading-none shrink-0 ml-3">×</button>
                </div>
                {/* ── Content ─────────────────────────────── */}
                <div className="px-4 py-3 space-y-2">
                  {mapPopup.tooltip.split('\n').filter(Boolean).map((line, i) => (
                    line !== mapPopup.label ? (
                      <p key={i} className="text-slate-200 text-sm leading-relaxed flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">
                          {line.startsWith('🔥') || line.startsWith('🔴') || line.startsWith('🟠') || line.startsWith('🟣') || line.startsWith('🟡') ? '' :
                           line.startsWith('احتمال') ? '📊' :
                           line.startsWith('القوة') ? '⚡' :
                           line.startsWith('نشط') ? '📅' :
                           line.startsWith('أقرب') ? '📍' :
                           line.startsWith('آخر') ? '🕐' :
                           line.startsWith('نوع') ? '🔧' : '•'}
                        </span>
                        <span>{line}</span>
                      </p>
                    ) : null
                  ))}
                </div>
                {/* ── Footer ──────────────────────────────── */}
                <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-slate-800/80 mt-1">
                  <span className="text-slate-500 text-xs font-mono">{mapPopup.lat.toFixed(5)}°N {mapPopup.lon.toFixed(5)}°E</span>
                  <span className="text-slate-600 text-[10px]">
                    {mapPopup.layerKey === 'fire_viirs' ? 'NASA FIRMS VIIRS' :
                     mapPopup.layerKey === 'urban_leak' ? 'Sentinel-2 SH Stats' : 'Sentinel Hub'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {addPointMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-900/90 border border-blue-500/60 text-blue-100 text-xs shadow-xl backdrop-blur-sm">
              <span>انقر على الخريطة لتحديد موقع المنشأة</span>
              <button onClick={() => setAddPointMode(null)} className="mr-2 text-blue-200 hover:text-white text-xs border border-blue-400/50 rounded px-1.5 py-0.5">إلغاء</button>
            </div>
          )}

          {error && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 max-w-[720px] px-3 py-2 rounded-xl bg-rose-950/80 border border-rose-700/50 text-rose-200 text-xs shadow-xl backdrop-blur-sm flex items-center gap-2">
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-rose-400 hover:text-white shrink-0">✕</button>
            </div>
          )}

          {/* Extraction busy indicator — inline in ribbon area, not a separate panel */}
          {extractBusy && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-900/90 border border-cyan-600/60 text-cyan-100 text-xs shadow-xl backdrop-blur-sm">
              <svg className="w-4 h-4 text-cyan-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              <span>{extractProgress || 'جاري التفكيك...'}</span>
            </div>
          )}

          {/* Analyze-this-area CTA — shown in layers mode when a municipality area is selected */}
          {isLayersMode && drawnPolygon && drawnPolygon.length > 2 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-900/90 border border-indigo-500/60 text-indigo-100 text-xs shadow-xl backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>منطقة محددة — يمكن تحليلها</span>
              <button
                onClick={() => {
                  patchRibbon({ activeGroup: 'report', reportSubTab: 'report' });
                  refreshAreaProducts();
                }}
                className="mr-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition-colors"
              >
                حلّل هذه المنطقة
              </button>
            </div>
          )}

          {/* Service layer features panel */}
          {activeLayerPanel && (
            <div className="absolute bottom-0 right-0 left-0 z-30 h-72 shadow-2xl">
              <ServiceLayerFeaturesPanel
                layer={activeLayerPanel}
                onClose={() => setActiveLayerPanel(null)}
                onEnterAddPointMode={(payload) => setAddPointMode(payload)}
                onFeaturesChanged={() => reloadServiceLayers()}
              />
            </div>
          )}

          {/* Asset detail panel — shown when layers mode + asset selected */}
          {isLayersMode && layerSelectedAssetId && (
            <AssetCenterPanel
              assetId={layerSelectedAssetId}
              onClose={() => { setLayerSelectedAssetId(null); selectEntity(null, null); }}
              onSelectChild={(id) => { setLayerSelectedAssetId(id); selectEntity('asset', id); }}
              onRedrawGeometry={(geometryType) => {
                if (!layerSelectedAssetId) return;
                window.dispatchEvent(new CustomEvent('engineering:redraw-asset', {
                  detail: { assetId: layerSelectedAssetId, geometryType },
                }));
              }}
            />
          )}

          {/* ── Extraction result sidebar ── vertical panel on right side, does NOT cover map */}
          {isLayersMode && layerExtractionResult && Array.isArray(layerExtractionResult.layers) && layerExtractionResult.layers.length > 0 && (
            <div
              className="absolute top-2 left-2 z-30 pointer-events-auto flex flex-col rounded-xl border border-cyan-800/50 bg-slate-900/95 backdrop-blur-sm shadow-2xl"
              style={{ width: layerExtractCollapsed ? '36px' : '200px', maxHeight: 'calc(100% - 16px)' }}
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-800 shrink-0">
                <button
                  onClick={() => setLayerExtractCollapsed(c => !c)}
                  className="flex items-center justify-center w-5 h-5 rounded text-cyan-400 hover:text-cyan-200 hover:bg-slate-800 transition-colors shrink-0"
                  title={layerExtractCollapsed ? 'توسيع' : 'طي'}
                >
                  <svg className={`w-3 h-3 transition-transform ${layerExtractCollapsed ? '-rotate-90' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {!layerExtractCollapsed && (
                  <>
                    <span className="text-[10px] font-bold text-cyan-300 truncate flex-1">نتائج التفكيك</span>
                    <button
                      onClick={() => {
                        setLayerExtractionResult(null);
                        setLayerExtractionScopeLabel('');
                        setLayerExtractSelectedKeys([]);
                        window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
                      }}
                      className="text-slate-500 hover:text-slate-300 text-xs shrink-0"
                    >✕</button>
                  </>
                )}
              </div>

              {!layerExtractCollapsed && (
                <>
                  {/* Scope + counts */}
                  <div className="px-2 py-1 border-b border-slate-800 shrink-0">
                    <div className="text-[9px] text-slate-400 truncate">{layerExtractionScopeLabel}</div>
                    <div className="text-[9px] text-slate-500">{layerExtractSelectedKeys.length} / {layerExtractionResult.layers.length} محددة</div>
                  </div>

                  {/* Layer list */}
                  <div className="flex flex-col gap-0.5 px-1.5 py-1.5 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
                    {layerExtractionResult.layers.map((layer: any) => {
                      const selected = layerExtractSelectedKeys.includes(layer.layer_key);
                      return (
                        <label
                          key={layer.layer_key}
                          className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                            selected ? 'border-cyan-500/50 bg-cyan-900/20' : 'border-slate-700/50 bg-slate-800/40 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={e => setLayerExtractSelectedKeys(prev =>
                              e.target.checked
                                ? [...new Set([...prev, layer.layer_key])]
                                : prev.filter((k: string) => k !== layer.layer_key)
                            )}
                            className="w-3 h-3 accent-cyan-500 shrink-0"
                          />
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: layer.color || '#38bdf8' }} />
                          <span className="flex-1 text-[10px] text-slate-100 font-medium truncate">{layer.layer_name}</span>
                          <span className="text-[9px] text-slate-400 shrink-0">{layer.feature_count}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 px-1.5 py-1.5 border-t border-slate-800 shrink-0">
                    <button
                      onClick={() => {
                        const all = layerExtractionResult.layers.map((l: any) => l.layer_key);
                        const allSelected = all.every((k: string) => layerExtractSelectedKeys.includes(k));
                        setLayerExtractSelectedKeys(allSelected ? [] : all);
                      }}
                      className="w-full text-[9px] text-slate-400 hover:text-slate-200 py-0.5 rounded border border-slate-700 bg-slate-800/60 transition-colors"
                    >
                      {layerExtractionResult.layers.every((l: any) => layerExtractSelectedKeys.includes(l.layer_key)) ? 'إلغاء الكل' : 'اختيار الكل'}
                    </button>
                    <button
                      disabled={layerExtractSaving || layerExtractSelectedKeys.length === 0}
                      onClick={async () => {
                        const TENANT_ID = (typeof window !== 'undefined' && window.localStorage.getItem('tenant_id')) || 'aaaaaaaa-0000-4000-a000-000000000001';
                        const layers = (layerExtractionResult.layers as any[]).filter((l: any) => layerExtractSelectedKeys.includes(l.layer_key));
                        if (!layers.length) return;
                        setLayerExtractSaving(true);
                        try {
                          for (const layer of layers) {
                            const feats = layer.geojson?.features || [];
                            if (!feats.length) continue;
                            const geoms = feats.map((f: any) => f?.geometry).filter(Boolean);
                            const geometry = geoms.length === 1 ? geoms[0] : { type: 'GeometryCollection', geometries: geoms };
                            await fetch('/api/engineering/workspace/principal-assets', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
                              body: JSON.stringify({
                                name: `${layerExtractionScopeLabel} — ${layer.layer_name}`,
                                geometry_type: String(geometry.type || '').toLowerCase().includes('polygon') ? 'polygon' : 'path',
                                classification: layer.layer_key,
                                owner_department: 'engineering',
                                status: 'active',
                                geometry,
                                properties: { source: 'layer_extraction', virtual: Boolean(layer.virtual) },
                                tenant_id: TENANT_ID,
                              }),
                            });
                          }
                          await fetch('/api/extraction-catalog/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
                            body: JSON.stringify({
                              jobId: layerExtractionResult?.job_id || null,
                              regionKey: layerExtractionScopeLabel.toLowerCase().replace(/\s+/g, '_'),
                              scopeLabel: layerExtractionScopeLabel,
                              layerData: layers.map((l: any) => ({
                                layer_key: l.layer_key, layer_name: l.layer_name,
                                feature_count: l.feature_count, color: l.color,
                                geojson: l.geojson, virtual: Boolean(l.virtual),
                              })),
                            }),
                          }).catch(() => {});
                          window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
                          setLayerRefreshKey(k => k + 1);
                          setLayerExtractionResult(null);
                          setLayerExtractionScopeLabel('');
                          setLayerExtractSelectedKeys([]);
                          window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
                        } catch (e: any) {
                          alert(`فشل الحفظ: ${e?.message}`);
                        } finally {
                          setLayerExtractSaving(false);
                        }
                      }}
                      className="w-full py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-[9px] font-bold transition-colors"
                    >
                      {layerExtractSaving ? '...' : `حفظ (${layerExtractSelectedKeys.length})`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* SatIntelRightPanel — hidden in monitoring & pipeline modes (they have their own panels) */}
        {!isMonitoringMode && !isPipelineMode && !focusMode && <SatIntelRightPanel
          summary={summary}
          loading={running}
          error={error}
          sceneUid={activeSceneUid}
          scenes={scenes}
          areaResult={areaResult}
          areaLoading={areaLoading}
          drawnPolygon={effectivePolygon}
          areaReport={areaReport}
          areaReportLoading={areaReportLoading}
          areaReportError={areaReportError}
          activeArea={activeArea}
          currentBbox={currentBbox}
          onLoadArea={(area) => {
            setActiveArea(area);
            setDrawnPolygon(area.polygon ?? null);
          }}
          multiSourceData={multiSourceData}
          zonalStats={zonalStats}
          objectExtraction={objectExtraction}
          geoprocessing={geoprocessing}
          topologyQa={topologyQa}
          multiSourceLoading={multiSourceLoading}
          dataSyncWarning={dataSyncWarning}
          onRunSceneAnalysis={handleRunAnalysis}
          onRunAreaProducts={refreshAreaProducts}
          onSuitabilityLocations={(pins) => setSuitabilityPins(pins)}
          onFlyTo={(lon, lat) => setFlyToPin({ lon, lat })}
          routingPickMode={routingPickMode}
          routingStartPoint={routingStartPoint}
          routingEndPoint={routingEndPoint}
          onStartRoutingPick={(which) => setRoutingPickMode(which === 'start' ? 'picking_start' : 'picking_end')}
          onClearRoutingPoints={() => { setRoutingStartPoint(null); setRoutingEndPoint(null); setRoutingPath(null); setRoutingPickMode('idle'); setRoutingEditMode('off'); setManualPathForPanel(null); }}
          onRoutingResultReady={(r) => setRoutingPath(r?.path?.coordinates ?? null)}
          routingEditMode={routingEditMode}
          onRoutingEditModeChange={setRoutingEditMode}
          externalManualPath={manualPathForPanel}
          networkPickMode={networkPickMode}
          networkPickedPoint={networkPickedPoint}
          onStartNetworkPick={() => setNetworkPickMode('picking_node')}
          onNetworkPickConsumed={() => { setNetworkPickedPoint(null); setNetworkPickMode('idle'); }}
          autoNetworkPolygon={autoNetworkPolygon}
          onStartAutoNetworkDraw={() => { setAutoNetworkDrawing(true); setGisDrawingMode('polygon'); }}
          onAutoNetworkResult={(geojson, _summary) => setAutoNetworkGeojson(geojson)}
          rscActiveTool={rscActiveTool}
          rscProcessing={rscProcessing}
          rscResult={rscResult}
          onRscProcessingChange={setRscProcessing}
          onRscResultChange={setRscResult}
          onChangeDetectionResult={(_result, geojson) => setChangeDetectionGeojson(geojson)}
          onRiskAssessmentResult={(_result, geojson) => setRiskGeojson(geojson)}
          forcedTab={forcedTab}
          hideTabBar={forcedTab !== null || isLayersMode}
          panelSize={rightPanelSize}
          onPanelSizeChange={setRightPanelSize}
        />}

        {/* Engineering asset modals */}
        {layerShowCreateModal && (
          <CreatePrincipalAssetModal
            geometry={layerPendingGeometry}
            geometryType={layerPendingGeomType}
            defaultName={layerPendingDefaults?.name}
            onSaved={(asset) => {
              const nextIdx = layerUploadIndex + 1;
              if (layerUploadedFeatures.length > 0 && nextIdx < layerUploadedFeatures.length) {
                // Advance to next uploaded feature
                const nf = layerUploadedFeatures[nextIdx];
                setLayerUploadIndex(nextIdx);
                setLayerPendingGeometry(nf?.geometry || null);
                setLayerPendingGeomType(String(nf?.geometry?.type ?? '').toLowerCase().includes('polygon') ? 'polygon' : 'path');
                const np = nf?.properties || {};
                setLayerPendingDefaults({ name: np.asset_name || '', classification: np.asset_type, ownerDept: np.owner_department, status: np.status });
                setLayerShowCreateModal(true);
              } else {
                setLayerShowCreateModal(false);
                setLayerPendingGeometry(null);
                setLayerPendingGeomType(null);
                setLayerPendingDefaults(null);
                setLayerUploadedFeatures([]);
                setLayerUploadIndex(0);
                window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
              }
              setLayerRefreshKey(k => k + 1);
              setLayerSelectedAssetId(asset.id);
              selectEntity('asset', asset.id);
              window.dispatchEvent(new CustomEvent('engineering:refresh-principal-layer'));
            }}
            onClose={() => {
              setLayerShowCreateModal(false);
              setLayerPendingGeometry(null);
              setLayerPendingDefaults(null);
              setLayerUploadedFeatures([]);
              setLayerUploadIndex(0);
            }}
            onStartDrawing={(mode) => {
              setLayerShowCreateModal(false);
              setGisDrawingMode(mode === 'polygon' ? 'polygon' : 'line');
            }}
          />
        )}
        {layerShowChildModal && (
          <AddChildAssetModal
            principalAssets={layerPrincipalAssets}
            preselectedParentId={layerSelectedAssetId}
            onSaved={() => { setLayerShowChildModal(false); setLayerRefreshKey(k => k + 1); }}
            onClose={() => setLayerShowChildModal(false)}
          />
        )}
      </div>

      <SatIntelBottomBar
        lon={lon}
        lat={lat}
        zoom={zoom}
        freshnessLabel={freshnessLabel}
        systemOnline={systemOnline}
        sceneCount={scenes.length}
      />

      {/* GIS Layer Editor overlay — standalone (when opened separately) */}
      {layerEditorOpen && ribbonState.activeGroup !== 'layers' && (
        <SICLayerEditorPanel onClose={() => setLayerEditorOpen(false)} />
      )}
    </div>
  );
}