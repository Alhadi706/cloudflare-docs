'use client';
/**
 * CommandCenterMap — خريطة OpenLayers نظيفة لمركز القيادة
 * ════════════════════════════════════════════════════════
 * بدون أي واجهة داخلية — كل شيء يُتحكم به من الخارج عبر ref.
 * لا تتعارض مع panels المركز.
 */

import React, {
  useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState
} from 'react';

if (typeof window !== 'undefined') {
  try { require('ol/ol.css'); } catch { /**/ }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CCDrawMode = 'none' | 'Point' | 'LineString' | 'Polygon' | 'Circle' | 'Box';

export interface AlertMarker {
  id: string;
  lat: number;
  lon: number;
  severity: 'CRITICAL' | 'ALERT' | 'WARNING' | 'WATCH';
  title: string;
}

export interface TargetFeature {
  id: string | number;
  name: string;
  lat: number;
  lon: number;
  geometry?: any;    // GeoJSON geometry
  status?: string;
  selected?: boolean;
}

export interface CCMapHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
  setBasemap: (type: 'satellite' | 'osm' | 'dark') => void;
  setDrawMode: (mode: CCDrawMode) => void;
  clearDraw: () => void;
  undo: () => void;
  redo: () => void;
  highlightTarget: (id: string | number) => void;
  setAlerts: (alerts: AlertMarker[]) => void;
  setTargets: (targets: TargetFeature[]) => void;
  getDrawnGeoJSON: () => any;
}

// ─── Severity colours ─────────────────────────────────────────────────────────
const SEV_FILL: Record<string, string> = {
  CRITICAL: 'rgba(239,68,68,0.35)',
  ALERT:    'rgba(249,115,22,0.35)',
  WARNING:  'rgba(234,179,8,0.35)',
  WATCH:    'rgba(59,130,246,0.25)',
};
const SEV_STROKE: Record<string, string> = {
  CRITICAL: '#ef4444',
  ALERT:    '#f97316',
  WARNING:  '#eab308',
  WATCH:    '#3b82f6',
};

// ─── Component ────────────────────────────────────────────────────────────────

