import type { DataQualitySummary, RejectedRow } from './components/DataQualityPanel';
import type { EarlyWarningSignal } from './components/EarlyWarningPanel';
import type { EngineeringWatchlistItem } from './components/EngineeringWatchlistPanel';
import type { PriorityCandidate } from './components/PriorityEnginePanel';
import type { WhatIfImpact } from './components/WhatIfScenarioPanel';
import type { LinearAsset } from '@/lib/linear-referencing/types';
import {
  EARLY_WARNING_ETA_BASE_HOURS_V1,
  EARLY_WARNING_ETA_MIN_HOURS_V1,
  EARLY_WARNING_THRESHOLD_V1,
  EARLY_WARNING_WEIGHTS_V1,
  PRIORITY_DQ_PENALTY_MULTIPLIER_V1,
  PRIORITY_WEIGHTS_V1,
} from './demo/analysisWeights';

type EngineeringRiskLevel = 'safe' | 'watch' | 'critical';
type MaintenanceState = 'stable' | 'planned' | 'attention';

interface EngineeringAsset extends LinearAsset {
  technical: LinearAsset['technical'] & {
    hydraulic_pressure_bar?: number;
    pipe_bar_grade_bar?: number;
    maintenance_note?: string;
    cathodic_status?: string;
  };
}

export interface EngineeringPoint extends EngineeringAsset {
  station_label: string;
  hydraulic_pressure_bar: number;
  pipe_bar_grade_bar: number;
  safety_margin_bar: number;
  risk_level: EngineeringRiskLevel;
  maintenance_state: MaintenanceState;
}

interface SectorSummary {
  sector: string;
  count: number;
  critical: number;
  watch: number;
  minMargin: number;
}

const PLACEHOLDER_TOKENS = new Set(['#REF!', '#VALUE!', 'N/A', 'NA', 'NULL', '-', '']);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatBar = (value: number) => `${value.toFixed(2)} bar`;

function buildStationLabel(station: number) {
  return `C ${Math.floor(station / 1000).toString().padStart(3, '0')}+${(station % 1000)
    .toFixed(0)
    .padStart(3, '0')}`;
}

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

