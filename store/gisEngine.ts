/**
 * GIS Unified Engine Store — محرك GIS الموحد
 * ═══════════════════════════════════════════
 * المصدر الوحيد للحقيقة لكل عمليات الخريطة عبر جميع مساحات العمل.
 *
 * المبادئ:
 *  - لا بيانات وهمية — كل كيان مصدره API حقيقي أو يُظهر حالة فارغة صريحة
 *  - ربط ERP-GIS إلزامي: مشروع بلا هندسة = انتهاك، أصل بلا إحداثيات = انتهاك
 *  - تصفية زمنية مركزية تُطبَّق على جميع الطبقات
 *  - إدارة الطبقات موحدة عبر جميع أوضاع العمل
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolveTenantContext, tenantHeaders } from '@/lib/gis/tenantContext';

// ══════════════════════════════════════════════════════════════════
// SHARED OL MAP SINGLETON  (not stored in Zustand — OL map is not
// serialisable, so we keep it as a plain module-level reference)
// ══════════════════════════════════════════════════════════════════
let _olMapSingleton: any = null;

/** MapCenterCanvas registers the live OL Map instance here after init. */
export function setSharedOlMap(map: any): void {
  _olMapSingleton = map;
  useGisEngine.getState().setOlMapReady(!!map);
}

/** CorridorMap (and any other consumer) reads the live OL Map here. */
export function getSharedOlMap(): any | null {
  return _olMapSingleton;
}

const API = '/api/v1';

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

export type GisWorkspace = 'satellite' | 'engineering' | 'maintenance' | 'executive' | 'spatial' | 'monitor' | 'remote_sensing';

export type BasemapKey = 'satellite' | 'terrain' | 'light' | 'dark' | 'road' | 'ndvi'
  | 's2_tci' | 's2_ndvi' | 's2_ndwi' | 's2_cir' | 's2_swir' | 's1_sar' | 's1_rgb'
  | 'dem' | 'hillshade';

// Drawing modes — used by engineering workspace toolbar
export type DrawingMode = 'idle' | 'polygon' | 'line' | 'point' | 'aoi-rectangle' | 'trace' | 'orthogonal-polygon' | 'modify' | 'delete' | 'measure-distance' | 'measure-area' | 'inspect-coordinate' | 'pick-location' | 'buffer' | 'nearby' | 'intersect';
export type EntityRenderMode = 'icons' | 'density';

export type LayerId =
  | 'projects'
  | 'assets'
  | 'work_orders'
  | 'employees'
  | 'warehouses'
  | 'contracts'
  | 'alerts'
  | 'satellite_ndvi'
  | 'satellite_sar'
  | 'heatmap'
  | 'roads'
  | 'admin_boundaries'
  | 'corridors';

export type LayerCategory = 'erp' | 'satellite' | 'infrastructure' | 'admin';

// ── Dual-Path GIS Architecture ───────────────────────────────────────────────
/**
 * GisPath defines the top-level operating mode of the engineering workspace.
 *  'asset'   — Real-world asset registry (open to all departments)
 *  'project' — Under-construction / proposed features (restricted departments)
 */
export type GisPath = 'asset' | 'project';

/** Tools available per GIS path */
export const PATH_TOOLS: Record<GisPath, string[]> = {
  asset: [
    'draw',           // رسم المعالم
    'explore',        // استكشاف الأصول
    'street_view',    // Street View
    'satellite',      // خرائط الأقمار الاصطناعية
    'spatial_search', // بحث مكاني
    'file_upload',    // رفع ملفات (CAD, Excel, GeoJSON)
    'analysis',       // أدوات التحليل المكاني
    'work_orders',    // أوامر العمل والصيانة
  ],
  project: [
    'draw',           // رسم مواقع المشاريع
    'progress_view',  // عرض التقدم المالي والزمني
    'financial_link', // ربط بالمستخلصات والميزانيات
    'correspondence', // ربط بالمراسلات الإدارية
    'handover',       // تفعيل الاستلام النهائي
    'file_upload',    // رفع ملفات المشروع
    'reports',        // تقارير فنية
  ],
};

/** Arabic labels for each tool */
export const TOOL_LABELS: Record<string, string> = {
  draw:           'رسم المعالم',
  explore:        'استكشاف',
  street_view:    'Street View',
  satellite:      'الأقمار الاصطناعية',
  spatial_search: 'بحث مكاني',
  file_upload:    'رفع ملفات',
  analysis:       'تحليل مكاني',
  work_orders:    'أوامر العمل',
  progress_view:  'التقدم المالي والزمني',
  financial_link: 'ربط مالي',
  correspondence: 'المراسلات',
  handover:       'استلام نهائي',
  reports:        'تقارير فنية',
};

/** Department access control per path */
export const PATH_ACCESS: Record<GisPath, string[] | 'all'> = {
  asset:   'all',  // all departments
  project: ['projects', 'monitoring', 'finance', 'super_admin', 'project_admin'],
};

export interface LayerDef {
  id: LayerId;
  labelAr: string;
  category: LayerCategory;
  color: string;
  defaultVisible: Record<GisWorkspace, boolean>;
  minWorkspace: GisWorkspace[];  // which workspaces allow this layer
}

// ERP entities on map
export interface MapProject {
  id: string | number;
  name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  geometry: GeoJSON_Geometry | null;
  budget?: number;
  start_date?: string;
  end_date?: string;
}

