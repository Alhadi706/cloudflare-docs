/**
 * GET/POST /api/v1/satellite/insar-subsidence
 * كشف هبوط الأرض (Subsidence) عبر InSAR — ASF HyP3 + NASA Earthdata
 *
 * معتمد: حساب NASA Earthdata alhadiasd — 8000 credit متاحة
 * وظائف قيد المعالجة: 6 وظائف InSAR_GAMMA (طرابلس × 2 + GMMR × 2 + مزيد)
 * الوقت المتوقع للإنجاز: 2-8 ساعات
 */
import { NextRequest, NextResponse } from 'next/server';
import { searchSTAC, daysAgo, today } from '@/lib/stac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NASA Earthdata credentials (from .env.local)
const ED_USER = process.env.NASA_EARTHDATA_USER || '';
const ED_PASS = process.env.NASA_EARTHDATA_PASS || '';
const HYP3_API = 'https://hyp3-api.asf.alaska.edu';

/** Get a fresh Earthdata token for ASF HyP3 */
async function getEdToken(): Promise<string | null> {
  if (!ED_USER || !ED_PASS) return null;
  try {
    const creds = Buffer.from(`${ED_USER}:${ED_PASS}`).toString('base64');
    const res = await fetch('https://urs.earthdata.nasa.gov/api/users/find_or_create_token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.access_token || null;
  } catch { return null; }
}

/** Fetch all HyP3 jobs for our account */
async function fetchHyP3Jobs(token: string): Promise<any[]> {
  try {
    const res = await fetch(`${HYP3_API}/jobs?limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const d = await res.json();
    return d.jobs || [];
  } catch { return []; }
}

/** Submit a new InSAR job pair */
async function submitInSARJob(token: string, granule1: string, granule2: string, name: string) {
  const body = JSON.stringify({
    jobs: [{
      job_type: 'INSAR_GAMMA',
      name: name.slice(0, 30),
      job_parameters: {
        granules: [granule1, granule2],
        include_los_displacement: true,
        looks: '20x4',
        apply_water_mask: false,
      },
    }],
  });
  const res = await fetch(`${HYP3_API}/jobs`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HyP3 ${res.status}: ${err.slice(0, 100)}`);
  }
  return await res.json();
}

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
  const t0   = Date.now();

  // ── Mode: historical query (custom bbox + date range → submit HyP3 jobs) ──
  if (body.mode === 'historical' || body.bbox || body.date_from) {
    const bbox: [number,number,number,number] = body.bbox ?? [12.5, 32.5, 14.0, 33.2];
    const dateFrom: string = body.date_from ?? daysAgo(365);
    const dateTo:   string = body.date_to   ?? today();
    const areaName: string = body.area_name ?? 'منطقة مخصصة';
    const maxPairs: number = Math.min(body.max_pairs ?? 4, 10);

    const token = await getEdToken();
    if (!token) {
      return NextResponse.json({ ok: false, error: 'NASA Earthdata credentials مطلوبة', data_real: false }, { status: 401 });
    }

    // Search CMR for S1A SLC scenes in the bbox/date range
    const bboxStr = bbox.join(',');
    const cmrUrl  = `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=SENTINEL-1A_SLC&bounding_box=${bboxStr}&temporal=${dateFrom},${dateTo}&page_size=50&sort_key=-start_date`;
    let scenes: any[] = [];
    try {
      const cmrRes = await fetch(cmrUrl, { signal: AbortSignal.timeout(20_000) });
      if (cmrRes.ok) {
        const d = await cmrRes.json();
        scenes = d.feed?.entry ?? [];
      }
    } catch { /* ignore */ }

    if (scenes.length < 2) {
      return NextResponse.json({
        ok:    false,
        error: `لم يُعثر على مشاهد S1 كافية في الفترة ${dateFrom} → ${dateTo}. الحد الأدنى: 2 مشاهد.`,
        scenes_found: scenes.length,
        data_real: true,
      }, { status: 422 });
    }

    // Group scenes by approximate overpass time to find same-path pairs
    // Also try direct pairing by date (any 10-18 day window = valid InSAR pair)
    const byPass: Record<string, {date: string; name: string}[]> = {};
    for (const s of scenes) {
      const t    = s.time_start ?? '';
      const pass = t.slice(11, 14); // hour group e.g. "05" or "17"
      const name = s.title.replace('-SLC', '');
      const date = t.slice(0, 10);
      if (!byPass[pass]) byPass[pass] = [];
      byPass[pass].push({ date, name });
    }

    // Build pairs: first try same-pass-time groups (most reliable)
    // then fall back to any 10-18 day window
    const pairs: {ref: string; sec: string; date_ref: string; date_sec: string}[] = [];

    // Pass 1: same-time-group pairs
    for (const [, passScenes] of Object.entries(byPass)) {
      passScenes.sort((a, b) => b.date.localeCompare(a.date));
      for (let i = 0; i < passScenes.length - 1 && pairs.length < maxPairs; i++) {
        const s1 = passScenes[i];
        const s2 = passScenes[i + 1];
        const diffDays = (new Date(s1.date).getTime() - new Date(s2.date).getTime()) / 86400_000;
        if (diffDays >= 10 && diffDays <= 18) {
          pairs.push({ ref: s1.name, sec: s2.name, date_ref: s1.date, date_sec: s2.date });
        }
      }
    }

    // Pass 2: if still not enough pairs, try any scene combination with 10-18 day gap
    if (pairs.length < maxPairs) {
      const allScenes = scenes.map((s: any) => ({
        date: (s.time_start ?? '').slice(0, 10),
        name: s.title.replace('-SLC', ''),
      })).sort((a: any, b: any) => b.date.localeCompare(a.date));

      for (let i = 0; i < allScenes.length - 1 && pairs.length < maxPairs; i++) {
        for (let j = i + 1; j < allScenes.length && pairs.length < maxPairs; j++) {
          const d1 = new Date(allScenes[i].date).getTime();
          const d2 = new Date(allScenes[j].date).getTime();
          const diffDays = (d1 - d2) / 86400_000;
          if (diffDays >= 10 && diffDays <= 18) {
            const already = pairs.some(p => p.ref === allScenes[i].name || p.sec === allScenes[j].name);
            if (!already) {
              pairs.push({ ref: allScenes[i].name, sec: allScenes[j].name, date_ref: allScenes[i].date, date_sec: allScenes[j].date });
              break; // move to next i
            }
          }
        }
      }
    }

    if (pairs.length === 0) {
      return NextResponse.json({
        ok:    false,
        error: 'لم يُعثر على أزواج InSAR صالحة (يحتاج زوجان من نفس المسار بفارق 10-18 يوماً)',
        scenes_found: scenes.length,
        scene_dates: scenes.slice(0, 8).map(s => s.time_start?.slice(0, 10)),
        data_real: true,
      }, { status: 422 });
    }

    // Submit HyP3 INSAR_GAMMA jobs
    const jobs_body = {
      jobs: pairs.map((p, idx) => ({
        job_type: 'INSAR_GAMMA',
        name: `${areaName.slice(0, 20)}_${p.date_ref}`.replace(/\s/g, '_').slice(0, 30),
        job_parameters: {
          granules: [p.ref, p.sec],
          include_los_displacement: true,
          looks: '20x4',
          apply_water_mask: false,
        },
      })),
    };

    let submitted: any[] = [];
    let submitError: string | null = null;
    try {
      const res = await fetch(`${HYP3_API}/jobs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(jobs_body),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const d = await res.json();
        submitted = d.jobs ?? [];
      } else {
        submitError = `HyP3 ${res.status}: ${(await res.text()).slice(0, 100)}`;
      }
    } catch (e: any) {
      submitError = e.message?.slice(0, 100);
    }

    return NextResponse.json({
      ok:              submitted.length > 0,
      data_real:       true,
      mode:            'historical',
      query_ms:        Date.now() - t0,
      area_name:       areaName,
      bbox,
      date_from:       dateFrom,
      date_to:         dateTo,
      scenes_found:    scenes.length,
      pairs_built:     pairs.length,
      jobs_submitted:  submitted.length,
      submit_error:    submitError,
      jobs: submitted.map(j => ({
        job_id:   j.job_id,
        name:     j.name,
        status:   j.status_code,
        granules: j.job_parameters?.granules ?? [],
      })),
      pairs,
      message: submitted.length > 0
        ? `✅ أُرسلت ${submitted.length} وظيفة InSAR — النتائج خلال 2-8 ساعات`
        : `❌ فشل الإرسال: ${submitError}`,
    });
  }

  // ── Default mode: zone feasibility assessment ──────────────────────────────
  const zones = body.zones ?? URBAN_MONITORING_ZONES;

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
  const t0 = Date.now();
  const hasCredentials = !!(ED_USER && ED_PASS);

  // Get HyP3 jobs status if credentials available
  let hyp3Jobs: any[] = [];
  let hyp3Error: string | null = null;
  let accountInfo: any = null;

  if (hasCredentials) {
    const token = await getEdToken();
    if (token) {
      [hyp3Jobs] = await Promise.all([
        fetchHyP3Jobs(token),
      ]);
      // Get account info
      try {
        const res = await fetch(`${HYP3_API}/user`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) accountInfo = await res.json();
      } catch { /* ignore */ }
    } else {
      hyp3Error = 'فشل الحصول على NASA Earthdata token';
    }
  }

  // Categorize jobs
  const pending    = hyp3Jobs.filter(j => j.status_code === 'PENDING');
  const running    = hyp3Jobs.filter(j => j.status_code === 'RUNNING');
  const succeeded  = hyp3Jobs.filter(j => j.status_code === 'SUCCEEDED');
  const failed     = hyp3Jobs.filter(j => j.status_code === 'FAILED');

  // Parse displacement results from completed jobs
  const results = succeeded.map(j => {
    const files = j.files || [];
    const dispFile = files.find((f: any) => f.filename?.includes('displacement') || f.filename?.includes('los'));
    const browseFile = files.find((f: any) => f.filename?.endsWith('.png') || f.filename?.endsWith('.browse.png'));
    return {
      job_id:        j.job_id,
      name:          j.name,
      status:        j.status_code,
      expiration:    j.expiration_time,
      files_count:   files.length,
      displacement_url: dispFile?.url || null,
      browse_url:    browseFile?.url || null,
      files: files.slice(0, 5).map((f: any) => ({ name: f.filename, url: f.url, size_mb: f.size ? (f.size/1048576).toFixed(1) : '?' })),
    };
  });

  // Check S1 scene availability for monitoring zones (from STAC)
  const zones = await Promise.all(URBAN_MONITORING_ZONES.map(async z => {
    const scenes = await searchSTAC({ bbox: z.bbox, date_from: daysAgo(180), date_to: today(), collections: ['sentinel-1-grd'], max_cloud: 100, limit: 10 }).catch(() => []);
    return {
      ...z,
      center: [z.lon, z.lat] as [number, number],
      s1_scenes_6m: scenes.length,
      insar_feasible: scenes.length >= 2,
      coherence_est: estimateCoherence(scenes.length, z.city),
      recommended_method: scenes.length >= 4 ? 'InSAR_GAMMA (12-day pairs)' : scenes.length >= 2 ? 'InSAR_GAMMA (single pair)' : 'أضف مزيداً من المشاهد',
    };
  }));

  return NextResponse.json({
    ok: true,
    data_real: true,
    source: 'ASF HyP3 INSAR_GAMMA + NASA Earthdata',
    query_ms: Date.now() - t0,
    has_credentials: hasCredentials,
    error: hyp3Error,

    account: accountInfo ? {
      user_id:           accountInfo.user_id,
      status:            accountInfo.application_status,
      remaining_credits: accountInfo.remaining_credits,
    } : null,

    jobs_summary: {
      total:     hyp3Jobs.length,
      pending:   pending.length,
      running:   running.length,
      succeeded: succeeded.length,
      failed:    failed.length,
    },

    pending_jobs: pending.map(j => ({
      job_id: j.job_id,
      name:   j.name,
      type:   j.job_type,
      submitted: j.request_time,
      granules: j.job_parameters?.granules || [],
    })),

    completed_results: results,

    zone_readiness: {
      zones_analyzed: zones.length,
      insar_ready:    zones.filter(z => z.insar_feasible).length,
      high_priority:  zones.filter(z => z.priority === 'high').length,
      zones,
    },

    interpretation: succeeded.length > 0
      ? `${succeeded.length} خريطة إزاحة InSAR جاهزة للتحميل — ابحث عن مناطق هبوط ≥5 مم/فترة`
      : pending.length > 0
      ? `${pending.length} وظيفة قيد المعالجة — النتائج متوقعة خلال 2-8 ساعات`
      : 'لا توجد وظائف InSAR نشطة — أرسل طلب POST لبدء المعالجة',

    how_to_read: {
      displacement_positive: 'حركة نحو القمر الصناعي (انتفاخ) → تراكم مياه تحت السطح',
      displacement_negative: 'حركة بعيداً عن القمر (هبوط) → تسرب + ترسب + انهيار',
      alert_threshold: 'هبوط > 5 مم في 12 يوم = إشارة خطر أنبوب مدفون',
      coherence: 'Coherence > 0.5 = نتائج موثوقة | < 0.3 = صخب عالي (غطاء نباتي أو رياح)',
    },
  });
}
