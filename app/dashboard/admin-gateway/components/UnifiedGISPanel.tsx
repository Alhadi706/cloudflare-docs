'use client';
/**
 * UnifiedGISPanel
 * ─────────────────
 * لوحة الخريطة الجغرافية الموحدة — تظهر في أي إدارة أو قسم.
 * تعرض جميع مواقع المشاريع مع كيانات كل إدارة مرتبطة بها.
 * النقر على أي موقع يفتح لوحة تفصيلية بكل المحتويات.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { X, RefreshCw, Layers, ChevronLeft, MapPin, AlertCircle,
         Building2, Loader2, Filter, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useGisUnifiedStore, CATEGORY_META, SITE_TYPE_COLORS,
         EntityCategory, GisEntity, SiteMarker } from '@/store/gisUnifiedStore';
import { useErpContextStore } from '@/store/erpContextStore';

// ─── اللوحة الجانبية لتفاصيل الموقع ─────────────────────────────────────────

function SiteDetailPanel() {
  const { selectedPanel, closeSitePanel, activeCategories } = useGisUnifiedStore();
  if (!selectedPanel) return null;

  const filtered = selectedPanel.entities.filter(
    e => activeCategories.includes(e.category)
  );

  const byCategory: Partial<Record<EntityCategory, GisEntity[]>> = {};
  for (const e of filtered) {
    (byCategory[e.category] ??= []).push(e);
  }

  const statusColor = (s?: string) => {
    if (!s) return 'text-slate-400';
    const l = s.toLowerCase();
    if (l.includes('active') || l.includes('مفعل') || l.includes('جاري')) return 'text-emerald-400';
    if (l.includes('pending') || l.includes('معلق')) return 'text-amber-400';
    if (l.includes('close') || l.includes('منجز') || l.includes('مكتمل')) return 'text-blue-400';
    return 'text-slate-300';
  };

  return (
    <div className="w-80 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col h-full overflow-hidden" dir="rtl">
      {/* رأس اللوحة */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/60 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <h3 className="text-sm font-bold text-slate-100 truncate">{selectedPanel.site_name}</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{selectedPanel.project_name}</p>
          <p className="text-xs text-slate-500 mt-0.5 dir-ltr">
            {selectedPanel.latitude.toFixed(5)}, {selectedPanel.longitude.toFixed(5)}
          </p>
        </div>
        <button onClick={closeSitePanel}
          className="p-1 hover:bg-slate-700 rounded ml-2 flex-shrink-0 text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* محتوى اللوحة */}
      {selectedPanel.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">تحميل بيانات الموقع...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">لا توجد سجلات في هذا الموقع</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* ملخص سريع */}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(byCategory).map(([cat, items]) => {
              const meta = CATEGORY_META[cat as EntityCategory];
              return (
                <div key={cat} className="bg-slate-800/60 rounded-lg p-2 flex items-center gap-2">
                  <span className="text-lg">{meta.icon}</span>
                  <div>
                    <div className="text-base font-bold text-white">{items!.length}</div>
                    <div className="text-[10px] text-slate-400">{meta.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* قوائم مفصّلة */}
          {Object.entries(byCategory).map(([cat, items]) => {
            const meta = CATEGORY_META[cat as EntityCategory];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span>{meta.icon}</span>
                  <h4 className="text-xs font-semibold text-slate-300">{meta.label}</h4>
                  <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                    {items!.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {items!.slice(0, 8).map(e => (
                    <div key={`${e.category}-${e.id}`}
                      className="bg-slate-800/40 hover:bg-slate-800 rounded-lg p-2 cursor-default transition-colors">
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs text-slate-200 font-medium leading-snug">{e.title}</span>
                        {e.status && (
                          <span className={`text-[9px] font-semibold shrink-0 ${statusColor(e.status)}`}>
                            {e.status}
                          </span>
                        )}
                      </div>
                      {(e.subtitle || e.value) && (
                        <div className="flex items-center justify-between mt-0.5">
                          {e.subtitle && <span className="text-[10px] text-slate-500">{e.subtitle}</span>}
                          {e.value && <span className="text-[10px] text-blue-400">{e.value}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  {items!.length > 8 && (
                    <p className="text-[10px] text-slate-500 text-center py-1">
                      + {items!.length - 8} سجل آخر
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* تقرير الموقع */}
      <div className="p-3 border-t border-slate-700">
        <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
          تقرير تفصيلي للموقع
        </button>
      </div>
    </div>
  );
}

// ─── مكون الخريطة الداخلي (OL) ───────────────────────────────────────────────

interface MapCoreProps {
  markers: SiteMarker[];
  onSiteClick: (marker: SiteMarker) => void;
  selectedSiteId?: number | null;
}

function MapCore({ markers, onSiteClick, selectedSiteId }: MapCoreProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const olMapRef = useRef<any>(null);
  const vectorSourceRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ name: string; count: number } | null>(null);

  // Force explicit pixel height on mapRef using ResizeObserver on wrapper
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const mapDiv = mapRef.current;
    if (!wrapper || !mapDiv) return;

    const sync = () => {
      const h = wrapper.offsetHeight;
      const w = wrapper.offsetWidth;
      if (h > 10 && w > 10) {
        mapDiv.style.width = w + 'px';
        mapDiv.style.height = h + 'px';
        olMapRef.current?.updateSize();
      }
    };

    sync();
    const obs = new ResizeObserver(sync);
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    // Dynamic OL import to avoid SSR issues
    let cleanup: () => void;

    const initMap = async () => {
      // انتظر حتى يكون للـ wrapper ارتفاع حقيقي
      let waited = 0;
      while (wrapperRef.current && wrapperRef.current.offsetHeight < 10 && waited < 5000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }

      const ol       = await import('ol');
      const View     = await import('ol/View');
      const TileLayer = await import('ol/layer/Tile');
      const VectorLayer = await import('ol/layer/Vector');
      const VectorSource = await import('ol/source/Vector');
      const XYZ     = await import('ol/source/XYZ');
      const Feature  = await import('ol/Feature');
      const Point    = await import('ol/geom/Point');
      const { fromLonLat } = await import('ol/proj');
      const { Style, Fill, Stroke, Circle: CircleStyle, Text } = await import('ol/style');
      const Select   = await import('ol/interaction/Select');
      const { click, pointerMove } = await import('ol/events/condition');
      const Overlay  = await import('ol/Overlay');

      if (!mapRef.current) return;

      // Base layer — صور فضائية عبر proxy
      const baseLayer = new TileLayer.default({
        source: new XYZ.default({
          url: '/tiles/satellite/{z}/{y}/{x}',
          maxZoom: 19,
          attributions: 'Tiles &copy; Esri',
        }),
      });

      // طبقة التسميات فوق الصور
      const labelsLayer = new TileLayer.default({
        source: new XYZ.default({
          url: '/tiles/labels/{z}/{y}/{x}',
          maxZoom: 19,
          attributions: 'Labels &copy; Esri',
        }),
      });

      // Vector source للماركرات
      const vectorSource = new VectorSource.default();
      vectorSourceRef.current = vectorSource;

      const vectorLayer = new VectorLayer.default({
        source: vectorSource,
        style: (feature) => {
          const siteType = feature.get('site_type') || 'field';
          const count = feature.get('entities_count') || 0;
          const isSelected = feature.get('site_id') === selectedSiteId;
          const siteName = feature.get('site_name') || '';
          const color = SITE_TYPE_COLORS[siteType] || '#22c55e';
          const radius = isSelected ? 16 : (count > 10 ? 13 : count > 0 ? 11 : 9);

          return new Style({
            image: new CircleStyle({
              radius,
              fill: new Fill({ color: isSelected ? '#ffffff' : color }),
              stroke: new Stroke({
                color: isSelected ? color : '#000000',
                width: isSelected ? 3 : 2,
              }),
            }),
            text: new Text({
              text: count > 0 ? String(count) : '',
              font: `bold ${isSelected ? 12 : 10}px sans-serif`,
              fill: new Fill({ color: isSelected ? color : '#ffffff' }),
              stroke: new Stroke({ color: '#000000', width: 2 }),
              offsetY: 0,
            }),
          });
        },
      });

      // Overlay للـ tooltip
      const overlayEl = overlayContainerRef.current;
      const overlay = overlayEl ? new Overlay.default({
        element: overlayEl,
        positioning: 'bottom-center',
        stopEvent: false,
        offset: [0, -12],
      }) : null;
      if (overlay) overlayRef.current = overlay;

      // حساب المركز من الماركرات
      const center = markers.length > 0
        ? fromLonLat([
            markers.reduce((s, m) => s + m.longitude, 0) / markers.length,
            markers.reduce((s, m) => s + m.latitude, 0) / markers.length,
          ])
        : fromLonLat([13.1913, 32.8872]);

      const map = new ol.default({
        target: mapRef.current,
        layers: [baseLayer, labelsLayer, vectorLayer],
        overlays: overlay ? [overlay] : [],
        view: new View.default({
          center,
          zoom: markers.length > 1 ? 9 : 13,
        }),
      });
      olMapRef.current = map;

      // إضافة الماركرات
      for (const m of markers) {
        const feature = new Feature.default({
          geometry: new Point.default(fromLonLat([m.longitude, m.latitude])),
          site_id: m.site_id,
          site_name: m.site_name,
          project_name: m.project_name,
          site_type: m.site_type,
          entities_count: m.entities_count,
          project_id: m.project_id,
        });
        vectorSource.addFeature(feature);
      }

      // Hover tooltip
      map.on('pointermove', (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
        if (feature && overlay) {
          const name = feature.get('site_name');
          const count = feature.get('entities_count');
          setTooltip({ name, count });
          overlay.setPosition(evt.coordinate);
          map.getTargetElement().style.cursor = 'pointer';
        } else {
          setTooltip(null);
          if (overlay) overlay.setPosition(undefined);
          map.getTargetElement().style.cursor = '';
        }
      });

      // Click handler
      map.on('click', (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
        if (feature) {
          const siteId = feature.get('site_id');
          const projectId = feature.get('project_id');
          const marker = markers.find(m => m.site_id === siteId);
          if (marker) onSiteClick(marker);
        }
      });

      // ResizeObserver — يجبر OL على إعادة حساب الحجم عند تغيير container
      let resizeObs: ResizeObserver | null = null;
      if (mapRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObs = new ResizeObserver(() => { map.updateSize(); });
        resizeObs.observe(mapRef.current);
      }
      // updateSize بعد لحظة لضمان رسم الـ tiles في أول تحميل
      setTimeout(() => { map.updateSize(); }, 100);
      setTimeout(() => { map.updateSize(); }, 500);

      cleanup = () => {
        if (resizeObs) resizeObs.disconnect();
        map.setTarget(undefined as any);
      };
    };

    initMap();

    return () => { cleanup?.(); };
  }, []); // eslint-disable-line

  // تحديث الماركرات عند تغيّر البيانات
  useEffect(() => {
    const doUpdate = async () => {
      if (!vectorSourceRef.current) return;
      const { default: Feature } = await import('ol/Feature');
      const { default: Point }   = await import('ol/geom/Point');
      const { fromLonLat }       = await import('ol/proj');

      vectorSourceRef.current.clear();
      for (const m of markers) {
        const feature = new Feature({
          geometry: new Point(fromLonLat([m.longitude, m.latitude])),
          site_id: m.site_id,
          site_name: m.site_name,
          project_name: m.project_name,
          site_type: m.site_type,
          entities_count: m.entities_count,
          project_id: m.project_id,
        });
        vectorSourceRef.current.addFeature(feature);
      }
      olMapRef.current?.getLayers()?.getArray()[1]?.changed();
    };
    doUpdate();
  }, [markers, selectedSiteId]);

  return (
    <div ref={wrapperRef} className="relative w-full h-full min-h-[300px]">
      <div ref={mapRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      {/* Tooltip */}
      <div ref={overlayContainerRef} className="pointer-events-none">
        {tooltip && (
          <div className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs shadow-xl -translate-x-1/2" dir="rtl">
            <div className="font-semibold text-slate-100">{tooltip.name}</div>
            {tooltip.count > 0 && (
              <div className="text-slate-400">{tooltip.count} سجل مرتبط</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── المكون الرئيسي ───────────────────────────────────────────────────────────

interface UnifiedGISPanelProps {
  /** ارتفاع اللوحة — افتراضي: 480px */
  height?: string | number;
  /** هل تظهر مدمجة (embedded) أو كصفحة كاملة */
  fullPage?: boolean;
  /** مشروع محدد للتصفية */
  filterProjectId?: string | number;
  /** موقع محدد للتصفية */
  filterSiteId?: number;
  onClose?: () => void;
}

export default function UnifiedGISPanel({
  height = 480,
  fullPage = false,
  filterProjectId,
  filterSiteId,
  onClose,
}: UnifiedGISPanelProps) {
  const {
    siteMarkers, markersLoading, markersError, lastRefresh,
    selectedPanel, panelOpen, activeCategories,
    loadSiteMarkers, loadSiteDetail, closeSitePanel,
    toggleCategory,
  } = useGisUnifiedStore();

  const { activeProjectId } = useErpContextStore();
  const [showLegend, setShowLegend] = useState(false);

  // حساب الارتفاع من window مباشرة عند fullPage
  const [vpHeight, setVpHeight] = useState(600);
  useEffect(() => {
    const update = () => setVpHeight(Math.max(400, window.innerHeight - 64 - 50));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // تحميل الماركرات عند أول تركيب
  useEffect(() => {
    const ids = filterProjectId
      ? [filterProjectId]
      : activeProjectId
        ? [activeProjectId]
        : undefined;
    loadSiteMarkers(ids);
  }, [filterProjectId, activeProjectId]); // eslint-disable-line

  // تصفية الماركرات
  const visibleMarkers = siteMarkers.filter(m => {
    if (filterProjectId && m.project_id !== filterProjectId) return false;
    if (filterSiteId && m.site_id !== filterSiteId) return false;
    return true;
  });

  const handleSiteClick = useCallback((marker: SiteMarker) => {
    loadSiteDetail(marker.site_id, marker.project_id);
  }, [loadSiteDetail]);

  const h = fullPage ? `${vpHeight}px` : (typeof height === 'number' ? `${height}px` : height);

  return (
    <div
      className="flex flex-col bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl"
      style={{ height: h }}
      dir="rtl"
    >
      {/* شريط الأدوات */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-blue-400">
          <MapPin className="w-4 h-4" />
          <span className="text-xs font-semibold">خريطة المشاريع الموحدة</span>
        </div>

        {lastRefresh && (
          <span className="text-[10px] text-slate-500">
            آخر تحديث: {new Date(lastRefresh).toLocaleTimeString('ar')}
          </span>
        )}

        <div className="flex-1" />

        {/* أزرار التحكم */}
        <button
          onClick={() => setShowLegend(v => !v)}
          className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
          title="الطبقات والفلاتر"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => loadSiteMarkers(filterProjectId ? [filterProjectId] : undefined)}
          disabled={markersLoading}
          className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          title="تحديث"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${markersLoading ? 'animate-spin' : ''}`} />
        </button>
        {onClose && (
          <button onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* فلتر الطبقات */}
      {showLegend && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-slate-900/80 border-b border-slate-700 flex-shrink-0">
          {(Object.entries(CATEGORY_META) as [EntityCategory, typeof CATEGORY_META[EntityCategory]][]).map(([cat, meta]) => {
            const active = activeCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-all ${
                  active
                    ? 'bg-slate-700 border-slate-500 text-slate-200'
                    : 'bg-transparent border-slate-700 text-slate-600'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
          {/* وسيلة إيضاح نوع الموقع */}
          <div className="w-full border-t border-slate-700 pt-1.5 mt-0.5 flex flex-wrap gap-2">
            {Object.entries(SITE_TYPE_COLORS).map(([type, color]) => {
              const labels: Record<string, string> = {
                administrative: 'إداري', operational: 'تشغيلي',
                field: 'ميداني', storage: 'مخزن', maintenance: 'صيانة',
              };
              return (
                <div key={type} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-[9px] text-slate-400">{labels[type] || type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* الجسم الرئيسي */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* الخريطة */}
        <div className="flex-1 relative min-h-0">
          {markersError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-400 px-4">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                <p className="text-sm">{markersError}</p>
                <button onClick={() => loadSiteMarkers()}
                  className="mt-2 text-xs text-blue-400 hover:underline">إعادة المحاولة</button>
              </div>
            </div>
          ) : markersLoading && visibleMarkers.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">تحميل مواقع المشاريع...</p>
              </div>
            </div>
          ) : !markersLoading && visibleMarkers.length === 0 ? (
            /* ── حالة فارغة — لا مشاريع بعد ── */
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                <MapPin className="w-7 h-7 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-300 mb-1">لا توجد مشاريع على الخريطة</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  هذه الخريطة تعرض مواقع المشاريع الحقيقية فقط.<br />
                  أضف مشروعاً جديداً لتظهر مواقعه هنا.
                </p>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> لا بيانات تجريبية — بيانات حقيقية فقط
                </p>
              </div>
            </div>
          ) : (
            <MapCore
              markers={visibleMarkers}
              onSiteClick={handleSiteClick}
              selectedSiteId={selectedPanel?.site_id}
            />
          )}

          {/* إحصائية سريعة — تظهر فقط إن وُجدت مواقع */}
          {visibleMarkers.length > 0 && (
            <div className="absolute bottom-2 right-2 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-2 py-1">
              <span className="text-[10px] text-slate-300">
                {visibleMarkers.length} موقع
                {visibleMarkers.reduce((s, m) => s + m.entities_count, 0) > 0 &&
                  ` · ${visibleMarkers.reduce((s, m) => s + m.entities_count, 0)} سجل`}
              </span>
            </div>
          )}
        </div>

        {/* لوحة التفاصيل الجانبية */}
        {panelOpen && <SiteDetailPanel />}
      </div>
    </div>
  );
}
