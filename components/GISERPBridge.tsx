// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GIS-ERP Bridge Component
// Links ERP Records (Assets, Projects) to GIS Map Visualization
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import { useEffect, useRef, useState } from 'react';

export interface GISERPBridgeProps {
  selectedAssetId?: string | null;
  selectedProjectId?: string | null;
  onAssetSelect?: (assetId: string) => void;
  onProjectSelect?: (projectId: string) => void;
}

export interface HighlightEvent {
  type: 'asset' | 'project';
  id: string;
  name: string;
  geometry: any;
  properties?: Record<string, any>;
}

/**
 * GIS-ERP Bridge Component
 * 
 * Provides bidirectional linking between ERP modules and GIS visualization:
 * 
 * **ERP → GIS:**
 * - When user clicks asset in ERP table → highlights on map
 * - When user clicks project in ERP table → shows project boundary
 * 
 * **GIS → ERP:**
 * - When user clicks map feature → selects corresponding ERP record
 * - Emits selection events for parent components
 * 
 * **Usage:**
 * ```tsx
 * // In Assets Page:
 * const [selectedAsset, setSelectedAsset] = useState(null);
 * 
 * <GISERPBridge 
 *   selectedAssetId={selectedAsset}
 *   onAssetSelect={setSelectedAsset}
 * />
 * 
 * <table>
 *   {assets.map(asset => (
 *     <tr 
 *       onClick={() => setSelectedAsset(asset.id)}
 *       className={selectedAsset === asset.id ? 'bg-cyan-500/20' : ''}
 *     >
 *       ...
 *     </tr>
 *   ))}
 * </table>
 * ```
 */
