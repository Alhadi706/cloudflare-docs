'use client';
/**
 * SICRibbon — Office-style ribbon toolbar for the Satellite Intelligence Center.
 *
 * Layout:
 *   Row 1: Tool group buttons (like Office tabs)
 *   Row 2: Contextual sub-tools for the active group
 *
 * Rules:
 *   • Each group button is a large icon + Arabic label
 *   • Clicking a group activates it and shows its sub-tools below
 *   • Sub-tools are smaller buttons/inputs specific to that group
 *   • Active group is highlighted; results appear in the side pane
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera, Pencil, Mountain, Target, Route, FileText,
  ShieldCheck, Trash2, Square, Hexagon, MousePointer2,
  Map as MapIcon, Play, RefreshCw, Loader2, GitCompare,
  Zap, ChevronDown, Navigation, Building2, Waves, Triangle,
  ShieldAlert, MessageCircle, CalendarDays, Layers3, Box,
  ScanSearch, BellRing, Radio, GitMerge,
  BarChart2, Sun, Wind, GitBranch, Activity, Scissors, Globe, Eye, Satellite,
} from 'lucide-react';
import { BASEMAPS, type DrawMode, type BaseStyle } from './SceneMapPanel';
import type { SceneListItem, WorkflowInfo } from '@/lib/satelliteIntelAPI';
import AssetTopBar from '@/app/dashboard/gis-sovereignty/engineering-workspace/components/AssetTopBar';

// ── Types ────────────────────────────────────────────────────────────────────

/** Hook: returns fixed-position style for a dropdown anchored below a trigger ref */
function useDropdownPos(triggerRef: React.RefObject<HTMLElement>, open: boolean) {
  const [style, setStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 9999,
    });
  }, [open, triggerRef]);
  return style;
}

export type RibbonGroup =
  | 'monitoring'   // satellite change detection + alerts
  | 'detection'    // AI object detection
  | 'insar'        // InSAR ground deformation
  | 'cva'          // CVA multi-spectral + sub-pixel + ground truth
  | 'scenes'       // scene browser + archive
  | 'draw'         // AOI drawing + basemap
  | 'terrain'      // 3D analysis + cut/fill
  | 'suitability'  // site suitability
  | 'routing'      // optimal path
  | 'report'       // scene report + temporal + chat
  | 'compliance'   // ArcGIS compliance
  | 'pipeline'     // pipeline route editor
  | 'layers'       // engineering layer editor (AssetTopBar tools)
  // RSC modules merged into SIC
  | 'spatial_analyst'  // Spatial Analyst tools
  | 'image_analyst'    // Image Analyst / spectral indices
  | '3d_analyst';      // 3D Analyst tools

export type SuitabilityUseCase =
  | 'health_center' | 'school' | 'pump_station'
  | 'warehouse' | 'fire_station' | 'park';

export interface RibbonState {
  activeGroup: RibbonGroup;
  // Terrain sub-state
  terrainBaseLevelM: number;
  terrainGridSize: number;
  // Suitability sub-state
  suitabilityUseCase: SuitabilityUseCase;
  // Routing sub-state (pass-through)
  routingPriority: 'shortest' | 'easiest_terrain' | 'least_obstacles' | 'balanced';
  routingObstacles: { buildings: boolean; water: boolean; steep_slope: boolean; restricted_zones: boolean };
  // Report sub-state
  reportSubTab: 'report' | 'chat' | 'temporal' | 'simulation';
  // ── RSC sub-state
  rscActiveTool?: string;
}

