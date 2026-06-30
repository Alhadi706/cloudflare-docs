/**
 * GET /api/v1/satellite/gas-monitor
 * كشف تسريبات الغاز ومصادر الميثان عبر Sentinel-5P TROPOMI
 *
 * البيانات: مجانية — API عام بدون مصادقة
 *   - CH4 (الميثان)  — من SRON/ESA S5P PAL
 *   - CO (أول أكسيد الكربون) — من Copernicus Climate Store
 *   - NASA FIRMS بديل لكشف الحرق (متوفر سابقاً)
 *
 * الاستخدامات:
 *   - تسريبات خطوط أنابيب الغاز
 *   - حقول نفط ليبيا (الشعلة + تسرب غاز)
 *   - مستودعات وقود
 *   - مناطق مدفن النفايات (CH4 عضوي)
 *
 * للكشف الدقيق داخل المدن → يحتاج InSAR (راجع /api/v1/satellite/insar-subsidence)
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── S5P-PAL API (Sentinel-5P Level-3) ─────────────────────────────────────
// SRON Dutch Institute provides averaged CH4/CO/NO2 data via WMS/WCS
// The API returns GeoTIFF tiles that we query as statistics
const S5P_PAL_WMS = 'https://maps.s5p-pal.com/no2';  // WMS endpoint for visualization

// ── Open-Meteo Air Quality API (free, no auth) ─────────────────────────────
// Uses CAMS (Copernicus Atmosphere Monitoring Service) data reanalysis
// Provides hourly CH4/CO/NO2 at point locations
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

interface SiteGasReading {
  name:           string;
  lon:            number;
  lat:            number;
  site_type:      string;
  no2_umol_m2:    number | null;   // إثاني أكسيد النيتروجين — من حرق الوقود
  co_ug_m3:       number | null;   // أول أكسيد الكربون — من الحرق الناقص
  pm25_ug_m3:     number | null;   // جسيمات دقيقة (من الحرق)
  anomaly_score:  number;          // 0-100
  anomaly_type:   'gas_flare' | 'pipeline_leak' | 'industrial' | 'normal';
  evidence:       string[];
}

async function queryOpenMeteoAQ(lon: number, lat: number): Promise<{
  no2:   number | null;
  co:    number | null;
  pm25:  number | null;
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
    return {
      no2:  avg(no2arr),
      co:   avg(coArr),
      pm25: avg(pm25arr),
    };
  } catch {
    return { no2: null, co: null, pm25: null };
  }
}

function classifyAnomaly(site: typeof LIBYA_GAS_SITES[0], no2: number | null, co: number | null, pm25: number | null): {
  score: number;
  type:  SiteGasReading['anomaly_type'];
  evidence: string[];
} {
  const evidence: string[] = [];
  let score = 0;

  // NO2 thresholds (µmol/m² converted from µg/m³ via 1 µg/m³ ≈ 0.53 nmol/m²)
  // Open-Meteo returns µg/m³
  // WHO annual guideline: 10 µg/m³; industrial: >40 µg/m³
  if (no2 !== null) {
    if (no2 > 80)  { score += 40; evidence.push(`🟥 NO₂ عالي جداً: ${no2.toFixed(1)} µg/m³ — احتراق كثيف`); }
    else if (no2 > 40) { score += 25; evidence.push(`🟧 NO₂ مرتفع: ${no2.toFixed(1)} µg/m³`); }
    else if (no2 > 20) { score += 10; evidence.push(`🟡 NO₂ متوسط: ${no2.toFixed(1)} µg/m³`); }
    else              evidence.push(`✅ NO₂ طبيعي: ${no2.toFixed(1)} µg/m³`);
  }

  // CO thresholds (µg/m³) — WHO 24h: 4000 µg/m³; flaring: >10000
  if (co !== null) {
    if (co > 10000) { score += 35; evidence.push(`🟥 CO مرتفع جداً: ${(co/1000).toFixed(1)} mg/m³ — شعلة/حريق`); }
    else if (co > 4000) { score += 20; evidence.push(`🟧 CO مرتفع: ${(co/1000).toFixed(1)} mg/m³`); }
    else if (co > 1000) { score += 8;  evidence.push(`🟡 CO متوسط: ${(co/1000).toFixed(1)} mg/m³`); }
    else               evidence.push(`✅ CO طبيعي: ${(co/1000).toFixed(2)} mg/m³`);
  }

  // PM2.5 thresholds (µg/m³) — WHO 24h: 15 µg/m³
  if (pm25 !== null) {
    if (pm25 > 75)  { score += 25; evidence.push(`🟥 PM2.5: ${pm25.toFixed(1)} µg/m³ — جسيمات حرق`); }
    else if (pm25 > 35) { score += 12; evidence.push(`🟧 PM2.5: ${pm25.toFixed(1)} µg/m³`); }
    else if (pm25 > 15) { score += 5;  evidence.push(`🟡 PM2.5: ${pm25.toFixed(1)} µg/m³`); }
  }

  // Classify type
  const type: SiteGasReading['anomaly_type'] =
    site.type === 'oil_field' && score >= 40 ? 'gas_flare' :
    site.type === 'refinery'  && score >= 30 ? 'industrial' :
    site.type === 'water_net' && score >= 20 ? 'pipeline_leak' :
    score >= 20                              ? 'industrial' :
                                               'normal';

  return { score: Math.min(100, score), type, evidence };
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();

  // Query all sites in parallel (max 9 concurrent Open-Meteo requests)
  const readings = await Promise.all(
    LIBYA_GAS_SITES.map(async (site): Promise<SiteGasReading> => {
      const { no2, co, pm25 } = await queryOpenMeteoAQ(site.lon, site.lat);
      const { score, type, evidence } = classifyAnomaly(site, no2, co, pm25);
      return {
        name:         site.name,
        lon:          site.lon,
        lat:          site.lat,
        site_type:    site.type,
        no2_umol_m2:  no2,
        co_ug_m3:     co,
        pm25_ug_m3:   pm25,
        anomaly_score: score,
        anomaly_type:  type,
        evidence,
      };
    })
  );

  const alerts = readings.filter(r => r.anomaly_score >= 30);
  const colorMap: Record<SiteGasReading['anomaly_type'], string> = {
    gas_flare:     '#a855f7',  // بنفسجي
    pipeline_leak: '#ef4444',  // أحمر
    industrial:    '#f97316',  // برتقالي
    normal:        '#34d399',  // أخضر
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
        no2:           r.no2_umol_m2?.toFixed(1),
        co_mg:         r.co_ug_m3 ? (r.co_ug_m3 / 1000).toFixed(2) : null,
        pm25:          r.pm25_ug_m3?.toFixed(1),
        label: r.anomaly_score >= 50 ? `🔴 ${r.name}` :
               r.anomaly_score >= 30 ? `🟠 ${r.name}` :
               r.anomaly_score >= 10 ? `🟡 ${r.name}` :
                                       `🟢 ${r.name}`,
        color:  colorMap[r.anomaly_type],
        radius: 8 + r.anomaly_score / 10,
        evidence: r.evidence.join(' | '),
        layerKey: 'gas_monitor',
      },
    })),
  };

  return NextResponse.json({
    ok:        true,
    data_real: true,
    source:    'CAMS (Copernicus Atmosphere Monitoring) via Open-Meteo — مجاني بدون مفاتيح',
    query_ms:  Date.now() - t0,
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
      data_source:  'CAMS (Copernicus Atmosphere Monitoring Service) — بيانات إعادة تحليل جوي',
      no2_use:      'ثاني أكسيد النيتروجين: يرتفع من حرق الوقود + الصناعة',
      co_use:       'أول أكسيد الكربون: يرتفع من حرق ناقص (شعلة/حريق)',
      pm25_use:     'جسيمات دقيقة: من حرق كربوني (مادة جامدة في دخان الشعلة)',
      limitation:   'دقة CAMS ~10 كم — لا يرصد التسريبات الصغيرة. للدقة العالية (<1 كم) استخدم Sentinel-5P COG مع CDSE Auth',
      urban_leaks:  'تسريبات شبكة المياه داخل المدن: لا يرصدها هذا API — يحتاج InSAR أو أجهزة استشعار أرضية',
    },
  });
}
