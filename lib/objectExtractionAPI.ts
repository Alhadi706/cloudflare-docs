import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';

export interface ObjectExtractionRequest {
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
  scene_uid?: string;
  date_from?: string;
  date_to?: string;
  require_native?: boolean;
}

export interface ObjectExtractionResult {
  status: 'ok' | 'error';
  source_mode: 'backend-object-extraction' | 'derived-area-report';
  confidence: 'high' | 'medium' | 'low';
  computed_at: string;
  objects: {
    buildings_count: number;
    trees_count: number;
    road_km_total: number;
    population_est: number;
  };
  densities?: {
    buildings_per_km2?: number | null;
    roads_km_per_km2?: number | null;
  };
  extraction_quality?: {
    model_version?: string;
    average_score?: number | null;
  };
  notes?: string[];
}

const BASE = '/api/satellite/object-extraction';

export async function fetchObjectExtraction(req: ObjectExtractionRequest): Promise<ObjectExtractionResult> {
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
    throw new Error(`Object extraction error: ${detail}`);
  }

  return res.json() as Promise<ObjectExtractionResult>;
}
