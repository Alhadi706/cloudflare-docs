'use client';

import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import { Draw, Modify, Select, Snap } from 'ol/interaction';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import Overlay from 'ol/Overlay';
import { getArea, getLength } from 'ol/sphere';
import { LineString, Polygon } from 'ol/geom';
import HeatmapLayer from 'ol/layer/Heatmap';
import { useMapStore, BaseMapType } from '@/store/mapStore';
import { useLayerStore } from '@/store/layerStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useProjectStore } from '@/store/projectStore';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { workspaceApi } from '@/store/apiService';
import { useToast } from '@/components/ToastProvider';

const getBaseMapSource = (type: BaseMapType) => {
  switch (type) {
    case 'satellite':
      return new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
        attributions: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      });
    case 'terrain':
      return new XYZ({ url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17, attributions: 'OpenTopoMap' });
    case 'dark':
      return new XYZ({ url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', attributions: 'CartoDB' });
    case 'light':
      return new XYZ({ url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', attributions: 'CartoDB' });
    case 'osm':
    default:
      return new OSM();
  }
};

const formatLength = (line: LineString) => {
  const length = getLength(line);
  return length > 100 ? (length / 1000).toFixed(2) + ' km' : Math.round(length) + ' m';
};

const formatArea = (polygon: Polygon) => {
  const area = getArea(polygon);
  return area > 10000 ? (area / 1000000).toFixed(2) + ' km²' : Math.round(area) + ' m²';
};

const defaultFeatureStyle = (feature: any) => {
  const geomType = feature.getGeometry().getType();
  // OL GeoJSON readFeature flattens properties — check both paths
  const props = feature.get('properties') ?? feature.getProperties();
  const assetType = props?.asset_type ?? feature.get('asset_type');
  const source = props?.source ?? feature.get('source');
  const isLowHealth = (props?.health_score ?? feature.get('health_score') ?? 100) < 40;

  let baseStyle: Style | Style[];

  // Manual drawings — always bright cyan/yellow so they are distinguishable
  if (source === 'manual_draw') {
    if (geomType === 'LineString' || geomType === 'MultiLineString') {
      baseStyle = [
        new Style({ stroke: new Stroke({ color: 'rgba(0,229,255,0.35)', width: 10 }) }),
        new Style({ stroke: new Stroke({ color: '#00e5ff', width: 3 }) }),
      ];
    } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      baseStyle = new Style({
        fill: new Fill({ color: 'rgba(0,229,255,0.18)' }),
        stroke: new Stroke({ color: '#00e5ff', width: 3 }),
      });
    } else {
      baseStyle = new Style({
        image: new CircleStyle({
          radius: 9,
          fill: new Fill({ color: '#00e5ff' }),
          stroke: new Stroke({ color: '#ffffff', width: 2 }),
        }),
      });
    }
    return baseStyle;
  }

  // Special styling for uploaded datasets
  if (source === 'uploaded_dataset') {
    if (geomType === 'LineString' || geomType === 'MultiLineString') {
      baseStyle = [
        new Style({ stroke: new Stroke({ color: 'rgba(255, 20, 147, 0.5)', width: 8 }) }), // Pink glow
        new Style({ stroke: new Stroke({ color: '#FF1493', width: 3 }) }) // Deep pink main line
      ];
    } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      baseStyle = new Style({ 
        fill: new Fill({ color: 'rgba(0, 255, 255, 0.35)' }), 
        stroke: new Stroke({ color: '#00FFFF', width: 3 }) 
      });
    } else {
      baseStyle = new Style({ 
        image: new CircleStyle({ 
          radius: 8, 
          fill: new Fill({ color: '#FF1493' }), 
          stroke: new Stroke({ color: '#FFF', width: 2 }) 
        }) 
      });
    }
    return baseStyle;
  }

  if (assetType === 'Pipeline') {
    baseStyle = [
      new Style({ stroke: new Stroke({ color: 'rgba(57, 255, 20, 0.4)', width: 8 }) }), // Neon Green Glow
      new Style({ stroke: new Stroke({ color: '#39ff14', width: 3 }) }) // Main line
    ];
  } else if (assetType === 'Pump Station') {
    baseStyle = new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#007FFF' }), // Azure Blue
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    });
  } else if (assetType === 'Valve' || assetType === 'Sensor') {
    baseStyle = new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: assetType === 'Valve' ? '#FF8C00' : '#800080' }), // Orange vs Purple
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    });
  } else if (assetType === 'Reservoir') {
    baseStyle = new Style({
      fill: new Fill({ color: 'rgba(0, 255, 255, 0.4)' }), // Cyan Fill
      stroke: new Stroke({ color: '#00ffff', width: 2 })
    });
  } else {
    // Fallback based on geometry (High Contrast for Engineering)
    if (geomType === 'LineString' || geomType === 'MultiLineString') {
      baseStyle = new Style({ stroke: new Stroke({ color: '#FFD700', width: 4 }) }); // Gold / Yellow
    } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      baseStyle = new Style({ fill: new Fill({ color: 'rgba(0, 255, 255, 0.35)' }), stroke: new Stroke({ color: '#00FFFF', width: 3 }) }); // Cyan
    } else {
      baseStyle = new Style({ image: new CircleStyle({ radius: 8, fill: new Fill({ color: '#FF3366' }), stroke: new Stroke({ color: '#FFF', width: 2 }) }) }); // Pinkish Red
    }
  }

  // Highlight low health
  if (isLowHealth) {
    if (Array.isArray(baseStyle)) {
        baseStyle.unshift(new Style({ stroke: new Stroke({ color: 'rgba(255, 0, 0, 0.6)', width: 12 }) }));
    } else if (geomType === 'Point') {
        baseStyle = [new Style({
          image: new CircleStyle({ radius: 12, fill: new Fill({ color: 'rgba(255,0,0,0.4)' }) })
        }), baseStyle];
    } else {
        baseStyle = [new Style({ stroke: new Stroke({ color: 'rgba(255,0,0,0.8)', width: 6 }) }), baseStyle];
    }
  }

  return baseStyle;
};

