'use client';
/**
 * مختبر التحليل المكاني
 * ═══════════════════════════════════════════
 * خريطة + تضاريس 3D | ملاءمة | مسار أمثل
 */

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Mountain, Target, Route } from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';
import { GisErrorBoundary } from '../components/GisErrorBoundary';
import { GisWorkspaceSwitcher } from '../components/GisWorkspaceSwitcher';

const MapCenterCanvas = dynamic(() => import('../components/MapCenterCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  ),
});

const SuitabilityPanel = dynamic(
  () => import('../satellite-intelligence-center/components/SuitabilityPanel'),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" /></div> },
);
const Terrain3DPanel = dynamic(
  () => import('../satellite-intelligence-center/components/Terrain3DPanel'),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div> },
);
const OptimalPathPanel = dynamic(
  () => import('../satellite-intelligence-center/components/OptimalPathPanel'),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div> },
);

type Tool = 'terrain' | 'suitability' | 'routing';

const TOOLS: { key: Tool; labelAr: string; Icon: React.ElementType; color: string }[] = [
  { key: 'terrain',     labelAr: 'تحليل التضاريس', Icon: Mountain, color: 'text-amber-400' },
  { key: 'suitability', labelAr: 'تحليل الملاءمة', Icon: Target,   color: 'text-green-400' },
  { key: 'routing',     labelAr: 'المسار الأمثل',  Icon: Route,    color: 'text-blue-400'  },
];

function SpatialAnalyticsContent() {
  const setWorkspace = useGisEngine(s => s.setWorkspace);
  const setCenter    = useGisEngine(s => s.setCenter);

  const [activeTool, setActiveTool] = useState<Tool>('terrain');
  const [routingPickMode, setRoutingPickMode] = useState<'idle' | 'picking_start' | 'picking_end'>('idle');
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint,   setEndPoint]   = useState<[number, number] | null>(null);

  useEffect(() => { setWorkspace('spatial'); }, []);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/90 shrink-0" dir="rtl">
        <h1 className="text-sm font-bold text-white">التخطيط العمراني ودراسات المواقع</h1>
        <GisWorkspaceSwitcher />
        <div className="flex-1" />
        {TOOLS.map(({ key, labelAr, Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTool(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              activeTool === key
                ? 'bg-slate-700 border-slate-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${activeTool === key ? color : ''}`} />
            {labelAr}
          </button>
        ))}
      </div>
      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          <MapCenterCanvas />
        </div>
        <div className="w-80 shrink-0 bg-slate-900 border-r border-slate-800 overflow-y-auto" dir="rtl">
          {activeTool === 'terrain'     && <Terrain3DPanel />}
          {activeTool === 'suitability' && (
            <SuitabilityPanel onFlyTo={(lon: number, lat: number) => setCenter([lon, lat])} />
          )}
          {activeTool === 'routing' && (
            <OptimalPathPanel
              routingPickMode={routingPickMode}
              startPoint={startPoint}
              endPoint={endPoint}
              onStartPicking={(w: 'start' | 'end') =>
                setRoutingPickMode(w === 'start' ? 'picking_start' : 'picking_end')
              }
              onClearPoints={() => { setStartPoint(null); setEndPoint(null); setRoutingPickMode('idle'); }}
              onResultReady={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function GisSpatialAnalyticsPage() {
  return (
    <GisErrorBoundary title="تعذر تحميل مختبر التحليل المكاني">
      <SpatialAnalyticsContent />
    </GisErrorBoundary>
  );
}
