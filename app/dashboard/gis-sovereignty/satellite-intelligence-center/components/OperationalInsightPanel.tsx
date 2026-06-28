'use client';
// ─── OperationalInsightPanel ─────────────────────────────────────────────────
// Shows the trust, confidence, validity and top intelligence signals
// from the most recently run analysis. Designed for fast operational reading:
// Grade → Confidence → Signals → Limitations → Guidance.

import React from 'react';
import {
  Satellite,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle,
  MinusCircle,
} from 'lucide-react';
import type { SceneSummaryContract } from '@/lib/satelliteIntelAPI';

interface Props {
  summary: SceneSummaryContract | null;
  loading: boolean;
  sceneUid: string | null;
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const GRADE: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string; hint: string }
> = {
  operational: {
    label: 'تشغيلي',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-700/40',
    dot: 'bg-emerald-400',
    hint: 'يمكن الاعتماد على هذه البيانات في القرارات التشغيلية',
  },
  advisory: {
    label: 'استشاري',
    color: 'text-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-700/40',
    dot: 'bg-amber-400',
    hint: 'للاسترشاد فقط — قيّد نتائجك بمصادر إضافية',
  },
  reference_only: {
    label: 'مرجعي',
    color: 'text-slate-400',
    bg: 'bg-slate-800/50',
    border: 'border-slate-600/40',
    dot: 'bg-slate-500',
    hint: 'للأرشيف والمرجعية فقط — لا تُستخدم في القرارات',
  },
};

const CONF: Record<string, { label: string; barClass: string; barWidth: string }> = {
  high:   { label: 'ثقة عالية',    barClass: 'bg-emerald-500', barWidth: 'w-full' },
  medium: { label: 'ثقة متوسطة',   barClass: 'bg-amber-500',   barWidth: 'w-2/3'  },
  low:    { label: 'ثقة منخفضة',   barClass: 'bg-rose-500',    barWidth: 'w-1/3'  },
};

const LEVEL_ORDER: Record<string, number> = { alert: 0, advisory: 1, informational: 2 };

const LEVEL_DOT: Record<string, string> = {
  alert: 'bg-red-400', advisory: 'bg-amber-400', informational: 'bg-blue-400',
};
const LEVEL_COLOR: Record<string, string> = {
  alert: 'text-red-400', advisory: 'text-amber-400', informational: 'text-blue-400',
};
const LEVEL_AR: Record<string, string> = {
  alert: 'تنبيه', advisory: 'تحذير', informational: 'معلوماتي',
};

