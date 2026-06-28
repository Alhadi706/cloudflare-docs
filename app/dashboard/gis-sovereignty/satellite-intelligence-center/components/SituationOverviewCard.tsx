'use client';
// ─── SituationOverviewCard ───────────────────────────────────────────────────
// Zone 2 right panel — human-facing operational situation summary.
// Default (simple mode): plain Arabic, grade badge, key signals, next steps.
// Optional (technical mode): confidence %, indicator grid, provenance, limitations.

import React, { useState } from 'react';
import {
  Satellite,
  ShieldCheck,
  AlertTriangle,
  Info,
  Settings2,
  CheckCircle,
} from 'lucide-react';
import type { SceneSummaryContract } from '@/lib/satelliteIntelAPI';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  summary: SceneSummaryContract | null;
  loading: boolean;
  sceneUid: string | null;
}

// ─── Human-readable mapping tables ───────────────────────────────────────────

const GRADE: Record<
  string,
  { label: string; color: string; bg: string; border: string; hint: string }
> = {
  operational: {
    label: 'البيانات صالحة للاستخدام التشغيلي',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-700/40',
    hint: 'يمكن الاعتماد على هذا التحليل في دعم القرارات الميدانية',
  },
  advisory: {
    label: 'يُستخدم للاسترشاد والتوجيه فقط',
    color: 'text-amber-400',
    bg: 'bg-amber-950/30',
    border: 'border-amber-700/40',
    hint: 'يُنصح بتأكيد النتائج عن طريق مصادر إضافية قبل القرار',
  },
  reference_only: {
    label: 'للمرجعية فقط — لا يعتمد في القرارات',
    color: 'text-slate-400',
    bg: 'bg-slate-800/40',
    border: 'border-slate-600/30',
    hint: 'استخدم مشهداً من بيانات حقيقية لعمليات فعلية',
  },
};

const HUMAN_OUTPUT: Record<string, { title: string; explanation: string }> = {
  vegetation_stress: {
    title: 'إشارة إجهاد نباتي مبدئية',
    explanation: 'مؤشر مبكر على تراجع الغطاء النباتي، يستحق متابعة ميدانية',
  },
  flood_exposure: {
    title: 'احتمالية وجود مياه سطحية',
    explanation: 'إشارة أولية لحالة تشبع مائي أو فيضان في المنطقة',
  },
  fire_risk: {
    title: 'إشارة احتراق أو نشاط حراري',
    explanation: 'قد تعكس حريقاً أو نشاطاً حرارياً — تحتاج تأكيداً من الميدان',
  },
  urban_expansion: {
    title: 'توسع عمراني ملاحَظ',
    explanation: 'تغيرات في امتداد المناطق المبنية مقارنة بفترة سابقة',
  },
};

const LEVEL_HUMAN: Record<string, string> = {
  alert: 'يستدعي الانتباه',
  advisory: 'جدير بالمراجعة',
  informational: 'معلومة تمهيدية',
};

