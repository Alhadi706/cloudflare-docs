'use client';
/**
 * LocationPickerModal
 * ────────────────────
 * مودال اختيار الموقع الجغرافي — يُستخدم في كل النماذج (أصول، شراء، موظفين...)
 * يسمح بـ:
 *   1. اختيار مشروع وموقع موجود
 *   2. أو النقر على الخريطة لتحديد إحداثيات جديدة
 * يُعيد: { project_id, site_id?, latitude, longitude, site_name? }
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, MapPin, Building2, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react';
import { useErpContextStore, ErpProject, ErpSite } from '@/store/erpContextStore';

export interface SelectedLocation {
  project_id: string | number;
  project_name: string;
  site_id?: number;
  site_name?: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (loc: SelectedLocation) => void;
  /** قيم مبدئية إذا كان التعديل */
  initialValue?: Partial<SelectedLocation>;
  /** عنوان المودال */
  title?: string;
}

const SITE_TYPE_LABELS: Record<string, string> = {
  administrative: 'إداري',
  operational: 'تشغيلي',
  field: 'ميداني',
  storage: 'مخزن',
  maintenance: 'صيانة',
};

const SITE_TYPE_COLORS: Record<string, string> = {
  administrative: '#6366f1',
  operational: '#f59e0b',
  field: '#22c55e',
  storage: '#06b6d4',
  maintenance: '#ef4444',
};