export interface MapAsset {
  id: string | number;
  name: string;
  asset_type: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  health_score?: number;
  project_id?: string | number;
  site_id?: number;
  has_geometry: boolean;
}

export interface MapWorkOrder {
  id: string | number;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  asset_id: string | number | null;
  latitude: number | null;
  longitude: number | null;
  scheduled_date?: string;
  has_asset_link: boolean;
}

export interface MapEmployee {
  id: string | number;
  name: string;
  department: string;
  latitude: number | null;
  longitude: number | null;
  location_status: 'located' | 'unassigned' | 'unknown';
  active: boolean;
}

export interface MapWarehouse {
  id: string | number;
  name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  status: string;
}

export interface MapAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  entity_type?: string;
  entity_id?: string | number;
}

export interface MapCorridor {
  id: string;
  name: string;
  geometry: [number, number][];   // array of [lon, lat]
  buffer_meters: number;
  status?: string;
}

// ── SVY CP Overlay (for cross-module GIS publish from corrosion module) ─────
export interface SvyCpFeature {
  chainage_m: number;
  on_mv: number;
  off_mv: number;
  gps_lat: number;
  gps_lon: number;
  is_off_below_850mv: boolean;
  protection_status: 'PROTECTED' | 'MARGINAL' | 'UNPROTECTED';
}

export interface SvyCpOverlay {
  sessionId: string | null;
  filename: string;
  pipelineId: string | null;
  surveyDate: string | null;
  features: SvyCpFeature[];
}

export type GeoJSON_Geometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };

export interface AoiSelection {
  source: 'admin-boundary' | 'manual-rectangle' | 'manual-polygon';
  name: string;
  geometry: GeoJSON_Geometry;
  bbox: [number, number, number, number] | null;
  updatedAt: string;
}

// ERP-GIS Binding Violation
export interface BindingViolation {
  entity_type: 'project' | 'asset' | 'work_order' | 'employee';
  entity_id: string | number;
  entity_name: string;
  violation: 'missing_geometry' | 'missing_coordinates' | 'missing_asset_link' | 'missing_location';
  severity: 'error' | 'warning';
}

// ── Layer Governance ─────────────────────────────────────────────
export type VisibilityScope = 'private' | 'shared_selected' | 'organization_wide';
export type EditPolicy = 'owner_only' | 'owner_plus_approved';
export type PublishStatus = 'draft' | 'reviewed' | 'published';

export interface GovernedLayer {
  id: string;
  name: string;
  layer_type: string;
  owner_department: string;
  visibility_scope: VisibilityScope;
  edit_policy: EditPolicy;
  publish_status: PublishStatus;
  is_base_layer: boolean;
  geometry_type: string;
  visible_to_departments: string[];
}

// Sovereign Layer (from /api/v1/map/sovereign-layers)
export interface SovereignLayerDef {
  id: string;
  name: string;
  layer_dept_type: string;
  owner_department: string;
  visibility_scope: VisibilityScope;
  edit_policy: EditPolicy;
  publish_status: PublishStatus;
  is_base_layer: boolean;
  geometry_type: string;
  description?: string;
  visible_to_departments: string[];
  can_edit: boolean;
}

export interface GovernanceAuditEntry {
  id: string;
  changed_by: string;
  changed_at: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  change_summary: string;
}

export interface SatelliteDataset {
  id: string;
  capture_date: string;
  satellite_name: string;
  coverage_area: string;
  band_type: string;
  data_category: 'raw' | 'processed';
  processing_status: string;
  resolution_m: number | null;
  cloud_coverage_pct: number | null;
  allowed_departments: string[];
}

// Time filter
export interface TimeFilter {
  enabled: boolean;
  start: string | null;   // ISO date
  end: string | null;     // ISO date
  mode: 'range' | 'snapshot' | 'comparison';
  comparisonDate: string | null;
}

// Layer visibility state
export type LayerVisibility = Record<LayerId, boolean>;
export type LayerOpacity = Record<LayerId, number>;

// ══════════════════════════════════════════════════════════════════
// LAYER REGISTRY
// ══════════════════════════════════════════════════════════════════

