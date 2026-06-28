'use client';

import dynamic from 'next/dynamic';
import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Gauge,
  Layers3,
  Orbit,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FileUploadZone } from '../components/FileUploadZone';
import { DataQualityPanel, type DataQualitySummary, type RejectedRow } from '../components/DataQualityPanel';
import { CorridorChartsRow } from '../components/CorridorChartsRow';
import { EngineeringWatchlistPanel } from '../components/EngineeringWatchlistPanel';
import type { EarlyWarningSignal } from '../components/EarlyWarningPanel';
import { MaintenanceFeedPanel } from '../components/MaintenanceFeedPanel';
import { PressureMixPanel } from '../components/PressureMixPanel';
import type { PriorityCandidate } from '../components/PriorityEnginePanel';
import type { SensitivityPoint } from '../components/SensitivityCurvePanel';
import type { WhatIfImpact } from '../components/WhatIfScenarioPanel';
import { ProfileView } from '../components/ProfileView';
import { AssetManagementTable } from '../components/AssetManagementTable';
import { LinearAsset } from '@/lib/linear-referencing/types';
import {
  ANALYSIS_MODEL_CANDIDATE_VERSION,
  ANALYSIS_MODEL_VERSION,
  EARLY_WARNING_ETA_BASE_HOURS_V1,
  EARLY_WARNING_ETA_MIN_HOURS_V1,
  EARLY_WARNING_THRESHOLD_V1,
  EARLY_WARNING_WEIGHTS_V1,
  PRIORITY_DQ_PENALTY_MULTIPLIER_V1,
  PRIORITY_WEIGHTS_V1,
  PRIORITY_WEIGHTS_V1_1,
} from './analysisWeights';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as any;

type EngineeringRiskLevel = 'safe' | 'watch' | 'critical';
type PressureZone = 'reserve' | 'nominal' | 'peak';
type MaintenanceState = 'stable' | 'planned' | 'attention';

interface EngineeringAsset extends LinearAsset {
  technical: LinearAsset['technical'] & {
    hydraulic_pressure_bar?: number;
    pipe_bar_grade_bar?: number;
    maintenance_note?: string;
    cathodic_status?: string;
  };
}

interface EngineeringPoint extends EngineeringAsset {
  station_label: string;
  hydraulic_pressure_bar: number;
  pipe_bar_grade_bar: number;
  safety_margin_bar: number;
  risk_level: EngineeringRiskLevel;
  pressure_zone: PressureZone;
  maintenance_state: MaintenanceState;
  integrity_score: number;
}

interface SectorSummary {
  sector: string;
  count: number;
  avgPressure: number;
  minMargin: number;
  critical: number;
  watch: number;
}

const formatBar = (value: number) => `${value.toFixed(2)} bar`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function classifyRisk(safetyMarginBar: number): EngineeringRiskLevel {
  if (safetyMarginBar <= 0) return 'critical';
  if (safetyMarginBar <= 0.75) return 'watch';
  return 'safe';
}

function classifyPressureZone(pressureBar: number): PressureZone {
  if (pressureBar >= 7.8) return 'peak';
  if (pressureBar >= 6.5) return 'nominal';
  return 'reserve';
}

function classifyMaintenanceState(note: string): MaintenanceState {
  const normalized = note.toLowerCase();
  if (normalized.includes('critical') || normalized.includes('leak') || normalized.includes('attention')) {
    return 'attention';
  }
  if (normalized.includes('scheduled') || normalized.includes('watch') || normalized.includes('verification')) {
    return 'planned';
  }
  return 'stable';
}

function riskColor(riskLevel: EngineeringRiskLevel) {
  if (riskLevel === 'critical') return '#f43f5e';
  if (riskLevel === 'watch') return '#f59e0b';
  return '#10b981';
}

function riskTone(riskLevel: EngineeringRiskLevel) {
  if (riskLevel === 'critical') {
    return {
      badge: 'bg-rose-500/15 text-rose-100 border-rose-400/30',
      panel: 'border-rose-500/25 bg-rose-500/10',
    };
  }
  if (riskLevel === 'watch') {
    return {
      badge: 'bg-amber-500/15 text-amber-100 border-amber-400/30',
      panel: 'border-amber-500/25 bg-amber-500/10',
    };
  }
  return {
    badge: 'bg-emerald-500/15 text-emerald-100 border-emerald-400/30',
    panel: 'border-emerald-500/25 bg-emerald-500/10',
  };
}

function buildStationLabel(station: number) {
  return `C ${Math.floor(station / 1000).toString().padStart(3, '0')}+${(station % 1000)
    .toFixed(0)
    .padStart(3, '0')}`;
}

const PLACEHOLDER_TOKENS = new Set(['#REF!', '#VALUE!', 'N/A', 'NA', 'NULL', '-', '']);

function isPlaceholderToken(value: unknown) {
  if (typeof value !== 'string') return false;
  return PLACEHOLDER_TOKENS.has(value.trim().toUpperCase());
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || isPlaceholderToken(trimmed)) return null;

  const normalized = trimmed.replace(/,/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseStationValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || isPlaceholderToken(trimmed)) return null;

  const chainageMatch = trimmed.match(/(\d+)\s*\+\s*(\d+(?:\.\d+)?)/);
  if (chainageMatch) {
    const km = Number(chainageMatch[1]);
    const meters = Number(chainageMatch[2]);
    if (Number.isFinite(km) && Number.isFinite(meters)) {
      return km * 1000 + meters;
    }
  }

  const fallback = Number(trimmed.replace(/[^\d.+-]/g, ''));
  return Number.isFinite(fallback) ? fallback : null;
}

