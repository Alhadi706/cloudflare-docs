/**
 * studyLayersAPI — client-side API helpers for study layers
 * طبقات الدراسة الخاصة بمركز الاستخبارات الفضائية
 */

export interface StudyLayerSummary {
  id:            string;
  name:          string;
  color:         string;
  description:   string;
  created_at:    string;
  updated_at:    string;
  feature_count: number;
}

export interface StudyLayerFeature {
  id:         string;
  name:       string;
  type:       'polygon' | 'line' | 'point';
  geometry:   any;  // GeoJSON geometry
  created_at: string;
  analysis_result?: any;
}

export interface StudyLayerFull extends StudyLayerSummary {
  features: StudyLayerFeature[];
}

const BASE = '/api/v1/satellite/study-layers';

export async function listStudyLayers(): Promise<StudyLayerSummary[]> {
  const r = await fetch(BASE);
  if (!r.ok) throw new Error('Failed to list study layers');
  const d = await r.json();
  return d.layers ?? [];
}

export async function createStudyLayer(
  name: string,
  color?: string,
  description?: string
): Promise<StudyLayerSummary> {
  const r = await fetch(BASE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, color, description: description ?? '' }),
  });
  if (!r.ok) throw new Error('Failed to create study layer');
  const d = await r.json();
  return d.layer;
}

export async function getStudyLayer(id: string): Promise<StudyLayerFull> {
  const r = await fetch(`${BASE}/${id}`);
  if (!r.ok) throw new Error('Layer not found');
  const d = await r.json();
  return d.layer;
}

export async function updateStudyLayer(
  id: string,
  patch: Partial<Pick<StudyLayerSummary, 'name' | 'color' | 'description'>>
): Promise<StudyLayerFull> {
  const r = await fetch(`${BASE}/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('Failed to update study layer');
  const d = await r.json();
  return d.layer;
}

export async function deleteStudyLayer(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('Failed to delete study layer');
}

export async function addFeatureToStudyLayer(
  layerId:  string,
  geometry: any,
  name?:    string,
  analysisResult?: any,
): Promise<StudyLayerFeature> {
  const r = await fetch(`${BASE}/${layerId}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ geometry, name, analysis_result: analysisResult }),
  });
  if (!r.ok) throw new Error('Failed to add feature');
  const d = await r.json();
  return d.feature;
}

export async function deleteFeatureFromStudyLayer(
  layerId: string,
  featureId: string,
): Promise<void> {
  const r = await fetch(`${BASE}/${layerId}?fid=${featureId}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('Failed to delete feature');
}
