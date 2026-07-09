/**
 * Shared terrain elevation fetcher — used by /api/terrain3d and /api/gis/3d-analyst
 * Fetches SRTM 30m elevation data from opentopodata.org
 */

export type Bbox = [number, number, number, number];

export interface TerrainData {
  ok:             boolean;
  bbox:           Bbox;
  grid_size:      number;
  elevation_grid: number[][];
  slope_grid:     number[][];
  aspect_grid:    number[][];
  cut_fill_grid:  number[][];
  contours:       { elevation: number; points: [number, number][] }[];
  stats: {
    min_elevation:   number;
    max_elevation:   number;
    mean_elevation:  number;
    range_m:         number;
    rough_slope_pct: number;
  };
  source: string;
  error?: string;
}

export async function fetchElevationGridShared(
  bbox: Bbox,
  n: number,
): Promise<number[][]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const pts: [number, number][] = [];

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const lat = maxLat - (row / (n - 1)) * (maxLat - minLat);
      const lon = minLon + (col / (n - 1)) * (maxLon - minLon);
      pts.push([lon, lat]);
    }
  }

  const BATCH = 100;
  const elevations: number[] = [];

  for (let i = 0; i < pts.length; i += BATCH) {
    const batch = pts.slice(i, i + BATCH);
    const locStr = batch.map(([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join('|');

    let success = false;

    try {
      const r = await fetch(
        `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locStr)}`,
        { headers: { 'User-Agent': 'DSF-digital-dashboard/1.0' }, signal: AbortSignal.timeout(15_000) }
      );
      const d = await r.json() as { status: string; results?: { elevation: number | null }[] };
      if (d.status === 'OK' && d.results) {
        d.results.forEach(res => elevations.push(res.elevation ?? 0));
        success = true;
      }
    } catch { /* fall through */ }

    if (!success) {
      try {
        const r = await fetch('https://api.open-elevation.com/api/v1/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'DSF-digital-dashboard/1.0' },
          body: JSON.stringify({ locations: batch.map(([lon, lat]) => ({ latitude: lat, longitude: lon })) }),
          signal: AbortSignal.timeout(15_000),
        });
        const d = await r.json() as { results?: { elevation: number }[] };
        if (d.results) {
          d.results.forEach(res => elevations.push(res.elevation ?? 0));
          success = true;
        }
      } catch { /* ignore */ }
    }

    if (!success) batch.forEach(() => elevations.push(0));
  }

  const grid: number[][] = [];
  for (let row = 0; row < n; row++) {
    grid.push(elevations.slice(row * n, row * n + n).map(e => Math.round(e * 10) / 10));
  }
  return grid;
}

export function computeSlopeShared(grid: number[][], bbox: Bbox, n: number): number[][] {
  const [minLon, , maxLon, maxLat] = bbox;
  const latSpan = bbox[3] - bbox[1];
  const lonSpan = maxLon - minLon;
  const cellLat = (latSpan / (n - 1)) * 111_000;
  const cellLon = (lonSpan / (n - 1)) * 111_000 * Math.cos((maxLat - latSpan / 2) * Math.PI / 180);

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
      return Math.round(Math.sqrt(dz_dx ** 2 + dz_dy ** 2) * 100 * 100) / 100;
    })
  );
}

export function computeAspectShared(grid: number[][], n: number): number[][] {
  return grid.map((row, r) =>
    row.map((_, c) => {
      const dx = c > 0 && c < n - 1 ? grid[r][c + 1] - grid[r][c - 1] : 0;
      const dy = r > 0 && r < n - 1 ? grid[r - 1][c] - grid[r + 1][c] : 0;
      if (dx === 0 && dy === 0) return -1;
      const deg = Math.atan2(dx, dy) * 180 / Math.PI;
      return Math.round((deg + 360) % 360);
    })
  );
}

export function computeContoursShared(
  grid: number[][],
  bbox: Bbox,
  n: number,
  levels: number[],
): { elevation: number; points: [number, number][] }[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return levels.map(level => {
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
    return { elevation: level, points: pts };
  }).filter(c => c.points.length > 0);
}

/**
 * Full terrain analysis for a bbox — used by both /api/terrain3d and /api/gis/3d-analyst
 */
export async function computeFullTerrain(bbox: Bbox, gridSize = 11, baseLevelM = 0): Promise<TerrainData> {
  const n = Math.max(5, Math.min(21, gridSize));
  const elevation_grid = await fetchElevationGridShared(bbox, n);

  const flat = elevation_grid.flat().filter(v => v !== 0);
  const stats = {
    min_elevation:   flat.length ? Math.min(...flat) : 0,
    max_elevation:   flat.length ? Math.max(...flat) : 0,
    mean_elevation:  flat.length ? Math.round(flat.reduce((a, b) => a + b, 0) / flat.length) : 0,
    range_m:         flat.length ? Math.max(...flat) - Math.min(...flat) : 0,
    rough_slope_pct: 0,
  };

  const slope_grid  = computeSlopeShared(elevation_grid, bbox, n);
  const aspect_grid = computeAspectShared(elevation_grid, n);
  stats.rough_slope_pct = Math.round(slope_grid.flat().reduce((a, b) => a + b, 0) / (n * n) * 10) / 10;

  const cut_fill_grid = elevation_grid.map(row => row.map(e => Math.round((e - baseLevelM) * 10) / 10));

  const step = Math.max(10, Math.round((stats.max_elevation - stats.min_elevation) / 8 / 10) * 10);
  const levels: number[] = [];
  for (let lv = Math.ceil(stats.min_elevation / step) * step; lv <= stats.max_elevation; lv += step) {
    levels.push(lv);
  }
  const contours = computeContoursShared(elevation_grid, bbox, n, levels);

  return {
    ok: true, bbox, grid_size: n, elevation_grid,
    slope_grid, aspect_grid, cut_fill_grid, contours, stats,
    source: 'SRTM 30m via opentopodata.org',
  };
}
