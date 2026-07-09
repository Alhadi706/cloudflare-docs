/**
 * POST /api/terrain3d
 * تحليل التضاريس ثلاثي الأبعاد — ارتفاعات SRTM + ميل + اتجاه + حفر/ردم + كنتور
 *
 * يستخدم opentopodata.org (SRTM 30m) كمصدر مجاني للارتفاعات
 * Public endpoint — لا يحتاج JWT (مضاف في middleware PUBLIC_API_PATHS)
 */
import { NextRequest, NextResponse } from 'next/server';

type Bbox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

interface TerrainRequest {
  bbox:           Bbox;
  grid_size?:     number;  // N×N grid, default 11
  base_level_m?:  number;  // cut/fill reference elevation, default 0
}

interface TerrainStats {
  min_elevation:  number;
  max_elevation:  number;
  mean_elevation: number;
  range_m:        number;
  rough_slope_pct: number;  // average absolute slope %
}

interface TerrainResponse {
  ok:             boolean;
  bbox:           Bbox;
  grid_size:      number;
  base_level_m:   number;
  elevation_grid: number[][];  // [row][col], north-to-south
  slope_grid:     number[][];  // slope % for each cell
  aspect_grid:    number[][];  // aspect degrees (0=N, 90=E)
  cut_fill_grid:  number[][];  // +ve=cut, -ve=fill relative to base_level_m
  contours:       { elevation: number; points: [number,number][] }[];
  stats:          TerrainStats;
  source:         string;
  error?:         string;
}

// ── Elevation fetch via opentopodata SRTM ────────────────────────────────────

