'use client';
// ─── MissionControlBar ──────────────────────────────────────────────────────
// The primary operational control strip at the top of the Satellite Intelligence Center.
// Contains: scene selector · workflow selector · run button · system status · freshness

import React from 'react';
import { Play, RefreshCw, Clock, Satellite } from 'lucide-react';
import type { SceneListItem, WorkflowInfo } from '@/lib/satelliteIntelAPI';

interface Props {
  scenes: SceneListItem[];
  workflows: WorkflowInfo[];
  activeSceneUid: string | null;
  activeWorkflow: string;
  running: boolean;
  systemOnline: boolean;
  freshnessLabel: string;
  isRefreshing: boolean;
  onSceneChange: (uid: string) => void;
  onWorkflowChange: (wf: string) => void;
  onRunAnalysis: () => void;
  onRefresh: () => void;
}

// Workflows always available even before API responds
const FALLBACK_WORKFLOWS = [
  { workflow_key: 'environment_summary', description: 'ملخص بيئي شامل' },
];

export default function MissionControlBar({
  scenes,
  workflows,
  activeSceneUid,
  activeWorkflow,
  running,
  systemOnline,
  freshnessLabel,
  isRefreshing,
  onSceneChange,
  onWorkflowChange,
  onRunAnalysis,
  onRefresh,
}: Props) {
  const mergedWorkflows = [
    ...FALLBACK_WORKFLOWS,
    ...workflows.filter(
      w => !w.needs_compare && w.workflow_key !== 'environment_summary',
    ),
  ];

  const activeScene = scenes.find(s => s.scene_uid === activeSceneUid);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 flex-wrap"
      dir="rtl"
    >
      {/* ── Brand + System Status ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            systemOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
          }`}
          title={systemOnline ? 'النظام متصل' : 'غير متصل'}
        />
        <div className="flex items-center gap-1.5">
          <Satellite className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-bold text-slate-300 tracking-wide">
            مركز الاستخبارات الفضائية
          </span>
        </div>
      </div>

      <div className="w-px h-5 bg-slate-700 shrink-0" />

      {/* ── Scene Selector ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xs">
        <label className="text-[10px] font-semibold text-slate-500 shrink-0">
          المشهد
        </label>
        <select
          className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-200 appearance-none focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          value={activeSceneUid ?? ''}
          onChange={e => onSceneChange(e.target.value)}
          disabled={scenes.length === 0}
        >
          <option value="" disabled>— اختر مشهداً —</option>
          {scenes.map(s => (
            <option key={s.scene_uid} value={s.scene_uid}>
              {s.scene_uid.length > 38
                ? '…' + s.scene_uid.slice(-36)
                : s.scene_uid}
              {s.data_is_real ? ' ★' : ''}
            </option>
          ))}
        </select>
        {/* Active scene indicator */}
        {activeScene && (
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              activeScene.data_is_real
                ? 'bg-blue-950/70 text-blue-400 border border-blue-700/40'
                : 'bg-amber-950/70 text-amber-400 border border-amber-700/40'
            }`}
          >
            {activeScene.data_is_real ? 'COG ★' : 'محاكاة'}
          </span>
        )}
      </div>

      {/* ── Workflow Selector ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        <label className="text-[10px] font-semibold text-slate-500 shrink-0">
          التحليل
        </label>
        <select
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 appearance-none focus:outline-none focus:border-blue-500 transition-colors cursor-pointer max-w-[200px]"
          value={activeWorkflow}
          onChange={e => onWorkflowChange(e.target.value)}
        >
          {mergedWorkflows.map(w => (
            <option key={w.workflow_key} value={w.workflow_key}>
              {w.description || w.workflow_key}
            </option>
          ))}
        </select>
      </div>

      {/* ── Run Button ─────────────────────────────────────────────────── */}
      <button
        onClick={onRunAnalysis}
        disabled={!activeSceneUid || running}
        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-xs font-bold transition-colors shrink-0 select-none"
      >
        {running ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>جاري التحليل…</span>
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>تشغيل التحليل</span>
          </>
        )}
      </button>

      {/* ── Spacer ─────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Freshness + Refresh ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
        <Clock className="w-3 h-3 shrink-0" />
        <span className="hidden sm:block">{freshnessLabel}</span>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          title="تحديث البيانات"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
