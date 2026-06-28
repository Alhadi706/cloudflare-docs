export type LonLat = [number, number];
export type BBox = [number, number, number, number];

export interface Terrain3DRequest {
  bbox?: BBox;
  polygon?: LonLat[];
  contour_interval_m?: number;
  los?: {
    start: LonLat;
    end: LonLat;
    observer_height_m?: number;
    target_height_m?: number;
  };
  base_level_m?: number;
  grid_size?: number;
}

export interface Terrain3DResponse {
  status: 'ok';
  source: {
    provider: string;
    dataset: string;
    queried_at: string;
  };
  quality: {
    sample_points: number;
    grid_size: number;
    warnings: string[];
  };
  terrain: {
    min_elevation_m: number;
    max_elevation_m: number;
    mean_elevation_m: number;
    relief_m: number;
    roughness_std_m: number;
    slope_mean_deg: number;
    slope_max_deg: number;
  };
  contours: {
    interval_m: number;
    bands: Array<{
      from_m: number;
      to_m: number;
      label: string;
      coverage_pct: number;
    }>;
  };
  visibility: null | {
    visible: boolean;
    blocked_at_distance_m: number | null;
    min_clearance_m: number;
    max_clearance_m: number;
  };
  cut_fill: {
    base_level_m: number;
    cell_area_m2: number;
    cut_m3: number;
    fill_m3: number;
    net_m3: number;
  };
}

export interface Terrain3DArchivedReport {
  id: string;
  tenant_id: string;
  created_at: string;
  signature_sha256: string;
  policy_version: string;
  policy_name: string;
  benchmark: any;
  result: Terrain3DResponse;
}
import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';

export async function fetchTerrain3DAnalysis(req: Terrain3DRequest): Promise<Terrain3DResponse> {
  const res = await fetchWithClientTenantRetry('/api/terrain3d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = data?.detail || data?.error || detail;
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(`terrain-3d: ${detail}`);
  }

  return res.json();
}

export async function saveTerrain3DReport(payload: {
  benchmark: any;
  result: Terrain3DResponse;
}): Promise<Terrain3DArchivedReport> {
  const res = await fetchWithClientTenantRetry('/api/terrain3d/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = data?.detail || data?.error || detail;
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(`terrain-3d-save: ${detail}`);
  }

  const data = await res.json();
  return data.item as Terrain3DArchivedReport;
}

export async function listTerrain3DReports(limit = 10): Promise<Terrain3DArchivedReport[]> {
  const res = await fetchWithClientTenantRetry(`/api/terrain3d/reports?limit=${limit}`, {
    method: 'GET',
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = data?.detail || data?.error || detail;
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(`terrain-3d-list: ${detail}`);
  }

  const data = await res.json();
  return (data.items ?? []) as Terrain3DArchivedReport[];
}
