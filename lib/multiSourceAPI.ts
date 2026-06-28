/**
 * multiSourceAPI.ts — Phase SIC-S13.1
 * =====================================
 * Client for POST /api/v1/satellite/multi-source/area
 * Returns fused multi-source (Sentinel-2, Sentinel-1, Landsat) context.
 */

const BASE = '/api/v1/satellite/multi-source/area';
import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MultiSourceRequest {
  bbox:       [number, number, number, number]; // [min_lon, min_lat, max_lon, max_lat]
  year_from?: number;
  year_to?:   number;
  zone?:      string;
}

export interface MultiSourceEnvironmental {
  ndvi:             number | null;
  bsi:              number | null;
  ndbi:             number | null;
  lst_c:            number | null;
  vv_db:            number | null;   // SAR VV backscatter (Sentinel-1)
  vh_db:            number | null;   // SAR VH backscatter (Sentinel-1)
  moisture_signal:  boolean;
  building_density: number | null;
  urban_expansion:  number | null;
}

export interface MultiSourceResult {
  request:            { bbox: number[]; year_from: number | null; year_to: number | null; use_case: string };
  retrieved_at:       string;
  source_stack:       string[];       // e.g. ['sentinel-2', 'sentinel-1', 'landsat']
  primary_source:     string;
  scene_count:        number;
  availability:       string;         // 'real' | 'modelled' | 'unavailable'
  confidence:         number;         // 0.0–1.0
  evidence_level:     string;         // 'observed' | 'confirmed' | 'estimated' | 'inferred' | 'unavailable'
  temporal_class:     string;         // 'current' | 'archive' | 'historical' | 'mixed'
  cloud_cover_pct:    number | null;
  environmental:      MultiSourceEnvironmental;
  strategy_note_ar:   string;
  strategy_note_en:   string;
  evidence_notes_ar:  string[];
  evidence_notes_en:  string[];
  limitations:        string[];
}

export interface MultiSourceResponse {
  status:  string;
  engine:  string;
  result:  MultiSourceResult;
  broker: {
    env_summary_ar:   string;
    env_summary_en:   string;
    source_stack:     string[];
    evidence_level:   string;
    anomaly_detected: boolean;
    timestamp:        string;
    limitations:      string[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Human-readable source label (Arabic) */
export function sourceStackLabel(sources: string[]): string {
  const map: Record<string, string> = {
    'sentinel-2': 'سنتينل-2 (بصري)',
    'sentinel-1': 'سنتينل-1 (رادار)',
    'landsat':    'لاندسات (أرشيف)',
    'nisar':      'نيسار',
  };
  return sources.map(s => map[s] ?? s).join(' + ');
}

/** Evidence level as Arabic label */
export function evidenceLevelAr(level: string): string {
  const map: Record<string, string> = {
    observed:    'قوي — مرصود مباشرة',
    confirmed:   'معتدل — مؤكد',
    estimated:   'ضعيف — مُقدَّر',
    inferred:    'منخفض جداً — مُستنتج',
    unavailable: 'غير متوفر',
  };
  return map[level] ?? level;
}

/** Data types from source stack */
export function dataTypes(sources: string[]): string[] {
  const types: string[] = [];
  if (sources.includes('sentinel-2') || sources.includes('landsat')) types.push('بصري');
  if (sources.includes('sentinel-1')) types.push('رادار SAR');
  if (sources.includes('landsat'))    types.push('أرشيف تاريخي');
  return types;
}

// ─── API call ─────────────────────────────────────────────────────────────────

export async function fetchMultiSourceArea(req: MultiSourceRequest): Promise<MultiSourceResponse> {
  const res = await fetchWithClientTenantRetry(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err: { detail?: string; message?: string } = await res.json();
      detail = err.detail ?? err.message ?? detail;
    } catch (_) { /* ignore */ }
    throw new Error(`Multi-source area error: ${detail}`);
  }

  return res.json() as Promise<MultiSourceResponse>;
}
