'use client';

import dynamic from 'next/dynamic';
import React, { useMemo, useState, useEffect } from 'react';
import { useGisEngine } from '@/store/gisEngine';
import { useWorkOrderStore } from '@/store/workOrderStore';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Layers3,
  LocateFixed,
  Orbit,
  ShieldCheck,
  Sparkles,
  Map as MapIcon,
  BarChart3,
  Bell,
  Database,
  TableProperties,
  FileText,
  ZoomIn,
  ZoomOut,
  Wrench,
  Printer,
} from 'lucide-react';
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FileUploadZone } from '../dashboard/operations-maintenance/components/FileUploadZone';
import { DataQualityPanel, type DataQualitySummary, type RejectedRow } from '../dashboard/operations-maintenance/components/DataQualityPanel';
import { EngineeringWatchlistPanel } from '../dashboard/operations-maintenance/components/EngineeringWatchlistPanel';
import { EarlyWarningPanel } from '../dashboard/operations-maintenance/components/EarlyWarningPanel';
import type { EarlyWarningSignal } from '../dashboard/operations-maintenance/components/EarlyWarningPanel';
import { MaintenanceFeedPanel } from '../dashboard/operations-maintenance/components/MaintenanceFeedPanel';
import { PressureMixPanel } from '../dashboard/operations-maintenance/components/PressureMixPanel';
import type { PriorityCandidate } from '../dashboard/operations-maintenance/components/PriorityEnginePanel';
import type { SensitivityPoint } from '../dashboard/operations-maintenance/components/SensitivityCurvePanel';
import type { WhatIfImpact } from '../dashboard/operations-maintenance/components/WhatIfScenarioPanel';
import { VerticalTimelineView } from '../dashboard/operations-maintenance/components/VerticalTimelineView';
import { AssetManagementTable } from '../dashboard/operations-maintenance/components/AssetManagementTable';
import LinearSchematicMap from '../dashboard/operations-maintenance/components/LinearSchematicMap';
import AssetDigitalTwin from '../dashboard/operations-maintenance/components/AssetDigitalTwin';
import { SmartAlertsPanel } from '../dashboard/operations-maintenance/components/SmartAlertsPanel';
import StationClustersPanel from '../dashboard/operations-maintenance/components/StationClustersPanel';
import ReplacementReport from '../dashboard/operations-maintenance/components/ReplacementReport';
import MaintenanceSchedule from '../dashboard/operations-maintenance/components/MaintenanceSchedule';
import CorrosionInbox from '../dashboard/operations-maintenance/components/CorrosionInbox';
import SectorBenchmarkPanel from '../dashboard/operations-maintenance/components/SectorBenchmarkPanel';
import { useWorkOrderStore as useWOStore } from '@/store/workOrderStore';
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
} from '../dashboard/operations-maintenance/demo/analysisWeights';


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

