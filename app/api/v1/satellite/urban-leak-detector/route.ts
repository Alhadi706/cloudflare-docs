/**
 * POST /api/v1/satellite/urban-leak-detector
 * كشف تسريبات شبكات المياه داخل المدن الليبية
 *
 * يختلف عن النهر الصناعي بأنه يراقب:
 *  - شبكات التوزيع الحضرية (أنابيب قطر أصغر)
 *  - محطات الضخ والمعالجة داخل المدن
 *  - التسريبات الصغيرة (<100م²) التي لا تظهر في مستوى الـ tile
 *
 * طرق الكشف:
 *  1. NDWI pixel-level — بقع مائية غير طبيعية في المناطق الحضرية
 *  2. NDMI (رطوبة التربة) — تسريب تحت الرصيف يرفع رطوبة التربة
 *  3. SAR Sigma0 — تغيرات backscatter من حفر شوارع (صيانة طارئة)
 *  4. Historical trend — تراكم دليل عبر 18 شهراً
 */
import { NextRequest, NextResponse } from 'next/server';
import { searchSTAC, daysAgo, today } from '@/lib/stac';
import {
  hasCDSECredentials,
  computeNDWI,
  computeNDMI,
  computeSARSigma0,
} from '@/lib/sentinel-hub';

// ═══════════════════════════════════════════════════════════════════════════════
// مناطق الرصد الحضرية — شبكات المياه في المدن الليبية الرئيسية
// ═══════════════════════════════════════════════════════════════════════════════

