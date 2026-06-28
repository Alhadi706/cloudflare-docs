/**
 * lib/srtm.ts — Elevation reader: Copernicus DEM GLO-30 (primary) + SRTM1 (fallback)
 *
 * Elevation source priority:
 *   1. Copernicus DEM GLO-30 (lib/copernicus-dem.ts) — better accuracy, fewer voids
 *   2. SRTM1 HGT tiles from AWS (Mapzen/Tilezen) — fallback
 *   3. OpenTopoData API — online fallback if tiles unavailable
 *   4. Simulated elevation — last resort
 *
 * SRTM tile URL:
 *   https://s3.amazonaws.com/elevation-tiles-prod/skadi/{NS}{lat}/{NS}{lat}{EW}{lon}.hgt.gz
 *   Example: /skadi/N32/N32E013.hgt.gz  →  32°N–33°N, 13°E–14°E
 *
 * Format: HGT (binary)
 *   • SRTM1: 3601 × 3601 big-endian Int16 samples per 1° × 1° tile
 *   • Resolution: 1 arc-second ≈ 30 m
 *   • -32768 = no data (ocean / void)
 *   • Row 0 = northernmost latitude, Col 0 = westernmost longitude
 *
 * Usage:
 *   import { getElevationsBatch, getElevationGrid } from '@/lib/srtm';
 */

import fs   from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import { getCopElevationsBatch, getCopElevationGrid } from '@/lib/copernicus-dem';

// ── Constants ─────────────────────────────────────────────────────────────────
const SRTM_N    = 3601;          // samples per row / column (SRTM1)
const NO_DATA   = -32768;
const CACHE_DIR = path.join(process.cwd(), 'data', 'srtm');
const AWS_BASE  = 'https://s3.amazonaws.com/elevation-tiles-prod/skadi';
const MAX_MEM   = 8;             // maximum tiles kept in memory at once

// ── In-memory LRU tile cache ──────────────────────────────────────────────────
const memCache = new Map<string, Int16Array>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function tileKey(tileLat: number, tileLon: number): string {
  const ns     = tileLat >= 0 ? 'N' : 'S';
  const ew     = tileLon >= 0 ? 'E' : 'W';
  const latStr = String(Math.abs(tileLat)).padStart(2, '0');
  const lonStr = String(Math.abs(tileLon)).padStart(3, '0');
  return `${ns}${latStr}${ew}${lonStr}`;
}

function latDir(tileLat: number): string {
  return tileLat >= 0
    ? `N${String(tileLat).padStart(2, '0')}`
    : `S${String(Math.abs(tileLat)).padStart(2, '0')}`;
}

// ── Tile loader ───────────────────────────────────────────────────────────────

async function loadTile(tileLat: number, tileLon: number): Promise<Int16Array | null> {
  const name = tileKey(tileLat, tileLon);

  // 1. Memory cache (fastest)
  if (memCache.has(name)) return memCache.get(name)!;

  // 2. Disk cache
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const hgtPath = path.join(CACHE_DIR, `${name}.hgt`);

  if (!fs.existsSync(hgtPath)) {
    // 3. Download from AWS (first time only)
    const url = `${AWS_BASE}/${latDir(tileLat)}/${name}.hgt.gz`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        // Non-existent tile (ocean) — write empty marker so we don't retry
        fs.writeFileSync(hgtPath + '.missing', '');
        return null;
      }
      const compressed = Buffer.from(await res.arrayBuffer());
      const hgt = gunzipSync(compressed);        // ~26 MB decompressed
      fs.writeFileSync(hgtPath, hgt);
    } catch {
      return null;
    }
  }

  // Check for "missing tile" marker
  if (fs.existsSync(hgtPath + '.missing')) return null;
  if (!fs.existsSync(hgtPath)) return null;

  // 4. Parse HGT binary file
  const buf = fs.readFileSync(hgtPath);
  const total = SRTM_N * SRTM_N;
  if (buf.length < total * 2) return null;     // corrupt file guard

  const arr = new Int16Array(total);
  for (let i = 0; i < total; i++) arr[i] = buf.readInt16BE(i * 2);

  // LRU eviction
  if (memCache.size >= MAX_MEM) memCache.delete(memCache.keys().next().value!);
  memCache.set(name, arr);
  return arr;
}

