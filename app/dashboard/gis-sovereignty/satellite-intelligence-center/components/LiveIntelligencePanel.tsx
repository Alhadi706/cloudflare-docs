'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { getSceneSummary, type SceneSummaryContract } from '@/lib/satelliteIntelAPI';
import SceneSummaryCard from './SceneSummaryCard';

interface Props {
  sceneUid: string | null;
}

export default function LiveIntelligencePanel({ sceneUid }: Props) {
  const [summary, setSummary] = useState<SceneSummaryContract | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sceneUid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getSceneSummary(sceneUid);
      setSummary(res.summary);
    } catch (e: any) {
      setError(e.message ?? 'فشل جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, [sceneUid]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-200">الاستخبارات الحية</h2>
          {summary && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950/60 text-blue-400 border border-blue-700/40 font-mono">
              {summary.provenance.data_is_real ? 'COG حقيقي' : 'محاكاة'}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={!sceneUid || loading}
          className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {!sceneUid && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Activity className="w-8 h-8 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">اختر مشهداً لعرض الاستخبارات الحية</p>
            <p className="text-xs text-slate-600 mt-1">تحليل المؤشرات الطيفية ومخرجات الذكاء</p>
          </div>
        )}

        {sceneUid && loading && (
          <div className="flex flex-col items-center justify-center h-48">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mb-3" />
            <p className="text-sm text-slate-400">يتم تحليل المشهد...</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 bg-rose-950/30 border border-rose-700/40 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-300">خطأ في الجلب</p>
              <p className="text-xs text-rose-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {summary && !loading && (
          <>
            {/* Summary text block */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3.5">
              <p className="text-[11px] font-semibold text-slate-400 mb-1.5">ملخص المشهد</p>
              <p className="text-xs text-slate-300 leading-relaxed">{summary.summary_text}</p>
            </div>

            {/* Full contract card */}
            <SceneSummaryCard summary={summary} compact={false} />
          </>
        )}
      </div>
    </div>
  );
}
