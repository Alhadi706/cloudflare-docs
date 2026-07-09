'use client';
/**
 * محطة المراقبة الفضائية
 * ═══════════════════════════════════════════
 * خريطة كاملة مع مبدّل مصدر الصور الفضائية
 */

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Satellite, Layers, ChevronDown } from 'lucide-react';
import { useGisEngine, BASEMAPS, type BasemapKey } from '@/store/gisEngine';
import { GisErrorBoundary } from '../components/GisErrorBoundary';
import { GisWorkspaceSwitcher } from '../components/GisWorkspaceSwitcher';

const MapCenterCanvas = dynamic(() => import('../components/MapCenterCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  ),
});

const SOURCES: { key: BasemapKey; icon: string; desc: string; group: string }[] = [
  // Esri / base
  { key: 'satellite', icon: '🛰️', desc: 'Esri (ثابتة، دقة عالية)',       group: 'خرائط أساسية' },
  { key: 'terrain',   icon: '🏔️', desc: 'OpenTopoMap DEM',                 group: 'خرائط أساسية' },
  { key: 'road',      icon: '🗺️', desc: 'OpenStreetMap',                   group: 'خرائط أساسية' },
  { key: 'dark',      icon: '🌑', desc: 'CartoDB Dark',                    group: 'خرائط أساسية' },
  // Sentinel-2 live
  { key: 's2_tci',   icon: '📸', desc: 'لون حقيقي — متجدد كل 5 أيام',   group: 'Sentinel-2 (حي)' },
  { key: 's2_ndvi',  icon: '🌿', desc: 'NDVI غطاء نباتي',                 group: 'Sentinel-2 (حي)' },
  { key: 's2_ndwi',  icon: '💧', desc: 'NDWI مؤشر المياه',                group: 'Sentinel-2 (حي)' },
  { key: 's2_cir',   icon: '🔴', desc: 'أشعة تحت حمراء CIR',              group: 'Sentinel-2 (حي)' },
  { key: 's2_swir',  icon: '🟠', desc: 'SWIR حرارة / بيولوجيا',          group: 'Sentinel-2 (حي)' },
  // Sentinel-1 SAR
  { key: 's1_sar',   icon: '📡', desc: 'رادار VV — يخترق الغيوم والليل', group: 'Sentinel-1 SAR (حي)' },
  { key: 's1_rgb',   icon: '🎨', desc: 'رادار RGB (VV+VH) — مركب',       group: 'Sentinel-1 SAR (حي)' },
  // DEM
  { key: 'dem',       icon: '🏔️', desc: 'ارتفاع التضاريس — Copernicus 30م', group: 'بيانات إضافية' },
  { key: 'hillshade', icon: '🌄', desc: 'تظليل التضاريس (Relief)',           group: 'بيانات إضافية' },
];

function SatelliteMonitorContent() {
  const setWorkspace = useGisEngine(s => s.setWorkspace);
  const setCenter    = useGisEngine(s => s.setCenter);
  const setZoom      = useGisEngine(s => s.setZoom);
  const basemap      = useGisEngine(s => s.basemap);
  const setBasemap   = useGisEngine(s => s.setBasemap);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setWorkspace('monitor');
    // Center on Libya — zoom 8 = مستوى مناسب لرؤية ليبيا مع تفاصيل Sentinel
    setCenter([17.0, 27.0]);
    setZoom(8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = SOURCES.find(s => s.key === basemap) ?? SOURCES[0];

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/90 shrink-0" dir="rtl">
        <Satellite className="w-4 h-4 text-purple-400" />
        <h1 className="text-sm font-bold text-white">عرض صور الأقمار الاصطناعية</h1>
        <GisWorkspaceSwitcher />
        <div className="flex-1" />
        {/* Source picker */}
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:border-slate-500 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>{current.icon} {BASEMAPS[basemap]?.labelAr ?? basemap}</span>
            <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-y-auto max-h-96" dir="rtl">
              {/* Group sources */}
              {Array.from(new Set(SOURCES.map(s => s.group))).map(group => (
                <div key={group}>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                    {group}
                  </div>
                  {SOURCES.filter(s => s.group === group).map(({ key, icon, desc }) => (
                    <button
                      key={key}
                      onClick={() => { setBasemap(key); setOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-slate-700 ${
                        basemap === key ? 'bg-purple-500/20 text-purple-300 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <span className="text-sm">{icon}</span>
                      <div className="flex-1 text-right">
                        <div className="font-semibold">{BASEMAPS[key]?.labelAr ?? key}</div>
                        <div className="text-[10px] text-slate-500">{desc}</div>
                      </div>
                      {basemap === key && <span className="text-purple-400 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Full-screen map */}
      <div className="flex-1 relative overflow-hidden">
        {open && <div className="absolute inset-0 z-40" onClick={() => setOpen(false)} />}
        <MapCenterCanvas />
      </div>
    </div>
  );
}

export default function GisSatelliteMonitorPage() {
  return (
    <GisErrorBoundary title="تعذر تحميل محطة المراقبة الفضائية">
      <SatelliteMonitorContent />
    </GisErrorBoundary>
  );
}
