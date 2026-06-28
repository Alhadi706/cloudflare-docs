'use client';
/**
 * UnifiedMapEngine — المحرك المكاني الموحد
 * ─────────────────────────────────────────────────────────────────────────────
 * wrapper فوق MapCanvas (OpenLayers) — هو القلب الحقيقي للنظام المكاني.
 *
 * الأوضاع:
 *   executive  — قراءة فقط، جميع المشاريع، بدون أدوات تحرير
 *   engineering — الوضع الكامل (محجوز لـ engineering-workspace)
 *
 * مصادر البيانات:
 *   projectStore + layerStore + workspaceStore → /api/gis/* (API حقيقي فقط)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * STRICT DATA TRUST RULE:
 * لا بيانات تجريبية — لا DEMO_MARKERS — لا markers مجهولة المصدر
 * كل بيانات مكانية مصدرها الـ API أو تظهر حالة فارغة صريحة
 * ══════════════════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  RefreshCw, MapPin, AlertTriangle, Loader2, CheckCircle2,
} from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useLayerStore } from '@/store/layerStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

// MapCanvas must be dynamic — OpenLayers requires browser environment
const MapCanvas = dynamic(
  () => import('@/app/dashboard/gis-sovereignty/engineering-workspace/components/MapCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    ),
  }
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type MapEngineMode = 'executive' | 'engineering';

interface UnifiedMapEngineProps {
  mode: MapEngineMode;
  className?: string;
  onProjectClick?: (projectId: string) => void;
}

// ── No-projects floating badge (overlays the map, does NOT replace it) ────────

function NoProjectsBadge() {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 backdrop-blur-sm shadow-lg">
        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="text-xs text-slate-400 whitespace-nowrap">
          لا توجد مشاريع بعد — أضف مشروعاً من بوابة الإدارة لتظهر على الخريطة
        </span>
      </div>
    </div>
  );
}

// ── UnifiedMapEngine ──────────────────────────────────────────────────────────

export default function UnifiedMapEngine({ mode, className, onProjectClick }: UnifiedMapEngineProps) {
  const loadProjects    = useProjectStore(s => s.loadProjects);
  const projects        = useProjectStore(s => s.projects);
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const setActiveProject = useProjectStore(s => s.setActiveProject);

  const loadLayers  = useLayerStore(s => s.loadLayers);

  const clearFeatures       = useWorkspaceStore(s => s.clearFeatures);
  const loadEvents          = useWorkspaceStore(s => s.loadEvents);
  const loadTemporalPatterns = useWorkspaceStore(s => s.loadTemporalPatterns);

  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState('');

  // Load all projects on mount
  useEffect(() => {
    setLoading(true);
    loadProjects()
      .catch(() => setLoadError('تعذّر تحميل المشاريع'))
      .finally(() => setLoading(false));
  }, [loadProjects]);

  // When active project changes, load its layers + features
  useEffect(() => {
    if (!activeProjectId) return;
    loadLayers(activeProjectId);
    clearFeatures();
    loadEvents();
    loadTemporalPatterns();
  }, [activeProjectId, loadLayers, clearFeatures, loadEvents, loadTemporalPatterns]);

  const handleProjectSelect = (id: string) => {
    setActiveProject(id);
    onProjectClick?.(id);
  };

  const isExecutive = mode === 'executive';

  return (
    <div className={`flex flex-col h-full bg-slate-950 overflow-hidden ${className ?? ''}`}>

      {/* ── LIVE verification banner ── */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900/80 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            UNIFIED MAP ENGINE ACTIVE
          </span>
          <span className="text-[10px] text-slate-600 font-mono">
            {isExecutive ? 'EXECUTIVE MODE' : 'ENGINEERING MODE'} · {projects.length} مشروع
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          API مباشر — لا بيانات تجريبية
        </div>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="text-sm text-slate-400">تحميل المشاريع من API...</span>
        </div>
      ) : loadError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-sm text-slate-400">{loadError}</p>
          <button
            onClick={() => { setLoadError(''); setLoading(true); loadProjects().finally(() => setLoading(false)); }}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
          >
            <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
          </button>
        </div>
      ) : (
        /* Map always renders — even with zero projects (shows base tiles) */
        <div className="flex flex-1 overflow-hidden relative">
          <MapCanvas
            isMonitoringMode={isExecutive}
            onProjectClick={handleProjectSelect}
          />
          {projects.length === 0 && <NoProjectsBadge />}
        </div>
      )}
    </div>
  );
}
