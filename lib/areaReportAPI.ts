/**
 * areaReportAPI.ts — Phase S11
 * ============================
 * Client for POST /api/v1/satellite/area-report
 * Returns a complete human-readable Arabic spatial report.
 */

const BASE = '/api/v1/satellite/area-report';
import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AreaReportRequest {
  bbox?: [number, number, number, number];  // [min_lon, min_lat, max_lon, max_lat]
  polygon?: [number, number][];             // [[lon, lat], ...]
  date_from?: string;
  date_to?: string;
  scene_uid?: string;
}

export interface SpatialEstimates {
  area_hectares:   number;
  area_km2:        number;
  buildings_count: number;
  trees_count:     number;
  road_km_paved:   number;
  road_km_unpaved: number;
  road_km_total:   number;
  population_est:  number;
  gov_facilities:  number;
  floors_avg:      number;
  zone:            string;
  zone_ar:         string;
  centroid:        [number, number];
}

export interface EnvironmentSummary {
  vegetation_status:  string;
  vegetation_pct:     number | null;
  heat_level:         string;
  temp_mean_c:        number | null;
  soil_moisture:      string;
  surface_water:      boolean;
  satellite_enriched: boolean;
}

export interface RiskSignals {
  flood_risk:  string;
  fire_risk:   string;
  heat_stress: string;
}

export interface Recommendation {
  text:       string;
  priority:   'urgent' | 'high' | 'medium' | 'info';
  department: string;
}

export interface AreaReport {
  report_id:    string;
  computed_at:  string;
  human_summary: string;
  spatial_estimates:   SpatialEstimates;
  environment_summary: EnvironmentSummary;
  risk_signals:        RiskSignals;
  recommendations:     Recommendation[];
  meta: {
    confidence:       string;
    data_source:      string;
    buildings_basis:  string;
    trees_basis:      string;
    roads_basis:      string;
    population_basis: string;
  };
}

// ─── API call ─────────────────────────────────────────────────────────────────

export async function fetchAreaReport(req: AreaReportRequest): Promise<AreaReport> {
  const res = await fetchWithClientTenantRetry(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail ?? err.message ?? detail;
    } catch (_) { /* ignore */ }
    throw new Error(`Area report error: ${detail}`);
  }

  return res.json() as Promise<AreaReport>;
}

// ─── Spectral history (chart) ─────────────────────────────────────────────────

export interface SpectralHistoryPoint {
  scene_id:   string;
  date:       string;
  cloud_pct:  number;
  ndvi:       number;
  ndbi:       number;
  ndwi:       number;
  lst_c:      number;
  urban_pct:  number;
  veg_pct:    number;
  water_pct:  number;
  bare_pct:   number;
  buildings:  number | null;
  trees:      number | null;
  population: number | null;
}

export interface SpectralHistory {
  bbox_key:    string;
  point_count: number;
  series:      SpectralHistoryPoint[];
}

export async function fetchSpectralHistory(
  bbox: [number, number, number, number]
): Promise<SpectralHistory> {
  const bboxStr = bbox.join(',');
  const res = await fetchWithClientTenantRetry(
    `/api/v1/satellite/spectral-history?bbox=${bboxStr}`,
    { method: 'GET' },
  );
  if (!res.ok) throw new Error(`spectral-history error: HTTP ${res.status}`);
  return res.json();
}