function classifyRisk(safetyMarginBar: number): EngineeringRiskLevel {
  if (safetyMarginBar <= 0) return 'critical';
  if (safetyMarginBar <= 0.75) return 'watch';
  return 'safe';
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

function buildSectorSummary(points: EngineeringPoint[]): SectorSummary[] {
  const grouped = points.reduce<Record<string, SectorSummary>>((accumulator, point) => {
    const sector = point.technical.route_sector || 'Unassigned';
    const current = accumulator[sector] || {
      sector,
      count: 0,
      critical: 0,
      watch: 0,
      minMargin: Number.POSITIVE_INFINITY,
    };

    current.count += 1;
    current.critical += point.risk_level === 'critical' ? 1 : 0;
    current.watch += point.risk_level === 'watch' ? 1 : 0;
    current.minMargin = Math.min(current.minMargin, point.safety_margin_bar);
    accumulator[sector] = current;
    return accumulator;
  }, {});

  return Object.values(grouped)
    .map((entry) => ({
      ...entry,
      minMargin: Number.isFinite(entry.minMargin) ? entry.minMargin : 0,
    }))
    .sort((left, right) => right.critical - left.critical || left.minMargin - right.minMargin);
}

export function getDqPenalty(qualityScore: number) {
  return Math.max(0, 100 - qualityScore) * PRIORITY_DQ_PENALTY_MULTIPLIER_V1;
}

export function sanitizeUploadedAssets(rawAssets: LinearAsset[]): {
  assets: LinearAsset[];
  qualitySummary: DataQualitySummary;
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
    const stationRaw = (asset as unknown as { station?: unknown }).station;
    const invertRaw = (asset as unknown as { invert_level?: unknown }).invert_level;
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
    qualitySummary: {
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

export function buildEngineeringPoints(assets: LinearAsset[]): EngineeringPoint[] {
  return [...assets]
    .map((asset) => {
      const engineeringAsset = asset as EngineeringAsset;
      const hydraulicPressureBar =
        engineeringAsset.technical.hydraulic_pressure_bar ??
        engineeringAsset.technical.pressure_bar ??
        Math.max(0, 8.2 - (asset.invert_level % 6) * 0.18);
      const pipeBarGradeBar =
        engineeringAsset.technical.pipe_bar_grade_bar ?? engineeringAsset.technical.pressure_bar ?? 8.0;
      const safetyMarginBar = pipeBarGradeBar - hydraulicPressureBar;
      const riskLevel = classifyRisk(safetyMarginBar);
      const maintenanceNote =
        engineeringAsset.technical.maintenance_note || engineeringAsset.technical.cathodic_status || '';

      return {
        ...engineeringAsset,
        station_label: buildStationLabel(asset.station),
        hydraulic_pressure_bar: hydraulicPressureBar,
        pipe_bar_grade_bar: pipeBarGradeBar,
        safety_margin_bar: safetyMarginBar,
        risk_level: riskLevel,
        maintenance_state: classifyMaintenanceState(maintenanceNote),
      };
    })
    .sort((left, right) => left.station - right.station);
}

export function buildPriorityCandidates(
  engineeringPoints: EngineeringPoint[],
  qualityScore: number
): PriorityCandidate[] {
  const sectorData = buildSectorSummary(engineeringPoints);
  const sectorStress = new Map(
    sectorData.map((sector) => [
      sector.sector,
      Math.min(
        1,
        (sector.critical * 0.5 + sector.watch * 0.25 + Math.max(0, 1.2 - sector.minMargin) * 0.25) /
          Math.max(1, sector.count)
      ),
    ])
  );
  const dqPenalty = getDqPenalty(qualityScore);

  return [...engineeringPoints]
    .map((point) => {
      const maintenanceSeverity =
        point.maintenance_state === 'attention' ? 1 : point.maintenance_state === 'planned' ? 0.6 : 0.15;
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

      return {
        id: point.id,
        name: point.name,
        stationLabel: point.station_label,
        sector: point.technical.route_sector || 'Unassigned',
        score,
        riskLabel: point.risk_level,
        reasons: [
          `margin ${formatBar(point.safety_margin_bar)}`,
          point.risk_level,
          point.maintenance_state,
          `sector ${point.technical.route_sector || 'Unassigned'}`,
        ],
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

export function buildEarlyWarningSignals(engineeringPoints: EngineeringPoint[]): EarlyWarningSignal[] {
  return [...engineeringPoints]
    .map((point) => {
      const marginStress = clamp((1 - point.safety_margin_bar) / 1, 0, 1);
      const pressureStress = clamp((point.hydraulic_pressure_bar - 7.2) / 1.2, 0, 1);
      const note = (point.technical.maintenance_note || point.technical.cathodic_status || '').toLowerCase();
      const noteStress =
        note.includes('critical') || note.includes('leak') || note.includes('rising')
          ? 1
          : note.includes('watch') || note.includes('scheduled')
            ? 0.5
            : 0.1;
      const score = clamp(
        100 *
          (EARLY_WARNING_WEIGHTS_V1.marginStress * marginStress +
            EARLY_WARNING_WEIGHTS_V1.pressureStress * pressureStress +
            EARLY_WARNING_WEIGHTS_V1.noteStress * noteStress),
        0,
        100
      );

      return {
        id: point.id,
        name: point.name,
        stationLabel: point.station_label,
        sector: point.technical.route_sector || 'Unassigned',
        score,
        etaHours: Math.max(EARLY_WARNING_ETA_MIN_HOURS_V1, Math.round(EARLY_WARNING_ETA_BASE_HOURS_V1 - score)),
        riskLevel: point.risk_level,
        trigger: marginStress >= pressureStress ? 'margin compression' : 'pressure escalation',
      };
    })
    .filter((signal) => signal.score >= EARLY_WARNING_THRESHOLD_V1)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

export function buildWhatIfImpacts(engineeringPoints: EngineeringPoint[]): WhatIfImpact[] {
  return [...engineeringPoints]
    .filter((point) => point.risk_level !== 'safe')
    .map((point) => {
      const projectedPressure = Math.max(0, point.hydraulic_pressure_bar - 0.35);
      const projectedMarginBar = point.pipe_bar_grade_bar - projectedPressure;

      return {
        id: point.id,
        name: point.name,
        stationLabel: point.station_label,
        sector: point.technical.route_sector || 'Unassigned',
        currentMarginBar: point.safety_margin_bar,
        projectedMarginBar,
        currentRisk: point.risk_level,
        projectedRisk: classifyRisk(projectedMarginBar),
      };
    })
    .sort((left, right) => left.projectedMarginBar - right.projectedMarginBar)
    .slice(0, 4);
}

export function buildWatchlistItems(engineeringPoints: EngineeringPoint[]): EngineeringWatchlistItem[] {
  return engineeringPoints
    .filter((point) => point.risk_level !== 'safe')
    .sort((left, right) => left.safety_margin_bar - right.safety_margin_bar)
    .slice(0, 8)
    .map((point) => {
      const tone = riskTone(point.risk_level);
      return {
        id: point.id,
        name: point.name,
        stationLabel: point.station_label,
        equipmentCode: point.equipment_code,
        riskLevel: point.risk_level,
        panelClass: tone.panel,
        badgeClass: tone.badge,
        pressureLabel: formatBar(point.hydraulic_pressure_bar),
        marginLabel: formatBar(point.safety_margin_bar),
        note: createEngineeringNote(point),
      };
    });
}