interface SICRibbonProps {
  // Scene data
  scenes: SceneListItem[];
  workflows: WorkflowInfo[];
  activeSceneUid: string | null;
  activeWorkflow: string;
  // Draw / map
  drawMode: DrawMode;
  baseStyle: BaseStyle;
  // Status
  running: boolean;
  systemOnline: boolean;
  isRefreshing: boolean;
  hasResult: boolean;
  // Archive
  archiveYear: number;
  archiveLoading?: boolean;
  // Routing pick mode
  routingPickMode: 'idle' | 'picking_start' | 'picking_end';
  routingStartPoint: [number, number] | null;
  routingEndPoint: [number, number] | null;
  // Layer editor callbacks (passed through to AssetTopBar)
  onAddChildAsset?: () => void;
  onStartLayerExtractionPolygon?: () => void;
  onRunMunicipalityExtraction?: (municipalityKey: string) => void;
  onMunicipalityChange?: (municipalityKey: string) => void;
  onCancelExtractionSelection?: () => void;
  extractionBusy?: boolean;
  // Callbacks
  onSceneChange: (uid: string) => void;
  onWorkflowChange: (wf: string) => void;
  onDrawModeChange: (mode: DrawMode) => void;
  onBaseStyleChange: (style: BaseStyle) => void;
  onRunAnalysis: () => void;
  onRefresh: () => void;
  onLoadArchiveYear: (year: number) => void;
  onStartRoutingPick: (which: 'start' | 'end') => void;
  onClearRoutingPoints: () => void;
  // Ribbon state output
  ribbonState: RibbonState;
  onRibbonChange: (patch: Partial<RibbonState>) => void;
  // RSC tool selection callback
  onRscToolChange?: (tool: string) => void;
  // Monitoring panel toggle
  drawnPolygon?: [number, number][] | null;
  onMonitoringPanelResult?: (geojson: any | null) => void;
  // Satellite layer toggles
  showFireLayer?: boolean;
  showLeakLayer?: boolean;
  showUrbanLeakLayer?: boolean;
  showEncroachLayer?: boolean;
  fireLoading?: boolean;
  leakLoading?: boolean;
  urbanLeakLoading?: boolean;
  encroachLoading?: boolean;
  fireCount?: number;
  leakCount?: number;
  urbanLeakCount?: number;
  encroachCount?: number;
  onToggleFireLayer?: () => void;
  fireShowAll?: boolean;
  onToggleFireShowAll?: () => void;
  onToggleLeakLayer?: () => void;
  onToggleUrbanLeakLayer?: () => void;
  onToggleEncroachLayer?: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

// ── Ribbon group categories for visual grouping (UI only, no state change) ────
type RibbonCategory = {
  labelAr: string;
  color: string;
  groups: { id: RibbonGroup; label: string; Icon: React.ElementType; color: string }[];
};

const RIBBON_CATEGORIES: RibbonCategory[] = [
  {
    labelAr: 'الاستشعار عن بعد',
    color: 'text-yellow-500',
    groups: [
      { id: 'scenes',       label: 'الصور',   Icon: Camera,    color: 'text-blue-400'   },
      { id: 'monitoring',   label: 'رصد',     Icon: ScanSearch, color: 'text-yellow-400' },
      { id: 'detection',    label: 'كشف AI', Icon: BellRing,  color: 'text-purple-400' },
      { id: 'cva',          label: 'CVA',     Icon: GitMerge,  color: 'text-teal-400'   },
      { id: 'insar',        label: 'InSAR',   Icon: Radio,     color: 'text-violet-400' },
      { id: 'image_analyst',label: 'Image',   Icon: Satellite, color: 'text-emerald-400'},
    ],
  },
  {
    labelAr: 'تحليل متقدم',
    color: 'text-sky-500',
    groups: [
      { id: 'spatial_analyst', label: 'Spatial', Icon: Activity, color: 'text-sky-400'    },
      { id: '3d_analyst',      label: '3D',      Icon: Box,      color: 'text-fuchsia-400'},
    ],
  },
  {
    labelAr: 'أدوات',
    color: 'text-emerald-500',
    groups: [
      { id: 'draw',       label: 'رسم',      Icon: Pencil,     color: 'text-emerald-400' },
      { id: 'pipeline',   label: 'المسارات', Icon: Route,     color: 'text-cyan-400'   },
      { id: 'report',     label: 'التقرير',  Icon: FileText,   color: 'text-slate-300'  },
      { id: 'compliance', label: 'المطابقة', Icon: ShieldCheck, color: 'text-rose-400'   },
    ],
  },
];

// Flat list kept for compatibility with any code that iterates GROUPS
const GROUPS: { id: RibbonGroup; label: string; Icon: React.ElementType; color: string }[] =
  RIBBON_CATEGORIES.flatMap(cat => cat.groups);

const SUITABILITY_CASES: { value: SuitabilityUseCase; label: string }[] = [
  { value: 'health_center', label: 'مركز صحي' },
  { value: 'school',        label: 'مدرسة' },
  { value: 'pump_station',  label: 'محطة ضخ' },
  { value: 'warehouse',     label: 'مستودع' },
  { value: 'fire_station',  label: 'محطة إطفاء' },
  { value: 'park',          label: 'حديقة' },
];

const PRIORITY_OPTIONS = [
  { value: 'shortest',        label: 'أقصر' },
  { value: 'easiest_terrain', label: 'أسهل تضاريس' },
  { value: 'least_obstacles', label: 'أقل عوائق' },
  { value: 'balanced',        label: 'متوازن' },
] as const;

const REPORT_TABS = [
  { value: 'report',     label: 'تقرير',  Icon: FileText },
  { value: 'chat',       label: 'محادثة', Icon: MessageCircle },
  { value: 'temporal',   label: 'زمني',   Icon: GitCompare },
  { value: 'simulation', label: 'محاكاة', Icon: Zap },
] as const;

// ── Sub-toolbars (one per group) ──────────────────────────────────────────────

function SubBarScenes({
  scenes, activeSceneUid, workflows, activeWorkflow, archiveYear, archiveLoading,
  isRefreshing, onSceneChange, onWorkflowChange, onRefresh, onLoadArchiveYear,
}: Pick<SICRibbonProps,
  'scenes' | 'activeSceneUid' | 'workflows' | 'activeWorkflow'
  | 'archiveYear' | 'archiveLoading' | 'isRefreshing'
  | 'onSceneChange' | 'onWorkflowChange' | 'onRefresh' | 'onLoadArchiveYear'
>) {
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showScenePicker, setShowScenePicker] = useState(false);
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: currentYear - 2014 + 1 }, (_, i) => currentYear - i);
  const activeScene = scenes.find(s => s.scene_uid === activeSceneUid);
  const activeDate = activeScene?.acquisition_date?.slice(0, 10) ?? '—';
  const sceneBtnRef = useRef<HTMLButtonElement>(null);
  const yearBtnRef  = useRef<HTMLButtonElement>(null);
  const sceneDropStyle = useDropdownPos(sceneBtnRef as React.RefObject<HTMLElement>, showScenePicker);
  const yearDropStyle  = useDropdownPos(yearBtnRef  as React.RefObject<HTMLElement>, showYearPicker);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Active scene */}
      <div className="relative">
        <button
          ref={sceneBtnRef}
          onClick={() => { setShowScenePicker(s => !s); setShowYearPicker(false); }}
          className="flex items-center gap-1.5 px-2.5 h-7 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-xs text-slate-200 font-medium max-w-[180px] truncate"
        >
          <Camera size={10} className="text-blue-400 shrink-0" />
          <span className="truncate">{activeDate}</span>
          <ChevronDown size={9} className="shrink-0 text-slate-500" />
        </button>
        {showScenePicker && (
          <div style={sceneDropStyle} className="w-64 rounded-lg border border-slate-700 bg-slate-900 shadow-2xl max-h-56 overflow-y-auto">
            {scenes.map(s => (
              <button key={s.scene_uid}
                onClick={() => { onSceneChange(s.scene_uid); setShowScenePicker(false); }}
                className={`w-full text-right px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex items-center gap-2 ${s.scene_uid === activeSceneUid ? 'text-blue-300 bg-blue-900/20' : 'text-slate-300'}`}
              >
                <Camera size={9} className={s.data_is_real ? 'text-green-400' : 'text-slate-500'} />
                <span className="flex-1 truncate">{s.acquisition_date?.slice(0, 10)} — {s.scene_uid.slice(0, 20)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Workflow */}
      <div className="relative">
        <select
          value={activeWorkflow}
          onChange={e => onWorkflowChange(e.target.value)}
          className="h-7 px-2 rounded bg-slate-800 border border-slate-700/50 text-xs text-slate-200 appearance-none pl-6 max-w-[140px]"
        >
          {workflows.map(w => (
            <option key={w.workflow_key} value={w.workflow_key}>{w.name_ar ?? w.workflow_key}</option>
          ))}
        </select>
      </div>

      {/* Archive year */}
      <div className="relative">
        <button
          ref={yearBtnRef}
          onClick={() => { setShowYearPicker(s => !s); setShowScenePicker(false); }}
          className="flex items-center gap-1.5 px-2.5 h-7 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-xs text-purple-300 font-medium"
        >
          <CalendarDays size={10} className="text-purple-400" />
          <span>{archiveYear}</span>
          {archiveLoading && <Loader2 size={8} className="animate-spin text-purple-400" />}
          <ChevronDown size={9} className="text-slate-500" />
        </button>
        {showYearPicker && (
          <div style={yearDropStyle} className="rounded-lg border border-slate-700 bg-slate-900 shadow-2xl p-2 grid grid-cols-4 gap-1 w-48">
            {YEARS.map(y => (
              <button key={y}
                onClick={() => { onLoadArchiveYear(y); setShowYearPicker(false); }}
                className={`text-xs rounded px-1.5 py-1 border transition-colors ${archiveYear === y ? 'bg-purple-700 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-purple-500'}`}
              >{y}</button>
            ))}
          </div>
        )}
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1 px-2 h-7 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-xs text-slate-400 disabled:opacity-40"
      >
        <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
        <span>تحديث</span>
      </button>
    </div>
  );
}

function BasemapPicker({ baseStyle, onBaseStyleChange }: Pick<SICRibbonProps, 'baseStyle' | 'onBaseStyleChange'>) {
  const [showBaseMap, setShowBaseMap] = useState(false);
  const basemapBtnRef = useRef<HTMLButtonElement>(null);
  const basemapDropStyle = useDropdownPos(basemapBtnRef as React.RefObject<HTMLElement>, showBaseMap);
  return (
    <div className="relative shrink-0">
      <button ref={basemapBtnRef} onClick={() => setShowBaseMap(s => !s)}
        className="flex items-center gap-1.5 px-2.5 h-7 rounded border border-slate-700/50 bg-slate-800 text-slate-300 text-xs hover:border-blue-500 transition-colors">
        <MapIcon size={10} className="text-blue-400" />
        {BASEMAPS[baseStyle]?.label ?? baseStyle}
        <ChevronDown size={9} />
      </button>
      {showBaseMap && (
        <div style={basemapDropStyle} className="rounded-lg border border-slate-700 bg-slate-900 shadow-2xl w-44">
          {Object.entries(BASEMAPS).map(([key, val]: [string, any]) => (
            <button key={key} onClick={() => { onBaseStyleChange(key as BaseStyle); setShowBaseMap(false); }}
              className={`w-full text-right px-3 py-2 text-xs transition-colors ${baseStyle === key ? 'text-blue-300 bg-blue-900/20' : 'text-slate-300 hover:bg-slate-800'}`}>
              {val.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SubBarDraw({
  drawMode, onDrawModeChange,
}: Pick<SICRibbonProps, 'drawMode' | 'onDrawModeChange'>) {
  const btnBase = 'flex items-center gap-1.5 px-2.5 h-7 rounded border text-xs font-medium transition-colors';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={() => onDrawModeChange('off')}
        className={`${btnBase} ${drawMode === 'off' ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-800 border-slate-700/50 text-slate-300 hover:border-slate-500'}`}>
        <MousePointer2 size={10} /> تحديد
      </button>
      <button onClick={() => onDrawModeChange('box')}
        className={`${btnBase} ${drawMode === 'box' ? 'bg-emerald-700/60 border-emerald-500 text-emerald-200' : 'bg-slate-800 border-slate-700/50 text-slate-300 hover:border-emerald-500'}`}>
        <Square size={10} /> مستطيل
      </button>
      <button onClick={() => onDrawModeChange('polygon')}
        className={`${btnBase} ${drawMode === 'polygon' ? 'bg-emerald-700/60 border-emerald-500 text-emerald-200' : 'bg-slate-800 border-slate-700/50 text-slate-300 hover:border-emerald-500'}`}>
        <Hexagon size={10} /> مضلع
      </button>
      <button onClick={() => onDrawModeChange('off')}
        className="flex items-center gap-1.5 px-2.5 h-7 rounded border border-slate-700/50 bg-slate-800 text-rose-400 text-xs hover:border-rose-500 transition-colors">
        <Trash2 size={10} /> مسح
      </button>
    </div>
  );
}

function SubBarTerrain({
  ribbonState, onRibbonChange, running, onRunAnalysis,
}: Pick<SICRibbonProps, 'running' | 'onRunAnalysis'> & Pick<SICRibbonProps, 'ribbonState' | 'onRibbonChange'>) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={onRunAnalysis} disabled={running}
        className="flex items-center gap-1.5 px-3 h-7 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-semibold">
        {running ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
        تشغيل تحليل التضاريس
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />

      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        مستوى القاعدة
        <input
          type="number" min={0} max={500} step={5}
          value={ribbonState.terrainBaseLevelM}
          onChange={e => onRibbonChange({ terrainBaseLevelM: Number(e.target.value) })}
          className="w-14 h-6 rounded bg-slate-800 border border-slate-700/50 text-xs text-slate-200 text-center"
        />
        <span>م</span>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        الشبكة
        <select
          value={ribbonState.terrainGridSize}
          onChange={e => onRibbonChange({ terrainGridSize: Number(e.target.value) })}
          className="h-6 px-1 rounded bg-slate-800 border border-slate-700/50 text-xs text-slate-200"
        >
          {[7, 11, 15, 21].map(n => <option key={n} value={n}>{n}×{n}</option>)}
        </select>
      </label>

      <div className="w-px h-5 bg-slate-700 mx-1" />
      <span className="text-xs text-amber-400/80">يشمل: الارتفاعات · الميل · الحفر والردم · خطوط الكنتور · خط الرؤية</span>
    </div>
  );
}

function SubBarSuitability({
  ribbonState, onRibbonChange, running, onRunAnalysis,
}: Pick<SICRibbonProps, 'running' | 'onRunAnalysis' | 'ribbonState' | 'onRibbonChange'>) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {SUITABILITY_CASES.map(opt => (
        <button key={opt.value}
          onClick={() => onRibbonChange({ suitabilityUseCase: opt.value })}
          className={`px-2.5 h-7 rounded border text-xs font-medium transition-colors ${
            ribbonState.suitabilityUseCase === opt.value
              ? 'bg-purple-700/60 border-purple-500 text-purple-200'
              : 'bg-slate-800 border-slate-700/50 text-slate-300 hover:border-purple-500'
          }`}
        >{opt.label}</button>
      ))}

      <div className="w-px h-5 bg-slate-700 mx-1" />

      <button onClick={onRunAnalysis} disabled={running}
        className="flex items-center gap-1.5 px-3 h-7 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-semibold">
        {running ? <Loader2 size={10} className="animate-spin" /> : <Target size={10} />}
        تشغيل
      </button>
    </div>
  );
}

function SubBarRouting({
  ribbonState, onRibbonChange, routingPickMode, routingStartPoint, routingEndPoint,
  onStartRoutingPick, onClearRoutingPoints,
}: Pick<SICRibbonProps,
  'ribbonState' | 'onRibbonChange' | 'routingPickMode'
  | 'routingStartPoint' | 'routingEndPoint'
  | 'onStartRoutingPick' | 'onClearRoutingPoints'
>) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Points */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-green-700 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-white">A</span>
        </div>
        <button
          onClick={() => onStartRoutingPick('start')}
          className={`px-2 h-7 rounded border text-xs transition-colors ${
            routingPickMode === 'picking_start'
              ? 'bg-green-800/60 border-green-500 text-green-200 animate-pulse'
              : routingStartPoint ? 'bg-slate-800 border-green-700/50 text-green-400' : 'bg-slate-800 border-slate-700/50 text-slate-400 hover:border-green-500'
          }`}
        >
          {routingPickMode === 'picking_start' ? '← انقر الخريطة' :
           routingStartPoint ? `${routingStartPoint[0].toFixed(3)}, ${routingStartPoint[1].toFixed(3)}` : 'تحديد'}
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-rose-700 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-white">B</span>
        </div>
        <button
          onClick={() => onStartRoutingPick('end')}
          className={`px-2 h-7 rounded border text-xs transition-colors ${
            routingPickMode === 'picking_end'
              ? 'bg-rose-800/60 border-rose-500 text-rose-200 animate-pulse'
              : routingEndPoint ? 'bg-slate-800 border-rose-700/50 text-rose-400' : 'bg-slate-800 border-slate-700/50 text-slate-400 hover:border-rose-500'
          }`}
        >
          {routingPickMode === 'picking_end' ? '← انقر الخريطة' :
           routingEndPoint ? `${routingEndPoint[0].toFixed(3)}, ${routingEndPoint[1].toFixed(3)}` : 'تحديد'}
        </button>
      </div>

      {(routingStartPoint || routingEndPoint) && (
        <button onClick={onClearRoutingPoints}
          className="flex items-center gap-1 px-2 h-7 rounded border border-slate-700/50 bg-slate-800 text-rose-400 text-xs hover:border-rose-500">
          <Trash2 size={9} /> مسح
        </button>
      )}

      <div className="w-px h-5 bg-slate-700 mx-1" />

      {/* Priority */}
      {PRIORITY_OPTIONS.map(opt => (
        <button key={opt.value}
          onClick={() => onRibbonChange({ routingPriority: opt.value })}
          className={`px-2 h-7 rounded border text-xs transition-colors ${
            ribbonState.routingPriority === opt.value
              ? 'bg-cyan-800/60 border-cyan-500 text-cyan-200'
              : 'bg-slate-800 border-slate-700/50 text-slate-400 hover:border-cyan-600'
          }`}
        >{opt.label}</button>
      ))}

      <div className="w-px h-5 bg-slate-700 mx-1" />

      {/* Obstacles */}
      <span className="text-xs text-slate-500">تجنب:</span>
      {([
        { key: 'buildings',        label: 'مبانٍ',  Icon: Building2,  color: 'text-orange-400' },
        { key: 'water',            label: 'مياه',    Icon: Waves,       color: 'text-blue-400' },
        { key: 'steep_slope',      label: 'ميول',    Icon: Triangle,    color: 'text-yellow-400' },
        { key: 'restricted_zones', label: 'محظور',  Icon: ShieldAlert, color: 'text-rose-400' },
      ] as const).map(({ key, label, Icon, color }) => (
        <button key={key}
          onClick={() => onRibbonChange({ routingObstacles: { ...ribbonState.routingObstacles, [key]: !ribbonState.routingObstacles[key as keyof typeof ribbonState.routingObstacles] } })}
          className={`flex items-center gap-1 px-2 h-6 rounded border text-xs transition-colors ${
            ribbonState.routingObstacles[key as keyof typeof ribbonState.routingObstacles]
              ? `bg-slate-700 border-slate-500 ${color}`
              : 'bg-slate-800/40 border-slate-700/30 text-slate-600'
          }`}
          title={label}
        >
          <Icon size={9} />
          <span className="hidden xl:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function SubBarReport({
  ribbonState, onRibbonChange, running, systemOnline, onRunAnalysis,
}: Pick<SICRibbonProps, 'running' | 'systemOnline' | 'onRunAnalysis' | 'ribbonState' | 'onRibbonChange'>) {  return (
    <div className="flex items-center gap-2 flex-wrap">
      {REPORT_TABS.map(t => (
        <button key={t.value}
          onClick={() => onRibbonChange({ reportSubTab: t.value })}
          className={`flex items-center gap-1.5 px-2.5 h-7 rounded border text-xs transition-colors ${
            ribbonState.reportSubTab === t.value
              ? 'bg-slate-600 border-slate-400 text-white'
              : 'bg-slate-800 border-slate-700/50 text-slate-400 hover:border-slate-500'
          }`}
        >
          <t.Icon size={10} />{t.label}
        </button>
      ))}

      <div className="w-px h-5 bg-slate-700 mx-1" />

      <button onClick={onRunAnalysis} disabled={running || !systemOnline}
        className="flex items-center gap-1.5 px-3 h-7 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold">
        {running ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
        تشغيل التحليل
      </button>
    </div>
  );
}

// ── Main Ribbon ───────────────────────────────────────────────────────────────

export default function SICRibbon(props: SICRibbonProps) {  const { ribbonState, onRibbonChange } = props;
  const activeGroup = ribbonState.activeGroup;

  return (
    <div className="shrink-0 bg-slate-900 border-b border-slate-800 z-[200] relative" dir="rtl">

      {/* ── Row 1: Group buttons — categorized ──────────────────── */}
      <div className="flex items-stretch gap-0 border-b border-slate-800/60 overflow-x-auto scrollbar-none">
        {RIBBON_CATEGORIES.map((cat, catIdx) => (
          <React.Fragment key={cat.labelAr}>
            {/* Category label + its buttons */}
            <div className="flex flex-col shrink-0">
              {/* Category header */}
              <div className={`text-[9px] font-bold uppercase tracking-widest px-3 pt-1 pb-0 ${cat.color} opacity-60 text-center`}>
                {cat.labelAr}
              </div>
              {/* Buttons row */}
              <div className="flex items-stretch flex-1">
                {cat.groups.map(g => {
                  const isActive = activeGroup === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => onRibbonChange({ activeGroup: g.id })}
                      title={g.label}
                      className={`flex flex-col items-center justify-center gap-0.5 px-3.5 py-1 min-w-[52px] transition-colors relative border-l border-slate-800/30 last:border-0 ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      }`}
                    >
                      <g.Icon size={14} className={isActive ? g.color : 'text-slate-500'} />
                      <span className="text-[10px] font-medium whitespace-nowrap">{g.label}</span>
                      {isActive && (
                        <span className={`absolute bottom-0 right-0 left-0 h-0.5 ${g.color.replace('text-', 'bg-')}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Category separator */}
            {catIdx < RIBBON_CATEGORIES.length - 1 && (
              <div className="w-px bg-slate-700/50 self-stretch mx-0.5 shrink-0" />
            )}
          </React.Fragment>
        ))}
        {/* ── Navigation shortcuts to specialist pages ── */}
        <div className="w-px bg-slate-700/50 self-stretch mx-0.5 shrink-0" />
        <div className="flex flex-col shrink-0 justify-center">
          <div className="text-[9px] font-bold uppercase tracking-widest px-2 pt-1 pb-0 text-slate-600 text-center">انتقال</div>
          <div className="flex items-stretch flex-1">
            <Link
              href="/dashboard/gis-sovereignty/spatial-analytics"
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-[52px] text-slate-500 hover:text-blue-300 hover:bg-slate-800/40 transition-colors border-l border-slate-800/30"
              title="مختبر التحليل المكاني — تضاريس، ملاءمة، مسار أمثل"
            >
              <Mountain size={14} className="text-amber-500/70" />
              <span className="text-[10px] font-medium whitespace-nowrap">التحليل</span>
            </Link>
            <Link
              href="/dashboard/gis-sovereignty/engineering-workspace"
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 min-w-[52px] text-slate-500 hover:text-emerald-300 hover:bg-slate-800/40 transition-colors border-l border-slate-800/30"
              title="مساحة العمل الهندسية — الطبقات والرسم الهندسي"
            >
              <Layers3 size={14} className="text-indigo-500/70" />
              <span className="text-[10px] font-medium whitespace-nowrap">الطبقات</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 2: Contextual sub-tools ─────────────────────────── */}
      <div className="flex items-center gap-0 px-3 h-9 overflow-visible">
        {/* ── Always-visible basemap picker (far left / start of row) ── */}
        <BasemapPicker baseStyle={props.baseStyle} onBaseStyleChange={props.onBaseStyleChange} />
        <div className="w-px h-5 bg-slate-800 mx-2 shrink-0" />
        {activeGroup === 'monitoring' && (
          <div className="flex items-stretch h-full gap-0">

            {/* ── طبقة 1: حرائق VIIRS ── */}
            <button
              onClick={props.onToggleFireLayer}
              disabled={props.fireLoading}
              title="حرائق VIIRS — NOAA-20 / NASA FIRMS (آخر 7 أيام)"
              className={`relative flex items-center gap-1.5 px-3.5 h-full text-xs font-semibold transition-all border-b-2 ${
                props.showFireLayer
                  ? 'border-orange-400 text-orange-300 bg-slate-800/70'
                  : 'border-transparent text-slate-400 hover:text-orange-300 hover:bg-slate-800/30'
              }`}
            >
              <span>{props.fireLoading ? '⏳' : '🔥'}</span>
              <span>حرائق VIIRS</span>
              {(props.fireCount ?? 0) > 0 && (
                <span className={`text-[9px] px-1 rounded-full font-bold ${
                  props.showFireLayer ? 'bg-orange-500/40 text-orange-200' : 'bg-slate-700 text-slate-400'
                }`}>{props.fireCount}</span>
              )}
              {props.showFireLayer && (
                <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-orange-400 rounded-t" />
              )}
            </button>

            <div className="w-px h-5 bg-slate-700/60 self-center" />

            {/* ── طبقة 2: تسريبات النهر الصناعي ── */}
            <button
              onClick={props.onToggleLeakLayer}
              disabled={props.leakLoading}
              title="تسريبات النهر الصناعي — Sentinel-2/1 + Sentinel Hub NDWI/NDVI"
              className={`relative flex items-center gap-1.5 px-3.5 h-full text-xs font-semibold transition-all border-b-2 ${
                props.showLeakLayer
                  ? 'border-cyan-400 text-cyan-300 bg-slate-800/70'
                  : 'border-transparent text-slate-400 hover:text-cyan-300 hover:bg-slate-800/30'
              }`}
            >
              <span>{props.leakLoading ? '⏳' : '💧'}</span>
              <span>تسريبات النهر</span>
              {(props.leakCount ?? 0) > 0 && (
                <span className={`text-[9px] px-1 rounded-full font-bold ${
                  props.showLeakLayer ? 'bg-cyan-500/40 text-cyan-200' : 'bg-slate-700 text-slate-400'
                }`}>{props.leakCount}</span>
              )}
              {props.showLeakLayer && (
                <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-cyan-400 rounded-t" />
              )}
            </button>

            <div className="w-px h-5 bg-slate-700/60 self-center" />

            {/* ── طبقة 3: تسريبات المدن ── */}
            <button
              onClick={props.onToggleUrbanLeakLayer}
              disabled={props.urbanLeakLoading}
              title="تسريبات شبكات المياه الحضرية — كشف شبكات المياه المعطّلة"
              className={`relative flex items-center gap-1.5 px-3.5 h-full text-xs font-semibold transition-all border-b-2 ${
                props.showUrbanLeakLayer
                  ? 'border-blue-400 text-blue-300 bg-slate-800/70'
                  : 'border-transparent text-slate-400 hover:text-blue-300 hover:bg-slate-800/30'
              }`}
            >
              <span>{props.urbanLeakLoading ? '⏳' : '🏙️'}</span>
              <span>تسريبات المدن</span>
              {(props.urbanLeakCount ?? 0) > 0 && (
                <span className={`text-[9px] px-1 rounded-full font-bold ${
                  props.showUrbanLeakLayer ? 'bg-blue-500/40 text-blue-200' : 'bg-slate-700 text-slate-400'
                }`}>{props.urbanLeakCount}</span>
              )}
              {props.showUrbanLeakLayer && (
                <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-blue-400 rounded-t" />
              )}
            </button>

            <div className="w-px h-5 bg-slate-700/60 self-center" />

            {/* ── طبقة 4: اعتداءات الحرم ── */}
            <button
              onClick={props.onToggleEncroachLayer}
              disabled={props.encroachLoading}
              title="رصد الاعتداءات على حرم المسارات والأصول المسجّلة"
              className={`relative flex items-center gap-1.5 px-3.5 h-full text-xs font-semibold transition-all border-b-2 ${
                props.showEncroachLayer
                  ? 'border-rose-400 text-rose-300 bg-slate-800/70'
                  : 'border-transparent text-slate-400 hover:text-rose-300 hover:bg-slate-800/30'
              }`}
            >
              <span>{props.encroachLoading ? '⏳' : '🚧'}</span>
              <span>اعتداءات الحرم</span>
              {(props.encroachCount ?? 0) > 0 && (
                <span className={`text-[9px] px-1 rounded-full font-bold ${
                  props.showEncroachLayer ? 'bg-rose-500/40 text-rose-200' : 'bg-slate-700 text-slate-400'
                }`}>{props.encroachCount}</span>
              )}
              {props.showEncroachLayer && (
                <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-rose-400 rounded-t" />
              )}
            </button>

            {/* ── وصف الطبقة النشطة ── */}
            {(props.showFireLayer || props.showLeakLayer || props.showUrbanLeakLayer || props.showEncroachLayer) && (
              <>
                <div className="w-px h-5 bg-slate-700/60 self-center mx-1" />
                <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                  {props.showFireLayer && (
                    <>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>حريق مؤكد</span>
                      {props.fireShowAll && <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"/>حرق غاز</span>}
                      {props.fireShowAll && <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>شذوذ</span>}
                      <button
                        onClick={props.onToggleFireShowAll}
                        className={`ml-1 text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                          props.fireShowAll
                            ? 'border-orange-400/60 text-orange-300 bg-orange-900/30'
                            : 'border-slate-600 text-slate-400 hover:text-orange-300 hover:border-orange-400/40'
                        }`}
                        title={props.fireShowAll ? 'عرض المؤكد فقط' : 'عرض كل الرصد (180 نقطة)'}
                      >{props.fireShowAll ? 'مؤكد فقط ↑' : 'كل الرصد ↓'}</button>
                    </>
                  )}
                  {props.showLeakLayer && (
                    <>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>مؤكد</span>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>مرتفع</span>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/>متوسط</span>
                    </>
                  )}
                  {props.showUrbanLeakLayer && (
                    <>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>تسرب حضري</span>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block"/>رطوبة شاذة</span>
                    </>
                  )}
                  {props.showEncroachLayer && (
                    <>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"/>اعتداء محتمل</span>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>أصل مراقب</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {activeGroup === 'detection' && (
          <span className="flex items-center gap-2 text-xs text-purple-300 font-semibold">
            <BellRing size={13} className="text-purple-400 shrink-0" />
            <span>🔴 <strong>كشف AI:</strong> ارسم منطقة على الخريطة (زر رسم) ← ثم اضغط "تشغيل" في اللوحة اليمنى</span>
          </span>
        )}
        {activeGroup === 'insar' && (
          <span className="flex items-center gap-2 text-xs text-violet-300 font-semibold">
            <Radio size={13} className="text-violet-400 shrink-0" />
            <span>🟣 <strong>InSAR:</strong> ارسم منطقة على الخريطة (زر رسم) ← ثم اضغط "تشغيل InSAR" في اللوحة اليمنى — قياس تشوه الأرض بدقة الملم</span>
          </span>
        )}
        {activeGroup === 'cva' && (
          <span className="flex items-center gap-2 text-xs text-teal-300 font-semibold">
            <GitMerge size={13} className="text-teal-400 shrink-0" />
            <span>🟢 <strong>CVA:</strong> ارسم منطقة على الخريطة (زر رسم) ← ثم اضغط "تحليل" في اللوحة اليمنى — كشف التغييرات متعدد النطاقات</span>
          </span>
        )}
        {activeGroup === 'scenes' && (
          <SubBarScenes
            scenes={props.scenes}
            activeSceneUid={props.activeSceneUid}
            workflows={props.workflows}
            activeWorkflow={props.activeWorkflow}
            archiveYear={props.archiveYear}
            archiveLoading={props.archiveLoading}
            isRefreshing={props.isRefreshing}
            onSceneChange={props.onSceneChange}
            onWorkflowChange={props.onWorkflowChange}
            onRefresh={props.onRefresh}
            onLoadArchiveYear={props.onLoadArchiveYear}
          />
        )}
        {activeGroup === 'draw' && (
          <SubBarDraw
            drawMode={props.drawMode}
            onDrawModeChange={props.onDrawModeChange}
          />
        )}
        {activeGroup === 'pipeline' && (
          <span className="flex items-center gap-2 text-xs text-cyan-300 font-semibold">
            <Route size={13} className="text-cyan-400 shrink-0" />
            <span>🗺️ <strong>مسارات الأنابيب:</strong> رسم وتحرير مسارات النهر الصناعي وخطوط النفط — استخدم اللوحة اليمنى</span>
          </span>
        )}
        {/* terrain/suitability/routing/layers moved to /spatial-analytics and /engineering-workspace */}
        {activeGroup === 'report' && (
          <SubBarReport
            ribbonState={ribbonState}
            onRibbonChange={onRibbonChange}
            running={props.running}
            systemOnline={props.systemOnline}
            onRunAnalysis={props.onRunAnalysis}
          />
        )}
        {activeGroup === 'compliance' && (
          <span className="text-xs text-slate-400">
            تقييم مطابقة بيانات ArcGIS والجودة — النتائج تظهر في لوحة التحليل
          </span>
        )}
        {/* layers moved to engineering-workspace */}
        {/* ── RSC Spatial Analyst sub-tools ────────────────────────────── */}
        {activeGroup === 'spatial_analyst' && (
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { key: 'sa_buffer',      label: 'عازلة',        Icon: Activity },
              { key: 'sa_slope',       label: 'انحدار',      Icon: Mountain },
              { key: 'sa_aspect',      label: 'اتجاه المنحدر', Icon: Wind },
              { key: 'sa_hillshade',   label: 'إضاءة',        Icon: Sun },
              { key: 'sa_watershed',   label: 'تصريف',        Icon: Waves },
              { key: 'sa_density',     label: 'كثافة',        Icon: BarChart2 },
              { key: 'sa_interpolate', label: 'استيفاء',       Icon: GitBranch },
              { key: 'sa_profile',     label: 'مقطع',          Icon: BarChart2 },
              { key: 'sa_overlay',     label: 'تداخل',        Icon: Layers3 },
            ].map(t => (
              <button key={t.key}
                onClick={() => props.onRscToolChange?.(t.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors ${
                  ribbonState.rscActiveTool === t.key
                    ? 'bg-sky-700/60 border-sky-500 text-sky-100'
                    : 'bg-slate-800 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <t.Icon size={11} />{t.label}
              </button>
            ))}
          </div>
        )}
        {/* ── RSC Image Analyst sub-tools ──────────────────────────────── */}
        {activeGroup === 'image_analyst' && (
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { key: 'ia_ndvi',      label: 'NDVI',         Icon: Satellite },
              { key: 'ia_ndwi',      label: 'NDWI',         Icon: Waves },
              { key: 'ia_savi',      label: 'SAVI',         Icon: Satellite },
              { key: 'ia_evi',       label: 'EVI',          Icon: Satellite },
              { key: 'ia_nbr',       label: 'NBR',          Icon: Zap },
              { key: 'ia_classify',  label: 'تصنيف',        Icon: Globe },
              { key: 'ia_change',    label: 'تغيير',         Icon: Eye },
              { key: 'ia_pansharp',  label: 'Pan-Sharp',    Icon: Zap },
              { key: 'ia_histogram', label: 'طيف',          Icon: BarChart2 },
            ].map(t => (
              <button key={t.key}
                onClick={() => props.onRscToolChange?.(t.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors ${
                  ribbonState.rscActiveTool === t.key
                    ? 'bg-emerald-700/60 border-emerald-500 text-emerald-100'
                    : 'bg-slate-800 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <t.Icon size={11} />{t.label}
              </button>
            ))}
          </div>
        )}
        {/* ── RSC 3D Analyst sub-tools ──────────────────────────────────── */}
        {activeGroup === '3d_analyst' && (
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { key: '3d_contour',   label: 'كنتور',         Icon: Mountain },
              { key: '3d_viewshed',  label: 'رؤية',           Icon: Eye },
              { key: '3d_los',       label: 'خط بصر',       Icon: Eye },
              { key: '3d_cut_fill',  label: 'حفر وردم',     Icon: Scissors },
              { key: '3d_profile',   label: 'مقطع 3D',      Icon: BarChart2 },
              { key: '3d_shadow',    label: 'ظل',             Icon: Sun },
              { key: '3d_skyline',   label: 'أفق',           Icon: Globe },
            ].map(t => (
              <button key={t.key}
                onClick={() => props.onRscToolChange?.(t.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors ${
                  ribbonState.rscActiveTool === t.key
                    ? 'bg-fuchsia-700/60 border-fuchsia-500 text-fuchsia-100'
                    : 'bg-slate-800 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <t.Icon size={11} />{t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Default ribbon state ──────────────────────────────────────────────────────
export const DEFAULT_RIBBON_STATE: RibbonState = {
  activeGroup:         'monitoring',
  terrainBaseLevelM:   0,
  terrainGridSize:     11,
  suitabilityUseCase:  'health_center',
  routingPriority:     'balanced',
  routingObstacles:    { buildings: true, water: true, steep_slope: true, restricted_zones: true },
  reportSubTab:        'report',
};