const CommandCenterMap = forwardRef<CCMapHandle, {
  onTargetClick?: (id: string | number) => void;
  onMapClick?: (lat: number, lon: number) => void;
}>(function CommandCenterMap({ onTargetClick, onMapClick }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const viewRef      = useRef<any>(null);
  const basemapRef   = useRef<any>(null);
  const alertsLyr    = useRef<any>(null);
  const targetsLyr   = useRef<any>(null);
  const drawLyr      = useRef<any>(null);
  const drawInteract = useRef<any>(null);
  const drawHistory  = useRef<any[]>([]);
  const redoStack    = useRef<any[]>([]);
  const [ready, setReady] = useState(false);

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    let map: any;

    (async () => {
      try {
        const [
          { default: Map    },
          { default: View   },
          { default: TileLayer },
          { default: VectorLayer },
          { default: VectorSource },
          { default: XYZ    },
          { default: OSM    },
          { default: Feature },
          { default: Point   },
          { default: Style   },
          { default: Fill    },
          { default: Stroke  },
          { default: CircleStyle },
          { default: Text    },
          { fromLonLat },
        ] = await Promise.all([
          import('ol/Map'),
          import('ol/View'),
          import('ol/layer/Tile'),
          import('ol/layer/Vector'),
          import('ol/source/Vector'),
          import('ol/source/XYZ'),
          import('ol/source/OSM'),
          import('ol/Feature'),
          import('ol/geom/Point'),
          import('ol/style/Style'),
          import('ol/style/Fill'),
          import('ol/style/Stroke'),
          import('ol/style/Circle'),
          import('ol/style/Text'),
          import('ol/proj'),
        ]);

        // Basemap
        const satSource = new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
        });
        const baseTile = new TileLayer({ source: satSource, zIndex: 0 });
        basemapRef.current = baseTile;

        // Alerts layer
        const alertsSource = new VectorSource();
        const alertsLayer  = new VectorLayer({
          source: alertsSource,
          zIndex: 10,
          style: (feat: any) => {
            const sev = feat.get('severity') || 'WATCH';
            return new Style({
              image: new CircleStyle({
                radius: sev === 'CRITICAL' ? 14 : sev === 'ALERT' ? 12 : 10,
                fill:   new Fill({ color: SEV_FILL[sev] || SEV_FILL.WATCH }),
                stroke: new Stroke({ color: SEV_STROKE[sev] || '#3b82f6', width: 2 }),
              }),
              text: new Text({
                text:  sev === 'CRITICAL' ? '⚡' : sev === 'ALERT' ? '!' : '·',
                font:  'bold 11px sans-serif',
                fill:  new Fill({ color: '#fff' }),
                textBaseline: 'middle',
              }),
            });
          },
        });
        alertsLyr.current = alertsLayer;

        // Targets layer
        const targetsSource = new VectorSource();
        const targetsLayer  = new VectorLayer({
          source: targetsSource,
          zIndex: 8,
          style: (feat: any) => {
            const selected = feat.get('selected');
            const status   = feat.get('status') || 'NORMAL';
            const colors: Record<string, string> = {
              CRITICAL: '#ef4444', ALERT: '#f97316',
              WARNING: '#eab308', NORMAL: '#22c55e',
            };
            const c = colors[status] || '#94a3b8';
            return new Style({
              image: new CircleStyle({
                radius: selected ? 9 : 7,
                fill:   new Fill({ color: `${c}40` }),
                stroke: new Stroke({ color: c, width: selected ? 3 : 1.5 }),
              }),
              text: new Text({
                text:         feat.get('name') || '',
                font:         '11px Tajawal, sans-serif',
                fill:         new Fill({ color: '#fff' }),
                stroke:       new Stroke({ color: '#00000080', width: 2 }),
                offsetY:      -16,
                overflow:     true,
              }),
            });
          },
        });
        targetsLyr.current = targetsLayer;

        // Draw layer
        const drawSource = new VectorSource();
        const drawLayer  = new VectorLayer({
          source: drawSource,
          zIndex: 15,
          style: new Style({
            fill:   new Fill({ color: 'rgba(6,182,212,0.15)' }),
            stroke: new Stroke({ color: '#06b6d4', width: 2, lineDash: [6, 3] }),
            image: new CircleStyle({
              radius: 5,
              fill:   new Fill({ color: '#06b6d4' }),
            }),
          }),
        });
        drawLyr.current = drawLayer;

        // View
        const view = new View({
          center: fromLonLat([17.0, 27.0]),
          zoom: 5,
          minZoom: 3,
          maxZoom: 19,
        });
        viewRef.current = view;

        // Map
        map = new Map({
          target:  containerRef.current!,
          layers:  [baseTile, targetsLayer, alertsLayer, drawLayer],
          view,
          controls: [], // NO internal controls
        });
        mapRef.current = map;

        // Click handler
        map.on('click', (evt: any) => {
          const { fromLonLat: _f, toLonLat } = require('ol/proj');
          const [lon, lat] = toLonLat(evt.coordinate);
          onMapClick?.(lat, lon);

          // Check if clicked on a feature
          map.forEachFeatureAtPixel(evt.pixel, (feat: any, layer: any) => {
            if (layer === targetsLayer) {
              const id = feat.get('targetId');
              if (id != null) onTargetClick?.(id);
            }
            if (layer === alertsLayer) {
              const id = feat.get('alertId');
              if (id != null) onTargetClick?.(id);
            }
          }, { hitTolerance: 8 });
        });

        setReady(true);
      } catch (err) {
        console.error('CommandCenterMap init error:', err);
      }
    })();

    return () => {
      map?.setTarget(undefined);
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Imperative API ──────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lon: number, zoom = 13) {
      const view = viewRef.current;
      if (!view) return;
      import('ol/proj').then(({ fromLonLat }) => {
        view.animate({ center: fromLonLat([lon, lat]), zoom, duration: 800 });
      });
    },

    setBasemap(type: 'satellite' | 'osm' | 'dark') {
      const layer = basemapRef.current;
      if (!layer) return;
      import('ol/source/XYZ').then(({ default: XYZ }) =>
        import('ol/source/OSM').then(({ default: OsmSrc }) => {
          const src =
            type === 'satellite'
              ? new XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19 })
              : type === 'dark'
              ? new XYZ({ url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' })
              : new OsmSrc();
          layer.setSource(src);
        })
      );
    },

    setDrawMode(mode: CCDrawMode) {
      const map = mapRef.current;
      if (!map) return;
      // Remove existing draw interaction
      if (drawInteract.current) {
        map.removeInteraction(drawInteract.current);
        drawInteract.current = null;
      }
      if (mode === 'none') return;

    Promise.all([
        import('ol/interaction/Draw'),
      ]).then(([{ default: Draw }]) => {
        const geomType = mode === 'Box' ? 'Circle' : mode;
        const opts: any = {
          source: drawLyr.current?.getSource(),
          type: geomType as any,
        };
        if (mode === 'Box') {
          opts.geometryFunction = require('ol/interaction/Draw').createBox();
          opts.type = 'Circle';
        }
        const draw = new Draw(opts);
        draw.on('drawend', (evt: any) => {
          drawHistory.current.push(evt.feature.clone());
          redoStack.current = [];
        });
        map.addInteraction(draw);
        drawInteract.current = draw;
      });
    },

    clearDraw() {
      drawLyr.current?.getSource()?.clear();
      drawHistory.current = [];
      redoStack.current = [];
    },

    undo() {
      const src = drawLyr.current?.getSource();
      if (!src) return;
      const feats = src.getFeatures();
      if (feats.length > 0) {
        const last = feats[feats.length - 1];
        redoStack.current.push(last.clone());
        src.removeFeature(last);
      }
    },

    redo() {
      const src = drawLyr.current?.getSource();
      if (!src || redoStack.current.length === 0) return;
      const feat = redoStack.current.pop();
      if (feat) src.addFeature(feat);
    },

    highlightTarget(id: string | number) {
      const src = targetsLyr.current?.getSource();
      if (!src) return;
      src.getFeatures().forEach((f: any) => {
        f.set('selected', String(f.get('targetId')) === String(id));
      });
      targetsLyr.current?.changed();
    },

    setAlerts(alerts: AlertMarker[]) {
      const src = alertsLyr.current?.getSource();
      if (!src) return;
      src.clear();
      import('ol/proj').then(({ fromLonLat }) => {
        import('ol/Feature').then(({ default: Feature }) => {
          import('ol/geom/Point').then(({ default: PointGeom }) => {
            alerts.forEach(a => {
              const f = new Feature({
                geometry:  new PointGeom(fromLonLat([a.lon, a.lat])),
                alertId:   a.id,
                severity:  a.severity,
                title:     a.title,
              });
              src.addFeature(f);
            });
          });
        });
      });
    },

    setTargets(targets: TargetFeature[]) {
      const src = targetsLyr.current?.getSource();
      if (!src) return;
      src.clear();
      import('ol/proj').then(({ fromLonLat }) => {
        import('ol/Feature').then(({ default: Feature }) => {
          import('ol/geom/Point').then(({ default: PointGeom }) => {
            targets.forEach(t => {
              const f = new Feature({
                geometry: new PointGeom(fromLonLat([t.lon, t.lat])),
                targetId: t.id,
                name:     t.name,
                status:   t.status || 'NORMAL',
                selected: t.selected || false,
              });
              src.addFeature(f);
            });
          });
        });
      });
    },

    getDrawnGeoJSON() {
      const src = drawLyr.current?.getSource();
      if (!src) return null;
      const feats = src.getFeatures();
      if (!feats.length) return null;
      // Return simple GeoJSON
      return { type: 'FeatureCollection', features: feats.map((f: any) => ({
        type: 'Feature',
        geometry: { type: f.getGeometry().getType(), coordinates: [] },
        properties: {},
      })) };
    },
  }), []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#050c14]">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050c14] z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500/40 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-cyan-500/60 text-xs font-mono tracking-widest">MAP INIT...</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default CommandCenterMap;
