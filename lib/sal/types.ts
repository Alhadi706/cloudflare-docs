/**
 * lib/sal/types.ts
 * Signal Abstraction Layer — Core Types
 *
 * Every observation in the system becomes a NormalizedSignal.
 * No reasoning code should ever reference a specific satellite or sensor.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Physical Signal Types — represent phenomena, not sensors
// ─────────────────────────────────────────────────────────────────────────────

export type SignalType =
  | 'SURFACE_REFLECTANCE'         // انعكاسية السطح (0-1)
  | 'SURFACE_ROUGHNESS'           // خشونة السطح (0-1 proxy from texture)
  | 'VEGETATION_ACTIVITY'         // نشاط نباتي (0-1, NDVI-equivalent)
  | 'BUILT_SURFACE_FRACTION'      // نسبة الأسطح المبنية (0-1)
  | 'SURFACE_MOISTURE'            // رطوبة السطح (0-1 proxy)
  | 'LINEAR_STRUCTURE_DENSITY'    // كثافة الهياكل الخطية (0-1)
  | 'CONSTRUCTION_ACTIVITY_INDEX' // مؤشر نشاط إنشائي مُركَّب (0-1)
  | string;

export type SignalProvider =
  | 'planet_scope'
  | 'sentinel_2'
  | 'sentinel_1_sar'
  | 'weather_api'
  | 'ground_sensor'
  | string;

// ─────────────────────────────────────────────────────────────────────────────
//  The Universal Signal Object
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedSignal {
  signal_id:          string;
  signal_type:        SignalType;
  physical_meaning:   string;       // human-readable description
  observation_time:   string;       // ISO date string
  spatial_resolution: number;       // meters per pixel
  coverage_fraction:  number;       // 0-1: fraction of project bbox covered
  value:              number;       // normalized 0-1 (or appropriate unit)
  value_unit:         string;       // 'fraction' | 'kelvin' | 'dB' | ...
  quality_score:      number;       // 0-1: observation quality
  confidence:         number;       // 0-1: confidence in accuracy
  uncertainty:        number;       // ± in value units
  is_valid:           boolean;
  rejection_reason:   string | null;
  provider:           SignalProvider;
  scene_id:           string;
  thumb_path?:        string;       // local path to source thumbnail
}

// ─────────────────────────────────────────────────────────────────────────────
//  Provider Adapter Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface PixelFeatures {
  // Brightness
  mean_luminance:      number;   // 0-1
  std_luminance:       number;   // 0-1 (higher = more variation)
  // Color-derived
  red_mean:            number;   // 0-1
  green_mean:          number;   // 0-1
  blue_mean:           number;   // 0-1
  vegetation_proxy:    number;   // (G-R)/(G+R) rough NDVI [-1, 1]
  bare_soil_proxy:     number;   // red-dominated fraction [0-1]
  // Texture
  entropy:             number;   // Shannon entropy [0-1 normalized]
  contrast:            number;   // local contrast [0-1 normalized]
  // Edge
  edge_density:        number;   // fraction of edge pixels [0-1]
}
