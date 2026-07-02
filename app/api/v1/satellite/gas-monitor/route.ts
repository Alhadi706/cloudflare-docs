/**
 * GET /api/v1/satellite/gas-monitor
 * كشف تسريبات الغاز ومصادر الميثان عبر Sentinel-5P TROPOMI
 *
 * المصادر (مرتبة بالأولوية):
 *  1. Sentinel-5P TROPOMI (SH Statistical API, CDSE)  — دقة 5.5×3.5 كم — CO, CH4, NO2 حقيقية
 *  2. Open-Meteo / CAMS  — احتياطي عند عدم توفر CDSE credentials — دقة 10-40 كم
 *
 * الاستخدامات:
 *   - تسريبات خطوط أنابيب الغاز (CH4 شذوذ)
 *   - حرق الغاز في حقول النفط (CO + NO2 ارتفاع)
 *   - دخان الحرائق (CO column)
 */
import { NextRequest, NextResponse } from 'next/server';
import { hasCDSECredentials, computeS5P } from '@/lib/sentinel-hub';
import { daysAgo, today } from '@/lib/stac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// ── Open-Meteo Air Quality API (fallback when no CDSE credentials) ───────────
const OPEN_METEO_AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// ── Libya key monitoring points ─────────────────────────────────────────────
const LIBYA_GAS_SITES = [
  { name: 'حقل الشرارة النفطي',   lon: 12.88, lat: 27.90, type: 'oil_field' },
  { name: 'حقل الحساونة',          lon: 14.60, lat: 29.50, type: 'oil_field' },
  { name: 'حقل السرير',            lon: 22.50, lat: 27.50, type: 'oil_field' },
  { name: 'حقل وفاء',              lon: 10.70, lat: 27.80, type: 'oil_field' },
  { name: 'مصفاة الزاوية',         lon: 12.73, lat: 32.75, type: 'refinery'  },
  { name: 'ميناء السدرة النفطي',   lon: 18.42, lat: 30.62, type: 'terminal'  },
  { name: 'ميناء رأس لانوف',       lon: 18.57, lat: 30.50, type: 'terminal'  },
  { name: 'طرابلس — شبكة مياه',   lon: 13.18, lat: 32.89, type: 'water_net' },
  { name: 'بنغازي — شبكة مياه',   lon: 20.07, lat: 32.11, type: 'water_net' },
];

// S5P bbox padding: 0.08° ~9km (covers ~1 S5P pixel at 5.5km)
const S5P_PAD = 0.08;

interface SiteGasReading {
  name:           string;
  lon:            number;
  lat:            number;
  site_type:      string;
  data_source:    'sentinel-5p' | 'cams-fallback';
  // Sentinel-5P TROPOMI values
  co_mol_m2:      number | null;   // CO column (mol/m²)  background ~0.030
  ch4_ppb:        number | null;   // CH4 mixing ratio (ppb) background ~1850
  no2_mol_m2:     number | null;   // NO2 tropospheric col (mol/m²) background ~3e-5
  // CAMS fallback
  no2_umol_m2:    number | null;
  co_ug_m3:       number | null;
  pm25_ug_m3:     number | null;
  anomaly_score:  number;          // 0-100
  anomaly_type:   'gas_flare' | 'pipeline_leak' | 'industrial' | 'normal';
  evidence:       string[];
}

// ── S5P-based anomaly classification ─────────────────────────────────────────
// S5P TROPOMI background values over Libya (desert / low anthropogenic):
//   CO  : 0.020–0.035 mol/m²   (flare/fire: >0.060)
//   CH4 : 1820–1870 ppb        (leak/flare: >1900)
//   NO2 : 1e-5 – 4e-5 mol/m²  (industrial: >1e-4)
function classifyS5P(site: typeof LIBYA_GAS_SITES[0], co: number | null, ch4: number | null, no2: number | null) {
  const evidence: string[] = [];
  let score = 0;

  if (co !== null) {
    if      (co > 0.08)  { score += 45; evidence.push(`🟥 CO = ${co.toFixed(3)} mol/m² — انبعاث كثيف (حريق/شعلة)`); }
    else if (co > 0.055) { score += 30; evidence.push(`🟧 CO = ${co.toFixed(3)} mol/m² — مرتفع (احتراق محلي)`); }
    else if (co > 0.040) { score += 15; evidence.push(`🟡 CO = ${co.toFixed(3)} mol/m² — فوق الخلفية الطبيعية`); }
    else                  evidence.push(`✅ CO = ${co.toFixed(3)} mol/m² — طبيعي`);
  }

  if (ch4 !== null) {
    if      (ch4 > 1920) { score += 40; evidence.push(`🟥 CH₄ = ${ch4.toFixed(0)} ppb — تسرب غاز طبيعي مرتفع`); }
    else if (ch4 > 1895) { score += 20; evidence.push(`🟧 CH₄ = ${ch4.toFixed(0)} ppb — شذوذ ميثان ملحوظ`); }
    else if (ch4 > 1875) { score += 8;  evidence.push(`🟡 CH₄ = ${ch4.toFixed(0)} ppb — فوق الخلفية قليلاً`); }
    else                  evidence.push(`✅ CH₄ = ${ch4.toFixed(0)} ppb — طبيعي`);
  }

  if (no2 !== null) {
    const no2_umol = no2 * 1e6; // mol/m² → µmol/m²
    if      (no2_umol > 150) { score += 30; evidence.push(`🟥 NO₂ = ${no2_umol.toFixed(0)} µmol/m² — احتراق صناعي كثيف`); }
    else if (no2_umol > 80)  { score += 18; evidence.push(`🟧 NO₂ = ${no2_umol.toFixed(0)} µmol/m² — مرتفع`); }
    else if (no2_umol > 40)  { score += 8;  evidence.push(`🟡 NO₂ = ${no2_umol.toFixed(0)} µmol/m² — متوسط`); }
    else                      evidence.push(`✅ NO₂ = ${no2_umol.toFixed(0)} µmol/m² — طبيعي`);
  }

  const type: SiteGasReading['anomaly_type'] =
    site.type === 'oil_field' && score >= 35 ? 'gas_flare' :
    site.type === 'refinery'  && score >= 25 ? 'industrial' :
    site.type === 'water_net' && ch4 !== null && ch4 > 1900 ? 'pipeline_leak' :
    score >= 25                              ? 'industrial' : 'normal';

  return { score: Math.min(100, score), type, evidence };
}

