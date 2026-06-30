'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

function polygonToBbox(polygon: [number, number][] | null): [number, number, number, number] | null {
  if (!polygon || polygon.length === 0) return null;
  return [
    Math.min(...polygon.map(c => c[0])),
    Math.min(...polygon.map(c => c[1])),
    Math.max(...polygon.map(c => c[0])),
    Math.max(...polygon.map(c => c[1])),
  ];
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

  const isLayersMode = ribbonState.activeGroup === 'layers';
  const isMonitoringMode = ribbonState.activeGroup === 'monitoring';

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
    if (g === 'monitoring') return 'satellite_trend' as const;
    // ── New: ribbon buttons now open their dedicated right-panel tool ──────
    if (g === 'detection') return 'object_detection' as const;
    if (g === 'insar')     return 'insar' as const;
    if (g === 'cva')       return 'change_detection' as const;
    if (g === 'spatial_analyst') return 'spatial_analyst' as const;
    if (g === 'image_analyst')   return 'image_analyst' as const;
    if (g === '3d_analyst')      return '3d_analyst' as const;
    if (g === 'report') return (ribbonState.reportSubTab ?? 'report') as 'report' | 'chat' | 'temporal' | 'simulation' | 'areas';
    return null;
  }, [ribbonState.activeGroup, ribbonState.reportSubTab]);

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
    if (!layerExtractionResult || !Array.isArray(layerExtractionResult.layers)) return [];
    return layerExtractionResult.layers
      .map((l: any) => ({
        layerKey: l.layer_key,
        layerName: l.layer_name,
        color: l.color || '#38bdf8',
        geojson: l.geojson || { type: 'FeatureCollection', features: [] },
        visible: layerExtractSelectedKeys.includes(l.layer_key),
      }));
  }, [layerExtractionResult, layerExtractSelectedKeys]);

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
        onRibbonChange={patchRibbon}
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
          <div className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden">
            <SmartAlertsPanel
              scenes={scenes}
              drawnPolygon={effectivePolygon}
              onResultReady={() => {}}
            />
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
          />

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

        <SatIntelRightPanel
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
        />

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