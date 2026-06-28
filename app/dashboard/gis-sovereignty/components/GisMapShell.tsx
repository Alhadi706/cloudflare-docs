'use client';
/**
 * GisMapShell — غلاف مساحة العمل الجغرافي الموحد
 * ════════════════════════════════════════════════
 * يجمع: شريط أعلى، مدير الطبقات، محرك الزمن، المحرك المركزي.
 * جميع الأوضاع (satellite/engineering/maintenance/executive/spatial/monitor)
 * تستخدم نفس الغلاف — فقط workspace يختلف في gisEngine.
 */

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Layers, Clock, AlertTriangle, RefreshCw, Map, ChevronDown } from 'lucide-react';
import { GisWorkspaceSwitcher } from './GisWorkspaceSwitcher';
import { useGisEngine, BASEMAPS, type GisWorkspace, type BasemapKey } from '@/store/gisEngine';

// Lazy load heavy components
const MapCenterCanvas = dynamic(() => import('./MapCenterCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  ),
});
const GisLayerManager  = dynamic(() => import('./GisLayerManager'),  { ssr: false });
const GisTimeEngine    = dynamic(() => import('./GisTimeEngine'),    { ssr: false });
const GisBindingPanel  = dynamic(() => import('./GisBindingPanel'),  { ssr: false });
const GisLayerGovernancePanel = dynamic(() => import('./GisLayerGovernancePanel'), { ssr: false });

// ── Workspace labels ──────────────────────────────────────────────────────────
const WS_LABELS: Record<GisWorkspace, { title: string; subtitle: string }> = {
  satellite:      { title: 'مركز الاستخبارات الفضائية',       subtitle: 'SIC — تحليل المشاهد والكشف الطيفي' },
  engineering:    { title: 'مساحة العمل الهندسية',             subtitle: 'رسم + تحرير + إدارة الطبقات' },
  maintenance:    { title: 'مساحة العمل الصيانية',             subtitle: 'فرق العمل والأصول وأوامر التشغيل' },
  executive:      { title: 'مركز القيادة التنفيذي',            subtitle: 'مؤشرات وخرائط حرارية للقرار' },
  spatial:        { title: 'التحليل المكاني المتقدم',          subtitle: 'استكشاف جغرافي متعدد الأبعاد' },
  monitor:        { title: 'وحدة المراقبة متعددة المصادر',    subtitle: 'Sentinel-2 + Sentinel-1 + Landsat' },
  remote_sensing: { title: 'مركز الاستشعار عن بُعد',          subtitle: 'تحليل مكاني · معالجة صور · نمذجة ثلاثية الأبعاد' },
};

export function GisMapShell({
  mode,
  title: titleProp,
  subtitle: subtitleProp,
}: {
  mode: GisWorkspace;
  title?: string;
  subtitle?: string;
}) {
  const setWorkspace  = useGisEngine(s => s.setWorkspace);
  const setBasemap    = useGisEngine(s => s.setBasemap);
  const basemap       = useGisEngine(s => s.basemap);
  const workspace     = useGisEngine(s => s.workspace);
  const layerPanel    = useGisEngine(s => s.layerPanelOpen);
  const timePanel     = useGisEngine(s => s.timePanelOpen);
  const governancePanel = useGisEngine(s => s.governancePanelOpen);
  const toggleLayer   = useGisEngine(s => s.toggleLayerPanel);
  const toggleTime    = useGisEngine(s => s.toggleTimePanel);
  const toggleGovernance = useGisEngine(s => s.toggleGovernancePanel);
  const violations    = useGisEngine(s => s.violations);
  const refreshAll    = useGisEngine(s => s.refreshAll);

  const { title, subtitle } = WS_LABELS[mode] ?? { title: titleProp ?? '', subtitle: subtitleProp ?? '' };

  // Sync workspace into engine when shell mounts
  useEffect(() => {
    if (workspace !== mode) setWorkspace(mode);
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden" dir="rtl">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm flex-shrink-0 h-12">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold truncate">{title}</h1>
          <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>
        </div>

        {/* Workspace switcher */}
        <GisWorkspaceSwitcher />

        {/* Basemap selector */}
        <div className="relative flex items-center">
          <Map className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
          <select
            value={basemap}
            onChange={e => setBasemap(e.target.value as BasemapKey)}
            className="h-8 pl-2 pr-7 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200 appearance-none focus:outline-none focus:border-blue-500"
          >
            {(Object.keys(BASEMAPS) as BasemapKey[]).map(k => (
              <option key={k} value={k}>{BASEMAPS[k].labelAr}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
        </div>

        {/* Layer panel toggle */}
        <button
          onClick={toggleLayer}
          className={`h-8 px-2.5 rounded text-xs flex items-center gap-1.5 border transition-colors ${layerPanel ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
        >
          <Layers className="w-3.5 h-3.5" />الطبقات
        </button>

        {/* Time engine toggle */}
        <button
          onClick={toggleTime}
          className={`h-8 px-2.5 rounded text-xs flex items-center gap-1.5 border transition-colors ${timePanel ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
        >
          <Clock className="w-3.5 h-3.5" />الزمن
        </button>

        {/* Governance panel toggle */}
        <button
          onClick={toggleGovernance}
          className={`h-8 px-2.5 rounded text-xs flex items-center gap-1.5 border transition-colors ${governancePanel ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />الحوكمة
        </button>

        {/* Violations badge */}
        {violations.filter(v => v.severity === 'error').length > 0 && (
          <button
            onClick={() => useGisEngine.getState().toggleViolationPanel()}
            className="h-8 px-2.5 rounded text-xs flex items-center gap-1.5 bg-red-900/40 border border-red-700 text-red-300 hover:bg-red-900/60 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {violations.filter(v => v.severity === 'error').length}
          </button>
        )}

        {/* Refresh */}
        <button
          onClick={refreshAll}
          className="h-8 w-8 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
          title="تحديث البيانات"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Time engine bar (collapsible) ────────────────────────────────── */}
      {timePanel && <GisTimeEngine />}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">

        {/* Layer manager (left panel) */}
        {layerPanel && <GisLayerManager />}

        {/* Governance manager (left panel) */}
        {governancePanel && <GisLayerGovernancePanel />}

        {/* Map canvas (center) */}
        <MapCenterCanvas />

        {/* Binding panel (floating) */}
        <GisBindingPanel />
      </div>
    </div>
  );
}


