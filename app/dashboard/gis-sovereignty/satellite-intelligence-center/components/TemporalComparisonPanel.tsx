'use client';
import React, { useState } from 'react';
import { GitCompare, Play, RefreshCw, AlertCircle, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  getComparisonSummary,
  type ComparisonSummaryContract,
  type ComparisonResult,
  type SceneListItem,
} from '@/lib/satelliteIntelAPI';
import ConfidenceBadge from './ConfidenceBadge';

const INDICATOR_LABELS: Record<string, string> = {
  ndvi: 'NDVI', ndwi: 'NDWI', mndwi: 'MNDWI', nbr: 'NBR',
  ndbi: 'NDBI', savi: 'SAVI', evi: 'EVI', bai: 'BAI',
};

const MAG_COLORS: Record<string, string> = {
  none: 'text-slate-500',
  minimal: 'text-slate-400',
  moderate: 'text-yellow-400',
  significant: 'text-orange-400',
  critical: 'text-red-400',
  suppressed: 'text-slate-600',
};

const MAG_AR: Record<string, string> = {
  none: 'لا تغيير', minimal: 'طفيف', moderate: 'متوسط',
  significant: 'ملحوظ', critical: 'حرج', suppressed: 'موقوف',
};

const COMP_CLASS_COLORS: Record<string, string> = {
  comparable: 'text-emerald-400 border-emerald-700/40 bg-emerald-950/40',
  weakly_comparable: 'text-amber-400 border-amber-700/40 bg-amber-950/40',
  not_comparable: 'text-rose-400 border-rose-700/40 bg-rose-950/40',
};

const COMP_CLASS_AR: Record<string, string> = {
  comparable: 'قابل للمقارنة',
  weakly_comparable: 'ضعيف القابلية',
  not_comparable: 'غير قابل للمقارنة',
};

function DeltaIcon({ direction }: { direction: string }) {
  if (direction === 'increase') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (direction === 'decrease') return <TrendingDown className="w-3.5 h-3.5 text-rose-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-500" />;
}

interface Props {
  scenes: SceneListItem[];
}

