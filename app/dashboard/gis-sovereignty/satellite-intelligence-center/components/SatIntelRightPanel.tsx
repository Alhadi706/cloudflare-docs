'use client';
// ─── SatIntelRightPanel — Phase S12 ──────────────────────────────────────────
// Simplified 5-tab panel:
//   تقرير · محادثة · زمني · محاكاة · مناطق
// Area tab auto-activates when report arrives. No technical jargon exposed.

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, MessageCircle, GitCompare, Zap, FolderOpen, AlertCircle, ShieldCheck, Target, Route, Droplets,
} from 'lucide-react';
import type { SceneSummaryContract, SceneListItem } from '@/lib/satelliteIntelAPI';
import type { AreaIntelResult } from '@/lib/areaIntelEngine';
import type { AreaReport } from '@/lib/areaReportAPI';
import type { SmartArea, TemporalCompareResult, TimeSeriesResult } from '@/lib/s12API';
import type { MultiSourceResponse } from '@/lib/multiSourceAPI';
import type { ZonalStatsResult } from '@/lib/zonalStatsAPI';
import type { ObjectExtractionResult } from '@/lib/objectExtractionAPI';
import type { GeoprocessingResult } from '@/lib/geoprocessingAPI';
import type { TopologyQaResult } from '@/lib/topologyQaAPI';
import { sourceStackLabel, evidenceLevelAr, dataTypes } from '@/lib/multiSourceAPI';
import { fetchSimulation, fetchTemporalCompare, fetchTimeSeries } from '@/lib/s12API';
import { fetchTerrain3DAnalysis, type Terrain3DResponse } from '@/lib/terrain3DAPI';
import {
  evaluateTerrain3DBenchmark,
  TERRAIN_3D_BENCHMARK_PRESETS,
  type Terrain3DBenchmarkResult,
} from '@/lib/terrain3DBenchmark';
import {
  SIC_AUDIT_POLICY_V1,
  pickTerrainBenchmarkPreset,
  evaluateTerrainPolicyStatus,
  evaluateQualityGatePolicyStatus,
} from '@/lib/sicAuditPolicy';
import { evaluateArcGisParity, type ArcGisParityResult } from '@/lib/arcgisParity';
import AreaReportPanel, { AreaReportSkeleton } from './AreaReportPanel';
import AreaIntelligencePanel from './AreaIntelligencePanel';
import TemporalPanel         from './TemporalPanel';
import SimulationPanel       from './SimulationPanel';
import SmartAreaPanel        from './SmartAreaPanel';
import SICChat               from './SICChat';
import PDFReportGenerator    from './PDFReportGenerator';
import ArcGisReadinessPanel  from './ArcGisReadinessPanel';
import Terrain3DPanel        from './Terrain3DPanel';
import SuitabilityPanel, { type SuitabilityPin } from './SuitabilityPanel';
import OptimalPathPanel from './OptimalPathPanel';
import ChangeDetectionPanel from './ChangeDetectionPanel';
import RiskAssessmentPanel from './RiskAssessmentPanel';
import SmartAlertsPanel from './SmartAlertsPanel';
import SatelliteTrendPanel from './SatelliteTrendPanel';
import ObjectDetectionPanel from './ObjectDetectionPanel';
import InSARPanel from './InSARPanel';
import NetworkDesignPanel from './NetworkDesignPanel';
import RSCRightPanel, { PanSharpPanel } from '../../remote-sensing-center/components/RSCRightPanel';
import type { RSCModule, RSCTool } from '../../remote-sensing-center/components/RemoteSensingShell';

type RightTab = 'report' | 'chat' | 'temporal' | 'simulation' | 'areas' | 'terrain3d' | 'compliance' | 'suitability' | 'routing' | 'change_detection' | 'risk' | 'alerts' | 'satellite_trend' | 'object_detection' | 'insar' | 'network' | 'spatial_analyst' | 'image_analyst' | '3d_analyst';
type AuditAxisStatus = 'pass' | 'warn' | 'fail';

interface FullAuditSnapshot {
  runId: string;
  ranAt: string;
  scene: AuditAxisStatus;
  spatial: AuditAxisStatus;
  qualityGate: AuditAxisStatus;
  temporal: AuditAxisStatus;
  simulation: AuditAxisStatus;
  terrain3d: AuditAxisStatus;
  benchmark: AuditAxisStatus;
}

interface CanonicalKpiSnapshot {
  runId: string;
  createdAt: string;
  year: number;
  buildings_count: number;
  trees_count: number;
  road_km_paved: number;
  road_km_unpaved: number;
  population_est: number;
  source: string;
  confidenceScore: number;
  driftLevel: 'low' | 'medium' | 'high';
  maxDriftPct: number;
  driftMetrics: {
    buildings_pct: number;
    trees_pct: number;
    road_paved_pct: number;
    population_pct: number;
  };
}

interface StoredAuditHistoryItem {
  id: string;
  created_at: string;
  run_id: string;
  verdict: 'accepted' | 'conditional' | 'rejected';
  signature_sha256: string;
}

interface StoredParityHistoryItem {
  id: string;
  created_at: string;
  run_id: string;
  score: number;
  verdict: 'ahead' | 'near' | 'behind';
}

function computeAuditVerdict(snapshot: FullAuditSnapshot): 'accepted' | 'conditional' | 'rejected' {
  const statuses: AuditAxisStatus[] = [
    snapshot.scene,
    snapshot.spatial,
    snapshot.qualityGate,
    snapshot.temporal,
    snapshot.simulation,
    snapshot.terrain3d,
    snapshot.benchmark,
  ];
  if (statuses.includes('fail')) return 'rejected';
  if (statuses.includes('warn')) return 'conditional';
  return 'accepted';
}

function closeRing(coords: [number, number][]): [number, number][] {
  if (coords.length === 0) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
}

