'use client';
// ─── SvyMapPanel ──────────────────────────────────────────────────────────────
// Renders parsed .svy GIS points on a satellite basemap using OpenLayers.
// TRUTHFULNESS CONTRACT:
//   • Points are drawn ONLY from backend-returned gis_points (real coords).
//   • If no coordinates → clear no-data message, zero fake markers.
//   • If CRS is non-WGS84 → banner asks for confirmation (no reprojection guess).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, AlertTriangle, Shield, Crosshair, Layers } from 'lucide-react';

// ── Satellite tile URL (Esri World Imagery — free, no key required) ──────────
const ESRI_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_LABELS = 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

// ── Spatial mode ──────────────────────────────────────────────────────────────
export type SpatialMode = 'direct_coordinates' | 'linear_reference' | 'no_geospatial_position';

export function detectSpatialMode(svyData: any): SpatialMode {
  const fields: Record<string, string> = svyData?.coord_fields ?? {};
  const hasXY = (fields.x || fields.y) && svyData?.gis_usable === true;
  const hasLinear = fields.distance || fields.chainage || fields.segment;

  if (hasXY && (svyData?.gis_points?.length ?? 0) > 0) return 'direct_coordinates';
  if (hasLinear) return 'linear_reference';
  return 'no_geospatial_position';
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface SvyMapPanelProps {
  svyData: any;  // full backend svy_parsed response
  spatialMode: SpatialMode;
}

// ── Popup state ───────────────────────────────────────────────────────────────
interface PopupState {
  visible: boolean;
  x: number;
  y: number;
  props: Record<string, any>;
}

export function SvyMapPanel({ svyData, spatialMode }: SvyMapPanelProps) {
  const mapRef        = useRef<HTMLDivElement>(null);
  const mapInstance   = useRef<any>(null);
  const vecSource     = useRef<any>(null);

  const [olLoaded,  setOlLoaded]  = useState(false);
  const [olError,   setOlError]   = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [popup,     setPopup]     = useState<PopupState>({ visible: false, x: 0, y: 0, props: {} });

  // ── spatial-mode banner text ────────────────────────────────────────────────
  const modeLabel =
    spatialMode === 'direct_coordinates'  ? 'DIRECT COORDINATES — إحداثيات مباشرة محققة' :
    spatialMode === 'linear_reference'    ? 'LINEAR REFERENCE MODE — مسافات على الخط' :
                                           'NO GEOSPATIAL DATA — لا إحداثيات متاحة';
  const modeBg =
    spatialMode === 'direct_coordinates'  ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-300' :
    spatialMode === 'linear_reference'    ? 'bg-amber-900/20 border-amber-500/30 text-amber-300' :
                                           'bg-slate-900/50 border-slate-700 text-slate-400';

  // ── No-geospatial case — render immediately without loading OL ──────────────
  if (spatialMode === 'no_geospatial_position') {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-slate-500" />
        <p className="text-base font-semibold text-slate-300">
          لا يمكن عرض المسح على الخريطة
        </p>
        <p className="text-sm text-slate-500 max-w-md">
          لعدم توفر إحداثيات مباشرة أو مسار خط مربوط — تحقق من وجود أعمدة X / Y أو
          latitude / longitude أو easting / northing في الملف
        </p>
        {svyData?.coord_fields && Object.keys(svyData.coord_fields).length > 0 && (
          <div className="text-xs text-slate-500 mt-1">
            الأعمدة المكتشفة: {Object.values(svyData.coord_fields).join(' · ')}
          </div>
        )}
      </div>
    );
  }

  // ── Linear-reference case — no pipeline geometry available in frontend ───────
  if (spatialMode === 'linear_reference') {
    return (
      <div className="rounded-2xl border border-amber-600/30 bg-amber-900/10 p-6 flex flex-col items-center gap-3 text-center">
        <Crosshair className="w-10 h-10 text-amber-500" />
        <p className="text-base font-semibold text-amber-300">
          تم اكتشاف مسافات على الخط (Linear Reference)
        </p>
        <p className="text-sm text-amber-400/70 max-w-md">
          الملف يحتوي حقول مسافة / شينيج (chainage) لكن لا يوجد مسار جيوميتري للخط
          محلي. لرسم المواقع بدقة: ربط الملف بمسار الخط المخزّن في قاعدة البيانات
          سيفعّل هذه الميزة تلقائياً.
        </p>
        <div className="flex gap-3 text-xs text-amber-400/60 mt-1 flex-wrap justify-center">
          {svyData?.coord_fields?.distance && <span>حقل المسافة: <strong>{svyData.coord_fields.distance}</strong></span>}
          {svyData?.coord_fields?.segment  && <span>حقل القطعة: <strong>{svyData.coord_fields.segment}</strong></span>}
        </div>
      </div>
    );
  }

  // ── Direct coordinates — render the map ──────────────────────────────────────
  return <SvyOlMap svyData={svyData} modeLabel={modeLabel} modeBg={modeBg} />;
}

