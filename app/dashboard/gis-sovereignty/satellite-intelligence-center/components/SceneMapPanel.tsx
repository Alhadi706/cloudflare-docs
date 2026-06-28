'use client';
// ─── SceneMapPanel ────────────────────────────────────────────────────────────
// Controlled map canvas — drawMode and baseStyle are owned by parent (SatIntelTopBar).
// Renders OL map with scene footprints; exposes callbacks for interaction events.

import React, { useEffect, useRef, useState } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { type SceneListItem } from '@/lib/satelliteIntelAPI';
// ── Shared basemap registry from unified GIS engine (no duplicate definition)
import { BASEMAPS as GIS_BASEMAPS } from '@/store/gisEngine';

// SceneMapPanel-specific basemap type — uses shared URLs from gisEngine, adds local 'label'
export const BASEMAPS = {
  voyager:   { ...GIS_BASEMAPS.road,      label: 'الطرق' },
  satellite: { ...GIS_BASEMAPS.satellite, label: 'صور فضائية' },
  terrain:   { ...GIS_BASEMAPS.terrain,   label: 'تضاريس' },
  light:     { ...GIS_BASEMAPS.light,     label: 'فاتح' },
  dark:      { ...GIS_BASEMAPS.dark,      label: 'داكن' },
} as const;
export type BaseStyle = keyof typeof BASEMAPS;
export type DrawMode  = 'off' | 'polygon' | 'box';

interface SceneMapPanelProps {
  scenes:        SceneListItem[];
  projects?:     any[];
  activeScene:   string | null;
  drawMode:      DrawMode;
  baseStyle:     BaseStyle;
  onSelectScene?:   (uid: string) => void;
  onAreaDrawn?:     (coords: [number, number][]) => void;
  onDrawEnd?:       () => void;
  onCoordsChange?:  (lon: number, lat: number) => void;
  onZoomChange?:    (zoom: number) => void;
  /** Service layer features rendered as styled markers on the map */
  serviceLayerFeatures?: ServiceLayerMapEntry[];
  /** When set, next map click fires this callback and exits mode */
  addPointMode?: { layerId: string; color: string; onPointPicked: (lon: number, lat: number) => void } | null;
  onExitAddPointMode?: () => void;
  /** Suitability analysis result pins — shown as green markers */
  suitabilityPins?: { lon: number; lat: number; score: number; label: string }[];
  /** When set, map animates to this coordinate */
  flyToPin?: { lon: number; lat: number; zoom?: number } | null;
  /** Routing state */
  routingPickMode?: 'idle' | 'picking_start' | 'picking_end';
  routingStartPoint?: [number, number] | null;
  routingEndPoint?: [number, number] | null;
  onRoutingPointPicked?: (which: 'start' | 'end', lon: number, lat: number) => void;
  routingPath?: [number, number][] | null;
  /** Network design pick state */
  networkPickMode?: 'idle' | 'picking_node';
  onNetworkPointPicked?: (lon: number, lat: number) => void;
  /** Municipality/polygon boundary to highlight with a dashed overlay */
  highlightBoundary?: any | null;
  /** Callback to change basemap — when provided, a floating basemap picker appears on the map */
  onBaseStyleChange?: (style: BaseStyle) => void;
  /** Extraction result layers — each rendered with its own color on the map */
  extractionLayers?: {
    layerKey: string;
    layerName: string;
    color: string;
    geojson: { type: 'FeatureCollection'; features: any[] };
    visible: boolean;
  }[];
  /** Alert event markers from monitoring — shown as coloured circles */
  alertEventMarkers?: { lon: number; lat: number; severity: string; type: string; label: string }[];
  /** Auto-generated network GeoJSON to render on the map */
  autoNetworkGeojson?: any | null;
}

export interface ServiceLayerMapEntry {
  layerId:  string;
  visible:  boolean;
  color:    string;
  emoji:    string;
  features: Array<{
    id: string;
    name: string;
    geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
    facility_type?: string;
  }>;
}

// Tripoli centroid (default view)
const TRIPOLI_LON = 13.19;
const TRIPOLI_LAT = 32.89;

// Approximate bounding boxes per known scene uid prefix (expanded as needed)
function getSceneBBox(uid: string): [number, number, number, number] | null {
  if (uid.includes('T33SUU') || uid.includes('TRIPOLI')) {
    // UTM Zone 33N tile 33SUU ≈ Tripoli area
    return [12.8, 32.5, 13.6, 33.3]; // [minLon, minLat, maxLon, maxLat]
  }
  if (uid.includes('33SUS')) {
    return [13.0, 31.8, 13.8, 32.6];
  }
  return null;
}

