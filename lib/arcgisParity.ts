type AuditAxisStatus = 'pass' | 'warn' | 'fail';

export interface FullAuditSnapshotForParity {
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

export interface CanonicalKpiForParity {
  confidenceScore: number;
  maxDriftPct: number;
}

export interface ArcGisParityResult {
  baseline_version: string;
  baseline_name: string;
  run_id: string;
  score: number;
  verdict: 'ahead' | 'near' | 'behind';
  deltas: {
    confidence_gap_pct: number;
    drift_gap_pct: number;
    axis_pass_rate_gap_pct: number;
  };
  metrics: {
    axis_pass_rate_pct: number;
    confidence_score_pct: number;
    max_drift_pct: number;
  };
  generated_at: string;
}

interface ArcGisParityBaseline {
  version: string;
  name: string;
  targetConfidencePct: number;
  targetMaxDriftPct: number;
  targetAxisPassRatePct: number;
}

const BASELINE: ArcGisParityBaseline = {
  version: 'ARCGIS-PARITY-V1',
  name: 'ArcGIS Decision-Grade Baseline v1',
  targetConfidencePct: 78,
  targetMaxDriftPct: 22,
  targetAxisPassRatePct: 100,
};

function statusPoints(status: AuditAxisStatus): number {
  if (status === 'pass') return 1;
  if (status === 'warn') return 0.5;
  return 0;
}

function toVerdict(score: number): ArcGisParityResult['verdict'] {
  if (score >= 85) return 'ahead';
  if (score >= 65) return 'near';
  return 'behind';
}

export function evaluateArcGisParity(params: {
  snapshot: FullAuditSnapshotForParity;
  canonicalKpi: CanonicalKpiForParity;
}): ArcGisParityResult {
  const axisStatuses: AuditAxisStatus[] = [
    params.snapshot.scene,
    params.snapshot.spatial,
    params.snapshot.qualityGate,
    params.snapshot.temporal,
    params.snapshot.simulation,
    params.snapshot.terrain3d,
    params.snapshot.benchmark,
  ];
  const axisPassRate = Math.round((axisStatuses.reduce((acc, s) => acc + statusPoints(s), 0) / axisStatuses.length) * 100);

  const confidenceGap = params.canonicalKpi.confidenceScore - BASELINE.targetConfidencePct;
  const driftGap = BASELINE.targetMaxDriftPct - params.canonicalKpi.maxDriftPct;
  const axisGap = axisPassRate - BASELINE.targetAxisPassRatePct;

  const confidenceComponent = Math.max(0, Math.min(100, params.canonicalKpi.confidenceScore));
  const driftComponent = Math.max(0, Math.min(100, 100 - Math.max(0, params.canonicalKpi.maxDriftPct - BASELINE.targetMaxDriftPct) * 2.5));
  const score = Math.round((axisPassRate * 0.4) + (confidenceComponent * 0.4) + (driftComponent * 0.2));

  return {
    baseline_version: BASELINE.version,
    baseline_name: BASELINE.name,
    run_id: params.snapshot.runId,
    score,
    verdict: toVerdict(score),
    deltas: {
      confidence_gap_pct: Math.round(confidenceGap),
      drift_gap_pct: Math.round(driftGap),
      axis_pass_rate_gap_pct: Math.round(axisGap),
    },
    metrics: {
      axis_pass_rate_pct: axisPassRate,
      confidence_score_pct: Math.round(params.canonicalKpi.confidenceScore),
      max_drift_pct: Math.round(params.canonicalKpi.maxDriftPct),
    },
    generated_at: new Date().toISOString(),
  };
}
