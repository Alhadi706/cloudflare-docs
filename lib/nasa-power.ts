/**
 * NASA POWER API client
 * Prediction Of Worldwide Energy Resources — https://power.larc.nasa.gov/
 * Free, no API key, global coverage 1981–present, daily resolution.
 *
 * Parameters chosen for pipeline corrosion analysis:
 *   PRECTOTCORR  — Precipitation corrected (mm/day)
 *   RH2M         — Relative Humidity at 2 m (%)
 *   T2M          — Temperature at 2 m (°C)
 *   GWETROOT     — Root zone soil wetness 0–1 (key driver of soil resistivity)
 *   GWETPROF     — Profile soil wetness 0–1 (deeper corrosion environment)
 *   WS2M         — Wind speed at 2 m (m/s) — minor coating drying factor
 */

export const NASA_POWER_PARAMS = [
  'PRECTOTCORR',
  'RH2M',
  'T2M',
  'GWETROOT',
  'GWETPROF',
] as const;

export type NasaParam = typeof NASA_POWER_PARAMS[number];

export interface NasaDailyRecord {
  date: string;          // YYYYMMDD
  year: number;
  month: number;
  day: number;
  PRECTOTCORR: number;   // mm/day
  RH2M:        number;   // %
  T2M:         number;   // °C
  GWETROOT:    number;   // 0–1
  GWETPROF:    number;   // 0–1
}

export interface NasaMonthlyStats {
  year:    number;
  month:   number;
  label:   string;                        // "يناير 2024"
  precip_mm:     number;                  // total monthly precip
  rh_pct:        number;                  // mean relative humidity
  temp_c:        number;                  // mean temperature
  soil_wet_root: number;                  // mean root-zone wetness
  soil_wet_prof: number;                  // mean profile wetness
  days:          number;                  // sample days in month
}

export interface NasaEnvData {
  lat:      number;
  lng:      number;
  startDate: string;
  endDate:   string;
  daily:    NasaDailyRecord[];
  monthly:  NasaMonthlyStats[];
  annual:   { year: number; avg_temp_c: number; total_precip_mm: number; avg_soil_wet: number }[];
}

const MONTH_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

/** Fetch historical daily climate data from NASA POWER for a point location.
 *  @param lat     Pipeline centroid latitude
 *  @param lng     Pipeline centroid longitude
 *  @param startYear  e.g. 2020
 *  @param endYear    e.g. 2025
 */
export async function fetchNasaPowerData(
  lat: number,
  lng: number,
  startYear = 2020,
  endYear   = new Date().getFullYear(),
): Promise<NasaEnvData> {
  const start = `${startYear}0101`;
  const end   = `${endYear}1231`;
  const params = NASA_POWER_PARAMS.join(',');

  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=${params}` +
    `&community=AG` +
    `&longitude=${lng.toFixed(4)}` +
    `&latitude=${lat.toFixed(4)}` +
    `&start=${start}` +
    `&end=${end}` +
    `&format=JSON`;

  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);

  const json = await res.json();
  const props = json?.properties?.parameter;
  if (!props) throw new Error('NASA POWER: unexpected response structure');

  // Build daily records from NASA's date-keyed dictionaries
  const dateKeys: string[] = Object.keys(props.T2M ?? {}).sort();
  const daily: NasaDailyRecord[] = dateKeys
    .filter((dk) => (props.GWETROOT?.[dk] ?? -999) > -900)   // skip fill-value
    .map((dk) => ({
      date:        dk,
      year:        parseInt(dk.slice(0, 4)),
      month:       parseInt(dk.slice(4, 6)),
      day:         parseInt(dk.slice(6, 8)),
      PRECTOTCORR: props.PRECTOTCORR?.[dk] ?? 0,
      RH2M:        props.RH2M?.[dk]         ?? 0,
      T2M:         props.T2M?.[dk]          ?? 0,
      GWETROOT:    props.GWETROOT?.[dk]     ?? 0,
      GWETPROF:    props.GWETPROF?.[dk]     ?? 0,
    }));

  // Aggregate monthly
  const monthMap = new Map<string, NasaDailyRecord[]>();
  for (const d of daily) {
    const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(d);
  }
  const monthly: NasaMonthlyStats[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, days]) => {
      const yr = parseInt(key.split('-')[0]);
      const mo = parseInt(key.split('-')[1]);
      const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
      return {
        year:          yr,
        month:         mo,
        label:         `${MONTH_AR[mo - 1]} ${yr}`,
        precip_mm:     days.reduce((s, d) => s + d.PRECTOTCORR, 0),
        rh_pct:        avg(days.map((d) => d.RH2M)),
        temp_c:        avg(days.map((d) => d.T2M)),
        soil_wet_root: avg(days.map((d) => d.GWETROOT)),
        soil_wet_prof: avg(days.map((d) => d.GWETPROF)),
        days:          days.length,
      };
    });

  // Aggregate annual
  const yearMap = new Map<number, NasaDailyRecord[]>();
  for (const d of daily) {
    if (!yearMap.has(d.year)) yearMap.set(d.year, []);
    yearMap.get(d.year)!.push(d);
  }
  const annual = Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([yr, days]) => {
      const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
      return {
        year:            yr,
        avg_temp_c:      parseFloat(avg(days.map((d) => d.T2M)).toFixed(1)),
        total_precip_mm: parseFloat(days.reduce((s, d) => s + d.PRECTOTCORR, 0).toFixed(1)),
        avg_soil_wet:    parseFloat(avg(days.map((d) => d.GWETROOT)).toFixed(3)),
      };
    });

  return { lat, lng, startDate: start, endDate: end, daily, monthly, annual };
}

/** Get monthly stats that overlap with a CP survey date window (±3 months). */
export function getEnvForSurveyYear(
  envData: NasaEnvData,
  surveyYear: number,
): NasaMonthlyStats[] {
  return envData.monthly.filter((m) => m.year === surveyYear);
}

/** Derive worst-month (most corrosive) stats for a given year. */
export function getPeakCorrosionMonth(months: NasaMonthlyStats[]): NasaMonthlyStats | null {
  if (!months.length) return null;
  // Score = soil_wet × (1 + precip/50) × (1 + temp/30)
  return months.reduce((best, m) => {
    const score = (c: NasaMonthlyStats) =>
      c.soil_wet_root * (1 + c.precip_mm / 50) * (1 + c.temp_c / 30);
    return score(m) > score(best) ? m : best;
  });
}
