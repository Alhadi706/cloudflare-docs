'use client';
// ─── CorridorMap ───────────────────────────────────────────────────────────────
// Satellite-basemap map with corridor draw, buffer visualization,
// and detection point overlay. Uses OpenLayers via dynamic import (no SSR).
// ──────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Layers, Minus, Plus, RotateCcw, Target, Flame } from 'lucide-react';
import { useGisEngine, getSharedOlMap } from '@/store/gisEngine';

// ── Basemaps ──────────────────────────────────────────────────────────────────
const SAT_URL   = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const LABEL_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const OSM_URL   = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
// Esri World Imagery serves aerial tiles up to zoom 23 in high-res coverage areas.
const MAX_ZOOM     = 23;
// EOX Sentinel-2 Cloudless 2023 — CC BY 4.0 (attribution required), free non-commercial.
// ~10 m native resolution globally. Excellent for desert/rural Libya. Max tile zoom: 15.
// Beyond zoom 15 tiles upscale — useful for corridor positioning, not detail inspection.
const S2_EOX_URL   = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg';
const S2_MAX_ZOOM  = 15;
const OSM_MAX_ZOOM = 19;

type BasemapKey = 'satellite' | 'sentinel2' | 'osm';
const BASEMAP_META: Record<BasemapKey, { label: string; attr: string; maxZoom: number }> = {
  satellite: { label: 'إيزري — صور فضائية',        attr: '© Esri World Imagery',              maxZoom: MAX_ZOOM    },
  sentinel2: { label: 'سنتينيل-2 (EOX 2023)',       attr: '© EOX IT Services, CC BY 4.0',      maxZoom: S2_MAX_ZOOM },
  osm:       { label: 'خريطة OpenStreetMap',        attr: '© OpenStreetMap contributors',      maxZoom: OSM_MAX_ZOOM },
};
const BASEMAP_CYCLE: Record<BasemapKey, BasemapKey> = {
  satellite: 'sentinel2', sentinel2: 'osm', osm: 'satellite',
};

// ── Default center: Libya ─────────────────────────────────────────────────────
const DEFAULT_LON = 13.18;
const DEFAULT_LAT = 32.89;

// ── Detection point types ─────────────────────────────────────────────────────
export type DetectionType = 'leak' | 'encroachment' | 'stress';

export interface DetectionPoint {
  id: string;
  lon: number;
  lat: number;
  type: DetectionType;
  label: string;
  details?: Record<string, any>;
}

// ── MNT-S13.3 Leak Candidate Zone ──────────────────────────────────────────
export type CandidateConfidence = 'weak' | 'moderate' | 'high';

export interface CandidateEvidence {
  type:           string;
  description_ar: string;
  value?:         number;
  years?:         number[];
  note?:          string;
}

// MNT-S13.8 — Emission point from satellite analysis
export interface EmissionPoint {
  point_id?:           string;
  lon:                 number;
  lat:                 number;
  mndwi_peak?:         number;
  anomaly_score:       number;
  unmixed_water_frac?: number;
  color_code?:         string;
  is_longitudinal?:    boolean;
  description_ar?:     string;
}

export interface CandidateZone {
  candidate_id:            string;
  geometry_polygon:        [number, number][];  // [[lon, lat], ...] closed ring
  center_lat:              number;
  center_lon:              number;
  distance_to_corridor_m:  number;
  first_seen:              string;
  last_seen:               string;
  confidence:              CandidateConfidence;
  precision_level:         string;
  evidence:                CandidateEvidence[];
  score:                   number;
  recommended_action:      string;
  label_ar:                string;
  honest_note:             string;
  anomaly_type:            string;
  patch_id:                number;
  frac_along_corridor:     number;
  temporal_trend?:         string;
}

// MNT-S13.8 — Emission point from satellite spectral analysis
export interface EmissionPoint {
  point_id?:           string;
  lon:                 number;
  lat:                 number;
  mndwi_peak?:         number;
  anomaly_score:       number;
  unmixed_water_frac?: number;
  color_code?:         string;
  is_longitudinal?:    boolean;
  description_ar?:     string;
}

// MNT-S13.8 — Emission marker colors (backend color_code → RGBA)
const EMIT_COLORS: Record<string, string> = {
  'critical-red':  'rgba(220,38,38,0.95)',
  'high-orange':   'rgba(234,88,12,0.95)',
  'medium-yellow': 'rgba(234,179,8,0.92)',
  'flow-blue':     'rgba(37,99,235,0.88)',
  RED:    'rgba(220,38,38,0.95)',
  ORANGE: 'rgba(234,88,12,0.95)',
  YELLOW: 'rgba(234,179,8,0.92)',
  BLUE:   'rgba(37,99,235,0.88)',
};

const ZONE_STYLE: Record<CandidateConfidence, { fill: string; stroke: string; width: number }> = {
  high:     { fill: 'rgba(239,68,68,0.22)',  stroke: '#ef4444', width: 2.5 },
  moderate: { fill: 'rgba(245,158,11,0.18)', stroke: '#f59e0b', width: 2.0 },
  weak:     { fill: 'rgba(59,130,246,0.14)', stroke: '#60a5fa', width: 1.5 },
};
// MNT-S13.4 — selected state: stronger fill + thicker border
const ZONE_STYLE_SEL: Record<CandidateConfidence, { fill: string; stroke: string; width: number }> = {
  high:     { fill: 'rgba(239,68,68,0.55)',  stroke: '#fca5a5', width: 4.5 },
  moderate: { fill: 'rgba(245,158,11,0.50)', stroke: '#fde68a', width: 4.0 },
  weak:     { fill: 'rgba(59,130,246,0.45)', stroke: '#93c5fd', width: 3.5 },
};

export interface CorridorData {
  id: string;
  name: string;
  coords: [number, number][];  // [lon, lat] pairs
  bufferMeters: number;
}

export interface CorridorMapHandle {
  fitToCorridor: () => void;
  clearDraw: () => void;
  focusPoint: (lat: number, lon: number, zoom?: number) => void;
  focusZone: (zone: CandidateZone) => void;
  /** MNT-S13.8-OPS: fly to source point at high zoom for field targeting */
  focusFieldTarget: (lat: number, lon: number, label?: string) => void;
  /** MNT-S13.9: fit view to show ALL candidate zones simultaneously */
  fitToAllZones: () => void;
  setHeatmapVisible: (v: boolean) => void;
  getMapSnapshot: () => string | null;
}

