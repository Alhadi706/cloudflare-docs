import { create } from 'zustand';
import { workspaceApi } from './apiService';

export interface BaseLayer {
  id: string;
  projectId: string;
  parentId?: string | null;
  name: string;
  layer_type?: string;
  description: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  department?: string;         // deprecated, kept for display only
  department_id?: number;       // FK → workspace.departments.id
  responsible_employee_id?: number; // FK → workspace.employees.id
  responsible_role?: string;
  managing_department_id?: number; // FK → workspace.departments.id
  status?: string;
  group: string;
  visible: boolean;
  color: string;
  featureCount: number;
  siteId?: number | null;
}

interface LayerState {
  layers: BaseLayer[];
  activeLayerId: string | null;
  addLayer: (layer: Omit<BaseLayer, 'id' | 'featureCount' | 'visible' | 'color' | 'group'>) => void;
  removeLayer: (id: string) => void;
  renameLayer: (id: string, newName: string) => void;
  toggleLayerVisibility: (id: string) => void;
  setActiveLayer: (id: string) => void;
  updateFeatureCount: (id: string, count: number) => void;
  reorderLayer: (id: string, direction: 'up' | 'down') => void;
  loadLayers: (projectId: string, siteId?: string | number | null) => Promise<void>;
}

const getNextColor = () => {
  const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-sky-500', 'bg-emerald-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: [],
  activeLayerId: null,
    loadLayers: async (projectId, siteId) => {
    try {
      const response = await workspaceApi.getLayersTree(projectId, siteId);
      console.log('✅ LAYER TREE:', response);
      
      let layersArray = response.layers || [];
      if (!Array.isArray(layersArray)) layersArray = [];
      
      const seenIds = new Set<string>();
      const flattenTree = (nodes: any[], parentId: string | null = null): any[] => {
        let result: any[] = [];
        for (const node of nodes) {
            const nodeId = node.id ? String(node.id) : null;
            // Skip nodes with missing or invalid IDs
            if (!nodeId || nodeId === 'null' || nodeId === 'undefined') {
                console.warn('[layerStore] Skipping node with invalid id:', node.name);
                continue;
            }
            // Skip self-referencing nodes
            if (parentId && nodeId === parentId) {
                console.warn('[layerStore] Skipping self-referencing node:', nodeId);
                continue;
            }
            // Skip duplicate nodes
            if (seenIds.has(nodeId)) {
                console.warn('[layerStore] Skipping duplicate node id:', nodeId);
                continue;
            }
            seenIds.add(nodeId);
            result.push({
                ...node,
                id: nodeId,
                projectId: String(projectId),
                parentId: parentId,
                visible: node.visible !== undefined ? node.visible : true,
                color: node.color || getNextColor(),
                featureCount: node.feature_count || 0,
                name: node.name || 'Unnamed Layer',
                siteId: node.site_id ?? null,
            });
            if (node.children && node.children.length > 0) {
                result = result.concat(flattenTree(node.children, nodeId));
            }
        }
        return result;
      };
      
      const flatLayers = flattenTree(layersArray);
      
      if(flatLayers.length > 0) {
        // Preserve the current activeLayerId if it still exists in the new layer list
        const currentId = get().activeLayerId;
        const stillValid = currentId && flatLayers.some(l => l.id === currentId);
        set({ layers: flatLayers, activeLayerId: stillValid ? currentId : String(flatLayers[0].id) });
      } else {
        set({ layers: [], activeLayerId: null });
      }
    } catch (e) { console.error('❌ خطأ في تحميل الطبقات:', e) }
  },


  
  addLayer: async (layerData) => {
    try {
      const response = await workspaceApi.createLayer({
        project_id: layerData.projectId, 
        name: layerData.name, 
        description: layerData.description || '', 
        owner_name: layerData.owner_name || 'Admin', 
        layer_type: layerData.layer_type || 'main', 
        owner_email: layerData.owner_email || '', 
        owner_phone: layerData.owner_phone || '', 
        parent_layer_id: layerData.parentId,
        department_id: layerData.department_id,
        responsible_employee_id: layerData.responsible_employee_id,
        managing_department_id: layerData.managing_department_id,
        responsible_role: layerData.responsible_role,
        site_id: (layerData as any).site_id ?? layerData.siteId ?? null,
        status: layerData.status || 'ACTIVE',
        color: '#3b82f6', 
        visible: true
      });
      
      const realId = response.layer_id || response.id;
      // Refresh tree immediately from backend
      const state = get();
      await state.loadLayers(layerData.projectId);
      // Only update activeLayerId if realId is a valid non-composite string
      if (realId && typeof realId === 'string' && !realId.includes(':') && realId !== 'null' && realId !== 'undefined') {
        set({ activeLayerId: realId });
      }
    } catch (error) {
      console.error('Error creating layer:', error);
    }
  },

  removeLayer: (id) => set((state) => {
    const remaining = state.layers.filter(l => l.id !== id);
    return {
      layers: remaining,
      activeLayerId: state.activeLayerId === id ? (remaining.length > 0 ? remaining[0].id : null) : state.activeLayerId
    };
  }),

  renameLayer: (id, newName) => set((state) => ({
    layers: state.layers.map(l => l.id === id ? { ...l, name: newName } : l)
  })),

  toggleLayerVisibility: (id) => set((state) => ({
    layers: state.layers.map(layer => layer.id === id ? { ...layer, visible: !layer.visible } : layer)
  })),

  setActiveLayer: (id) => {
    if (!id || typeof id !== 'string' || id.includes(':') || id === 'null' || id === 'undefined') {
      console.warn('[layerStore] Refusing to set invalid activeLayerId:', id);
      return;
    }
    set({ activeLayerId: id });
  },

  updateFeatureCount: (id, count) => set((state) => ({
    layers: state.layers.map(layer => layer.id === id ? { ...layer, featureCount: count } : layer)
  })),

  reorderLayer: (id, direction) => set((state) => {
    const index = state.layers.findIndex(l => l.id === id);
    if (index < 0) return state;
    if (direction === 'up' && index > 0) {
      const newLayers = [...state.layers];
      [newLayers[index - 1], newLayers[index]] = [newLayers[index], newLayers[index - 1]];
      return { layers: newLayers };
    }
    if (direction === 'down' && index < state.layers.length - 1) {
      const newLayers = [...state.layers];
      [newLayers[index + 1], newLayers[index]] = [newLayers[index], newLayers[index + 1]];
      return { layers: newLayers };
    }
    return state;
  })
}));