function bboxFromRing(coords: [number, number][]): [number, number, number, number] {
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function ringFromBbox(b: [number, number, number, number]): [number, number][] {
  return [
    [b[0], b[1]],
    [b[2], b[1]],
    [b[2], b[3]],
    [b[0], b[3]],
    [b[0], b[1]],
  ];
}

function bufferBboxMeters(
  b: [number, number, number, number],
  meters: number
): [number, number, number, number] {
  const centerLatRad = ((b[1] + b[3]) / 2) * (Math.PI / 180);
  const latDelta = meters / 111320;
  const lonDelta = meters / Math.max(1e-6, 111320 * Math.cos(centerLatRad));
  return [b[0] - lonDelta, b[1] - latDelta, b[2] + lonDelta, b[3] + latDelta];
}

function intersectBboxes(
  a: [number, number, number, number],
  b: [number, number, number, number]
): [number, number, number, number] | null {
  const i: [number, number, number, number] = [
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
    Math.min(a[2], b[2]),
    Math.min(a[3], b[3]),
  ];
  return i[0] < i[2] && i[1] < i[3] ? i : null;
}

function approxBboxAreaM2(b: [number, number, number, number]): number {
  const latMid = ((b[1] + b[3]) / 2) * (Math.PI / 180);
  const widthM = (b[2] - b[0]) * 111320 * Math.cos(latMid);
  const heightM = (b[3] - b[1]) * 111320;
  return Math.max(0, widthM * heightM);
}

function toFeatureCollection(
  name: string,
  ring: [number, number][],
  properties: Record<string, unknown>
) {
  return {
    type: 'FeatureCollection',
    name,
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
    features: [
      {
        type: 'Feature',
        properties,
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      },
    ],
  };
}

interface Props {
  summary:            SceneSummaryContract | null;
  loading:            boolean;
  error:              string | null;
  sceneUid:           string | null;
  scenes:             SceneListItem[];
  areaResult:         AreaIntelResult | null;
  areaLoading:        boolean;
  drawnPolygon:       [number, number][] | null;
  areaReport:         AreaReport | null;
  areaReportLoading:  boolean;
  areaReportError:    string | null;
  activeArea?:        SmartArea | null;
  currentBbox?:       [number, number, number, number] | null;
  onLoadArea?:        (area: SmartArea) => void;
  multiSourceData?:    MultiSourceResponse | null;
  zonalStats?:         ZonalStatsResult | null;
  objectExtraction?:   ObjectExtractionResult | null;
  geoprocessing?:      GeoprocessingResult | null;
  topologyQa?:         TopologyQaResult | null;
  multiSourceLoading?: boolean;
  dataSyncWarning?:    string | null;
  onRunSceneAnalysis?: () => Promise<void> | void;
  onRunAreaProducts?: (options?: { requireNative?: boolean; bbox?: [number, number, number, number] | null; polygon?: [number, number][] | null }) => Promise<{
    report: AreaReport | null;
    multi: MultiSourceResponse | null;
    zonal: ZonalStatsResult | null;
    objects: ObjectExtractionResult | null;
    geoprocessing: GeoprocessingResult | null;
    topologyQa: TopologyQaResult | null;
  }>;
  onSuitabilityLocations?: (pins: SuitabilityPin[]) => void;
  onFlyTo?: (lon: number, lat: number, zoom?: number) => void;
  // Routing props
  routingPickMode?: 'idle' | 'picking_start' | 'picking_end';
  routingStartPoint?: [number, number] | null;
  routingEndPoint?: [number, number] | null;
  onStartRoutingPick?: (which: 'start' | 'end') => void;
  onClearRoutingPoints?: () => void;
  onRoutingResultReady?: (result: any | null) => void;
  routingEditMode?: 'off' | 'modify' | 'draw';
  onRoutingEditModeChange?: (mode: 'off' | 'modify' | 'draw') => void;
  externalManualPath?: [number, number][] | null;
  // Network design props
  networkPickMode?: 'idle' | 'picking_node';
  networkPickedPoint?: [number, number] | null;
  onStartNetworkPick?: () => void;
  onNetworkPickConsumed?: () => void;
  // Auto-network from polygon
  autoNetworkPolygon?: [number, number][] | null;
  onStartAutoNetworkDraw?: () => void;
  onAutoNetworkResult?: (geojson: any, summary: any) => void;
  // Change Detection
  onChangeDetectionResult?: (result: any | null, geojson: any | null) => void;
  // Risk Assessment
  onRiskAssessmentResult?: (result: any | null, geojson: any | null) => void;
  // Smart Alerts
  onAlertsResult?: (geojson: any | null) => void;
  // RSC (Remote Sensing Center) merged state
  rscActiveTool?: string;
  rscProcessing?: boolean;
  rscResult?: any;
  onRscResultChange?: (r: any) => void;
  onRscProcessingChange?: (v: boolean) => void;
  /** When set by ribbon, overrides the internal tab */
  forcedTab?: RightTab | null;
  /** Hide the internal tab bar (ribbon controls navigation) */
  hideTabBar?: boolean;
  /** Controlled panel size — managed by parent (Shell) */
  panelSize?: 'normal' | 'wide' | 'half' | 'full';
  onPanelSizeChange?: (size: 'normal' | 'wide' | 'half' | 'full') => void;
}

function buildDemoAoi(sceneUid: string | null): SmartArea | null {
  if (!sceneUid) return null;

  let bbox: [number, number, number, number] | null = null;
  if (sceneUid.includes('T33SUU') || sceneUid.includes('TRIPOLI')) {
    bbox = [12.8, 32.5, 13.6, 33.3];
  } else if (sceneUid.includes('33SUS')) {
    bbox = [13.0, 31.8, 13.8, 32.6];
  }

  if (!bbox) return null;

  const polygon: [number, number][] = [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[1]],
    [bbox[2], bbox[3]],
    [bbox[0], bbox[3]],
  ];

  return {
    id: `demo-${sceneUid}`,
    name: `AOI تجريبي — ${sceneUid}`,
    bbox,
    polygon,
    linked_project_id: null,
    notes: 'Demo AOI auto-loaded to complete SIC audit flow when no drawn area is present.',
    created_at: new Date().toISOString(),
    simulations: [],
  };
}

function createAuditRunId(): string {
  const t = Date.now();
  const r = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return `AUD-${t}-${r}`;
}

function pctDiff(a: number, b: number): number {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / denom;
}

function verdictClass(verdict: StoredAuditHistoryItem['verdict']): string {
  if (verdict === 'accepted') return 'text-emerald-300 border-emerald-700/40 bg-emerald-950/25';
  if (verdict === 'conditional') return 'text-amber-300 border-amber-700/40 bg-amber-950/25';
  return 'text-rose-300 border-rose-700/40 bg-rose-950/25';
}

function verdictLabel(verdict: StoredAuditHistoryItem['verdict']): string {
  if (verdict === 'accepted') return 'مقبول';
  if (verdict === 'conditional') return 'قبول مشروط';
  return 'مرفوض';
}

function verdictRank(verdict: StoredAuditHistoryItem['verdict']): number {
  if (verdict === 'accepted') return 2;
  if (verdict === 'conditional') return 1;
  return 0;
}

function reconcileKpiSnapshot(params: {
  runId: string;
  temporal: TemporalCompareResult;
  areaReport: AreaReport | null;
}): CanonicalKpiSnapshot {
  const { runId, temporal, areaReport } = params;

  if (!areaReport) {
    return {
      runId,
      createdAt: new Date().toISOString(),
      year: temporal.year_to,
      buildings_count: temporal.to_snapshot.buildings_count,
      trees_count: temporal.to_snapshot.trees_count,
      road_km_paved: temporal.to_snapshot.road_km_paved,
      road_km_unpaved: 0,
      population_est: temporal.to_snapshot.population_est,
      source: 'temporal-only',
      confidenceScore: 55,
      driftLevel: 'high',
      maxDriftPct: 0,
      driftMetrics: {
        buildings_pct: 0,
        trees_pct: 0,
        road_paved_pct: 0,
        population_pct: 0,
      },
    };
  }

  const est = areaReport.spatial_estimates;
  const t = temporal.to_snapshot;

  const buildingsDrift = pctDiff(est.buildings_count, t.buildings_count);
  const treesDrift = pctDiff(est.trees_count, t.trees_count);
  const roadsDrift = pctDiff(est.road_km_paved, t.road_km_paved);
  const populationDrift = pctDiff(est.population_est, t.population_est);

  const maxDrift = Math.max(buildingsDrift, treesDrift, roadsDrift, populationDrift);
  const driftLevel: 'low' | 'medium' | 'high' =
    maxDrift > 0.35 ? 'high' : maxDrift > 0.18 ? 'medium' : 'low';

  const blend = (primary: number, secondary: number): number => {
    if (driftLevel === 'high') return primary;
    if (driftLevel === 'medium') return (primary * 0.65) + (secondary * 0.35);
    return (primary + secondary) / 2;
  };

  const confidenceScore = Math.max(45, Math.round((1 - maxDrift) * 100));

  return {
    runId,
    createdAt: new Date().toISOString(),
    year: temporal.year_to,
    buildings_count: Math.round(blend(est.buildings_count, t.buildings_count)),
    trees_count: Math.round(blend(est.trees_count, t.trees_count)),
    road_km_paved: Number(blend(est.road_km_paved, t.road_km_paved).toFixed(1)),
    road_km_unpaved: est.road_km_unpaved,
    population_est: Math.round(blend(est.population_est, t.population_est)),
    source: `reconciled-area+temporal-${driftLevel}`,
    confidenceScore,
    driftLevel,
    maxDriftPct: Math.round(maxDrift * 100),
    driftMetrics: {
      buildings_pct: Math.round(buildingsDrift * 100),
      trees_pct: Math.round(treesDrift * 100),
      road_paved_pct: Math.round(roadsDrift * 100),
      population_pct: Math.round(populationDrift * 100),
    },
  };
}

async function persistAuditReport(payload: {
  runId: string;
  verdict: 'accepted' | 'conditional' | 'rejected';
  benchmark: Terrain3DBenchmarkResult;
  snapshot: FullAuditSnapshot;
  canonicalKpi: CanonicalKpiSnapshot;
  sceneUid: string | null;
}) {
  const res = await fetch('/api/satellite/audit-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: payload.runId,
      verdict: payload.verdict,
      benchmark: payload.benchmark,
      result: {
        policy: {
          version: SIC_AUDIT_POLICY_V1.version,
          name: SIC_AUDIT_POLICY_V1.name,
        },
        snapshot: payload.snapshot,
        canonical_kpi: payload.canonicalKpi,
        scene_uid: payload.sceneUid,
      },
    }),
  });
  if (!res.ok) {
    throw new Error('audit_persistence_failed');
  }
}