function sampleTile(
  tile:    Int16Array,
  tileLat: number,
  tileLon: number,
  lat:     number,
  lon:     number,
): number {
  const row = Math.min(SRTM_N - 1, Math.max(0,
    Math.round((tileLat + 1 - lat) * (SRTM_N - 1))));
  const col = Math.min(SRTM_N - 1, Math.max(0,
    Math.round((lon - tileLon) * (SRTM_N - 1))));
  const val = tile[row * SRTM_N + col];
  return val === NO_DATA ? 0 : val;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get elevations (metres AMSL) for an array of [lon, lat] points.
 *
 * Priority:
 *   1. Copernicus DEM GLO-30  (better accuracy, fewer voids in arid regions)
 *   2. SRTM1 HGT tiles        (fallback if Copernicus tile unavailable)
 *
 * @returns { elevs, source }
 *   source = 'copernicus' → Copernicus DEM used
 *   source = 'local'      → SRTM1 tiles used
 *   source = 'failed'     → all tiles unavailable (elevs may be 0)
 */
export async function getElevationsBatch(
  points: [number, number][],
): Promise<{ elevs: number[]; source: 'copernicus' | 'local' | 'failed' }> {
  // ── 1. Try Copernicus DEM first ───────────────────────────────────────────
  const cop = await getCopElevationsBatch(points);
  if (cop.source === 'copernicus') return { elevs: cop.elevs, source: 'copernicus' };

  // ── 2. Fallback: SRTM1 HGT ───────────────────────────────────────────────
  const elevs = new Array<number>(points.length).fill(0);

  type TileGroup = { tileLat: number; tileLon: number; name: string; indices: number[] };
  const groups = new Map<string, TileGroup>();

  for (let i = 0; i < points.length; i++) {
    const [lon, lat] = points[i];
    const tLat = Math.floor(lat);
    const tLon = Math.floor(lon);
    const key  = `${tLat}_${tLon}`;
    if (!groups.has(key)) groups.set(key, { tileLat: tLat, tileLon: tLon, name: tileKey(tLat, tLon), indices: [] });
    groups.get(key)!.indices.push(i);
  }

  let anyFailed = false;

  await Promise.all(
    Array.from(groups.values()).map(async ({ tileLat, tileLon, indices }) => {
      const tile = await loadTile(tileLat, tileLon);
      if (!tile) { anyFailed = true; return; }
      for (const i of indices) {
        elevs[i] = sampleTile(tile, tileLat, tileLon, points[i][1], points[i][0]);
      }
    }),
  );

  return { elevs, source: anyFailed ? 'failed' : 'local' };
}

/**
 * Build a Float32Array elevation grid for an A* occupancy grid.
 * Each cell [r * cols + c] gets its SRTM1 elevation in metres.
 *
 * @param minLon  western edge of grid (degrees)
 * @param minLat  southern edge of grid (degrees)
 * @param cols    number of grid columns
 * @param rows    number of grid rows
 * @param res     grid cell size in degrees
 * @returns       elevation grid, or null if tiles unavailable
 */
export async function getElevationGrid(
  minLon: number,
  minLat: number,
  cols:   number,
  rows:   number,
  res:    number,
): Promise<Float32Array | null> {
  // Try Copernicus DEM grid first
  const copGrid = await getCopElevationGrid(minLon, minLat, cols, rows, res);
  if (copGrid) return copGrid;

  // Fallback: SRTM batch
  const points: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      points.push([minLon + c * res, minLat + r * res]);

  const { elevs, source } = await getElevationsBatch(points);
  if (source === 'failed' && elevs.every(e => e === 0)) return null;

  const grid = new Float32Array(rows * cols);
  for (let i = 0; i < elevs.length; i++) grid[i] = elevs[i];
  return grid;
}
