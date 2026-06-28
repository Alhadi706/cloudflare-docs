'use client';
/**
 * GisNotifMap — خريطة تفاعلية بـ OpenLayers لعرض بيانات GeoJSON على صور القمر الصناعي
 */
import React, { useEffect, useRef } from 'react';

export default function GisNotifMap({ geojson }: { geojson: any }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olRef  = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || !geojson) return;

    (async () => {
      const [
        { default: Map },
        { default: View },
        { default: TileLayer },
        { default: VectorLayer },
        { default: XYZ },
        { default: VectorSource },
        { default: GeoJSON },
        { default: Style },
        { default: Fill },
        { default: Stroke },
        { fromLonLat },
        { getCenter },
      ] = await Promise.all([
        import('ol/Map'),
        import('ol/View'),
        import('ol/layer/Tile'),
        import('ol/layer/Vector'),
        import('ol/source/XYZ'),
        import('ol/source/Vector'),
        import('ol/format/GeoJSON'),
        import('ol/style/Style'),
        import('ol/style/Fill'),
        import('ol/style/Stroke'),
        import('ol/proj'),
        import('ol/extent'),
      ]);

      // طبقة القمر الصناعي عبر proxy المحلي
      const satelliteLayer = new TileLayer({
        source: new XYZ({
          url: '/tiles/satellite/{z}/{y}/{x}',
          maxZoom: 19,
          crossOrigin: 'anonymous',
        }),
      });

      // طبقة GeoJSON
      const vectorSource = new VectorSource({
        features: new GeoJSON().readFeatures(geojson, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        }),
      });

      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: (feature: any) => {
          const props = feature.getProperties();
          const sev = props?.severity ?? props?.properties?.severity ?? '';
          const isCrit = sev === 'critical';
          return new Style({
            fill:   new Fill({ color: isCrit ? 'rgba(239,68,68,0.30)' : 'rgba(245,158,11,0.30)' }),
            stroke: new Stroke({ color: isCrit ? '#ef4444' : '#f59e0b', width: 2.5 }),
          });
        },
      });

      const extent = vectorSource.getExtent();
      const centre = Number.isFinite(extent[0]) ? getCenter(extent) : fromLonLat([13.19, 32.9]);

      const map = new Map({
        target: mapRef.current!,
        layers: [satelliteLayer, vectorLayer],
        view: new View({
          center: centre,
          zoom: 14,
          minZoom: 4,
          maxZoom: 19,
        }),
        controls: [],
      });

      if (Number.isFinite(extent[0])) {
        map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 17, duration: 600 });
      }

      olRef.current = map;
    })();

    return () => {
      if (olRef.current) {
        olRef.current.setTarget(undefined);
        olRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomIn  = () => { const v = olRef.current?.getView(); if (v) v.animate({ zoom: (v.getZoom() ?? 14) + 1, duration: 250 }); };
  const zoomOut = () => { const v = olRef.current?.getView(); if (v) v.animate({ zoom: (v.getZoom() ?? 14) - 1, duration: 250 }); };

  return (
    <div className="space-y-1.5" dir="rtl">
      <div className="relative overflow-hidden rounded-xl" style={{ height: 340 }}>
        <style>{`.ol-viewport { touch-action: none; } .ol-overlaycontainer-stopevent, .ol-overlaycontainer { display: none !important; }`}</style>
        <div ref={mapRef} className="h-full w-full bg-slate-900" />

        {/* أزرار التكبير والتصغير */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
          <button
            onClick={zoomIn}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-600/60 bg-slate-900/85 text-xl font-bold text-white shadow-lg backdrop-blur-sm active:bg-slate-700"
          >+</button>
          <button
            onClick={zoomOut}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-600/60 bg-slate-900/85 text-xl font-bold text-white shadow-lg backdrop-blur-sm active:bg-slate-700"
          >−</button>
        </div>

        {/* مفتاح الألوان */}
        <div className="absolute bottom-2.5 right-2.5 z-10 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-200 backdrop-blur-sm shadow">
            <span className="h-3 w-3 shrink-0 rounded-sm border border-red-400 bg-red-500/60" />حدث حرج
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-200 backdrop-blur-sm shadow">
            <span className="h-3 w-3 shrink-0 rounded-sm border border-amber-400 bg-amber-500/60" />تحذير
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-slate-600">
        المناطق الملوّنة هي مواقع الأحداث المرصودة — اسحب للتنقل، قرِّب للتفاصيل
      </p>
    </div>
  );
}