export default function GISERPBridge({
  selectedAssetId,
  selectedProjectId,
  onAssetSelect,
  onProjectSelect
}: GISERPBridgeProps) {
  const highlightLayerRef = useRef<string | null>(null);

  // ╔════════════════════════════════════════════════════════════════╗
  // ║ ERP → GIS: Asset Selection                                     ║
  // ╚════════════════════════════════════════════════════════════════╝
  useEffect(() => {
    if (!selectedAssetId) {
      clearHighlight();
      return;
    }

    fetchAssetAndHighlight(selectedAssetId);
  }, [selectedAssetId]);

  // ╔════════════════════════════════════════════════════════════════╗
  // ║ ERP → GIS: Project Selection                                   ║
  // ╚════════════════════════════════════════════════════════════════╝
  useEffect(() => {
    if (!selectedProjectId) {
      clearHighlight();
      return;
    }

    fetchProjectAndHighlight(selectedProjectId);
  }, [selectedProjectId]);

  // ╔════════════════════════════════════════════════════════════════╗
  // ║ GIS → ERP: Map Click Event Listener                           ║
  // ╚════════════════════════════════════════════════════════════════╝
  useEffect(() => {
    const handleMapFeatureClick = (event: any) => {
      const detail = event.detail;
      
      if (detail.type === 'asset' && onAssetSelect) {
        onAssetSelect(detail.id);
      } else if (detail.type === 'project' && onProjectSelect) {
        onProjectSelect(detail.id);
      }
    };

    window.addEventListener('gis-feature-clicked', handleMapFeatureClick);
    
    return () => {
      window.removeEventListener('gis-feature-clicked', handleMapFeatureClick);
    };
  }, [onAssetSelect, onProjectSelect]);

  // ╔════════════════════════════════════════════════════════════════╗
  // ║ Asset Highlight Logic                                          ║
  // ╚════════════════════════════════════════════════════════════════╝
  const fetchAssetAndHighlight = async (assetId: string) => {
    try {
      const response = await fetch(`/api/v1/workspace/assets/${assetId}`);
      if (!response.ok) {
        console.warn(`Asset ${assetId} not found`);
        return;
      }

      const asset = await response.json();
      
      if (asset.location) {
        const geometry = typeof asset.location === 'string' 
          ? JSON.parse(asset.location) 
          : asset.location;

        highlightOnMap({
          type: 'asset',
          id: asset.asset_id,
          name: asset.asset_name || 'Unnamed Asset',
          geometry: geometry,
          properties: {
            asset_type: asset.asset_type,
            health_score: asset.health_score,
            status: asset.status,
            installation_date: asset.installation_date
          }
        });
      } else {
        console.warn(`Asset ${assetId} has no location data`);
      }
    } catch (error) {
      console.error('Failed to fetch asset:', error);
    }
  };

  // ╔════════════════════════════════════════════════════════════════╗
  // ║ Project Highlight Logic                                        ║
  // ╚════════════════════════════════════════════════════════════════╝
  const fetchProjectAndHighlight = async (projectId: string) => {
    try {
      const response = await fetch(`/api/v1/workspace/projects/${projectId}`);
      if (!response.ok) {
        console.warn(`Project ${projectId} not found`);
        return;
      }

      const project = await response.json();
      
      if (project.project_boundary) {
        const geometry = typeof project.project_boundary === 'string'
          ? JSON.parse(project.project_boundary)
          : project.project_boundary;

        highlightOnMap({
          type: 'project',
          id: project.project_id,
          name: project.project_name || 'Unnamed Project',
          geometry: geometry,
          properties: {
            project_type: project.project_type,
            status: project.status,
            budget: project.budget,
            start_date: project.start_date,
            end_date: project.end_date
          }
        });
      } else {
        console.warn(`Project ${projectId} has no boundary data`);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    }
  };

  // ╔════════════════════════════════════════════════════════════════╗
  // ║ Map Highlight Dispatcher                                       ║
  // ╚════════════════════════════════════════════════════════════════╝
  const highlightOnMap = (event: HighlightEvent) => {
    // Dispatch custom event to map component
    window.dispatchEvent(new CustomEvent('highlight-gis-feature', {
      detail: event
    }));

    // Store reference for cleanup
    highlightLayerRef.current = event.id;

    // Auto-zoom to feature
    window.dispatchEvent(new CustomEvent('zoom-to-feature', {
      detail: event
    }));
  };

  // ╔════════════════════════════════════════════════════════════════╗
  // ║ Clear Highlight                                                ║
  // ╚════════════════════════════════════════════════════════════════╝
  const clearHighlight = () => {
    if (highlightLayerRef.current) {
      window.dispatchEvent(new CustomEvent('clear-gis-highlight', {
        detail: { id: highlightLayerRef.current }
      }));
      highlightLayerRef.current = null;
    }
  };

  // Bridge component has no UI
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper Hook: useGISERPBridge
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Custom hook for easier integration
 * 
 * Usage:
 * ```tsx
 * const { selectedAsset, selectAsset, clearSelection } = useGISERPBridge();
 * 
 * <GISERPBridge selectedAssetId={selectedAsset} onAssetSelect={selectAsset} />
 * 
 * <button onClick={() => selectAsset('ASSET-001')}>
 *   Highlight Asset
 * </button>
 * ```
 */
export function useGISERPBridge() {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const selectAsset = (assetId: string | null) => {
    setSelectedAsset(assetId);
    setSelectedProject(null);
  };

  const selectProject = (projectId: string | null) => {
    setSelectedProject(projectId);
    setSelectedAsset(null);
  };

  const clearSelection = () => {
    setSelectedAsset(null);
    setSelectedProject(null);
  };

  return {
    selectedAsset,
    selectedProject,
    selectAsset,
    selectProject,
    clearSelection
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Map Integration Instructions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * **For Map Component Integration:**
 * 
 * Add event listeners in your MapView component:
 * 
 * ```tsx
 * useEffect(() => {
 *   // Listen for highlight requests
 *   const handleHighlight = (event: any) => {
 *     const { type, id, name, geometry, properties } = event.detail;
 *     
 *     // Add highlight layer
 *     if (map.current) {
 *       // Remove existing highlight
 *       if (map.current.getLayer('highlight-layer')) {
 *         map.current.removeLayer('highlight-layer');
 *         map.current.removeSource('highlight-source');
 *       }
 *       
 *       // Add new highlight
 *       map.current.addSource('highlight-source', {
 *         type: 'geojson',
 *         data: {
 *           type: 'Feature',
 *           properties: { ...properties, name, id, type },
 *           geometry: geometry
 *         }
 *       });
 *       
 *       map.current.addLayer({
 *         id: 'highlight-layer',
 *         type: geometry.type === 'Point' ? 'circle' : 'fill',
 *         source: 'highlight-source',
 *         paint: geometry.type === 'Point' ? {
 *           'circle-radius': 15,
 *           'circle-color': '#06b6d4',
 *           'circle-stroke-width': 3,
 *           'circle-stroke-color': '#ffffff'
 *         } : {
 *           'fill-color': '#06b6d4',
 *           'fill-opacity': 0.3,
 *           'fill-outline-color': '#06b6d4'
 *         }
 *       });
 *     }
 *   };
 *   
 *   // Listen for zoom requests
 *   const handleZoom = (event: any) => {
 *     const { geometry } = event.detail;
 *     
 *     if (map.current && geometry) {
 *       // Calculate bounds and zoom
 *       const bounds = new maplibregl.LngLatBounds();
 *       
 *       if (geometry.type === 'Point') {
 *         const [lng, lat] = geometry.coordinates;
 *         bounds.extend([lng, lat]);
 *         map.current.flyTo({ center: [lng, lat], zoom: 16 });
 *       } else if (geometry.type === 'Polygon') {
 *         geometry.coordinates[0].forEach(coord => bounds.extend(coord));
 *         map.current.fitBounds(bounds, { padding: 50 });
 *       }
 *     }
 *   };
 *   
 *   // Listen for clear requests
 *   const handleClear = () => {
 *     if (map.current && map.current.getLayer('highlight-layer')) {
 *       map.current.removeLayer('highlight-layer');
 *       map.current.removeSource('highlight-source');
 *     }
 *   };
 *   
 *   window.addEventListener('highlight-gis-feature', handleHighlight);
 *   window.addEventListener('zoom-to-feature', handleZoom);
 *   window.addEventListener('clear-gis-highlight', handleClear);
 *   
 *   return () => {
 *     window.removeEventListener('highlight-gis-feature', handleHighlight);
 *     window.removeEventListener('zoom-to-feature', handleZoom);
 *     window.removeEventListener('clear-gis-highlight', handleClear);
 *   };
 * }, []);
 * 
 * // Emit events when map features are clicked
 * map.current.on('click', 'assets-layer', (e) => {
 *   const feature = e.features[0];
 *   window.dispatchEvent(new CustomEvent('gis-feature-clicked', {
 *     detail: {
 *       type: 'asset',
 *       id: feature.properties.asset_id,
 *       name: feature.properties.asset_name,
 *       geometry: feature.geometry
 *     }
 *   }));
 * });
 * ```
 */
