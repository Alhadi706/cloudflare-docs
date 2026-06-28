import { create } from 'zustand';
import { workspaceApi } from './apiService';

export type EditingState = 'idle' | 'polygon' | 'line' | 'point' | 'modify' | 'delete' | 'measure-distance' | 'measure-area' | 'inspect-coordinate' | 'buffer' | 'nearby' | 'intersect';

export interface InfrastructureAsset {
  asset_id: string;
  asset_type: string;
  asset_name: string;
  status: 'Active' | 'Inactive' | 'Maintenance' | 'Planned';
  health_score: number;
  installation_date: string;
  department_owner: string;
  layerId: string;
}

export interface GeoFeature {
  type: 'Feature';
  id: string;
  geometry: any;
  properties: InfrastructureAsset;
}

export interface AssetFilters {
  type: string | 'all';
  hideInactive: boolean;
  highlightLowHealth: boolean;
}

export interface TemporalPattern {
  analysis_id: string;
  asset_id: string;
  analysis_type: string;
  confidence_score: number;
  detected_pattern: string;
  first_detected: string;
  last_updated: string;
}

export interface AssetEvent {
  event_id: string;
  asset_id: string;
  event_type: string;
  severity: string;
  timestamp: string;
  description: string;
  resolved: boolean;
}

interface WorkspaceState {
  temporalPatterns: TemporalPattern[];
  loadTemporalPatterns: () => Promise<void>;
  events: AssetEvent[];
  loadEvents: () => Promise<void>;
  resolveEvent: (id: string) => Promise<void>;
  features: GeoFeature[];
  selectedFeatureId: string | null;
  editingState: EditingState;
  assetFilters: AssetFilters;

  // Phase 11 — GIS Intelligence
  bufferResult: any | null;
  spatialResults: any[];
  heatmapVisible: boolean;
  bufferDistance: number;
  nearbyRadius: number;
  setBufferResult: (f: any | null) => void;
  setSpatialResults: (fs: any[]) => void;
  setHeatmapVisible: (v: boolean) => void;
  setBufferDistance: (d: number) => void;
  setNearbyRadius: (r: number) => void;
  clearSpatialAnalysis: () => void;

  // Phase 12 — Cognitive UX
  lastActionSummary: {
    type: 'buffer' | 'nearby' | 'intersect' | 'upload' | 'draw' | 'simulate' | 'query' | null;
    title: string;
    body: string;
    count?: number;
    timestamp: number;
  } | null;
  uploadReport: {
    filename: string;
    totalFeatures: number;
    byType: Record<string, number>;
    warnings: string[];
    timestamp: number;
  } | null;
  setLastActionSummary: (s: WorkspaceState['lastActionSummary']) => void;
  setUploadReport: (r: WorkspaceState['uploadReport']) => void;

  setEditingState: (state: EditingState) => void;
  setAssetFilters: (filters: Partial<AssetFilters>) => void;
  addFeature: (feature: GeoFeature) => void;
  updateFeature: (feature: GeoFeature) => void;
  updateFeatureProperties: (id: string, properties: Partial<InfrastructureAsset>) => void;
  deleteFeature: (id: string) => void;
  clearFeatures: (layerId?: string) => void;
  setSelectedFeature: (id: string | null) => void;
  loadAssets: (projectId: string, siteId?: string | number | null, layerId?: string | null) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  events: [],
  temporalPatterns: [],
  loadTemporalPatterns: async () => {
    try {
      const patterns = await workspaceApi.getTemporalPatterns();
      set({ temporalPatterns: patterns });
    } catch(e) { console.error(e); }
  },
  loadEvents: async () => {
    try {
      const evs = await workspaceApi.getEvents();
      set({ events: evs });
    } catch(e) { console.error(e) }
  },
  resolveEvent: async (id) => {
    try {
      await workspaceApi.resolveEvent(id);
      set(state => ({ events: state.events.filter(e => e.event_id !== id) }));
    } catch(e) { console.error(e) }
  },
  features: [],
  selectedFeatureId: null,
  editingState: 'idle',
  assetFilters: {
    type: 'all',
    hideInactive: false,
    highlightLowHealth: false
  },