export const LAYER_REGISTRY: LayerDef[] = [
  {
    id: 'projects',
    labelAr: 'حدود المشاريع',
    category: 'erp',
    color: '#3b82f6',
    defaultVisible: { satellite: false, engineering: true, maintenance: true, executive: true, spatial: true, monitor: false },
    minWorkspace: ['engineering', 'maintenance', 'executive', 'spatial'],
  },
  {
    id: 'assets',
    labelAr: 'الأصول والمعدات',
    category: 'erp',
    color: '#10b981',
    defaultVisible: { satellite: true, engineering: true, maintenance: true, executive: true, spatial: true, monitor: true },
    minWorkspace: ['satellite', 'engineering', 'maintenance', 'executive', 'spatial', 'monitor'],
  },
  {
    id: 'work_orders',
    labelAr: 'أوامر العمل',
    category: 'erp',
    color: '#f59e0b',
    defaultVisible: { satellite: false, engineering: false, maintenance: true, executive: false, spatial: false, monitor: false },
    minWorkspace: ['maintenance', 'engineering'],
  },
  {
    id: 'employees',
    labelAr: 'الموظفون',
    category: 'erp',
    color: '#8b5cf6',
    defaultVisible: { satellite: true, engineering: false, maintenance: true, executive: false, spatial: false, monitor: false },
    minWorkspace: ['satellite', 'maintenance', 'executive'],
  },
  {
    id: 'warehouses',
    labelAr: 'المخازن',
    category: 'erp',
    color: '#22d3ee',
    defaultVisible: { satellite: true, engineering: false, maintenance: true, executive: true, spatial: true, monitor: false },
    minWorkspace: ['satellite', 'maintenance', 'executive', 'spatial'],
  },
  {
    id: 'contracts',
    labelAr: 'العقود',
    category: 'erp',
    color: '#06b6d4',
    defaultVisible: { satellite: false, engineering: false, maintenance: false, executive: true, spatial: false, monitor: false },
    minWorkspace: ['executive', 'spatial'],
  },
  {
    id: 'alerts',
    labelAr: 'التنبيهات',
    category: 'erp',
    color: '#ef4444',
    defaultVisible: { satellite: true, engineering: true, maintenance: true, executive: true, spatial: true, monitor: true },
    minWorkspace: ['satellite', 'engineering', 'maintenance', 'executive', 'spatial', 'monitor'],
  },
  {
    id: 'satellite_ndvi',
    labelAr: 'مؤشر NDVI',
    category: 'satellite',
    color: '#84cc16',
    defaultVisible: { satellite: true, engineering: false, maintenance: false, executive: false, spatial: true, monitor: true },
    minWorkspace: ['satellite', 'spatial', 'monitor'],
  },
  {
    id: 'satellite_sar',
    labelAr: 'رادار SAR',
    category: 'satellite',
    color: '#a855f7',
    defaultVisible: { satellite: true, engineering: false, maintenance: false, executive: false, spatial: false, monitor: true },
    minWorkspace: ['satellite', 'monitor'],
  },
  {
    id: 'heatmap',
    labelAr: 'خريطة حرارية',
    category: 'erp',
    color: '#f97316',
    defaultVisible: { satellite: false, engineering: false, maintenance: false, executive: true, spatial: true, monitor: false },
    minWorkspace: ['executive', 'spatial'],
  },
  {
    id: 'roads',
    labelAr: 'شبكة الطرق',
    category: 'infrastructure',
    color: '#94a3b8',
    defaultVisible: { satellite: false, engineering: true, maintenance: true, executive: false, spatial: false, monitor: false },
    minWorkspace: ['engineering', 'maintenance'],
  },
  {
    id: 'admin_boundaries',
    labelAr: 'الحدود الإدارية',
    category: 'admin',
    color: '#e2e8f0',
    defaultVisible: { satellite: false, engineering: false, maintenance: false, executive: true, spatial: true, monitor: false },
    minWorkspace: ['executive', 'spatial', 'engineering'],
  },
  {
    id: 'corridors',
    labelAr: 'ممرات البنية التحتية',
    category: 'infrastructure',
    color: '#f97316',
    defaultVisible: { satellite: true, engineering: true, maintenance: true, executive: true, spatial: true, monitor: true },
    minWorkspace: ['satellite', 'engineering', 'maintenance', 'executive', 'spatial', 'monitor'],
  },
];