export function SceneMapPanel({
  scenes, projects, activeScene, drawMode, baseStyle,
  onSelectScene, onAreaDrawn, onDrawEnd, onCoordsChange, onZoomChange,
  serviceLayerFeatures, addPointMode, onExitAddPointMode,
  suitabilityPins, flyToPin,
  routingPickMode = 'idle', routingStartPoint, routingEndPoint,
  onRoutingPointPicked, routingPath,
  networkPickMode = 'idle', onNetworkPointPicked,
  highlightBoundary,
  onBaseStyleChange,
  extractionLayers,
  alertEventMarkers,
  autoNetworkGeojson,
}: SceneMapPanelProps) {
  const mapRef           = useRef<HTMLDivElement>(null);
  const mapInstanceRef   = useRef<any>(null);
  const vectorSourceRef  = useRef<any>(null);
  const projectSourceRef = useRef<any>(null);
  const projectLayerRef  = useRef<any>(null);
  const xyzSourceRef     = useRef<any>(null);
  const baseLayerRef     = useRef<any>(null); // tracks current base TileLayer for clean swap
  const drawLayerRef     = useRef<any>(null);
  const drawInteractRef  = useRef<any>(null);
  // AOI persistence — separate layer kept alive after draw ends
  const aoiSourceRef     = useRef<any>(null);
  const aoiLayerRef      = useRef<any>(null);
  // Service layer features layers (one OL VectorLayer per service layer)
  const svcLayerMapRef   = useRef<Map<string, any>>(new Map());
  const addPointModeRef  = useRef<typeof addPointMode>(null);
  // Suitability result pins layer
  const suitabilityLayerRef = useRef<any>(null);
  // Routing layers (start/end markers + path line)
  const routingLayerRef     = useRef<any>(null);
  // Auto-generated network layer
  const autoNetworkLayerRef = useRef<any>(null);
  // Municipality highlight boundary layer
  const boundaryLayerRef    = useRef<any>(null);
  // Upload/extraction preview layer (responds to engineering:preview-geojson)
  const previewLayerRef     = useRef<any>(null);
  // Per-layer extraction map layers (one OL VectorLayer per layer key)
  const extractionLayerMapRef = useRef<Map<string, any>>(new Map());
  const routingPickModeRef  = useRef<typeof routingPickMode>('idle');
  const networkPickModeRef  = useRef<typeof networkPickMode>('idle');
  // Cached OL classes after dynamic import (avoids re-importing)
  const olCache          = useRef<{ Draw: any; createBox: any; VectorSource: any; VectorLayer: any; TileLayer: any; XYZ: any; Style: any; Fill: any; Stroke: any; Text: any; CircleStyle: any; toLonLat: any; fromLonLat: any } | null>(null);

  const [olLoaded, setOlLoaded] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [hasAoi,   setHasAoi]   = useState(false);
  // Debug: visible proof that basemap effect fired and which style is active


  // Dynamic import of OpenLayers (avoid SSR issues)
  useEffect(() => {
    let cancelled = false;
    async function initMap() {
      if (!mapRef.current) return;
      try {
        const [
          { default: Map },
          { default: View },
          { default: TileLayer },
          { default: XYZ },
          { default: VectorLayer },
          { default: VectorSource },
          { default: GeoJSON },
          { Style, Fill, Stroke, Text, Circle: CircleStyle },
          { fromLonLat, toLonLat },
          { default: Draw, createBox },
        ] = await Promise.all([
          import('ol/Map'),
          import('ol/View'),
          import('ol/layer/Tile'),
          import('ol/source/XYZ'),
          import('ol/layer/Vector'),
          import('ol/source/Vector'),
          import('ol/format/GeoJSON'),
          import('ol/style'),
          import('ol/proj'),
          import('ol/interaction/Draw'),
        ]);

        if (cancelled || !mapRef.current) return;

        const vectorSource = new VectorSource();
        vectorSourceRef.current = vectorSource;

        // ── AOI persistence layer (survives draw mode toggle) ──────────────
        const aoiSource = new VectorSource();
        aoiSourceRef.current = aoiSource;
        const aoiLayer  = new VectorLayer({
          source: aoiSource,
          // Two-layer style: outer glow ring + sharp inner border
          style: [
            new Style({
              stroke: new Stroke({ color: 'rgba(16,185,129,0.25)', width: 16 }),
            }),
            new Style({
              stroke: new Stroke({ color: '#10b981', width: 3.5 }),
              fill:   new Fill({ color: 'rgba(16,185,129,0.10)' }),
            }),
          ],
          zIndex: 20,
        });
        aoiLayerRef.current = aoiLayer;

        const initialBasemap = BASEMAPS[baseStyle] ?? BASEMAPS.satellite;
        const xyzSource = new XYZ({
          url: initialBasemap.url,
          attributions: [initialBasemap.attr],
        });
        xyzSourceRef.current = xyzSource;

        // Base tile layer — always lives at index 0 in the layer collection
        const baseTileLayer = new TileLayer({ source: xyzSource });
        baseLayerRef.current = baseTileLayer;

        const vectorLayer = new VectorLayer({
          source: vectorSource,
          style: (feature: any) => {
            const isActive = feature.get('uid') === activeScene;
            return new Style({
              stroke: new Stroke({
                color: isActive ? '#f59e0b' : '#3b82f6',
                width: isActive ? 2.5 : 1.5,
              }),
              fill: new Fill({
                color: isActive ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.08)',
              }),
            });
          },
          zIndex: 5,
        });

        // ── Projects layer (shared from gisEngine) ────────────────────────
        const projectSource = new VectorSource();
        projectSourceRef.current = projectSource;
        const projectLayer = new VectorLayer({
          source: projectSource,
          style: (f: any) => {
            const gt = f.getGeometry()?.getType?.();
            if (gt === 'Polygon' || gt === 'MultiPolygon') {
              return new Style({
                fill: new Fill({ color: 'rgba(59,130,246,0.12)' }),
                stroke: new Stroke({ color: '#3b82f6', width: 2 }),
              });
            }
            return new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({ color: '#3b82f6' }),
                stroke: new Stroke({ color: '#fff', width: 2 }),
              }),
              text: new Text({
                text: f.get('name') ?? '',
                offsetY: -16,
                fill: new Fill({ color: '#fff' }),
                stroke: new Stroke({ color: '#1e3a5f', width: 3 }),
                font: '11px sans-serif',
              }),
            });
          },
          zIndex: 8,
        });
        projectLayerRef.current = projectLayer;

        const map = new Map({
          target: mapRef.current,
          layers: [
            baseTileLayer,
            vectorLayer,
            projectLayer,
            aoiLayer,
          ],
          view: new View({
            center: fromLonLat([TRIPOLI_LON, TRIPOLI_LAT]),
            zoom: 9,
          }),
          controls: [],
        });

        mapInstanceRef.current = map;

        // Add footprint polygons for each scene
        const format = new GeoJSON();
        for (const scene of scenes) {
          const uid = scene.scene_uid;
          const bbox = getSceneBBox(uid);
          if (!bbox) continue;
          const [minLon, minLat, maxLon, maxLat] = bbox;
          const feature = format.readFeature({
            type: 'Feature',
            properties: { uid, real: scene.data_is_real },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [minLon, minLat],
                [maxLon, minLat],
                [maxLon, maxLat],
                [minLon, maxLat],
                [minLon, minLat],
              ]],
            },
          }, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' }) as any;
          vectorSource.addFeature(feature);
        }

        // Fit view to all footprints
        const ext = vectorSource.getExtent();
        if (ext && isFinite(ext[0])) {
          map.getView().fit(ext, { padding: [24, 24, 24, 24], maxZoom: 11 });
        }

        // Click to select scene
        map.on('click', (evt: any) => {
          // If in add-point mode, capture coords and exit
          if (addPointModeRef.current) {
            const [lon, lat] = toLonLat(evt.coordinate) as [number, number];
            const cb = addPointModeRef.current.onPointPicked;
            addPointModeRef.current = null;
            onExitAddPointMode?.();
            cb(lon, lat);
            return;
          }
          // If in routing pick mode, capture routing point
          if (routingPickModeRef.current !== 'idle') {
            const [lon, lat] = toLonLat(evt.coordinate) as [number, number];
            const which = routingPickModeRef.current === 'picking_start' ? 'start' : 'end';
            routingPickModeRef.current = 'idle';
            onRoutingPointPicked?.(which, lon, lat);
            return;
          }
          // If in network pick mode, capture node point
          if (networkPickModeRef.current === 'picking_node') {
            const [lon, lat] = toLonLat(evt.coordinate) as [number, number];
            networkPickModeRef.current = 'idle';
            onNetworkPointPicked?.(lon, lat);
            return;
          }
          map.forEachFeatureAtPixel(evt.pixel, (feature: any) => {
            const uid = feature.get('uid');
            if (uid && onSelectScene) onSelectScene(uid);
            return true;
          });
        });

        // Pointer move → coords callback
        map.on('pointermove', (evt: any) => {
          if (onCoordsChange && evt.coordinate) {
            const [lon, lat] = toLonLat(evt.coordinate);
            onCoordsChange(lon, lat);
          }
        });

        // View moveend → zoom callback
        map.getView().on('change:resolution', () => {
          const z = map.getView().getZoom();
          if (z != null && onZoomChange) onZoomChange(z);
        });

        if (!cancelled) {
          // Cache OL classes for draw interaction (avoids re-importing)
          olCache.current = { Draw, createBox, VectorSource, VectorLayer, TileLayer, XYZ, Style, Fill, Stroke, Text, CircleStyle, toLonLat, fromLonLat };
          setOlLoaded(true);
          // Initial zoom
          const initZoom = map.getView().getZoom();
          if (initZoom != null && onZoomChange) onZoomChange(initZoom);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'فشل تحميل الخريطة');
      }
    }

    initMap();
    return () => { cancelled = true; };
  }, []); // intentionally only on mount

  // Sync addPointMode into ref (accessible inside map click handler closure)
  useEffect(() => {
    addPointModeRef.current = addPointMode ?? null;
  }, [addPointMode]);

  // Render service layer features on the map
  useEffect(() => {
    if (!olLoaded || !mapInstanceRef.current || !olCache.current) return;
    const map = mapInstanceRef.current;
    const { VectorSource, VectorLayer, Style, Fill, Stroke, CircleStyle, Text, fromLonLat } = olCache.current;

    const entries = serviceLayerFeatures ?? [];
    const seenIds = new Set<string>();

    for (const entry of entries) {
      seenIds.add(entry.layerId);
      let svcLayer = svcLayerMapRef.current.get(entry.layerId);

      if (!svcLayer) {
        const src = new VectorSource();
        svcLayer = new VectorLayer({ source: src, zIndex: 15 });
        map.addLayer(svcLayer);
        svcLayerMapRef.current.set(entry.layerId, svcLayer);
      }

      svcLayer.setVisible(entry.visible);
      const src = svcLayer.getSource();
      src.clear();

      if (!entry.visible || entry.features.length === 0) continue;

      (async () => {
        const { default: Feature } = await import('ol/Feature') as any;
        const { default: Point }   = await import('ol/geom/Point') as any;
        for (const feat of entry.features) {
          if (feat.geometry.type !== 'Point') continue;
          const coords = feat.geometry.coordinates as number[];
          try {
            const olFeat = new Feature(new Point(fromLonLat([coords[0], coords[1]])));
            olFeat.set('svc_name', feat.name);
            olFeat.set('svc_id', feat.id);
            const color = entry.color;
            olFeat.setStyle(new Style({
              image: new CircleStyle({
                radius: 8,
                fill:   new Fill({ color }),
                stroke: new Stroke({ color: '#fff', width: 2 }),
              }),
              text: new Text({
                text: feat.name,
                offsetY: -18,
                font: 'bold 10px sans-serif',
                fill:   new Fill({ color: '#fff' }),
                stroke: new Stroke({ color: '#0f172a', width: 3 }),
              }),
            }));
            src.addFeature(olFeat);
          } catch { /* skip malformed */ }
        }
      })();
    }

    // Remove OL layers for deleted service layers
    svcLayerMapRef.current.forEach((olLayer, layerId) => {
      if (!seenIds.has(layerId)) {
        map.removeLayer(olLayer);
        svcLayerMapRef.current.delete(layerId);
      }
    });
  }, [serviceLayerFeatures, olLoaded]);

  // Re-style when activeScene changes (force vectorLayer redraw)
  useEffect(() => {
    if (!olLoaded || !vectorSourceRef.current) return;
    vectorSourceRef.current.forEachFeature((f: any) => f.changed());
  }, [activeScene, olLoaded]);

  // ── Render projects from shared gisEngine ─────────────────────────────────
  useEffect(() => {
    (async () => {
      const src = projectSourceRef.current;
      if (!src || !projects) return;
      
      const { fromLonLat } = await import('ol/proj');
      const FeatureAny: any = (await import('ol/Feature')).default;
      const PointAny: any = (await import('ol/geom/Point')).default;
      const GeoJSONAny: any = (await import('ol/format/GeoJSON')).default;
      
      src.clear();
      const fmt = new GeoJSONAny();
      for (const p of projects) {
        if (!p.geometry) continue;
        try {
          const geom = typeof p.geometry === 'string' ? JSON.parse(p.geometry) : p.geometry;
          if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
            const feats = fmt.readFeatures({ type: 'Feature', geometry: geom, properties: {} }, { featureProjection: 'EPSG:3857' });
            feats.forEach((f: any) => {
              f.set('entity_type', 'project');
              f.set('entity_id', p.id);
              f.set('name', p.name);
            });
            src.addFeatures(feats);
          } else if (geom && geom.type === 'Point') {
            const feat = new FeatureAny(new PointAny(fromLonLat([geom.coordinates[0], geom.coordinates[1]])));
            feat.set('entity_type', 'project');
            feat.set('entity_id', p.id);
            feat.set('name', p.name);
            src.addFeature(feat);
          }
        } catch (e) {
          // Skip malformed geometries
        }
      }
    })();
  }, [projects, olLoaded]);

  // Swap basemap: update XYZ source URL directly — no layer replace needed
  useEffect(() => {
    if (!olLoaded || !xyzSourceRef.current) return;
    const src = xyzSourceRef.current;
    // setUrl + refresh cache triggers an immediate re-render of all tiles
    src.setUrl(BASEMAPS[baseStyle].url);
    src.refresh();
  }, [baseStyle, olLoaded]);

  // ── Draw interaction lifecycle ─────────────────────────────────────────
  useEffect(() => {
    if (!olLoaded || !mapInstanceRef.current || !olCache.current) return;
    if (drawMode === 'off') {
      // Clean up any active draw interaction
      if (drawInteractRef.current) {
        mapInstanceRef.current.removeInteraction(drawInteractRef.current);
        drawInteractRef.current = null;
      }
      return;
    }

    const { Draw, createBox, VectorSource, VectorLayer, Style, Fill, Stroke, toLonLat } = olCache.current;
    const map = mapInstanceRef.current;

    // Draw source/layer (separate from scene footprints)
    const drawSource = new VectorSource();
    const drawLayer  = new VectorLayer({
      source:   drawSource,
      style:    new Style({
        stroke: new Stroke({ color: '#10b981', width: 2 }),
        fill:   new Fill({ color: 'rgba(16,185,129,0.08)' }),
      }),
      zIndex: 10,
    });
    map.addLayer(drawLayer);
    drawLayerRef.current = drawLayer;

    const drawOpts: any = {
      source: drawSource,
      type: drawMode === 'box' ? 'Circle' : 'Polygon',
    };
    if (drawMode === 'box') drawOpts.geometryFunction = createBox();

    const draw = new Draw(drawOpts);
    draw.on('drawend', (evt: any) => {
      const geom      = evt.feature.getGeometry();
      const rawCoords = drawMode === 'box'
        ? geom.getLinearRing(0).getCoordinates()
        : geom.getCoordinates()[0];
      const coords = rawCoords.map((c: number[]) => toLonLat(c) as [number, number]);

      // ── Persist AOI on map — clear previous, add new feature ──
      if (aoiSourceRef.current) {
        aoiSourceRef.current.clear();
        // Clone the geometry into the AOI source so it survives draw layer removal
        const clonedFeature = evt.feature.clone();
        clonedFeature.setGeometry(geom.clone());
        aoiSourceRef.current.addFeature(clonedFeature);
        setHasAoi(true);
        // Zoom map to the AOI extent with padding
        const aoiExtent = aoiSourceRef.current.getExtent();
        if (aoiExtent && isFinite(aoiExtent[0])) {
          mapInstanceRef.current?.getView().fit(aoiExtent, {
            padding: [40, 40, 40, 40],
            maxZoom: 16,
            duration: 600,
          });
        }
      }

      if (onAreaDrawn) onAreaDrawn(coords);
      if (onDrawEnd) onDrawEnd();
    });

    map.addInteraction(draw);
    drawInteractRef.current = draw;

    return () => {
      map.removeInteraction(draw);
      map.removeLayer(drawLayer);
      drawInteractRef.current = null;
      drawLayerRef.current    = null;
    };
  }, [drawMode, olLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync routingPickMode into ref
  useEffect(() => {
    routingPickModeRef.current = routingPickMode;
  }, [routingPickMode]);

  // Sync networkPickMode into ref
  useEffect(() => {
    networkPickModeRef.current = networkPickMode;
  }, [networkPickMode]);

  // ── Suitability pins ───────────────────────────────────────────────────
  useEffect(() => {
    if (!olLoaded || !mapInstanceRef.current || !olCache.current) return;
    const map = mapInstanceRef.current;
    const { VectorSource, VectorLayer, Style, Fill, Stroke, CircleStyle, Text, fromLonLat } = olCache.current;

    // Remove old suitability layer if any
    if (suitabilityLayerRef.current) {
      map.removeLayer(suitabilityLayerRef.current);
      suitabilityLayerRef.current = null;
    }

    const pins = suitabilityPins ?? [];
    if (pins.length === 0) return;

    const src = new VectorSource();
    const layer = new VectorLayer({ source: src, zIndex: 20 });
    map.addLayer(layer);
    suitabilityLayerRef.current = layer;

    (async () => {
      const { default: Feature } = await import('ol/Feature') as any;
      const { default: Point }   = await import('ol/geom/Point') as any;
      pins.forEach((pin, i) => {
        const feat = new Feature(new Point(fromLonLat([pin.lon, pin.lat])));
        const pct = Math.round(pin.score * 100);
        feat.setStyle(new Style({
          image: new CircleStyle({
            radius: 10,
            fill:   new Fill({ color: '#16a34a' }),
            stroke: new Stroke({ color: '#bbf7d0', width: 2 }),
          }),
          text: new Text({
            text: `${i + 1}`,
            fill: new Fill({ color: '#ffffff' }),
            font: 'bold 10px sans-serif',
            offsetY: 0,
          }),
        }));
        feat.set('suitability_label', pin.label);
        feat.set('suitability_score', pct);
        src.addFeature(feat);
      });
    })();
  }, [suitabilityPins, olLoaded]);

  // ── Fly to pin ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!olLoaded || !mapInstanceRef.current || !olCache.current || !flyToPin) return;
    const { fromLonLat } = olCache.current;
    mapInstanceRef.current.getView().animate({
      center: fromLonLat([flyToPin.lon, flyToPin.lat]),
      zoom: flyToPin.zoom ?? 14,
      duration: 700,
    });
  }, [flyToPin, olLoaded]);

  // ── Alert event markers layer ───────────────────────────────────────────
  useEffect(() => {
    if (!olLoaded || !mapInstanceRef.current || !olCache.current) return;
    const map = mapInstanceRef.current;
    const { VectorSource, VectorLayer, Style, Fill, Stroke, CircleStyle, fromLonLat } = olCache.current;

    // Remove old alert markers layer
    map.getLayers().forEach((lyr: any) => {
      if (lyr?.get?.('alert_markers')) map.removeLayer(lyr);
    });

    if (!alertEventMarkers || alertEventMarkers.length === 0) return;

    const colorMap: Record<string, string> = {
      critical: '#ef4444',
      warning: '#f59e0b',
      info: '#6b7280',
    };

    const src = new VectorSource();
    const lyr = new VectorLayer({ source: src, zIndex: 70 });
    lyr.set('alert_markers', true);
    map.addLayer(lyr);

    (async () => {
      const { default: Feature } = await import('ol/Feature') as any;
      const { default: Point }   = await import('ol/geom/Point') as any;
      alertEventMarkers.forEach(m => {
        const feat = new Feature(new Point(fromLonLat([m.lon, m.lat])));
        const color = colorMap[m.severity] ?? '#6b7280';
        feat.setStyle(new Style({
          image: new CircleStyle({
            radius: m.severity === 'critical' ? 10 : m.severity === 'warning' ? 8 : 6,
            fill: new Fill({ color: color + 'cc' }),
            stroke: new Stroke({ color: '#fff', width: 1.5 }),
          }),
        }));
        feat.set('alert_label', m.label);
        src.addFeature(feat);
      });
    })();
  }, [alertEventMarkers, olLoaded]);

  // ── Routing layer (start/end pins + path line) ─────────────────────────
  useEffect(() => {
    if (!olLoaded || !mapInstanceRef.current || !olCache.current) return;
    const map = mapInstanceRef.current;
    const { VectorSource, VectorLayer, Style, Fill, Stroke, CircleStyle, Text, fromLonLat } = olCache.current;

    // Remove old routing layer
    if (routingLayerRef.current) {
      map.removeLayer(routingLayerRef.current);
      routingLayerRef.current = null;
    }
    if (!routingStartPoint && !routingEndPoint && !routingPath) return;

    const src = new VectorSource();
    const layer = new VectorLayer({ source: src, zIndex: 22 });
    map.addLayer(layer);
    routingLayerRef.current = layer;

    (async () => {
      const { default: Feature }    = await import('ol/Feature') as any;
      const { default: Point }      = await import('ol/geom/Point') as any;
      const { default: LineString } = await import('ol/geom/LineString') as any;

      // Start marker
      if (routingStartPoint) {
        const feat = new Feature(new Point(fromLonLat(routingStartPoint)));
        feat.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#16a34a' }),
            stroke: new Stroke({ color: '#bbf7d0', width: 2 }),
          }),
          text: new Text({ text: 'A', fill: new Fill({ color: '#fff' }), font: 'bold 9px sans-serif' }),
        }));
        src.addFeature(feat);
      }

      // End marker
      if (routingEndPoint) {
        const feat = new Feature(new Point(fromLonLat(routingEndPoint)));
        feat.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#dc2626' }),
            stroke: new Stroke({ color: '#fecaca', width: 2 }),
          }),
          text: new Text({ text: 'B', fill: new Fill({ color: '#fff' }), font: 'bold 9px sans-serif' }),
        }));
        src.addFeature(feat);
      }

      // Path line
      if (routingPath && routingPath.length >= 2) {
        const coords = routingPath.map(([lon, lat]) => fromLonLat([lon, lat]));
        const lineFeat = new Feature(new LineString(coords));
        lineFeat.setStyle(new Style({
          stroke: new Stroke({ color: '#22d3ee', width: 3, lineDash: [8, 4] }),
        }));
        src.addFeature(lineFeat);
        // Fit map to path
        const ext = src.getExtent();
        if (ext && isFinite(ext[0])) {
          map.getView().fit(ext, { padding: [40, 40, 40, 40], duration: 600, maxZoom: 14 });
        }
      }
    })();
  }, [routingStartPoint, routingEndPoint, routingPath, olLoaded]);

  // ── Auto-generated network GeoJSON layer ─────────────────────────────────
  useEffect(() => {
    if (!olLoaded || !mapInstanceRef.current || !olCache.current) return;
    const map = mapInstanceRef.current;
    const { VectorSource, VectorLayer, Style, Fill, Stroke, CircleStyle } = olCache.current;

    if (autoNetworkLayerRef.current) {
      map.removeLayer(autoNetworkLayerRef.current);
      autoNetworkLayerRef.current = null;
    }
    if (!autoNetworkGeojson || !autoNetworkGeojson.features?.length) return;

    const src = new VectorSource();
    const layer = new VectorLayer({
      source: src,
      zIndex: 25,
      style: (feature: any) => {
        const props = feature.getProperties();
        const isNode = props.feature_type === 'node';
        const isWater = props.network_type === 'water';
        if (isNode) {
          const color = props.node_type === 'source' ? '#3b82f6'
            : props.node_type === 'outlet' ? '#ef4444' : '#94a3b8';
          return new Style({
            image: new CircleStyle({
              radius: 5,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: '#fff', width: 1.5 }),
            }),
          });
        }
        // Pipe
        const color = isWater ? '#38bdf8' : '#a78bfa';
        return new Style({
          stroke: new Stroke({ color, width: 2 }),
        });
      },
    });
    map.addLayer(layer);
    autoNetworkLayerRef.current = layer;

    (async () => {
      const { default: Feature }    = await import('ol/Feature') as any;
      const { default: Point }      = await import('ol/geom/Point') as any;
      const { default: LineString } = await import('ol/geom/LineString') as any;
      const { fromLonLat: fll }     = await import('ol/proj') as any;

      for (const f of autoNetworkGeojson.features) {
        let geom: any;
        if (f.geometry.type === 'Point') {
          geom = new Point(fll(f.geometry.coordinates));
        } else if (f.geometry.type === 'LineString') {
          geom = new LineString(f.geometry.coordinates.map((c: number[]) => fll(c)));
        } else continue;
        const feat = new Feature(geom);
        feat.setProperties(f.properties ?? {});
        src.addFeature(feat);
      }

      // Fit map to network extent
      const ext = src.getExtent();
      if (ext && isFinite(ext[0])) {
        map.getView().fit(ext, { padding: [60, 60, 60, 60], duration: 800, maxZoom: 15 });
      }
    })();
  }, [autoNetworkGeojson, olLoaded]);

  // ── Highlight municipality/polygon boundary ───────────────────────────────
  useEffect(() => {    if (!olLoaded || !mapInstanceRef.current || !olCache.current) return;
    const map = mapInstanceRef.current;
    const { VectorSource, VectorLayer, Style, Fill, Stroke } = olCache.current;

    // Remove previous boundary layer
    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }
    if (!highlightBoundary) return;

    (async () => {
      try {
        const GeoJSONFmt: any = (await import('ol/format/GeoJSON')).default;
        const fmt = new GeoJSONFmt();
        const geom = highlightBoundary;
        const fc = geom.type === 'FeatureCollection' ? geom : { type: 'Feature', geometry: geom, properties: {} };
        const feats = fmt.readFeatures(fc, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
        if (!feats.length) return;
        const src = new VectorSource({ features: feats });
        const layer = new VectorLayer({
          source: src,
          style: [
            new Style({ stroke: new Stroke({ color: 'rgba(56,189,248,0.3)', width: 14 }) }),
            new Style({
              stroke: new Stroke({ color: '#38bdf8', width: 2.5, lineDash: [8, 5] }),
              fill: new Fill({ color: 'rgba(56,189,248,0.08)' }),
            }),
          ],
          zIndex: 18,
        });
        map.addLayer(layer);
        boundaryLayerRef.current = layer;
        // Zoom to boundary
        const ext = src.getExtent();
        if (ext && isFinite(ext[0])) {
          map.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 12, duration: 700 });
        }
      } catch { /* skip */ }
    })();
  }, [highlightBoundary, olLoaded]);

  // ── Extraction result layers (per-layer color-coded rendering) ──────────
  useEffect(() => {
    if (!olLoaded || !mapInstanceRef.current || !olCache.current) return;
    const map = mapInstanceRef.current;
    const { VectorSource, VectorLayer, Style, Fill, Stroke } = olCache.current;

    const entries = extractionLayers ?? [];
    const seenKeys = new Set<string>();

    for (const entry of entries) {
      seenKeys.add(entry.layerKey);
      let olLayer = extractionLayerMapRef.current.get(entry.layerKey);

      if (!olLayer) {
        const src = new VectorSource();
        olLayer = new VectorLayer({
          source: src,
          zIndex: 28,
          style: [
            new Style({ stroke: new Stroke({ color: entry.color + '55', width: 8 }) }),
            new Style({
              stroke: new Stroke({ color: entry.color, width: 2 }),
              fill: new Fill({ color: entry.color + '22' }),
            }),
          ],
        });
        map.addLayer(olLayer);
        extractionLayerMapRef.current.set(entry.layerKey, olLayer);
      }

      olLayer.setVisible(entry.visible);

      if (!entry.visible) continue;
      const src = olLayer.getSource();
      src.clear();
      if (!entry.geojson?.features?.length) continue;

      (async () => {
        try {
          const GeoJSONFmt: any = (await import('ol/format/GeoJSON')).default;
          const fmt = new GeoJSONFmt();
          const feats = fmt.readFeatures(entry.geojson, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
          src.addFeatures(feats);
        } catch { /* skip malformed */ }
      })();
    }

    // Remove OL layers for extraction layers no longer present
    extractionLayerMapRef.current.forEach((olLayer, key) => {
      if (!seenKeys.has(key)) {
        map.removeLayer(olLayer);
        extractionLayerMapRef.current.delete(key);
      }
    });
  }, [extractionLayers, olLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── engineering:preview-geojson / clear-preview ─────────────────────────  // Listens globally so that file uploads via AssetTopBar show on this map.
  useEffect(() => {
    if (!olLoaded || !mapInstanceRef.current || !olCache.current) return;
    const map = mapInstanceRef.current;
    const { VectorSource, VectorLayer, Style, Fill, Stroke } = olCache.current;

    let lastFc: any = null;

    const renderPreview = async (fc: any) => {
      if (!fc || !Array.isArray(fc.features)) return;
      lastFc = fc;
      // Remove old preview layer
      if (previewLayerRef.current) {
        map.removeLayer(previewLayerRef.current);
        previewLayerRef.current = null;
      }
      try {
        const GeoJSONFmt: any = (await import('ol/format/GeoJSON')).default;
        const fmt = new GeoJSONFmt();
        const feats = fmt.readFeatures(fc, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
        if (!feats.length) return;
        const src = new VectorSource({ features: feats });
        const layer = new VectorLayer({
          source: src,
          style: [
            new Style({ stroke: new Stroke({ color: 'rgba(250,204,21,0.35)', width: 10 }) }),
            new Style({
              stroke: new Stroke({ color: '#facc15', width: 2.5 }),
              fill: new Fill({ color: 'rgba(250,204,21,0.12)' }),
            }),
          ],
          zIndex: 25,
        });
        map.addLayer(layer);
        previewLayerRef.current = layer;
        // Fit map to preview
        const ext = src.getExtent();
        if (ext && isFinite(ext[0])) {
          map.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 16, duration: 600 });
        }
      } catch { /* skip */ }
    };

    const handlePreview = (ev: Event) => {
      const custom = ev as CustomEvent;
      const fc = custom.detail?.featureCollection || custom.detail?.geojson;
      if (fc) renderPreview(fc);
    };

    const handleClear = () => {
      if (previewLayerRef.current) {
        map.removeLayer(previewLayerRef.current);
        previewLayerRef.current = null;
      }
      lastFc = null;
    };

    window.addEventListener('engineering:preview-geojson', handlePreview as EventListener);
    window.addEventListener('engineering:clear-preview', handleClear as EventListener);
    return () => {
      window.removeEventListener('engineering:preview-geojson', handlePreview as EventListener);
      window.removeEventListener('engineering:clear-preview', handleClear as EventListener);
    };
  }, [olLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ───────────────────────────────────────────────────────────────
  // Map fills the entire parent container.
  return (
    <div className="relative w-full h-full" dir="ltr">

      {/* OpenLayers map target */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Loading overlay */}
      {!olLoaded && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-10">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mb-2" />
          <p className="text-xs text-slate-400">جاري تحميل الخريطة…</p>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-10">
          <Layers className="w-7 h-7 text-slate-600 mb-2" />
          <p className="text-xs text-red-400 text-center px-6">{error}</p>
        </div>
      )}

      {/* Basemap label — passive indicator only, control is in the ribbon */}
      {olLoaded && (
        <div className="absolute bottom-10 right-2 z-10 pointer-events-none">
          <span className="text-xs text-slate-400 bg-slate-900/75 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-700/30">
            {BASEMAPS[baseStyle]?.label ?? baseStyle}
          </span>
        </div>
      )}

      {/* Draw hint — shown while a draw mode is active */}
      {olLoaded && drawMode !== 'off' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="text-sm text-emerald-400 font-semibold bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow border border-emerald-700/40 animate-pulse">
            {drawMode === 'box' ? 'ارسم مستطيلاً على الخريطة…' : 'انقر لتحديد نقاط المضلع، انقر مرتين للإنهاء…'}
          </span>
        </div>
      )}

      {/* AOI badge — shown after area is drawn */}
      {olLoaded && drawMode === 'off' && hasAoi && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="text-xs text-emerald-300 font-bold bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg border border-emerald-700/50 flex items-center gap-1.5"
            style={{ animation: 'pulse 2s ease-in-out infinite' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            منطقة العمل النشطة
          </span>
        </div>
      )}
    </div>
  );
}