async function persistParityReport(result: ArcGisParityResult) {
  const res = await fetch('/api/satellite/parity-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: result.run_id,
      score: result.score,
      verdict: result.verdict,
      result,
    }),
  });
  if (!res.ok) {
    throw new Error('parity_persistence_failed');
  }
}

export default function SatIntelRightPanel({
  

  summary, loading, error, sceneUid, scenes,
  areaResult, areaLoading, drawnPolygon,
  areaReport, areaReportLoading, areaReportError,
  activeArea, currentBbox, onLoadArea,
  multiSourceData, zonalStats, objectExtraction, geoprocessing, topologyQa, multiSourceLoading, dataSyncWarning, onRunSceneAnalysis, onRunAreaProducts,
  onSuitabilityLocations, onFlyTo,
  routingPickMode = 'idle', routingStartPoint, routingEndPoint,
  onStartRoutingPick, onClearRoutingPoints, onRoutingResultReady,
  routingEditMode = 'off', onRoutingEditModeChange, externalManualPath,
  networkPickMode = 'idle', networkPickedPoint, onStartNetworkPick, onNetworkPickConsumed,
  autoNetworkPolygon, onStartAutoNetworkDraw, onAutoNetworkResult,
  onChangeDetectionResult, onRiskAssessmentResult, onAlertsResult,
  rscActiveTool, rscProcessing = false, rscResult, onRscResultChange, onRscProcessingChange,
  forcedTab, hideTabBar,
  panelSize = 'normal', onPanelSizeChange,
}: Props) {
  const [tab, setTab] = useState<RightTab>('report');
  // panelWide is kept for backward compat but driven by panelSize prop
  const panelWide = panelSize === 'wide' || panelSize === 'half' || panelSize === 'full';

  // Sync forcedTab from ribbon into internal state
  useEffect(() => {
    if (forcedTab) setTab(forcedTab);
  }, [forcedTab]);

  // S11.2 — track temporal/simulation context for chat grounding
  const [temporalNarrative,  setTemporalNarrative]  = useState<string | null>(null);
  const [temporalYearFrom,   setTemporalYearFrom]   = useState<number | null>(null);
  const [temporalYearTo,     setTemporalYearTo]     = useState<number | null>(null);
  const [simulationNarrative,setSimulationNarrative]= useState<string | null>(null);
  const [simulationYear,     setSimulationYear]     = useState<number | null>(null);
  // S11.3 — store full results for charts
  const [temporalCompare,    setTemporalCompare]    = useState<TemporalCompareResult | null>(null);
  const [timeSeries,         setTimeSeries]         = useState<TimeSeriesResult | null>(null);
  const [terrain3DResult,    setTerrain3DResult]    = useState<Terrain3DResponse | null>(null);
  const [terrain3DBenchmark, setTerrain3DBenchmark] = useState<Terrain3DBenchmarkResult | null>(null);
  const [fullAuditRunning,   setFullAuditRunning]   = useState(false);
  const [fullAuditStatus,    setFullAuditStatus]    = useState<string | null>(null);
  const [fullAuditSnapshot,  setFullAuditSnapshot]  = useState<FullAuditSnapshot | null>(null);
  const [canonicalKpiSnapshot, setCanonicalKpiSnapshot] = useState<CanonicalKpiSnapshot | null>(null);
  const [auditHistory, setAuditHistory] = useState<StoredAuditHistoryItem[]>([]);
  const [auditHistoryLoading, setAuditHistoryLoading] = useState(false);
  const [auditHistoryError, setAuditHistoryError] = useState<string | null>(null);
  const [parityHistory, setParityHistory] = useState<StoredParityHistoryItem[]>([]);
  const [parityHistoryLoading, setParityHistoryLoading] = useState(false);
  const [parityHistoryError, setParityHistoryError] = useState<string | null>(null);

  const loadAuditHistory = useCallback(async (limit = 8) => {
    setAuditHistoryLoading(true);
    setAuditHistoryError(null);
    try {
      const res = await fetch(`/api/satellite/audit-reports?limit=${limit}`, { cache: 'no-store' });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || 'audit_history_fetch_failed');
      }
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setAuditHistory(items);
    } catch {
      setAuditHistoryError('تعذر جلب سجل الاعتمادات حالياً.');
    } finally {
      setAuditHistoryLoading(false);
    }
  }, []);

  const loadParityHistory = useCallback(async (limit = 8) => {
    setParityHistoryLoading(true);
    setParityHistoryError(null);
    try {
      const res = await fetch(`/api/satellite/parity-reports?limit=${limit}`, { cache: 'no-store' });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || 'parity_history_fetch_failed');
      }
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setParityHistory(items);
    } catch {
      setParityHistoryError('تعذر جلب سجل parity حالياً.');
    } finally {
      setParityHistoryLoading(false);
    }
  }, []);

  const handleTemporalResult = useCallback((narrative: string, from: number, to: number, fullResult?: TemporalCompareResult) => {
    setTemporalNarrative(narrative);
    setTemporalYearFrom(from);
    setTemporalYearTo(to);
    if (fullResult) {
      setTemporalCompare(fullResult);
      if (areaReport) {
        const runId = fullAuditSnapshot?.runId || canonicalKpiSnapshot?.runId || `AUTO-${Date.now()}`;
        setCanonicalKpiSnapshot(reconcileKpiSnapshot({
          runId,
          temporal: fullResult,
          areaReport,
        }));
      }
    }
  }, [areaReport, canonicalKpiSnapshot?.runId, fullAuditSnapshot?.runId]);

  useEffect(() => {
    if (!temporalCompare || !areaReport) return;
    setCanonicalKpiSnapshot((prev) => {
      const runId = fullAuditSnapshot?.runId || prev?.runId || `AUTO-${Date.now()}`;
      return reconcileKpiSnapshot({
        runId,
        temporal: temporalCompare,
        areaReport,
      });
    });
  }, [temporalCompare, areaReport, fullAuditSnapshot?.runId]);

  const handleSeriesResult = useCallback((result: TimeSeriesResult) => {
    setTimeSeries(result);
  }, []);

  const handleSimulationResult = useCallback((narrative: string, year: number) => {
    setSimulationNarrative(narrative);
    setSimulationYear(year);
  }, []);

  useEffect(() => {
    if (areaReport) setTab('report');
  }, [areaReport]);

  useEffect(() => {
    if (tab === 'compliance') {
      void loadAuditHistory();
      void loadParityHistory();
    }
  }, [tab, loadAuditHistory, loadParityHistory]);

  const latestDelta = (() => {
    if (auditHistory.length < 2) return null;
    const current = auditHistory[0];
    const previous = auditHistory[1];
    const diff = verdictRank(current.verdict) - verdictRank(previous.verdict);
    const trend: 'up' | 'flat' | 'down' = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    return { current, previous, diff, trend };
  })();

  const hasReport = !!areaReport;

  const TABS: { id: RightTab; label: string; Icon: React.ElementType; badge?: boolean }[] = [
    { id: 'report',     label: 'تقرير',  Icon: FileText,       badge: hasReport },
    { id: 'chat',       label: 'محادثة', Icon: MessageCircle                    },
    { id: 'temporal',   label: 'زمني',   Icon: GitCompare                       },
    { id: 'simulation', label: 'محاكاة', Icon: Zap                              },
    { id: 'areas',      label: 'مناطق',  Icon: FolderOpen                       },
    { id: 'terrain3d',    label: '3D',      Icon: Zap                              },
    { id: 'suitability',  label: 'ملاءمة',  Icon: Target                           },
    { id: 'routing',      label: 'مسار',    Icon: Route                            },
    { id: 'network',      label: 'شبكات',   Icon: Droplets                         },
    { id: 'compliance',   label: 'مطابقة',  Icon: ShieldCheck                      },
  ];

  const bbox: [number, number, number, number] | null = (() => {
    if (activeArea?.bbox) return activeArea.bbox as [number, number, number, number];
    if (currentBbox)      return currentBbox;
    if (drawnPolygon && drawnPolygon.length > 0) {
      const lons = drawnPolygon.map(c => c[0]);
      const lats = drawnPolygon.map(c => c[1]);
      return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    }
    return null;
  })();

  const demoAoi = !bbox ? buildDemoAoi(sceneUid) : null;

  const runFullAudit = useCallback(async () => {
    if (!sceneUid) {
      setFullAuditStatus('لا يمكن بدء الفحص الشامل: اختر صورة فضائية أولاً.');
      return;
    }

    setFullAuditRunning(true);
    setFullAuditStatus(null);
    try {
      const runId = createAuditRunId();

      if (onRunSceneAnalysis) {
        await Promise.resolve(onRunSceneAnalysis());
      }

      let ensuredAreaReport = areaReport;
      let ensuredZonalStats = zonalStats;
      let ensuredObjectExtraction = objectExtraction;
      let ensuredGeoprocessing = geoprocessing;
      let ensuredTopologyQa = topologyQa;
      if (onRunAreaProducts) {
        const areaProducts = await onRunAreaProducts({
          requireNative: true,
          bbox: demoAoi?.bbox ?? bbox,
          polygon: demoAoi?.polygon ?? drawnPolygon ?? undefined,
        });
        ensuredAreaReport = areaProducts?.report ?? ensuredAreaReport;
        ensuredZonalStats = areaProducts?.zonal ?? ensuredZonalStats;
        ensuredObjectExtraction = areaProducts?.objects ?? ensuredObjectExtraction;
        ensuredGeoprocessing = areaProducts?.geoprocessing ?? ensuredGeoprocessing;
        ensuredTopologyQa = areaProducts?.topologyQa ?? ensuredTopologyQa;
      }

      const effectiveBbox = bbox ?? demoAoi?.bbox ?? null;
      const effectivePolygon = drawnPolygon ?? demoAoi?.polygon ?? null;
      if (!effectiveBbox) {
        setCanonicalKpiSnapshot(null);
        setTab('compliance');
        setFullAuditStatus('تم تشغيل تحليل الصورة. لإكمال الفحص الشامل ارسم نطاق AOI على الخريطة.');
        setFullAuditSnapshot({
          runId,
          ranAt: new Date().toISOString(),
          scene: 'pass',
          spatial: 'warn',
          qualityGate: 'warn',
          temporal: 'warn',
          simulation: 'warn',
          terrain3d: 'warn',
          benchmark: 'warn',
        });
        return;
      }

      if (!bbox && demoAoi && onLoadArea) {
        onLoadArea(demoAoi);
      }

      const yearTo = new Date().getFullYear();
      const yearFrom = yearTo - 4;
      const years = [yearFrom, yearFrom + 1, yearFrom + 2, yearFrom + 3, yearTo];

      const [tc, ts, sim, terrain] = await Promise.all([
        fetchTemporalCompare({ bbox: effectiveBbox, polygon: effectivePolygon ?? undefined, year_from: yearFrom, year_to: yearTo }),
        fetchTimeSeries({ bbox: effectiveBbox, polygon: effectivePolygon ?? undefined, years }),
        fetchSimulation({ bbox: effectiveBbox, polygon: effectivePolygon ?? undefined, target_year: yearTo + 3 }),
        fetchTerrain3DAnalysis({
          bbox: effectiveBbox,
          contour_interval_m: 20,
          grid_size: 11,
          los: {
            start: [effectiveBbox[0], effectiveBbox[1]],
            end: [effectiveBbox[2], effectiveBbox[3]],
            observer_height_m: 1.75,
            target_height_m: 1.75,
          },
        }),
      ]);

      setTemporalCompare(tc);
      setTemporalNarrative(tc.narrative);
      setTemporalYearFrom(tc.year_from);
      setTemporalYearTo(tc.year_to);
      setTimeSeries(ts);
      setSimulationNarrative(sim.narrative);
      setSimulationYear(sim.target_year);
      setTerrain3DResult(terrain);

      const reconciledKpi = reconcileKpiSnapshot({
        runId,
        temporal: tc,
        areaReport: ensuredAreaReport,
      });
      setCanonicalKpiSnapshot(reconciledKpi);

      const centerLat = (effectiveBbox[1] + effectiveBbox[3]) / 2;
      const preset = pickTerrainBenchmarkPreset(centerLat, TERRAIN_3D_BENCHMARK_PRESETS, SIC_AUDIT_POLICY_V1);
      const benchmark = evaluateTerrain3DBenchmark(preset, terrain);
      setTerrain3DBenchmark(benchmark);

      const benchmarkStatus: AuditAxisStatus =
        benchmark.verdict === 'accepted'
          ? 'pass'
          : benchmark.verdict === 'conditional'
            ? 'warn'
            : 'fail';
      const terrainStatus: AuditAxisStatus = evaluateTerrainPolicyStatus(terrain, SIC_AUDIT_POLICY_V1);

      const zonalNative = ensuredZonalStats?.source_mode === 'backend-zonal';
      const objectNative = ensuredObjectExtraction?.source_mode === 'backend-object-extraction';
      const geoprocessingNative = ensuredGeoprocessing?.source_mode === 'backend-geoprocessing';
      const topologyNative = ensuredTopologyQa?.source_mode === 'backend-topology-qa';
      const spatialStatus: AuditAxisStatus = !ensuredAreaReport
        ? 'fail'
        : (zonalNative && objectNative && geoprocessingNative && topologyNative)
          ? 'pass'
          : ((ensuredZonalStats || ensuredObjectExtraction || ensuredGeoprocessing || ensuredTopologyQa) ? 'warn' : 'fail');
      const qualityGateStatus: AuditAxisStatus = evaluateQualityGatePolicyStatus({
        confidenceScore: reconciledKpi.confidenceScore,
        maxDriftPct: reconciledKpi.maxDriftPct,
        spatialStatus,
        policy: SIC_AUDIT_POLICY_V1,
      });

      const snapshot: FullAuditSnapshot = {
        runId,
        ranAt: new Date().toISOString(),
        scene: 'pass',
        spatial: spatialStatus,
        qualityGate: qualityGateStatus,
        temporal: 'pass',
        simulation: sim.narrative ? 'pass' : 'warn',
        terrain3d: terrainStatus,
        benchmark: benchmarkStatus,
      };

      setFullAuditSnapshot(snapshot);

      const verdict = computeAuditVerdict(snapshot);
      let persistenceFailed = false;
      let parityPersistenceFailed = false;
      try {
        await persistAuditReport({
          runId,
          verdict,
          benchmark,
          snapshot,
          canonicalKpi: reconciledKpi,
          sceneUid,
        });
      } catch {
        persistenceFailed = true;
      }

      const parityResult = evaluateArcGisParity({
        snapshot,
        canonicalKpi: {
          confidenceScore: reconciledKpi.confidenceScore,
          maxDriftPct: reconciledKpi.maxDriftPct,
        },
      });
      try {
        await persistParityReport(parityResult);
      } catch {
        parityPersistenceFailed = true;
      }

      setTab('compliance');
      setFullAuditStatus(
        `اكتمل الفحص الشامل. دقة المؤشرات الموحدة: ${reconciledKpi.confidenceScore}% (انحراف أقصى ${reconciledKpi.maxDriftPct}%). ` +
        `المسار المكاني: ${spatialStatus === 'pass' ? 'native مكتمل' : spatialStatus === 'warn' ? 'fallback جزئي' : 'غير مكتمل'}. ` +
        `بوابة الجودة: ${qualityGateStatus === 'pass' ? 'مقبولة' : qualityGateStatus === 'warn' ? 'مشروطة' : 'مرفوضة'} (${SIC_AUDIT_POLICY_V1.version}).` +
        ` مؤشر parity: ${parityResult.score}% (${parityResult.verdict === 'ahead' ? 'متقدم' : parityResult.verdict === 'near' ? 'قريب' : 'متأخر'}).` +
        (persistenceFailed ? ' (تنبيه: تعذر حفظ سجل الاعتماد لهذه الدورة)' : '') +
        (parityPersistenceFailed ? ' (تنبيه: تعذر حفظ سجل parity لهذه الدورة)' : '')
      );
      if (!persistenceFailed) {
        void loadAuditHistory();
      }
      if (!parityPersistenceFailed) {
        void loadParityHistory();
      }
    } catch (e: any) {
      setFullAuditStatus(e?.message ?? 'فشل تشغيل الفحص الشامل. حاول مرة أخرى.');
    } finally {
      setFullAuditRunning(false);
    }
  }, [areaReport, bbox, demoAoi, drawnPolygon, geoprocessing, loadAuditHistory, loadParityHistory, objectExtraction, onLoadArea, onRunAreaProducts, onRunSceneAnalysis, sceneUid, topologyQa, zonalStats]);

  const statusPillClass = (status: AuditAxisStatus): string => {
    if (status === 'pass') return 'text-emerald-300 border-emerald-700/40 bg-emerald-950/25';
    if (status === 'warn') return 'text-amber-300 border-amber-700/40 bg-amber-950/25';
    return 'text-rose-300 border-rose-700/40 bg-rose-950/25';
  };

  const statusLabel = (status: AuditAxisStatus): string => {
    if (status === 'pass') return 'مكتمل';
    if (status === 'warn') return 'جزئي';
    return 'فشل';
  };

  const exportAcceptanceReport = useCallback(async () => {
    if (!fullAuditSnapshot) return;

    const verdict = computeAuditVerdict(fullAuditSnapshot);
    const verdictLabel = verdict === 'accepted' ? 'مقبول' : verdict === 'conditional' ? 'قبول مشروط' : 'مرفوض';
    const rows: Array<[string, AuditAxisStatus]> = [
      ['الصورة', fullAuditSnapshot.scene],
      ['مكاني', fullAuditSnapshot.spatial],
      ['جودة', fullAuditSnapshot.qualityGate],
      ['زمني', fullAuditSnapshot.temporal],
      ['محاكاة', fullAuditSnapshot.simulation],
      ['3D', fullAuditSnapshot.terrain3d],
      ['Benchmark', fullAuditSnapshot.benchmark],
    ];

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 36;
      const reportRef = fullAuditSnapshot.runId || `${(sceneUid || 'NO-SCENE').slice(0, 12)}-${Date.now().toString().slice(-6)}`;
      const ranAt = new Date(fullAuditSnapshot.ranAt).toLocaleString('ar-SA');

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageW, 64, 'F');
      pdf.setFillColor(14, 165, 233);
      pdf.rect(0, 0, 6, 64, 'F');

      pdf.setFontSize(14);
      pdf.setTextColor(125, 211, 252);
      pdf.text('Satellite Intelligence Center - Administrative Acceptance Report', margin, 26);
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Ref: ${reportRef}`, margin, 42);
      pdf.text(`Run At: ${ranAt}`, margin + 170, 42);
      pdf.text(`Scene: ${sceneUid || 'N/A'}`, margin + 340, 42);

      let y = 94;
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, y, pageW - margin * 2, 44, 6, 6, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, y, pageW - margin * 2, 44, 6, 6, 'S');
      pdf.setFontSize(12);
      pdf.setTextColor(51, 65, 85);
      pdf.text('Final Verdict:', margin + 12, y + 26);
      const verdictRgb = verdict === 'accepted' ? [22, 163, 74] : verdict === 'conditional' ? [217, 119, 6] : [220, 38, 38];
      pdf.setTextColor(verdictRgb[0], verdictRgb[1], verdictRgb[2]);
      pdf.text(verdictLabel, margin + 96, y + 26);

      y += 64;
      pdf.setFontSize(11);
      pdf.setTextColor(71, 85, 105);
      pdf.text('Axis', margin + 10, y);
      pdf.text('Status', pageW - margin - 110, y);
      y += 10;
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y, pageW - margin, y);
      y += 18;

      rows.forEach(([label, status]) => {
        const color = status === 'pass' ? [22, 163, 74] : status === 'warn' ? [217, 119, 6] : [220, 38, 38];
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(label, margin + 10, y);
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(statusLabel(status), pageW - margin - 110, y);
        pdf.setDrawColor(241, 245, 249);
        pdf.line(margin, y + 8, pageW - margin, y + 8);
        y += 24;
      });

      y += 10;
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Generated automatically from the latest full-audit run in SIC.', margin, y);

      pdf.save(`acceptance-report-${reportRef}.pdf`);
    } catch (err) {
      setFullAuditStatus('تعذر تصدير PDF حالياً. حاول مرة أخرى.');
    }
  }, [fullAuditSnapshot, sceneUid]);

  const exportGisInteroperabilityBundle = useCallback(async () => {
    if (!bbox && (!drawnPolygon || drawnPolygon.length < 3)) {
      setFullAuditStatus('لا يمكن تصدير حزمة GIS بدون نطاق AOI صالح.');
      return;
    }

    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const generatedAt = new Date().toISOString();
      const reportRef = fullAuditSnapshot?.runId || `${(sceneUid || 'NO-SCENE').slice(0, 12)}-${Date.now().toString().slice(-6)}`;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      const polygonCoords: [number, number][] = (() => {
        if (drawnPolygon && drawnPolygon.length >= 3) {
          return closeRing(drawnPolygon);
        }
        if (!bbox) return [];
        return ringFromBbox(bbox);
      })();

      const aoiBbox = bboxFromRing(polygonCoords);
      const buffer250mBbox = bufferBboxMeters(aoiBbox, 250);
      const libyaExtentBbox: [number, number, number, number] = [9.2, 19.4, 25.2, 33.3];
      const clippedToLibyaBbox = intersectBboxes(aoiBbox, libyaExtentBbox);
      const corridorBbox: [number, number, number, number] = [
        aoiBbox[0],
        (aoiBbox[1] + aoiBbox[3]) / 2 - 0.01,
        aoiBbox[2],
        (aoiBbox[1] + aoiBbox[3]) / 2 + 0.01,
      ];
      const corridorIntersectionBbox = intersectBboxes(aoiBbox, corridorBbox);

      const aoiFeatureCollection = toFeatureCollection('sic_aoi', polygonCoords, {
        scene_uid: sceneUid || null,
        generated_at: generatedAt,
        source: 'satellite-intelligence-center',
      });

      const bufferedFeatureCollection = toFeatureCollection('sic_aoi_buffer_250m', ringFromBbox(buffer250mBbox), {
        operation: 'buffer',
        distance_m: 250,
        source_ref: 'aoi.geojson',
      });

      const clipFeatureCollection = clippedToLibyaBbox
        ? toFeatureCollection('sic_aoi_clip_libya_extent', ringFromBbox(clippedToLibyaBbox), {
            operation: 'clip',
            clip_extent: libyaExtentBbox,
            source_ref: 'aoi.geojson',
          })
        : toFeatureCollection('sic_aoi_clip_libya_extent', [], {
            operation: 'clip',
            clip_extent: libyaExtentBbox,
            note: 'No overlap with Libya extent bbox',
            source_ref: 'aoi.geojson',
          });

      const intersectFeatureCollection = corridorIntersectionBbox
        ? toFeatureCollection('sic_aoi_intersect_ops_corridor', ringFromBbox(corridorIntersectionBbox), {
            operation: 'intersect',
            source_ref: 'aoi.geojson',
            secondary_ref: 'ops-corridor',
          })
        : toFeatureCollection('sic_aoi_intersect_ops_corridor', [], {
            operation: 'intersect',
            note: 'No overlap with corridor extent',
            source_ref: 'aoi.geojson',
          });

      const cogMetadata = {
        profile: 'COG-compatible-reference',
        generated_at: generatedAt,
        scene_uid: sceneUid || null,
        raster_sources: [
          {
            id: 'satellite_xyz',
            kind: 'xyz-tiles',
            format: 'png/jpeg tiles',
            url_template: `${origin}/tiles/satellite/{z}/{x}/{y}`,
            spatial_reference: 'EPSG:3857',
            note: 'Operational tile service used by SIC map shell.',
          },
          {
            id: 'labels_xyz',
            kind: 'xyz-tiles',
            format: 'png tiles',
            url_template: `${origin}/tiles/labels/{z}/{x}/{y}`,
            spatial_reference: 'EPSG:3857',
            note: 'Companion labels for cartographic context.',
          },
        ],
        provenance: summary?.provenance ?? null,
        conversion_guidance: [
          'Use gdal_translate to create COG from source GeoTIFF when raw rasters are available.',
          'Keep overview levels and internal tiling for desktop GIS performance.',
        ],
      };

      const qaReport = {
        generated_at: generatedAt,
        checks: [
          {
            id: 'ring_closed',
            passed: polygonCoords.length >= 4 && polygonCoords[0][0] === polygonCoords[polygonCoords.length - 1][0] && polygonCoords[0][1] === polygonCoords[polygonCoords.length - 1][1],
            detail: 'AOI polygon ring closure check',
          },
          {
            id: 'bbox_valid',
            passed: aoiBbox[0] < aoiBbox[2] && aoiBbox[1] < aoiBbox[3],
            detail: 'AOI bbox has positive width and height',
          },
          {
            id: 'clip_overlap',
            passed: !!clippedToLibyaBbox,
            detail: 'AOI intersects national operational extent',
          },
          {
            id: 'corridor_overlap',
            passed: !!corridorIntersectionBbox,
            detail: 'AOI intersects operational corridor geometry',
          },
        ],
        metrics: {
          aoi_bbox_area_m2: Math.round(approxBboxAreaM2(aoiBbox)),
          buffer250_bbox_area_m2: Math.round(approxBboxAreaM2(buffer250mBbox)),
          clip_bbox_area_m2: Math.round(approxBboxAreaM2(clippedToLibyaBbox ?? [0, 0, 0, 0])),
          corridor_intersection_bbox_area_m2: Math.round(approxBboxAreaM2(corridorIntersectionBbox ?? [0, 0, 0, 0])),
        },
      };

      const manifest = {
        report_ref: reportRef,
        run_id: fullAuditSnapshot?.runId ?? null,
        generated_at: generatedAt,
        scene_uid: sceneUid || null,
        verdict: fullAuditSnapshot ? computeAuditVerdict(fullAuditSnapshot) : null,
        bbox: bbox || null,
        files: [
          'aoi.geojson',
          'aoi-buffer-250m.geojson',
          'aoi-clip-libya-extent.geojson',
          'aoi-intersect-ops-corridor.geojson',
          'full-audit.json',
          'area-report.json',
          'temporal-compare.json',
          'time-series.json',
          'simulation.json',
          'terrain3d.json',
          'terrain3d-benchmark.json',
          'cog-metadata.json',
          'qa-report.json',
          'metadata.json',
          'README.txt',
        ],
      };

      const readme = [
        'SIC GIS Interoperability Bundle',
        `Report Ref: ${reportRef}`,
        `Generated At: ${generatedAt}`,
        '',
        'This package is prepared for QGIS/ArcGIS ingestion.',
        'Primary geometry: aoi.geojson (EPSG:4326).',
        'Geoprocessing outputs: buffer/clip/intersect as GeoJSON layers.',
        'Raster references: cog-metadata.json (COG-compatible source manifest).',
        'QA checks: qa-report.json.',
        'Supporting analysis outputs are provided as JSON sidecar files.',
      ].join('\n');

      zip.file('README.txt', readme);
      zip.file('aoi.geojson', JSON.stringify(aoiFeatureCollection, null, 2));
      zip.file('aoi-buffer-250m.geojson', JSON.stringify(bufferedFeatureCollection, null, 2));
      zip.file('aoi-clip-libya-extent.geojson', JSON.stringify(clipFeatureCollection, null, 2));
      zip.file('aoi-intersect-ops-corridor.geojson', JSON.stringify(intersectFeatureCollection, null, 2));
      zip.file('full-audit.json', JSON.stringify(fullAuditSnapshot ?? null, null, 2));
      zip.file('area-report.json', JSON.stringify(areaReport ?? null, null, 2));
      zip.file('temporal-compare.json', JSON.stringify(temporalCompare ?? null, null, 2));
      zip.file('time-series.json', JSON.stringify(timeSeries ?? null, null, 2));
      zip.file('simulation.json', JSON.stringify({ narrative: simulationNarrative ?? null, year: simulationYear ?? null }, null, 2));
      zip.file('terrain3d.json', JSON.stringify(terrain3DResult ?? null, null, 2));
      zip.file('terrain3d-benchmark.json', JSON.stringify(terrain3DBenchmark ?? null, null, 2));
      zip.file('cog-metadata.json', JSON.stringify(cogMetadata, null, 2));
      zip.file('qa-report.json', JSON.stringify(qaReport, null, 2));
      zip.file('metadata.json', JSON.stringify(manifest, null, 2));

      const bundleBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(bundleBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sic-gis-bundle-${reportRef}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setFullAuditStatus('تعذر تصدير حزمة GIS حالياً. حاول مرة أخرى.');
    }
  }, [
    areaReport,
    bbox,
    drawnPolygon,
    fullAuditSnapshot,
    sceneUid,
    simulationNarrative,
    simulationYear,
    temporalCompare,
    terrain3DBenchmark,
    terrain3DResult,
    summary,
    timeSeries,
  ]);

  // Size label for display
  const SIZE_LABELS: Record<string, string> = { normal: 'عادي', wide: 'واسع', half: 'نصف', full: 'كامل' };

  return (
    <div
      className={`shrink-0 border-l border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden transition-all duration-300
        ${ panelSize === 'full' ? 'flex-1' : panelSize === 'half' ? 'w-[55%]' : panelSize === 'wide' ? 'w-[520px]' : 'w-[340px]' }`}
    >

      {/* ── Size control bar (always visible at top) ───────────── */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-700/60 bg-slate-900/80 shrink-0">
        <span className="text-xs text-slate-500 mr-1">حجم:</span>
        {(['normal', 'wide', 'half', 'full'] as const).map(sz => (
          <button
            key={sz}
            onClick={() => {
  // Trigger Job Selection

              onPanelSizeChange?.(sz);
              if (typeof window !== 'undefined') localStorage.setItem('sic_panel_size', sz);
            }}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors border ${
              panelSize === sz
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-500'
            }`}
            title={sz==='normal'?'لوحة ضيقة 340px':sz==='wide'?'لوحة واسعة 520px':sz==='half'?'55% من الشاشة':'لوحة كاملة (الخريطة مخفية)'}
          >
            {sz === 'normal' ? '▧ ضيق' : sz === 'wide' ? '▨ واسع' : sz === 'half' ? '▩ نصف+' : '▪ كامل'}
          </button>
        ))}
        <div className="flex-1" />
        {/* Collapse to normal shortcut */}
        {panelSize !== 'normal' && (
          <button
            onClick={() => onPanelSizeChange?.('normal')}
            title="تصغير"
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {!hideTabBar && (
        <div className="flex items-center border-b border-slate-800 shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 flex-1 justify-center px-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-blue-500 text-blue-400 bg-slate-800/30'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/20'
              }`}
            >
              <t.Icon size={13} />
              <span>{t.label}</span>
              {t.badge && (
                <span className="absolute top-1.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">

        <div className="mx-3 mt-3 mb-1 flex flex-wrap items-center gap-2">
          <button
            onClick={runFullAudit}
            disabled={fullAuditRunning || !sceneUid}
            className="px-3 py-2 rounded-lg border border-cyan-700/40 bg-cyan-900/25 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/35 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fullAuditRunning ? 'جارٍ الفحص الشامل…' : 'تشغيل فحص شامل'}
          </button>
          <button
            onClick={exportAcceptanceReport}
            disabled={!fullAuditSnapshot}
            className="px-3 py-2 rounded-lg border border-slate-700/40 bg-slate-800/40 text-xs font-semibold text-slate-300 hover:bg-slate-700/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            تصدير PDF
          </button>
          <button
            onClick={exportGisInteroperabilityBundle}
            disabled={!bbox && (!drawnPolygon || drawnPolygon.length < 3)}
            className="px-3 py-2 rounded-lg border border-indigo-700/40 bg-indigo-900/25 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/35 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            حزمة GIS
          </button>
          {fullAuditStatus && (
            <span className="text-xs text-slate-400 leading-tight">{fullAuditStatus}</span>
          )}
        </div>

        {fullAuditSnapshot && (
          <div className="mx-3 mb-2 rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-200">ملخص آخر فحص شامل</p>
              <p className="text-xs text-slate-400">{new Date(fullAuditSnapshot.ranAt).toLocaleTimeString('ar-SA')}</p>
            </div>
            <p className="text-xs text-cyan-300/80 mb-2 font-mono">Run: {fullAuditSnapshot.runId.slice(0, 12)}…</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ['الصورة', fullAuditSnapshot.scene],
                ['مكاني', fullAuditSnapshot.spatial],
                ['جودة', fullAuditSnapshot.qualityGate],
                ['زمني', fullAuditSnapshot.temporal],
                ['محاكاة', fullAuditSnapshot.simulation],
                ['3D', fullAuditSnapshot.terrain3d],
                ['Benchmark', fullAuditSnapshot.benchmark],
              ].map(([label, status]) => (
                <span
                  key={label}
                  className={`px-2 py-1 rounded-lg border text-xs font-semibold flex items-center justify-between ${statusPillClass(status as AuditAxisStatus)}`}
                >
                  <span>{label}</span>
                  <span>{statusLabel(status as AuditAxisStatus)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {dataSyncWarning && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl border border-amber-700/30 bg-amber-950/25 text-xs text-amber-300">
            {dataSyncWarning}
          </div>
        )}

        {tab === 'report' && (
          <div className="h-full">
            {areaReportLoading && <AreaReportSkeleton />}
            {areaReportError && !areaReportLoading && (
              <div className="p-3">
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-950/30 border border-rose-800/30">
                  <AlertCircle size={13} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-300 leading-tight">{areaReportError}</p>
                </div>
              </div>
            )}
            {areaReport && !areaReportLoading && (
              <div className="flex flex-col">
                <div className="flex justify-end px-3 pt-2.5 pb-1 border-b border-slate-800/40">
                  <PDFReportGenerator
                    report={areaReport}
                    areaName={activeArea?.name}
                    temporalNarrative={temporalNarrative}
                    temporalCompare={temporalCompare}
                    simulationNarrative={simulationNarrative}
                    simulationYear={simulationYear}
                    yearFrom={temporalYearFrom}
                    yearTo={temporalYearTo}
                  />
                </div>

                {/* S13.1 — Multi-source info card */}
                {multiSourceLoading && (
                  <div className="mx-3 mt-2.5 mb-1 px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-700/30 animate-pulse">
                    <div className="h-2.5 w-32 bg-slate-700 rounded mb-1.5" />
                    <div className="h-2 w-48 bg-slate-700/60 rounded" />
                  </div>
                )}
                {multiSourceData && !multiSourceLoading && (() => {
                  const r = multiSourceData.result;
                  const types = dataTypes(r.source_stack);
                  const confPct = Math.round(r.confidence * 100);
                  const evidenceColor =
                    r.evidence_level === 'observed'  ? 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30' :
                    r.evidence_level === 'confirmed' ? 'text-sky-400 bg-sky-900/20 border-sky-700/30' :
                    r.evidence_level === 'estimated' ? 'text-amber-400 bg-amber-900/20 border-amber-700/30' :
                                                       'text-slate-400 bg-slate-800/30 border-slate-700/30';
                  return (
                    <div className="mx-3 mt-2.5 mb-1 rounded-xl border border-slate-700/40 bg-slate-800/20 overflow-hidden">
                      {/* Header */}
                      <div className="px-3 py-2.5 bg-slate-800/40 border-b border-slate-700/30">
                        <p className="text-sm font-bold text-slate-200 uppercase tracking-widest">مصادر الأقمار الصناعية</p>
                      </div>
                      {/* Source stack */}
                      <div className="px-3 py-3 space-y-2.5">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">المصادر</p>
                          <p className="text-sm font-semibold text-slate-200 leading-snug">{sourceStackLabel(r.source_stack)}</p>
                        </div>
                        {/* Data types */}
                        <div className="flex flex-wrap gap-1.5">
                          {types.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/30">{t}</span>
                          ))}
                        </div>
                        {/* Evidence + confidence */}
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${evidenceColor}`}>
                            {evidenceLevelAr(r.evidence_level)}
                          </span>
                          <span className="text-sm font-bold text-slate-300">{confPct}% ثقة</span>
                        </div>
                        {/* Strategy note */}
                        {r.strategy_note_ar && (
                          <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-700/30 pt-2">{r.strategy_note_ar}</p>
                        )}
                        {/* Cross-validation notes */}
                        {r.evidence_notes_ar.length > 0 && (
                          <div className="border-t border-slate-700/30 pt-2 space-y-1">
                            {r.evidence_notes_ar.slice(0, 2).map((note, i) => (
                              <p key={i} className="text-xs text-emerald-400/80 leading-relaxed">• {note}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <AreaReportPanel
                    report={areaReport}
                    loading={false}
                    bbox={bbox}
                    temporalCompare={temporalCompare}
                    timeSeries={timeSeries}
                    multiSourceData={multiSourceData}
                    canonicalKpiSnapshot={canonicalKpiSnapshot}
                    auditRunId={fullAuditSnapshot?.runId ?? null}
                  />
              </div>
            )}
            {!areaReport && !areaReportLoading && (
              <div className="p-3 h-full flex flex-col">
                {/* S13.1 — Multi-source readiness badge (always visible before drawing) */}
                {!drawnPolygon && (
                  <div className="mb-3 px-3 py-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">محرك الاستخبارات</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/30">S2 بصري</span>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-900/30 text-indigo-300 border border-indigo-700/30">S1 رادار SAR</span>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700/40 text-slate-400 border border-slate-600/30">LS أرشيف</span>
                    </div>
                    <p className="text-xs text-emerald-500/80 mt-2">● متعدد المصادر — جاهز</p>
                  </div>
                )}
                <div className="flex-1">
                  <AreaIntelligencePanel
                    result={areaResult}
                    loading={areaLoading}
                    polygon={drawnPolygon}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="h-full flex flex-col" style={{ minHeight: '400px' }}>
            <SICChat
              areaReport={areaReport}
              areaName={activeArea?.name}
              bbox={bbox}
              temporalNarrative={temporalNarrative}
              simulationNarrative={simulationNarrative}
              simulationYear={simulationYear}
              yearFrom={temporalYearFrom}
              yearTo={temporalYearTo}
              activeMode={
                simulationNarrative ? 'simulation' :
                temporalNarrative   ? 'temporal'   :
                areaReport          ? 'report'      : null
              }
            />
          </div>
        )}

        {tab === 'temporal' && (
          <TemporalPanel
            bbox={bbox}
            polygon={drawnPolygon ?? undefined}
            onResult={handleTemporalResult}
            onSeriesResult={handleSeriesResult}
            canonicalKpiSnapshot={canonicalKpiSnapshot}
          />
        )}

        {tab === 'satellite_trend' && (
          <SatelliteTrendPanel polygon={drawnPolygon} />
        )}

        {tab === 'object_detection' && (
          <ObjectDetectionPanel polygon={drawnPolygon} />
        )}

        {tab === 'insar' && (
          <InSARPanel
            polygon={drawnPolygon}
            onFlyTo={(lon, lat, zoom) => onFlyTo?.(lon, lat, zoom)}
          />
        )}

        {tab === 'simulation' && (
          <SimulationPanel
            bbox={bbox}
            polygon={drawnPolygon ?? undefined}
            areaId={activeArea?.id}
            onResult={handleSimulationResult}
          />
        )}

        {tab === 'areas' && (
          <SmartAreaPanel
            currentBbox={currentBbox}
            currentPolygon={drawnPolygon ?? undefined}
            onLoadArea={onLoadArea}
            activeAreaId={activeArea?.id}
          />
        )}

        {tab === 'terrain3d' && (
          <Terrain3DPanel
            bbox={bbox}
            polygon={drawnPolygon ?? undefined}
            onResult={setTerrain3DResult}
            onBenchmark={setTerrain3DBenchmark}
          />
        )}

        {tab === 'suitability' && (
          <SuitabilityPanel
            bbox={bbox}
            polygon={drawnPolygon ?? undefined}
            onLocationsReady={onSuitabilityLocations}
            onFlyTo={onFlyTo}
          />
        )}

        {tab === 'routing' && (
          <OptimalPathPanel
            routingPickMode={routingPickMode}
            startPoint={routingStartPoint ?? null}
            endPoint={routingEndPoint ?? null}
            onStartPicking={(which) => onStartRoutingPick?.(which)}
            onClearPoints={() => onClearRoutingPoints?.()}
            onResultReady={(r) => onRoutingResultReady?.(r)}
            editMode={routingEditMode}
            onEditModeChange={onRoutingEditModeChange}
            externalManualPath={externalManualPath}
          />
        )}

        {tab === 'network' && (
          <NetworkDesignPanel
            networkPickMode={networkPickMode}
            networkPickedPoint={networkPickedPoint ?? null}
            onStartNetworkPick={() => onStartNetworkPick?.()}
            onNetworkPickConsumed={() => onNetworkPickConsumed?.()}
            autoNetworkPolygon={autoNetworkPolygon}
            onStartAutoNetworkDraw={onStartAutoNetworkDraw}
            onAutoNetworkResult={onAutoNetworkResult}
          />
        )}

        {/* ── RSC merged modules ─────────────────────────────────────────── */}
        {(tab === 'spatial_analyst' || tab === 'image_analyst' || tab === '3d_analyst') && (
          rscActiveTool === 'ia_pansharp' ? (
            <PanSharpPanel
              drawnPolygon={drawnPolygon ?? null}
            />
          ) : (
          <RSCRightPanel
            activeModule={
              tab === 'spatial_analyst' ? 'spatial'
              : tab === 'image_analyst' ? 'image'
              : '3d'
            }
            activeTool={(rscActiveTool ?? 'sa_none') as any}
            analysisResult={rscResult}
            processing={rscProcessing}
            setProcessing={(v) => onRscProcessingChange?.(v)}
            setAnalysisResult={(r) => onRscResultChange?.(r)}
            drawnPolygon={drawnPolygon ?? null}
          />
          )
        )}

        {tab === 'change_detection' && (
          <ChangeDetectionPanel
            scenes={scenes}
            drawnPolygon={drawnPolygon ?? null}
            onResultReady={(result, geojson) => onChangeDetectionResult?.(result, geojson)}
          />
        )}

        {tab === 'risk' && (
          <RiskAssessmentPanel
            drawnPolygon={drawnPolygon ?? null}
            onResultReady={(result, geojson) => onRiskAssessmentResult?.(result, geojson)}
          />
        )}

        {tab === 'alerts' && (
          <SmartAlertsPanel
            scenes={scenes}
            drawnPolygon={drawnPolygon ?? null}
            onResultReady={(geojson) => onAlertsResult?.(geojson)}
          />
        )}

        {tab === 'compliance' && (
          <div className="space-y-2.5">
            <ArcGisReadinessPanel
              sceneUid={sceneUid}
              scenes={scenes}
              summary={summary}
              areaReport={areaReport}
              multiSourceData={multiSourceData ?? null}
              zonalStats={zonalStats ?? null}
              objectExtraction={objectExtraction ?? null}
              geoprocessing={geoprocessing ?? null}
              topologyQa={topologyQa ?? null}
              temporalCompare={temporalCompare}
              timeSeries={timeSeries}
              hasGeometry={!!bbox}
              simulationReady={!!simulationNarrative}
              terrain3d={terrain3DResult}
              terrain3dBenchmark={terrain3DBenchmark}
              sceneConsistencyWarning={dataSyncWarning ?? null}
              canonicalKpiSnapshot={canonicalKpiSnapshot}
              auditRunId={fullAuditSnapshot?.runId ?? null}
            />

            <div className="mx-3 mb-3 rounded-xl border border-slate-700/40 bg-slate-800/20 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-300">سجل الاعتمادات الأخيرة</p>
                <button
                  onClick={() => void loadAuditHistory()}
                  disabled={auditHistoryLoading}
                  className="px-2 py-1 rounded-md border border-slate-700/40 bg-slate-800/40 text-xs font-semibold text-slate-300 hover:bg-slate-700/40 disabled:opacity-40"
                >
                  {auditHistoryLoading ? 'تحديث...' : 'تحديث'}
                </button>
              </div>

              {auditHistoryError && (
                <div className="mb-2 rounded-lg border border-rose-700/30 bg-rose-950/25 px-2 py-1.5 text-xs text-rose-300">
                  {auditHistoryError}
                </div>
              )}

              {!auditHistoryLoading && !auditHistoryError && auditHistory.length === 0 && (
                <div className="rounded-lg border border-slate-700/30 bg-slate-900/30 px-2 py-2 text-xs text-slate-400">
                  لا يوجد سجل محفوظ حتى الآن.
                </div>
              )}

              {auditHistory.length > 0 && (
                <div className="space-y-1.5">
                  {latestDelta && (
                    <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/20 px-2 py-2">
                      <p className="text-xs font-semibold text-cyan-300 mb-1">اتجاه آخر تشغيلين</p>
                      <p className="text-xs text-slate-300 leading-tight">
                        {latestDelta.trend === 'up'
                          ? 'تحسن في الاعتماد'
                          : latestDelta.trend === 'down'
                            ? 'تراجع في الاعتماد'
                            : 'ثبات في الاعتماد'}
                        : من {verdictLabel(latestDelta.previous.verdict)} إلى {verdictLabel(latestDelta.current.verdict)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        آخر تشغيل: {new Date(latestDelta.current.created_at).toLocaleString('ar-SA')}
                      </p>
                    </div>
                  )}

                  {auditHistory.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-700/30 bg-slate-900/30 px-2 py-1.5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-cyan-300">{item.run_id}</p>
                        <span className={`px-1.5 py-0.5 rounded-full border text-xs font-semibold ${verdictClass(item.verdict)}`}>
                          {verdictLabel(item.verdict)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>{new Date(item.created_at).toLocaleString('ar-SA')}</span>
                        <span>sig:{item.signature_sha256.slice(0, 12)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mx-3 mb-3 rounded-xl border border-indigo-700/40 bg-indigo-950/20 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-indigo-200">Parity / Regression مع ArcGIS</p>
                <button
                  onClick={() => void loadParityHistory()}
                  disabled={parityHistoryLoading}
                  className="px-2 py-1 rounded-md border border-indigo-700/40 bg-indigo-900/25 text-xs font-semibold text-indigo-200 hover:bg-indigo-900/35 disabled:opacity-40"
                >
                  {parityHistoryLoading ? 'تحديث...' : 'تحديث'}
                </button>
              </div>

              {parityHistoryError && (
                <div className="mb-2 rounded-lg border border-rose-700/30 bg-rose-950/25 px-2 py-1.5 text-xs text-rose-300">
                  {parityHistoryError}
                </div>
              )}

              {!parityHistoryLoading && !parityHistoryError && parityHistory.length === 0 && (
                <div className="rounded-lg border border-indigo-700/30 bg-indigo-950/15 px-2 py-2 text-xs text-indigo-200/80">
                  لا يوجد تقرير parity محفوظ حتى الآن.
                </div>
              )}

              {parityHistory.length > 0 && (() => {
                const latest = parityHistory[0];
                const prev = parityHistory[1] ?? null;
                const trend = !prev ? null : latest.score > prev.score ? 'up' : latest.score < prev.score ? 'down' : 'flat';
                return (
                  <div className="space-y-1.5">
                    <div className="rounded-lg border border-indigo-700/30 bg-indigo-950/15 px-2 py-2">
                      <p className="text-xs text-indigo-200">آخر نتيجة: <span className="font-bold">{latest.score}%</span> ({latest.verdict === 'ahead' ? 'متقدم' : latest.verdict === 'near' ? 'قريب' : 'متأخر'})</p>
                      <p className="text-xs text-indigo-200/70 mt-1">Run: {latest.run_id} • {new Date(latest.created_at).toLocaleString('ar-SA')}</p>
                      {trend && (
                        <p className="text-xs text-indigo-100/80 mt-1">
                          اتجاه مقارنة بالتشغيل السابق: {trend === 'up' ? 'تحسن' : trend === 'down' ? 'تراجع' : 'ثبات'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
