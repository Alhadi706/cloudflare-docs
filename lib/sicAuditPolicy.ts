import type { Terrain3DResponse } from './terrain3DAPI';
import type { Terrain3DBenchmarkPreset } from './terrain3DBenchmark';

export type PolicyAxisStatus = 'pass' | 'warn' | 'fail';

export interface SicAuditPolicy {
  version: string;
  name: string;
  benchmark: {
    coastalLatitudeThreshold: number;
  };
  terrain: {
    requiredArtifactsForPass: number;
    minArtifactsForWarn: number;
  };
  qualityGate: {
    pass: {
      minConfidenceScore: number;
      maxDriftPct: number;
      requireSpatialPass: boolean;
    };
    warn: {
      minConfidenceScore: number;
      maxDriftPct: number;
    };
  };
}

export const SIC_AUDIT_POLICY_V1: SicAuditPolicy = {
  version: 'SIC-AUDIT-V1',
  name: 'SIC Full Audit Policy v1',
  benchmark: {
    coastalLatitudeThreshold: 30,
  },
  terrain: {
    requiredArtifactsForPass: 3,
    minArtifactsForWarn: 1,
  },
  qualityGate: {
    pass: {
      minConfidenceScore: 75,
      maxDriftPct: 25,
      requireSpatialPass: true,
    },
    warn: {
      minConfidenceScore: 60,
      maxDriftPct: 35,
    },
  },
};

export function pickTerrainBenchmarkPreset(
  centerLat: number,
  presets: Terrain3DBenchmarkPreset[],
  policy: SicAuditPolicy = SIC_AUDIT_POLICY_V1
): Terrain3DBenchmarkPreset {
  if (presets.length === 0) {
    throw new Error('terrain_benchmark_presets_missing');
  }
  const coastalPreset = presets[0];
  const inlandPreset = presets[1] ?? presets[0];
  return centerLat >= policy.benchmark.coastalLatitudeThreshold ? coastalPreset : inlandPreset;
}

export function evaluateTerrainPolicyStatus(
  terrain: Terrain3DResponse,
  policy: SicAuditPolicy = SIC_AUDIT_POLICY_V1
): PolicyAxisStatus {
  const artifacts = [
    Boolean(terrain?.contours?.bands?.length),
    Boolean(terrain?.visibility),
    Boolean(terrain?.cut_fill),
  ];
  const count = artifacts.filter(Boolean).length;

  if (count >= policy.terrain.requiredArtifactsForPass) return 'pass';
  if (count >= policy.terrain.minArtifactsForWarn) return 'warn';
  return 'fail';
}

export function evaluateQualityGatePolicyStatus(params: {
  confidenceScore: number;
  maxDriftPct: number;
  spatialStatus: PolicyAxisStatus;
  policy?: SicAuditPolicy;
}): PolicyAxisStatus {
  const policy = params.policy ?? SIC_AUDIT_POLICY_V1;
  const passEligible =
    params.confidenceScore >= policy.qualityGate.pass.minConfidenceScore &&
    params.maxDriftPct <= policy.qualityGate.pass.maxDriftPct &&
    (!policy.qualityGate.pass.requireSpatialPass || params.spatialStatus === 'pass');
  if (passEligible) return 'pass';

  const warnEligible =
    params.confidenceScore >= policy.qualityGate.warn.minConfidenceScore &&
    params.maxDriftPct <= policy.qualityGate.warn.maxDriftPct;
  if (warnEligible) return 'warn';

  return 'fail';
}
