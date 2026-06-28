import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';

export interface TopologyQaRequest {
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
  scene_uid?: string;
  date_from?: string;
  date_to?: string;
  require_native?: boolean;
}

export interface TopologyQaResult {
  status: 'ok' | 'error';
  source_mode: 'backend-topology-qa' | 'derived-aoi-rules';
  confidence: 'high' | 'medium' | 'low';
  computed_at: string;
  checks: {
    ring_closed: boolean;
    self_intersection_free: boolean;
    valid_bbox: boolean;
    min_area_ok: boolean;
  };
  issues: string[];
  quality_score: number;
  notes?: string[];
}

const BASE = '/api/satellite/topology-qa';

export async function fetchTopologyQa(req: TopologyQaRequest): Promise<TopologyQaResult> {
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
    throw new Error(`Topology QA error: ${detail}`);
  }

  return res.json() as Promise<TopologyQaResult>;
}