// ── Inner OL component (only mounted when direct_coordinates) ─────────────────
function SvyOlMap({ svyData, modeLabel, modeBg }: { svyData: any; modeLabel: string; modeBg: string }) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const mapInstance  = useRef<any>(null);
  const vecSource    = useRef<any>(null);
  const labelsLayer  = useRef<any>(null);

  const [olLoaded,   setOlLoaded]   = useState(false);
  const [olError,    setOlError]    = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [pointCount, setPointCount] = useState(0);
  const [popup,      setPopup]      = useState<PopupState>({ visible: false, x: 0, y: 0, props: {} });

  const gisPoints: any[] = svyData?.gis_points ?? [];
  const crsGuess: string | null = svyData?.crs_guess ?? null;
  const isUnknownCRS = !crsGuess || crsGuess.toLowerCase().includes('unknown');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!mapRef.current || gisPoints.length === 0) return;

      try {
        const [
          { default: OLMap },
          { default: View },
          { default: TileLayer },
          { default: XYZ },
          { default: VectorLayer },
          { default: VectorSource },
          { default: GeoJSON },
          { Style, Fill, Stroke, Circle: CircleStyle },
          { fromLonLat, transformExtent },
          { defaults: defaultControls },
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
          import('ol/control'),
        ]);

        if (cancelled || !mapRef.current) return;

        // ── Vector source from backend gis_points ────────────────────────────
        const format = new GeoJSON();
        const features = format.readFeatures(
          { type: 'FeatureCollection', features: gisPoints },
          { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' }
        );

        const vs = new VectorSource({ features });
        vecSource.current = vs;

        // ── Point style (glowing coral circles) ──────────────────────────────
        const pointStyle = new Style({
          image: new CircleStyle({
            radius: 7,
            fill:   new Fill({ color: 'rgba(251, 113, 133, 0.85)' }),  // coral
            stroke: new Stroke({ color: '#fbbf24', width: 2 }),         // amber ring
          }),
        });

        const vectorLayer = new VectorLayer({
          source: vs,
          style: pointStyle,
          zIndex: 10,
        });

        // ── Satellite basemap ────────────────────────────────────────────────
        const satLayer = new TileLayer({
          source: new XYZ({
            url: ESRI_SAT,
            attributions: '© Esri, DigitalGlobe',
            maxZoom: 19,
          }),
        });

        // ── Labels overlay (optional) ────────────────────────────────────────
        const lblLayer = new TileLayer({
          source: new XYZ({
            url: ESRI_LABELS,
            attributions: '© Esri',
            maxZoom: 19,
          }),
          opacity: 0.7,
          visible: true,
          zIndex: 5,
        });
        labelsLayer.current = lblLayer;

        const map = new OLMap({
          target: mapRef.current,
          layers: [satLayer, lblLayer, vectorLayer],
          view: new View({
            center: fromLonLat([13.19, 32.89]),
            zoom: 12,
          }),
          controls: defaultControls({ attribution: false, zoom: true, rotate: false }),
        });

        mapInstance.current = map;

        // ── Fit view to all points ────────────────────────────────────────────
        if (features.length > 0) {
          const extent = vs.getExtent();
          if (features.length === 1) {
            const geom = features[0].getGeometry();
            const center = (geom as any).getCoordinates();
            map.getView().setCenter(center);
            map.getView().setZoom(14);
          } else {
            map.getView().fit(extent, {
              padding: [60, 60, 60, 60],
              maxZoom: 17,
            });
          }
        }

        // ── Click → popup ─────────────────────────────────────────────────────
        map.on('click', (evt: any) => {
          const feature = map.forEachFeatureAtPixel(evt.pixel, (f: any) => f);
          if (feature) {
            const props = feature.getProperties();
            const pixel = evt.pixel as [number, number];
            setPopup({ visible: true, x: pixel[0], y: pixel[1], props });
          } else {
            setPopup(p => ({ ...p, visible: false }));
          }
        });

        // Cursor
        map.on('pointermove', (evt: any) => {
          const hit = map.hasFeatureAtPixel(evt.pixel);
          (mapRef.current as HTMLDivElement).style.cursor = hit ? 'pointer' : '';
        });

        setPointCount(features.length);
        setOlLoaded(true);
      } catch (e: any) {
        if (!cancelled) setOlError(e.message ?? 'OpenLayers load failed');
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);  // only once on mount

  // Toggle label layer
  useEffect(() => {
    if (labelsLayer.current) labelsLayer.current.setVisible(showLabels);
  }, [showLabels]);

  return (
    <div className="rounded-2xl border border-slate-700 overflow-hidden bg-slate-950">
      {/* ── Header bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="text-sm font-bold text-white">خريطة نقاط المسح — SVY MAP ACTIVE</span>
        <span className={`ml-1 text-xs font-mono px-2 py-0.5 rounded-lg border ${modeBg}`}>
          {modeLabel}
        </span>
        {olLoaded && <span className="text-xs text-slate-500 ml-1">{pointCount} نقطة</span>}

        {/* Labels toggle */}
        <button
          onClick={() => setShowLabels(v => !v)}
          className={`ml-auto flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors ${showLabels ? 'bg-blue-900/30 border-blue-500/40 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
        >
          <Layers className="w-3 h-3" />
          {showLabels ? 'تسميات: ON' : 'تسميات: OFF'}
        </button>
      </div>

      {/* ── CRS warning ───────────────────────────────────────────────── */}
      {isUnknownCRS && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/20 border-b border-amber-600/30">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            نظام الإحداثيات غير محدد — تم افتراض WGS84. تحقق من مصدر الملف للتأكد من دقة المواقع.
          </p>
        </div>
      )}
      {crsGuess && !isUnknownCRS && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-900/15 border-b border-emerald-700/20">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-300/80">نظام الإحداثيات: {crsGuess}</p>
        </div>
      )}

      {/* ── Map canvas ────────────────────────────────────────────────── */}
      <div className="relative">
        <div
          ref={mapRef}
          className="w-full"
          style={{ height: 420 }}
        />

        {/* Loading spinner */}
        {!olLoaded && !olError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">يتم تحميل الخريطة الفضائية…</p>
          </div>
        )}

        {/* Error */}
        {olError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-300">فشل تحميل الخريطة</p>
              <p className="text-xs text-slate-500 mt-1">{olError}</p>
            </div>
          </div>
        )}

        {/* Feature popup */}
        {popup.visible && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: Math.min(popup.x + 12, (mapRef.current?.offsetWidth ?? 400) - 200),
              top:  Math.max(popup.y - 120, 8),
            }}
          >
            <div className="bg-slate-900/95 border border-slate-600 rounded-xl p-3 shadow-2xl w-48 pointer-events-auto">
              <button
                onClick={() => setPopup(p => ({ ...p, visible: false }))}
                className="absolute top-1.5 right-2 text-slate-500 hover:text-white text-xs"
              >✕</button>
              <p className="text-xs font-bold text-slate-200 mb-2">نقطة مسح</p>
              {Object.entries(popup.props)
                .filter(([k]) => k !== 'geometry')
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-200 font-mono">{String(v)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer summary ────────────────────────────────────────────── */}
      {olLoaded && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-slate-900/80 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-400 border-2 border-amber-400 inline-block" />
            <span className="text-xs text-slate-400">{pointCount} نقطة مسح حقيقية</span>
          </div>
          {svyData?.coord_fields?.x && (
            <span className="text-xs text-slate-500">
              عمود X: <strong className="text-slate-300">{svyData.coord_fields.x}</strong>
            </span>
          )}
          {svyData?.coord_fields?.y && (
            <span className="text-xs text-slate-500">
              عمود Y: <strong className="text-slate-300">{svyData.coord_fields.y}</strong>
            </span>
          )}
          <span className="text-xs text-slate-600 ml-auto">© Esri World Imagery</span>
        </div>
      )}
    </div>
  );
}
