'use client';
// ─── IntelligenceDrawer ───────────────────────────────────────────────────────
// Collapsible floating panel positioned over the map (right side).
// When expanded: shows SituationOverviewCard in a glass panel.
// When collapsed: shows a thin vertical tab to re-open.

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Brain } from 'lucide-react';
import type { SceneSummaryContract } from '@/lib/satelliteIntelAPI';
import SituationOverviewCard from './SituationOverviewCard';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  summary: SceneSummaryContract | null;
  loading: boolean;
  sceneUid: string | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IntelligenceDrawer({ summary, loading, sceneUid }: Props) {
  const [open, setOpen] = useState(true);

  // ── Collapsed state ─────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        dir="rtl"
        className="absolute top-3 right-0 z-30 flex flex-col items-center gap-1 bg-slate-900/90 backdrop-blur-sm border border-slate-700/60 border-r-0 rounded-l-xl px-1.5 py-3 shadow-2xl hover:bg-slate-800/90 transition-colors"
        title="فتح لوحة الاستخبارات"
      >
        <Brain className="w-3.5 h-3.5 text-cyan-400" />
        <ChevronLeft className="w-3 h-3 text-slate-500 mt-0.5" />
        <span
          className="text-[9px] text-slate-400 font-semibold mt-1"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          الموقف
        </span>
      </button>
    );
  }

  // ── Expanded state ───────────────────────────────────────────────────────
  return (
    <div
      dir="rtl"
      className="absolute top-3 right-3 bottom-16 w-80 z-30 flex flex-col overflow-hidden
                 bg-slate-900/92 backdrop-blur-md rounded-2xl
                 border border-slate-700/60 shadow-2xl shadow-black/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/70 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold text-slate-200 tracking-wide">
            لوحة الموقف
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
          title="طي اللوحة"
        >
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      {/* Content — SituationOverviewCard fills and scrolls */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden
                      scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <SituationOverviewCard
          summary={summary}
          loading={loading}
          sceneUid={sceneUid}
        />
      </div>
    </div>
  );
}
