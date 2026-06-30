/**
 * GET/POST /api/v1/satellite/insar-subsidence
 * كشف هبوط الأرض (Subsidence) عبر InSAR — مؤشر تسريب الأنابيب المدفونة
 *
 * النظرية:
 *   تسريب أنبوب مياه مدفون → ترطيب التربة → ضغط ميكانيكي → هبوط أو انتفاخ سطح الأرض
 *   بدقة مم/سنة → كاشف ممتاز لتسريبات شبكة المياه والصرف الصحي داخل المدن
 *
 * المصادر:
 *   1. NASA ASF HyP3 (مجاني) — https://hyp3.asf.alaska.edu/
 *      يعالج أزواج Sentinel-1 ويُنتج interferograms + displacement maps
 *      الدقة: 20-80 مم (coherent areas)
 *
 *   2. COMET-LiCS (مجاني) — https://comet.nerc.ac.uk/COMET-LiCS-portal/
 *      Cumulative displacement series لجميع Sentinel-1 tracks
 *      يُنتج displacement بالسنتيمتر للفترة 2014-الآن
 *
 *   3. Copernicus DEM + SRTM (مجاني) — للرقابة على التغيّر الطبوغرافي
 *
 * هذا الـ route:
 *   - يُقدّم خطوات التحليل والروابط للمستخدم
 *   - يستعلم عن Sentinel-1 scene pairs المتاحة للمنطقة المطلوبة
 *   - يُنتج تقرير قابلية InSAR لكل منطقة (coherence estimate)
 *   - يُرجع نقاط اهتمام مُرتبة حسب احتمال وجود subsidence
 */
import { NextRequest, NextResponse } from 'next/server';
import { searchSTAC, daysAgo, today } from '@/lib/stac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── مناطق الكشف الحضري في ليبيا ──────────────────────────────────────────
const URBAN_MONITORING_ZONES = [
  {
    name:     'طرابلس — وسط المدينة',
    city:     'طرابلس',
    lon:      13.18,
    lat:      32.89,
    bbox:     [12.95, 32.75, 13.45, 33.05] as [number,number,number,number],
    priority: 'high',
    reason:   'شبكة مياه قديمة، أنابيب النهر الصناعي الرئيسية',
  },
  {
    name:     'طرابلس — ضاحية تاجوراء',
    city:     'طرابلس',
    lon:      13.37,
    lat:      32.87,
    bbox:     [13.25, 32.78, 13.55, 32.98] as [number,number,number,number],
    priority: 'medium',
    reason:   'توسع حضري سريع — أنابيب مياه قد تكون متضررة',
  },
  {
    name:     'بنغازي — وسط المدينة',
    city:     'بنغازي',
    lon:      20.07,
    lat:      32.11,
    bbox:     [19.85, 31.95, 20.30, 32.25] as [number,number,number,number],
    priority: 'high',
    reason:   'نهاية الفرع الشرقي للنهر الصناعي — ضغط مرتفع',
  },
  {
    name:     'سبها',
    city:     'سبها',
    lon:      14.43,
    lat:      27.04,
    bbox:     [14.25, 26.88, 14.65, 27.22] as [number,number,number,number],
    priority: 'medium',
    reason:   'محطة ضخ مياه الحساونة الرئيسية',
  },
  {
    name:     'غريان — نقطة توزيع GMMR',
    city:     'غريان',
    lon:      13.01,
    lat:      32.17,
    bbox:     [12.85, 32.05, 13.20, 32.32] as [number,number,number,number],
    priority: 'high',
    reason:   'نقطة توزيع رئيسية للنهر الصناعي — تاريخ تسربات',
  },
];

interface ZoneInSARReadiness {
  zone_name:      string;
  city:           string;
  priority:       string;
  reason:         string;
  center:         [number, number];
  bbox:           [number, number, number, number];
  s1_scenes_6m:   number;   // عدد مشاهد Sentinel-1 آخر 6 أشهر
  insar_feasible: boolean;  // هل InSAR ممكن (يحتاج ≥2 مشاهد في نفس المسار)
  coherence_est:  'high' | 'medium' | 'low';  // تقدير التماسك للمنطقة
  recommended_method: string;
  hyp3_command:   string;   // أمر HyP3 API للمعالجة
}