function sanitizeUploadedAssets(rawAssets: LinearAsset[]): {
  assets: LinearAsset[];
  summary: DataQualitySummary;
  rejectedRows: RejectedRow[];
} {
  const dedupe = new Set<string>();
  const sanitized: LinearAsset[] = [];
  const rejectedRows: RejectedRow[] = [];
  let duplicatesRemoved = 0;
  let invalidStationRows = 0;
  let invalidInvertRows = 0;
  let placeholderTokens = 0;

  for (const asset of rawAssets) {
    const stationRaw = (asset as any)?.station;
    const invertRaw = (asset as any)?.invert_level;
    const equipmentCode = String(asset.equipment_code || 'UNKNOWN').trim() || 'UNKNOWN';

    if (isPlaceholderToken(stationRaw)) placeholderTokens += 1;
    if (isPlaceholderToken(invertRaw)) placeholderTokens += 1;

    const station = parseStationValue(stationRaw);
    // For geo-operational assets (lat/lon based), station may be null — accept them
    const isGeoAsset = asset.coordinate_source === 'gps' ||
      (asset.latitude != null && asset.longitude != null && stationRaw == null);

    if (station === null && !isGeoAsset) {
      invalidStationRows += 1;
      rejectedRows.push({
        key: `${asset.id}-station`,
        equipmentCode,
        station: String(stationRaw ?? 'NULL'),
        reason: 'invalid station value',
      });
      continue;
    }

    const invertLevel = parseNumericValue(invertRaw);
    if (invertLevel === null && !isGeoAsset) {
      invalidInvertRows += 1;
      rejectedRows.push({
        key: `${asset.id}-invert`,
        equipmentCode,
        station: buildStationLabel(station ?? 0),
        reason: 'invalid invert level',
      });
      continue;
    }

    // For geo assets, use lat-based dedup key
    const key = isGeoAsset
      ? `${equipmentCode.toUpperCase()}|${asset.latitude?.toFixed(5) ?? ''}|${asset.longitude?.toFixed(5) ?? ''}`
      : `${equipmentCode.toUpperCase()}|${station!.toFixed(3)}|${invertLevel!.toFixed(3)}`;
    if (dedupe.has(key)) {
      duplicatesRemoved += 1;
      rejectedRows.push({
        key: `${asset.id}-duplicate`,
        equipmentCode,
        station: buildStationLabel(station),
        reason: 'duplicate row removed',
      });
      continue;
    }
    dedupe.add(key);

    sanitized.push({
      ...asset,
      ...(station != null ? { station } : {}),
      ...(invertLevel != null ? { invert_level: invertLevel } : {}),
      technical: {
        ...asset.technical,
        route_sector: asset.technical?.route_sector || 'Unassigned',
      },
    });
  }

  const totalRows = rawAssets.length;
  const validRows = sanitized.length;
  const uniqueSectors = new Set(
    sanitized.map((asset) => asset.technical?.route_sector || 'Unassigned')
  ).size;
  const qualityScore = totalRows === 0 ? 0 : Math.max(0, Math.round((validRows / totalRows) * 100));

  return {
    assets: sanitized,
    summary: {
      totalRows,
      validRows,
      duplicatesRemoved,
      invalidStationRows,
      invalidInvertRows,
      placeholderTokens,
      uniqueSectors,
      qualityScore,
    },
    rejectedRows,
  };
}

function enrichAsset(asset: LinearAsset): EngineeringPoint {
  const engineeringAsset = asset as EngineeringAsset;
  const hydraulicPressureBar =
    engineeringAsset.technical.hydraulic_pressure_bar ??
    engineeringAsset.technical.pressure_bar ??
    Math.max(0, 8.2 - (asset.invert_level % 6) * 0.18);
  const pipeBarGradeBar =
    engineeringAsset.technical.pipe_bar_grade_bar ?? engineeringAsset.technical.pressure_bar ?? 8.0;
  const safetyMarginBar = pipeBarGradeBar - hydraulicPressureBar;
  const riskLevel = classifyRisk(safetyMarginBar);
  const maintenanceNote = engineeringAsset.technical.maintenance_note || engineeringAsset.technical.cathodic_status || '';
  const maintenanceState = classifyMaintenanceState(maintenanceNote);
  const integrityScore = clamp(100 + safetyMarginBar * 18 - (riskLevel === 'critical' ? 32 : riskLevel === 'watch' ? 14 : 0), 18, 100);

  return {
    ...engineeringAsset,
    station_label: buildStationLabel(asset.station),
    hydraulic_pressure_bar: hydraulicPressureBar,
    pipe_bar_grade_bar: pipeBarGradeBar,
    safety_margin_bar: safetyMarginBar,
    risk_level: riskLevel,
    pressure_zone: classifyPressureZone(hydraulicPressureBar),
    maintenance_state: maintenanceState,
    integrity_score: integrityScore,
  };
}

function createEngineeringNote(point: EngineeringPoint) {
  const sourceNote = point.technical.maintenance_note || point.technical.cathodic_status || '';
  const fallback =
    point.risk_level === 'critical'
      ? 'Immediate hydraulic review and field verification required'
      : point.risk_level === 'watch'
        ? 'Trend review advised before the margin compresses further'
        : 'Envelope is stable and within the operational window';

  return sourceNote ? `${sourceNote} · ${fallback}` : fallback;
}

