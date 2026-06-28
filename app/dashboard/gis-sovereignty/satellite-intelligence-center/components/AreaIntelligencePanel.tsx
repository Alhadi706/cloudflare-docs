'use client';
// ─── AreaIntelligencePanel ────────────────────────────────────────────────────
// Mode-switching orchestrator for area intelligence results.
//   Human mode  (default) → AreaHumanSummary   — plain Arabic, readable cards
//   Technical mode         → AreaTechnicalDetail — raw metrics, export, badges
// The toggle is clearly labelled; human mode is always the landing state.

import React, { useState } from 'react';
import { BarChart2, Eye, Code2 } from 'lucide-react';
import type { AreaIntelResult } from '@/lib/areaIntelEngine';
import AreaHumanSummary    from './AreaHumanSummary';
import AreaTechnicalDetail from './AreaTechnicalDetail';

// ─── Empty / loading states ───────────────────────────────────────────────────

function EmptyState({ polygon }: { polygon: [number, number][] | null }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-14 px-6" dir="rtl">
      <BarChart2 className="w-10 h-10 text-slate-700 mb-4" />
      {polygon ? (
        <>
          <p className="text-base font-semibold text-slate-400 mb-1">جارٍ حساب الاستخبارات…</p>
          <p className="text-sm text-slate-600">تحليل المنطقة المرسومة</p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-500 mb-2">لم يُرسم أي نطاق بعد</p>
          <p className="text-sm text-slate-600 leading-relaxed max-w-64">
            استخدم أدوات الرسم على الخريطة — ارسم مستطيلاً أو مضلعاً لتوليد تقرير استخباراتي للمنطقة
          </p>
          <div className="mt-4 flex flex-wrap gap-1 justify-center">
            <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-blue-900/30 text-blue-300 border border-blue-700/30">سنتينل-2 بصري</span>
            <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-indigo-900/30 text-indigo-300 border border-indigo-700/30">سنتينل-1 رادار SAR</span>
            <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-slate-700/40 text-slate-400 border border-slate-600/30">لاندسات أرشيف</span>
          </div>
          <p className="text-[9px] text-slate-700 mt-2">متعدد المصادر — جاهز</p>
        </>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface AreaIntelligencePanelProps {
  result:  AreaIntelResult | null;
  loading: boolean;
  polygon: [number, number][] | null;
}

export default function AreaIntelligencePanel({ result, loading, polygon }: AreaIntelligencePanelProps) {
  const [isTechnical, setIsTechnical] = useState(false);

  if (loading || (!result && polygon)) return <EmptyState polygon={polygon} />;
  if (!result)                          return <EmptyState polygon={null} />;

  return (
    <div className="h-full overflow-y-auto" dir="rtl">
      <div className="min-h-full flex flex-col gap-0">

        {/* ── Mode toggle strip ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-1 pb-4 pt-1 shrink-0">
          <span className="text-xs text-slate-500 font-semibold">
            {isTechnical ? 'وضع تقني' : 'وضع بسيط (افتراضي)'}
          </span>
          <div className="flex items-center gap-1 p-0.5 bg-slate-800/60 border border-slate-700/40 rounded-lg">
            <button
              onClick={() => setIsTechnical(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                !isTechnical
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Eye size={11} />
              بسيط
            </button>
            <button
              onClick={() => setIsTechnical(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                isTechnical
                  ? 'bg-slate-700/60 text-slate-200 border border-slate-600/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Code2 size={11} />
              تقني
            </button>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        {isTechnical
          ? <AreaTechnicalDetail result={result} />
          : <AreaHumanSummary    result={result} />
        }

      </div>
    </div>
  );
}