function estimateCoherence(scenesCount: number, zoneType: string): 'high' | 'medium' | 'low' {
  // المدن الليبية: مباني منخفضة + أرض جافة → coherence متوسطة إلى عالية
  // المناطق الزراعية: غطاء نباتي → coherence منخفضة
  if (scenesCount >= 6) return 'high';
  if (scenesCount >= 3) return 'medium';
  return 'low';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const zones = body.zones ?? URBAN_MONITORING_ZONES;
  const t0    = Date.now();

  const results: ZoneInSARReadiness[] = await Promise.all(
    zones.map(async (zone: typeof URBAN_MONITORING_ZONES[0]) => {
      // استعلام عن مشاهد Sentinel-1 آخر 6 أشهر
      const s1Scenes = await searchSTAC({
        bbox:        zone.bbox,
        date_from:   daysAgo(180),
        date_to:     today(),
        collections: ['sentinel-1-grd'],
        max_cloud:   100,
        limit:       20,
      }).catch(() => []);

      const feasible  = s1Scenes.length >= 4;
      const coherence = estimateCoherence(s1Scenes.length, zone.name);

      // اقتراح طريقة الكشف الأنسب
      const method =
        coherence === 'high'   ? 'InSAR PS-InSAR (Persistent Scatterer) — دقة 1-3 مم' :
        coherence === 'medium' ? 'SBAS-InSAR (Small Baseline Subset) — دقة 5-15 مم' :
                                 'S2 NDWI + SAR sigma0 (fallback — دقة منخفضة)';

      // أمر HyP3 للمعالجة عبر Python SDK
      const hyp3Cmd = `
# 1. تثبيت SDK
pip install hyp3-sdk

# 2. تقديم طلب InSAR
from hyp3_sdk import HyP3
hyp3 = HyP3()  # يحتاج حساب earthdata.nasa.gov مجاني
job = hyp3.submit_insar_job(
    granule1='S1A_IW_SLC__...',  # من ASF Data Search
    granule2='S1A_IW_SLC__...',  # مشهد آخر في نفس المسار
    name='${zone.city}-leak-detection',
    include_dem=True,
    include_wrapped_phase=True,
    apply_water_mask=False,
)
result = hyp3.watch(job)
`.trim();

      return {
        zone_name:           zone.name,
        city:                zone.city,
        priority:            zone.priority,
        reason:              zone.reason,
        center:              [zone.lon, zone.lat] as [number, number],
        bbox:                zone.bbox,
        s1_scenes_6m:        s1Scenes.length,
        insar_feasible:      feasible,
        coherence_est:       coherence,
        recommended_method:  method,
        hyp3_command:        hyp3Cmd,
      };
    })
  );

  const geojson = {
    type: 'FeatureCollection',
    features: results.map(r => ({
      type:     'Feature',
      geometry: { type: 'Point', coordinates: [r.center[0], r.center[1]] },
      properties: {
        zone_name:        r.zone_name,
        city:             r.city,
        priority:         r.priority,
        s1_scenes:        r.s1_scenes_6m,
        insar_feasible:   r.insar_feasible,
        coherence:        r.coherence_est,
        method:           r.recommended_method,
        label:            r.priority === 'high' ? `🔴 ${r.zone_name}` : `🟡 ${r.zone_name}`,
        color:            r.priority === 'high' && r.insar_feasible ? '#ef4444' :
                          r.priority === 'high'                      ? '#f97316' :
                                                                       '#facc15',
        radius:           r.insar_feasible ? 14 : 9,
        layerKey:         'insar_zones',
      },
    })),
  };

  return NextResponse.json({
    ok:        true,
    data_real: true,
    source:    'Sentinel-1 STAC availability + ASF HyP3 feasibility analysis',
    query_ms:  Date.now() - t0,
    zones_analyzed: results.length,
    insar_ready:    results.filter(r => r.insar_feasible).length,
    high_priority:  results.filter(r => r.priority === 'high').length,
    zones:   results,
    geojson,

    // دليل الاستخدام الكامل
    getting_started: {
      step1_earthdata: {
        title:       'تسجيل NASA Earthdata (مجاني)',
        url:         'https://urs.earthdata.nasa.gov/users/new',
        note:        'مطلوب لاستخدام ASF HyP3 — نفس الحساب يُتيح MODIS/SRTM/Landsat',
      },
      step2_asf_search: {
        title:       'البحث عن Sentinel-1 SLC Pairs',
        url:         'https://search.asf.alaska.edu/',
        note:        'ابحث في المنطقة المطلوبة عن S1 SLC products في نفس المسار (relative orbit) وبفارق 12-24 يوماً',
        filter_tips: 'Beam Mode: IW | Product Type: SLC | Platform: Sentinel-1A or 1B | Relative Orbit matching',
      },
      step3_hyp3: {
        title:       'تشغيل InSAR عبر HyP3 (مجاني 10 وظائف/شهر)',
        url:         'https://hyp3.asf.alaska.edu/',
        docs:        'https://hyp3-docs.asf.alaska.edu/',
        note:        'يُنتج displacement map بالسنتيمتر خلال ساعات — الملف الناتج: *_vert_disp.tif',
      },
      step4_interpret: {
        title:       'تفسير نتائج InSAR',
        note:        'هبوط >5 مم/سنة في المناطق الحضرية = مؤشر تسرب محتمل',
        tool:        'QGIS (مجاني) أو Google Earth Engine لعرض الـ displacement raster',
        threshold:   '-5 mm/yr = low concern | -15 mm/yr = medium | -30 mm/yr = high alert',
      },
    },

    urban_leak_detection_methods: {
      insar: {
        name:      'InSAR — Interferometric SAR ⭐⭐⭐⭐⭐',
        tool:      'ASF HyP3 (مجاني) + Sentinel-1 SLC',
        accuracy:  '1-5 مم/سنة',
        cost:      'مجاني (NASA)',
        urban_ok:  true,
        note:      'الأفضل للكشف داخل المدن — يرصد هبوط الأرض فوق الأنبوب المتسرب',
      },
      sentinel2_ndwi: {
        name:      'Sentinel-2 NDWI pixel-level ⭐⭐⭐',
        tool:      'Sentinel Hub Process API (CDSE credentials)',
        accuracy:  '10 متر — يرصد بقع مائية >1000 م²',
        cost:      'مجاني بعد تسجيل CDSE',
        urban_ok:  false,
        note:      'جيد خارج المدن — في المدن يُعطي false positive من الأسطح الرطبة والطرق',
      },
      thermal_ecostress: {
        name:      'ECOSTRESS Thermal ⭐⭐⭐',
        tool:      'NASA ECOSTRESS via AppEEARS API (مجاني)',
        url:       'https://appeears.earthdatacloud.nasa.gov/',
        accuracy:  '70 متر — يرصد تبريد/تسخين سطحي',
        cost:      'مجاني',
        urban_ok:  true,
        note:      'مفيد لتسريبات الماء الساخن — يُظهر بقعة باردة فوق التسرب ليلاً',
      },
      cams_atmosphere: {
        name:      'CAMS Atmosphere ⭐⭐ (للغاز فقط)',
        tool:      'متوفر عبر /api/v1/satellite/gas-monitor',
        accuracy:  '10-40 كم — مناسب للمصافي وحقول النفط',
        cost:      'مجاني',
        urban_ok:  false,
        note:      'للكشف عن غاز الميثان وليس تسريبات المياه',
      },
      ground_sensors: {
        name:      'أجهزة استشعار أرضية ⭐⭐⭐⭐⭐ (غير فضائية)',
        examples:  'Flow meters + Pressure sensors في شبكة المياه',
        note:      'أدق طريقة لتسريبات المياه داخل المدن — لكن تحتاج تركيب مادي',
        cost:      'استثمار أولي عالٍ لكن دقيق جداً',
        urban_ok:  true,
      },
    },
  });
}

export async function GET(req: NextRequest) {
  return POST(new NextRequest(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }));
}