const formatBar = (value: number) => `${(value || 0).toFixed(2)} bar`;
const formatBarAxis = (v: number) => `${(v || 0).toFixed(1)}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// ── Sector descriptions shown on corridor cards ────────────────────────────
const SECTOR_INFO: Record<string, { ar: string; desc: string; type: 'pump' | 'conv' | 'fcs' }> = {
  'P/S-NEJH(N)': { ar: 'محطة ضخ نجح — شمال', desc: 'نقطة الضخ الرئيسية الشمالية، تغذي الخط الشمالي لمسار الأنبوب', type: 'pump' },
  'P/S-NEJH(S)': { ar: 'محطة ضخ نجح — جنوب', desc: 'نقطة الضخ الرئيسية الجنوبية، تغذي الخط الجنوبي وتدعم التوازن الهيدروليكي', type: 'pump' },
  'P/S-EJH':     { ar: 'محطة ضخ عجيلة', desc: 'محطة ضخ مركزية تخدم منطقة عجيلة وتُحوّل الضغط نحو ممرات النقل', type: 'pump' },
  'FCS-ASH':     { ar: 'محطة تحكم عين الشهداء', desc: 'محطة ضبط التدفق وموازنة الضغط بين قطاعات الخط الرئيسي', type: 'fcs' },
  'CONV-C000':   { ar: 'ممر النقل — القطاع 000', desc: 'القطاع الأول من خط نقل المياه، يمتد من نقطة البداية باتجاه المنطقة الوسطى', type: 'conv' },
  'CONV-C100':   { ar: 'ممر النقل — القطاع 100', desc: 'القطاع الثاني، يمر عبر مناطق ذات تضاريس متذبذبة وضغط هيدروليكي مرتفع نسبياً', type: 'conv' },
  'CONV-C200':   { ar: 'ممر النقل — القطاع 200', desc: 'القطاع الثالث من الخط الرئيسي، يشمل مناطق تفتيش حرجة', type: 'conv' },
  'CONV-C300':   { ar: 'ممر النقل — القطاع 300', desc: 'القطاع الرابع، يحتوي على انحدار حرج يتطلب مراقبة دورية مستمرة', type: 'conv' },
  'CONV-C400':   { ar: 'ممر النقل — القطاع 400', desc: 'القطاع الخامس، منطقة انتقالية بين الضغط المتوسط والمنخفض', type: 'conv' },
  'CONV-C500':   { ar: 'ممر النقل — القطاع 500', desc: 'القطاع الختامي للخط الرئيسي، يصل إلى نقطة التوزيع النهائية', type: 'conv' },
};

const ASSET_TYPE_LABELS: Record<string, { ar: string; icon: string }> = {
  SAV:  { ar: 'صمام تنفيس هواء', icon: '💨' },
  MH:   { ar: 'غرفة تفتيش',       icon: '🔲' },
  PU:   { ar: 'وحدة ضخ',          icon: '⚙️' },
  WT:   { ar: 'خزان مياه',         icon: '🗄️' },
  DAV:  { ar: 'صمام هواء مزدوج',  icon: '🔀' },
  PUWE: { ar: 'معدات ضخ',          icon: '🔧' },
  TJE:  { ar: 'وصلة تمدد',         icon: '↔️' },
};

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

function localizedRiskLabel(riskLevel: EngineeringRiskLevel): 'آمن' | 'مراقبة' | 'حرج' {
  if (riskLevel === 'critical') return 'حرج';
  if (riskLevel === 'watch') return 'مراقبة';
  return 'آمن';
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
    if (station === null) {
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
    if (invertLevel === null) {
      invalidInvertRows += 1;
      rejectedRows.push({
        key: `${asset.id}-invert`,
        equipmentCode,
        station: buildStationLabel(station),
        reason: 'invalid invert level',
      });
      continue;
    }

    const key = `${equipmentCode.toUpperCase()}|${station.toFixed(3)}|${invertLevel.toFixed(3)}`;
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
      station,
      invert_level: invertLevel,
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
      ? 'الفارق التصميمي HGL/MAOP يتجاوز الحد — مراجعة هندسية للمقطع مطلوبة'
      : point.risk_level === 'watch'
        ? 'الفارق التصميمي HGL/MAOP ضيق — يستحسن المراجعة عند إعداد مخططات التنفيذ'
        : 'الفارق التصميمي HGL/MAOP ضمن الحدود المقبولة';

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


const UnifiedOLMap = dynamic(
  () => import('../dashboard/admin-gateway/unified-map/UnifiedOLMap'),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-slate-400">تحميل الخريطة...</div> }
);


// ── Simulation Modal ──────────────────────────────────────────────────────
type SimParams = { flowRate: number; pumpHead: number; scenario: 'normal' | 'emergency' | 'low' };
function SimModal({
  open, params, onClose, onApply,
}: { open: boolean; params: SimParams; onClose: () => void; onApply: (p: SimParams) => void }) {
  const [local, setLocal] = React.useState<SimParams>(params);
  React.useEffect(() => { if (open) setLocal(params); }, [open, params]);
  if (!open) return null;
  const SCENARIOS = [
    { key: 'normal',    label: 'تشغيل عادي',   color: 'text-emerald-400', desc: 'الضغط الاعتيادي — ضغط الضخ 100%' },
    { key: 'emergency', label: 'طارئ / ذروة',  color: 'text-rose-400',    desc: 'تشغيل بحمل زائد — ضغط ×1.35' },
    { key: 'low',       label: 'ضغط منخفض',    color: 'text-amber-400',   desc: 'انخفاض الطلب أو صيانة — ضغط ×0.65' },
  ] as const;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h3 className="text-base font-bold text-white">محاكاة تصميمية — سيناريوهات تغيير ظروف التشغيل المفترضة</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="space-y-5 p-6">
          {/* Scenario selector */}
          <div>
            <label className="text-base font-semibold text-slate-400 mb-2 block">نوع السيناريو</label>
            <div className="grid grid-cols-3 gap-2">
              {SCENARIOS.map(s => (
                <button key={s.key} onClick={() => setLocal(p => ({ ...p, scenario: s.key }))}
                  className={`rounded-xl border p-3 text-center transition-all ${local.scenario === s.key ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/8 bg-white/3 hover:bg-white/8'}`}>
                  <p className={`text-base font-bold ${s.color}`}>{s.label}</p>
                  <p className="text-[13px] text-slate-500 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {/* Flow rate slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-base font-semibold text-slate-400">معدل التدفق</label>
              <span className="text-base font-mono font-bold text-cyan-400">{local.flowRate.toLocaleString()} م³/س</span>
            </div>
            <input type="range" min={400} max={2400} step={50} value={local.flowRate}
              onChange={e => setLocal(p => ({ ...p, flowRate: +e.target.value }))}
              className="w-full accent-cyan-500 h-1.5 rounded-full" />
            <div className="flex justify-between text-[13px] text-slate-600 mt-1"><span>400</span><span>1,200 (عادي)</span><span>2,400</span></div>
          </div>
          {/* Pump head slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-base font-semibold text-slate-400">ضغط الضخ (Head)</label>
              <span className="text-base font-mono font-bold text-cyan-400">{local.pumpHead} م</span>
            </div>
            <input type="range" min={200} max={800} step={10} value={local.pumpHead}
              onChange={e => setLocal(p => ({ ...p, pumpHead: +e.target.value }))}
              className="w-full accent-cyan-500 h-1.5 rounded-full" />
            <div className="flex justify-between text-[13px] text-slate-600 mt-1"><span>200م</span><span>450م (عادي)</span><span>800م</span></div>
          </div>
        </div>
        <div className="flex gap-3 border-t border-white/5 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-2.5 text-base text-slate-400 hover:text-white transition-all">إلغاء</button>
          <button onClick={() => { onApply(local); onClose(); }}
            className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-base font-bold text-black hover:bg-cyan-400 transition-all">
            تطبيق المحاكاة
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Maintenance sub-tabs wrapper ──────────────────────────────────────────
function MaintainTabs({ assets, onAssetSelect }: { assets: LinearAsset[]; onAssetSelect: (id: string) => void }) {
  const [sub, setSub] = React.useState<'clusters' | 'replacement' | 'schedule' | 'benchmark' | 'corrosion_inbox'>('clusters');
  const corrosionNew = useWOStore(s =>
    s.workOrders.filter(w => w.department === 'corrosion' && w.status === 'dispatched').length
  );
  const resultsNew = useWOStore(s =>
    s.workOrders.filter(w => w.status === 'results_submitted').length
  );
  const SUB_TABS = [
    { key: 'clusters',        label: '📍 مواقع الزيارة الميدانية' },
    { key: 'replacement',     label: '🔩 تقرير الإحلال والقطع' },
    { key: 'schedule',        label: `📅 جدول الصيانة السنوي${resultsNew > 0 ? ` 🟢${resultsNew}` : ''}` },
    { key: 'benchmark',       label: '📊 مقارنة القطاعات' },
    { key: 'corrosion_inbox', label: `⚗️ صندوق التآكل${corrosionNew > 0 ? ` 🔴${corrosionNew}` : ''}` },
  ] as const;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-3">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            className={`rounded-full px-4 py-1.5 text-base font-semibold border transition-all ${
              sub === t.key
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'border-white/8 text-slate-500 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'clusters'        && <StationClustersPanel assets={assets} onAssetSelect={onAssetSelect} />}
      {sub === 'replacement'     && <ReplacementReport assets={assets} onAssetSelect={onAssetSelect} />}
      {sub === 'schedule'        && <MaintenanceSchedule assets={assets} onAssetSelect={onAssetSelect} />}
      {sub === 'benchmark'       && <SectorBenchmarkPanel assets={assets} />}
      {sub === 'corrosion_inbox' && <CorrosionInbox />}
    </div>
  );
}

export default function MaintenanceDemoPage() {
  const [assets, setAssets] = useState<LinearAsset[]>(DEMO_ASSETS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>('6');
  const [activeTab, setActiveTab] = useState<'map' | 'analytics' | 'linemap' | 'maintain' | 'reports'>('map');
  const [qualitySummary, setQualitySummary] = useState<DataQualitySummary>(() => sanitizeUploadedAssets(DEMO_ASSETS).summary);
  const [rejectedRows, setRejectedRows] = useState<RejectedRow[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(true);
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simParams, setSimParams] = useState({ flowRate: 1200, pumpHead: 450, scenario: 'normal' as 'normal' | 'emergency' | 'low' });
  const [activeSimParams, setActiveSimParams] = useState({ flowRate: 1200, pumpHead: 450, scenario: 'normal' as 'normal' | 'emergency' | 'low' });

  // ── Auto-load saved assets on first render ─────────────────────────────
  useEffect(() => {
    fetch('/api/maintenance/linear-assets/saved')
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.assets) && data.assets.length > 0) {
          const sanitized = sanitizeUploadedAssets(data.assets);
          setAssets(sanitized.assets);
          setQualitySummary(sanitized.summary);
          setSelectedAssetId(sanitized.assets[0]?.id || null);
          setSavedAt(data.savedAt ? new Date(data.savedAt).toLocaleString('ar-LY') : null);
          setUsingDemo(false);
        }
      })
      .catch(() => {/* stay on DEMO_ASSETS silently */});
  }, []);

  const engineeringPoints = useMemo(() => {
    const SCENARIO_FACTOR = { normal: 1.0, emergency: 1.35, low: 0.65 };
    const factor = SCENARIO_FACTOR[activeSimParams.scenario];
    const headScale = activeSimParams.pumpHead / 450;
    const flowScale = activeSimParams.flowRate / 1200;
    return [...assets].map(a => {
      const base = enrichAsset(a);
      return {
        ...base,
        hydraulic_pressure_bar: +(base.hydraulic_pressure_bar * factor * headScale * (1 / Math.max(0.5, flowScale))).toFixed(2),
        safety_margin_bar: +(base.safety_margin_bar * (1 / factor)).toFixed(2),
      };
    }).sort((l, r) => l.station - r.station);
  }, [assets, activeSimParams]);

  // ── Real Data Intelligence ──────────────────────────────────────────────
  const dataIntelligence = useMemo(() => {
    const sorted = [...assets].sort((a, b) => a.station - b.station);

    // Equipment type counts
    const typeMap: Record<string, number> = {};
    for (const a of sorted) {
      const prefix = (a.equipment_code || '').replace(/-.*/, '').replace(/[^A-Z]/g, '');
      typeMap[prefix] = (typeMap[prefix] || 0) + 1;
    }

    // Sector summary
    const sectorMap: Record<string, { count: number; minSt: number; maxSt: number; minEl: number; maxEl: number; types: Record<string,number> }> = {};
    for (const a of sorted) {
      const s = a.technical?.route_sector || 'Unknown';
      if (!sectorMap[s]) sectorMap[s] = { count: 0, minSt: a.station, maxSt: a.station, minEl: a.invert_level, maxEl: a.invert_level, types: {} };
      const sm = sectorMap[s];
      sm.count++;
      sm.minSt = Math.min(sm.minSt, a.station);
      sm.maxSt = Math.max(sm.maxSt, a.station);
      sm.minEl = Math.min(sm.minEl, a.invert_level);
      sm.maxEl = Math.max(sm.maxEl, a.invert_level);
      const t = (a.equipment_code || '').replace(/-.*/, '').replace(/[^A-Z]/g, '');
      sm.types[t] = (sm.types[t] || 0) + 1;
    }

    // SAV pressure class (PN) distribution — second number in DN×PN code = pressure class in bar (NOT wall thickness)
    const thicknessMap: Record<string, number> = {};
    for (const a of sorted) {
      if ((a.equipment_code || '').startsWith('SAV')) {
        const d = a.technical?.diameter || '';
        const t = d.includes('x') ? d.split('x')[1].trim() : 'Unknown';
        thicknessMap[t] = (thicknessMap[t] || 0) + 1;
      }
    }

    // Elevation profile (sampled every ~10 assets for chart performance)
    const elevationProfile = sorted
      .filter((_, i) => i % 3 === 0)
      .map(a => ({
        station_label: `C${Math.floor(a.station / 1000)}+${String(a.station % 1000).padStart(3, '0')}`,
        elevation: a.invert_level,
        station: a.station,
      }));

    // SAV spacing analysis
    const savAssets = sorted.filter(a => (a.equipment_code || '').startsWith('SAV'));
    const savGaps = savAssets.slice(0, -1).map((a, i) => ({
      station_label: `C${Math.floor(a.station / 1000)}+000`,
      gap_m: savAssets[i + 1].station - a.station,
    })).filter(g => g.gap_m > 0);

    const maxGap = savGaps.reduce((mx, g) => g.gap_m > mx.gap_m ? g : mx, savGaps[0] || { station_label: '', gap_m: 0 });
    const avgGap = savGaps.length ? savGaps.reduce((s, g) => s + g.gap_m, 0) / savGaps.length : 0;

    return { typeMap, sectorMap, thicknessMap, elevationProfile, savGaps, maxGap, avgGap, sorted };
  }, [assets]);

  
  // Simulation: Convert Linear Station to Lat/Long (Simplified routing for demo)
  
  const [enableEdit, setEnableEdit] = useState(false);
  const [snapToCurves, setSnapToCurves] = useState(true);
  const [trueCoords, setTrueCoords] = useState<number[][]>([]);
  useEffect(() => { fetch('/centerline.json').then(r => r.json()).then(setTrueCoords).catch(console.error); }, []);
  const [routeAnchors, setRouteAnchors] = useState([
      { station: 0, lat: 28.530, lng: 14.100, label: 'الحساونة (Al Hasawna)' },
      { station: 150000, lat: 30.230, lng: 14.300, label: 'الشويرف (Ash Shwayrif)' },
      { station: 250000, lat: 31.050, lng: 14.400, label: 'وادي زمزم' },
      { station: 300000, lat: 31.750, lng: 13.980, label: 'بني وليد (Bani Walid)' },
      { station: 380000, lat: 32.430, lng: 13.550, label: 'ترهونة (Tarhuna)' },
      { station: 400000, lat: 32.650, lng: 13.200, label: 'سيدي السايح (Sidi As Sayih)' },
      { station: 450000, lat: 32.880, lng: 13.180, label: 'طرابلس (Tripoli)' }
    ]);
  const _unused = useMemo(() => {
    // Al Hasawna -> Shwerf -> Bani Walid -> Sidi Sayeh
    return [
      { station: 0, lat: 28.530, lng: 14.100, label: 'الحساونة (Al Hasawna)' },
      { station: 150000, lat: 30.230, lng: 14.300, label: 'الشويرف (Ash Shwayrif)' },
      { station: 250000, lat: 31.050, lng: 14.400, label: 'وادي زمزم' },
      { station: 300000, lat: 31.750, lng: 13.980, label: 'بني وليد (Bani Walid)' },
      { station: 380000, lat: 32.430, lng: 13.550, label: 'ترهونة (Tarhuna)' },
      { station: 400000, lat: 32.650, lng: 13.200, label: 'سيدي السايح (Sidi As Sayih)' },
      { station: 450000, lat: 32.880, lng: 13.180, label: 'طرابلس (Tripoli)' }
    ];
  }, []);

  const lrsPoints = useMemo(() => {
    return engineeringPoints.map(p => {
       if (p.latitude && p.longitude) return p;
       
       let lat = 28.530;
       let lon = 14.100;
       
       const anchors = routeAnchors.map(a => ({ s: a.station, lat: a.lat, lng: a.lng }));
       
       const st = p.station || 0;
       for (let i = 0; i < anchors.length - 1; i++) {
         const a1 = anchors[i];
         const a2 = anchors[i+1];
         if (st >= a1.s && st <= a2.s) {
            const fraction = Math.max(0, Math.min(1, (st - a1.s) / (a2.s - a1.s)));
            lat = a1.lat + (a2.lat - a1.lat) * fraction;
            lon = a1.lng + (a2.lng - a1.lng) * fraction;
            
            break;
         } else if (st > anchors[anchors.length-2].s) {
            lat = a2.lat;
            lon = a2.lng;
         }
       }
       
       if (snapToCurves && trueCoords.length > 0) {
           let minDist = Infinity;
           let bestLng = lon; let bestLat = lat;
           for (const [cLng, cLat] of trueCoords) {
               // Fast pythagorean approximation for snapping locally
               const d = Math.pow(cLng - lon, 2) + Math.pow(cLat - lat, 2);
               if (d < minDist) { minDist = d; bestLng = cLng; bestLat = cLat; }
           }
           // Only snap if reasonably close (e.g. avoid snapping across the country)
           if (minDist < 0.1) {
               lon = bestLng;
               lat = bestLat;
           }
       }

       
       return { ...p, latitude: lat, longitude: lon, geometry: { coordinates: [lon, lat] } };
    });
  }, [engineeringPoints]);

  // ── Work-order map overlay ────────────────────────────────────────────────
  const allWorkOrders = useWorkOrderStore(s => s.workOrders);
  const woMapPoints = useMemo(() => {
    const WO_COLOR: Record<string, string> = {
      critical: '#ef4444',
      warning:  '#f59e0b',
      routine:  '#94a3b8',
    };
    // Group by asset_id — keep highest-priority WO per asset for the marker
    const byAsset = new Map<string, typeof allWorkOrders[0]>();
    for (const wo of allWorkOrders) {
      const existing = byAsset.get(wo.asset_id);
      const rank = (p: string) => p === 'critical' ? 2 : p === 'warning' ? 1 : 0;
      if (!existing || rank(wo.priority) > rank(existing.priority)) {
        byAsset.set(wo.asset_id, wo);
      }
    }
    return lrsPoints
      .filter(p => byAsset.has(p.id))
      .map(p => {
        const wo = byAsset.get(p.id)!;
        const count = allWorkOrders.filter(w => w.asset_id === p.id).length;
        return {
          id: 'wo-' + p.id,
          name: `${count} أمر عمل — ${p.equipment_code || p.name}`,
          geometry: { coordinates: [p.longitude, p.latitude] },
          latitude: p.latitude,
          longitude: p.longitude,
          color: WO_COLOR[wo.priority] || '#94a3b8',
          radius: 11,
          category: 'work_order',
        };
      });
  }, [allWorkOrders, lrsPoints]);

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
          `margin ${formatBar(point.safety_margin_bar || 0)}`,
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
          riskLabel: localizedRiskLabel(point.risk_level),
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
        const trigger = marginStress >= pressureStress ? 'فارق HGL/MAOP ضيق' : 'HGL مرتفع نسبةً للـ MAOP';

        return {
          id: point.id,
          name: point.name,
          stationLabel: point.station_label,
          sector: point.technical.route_sector || 'Unassigned',
          score,
          etaHours,
          riskLevel: localizedRiskLabel(point.risk_level),
          trigger,
        };
      })
        .filter((signal) => signal.score >= EARLY_WARNING_THRESHOLD_V1)
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);
      }, [engineeringPoints]);

  const whatIfTitle = 'سيناريو أ: خفض HGL التصميمي (−0.35 bar) عند نقاط الفارق الضيق — محاكاة تصميمية';

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
          currentRisk: localizedRiskLabel(point.risk_level),
          projectedRisk: localizedRiskLabel(projectedRisk),
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
        riskLevel: localizedRiskLabel(point.risk_level),
        panelClass: riskTone(point.risk_level).panel,
        badgeClass: riskTone(point.risk_level).badge,
        pressureLabel: formatBar(point.hydraulic_pressure_bar || 0),
        marginLabel: formatBar(point.safety_margin_bar || 0),
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

  const pressureMix = useMemo(
    () => ({
      reserve: engineeringPoints.filter((point) => point.pressure_zone === 'reserve').length,
      nominal: engineeringPoints.filter((point) => point.pressure_zone === 'nominal').length,
      peak: engineeringPoints.filter((point) => point.pressure_zone === 'peak').length,
    }),
    [engineeringPoints]
  );

  const corridorSignalSeries = useMemo(
    () =>
      engineeringPoints.map((point) => {
        const stressIndex = clamp(
          Math.round(
            (point.risk_level === 'critical' ? 100 : point.risk_level === 'watch' ? 65 : 25) +
              Math.max(0, (1.2 - point.safety_margin_bar) * 28)
          ),
          0,
          100
        );

        return {
          ...point,
          stressIndex,
        };
      }),
    [engineeringPoints]
  );

  const corridorHotspotBands = useMemo(() => {
    if (engineeringPoints.length === 0) return [];

    const sorted = [...engineeringPoints].sort((left, right) => left.station - right.station);
    const bandCount = Math.min(8, sorted.length);
    const bandSize = Math.max(1, Math.ceil(sorted.length / bandCount));
    const bands: Array<{
      id: string;
      label: string;
      range: string;
      critical: number;
      watch: number;
      stressIndex: number;
      avgMargin: number;
    }> = [];

    for (let index = 0; index < bandCount; index += 1) {
      const from = index * bandSize;
      const to = Math.min(sorted.length, from + bandSize);
      const chunk = sorted.slice(from, to);
      if (!chunk.length) continue;

      const critical = chunk.filter((point) => point.risk_level === 'critical').length;
      const watch = chunk.filter((point) => point.risk_level === 'watch').length;
      const avgMargin = chunk.reduce((sum, point) => sum + point.safety_margin_bar, 0) / chunk.length;
      const stressIndex = clamp(Math.round(((critical + watch * 0.55) / chunk.length) * 100), 0, 100);

      bands.push({
        id: `band-${index + 1}`,
        label: `Segment ${index + 1}`,
        range: `${chunk[0].station_label} - ${chunk[chunk.length - 1].station_label}`,
        critical,
        watch,
        stressIndex,
        avgMargin: Number(avgMargin.toFixed(2)),
      });
    }

    return bands.sort((left, right) => right.stressIndex - left.stressIndex);
  }, [engineeringPoints]);

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
      setUsingDemo(false);

      // ── Auto-save to server store so data persists across refreshes ──
      try {
        await fetch('/api/maintenance/linear-assets/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assets: sanitized.assets, summary: sanitized.summary }),
        });
        const now = new Date().toLocaleString('ar-LY');
        setSavedAt(now);
      } catch {/* save silently fails, data still in memory */}

      const qualityNote =
        sanitized.summary.duplicatesRemoved > 0 ||
        sanitized.summary.invalidStationRows > 0 ||
        sanitized.summary.invalidInvertRows > 0
          ? ` | Cleaned: ${sanitized.summary.duplicatesRemoved} duplicates, ${sanitized.summary.invalidStationRows} invalid station, ${sanitized.summary.invalidInvertRows} invalid invert`
          : '';
      setSuccess(`${data.message}${qualityNote} — تم الحفظ تلقائياً ✓`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'حدث خطأ غير معروف');
    } finally {
      setIsLoading(false);
    }
  };

  
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#06121c] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.24),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(249,115,22,0.14),transparent_24%),linear-gradient(180deg,rgba(6,18,28,0.85),rgba(3,7,18,1))]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto max-w-[1760px] space-y-6 px-4 py-6 md:px-6 xl:px-8">
        
        {/* Header Section */}
        <section className="overflow-hidden rounded-[32px] border border-cyan-500/15 bg-slate-950/70 shadow-[0_40px_120px_rgba(8,47,73,0.35)] backdrop-blur-xl mb-6">
          <div className="grid gap-6 border-b border-white/5 px-6 py-6 lg:grid-cols-[1.45fr_0.8fr] xl:px-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-base font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                لوحة المراقبة الهندسية الذكية
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl font-sans text-4xl font-black leading-tight text-white md:text-6xl">
                  منصة هندسية مبسطة ومتكاملة
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 md:text-base">
                  تم تبويب البيانات لتوفير تجربة مستخدم واضحة وغير فوضوية. البروفايل والضغط والحماية الكاثودية معروضة بشكل يسهل على صانع القرار والمهندس قراءتها وفهمها مباشرة.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MiniStat label="ملاءمة تصميمية" value={`${engineeringSummary.integrityScore}%`} hint="نسبة الأصول ضمن الحدود التصميمية" tone="cyan" />
                <MiniStat label="أعلى HGL تصميمي" value={formatBar(engineeringSummary.maxPressure)} hint="أعلى ضغط هيدروليكي في الدراسة" tone="amber" />
                <MiniStat label="Backlog" value={engineeringSummary.maintenanceBacklog.toString()} hint="نقاط متابعة وصيانة" tone="rose" />
                <MiniStat label="تجاوز MAOP" value={engineeringSummary.critical.toString()} hint="نقاط HGL يتجاوز فيها حد التصميم" tone="emerald" />
              </div>
            </div>

            <div className="grid gap-4">
              <div className={`rounded-[28px] border p-5 ${engineeringSummary.critical > 0 ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/25 bg-emerald-500/10'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base uppercase tracking-[0.24em] text-slate-300">حالة المسار</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {engineeringSummary.critical > 0 ? 'يوجد تجاوز في الحدود التصميمية' : 'المسار ضمن الحدود التصميمية'}
                    </p>
                  </div>
                  <div className={`rounded-2xl p-3 ${engineeringSummary.critical > 0 ? 'bg-rose-500/15 text-rose-100' : 'bg-emerald-500/15 text-emerald-100'}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-base">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-2 text-slate-400"><Activity className="h-4 w-4" /> نقاط المراقبة</div>
                    <p className="mt-1 text-2xl font-bold text-white">{engineeringSummary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-2 text-slate-400"><ShieldCheck className="h-4 w-4" /> متوسط الفارق التصميمي (HGL/MAOP)</div>
                    <p className="mt-1 text-2xl font-bold text-white">{formatBar(engineeringSummary.averageMargin)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Tabs Navigation */}
          <div className="flex flex-wrap items-center gap-2 px-6 py-4 xl:px-8 bg-black/20">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-semibold transition-all ${activeTab === 'map' ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              <MapIcon className="h-4 w-4" />
              الخريطة والمراقبة
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-semibold transition-all ${activeTab === 'analytics' ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              <BarChart3 className="h-4 w-4" />
              التحليلات والمحاكاة
            </button>
            <button
              onClick={() => setActiveTab('linemap')}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-semibold transition-all ${activeTab === 'linemap' ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              <Activity className="h-4 w-4" />
              الخريطة الخطية
            </button>
            <button
              onClick={() => setActiveTab('maintain')}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-semibold transition-all ${activeTab === 'maintain' ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              <Wrench className="h-4 w-4" />
              إدارة الصيانة
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-semibold transition-all ${activeTab === 'reports' ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
            >
              <TableProperties className="h-4 w-4" />
              إدارة الأصول والتقارير
            </button>
          </div>
        </section>

        {/* --- TAB CONTENT: MAP --- */}
        {activeTab === 'map' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="ضمن الحدود التصميمية" value={engineeringSummary.safe.toString()} hint="HGL ضمن MAOP بهامش مريح" icon={<ShieldCheck className="h-4 w-4" />} accent="success" />
            <MetricCard label="هامش تصميمي ضيق" value={engineeringSummary.watch.toString()} hint="نقاط ذات فارق HGL/MAOP محدود" icon={<ArrowUpRight className="h-4 w-4" />} accent="warning" />
            <MetricCard label="تجاوز MAOP" value={engineeringSummary.critical.toString()} hint="HGL يتجاوز أو يساوي حد التصميم" icon={<AlertTriangle className="h-4 w-4" />} accent="danger" />
            <MetricCard label="أدنى فارق تصميمي" value={formatBar(engineeringSummary.minMargin)} hint="أدنى فارق HGL/MAOP في المسار" icon={<Gauge className="h-4 w-4" />} accent="default" />
          </div>

            
              <SectionShell
                title="الخريطة الجغرافية للمسار (Geospatial View)"
                subtitle="عرض حي لمسار النهر الصناعي والأصول على الخريطة"
                badge="GIS"
              >
                
                <div className="flex flex-wrap gap-2 mb-4 pointer-events-auto">
                  <div className="bg-slate-900/80 backdrop-blur border border-white/10 p-2 rounded-xl shadow-xl flex gap-2">
                    <button 
                       onClick={() => setEnableEdit(!enableEdit)}
                       className={`px-3 py-1.5 text-base font-semibold rounded-md transition-colors ${enableEdit ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {enableEdit ? 'إيقاف تعديل المسار' : 'تعديل المسار (LRS)'}
                    </button>
                    
                    <button 
                       onClick={() => setSnapToCurves(!snapToCurves)}
                       className={`px-3 py-1.5 text-base font-semibold rounded-md transition-colors ${snapToCurves ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {snapToCurves ? 'فصل التتبع الجغرافي' : 'تتبع تعرجات النهر'}
                    </button>
                    <button 
                       onClick={() => useGisEngine.getState().setBasemap('satellite')}

                       className="px-3 py-1.5 text-base font-semibold rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >قمر صناعي</button>
                    <button 
                       onClick={() => useGisEngine.getState().setBasemap('terrain')}
                       className="px-3 py-1.5 text-base font-semibold rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >تضاريس</button>
                    <button 
                       onClick={() => useGisEngine.getState().setBasemap('road')}
                       className="px-3 py-1.5 text-base font-semibold rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >خرائط الشوارع</button>
                  </div>
                </div>
                <div className="h-[500px] w-full mb-6 mt-4 rounded-xl border border-white/5 overflow-hidden relative isolation-auto">

                  <UnifiedOLMap 
                     zoom={6} 
                     assetPoints={[
                       ...lrsPoints.map(p => ({
                          id: p.id,
                          name: p.name,
                          geometry: { coordinates: [p.longitude, p.latitude] },
                          latitude: p.latitude,
                          longitude: p.longitude,
                          status: p.risk_level === 'critical' ? 'offline' : p.risk_level === 'watch' ? 'maintenance' : 'active'
                       })),
                       ...woMapPoints,
                     ]}
                     showAssets={true}
                     routeAnchors={routeAnchors} onRouteUpdate={setRouteAnchors} enableEdit={enableEdit} trueCoords={(snapToCurves && trueCoords.length > 0) ? trueCoords : undefined}
                  />
                </div>
              </SectionShell>

            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
              <SectionShell
                title="الخريطة الخطية الديناميكية للمسار"
                subtitle="مشهد واسع غير فوضوي يعرض مقطع المسار مع التنبيهات المباشرة دون إزعاج بصري"
                badge="المسار الخطي"
              >
                <div className="h-[650px] flex flex-col">
                  <VerticalTimelineView
                    assets={assets}
                    selectedAssetId={selectedAssetId}
                    onAssetClick={setSelectedAssetId}
                  />
                </div>
                <div className="mt-8 border-t border-white/5 pt-6">
                  <div className="flex items-center justify-between pb-4">
                    <p className="text-base font-semibold uppercase tracking-[0.18em] text-slate-300">التوزيع الزمني للنقاط الحرجة (Stress Timeline)</p>
                  </div>
                  <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={corridorSignalSeries} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="station_label" stroke="rgba(255,255,255,0.3)" fontSize={13} tickMargin={8} minTickGap={30} />
                        <YAxis yAxisId="left" stroke="rgba(255,255,255,0.2)" fontSize={13} tickFormatter={(val) => `${val}%`} domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.2)" fontSize={13} hide />
                        <Tooltip content={<EngineeringTooltip />} offset={12} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                        <Bar yAxisId="left" dataKey="stressIndex" name="مؤشر الإجهاد (%)" fill="rgba(249, 115, 22, 0.4)" barSize={4} radius={[2, 2, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="safety_margin_bar" name="هامش الأمان (bar)" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="hydraulic_pressure_bar" name="الضغط الفعلي (bar)" stroke="#06b6d4" strokeWidth={3} dot={false} isAnimationActive={false} />
                        <ReferenceLine yAxisId="left" y={75} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.5} />
                        <Brush dataKey="station_label" height={24} stroke="#0ea5e9" fill="rgba(8,18,28,0.5)" tickFormatter={() => ''} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-orange-500/50" /> الأعمدة البرتقالية = مؤشر الإجهاد (0-100%) · فوق الخط الأحمر المنقط = خطر عالٍ</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-emerald-400" /> هامش الأمان</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-cyan-400" /> الضغط الفعلي</span>
                    <span className="text-slate-500">اسحب المقبض في الأسفل لتكبير منطقة معينة</span>
                  </div>
                </div>
              </SectionShell>

              <div className="grid gap-4 grid-rows-[auto_1fr]">
                <SectionShell
                  title="نطاقات الإجهاد الحرجة"
                  subtitle="أكثر المقاطع إجهاداً على المسار مرتبة لسهولة القراءة"
                >
                  <div className="space-y-3">
                    {corridorHotspotBands.slice(0, 4).map((band) => (
                      <div key={band.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/50 p-4 transition-colors hover:bg-slate-800/60">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${band.stressIndex > 75 ? 'bg-rose-500' : band.stressIndex > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <p className="font-semibold text-white">{band.range}</p>
                          </div>
                          <p className="mt-1 text-base text-slate-400">Critical: {band.critical} | Watch: {band.watch} | Avg Margin: {band.avgMargin}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${band.stressIndex > 75 ? 'text-rose-400' : band.stressIndex > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {band.stressIndex}%
                          </p>
                          <p className="text-[13px] uppercase text-slate-500">Stress</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionShell>
                
                <SectionShell
                  title="لوحة المراقبة السريعة"
                  subtitle="أبرز التنبيهات المباشرة التي تستدعي اتخاذ قرار اليوم"
                >
                  <EngineeringWatchlistPanel
                    items={watchlistItems}
                    onIdentify={(id) => {
                      setSelectedAssetId(id);
                      const el = document.getElementById(`asset-${id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                </SectionShell>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: ANALYTICS --- */}
        {activeTab === 'analytics' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── DESIGN DATA NOTICE BANNER ─────────────────────────────── */}
            <div className="flex items-start gap-3 rounded-2xl border border-blue-500/25 bg-blue-500/8 px-5 py-3.5 text-base">
              <span className="mt-0.5 text-blue-400 text-base">&#x1F4D0;</span>
              <div>
                <p className="font-semibold text-blue-300">تنبيه: بيانات تصميمية</p>
                <p className="text-slate-400 text-base mt-0.5 leading-relaxed">القيم الهيدروليكية المعروضة تمثّل <strong className="text-slate-300">منسوب خط التدرج الهيدروليكي التصميمي (HGL)</strong> مستخرجةً من الدراسة الهيدروليكية، والحدود تمثّل <strong className="text-slate-300">درجة الأنبوب التصميمية (MAOP)</strong> من مواصفات المشروع — وليست قراءات تشغيلية مباشرة. المقارنات المعروضة هي فحوصات ملاءمة تصميمية.</p>
              </div>
            </div>

            {/* ── DATA INTELLIGENCE SECTION ─────────────────────────────── */}
            <div className="space-y-6 px-6 xl:px-0">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/40 to-transparent" />
                  <span className="text-base font-bold uppercase tracking-widest text-cyan-400">
                    {usingDemo
                      ? `ذكاء البيانات — ${assets.length} أصل (بيانات تجريبية)`
                      : `ذكاء البيانات الحقيقية — ${assets.length} أصل مرفوع`}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-cyan-500/40 to-transparent" />
                </div>

                {/* Sector Cards */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {Object.entries(dataIntelligence.sectorMap)
                    .sort((a, b) => a[1].minSt - b[1].minSt)
                    .map(([sector, info]) => {
                      const elDiff = info.maxEl - info.minEl;
                      const isPumpStation = sector.startsWith('P/S') || sector.startsWith('FCS');
                      const sInfo = SECTOR_INFO[sector];
                      const borderColor = isPumpStation ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/8 bg-slate-900/50';
                      const labelColor = isPumpStation ? 'text-amber-400' : 'text-cyan-400';
                      const typeIcon = isPumpStation ? '⚡' : '🔵';
                      return (
                        <div key={sector} className={`rounded-xl border p-4 flex flex-col gap-2 ${borderColor}`}>
                          {/* Header */}
                          <div className="flex items-start justify-between gap-1">
                            <p className={`text-[13px] font-bold uppercase tracking-wider ${labelColor}`}>{sector}</p>
                            <span className="text-base leading-none">{typeIcon}</span>
                          </div>
                          {/* Arabic name */}
                          {sInfo && (
                            <p className="text-[13px] font-semibold text-white leading-tight">{sInfo.ar}</p>
                          )}
                          {/* Asset count + km */}
                          <div className="flex items-end gap-2">
                            <p className="text-2xl font-black text-white leading-none">{info.count}</p>
                            <p className="text-[13px] text-slate-400 pb-0.5">أصل · {Math.round((info.maxSt - info.minSt) / 1000)} كم</p>
                          </div>
                          {/* Description */}
                          {sInfo && (
                            <p className="text-[13px] text-slate-500 leading-relaxed border-t border-white/5 pt-2">{sInfo.desc}</p>
                          )}
                          {/* Asset type tags with full Arabic labels */}
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(info.types).map(([t, n]) => {
                              const tInfo = ASSET_TYPE_LABELS[t];
                              return (
                                <span key={t} title={tInfo?.ar ?? t} className="text-[14px] bg-white/5 px-1.5 py-0.5 rounded text-slate-300 cursor-default">
                                  {t}:{n}
                                  {tInfo && <span className="text-slate-500 mr-0.5"> ({tInfo.ar})</span>}
                                </span>
                              );
                            })}
                          </div>
                          {/* Elevation */}
                          <div className="text-[14px] text-slate-500">
                            ارتفاع: {info.minEl.toFixed(0)}–{info.maxEl.toFixed(0)} م
                            {elDiff > 50 && <span className="text-amber-400 mr-1"> (فرق ↕ {elDiff.toFixed(0)}م)</span>}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Elevation Profile + SAV Thickness Row */}
                <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                  <SectionShell title="المنحنى الحقيقي للتضاريس (Invert Level Profile)" subtitle="منسوب القاع الفعلي لمسار الأنبوب من محطة الضخ حتى طرابلس — الانحدار يحدد مناطق الضغط العالي والانخفاض">
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dataIntelligence.elevationProfile} margin={{ top: 8, right: 8, bottom: 8, left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                          <XAxis dataKey="station_label" stroke="transparent" tick={false} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={13} tickFormatter={(v) => `${v}م`} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, pointerEvents: 'none' }} formatter={(v: number) => [`${v.toFixed(1)} م`, 'المنسوب']} labelFormatter={(l) => `الموقع: ${l}`} />
                          <defs>
                            <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="elevation" stroke="#0ea5e9" fill="url(#elevGrad)" strokeWidth={3} dot={false} isAnimationActive={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[13px] text-slate-500 mt-2">المنسوب الأقصى: {Math.max(...dataIntelligence.elevationProfile.map(p => p.elevation)).toFixed(1)} م · الأدنى: {Math.min(...dataIntelligence.elevationProfile.map(p => p.elevation)).toFixed(1)} م · فرق الارتفاع: {(Math.max(...dataIntelligence.elevationProfile.map(p => p.elevation)) - Math.min(...dataIntelligence.elevationProfile.map(p => p.elevation))).toFixed(0)} م</p>
                  </SectionShell>

                  <SectionShell title="توزيع درجة الضغط التصميمية (PN) للصمامات الهوائية" subtitle="مواصفات PN لجميع صمامات SAV — الرقم الثاني في كود DN×PN هو درجة الضغط التصميمي بالبار">
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={Object.entries(dataIntelligence.thicknessMap).sort((a,b)=>+a[0]-+b[0]).map(([t,n]) => ({ pnClass: `PN${t}`, count: n, pn: +t }))} margin={{ top: 8, right: 8, bottom: 8, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                          <XAxis dataKey="pnClass" stroke="rgba(255,255,255,0.3)" fontSize={13} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={13} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, pointerEvents: 'none' }} formatter={(v: number) => [v, 'عدد الصمامات']} />
                          <Bar dataKey="count" name="عدد الصمامات" radius={[4, 4, 0, 0]}>
                            {Object.entries(dataIntelligence.thicknessMap).sort((a,b)=>+a[0]-+b[0]).map(([t], i) => (
                              <Cell key={i} fill={+t < 8 ? '#38bdf8' : +t < 10 ? '#f59e0b' : '#10b981'} />
                            ))}
                          </Bar>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex gap-4 mt-2 text-[13px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> PN6 — أساسي (6 bar)</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> PN8 — متوسط (8 bar)</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> PN≥10 — عالي (≥10 bar)</span>
                    </div>
                  </SectionShell>
                </div>

                {/* Equipment Distribution + SAV Gap Analysis */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <SectionShell title="توزيع أنواع الأصول" subtitle="نظرة عامة على تكوين الشبكة ونسبة كل نوع من المعدات">
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      {Object.entries(dataIntelligence.typeMap).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
                        const colors: Record<string,string> = { SAV: 'from-sky-500/20 border-sky-500/30 text-sky-400', MH: 'from-slate-500/20 border-slate-500/30 text-slate-400', PU: 'from-indigo-500/20 border-indigo-500/30 text-indigo-400', WT: 'from-teal-500/20 border-teal-500/30 text-teal-400', DAV: 'from-purple-500/20 border-purple-500/30 text-purple-400', PUWE: 'from-orange-500/20 border-orange-500/30 text-orange-400' };
                        const labels: Record<string,string> = { SAV: 'صمام هواء', MH: 'بوابة تفتيش', PU: 'محطة ضخ', WT: 'خزان مياه', DAV: 'صمام مزدوج', PUWE: 'معدات ضخ', TJE: 'وصلة تمدد' };
                        const pct = ((count / assets.length) * 100).toFixed(1);
                        return (
                          <div key={type} className={`rounded-xl border bg-gradient-to-b p-4 ${colors[type] || 'from-slate-500/20 border-slate-500/30 text-slate-400'}`}>
                            <p className="text-base font-bold mb-1">{type}</p>
                            <p className="text-2xl font-black text-white">{count}</p>
                            <p className="text-[13px] opacity-70 mt-0.5">{labels[type] || type}</p>
                            <p className="text-[13px] mt-1 font-mono">{pct}%</p>
                          </div>
                        );
                      })}
                    </div>
                  </SectionShell>

                  <SectionShell title="تحليل تباعد صمامات الهواء (SAV)" subtitle={`متوسط المسافة بين الصمامات: ${(dataIntelligence.avgGap / 1000).toFixed(2)} كم · أكبر فجوة: ${(dataIntelligence.maxGap.gap_m / 1000).toFixed(2)} كم عند ${dataIntelligence.maxGap.station_label}`}>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dataIntelligence.savGaps.filter((_,i) => i % 5 === 0)} margin={{ top: 8, right: 8, bottom: 8, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                          <XAxis dataKey="station_label" stroke="transparent" tick={false} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={13} tickFormatter={(v) => `${(v/1000).toFixed(1)}كم`} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, pointerEvents: 'none' }} formatter={(v: number) => [`${(v/1000).toFixed(2)} كم`, 'المسافة']} />
                          <ReferenceLine y={dataIntelligence.avgGap} stroke="#f59e0b" strokeDasharray="4 4" opacity={0.6} />
                          <Bar dataKey="gap_m" name="المسافة بين صمامين" radius={[2,2,0,0]}>
                            {dataIntelligence.savGaps.filter((_,i) => i % 5 === 0).map((g, i) => (
                              <Cell key={i} fill={g.gap_m > dataIntelligence.avgGap * 2 ? '#f43f5e' : g.gap_m > dataIntelligence.avgGap * 1.5 ? '#f59e0b' : '#0ea5e9'} />
                            ))}
                          </Bar>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[13px] text-slate-500 mt-2">الأعمدة الحمراء = فجوة أكبر من ضعف المتوسط (خطر تجمع الهواء) · الأصفر = تحذير · الأزرق = طبيعي</p>
                  </SectionShell>
                </div>
              </div>

            {/* Separator */}
            <div className="border-t border-white/5 mx-6 xl:mx-0" />
            <div className="flex items-center justify-between px-6 xl:px-0">
              <div>
                <h3 className="text-xl font-bold text-white">تحليل مقاطع التصميم الهيدروليكي</h3>
                <p className="text-base text-slate-400">دراسة منسوب خط التدرج الهيدروليكي (HGL) مقارنةً بدرجة الأنبوب (MAOP) على طول المسار — البيانات من الدراسة الهيدروليكية التصميمية، وليست قراءات تشغيلية مباشرة</p>
              </div>
              <button
                onClick={() => setSimModalOpen(true)}
                className="flex items-center gap-2 rounded-full bg-cyan-500/10 px-6 py-2.5 text-base font-bold text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <span className="text-lg leading-none">+</span> إضافة محاكاة جديدة
              </button>
            </div>

            {/* Active simulation badge */}
            {(activeSimParams.scenario !== 'normal' || activeSimParams.flowRate !== 1200 || activeSimParams.pumpHead !== 450) && (
              <div className="mx-6 xl:mx-0 flex items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/8 px-4 py-2.5 text-base">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
                <span className="text-cyan-300 font-semibold">سيناريو نشط:</span>
                <span className="text-slate-300">
                  {activeSimParams.scenario === 'emergency' ? 'طارئ / ذروة' : activeSimParams.scenario === 'low' ? 'ضغط منخفض' : 'تشغيل عادي'}
                  {' · '}تدفق {activeSimParams.flowRate.toLocaleString()} م³/س
                  {' · '}ضغط ضخ {activeSimParams.pumpHead} م
                </span>
                <button
                  onClick={() => setActiveSimParams({ flowRate: 1200, pumpHead: 450, scenario: 'normal' })}
                  className="mr-auto text-base text-slate-500 hover:text-rose-400 transition-colors">
                  × إعادة تعيين
                </button>
              </div>
            )}

            <div className="grid gap-6 px-6 grid-cols-1 xl:px-0">
              <SectionShell
                title="مصفوفة مقاطع التصميم الهيدروليكي"
                subtitle="الخط الأزرق = ضغط HGL التصميمي · الأخضر = الفارق التصميمي للأمان · الرمادي الداكن = الحد الأقصى للأنبوب (MAOP) — كلما اقترب الأزرق من الرمادي كان الفارق التصميمي أضيق (يمكنك التمرير والتكبير من الشريط السفلي)"
              >
                <div className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={engineeringPoints} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
                      <defs>
                        <linearGradient id="engCyanGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="engGreenGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="station_label" stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 13 }} height={22} interval="preserveStartEnd" minTickGap={50} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 13 }} tickFormatter={(v) => `${v.toFixed(1)} bar`} width={56} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                      <Tooltip content={<EngineeringTooltip />} offset={12} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Brush dataKey="station_label" height={24} stroke="#334155" fill="rgba(8,18,28,0.5)" tickFormatter={() => ''} />
                      <Area type="step" dataKey="pipe_bar_grade_bar" name="MAOP التصميمي (bar)" stroke="rgba(148,163,184,0.35)" fill="rgba(30,41,59,0.5)" strokeWidth={3} strokeDasharray="6 3" isAnimationActive={false} />
                      <Area type="monotoneX" dataKey="hydraulic_pressure_bar" name="ضغط HGL التصميمي (bar)" stroke="#06b6d4" fill="url(#engCyanGrad)" strokeWidth={3.5} isAnimationActive={false} />
                      <Area type="monotoneX" dataKey="safety_margin_bar" name="الفارق التصميمي (bar)" stroke="#10b981" fill="url(#engGreenGrad)" strokeWidth={3} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex justify-center gap-8">
                    <LegendItem color="#06b6d4" label="HGL التصميمي" area />
                    <LegendItem color="#10b981" label="الفارق التصميمي" area />
                    <LegendItem color="#94a3b8" label="MAOP التصميمي" dash />
                  </div>
                </div>
              </SectionShell>

              <SectionShell
                title="ضغط HGL ومنسوب الأنبوب تحت الأرض"
                subtitle="الخط البرتقالي = ضغط HGL التصميمي · الخط البنفسجي = منسوب الأنبوب نسبة لسطح البحر (Invert Level) — يعكس التغيرات الجغرافية لمسار الخط (يمكنك التمرير والتكبير من الشريط السفلي)"
              >
                <div className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={engineeringPoints} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
                      <defs>
                        <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="station_label" stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 13 }} height={22} interval="preserveStartEnd" minTickGap={50} tickLine={false} />
                      <YAxis yAxisId="left" stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 13 }} tickFormatter={(v) => `${v.toFixed(1)} bar`} width={56} />
                      <YAxis yAxisId="right" orientation="right" stroke="rgba(99,102,241,0.3)" tick={{ fill: 'rgba(99,102,241,0.7)', fontSize: 13 }} tickFormatter={(v) => `${v.toFixed(1)}m`} width={44} />
                      <Tooltip content={<EngineeringTooltip />} offset={12} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Brush dataKey="station_label" height={24} stroke="#334155" fill="rgba(8,18,28,0.5)" tickFormatter={() => ''} />
                      <Area yAxisId="left" type="monotoneX" dataKey="hydraulic_pressure_bar" name="الضغط (bar)" stroke="#f59e0b" fill="url(#amberGradient)" strokeWidth={3.5} isAnimationActive={false} />
                      <Line yAxisId="right" type="monotoneX" dataKey="invert_level" name="المنسوب (m)" stroke="#6366f1" strokeWidth={3} dot={false} opacity={0.85} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex justify-center gap-8">
                    <LegendItem color="#f59e0b" label="ضغط HGL (bar)" area />
                    <LegendItem color="#6366f1" label="الارتفاع (m)" />
                  </div>
                </div>
              </SectionShell>

              <SectionShell
                title="مغلف الضغط التصميمي (Design Pressure Envelope)"
                subtitle="الخط الوردي = ضغط HGL التصميمي · الخط الرمادي = الحد الأقصى للأنبوب (MAOP) · الأخضر = الفارق التصميمي — انقر على نقطة لعرض الأصل (يمكنك التمرير والتكبير من الشريط السفلي)"
                className="col-span-full"
              >
                <div className="h-[480px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={engineeringPoints}
                      margin={{ top: 16, right: 24, bottom: 16, left: 4 }}
                      onClick={(d) => {
                        const pt = d?.activePayload?.[0]?.payload;
                        if (pt?.id) { setSelectedAssetId(pt.id); setActiveTab('linemap'); }
                      }}
                      style={{ cursor: 'crosshair' }}
                    >
                      <defs>
                        <linearGradient id="envPinkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="envGreenGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis dataKey="station_label" stroke="rgba(255,255,255,0.12)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 13 }} tickMargin={8} minTickGap={40} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 13 }} tickFormatter={(v) => `${v.toFixed(1)} bar`} width={60} />
                      <Tooltip content={<EngineeringTooltip />} offset={16} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Brush dataKey="station_label" height={24} stroke="#334155" fill="rgba(8,18,28,0.5)" tickFormatter={() => ''} />
                      <Area type="step" dataKey="pipe_bar_grade_bar" name="MAOP التصميمي (bar)" stroke="rgba(148,163,184,0.5)" fill="rgba(30,41,59,0.3)" strokeWidth={3} strokeDasharray="7 3" isAnimationActive={false} />
                      <Area type="monotoneX" dataKey="safety_margin_bar" name="الفارق التصميمي (bar)" stroke="#10b981" fill="url(#envGreenGrad)" strokeWidth={3} isAnimationActive={false} />
                      <Line type="monotoneX" dataKey="hydraulic_pressure_bar" name="ضغط HGL (bar)" stroke="#ec4899" strokeWidth={3} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex justify-center gap-10 text-base">
                    <LegendItem color="#ec4899" label="ضغط HGL" />
                    <LegendItem color="#94a3b8" label="MAOP التصميمي (الحد الأقصى)" dash />
                    <LegendItem color="#10b981" label="الفارق التصميمي" area />
                  </div>
                </div>
              </SectionShell>
            </div>

            <div className="grid gap-6 px-6 md:grid-cols-[1fr_2fr] xl:px-0">
              <SectionShell
                title="تركيب وتوزيع المخاطر"
                subtitle="نظرة مركزة على نسب الأمان والمراقبة والخطورة في الخط بالكامل"
              >
                <div className="flex h-[320px] flex-col items-center justify-center pt-4">
                  <div className="h-48 w-full max-w-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'ضمن الحدود', value: engineeringSummary.safe, color: '#10b981' },
                            { name: 'هامش ضيق', value: engineeringSummary.watch, color: '#f59e0b' },
                            { name: 'تجاوز MAOP', value: engineeringSummary.critical, color: '#f43f5e' },
                          ]}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none"
                        >
                          {([
                            { name: 'ضمن الحدود', value: engineeringSummary.safe, color: '#10b981' },
                            { name: 'هامش ضيق', value: engineeringSummary.watch, color: '#f59e0b' },
                            { name: 'تجاوز MAOP', value: engineeringSummary.critical, color: '#f43f5e' },
                          ]).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number, name: string) => [`${v} نقطة`, name]} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 14, pointerEvents: 'none' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-2xl font-bold text-white">{Math.round((engineeringSummary.safe / engineeringSummary.total) * 100)}%</p>
                    <p className="text-[13px] uppercase tracking-wider text-slate-400">معدل الملاءمة التصميمية</p>
                  </div>
                  <div className="mt-4 flex items-center gap-6 text-base font-medium">
                    <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> <span className="text-white">ضمن الحدود {engineeringSummary.safe}</span></div>
                    <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-amber-500" /> <span className="text-white">هامش ضيق {engineeringSummary.watch}</span></div>
                    <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full bg-rose-500" /> <span className="text-white">تجاوز MAOP {engineeringSummary.critical}</span></div>
                  </div>
                </div>
              </SectionShell>

              <SectionShell
                title="توزيع سلوك الضغط (Pressure Mix)"
                subtitle="كيف يتوزع الضغط التشغيلي عبر المسار ومقارنته بالهوامش الآمنة"
              >
                <PressureMixPanel points={engineeringPoints} />
              </SectionShell>
            </div>

            {/* ── Simulation Modal ── */}
            <SimModal
              open={simModalOpen}
              params={simParams}
              onClose={() => setSimModalOpen(false)}
              onApply={(p) => { setSimParams(p); setActiveSimParams(p); }}
            />
          </div>
        )}

        {/* --- TAB CONTENT: LINEAR SCHEMATIC MAP --- */}
        {activeTab === 'linemap' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="overflow-hidden rounded-[28px] border border-cyan-500/15 bg-slate-950/70 shadow-[0_20px_60px_rgba(8,47,73,0.25)] backdrop-blur-xl">
              <div className="border-b border-white/5 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">الخريطة الخطية للأصول (Linear Asset Schematic)</h3>
                    <p className="mt-1 text-base text-slate-400">
                      عرض شماتيكي تفاعلي لجميع الأصول على طول مسار الأنبوب — المثلثات = صمامات هواء (SAV/DAV) · الدوائر = بوابات التفتيش (MH) · الرموز الكبيرة = محطات الضخ والخزانات
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 text-right">
                    <span className="text-base text-slate-500">إجمالي المسار</span>
                    <span className="text-lg font-black text-cyan-400 font-mono">
                      {assets.length > 0
                        ? `${((Math.max(...assets.map(a => a.station)) - Math.min(...assets.map(a => a.station))) / 1000).toFixed(0)} كم`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {assets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                    <Activity className="h-8 w-8 opacity-30" />
                    <p className="text-base">لا توجد بيانات — يرجى رفع ملف الأصول أولاً من تبويب التقارير</p>
                  </div>
                ) : (
                  <>
                    {/* Smart Alerts Panel */}
                    {assets.length > 0 && (
                      <SmartAlertsPanel
                        assets={assets}
                        onAssetSelect={setSelectedAssetId}
                        selectedId={selectedAssetId}
                      />
                    )}
                    <LinearSchematicMap
                      assets={assets}
                      selectedAssetId={selectedAssetId}
                      onAssetClick={setSelectedAssetId}
                    />
                  </>
                )}
              </div>
            </section>

            {/* Selected asset — Digital Twin */}
            {selectedAssetId && (() => {
              const a = assets.find(x => x.id === selectedAssetId);
              if (!a) return null;
              return (
                <AssetDigitalTwin
                  asset={a}
                  allAssets={assets}
                  onClose={() => setSelectedAssetId(null)}
                />
              );
            })()}
          </div>
        )}

        {/* --- TAB CONTENT: MAINTENANCE MANAGEMENT --- */}
        {activeTab === 'maintain' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="overflow-hidden rounded-[28px] border border-white/8 bg-slate-950/70 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="border-b border-white/5 px-6 py-5">
                <h3 className="text-xl font-bold text-white">إدارة الصيانة الذكية</h3>
                <p className="mt-1 text-base text-slate-400">
                  تحليل متكامل للأصول: مواقع التجمّع الميداني · تقرير الإحلال · جدول الصيانة السنوي · مقارنة القطاعات
                </p>
              </div>
              <div className="p-6">
                {assets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                    <Wrench className="h-8 w-8 opacity-30" />
                    <p className="text-base">لا توجد بيانات — يرجى رفع ملف الأصول أولاً من تبويب التقارير</p>
                  </div>
                ) : (
                  <MaintainTabs assets={assets} onAssetSelect={setSelectedAssetId} />
                )}
              </div>
            </section>

            {/* Selected asset — Digital Twin */}
            {selectedAssetId && (() => {
              const a = assets.find(x => x.id === selectedAssetId);
              if (!a) return null;
              return (
                <AssetDigitalTwin
                  asset={a}
                  allAssets={assets}
                  onClose={() => setSelectedAssetId(null)}
                />
              );
            })()}
          </div>
        )}

        {/* --- TAB CONTENT: REPORTS & ASSETS --- */}
        {activeTab === 'reports' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── Report Header ───────────────────────────────────────── */}
            <section className="overflow-hidden rounded-[28px] border border-white/8 bg-slate-950/70 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="border-b border-white/5 px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TableProperties className="h-5 w-5 text-cyan-400" />
                    <h3 className="text-xl font-bold text-white">تقرير إدارة الأصول</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${usingDemo ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'}`}>
                      {usingDemo ? 'بيانات تجريبية' : 'بيانات حقيقية'}
                    </span>
                  </div>
                  <p className="text-base text-slate-400">
                    {assets.length} أصل · {Object.keys(dataIntelligence.sectorMap).length} قطاع · آخر تحديث: {savedAt || 'جلسة حالية'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const headers = ['id', 'equipment_code', 'name', 'station', 'invert_level', 'sector', 'diameter'];
                    const rows = assets.map(a => [
                      a.id, a.equipment_code, a.name,
                      a.station, a.invert_level,
                      a.technical?.route_sector || '',
                      a.technical?.diameter || '',
                    ]);
                    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
                    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                    const link = document.createElement('a'); link.href = url;
                    link.download = `assets-report-${new Date().toISOString().slice(0,10)}.csv`;
                    link.click(); URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-5 py-2 text-base font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  <FileText className="h-4 w-4" />
                  تصدير CSV
                </button>
              </div>

              {/* ── 4 KPI Cards ── */}
              <div className="grid grid-cols-2 gap-px lg:grid-cols-4 bg-white/5">
                {[
                  { label: 'إجمالي الأصول', value: assets.length.toLocaleString(), hint: `على ${((Math.max(...assets.map(a=>a.station)) - Math.min(...assets.map(a=>a.station)))/1000).toFixed(0)} كم`, color: 'text-cyan-400', bg: 'bg-slate-900/80' },
                  { label: 'تجاوز MAOP', value: engineeringSummary.critical.toLocaleString(), hint: `${Math.round(engineeringSummary.critical/engineeringSummary.total*100)}% من المقاطع`, color: 'text-rose-400', bg: 'bg-slate-900/80' },
                  { label: 'هامش تصميمي ضيق', value: engineeringSummary.watch.toLocaleString(), hint: `${Math.round(engineeringSummary.watch/engineeringSummary.total*100)}% من المقاطع`, color: 'text-amber-400', bg: 'bg-slate-900/80' },
                  { label: 'ملاءمة تصميمية', value: `${engineeringSummary.integrityScore}%`, hint: `أدنى فارق: ${engineeringSummary.minMargin.toFixed(2)} bar`, color: engineeringSummary.integrityScore >= 70 ? 'text-emerald-400' : 'text-rose-400', bg: 'bg-slate-900/80' },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} px-6 py-5`}>
                    <p className="text-[13px] font-semibold uppercase tracking-widest text-slate-500">{k.label}</p>
                    <p className={`text-3xl font-black mt-1 ${k.color}`}>{k.value}</p>
                    <p className="text-[13px] text-slate-500 mt-1">{k.hint}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── 1. Early Warnings — most urgent first ────────────────── */}
            <SectionShell
              title="📋 نقاط المراجعة التصميمية — الهامش الأدنى"
              subtitle="نقاط يكون فيها فارق HGL/MAOP ضيقاً — تستوجب مراجعة في التصميم أو صيانة استباقية — مستخرجة من بيانات الدراسة الهيدروليكية"
            >
              <EarlyWarningPanel signals={earlyWarningSignals} onIdentify={(id) => {
                setSelectedAssetId(id);
                setActiveTab('linemap');
              }} />
            </SectionShell>

            {/* ── 2. Sector Stress ──────────────────────────────────────── */}
            <SectionShell
              title="📊 تحليل إجهاد القطاعات"
              subtitle="توزيع النقاط الحرجة والمراقبة والهامش الأدنى لكل قطاع"
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={sectorData} margin={{ top: 8, right: 10, left: -20, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="sector" stroke="rgba(255,255,255,0.3)" fontSize={13} tickMargin={8} />
                      <YAxis yAxisId="left" stroke="rgba(255,255,255,0.2)" fontSize={13} />
                      <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.2)" fontSize={13} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 14, pointerEvents: 'none' }} />
                      <Bar yAxisId="left" dataKey="critical" fill="#f43f5e" barSize={14} radius={[4, 4, 0, 0]} name="تجاوز MAOP" />
                      <Bar yAxisId="left" dataKey="watch" fill="#0ea5e9" barSize={14} radius={[4, 4, 0, 0]} name="هامش ضيق" />
                      <Line yAxisId="right" type="monotone" dataKey="minMargin" stroke="#f59e0b" strokeWidth={3} name="الفارق الأدنى" dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {/* Top 3 stressed sectors — vertical pill list */}
                <div className="flex lg:flex-col gap-2 flex-wrap lg:flex-nowrap lg:min-w-[200px]">
                  {topStressedSectors.map((s, i) => (
                    <div key={s.sector} className="flex items-center gap-2 rounded-lg bg-white/4 border border-white/6 px-3 py-2 lg:min-w-[180px]">
                      <span className={`text-base font-black w-4 shrink-0 ${i === 0 ? 'text-rose-400' : i === 1 ? 'text-amber-400' : 'text-slate-400'}`}>{i+1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-white truncate">{s.sector}</p>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                          <span className="text-rose-400">{s.critical} حرج</span>
                          {' · '}
                          <span className="text-amber-400">{s.watch} مراقبة</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionShell>

            {/* ── 3. Maintenance Narrative ──────────────────────────────── */}
            <SectionShell
              title="📋 السرد الهندسي — تقرير الحالة"
              subtitle="ملخص تحليلي مبني على بيانات الشبكة الحالية"
            >
              <MaintenanceFeedPanel
                priorityCandidates={priorityCandidates}
                dqPenalty={priorityDqPenalty}
                earlyWarningSignals={earlyWarningSignals}
                whatIfTitle={whatIfTitle}
                whatIfImpacts={whatIfImpacts}
                sensitivityCurve={sensitivityCurve}
                modelVersion="priority-v1.0"
                priorityAbComparison={priorityAbComparison}
                topStressedSectors={topStressedSectors}
                maintenanceFeed={maintenanceFeedItems}
              />
            </SectionShell>

            {/* ── 4. Asset Intelligence Table — collapsible ─────────────── */}
            <CollapsibleSection
              title="🗂️ سجل الأصول الكامل"
              subtitle={`${assets.length} أصل — انقر على صف لفتح التوأم الرقمي`}
              badge={`${assets.length} أصل`}
            >
              <AssetManagementTable
                assets={assets}
                selectedId={selectedAssetId}
                onRowClick={(c) => {
                  setSelectedAssetId(c.id);
                  setActiveTab('linemap');
                }}
              />
            </CollapsibleSection>

            {/* ── 4. Upload Zone — collapsible at bottom ───────────────── */}
            <UploadCollapsible
              usingDemo={usingDemo}
              assets={assets}
              savedAt={savedAt}
              isLoading={isLoading}
              error={error}
              success={success}
              rejectedRows={rejectedRows}
              qualitySummary={qualitySummary}
              onFileSelect={handleFileSelect}
              onReset={async () => {
                await fetch('/api/maintenance/linear-assets/saved', { method: 'DELETE' });
                setAssets(DEMO_ASSETS);
                setQualitySummary(sanitizeUploadedAssets(DEMO_ASSETS).summary);
                setUsingDemo(true);
                setSavedAt(null);
              }}
            />
          </div>
        )}

      </div>
    </div>
  );

}

// ── Generic collapsible section ───────────────────────────────────────────
function CollapsibleSection({ title, subtitle, badge, defaultOpen = false, children }: {
  title: string; subtitle?: string; badge?: string;
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/60 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base font-semibold text-white truncate">{title}</span>
          {badge && <span className="rounded-full bg-white/8 border border-white/10 px-2 py-0.5 text-[13px] font-semibold text-slate-400 shrink-0">{badge}</span>}
          {subtitle && <span className="text-base text-slate-500 hidden md:block truncate">{subtitle}</span>}
        </div>
        <span className={`text-slate-400 text-base shrink-0 transition-transform duration-200 ml-3 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="border-t border-white/5 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Collapsible Upload Zone ────────────────────────────────────────────────
function UploadCollapsible({
  usingDemo, assets, savedAt, isLoading, error, success,
  rejectedRows, qualitySummary, onFileSelect, onReset,
}: {
  usingDemo: boolean; assets: LinearAsset[]; savedAt: string | null;
  isLoading: boolean; error: string | null; success: string | null;
  rejectedRows: RejectedRow[]; qualitySummary: DataQualitySummary;
  onFileSelect: (f: File) => void; onReset: () => void;
}) {
  const [open, setOpen] = React.useState(usingDemo);
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-slate-300">📂 رفع بيانات جديدة / إدارة المصدر</span>
          <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${usingDemo ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
            {usingDemo ? 'تجريبي' : `${assets.length} أصل محفوظ`}
          </span>
        </div>
        <span className={`text-slate-400 text-base transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-4">
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-base ${usingDemo ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${usingDemo ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
            {usingDemo ? (
              <span>تعمل على <strong>بيانات تجريبية</strong> — ارفع ملفك الحقيقي ليتم تخزينه وعرضه تلقائياً</span>
            ) : (
              <span>بيانات محفوظة <strong>({assets.length} أصل)</strong>{savedAt ? ` — آخر حفظ: ${savedAt}` : ''}</span>
            )}
            {!usingDemo && (
              <button onClick={onReset} className="mr-auto text-base text-slate-400 hover:text-rose-400 underline transition-colors">
                حذف والعودة للتجريبية
              </button>
            )}
          </div>
          <FileUploadZone onFileSelect={onFileSelect} isLoading={isLoading} error={error} success={success} />
          {rejectedRows.length > 0 && <DataQualityPanel summary={qualitySummary} rejectedRows={rejectedRows} />}
        </div>
      )}
    </div>
  );
}

function SectionShell({ title, subtitle, badge, children, className = '' }: { title: string; subtitle?: string; badge?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm ${className}`}>
      <div className="mb-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-bold text-white leading-tight">{title}</p>
          {badge && <span className="mt-0.5 flex-shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[13px] font-bold uppercase tracking-widest text-cyan-400">{badge}</span>}
        </div>
        {subtitle && <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function LegendItem({ color, label, dash, area }: { color: string; label: string; dash?: boolean; area?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="10" viewBox="0 0 22 10" className="flex-shrink-0">
        {area && <rect x="0" y="3" width="22" height="7" fill={color} fillOpacity={0.18} rx="1" />}
        {dash
          ? <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 2" />
          : <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2.5" />
        }
      </svg>
      <span className="text-[13px] font-medium text-slate-400">{label}</span>
    </div>
  );
}

function MiniStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: 'cyan' | 'amber' | 'rose' | 'emerald' }) {
  const colors = { cyan: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100', amber: 'border-amber-500/25 bg-amber-500/10 text-amber-100', rose: 'border-rose-500/25 bg-rose-500/10 text-rose-100', emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100' };
  return (
    <div className={`rounded-2xl border p-3 ${colors[tone]}`}>
      <p className="text-[13px] uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-[13px] opacity-60">{hint}</p>}
    </div>
  );
}

function MetricCard({ label, value, hint, icon, accent }: { label: string; value: string; hint?: string; icon?: React.ReactNode; accent: 'success' | 'warning' | 'danger' | 'default' }) {
  const colors = { success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100', warning: 'border-amber-500/25 bg-amber-500/10 text-amber-100', danger: 'border-rose-500/25 bg-rose-500/10 text-rose-100', default: 'border-white/10 bg-white/5 text-slate-100' };
  return (
    <div className={`rounded-2xl border p-4 ${colors[accent]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] uppercase tracking-[0.18em] opacity-70">{label}</p>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-base opacity-60">{hint}</p>}
    </div>
  );
}

function EngineeringTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  // Show only the top 3 series to keep tooltip compact
  const visible = payload.slice(0, 3);
  return (
    <div className="rounded-lg border border-white/8 bg-slate-900/90 px-2.5 py-2 text-[13px] shadow-lg backdrop-blur-sm pointer-events-none" style={{ minWidth: 140, maxWidth: 200 }}>
      {label && <p className="mb-1.5 text-[13px] font-semibold text-slate-400 truncate">{label}</p>}
      {visible.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400 truncate" style={{ maxWidth: 90 }}>{entry.name}</span>
          </div>
          <span className="font-bold text-white shrink-0">{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}
