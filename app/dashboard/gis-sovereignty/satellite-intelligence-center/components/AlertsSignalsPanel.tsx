'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Bell, RefreshCw, AlertCircle, ShieldCheck, BellOff } from 'lucide-react';
import { getSceneSummary, type IntelligenceOutput, type SceneSummaryContract } from '@/lib/satelliteIntelAPI';
import SemanticLevelBadge from './SemanticLevelBadge';
import ConfidenceBadge from './ConfidenceBadge';

const OUTPUT_TYPE_AR: Record<string, string> = {
  vegetation_stress: 'إجهاد النباتات',
  flood_exposure:    'تعرض للفيضان',
  fire_risk:         'خطر الحريق',
  urban_expansion:   'توسع عمراني',
};

const CLASSIFICATION_AR: Record<string, string> = {
  none: 'لا شيء', low: 'منخفض', moderate: 'متوسط', high: 'عالٍ', critical: 'حرج',
};

interface ActiveSignal {
  output: IntelligenceOutput;
  sceneUid: string;
  confidence_class: 'high' | 'medium' | 'low';
  provenance_is_real: boolean;
}

interface Props {
  sceneUid: string | null;
}

export default function AlertsSignalsPanel({ sceneUid }: Props) {
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
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sceneUid]);

  useEffect(() => { load(); }, [load]);

  // Derive active signals: only accepted/downgraded (not suppressed), sorted by severity
  const activeSignals: ActiveSignal[] = React.useMemo(() => {
    if (!summary) return [];
    const LEVEL_ORDER = { alert: 0, advisory: 1, informational: 2 };
    return summary.intelligence_outputs
      .filter(o => o.validity.verdict !== 'suppressed')
      .sort((a, b) =>
        (LEVEL_ORDER[a.semantic_level] ?? 2) - (LEVEL_ORDER[b.semantic_level] ?? 2)
      )
      .map(o => ({
        output: o,
        sceneUid: summary.scene_uid,
        confidence_class: summary.quality.confidence_class,
        provenance_is_real: summary.provenance.data_is_real,
      }));
  }, [summary]);

  const suppressedCount = summary
    ? summary.intelligence_outputs.filter(o => o.validity.verdict === 'suppressed').length
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">الإشارات والتنبيهات</h2>
          {summary && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-700/40 font-mono">
              {activeSignals.length} نشط
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

      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {!sceneUid && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Bell className="w-8 h-8 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">اختر مشهداً لعرض الإشارات</p>
          </div>
        )}

        {sceneUid && loading && (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-rose-950/30 border border-rose-700/40 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="text-xs text-rose-400">{error}</p>
          </div>
        )}

        {summary && !loading && (
          <>
            {/* S5 Gate notice */}
            <div className="flex items-center gap-2 bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-[10px] text-slate-400">
                الإشارات المعروضة اجتازت بوابات صحة S5 فقط.
                {suppressedCount > 0 && (
                  <span className="text-rose-400/70"> تم إيقاف {suppressedCount} مخرجات.</span>
                )}
              </p>
            </div>

            {/* No active signals */}
            {activeSignals.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 bg-slate-800/20 rounded-xl border border-slate-700/30">
                <BellOff className="w-6 h-6 text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">لا توجد إشارات نشطة</p>
                <p className="text-xs text-slate-600 mt-1">
                  {suppressedCount > 0
                    ? `تم إيقاف ${suppressedCount} مخرجات بسبب ضعف البيانات`
                    : 'جميع المؤشرات ضمن الحدود الطبيعية'}
                </p>
              </div>
            )}

            {/* Signal cards */}
            {activeSignals.map(({ output, confidence_class, provenance_is_real }) => (
              <div
                key={output.output_type}
                className={`rounded-xl border p-4 ${
                  output.semantic_level === 'alert'
                    ? 'bg-rose-950/25 border-rose-700/50'
                    : output.semantic_level === 'advisory'
                    ? 'bg-amber-950/20 border-amber-700/40'
                    : 'bg-slate-800/30 border-slate-700/40'
                }`}
              >
                {/* Title row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">
                      {OUTPUT_TYPE_AR[output.output_type] ?? output.output_type}
                    </span>
                    {output.validity.verdict === 'downgraded' && (
                      <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700/40 px-1.5 py-0.5 rounded-full font-mono">
                        خُفِّض
                      </span>
                    )}
                  </div>
                  <SemanticLevelBadge value={output.semantic_level} size="md" />
                </div>

                {/* Severity + Confidence row */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-400">الشدة:</span>
                  <span className={`text-xs font-mono font-bold ${
                    output.effective_classification === 'critical' ? 'text-red-400' :
                    output.effective_classification === 'high' ? 'text-orange-400' :
                    output.effective_classification === 'moderate' ? 'text-yellow-400' :
                    'text-slate-400'
                  }`}>
                    {CLASSIFICATION_AR[output.effective_classification] ?? output.effective_classification}
                  </span>
                  {output.raw_classification !== output.effective_classification && (
                    <span className="text-[9px] text-slate-600 line-through">
                      {CLASSIFICATION_AR[output.raw_classification] ?? output.raw_classification}
                    </span>
                  )}
                  <div className="flex-1" />
                  <ConfidenceBadge value={confidence_class} />
                </div>

                {/* Meaning */}
                <p className="text-[10px] text-slate-400 leading-relaxed mb-2 line-clamp-3">
                  {output.meaning}
                </p>

                {/* Use Guidance */}
                <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/30">
                  <p className="text-[9px] font-semibold text-slate-400 mb-1">إرشادات الاستخدام</p>
                  <p className="text-[9px] text-slate-500 leading-relaxed">{output.use_guidance}</p>
                </div>

                {/* Data provenance note */}
                {!provenance_is_real && (
                  <p className="text-[9px] text-amber-500/60 mt-2 font-mono">
                    ⚠ بيانات محاكاة — لا تستخدم لاتخاذ قرارات تشغيلية
                  </p>
                )}

                {/* Applied rules */}
                {output.validity.applied_rules.length > 0 && (
                  <p className="text-[9px] text-slate-600 mt-1 font-mono">
                    قواعد S5: {output.validity.applied_rules.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