export const BASEMAPS: Record<BasemapKey, { labelAr: string; url: string; attr: string; group?: string }> = {
  // Use same-origin proxy to avoid browser/network blocking of third-party tile hosts.
  satellite: { labelAr: 'صور فضائية (Esri)',  url: '/tiles/satellite/{z}/{y}/{x}',                                                             attr: 'Esri World Imagery (proxied)',   group: 'base'      },
  terrain:   { labelAr: 'تضاريس',              url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',                                              attr: 'OpenTopoMap',                   group: 'base'      },
  light:     { labelAr: 'فاتح',                url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',                                   attr: 'CartoDB',                       group: 'base'      },
  dark:      { labelAr: 'داكن',                url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',                                    attr: 'CartoDB',                       group: 'base'      },
  road:      { labelAr: 'الطرق',               url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',                                            attr: 'OpenStreetMap contributors',    group: 'base'      },
  ndvi:      { labelAr: 'NDVI (EOX 2020)',      url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg', attr: 'EOX Sentinel-2 proxy',          group: 'base'      },
  // ── Sentinel-2 live layers (via CDSE Process API proxy) ────────────────────────────
  s2_tci:    { labelAr: 'سنتينل-2 لون حقيقي (TCI)', url: '/tiles/sentinel/tci/latest/{z}/{y}/{x}',              attr: 'Copernicus Sentinel-2 L2A — متجدد دورياً', group: 'sentinel' },
  s2_ndvi:   { labelAr: 'سنتينل-2 NDVI حي',         url: '/tiles/sentinel/ndvi/latest/{z}/{y}/{x}',              attr: 'Copernicus Sentinel-2 — غطاء نباتي حي',  group: 'sentinel' },
  s2_ndwi:   { labelAr: 'سنتينل-2 NDWI مياه',       url: '/tiles/sentinel/ndwi/latest/{z}/{y}/{x}',              attr: 'Copernicus Sentinel-2 — مؤشر المياه',      group: 'sentinel' },
  s2_cir:    { labelAr: 'سنتينل-2 أشعة تحت حمراء (CIR)', url: '/tiles/sentinel/cir/latest/{z}/{y}/{x}',         attr: 'Copernicus Sentinel-2 — لون مصطنع',         group: 'sentinel' },
  s2_swir:   { labelAr: 'سنتينل-2 SWIR حراري',      url: '/tiles/sentinel/swir/latest/{z}/{y}/{x}',              attr: 'Copernicus Sentinel-2 — SWIR',            group: 'sentinel' },
  // ── Sentinel-1 SAR (radar) ─────────────────────────────────────────────────────
  s1_sar:    { labelAr: 'سنتينل-1 رادار VV',         url: '/tiles/sentinel/sar/latest/{z}/{y}/{x}',               attr: 'Copernicus Sentinel-1 SAR — يخترق الغيوم', group: 'sentinel' },
  s1_rgb:    { labelAr: 'سنتينل-1 SAR RGB',        url: '/tiles/sentinel/sar_rgb/latest/{z}/{y}/{x}',           attr: 'Copernicus Sentinel-1 VV/VH — مركب',   group: 'sentinel' },
  // ── Copernicus DEM ────────────────────────────────────────────────────────────────
  dem:       { labelAr: 'تضاريس DEM 30م (Copernicus)', url: '/tiles/sentinel/dem/latest/{z}/{y}/{x}',                attr: 'Copernicus DEM GLO-30',               group: 'dem' },
  hillshade: { labelAr: 'تظليل التضاريس',         url: '/tiles/sentinel/hillshade/latest/{z}/{y}/{x}',         attr: 'Copernicus DEM — Hillshade',              group: 'dem' },
};

// ══════════════════════════════════════════════════════════════════
// STORE STATE
// ══════════════════════════════════════════════════════════════════

function buildDefaultVisibility(workspace: GisWorkspace): LayerVisibility {
  return Object.fromEntries(
    LAYER_REGISTRY.map(l => [l.id, l.defaultVisible[workspace]])
  ) as LayerVisibility;
}

function buildDefaultOpacity(): LayerOpacity {
  return Object.fromEntries(
    LAYER_REGISTRY.map(l => [l.id, 1.0])
  ) as LayerOpacity;
}

interface GisEngineState {
  // ── Workspace ──────────────────────────────────────────────
  workspace: GisWorkspace;

  // ── Shared OL Map (non-persisted) ─────────────────────────
  olMapReady: boolean;
  setOlMapReady: (ready: boolean) => void;

  // ── Viewport ───────────────────────────────────────────────
  center: [number, number];   // [lon, lat]
  zoom: number;
  basemap: BasemapKey;

  // ── Layers ─────────────────────────────────────────────────
  layerVisibility: LayerVisibility;
  layerOpacity: LayerOpacity;
  entityRenderMode: EntityRenderMode;

  // ── ERP Entities on Map ────────────────────────────────────
  projects: MapProject[];
  assets: MapAsset[];
  workOrders: MapWorkOrder[];
  employees: MapEmployee[];
  alerts: MapAlert[];

  projectsLoading: boolean;
  assetsLoading: boolean;
  workOrdersLoading: boolean;
  employeesLoading: boolean;

  projectsError: string | null;
  assetsError: string | null;
  workOrdersError: string | null;
  employeesError: string | null;

  warehouses: MapWarehouse[];
  warehousesLoading: boolean;

  // ── Corridors on Map ───────────────────────────────────────
  corridors: MapCorridor[];
  corridorsLoading: boolean;


  // ── ERP Binding Violations ─────────────────────────────────
  violations: BindingViolation[];
  violationsLoading: boolean;

  // ── Time Filter ────────────────────────────────────────────
  timeFilter: TimeFilter;

  // ── Selected Entity ────────────────────────────────────────
  selectedEntityType: 'project' | 'asset' | 'work_order' | 'employee' | 'warehouse' | null;
  selectedEntityId: string | number | null;

  // ── UI Panels ──────────────────────────────────────────────
  layerPanelOpen: boolean;
  timePanelOpen: boolean;
  violationPanelOpen: boolean;

  // ── Drawing (engineering workspace) ───────────────────────
  drawingMode: DrawingMode;
  drawnFeatures: { type: DrawingMode; geojson: object }[];

  // ── Area Of Interest (AOI) ────────────────────────────────
  aoi: AoiSelection | null;

  // ── Layer Governance ───────────────────────────────────────
  governedLayers: GovernedLayer[];
  governedLayersLoading: boolean;
  activeDepartment: string | null;  // requesting department for visibility filter
  governancePanelOpen: boolean;
  satelliteDatasets: SatelliteDataset[];
  satelliteDatasetsLoading: boolean;
  // ── Sovereign Layer Registry ───────────────────────────────────
  sovereignLayers: SovereignLayerDef[];
  sovereignLayersLoading: boolean;

  // ── SVY CP Overlay (from corrosion module publish) ─────────────
  svyCpOverlay: SvyCpOverlay | null;
  setSvyCpOverlay: (overlay: SvyCpOverlay | null) => void;

  // ── Actions ────────────────────────────────────────────────
  setWorkspace: (ws: GisWorkspace) => void;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setBasemap: (bm: BasemapKey) => void;

  toggleLayer: (id: LayerId) => void;
  setLayerOpacity: (id: LayerId, opacity: number) => void;
  setLayerVisible: (id: LayerId, visible: boolean) => void;
  setEntityRenderMode: (mode: EntityRenderMode) => void;
  toggleEntityRenderMode: () => void;

  loadProjects: () => Promise<void>;
  loadAssets: () => Promise<void>;
  loadWorkOrders: () => Promise<void>;
  loadEmployees: () => Promise<void>;
  loadViolations: () => Promise<void>;
  loadWarehouses: () => Promise<void>;
  loadCorridors: () => Promise<void>;

  setTimeFilter: (filter: Partial<TimeFilter>) => void;
  resetTimeFilter: () => void;

  selectEntity: (type: 'project' | 'asset' | 'work_order' | 'employee' | 'warehouse' | null, id: string | number | null) => void;

  toggleLayerPanel: () => void;
  toggleTimePanel: () => void;
  toggleViolationPanel: () => void;

  // Drawing actions
  setDrawingMode: (mode: DrawingMode) => void;
  addDrawnFeature: (type: DrawingMode, geojson: object) => void;
  clearDrawnFeatures: () => void;

  setAoi: (aoi: AoiSelection | null) => void;
  clearAoi: () => void;

  // Location pick (map click → form field)
  pendingLocationCallback: ((lon: number, lat: number) => void) | null;
  requestMapLocation: (cb: (lon: number, lat: number) => void) => void;
  cancelLocationPick: () => void;

  // Governance actions
  loadGovernedLayers: (requestingDept?: string) => Promise<void>;
  setActiveDepartment: (dept: string | null) => void;
  toggleGovernancePanel: () => void;
  
  // ── تحميل مناطق المشاريع من projects_core ──────────────────
  projectAreasFromCore: any[];
  projectAreasLoading: boolean;
  loadProjectAreas: () => Promise<void>;
  
  loadSatelliteDatasets: (requestingDept?: string) => Promise<void>;

  // Sovereign layer actions
  loadSovereignLayers: (requestingDept?: string) => Promise<void>;
  saveDrawnFeatureToBackend: (name: string, featureType: string, geometry: object, department?: string) => Promise<string | null>;

  refreshAll: () => Promise<void>;
}


// ══════════════════════════════════════════════════════════════════
// FETCH HELPERS
// ══════════════════════════════════════════════════════════════════

function hdr(): HeadersInit {
  return { 'Content-Type': 'application/json', ...tenantHeaders() };
}

async function fetchProjects(): Promise<MapProject[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    const res = await fetch(`${API}/erp-spatial/projects/geojson?tenant_id=${ctx.tenantId}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    // Response is GeoJSON FeatureCollection
    const features: any[] = data.features ?? [];
    return features.map(f => {
      const p = f.properties ?? {};
      return {
        id: p.id ?? f.id,
        name: p.name ?? 'مشروع',
        status: p.status ?? 'unknown',
        latitude: p.lat ?? (f.geometry?.type === 'Point' ? f.geometry.coordinates[1] : null),
        longitude: p.lon ?? (f.geometry?.type === 'Point' ? f.geometry.coordinates[0] : null),
        geometry: f.geometry ?? null,
        budget: p.budget,
        start_date: p.start_date,
        end_date: p.end_date,
      };
    });
  } catch { return []; }
}

async function fetchAssets(): Promise<MapAsset[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    const res = await fetch(`${API}/erp-spatial/assets/geojson?tenant_id=${ctx.tenantId}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    // Response is GeoJSON FeatureCollection
    const features: any[] = data.features ?? [];
    return features.map(f => {
      const a = f.properties ?? {};
      // Use UUID id from properties (added now), or feature-level id (now also UUID)
      const resolvedId = a.id ?? (typeof f.id === 'string' && !f.id.startsWith('asset-') ? f.id : null) ?? a.asset_id ?? f.id;
      return {
        id: resolvedId,
        name: a.name ?? a.asset_name ?? 'أصل',
        asset_type: a.asset_type ?? a.type ?? 'unknown',
        latitude: a.lat ?? (f.geometry?.type === 'Point' ? f.geometry.coordinates[1] : null),
        longitude: a.lon ?? (f.geometry?.type === 'Point' ? f.geometry.coordinates[0] : null),
        status: a.status ?? 'unknown',
        health_score: a.health_score,
        project_id: a.project_id,
        site_id: a.site_id,
        has_geometry: !!f.geometry,
      };
    });
  } catch { return []; }
}

async function fetchWorkOrders(): Promise<MapWorkOrder[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    const res = await fetch(`${API}/erp-spatial/work-orders/geojson?tenant_id=${ctx.tenantId}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    // Response is GeoJSON FeatureCollection
    const features: any[] = data.features ?? [];
    return features.map(f => {
      const w = f.properties ?? {};
      return {
        id: w.id ?? f.id,
        title: w.title ?? w.title_ar ?? 'أمر عمل',
        priority: w.priority ?? 'normal',
        status: w.status ?? 'unknown',
        asset_id: w.asset_id ?? null,
        latitude: f.geometry?.type === 'Point' ? f.geometry.coordinates[1] : null,
        longitude: f.geometry?.type === 'Point' ? f.geometry.coordinates[0] : null,
        scheduled_date: w.scheduled_date,
        has_asset_link: !!(w.asset_id),
      };
    });
  } catch { return []; }
}

async function fetchEmployees(): Promise<MapEmployee[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    const res = await fetch(`${API}/erp-spatial/employees/geojson?tenant_id=${ctx.tenantId}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    const features: any[] = data.features ?? [];
    return features.map(f => {
      const p = f.properties ?? {};
      return {
        id: p.id,
        name: p.name ?? `موظف ${p.id}`,
        department: p.department ?? 'غير محدد',
        latitude: f.geometry?.type === 'Point' ? f.geometry.coordinates[1] : null,
        longitude: f.geometry?.type === 'Point' ? f.geometry.coordinates[0] : null,
        location_status: (f.geometry ? 'located' : 'unknown') as 'located' | 'unassigned' | 'unknown',
        active: p.active ?? true,
      };
    });
  } catch { return []; }
}

async function fetchWarehouses(): Promise<MapWarehouse[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    const res = await fetch(`${API}/erp-spatial/warehouses/geojson?tenant_id=${ctx.tenantId}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    const features: any[] = data.features ?? [];
    return features.map(f => {
      const p = f.properties ?? {};
      return {
        id: p.id,
        name: p.name ?? `مستودع ${p.id}`,
        city: p.city ?? null,
        latitude: f.geometry?.type === 'Point' ? f.geometry.coordinates[1] : null,
        longitude: f.geometry?.type === 'Point' ? f.geometry.coordinates[0] : null,
        capacity: p.capacity ?? null,
        status: p.status ?? 'active',
      };
    });
  } catch { return []; }
}

async function fetchViolations(): Promise<BindingViolation[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    const res = await fetch(`${API}/gis/binding/violations?tenant_id=${ctx.tenantId}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.violations) ? data.violations : [];
  } catch { return []; }
}

async function fetchGovernedLayers(requestingDept?: string): Promise<GovernedLayer[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    const q = requestingDept
      ? `tenant_id=${ctx.tenantId}&requesting_dept=${encodeURIComponent(requestingDept)}`
      : `tenant_id=${ctx.tenantId}`;
    const res = await fetch(`${API}/gis/governance/layers?${q}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.layers ?? []) as GovernedLayer[];
  } catch { return []; }
}

async function fetchSovereignLayers(requestingDept?: string): Promise<SovereignLayerDef[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    const q = requestingDept
      ? `tenant_id=${ctx.tenantId}&requesting_dept=${encodeURIComponent(requestingDept)}`
      : `tenant_id=${ctx.tenantId}`;
    const res = await fetch(`${API}/map/sovereign-layers?${q}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.layers ?? []) as SovereignLayerDef[];
  } catch { return []; }
}
// ── تحميل مناطق المشاريع من projects_core تلقائياً ──────────────────────
async function fetchProjectAreasFromCore(): Promise<any[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    // جلب المشاريع من projects_core
    const res = await fetch(`${API}/v1/projects`, {
      headers: { ...hdr(), 'X-Tenant-ID': ctx.tenantId }
    });
    if (!res.ok) return [];
    const projects = await res.json();
    if (!Array.isArray(projects)) return [];
    
    // تحويل المشاريع إلى features GIS
    const features = projects
      .filter((p: any) => p.latitude && p.longitude)
      .map((p: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(p.longitude), parseFloat(p.latitude)]
        },
        properties: {
          id: p.id,
          name: p.name || p.project_name || `مشروع ${p.id}`,
          project_code: p.code || p.project_code,
          status: p.status || 'active',
          description: p.description,
          layer_type: 'project_area',
          created_via: 'projects_core_sync'
        }
      }));
    
    console.log(`✅ تم جلب ${features.length} مشروع من projects_core للربط التلقائي`);
    return features;
  } catch (err) {
    console.warn('⚠️ فشل جلب مناطق المشاريع من projects_core:', err);
    return [];
  }
}
async function fetchSatelliteDatasets(requestingDept?: string): Promise<SatelliteDataset[]> {
  const ctx = resolveTenantContext();
  if (!ctx.tenantId) return [];
  try {
    const q = requestingDept
      ? `tenant_id=${ctx.tenantId}&requesting_dept=${encodeURIComponent(requestingDept)}`
      : `tenant_id=${ctx.tenantId}`;
    const res = await fetch(`${API}/gis/governance/satellite/pipeline?${q}`, { headers: hdr() });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.datasets ?? []) as SatelliteDataset[];
  } catch { return []; }
}

