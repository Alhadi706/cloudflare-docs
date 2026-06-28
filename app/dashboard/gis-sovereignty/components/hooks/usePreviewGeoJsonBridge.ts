import { useEffect } from 'react';
import type { RefObject } from 'react';

type AnyRef<T> = RefObject<T>;

type PreviewMode = 'both' | 'centerline' | 'corridor';

function isDigitizationFeature(f: any): boolean {
  const id = String(f?.id || '').toLowerCase();
  const src = String(f?.properties?.source || '').toLowerCase();
  const kind = String(f?.properties?.feature_kind || '').toLowerCase();
  return src === 'image_to_map_engine' || id === 'pipeline-row' || id === 'pipeline-centerline' || kind === 'centerline';
}

function applyPreviewMode(fc: any, mode: PreviewMode): any {
  if (!fc || !Array.isArray(fc.features)) return fc;
  const hasDigitization = fc.features.some((f: any) => isDigitizationFeature(f));
  if (!hasDigitization || mode === 'both') return fc;

  const filtered = fc.features.filter((f: any) => {
    const id = String(f?.id || '').toLowerCase();
    const kind = String(f?.properties?.feature_kind || '').toLowerCase();
    const geomType = String(f?.geometry?.type || '');

    if (mode === 'centerline') {
      return id === 'pipeline-centerline' || kind === 'centerline' || geomType === 'LineString' || geomType === 'MultiLineString';
    }
    if (mode === 'corridor') {
      return id === 'pipeline-row' || geomType === 'Polygon' || geomType === 'MultiPolygon';
    }
    return true;
  });

  return { ...fc, features: filtered };
}

export function usePreviewGeoJsonBridge(
  layersRef: AnyRef<Record<string, any>>,
  mapRef: AnyRef<any>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;

    const drawSource = layersRef.current?.drawSource;
    if (!drawSource) return;

    let disposed = false;
    let lastFeatureCollection: any = null;
    let previewMode: PreviewMode = 'both';

    const renderFeatureCollection = async (fc: any) => {
      if (disposed || !fc || !Array.isArray(fc.features)) return;
      const applied = applyPreviewMode(fc, previewMode);
      const GeoJSONAny: any = (await import('ol/format/GeoJSON')).default;
      const fmt = new GeoJSONAny();
      drawSource.clear();
      let feats: any[] = [];
      try {
        feats = fmt.readFeatures(applied, { featureProjection: 'EPSG:3857' });
      } catch (err) {
        console.warn('[engineering:preview-geojson] invalid feature collection', err);
        return;
      }
      drawSource.addFeatures(feats);

      const mapInst = mapRef.current;
      if (mapInst && feats.length > 0) {
        const extent = drawSource.getExtent();
        if (extent && isFinite(extent[0])) {
          mapInst.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 17, duration: 600 });
        }
      }
    };

    const handlePreview = async (ev: Event) => {
      if (disposed) return;
      const custom = ev as CustomEvent<{ featureCollection?: { type: string; features: unknown[] }; geojson?: { type: string; features: unknown[] } }>;
      const fc = custom.detail?.featureCollection || custom.detail?.geojson;
      if (!fc || !Array.isArray(fc.features)) return;
      lastFeatureCollection = fc;
      await renderFeatureCollection(fc);
    };

    const handlePreviewMode = async (ev: Event) => {
      if (disposed) return;
      const custom = ev as CustomEvent<{ mode?: PreviewMode }>;
      const mode = custom.detail?.mode;
      if (!mode) return;
      previewMode = mode;
      if (lastFeatureCollection) {
        await renderFeatureCollection(lastFeatureCollection);
      }
    };

    const handleClear = () => {
      if (disposed) return;
      drawSource.clear();
      lastFeatureCollection = null;
    };

    window.addEventListener('engineering:preview-geojson', handlePreview as EventListener);
    window.addEventListener('engineering:set-preview-mode', handlePreviewMode as EventListener);
    window.addEventListener('engineering:clear-preview', handleClear as EventListener);
    return () => {
      disposed = true;
      window.removeEventListener('engineering:preview-geojson', handlePreview as EventListener);
      window.removeEventListener('engineering:set-preview-mode', handlePreviewMode as EventListener);
      window.removeEventListener('engineering:clear-preview', handleClear as EventListener);
    };
  }, [enabled, layersRef, mapRef]);
}
