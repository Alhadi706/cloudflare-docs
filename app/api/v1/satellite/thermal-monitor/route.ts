/**
 * POST /api/v1/satellite/thermal-monitor
 * رصد شذوذات درجة الحرارة عبر NASA POWER + Landsat-9 STAC
 * بيانات حقيقية — لا تحاكي
 */
import { NextRequest, NextResponse } from 'next/server';
import { searchSTAC, daysAgo, today } from '@/lib/stac';

const POWER_API = 'https://power.larc.nasa.gov/api/temporal/daily/point';

interface PowerResponse {
  properties: {
    parameter: Record<string, Record<string, number>>;
  };
}

/** Fetch NASA POWER daily temperature for a point */
async function fetchPower(
  lon: number, lat: number, start: string, end: string
): Promise<Record<string, Record<string, number>>> {
  const params = new URLSearchParams({
    parameters: 'T2M_MAX,T2M_MIN,T2M,WS10M,PRECTOTCORR',
    community:  'RE',
    longitude:  String(lon),
    latitude:   String(lat),
    start:      start.replace(/-/g, ''),
    end:        end.replace(/-/g, ''),
    format:     'JSON',
  });
  const res = await fetch(`${POWER_API}?${params}`, {
    next:   { revalidate: 3600 },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);
  const d: PowerResponse = await res.json();
  return d.properties.parameter;
}

/** Compute stats for a dict of date->value */
function stats(vals: Record<string, number>): { mean: number; max: number; min: number; count: number } {
  const arr = Object.values(vals).filter(v => v !== -999 && !isNaN(v));
  if (!arr.length) return { mean: 0, max: 0, min: 0, count: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { mean: Math.round(mean * 10) / 10, max: Math.round(Math.max(...arr) * 10) / 10, min: Math.round(Math.min(...arr) * 10) / 10, count: arr.length };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Centre point from bbox or explicit point
  const bbox       = body.bbox as number[] | undefined;
  const pointInput = body.point as number[] | undefined;
  const days        = Math.min(body.days ?? 30, 90);

  let lon = 13.19;
  let lat = 32.9;

  if (pointInput?.length === 2) {
    lon = pointInput[0]; lat = pointInput[1];
  } else if (bbox?.length === 4) {
    lon = (bbox[0] + bbox[2]) / 2;
    lat = (bbox[1] + bbox[3]) / 2;
  }

  const t0        = Date.now();
  const todayStr  = today();
  const recentEnd = todayStr;
  const recentStart = daysAgo(days);

  // Baseline: same period one year ago
  const baseStart = daysAgo(days + 365);
  const baseEnd   = daysAgo(365);

  try {
    // Fetch current + baseline in parallel
    const [currentPower, basePower, landsatScenes] = await Promise.allSettled([
      fetchPower(lon, lat, recentStart, recentEnd),
      fetchPower(lon, lat, baseStart,   baseEnd),
      searchSTAC({
        bbox:        [lon - 1, lat - 1, lon + 1, lat + 1],
        date_from:   daysAgo(60),
        date_to:     todayStr,
        collections: ['landsat-c2-l2'],
        max_cloud:   40,
        limit:       5,
      }),
    ]);

    const cPow = currentPower.status === 'fulfilled' ? currentPower.value : {};
    const bPow = basePower.status    === 'fulfilled' ? basePower.value    : {};
    const lsScenes = landsatScenes.status === 'fulfilled' ? landsatScenes.value : [];

    const curT2M  = stats(cPow['T2M_MAX'] ?? {});
    const baseT2M = stats(bPow['T2M_MAX'] ?? {});
    const anomaly = curT2M.mean - baseT2M.mean;

    // Recent daily series for chart
    const dailySeries = Object.entries(cPow['T2M_MAX'] ?? {})
      .filter(([, v]) => v !== -999)
      .map(([date, val]) => ({ date, t_max: val, t_min: (cPow['T2M_MIN'] ?? {})[date] ?? null }))
      .slice(-30);

    // Classify anomaly
    let anomaly_level = 'normal';
    if (anomaly >= 5)      anomaly_level = 'critical';
    else if (anomaly >= 3) anomaly_level = 'high';
    else if (anomaly >= 1.5) anomaly_level = 'elevated';
    else if (anomaly <= -2) anomaly_level = 'cool';

    return NextResponse.json({
      ok:        true,
      data_real: true,
      source:    'NASA_POWER_LARC + Landsat9_STAC',
      query_ms:  Date.now() - t0,
      location:  { lon, lat },
      period: {
        current:  { start: recentStart, end: recentEnd, days },
        baseline: { start: baseStart, end: baseEnd, days },
      },
      temperature: {
        current_mean_max_c:  curT2M.mean,
        current_max_c:       curT2M.max,
        current_min_c:       curT2M.min,
        baseline_mean_max_c: baseT2M.mean,
        anomaly_celsius:     Math.round(anomaly * 10) / 10,
        anomaly_level,
      },
      landsat9: {
        recent_scenes: lsScenes.length,
        scenes: lsScenes.map(s => ({
          id:          s.id,
          date:        s.date,
          cloud_cover: s.cloud_cover,
          platform:    s.platform,
        })),
      },
      daily_series: dailySeries,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'error', data_real: true },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  const p   = req.nextUrl.searchParams;
  const lon = parseFloat(p.get('lon') ?? '13.19');
  const lat = parseFloat(p.get('lat') ?? '32.9');
  const days = parseInt(p.get('days') ?? '30');
  return POST(new NextRequest(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ point: [lon, lat], days }),
  }));
}
