import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BaseMapType = 'osm' | 'dark' | 'light' | 'terrain' | 'satellite';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface MapState {
  zoom: number;
  center: [number, number];
  projection: string;
  baseMap: BaseMapType;
  pendingFitExtent: [number, number, number, number] | null;
  fitTrigger: number;
  // Phase 6: Live viewport bounds — updated by MapCanvas on every moveend/zoomend
  mapBounds: MapBounds | null;
  setZoom: (zoom: number) => void;
  setCenter: (center: [number, number]) => void;
  setBaseMap: (baseMap: BaseMapType) => void;
  setPendingFitExtent: (extent: [number, number, number, number] | null) => void;
  triggerFit: () => void;
  // Phase 6: set real live viewport bounds from OL map extent
  setMapBounds: (bounds: MapBounds) => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      zoom: 13,
      center: [13.1913, 32.8872],
      projection: 'EPSG:3857',
      baseMap: 'satellite',
      pendingFitExtent: null,
      fitTrigger: 0,
      mapBounds: null,   // null until MapCanvas fires first moveend
      setZoom: (zoom) => set({ zoom }),
      setCenter: (center) => set({ center }),
      setBaseMap: (baseMap) => set({ baseMap }),
      setPendingFitExtent: (extent) => set({ pendingFitExtent: extent }),
      triggerFit: () => set((s) => ({ fitTrigger: s.fitTrigger + 1 })),
      setMapBounds: (bounds) => set({ mapBounds: bounds }),
    }),
    {
      name: 'map-store',
      partialize: (state) => ({ baseMap: state.baseMap }), // only persist basemap choice
    }
  )
);

/**
 * Derive approximate map_bounds from center [lon, lat] and zoom level.
 * Returns {north, south, east, west} in WGS84 degrees.
 * Used to pass spatial context to the backend when real viewport bounds are unavailable.
 */
export function computeMapBounds(
  center: [number, number],
  zoom: number
): { north: number; south: number; east: number; west: number } {
  const [lon, lat] = center;
  const halfLon = 180 / Math.pow(2, zoom);
  const halfLat = halfLon * 0.6;
  return {
    north: Math.min(90,  lat + halfLat),
    south: Math.max(-90, lat - halfLat),
    east:  Math.min(180, lon + halfLon),
    west:  Math.max(-180,lon - halfLon),
  };
}