async function fetchElevationGrid(
  bbox: Bbox,
  n: number,
): Promise<number[][]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const pts: [number, number][] = [];

  // Build grid: row0 = northernmost
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const lat = maxLat - (row / (n - 1)) * (maxLat - minLat);
      const lon = minLon + (col / (n - 1)) * (maxLon - minLon);
      pts.push([lon, lat]);
    }
  }

  // Batch into chunks of 100 (opentopodata limit)
  const BATCH = 100;
  const elevations: number[] = [];

  for (let i = 0; i < pts.length; i += BATCH) {
    const batch = pts.slice(i, i + BATCH);
    const locStr = batch.map(([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join('|');

    try {
      const r = await fetch(
        `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locStr)}`,
        {
          headers: { 'User-Agent': 'DSF-digital-dashboard/1.0 (terrain analysis)' },
          signal: AbortSignal.timeout(15_000),
        }
      );
      const d = await r.json() as { status: string; results?: { elevation: number | null }[] };
      if (d.status === 'OK' && d.results) {
        d.results.forEach(res => elevations.push(res.elevation ?? 0));
        continue;
      }
    } catch { /* fall through */ }

    // Fallback: open-elevation API
    try {
      const r = await fetch('https://api.open-elevation.com/api/v1/lookup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'DSF-digital-dashboard/1.0' },
        body:    JSON.stringify({ locations: batch.map(([lon, lat]) => ({ latitude: lat, longitude: lon })) }),
        signal:  AbortSignal.timeout(15_000),
      });
      const d = await r.json() as { results?: { elevation: number }[] };
      if (d.results) {
        d.results.forEach(res => elevations.push(res.elevation ?? 0));
        continue;
      }
    } catch { /* ignore */ }

    // Last fallback: fill with zeros
    batch.forEach(() => elevations.push(0));
  }

  // Reshape into [n][n] grid
  const grid: number[][] = [];
  for (let row = 0; row < n; row++) {
    grid.push(elevations.slice(row * n, row * n + n).map(e => Math.round(e * 10) / 10));
  }
  return grid;
}

// ── Derive slope from elevation grid ─────────────────────────────────────────

function computeSlope(grid: number[][], bbox: Bbox, n: number): number[][] {
  const [minLon, , maxLon, maxLat] = bbox;
  const latSpan  = bbox[3] - bbox[1];
  const lonSpan  = maxLon - minLon;
  const cellLat  = (latSpan  / (n - 1)) * 111_000;  // meters
  const cellLon  = (lonSpan  / (n - 1)) * 111_000 * Math.cos((maxLat - latSpan / 2) * Math.PI / 180);

  return grid.map((row, r) =>
    row.map((_, c) => {
      const dz_dx = c > 0 && c < n - 1
        ? (grid[r][c + 1] - grid[r][c - 1]) / (2 * cellLon)
        : c === 0 ? (grid[r][1] - grid[r][0]) / cellLon
        : (grid[r][n - 1] - grid[r][n - 2]) / cellLon;

      const dz_dy = r > 0 && r < n - 1
        ? (grid[r - 1][c] - grid[r + 1][c]) / (2 * cellLat)
        : r === 0 ? (grid[0][c] - grid[1][c]) / cellLat
        : (grid[n - 2][c] - grid[n - 1][c]) / cellLat;

      return Math.round(Math.sqrt(dz_dx ** 2 + dz_dy ** 2) * 100 * 100) / 100; // %
    })
  );
}

function computeAspect(grid: number[][], n: number): number[][] {
  return grid.map((row, r) =>
    row.map((_, c) => {
      const dx = c > 0 && c < n - 1 ? grid[r][c + 1] - grid[r][c - 1] : 0;
      const dy = r > 0 && r < n - 1 ? grid[r - 1][c] - grid[r + 1][c] : 0;
      if (dx === 0 && dy === 0) return -1; // flat
      const deg = Math.atan2(dx, dy) * 180 / Math.PI;
      return Math.round((deg + 360) % 360);
    })
  );
}

function computeContours(grid: number[][], bbox: Bbox, n: number, levels: number[]): { elevation: number; points: [number, number][] }[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const results: { elevation: number; points: [number, number][] }[] = [];

  for (const level of levels) {
    const pts: [number, number][] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (Math.abs(grid[r][c] - level) < 15) {
          const lon = minLon + (c / (n - 1)) * (maxLon - minLon);
          const lat = maxLat - (r / (n - 1)) * (maxLat - minLat);
          pts.push([Math.round(lon * 10000) / 10000, Math.round(lat * 10000) / 10000]);
        }
      }
    }
    if (pts.length > 0) results.push({ elevation: level, points: pts });
  }
  return results;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: TerrainRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { bbox, grid_size = 11, base_level_m = 0 } = body;

  if (!bbox || bbox.length !== 4) {
    return NextResponse.json({ ok: false, error: 'bbox مطلوب: [minLon,minLat,maxLon,maxLat]' }, { status: 400 });
  }

  const n = Math.max(5, Math.min(21, grid_size));

  try {
    const elevation_grid = await fetchElevationGrid(bbox, n);

    // Flatten for stats
    const flat = elevation_grid.flat().filter(v => v !== 0);
    const stats: TerrainStats = {
      min_elevation:   flat.length ? Math.min(...flat) : 0,
      max_elevation:   flat.length ? Math.max(...flat) : 0,
      mean_elevation:  flat.length ? Math.round(flat.reduce((a, b) => a + b, 0) / flat.length) : 0,
      range_m:         flat.length ? Math.max(...flat) - Math.min(...flat) : 0,
      rough_slope_pct: 0,
    };

    const slope_grid  = computeSlope(elevation_grid, bbox, n);
    const aspect_grid = computeAspect(elevation_grid, n);

    // Slope stats
    const slopeFlat = slope_grid.flat();
    stats.rough_slope_pct = Math.round(slopeFlat.reduce((a, b) => a + b, 0) / slopeFlat.length * 10) / 10;

    // Cut/fill relative to base_level_m
    const cut_fill_grid = elevation_grid.map(row =>
      row.map(e => Math.round((e - base_level_m) * 10) / 10)
    );

    // Contour lines at 50m intervals
    const minE = stats.min_elevation;
    const maxE = stats.max_elevation;
    const step = Math.max(10, Math.round((maxE - minE) / 8 / 10) * 10);
    const levels: number[] = [];
    for (let lv = Math.ceil(minE / step) * step; lv <= maxE; lv += step) {
      levels.push(lv);
    }
    const contours = computeContours(elevation_grid, bbox, n, levels);

    return NextResponse.json({
      ok:             true,
      bbox,
      grid_size:      n,
      base_level_m,
      elevation_grid,
      slope_grid,
      aspect_grid,
      cut_fill_grid,
      contours,
      stats,
      source:         'SRTM 30m via opentopodata.org',
    } satisfies TerrainResponse);

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({
    ok:          true,
    service:     'Terrain 3D Analysis',
    description: 'SRTM 30m elevation grid + slope + aspect + cut/fill + contours',
    usage:       'POST /api/terrain3d { bbox, grid_size?, base_level_m? }',
  });
}
