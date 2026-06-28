'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  MousePointer2,
  Square,
  Hexagon,
  Trash2,
  ChevronDown,
  RefreshCw,
  ScanLine,
  Loader2,
  Map as MapIcon,
  Camera,
  Layers3,
  Plus,
  Eye,
  EyeOff,
  X,
  ChevronUp,
  PenTool,
} from 'lucide-react';
import { BASEMAPS, type DrawMode, type BaseStyle } from './SceneMapPanel';
import type { SceneListItem, WorkflowInfo } from '@/lib/satelliteIntelAPI';
import type { ServiceLayerRecord } from '@/lib/serviceLayersAPI';
import { parseSceneLabel } from '@/lib/sceneLabels';

interface Props {
  scenes: SceneListItem[];
  workflows: WorkflowInfo[];
  activeSceneUid: string | null;
  activeWorkflow: string;
  drawMode: DrawMode;
  baseStyle: BaseStyle;
  running: boolean;
  systemOnline: boolean;
  isRefreshing: boolean;
  hasResult: boolean;
  serviceLayers: ServiceLayerRecord[];
  serviceLayersLoading?: boolean;
  serviceLayersError?: string | null;
  onSceneChange: (uid: string) => void;
  onWorkflowChange: (wf: string) => void;
  onDrawModeChange: (mode: DrawMode) => void;
  onBaseStyleChange: (style: BaseStyle) => void;
  onReloadServiceLayers?: () => void;
  onCreateServiceLayer?: (name: string) => void;
  onToggleServiceLayer?: (layerId: string, visible: boolean) => void;
  onDeleteServiceLayer?: (layerId: string) => void;
  onReorderServiceLayer?: (layerId: string, direction: 'up' | 'down') => void;
  onOpenLayerEditor?: () => void;
  layerEditorOpen?: boolean;
  onRunAnalysis: () => void;
  onRefresh: () => void;
}

