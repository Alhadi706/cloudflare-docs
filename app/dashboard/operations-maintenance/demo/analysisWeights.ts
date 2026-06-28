export const ANALYSIS_MODEL_VERSION = 'v1.0.0';
export const ANALYSIS_MODEL_CANDIDATE_VERSION = 'v1.1.0';

export const PRIORITY_WEIGHTS_V1 = {
  marginPressure: 0.35,
  riskSeverity: 0.25,
  maintenanceSeverity: 0.2,
  sectorPressure: 0.2,
} as const;

export const PRIORITY_WEIGHTS_V1_1 = {
  marginPressure: 0.4,
  riskSeverity: 0.22,
  maintenanceSeverity: 0.18,
  sectorPressure: 0.2,
} as const;

export const PRIORITY_DQ_PENALTY_MULTIPLIER_V1 = 0.3;

export const EARLY_WARNING_WEIGHTS_V1 = {
  marginStress: 0.45,
  pressureStress: 0.35,
  noteStress: 0.2,
} as const;

export const EARLY_WARNING_THRESHOLD_V1 = 45;
export const EARLY_WARNING_ETA_BASE_HOURS_V1 = 120;
export const EARLY_WARNING_ETA_MIN_HOURS_V1 = 6;