interface CorridorMapProps {
  corridor:        CorridorData | null;
  detections:      DetectionPoint[];
  drawActive:      boolean;
  onCorridorDrawn: (coords: [number, number][]) => void;
  onPointClick:    (pt: DetectionPoint) => void;
  // MNT-S13.3 zone polygons
  candidateZones?: CandidateZone[];
  onZoneClick?:    (zone: CandidateZone) => void;
  selectedDetectionId?: string;
  selectedZoneId?:      string;
  // MNT-S13.8 heatmap
  emissionPoints?:       EmissionPoint[];
  showHeatmap?:          boolean;
  temporalYear?:         number | null;
  slideshowHighlightId?: string | null;
  /** MNT-S13.8-OPS: activate field targeting mode (3-layer display) */
  fieldTargetingMode?:   boolean;
}

// ── Detection colours ─────────────────────────────────────────────────────────
const DET_COLORS: Record<DetectionType, { fill: string; stroke: string }> = {
  leak:          { fill: 'rgba(59,130,246,0.85)',  stroke: '#93c5fd' },
  encroachment:  { fill: 'rgba(239,68,68,0.85)',   stroke: '#fca5a5' },
  stress:        { fill: 'rgba(234,179,8,0.85)',   stroke: '#fde68a' },
};

// ── Geometry QA helpers (no deps) ───────────────────────────────────────────
function approxPolyAreaM2(poly: [number, number][]): number {
  if (poly.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    area += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  area = Math.abs(area) / 2;
  return area * 111320 * Math.cos(32 * Math.PI / 180) * 111320;
}
function pointInPoly(lon: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

export const CorridorMap = forwardRef<CorridorMapHandle, CorridorMapProps>(
  function CorridorMap({ corridor, detections, drawActive, onCorridorDrawn, onPointClick, candidateZones, onZoneClick, selectedDetectionId, selectedZoneId, emissionPoints, showHeatmap = false, temporalYear, slideshowHighlightId, fieldTargetingMode = false }, ref) {
    const olMapReady    = useGisEngine(s => s.olMapReady);
    const gisBasemap    = useGisEngine(s => s.basemap);
    const setGisBasemap = useGisEngine(s => s.setBasemap);
    // Map gisEngine basemap key → local display key
    const basemap: BasemapKey = gisBasemap === 'ndvi' ? 'sentinel2' : gisBasemap === 'satellite' ? 'satellite' : 'osm';
    const mapRef        = useRef<any>(null);
    const lineSourceRef = useRef<any>(null);
    const bufSourceRef  = useRef<any>(null);
    const detSourceRef  = useRef<any>(null);
    const zoneSourceRef = useRef<any>(null);
    const heatSrcRef    = useRef<any>(null);   // heatmap vector source
    const emitSrcRef    = useRef<any>(null);   // emission marker source
    const heatLayerRef  = useRef<any>(null);   // ol/layer/Heatmap
    const emitLayerRef  = useRef<any>(null);   // emission VectorLayer
    const leakCenterSrcRef   = useRef<any>(null);  // estimated leak center
    const leakCenterLayerRef = useRef<any>(null);
    const animTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);   // zone breathing
    const emitAnimTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);  // emit pulse
    const leakCenterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);  // halo pulse
    const labLayerRef   = useRef<any>(null);
    const drawIntRef    = useRef<any>(null);
    const styleRef      = useRef<any>(null);
    // Stale-closure guards
    const candidateZonesRef       = useRef<CandidateZone[]>([]);
    const onZoneClickRef          = useRef<((z: CandidateZone) => void) | undefined>(undefined);
    const selectedDetIdRef        = useRef<string | null>(null);
    const selectedZoneIdRef       = useRef<string | null>(null);
    const slideshowHighlightIdRef = useRef<string | null>(null);
    // MNT-S13.8-OPS: field targeting layers
    const zoneLayerRef        = useRef<any>(null);
    const wetPolyLayerRef     = useRef<any>(null);
    const sourcePointSrcRef   = useRef<any>(null);
    const sourcePointLayerRef = useRef<any>(null);
    const inspRadiusSrcRef    = useRef<any>(null);
    const inspRadiusLayerRef  = useRef<any>(null);
    const sourceAnimTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

    const [ready,        setReady]        = useState(false);
    const [focusLabel,   setFocusLabel]   = useState<string | null>(null);
    const [mapError,     setMapError]     = useState<string | null>(null);
    const [showLabels,   setShowLabels]   = useState(true);
    const [zoomLevel,    setZoomLevel]    = useState<number>(9);
    const [localHeatmap, setLocalHeatmap] = useState(showHeatmap);
    const [emitTooltip,  setEmitTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
    const fromLonLatRef = useRef<((c: [number, number]) => number[]) | null>(null);

    // ─── Init OL ───────────────────────────────────────────────────────────────
    useEffect(() => {
      let cancelled = false;

      // ─── Attach corridor layers to the shared OL map ─────────────────────────
      if (!olMapReady) return;
      const map = getSharedOlMap();
      if (!map) return;

      const attachedLayers: any[] = [];
      let clickHandler: any    = null;
      let pointerMoveHandler: any = null;
      let zoomHandler: any     = null;

      async function attachLayers() {
        try {
          const [
            { default: VectorLayer },
            { default: VectorSource },
            { Style, Fill, Stroke, Circle: CircleStyle },
            { fromLonLat },
            { default: Heatmap },
            { default: TileLayer },
            { default: XYZ },
          ] = await Promise.all([
            import('ol/layer/Vector'),
            import('ol/source/Vector'),
            import('ol/style'),
            import('ol/proj'),
            import('ol/layer/Heatmap'),
            import('ol/layer/Tile'),
            import('ol/source/XYZ'),
          ]);

          if (cancelled) return;

          const { Style: Style2, Fill: Fill2, Stroke: Stroke2,
                  Circle: CircleStyle2, Text, RegularShape } = await import('ol/style') as any;
          styleRef.current = { Style: Style2, Fill: Fill2, Stroke: Stroke2,
                               CircleStyle: CircleStyle2, Text, RegularShape };
          fromLonLatRef.current = fromLonLat;

          // Labels overlay — sits on top of shared basemap
          const lblLayer = new TileLayer({
            source: new XYZ({ url: LABEL_URL, attributions: '© Esri', maxZoom: MAX_ZOOM }),
            opacity: 0.75, zIndex: 62, visible: showLabels,
          });
          labLayerRef.current = lblLayer;

          // Corridor line
          const lineSource = new VectorSource();
          lineSourceRef.current = lineSource;
          const lineLayer = new VectorLayer({
            source: lineSource, zIndex: 71,
            style: new Style({
              stroke: new Stroke({ color: '#f97316', width: 3, lineDash: [10, 4] }),
            }),
          });

          // Buffer polygon
          const bufSource = new VectorSource();
          bufSourceRef.current = bufSource;
          const bufLayer = new VectorLayer({
            source: bufSource, zIndex: 70,
            style: new Style({
              fill:   new Fill({ color: 'rgba(249,115,22,0.10)' }),
              stroke: new Stroke({ color: 'rgba(249,115,22,0.40)', width: 1.5 }),
            }),
          });

          // Candidate zone polygons
          const zoneSource = new VectorSource();
          zoneSourceRef.current = zoneSource;
          const zoneLayer = new VectorLayer({
            source: zoneSource, zIndex: 72,
            style: (feature: any) => {
              const conf: CandidateConfidence = feature.get('zone_conf') ?? 'weak';
              const zid     = feature.get('zone_id');
              const isSel   = selectedZoneIdRef.current === zid;
              const isSlide = slideshowHighlightIdRef.current === zid;
              if (isSlide) {
                const t = (Date.now() % 800) / 800;
                const w = 5 + Math.sin(t * Math.PI * 2) * 2.5;
                return new Style({ fill: new Fill({ color: 'rgba(0,0,0,0)' }), stroke: new Stroke({ color: '#facc15', width: w, lineDash: [6, 3] }) });
              }
              const CONTEXT: Record<CandidateConfidence, { sel: string; normal: string }> = {
                high:     { sel: 'rgba(239,68,68,0.60)',  normal: 'rgba(239,68,68,0.22)'  },
                moderate: { sel: 'rgba(245,158,11,0.55)', normal: 'rgba(245,158,11,0.18)' },
                weak:     { sel: 'rgba(96,165,250,0.50)', normal: 'rgba(96,165,250,0.15)' },
              };
              const cs = CONTEXT[conf];
              return new Style({
                fill:   new Fill({ color: 'rgba(0,0,0,0)' }),
                stroke: new Stroke({ color: isSel ? cs.sel : cs.normal, width: isSel ? 3.0 : 1.0, lineDash: isSel ? [] : [5, 4] }),
              });
            },
          });
          zoneLayerRef.current = zoneLayer;

          const wetPolyLayer = new VectorLayer({
            source: zoneSource, zIndex: 77,
            style: () => new Style({}),
          });
          wetPolyLayerRef.current = wetPolyLayer;

          // Source point markers
          const sourcePointSrc = new VectorSource();
          sourcePointSrcRef.current = sourcePointSrc;
          const sourcePointLayer = new VectorLayer({
            source: sourcePointSrc, zIndex: 80,
            style: (feature: any) => {
              const rank  = feature.get('rank') ?? 1;
              const conf  = feature.get('confidence') ?? 'weak';
              const score = feature.get('score') ?? 0;
              const isTop = rank === 1;
              const t     = (Date.now() % 1200) / 1200;
              const CONF_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
                high:     { fill: '#ef4444', stroke: '#fca5a5', glow: 'rgba(239,68,68,0.25)' },
                moderate: { fill: '#f59e0b', stroke: '#fde68a', glow: 'rgba(245,158,11,0.22)' },
                weak:     { fill: '#60a5fa', stroke: '#bfdbfe', glow: 'rgba(96,165,250,0.20)' },
              };
              const cc = CONF_COLORS[conf] ?? CONF_COLORS.weak;
              const pR = isTop ? 22 + Math.sin(t * Math.PI * 2) * 5 : 18;
              const SR = styleRef.current;
              const styles: any[] = [
                new Style({ image: new CircleStyle({ radius: pR, fill: new Fill({ color: cc.glow }), stroke: new Stroke({ color: isTop ? cc.fill : 'rgba(0,0,0,0)', width: isTop ? 2 : 0 }) }) }),
                new Style({ image: new CircleStyle({ radius: 16, fill: new Fill({ color: `${cc.fill}33` }), stroke: new Stroke({ color: cc.fill, width: 2.5 }) }) }),
                new Style({ image: new CircleStyle({ radius: 10, fill: new Fill({ color: cc.fill }), stroke: new Stroke({ color: '#fff', width: 2.5 }) }) }),
              ];
              if (SR?.Text) {
                styles.push(new Style({ image: new CircleStyle({ radius: 0 }),
                  text: new SR.Text({ text: `${rank}`, font: 'bold 10px sans-serif', fill: new SR.Fill({ color: '#fff' }), stroke: new SR.Stroke({ color: cc.fill, width: 2 }), textAlign: 'center', offsetY: 0.5 }) }));
                styles.push(new Style({ text: new SR.Text({
                  text: isTop ? `⭐ ${score.toFixed(1)}` : `${score.toFixed(1)}`,
                  font: `bold ${isTop ? 11 : 10}px sans-serif`,
                  fill: new SR.Fill({ color: cc.stroke }),
                  stroke: new SR.Stroke({ color: 'rgba(0,0,0,0.9)', width: 3 }),
                  offsetY: 30, textAlign: 'center',
                }) }));
              }
              return styles;
            },
          });
          sourcePointLayerRef.current = sourcePointLayer;

          // Inspection radius
          const inspRadiusSrc = new VectorSource();
          inspRadiusSrcRef.current = inspRadiusSrc;
          const inspRadiusLayer = new VectorLayer({
            source: inspRadiusSrc, zIndex: 78,
            style: (feature: any) => {
              const view = mapRef.current?.getView();
              const zoom = view ? view.getZoom() ?? 0 : 0;
              if (zoom < 15) return new Style({});
              const SR = styleRef.current;
              const styles: any[] = [
                new Style({ fill: new Fill({ color: 'rgba(251,191,36,0.08)' }), stroke: new Stroke({ color: '#fbbf24', width: 1.8, lineDash: [5, 4] }) }),
              ];
              if (SR?.Text && zoom >= 16) {
                styles.push(new Style({ text: new SR.Text({ text: 'نطاق الفحص — 30م', font: '10px sans-serif', fill: new SR.Fill({ color: '#fde68a' }), stroke: new SR.Stroke({ color: 'rgba(0,0,0,0.8)', width: 3 }), overflow: true, placement: 'point' }) }));
              }
              return styles;
            },
          });
          inspRadiusLayerRef.current = inspRadiusLayer;

          // Detection points
          const detSource = new VectorSource();
          detSourceRef.current = detSource;
          const detLayer = new VectorLayer({
            source: detSource, zIndex: 73,
            style: (feature: any) => {
              const type: DetectionType = feature.get('det_type') ?? 'stress';
              const { fill, stroke } = DET_COLORS[type];
              const isSel = selectedDetIdRef.current === feature.get('det_id');
              return new Style({
                image: new CircleStyle({
                  radius: isSel ? 13 : 8,
                  fill:   new Fill({ color: fill }),
                  stroke: new Stroke({ color: isSel ? '#ffffff' : stroke, width: isSel ? 3 : 2 }),
                }),
              });
            },
          });

          // Heatmap
          const heatSource = new VectorSource();
          heatSrcRef.current = heatSource;
          const heatLayer = new (Heatmap as any)({
            source: heatSource, blur: 28, radius: 18,
            weight: (f: any) => f.get('weight') ?? 0.5,
            gradient: ['#1e3a8a','#1d4ed8','#06b6d4','#10b981','#84cc16','#facc15','#f97316','#ef4444','#7f1d1d'],
            zIndex: 69, visible: showHeatmap,
          });
          heatLayerRef.current = heatLayer;

          // Emission markers
          const emitSource = new VectorSource();
          emitSrcRef.current = emitSource;
          const emitLayer = new VectorLayer({
            source: emitSource, zIndex: 74, visible: showHeatmap,
            style: (feature: any) => {
              const score  = feature.get('anomaly_score') ?? 0.5;
              const code   = feature.get('color_code') ?? 'flow-blue';
              const fill   = EMIT_COLORS[code] ?? EMIT_COLORS['flow-blue'];
              const baseR  = Math.max(5, Math.round(score * 16));
              const isHigh = score >= 0.5;
              const pulse  = isHigh ? Math.sin((Date.now() % 1400) / 1400 * Math.PI * 2) * 3 : 0;
              return new Style({
                image: new CircleStyle({
                  radius: Math.max(4, baseR + pulse),
                  fill:   new Fill({ color: fill }),
                  stroke: new Stroke({ color: isHigh ? '#ffffff' : 'rgba(255,255,255,0.55)', width: isHigh ? 2.5 : 1.5 }),
                }),
              });
            },
          });
          emitLayerRef.current = emitLayer;

          // Estimated leak center
          const leakCenterSrc = new VectorSource();
          leakCenterSrcRef.current = leakCenterSrc;
          const leakCenterLayer = new VectorLayer({
            source: leakCenterSrc, zIndex: 76, visible: showHeatmap,
            style: () => {
              const SR = styleRef.current;
              const t  = (Date.now() % 900) / 900;
              const hR = 18 + Math.sin(t * Math.PI * 2) * 7;
              const items: any[] = [
                new Style({ image: new CircleStyle({ radius: hR + 6, fill: new Fill({ color: 'rgba(239,68,68,0.10)' }), stroke: new Stroke({ color: 'rgba(239,68,68,0.30)', width: 1.5 }) }) }),
                new Style({ image: new CircleStyle({ radius: hR,     fill: new Fill({ color: 'rgba(239,68,68,0.18)' }), stroke: new Stroke({ color: '#ef4444', width: 2.5 }) }) }),
                new Style({ image: new CircleStyle({ radius: 7,      fill: new Fill({ color: '#ef4444' }),             stroke: new Stroke({ color: '#ffffff', width: 2.5 }) }) }),
              ];
              if (SR?.Text) {
                items.push(new Style({ text: new SR.Text({ text: 'مصدر التسريب المقدّر', font: 'bold 11px sans-serif', fill: new SR.Fill({ color: '#fca5a5' }), stroke: new SR.Stroke({ color: 'rgba(0,0,0,0.85)', width: 3 }), offsetY: 30, textAlign: 'center' }) }));
              }
              return items;
            },
          });
          leakCenterLayerRef.current = leakCenterLayer;

          // Add all corridor-specific layers to the shared map
          const myLayers = [lblLayer, bufLayer, lineLayer, zoneLayer, wetPolyLayer,
                            detLayer, heatLayer, emitLayer, leakCenterLayer,
                            inspRadiusLayer, sourcePointLayer];
          myLayers.forEach(l => map.addLayer(l));
          attachedLayers.push(...myLayers);

          if (cancelled) {
            myLayers.forEach(l => { try { map.removeLayer(l); } catch {} });
            return;
          }

          mapRef.current = map;

          // Track live zoom level for UI badge
          const view = map.getView();
          zoomHandler = () => {
            const z = view.getZoom();
            if (z !== undefined) setZoomLevel(Math.round(z * 10) / 10);
          };
          view.on('change:resolution', zoomHandler);
          const initialZ = view.getZoom();
          if (initialZ !== undefined) setZoomLevel(Math.round(initialZ * 10) / 10);

          // Click → detection / zone / emit tooltip
          clickHandler = (evt: any) => {
            const feat = map.forEachFeatureAtPixel(evt.pixel, (f: any) => f, { hitTolerance: 8 });
            if (!feat) { setEmitTooltip(null); return; }
            const detId = feat.get('det_id');
            if (detId) { const pt = detections.find(d => d.id === detId); if (pt) onPointClick(pt); }
            const zoneId = feat.get('zone_id');
            if (zoneId && onZoneClickRef.current) {
              const zone = candidateZonesRef.current.find(z => z.candidate_id === zoneId);
              if (zone) onZoneClickRef.current(zone);
            }
            const descAr = feat.get('description_ar');
            const score  = feat.get('anomaly_score');
            if (descAr || score != null) {
              const px = evt.pixel as [number, number];
              setEmitTooltip({ text: descAr ?? `شذوذ ${Math.round((score ?? 0) * 100)}٪`, x: px[0], y: px[1] });
            }
          };
          pointerMoveHandler = (evt: any) => {
            const hit = map.hasFeatureAtPixel(evt.pixel, { hitTolerance: 8 });
            const targetEl = map.getTargetElement() as HTMLElement;
            if (targetEl) targetEl.style.cursor = hit ? 'pointer' : '';
          };
          map.on('singleclick', clickHandler);
          map.on('pointermove', pointerMoveHandler);

          setReady(true);
        } catch (e: any) {
          if (!cancelled) setMapError(e.message ?? 'Layer init failed');
        }
      }

      attachLayers();
      return () => {
        cancelled = true;
        attachedLayers.forEach(l => { try { map.removeLayer(l); } catch {} });
        if (clickHandler)      map.un('singleclick', clickHandler);
        if (pointerMoveHandler) map.un('pointermove', pointerMoveHandler);
        if (zoomHandler)       map.getView()?.un('change:resolution', zoomHandler);
        mapRef.current = null;
        setReady(false);
      };
    }, [olMapReady]); // eslint-disable-line

    // ─── Toggle labels ─────────────────────────────────────────────────────────
    useEffect(() => {
      labLayerRef.current?.setVisible(showLabels);
    }, [showLabels]);

    // ─── Draw interaction ──────────────────────────────────────────────────────
    useEffect(() => {
      if (!ready || !mapRef.current) return;
      let cancelled = false;

      async function toggleDraw() {
        const map = mapRef.current;
        // Remove existing draw interaction
        if (drawIntRef.current) { map.removeInteraction(drawIntRef.current); drawIntRef.current = null; }
        if (!drawActive) return;

        const { default: Draw }         = await import('ol/interaction/Draw');
        const { default: VectorSource } = await import('ol/source/Vector');
        const { Style, Stroke, Fill }   = await import('ol/style');
        const { toLonLat }              = await import('ol/proj');

        if (cancelled) return;

        const drawSource = new VectorSource();
        const drawInt = new Draw({
          source: drawSource,
          type: 'LineString',
          style: new Style({
            stroke: new Stroke({ color: '#f97316', width: 2.5, lineDash: [6, 4] }),
            fill:   new Fill({ color: 'rgba(249,115,22,0.15)' }),
          }),
        });

        drawInt.on('drawend', (evt: any) => {
          const coords3857 = evt.feature.getGeometry().getCoordinates();
          const lonLat: [number, number][] = coords3857.map((c: number[]) => {
            const ll = toLonLat(c);
            return [ll[0], ll[1]] as [number, number];
          });
          onCorridorDrawn(lonLat);
          // Remove draw after one stroke
          setTimeout(() => map.removeInteraction(drawInt), 50);
        });

        map.addInteraction(drawInt);
        drawIntRef.current = drawInt;

        // Fly to Libya if no corridor is loaded yet (so the user can draw)
        if (!lineSourceRef.current?.getFeatures()?.length) {
          const { fromLonLat: fl2 } = await import('ol/proj');
          map.getView().animate({
            center: fl2([DEFAULT_LON, DEFAULT_LAT]),
            zoom: 8,
            duration: 600,
          });
        }
      }

      toggleDraw();
      return () => { cancelled = true; };
    }, [drawActive, ready]); // eslint-disable-line

    // ─── Render corridor line + buffer when corridor changes ───────────────────
    useEffect(() => {
      if (!ready || !lineSourceRef.current) return;

      (async () => {
        const { default: Feature }    = await import('ol/Feature');
        const { default: LineString } = await import('ol/geom/LineString');
        const { default: Polygon }    = await import('ol/geom/Polygon');
        const { fromLonLat }          = await import('ol/proj');

        lineSourceRef.current.clear();
        bufSourceRef.current.clear();

        if (!corridor || corridor.coords.length < 2) return;

        // ── Draw corridor line ──────────────────────────────────────────────
        const pts3857 = corridor.coords.map(([lon, lat]) => fromLonLat([lon, lat]));
        const line = new LineString(pts3857);
        lineSourceRef.current.addFeature(new Feature({ geometry: line }));

        // ── Auto-fit map to corridor after drawing ──────────────────────────
        if (mapRef.current) {
          const ext = line.getExtent();
          if (ext[0] !== Infinity) {
            mapRef.current.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 13, duration: 900 });
          }
        }

        // ── Buffer approximation (simple perpendicular offset polygon) ──────
        // Use turf-free approach: extend each segment by bufferMeters
        const R = 6371000;
        const buf = corridor.bufferMeters;

        function perpOffset(ax: number, ay: number, bx: number, by: number, d: number): [[number,number],[number,number]] {
          const dx = bx - ax, dy = by - ay;
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len === 0) return [[ax, ay], [bx, by]];
          const nx = -dy/len * d, ny = dx/len * d;
          return [[ax+nx, ay+ny], [bx+nx, by+ny]];
        }

        const left: [number,number][]  = [];
        const right: [number,number][] = [];

        for (let i = 0; i < pts3857.length - 1; i++) {
          const [ax, ay] = pts3857[i];
          const [bx, by] = pts3857[i+1];
          const [lA, lB] = perpOffset(ax, ay, bx, by, buf);
          const [rA, rB] = perpOffset(ax, ay, bx, by, -buf);
          if (i === 0) { left.push(lA); right.push(rA); }
          left.push(lB);
          right.push(rB);
        }

        const ring = [...left, ...[...right].reverse(), left[0]];
        const polygon = new Polygon([ring]);
        bufSourceRef.current.addFeature(new Feature({ geometry: polygon }));
      })();
    }, [corridor, ready]);

    // ─── Render detection points ───────────────────────────────────────────────
    useEffect(() => {
      if (!ready || !detSourceRef.current) return;

      (async () => {
        const { default: Feature } = await import('ol/Feature');
        const { default: Point }   = await import('ol/geom/Point');
        const { fromLonLat }       = await import('ol/proj');

        detSourceRef.current.clear();
        for (const pt of detections) {
          const f = new Feature({ geometry: new Point(fromLonLat([pt.lon, pt.lat])) });
          f.set('det_id', pt.id);
          f.set('det_type', pt.type);
          f.set('label', pt.label);
          detSourceRef.current.addFeature(f);
        }
      })();
    }, [detections, ready]);

    // ── Stale-closure guards ───────────────────────────────────────────────────
    useEffect(() => { candidateZonesRef.current = candidateZones ?? []; }, [candidateZones]);
    useEffect(() => { onZoneClickRef.current    = onZoneClick;           }, [onZoneClick]);
    useEffect(() => {
      slideshowHighlightIdRef.current = slideshowHighlightId ?? null;
      zoneSourceRef.current?.changed();
    }, [slideshowHighlightId]);

    // ── Zone polygons with temporal filter ────────────────────────────────────
    useEffect(() => {
      if (!ready || !zoneSourceRef.current) return;
      (async () => {
        const { default: Feature } = await import('ol/Feature');
        const { default: Polygon } = await import('ol/geom/Polygon');
        const { fromLonLat }       = await import('ol/proj');

        zoneSourceRef.current.clear();
        const filtered = (candidateZones ?? []).filter(zone => {
          if (!temporalYear) return true;
          const fy = parseInt(zone.first_seen) || 0;
          const ly = parseInt(zone.last_seen)  || 9999;
          return fy <= temporalYear && temporalYear <= ly;
        });
        for (const zone of filtered) {
          if (!zone.geometry_polygon || zone.geometry_polygon.length < 3) continue;
          const ring3857 = zone.geometry_polygon.map(([lon, lat]) => fromLonLat([lon, lat]));
          const f = new Feature({ geometry: new Polygon([ring3857]) });
          f.set('zone_id',    zone.candidate_id);
          f.set('zone_conf',  zone.confidence);
          f.set('zone_label', zone.label_ar);
          zoneSourceRef.current.addFeature(f);
        }

        // MNT-S13.9 — auto-fit to all zones when they first load (>0 zones with valid geometry)
        if (filtered.length > 0 && mapRef.current) {
          const src = zoneSourceRef.current;
          const feats = src.getFeatures() as any[];
          if (feats.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            feats.forEach((f: any) => {
              const ext = f.getGeometry()?.getExtent();
              if (!ext || ext[0] === Infinity) return;
              if (ext[0] < minX) minX = ext[0]; if (ext[1] < minY) minY = ext[1];
              if (ext[2] > maxX) maxX = ext[2]; if (ext[3] > maxY) maxY = ext[3];
            });
            if (minX !== Infinity) {
              mapRef.current.getView().fit([minX, minY, maxX, maxY], {
                padding: [80, 80, 80, 80], maxZoom: 16, duration: 950,
              });
            }
          }
        }
      })();
    }, [candidateZones, ready, temporalYear]);

    // ── Emission points → heatmap + marker layers ─────────────────────────────
    useEffect(() => {
      if (!ready || !heatSrcRef.current || !emitSrcRef.current) return;
      (async () => {
        const { default: Feature } = await import('ol/Feature');
        const { default: Point }   = await import('ol/geom/Point');
        const { fromLonLat }       = await import('ol/proj');
        heatSrcRef.current.clear();
        emitSrcRef.current.clear();
        for (const ep of (emissionPoints ?? [])) {
          if (ep.lat < -90 || ep.lat > 90 || ep.lon < -180 || ep.lon > 180) continue;
          const coords = fromLonLat([ep.lon, ep.lat]);
          const hf = new Feature({ geometry: new Point(coords) });
          hf.set('weight', Math.max(0.1, ep.anomaly_score ?? 0.5));
          heatSrcRef.current.addFeature(hf);
          const mf = new Feature({ geometry: new Point(coords) });
          mf.set('anomaly_score',   ep.anomaly_score ?? 0.5);
          mf.set('color_code',      ep.color_code ?? 'flow-blue');
          mf.set('is_longitudinal', ep.is_longitudinal ?? false);
          mf.set('description_ar',  ep.description_ar ?? '');
          emitSrcRef.current.addFeature(mf);
        }
      })();
    }, [emissionPoints, ready]);

    // ── Sync showHeatmap → layer visibility ───────────────────────────────────
    useEffect(() => {
      heatLayerRef.current?.setVisible(showHeatmap);
      emitLayerRef.current?.setVisible(showHeatmap);
      leakCenterLayerRef.current?.setVisible(showHeatmap);
      setLocalHeatmap(showHeatmap);
    }, [showHeatmap]);

    // ── Estimated Leak Center — compute highest-anomaly centroid ──────────────
    useEffect(() => {
      if (!ready || !leakCenterSrcRef.current) return;
      leakCenterSrcRef.current.clear();
      const pts = (emissionPoints ?? []).filter(
        ep => ep.lat >= -90 && ep.lat <= 90 && ep.lon >= -180 && ep.lon <= 180
      );
      if (pts.length === 0) return;
      const sorted = [...pts].sort((a, b) => (b.anomaly_score ?? 0) - (a.anomaly_score ?? 0));
      const peak   = sorted[0];
      let centerLon = peak.lon, centerLat = peak.lat;
      if (sorted.length >= 3) {
        const dists = sorted.map(p => {
          const dlat = p.lat - peak.lat, dlon = p.lon - peak.lon;
          return Math.sqrt(dlat * dlat + dlon * dlon);
        });
        const median    = dists.slice().sort((a, b) => a - b)[Math.floor(dists.length / 2)];
        const threshold = median * 2.0;
        const cluster   = sorted.filter((_, i) => dists[i] <= threshold);
        if (cluster.length >= 2) {
          centerLon = cluster.reduce((s, p) => s + p.lon, 0) / cluster.length;
          centerLat = cluster.reduce((s, p) => s + p.lat, 0) / cluster.length;
        }
      }
      (async () => {
        const { default: Feature } = await import('ol/Feature');
        const { default: Point }   = await import('ol/geom/Point');
        const { fromLonLat }       = await import('ol/proj');
        const f = new Feature({ geometry: new Point(fromLonLat([centerLon, centerLat])) });
        f.set('leak_center', true);
        f.set('peak_score',  peak.anomaly_score);
        leakCenterSrcRef.current.addFeature(f);
      })();
    }, [emissionPoints, ready]);

    // ── Halo animation timer (leak center) ────────────────────────────────────
    useEffect(() => {
      if (leakCenterTimerRef.current) { clearInterval(leakCenterTimerRef.current); leakCenterTimerRef.current = null; }
      if ((emissionPoints ?? []).length === 0 || !showHeatmap || !ready) return;
      leakCenterTimerRef.current = setInterval(() => { leakCenterSrcRef.current?.changed(); }, 45);
      return () => { if (leakCenterTimerRef.current) clearInterval(leakCenterTimerRef.current); };
    }, [emissionPoints, ready, showHeatmap]);

    // ── Breathing animation timer (zone polygons) ─────────────────────────────
    useEffect(() => {
      if (animTimerRef.current) { clearInterval(animTimerRef.current); animTimerRef.current = null; }
      const hasHigh = (candidateZones ?? []).some(z => z.confidence === 'high');
      if (!hasHigh || !ready) return;
      animTimerRef.current = setInterval(() => { zoneSourceRef.current?.changed(); }, 80);
      return () => { if (animTimerRef.current) clearInterval(animTimerRef.current); };
    }, [candidateZones, ready]);

    // ── Pulse animation timer (emission markers) ──────────────────────────────
    useEffect(() => {
      if (emitAnimTimerRef.current) { clearInterval(emitAnimTimerRef.current); emitAnimTimerRef.current = null; }
      const hasHigh = (emissionPoints ?? []).some(ep => (ep.anomaly_score ?? 0) >= 0.5);
      if (!hasHigh || !ready || !showHeatmap) return;
      emitAnimTimerRef.current = setInterval(() => { emitSrcRef.current?.changed(); }, 60);
      return () => { if (emitAnimTimerRef.current) clearInterval(emitAnimTimerRef.current); };
    }, [emissionPoints, ready, showHeatmap]);

    // ─── MNT-S13.8-OPS: Field targeting data (source point + inspection radius) ──
    useEffect(() => {
      if (!ready || !sourcePointSrcRef.current || !inspRadiusSrcRef.current) return;
      (async () => {
        const { default: Feature }    = await import('ol/Feature');
        const { default: Point }      = await import('ol/geom/Point');
        const { default: CircleGeom } = await import('ol/geom/Circle');
        const { fromLonLat }          = await import('ol/proj');

        sourcePointSrcRef.current.clear();
        inspRadiusSrcRef.current.clear();

        const zones  = (candidateZones ?? []);
        const sorted = [...zones].sort((a, b) => b.score - a.score);

        console.group('[LEAK-QA] MNT-S13.8-OPS Field Targeting Geometry Validation');

        sorted.forEach((zone, rank) => {
          const poly      = zone.geometry_polygon ?? [];
          const validPoly = poly.length >= 3 &&
            poly.every(([lon, lat]) => lon > 5 && lon < 35 && lat > 15 && lat < 40);

          // Best source point: highest anomaly emission point, fallback to centroid
          let sourceLon  = zone.center_lon;
          let sourceLat  = zone.center_lat;
          let sourceFrom = 'centroid';
          const emits    = zone.emission_points ?? [];
          if (emits.length > 0) {
            const best = [...emits].sort((a, b) => b.anomaly_score - a.anomaly_score)[0];
            if (best.lon > 5 && best.lon < 35 && best.lat > 15 && best.lat < 40) {
              sourceLon  = best.lon;
              sourceLat  = best.lat;
              sourceFrom = 'emission_peak';
            }
          }

          // QA analysis
          const polyAreaM2  = validPoly ? approxPolyAreaM2(poly) : 0;
          const insidePoly  = validPoly ? pointInPoly(sourceLon, sourceLat, poly) : false;
          const sectorApprox = zone.distance_to_corridor_m * zone.distance_to_corridor_m * Math.PI;

          console.log(`%c[LEAK-QA] #${rank + 1} ${zone.candidate_id}`, 'color:#22d3ee;font-weight:bold');
          console.log(`  sector_rect_area≈${sectorApprox.toFixed(0)}m² | wet_polygon_area≈${polyAreaM2.toFixed(0)}m²`);
          console.log(`  source_point=[${sourceLon.toFixed(6)}, ${sourceLat.toFixed(6)}] from=${sourceFrom}`);
          console.log(`  inside_polygon=${insidePoly} | poly_pts=${poly.length} | valid_coords=${validPoly}`);
          console.log(`  confidence=${zone.confidence} | score=${zone.score.toFixed(2)} | precision=${zone.precision_level}`);
          console.log(`  distance_to_corridor_m=${zone.distance_to_corridor_m.toFixed(1)}`);
          if (!validPoly)   console.warn(`  ⚠️ INVALID POLYGON COORDS`);
          if (!insidePoly && validPoly) console.warn(`  ⚠️ SOURCE OUTSIDE POLYGON — may be misplaced`);

          const coord3857 = fromLonLat([sourceLon, sourceLat]);

          // Source point feature
          const sf = new Feature({ geometry: new Point(coord3857) });
          sf.set('rank',       rank + 1);
          sf.set('confidence', zone.confidence);
          sf.set('zone_id',    zone.candidate_id);
          sf.set('score',      zone.score);
          sf.set('label_ar',   zone.label_ar);
          sf.set('source_from', sourceFrom);
          sf.set('inside_poly', insidePoly);
          sourcePointSrcRef.current.addFeature(sf);

          // Inspection radius: 30m practical field circle
          const rf = new Feature({ geometry: new CircleGeom(coord3857, 30) });
          rf.set('rank',    rank + 1);
          rf.set('zone_id', zone.candidate_id);
          inspRadiusSrcRef.current.addFeature(rf);
        });

        console.groupEnd();
      })();
    }, [candidateZones, ready]);

    // ─── Source point pulse animation ─────────────────────────────────────────
    useEffect(() => {
      if (sourceAnimTimerRef.current) { clearInterval(sourceAnimTimerRef.current); sourceAnimTimerRef.current = null; }
      if ((candidateZones ?? []).length === 0 || !ready) return;
      sourceAnimTimerRef.current = setInterval(() => { sourcePointSrcRef.current?.changed(); }, 55);
      return () => { if (sourceAnimTimerRef.current) clearInterval(sourceAnimTimerRef.current); };
    }, [candidateZones, ready]);

    // ─── Field targeting mode: dim zone layer (wet polygon layer is primary) ──
    useEffect(() => {
      zoneLayerRef.current?.setOpacity(fieldTargetingMode ? 0.15 : 1.0);
    }, [fieldTargetingMode, ready]);

    // ── Exposed handles ───────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      fitToCorridor() {
        if (!mapRef.current || !lineSourceRef.current) return;
        const ext = lineSourceRef.current.getExtent();
        if (ext[0] === Infinity) return;
        mapRef.current.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 19, duration: 600 });
      },
      clearDraw() {
        lineSourceRef.current?.clear();
        bufSourceRef.current?.clear();
      },
      /** S12.3 — animate map to detection/event point */
      focusPoint(lat: number, lon: number, zoom = 15) {
        if (!mapRef.current || !fromLonLatRef.current) return;
        mapRef.current.getView().animate({
          center:   fromLonLatRef.current([lon, lat]),
          zoom,
          duration: 600,
        });
        setFocusLabel('جارٍ التركيز على الموقع');
        setTimeout(() => setFocusLabel(null), 2200);
      },
      /** S13.4 — fit map to candidate zone polygon extent */
      focusZone(zone: CandidateZone) {
        if (!mapRef.current || !fromLonLatRef.current) return;
        const zoomMap: Record<string, number> = {
          'sub-patch-optical': 18, 'patch-level': 17,
          'sector-level': 14,     'corridor-level': 12,
        };
        const targetZoom = zoomMap[zone.precision_level] ?? 15;
        if (zoneSourceRef.current) {
          const feat = (zoneSourceRef.current.getFeatures() as any[])
            .find((f: any) => f.get('zone_id') === zone.candidate_id);
          if (feat) {
            const ext = feat.getGeometry().getExtent();
            if (ext[0] !== Infinity) {
              mapRef.current.getView().fit(ext, {
                padding: [60, 60, 60, 60],
                maxZoom: Math.min(targetZoom + 2, 20),
                duration: 750,
              });
              setFocusLabel('جارٍ التركيز على المنطقة المرشّحة');
              setTimeout(() => setFocusLabel(null), 2200);
              return;
            }
          }
        }
        mapRef.current.getView().animate({
          center:   fromLonLatRef.current([zone.center_lon, zone.center_lat]),
          zoom:     targetZoom,
          duration: 750,
        });
        setFocusLabel('جارٍ التركيز على الموقع');
        setTimeout(() => setFocusLabel(null), 2200);
      },
      /** MNT-S13.8-OPS — fly to precise source point at field targeting zoom */
      focusFieldTarget(lat: number, lon: number, label?: string) {
        if (!mapRef.current || !fromLonLatRef.current) return;
        mapRef.current.getView().animate({
          center:   fromLonLatRef.current([lon, lat]),
          zoom:     19,   // sub-patch optical precision zoom
          duration: 800,
        });
        setFocusLabel(label ?? '🎯 الهدف الميداني');
        setTimeout(() => setFocusLabel(null), 2800);
      },
      /** MNT-S13.9 — fit view to ALL candidate zones so all are visible at once */
      fitToAllZones() {
        if (!mapRef.current || !fromLonLatRef.current) return;
        const src = zoneSourceRef.current;
        if (!src) return;
        const feats = src.getFeatures() as any[];
        if (!feats.length) return;
        // Compute union extent of all zone features
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        feats.forEach((f: any) => {
          const ext = f.getGeometry()?.getExtent();
          if (!ext || ext[0] === Infinity) return;
          if (ext[0] < minX) minX = ext[0];
          if (ext[1] < minY) minY = ext[1];
          if (ext[2] > maxX) maxX = ext[2];
          if (ext[3] > maxY) maxY = ext[3];
        });
        if (minX === Infinity) return;
        mapRef.current.getView().fit([minX, minY, maxX, maxY], {
          padding: [80, 80, 80, 80],
          maxZoom: 16,
          duration: 900,
        });
        setFocusLabel('عرض جميع المناطق المرشّحة');
        setTimeout(() => setFocusLabel(null), 2500);
      },
      setHeatmapVisible(v: boolean) {
        heatLayerRef.current?.setVisible(v);
        emitLayerRef.current?.setVisible(v);
        leakCenterLayerRef.current?.setVisible(v);
        setLocalHeatmap(v);
      },
      getMapSnapshot(): string | null {
        if (!mapRef.current) return null;
        try {
          mapRef.current.renderSync();
          const mapEl   = mapRef.current.getTargetElement() as HTMLElement;
          const canvases = mapEl.querySelectorAll('canvas') as NodeListOf<HTMLCanvasElement>;
          if (!canvases.length) return null;
          const out = document.createElement('canvas');
          out.width = canvases[0].width; out.height = canvases[0].height;
          const ctx = out.getContext('2d')!;
          canvases.forEach(c => { try { ctx.drawImage(c, 0, 0); } catch { /* cross-origin */ } });
          return out.toDataURL('image/png');
        } catch { return null; }
      },
    }));

    // ── Sync selected IDs → OL re-render ─────────────────────────────────────
    useEffect(() => {
      selectedDetIdRef.current = selectedDetectionId ?? null;
      detSourceRef.current?.changed();
    }, [selectedDetectionId]);

    useEffect(() => {
      selectedZoneIdRef.current = selectedZoneId ?? null;
      zoneSourceRef.current?.changed();
    }, [selectedZoneId]);

    // ── Zoom helpers ───────────────────────────────────────────────────────────
    function zoomIn()    { mapRef.current?.getView().setZoom((mapRef.current.getView().getZoom() ?? 10) + 1); }
    function zoomOut()   { mapRef.current?.getView().setZoom((mapRef.current.getView().getZoom() ?? 10) - 1); }
    function resetView() { mapRef.current?.getView().animate({ zoom: 9, duration: 400 }); }
    const precisionMode = zoomLevel >= 16;

    return (
      <div className="relative w-full h-full flex flex-col pointer-events-none">
        {/* Loading */}
        {!ready && !mapError && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 z-50">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">تحميل الخريطة الفضائية…</p>
          </div>
        )}

        {/* Error */}
        {mapError && (
          <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center z-50">
            <div className="text-center">
              <p className="text-red-400 font-semibold">فشل تحميل الخريطة</p>
              <p className="text-xs text-slate-500 mt-1">{mapError}</p>
            </div>
          </div>
        )}

        {/* Draw mode banner */}
        {drawActive && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-orange-500/90 rounded-xl text-white text-sm font-bold shadow-lg animate-pulse pointer-events-none">
            ✏️ انقر على الخريطة لرسم مسار الممر — انقر مرتين للإنهاء
          </div>
        )}

        {/* Focus label */}
        {!drawActive && focusLabel && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-teal-700/90 border border-teal-500/50 rounded-xl text-white text-sm font-semibold shadow-lg pointer-events-none">
            📍 {focusLabel}
          </div>
        )}

        {/* Precision mode badge */}
        {precisionMode && ready && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3 py-1 bg-teal-900/80 border border-teal-500/40 rounded-full text-[10px] text-teal-300 pointer-events-none">
            🔬 وضع الدقة العالية — {zoomLevel.toFixed(1)}×
          </div>
        )}

        {/* Minimal heatmap legend strip */}
        {localHeatmap && (emissionPoints?.length ?? 0) > 0 && (
          <div className="absolute top-12 left-3 z-30 flex flex-col gap-1 items-start pointer-events-none">
            <p className="text-[9px] text-slate-500 flex items-center gap-1">
              <Flame className="w-2.5 h-2.5 text-orange-400" />
              حرارة التسرب
            </p>
            <div className="flex gap-0.5">
              {['#1e3a8a','#06b6d4','#10b981','#facc15','#f97316','#ef4444'].map(c => (
                <div key={c} className="w-4 h-2 rounded-sm" style={{ background: c }} />
              ))}
            </div>
            <span className="text-[9px] text-slate-600">({emissionPoints?.length} نقطة)</span>
          </div>
        )}

        {/* Emit tooltip */}
        {emitTooltip && (
          <div
            className="absolute z-50 bg-slate-900/95 border border-slate-600 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 shadow-xl pointer-events-none max-w-[200px]"
            style={{ left: emitTooltip.x + 12, top: emitTooltip.y - 24 }}
          >
            {emitTooltip.text}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-6 right-4 z-30 flex flex-col gap-1.5 pointer-events-auto">
          <button onClick={zoomIn}   className="w-9 h-9 bg-slate-900/90 border border-slate-700 hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-300 transition-colors"><Plus className="w-4 h-4" /></button>
          <button onClick={zoomOut}  className="w-9 h-9 bg-slate-900/90 border border-slate-700 hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-300 transition-colors"><Minus className="w-4 h-4" /></button>
          <button onClick={resetView} className="w-9 h-9 bg-slate-900/90 border border-slate-700 hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-300 transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
        </div>

        {/* Basemap + labels toggles */}
        <div className="absolute bottom-6 left-4 z-30 flex flex-col gap-1.5 pointer-events-auto">
          <button
            onClick={() => setGisBasemap(
              basemap === 'satellite' ? 'ndvi' : basemap === 'sentinel2' ? 'road' : 'satellite'
            )}
            title={BASEMAP_META[basemap].attr}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/90 border border-slate-700 hover:bg-slate-700 rounded-xl text-xs text-slate-300 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            {BASEMAP_META[basemap].label}
          </button>
          {/* Sentinel-2 resolution note — honest about tile depth */}
          {basemap === 'sentinel2' && (
            <div className="px-2 py-1 bg-emerald-950/80 border border-emerald-800/50 rounded-lg text-[10px] text-emerald-400 leading-snug max-w-[160px]">
              🛰️ دقة 10م — حتى Z15
              <br />
              <span className="text-emerald-600">© EOX / CC BY 4.0</span>
            </div>
          )}
          <button
            onClick={() => setShowLabels(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-colors ${showLabels ? 'bg-blue-900/50 border-blue-600/50 text-blue-300' : 'bg-slate-900/90 border-slate-700 text-slate-400'}`}
          >
            <Target className="w-3.5 h-3.5" />
            التسميات
          </button>
        </div>

        {/* Zoom level badge */}
        {ready && (
          <div className="absolute top-3 right-3 z-30 px-2 py-0.5 bg-slate-900/80 border border-slate-700 rounded-lg text-[11px] text-slate-400 font-mono tabular-nums select-none">
            Z {zoomLevel.toFixed(1)} / {BASEMAP_META[basemap].maxZoom}
          </div>
        )}

        {/* Dynamic attribution */}
        <div className="absolute bottom-1 right-16 z-20 text-[10px] text-slate-600">
          {BASEMAP_META[basemap].attr}
        </div>
      </div>
    );
  }
);