// ── CAMS fallback (Open-Meteo) ────────────────────────────────────────────────
async function queryOpenMeteoAQ(lon: number, lat: number): Promise<{
  no2: number | null; co: number | null; pm25: number | null;
}> {
  const url = new URL(OPEN_METEO_AQ);
  url.searchParams.set('latitude',   lat.toString());
  url.searchParams.set('longitude',  lon.toString());
  url.searchParams.set('hourly',     'nitrogen_dioxide,carbon_monoxide,pm2_5');
  url.searchParams.set('past_days',  '3');
  url.searchParams.set('forecast_days', '0');
  url.searchParams.set('timezone',   'UTC');
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { no2: null, co: null, pm25: null };
    const data = await res.json();
    const hourly = data.hourly ?? {};
    const no2arr  = (hourly.nitrogen_dioxide  ?? []).filter((v: any) => v !== null);
    const coArr   = (hourly.carbon_monoxide    ?? []).filter((v: any) => v !== null);
    const pm25arr = (hourly.pm2_5             ?? []).filter((v: any) => v !== null);
    const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
    return { no2: avg(no2arr), co: avg(coArr), pm25: avg(pm25arr) };
  } catch { return { no2: null, co: null, pm25: null }; }
}

function classifyCAMS(site: typeof LIBYA_GAS_SITES[0], no2: number | null, co: number | null, pm25: number | null) {
  const evidence: string[] = [];
  let score = 0;
  if (no2 !== null) {
    if (no2 > 80)  { score += 40; evidence.push(`🟥 NO₂ = ${no2.toFixed(1)} µg/m³ (CAMS)`); }
    else if (no2 > 40) { score += 25; evidence.push(`🟧 NO₂ = ${no2.toFixed(1)} µg/m³ (CAMS)`); }
    else evidence.push(`✅ NO₂ = ${no2.toFixed(1)} µg/m³ (CAMS, دقة ~10كم)`);
  }
  if (co !== null) {
    if (co > 10000) { score += 35; evidence.push(`🟥 CO = ${(co/1000).toFixed(1)} mg/m³ (CAMS)`); }
    else if (co > 4000) { score += 20; evidence.push(`🟧 CO = ${(co/1000).toFixed(1)} mg/m³ (CAMS)`); }
    else evidence.push(`✅ CO = ${(co/1000).toFixed(2)} mg/m³ (CAMS)`);
  }
  if (pm25 !== null && pm25 > 75)  { score += 25; evidence.push(`🟥 PM2.5 = ${pm25.toFixed(1)} µg/m³`); }
  const type: SiteGasReading['anomaly_type'] =
    site.type === 'oil_field' && score >= 40 ? 'gas_flare' :
    site.type === 'refinery'  && score >= 30 ? 'industrial' :
    score >= 20 ? 'industrial' : 'normal';
  return { score: Math.min(100, score), type, evidence };
}

