// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🗺️ ERP-GIS SPATIAL INTEGRATION SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Client-side API service for spatial integration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const SPATIAL_BASE = `${API_BASE}/api/v1/erp-spatial`;

export interface SpatialPoint {
  latitude: number;
  longitude: number;
}

export interface AssetSpatial {
  asset_id: number;
  asset_name: string;
  asset_type: string;
  latitude: number;
  longitude: number;
  status?: string;
  health_score?: number;
  department?: string;
  location?: string;
}

export interface WorkOrderSpatialLink {
  work_order_id: number;
  asset_id: number;
  work_order_type: string;
  priority: string;
  status: string;
}

export interface ProjectBoundary {
  project_id: number;
  project_name: string;
  boundary_type: 'polygon' | 'line' | 'point';
  coordinates: number[][] | number[][][];
  description?: string;
}

export interface MonitoringEvent {
  event_type: string;
  asset_id: number;
  severity: string;
  latitude: number;
  longitude: number;
  description?: string;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  metadata?: Record<string, any>;
}

export interface GeoJSONFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  properties: Record<string, any>;
}

export interface NavigationTarget {
  asset_id?: number;
  asset_name?: string;
  center: {
    latitude: number;
    longitude: number;
  };
  zoom?: number;
  health_score?: number;
  map_url?: string;
  erp_url?: string;
}

// ═══════════════════════════════════════════════════════════════
// ASSET SPATIAL OPERATIONS
// ═══════════════════════════════════════════════════════════════

export const createAssetSpatial = async (asset: AssetSpatial): Promise<any> => {
  const response = await fetch(`${SPATIAL_BASE}/assets/spatial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asset)
  });
  if (!response.ok) throw new Error('Failed to create asset spatial data');
  return response.json();
};

export const getAssetSpatial = async (assetId: number): Promise<AssetSpatial> => {
  const response = await fetch(`${SPATIAL_BASE}/assets/${assetId}`);
  if (!response.ok) throw new Error('Asset not found');
  return response.json();
};

export const updateAssetSpatial = async (
  assetId: number,
  update: Partial<AssetSpatial>
): Promise<any> => {
  const response = await fetch(`${SPATIAL_BASE}/assets/${assetId}/spatial`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update)
  });
  if (!response.ok) throw new Error('Failed to update asset spatial data');
  return response.json();
};

export const getAssetsGeoJSON = async (
  healthThreshold?: number
): Promise<GeoJSONFeatureCollection> => {
  const url = new URL(`${SPATIAL_BASE}/assets/geojson`);
  if (healthThreshold !== undefined) {
    url.searchParams.append('health_threshold', healthThreshold.toString());
  }
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch assets GeoJSON');
  return response.json();
};

// ═══════════════════════════════════════════════════════════════
// MAINTENANCE WORK ORDERS SPATIAL
// ═══════════════════════════════════════════════════════════════

export const linkWorkOrderSpatial = async (
  link: WorkOrderSpatialLink
): Promise<any> => {
  const response = await fetch(`${SPATIAL_BASE}/work-orders/spatial-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(link)
  });
  if (!response.ok) throw new Error('Failed to link work order');
  return response.json();
};

export const getWorkOrdersGeoJSON = async (
  status?: string
): Promise<GeoJSONFeatureCollection> => {
  const url = new URL(`${SPATIAL_BASE}/work-orders/geojson`);
  if (status) url.searchParams.append('status', status);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch work orders GeoJSON');
  return response.json();
};

// ═══════════════════════════════════════════════════════════════
// PROJECT SPATIAL BOUNDARIES
// ═══════════════════════════════════════════════════════════════

export const createProjectBoundary = async (
  boundary: ProjectBoundary
): Promise<any> => {
  const response = await fetch(`${SPATIAL_BASE}/projects/boundary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(boundary)
  });
  if (!response.ok) throw new Error('Failed to create project boundary');
  return response.json();
};

export const getProjectsGeoJSON = async (): Promise<GeoJSONFeatureCollection> => {
  const response = await fetch(`${SPATIAL_BASE}/projects/geojson`);
  if (!response.ok) throw new Error('Failed to fetch projects GeoJSON');
  return response.json();
};

// ═══════════════════════════════════════════════════════════════
// MONITORING EVENTS SPATIAL
// ═══════════════════════════════════════════════════════════════

export const createMonitoringEvent = async (
  event: MonitoringEvent
): Promise<any> => {
  const response = await fetch(`${SPATIAL_BASE}/monitoring/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  if (!response.ok) throw new Error('Failed to create monitoring event');
  return response.json();
};

export const getMonitoringEventsGeoJSON = async (
  severity?: string,
  resolved: boolean = false
): Promise<GeoJSONFeatureCollection> => {
  const url = new URL(`${SPATIAL_BASE}/monitoring/events/geojson`);
  if (severity) url.searchParams.append('severity', severity);
  url.searchParams.append('resolved', resolved.toString());
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch monitoring events GeoJSON');
  return response.json();
};

// ═══════════════════════════════════════════════════════════════
// COMMAND CENTER UNIFIED
// ═══════════════════════════════════════════════════════════════

export const getCommandCenterUnifiedGeoJSON = async (): Promise<GeoJSONFeatureCollection> => {
  const response = await fetch(`${SPATIAL_BASE}/command-center/unified-geojson`);
  if (!response.ok) throw new Error('Failed to fetch command center data');
  return response.json();
};

// ═══════════════════════════════════════════════════════════════
// BIDIRECTIONAL NAVIGATION
// ═══════════════════════════════════════════════════════════════

export const navigateAssetToMap = async (assetId: number): Promise<NavigationTarget> => {
  const response = await fetch(`${SPATIAL_BASE}/navigation/asset-to-map/${assetId}`);
  if (!response.ok) throw new Error('Asset not found');
  return response.json();
};

export const navigateMapToAsset = async (
  latitude: number,
  longitude: number,
  radius: number = 100
): Promise<any> => {
  const url = new URL(`${SPATIAL_BASE}/navigation/map-to-asset`);
  url.searchParams.append('latitude', latitude.toString());
  url.searchParams.append('longitude', longitude.toString());
  url.searchParams.append('radius', radius.toString());
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to find nearby asset');
  return response.json();
};

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

export const openAssetOnMap = (assetId: number): void => {
  // Open command center with asset highlighted
  window.open(
    `/dashboard/gis-sovereignty/command-center?highlight=asset-${assetId}`,
    '_blank'
  );
};

export const openErpAssetPage = (assetId: number): void => {
  // Navigate to asset registry with highlight
  window.location.href = `/dashboard/admin-gateway/assets/registry?highlight=${assetId}`;
};

export const getMarkerColorForHealth = (healthScore: number): string => {
  if (healthScore >= 80) return '#10b981'; // green
  if (healthScore >= 50) return '#fbbf24'; // yellow
  return '#ef4444'; // red
};

export const getMarkerColorForPriority = (priority: string): string => {
  const colors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    normal: '#3b82f6',
    low: '#10b981'
  };
  return colors[priority?.toLowerCase()] || '#6b7280';
};

export const getMarkerColorForSeverity = (severity: string): string => {
  const colors: Record<string, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#fbbf24',
    low: '#3b82f6'
  };
  return colors[severity?.toLowerCase()] || '#6b7280';
};