export default function TemporalComparisonPanel({ scenes }: Props) {
  const [beforeUid, setBeforeUid] = useState<string>('');
  const [afterUid, setAfterUid] = useState<string>('');
  const [result, setResult] = useState<ComparisonSummaryContract | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!beforeUid || !afterUid || beforeUid === afterUid) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await getComparisonSummary(beforeUid, afterUid);
      setResult(res.summary);
    } catch (e: any) {
      setError(e.message ?? 'فشلت المقارنة');
    } finally {
      setRunning(false);
    }
  };

  const sceneOptions = scenes.map(s => (
    <option key={s.scene_uid} value={s.scene_uid}>
      {s.scene_uid.length > 40 ? '…' + s.scene_uid.slice(-38) : s.scene_uid}
      {s.data_is_real ? ' ★' : ''}
    </option>
  ));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <GitCompare className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-slate-200">المقارنة الزمنية</h2>
      </div>

      {/* Scene Selectors */}
      <div className="space-y-3 mb-4 shrink-0">
        <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500">قبل (Baseline)</label>
            <select
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-200 appearance-none focus:outline-none focus:border-purple-500/60"
              value={beforeUid}
              onChange={e => setBeforeUid(e.target.value)}
            >
              <option value="">— اختر —</option>
              {sceneOptions}
            </select>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0 mt-4" />
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500">بعد (Current)</label>
            <select
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-200 appearance-none focus:outline-none focus:border-purple-500/60"
              value={afterUid}
              onChange={e => setAfterUid(e.target.value)}
            >
              <option value="">— اختر —</option>
              {sceneOptions}
            </select>
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={!beforeUid || !afterUid || beforeUid === afterUid || running}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-700/30 hover:bg-purple-700/50 border border-purple-600/40 rounded-xl text-sm font-semibold text-purple-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> جارٍ المقارنة...</>
          ) : (
            <><GitCompare className="w-4 h-4" /> مقارنة المشهدين</>
          )}
        </button>
        {beforeUid === afterUid && beforeUid && (
          <p className="text-[10px] text-rose-400 text-center">لا يمكن مقارنة المشهد بنفسه</p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {error && (
          <div className="flex items-start gap-2 bg-rose-950/30 border border-rose-700/40 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="text-xs text-rose-400">{error}</p>
          </div>
        )}

        {result && !running && (
          <>
            {/* Comparability header */}
            <div className={`rounded-xl border p-3 ${COMP_CLASS_COLORS[result.comparability.comparability_class]}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold">
                  {COMP_CLASS_AR[result.comparability.comparability_class]}
                </span>
                <ConfidenceBadge value={result.comparability.confidence_class} />
              </div>
              <p className="text-[10px] opacity-80">
                الفجوة الزمنية: {result.comparability.temporal_gap_days} يوماً
              </p>
              <p className="text-[10px] opacity-70 mt-1">{result.comparability.recommendation}</p>
            </div>

            {/* Summary */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 leading-relaxed">{result.comparability.recommendation}</p>
              {result.limitations?.[0] && (
                <p className="text-[9px] text-amber-400/70 mt-1.5">⚠ {result.limitations[0]}</p>
              )}
            </div>

            {/* Changes stats */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'إجمالي المقارنات', value: result.comparisons.length, color: 'text-slate-300' },
                { label: 'تغييرات موثوقة', value: result.reliable_changes.length, color: 'text-emerald-400' },
                { label: 'مُعطَّلة (S5)', value: result.comparisons.length - result.reliable_changes.length, color: 'text-rose-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-800/40 rounded-lg border border-slate-700/40 p-2.5 text-center">
                  <p className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</p>
                  <p className="text-[9px] text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Reliable changes list */}
            {result.reliable_changes.length === 0 ? (
              <div className="bg-slate-800/20 rounded-xl border border-slate-700/30 p-4 text-center">
                <p className="text-sm text-slate-500">لا توجد تغييرات موثوقة</p>
                <p className="text-xs text-slate-600 mt-1">جميع المقارنات تم إيقافها بواسطة بوابات S5</p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-semibold text-slate-300 mb-2">التغييرات الموثوقة</p>
                <div className="space-y-2">
                  {result.reliable_changes.map((rc: ComparisonResult) => (
                    <div key={rc.indicator_type} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <DeltaIcon direction={rc.change_direction} />
                          <span className="text-[11px] font-mono font-bold text-slate-200">
                            {INDICATOR_LABELS[rc.indicator_type] ?? rc.indicator_type.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono font-bold ${MAG_COLORS[rc.effective_magnitude] ?? 'text-slate-400'}`}>
                            {MAG_AR[rc.effective_magnitude] ?? rc.effective_magnitude}
                          </span>
                        </div>
                      </div>

                      {/* Delta */}
                      <div className="grid grid-cols-5 gap-1 items-center text-center">
                        <div className="col-span-2 bg-slate-900/50 rounded p-1.5">
                          <p className="text-[9px] text-slate-500">تغيير الوسط</p>
                          <p className={`text-[11px] font-mono font-bold ${rc.delta_mean > 0 ? 'text-emerald-400' : rc.delta_mean < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                            {rc.delta_mean > 0 ? '+' : ''}{rc.delta_mean.toFixed(3)}
                          </p>
                        </div>
                        <div className="flex justify-center">
                          <ArrowRight className="w-3 h-3 text-slate-600" />
                        </div>
                        <div className="col-span-2 bg-slate-900/50 rounded p-1.5">
                          <p className="text-[9px] text-slate-500">الاتجاه</p>
                          <p className="text-[9px] font-mono text-slate-400">
                            {rc.change_direction === 'increase' ? '↑ ارتفاع' : rc.change_direction === 'decrease' ? '↓ انخفاض' : '— ثابت'}
                          </p>
                        </div>
                      </div>

                      {/* Pixel stats */}
                      <div className="grid grid-cols-2 gap-1 mt-1.5">
                        <div className="text-center">
                          <p className="text-[9px] text-emerald-500/70">↑ {rc.pct_pixels_increased.toFixed(1)}% ارتفع</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] text-rose-500/70">↓ {rc.pct_pixels_decreased.toFixed(1)}% انخفض</p>
                        </div>
                      </div>

                      {rc.validity.applied_rules.length > 0 && (
                        <p className="text-[9px] text-slate-600 font-mono mt-1">
                          قواعد S5: {rc.validity.applied_rules.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!result && !running && !error && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <GitCompare className="w-7 h-7 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">اختر مشهدَين للمقارنة الزمنية</p>
            <p className="text-xs text-slate-600 mt-1">يعرض التغيير الخام مقابل الفعّال (بعد بوابات S5)</p>
          </div>
        )}
      </div>
    </div>
  );
}