export async function GET(req: NextRequest) {
  const t0   = Date.now();
  const useSH = hasCDSECredentials();
  const dateFrom = daysAgo(14);   // S5P: use 14-day window for better coverage
  const dateTo   = today();

  const readings = await Promise.all(
    LIBYA_GAS_SITES.map(async (site): Promise<SiteGasReading> => {
      // S5P bbox: 0.08° padding each side (~9 km covers 1-2 S5P pixels)
      const bbox: [number, number, number, number] = [
        site.lon - S5P_PAD, site.lat - S5P_PAD,
        site.lon + S5P_PAD, site.lat + S5P_PAD,
      ];

      if (useSH) {
        // Primary: Sentinel-5P TROPOMI via Sentinel Hub Statistical API
        const s5p = await computeS5P(bbox, dateFrom, dateTo).catch(() => null);
        const { score, type, evidence } = classifyS5P(
          site,
          s5p?.co_mean  ?? null,
          s5p?.ch4_mean ?? null,
          s5p?.no2_mean ?? null,
        );
        return {
          name:          site.name,
          lon:           site.lon,
          lat:           site.lat,
          site_type:     site.type,
          data_source:   'sentinel-5p',
          co_mol_m2:     s5p?.co_mean  ?? null,
          ch4_ppb:       s5p?.ch4_mean ?? null,
          no2_mol_m2:    s5p?.no2_mean ?? null,
          no2_umol_m2:   null,
          co_ug_m3:      null,
          pm25_ug_m3:    null,
          anomaly_score: score,
          anomaly_type:  type,
          evidence,
        };
      } else {
        // Fallback: CAMS via Open-Meteo (10-40km resolution)
        const { no2, co, pm25 } = await queryOpenMeteoAQ(site.lon, site.lat);
        const { score, type, evidence } = classifyCAMS(site, no2, co, pm25);
        return {
          name:          site.name,
          lon:           site.lon,
          lat:           site.lat,
          site_type:     site.type,
          data_source:   'cams-fallback',
          co_mol_m2:     null,
          ch4_ppb:       null,
          no2_mol_m2:    null,
          no2_umol_m2:   no2,
          co_ug_m3:      co,
          pm25_ug_m3:    pm25,
          anomaly_score: score,
          anomaly_type:  type,
          evidence,
        };
      }
    })
  );

  const alerts   = readings.filter(r => r.anomaly_score >= 30);
  const colorMap: Record<SiteGasReading['anomaly_type'], string> = {
    gas_flare:     '#a855f7',
    pipeline_leak: '#ef4444',
    industrial:    '#f97316',
    normal:        '#34d399',
  };

  const geojson = {
    type: 'FeatureCollection',
    features: readings.map(r => ({
      type:     'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: {
        name:          r.name,
        site_type:     r.site_type,
        anomaly_type:  r.anomaly_type,
        anomaly_score: r.anomaly_score,
        data_source:   r.data_source,
        co_mol_m2:     r.co_mol_m2?.toFixed(4),
        ch4_ppb:       r.ch4_ppb?.toFixed(1),
        no2_umol_m2:   r.no2_mol_m2 ? (r.no2_mol_m2 * 1e6).toFixed(1) : null,
        label: r.anomaly_score >= 50 ? `🔴 ${r.name}` :
               r.anomaly_score >= 30 ? `🟠 ${r.name}` :
               r.anomaly_score >= 10 ? `🟡 ${r.name}` :
                                       `🟢 ${r.name}`,
        color:    colorMap[r.anomaly_type],
        radius:   8 + r.anomaly_score / 10,
        evidence: r.evidence.join(' | '),
        layerKey: 'gas_monitor',
      },
    })),
  };

  return NextResponse.json({
    ok:              true,
    data_real:       true,
    data_source:     useSH ? 'Sentinel-5P TROPOMI — Sentinel Hub Statistical API (CDSE, 5.5×3.5 كم)' : 'CAMS via Open-Meteo (fallback, ~10-40 كم)',
    sentinel5p_active: useSH,
    query_ms:        Date.now() - t0,
    period:          `${dateFrom} → ${dateTo}`,
    sites_monitored: readings.length,
    alerts_count:    alerts.length,
    summary: {
      gas_flares:     readings.filter(r => r.anomaly_type === 'gas_flare').length,
      industrial:     readings.filter(r => r.anomaly_type === 'industrial').length,
      pipeline_leaks: readings.filter(r => r.anomaly_type === 'pipeline_leak').length,
      normal:         readings.filter(r => r.anomaly_type === 'normal').length,
    },
    alerts: alerts.map(r => ({ name: r.name, score: r.anomaly_score, type: r.anomaly_type, evidence: r.evidence })),
    readings,
    geojson,
    methodology: {
      primary_source: useSH ? 'Sentinel-5P TROPOMI (SH Statistical API) — CO, CH4, NO2 — دقة 5.5×3.5 كم' : 'CAMS via Open-Meteo (fallback) — دقة ~10-40 كم',
      co_use:   'CO (mol/m²): يرتفع من الحرائق والشعلات والحرق الناقص — مؤشر دخان ممتاز',
      ch4_use:  'CH4 (ppb): خلفية 1840-1870 ppb — أي ارتفاع >+30 ppb يشير لتسرب غاز طبيعي',
      no2_use:  'NO2 (mol/m²): من احتراق الوقود + الصناعة — يُميّز الشعلات من التسريبات',
      next_step: 'لدقة أعلى: طلب S5P TROPOMI L3 daily mosaic من CDSE API + خوارزمية enhanced light ratio',
    },
  });
}