export default function SatIntelTopBar({
  scenes,
  workflows,
  activeSceneUid,
  activeWorkflow,
  drawMode,
  baseStyle,
  running,
  systemOnline,
  isRefreshing,
  hasResult,
  serviceLayers,
  serviceLayersLoading,
  serviceLayersError,
  onSceneChange,
  onWorkflowChange,
  onDrawModeChange,
  onBaseStyleChange,
  onReloadServiceLayers,
  onCreateServiceLayer,
  onToggleServiceLayer,
  onDeleteServiceLayer,
  onReorderServiceLayer,
  onOpenLayerEditor,
  layerEditorOpen,
  onRunAnalysis,
  onRefresh,
}: Props) {
  const [showBaseMap, setShowBaseMap] = useState(false);
  const [showServiceLayers, setShowServiceLayers] = useState(false);
  const [baseMapPos, setBaseMapPos] = useState<{ top: number; right: number } | null>(null);
  const [serviceLayersPos, setServiceLayersPos] = useState<{ top: number; right: number } | null>(null);

  const basemapAnchorRef = useRef<HTMLButtonElement>(null);
  const serviceLayersAnchorRef = useRef<HTMLButtonElement>(null);
  const serviceLayersMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBaseMap) return;
    const close = (e: MouseEvent) => {
      if (basemapAnchorRef.current && !basemapAnchorRef.current.contains(e.target as Node)) {
        setShowBaseMap(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showBaseMap]);

  useEffect(() => {
    if (!showServiceLayers) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (serviceLayersAnchorRef.current?.contains(target)) return;
      if (serviceLayersMenuRef.current?.contains(target)) return;
      setShowServiceLayers(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showServiceLayers]);

  const handleBasemapClick = () => {
    if (!showBaseMap && basemapAnchorRef.current) {
      const rect = basemapAnchorRef.current.getBoundingClientRect();
      setBaseMapPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowBaseMap((v) => !v);
  };

  const handleServiceLayersClick = () => {
    if (!showServiceLayers && serviceLayersAnchorRef.current) {
      const rect = serviceLayersAnchorRef.current.getBoundingClientRect();
      setServiceLayersPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowServiceLayers((v) => !v);
  };

  const handleCreateLayer = () => {
    const name = window.prompt('اسم طبقة الخدمات الجديدة');
    if (!name) return;
    onCreateServiceLayer?.(name);
  };

  const stepHint: string | null = !activeSceneUid
    ? '① اختر صورة فضائية'
    : !hasResult && !running
      ? '② شغّل تحليل الصورة'
      : drawMode !== 'off'
        ? '③ ارسم منطقة على الخريطة'
        : null;

  const tools: { icon: React.ElementType; label: string; mode: DrawMode }[] = [
    { icon: MousePointer2, label: 'تحديد', mode: 'off' },
    { icon: Square, label: 'مستطيل', mode: 'box' },
    { icon: Hexagon, label: 'مضلع', mode: 'polygon' },
  ];

  return (
    <div
      className="h-11 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center gap-1 px-3 z-10 overflow-x-auto"
      dir="rtl"
    >
      {tools.map((t) => (
        <button
          key={t.mode}
          onClick={() => onDrawModeChange(drawMode === t.mode && t.mode !== 'off' ? 'off' : t.mode)}
          title={t.label}
          className={`flex items-center justify-center w-8 h-8 rounded transition-colors shrink-0 ${
            drawMode === t.mode
              ? 'bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <t.icon size={15} />
        </button>
      ))}

      {drawMode !== 'off' && (
        <button
          onClick={() => onDrawModeChange('off')}
          title="إلغاء الرسم"
          className="flex items-center justify-center w-8 h-8 rounded text-rose-400 hover:bg-rose-900/30 transition-colors shrink-0"
        >
          <Trash2 size={14} />
        </button>
      )}

      <div className="w-px h-5 bg-slate-700 mx-1 shrink-0" />

      <div className="relative shrink-0">
        <button
          ref={basemapAnchorRef}
          onClick={handleBasemapClick}
          className="flex items-center gap-1.5 px-2.5 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
        >
          <MapIcon size={13} />
          <span>{BASEMAPS[baseStyle].label}</span>
          <ChevronDown size={11} />
        </button>
        {showBaseMap && baseMapPos && (
          <div
            style={{ position: 'fixed', top: baseMapPos.top, right: baseMapPos.right, zIndex: 9999 }}
            className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[110px]"
          >
            {(Object.entries(BASEMAPS) as [BaseStyle, { label: string }][]).map(([key, bm]) => (
              <button
                key={key}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onBaseStyleChange(key);
                  setShowBaseMap(false);
                }}
                className={`w-full text-right px-3 py-1.5 text-[11px] transition-colors ${
                  baseStyle === key ? 'text-blue-400 bg-blue-900/30' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {bm.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-slate-700 mx-1 shrink-0" />

      <div className="relative shrink-0">
        <button
          ref={serviceLayersAnchorRef}
          onClick={handleServiceLayersClick}
          className="flex items-center gap-1.5 px-2.5 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
          title="إدارة طبقات الخدمات"
        >
          <Layers3 size={13} />
          <span>الطبقات</span>
          <span className="text-[10px] text-cyan-300">{serviceLayers.length}</span>
          <ChevronDown size={11} />
        </button>
        {showServiceLayers && serviceLayersPos && (
          <div
            ref={serviceLayersMenuRef}
            style={{ position: 'fixed', top: serviceLayersPos.top, right: serviceLayersPos.right, zIndex: 9999 }}
            className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 min-w-[260px]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-300 font-semibold">طبقات الخدمات</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCreateLayer}
                  className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center"
                  title="إضافة طبقة"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={onReloadServiceLayers}
                  className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center"
                  title="تحديث"
                >
                  <RefreshCw size={12} className={serviceLayersLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            {serviceLayersError && <p className="text-[10px] text-rose-300 mb-2">{serviceLayersError}</p>}
            {serviceLayers.length === 0 ? (
              <p className="text-[10px] text-slate-500 px-1 py-2">لا توجد طبقات خدمات بعد</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {[...serviceLayers].sort((a, b) => a.order - b.order).map((layer, idx, arr) => (
                  <div
                    key={layer.id}
                    className="flex items-center gap-1 rounded bg-slate-900/60 border border-slate-700/50 px-2 py-1.5"
                  >
                    {/* reorder */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => onReorderServiceLayer?.(layer.id, 'up')}
                        disabled={idx === 0}
                        className="w-4 h-3.5 text-slate-500 hover:text-slate-200 disabled:opacity-30 flex items-center justify-center"
                        title="تحريك لأعلى"
                      ><ChevronUp size={10} /></button>
                      <button
                        onClick={() => onReorderServiceLayer?.(layer.id, 'down')}
                        disabled={idx === arr.length - 1}
                        className="w-4 h-3.5 text-slate-500 hover:text-slate-200 disabled:opacity-30 flex items-center justify-center rotate-180"
                        title="تحريك لأسفل"
                      ><ChevronUp size={10} /></button>
                    </div>
                    {/* name + municipality */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-200 truncate">{layer.name}</p>
                      <p className="text-[9px] text-slate-500">{layer.municipality_key || 'all-libya'}</p>
                    </div>
                    {/* visibility */}
                    <button
                      onClick={() => onToggleServiceLayer?.(layer.id, !layer.visible)}
                      className="text-slate-400 hover:text-slate-200 shrink-0"
                      title={layer.visible ? 'إخفاء الطبقة' : 'إظهار الطبقة'}
                    >
                      {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    {/* delete */}
                    <button
                      onClick={() => {
                        if (window.confirm(`حذف طبقة "${layer.name}"؟`)) {
                          onDeleteServiceLayer?.(layer.id);
                        }
                      }}
                      className="text-slate-600 hover:text-rose-400 shrink-0"
                      title="حذف الطبقة"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-slate-700 mx-1 shrink-0" />

      {scenes.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Camera size={13} className="text-slate-500 shrink-0" />
          <select
            value={activeSceneUid ?? ''}
            onChange={(e) => onSceneChange(e.target.value)}
            className="h-7 px-2 rounded bg-slate-800 border border-slate-700 text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px]"
            dir="rtl"
          >
            {scenes.map((s) => {
              const lbl = parseSceneLabel(s.scene_uid, s.data_is_real);
              return (
                <option key={s.scene_uid} value={s.scene_uid}>
                  {lbl.area} · {lbl.dateShort}
                  {lbl.isReal ? ' ●' : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {workflows.length > 0 && (
        <select
          value={activeWorkflow}
          onChange={(e) => onWorkflowChange(e.target.value)}
          className="h-7 px-2 rounded bg-slate-800 border border-slate-700 text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0 max-w-[160px]"
          dir="rtl"
        >
          {workflows.map((w) => (
            <option key={w.workflow_key} value={w.workflow_key}>
              {w.name_ar ?? (w as any).name_ar ?? w.description ?? w.workflow_key}
            </option>
          ))}
        </select>
      )}

      <div className="flex-1 min-w-0" />

      {stepHint && (
        <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2.5 py-1 rounded-full border border-slate-700/50 shrink-0">
          {stepHint}
        </span>
      )}

      {onOpenLayerEditor && (
        <button
          onClick={onOpenLayerEditor}
          title="محرر طبقات الخدمات والمرافق"
          className={`flex items-center gap-1.5 px-2.5 h-7 rounded text-[11px] font-semibold transition-colors shrink-0 border ${
            layerEditorOpen
              ? 'bg-cyan-700/30 border-cyan-500/60 text-cyan-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-600/40'
          }`}
        >
          <PenTool size={12} />
          محرر الطبقات
        </button>
      )}

      <button
        onClick={onRunAnalysis}
        disabled={running || !activeSceneUid || !systemOnline}
        title={!activeSceneUid ? 'اختر صورة فضائية أولاً' : !systemOnline ? 'النظام غير متصل' : 'تحليل الصورة الفضائية'}
        className="flex items-center gap-1.5 px-3.5 h-7 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-colors shrink-0"
      >
        {running ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
        {running ? 'جارٍ التحليل…' : 'تحليل الصورة'}
      </button>

      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        title="تحديث البيانات"
        className="flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0"
      >
        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
      </button>

      <div
        title={systemOnline ? 'النظام متصل' : 'النظام غير متصل'}
        className={`w-2 h-2 rounded-full shrink-0 ${systemOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}
      />
    </div>
  );
}
