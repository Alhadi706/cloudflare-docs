/**
 * Advanced Engineering Calculations for Cathodic Protection Systems
 * Based on NACE SP0169, ASME B31G, Faraday's Law, and Tafel Extrapolation
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. POTENTIAL SHIFT CALCULATOR (Shift Potentiel: Native vs Polarized)
// ─────────────────────────────────────────────────────────────────────────────

export interface PotentialShiftInput {
  nativeVoltage: number; // mV (natural potential without CP)
  polarizedVoltage: number; // mV (with CP applied)
  measurementDate?: string;
  location?: string;
}

export interface PotentialShiftResult {
  nativeVoltage: number;
  polarizedVoltage: number;
  potentialShift: number; // Absolute change in mV
  shiftPercentage: number;
  classification: 'PROTECTED' | 'MARGINAL' | 'NOT_PROTECTED';
  naceStatus: string;
  explanation: string;
}

/**
 * Calculate potential shift (تحويل الجهد)
 * NACE SP0169: -850 mV (Cu/CuSO4) is the threshold for full cathodic protection
 */
export function calculatePotentialShift(
  input: PotentialShiftInput
): PotentialShiftResult {
  const shift = Math.abs(input.polarizedVoltage - input.nativeVoltage);
  const base = Math.abs(input.nativeVoltage);
  const shiftPct = base > 0 ? (shift / base) * 100 : 0;

  let classification: 'PROTECTED' | 'MARGINAL' | 'NOT_PROTECTED';
  let naceStatus: string;
  let explanation: string;

  if (input.polarizedVoltage <= -850) {
    classification = 'PROTECTED';
    naceStatus = 'NACE SP0169 Full Protection';
    explanation = 'جهد مستقطب يحقق الحماية الكاملة وفق معيار NACE SP0169';
  } else if (input.polarizedVoltage > -850 && input.polarizedVoltage <= -700) {
    classification = 'MARGINAL';
    naceStatus = 'Marginal Protection';
    explanation = 'حماية هامشية — توصية بمراجعة سريعة للنظام';
  } else {
    classification = 'NOT_PROTECTED';
    naceStatus = 'No Protection';
    explanation = 'لا توجد حماية كافية — تحتاج تدخل فوري';
  }

  return {
    nativeVoltage: input.nativeVoltage,
    polarizedVoltage: input.polarizedVoltage,
    potentialShift: shift,
    shiftPercentage: shiftPct,
    classification,
    naceStatus,
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. IR DROP COMPENSATION (تصحيح هبوط الجهد)
// ─────────────────────────────────────────────────────────────────────────────

export interface IrDropInput {
  measuredVoltage: number; // mV (what we measured at surface)
  appliedCurrent: number; // mA or Amps (current flowing through CP system)
  soilResistance: number; // Ohms·cm (soil resistivity)
  measurementDistance: number; // meters (distance from measurement point to CP anode)
}

export interface IrDropResult {
  measuredVoltage: number;
  irDropEstimated: number; // mV voltage drop due to soil resistance
  trueMetalVoltage: number; // mV actual potential at metal surface
  soilResistivity: number;
  appliedCurrent: number;
  correction: number;
  reliability: 'high' | 'medium' | 'low';
  recommendation: string;
}

/**
 * Calculate true metal surface potential after IR drop correction
 * IR Drop = Current (mA) × Resistance (Ohms)
 * Resistance = (ρ × distance) / electrode_area
 */
export function calculateIrDropCompensation(
  input: IrDropInput
): IrDropResult {
  // Simplified Ohm's law: V = I × R
  // For soil: R ≈ (resistivity × distance) / area
  // Assuming standard electrode, we estimate the resistance
  const estimatedResistance = (input.soilResistance / 100) * (input.measurementDistance / 10);
  const irDropMv = input.appliedCurrent * (estimatedResistance / 1000);

  // True voltage = measured voltage - IR drop
  // (more negative = actually better protected)
  const trueVoltage = input.measuredVoltage - irDropMv;

  let reliability: 'high' | 'medium' | 'low' = 'medium';
  if (input.soilResistance > 5000) reliability = 'low'; // High uncertainty
  if (input.soilResistance < 500) reliability = 'high'; // More stable

  let recommendation = 'تحقق من قراءة الجهد بعد تصحيح هبوط الجهد';
  if (trueVoltage <= -850) {
    recommendation = '✅ الحماية كافية بعد التصحيح';
  } else if (trueVoltage >= -700) {
    recommendation = '⚠️ حماية غير كافية — زيادة التيار المطبوع';
  }

  return {
    measuredVoltage: input.measuredVoltage,
    irDropEstimated: irDropMv,
    trueMetalVoltage: trueVoltage,
    soilResistivity: input.soilResistance,
    appliedCurrent: input.appliedCurrent,
    correction: irDropMv,
    reliability,
    recommendation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CORROSION RATE ESTIMATION (تقدير معدل التآكل)
// ─────────────────────────────────────────────────────────────────────────────

export interface CorrosionRateInput {
  method: 'faraday' | 'tafel'; // Calculation method
  // For Faraday method:
  corrosionCurrent?: number; // μA/cm² (current density)
  metalDensity?: number; // g/cm³ (e.g., 7.85 for steel)
  atomicWeight?: number; // g/mol (e.g., 55.85 for iron/steel)
  // For Tafel method:
  baCorr?: number; // mV (Tafel constant for corrosion)
  bcCorr?: number; // mV (Tafel constant for passivation)
  measuredCurrent?: number; // mA (actual current measured)
  // General
  potentialDifference?: number; // mV from reference
}

export interface CorrosionRateResult {
  method: 'faraday' | 'tafel';
  corrosionRateMmYear: number; // mm/year penetration rate
  corrosionRateMpy: number; // mils per year
  mmYear3Years: number; // Projection for 3 years
  mmYear10Years: number; // Projection for 10 years
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'NEGLIGIBLE';
  timeToFailure?: number; // estimated years to failure at 6mm critical thickness
  recommendation: string;
}

const FARADAY_CONSTANT = 96485; // C/mol
const ELECTRON_TRANSFER = 2; // electrons for iron oxidation (Fe → Fe²⁺ + 2e⁻)

/**
 * Faraday's Law: Corrosion rate (mm/year) = (I × M) / (n × F × ρ × 1000)
 * I = current density (μA/cm²)
 * M = atomic weight (g/mol)
 * n = electron transfer number
 * F = Faraday constant (96485 C/mol)
 * ρ = metal density (g/cm³)
 */
export function calculateCorrosionRateFaraday(
  input: CorrosionRateInput
): CorrosionRateResult {
  const I = input.corrosionCurrent || 10; // default 10 μA/cm²
  const M = input.atomicWeight || 55.85; // Steel (Fe)
  const rho = input.metalDensity || 7.85; // g/cm³

  // Formula: CR = (I × M) / (n × F × ρ)
  // Result in mm/year
  const crMmYear =
    (I * M) / (ELECTRON_TRANSFER * FARADAY_CONSTANT * rho) * 31536; // 31536 = seconds per year

  const severity = determineSeverity(crMmYear);
  const timeToFailure = crMmYear > 0 ? 6 / crMmYear : undefined; // 6mm critical thickness

  return {
    method: 'faraday',
    corrosionRateMmYear: crMmYear,
    corrosionRateMpy: crMmYear * 39.37, // 1 inch = 25.4 mm
    mmYear3Years: crMmYear * 3,
    mmYear10Years: crMmYear * 10,
    severity,
    timeToFailure,
    recommendation: getCorrosionRecommendation(crMmYear, severity),
  };
}

/**
 * Tafel Extrapolation: Based on electrochemical impedance
 * Estimates corrosion rate from potential-current relationship
 */
export function calculateCorrosionRateTafel(
  input: CorrosionRateInput
): CorrosionRateResult {
  // Simplified Tafel: log(I) = (E - Ecorr) / B
  // B ≈ (ba × bc) / (2.303 × (ba + bc))
  const ba = input.baCorr || 50; // mV
  const bc = input.bcCorr || 100; // mV
  const B = (ba * bc) / (2.303 * (ba + bc)); // Tafel slope

  const E = input.potentialDifference || -750; // measured mV
  const Ecorr = -650; // typical corrosion potential
  const logI = (E - Ecorr) / B;
  const I = Math.pow(10, logI); // Current in mA/cm²

  const crMmYear = (I * 55.85) / (ELECTRON_TRANSFER * FARADAY_CONSTANT * 7.85) * 31536;
  const severity = determineSeverity(crMmYear);

  return {
    method: 'tafel',
    corrosionRateMmYear: crMmYear,
    corrosionRateMpy: crMmYear * 39.37,
    mmYear3Years: crMmYear * 3,
    mmYear10Years: crMmYear * 10,
    severity,
    timeToFailure: crMmYear > 0 ? 6 / crMmYear : undefined,
    recommendation: getCorrosionRecommendation(crMmYear, severity),
  };
}

function determineSeverity(
  crMmYear: number
): 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'NEGLIGIBLE' {
  if (crMmYear >= 2.0) return 'CRITICAL';
  if (crMmYear >= 1.0) return 'HIGH';
  if (crMmYear >= 0.3) return 'MODERATE';
  if (crMmYear >= 0.05) return 'LOW';
  return 'NEGLIGIBLE';
}

function getCorrosionRecommendation(crMmYear: number, severity: string): string {
  const recommendations: Record<string, string> = {
    CRITICAL: '🚨 تدخل فوري مطلوب — إعادة تقييم نظام الحماية الكاثودية',
    HIGH: '⚠️ متابعة دورية (شهرية) — زيادة التيار المطبوع مستحسن',
    MODERATE: '📋 متابعة فصلية — تحسين تصريف المياه والعزل',
    LOW: '✅ متابعة سنوية كافية — النظام في حالة جيدة',
    NEGLIGIBLE: '✅ لا توجد مخاطر متوقعة — استمرار المراقبة الروتينية',
  };
  return recommendations[severity] || 'متابعة دورية موصى بها';
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. REMAINING LIFE ASSESSMENT (تحليل العمر المتبقي)
// Based on ASME B31G
// ─────────────────────────────────────────────────────────────────────────────

export interface RemainingLifeInput {
  originalWallThickness: number; // mm
  currentWallThickness: number; // mm
  corrosionRate: number; // mm/year
  minAllowableThickness: number; // mm (typically 3-4mm for pipelines)
  operatingPressure: number; // bar
  pipelineYieldStrength: number; // MPa (typically 450-550 for API 5L)
  defectType: 'general' | 'localized' | 'pit'; // Type of corrosion
}

export interface RemainingLifeResult {
  wallLoss: number; // mm
  wallLossPercentage: number;
  remainingThickness: number; // mm
  safetyFactor: number;
  estimatedYearsRemaining: number;
  criticality: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedActions: string[];
  nextInspectionSchedule: string;
  asmeB31gCompliance: boolean;
}

/**
 * ASME B31G: Remaining Life Assessment
 * Uses depth of defect and operating conditions
 */
export function calculateRemainingLife(
  input: RemainingLifeInput
): RemainingLifeResult {
  const wallLoss = input.originalWallThickness - input.currentWallThickness;
  const wallLossPercentage = (wallLoss / input.originalWallThickness) * 100;

  // Safety factor: ratio of thickness to minimum
  const safetyFactor = input.currentWallThickness / input.minAllowableThickness;

  // Years remaining before reaching critical thickness
  const thicknessNeeded = input.currentWallThickness - input.minAllowableThickness;
  const yearsRemaining = thicknessNeeded / input.corrosionRate;

  // Determine criticality
  let criticality: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';
  if (yearsRemaining < 0 || safetyFactor < 1.2) {
    criticality = 'IMMEDIATE';
  } else if (yearsRemaining < 1 || safetyFactor < 1.5) {
    criticality = 'HIGH';
  } else if (yearsRemaining < 3 || safetyFactor < 2.0) {
    criticality = 'MEDIUM';
  } else {
    criticality = 'LOW';
  }

  // Recommended actions based on criticality
  const recommendedActions: string[] = [];
  if (criticality === 'IMMEDIATE') {
    recommendedActions.push('⚠️ إيقاف التشغيل الفوري والإصلاح/الاستبدال');
    recommendedActions.push('توثيق الحالة للتقارير القانونية');
  } else if (criticality === 'HIGH') {
    recommendedActions.push('📋 جدولة الإصلاح في أقرب وقت (أقل من 6 أشهر)');
    recommendedActions.push('زيادة التيار المطبوع فوراً');
    recommendedActions.push('مراقبة أسبوعية مكثفة');
  } else if (criticality === 'MEDIUM') {
    recommendedActions.push('جدولة صيانة في الربع القادم');
    recommendedActions.push('تحسين نظام الحماية الكاثودية');
    recommendedActions.push('فحص دقيق للمناطق المتشابهة');
  } else {
    recommendedActions.push('استمرار برنامج المراقبة الروتينية');
    recommendedActions.push('مراجعة سنوية');
  }

  // Inspection schedule
  const inspectionInterval =
    criticality === 'IMMEDIATE'
      ? 'فوري'
      : criticality === 'HIGH'
        ? '3 أشهر'
        : criticality === 'MEDIUM'
          ? '6 أشهر'
          : '12 شهر';

  // ASME B31G compliance: wall thickness must be ≥ minimum
  const asmeB31gCompliance = input.currentWallThickness >= input.minAllowableThickness;

  return {
    wallLoss,
    wallLossPercentage,
    remainingThickness: input.currentWallThickness,
    safetyFactor,
    estimatedYearsRemaining: Math.max(0, yearsRemaining),
    criticality,
    recommendedActions,
    nextInspectionSchedule: inspectionInterval,
    asmeB31gCompliance,
  };
}