const selectedFeatureStyle = new Style({
  fill: new Fill({ color: 'rgba(255, 165, 0, 0.3)' }),
  stroke: new Stroke({ color: '#ffa500', width: 4 }), // Orange Highlight
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#ffa500' }),
    stroke: new Stroke({ color: '#fff', width: 2 })
  })
});

// Site marker style - blue dot with name label
const siteStyle = (feature: any) => {
  const status = feature.get('status');
  const name = feature.get('name') || 'موقع';
  const color = status === 'active' ? '#3b82f6' : '#6b7280';
  return [
    new Style({
      image: new CircleStyle({
        radius: 16,
        fill: new Fill({ color: `${color}33` }),
      }),
    }),
    new Style({
      image: new CircleStyle({
        radius: 9,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#fff', width: 3 }),
      }),
      text: new Text({
        text: name,
        font: 'bold 12px Arial',
        fill: new Fill({ color: '#fff' }),
        stroke: new Stroke({ color, width: 3 }),
        offsetY: 24,
        textAlign: 'center',
        backgroundFill: new Fill({ color: `${color}cc` }),
        padding: [2, 5, 2, 5],
      }),
    }),
  ];
};

// Project marker style - distinctive icon for projects on map
const projectStyle = (feature: any) => {
  const name = feature.get('name') || 'مشروع';
  return [
    // Glow effect - outer circle
    new Style({
      image: new CircleStyle({
        radius: 18,
        fill: new Fill({ color: 'rgba(16, 185, 129, 0.3)' }), // Soft glow
      })
    }),
    // Main marker - bright and large
    new Style({
      image: new CircleStyle({
        radius: 14,
        fill: new Fill({ color: '#10b981' }), // Bright emerald green
        stroke: new Stroke({ color: '#fff', width: 4 })
      }),
      text: new Text({
        text: name,
        font: 'bold 14px Arial',
        fill: new Fill({ color: '#fff' }),
        stroke: new Stroke({ color: '#10b981', width: 4 }),
        offsetY: 25, // Position label below marker
        textAlign: 'center',
        backgroundFill: new Fill({ color: 'rgba(16, 185, 129, 0.8)' }),
        padding: [3, 6, 3, 6]
      })
    })
  ];
};

