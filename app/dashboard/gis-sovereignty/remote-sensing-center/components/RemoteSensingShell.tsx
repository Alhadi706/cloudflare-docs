'use client';
/**
 * Remote Sensing Center — مركز الاستشعار عن بُعد
 * ═══════════════════════════════════════════════
 * 3 وحدات متكاملة تضاهي ArcGIS Pro Advanced V3.6:
 *  1) Spatial Analyst  — تحليل مكاني متقدم + Raster + هيدرولوجيا
 *  2) Image Analyst    — معالجة صور فضائية + مؤشرات طيفية + تصنيف
 *  3) 3D Analyst       — نمذجة DEM/DSM + تحليل التضاريس + مسار الرؤية
 */

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useGisEngine } from '@/store/gisEngine';
import { GisWorkspaceSwitcher } from '../../components/GisWorkspaceSwitcher';
import RSCTopBar from './RSCTopBar';
import RSCLeftPanel from './RSCLeftPanel';
import RSCRightPanel from './RSCRightPanel';
import RSCStatusBar from './RSCStatusBar';

const MapCenterCanvas = dynamic(() => import('../../components/MapCenterCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  ),
});

export type RSCModule = 'spatial' | 'image' | '3d';
export type RSCTool =
  // Spatial Analyst
  | 'sa_none' | 'sa_buffer' | 'sa_overlay' | 'sa_watershed' | 'sa_slope'
  | 'sa_hillshade' | 'sa_aspect' | 'sa_density' | 'sa_interpolate' | 'sa_profile'
  // Image Analyst
  | 'ia_none' | 'ia_ndvi' | 'ia_ndwi' | 'ia_savi' | 'ia_evi' | 'ia_nbr'
  | 'ia_classify' | 'ia_change' | 'ia_pansharp' | 'ia_histogram'
  // 3D Analyst
  | '3d_none' | '3d_contour' | '3d_viewshed' | '3d_los' | '3d_cut_fill'
  | '3d_skyline' | '3d_profile' | '3d_shadow';

export default function RemoteSensingShell() {
  const setWorkspace = useGisEngine(s => s.setWorkspace);
  const refreshAll   = useGisEngine(s => s.refreshAll);

  const [activeModule, setActiveModule] = useState<RSCModule>('spatial');
  const [activeTool,   setActiveTool]   = useState<RSCTool>('sa_none');
  const [leftOpen,     setLeftOpen]     = useState(true);
  const [rightOpen,    setRightOpen]    = useState(true);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [processing,   setProcessing]   = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lon: number; lat: number } | null>(null);

  useEffect(() => {
    setWorkspace('remote_sensing');
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden" dir="rtl">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <RSCTopBar
        activeModule={activeModule}
        setActiveModule={(m) => { setActiveModule(m); setActiveTool(m === 'spatial' ? 'sa_none' : m === 'image' ? 'ia_none' : '3d_none'); }}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        processing={processing}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        toggleLeft={() => setLeftOpen(p => !p)}
        toggleRight={() => setRightOpen(p => !p)}
      />

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left panel — layers + tools */}
        {leftOpen && (
          <RSCLeftPanel
            activeModule={activeModule}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            processing={processing}
            setProcessing={setProcessing}
            setAnalysisResult={setAnalysisResult}
          />
        )}

        {/* Map */}
        <div className="flex-1 relative min-w-0">
          <MapCenterCanvas hideControls={false} />
          {/* Module badge */}
          <div className="absolute top-3 left-3 z-30 pointer-events-none">
            <span className={[
              'px-2.5 py-1 rounded text-[11px] font-bold backdrop-blur-sm border',
              activeModule === 'spatial' ? 'bg-blue-900/80 border-blue-500/50 text-blue-200' :
              activeModule === 'image'   ? 'bg-emerald-900/80 border-emerald-500/50 text-emerald-200' :
                                          'bg-purple-900/80 border-purple-500/50 text-purple-200',
            ].join(' ')}>
              {activeModule === 'spatial' ? '⚙ Spatial Analyst' :
               activeModule === 'image'   ? '🛰 Image Analyst' :
                                            '🧊 3D Analyst'}
            </span>
          </div>
          {/* Processing overlay */}
          {processing && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
              <div className="bg-slate-900 border border-cyan-500/50 rounded-xl px-6 py-4 flex items-center gap-3 shadow-2xl">
                <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                <span className="text-cyan-300 text-sm font-semibold">جاري المعالجة…</span>
              </div>
            </div>
          )}
        </div>

        {/* Right panel — results + params */}
        {rightOpen && (
          <RSCRightPanel
            activeModule={activeModule}
            activeTool={activeTool}
            analysisResult={analysisResult}
            processing={processing}
            setProcessing={setProcessing}
            setAnalysisResult={setAnalysisResult}
          />
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <RSCStatusBar activeModule={activeModule} activeTool={activeTool} processing={processing} />
    </div>
  );
}