const DEMO_ASSETS: EngineeringAsset[] = [
  {
    id: '1',
    equipment_code: 'C-01',
    name: 'C-01',
    station: 64611,
    invert_level: 474.539,
    latitude: null,
    longitude: null,
    coordinate_source: 'lineal',
    parent_asset_id: null,
    relation_type: 'main',
    technical: {
      pressure_bar: 6.2,
      hydraulic_pressure_bar: 6.2,
      pipe_bar_grade_bar: 8.0,
      diameter: '3400 x 12',
      route_sector: 'P/S-EJH',
      cathodic_status: 'Cathodic protection stable',
    },
    source: 'maintenance_upload',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lrs_transformation_applied: false,
  },
  {
    id: '2',
    equipment_code: 'SAV-37-01',
    name: 'SAV-37-01',
    station: 64748,
    invert_level: 474.539,
    latitude: null,
    longitude: null,
    coordinate_source: 'lineal',
    parent_asset_id: '1',
    relation_type: 'child',
    technical: {
      hydraulic_pressure_bar: 6.4,
      pipe_bar_grade_bar: 8.0,
      maintenance_note: 'Leakage -> repaired and monitored',
      cathodic_status: 'OK',
      diameter: '250 x 10',
      route_sector: 'CONV-C000',
    },
    source: 'maintenance_upload',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lrs_transformation_applied: false,
  },
  {
    id: '3',
    equipment_code: 'SAV-37-02',
    name: 'SAV-37-02',
    station: 65070,
    invert_level: 471.788,
    latitude: null,
    longitude: null,
    coordinate_source: 'lineal',
    parent_asset_id: '1',
    relation_type: 'child',
    technical: {
      hydraulic_pressure_bar: 6.9,
      pipe_bar_grade_bar: 7.9,
      maintenance_note: 'Near-limit section, watch trend',
      cathodic_status: 'Scheduled inspection',
      diameter: '250 x 10',
      route_sector: 'CONV-C000',
    },
    source: 'maintenance_upload',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lrs_transformation_applied: false,
  },
  {
    id: '4',
    equipment_code: 'M/H',
    name: 'M/H',
    station: 65127,
    invert_level: 471.606,
    latitude: null,
    longitude: null,
    coordinate_source: 'lineal',
    parent_asset_id: null,
    relation_type: 'main',
    technical: {
      hydraulic_pressure_bar: 7.5,
      pipe_bar_grade_bar: 8.0,
      maintenance_note: 'Pressure trend rising at crest point',
      cathodic_status: 'Cathodic current nominal',
      diameter: 'Inspection point',
      route_sector: 'CONV-C000',
    },
    source: 'maintenance_upload',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lrs_transformation_applied: false,
  },
  {
    id: '5',
    equipment_code: 'PUWE-02-01',
    name: 'PUWE-02-01',
    station: 65196,
    invert_level: 466.824,
    latitude: null,
    longitude: null,
    coordinate_source: 'lineal',
    parent_asset_id: '4',
    relation_type: 'child',
    technical: {
      hydraulic_pressure_bar: 7.9,
      pipe_bar_grade_bar: 8.1,
      maintenance_note: 'Watch zone: outlet needs routine verification',
      cathodic_status: 'OK',
      diameter: '600 x 10',
      route_sector: 'CONV-C000',
    },
    source: 'maintenance_upload',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lrs_transformation_applied: false,
  },
  {
    id: '6',
    equipment_code: 'SAV-08-01',
    name: 'SAV-08-01',
    station: 66100,
    invert_level: 468.753,
    latitude: null,
    longitude: null,
    coordinate_source: 'lineal',
    parent_asset_id: '4',
    relation_type: 'child',
    technical: {
      hydraulic_pressure_bar: 8.15,
      pipe_bar_grade_bar: 8.0,
      maintenance_note: 'Critical margin crossed - immediate attention',
      cathodic_status: 'Verify coating and bonds',
      diameter: '150 x 10',
      route_sector: 'CONV-C000',
    },
    source: 'maintenance_upload',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lrs_transformation_applied: false,
  },
  {
    id: '7',
    equipment_code: 'SAV-04-01',
    name: 'SAV-04-01',
    station: 74620,
    invert_level: 484.712,
    latitude: null,
    longitude: null,
    coordinate_source: 'lineal',
    parent_asset_id: '4',
    relation_type: 'child',
    technical: {
      hydraulic_pressure_bar: 7.1,
      pipe_bar_grade_bar: 8.2,
      maintenance_note: 'Stable after recent inspection',
      cathodic_status: 'Anode condition acceptable',
      diameter: '150 x 08',
      route_sector: 'CONV-C000',
    },
    source: 'maintenance_upload',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lrs_transformation_applied: false,
  },
  {
    id: '8',
    equipment_code: 'FEEDER TANK',
    name: 'FEEDER TANK',
    station: 103660,
    invert_level: 527.347,
    latitude: null,
    longitude: null,
    coordinate_source: 'lineal',
    parent_asset_id: null,
    relation_type: 'main',
    technical: {
      hydraulic_pressure_bar: 6.7,
      pipe_bar_grade_bar: 7.6,
      maintenance_note: 'Storage interface stable',
      cathodic_status: 'Protected',
      diameter: 'FEEDER TANK',
      route_sector: 'FEEDER TANK',
    },
    source: 'maintenance_upload',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lrs_transformation_applied: false,
  },
];

