'use client';
// ─── AreaTechnicalDetail ──────────────────────────────────────────────────────
// Technical/specialist view of area intelligence result.
// Shows raw metrics, ValueType badges, data provenance, and JSON export.
// Only shown when user explicitly switches to technical mode.

import React from 'react';
import { Download, Code2 } from 'lucide-react';
import type { AreaIntelResult, AreaMetric, ValueType } from '@/lib/areaIntelEngine';

// ─── ValueType badge ──────────────────────────────────────────────────────────

const VALUE_TYPE_CFG: Record<ValueType, { label: string; cls: string }> = {
  observed:            { label: 'مرصود',      cls: 'bg-emerald-950/50 text-emerald-400 border-emerald-700/40' },
  interpreted:         { label: 'مستقرأ',     cls: 'bg-blue-950/50   text-blue-400   border-blue-700/40'   },
  estimated:           { label: 'مقدّر',       cls: 'bg-amber-950/50  text-amber-400  border-amber-700/40'  },
  requires_validation: { label: 'يحتاج تحقق', cls: 'bg-rose-950/50   text-rose-400   border-rose-700/40'   },
};

function ValueTypeBadge({ type }: { type: ValueType }) {
  const { label, cls } = VALUE_TYPE_CFG[type];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9px] font-semibold shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

function MetricRow({ metric }: { metric: AreaMetric }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-slate-800/60 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-300">{metric.label}</span>
          <ValueTypeBadge type={metric.value_type} />
        </div>
        {metric.note && (
          <p className="text-[9px] text-slate-600 mt-0.5 leading-relaxed">{metric.note}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <span className="text-xs font-semibold text-slate-100">{metric.value}</span>
        {metric.unit && <span className="text-[9px] text-slate-500 mr-0.5">{metric.unit}</span>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  result: AreaIntelResult;
}

export default function AreaTechnicalDetail({ result }: Props) {

  function handleExport() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `area-intel-${result.scene_uid ?? 'unknown'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3" dir="rtl">

      {/* ── Technical header ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Code2 size={13} className="text-slate-500" />
          <span className="text-xs text-slate-500 font-semibold">التفاصيل التقنية</span>
          {result.scene_uid && (
            <span className="text-[9px] font-mono text-slate-600 bg-slate-800/60 px-2 py-0.5 rounded">
              {result.scene_uid}
            </span>
          )}
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800/50 transition-colors"
        >
          <Download size={11} />
          تصدير JSON
        </button>
      </div>

      {/* ── Metric groups ─────────────────────────────────────── */}
      {result.groups.map(group => (
        <div key={group.id} className="bg-slate-800/30 border border-slate-700/30 rounded-xl px-4 py-3">
          <p className="text-[10px] font-bold text-slate-500 mb-2 pb-1.5 border-b border-slate-700/30 uppercase tracking-wider">
            {group.title}
          </p>
          <div>
            {group.metrics.map(m => (
              <MetricRow key={m.id} metric={m} />
            ))}
          </div>
        </div>
      ))}

      {/* ── Quality/limitations notes ─────────────────────────── */}
      {result.quality.notes.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-700/20 rounded-xl px-4 py-3">
          <p className="text-[10px] font-bold text-slate-500 mb-2">قيود وجودة البيانات</p>
          <ul className="space-y-1">
            {result.quality.notes.map((note, i) => (
              <li key={i} className="text-[9px] text-slate-600 flex items-start gap-1.5">
                <span className="mt-0.5 text-slate-700 shrink-0">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Value type legend ─────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap pb-2 border-t border-slate-800 pt-2">
        <span className="text-[9px] text-slate-600 font-semibold">مفتاح:</span>
        {(Object.entries(VALUE_TYPE_CFG) as [ValueType, { label: string; cls: string }][]).map(([t, { label, cls }]) => (
          <span key={t} className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9px] font-semibold ${cls}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
