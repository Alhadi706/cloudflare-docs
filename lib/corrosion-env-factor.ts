/**
 * Corrosion Environment Factor (CEF) calculations
 *
 * CEF quantifies how environmental conditions (soil moisture, temperature,
 * relative humidity) amplify the baseline corrosion rate relative to
 * standard reference conditions (T=20°C, RH=50%, dry soil).
 *
 * Formula (derived from ISO 15589-1 Annex D and NACE TM0497):
 *   CEF = (1 + 0.45 × gwetroot)
 *       × exp(0.022 × (T₂ₘ − 20))
 *       × (1 + 0.08 × (RH₂ₘ / 100))
 *
 * CEF = 1.0 → reference conditions (no amplification)
 * CEF > 1.0 → more corrosive than reference
 * CEF < 1.0 → less corrosive than reference (dry/cold)
 *
 * Practical ranges:
 *   Low        CEF < 1.10  — arid / cold conditions
 *   Moderate   1.10–1.40   — typical temperate climate
 *   High       1.40–1.70   — humid / warm conditions
 *   Severe     CEF > 1.70  — tropical / waterlogged soil
 */

import type { NasaMonthlyStats } from './nasa-power';

export interface CefResult {
  cef:         number;   // overall factor (dimensionless)
  soil_factor: number;   // (1 + 0.45 × gwetroot)
  temp_factor: number;   // exp(0.022 × (T − 20))
  rh_factor:   number;   // (1 + 0.08 × rh/100)
  risk_level:  'low' | 'moderate' | 'high' | 'severe';
  risk_label_ar: string;
}

export function calcCEF(gwetroot: number, t2m: number, rh2m: number): CefResult {
  const soil_factor = 1 + 0.45 * Math.max(0, Math.min(1, gwetroot));
  const temp_factor = Math.exp(0.022 * (t2m - 20));
  const rh_factor   = 1 + 0.08 * (Math.max(0, Math.min(100, rh2m)) / 100);
  const cef = parseFloat((soil_factor * temp_factor * rh_factor).toFixed(4));

  let risk_level: CefResult['risk_level'];
  let risk_label_ar: string;
  if      (cef < 1.10) { risk_level = 'low';      risk_label_ar = 'منخفض'; }
  else if (cef < 1.40) { risk_level = 'moderate'; risk_label_ar = 'متوسط'; }
  else if (cef < 1.70) { risk_level = 'high';     risk_label_ar = 'مرتفع'; }
  else                 { risk_level = 'severe';   risk_label_ar = 'حرج';   }

  return { cef, soil_factor, temp_factor, rh_factor, risk_level, risk_label_ar };
}

/** Aggregate monthly NASA stats into a single CEF for a survey year. */
export function calcAnnualCEF(months: NasaMonthlyStats[]): CefResult | null {
  if (!months.length) return null;
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  return calcCEF(
    avg(months.map((m) => m.soil_wet_root)),
    avg(months.map((m) => m.temp_c)),
    avg(months.map((m) => m.rh_pct)),
  );
}

/** Peak (worst month) CEF for a set of monthly stats. */
export function calcPeakCEF(months: NasaMonthlyStats[]): CefResult | null {
  if (!months.length) return null;
  const worst = months.reduce((best, m) => {
    const s = calcCEF(m.soil_wet_root, m.temp_c, m.rh_pct);
    const b = calcCEF(best.soil_wet_root, best.temp_c, best.rh_pct);
    return s.cef > b.cef ? m : best;
  });
  return calcCEF(worst.soil_wet_root, worst.temp_c, worst.rh_pct);
}

// ─── Pearson Correlation ─────────────────────────────────────────────────────

/**
 * Pearson product-moment correlation coefficient between two numeric arrays.
 * Returns NaN if either array has < 2 elements or zero variance.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  const meanX = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanY = y.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const ex = x[i] - meanX, ey = y[i] - meanY;
    num += ex * ey;
    dx2 += ex * ex;
    dy2 += ey * ey;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return NaN;
  return parseFloat((num / denom).toFixed(4));
}

/** Human-readable Arabic interpretation of Pearson r. */
export function interpretCorrelation(r: number): string {
  if (isNaN(r)) return 'لا توجد بيانات كافية';
  const abs = Math.abs(r);
  const dir = r < 0 ? 'عكسي' : 'طردي';
  if (abs < 0.10) return `لا ارتباط (${r.toFixed(2)})`;
  if (abs < 0.30) return `ارتباط ${dir} ضعيف (${r.toFixed(2)})`;
  if (abs < 0.50) return `ارتباط ${dir} معتدل (${r.toFixed(2)})`;
  if (abs < 0.70) return `ارتباط ${dir} متوسط (${r.toFixed(2)})`;
  if (abs < 0.90) return `ارتباط ${dir} قوي (${r.toFixed(2)})`;
  return `ارتباط ${dir} قوي جداً (${r.toFixed(2)})`;
}

// ─── Survey-period aggregation ───────────────────────────────────────────────

export interface SurveyEnvSummary {
  surveyYear:   number;
  avgSoilWet:   number;
  avgTempC:     number;
  avgRhPct:     number;
  totalPrecipMm: number;
  cef:          CefResult;
}

/**
 * Compute the OLS sensitivity coefficient β (mV per CEF unit).
 * β is estimated by regressing annual mean CP prediction errors against CEF deviations.
 *
 *   β = Σ[(error_yr × cefDev_yr)] / Σ[cefDev_yr²]
 *
 * @param errorByYear  Map from survey year → mean error (real_mv − pred_mv)
 * @param cefByYear    Map from year → annual CEF
 * @returns β in mV / CEF-unit.  Returns 0 if < 2 shared years.
 */
export function computeCefSensitivity(
  errorByYear: Map<number, number>,
  cefByYear:   Map<number, number>,
): number {
  const years = [...errorByYear.keys()].filter((yr) => cefByYear.has(yr));
  if (years.length < 2) return 0;
  const avgCef = years.reduce((s, yr) => s + cefByYear.get(yr)!, 0) / years.length;
  let num = 0, denom = 0;
  for (const yr of years) {
    const e = errorByYear.get(yr)!;
    const d = cefByYear.get(yr)! - avgCef;
    num   += e * d;
    denom += d * d;
  }
  return denom > 0 ? num / denom : 0;
}

/** Build one summary row per survey year by matching against monthly NASA data. */
export function buildSurveyEnvRows(
  surveyYears: number[],
  monthly: NasaMonthlyStats[],
): SurveyEnvSummary[] {
  return surveyYears
    .map((yr) => {
      const months = monthly.filter((m) => m.year === yr);
      if (!months.length) return null;
      const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
      const avgSoilWet  = parseFloat(avg(months.map((m) => m.soil_wet_root)).toFixed(3));
      const avgTempC    = parseFloat(avg(months.map((m) => m.temp_c)).toFixed(1));
      const avgRhPct    = parseFloat(avg(months.map((m) => m.rh_pct)).toFixed(1));
      const totalPrecipMm = parseFloat(months.reduce((s, m) => s + m.precip_mm, 0).toFixed(1));
      const cef = calcCEF(avgSoilWet, avgTempC, avgRhPct);
      return { surveyYear: yr, avgSoilWet, avgTempC, avgRhPct, totalPrecipMm, cef };
    })
    .filter((r): r is SurveyEnvSummary => r !== null);
}