export default function MaintenanceDemoPage() {
  const [assets, setAssets] = useState<LinearAsset[]>(DEMO_ASSETS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>('6');
  const [activeTab, setActiveTab] = useState<'cockpit' | 'profile' | 'table'>('cockpit');
  const [qualitySummary, setQualitySummary] = useState<DataQualitySummary>(() => sanitizeUploadedAssets(DEMO_ASSETS).summary);
  const [rejectedRows, setRejectedRows] = useState<RejectedRow[]>([]);

  const engineeringPoints = useMemo(
    () => [...assets].map(enrichAsset).sort((left, right) => left.station - right.station),
    [assets]
  );

  const engineeringSummary = useMemo(() => {
    const total = engineeringPoints.length;
    const critical = engineeringPoints.filter((point) => point.risk_level === 'critical').length;
    const watch = engineeringPoints.filter((point) => point.risk_level === 'watch').length;
    const safe = engineeringPoints.filter((point) => point.risk_level === 'safe').length;
    const averageMargin = total > 0 ? engineeringPoints.reduce((sum, point) => sum + point.safety_margin_bar, 0) / total : 0;
    const maxPressure = total > 0 ? Math.max(...engineeringPoints.map((point) => point.hydraulic_pressure_bar)) : 0;
    const minMargin = total > 0 ? Math.min(...engineeringPoints.map((point) => point.safety_margin_bar)) : 0;
    const selectedPoint = engineeringPoints.find((point) => point.id === selectedAssetId) || engineeringPoints[0] || null;
    const integrityScore = clamp(Math.round(100 - critical * 16 - watch * 7 + averageMargin * 12), 16, 100);
    const criticalStations = engineeringPoints.filter((point) => point.risk_level === 'critical').map((point) => point.station_label);
    const maintenanceBacklog = engineeringPoints.filter((point) => point.maintenance_state !== 'stable').length;

    return {
      total,
      critical,
      watch,
      safe,
      averageMargin,
      maxPressure,
      minMargin,
      integrityScore,
      selectedPoint,
      criticalStations,
      maintenanceBacklog,
      watchlist: engineeringPoints.filter((point) => point.risk_level !== 'safe').slice(0, 6),
    };
  }, [engineeringPoints, selectedAssetId]);

  const sectorData = useMemo<SectorSummary[]>(() => {
    const grouped = engineeringPoints.reduce<Record<string, SectorSummary>>((accumulator, point) => {
      const sector = point.technical.route_sector || 'Unassigned';
      const current = accumulator[sector] || {
        sector,
        count: 0,
        avgPressure: 0,
        minMargin: Number.POSITIVE_INFINITY,
        critical: 0,
        watch: 0,
      };

      current.count += 1;
      current.avgPressure += point.hydraulic_pressure_bar;
      current.minMargin = Math.min(current.minMargin, point.safety_margin_bar);
      current.critical += point.risk_level === 'critical' ? 1 : 0;
      current.watch += point.risk_level === 'watch' ? 1 : 0;
      accumulator[sector] = current;
      return accumulator;
    }, {});

    return Object.values(grouped)
      .map((entry) => ({
        ...entry,
        avgPressure: entry.avgPressure / entry.count,
        minMargin: Number.isFinite(entry.minMargin) ? entry.minMargin : 0,
      }))
      .sort((left, right) => right.critical - left.critical || left.minMargin - right.minMargin);
  }, [engineeringPoints]);

  const topStressedSectors = useMemo(() => sectorData.slice(0, 3), [sectorData]);
  const priorityDqPenalty = Math.max(0, 100 - qualitySummary.qualityScore) * PRIORITY_DQ_PENALTY_MULTIPLIER_V1;

  const priorityCandidates = useMemo<PriorityCandidate[]>(() => {
    const sectorStress = new Map(
      sectorData.map((sector) => [sector.sector, Math.min(1, (sector.critical * 0.5 + sector.watch * 0.25 + Math.max(0, 1.2 - sector.minMargin) * 0.25) / Math.max(1, sector.count))])
    );
    const dqPenalty = Math.max(0, 100 - qualitySummary.qualityScore) * PRIORITY_DQ_PENALTY_MULTIPLIER_V1;

    return [...engineeringPoints]
      .map((point) => {
        const maintenanceSeverity = point.maintenance_state === 'attention' ? 1 : point.maintenance_state === 'planned' ? 0.6 : 0.15;
        const riskSeverity = point.risk_level === 'critical' ? 1 : point.risk_level === 'watch' ? 0.65 : 0.2;
        const marginPressure = Math.min(1, Math.max(0, 1.2 - point.safety_margin_bar) / 1.2);
        const sectorPressure = sectorStress.get(point.technical.route_sector || 'Unassigned') || 0;
        const rawScore =
          100 *
            (PRIORITY_WEIGHTS_V1.marginPressure * marginPressure +
              PRIORITY_WEIGHTS_V1.riskSeverity * riskSeverity +
              PRIORITY_WEIGHTS_V1.maintenanceSeverity * maintenanceSeverity +
              PRIORITY_WEIGHTS_V1.sectorPressure * sectorPressure) -
          dqPenalty;
        const score = clamp(rawScore, 0, 100);
        const reasons = [
          `margin ${formatBar(point.safety_margin_bar)}`,
          point.risk_level,
          point.maintenance_state,
          `sector ${point.technical.route_sector || 'Unassigned'}`,
        ];

        return {
          id: point.id,
          name: point.name,
          stationLabel: point.station_label,
          sector: point.technical.route_sector || 'Unassigned',
          score,
          riskLabel: point.risk_level,
          reasons,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);
  }, [engineeringPoints, qualitySummary.qualityScore, sectorData]);

  const priorityAbComparison = useMemo(() => {
    const sectorStress = new Map(
      sectorData.map((sector) => [sector.sector, Math.min(1, (sector.critical * 0.5 + sector.watch * 0.25 + Math.max(0, 1.2 - sector.minMargin) * 0.25) / Math.max(1, sector.count))])
    );
    const dqPenalty = Math.max(0, 100 - qualitySummary.qualityScore) * PRIORITY_DQ_PENALTY_MULTIPLIER_V1;

    const scoreByWeights = (weights: {
      marginPressure: number;
      riskSeverity: number;
      maintenanceSeverity: number;
      sectorPressure: number;
    }) => {
      return engineeringPoints
        .map((point) => {
          const maintenanceSeverity = point.maintenance_state === 'attention' ? 1 : point.maintenance_state === 'planned' ? 0.6 : 0.15;
          const riskSeverity = point.risk_level === 'critical' ? 1 : point.risk_level === 'watch' ? 0.65 : 0.2;
          const marginPressure = Math.min(1, Math.max(0, 1.2 - point.safety_margin_bar) / 1.2);
          const sectorPressure = sectorStress.get(point.technical.route_sector || 'Unassigned') || 0;

          const rawScore =
            100 *
              (weights.marginPressure * marginPressure +
                weights.riskSeverity * riskSeverity +
                weights.maintenanceSeverity * maintenanceSeverity +
                weights.sectorPressure * sectorPressure) -
            dqPenalty;

          return {
            id: point.id,
            score: clamp(rawScore, 0, 100),
          };
        })
        .sort((left, right) => right.score - left.score);
    };

    const baseline = scoreByWeights(PRIORITY_WEIGHTS_V1);
    const candidate = scoreByWeights(PRIORITY_WEIGHTS_V1_1);
    const baselineTop = baseline.slice(0, 4);
    const candidateTop = candidate.slice(0, 4);
    const candidateById = new Map(candidate.map((row) => [row.id, row.score]));
    const overlapTop4 = baselineTop.filter((row) => candidateTop.some((candidateRow) => candidateRow.id === row.id)).length;
    const improvedCount = baseline.filter((row) => (candidateById.get(row.id) || 0) - row.score >= 1).length;
    const baselineMean = baselineTop.length > 0 ? baselineTop.reduce((sum, row) => sum + row.score, 0) / baselineTop.length : 0;
    const candidateMean = candidateTop.length > 0 ? candidateTop.reduce((sum, row) => sum + row.score, 0) / candidateTop.length : 0;

    return {
      baselineVersion: ANALYSIS_MODEL_VERSION,
      candidateVersion: ANALYSIS_MODEL_CANDIDATE_VERSION,
      baselineMean,
      candidateMean,
      meanDelta: candidateMean - baselineMean,
      overlapTop4,
      improvedCount,
    };
  }, [engineeringPoints, qualitySummary.qualityScore, sectorData]);

  const earlyWarningSignals = useMemo<EarlyWarningSignal[]>(() => {
    return [...engineeringPoints]
      .map((point) => {
        const marginStress = clamp((1 - point.safety_margin_bar) / 1, 0, 1);
        const pressureStress = clamp((point.hydraulic_pressure_bar - 7.2) / 1.2, 0, 1);
        const note = (point.technical.maintenance_note || point.technical.cathodic_status || '').toLowerCase();
        const noteStress = note.includes('critical') || note.includes('leak') || note.includes('rising') ? 1 : note.includes('watch') || note.includes('scheduled') ? 0.5 : 0.1;

        const score =
          clamp(
            100 *
              (EARLY_WARNING_WEIGHTS_V1.marginStress * marginStress +
                EARLY_WARNING_WEIGHTS_V1.pressureStress * pressureStress +
                EARLY_WARNING_WEIGHTS_V1.noteStress * noteStress),
            0,
            100
          );
        const etaHours = Math.max(EARLY_WARNING_ETA_MIN_HOURS_V1, Math.round(EARLY_WARNING_ETA_BASE_HOURS_V1 - score));
        const trigger = marginStress >= pressureStress ? 'margin compression' : 'pressure escalation';

        return {
          id: point.id,
          name: point.name,
          stationLabel: point.station_label,
          sector: point.technical.route_sector || 'Unassigned',
          score,
          etaHours,
          riskLevel: point.risk_level,
          trigger,
        };
      })
        .filter((signal) => signal.score >= EARLY_WARNING_THRESHOLD_V1)
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);
      }, [engineeringPoints]);

  const whatIfTitle = 'Scenario A: controlled pressure reduction (-0.35 bar) at stressed points';

  const whatIfImpacts = useMemo<WhatIfImpact[]>(() => {
    return [...engineeringPoints]
      .filter((point) => point.risk_level !== 'safe')
      .map((point) => {
        const projectedPressure = Math.max(0, point.hydraulic_pressure_bar - 0.35);
        const projectedMarginBar = point.pipe_bar_grade_bar - projectedPressure;
        const projectedRisk = classifyRisk(projectedMarginBar);

        return {
          id: point.id,
          name: point.name,
          stationLabel: point.station_label,
          sector: point.technical.route_sector || 'Unassigned',
          currentMarginBar: point.safety_margin_bar,
          projectedMarginBar,
          currentRisk: point.risk_level,
          projectedRisk,
        };
      })
      .sort((left, right) => left.projectedMarginBar - right.projectedMarginBar)
      .slice(0, 3);
  }, [engineeringPoints]);

  const sensitivityCurve = useMemo<SensitivityPoint[]>(() => {
    const deltas = Array.from({ length: 11 }, (_, index) => Number((index * 0.1 - 0.5).toFixed(1)));

    return deltas.map((delta) => {
      let critical = 0;
      let watch = 0;
      let safe = 0;

      for (const point of engineeringPoints) {
        const projectedPressure = Math.max(0, point.hydraulic_pressure_bar + delta);
        const projectedMargin = point.pipe_bar_grade_bar - projectedPressure;
        const projectedRisk = classifyRisk(projectedMargin);

        if (projectedRisk === 'critical') critical += 1;
        else if (projectedRisk === 'watch') watch += 1;
        else safe += 1;
      }

      const deltaLabel = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
      return {
        deltaLabel,
        critical,
        watch,
        safe,
        risky: critical + watch,
      };
    });
  }, [engineeringPoints]);

  const watchlistItems = useMemo(
    () =>
      engineeringSummary.watchlist.map((point) => ({
        id: point.id,
        name: point.name,
        stationLabel: point.station_label,
        equipmentCode: point.equipment_code,
        riskLevel: point.risk_level,
        panelClass: riskTone(point.risk_level).panel,
        badgeClass: riskTone(point.risk_level).badge,
        pressureLabel: formatBar(point.hydraulic_pressure_bar),
        marginLabel: formatBar(point.safety_margin_bar),
        note: createEngineeringNote(point),
      })),
    [engineeringSummary.watchlist]
  );

  const maintenanceFeed = useMemo(
    () =>
      [...engineeringPoints].sort((left, right) => {
        const leftScore = (left.risk_level === 'critical' ? 3 : left.risk_level === 'watch' ? 2 : 1) + (left.maintenance_state === 'attention' ? 2 : left.maintenance_state === 'planned' ? 1 : 0);
        const rightScore = (right.risk_level === 'critical' ? 3 : right.risk_level === 'watch' ? 2 : 1) + (right.maintenance_state === 'attention' ? 2 : right.maintenance_state === 'planned' ? 1 : 0);
        return rightScore - leftScore;
      }),
    [engineeringPoints]
  );

  const maintenanceFeedItems = useMemo(
    () =>
      maintenanceFeed.map((point) => ({
        id: point.id,
        name: point.name,
        stationLabel: point.station_label,
        sector: point.technical.route_sector || 'Unassigned',
        maintenanceState: point.maintenance_state,
        note: createEngineeringNote(point),
      })),
    [maintenanceFeed]
  );

  const heatmapValues = useMemo(
    () => [
      engineeringPoints.map((point) => Number(point.hydraulic_pressure_bar.toFixed(2))),
      engineeringPoints.map((point) => Number(point.pipe_bar_grade_bar.toFixed(2))),
      engineeringPoints.map((point) => Number(point.safety_margin_bar.toFixed(2))),
      engineeringPoints.map((point) => Number(point.invert_level.toFixed(2))),
    ],
    [engineeringPoints]
  );

  const pressureMix = useMemo(
    () => ({
      reserve: engineeringPoints.filter((point) => point.pressure_zone === 'reserve').length,
      nominal: engineeringPoints.filter((point) => point.pressure_zone === 'nominal').length,
      peak: engineeringPoints.filter((point) => point.pressure_zone === 'peak').length,
    }),
    [engineeringPoints]
  );

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/maintenance/linear-assets/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'فشل رفع الملف');
      }

      const rawAssets = Array.isArray(data.assets) ? (data.assets as LinearAsset[]) : [];
      const sanitized = sanitizeUploadedAssets(rawAssets);

      if (sanitized.assets.length === 0) {
        throw new Error('الملف تم استلامه لكن لا توجد صفوف صالحة بعد تنظيف البيانات');
      }

      setAssets(sanitized.assets);
      setQualitySummary(sanitized.summary);
      setRejectedRows(sanitized.rejectedRows.slice(0, 10));
      setSelectedAssetId(sanitized.assets[0]?.id || null);

      const qualityNote =
        sanitized.summary.duplicatesRemoved > 0 ||
        sanitized.summary.invalidStationRows > 0 ||
        sanitized.summary.invalidInvertRows > 0
          ? ` | Cleaned: ${sanitized.summary.duplicatesRemoved} duplicates, ${sanitized.summary.invalidStationRows} invalid station, ${sanitized.summary.invalidInvertRows} invalid invert`
          : '';
      setSuccess(`${data.message}${qualityNote}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'حدث خطأ غير معروف');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#06121c] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(8,145,178,0.24),_transparent_32%),radial-gradient(circle_at_85%_15%,_rgba(249,115,22,0.14),_transparent_24%),linear-gradient(180deg,_rgba(6,18,28,0.85),_rgba(3,7,18,1))]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto max-w-[1760px] space-y-6 px-4 py-6 md:px-6 xl:px-8">
        <section className="overflow-hidden rounded-[32px] border border-cyan-500/15 bg-slate-950/70 shadow-[0_40px_120px_rgba(8,47,73,0.35)] backdrop-blur-xl">
          <div className="grid gap-6 border-b border-white/5 px-6 py-6 lg:grid-cols-[1.45fr_0.8fr] xl:px-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-base font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                Engineering Intelligence Dashboard
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl font-sans text-4xl font-black leading-tight text-white md:text-6xl">
                  منصة هندسية تعرض المسار كـ digital twin لا كتشارت قديم.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 md:text-base">
                  البروفايل، الضغط، grade، الصيانة، والحماية الكاثودية تظهر الآن كلوحات تشغيلية متزامنة. كل نقطة في السلسلة تتحول إلى تقييم سلامة، مؤشر نزعة، ومشهد بصري ثلاثي الأبعاد يساعد المهندس يقرأ الخط بسرعة.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MiniStat label="Integrity score" value={`${engineeringSummary.integrityScore}%`} hint="شبكة السلامة العامة" tone="cyan" />
                <MiniStat label="Hydraulic peak" value={formatBar(engineeringSummary.maxPressure)} hint="أعلى ضغط على الخط" tone="amber" />
                <MiniStat label="Backlog" value={engineeringSummary.maintenanceBacklog.toString()} hint="نقاط متابعة وصيانة" tone="rose" />
                <MiniStat label="Critical stations" value={engineeringSummary.critical.toString()} hint="تجاوز مباشر للهامش" tone="emerald" />
              </div>
            </div>

            <div className="grid gap-4">
              <div className={`rounded-[28px] border p-5 ${engineeringSummary.critical > 0 ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/25 bg-emerald-500/10'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base uppercase tracking-[0.24em] text-slate-300">Mission state</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {engineeringSummary.critical > 0 ? 'Immediate engineering attention' : 'Operational envelope stable'}
                    </p>
                  </div>
                  <div className={`rounded-2xl p-3 ${engineeringSummary.critical > 0 ? 'bg-rose-500/15 text-rose-100' : 'bg-emerald-500/15 text-emerald-100'}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-base">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-2 text-slate-400"><Activity className="h-4 w-4" /> Monitored assets</div>
                    <p className="mt-1 text-2xl font-bold text-white">{engineeringSummary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-2 text-slate-400"><ShieldCheck className="h-4 w-4" /> Avg. margin</div>
                    <p className="mt-1 text-2xl font-bold text-white">{formatBar(engineeringSummary.averageMargin)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base uppercase tracking-[0.24em] text-slate-400">Active command</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {engineeringSummary.selectedPoint?.name || 'No selection'}
                    </p>
                  </div>
                  {engineeringSummary.selectedPoint && (
                    <span className={`rounded-full border px-3 py-1 text-[13px] font-semibold uppercase ${riskTone(engineeringSummary.selectedPoint.risk_level).badge}`}>
                      {engineeringSummary.selectedPoint.risk_level}
                    </span>
                  )}
                </div>
                {engineeringSummary.selectedPoint && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-base uppercase tracking-[0.2em] text-slate-400">Station</p>
                      <p className="mt-2 text-lg font-semibold text-white">{engineeringSummary.selectedPoint.station_label}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-base uppercase tracking-[0.2em] text-slate-400">Safety margin</p>
                      <p className="mt-2 text-lg font-semibold text-white">{formatBar(engineeringSummary.selectedPoint.safety_margin_bar)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-base uppercase tracking-[0.2em] text-slate-400">Hydraulic pressure</p>
                      <p className="mt-2 text-lg font-semibold text-white">{formatBar(engineeringSummary.selectedPoint.hydraulic_pressure_bar)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-base uppercase tracking-[0.2em] text-slate-400">Cathodic / maintenance</p>
                      <p className="mt-2 text-base leading-6 text-slate-200">{createEngineeringNote(engineeringSummary.selectedPoint)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-white/5 px-6 py-5 md:grid-cols-2 xl:grid-cols-4 xl:px-8">
            <MetricCard label="Safe envelope" value={engineeringSummary.safe.toString()} hint="نقاط تعمل ضمن هامش مريح" icon={<ShieldCheck className="h-4 w-4" />} accent="success" />
            <MetricCard label="Watch zone" value={engineeringSummary.watch.toString()} hint="هوامش تحتاج مراقبة مبكرة" icon={<ArrowUpRight className="h-4 w-4" />} accent="warning" />
            <MetricCard label="Critical alerts" value={engineeringSummary.critical.toString()} hint="ضغط يساوي أو يتجاوز الـ grade" icon={<AlertTriangle className="h-4 w-4" />} accent="danger" />
            <MetricCard label="Lowest margin" value={formatBar(engineeringSummary.minMargin)} hint="أضعف مسافة أمان على الخط" icon={<Gauge className="h-4 w-4" />} accent="default" />
          </div>

          <div className="grid gap-4 px-6 py-6 xl:grid-cols-[1.35fr_0.9fr] xl:px-8">
            <SectionShell
              title="Corridor Digital Twin"
              subtitle="مقطع بصري حديث للمسار يربط chainage والارتفاع والضغط في مشهد واحد"
              badge="live corridor"
            >
              <CorridorTwin
                points={engineeringPoints}
                selectedAssetId={engineeringSummary.selectedPoint?.id || null}
                onSelect={setSelectedAssetId}
              />
            </SectionShell>

            <div className="grid gap-4">
              <SectionShell
                title="Engineering watchlist"
                subtitle="الأولوية هنا للقرار، لا للتنقل اليدوي"
                badge="rapid actions"
              >
                <EngineeringWatchlistPanel items={watchlistItems} onSelect={setSelectedAssetId} />
              </SectionShell>

              <SectionShell
                title="Pressure mix"
                subtitle="توزيع السلوك التشغيلي على الخط"
                badge="operating state"
              >
                <PressureMixPanel points={engineeringPoints} />
              </SectionShell>
            </div>
          </div>

          <CorridorChartsRow
            points={engineeringPoints}
            heatmapValues={heatmapValues}
            selectedPointId={engineeringSummary.selectedPoint?.id || null}
          />

          <div className="grid gap-4 px-6 py-6 xl:grid-cols-[1.1fr_0.85fr_0.85fr] xl:px-8">
            <SectionShell
              title="Sector Stress Profile"
              subtitle="من أين تأتي الخطورة: القطاع، الضغط، والهامش الأدنى"
              badge="sector analytics"
            >
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={sectorData}>
                    <CartesianGrid stroke="rgba(148,163,184,0.14)" strokeDasharray="4 6" />
                    <XAxis dataKey="sector" tick={{ fill: '#cbd5e1', fontSize: 13 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#cbd5e1', fontSize: 13 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#cbd5e1', fontSize: 13 }} />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="avgPressure" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="left" dataKey="critical" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="minMargin" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionShell>

            <SectionShell
              title="Risk Composition"
              subtitle="النسب العامة للمشهد التشغيلي"
              badge="composition"
            >
              <Plot
                data={[
                  {
                    type: 'pie',
                    hole: 0.62,
                    labels: ['Safe', 'Watch', 'Critical'],
                    values: [engineeringSummary.safe, engineeringSummary.watch, engineeringSummary.critical],
                    marker: { colors: ['#10b981', '#f59e0b', '#f43f5e'] },
                    textinfo: 'label+percent',
                    textfont: { color: '#e2e8f0', size: 12 },
                    hovertemplate: '%{label}: %{value}<extra></extra>',
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 0, r: 0, t: 10, b: 0 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  font: { color: '#dbeafe' },
                  annotations: [
                    {
                      text: `${engineeringSummary.integrityScore}%<br>Integrity`,
                      showarrow: false,
                      font: { size: 18, color: '#ffffff' },
                    },
                  ],
                }}
                config={{ displayModeBar: false, responsive: true }}
                className="h-[320px] w-full"
                useResizeHandler
                style={{ width: '100%', height: '320px' }}
              />
            </SectionShell>

            <SectionShell
              title="Maintenance feed"
              subtitle="ملاحظات الصيانة والحماية الكاثودية ضمن نفس القراءة"
              badge="field actions"
            >
              <MaintenanceFeedPanel
                priorityCandidates={priorityCandidates}
                dqPenalty={priorityDqPenalty}
                earlyWarningSignals={earlyWarningSignals}
                whatIfTitle={whatIfTitle}
                whatIfImpacts={whatIfImpacts}
                sensitivityCurve={sensitivityCurve}
                topStressedSectors={topStressedSectors}
                maintenanceFeed={maintenanceFeedItems}
                modelVersion={ANALYSIS_MODEL_VERSION}
                priorityAbComparison={priorityAbComparison}
              />
            </SectionShell>
          </div>

          <div className="grid gap-4 border-y border-white/5 px-6 py-6 xl:grid-cols-[1.1fr_0.9fr] xl:px-8">
            <SectionShell
              title="Data Ingestion"
              subtitle="ملفات CSV / XLSX تبقى مدعومة، لكن تدخل الآن إلى واجهة تحليلية أوسع"
              badge="upload"
            >
              <FileUploadZone onFileSelect={handleFileSelect} isLoading={isLoading} error={error} success={success} />
              <DataQualityPanel qualitySummary={qualitySummary} rejectedRows={rejectedRows} />
            </SectionShell>

            <SectionShell
              title="Engineering narrative"
              subtitle="وصف مباشر لما تقوله البيانات حالياً"
              badge="decision support"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <NarrativeCard
                  icon={<Layers3 className="h-4 w-4" />}
                  title="Longitudinal intelligence"
                  text="المسار لم يعد مجرد line profile؛ تم تحويله إلى corridor له قطاع، ضغط، margin، integrity score، وسياق صيانة."
                />
                <NarrativeCard
                  icon={<Orbit className="h-4 w-4" />}
                  title="3D situational reading"
                  text="المشهد الثلاثي الأبعاد يربط station مع pressure وinvert elevation ليظهر crest points والضغط الحرج في نفس الفضاء."
                />
                <NarrativeCard
                  icon={<Wrench className="h-4 w-4" />}
                  title="Maintenance coupling"
                  text="ملاحظات الصيانة والحماية الكاثودية لم تعد منفصلة؛ كل أصل يحمل حالته مباشرة داخل التحليل."
                />
                <NarrativeCard
                  icon={<Gauge className="h-4 w-4" />}
                  title="Actionable thresholds"
                  text="كل اقتراب من Pipe Bar Grade يتحول إلى watchlist مع أولوية انتقاء جاهزة، بدل البحث اليدوي داخل جدول أو أداة سحب قديمة."
                />
              </div>
            </SectionShell>
          </div>

          <div className="space-y-4 px-6 py-6 xl:px-8">
            <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
              <WorkbenchTab active={activeTab === 'cockpit'} onClick={() => setActiveTab('cockpit')} label="Cockpit" />
              <WorkbenchTab active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} label="Deep Profile" />
              <WorkbenchTab active={activeTab === 'table'} onClick={() => setActiveTab('table')} label="Asset Table" />
            </div>

            {activeTab === 'cockpit' && (
              <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
                <SectionShell
                  title="Command board"
                  subtitle="المهندس يبدأ من هنا: ما الذي يحتاج تدخل الآن"
                  badge="priority board"
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    {engineeringSummary.watchlist.map((point) => (
                      <button
                        key={point.id}
                        onClick={() => setSelectedAssetId(point.id)}
                        className={`rounded-2xl border p-4 text-left transition hover:-translate-y-1 ${riskTone(point.risk_level).panel}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-base font-semibold text-white">{point.name}</p>
                            <p className="mt-1 text-base text-slate-300">{point.station_label}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-[13px] font-semibold uppercase ${riskTone(point.risk_level).badge}`}>
                            {point.risk_level}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-2 text-base">
                          <InfoTile label="Pressure" value={formatBar(point.hydraulic_pressure_bar)} />
                          <InfoTile label="Grade" value={formatBar(point.pipe_bar_grade_bar)} />
                          <InfoTile label="Maintenance" value={point.maintenance_state} tone="default" />
                        </div>
                      </button>
                    ))}
                  </div>
                </SectionShell>

                <SectionShell
                  title="Critical corridor notes"
                  subtitle="أين تظهر الإشارات الحرجة حالياً"
                  badge="instant brief"
                >
                  <div className="space-y-3 text-base leading-6 text-slate-300">
                    <p>أقرب نقطة حرجة حالياً هي {engineeringSummary.criticalStations[0] || 'لا توجد نقطة حرجة'}، ويظهر ذلك مباشرة عبر انخفاض margin إلى {formatBar(engineeringSummary.minMargin)}.</p>
                    <p>القطاع الأكثر تعرضاً حالياً هو {sectorData[0]?.sector || 'غير محدد'} بسبب اقتراب الضغط المتوسط من حدود grade مع تركز نقاط watch / critical فيه.</p>
                    <p>عند اختيار أي أصل من watchlist أو الـ digital twin، تنتقل القراءة كاملة إلى command card بدون العودة لأدوات pan/zoom قديمة.</p>
                  </div>
                </SectionShell>
              </div>
            )}

            {activeTab === 'profile' && (
              <SectionShell
                title="Deep Longitudinal Profile"
                subtitle="الإبقاء على البروفايل التقليدي كأداة فحص ثانوية بعد بناء cockpit الأعلى"
                badge="secondary workspace"
              >
                <ProfileView
                  assets={assets}
                  routeName="مسار النهر الصناعي"
                  onAssetClick={(asset) => setSelectedAssetId(asset.id)}
                  selectedAssetId={selectedAssetId || undefined}
                />
              </SectionShell>
            )}

            {activeTab === 'table' && (
              <SectionShell
                title="Asset Intelligence Table"
                subtitle="الجدول يبقى موجوداً لكن بعدة طبقات فنية أعمق"
                badge="asset registry"
              >
                <AssetManagementTable
                  assets={assets}
                  onAssetClick={(asset) => setSelectedAssetId(asset.id)}
                  selectedAssetId={selectedAssetId || undefined}
                />
              </SectionShell>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-4 shadow-[0_20px_80px_rgba(2,6,23,0.28)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-base text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.2em] text-slate-300">
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  accent = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const styles = {
    default: 'border-white/10 bg-white/5 text-slate-300',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
    danger: 'border-rose-500/20 bg-rose-500/10 text-rose-100',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100',
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${styles[accent]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base uppercase tracking-[0.18em] opacity-75">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/50 p-3 text-white/80">{icon}</div>
      </div>
      <p className="mt-2 text-base leading-5 opacity-80">{hint}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'cyan' | 'amber' | 'rose' | 'emerald';
}) {
  const tones = {
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  } as const;

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[13px] uppercase tracking-[0.2em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-base opacity-80">{hint}</p>
    </div>
  );
}

function InfoTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const tones = {
    default: 'border-white/10 bg-slate-950/60 text-slate-100',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
    danger: 'border-rose-500/20 bg-rose-500/10 text-rose-100',
  } as const;

  return (
    <div className={`rounded-xl border p-2 ${tones[tone]}`}>
      <span className="text-[13px] uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function WorkbenchTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-base font-semibold transition ${
        active ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function NarrativeCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-cyan-200">
        {icon}
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <p className="mt-3 text-base leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function CorridorTwin({
  points,
  selectedAssetId,
  onSelect,
}: {
  points: EngineeringPoint[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
}) {
  const width = 1000;
  const height = 360;
  const padX = 60;
  const baseY = 250;

  const minStation = Math.min(...points.map((point) => point.station));
  const maxStation = Math.max(...points.map((point) => point.station));
  const minElevation = Math.min(...points.map((point) => point.invert_level));
  const maxElevation = Math.max(...points.map((point) => point.invert_level));
  const maxPressure = Math.max(...points.map((point) => point.hydraulic_pressure_bar));

  const plotPoints = points.map((point) => {
    const stationRatio = (point.station - minStation) / Math.max(1, maxStation - minStation);
    const elevationRatio = (point.invert_level - minElevation) / Math.max(1, maxElevation - minElevation);
    const pressureRatio = point.hydraulic_pressure_bar / Math.max(1, maxPressure);
    const x = padX + stationRatio * (width - padX * 2);
    const y = baseY - elevationRatio * 120;
    const extrusion = 24 + pressureRatio * 58;
    return { ...point, x, y, extrusion };
  });

  const profilePath = plotPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-[24px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(8,47,73,0.22),rgba(2,6,23,0.55))] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[380px] min-w-[920px] w-full md:h-[420px]">
        <defs>
          <linearGradient id="corridor-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(56,189,248,0.16)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.9)" />
          </linearGradient>
        </defs>

        <polygon points="40,260 960,260 900,305 100,305" fill="url(#corridor-floor)" stroke="rgba(56,189,248,0.18)" />
        <path d={profilePath} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="3" />

        {plotPoints.map((point) => {
          const isSelected = point.id === selectedAssetId;
          const fill = riskColor(point.risk_level);
          const left = point.x - 10;
          const right = point.x + 10;
          const topY = point.y - point.extrusion;

          return (
            <g key={point.id} onClick={() => onSelect(point.id)} className="cursor-pointer">
              <polygon
                points={`${left},${point.y} ${right},${point.y} ${right},${topY} ${left},${topY}`}
                fill={fill}
                opacity={isSelected ? 1 : 0.76}
                stroke={isSelected ? '#f8fafc' : 'rgba(255,255,255,0.2)'}
                strokeWidth={isSelected ? 2.4 : 0.8}
              />
              <polygon
                points={`${right},${point.y} ${right + 8},${point.y - 5} ${right + 8},${topY - 5} ${right},${topY}`}
                fill="rgba(255,255,255,0.16)"
                opacity={0.55}
              />
              <polygon
                points={`${left},${topY} ${right},${topY} ${right + 8},${topY - 5} ${left + 8},${topY - 5}`}
                fill="rgba(255,255,255,0.18)"
                opacity={0.55}
              />
              <circle cx={point.x} cy={point.y} r={isSelected ? 6 : 4} fill="#e2e8f0" opacity={0.9} />
              {(point.risk_level !== 'safe' || isSelected) && (
                <text x={point.x} y={topY - 12} textAnchor="middle" fill="#e2e8f0" fontSize="12" fontWeight="700" pointerEvents="none">
                  {point.station_label}
                </text>
              )}
            </g>
          );
        })}

        <text x="60" y="36" fill="#e2e8f0" fontSize="14" fontWeight="700">Elevation spine</text>
        <text x="60" y="56" fill="#94a3b8" fontSize="12">3D bars represent hydraulic pressure intensity over the route</text>
      </svg>
    </div>
  );
}

function EngineeringTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: EngineeringPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-white">{point.name}</p>
          <p className="text-base text-slate-400">{point.station_label} · {point.equipment_code}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[13px] font-semibold uppercase ${riskTone(point.risk_level).badge}`}>
          {point.risk_level}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-base">
        <InfoTile label="Hydraulic" value={formatBar(point.hydraulic_pressure_bar)} />
        <InfoTile label="Pipe grade" value={formatBar(point.pipe_bar_grade_bar)} />
        <InfoTile label="Margin" value={formatBar(point.safety_margin_bar)} tone={point.risk_level === 'critical' ? 'danger' : point.risk_level === 'watch' ? 'warning' : 'default'} />
        <InfoTile label="Invert" value={`${point.invert_level.toFixed(3)} m`} />
      </div>
      <p className="mt-3 text-base leading-5 text-slate-300">{createEngineeringNote(point)}</p>
    </div>
  );
}