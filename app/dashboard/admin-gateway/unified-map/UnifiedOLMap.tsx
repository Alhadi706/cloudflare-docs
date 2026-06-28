'use client';

import React from 'react';
import MapCenterCanvas from '@/app/dashboard/gis-sovereignty/components/MapCenterCanvas';

export interface SavedFeature {
  id?: string;
  name?: string;
  geometry: unknown;
  category?: string;
  color?: string;
  [key: string]: unknown;
}

export interface ContextAction {
  label: string;
  action: string;
  icon?: string;
}

interface UnifiedOLMapProps {
  layers?: unknown[];
  center?: [number, number];
  zoom?: number;
  assetPoints?: unknown[];
  showAssets?: boolean;
  projectPoints?: unknown[];
  showProjects?: boolean;
  department?: string;
  basemap?: string;
  overlayLayers?: unknown;
  drawTool?: string | null;
  onFeatureDrawn?: (geometry: object, type: string) => void;
  savedFeatures?: SavedFeature[];
  contextActions?: ContextAction[];
  onContextAction?: (action: string, lonLat: [number, number]) => void;
}

import { useGisEngine, getSharedOlMap } from '@/store/gisEngine';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import { Style, Stroke, Circle, Fill, Text } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { fromLonLat, toLonLat } from 'ol/proj';
import Modify from 'ol/interaction/Modify';
import Collection from 'ol/Collection';
import { getLength } from 'ol/sphere';

function CustomMapOverlay({ assetPoints, routeAnchors, onRouteUpdate, enableEdit, trueCoords }: { assetPoints?: any[], routeAnchors?: any[], onRouteUpdate?: (newAnchors: any[]) => void, enableEdit?: boolean, trueCoords?: number[][] }) {
  const { olMapReady } = useGisEngine();
  
  React.useEffect(() => {
    if (!olMapReady) return;
    const map = getSharedOlMap();
    if (!map) return;

    // Create a vector source and layer
    
    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      zIndex: 9999, // Ensure it's on top
    });
    map.addLayer(layer);

    let lineFeature: Feature<LineString> | null = null;
    // 1. Draw Pipeline Track if routeAnchors are provided
    if (!enableEdit && trueCoords && trueCoords.length > 1) {
      // Draw true curves instead of straight point-to-point connections
      const coords = trueCoords.map(c => fromLonLat([c[0], c[1]]));
      lineFeature = new Feature({ geometry: new LineString(coords) });
      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({ color: '#0ea5e9', width: 4 }) // Cyan solid for exact trace
        })
      );
      source.addFeature(lineFeature);
    } else if (routeAnchors && routeAnchors.length > 1) {
      const sorted = [...routeAnchors].sort((a, b) => a.station - b.station);
      const coords = sorted.map(a => fromLonLat([a.lng, a.lat]));
      lineFeature = new Feature({ geometry: new LineString(coords) });
      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({ color: '#f59e0b', width: 4, lineDash: enableEdit ? undefined : [10, 10] }),
        })
      );
      source.addFeature(lineFeature);
    }
    
    let modifyInteraction: Modify | null = null;
    if (enableEdit && lineFeature) {
        modifyInteraction = new Modify({ features: new Collection([lineFeature]) });
        map.addInteraction(modifyInteraction);
        
        modifyInteraction.on('modifyend', (e) => {
            const geom = lineFeature.getGeometry();
            if (geom && onRouteUpdate) {
                const coords = geom.getCoordinates();
                
                // Re-calculate distances to find new stations
                const newAnchors = [];
                let currentStation = 0;
                
                for (let i = 0; i < coords.length; i++) {
                    const [lng, lat] = toLonLat(coords[i]);
                    // calculate geographic distance from prev point to this point
                    if (i > 0) {
                        const geomSeg = new LineString([coords[i-1], coords[i]]);
                        currentStation += getLength(geomSeg);
                    }
                    newAnchors.push({
                        station: currentStation,
                        lat,
                        lng,
                        label: routeAnchors[i]?.label || `نقطة ${i+1}`
                    });
                }
                onRouteUpdate(newAnchors);
            }
        });
    }


    // 2. Draw Engineering Assets (valves, pumps, etc)
    if (assetPoints && assetPoints.length > 0) {
      assetPoints.forEach(pt => {
        if (!pt.geometry || !pt.geometry.coordinates) return;
        const [lng, lat] = pt.geometry.coordinates;
        const pointFeature = new Feature({ geometry: new Point(fromLonLat([lng, lat])) });
        
        let color = pt.color || '#3B82F6';
        let radius = pt.radius ?? (pt.category === 'primary_asset' ? 7 : 4);
        
        pointFeature.setStyle((feature, resolution) => {
          const defaultImage = new Circle({
              radius,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: '#020617', width: 2 })
          });
          
          let mapZoom = 6;
          // Retrieve zoom directly from map view
          const view = map.getView();
          if (view && resolution) {
            mapZoom = view.getZoomForResolution(resolution) || view.getZoom();
          }

          // Show text only if zoomed in closer than 10
          if (mapZoom && mapZoom > 10) {
            return new Style({
              image: defaultImage,
              text: new Text({
                text: pt.name || '',
                font: 'bold 11px sans-serif',
                offsetY: -15,
                fill: new Fill({ color: '#fff' }),
                stroke: new Stroke({ color: '#0f172a', width: 3 })
              })
            });
          }

          return new Style({ image: defaultImage });
        });
        source.addFeature(pointFeature);
      });
      
      // Auto-fit bounds if we have points
      if (assetPoints.length > 0) {
        const extent = source.getExtent();
        if (extent && extent.some(c => isFinite(c))) {
          map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000, maxZoom: 14 });
        }
      }
    }

    return () => {
      map.removeLayer(layer);
    };
  }, [olMapReady, assetPoints, routeAnchors]);

  return null;
}

export default function UnifiedOLMap(props: UnifiedOLMapProps & { routeAnchors?: any[], onRouteUpdate?: (n:any[])=>void, enableEdit?: boolean, trueCoords?: number[][] }) {
  // Compatibility wrapper for legacy unified-map route.
  return (
    <>
      <MapCenterCanvas />
      <CustomMapOverlay assetPoints={props.assetPoints} routeAnchors={props.routeAnchors} onRouteUpdate={props.onRouteUpdate} enableEdit={props.enableEdit} trueCoords={props.trueCoords} />
    </>
  );
}
