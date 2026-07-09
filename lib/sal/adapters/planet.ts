/**
 * lib/sal/adapters/planet.ts
 * Planet PlanetScope RGB Adapter
 *
 * Decodes PNG thumbnails into NormalizedSignal objects using real pixel data.
 * Implements spatial cropping to the project bbox before feature extraction,
 * ensuring we measure changes IN THE PROJECT AREA, not in the entire scene.
 *
 * Architecture:
 *   1. Compute which sub-region of the 256×256 thumbnail covers the project
 *   2. Crop to that sub-region using sharp
 *   3. Choose an adaptive analysis size based on project pixel coverage
 *   4. Extract features from the cropped, resized region only
 */

import sharp from 'sharp';
import type { NormalizedSignal, PixelFeatures } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
//  Spatial Crop Computation
// ─────────────────────────────────────────────────────────────────────────────

const THUMB_SIZE = 256;  // all Planet thumbnails are 256×256
const MIN_ANALYSIS_SIZE = 32;   // minimum pixels after crop + resize
const MAX_ANALYSIS_SIZE = 128;  // maximum pixels (for performance)

export interface CropRegion {
  left:   number;  // pixels from left
  top:    number;  // pixels from top
  width:  number;  // crop width in pixels
  height: number;  // crop height in pixels
  analysis_size:     number;  // resize target for feature extraction
  project_px_count:  number;  // original pixel count before resize
  coverage_fraction: number;  // fraction of scene covered by project
  is_reliable:       boolean; // enough pixels for meaningful analysis
  reliability_note:  string;
}

/**
 * Compute which sub-region of a 256×256 thumbnail corresponds to the project bbox.
 *
 * Planet thumbnails cover the full scene extent.
 * Image coordinates: (0,0) = top-left = (minLon, maxLat) in geographic terms.
 * Y-axis is flipped: increasing y in pixels = decreasing latitude.
 */
