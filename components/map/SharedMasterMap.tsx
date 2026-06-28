'use client';
/**
 * SharedMasterMap — ⚠️ DEPRECATED — لا يُستخدم في مسار الإنتاج
 * ─────────────────────────────────────────────────────────────────────────────
 * هذا المكوّن موقوف عن الاستخدام في مسار الإنتاج الرئيسي.
 *
 * البديل الصحيح: UnifiedMapEngine (components/map/UnifiedMapEngine.tsx)
 *   - يستخدم OpenLayers (MapCanvas)
 *   - بيانات حقيقية من API
 *   - لا DEMO_MARKERS
 *
 * هذا الملف محتفظ به مؤقتاً لأغراض المرجع فقط.
 * لا تستخدمه في صفحات جديدة.
 * ─────────────────────────────────────────────────────────────────────────────
 * One map to serve all departments
 * Architecture:
 *   Base satellite/streets/terrain tiles
 *   → Core shared layers (municipalities, boundaries, projects)
 *   → Department-specific layers (filtered by dept + role)
 *   → Role-based visibility (executive sees all / officer sees working set)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Layers, Globe, Map as MapIcon, Satellite, Shield, ChevronDown,
  ChevronRight, Eye, EyeOff, RefreshCw, AlertTriangle, AlertCircle,
  CheckCircle, Info, Maximize2, ZoomIn, ZoomOut, LocateFixed,
  MapPin, Building2, Users, Wrench, FileText, Package, Hammer,
  DollarSign, ShieldAlert, Scan, Route, Zap, Activity,
  LayoutDashboard,
} from 'lucide-react';
import {
  MASTER_LAYERS, DEMO_MARKERS, LayerDef, UserRole, Department,
  BaseMapStyle, getLayersForDepartment, getExecutiveLayers,
  LIBYA_CENTER, LIBYA_ZOOM, TRIPOLI_CENTER, TRIPOLI_ZOOM,
  BASE_TILE_URLS, DemoMarker, IS_DEMO_DATA,
} from '@/lib/masterMapConfig';

// ── Icon mapping for layer icons ─────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  Globe:         <Globe className="w-3.5 h-3.5" />,
  MapPin:        <MapPin className="w-3.5 h-3.5" />,
  Map:           <MapIcon className="w-3.5 h-3.5" />,
  Route:         <Route className="w-3.5 h-3.5" />,
  Building2:     <Building2 className="w-3.5 h-3.5" />,
  Zap:           <Zap className="w-3.5 h-3.5" />,
  Hammer:        <Hammer className="w-3.5 h-3.5" />,
  Package:       <Package className="w-3.5 h-3.5" />,
  AlertTriangle: <AlertTriangle className="w-3.5 h-3.5" />,
  Wrench:        <Wrench className="w-3.5 h-3.5" />,
  AlertOctagon:  <AlertCircle className="w-3.5 h-3.5" />,
  Users:         <Users className="w-3.5 h-3.5" />,
  Layers:        <Layers className="w-3.5 h-3.5" />,
  DollarSign:    <DollarSign className="w-3.5 h-3.5" />,
  FileText:      <FileText className="w-3.5 h-3.5" />,
  ShieldAlert:   <ShieldAlert className="w-3.5 h-3.5" />,
  Scan:          <Scan className="w-3.5 h-3.5" />,
};

// ── Status indicator ─────────────────────────────────────────────────────────

const STATUS_STYLES: Record<DemoMarker['status'], { bg: string; dot: string }> = {
  active:  { bg: '#10b981', dot: '#34d399' },
  warning: { bg: '#f59e0b', dot: '#fbbf24' },
  alert:   { bg: '#ef4444', dot: '#f87171' },
  info:    { bg: '#3b82f6', dot: '#60a5fa' },
};

// ── Layer category grouping ───────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  base:           'قاعدية',
  core:           'أساسية',
  infrastructure: 'بنية تحتية',
  operations:     'تشغيلية',
  finance:        'مالية',
  social:         'اجتماعية',
  alerts:         'تنبيهات',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface SharedMasterMapProps {
  /** View mode: executive sees read-only overview; department = focused working view */
  viewMode?: 'executive' | 'department';
  department?: Department;
  role?: UserRole;
  /** If true, shows in a compact side-panel style */
  compact?: boolean;
  /** Override visible layers by ID */
  forceLayers?: string[];
  /** Callback when a marker is clicked */
  onMarkerClick?: (marker: DemoMarker) => void;
  className?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SharedMasterMap({
  viewMode = 'department',
  department = 'gis',
  role = 'officer',
  compact = false,
  forceLayers,
  onMarkerClick,
  className = '',
}: SharedMasterMapProps) {
  const mapRef   = useRef<HTMLDivElement>(null);
  const olMapRef = useRef<any>(null);
  const layerRefs = useRef<Map<string, any>>(new Map());
  const vectorLayerRef = useRef<any>(null);

  const [baseStyle,    setBaseStyle]    = useState<BaseMapStyle>('satellite');
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  const [layerPanelOpen, setLayerPanelOpen] = useState(!compact);
  const [selectedMarker, setSelectedMarker] = useState<DemoMarker | null>(null);
  const [mapReady,     setMapReady]     = useState(false);
  const [mapError,     setMapError]     = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['core','operations','alerts']));
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const [zoom,         setZoom]         = useState(LIBYA_ZOOM);

  // Determine which layers are available for this user
  const availableLayers: LayerDef[] = forceLayers
    ? MASTER_LAYERS.filter(l => forceLayers.includes(l.id))
    : viewMode === 'executive'
      ? getExecutiveLayers()
      : getLayersForDepartment(department, role);

  // Default visible: those with defaultVisible=true in available set
  useEffect(() => {
    const defaults = new Set(
      availableLayers
        .filter(l => l.defaultVisible)
        .map(l => l.id)
    );
    setVisibleLayers(defaults);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, department, role]);

  // ── OL Map initialization ────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current) return;
    let destroyed = false;

    const initMap = async () => {
      try {
        const ol         = await import('ol');
        const View       = await import('ol/View');
        const TileLayer  = await import('ol/layer/Tile');
        const VectorLayer = await import('ol/layer/Vector');
        const VectorSource = await import('ol/source/Vector');
        const XYZ        = await import('ol/source/XYZ');
        const Feature    = await import('ol/Feature');
        const Point      = await import('ol/geom/Point');
        const { fromLonLat } = await import('ol/proj');
        const { Style, Fill, Stroke, Circle: CircleStyle, Text } = await import('ol/style');
        const Select     = await import('ol/interaction/Select');
        const { click }  = await import('ol/events/condition');

        if (destroyed || !mapRef.current) return;

        // ── Base tile layer ──────────────────────────────────────────────
        const tileUrls = BASE_TILE_URLS[baseStyle];
        const baseSource = new XYZ.default({
          url: tileUrls.satellite || tileUrls.streets || '',
          crossOrigin: 'anonymous',
          tileSize: 256,
        });
        const baseTile = new TileLayer.default({ source: baseSource, zIndex: 0 });

        // ── Label overlay (satellite mode only) ──────────────────────────
        let labelTile: any = null;
        if (baseStyle === 'satellite' && tileUrls.labels) {
          labelTile = new TileLayer.default({
            source: new XYZ.default({ url: tileUrls.labels, crossOrigin: 'anonymous' }),
            zIndex: 1,
          });
        }

        // ── Vector markers layer ─────────────────────────────────────────
        const vectorSource = new VectorSource.default();

        // Create marker features for visible layers
        const markersForVisibleLayers = DEMO_MARKERS.filter(m =>
          visibleLayers.has(m.layer)
        );
        const features = markersForVisibleLayers.map(marker => {
          const layer = MASTER_LAYERS.find(l => l.id === marker.layer);
          const statusStyle = STATUS_STYLES[marker.status];
          const color = layer?.color || '#60a5fa';

          const f = new Feature.default({
            geometry: new Point.default(fromLonLat([marker.lon, marker.lat])),
            markerId: marker.id,
            markerData: marker,
          });
          f.setStyle(new Style.default({
            image: new CircleStyle.default({
              radius: viewMode === 'executive' ? 7 : 9,
              fill:   new Fill.default({ color: statusStyle.bg + 'cc' }),
              stroke: new Stroke.default({ color, width: 2 }),
            }),
            text: viewMode !== 'executive' ? new Text.default({
              text: marker.nameAr,
              offsetY: -18,
              fill:   new Fill.default({ color: '#fff' }),
              stroke: new Stroke.default({ color: '#000', width: 2 }),
              font:   '11px Cairo, sans-serif',
            }) : undefined,
          }));
          return f;
        });
        vectorSource.addFeatures(features);

        const vectorLayer = new VectorLayer.default({ source: vectorSource, zIndex: 10 });
        vectorLayerRef.current = vectorLayer;

        // ── Map instance ─────────────────────────────────────────────────
        const layers = [baseTile, ...(labelTile ? [labelTile] : []), vectorLayer];
        const map = new ol.Map({
          target: mapRef.current!,
          layers,
          view: new View.default({
            center: fromLonLat(LIBYA_CENTER),
            zoom: LIBYA_ZOOM,
            minZoom: 4,
            maxZoom: 18,
          }),
          controls: [],
        });

        // ── Click interaction ────────────────────────────────────────────
        const selectClick = new Select.default({
          condition: click,
          layers: [vectorLayer],
        });
        selectClick.on('select', (e: any) => {
          const selected = e.selected[0];
          if (selected) {
            const data: DemoMarker = selected.get('markerData');
            setSelectedMarker(data);
            onMarkerClick?.(data);
          } else {
            setSelectedMarker(null);
          }
        });
        map.addInteraction(selectClick);

        // ── Zoom change ──────────────────────────────────────────────────
        map.getView().on('change:resolution', () => {
          setZoom(Math.round(map.getView().getZoom() || LIBYA_ZOOM));
        });

        setTimeout(() => map.updateSize(), 200);

        olMapRef.current = map;
        if (!destroyed) setMapReady(true);
      } catch (err: any) {
        if (!destroyed) setMapError(err?.message || 'Map initialization failed');
      }
    };

    initMap();

    return () => {
      destroyed = true;
      olMapRef.current?.setTarget(undefined);
      olMapRef.current = null;
      vectorLayerRef.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseStyle]);

  // ── Update markers when visible layers change ─────────────────────────────

  useEffect(() => {
    if (!vectorLayerRef.current) return;
    const source = vectorLayerRef.current.getSource();
    if (!source) return;

    source.clear();

    import('ol/Feature').then(({ default: Feature }) =>
    import('ol/geom/Point').then(({ default: Point }) =>
    import('ol/proj').then(({ fromLonLat }) =>
    import('ol/style').then(({ Style, Fill, Stroke, Circle: CircleStyle, Text }) => {
      const newFeatures = DEMO_MARKERS
        .filter(m => visibleLayers.has(m.layer))
        .map(marker => {
          const layer = MASTER_LAYERS.find(l => l.id === marker.layer);
          const statusStyle = STATUS_STYLES[marker.status];
          const color = layer?.color || '#60a5fa';
          const f = new Feature({
            geometry: new Point(fromLonLat([marker.lon, marker.lat])),
            markerId: marker.id,
            markerData: marker,
          });
          f.setStyle(new Style({
            image: new CircleStyle({
              radius: viewMode === 'executive' ? 7 : 9,
              fill:   new Fill({ color: statusStyle.bg + 'cc' }),
              stroke: new Stroke({ color, width: 2 }),
            }),
            text: viewMode !== 'executive' ? new Text({
              text: marker.nameAr,
              offsetY: -18,
              fill:   new Fill({ color: '#fff' }),
              stroke: new Stroke({ color: '#000', width: 2 }),
              font:   '11px Cairo, sans-serif',
            }) : undefined,
          }));
          return f;
        });
      source.addFeatures(newFeatures);
    }))));
  }, [visibleLayers, viewMode]);

  // ── Map controls ──────────────────────────────────────────────────────────

  const zoomIn  = useCallback(() => olMapRef.current?.getView().animate({ zoom: (olMapRef.current.getView().getZoom() || 6) + 1, duration: 250 }), []);
  const zoomOut = useCallback(() => olMapRef.current?.getView().animate({ zoom: (olMapRef.current.getView().getZoom() || 6) - 1, duration: 250 }), []);
  const flyToLibya = useCallback(() => {
    import('ol/proj').then(({ fromLonLat }) => {
      olMapRef.current?.getView().animate({ center: fromLonLat(LIBYA_CENTER), zoom: LIBYA_ZOOM, duration: 800 });
    });
  }, []);
  const flyToTripoli = useCallback(() => {
    import('ol/proj').then(({ fromLonLat }) => {
      olMapRef.current?.getView().animate({ center: fromLonLat(TRIPOLI_CENTER), zoom: TRIPOLI_ZOOM, duration: 800 });
    });
  }, []);

  // ── Layer toggle ─────────────────────────────────────────────────────────

  const toggleLayer = useCallback((id: string) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  // ── Group layers by category ─────────────────────────────────────────────

  const byCategory: Record<string, LayerDef[]> = {};
  for (const layer of availableLayers) {
    (byCategory[layer.category] ??= []).push(layer);
  }

  // ── Marker info popup ─────────────────────────────────────────────────────

  const MarkerPopup = selectedMarker ? (
    <div
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 rounded-xl px-4 py-3 min-w-[200px] max-w-xs"
      style={{ background: 'rgba(4,12,32,0.92)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}
    >
      <div className="flex items-start justify-between gap-3" dir="rtl">
        <div>
          <div className="text-white font-semibold text-sm">{selectedMarker.nameAr}</div>
          <div className="text-slate-400 text-xs mt-0.5">{selectedMarker.name}</div>
          {selectedMarker.value && (
            <div className="text-blue-400 text-xs mt-1">{selectedMarker.value}</div>
          )}
        </div>
        <div
          className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
          style={{ background: STATUS_STYLES[selectedMarker.status].bg }}
        />
      </div>
      <button
        onClick={() => setSelectedMarker(null)}
        className="absolute top-1 left-1 text-slate-500 hover:text-white text-xs px-1"
      >✕</button>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`relative flex bg-slate-950 overflow-hidden ${className}`}
      style={{ minHeight: compact ? '300px' : '100%' }}
      dir="rtl"
    >
      {/* ── Map container ── */}
      <div className="flex-1 relative">

        {/* MASTER MAP LIVE badge */}
        <div
          className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-bold"
          style={{ background: 'rgba(4,12,32,0.85)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          MASTER MAP LIVE
        </div>

        {/* View mode badge */}
        <div
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs"
          style={{ background: 'rgba(4,12,32,0.85)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
        >
          {viewMode === 'executive'
            ? <><Shield className="w-3 h-3 text-blue-400" /> عرض تنفيذي — قراءة فقط</>
            : <><LayoutDashboard className="w-3 h-3 text-emerald-400" /> وضع العمل</>
          }
        </div>

        {/* Map canvas */}
        <div ref={mapRef} className="absolute inset-0" />

        {/* Loading overlay */}
        {!mapReady && !mapError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10">
            <Globe className="w-10 h-10 text-blue-400 animate-pulse mb-3" />
            <p className="text-slate-400 text-sm">تحميل الخريطة...</p>
          </div>
        )}

        {/* Error overlay */}
        {mapError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-slate-300 text-sm font-medium mb-1">فشل تحميل الخريطة</p>
            <p className="text-slate-500 text-xs max-w-xs text-center">{mapError}</p>
          </div>
        )}

        {/* Map control buttons */}
        {mapReady && (
          <div className="absolute right-3 bottom-16 z-20 flex flex-col gap-1.5">
            {[
              { icon: <ZoomIn className="w-4 h-4" />, onClick: zoomIn,    tip: 'تكبير' },
              { icon: <ZoomOut className="w-4 h-4" />, onClick: zoomOut,  tip: 'تصغير' },
              { icon: <Globe className="w-4 h-4" />, onClick: flyToLibya, tip: 'ليبيا' },
              { icon: <LocateFixed className="w-4 h-4" />, onClick: flyToTripoli, tip: 'طرابلس' },
            ].map((btn, i) => (
              <button key={i} onClick={btn.onClick} title={btn.tip}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                style={{ background: 'rgba(4,12,32,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        )}

        {/* Base map style switcher */}
        {mapReady && (
          <div className="absolute left-3 bottom-3 z-20 flex gap-1.5">
            {(['satellite','streets','terrain'] as BaseMapStyle[]).map(s => (
              <button
                key={s}
                onClick={() => setBaseStyle(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${baseStyle === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                style={baseStyle !== s ? { background: 'rgba(4,12,32,0.85)', border: '1px solid rgba(255,255,255,0.1)' } : {}}
              >
                {s === 'satellite' ? '🛰 فضائي' : s === 'streets' ? '🗺 خرائط' : '🌿 تضاريس'}
              </button>
            ))}
          </div>
        )}

        {/* Zoom indicator */}
        {mapReady && (
          <div className="absolute left-3 bottom-12 z-20 text-xs font-mono"
            style={{ color: '#475569' }}>
            Z{zoom}
          </div>
        )}

        {/* ⚠️ Floating demo badge — always visible on the map */}
        {IS_DEMO_DATA && (
          <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-900/80 border border-amber-500/50 shadow-lg backdrop-blur-sm">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-300 font-mono tracking-wider">بيانات تجريبية</span>
          </div>
        )}

        {/* Marker popup */}
        {MarkerPopup}
      </div>

      {/* ── Layer panel ── */}
      <div
        className={`flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ${layerPanelOpen ? (compact ? 'w-52' : 'w-60') : 'w-8'}`}
      >
        {/* Panel toggle button */}
        <button
          onClick={() => setLayerPanelOpen(v => !v)}
          className="flex items-center gap-1.5 p-2 text-slate-400 hover:text-white border-b border-slate-800 transition-colors w-full"
        >
          <Layers className="w-4 h-4 flex-shrink-0" />
          {layerPanelOpen && <span className="text-xs font-medium whitespace-nowrap">الطبقات</span>}
          {layerPanelOpen
            ? <ChevronRight className="w-3 h-3 mr-auto" />
            : <ChevronDown className="w-3 h-3 mr-auto rotate-90" />}
        </button>

        {layerPanelOpen && (
          <div className="flex-1 overflow-y-auto">
            {/* ⚠️ Demo data warning banner */}
            {IS_DEMO_DATA && (
              <div className="mx-2 mt-2 mb-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-amber-400 leading-snug">بيانات تجريبية</span>
                <span className="text-[9px] text-amber-500/70 leading-snug mr-auto">ليست بيانات حقيقية</span>
              </div>
            )}

            {/* Role/dept context */}
            <div className="px-3 py-2 border-b border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                {viewMode === 'executive' ? 'نظرة عامة تنفيذية' : 'وضع العمل'}
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-1">
                {viewMode === 'executive'
                  ? <><Shield className="w-3 h-3 text-blue-400" />{role}</>
                  : <><Activity className="w-3 h-3 text-emerald-400" />{department} · {role}</>
                }
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {availableLayers.length} طبقة متاحة · {visibleLayers.size} مرئية
              </div>
            </div>

            {/* Layer groups */}
            {Object.entries(byCategory).map(([cat, layers]) => (
              <div key={cat} className="border-b border-slate-800/60">
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <ChevronRight className={`w-3 h-3 transition-transform ${expandedCats.has(cat) ? 'rotate-90' : ''}`} />
                  {CATEGORY_LABELS[cat] || cat}
                  <span className="mr-auto text-slate-600">{layers.length}</span>
                </button>

                {/* Layer items */}
                {expandedCats.has(cat) && layers.map(layer => {
                  const visible = visibleLayers.has(layer.id);
                  return (
                    <button
                      key={layer.id}
                      onClick={() => toggleLayer(layer.id)}
                      onMouseEnter={() => setHoveredLayer(layer.id)}
                      onMouseLeave={() => setHoveredLayer(null)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-right transition-all ${visible ? 'text-slate-200' : 'text-slate-500 hover:text-slate-300'} ${hoveredLayer === layer.id ? 'bg-slate-800/60' : ''}`}
                    >
                      {/* Color dot */}
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: visible ? layer.color : '#374151' }}
                      />
                      {/* Icon */}
                      <span style={{ color: visible ? layer.color : '#4b5563' }}>
                        {ICON_MAP[layer.icon] ?? <MapPin className="w-3.5 h-3.5" />}
                      </span>
                      {/* Label */}
                      <span className="flex-1 text-right leading-tight">{layer.labelAr}</span>
                      {/* Eye toggle */}
                      <span className="text-slate-600 flex-shrink-0">
                        {visible
                          ? <Eye className="w-3 h-3 text-slate-400" />
                          : <EyeOff className="w-3 h-3" />
                        }
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Quick actions */}
            <div className="p-3 border-t border-slate-800 mt-auto">
              <button
                onClick={() => {
                  const allIds = new Set(availableLayers.map(l => l.id));
                  setVisibleLayers(allIds);
                }}
                className="w-full text-[10px] text-slate-500 hover:text-slate-300 py-1 flex items-center justify-center gap-1 hover:bg-slate-800/40 rounded transition-colors"
              >
                <Eye className="w-3 h-3" /> إظهار الكل
              </button>
              <button
                onClick={() => setVisibleLayers(new Set())}
                className="w-full text-[10px] text-slate-500 hover:text-slate-300 py-1 flex items-center justify-center gap-1 hover:bg-slate-800/40 rounded transition-colors"
              >
                <EyeOff className="w-3 h-3" /> إخفاء الكل
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
