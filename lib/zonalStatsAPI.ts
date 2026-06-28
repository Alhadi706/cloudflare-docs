import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';

export interface ZonalStatsRequest {
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
  scene_uid?: string;
  date_from?: string;
  date_to?: string;
  require_native?: boolean;
}

export interface ZonalStatsResult {
  status: 'ok' | 'error';
  source_mode: 'backend-zonal' | 'derived-area-report';
  confidence: 'high' | 'medium' | 'low';
  computed_at: string;
  stats: {
    area_km2?: number | null;
    vegetation_pct?: number | null;
    mean_temp_c?: number | null;
    surface_water?: boolean | null;
    buildings_density_km2?: number | null;
    roads_density_km_km2?: number | null;
    objects?: {
      buildings_count?: number | null;
      trees_count?: number | null;
      road_km_total?: number | null;
      population_est?: number | null;
    };
  };
  notes?: string[];
}

const BASE = '/api/satellite/zonal-stats';

export async function fetchZonalStats(req: ZonalStatsRequest): Promise<ZonalStatsResult> {
  const res = await fetchWithClientTenantRetry(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.error ?? err.detail ?? detail;
    } catch {
      // keep default detail
    }
    throw new Error(`Zonal stats error: ${detail}`);
  }

  return res.json() as Promise<ZonalStatsResult>;
}
