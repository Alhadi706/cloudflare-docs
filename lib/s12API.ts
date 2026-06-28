/**
 * s12API.ts — Phase S12
 * ======================
 * API clients for: SmartAreas · Temporal Analysis · Simulation · Decision Tracking
 */
import { fetchWithClientTenantRetry } from '@/lib/gis/clientTenantHeaders';

// ─── SmartArea ────────────────────────────────────────────────────────────────

export interface SmartArea {
  id:                 string;
  name:               string;
  bbox:               [number, number, number, number] | null;
  polygon:            [number, number][] | null;
  linked_project_id:  string | null;
  notes:              string | null;
  created_at:         string;
  simulations:        SavedSimulation[];
}

export async function saveSmartArea(params: {
  name?: string;
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
  notes?: string;
}): Promise<SmartArea> {
  const res = await fetchWithClientTenantRetry('/api/v1/satellite/smart-areas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`save-area: ${res.status}`);
  const data = await res.json();
  return data.area;
}

export async function listSmartAreas(): Promise<SmartArea[]> {
  const res = await fetchWithClientTenantRetry('/api/v1/satellite/smart-areas');
  if (!res.ok) throw new Error(`list-areas: ${res.status}`);
  const data = await res.json();
  return data.areas;
}

export async function deleteSmartArea(id: string): Promise<void> {
  await fetchWithClientTenantRetry(`/api/v1/satellite/smart-areas/${id}`, { method: 'DELETE' });
}

// ─── Temporal Compare ─────────────────────────────────────────────────────────

export interface TemporalSnapshot {
  year:            number;
  buildings_count: number;
  trees_count:     number;
  road_km_paved:   number;
  population_est:  number;
  temp_mean_c:     number;
  vegetation_pct:  number;
}

export interface TemporalCompareResult {
  computed_at:     string;
  year_from:       number;
  year_to:         number;
  narrative:       string;
  from_snapshot:   TemporalSnapshot;
  to_snapshot:     TemporalSnapshot;
  changes:         Record<string, string>;
  trend_labels:    Record<string, string>;
  disclaimer:      string;
}

export async function fetchTemporalCompare(params: {
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
  year_from: number;
  year_to: number;
}): Promise<TemporalCompareResult> {
  const res = await fetchWithClientTenantRetry('/api/v1/satellite/temporal-compare', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`temporal-compare: ${res.status}`);
  return res.json();
}

export interface TimeSeriesResult {
  computed_at: string;
  years:       number[];
  snapshots:   TemporalSnapshot[];
  chart_data:  Record<string, { year: number; value: number }[]>;
  disclaimer:  string;
}

export async function fetchTimeSeries(params: {
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
  years: number[];
}): Promise<TimeSeriesResult> {
  const res = await fetchWithClientTenantRetry('/api/v1/satellite/time-series', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`time-series: ${res.status}`);
  return res.json();
}

// ─── Simulation ───────────────────────────────────────────────────────────────

export interface SimulationResult {
  simulation_id: string;
  computed_at:   string;
  target_year:   number;
  area_id:       string | null;
  current_year:  number;
  is_future:     boolean;
  disclaimer:    string;
  narrative:     string;
  current_state: TemporalSnapshot;
  predicted:     TemporalSnapshot;
}

export interface SavedSimulation {
  id:          string;
  area_id:     string;
  target_year: number;
  predicted:   TemporalSnapshot;
  notes:       string | null;
  created_at:  string;
  compared:    boolean;
}

export async function fetchSimulation(params: {
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
  target_year: number;
  area_id?: string;
}): Promise<SimulationResult> {
  const res = await fetchWithClientTenantRetry('/api/v1/satellite/simulate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`simulate: ${res.status}`);
  return res.json();
}

export async function saveSimulation(params: {
  area_id: string;
  target_year: number;
  predicted: TemporalSnapshot;
  notes?: string;
}): Promise<SavedSimulation> {
  const res = await fetchWithClientTenantRetry('/api/v1/satellite/simulations/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`save-sim: ${res.status}`);
  const data = await res.json();
  return data.simulation;
}

export async function listSimulations(area_id: string): Promise<SavedSimulation[]> {
  const res = await fetchWithClientTenantRetry(`/api/v1/satellite/simulations/${area_id}`);
  if (!res.ok) throw new Error(`list-sims: ${res.status}`);
  const data = await res.json();
  return data.simulations;
}