  // Phase 11 — GIS Intelligence state
  bufferResult: null,
  spatialResults: [],
  heatmapVisible: false,
  bufferDistance: 500,
  nearbyRadius: 500,
  setBufferResult: (bufferResult) => set({ bufferResult }),
  setSpatialResults: (spatialResults) => set({ spatialResults }),
  setHeatmapVisible: (heatmapVisible) => set({ heatmapVisible }),
  setBufferDistance: (bufferDistance) => set({ bufferDistance }),
  setNearbyRadius: (nearbyRadius) => set({ nearbyRadius }),
  clearSpatialAnalysis: () => set({ bufferResult: null, spatialResults: [] }),

  // Phase 12 — Cognitive UX
  lastActionSummary: null,
  uploadReport: null,
  setLastActionSummary: (lastActionSummary) => set({ lastActionSummary }),
  setUploadReport: (uploadReport) => set({ uploadReport }),

  loadAssets: async (projectId, siteId, layerId) => {
    // Clear immediately — never show stale data from previous scope
    set({ features: [] });
    if (!projectId) return;
    try {
      const assets = await workspaceApi.getAssets(projectId, siteId, layerId);
      set({ features: Array.isArray(assets) ? assets : [] });
    } catch(e) { console.error('[workspaceStore] loadAssets:', e) }
  },
  setEditingState: (editingState) => set({ editingState }),
  setAssetFilters: (filters) => set((state) => ({ assetFilters: { ...state.assetFilters, ...filters } })),
  setSelectedFeature: (id: string | null) => set({ selectedFeatureId: id }),
  addFeature: (feature) => {
    const payload = { layer_id: feature.properties.layerId, asset_id: feature.properties.asset_id, asset_type: feature.properties.asset_type, asset_name: feature.properties.asset_name, status: feature.properties.status, health_score: feature.properties.health_score, installation_date: feature.properties.installation_date, department_owner: feature.properties.department_owner, geometry: feature.geometry, properties: feature.properties };
    console.log('[STORE] 📤 createAsset POST payload:', JSON.stringify(payload));
    workspaceApi.createAsset(payload)
      .then((res: any) => console.log('[STORE] ✅ createAsset response:', JSON.stringify(res)))
      .catch((err: any) => console.error('[STORE] ❌ createAsset FAILED:', err));
    set((state) => ({ features: [...state.features, feature] }));
  },
  updateFeature: (updatedFeature) => {
    workspaceApi.updateAsset(updatedFeature.id, { layer_id: updatedFeature.properties.layerId, asset_id: updatedFeature.properties.asset_id, asset_type: updatedFeature.properties.asset_type, asset_name: updatedFeature.properties.asset_name, status: updatedFeature.properties.status, health_score: updatedFeature.properties.health_score, installation_date: updatedFeature.properties.installation_date, department_owner: updatedFeature.properties.department_owner, geometry: updatedFeature.geometry, properties: updatedFeature.properties }).catch(console.error);
    set((state) => ({
      features: state.features.map(f => f.id === updatedFeature.id ? updatedFeature : f)
    }));
  },
  updateFeatureProperties: (id, properties) => {
    set((state) => {
      const features = state.features.map(f => f.id === id ? { ...f, properties: { ...f.properties, ...properties } } : f);
      const f = features.find(fx => fx.id === id);
      if (f) {
         workspaceApi.updateAsset(id, { layer_id: f.properties.layerId, asset_id: f.properties.asset_id, asset_type: f.properties.asset_type, asset_name: f.properties.asset_name, status: f.properties.status, health_score: f.properties.health_score, installation_date: f.properties.installation_date, department_owner: f.properties.department_owner, geometry: f.geometry, properties: f.properties }).catch(console.error);
      }
      return { features };
    });
  },
  deleteFeature: (id) => {
    workspaceApi.deleteAsset(id).catch(console.error);
    set((state) => ({
      features: state.features.filter(f => f.id !== id)
    }));
  },
  clearFeatures: (layerId) => set((state) => ({
    features: layerId ? state.features.filter(f => f.properties?.layerId !== layerId) : []
  })),
}));
