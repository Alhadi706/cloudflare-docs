/**
 * lib/copernicus-dem.ts — Copernicus DEM GLO-30 elevation reader
 *
 * Downloads Cloud-Optimised GeoTIFF (COG) tiles from the AWS Open Data
 * registry, caches to data/copernicus/, and samples on demand.
 *
 * Tile URL pattern:
 *   https://copernicus-dem-30m.s3.amazonaws.com/
 *     Copernicus_DSM_COG_10_{NS}{lat:02d}_00_{EW}{lon:03d}_00_DEM/
 *     Copernicus_DSM_COG_10_{NS}{lat:02d}_00_{EW}{lon:03d}_00_DEM.tif
 *
 * Resolution: ~30 m  (3601 × 3601 per 1° × 1° tile)
 * Data type:  Float32  (metres AMSL, -9999 = no data)
 * Coverage:   Global incl. Libya  (lat 19–34 °N, lon 10–26 °E)
 *
 * Advantage over SRTM:
 *   • Far fewer voids in arid/desert regions
 *   • Better absolute vertical accuracy (RMSE ~2 m vs SRTM ~6 m)
 *   • No striping artefacts
 *
 * Usage (drop-in replacement for srtm exports):
 *   import { getCopElevationsBatch } from '@/lib/copernicus-dem';
 */

import fs   from 'fs';
import path from 'path';
// geotiff v3 is in package.json — fromArrayBuffer works in Node.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fromArrayBuffer } = require('geotiff') as {
  fromArrayBuffer: (buf: ArrayBuffer) => Promise<{
    getImage(index?: number): Promise<{
      getWidth(): number;
      getHeight(): number;
      getBoundingBox(): [number, number, number, number]; // [minX, minY, maxX, maxY]
      readRasters(opts?: { interleave?: boolean }): Promise<{ [0]: Float32Array | Int16Array } & ArrayLike<Float32Array | Int16Array>>;
    }>;
  }>;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CACHE_DIR = path.join(process.cwd(), 'data', 'copernicus');
const AWS_BASE  = 'https://copernicus-dem-30m.s3.amazonaws.com';
const NO_DATA   = -9999;
const MAX_MEM   = 6;   // max tiles in memory (Float32 ≈ 52 MB each)

// ── In-memory LRU tile cache ──────────────────────────────────────────────────
interface CopTile {
  data:   Float32Array;
  width:  number;
  height: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}
const memCache = new Map<string, CopTile>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function tileId(tileLat: number, tileLon: number): string {
  const ns     = tileLat >= 0 ? 'N' : 'S';
  const ew     = tileLon >= 0 ? 'E' : 'W';
  const latStr = String(Math.abs(tileLat)).padStart(2, '0');
  const lonStr = String(Math.abs(tileLon)).padStart(3, '0');
  return `Copernicus_DSM_COG_10_${ns}${latStr}_00_${ew}${lonStr}_00_DEM`;
}

// ── Tile loader ───────────────────────────────────────────────────────────────

async function loadCopTile(tileLat: number, tileLon: number): Promise<CopTile | null> {
  const id      = tileId(tileLat, tileLon);
  const cacheKey = `${tileLat}_${tileLon}`;

  // 1. Memory cache
  if (memCache.has(cacheKey)) return memCache.get(cacheKey)!;

  // 2. Disk cache
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tifPath     = path.join(CACHE_DIR, `${id}.tif`);
  const missingPath = tifPath + '.missing';

  if (fs.existsSync(missingPath)) return null;

  if (!fs.existsSync(tifPath)) {
    // 3. Download from AWS S3 (first time only)
    const url = `${AWS_BASE}/${id}/${id}.tif`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        fs.writeFileSync(missingPath, '');
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(tifPath, buf);
    } catch {
      return null;
    }
  }

  // 4. Parse GeoTIFF
  try {
    const rawBuf   = fs.readFileSync(tifPath);
    const ab       = rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength) as ArrayBuffer;
    const geotiff  = await fromArrayBuffer(ab);
    const image    = await geotiff.getImage(0);
    const [minX, minY, maxX, maxY] = image.getBoundingBox();
    const width    = image.getWidth();
    const height   = image.getHeight();
    const rasters  = await image.readRasters({ interleave: true });
    const raw      = rasters[0] as Float32Array | Int16Array;

    // Normalise to Float32Array
    const data = raw instanceof Float32Array ? raw : Float32Array.from(raw);

    const tile: CopTile = { data, width, height, minLon: minX, minLat: minY, maxLon: maxX, maxLat: maxY };

    // LRU eviction
    if (memCache.size >= MAX_MEM) memCache.delete(memCache.keys().next().value!);
    memCache.set(cacheKey, tile);
    return tile;
  } catch {
    // Corrupt file — mark missing
    fs.writeFileSync(missingPath, '');
    return null;
  }
}

function sampleCopTile(tile: CopTile, lat: number, lon: number): number {
  const col = Math.min(tile.width  - 1, Math.max(0,
    Math.round((lon - tile.minLon) / (tile.maxLon - tile.minLon) * (tile.width  - 1))));
  const row = Math.min(tile.height - 1, Math.max(0,
    Math.round((tile.maxLat - lat) / (tile.maxLat - tile.minLat) * (tile.height - 1))));
  const val = tile.data[row * tile.width + col];
  return (val === NO_DATA || val < -500 || val > 9000) ? 0 : val;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get elevations for an array of [lon, lat] points using Copernicus DEM GLO-30.
 * Returns { elevs, source } — same interface as srtm.getElevationsBatch.
 */
export async function getCopElevationsBatch(
  points: [number, number][],
): Promise<{ elevs: number[]; source: 'copernicus' | 'failed' }> {
  const elevs = new Array<number>(points.length).fill(0);

  // Group point indices by tile
  type TileGroup = { tileLat: number; tileLon: number; indices: number[] };
  const groups = new Map<string, TileGroup>();

  for (let i = 0; i < points.length; i++) {
    const [lon, lat] = points[i];
    const tLat = Math.floor(lat);
    const tLon = Math.floor(lon);
    const key  = `${tLat}_${tLon}`;
    if (!groups.has(key)) groups.set(key, { tileLat: tLat, tileLon: tLon, indices: [] });
    groups.get(key)!.indices.push(i);
  }

  let anyFailed = false;

  await Promise.all(
    Array.from(groups.values()).map(async ({ tileLat, tileLon, indices }) => {
      const tile = await loadCopTile(tileLat, tileLon);
      if (!tile) { anyFailed = true; return; }
      for (const i of indices) {
        elevs[i] = sampleCopTile(tile, points[i][1], points[i][0]);
      }
    }),
  );

  return { elevs, source: anyFailed ? 'failed' : 'copernicus' };
}

/**
 * Build a Float32Array elevation grid using Copernicus DEM.
 * Compatible with srtm.getElevationGrid — same signature.
 */
export async function getCopElevationGrid(
  minLon: number,
  minLat: number,
  cols:   number,
  rows:   number,
  res:    number,
): Promise<Float32Array | null> {
  const points: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      points.push([minLon + c * res, minLat + r * res]);

  const { elevs, source } = await getCopElevationsBatch(points);
  if (source === 'failed' && elevs.every(e => e === 0)) return null;

  const grid = new Float32Array(rows * cols);
  for (let i = 0; i < elevs.length; i++) grid[i] = elevs[i];
  return grid;
}