export default function LocationPickerModal({
  open,
  onClose,
  onConfirm,
  initialValue,
  title = 'تحديد الموقع الجغرافي',
}: LocationPickerModalProps) {
  const {
    projects, sites,
    projectsLoading, sitesLoading,
    loadProjects, loadSites,
  } = useErpContextStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string | number | ''>(
    initialValue?.project_id ?? ''
  );
  const [selectedSiteId, setSelectedSiteId] = useState<number | ''>(
    initialValue?.site_id ?? ''
  );
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lon: number } | null>(
    initialValue?.latitude ? { lat: initialValue.latitude, lon: initialValue.longitude! } : null
  );
  const [mode, setMode] = useState<'site' | 'click'>('site');

  const mapRef = useRef<HTMLDivElement>(null);
  const olMapRef = useRef<any>(null);
  const markerSourceRef = useRef<any>(null);
  const siteSourceRef = useRef<any>(null);

  // تحميل المشاريع
  useEffect(() => {
    if (open && projects.length === 0 && !projectsLoading) {
      loadProjects();
    }
  }, [open]); // eslint-disable-line

  // تحميل المواقع عند اختيار مشروع
  useEffect(() => {
    if (selectedProjectId) {
      loadSites(selectedProjectId);
      setSelectedSiteId('');
    }
  }, [selectedProjectId]); // eslint-disable-line

  // بناء الخريطة
  useEffect(() => {
    if (!open || !mapRef.current) return;
    let cleanup: () => void;

    (async () => {
      const ol            = await import('ol');
      const View          = await import('ol/View');
      const TileLayer     = await import('ol/layer/Tile');
      const VectorLayer   = await import('ol/layer/Vector');
      const VectorSource  = await import('ol/source/Vector');
      const XYZ           = await import('ol/source/XYZ');
      const Feature       = await import('ol/Feature');
      const Point         = await import('ol/geom/Point');
      const { fromLonLat, toLonLat } = await import('ol/proj');
      const { Style, Fill, Stroke, Circle: CircleStyle, Text } = await import('ol/style');

      if (!mapRef.current || olMapRef.current) return;

      const baseLayer = new TileLayer.default({
        source: new XYZ.default({
          url: '/tiles/satellite/{z}/{y}/{x}',
          maxZoom: 19,
          attributions: 'CartoDB',
        }),
      });

      // طبقة مواقع المشروع
      const siteSource = new VectorSource.default();
      siteSourceRef.current = siteSource;
      const siteLayer = new VectorLayer.default({
        source: siteSource,
        style: (feature) => {
          const siteType = feature.get('site_type') || 'field';
          const isSelected = feature.get('site_id') === Number(selectedSiteId);
          const color = SITE_TYPE_COLORS[siteType] || '#22c55e';
          return new Style({
            image: new CircleStyle({
              radius: isSelected ? 12 : 8,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: '#fff', width: isSelected ? 3 : 1.5 }),
            }),
            text: new Text({
              text: feature.get('site_name') || '',
              font: 'bold 11px sans-serif',
              fill: new Fill({ color: '#fff' }),
              offsetY: -16,
              backgroundFill: new Fill({ color: 'rgba(15,23,42,0.85)' }),
              padding: [2, 4, 2, 4],
            }),
          });
        },
      });

      // طبقة ماركر النقر
      const markerSource = new VectorSource.default();
      markerSourceRef.current = markerSource;
      const markerLayer = new VectorLayer.default({
        source: markerSource,
        style: new Style({
          image: new CircleStyle({
            radius: 10,
            fill: new Fill({ color: '#ef4444' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        }),
      });

      const map = new ol.default({
        target: mapRef.current!,
        layers: [baseLayer, siteLayer, markerLayer],
        view: new View.default({
          center: fromLonLat([13.1913, 32.8872]),
          zoom: 8,
        }),
      });
      olMapRef.current = map;

      // Click to pick coords
      map.on('click', (evt) => {
        const coords = toLonLat(evt.coordinate);
        const [lon, lat] = coords;

        // هل نقر على موقع موجود؟
        const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
        if (feature && feature.get('site_id')) {
          setSelectedSiteId(feature.get('site_id'));
          setClickedCoords({ lat: feature.get('lat'), lon: feature.get('lon') });
          return;
        }

        if (mode === 'click') {
          setClickedCoords({ lat, lon });
          markerSource.clear();
          markerSource.addFeature(new Feature.default({
            geometry: new Point.default(fromLonLat([lon, lat])),
          }));
        }
      });

      // Cursor on hover
      map.on('pointermove', (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
        (map.getTargetElement() as HTMLElement).style.cursor = feature ? 'pointer' : '';
      });

      cleanup = () => { map.setTarget(undefined as any); olMapRef.current = null; };
    })();

    return () => { cleanup?.(); };
  }, [open]); // eslint-disable-line

  // تحديث مواقع المشروع على الخريطة
  useEffect(() => {
    if (!siteSourceRef.current || !olMapRef.current) return;

    (async () => {
      const Feature = await import('ol/Feature');
      const Point   = await import('ol/geom/Point');
      const { fromLonLat } = await import('ol/proj');

      siteSourceRef.current.clear();
      const sitesWithCoords = sites.filter(
        (s: ErpSite & { latitude?: number; longitude?: number }) =>
          (s as any).latitude && (s as any).longitude
      );
      for (const s of sitesWithCoords as any[]) {
        siteSourceRef.current.addFeature(new Feature.default({
          geometry: new Point.default(fromLonLat([s.longitude, s.latitude])),
          site_id: s.id,
          site_name: s.name,
          site_type: s.site_type,
          lat: s.latitude,
          lon: s.longitude,
        }));
      }

      // انتقل إلى مركز المواقع
      if (sitesWithCoords.length > 0) {
        const { fromLonLat: fl } = await import('ol/proj');
        const avgLon = sitesWithCoords.reduce((a: number, s: any) => a + s.longitude, 0) / sitesWithCoords.length;
        const avgLat = sitesWithCoords.reduce((a: number, s: any) => a + s.latitude, 0) / sitesWithCoords.length;
        olMapRef.current?.getView().animate({ center: fl([avgLon, avgLat]), zoom: 12, duration: 600 });
      }

      olMapRef.current?.getLayers()?.getArray()[1]?.changed();
    })();
  }, [sites, selectedSiteId]);

  // إضافة ماركر الإحداثيات المبدئية
  useEffect(() => {
    if (!open || !clickedCoords || !markerSourceRef.current) return;
    (async () => {
      const Feature = await import('ol/Feature');
      const Point   = await import('ol/geom/Point');
      const { fromLonLat } = await import('ol/proj');
      markerSourceRef.current.clear();
      markerSourceRef.current.addFeature(new Feature.default({
        geometry: new Point.default(fromLonLat([clickedCoords.lon, clickedCoords.lat])),
      }));
    })();
  }, [clickedCoords, open]);

  const handleConfirm = useCallback(() => {
    if (!selectedProjectId) return;

    const project = projects.find(p => p.id == selectedProjectId);
    const site = sites.find((s: ErpSite) => s.id === Number(selectedSiteId)) as any;

    let lat = clickedCoords?.lat || 0;
    let lon = clickedCoords?.lon || 0;
    if (site?.latitude) { lat = site.latitude; lon = site.longitude; }

    if (!lat || !lon) {
      alert('يرجى اختيار موقع على الخريطة أو تحديد موقع من القائمة');
      return;
    }

    onConfirm({
      project_id: selectedProjectId,
      project_name: project?.project_name || project?.name || '',
      site_id: selectedSiteId ? Number(selectedSiteId) : undefined,
      site_name: site?.name,
      latitude: lat,
      longitude: lon,
    });
    onClose();
  }, [selectedProjectId, selectedSiteId, clickedCoords, projects, sites, onConfirm, onClose]);

  if (!open) return null;

  const selectedSite = sites.find((s: ErpSite) => s.id === Number(selectedSiteId)) as any;
  const hasLocation = !!(
    (selectedSiteId && selectedSite?.latitude) ||
    (mode === 'click' && clickedCoords)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col"
        style={{ maxHeight: '90vh' }}>
        {/* رأس */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-slate-100">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* شريط الإعدادات */}
          <div className="w-64 flex-shrink-0 border-l border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto">
            {/* اختيار المشروع */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> المشروع *
              </label>
              <div className="relative">
                <select
                  value={String(selectedProjectId)}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 appearance-none focus:outline-none focus:border-blue-500"
                >
                  <option value="">— اختر مشروعاً —</option>
                  {projects.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.project_name || p.name}
                    </option>
                  ))}
                </select>
                {projectsLoading && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin absolute left-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>

            {/* اختيار الموقع */}
            {selectedProjectId && (
              <div>
                <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> الموقع
                </label>
                {sitesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>تحميل المواقع...</span>
                  </div>
                ) : sites.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">لا توجد مواقع لهذا المشروع</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {sites.map((s: ErpSite & { latitude?: number; longitude?: number }) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedSiteId(s.id);
                          if ((s as any).latitude) {
                            setClickedCoords({ lat: (s as any).latitude, lon: (s as any).longitude });
                          }
                        }}
                        className={`w-full text-right px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                          selectedSiteId === s.id
                            ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                            : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-transparent'
                        }`}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: SITE_TYPE_COLORS[s.site_type] || '#22c55e' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{s.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {SITE_TYPE_LABELS[s.site_type] || s.site_type}
                            {!(s as any).latitude && ' · بدون إحداثيات'}
                          </div>
                        </div>
                        {selectedSiteId === s.id && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* وضع النقر على الخريطة */}
            <div className="border-t border-slate-700 pt-3">
              <label className="text-xs text-slate-400 mb-2 block">طريقة تحديد الإحداثيات</label>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="mode" value="site"
                    checked={mode === 'site'}
                    onChange={() => setMode('site')}
                    className="accent-blue-500"
                  />
                  <span className="text-xs text-slate-300">من الموقع المحدد</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="mode" value="click"
                    checked={mode === 'click'}
                    onChange={() => setMode('click')}
                    className="accent-blue-500"
                  />
                  <span className="text-xs text-slate-300">نقر على الخريطة</span>
                </label>
              </div>
              {mode === 'click' && (
                <p className="text-[10px] text-amber-400 mt-1.5">
                  انقر على الخريطة لتحديد الإحداثيات
                </p>
              )}
            </div>

            {/* الإحداثيات المحددة */}
            {clickedCoords && (
              <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700">
                <p className="text-[10px] text-slate-400 mb-1">الإحداثيات المحددة</p>
                <p className="text-xs font-mono text-slate-200">
                  {clickedCoords.lat.toFixed(6)}, {clickedCoords.lon.toFixed(6)}
                </p>
              </div>
            )}
          </div>

          {/* الخريطة */}
          <div className="flex-1 relative min-h-[350px]">
            <div ref={mapRef} className="absolute inset-0" />
            {mode === 'click' && (
              <div className="absolute top-2 right-2 bg-slate-900/90 border border-slate-600 rounded-lg px-2 py-1 text-[10px] text-amber-300 pointer-events-none">
                انقر لتحديد الموقع
              </div>
            )}
          </div>
        </div>

        {/* أزرار التأكيد */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <div className="text-xs text-slate-400">
            {!selectedProjectId
              ? 'يجب اختيار مشروع'
              : !hasLocation
                ? 'يجب تحديد موقع جغرافي'
                : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    الموقع محدد
                  </span>
                )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedProjectId || !hasLocation}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              تأكيد الموقع
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