const OUTPUT_AR: Record<string, string> = {
  vegetation_stress: 'إجهاد النباتات',
  flood_exposure:    'تعرض للفيضان',
  fire_risk:         'خطر الحريق',
  urban_expansion:   'توسع عمراني',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function OperationalInsightPanel({ summary, loading, sceneUid }: Props) {
  // ── Empty: no scene selected ──────────────────────────────────────────────
  if (!sceneUid) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 text-center">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
          <Satellite className="w-5 h-5 text-slate-600" />
        </div>
        <p className="text-xs font-semibold text-slate-400 mb-1">ابدأ التحليل</p>
        <p className="text-[10px] text-slate-600 leading-relaxed">
          اختر مشهداً ونوع التحليل من شريط التحكم أعلاه، ثم اضغط «تشغيل التحليل»
        </p>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-10 h-10 rounded-full bg-blue-950/60 flex items-center justify-center mb-3">
          <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
        </div>
        <p className="text-xs text-blue-400 font-semibold">يتم التحليل…</p>
        <p className="text-[10px] text-slate-600 mt-1">
          تحليل المؤشرات الطيفية…
        </p>
      </div>
    );
  }

  // ── Waiting for first run ─────────────────────────────────────────────────
  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 text-center">
        <div className="w-10 h-10 rounded-full bg-slate-800/70 border border-slate-700 flex items-center justify-center mb-3">
          <Activity className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-xs font-semibold text-slate-400 mb-1">جاهز للتحليل</p>
        <p className="text-[10px] text-slate-600 leading-relaxed">
          اضغط «تشغيل التحليل» لتحليل المشهد المحدد
        </p>
      </div>
    );
  }

  // ── Summary ready ─────────────────────────────────────────────────────────
  const { quality, provenance, intelligence_outputs, limitations, indicators } = summary;

  const grade = GRADE[quality.operational_grade] ?? GRADE.reference_only;
  const conf  = CONF[quality.confidence_class]  ?? CONF.low;

  const activeOutputs = intelligence_outputs
    .filter(o => o.validity.verdict !== 'suppressed')
    .sort((a, b) => (LEVEL_ORDER[a.semantic_level] ?? 2) - (LEVEL_ORDER[b.semantic_level] ?? 2))
    .slice(0, 3);

  const suppressedCount  = intelligence_outputs.filter(o => o.validity.verdict === 'suppressed').length;
  const validIndicators  = indicators.filter(i => i.validity.verdict !== 'suppressed').length;

  const shortUid = summary.scene_uid.length > 32
    ? '…' + summary.scene_uid.slice(-30)
    : summary.scene_uid;

  const nextActionText =
    quality.operational_grade === 'operational' &&
    activeOutputs.some(o => o.semantic_level === 'alert')
      ? 'تنبيه نشط — راجع تبويب الإشارات'
      : quality.operational_grade === 'operational'
      ? 'البيانات تشغيلية — يمكن المقارنة أو التصدير'
      : quality.operational_grade === 'advisory'
      ? 'راجع المؤشرات التفصيلية قبل القرار'
      : 'استخدم مشهداً حقيقياً للعمليات';

  return (
    <div className="flex flex-col h-full overflow-y-auto px-3 py-3 space-y-3">

      {/* ── Scene identity ─────────────────────────────────────────────── */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">
              المشهد النشط
            </p>
            <p
              className="text-[10px] font-mono text-slate-300 break-all leading-tight"
              title={summary.scene_uid}
            >
              {shortUid}
            </p>
            {provenance.acquisition_date && (
              <p className="text-[9px] text-slate-500 mt-0.5">
                {provenance.acquisition_date}
              </p>
            )}
          </div>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              provenance.data_is_real
                ? 'bg-blue-950/60 text-blue-400 border border-blue-700/40'
                : 'bg-amber-950/60 text-amber-400 border border-amber-700/40'
            }`}
          >
            {provenance.data_is_real ? 'COG ★' : 'محاكاة'}
          </span>
        </div>
      </div>

      {/* ── Operational Grade ─────────────────────────────────────────── */}
      <div className={`rounded-xl border p-2.5 ${grade.bg} ${grade.border}`}>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
          مستوى الاستخدام
        </p>
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${grade.dot}`} />
          <span className={`text-base font-bold ${grade.color}`}>{grade.label}</span>
        </div>
        <p className="text-[9px] text-slate-500 leading-snug">{grade.hint}</p>
      </div>

      {/* ── Confidence Bar ────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold text-slate-400">{conf.label}</p>
          <span className="text-[9px] text-slate-500 font-mono">
            {(quality.quality_score * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${conf.barClass} ${conf.barWidth}`} />
        </div>
      </div>

      {/* ── Indicators count ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-slate-800/30 rounded-xl border border-slate-700/30 px-3 py-2">
        <Shield className="w-3 h-3 text-slate-400 shrink-0" />
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3 text-emerald-400" />
          <span className="text-[11px] font-bold text-emerald-400">{validIndicators}</span>
          <span className="text-[9px] text-slate-500">نشط</span>
        </div>
        {suppressedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <MinusCircle className="w-3 h-3 text-slate-500" />
            <span className="text-[11px] font-bold text-slate-500">{suppressedCount}</span>
            <span className="text-[9px] text-slate-600">موقوف</span>
          </div>
        )}
      </div>

      {/* ── Active intelligence signals ───────────────────────────────── */}
      {activeOutputs.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
            الإشارات الاستخباراتية
          </p>
          <div className="space-y-1.5">
            {activeOutputs.map(out => {
              const lk = out.semantic_level as keyof typeof LEVEL_COLOR;
              return (
                <div
                  key={out.output_type}
                  className="flex items-center gap-2 bg-slate-800/30 rounded-lg px-2.5 py-2 border border-slate-700/30"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${LEVEL_DOT[lk] ?? 'bg-slate-400'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-200 truncate">
                      {OUTPUT_AR[out.output_type] ?? out.output_type}
                    </p>
                    <p className="text-[9px] text-slate-500">{out.classification}</p>
                  </div>
                  <span
                    className={`text-[9px] font-bold shrink-0 ${LEVEL_COLOR[lk] ?? 'text-slate-400'}`}
                  >
                    {LEVEL_AR[lk] ?? out.semantic_level}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Limitation warning ────────────────────────────────────────── */}
      {limitations.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-950/20 border border-amber-800/30 rounded-xl p-2.5">
          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-semibold text-amber-300 mb-0.5">قيد موثّق</p>
            <p className="text-[9px] text-amber-400/80 leading-snug">{limitations[0]}</p>
          </div>
        </div>
      )}

      {/* ── Next action guidance ──────────────────────────────────────── */}
      <div className="bg-slate-800/20 border border-slate-700/20 rounded-xl px-3 py-2.5">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">
          الخطوة التالية
        </p>
        <p className="text-[10px] text-slate-400 leading-snug">{nextActionText}</p>
      </div>
    </div>
  );
}
