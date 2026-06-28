'use client';
/**
 * GisTimeEngine — محرك التصفية الزمنية
 * ══════════════════════════════════════
 * يتيح تصفية الطبقات حسب نطاق تاريخي أو مقارنة قبل/بعد.
 * متصل بـ gisEngine.timeFilter.
 */

import React from 'react';
import { Clock, CalendarRange, GitCompare, X, Check } from 'lucide-react';
import { useGisEngine, type TimeFilter } from '@/store/gisEngine';

export default function GisTimeEngine() {
  const timeFilter     = useGisEngine(s => s.timeFilter);
  const setTimeFilter  = useGisEngine(s => s.setTimeFilter);
  const resetTimeFilter = useGisEngine(s => s.resetTimeFilter);

  const handleMode = (mode: TimeFilter['mode']) => setTimeFilter({ mode });

  return (
    <div className="flex flex-col bg-slate-900/95 border-b border-slate-800 px-3 py-2 gap-2" dir="rtl">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-200 flex-1">التصفية الزمنية</span>

        {/* Enable toggle */}
        <button
          onClick={() => setTimeFilter({ enabled: !timeFilter.enabled })}
          className={`relative w-10 h-5 rounded-full transition-colors ${timeFilter.enabled ? 'bg-amber-500' : 'bg-slate-700'}`}
          title={timeFilter.enabled ? 'تعطيل التصفية الزمنية' : 'تفعيل التصفية الزمنية'}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${timeFilter.enabled ? 'translate-x-0.5' : 'translate-x-5'}`} />
        </button>
      </div>

      {timeFilter.enabled && (
        <>
          {/* Mode selector */}
          <div className="flex gap-1">
            {([
              { key: 'range',      icon: <CalendarRange className="w-3 h-3" />, label: 'نطاق' },
              { key: 'snapshot',   icon: <Clock className="w-3 h-3" />,         label: 'لقطة' },
              { key: 'comparison', icon: <GitCompare className="w-3 h-3" />,    label: 'مقارنة' },
            ] as { key: TimeFilter['mode']; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => handleMode(key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${timeFilter.mode === key ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Date inputs */}
          <div className="flex flex-col gap-1.5">
            {(timeFilter.mode === 'range' || timeFilter.mode === 'comparison') && (
              <>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-10 text-right">من</span>
                  <input
                    type="date"
                    value={timeFilter.start ?? ''}
                    onChange={e => setTimeFilter({ start: e.target.value || null })}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </label>
                {timeFilter.mode === 'range' && (
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-10 text-right">إلى</span>
                    <input
                      type="date"
                      value={timeFilter.end ?? ''}
                      onChange={e => setTimeFilter({ end: e.target.value || null })}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </label>
                )}
              </>
            )}

            {timeFilter.mode === 'snapshot' && (
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-10 text-right">تاريخ</span>
                <input
                  type="date"
                  value={timeFilter.start ?? ''}
                  onChange={e => setTimeFilter({ start: e.target.value || null, end: e.target.value || null })}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </label>
            )}

            {timeFilter.mode === 'comparison' && (
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-10 text-right">مقارنة</span>
                <input
                  type="date"
                  value={timeFilter.comparisonDate ?? ''}
                  onChange={e => setTimeFilter({ comparisonDate: e.target.value || null })}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={resetTimeFilter}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-3 h-3" />إعادة تعيين
            </button>
          </div>
        </>
      )}
    </div>
  );
}