export default function MapCanvas({ isMonitoringMode = false, onProjectClick }: { 
  isMonitoringMode?: boolean;
  onProjectClick?: (projectId: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const vectorSource = useRef<VectorSource>(new VectorSource());
  const projectsVectorSource = useRef<VectorSource>(new VectorSource());
  const sitesVectorSource = useRef<VectorSource>(new VectorSource());
  const spatialSource = useRef<VectorSource>(new VectorSource());
  const heatmapLayerRef = useRef<HeatmapLayer | null>(null);
  const measureTooltipElement = useRef<HTMLDivElement | null>(null);
  const measureTooltip = useRef<Overlay | null>(null);

  const baseMap = useMapStore((state) => state.baseMap);
  const pendingFitExtent = useMapStore((state) => state.pendingFitExtent);
  const fitTrigger = useMapStore((state) => state.fitTrigger);
  const setPendingFitExtent = useMapStore((state) => state.setPendingFitExtent);
  const setMapBounds = useMapStore((state) => state.setMapBounds);
  const {
    editingState, addFeature, deleteFeature, setSelectedFeature, setEditingState, features, events,
    bufferResult, spatialResults, heatmapVisible, bufferDistance, nearbyRadius,
    setBufferResult, setSpatialResults, setLastActionSummary,
  } = useWorkspaceStore();
  const activeLayerId = useLayerStore((state) => state.activeLayerId);
  const layerStoreLayers = useLayerStore((state) => state.layers);
  const { loadLayers, updateFeatureCount } = useLayerStore();
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const sites = useProjectStore((state) => state.sites);
  const loadSites = useProjectStore((state) => state.loadSites);
  const { showToast } = useToast();

  
  // Blinking Critical Overlays
  useEffect(() => {
    if (!isMonitoringMode || !mapInstance.current) return;
    const map = mapInstance.current;
    
    // Clear old monitoring overlays
    const overlaysToRemove = [];
    map.getOverlays().forEach(o => {
      if (o.get('isCriticalOverlay')) overlaysToRemove.push(o);
    });
    overlaysToRemove.forEach(o => map.removeOverlay(o));

    const criticalEvents = events?.filter(e => e.event_type === 'CRITICAL_ASSET_RISK' && !e.resolved) || [];
    const criticalAssetIds = criticalEvents.map(e => e.asset_id);

    const format = new GeoJSON();
    features.forEach(f => {
      if (criticalAssetIds.includes(f.properties?.asset_id)) {
        const geom = format.readGeometry(f.geometry, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
        // get center or closest point
        let coord;
        if (geom.getType() === 'Point') {
          coord = (geom as any).getCoordinates();
        } else {
          coord = geom.getExtent() ? [ (geom.getExtent()[0] + geom.getExtent()[2])/2, (geom.getExtent()[1] + geom.getExtent()[3])/2 ] : null;
        }

        if (coord) {
          const el = document.createElement('div');
          el.className = 'w-6 h-6 bg-red-600 rounded-full animate-ping opacity-75';
          el.style.border = '2px solid red';
          const overlay = new Overlay({
            position: coord,
            positioning: 'center-center',
            element: el,
            stopEvent: false
          });
          overlay.set('isCriticalOverlay', true);
          map.addOverlay(overlay);
        }
      }
    });

  }, [isMonitoringMode, events, features]);

  // Init Map
  useEffect(() => {
    if (!mapRef.current) return;

    const baseLayer = new TileLayer({
      source: getBaseMapSource(baseMap)
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource.current,
      style: defaultFeatureStyle
    });

    // Spatial analysis results layer (orange highlight)
    const spatialResultsStyle = (feature: any) => {
      const geomType = feature.getGeometry().getType();
      if (geomType === 'Point') {
        return new Style({
          image: new CircleStyle({
            radius: 11,
            fill: new Fill({ color: 'rgba(255, 165, 0, 0.9)' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        });
      }
      if (geomType === 'LineString' || geomType === 'MultiLineString') {
        return new Style({ stroke: new Stroke({ color: '#ff9800', width: 5 }) });
      }
      return new Style({
        fill: new Fill({ color: 'rgba(255, 165, 0, 0.25)' }),
        stroke: new Stroke({ color: '#ff9800', width: 3, lineDash: [8, 4] }),
      });
    };

    const spatialLayer = new VectorLayer({
      source: spatialSource.current,
      style: spatialResultsStyle,
      zIndex: 50,
    });
    spatialLayer.set('name', 'spatial-analysis');

    // Heatmap layer (asset density / risk heat)
    const heatmap = new HeatmapLayer({
      source: vectorSource.current,
      blur: 20,
      radius: 15,
      weight: (feature: any) => {
        const health = feature.get('health_score') ?? 80;
        return (100 - Number(health)) / 100;
      },
    });
    heatmap.setVisible(false);
    heatmapLayerRef.current = heatmap;
    const clusterSource = new Cluster({
      distance: 40,
      source: projectsVectorSource.current,
    });
    
    // Cluster style
    const clusterStyleCache: { [key: string]: Style } = {};
    const getClusterStyle = (feature: any) => {
      const size = feature.get('features').length;
      
      // If single feature, just render as project
      if (size === 1) {
         return projectStyle(feature.get('features')[0]);
      }
      
      let style = clusterStyleCache[size];
      if (!style) {
        style = new Style({
          image: new CircleStyle({
            radius: 18,
            stroke: new Stroke({ color: '#fff', width: 2 }),
            fill: new Fill({ color: 'rgba(16, 185, 129, 0.9)' })
          }),
          text: new Text({
            text: size.toString(),
            font: 'bold 14px Arial',
            fill: new Fill({ color: '#fff' })
          })
        });
        clusterStyleCache[size] = style;
      }
      return style;
    };

    const projectsLayer = new VectorLayer({
      source: clusterSource,
      style: getClusterStyle,
      zIndex: 100
    });
    projectsLayer.set('name', 'projects');

    const sitesLayer = new VectorLayer({
      source: sitesVectorSource.current,
      style: siteStyle,
      zIndex: 110,
    });
    sitesLayer.set('name', 'project-sites');

    const map = new Map({
      target: mapRef.current,
      layers: [baseLayer, vectorLayer, spatialLayer, heatmap, projectsLayer, sitesLayer],
      view: new View({
        center: fromLonLat([13.1913, 32.8872]),
        zoom: 12
      })
    });

    mapInstance.current = map;

    // Add click handler for projects
    if (onProjectClick) {
      map.on('click', (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
        if (feature) {
          // It could be a clustered feature
          const clusterFeatures = feature.get('features');
          if (clusterFeatures && clusterFeatures.length > 0) {
            // Zoom in if multiple
            if (clusterFeatures.length > 1) {
              const view = map.getView();
              view.animate({
                center: evt.coordinate,
                zoom: view.getZoom()! + 2,
                duration: 500
              });
              return;
            }
            // Else single project clicked
            const projectId = clusterFeatures[0].get('projectId');
            if (projectId) {
               console.log('🗺️ Project marker clicked:', projectId);
               onProjectClick(projectId);
            }
          } else {
             // Normal project marker fallback
             if (feature.get('type') === 'project') {
               const projectId = feature.get('projectId');
               if (projectId) onProjectClick(projectId);
             }
          }
        }
      });

      // Change cursor on hover
      map.on('pointermove', (evt) => {
        const pixel = map.getEventPixel(evt.originalEvent);
        const hit = map.hasFeatureAtPixel(pixel, {
          layerFilter: (layer) => layer.get('name') === 'projects'
        });
        map.getTargetElement().style.cursor = hit ? 'pointer' : '';
      });
    }

    // ── Phase 6: Sync live viewport bounds to mapStore on every move/zoom ──
    const syncBoundsToStore = () => {
      const view = map.getView();
      const size = map.getSize();
      if (!size) return;
      const extent3857 = view.calculateExtent(size);
      const [west, south, east, north] = transformExtent(extent3857, 'EPSG:3857', 'EPSG:4326');
      setMapBounds({ north, south, east, west });
    };

    map.on('moveend', syncBoundsToStore);
    // Fire once immediately so store has live bounds from the first render
    syncBoundsToStore();

    return () => {
      map.setTarget(undefined);
    };
  }, [onProjectClick]);

  // Watch base map changing
  useEffect(() => {
    if (mapInstance.current) {
      const layers = mapInstance.current.getLayers().getArray();
      if (layers.length > 0) {
        (layers[0] as TileLayer<any>).setSource(getBaseMapSource(baseMap));
      }
    }
  }, [baseMap]);

  // Sync features
  useEffect(() => {
    if (!mapInstance.current) return;
    vectorSource.current.clear();

    const geojsonFormat = new GeoJSON();
    
    // LAYER ISOLATION: When a sub-layer is active show only its features.
    // When a main layer is active, show features from it AND all its direct sub-layers.
    const allLayers = useLayerStore.getState().layers;
    const activeLayer = allLayers.find(l => l.id === activeLayerId);
    const isSubLayer = !!activeLayer?.parentId && String(activeLayer.parentId) !== 'null';
    const relevantIds = new Set<string>([activeLayerId || '']);
    if (!isSubLayer && activeLayerId) {
      allLayers.filter(l => String(l.parentId) === activeLayerId).forEach(l => relevantIds.add(l.id));
    }
    const activeFeatures = features.filter(f => {
      const fLayerId = f.properties?.layerId || (f as any).layer_id;
      return relevantIds.has(fLayerId);
    });
    console.log(`🗺️ [SYNC] activeLayerId=${activeLayerId} relevantIds=[${Array.from(relevantIds)}] total=${features.length} shown=${activeFeatures.length}`);

    const olFeatures = activeFeatures.map(f => {
      try {
        const feat = geojsonFormat.readFeature(f, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
        const stableId = f.id ?? f.properties?.asset_id ?? f.properties?.id;
        if (stableId != null) {
          feat.setId(String(stableId));
        }
        return feat;
      } catch (err) {
        console.error('[SYNC] ❌ readFeature error:', err, 'feature:', JSON.stringify(f));
        return null;
      }
    }).filter(Boolean) as Feature<any>[];

    vectorSource.current.addFeatures(olFeatures.flat());
    console.log(`🗺️ [SYNC] added ${olFeatures.length} OL features to vectorSource`);
  }, [features, activeLayerId]);

  // Auto-zoom to uploaded features extent (lon/lat bounds from LeftPanel)
  useEffect(() => {
    if (!pendingFitExtent || !mapInstance.current) return;
    try {
      const extent3857 = transformExtent(pendingFitExtent, 'EPSG:4326', 'EPSG:3857');
      if (extent3857.every(isFinite)) {
        mapInstance.current.getView().fit(extent3857, { padding: [60, 60, 60, 60], duration: 700, maxZoom: 17 });
      }
    } catch (e) { console.warn('[MapCanvas] fitExtent error', e); }
    setPendingFitExtent(null);
  }, [pendingFitExtent, setPendingFitExtent]);

  // Zoom to current active layer features on demand
  useEffect(() => {
    if (!fitTrigger || !mapInstance.current) return;
    const extent = vectorSource.current.getExtent();
    if (extent && extent.every(isFinite)) {
      mapInstance.current.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 700, maxZoom: 17 });
    }
  }, [fitTrigger]);

  // Sync projects on map — hide cluster when a project is already selected
  useEffect(() => {
    if (!mapInstance.current) return;
    projectsVectorSource.current.clear();

    // Once a project is active the user is inside the workspace.
    // Project cluster markers must NOT bleed through — they belong to the picker, not the workspace.
    if (activeProjectId) return;

    // Filter projects that have GPS coordinates
    const projectsWithGPS = projects.filter(p => {
      const proj = p as any;
      return proj.latitude && proj.longitude;
    });

    console.log(`🗺️ عرض ${projectsWithGPS.length} مشروع على الخريطة`);

    // Create features for each project
    const projectFeatures = projectsWithGPS.map(project => {
      const proj = project as any;
      const lon = Number(proj.longitude);
      const lat = Number(proj.latitude);
      
      console.log(`  📍 ${project.name}: (${lat}, ${lon})`);
      
      const feature = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
        name: project.name,
        type: 'project',
        projectId: project.id
      });
      feature.setId(`project-${project.id}`);
      return feature;
    });

    projectsVectorSource.current.addFeatures(projectFeatures);
    
    // Fit map to show all projects if any exist
    if (projectFeatures.length > 0 && mapInstance.current) {
      const extent = projectsVectorSource.current.getExtent();
      if (extent && extent.every(v => isFinite(v))) {
        console.log('🎯 تمركز الخريطة على المشاريع');
        mapInstance.current.getView().fit(extent, { 
          padding: [100, 100, 100, 100], 
          maxZoom: 11,
          duration: 1500 
        });
      }
    }
  }, [projects, activeProjectId]);

  // Render project site markers when a project is active
  useEffect(() => {
    if (!mapInstance.current) return;
    sitesVectorSource.current.clear();
    if (!activeProjectId || !sites || sites.length === 0) return;

    const siteFeatures = (sites as any[])
      .filter(s => s.latitude && s.longitude)
      .map(site => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([Number(site.longitude), Number(site.latitude)])),
          name: site.name,
          type: 'site',
          siteId: site.id,
          status: site.status ?? 'active',
        });
        feature.setId(`site-${site.id}`);
        return feature;
      });

    console.log(`🗺️ [SITES] عرض ${siteFeatures.length} موقع على الخريطة`);
    sitesVectorSource.current.addFeatures(siteFeatures);
  }, [sites, activeProjectId]);

  // ── GIS Focus: zoom to selected project location when activeProjectId changes ──
  useEffect(() => {
    if (!activeProjectId || !mapInstance.current) return;
    const project = projects.find(p => String(p.id) === String(activeProjectId)) as any;
    if (!project) return;

    const lat = Number(project.latitude);
    const lon = Number(project.longitude);
    if (!isFinite(lat) || !isFinite(lon) || lat === 0 || lon === 0) return;

    // Validate this is a real geographic coordinate (not leftover default)
    if (lat < 20 || lat > 40 || lon < 5 || lon > 30) {
      console.warn(`⚠️ مشروع ${project.name}: إحداثيات غير صحيحة (${lat}, ${lon})`);
      return;
    }

    console.log(`🎯 GIS Focus → مشروع "${project.name}" at (${lat}, ${lon})`);
    mapInstance.current.getView().animate({
      center: fromLonLat([lon, lat]),
      zoom: 14,
      duration: 1200,
    });
  }, [activeProjectId, projects]);

  // Removed raw dataset rendering (STEP 1: Force Project loading only)

  // Handle Editing Interactions
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    const interactionsToRemove = map.getInteractions().getArray().filter(
      i => i instanceof Draw || i instanceof Modify || i instanceof Select || i instanceof Snap
    );
    interactionsToRemove.forEach(i => map.removeInteraction(i));

    map.getOverlays().clear();

    const createMeasureTooltip = () => {
      if (measureTooltipElement.current && measureTooltipElement.current.parentNode) {
        measureTooltipElement.current.parentNode.removeChild(measureTooltipElement.current);
      }
      measureTooltipElement.current = document.createElement('div');
      measureTooltipElement.current.className = 'bg-gray-900 text-white px-2 py-1 rounded shadow-lg text-sm font-bold pointer-events-none mt-4 border border-indigo-500';
      measureTooltip.current = new Overlay({
        element: measureTooltipElement.current,
        offset: [0, -15],
        positioning: 'bottom-center'
      });
      map.addOverlay(measureTooltip.current);
    };

    if (editingState === 'inspect-coordinate') {
      const clickHandler = (e: any) => {
        const coords = toLonLat(e.coordinate);
        alert(`الإحداثيات: ${coords[1].toFixed(5)}N, ${coords[0].toFixed(5)}E`);
      };
      map.on('singleclick', clickHandler);
      return () => map.un('singleclick', clickHandler);
    }

    // ── Buffer: click a point → compute buffer polygon ──────────────
    if (editingState === 'buffer') {
      const clickHandler = async (e: any) => {
        const [lon, lat] = toLonLat(e.coordinate);
        const geometry = { type: 'Point', coordinates: [lon, lat] };
        try {
          const result = await workspaceApi.spatialBuffer(geometry, bufferDistance, activeProjectId ?? undefined);
          setBufferResult(result);
          setLastActionSummary({
            type: 'buffer',
            title: `نطاق التأثير — ${bufferDistance}م`,
            body: `تم رسم دائرة برتقالية بنصف قطر ${bufferDistance} متراً حول النقطة المحددة. يمكنك تغيير المسافة من الشريط العلوي.`,
            timestamp: Date.now(),
          });
          const toast = document.createElement('div');
          toast.style.cssText = 'position:fixed;top:80px;right:24px;z-index:9999;background:#1e3a5f;color:#93c5fd;border:1px solid #3b82f6;border-radius:10px;padding:12px 18px;font-size:14px;direction:rtl;box-shadow:0 4px 20px rgba(0,0,0,0.6)';
          toast.textContent = `✅ منطقة التأثير: ${bufferDistance}م مرسومة`;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 4000);
        } catch (err) {
          console.error('[buffer] error:', err);
        }
        setEditingState('idle');
      };
      map.on('singleclick', clickHandler);
      return () => map.un('singleclick', clickHandler);
    }

    // ── Nearby: click a point → find assets within radius ───────────
    if (editingState === 'nearby') {
      const clickHandler = async (e: any) => {
        const [lon, lat] = toLonLat(e.coordinate);
        try {
          const result = await workspaceApi.spatialNearby(lon, lat, nearbyRadius, activeProjectId ?? undefined);
          const feats = result?.features ?? [];
          setSpatialResults(feats);
          setLastActionSummary({
            type: 'nearby',
            title: `بحث قريب — ${nearbyRadius}م`,
            body: feats.length > 0
              ? `وُجد ${feats.length} أصل ضمن نطاق ${nearbyRadius} متراً من النقطة المحددة. الأصول مُعلَّمة باللون البرتقالي على الخريطة.`
              : `لم يُوجد أي أصل ضمن نطاق ${nearbyRadius}م. جرّب توسيع النطاق من الشريط العلوي.`,
            count: feats.length,
            timestamp: Date.now(),
          });
          const toast = document.createElement('div');
          toast.style.cssText = 'position:fixed;top:80px;right:24px;z-index:9999;background:#1e3a5f;color:#93c5fd;border:1px solid #3b82f6;border-radius:10px;padding:12px 18px;font-size:14px;direction:rtl;box-shadow:0 4px 20px rgba(0,0,0,0.6)';
          toast.textContent = `🔍 وُجد ${feats.length} أصل خلال ${nearbyRadius}م`;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 5000);
        } catch (err) {
          console.error('[nearby] error:', err);
        }
        setEditingState('idle');
      };
      map.on('singleclick', clickHandler);
      return () => map.un('singleclick', clickHandler);
    }

    // ── Intersect: draw polygon → query intersecting assets ─────────
    if (editingState === 'intersect') {
      const sketchStyle = [
        new Style({
          fill: new Fill({ color: 'rgba(138, 43, 226, 0.15)' }),
          stroke: new Stroke({ color: '#8b5cf6', width: 3, lineDash: [8, 5] }),
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: '#8b5cf6' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        }),
      ];
      const draw = new Draw({ source: new VectorSource(), type: 'Polygon', style: sketchStyle });
      draw.on('drawend', async (event) => {
        const olGeom = event.feature.getGeometry() as Polygon;
        const rings = (olGeom as any).getCoordinates() as number[][][];
        const polygon = { type: 'Polygon', coordinates: rings.map((ring: number[][]) => ring.map((c: number[]) => { const [lo, la] = toLonLat(c); return [lo, la]; })) };
        try {
          const result = await workspaceApi.spatialIntersect(polygon, activeProjectId ?? undefined);
          const feats = result?.features ?? [];
          setSpatialResults(feats);
          setLastActionSummary({
            type: 'intersect',
            title: 'تقاطع المضلع',
            body: feats.length > 0
              ? `وُجد ${feats.length} أصل يقع داخل المنطقة المرسومة. الأصول مُعلَّمة باللون البنفسجي على الخريطة.`
              : 'لا توجد أصول داخل المنطقة المحددة. حاول رسم منطقة أوسع.',
            count: feats.length,
            timestamp: Date.now(),
          });
          const toast = document.createElement('div');
          toast.style.cssText = 'position:fixed;top:80px;right:24px;z-index:9999;background:#2e1065;color:#c4b5fd;border:1px solid #7c3aed;border-radius:10px;padding:12px 18px;font-size:14px;direction:rtl;box-shadow:0 4px 20px rgba(0,0,0,0.6)';
          toast.textContent = `🔷 ${feats.length} أصل داخل المضلع المحدد`;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 5000);
        } catch (err) {
          console.error('[intersect] error:', err);
        }
        setEditingState('idle');
      });
      map.addInteraction(draw);
      return () => map.removeInteraction(draw);
    }

    if (editingState === 'delete') {
      const handleDeleteClick = async (evt: any) => {
        const hit = map.forEachFeatureAtPixel(evt.pixel, (feature) => feature, { hitTolerance: 8 });
        if (!hit) return;

        const feature = hit as Feature;
        const rawId = feature.getId();
        const featureId = rawId != null ? String(rawId) : '';
        const featureType = String(feature.get('type') || feature.get('asset_type') || '');
        const siteId = feature.get('siteId');

        if (featureType === 'project' || featureId.startsWith('project-')) {
          showToast('حذف المشروع لا يتم من الخريطة. استخدم لوحة المشاريع.', 'warning');
          return;
        }

        if (featureType === 'site' || siteId != null || featureId.startsWith('site-')) {
          if (!activeProjectId) {
            showToast('لا يمكن حذف الموقع بدون مشروع نشط.', 'warning');
            return;
          }

          const resolvedSiteId = String(siteId ?? featureId.replace(/^site-/, ''));
          const siteName = String(feature.get('name') || 'الموقع');
          if (!window.confirm(`هل تريد حذف الموقع "${siteName}"؟`)) return;

          try {
            await workspaceApi.deleteSite(resolvedSiteId);
            sitesVectorSource.current.removeFeature(feature);
            await loadSites(activeProjectId);
            showToast(`تم حذف الموقع "${siteName}"`, 'success');
            setEditingState('idle');
          } catch (error: any) {
            showToast(`فشل حذف الموقع: ${error.message}`, 'error');
          }
          return;
        }

        if (featureId) {
          if (!window.confirm('هل تريد حذف هذا المعلم؟')) return;
          deleteFeature(featureId);
          vectorSource.current.removeFeature(feature);
          showToast('تم إرسال أمر حذف المعلم', 'success');
          setEditingState('idle');
          return;
        }

        showToast('هذا العنصر غير قابل للحذف من أداة الخريطة.', 'warning');
      };

      map.on('singleclick', handleDeleteClick);
      return () => map.un('singleclick', handleDeleteClick);
    }

    if (editingState === 'idle') {
      const select = new Select({ style: selectedFeatureStyle });
      map.addInteraction(select);
      select.on('select', (e) => {
        if (e.selected.length > 0) {
          const feature = e.selected[0];
          setSelectedFeature(feature.getId() as string);
        } else {
          setSelectedFeature(null);
        }
      });
      return;
    }

    if (editingState === 'modify') {
      const modify = new Modify({ source: vectorSource.current });
      map.addInteraction(modify);
      return;
    }

    if (['polygon', 'line', 'point', 'measure-distance', 'measure-area'].includes(editingState)) {


      let type: 'Polygon' | 'LineString' | 'Point' = 'Polygon';
      if (editingState === 'line' || editingState === 'measure-distance') type = 'LineString';
      if (editingState === 'point') type = 'Point';

      console.log(`%c[DRAW-INIT] Draw interaction created: type=${type} editingState=${editingState} activeLayerId=${activeLayerId}`, 'color:#facc15;font-weight:bold');

      // Bright sketch style — high contrast on dark basemap
      const sketchStyle = [
        new Style({
          fill: new Fill({ color: 'rgba(0, 255, 255, 0.15)' }),
          stroke: new Stroke({ color: '#00e5ff', width: 3, lineDash: [8, 5] }),
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: '#00e5ff' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }),
      ];

      const draw = new Draw({
        source: vectorSource.current,
        type: type,
        style: sketchStyle,
      });

      let listener: any;
      draw.on('drawstart', (evt) => {
        const sketch = evt.feature;
        if (editingState.startsWith('measure')) {
          createMeasureTooltip();
          listener = sketch.getGeometry()?.on('change', (e) => {
            const geom = e.target;
            let output = '';
            let tooltipCoord = (evt as any).coordinate;
            if (geom instanceof Polygon) {
              output = formatArea(geom);
              tooltipCoord = geom.getInteriorPoint().getCoordinates();
            } else if (geom instanceof LineString) {
              output = formatLength(geom);
              tooltipCoord = geom.getLastCoordinate();
            }
            if (measureTooltipElement.current) {
              measureTooltipElement.current.innerHTML = output;
            }
            if (measureTooltip.current) {
              measureTooltip.current.setPosition(tooltipCoord);
            }
          });
        }
      });

      draw.on('drawend', (event) => {
        if (measureTooltipElement.current && measureTooltipElement.current.parentNode) {
            measureTooltipElement.current.parentNode.removeChild(measureTooltipElement.current);
            setTimeout(createMeasureTooltip, 0);
        }

        if (editingState.startsWith('measure')) return;

        console.log('%c[DRAW-0] drawend fired', 'color:#00e5ff;font-weight:bold', {
          editingState, activeLayerId, activeProjectId
        });

        // ── Guard: must have an active layer ─────────────────────────
        if (!activeLayerId) {
          console.warn('[DRAW-0] ❌ activeLayerId is null/empty — aborting draw save');
          // Remove the drawn OL feature so it doesn't stay on map
          setTimeout(() => vectorSource.current.removeFeature(event.feature), 10);
          // Show Arabic warning toast
          const el = document.createElement('div');
          el.style.cssText = 'position:fixed;top:80px;right:24px;z-index:9999;background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c;border-radius:10px;padding:12px 18px;font-size:14px;direction:rtl;box-shadow:0 4px 20px rgba(0,0,0,0.6)';
          el.textContent = '⚠️ اختر طبقة أولاً قبل حفظ الرسم';
          document.body.appendChild(el);
          setTimeout(() => el.remove(), 4000);
          setEditingState('idle');
          return;
        }

        const feature = event.feature;
        const id = 'draw-' + Date.now();
        feature.setId(id);

        // ── Convert geometry to EPSG:4326 using toLonLat (reliable, no registry dep) ──
        const olGeom = feature.getGeometry();
        let geometry4326: any;
        if (!olGeom) {
          console.error('[DRAW-1] ❌ olGeom is null — no geometry on drawn feature');
          setEditingState('idle');
          return;
        }
        const gType = olGeom.getType();
        console.log('[DRAW-1] geometry type:', gType, '| raw coords:', (olGeom as any).getCoordinates());
        if (gType === 'Point') {
          const c = (olGeom as any).getCoordinates() as number[];
          const [lon, lat] = toLonLat(c);
          geometry4326 = { type: 'Point', coordinates: [lon, lat] };
        } else if (gType === 'LineString') {
          const coords = (olGeom as any).getCoordinates() as number[][];
          geometry4326 = { type: 'LineString', coordinates: coords.map(c => { const [lo, la] = toLonLat(c); return [lo, la]; }) };
        } else if (gType === 'Polygon') {
          const rings = (olGeom as any).getCoordinates() as number[][][];
          geometry4326 = { type: 'Polygon', coordinates: rings.map(ring => ring.map(c => { const [lo, la] = toLonLat(c); return [lo, la]; })) };
        } else {
          // Fallback for MultiPolygon / MultiLineString
          const geojson4326 = new GeoJSON().writeFeatureObject(feature, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
          geometry4326 = geojson4326.geometry;
        }
        console.log('[DRAW-1] ✅ geometry4326:', JSON.stringify(geometry4326));

        let assetType = 'مرسوم يدوياً';
        if (type === 'Polygon') assetType = 'مضلع مرسوم';
        if (type === 'LineString') assetType = 'مسار مرسوم';
        if (type === 'Point') assetType = 'نقطة مرسومة';

        const layerInfo = layerStoreLayers.find(l => l.id === activeLayerId);
        const parentLayer = layerInfo?.parentId ? layerStoreLayers.find(l => l.id === String(layerInfo.parentId)) : null;
        const layerPath = parentLayer ? `${parentLayer.name} › ${layerInfo?.name}` : (layerInfo?.name ?? activeLayerId);

        const featurePayload = {
          type: 'Feature' as const,
          id: id,
          geometry: geometry4326,
          properties: {
            asset_id: id,
            asset_type: assetType,
            asset_name: assetType,
            status: 'Active',
            health_score: 100,
            installation_date: new Date().toISOString().split('T')[0],
            department_owner: 'Admin',
            source: 'manual_draw',
            layerId: activeLayerId,
          } as any,
        };

        console.log('[DRAW-2] calling addFeature with payload:', JSON.stringify(featurePayload));
        // ── Persist: addFeature calls workspaceApi.createAsset → POST /assets ──
        addFeature(featurePayload);

        // ── DO NOT remove the OL sketch feature manually ─────────────
        // The features-sync useEffect (triggered by addFeature updating the store)
        // will call vectorSource.clear() then re-add all features from store.
        // Calling removeFeature here races with that effect and causes the feature
        // to disappear: the sketch is gone AND features-sync runs with stale closure.
        // Leaving the OL feature in place means it shows immediately after drawend
        // and is then seamlessly replaced by the store-synced version.

        // ── Refresh layer tree counts ─────────────────────────────────
        if (activeProjectId) {
          setTimeout(() => loadLayers(activeProjectId), 800);
        }

        // ── Reset drawing mode to idle ────────────────────────────────
        setEditingState('idle');

        // ── Success toast ─────────────────────────────────────────────
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;top:80px;right:24px;z-index:9999;background:#052e16;color:#86efac;border:1px solid #166534;border-radius:10px;padding:12px 18px;font-size:14px;direction:rtl;box-shadow:0 4px 20px rgba(0,0,0,0.6)';
        toast.textContent = `✅ تم حفظ الرسم في الطبقة: ${layerPath}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      });

      map.addInteraction(draw);
      map.addInteraction(new Snap({ source: vectorSource.current }));
    }
  }, [editingState, addFeature, deleteFeature, setSelectedFeature, setEditingState, activeLayerId, activeProjectId, loadLayers, layerStoreLayers, updateFeatureCount, bufferDistance, nearbyRadius, setBufferResult, setSpatialResults]);

  // Sync spatial analysis results (buffer + nearby/intersect) to spatialSource
  useEffect(() => {
    spatialSource.current.clear();
    const format = new GeoJSON();
    if (bufferResult) {
      try {
        const feat = format.readFeature(bufferResult, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
        spatialSource.current.addFeature(feat as Feature<any>);
      } catch (e) { console.warn('[spatial] buffer read err', e); }
    }
    if (spatialResults && spatialResults.length > 0) {
      spatialResults.forEach(f => {
        try {
          const feat = format.readFeature(f, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
          spatialSource.current.addFeature(feat as Feature<any>);
        } catch (e) { console.warn('[spatial] result read err', e); }
      });
    }
  }, [bufferResult, spatialResults]);

  // Sync heatmap visibility
  useEffect(() => {
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.setVisible(heatmapVisible);
    }
  }, [heatmapVisible]);

  return <div dir="ltr" ref={mapRef} className="w-full h-full bg-gray-50 dark:bg-gray-900" />;
}
