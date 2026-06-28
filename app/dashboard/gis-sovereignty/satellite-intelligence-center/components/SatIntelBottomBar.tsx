'use client';
// ─── SatIntelBottomBar ────────────────────────────────────────────────────────
// Status strip — coordinates, zoom, freshness, scene count, system status.
// Engineering Workspace BottomPanel pattern.

import React from 'react';
import { Target, ZoomIn, Globe2, Satellite, Wifi, WifiOff } from 'lucide-react';

interface Props {
  lon:           number | null;
  lat:           number | null;
  zoom:          number | null;
  freshnessLabel: string;
  systemOnline:  boolean;
  sceneCount:    number;
}

export default function SatIntelBottomBar({
  lon, lat, zoom, freshnessLabel, systemOnline, sceneCount,
}: Props) {
  return (
    <div className="h-7 shrink-0 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-4 text-[10px] text-slate-500 z-10 gap-4 overflow-hidden">

      {/* Left: coordinates + zoom */}
      <div className="flex items-center gap-4 shrink-0">
        {lon != null && lat != null && (
          <div className="flex items-center gap-1.5">
            <Target size={11} className="text-slate-600" />
            <span className="font-mono tabular-nums">
              {lat.toFixed(4)}°N&nbsp;&nbsp;{lon.toFixed(4)}°E
            </span>
          </div>
        )}
        {zoom != null && (
          <div className="flex items-center gap-1.5">
            <ZoomIn size={11} className="text-slate-600" />
            <span>مستوى {zoom.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Center: freshness */}
      <div className="flex items-center gap-1.5 flex-1 justify-center">
        <Globe2 size={11} className="text-slate-600 shrink-0" />
        <span className="truncate">{freshnessLabel}</span>
      </div>

      {/* Right: scene count + system status + CRS */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <Satellite size={11} className="text-slate-600" />
          <span>{sceneCount} صورة فضائية</span>
        </div>
        <div className="flex items-center gap-1.5">
          {systemOnline
            ? <Wifi size={11} className="text-emerald-500" />
            : <WifiOff size={11} className="text-slate-600" />
          }
          <div className={`w-1.5 h-1.5 rounded-full ${systemOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className={systemOnline ? 'text-emerald-600' : ''}>
            {systemOnline ? 'متصل' : 'غير متصل'}
          </span>
        </div>
        <span className="text-slate-700">EPSG:3857</span>
      </div>
    </div>
  );
}