// ══════════════════════════════════════════════════════════════════
// STORE
// ══════════════════════════════════════════════════════════════════

export const useGisEngine = create<GisEngineState>()(
  persist(
    (set, get) => ({
        // ── Shared OL Map ──────────────────────────────────────
        olMapReady: false,
        setOlMapReady: (ready) => set({ olMapReady: ready }),

        // ── Workspace ──────────────────────────────────────────
      workspace: 'engineering',
      center: [13.19, 32.89],
      zoom: 11,
      basemap: 'satellite',

      layerVisibility: buildDefaultVisibility('engineering'),
      layerOpacity: buildDefaultOpacity(),
      entityRenderMode: 'density',

      projects: [],
      assets: [],
      workOrders: [],
      employees: [],
      warehouses: [],
      alerts: [],

      projectsLoading: false,
      assetsLoading: false,
      workOrdersLoading: false,
      employeesLoading: false,
      warehousesLoading: false,

      projectsError: null,
      assetsError: null,
      workOrdersError: null,
      employeesError: null,

      violations: [],
      violationsLoading: false,

      timeFilter: {
        enabled: false,
        start: null,
        end: null,
        mode: 'range',
        comparisonDate: null,
      },

      selectedEntityType: null,
      selectedEntityId: null,

      layerPanelOpen: false,
      timePanelOpen: false,
      violationPanelOpen: false,
      // ── Widget visibility (map-shell panels) ─────────────────
      widgetVisibility: {
        top: true,
        left: true,
        right: true,
        bottom: false,
      },
      toggleWidget: (position: 'top' | 'left' | 'right' | 'bottom') => 
        set(s => ({
          widgetVisibility: {
            ...s.widgetVisibility,
            [position]: !s.widgetVisibility[position],
          },
        })),
      

      // ── Workspace ──────────────────────────────────────────
      setWorkspace: (workspace) => set({
        workspace,
        layerVisibility: {
          ...buildDefaultVisibility(workspace),
          // Assets are a global base layer and should remain visible across all screens.
          assets: true,
        },
      }),

      // ── Viewport ───────────────────────────────────────────
      setCenter: (center) => set({ center }),
      setZoom:   (zoom)   => set({ zoom }),
      setBasemap: (basemap) => set({ basemap }),

      // ── Layers ─────────────────────────────────────────────
      toggleLayer: (id) => set(s => ({
        layerVisibility: { ...s.layerVisibility, [id]: !s.layerVisibility[id] },
      })),
      setLayerVisible: (id, visible) => set(s => ({
        layerVisibility: { ...s.layerVisibility, [id]: visible },
      })),
      setLayerOpacity: (id, opacity) => set(s => ({
        layerOpacity: { ...s.layerOpacity, [id]: opacity },
      })),
      setEntityRenderMode: (entityRenderMode) => set({ entityRenderMode }),
      toggleEntityRenderMode: () => set(s => ({ entityRenderMode: s.entityRenderMode === 'icons' ? 'density' : 'icons' })),

      // ── Load ERP data ───────────────────────────────────────
      loadProjects: async () => {
        set({ projectsLoading: true, projectsError: null });
        try {
          const projects = await fetchProjects();
          set({ projects, projectsLoading: false });
        } catch (e: any) {
          set({ projectsLoading: false, projectsError: e.message });
        }
      },
      loadAssets: async () => {
        set({ assetsLoading: true, assetsError: null });
        try {
          const assets = await fetchAssets();
          set({ assets, assetsLoading: false });
        } catch (e: any) {
          set({ assetsLoading: false, assetsError: e.message });
        }
      },
      loadWorkOrders: async () => {
        set({ workOrdersLoading: true, workOrdersError: null });
        try {
          const workOrders = await fetchWorkOrders();
          set({ workOrders, workOrdersLoading: false });
        } catch (e: any) {
          set({ workOrdersLoading: false, workOrdersError: e.message });
        }
      },
      loadEmployees: async () => {
        set({ employeesLoading: true, employeesError: null });
        try {
          const employees = await fetchEmployees();
          set({ employees, employeesLoading: false });
        } catch (e: any) {
          set({ employeesLoading: false, employeesError: e.message });
        }
      },
      loadViolations: async () => {
        set({ violationsLoading: true });
        const violations = await fetchViolations();
        set({ violations, violationsLoading: false });
      },

      loadWarehouses: async () => {
        set({ warehousesLoading: true });
        try {
          const warehouses = await fetchWarehouses();
          set({ warehouses, warehousesLoading: false });
        } catch {
          set({ warehousesLoading: false });
        }
      },

      corridors: [],
      corridorsLoading: false,

      loadCorridors: async () => {
        set({ corridorsLoading: true });
        try {
          const ctx = resolveTenantContext();
          const tenantId = ctx.tenantId || '';
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-User-Role': 'tenant_admin',
          };
          if (tenantId) headers['X-Tenant-ID'] = tenantId;
          const res = await fetch(`${API}/corridors`, {
            headers,
          });
          if (!res.ok) { set({ corridorsLoading: false }); return; }
          const data = await res.json();
          const list = Array.isArray(data) ? data
            : Array.isArray(data?.corridors) ? data.corridors
            : Array.isArray(data?.items) ? data.items : [];
          const corridors: MapCorridor[] = list.map((c: any) => ({
            id: c.corridor_id ?? c.id,
            name: c.name,
            geometry: Array.isArray(c.geometry) ? c.geometry : [],
            buffer_meters: c.buffer_meters ?? 200,
            status: c.status ?? 'active',
          }));
          set({ corridors, corridorsLoading: false });
        } catch {
          set({ corridorsLoading: false });
        }
      },

      // ── Time Filter ────────────────────────────────────────
      setTimeFilter: (filter) => set(s => ({ timeFilter: { ...s.timeFilter, ...filter } })),
      resetTimeFilter: () => set({ timeFilter: { enabled: false, start: null, end: null, mode: 'range', comparisonDate: null } }),

      // ── Selection ──────────────────────────────────────────
      selectEntity: (type, id) => set({ selectedEntityType: type, selectedEntityId: id }),

      // ── Panels ─────────────────────────────────────────────
      toggleLayerPanel:     () => set(s => ({ layerPanelOpen: !s.layerPanelOpen })),
      toggleTimePanel:      () => set(s => ({ timePanelOpen: !s.timePanelOpen })),
      toggleViolationPanel: () => set(s => ({ violationPanelOpen: !s.violationPanelOpen })),

      // ── Drawing ────────────────────────────────────────────
      drawingMode: 'idle' as DrawingMode,
      drawnFeatures: [],
      aoi: null,

      // ── Governance ─────────────────────────────────────────
      governedLayers: [],
      governedLayersLoading: false,
      activeDepartment: null,
      governancePanelOpen: false,
      satelliteDatasets: [],
      satelliteDatasetsLoading: false,

      setDrawingMode: (drawingMode) => set((state) => {
        const nonEngineeringAllowed: DrawingMode[] = [
          'idle',
          'inspect-coordinate',
          'measure-distance',
          'measure-area',
          'pick-location',
        ];

        if (state.workspace !== 'engineering' && !nonEngineeringAllowed.includes(drawingMode)) {
          return { drawingMode: 'idle' };
        }

        return { drawingMode };
      }),
      addDrawnFeature: (type, geojson) => set(s => ({
        drawnFeatures: [...s.drawnFeatures, { type, geojson }],
      })),
      clearDrawnFeatures: () => set({ drawnFeatures: [] }),
      setAoi: (aoi) => set({ aoi }),
      clearAoi: () => set({ aoi: null }),

      pendingLocationCallback: null,
      requestMapLocation: (cb) => set({ pendingLocationCallback: cb, drawingMode: 'pick-location' }),
      cancelLocationPick: () => set({ pendingLocationCallback: null, drawingMode: 'idle' }),

      loadGovernedLayers: async (requestingDept) => {
        set({ governedLayersLoading: true });
        const governedLayers = await fetchGovernedLayers(requestingDept ?? get().activeDepartment ?? undefined);
        set({ governedLayers, governedLayersLoading: false });
      },

      setActiveDepartment: (activeDepartment) => set({ activeDepartment }),

      toggleGovernancePanel: () => set(s => ({ governancePanelOpen: !s.governancePanelOpen })),

      // ── تحميل مناطق المشاريع من projects_core ──────────────────
      projectAreasFromCore: [],
      projectAreasLoading: false,
      
      loadProjectAreas: async () => {
        set({ projectAreasLoading: true });
        const projectAreasFromCore = await fetchProjectAreasFromCore();
        set({ projectAreasFromCore, projectAreasLoading: false });
      },

      loadSatelliteDatasets: async (requestingDept) => {
        set({ satelliteDatasetsLoading: true });
        const satelliteDatasets = await fetchSatelliteDatasets(requestingDept ?? get().activeDepartment ?? undefined);
        set({ satelliteDatasets, satelliteDatasetsLoading: false });
      },

      // ── Sovereign layers ───────────────────────────────────────
      sovereignLayers: [] as SovereignLayerDef[],
      sovereignLayersLoading: false,

      loadSovereignLayers: async (requestingDept) => {
        set({ sovereignLayersLoading: true });
        const layers = await fetchSovereignLayers(requestingDept ?? get().activeDepartment ?? undefined);
        set({ sovereignLayers: layers, sovereignLayersLoading: false });
      },

      // ── SVY CP Overlay ─────────────────────────────────────────
      svyCpOverlay: null as SvyCpOverlay | null,
      setSvyCpOverlay: (overlay: SvyCpOverlay | null) => set({ svyCpOverlay: overlay }),

      saveDrawnFeatureToBackend: async (name, featureType, geometry, department = 'engineering') => {
        const ctx = resolveTenantContext();
        if (!ctx.tenantId) return null;
        try {
          const res = await fetch(`${API}/map/features?tenant_id=${ctx.tenantId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...tenantHeaders() },
            body: JSON.stringify({
              name,
              feature_type: featureType,
              geometry,
              category: 'engineering_backbone',
              department,
              color: '#06b6d4',
              created_by: department,
              properties: { layer_dept_type: 'engineering_backbone', saved_via: 'gis_engine' },
            }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          return data.id ?? null;
        } catch { return null; }
      },

      // ── Refresh all ────────────────────────────────────────
      refreshAll: async () => {
        const state = get();
        const vis = state.layerVisibility;
        const loads: Promise<void>[] = [];

        if (vis.projects)    loads.push(state.loadProjects());
        if (vis.assets)      loads.push(state.loadAssets());
        if (vis.work_orders) loads.push(state.loadWorkOrders());
        if (vis.employees)   loads.push(state.loadEmployees());
        if (vis.warehouses || state.entityRenderMode === 'density') loads.push(state.loadWarehouses());
        if (vis.corridors)   loads.push(state.loadCorridors());
        
        // ── تحميل مناطق المشاريع من projects_core تلقائياً ──────────────
        loads.push(state.loadProjectAreas());

        await Promise.all(loads);
        state.loadViolations();
        state.loadGovernedLayers();
        state.loadSatelliteDatasets();
        state.loadSovereignLayers(state.activeDepartment ?? undefined);
      },
    }),
    {
      name: 'gis-engine-v2',
      version: 3,
      migrate: (persistedState: any) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;
        if ('aoi' in persistedState) {
          const { aoi: _dropAoi, ...rest } = persistedState;
          return rest;
        }
        return persistedState;
      },
      partialize: (s) => ({
        workspace: s.workspace,
        basemap:   s.basemap,
        center:    s.center,
        zoom:      s.zoom,
        entityRenderMode: s.entityRenderMode,
        layerVisibility: s.layerVisibility,
        layerOpacity:    s.layerOpacity,
          svyCpOverlay: s.svyCpOverlay,
      }),
    }
  )
);
