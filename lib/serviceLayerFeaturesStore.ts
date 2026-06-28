/**
 * File-based store for service layer geographic features.
 * Each layer has its own JSON file: .data/gis-layer-features-{layerId}.json
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), '.data');

function featuresFile(layerId: string): string {
  return path.join(DATA_DIR, `gis-layer-features-${layerId}.json`);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export type FeatureGeometryType = 'Point' | 'LineString' | 'Polygon';

export interface FeatureGeometry {
  type: FeatureGeometryType;
  coordinates: number[] | number[][] | number[][][];
}

export type FacilityType =
  | 'hospital'
  | 'health_center'
  | 'school'
  | 'university'
  | 'water_tank'
  | 'pump_station'
  | 'power_station'
  | 'warehouse'
  | 'fire_station'
  | 'police'
  | 'mosque'
  | 'market'
  | 'admin_building'
  | 'road'
  | 'boundary'
  | 'custom';

export interface LayerFeature {
  id: string;
  layer_id: string;
  geometry: FeatureGeometry;
  properties: {
    name: string;
    facility_type: FacilityType;
    description?: string;
    status?: 'active' | 'inactive' | 'planned';
    capacity?: number | null;
    address?: string;
    phone?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export function loadFeatures(layerId: string): LayerFeature[] {
  ensureDataDir();
  const file = featuresFile(layerId);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) as LayerFeature[];
  } catch {
    return [];
  }
}

export function saveFeatures(layerId: string, features: LayerFeature[]): void {
  ensureDataDir();
  fs.writeFileSync(featuresFile(layerId), JSON.stringify(features, null, 2), 'utf8');
}

export function addFeature(layerId: string, payload: {
  geometry: FeatureGeometry;
  properties: LayerFeature['properties'];
}): LayerFeature {
  const features = loadFeatures(layerId);
  const now = new Date().toISOString();
  const feature: LayerFeature = {
    id: randomUUID(),
    layer_id: layerId,
    geometry: payload.geometry,
    properties: {
      status: 'active',
      ...payload.properties,
    },
    created_at: now,
    updated_at: now,
  };
  features.push(feature);
  saveFeatures(layerId, features);
  return feature;
}

export function updateFeature(layerId: string, featureId: string, patch: Partial<LayerFeature>): LayerFeature | null {
  const features = loadFeatures(layerId);
  const idx = features.findIndex((f) => f.id === featureId);
  if (idx < 0) return null;
  features[idx] = { ...features[idx], ...patch, updated_at: new Date().toISOString() };
  saveFeatures(layerId, features);
  return features[idx];
}

export function deleteFeature(layerId: string, featureId: string): boolean {
  const features = loadFeatures(layerId);
  const next = features.filter((f) => f.id !== featureId);
  if (next.length === features.length) return false;
  saveFeatures(layerId, next);
  return true;
}

export function deleteAllFeatures(layerId: string): void {
  const file = featuresFile(layerId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function getFeatureCount(layerId: string): number {
  return loadFeatures(layerId).length;
}
