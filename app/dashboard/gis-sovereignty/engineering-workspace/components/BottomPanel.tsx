'use client';
import React, { useState, useEffect } from 'react';
import { Target, Maximize, Orbit, PenTool } from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';

const DRAWING_LABELS: Record<string, string> = {
  idle:                'تحديد',
  point:               '▸ ارسم نقطة على الخريطة',
  line:                '▸ انقر لبدء الخط — انقر مرتين لإنهائه',
  polygon:             '▸ انقر لإضافة رؤوس المضلع — أغلق بالنقر على النقطة الأولى',
  'measure-distance':  '▸ انقر لقياس المسافة',
  'measure-area':      '▸ ارسم مضلعاً لحساب المساحة',
  'inspect-coordinate':'▸ انقر على الخريطة لفحص الإحداثيات',
  delete:              '▸ انقر على معلم لحذفه',
};

// Approximate scale denominator from zoom level (WGS84 at equator)
function zoomToScale(zoom: number): string {
  const scale = Math.round(559082264 / Math.pow(2, zoom));
  if (scale >= 1_000_000) return `1:${(scale / 1_000_000).toFixed(1)}M`;
  if (scale >= 1_000)     return `1:${(scale / 1_000).toFixed(0)}K`;
  return `1:${scale}`;
}

export default function BottomPanel() {
  const zoom        = useGisEngine(s => s.zoom);
  const drawingMode = useGisEngine(s => s.drawingMode);

  const [cursor, setCursor] = useState<{ lon: number; lat: number } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { lon, lat } = (e as CustomEvent).detail;
      setCursor({ lon, lat });
    };
    window.addEventListener('gis:cursor-coords', handler);
    return () => window.removeEventListener('gis:cursor-coords', handler);
  }, []);

  const hint = drawingMode !== 'idle' ? DRAWING_LABELS[drawingMode] : null;

  return (
    <div className="h-8 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-4 text-xs text-slate-500 z-10 shrink-0" dir="ltr">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Target size={13} className="text-slate-400" />
          <span className="font-mono tabular-nums">
            {cursor
              ? `${cursor.lat.toFixed(5)}, ${cursor.lon.toFixed(5)}`
              : '— حرّك المؤشر فوق الخريطة —'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Orbit size={13} className="text-slate-400" />
          <span>Zoom: {zoom}</span>
        </div>
        <div className="flex items-center gap-2">
          <Maximize size={13} className="text-slate-400" />
          <span>{zoomToScale(zoom)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {hint && (
          <div className="flex items-center gap-1.5 text-cyan-400 animate-pulse">
            <PenTool size={12} />
            <span dir="rtl">{hint}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span dir="rtl">OpenLayers</span>
        </div>
        <span>EPSG:3857</span>
      </div>
    </div>
  );
}