const LEVEL_STYLE: Record<string, string> = {
  alert:         'text-red-400 bg-red-950/30 border-red-800/30',
  advisory:      'text-amber-400 bg-amber-950/30 border-amber-800/30',
  informational: 'text-blue-400 bg-blue-950/30 border-blue-800/30',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SituationOverviewCard({ summary, loading, sceneUid }: Props) {
  const [techMode, setTechMode] = useState(false);

  // ── No scene selected ──────────────────────────────────────────────────────
  if (!sceneUid) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-4 text-center">
        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center mb-2">
          <Satellite className="w-4 h-4 text-slate-600" />
        </div>
        <p className="text-xs font-semibold text-slate-400 mb-0.5">ابدأ التحليل</p>
        <p className="text-[9px] text-slate-600 leading-relaxed max-w-[170px]">
          اختر مشهداً من شريط التحكم ثم اضغط «تشغيل»
        </p>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-blue-950/60 border border-blue-800/40 flex items-center justify-center mb-2 animate-pulse">
          <Satellite className="w-4 h-4 text-blue-400" />
        </div>
        <p className="text-xs text-blue-400 font-semibold">يتم التحليل…</p>
        <p className="text-[9px] text-slate-600 mt-0.5">فحص المؤشرات والإشارات</p>
      </div>
    );
  }

  // ── Ready, no result yet ───────────────────────────────────────────────────
  if (!summary) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-4 text-center">
        <div className="w-8 h-8 rounded-full bg-slate-800/70 border border-slate-700 flex items-center justify-center mb-2">
          <ShieldCheck className="w-4 h-4 text-slate-500" />
        </div>
        <p className="text-xs font-semibold text-slate-400 mb-0.5">النظام جاهز</p>
        <p className="text-[9px] text-slate-600 leading-relaxed max-w-[170px]">
          اضغط «تشغيل التحليل» لاستقراء الوضع الميداني
        </p>
      </div>
    );
  }

  // ── Result ready ───────────────────────────────────────────────────────────
  const { quality, provenance, intelligence_outputs, limitations, indicators } = summary;
  const grade         = GRADE[quality.operational_grade] ?? GRADE.reference_only;
  const activeOutputs = intelligence_outputs
    .filter(o => o.validity.verdict !== 'suppressed')
    .sort((a, b) => {
      const ORD: Record<string, number> = { alert: 0, advisory: 1, informational: 2 };
      return (ORD[a.semantic_level] ?? 2) - (ORD[b.semantic_level] ?? 2);
    })
    .slice(0, 3);

  const validIndicatorsCount   = indicators.filter(i => i.validity.verdict !== 'suppressed').length;
  const suppressedCount        = indicators.filter(i => i.validity.verdict === 'suppressed').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Mode toggle header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/50 shrink-0">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
          {techMode ? 'التفاصيل التقنية' : 'الوضع الميداني'}
        </p>
        <button
          onClick={() => setTechMode(v => !v)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-700 text-[8px] font-semibold text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors"
        >
          <Settings2 className="w-2.5 h-2.5" />
          {techMode ? 'عرض بسيط' : 'تقني'}
        </button>
      </div>

      {/* ── SIMPLE / HUMAN MODE ───────────────────────────────────────────── */}
      {!techMode && (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {/* Source badge */}
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-slate-500">
              {provenance.acquisition_date ?? 'تاريخ غير معروف'}
            </p>
            <span
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                provenance.data_is_real
                  ? 'bg-blue-950/50 text-blue-400 border-blue-700/30'
                  : 'bg-amber-950/50 text-amber-400 border-amber-700/30'
              }`}
            >
              {provenance.data_is_real ? 'بيانات حقيقية ★' : 'محاكاة'}
            </span>
          </div>

          {/* Operational grade — human label */}
          <div className={`rounded-xl border px-2.5 py-2 ${grade.bg} ${grade.border}`}>
            <p className={`text-[10px] font-bold ${grade.color} leading-snug mb-0.5`}>
              {grade.label}
            </p>
            <p className="text-[9px] text-slate-500 leading-snug">{grade.hint}</p>
          </div>

          {/* Indicator count — minimal, human */}
          <div className="flex items-center gap-2 bg-slate-800/30 rounded-lg border border-slate-700/20 px-2.5 py-1.5">
            <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
            <p className="text-[9px] text-slate-400">
              <span className="font-bold text-emerald-400">{validIndicatorsCount}</span> مؤشر نشط
              {suppressedCount > 0 && (
                <span className="text-slate-600"> · {suppressedCount} موقوف</span>
              )}
            </p>
          </div>

          {/* Key signals — plain Arabic */}
          {activeOutputs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wide">
                الإشارات الرئيسية
              </p>
              {activeOutputs.map(out => {
                const human = HUMAN_OUTPUT[out.output_type];
                const lk    = out.semantic_level;
                return (
                  <div
                    key={out.output_type}
                    className={`rounded-lg border px-2.5 py-1.5 ${LEVEL_STYLE[lk] ?? 'text-slate-400 bg-slate-800/30 border-slate-700/30'}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[10px] font-semibold leading-tight">
                        {human?.title ?? out.output_type}
                      </p>
                      <span className="text-[7px] font-bold shrink-0 opacity-60 mt-0.5">
                        {LEVEL_HUMAN[lk] ?? lk}
                      </span>
                    </div>
                    {human?.explanation && (
                      <p className="text-[8px] opacity-60 leading-snug mt-0.5">
                        {human.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeOutputs.length === 0 && (
            <div className="flex items-start gap-2 bg-slate-800/20 rounded-lg border border-slate-700/20 px-2.5 py-2">
              <Info className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[9px] text-slate-500 leading-snug">
                لم تُرصد إشارات ذات دلالة تشغيلية في هذا المشهد
              </p>
            </div>
          )}

          {/* Limitation — brief */}
          {limitations.length > 0 && (
            <div className="flex items-start gap-1.5 bg-amber-950/15 border border-amber-800/20 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400/70 shrink-0 mt-0.5" />
              <p className="text-[8px] text-amber-300/60 leading-snug">{limitations[0]}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TECHNICAL MODE ─────────────────────────────────────────────────── */}
      {techMode && (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">

          {/* Confidence bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-semibold text-slate-400">
                {quality.confidence_class === 'high' ? 'ثقة عالية' : quality.confidence_class === 'medium' ? 'ثقة متوسطة' : 'ثقة منخفضة'}
              </p>
              <span className="text-[9px] font-mono text-slate-500">{(quality.quality_score * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1">
              <div
                className={`h-1 rounded-full ${quality.confidence_class === 'high' ? 'bg-emerald-500' : quality.confidence_class === 'medium' ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${(quality.quality_score * 100).toFixed(0)}%` }}
              />
            </div>
          </div>

          {/* Indicator grid */}
          <div>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wide mb-1">
              المؤشرات الطيفية
            </p>
            <div className="grid grid-cols-2 gap-1">
              {indicators.map(ind => (
                <div
                  key={ind.indicator_type}
                  className={`rounded-lg border px-2 py-1.5 ${
                    ind.validity.verdict === 'suppressed'
                      ? 'bg-slate-800/20 border-slate-700/20 opacity-40'
                      : 'bg-slate-800/40 border-slate-700/40'
                  }`}
                >
                  <p className="text-[8px] font-mono font-bold text-slate-300">
                    {ind.indicator_type.toUpperCase()}
                  </p>
                  <p className="text-xs font-mono text-white">
                    {ind.validity.verdict === 'suppressed' ? '—' : ind.mean.toFixed(3)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Provenance */}
          <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 px-2.5 py-1.5">
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wide mb-1">المصدر</p>
            <p className="text-[8px] font-mono text-slate-400 break-all leading-snug">
              {summary.scene_uid}
            </p>
            <p className="text-[8px] text-slate-500 mt-0.5">
              {provenance.data_is_real ? 'COG حقيقي' : 'محاكاة'} · {provenance.acquisition_date}
            </p>
          </div>

          {/* All limitations */}
          {limitations.length > 0 && (
            <div>
              <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                القيود الموثّقة
              </p>
              {limitations.map((lim, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400/60 shrink-0 mt-0.5" />
                  <p className="text-[8px] text-amber-300/60 leading-snug">{lim}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