interface UrbanZone {
  id:       string;
  name:     string;
  city:     string;
  type:     'distribution' | 'pumping_station' | 'treatment_plant' | 'reservoir';
  bbox:     [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  priority: 'high' | 'medium' | 'low';
}

export const URBAN_WATER_ZONES: UrbanZone[] = [
  // ── طرابلس ──────────────────────────────────────────────────────────────
  {
    id: 'tpl_ayn_zara',
    name: 'طرابلس — عين زارة (محطة ضخ رئيسية)',
    city: 'طرابلس',
    type: 'pumping_station',
    bbox: [13.18, 32.79, 13.32, 32.87],
    priority: 'high',
  },
  {
    id: 'tpl_janzur',
    name: 'طرابلس — جنزور (شبكة توزيع غرب)',
    city: 'طرابلس',
    type: 'distribution',
    bbox: [12.94, 32.83, 13.09, 32.94],
    priority: 'high',
  },
  {
    id: 'tpl_fashloum',
    name: 'طرابلس — فشلوم (شبكة مركز المدينة)',
    city: 'طرابلس',
    type: 'distribution',
    bbox: [13.17, 32.83, 13.28, 32.89],
    priority: 'high',
  },
  {
    id: 'tpl_tajura',
    name: 'طرابلس — تاجوراء (شبكة توزيع شرق)',
    city: 'طرابلس',
    type: 'distribution',
    bbox: [13.34, 32.82, 13.49, 32.88],
    priority: 'medium',
  },
  // ── بنغازي ──────────────────────────────────────────────────────────────
  {
    id: 'bgz_center',
    name: 'بنغازي — الوسط (شبكة المدينة المركزية)',
    city: 'بنغازي',
    type: 'distribution',
    bbox: [20.01, 32.06, 20.17, 32.22],
    priority: 'high',
  },
  {
    id: 'bgz_benina',
    name: 'بنغازي — بنينا (محطة معالجة شرق)',
    city: 'بنغازي',
    type: 'treatment_plant',
    bbox: [20.19, 32.03, 20.38, 32.18],
    priority: 'medium',
  },
  {
    id: 'bgz_salmani',
    name: 'بنغازي — السلماني (خزانات التوزيع)',
    city: 'بنغازي',
    type: 'reservoir',
    bbox: [20.04, 32.09, 20.16, 32.20],
    priority: 'medium',
  },
  // ── مصراتة ──────────────────────────────────────────────────────────────
  {
    id: 'msr_industrial',
    name: 'مصراتة — المنطقة الصناعية (شبكة مياه)',
    city: 'مصراتة',
    type: 'distribution',
    bbox: [15.00, 32.35, 15.28, 32.52],
    priority: 'medium',
  },
  {
    id: 'msr_port',
    name: 'مصراتة — الميناء (محطة ضخ بحرية)',
    city: 'مصراتة',
    type: 'pumping_station',
    bbox: [15.10, 32.47, 15.30, 32.60],
    priority: 'medium',
  },
  // ── الزاوية ─────────────────────────────────────────────────────────────
  {
    id: 'zwi_refinery',
    name: 'الزاوية — مصفاة النفط (شبكة المياه الصناعية)',
    city: 'الزاوية',
    type: 'distribution',
    bbox: [12.69, 32.74, 12.85, 32.88],
    priority: 'high',
  },
  // ── سبها ────────────────────────────────────────────────────────────────
  {
    id: 'sbh_main',
    name: 'سبها — الشبكة الرئيسية (مدينة سبها)',
    city: 'سبها',
    type: 'distribution',
    bbox: [14.38, 27.00, 14.54, 27.14],
    priority: 'medium',
  },
  // ── غريان ───────────────────────────────────────────────────────────────
  {
    id: 'ghr_plateau',
    name: 'غريان — جبل نفوسة (خزانات الهضبة)',
    city: 'غريان',
    type: 'reservoir',
    bbox: [13.00, 32.15, 13.20, 32.30],
    priority: 'medium',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// واجهة نتيجة تحليل المنطقة الحضرية
// ═══════════════════════════════════════════════════════════════════════════════

interface UrbanZoneResult {
  zone_id:          string;
  zone_name:        string;
  city:             string;
  zone_type:        string;
  center:           [number, number];
  bbox:             [number, number, number, number];
  priority:         string;
  confidence_pct:   number;
  leak_probability: 'none' | 'low' | 'medium' | 'high' | 'confirmed';
  evidence:         string[];
  scores: {
    ndwi_anomaly:   number;
    ndmi_anomaly:   number;
    sar_disturbance:number;
    historical:     number;
  };
}

function classifyLeak(pct: number): UrbanZoneResult['leak_probability'] {
  if (pct >= 70) return 'confirmed';
  if (pct >= 45) return 'high';
  if (pct >= 20) return 'medium';
  if (pct >= 8)  return 'low';
  return 'none';
}

async function analyzeUrbanZone(
  zone: UrbanZone,
  windowDays: number,
): Promise<UrbanZoneResult> {
  const todayStr = today();
  const center: [number, number] = [
    (zone.bbox[0] + zone.bbox[2]) / 2,
    (zone.bbox[1] + zone.bbox[3]) / 2,
  ];
  const scores = { ndwi_anomaly: 0, ndmi_anomaly: 0, sar_disturbance: 0, historical: 0 };
  const evidence: string[] = [];

  const useSH = hasCDSECredentials();

  // ── STAC: SAR scenes (detect ground disturbance from pipe repair) ─────────
  const [sarRecent, sarBaseline, s2Hist1, s2Hist2] = await Promise.all([
    searchSTAC({ bbox: zone.bbox, date_from: daysAgo(windowDays), date_to: todayStr, collections: ['sentinel-1-grd'], max_cloud: 100, limit: 4 }).catch(() => []),
    searchSTAC({ bbox: zone.bbox, date_from: daysAgo(windowDays * 2), date_to: daysAgo(windowDays), collections: ['sentinel-1-grd'], max_cloud: 100, limit: 4 }).catch(() => []),
    searchSTAC({ bbox: zone.bbox, date_from: daysAgo(540), date_to: daysAgo(365), collections: ['sentinel-2-l2a'], max_cloud: 40, limit: 3 }).catch(() => []),
    searchSTAC({ bbox: zone.bbox, date_from: daysAgo(365), date_to: daysAgo(180), collections: ['sentinel-2-l2a'], max_cloud: 40, limit: 3 }).catch(() => []),
  ]);

  // ── Sentinel Hub pixel-level (NDWI + NDMI + SAR) ─────────────────────────
  if (useSH) {
    const [ndwi, ndmi, sar] = await Promise.all([
      computeNDWI(zone.bbox, daysAgo(windowDays + 45), todayStr).catch(() => null),
      computeNDMI(zone.bbox, daysAgo(windowDays + 45), todayStr).catch(() => null),
      computeSARSigma0(zone.bbox, daysAgo(windowDays + 45), todayStr).catch(() => null),
    ]);

    // NDWI in urban context: urban areas have higher baseline (~-0.15) than desert (-0.4)
    // Any NDWI max > 0.2 in urban context = possible standing water from leak
    if (ndwi?.ok && ndwi.ndwi_mean !== null) {
      const mean = ndwi.ndwi_mean;
      const max  = ndwi.ndwi_max ?? mean;
      if (max > 0.4) {
        scores.ndwi_anomaly = 35;
        evidence.push(`💧 NDWI max=${max.toFixed(3)} — مسطح مائي كبير في المدينة! (تسرب كبير أو انفجار شبكة)`);
      } else if (max > 0.15) {
        scores.ndwi_anomaly = 25;
        evidence.push(`💧 NDWI max=${max.toFixed(3)} — وجود ماء حر في المنطقة الحضرية (mean=${mean.toFixed(3)})`);
      } else if (max > -0.05 && mean < -0.1) {
        scores.ndwi_anomaly = 18;
        evidence.push(`🔍 NDWI max=${max.toFixed(3)} (mean=${mean.toFixed(3)}) — بقعة رطبة موضعية داخل المدينة`);
      } else if (mean > 0.0) {
        scores.ndwi_anomaly = 12;
        evidence.push(`💦 NDWI mean=${mean.toFixed(3)} — رطوبة فوق المعدل الحضري (>0 غير طبيعي في مناطق المدينة الجافة)`);
      }
    }

    // NDMI (soil moisture): urban soil under pavement has very low NDMI (-0.5 to -0.3)
    // NDMI > -0.15 in urban = water percolating through pavement/soil
    if (ndmi?.ok && ndmi.ndmi_mean !== null) {
      const ndmiMean = ndmi.ndmi_mean;
      if (ndmiMean > -0.05) {
        scores.ndmi_anomaly = 30;
        evidence.push(`💦 NDMI رطوبة التربة: ${ndmiMean.toFixed(3)} — تشبع مائي في التربة الحضرية! (تسرب قوي مستمر)`);
      } else if (ndmiMean > -0.18) {
        scores.ndmi_anomaly = 20;
        evidence.push(`💦 NDMI: ${ndmiMean.toFixed(3)} — رطوبة تربة غير طبيعية تحت الرصيف الحضري`);
      } else if (ndmiMean > -0.28) {
        scores.ndmi_anomaly = 10;
        evidence.push(`💦 NDMI: ${ndmiMean.toFixed(3)} — رطوبة خفيفة فوق المعدل`);
      }
    }

    // SAR: new road excavation/repair shows as coherence change
    // High VV in urban areas can indicate wet pavement or excavated soil
    if (sar?.ok && sar.vv_db_mean !== null) {
      const vv = sar.vv_db_mean;
      if (vv > -8) {
        scores.sar_disturbance = 20;
        evidence.push(`📡 SAR VV: ${vv.toFixed(1)} dB — شذوذ رادار حضري مرتفع (حفر أو تشبع مائي)`);
      } else if (vv > -12) {
        scores.sar_disturbance = 10;
        evidence.push(`📡 SAR VV: ${vv.toFixed(1)} dB — نشاط رادار فوق المعدل الحضري`);
      }
    }
  }

  // ── SAR scene frequency (fallback) ────────────────────────────────────────
  if (!useSH && sarRecent.length > 0) {
    if (sarRecent.length > sarBaseline.length + 1) {
      scores.sar_disturbance = 8;
      evidence.push(`📡 نشاط SAR متزايد (${sarRecent.length} مشاهد حديثة مقابل ${sarBaseline.length} مرجعية)`);
    }
  }

  // ── Historical trend (S2 water pixel count proxy) ─────────────────────────
  const hist1Water = s2Hist1[0]?.statistics?.water_pct ?? null;
  const hist2Water = s2Hist2[0]?.statistics?.water_pct ?? null;
  if (hist1Water !== null && hist2Water !== null && hist2Water > hist1Water + 0.02) {
    scores.historical = 10;
    evidence.push(`📈 اتجاه تصاعدي في بيانات الرطوبة عبر 18 شهراً — مشكلة مزمنة`);
  }

  const confidence_pct = Math.min(100,
    scores.ndwi_anomaly + scores.ndmi_anomaly +
    scores.sar_disturbance + scores.historical,
  );

  return {
    zone_id:          zone.id,
    zone_name:        zone.name,
    city:             zone.city,
    zone_type:        zone.type,
    center,
    bbox:             zone.bbox,
    priority:         zone.priority,
    confidence_pct,
    leak_probability: classifyLeak(confidence_pct),
    evidence,
    scores,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));
  const city_filter: string | null = body.city ?? null;

  const zones = city_filter
    ? URBAN_WATER_ZONES.filter(z => z.city === city_filter)
    : URBAN_WATER_ZONES;

  // Analyze all zones in parallel (urban zones are small → fast SH calls)
  const results = await Promise.all(
    zones.map(z => analyzeUrbanZone(z, 45))
  );

  const alertZones = results.filter(r => r.leak_probability !== 'none' && r.confidence_pct >= 20);
  const confirmedCount = results.filter(r => r.leak_probability === 'confirmed').length;
  const highCount      = results.filter(r => r.leak_probability === 'high').length;
  const cities = [...new Set(results.map(r => r.city))];

  return NextResponse.json({
    ok:   true,
    source: 'Sentinel-2/1 CDSE + SH_Statistical_API',
    sentinel_hub_active: hasCDSECredentials(),
    query_ms: Date.now() - t0,
    zones_count:      results.length,
    cities_monitored: cities,
    summary: {
      confirmed_leaks: confirmedCount,
      high_risk:       highCount,
      alert_zones:     alertZones.length,
    },
    alert_zones: alertZones,
    zones:       results,
    // GeoJSON for map rendering
    geojson: {
      type: 'FeatureCollection',
      features: results
        .filter(r => r.leak_probability !== 'none')
        .map(r => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.center[0], r.center[1]] },
          properties: {
            id:           r.zone_id,
            name:         r.zone_name,
            city:         r.city,
            confidence:   r.confidence_pct,
            risk:         r.leak_probability,
            evidence:     r.evidence.join(' | '),
            color: r.leak_probability === 'confirmed' ? '#ef4444'
                 : r.leak_probability === 'high'      ? '#f97316'
                 : r.leak_probability === 'medium'    ? '#facc15'
                 : '#34d399',
          },
        })),
    },
  });
}

export async function GET() {
  return NextResponse.json({
    ok:     true,
    cities: [...new Set(URBAN_WATER_ZONES.map(z => z.city))],
    zones:  URBAN_WATER_ZONES.map(({ id, name, city, type, priority }) => ({ id, name, city, type, priority })),
  });
}
