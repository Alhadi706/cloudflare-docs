import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';

export interface GeoprocessingRequest {
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
  scene_uid?: string;
  date_from?: string;
  date_to?: string;
  require_native?: boolean;
}

export interface GeoprocessingResult {
  status: 'ok' | 'error';
  source_mode: 'backend-geoprocessing' | 'derived-area-report';
  confidence: 'high' | 'medium' | 'low';
  computed_at: string;
  operations: {
    buffer_250m_ready: boolean;
    clip_ready: boolean;
    intersect_ready: boolean;
  };
  metrics: {
    aoi_bbox_area_m2: number;
    buffer_bbox_area_m2: number;
    clip_bbox_area_m2: number;
    intersect_bbox_area_m2: number;
  };
  notes?: string[];
}

const BASE = '/api/satellite/geoprocessing';

export async function fetchGeoprocessing(req: GeoprocessingRequest): Promise<GeoprocessingResult> {
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
      // Keep fallback detail.
    }
    throw new Error(`Geoprocessing error: ${detail}`);
  }

  return res.json() as Promise<GeoprocessingResult>;
}