export function computeCropRegion(
  projectBbox: [number, number, number, number],
  sceneBbox:   [number, number, number, number],  // Must be actual scene footprint, NOT area-level bbox
): CropRegion {
  const [pMinLon, pMinLat, pMaxLon, pMaxLat] = projectBbox;
  const [sMinLon, sMinLat, sMaxLon, sMaxLat] = sceneBbox;

  const sceneWDeg = sMaxLon - sMinLon;
  const sceneHDeg = sMaxLat - sMinLat;

  if (sceneWDeg <= 0 || sceneHDeg <= 0) {
    // Invalid scene bbox — analyze full thumbnail
    return {
      left: 0, top: 0, width: THUMB_SIZE, height: THUMB_SIZE,
      analysis_size: 64, project_px_count: THUMB_SIZE * THUMB_SIZE,
      coverage_fraction: 1.0, is_reliable: true,
      reliability_note: 'invalid_scene_bbox_using_full_thumbnail',
    };
  }

  // Fraction of scene covered by project
  const xFrac = (pMinLon - sMinLon) / sceneWDeg;
  const yFrac = (sMaxLat - pMaxLat) / sceneHDeg;  // flipped
  const wFrac = (pMaxLon - pMinLon) / sceneWDeg;
  const hFrac = (pMaxLat - pMinLat) / sceneHDeg;

  // Convert to pixel coordinates in the 256×256 thumbnail
  const left   = Math.max(0, Math.floor(xFrac * THUMB_SIZE));
  const top    = Math.max(0, Math.floor(yFrac * THUMB_SIZE));
  const right  = Math.min(THUMB_SIZE, Math.ceil((xFrac + wFrac) * THUMB_SIZE));
  const bottom = Math.min(THUMB_SIZE, Math.ceil((yFrac + hFrac) * THUMB_SIZE));
  const width  = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  const project_px_count = width * height;
  const coverage_fraction = project_px_count / (THUMB_SIZE * THUMB_SIZE);

  // Adaptive analysis size:
  // - Very small crops (< MIN_ANALYSIS_SIZE²) → upsample to MIN_ANALYSIS_SIZE
  // - Medium crops → use crop size or 64
  // - Large crops → cap at MAX_ANALYSIS_SIZE
  const rawSize = Math.round(Math.sqrt(project_px_count));
  const analysis_size = Math.min(MAX_ANALYSIS_SIZE, Math.max(MIN_ANALYSIS_SIZE, rawSize));

  // Reliability: we need at least 4×4 original pixels to extract meaningful features
  // Below that, we're just upsampling noise
  const is_reliable   = project_px_count >= 16;  // 4×4 minimum
  const reliability_note = is_reliable
    ? `${width}x${height}px crop (${(coverage_fraction*100).toFixed(2)}% of scene)`
    : `only ${width}x${height}px — sub-pixel project, confidence degraded`;

  return { left, top, width, height, analysis_size, project_px_count, coverage_fraction, is_reliable, reliability_note };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pixel Decoder — PNG → Float32 channels, with optional spatial crop
// ─────────────────────────────────────────────────────────────────────────────

export async function decodePixels(
  thumbPath:  string,
  cropRegion: CropRegion,
): Promise<{
  r: Float32Array; g: Float32Array; b: Float32Array; lum: Float32Array;
  width: number; height: number;
  crop: CropRegion;
} | null> {
  try {
    const S = cropRegion.analysis_size;
    const { data, info } = await sharp(thumbPath)
      .extract({
        left:   cropRegion.left,
        top:    cropRegion.top,
        width:  cropRegion.width,
        height: cropRegion.height,
      })
      .resize(S, S, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const n = info.width * info.height;
    const r   = new Float32Array(n);
    const g   = new Float32Array(n);
    const b   = new Float32Array(n);
    const lum = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const ri = data[i * 3]     / 255;
      const gi = data[i * 3 + 1] / 255;
      const bi = data[i * 3 + 2] / 255;
      r[i]   = ri;
      g[i]   = gi;
      b[i]   = bi;
      lum[i] = 0.299 * ri + 0.587 * gi + 0.114 * bi;
    }

    return { r, g, b, lum, width: info.width, height: info.height, crop: cropRegion };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Feature Extraction — PixelFeatures from decoded project-area pixels
// ─────────────────────────────────────────────────────────────────────────────

export function extractFeatures(
  pixels: NonNullable<Awaited<ReturnType<typeof decodePixels>>>
): PixelFeatures {
  const { r, g, b, lum } = pixels;
  const n = lum.length;

  const rMean   = mean(r);
  const gMean   = mean(g);
  const bMean   = mean(b);
  const lumMean = mean(lum);
  const lumStd  = std(lum, lumMean);

  // Vegetation proxy: (G-R)/(G+R)
  let vegSum = 0;
  for (let i = 0; i < n; i++) {
    const denom = g[i] + r[i];
    vegSum += denom > 0.01 ? (g[i] - r[i]) / denom : 0;
  }
  const vegProxy = vegSum / n;

  // Bare soil proxy
  let soilCount = 0;
  for (let i = 0; i < n; i++) {
    if (r[i] > g[i] * 1.1 && r[i] > b[i] * 1.1 && r[i] > 0.2) soilCount++;
  }
  const bareSoilProxy = soilCount / n;

  // Entropy (16-bin histogram)
  const hist = new Float32Array(16);
  for (let i = 0; i < n; i++) hist[Math.min(15, Math.floor(lum[i] * 16))]++;
  let entropy = 0;
  for (let bi = 0; bi < 16; bi++) {
    const p = hist[bi] / n;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const entropyNorm = Math.min(1, entropy / 4);

  // Contrast (mean absolute difference of adjacent pixels)
  let contrastSum = 0;
  for (let i = 1; i < n; i++) contrastSum += Math.abs(lum[i] - lum[i-1]);
  const contrastNorm = Math.min(1, (contrastSum / (n - 1)) * 10);

  // Edge density (pixels with |lum - mean| > 1.5σ)
  const threshold = lumStd * 1.5;
  let edgeCount = 0;
  for (let i = 0; i < n; i++) if (Math.abs(lum[i] - lumMean) > threshold) edgeCount++;

  return {
    mean_luminance:   lumMean,
    std_luminance:    Math.min(1, lumStd * 3),
    red_mean:         rMean,
    green_mean:       gMean,
    blue_mean:        bMean,
    vegetation_proxy: vegProxy,
    bare_soil_proxy:  bareSoilProxy,
    entropy:          entropyNorm,
    contrast:         contrastNorm,
    edge_density:     edgeCount / n,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Change Score — weighted delta of feature vectors
// ─────────────────────────────────────────────────────────────────────────────

export function computeChangeScore(f1: PixelFeatures, f2: PixelFeatures): {
  score:    number;
  details:  Record<string, number>;
  dominant: string;
} {
  const d = {
    luminance_change:    Math.abs(f2.mean_luminance - f1.mean_luminance),
    surface_disturbance: Math.abs(f2.std_luminance - f1.std_luminance),
    vegetation_change:   Math.abs(f2.vegetation_proxy - f1.vegetation_proxy),
    soil_change:         Math.abs(f2.bare_soil_proxy - f1.bare_soil_proxy),
    entropy_change:      Math.abs(f2.entropy - f1.entropy),
    edge_change:         Math.abs(f2.edge_density - f1.edge_density),
  };

  const raw = Math.min(1,
    d.luminance_change    * 0.10 +
    d.surface_disturbance * 0.30 +
    d.vegetation_change   * 0.15 +
    d.soil_change         * 0.20 +
    d.entropy_change      * 0.15 +
    d.edge_change         * 0.10
  ) * 3;  // amplification factor: needs calibration with ground truth

  const dominant = Object.entries(d).sort((a, b) => b[1] - a[1])[0][0];
  return { score: Math.min(1, Math.round(raw * 100) / 100), details: d, dominant };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Entry Point — now requires project + scene bbox for spatial crop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a spatially-representative activity score between two Planet scenes.
 *
 * KEY IMPROVEMENT over Phase 1:
 * - Crops the 256×256 thumbnail to the project bbox before analysis
 * - Uses an adaptive analysis size based on project pixel coverage
 * - Returns confidence degraded for sub-pixel projects (< 4×4 pixels)
 *
 * This ensures we measure changes IN THE PROJECT AREA specifically,
 * not changes across the entire Planet scene (which includes background).
 */
export async function computePixelActivityScore(
  thumbPathA:  string,
  thumbPathB:  string,
  projectBbox: [number, number, number, number],
  sceneBbox:   [number, number, number, number],
): Promise<{ score: number; confidence: number; method: string; crop?: CropRegion }> {

  const crop = computeCropRegion(projectBbox, sceneBbox);

  const [pxA, pxB] = await Promise.all([
    decodePixels(thumbPathA, crop),
    decodePixels(thumbPathB, crop),
  ]);

  if (!pxA || !pxB) {
    return { score: 0, confidence: 0, method: 'failed_decode', crop };
  }

  const f1 = extractFeatures(pxA);
  const f2 = extractFeatures(pxB);
  const { score } = computeChangeScore(f1, f2);

  // Confidence degrades for very small crops
  const qualityA    = assessImageQuality(f1);
  const qualityB    = assessImageQuality(f2);
  const baseConf    = Math.min(qualityA, qualityB);
  const sizeConf    = Math.min(1, crop.project_px_count / 64);  // full confidence at 8×8px
  const confidence  = baseConf * sizeConf * (crop.is_reliable ? 1.0 : 0.5);

  return { score, confidence, method: 'spatial_crop_pixel_features', crop };
}

function assessImageQuality(f: PixelFeatures): number {
  if (f.mean_luminance > 0.85) return 0.3;
  if (f.mean_luminance < 0.05) return 0.2;
  if (f.std_luminance < 0.02)  return 0.4;
  return Math.min(1, 0.5 + f.std_luminance * 2);
}

function mean(arr: Float32Array): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: Float32Array, m: number): number {
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length);
}

