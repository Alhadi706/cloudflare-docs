'use client';
// ─── AreaHumanSummary ─────────────────────────────────────────────────────────
// Human-facing area intelligence presentation.
// Default mode: plain Arabic, grouped signal cards, readable recommendations.
// Non-specialists should be able to read and act on this without training.

import React from 'react';
import {
  Leaf, Droplets, Building2, Flame, BarChart2,
  MapPin, ChevronRight, AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import type {
  AreaIntelResult, AreaMetricGroup, AreaRecommendation, LightSignal,
} from '@/lib/areaIntelEngine';
import { parseSceneLabel } from '@/lib/sceneLabels';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  good:    { label: 'جيد',          pill: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40', dot: 'bg-emerald-400' },
  neutral: { label: 'طبيعي',        pill: 'bg-slate-800/60   text-slate-400   border-slate-600/40',   dot: 'bg-slate-500'   },
  caution: { label: 'يحتاج انتباه', pill: 'bg-amber-950/60  text-amber-300   border-amber-700/40',   dot: 'bg-amber-400'   },
  alert:   { label: 'يستوجب مراجعة',pill: 'bg-rose-950/60   text-rose-300    border-rose-700/40',    dot: 'bg-rose-400'    },
} as const;

const SIGNAL_ICON_CFG: Record<LightSignal['icon_hint'], { Icon: React.ElementType; color: string }> = {
  vegetation: { Icon: Leaf,      color: 'text-emerald-400' },
  water:      { Icon: Droplets,  color: 'text-blue-400'    },
  urban:      { Icon: Building2, color: 'text-orange-400'  },
  thermal:    { Icon: Flame,     color: 'text-red-400'     },
  geometry:   { Icon: MapPin,    color: 'text-slate-400'   },
};

const GROUP_CFG: Record<string, { Icon: React.ElementType; color: string }> = {
  vegetation: { Icon: Leaf,      color: 'text-emerald-400' },
  water:      { Icon: Droplets,  color: 'text-blue-400'    },
  built_env:  { Icon: Building2, color: 'text-orange-400'  },
  thermal:    { Icon: Flame,     color: 'text-red-400'     },
  model_chain:{ Icon: BarChart2, color: 'text-cyan-400'    },
  estimates:  { Icon: BarChart2, color: 'text-violet-400'  },
};

const SEVERITY_CFG = {
  critical: { Icon: AlertTriangle, color: 'text-red-300',    bg: 'bg-red-950/40    border-red-700/40'     },
  high:     { Icon: AlertTriangle, color: 'text-orange-300', bg: 'bg-orange-950/40 border-orange-700/40'  },
  medium:   { Icon: AlertTriangle, color: 'text-amber-300',  bg: 'bg-amber-950/40  border-amber-700/40'   },
  low:      { Icon: CheckCircle2,  color: 'text-emerald-300',bg: 'bg-emerald-950/40 border-emerald-700/40' },
  info:     { Icon: Info,          color: 'text-blue-300',   bg: 'bg-blue-950/40   border-blue-700/40'    },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveGroupStatus(group: AreaMetricGroup): keyof typeof STATUS_CFG {
  const primary = group.metrics.find(m => m.id.endsWith('_ctx') || m.id.endsWith('_na')) ?? group.metrics[0];
  if (!primary || primary.value_type === 'requires_validation') return 'neutral';
  const v = primary.value;
  if (['شبه معدوم', 'احتراق نشط', 'مناطق محترقة', 'تشبع مائي', 'كثافة عمرانية مرتفعة', 'مرتفعة جداً'].some(kw => v.includes(kw))) return 'alert';
  if (['خفيف', 'احتمال', 'رطوبة ملحوظة', 'عمران متوسط', 'حرائق منخفضة', 'حرارة ملحوظة'].some(kw => v.includes(kw))) return 'caution';
  if (['كثيف', 'لا تغيير', 'غير عمراني', 'طبيعي', 'منخفض المستوى'].some(kw => v.includes(kw))) return 'good';
  return 'neutral';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: keyof typeof STATUS_CFG }) {
  const { label, pill, dot } = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shrink-0 ${pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function LightSignalBar({ signals }: { signals: LightSignal[] }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl px-4 py-3.5">
      <p className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
        <span className="w-1 h-3.5 bg-blue-500 rounded-full" />
        إشارات المنطقة الرئيسية
      </p>
      <div className="grid grid-cols-2 gap-2">
        {signals.map(sig => {
          const { Icon, color } = SIGNAL_ICON_CFG[sig.icon_hint];
          const { pill, dot } = STATUS_CFG[sig.status];
          return (
            <div key={sig.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${pill}`}>
              <Icon size={14} className={color} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-500 leading-none mb-0.5">{sig.label}</p>
                <p className="text-[13px] font-bold leading-none">{sig.brief}</p>
              </div>
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({ group }: { group: AreaMetricGroup }) {
  const cfg = GROUP_CFG[group.id];
  if (!cfg) return null;

  const primary   = group.metrics.find(m => m.id.endsWith('_ctx') || m.id.endsWith('_na')) ?? group.metrics[0];
  const secondary = group.metrics.find(m => m.id !== primary?.id && (m.id.endsWith('_est') || m.id.endsWith('_cover_est') || m.id === 'urban_est'));
  if (!primary) return null;

  const status = deriveGroupStatus(group);

  // For unavailable data, show a dimmed state
  const isUnavailable = primary.value_type === 'requires_validation';

  return (
    <div className={`rounded-xl border px-4 py-4 transition-colors ${
      isUnavailable
        ? 'bg-slate-900/20 border-slate-800/40'
        : 'bg-slate-800/30 border-slate-700/30'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <cfg.Icon size={15} className={isUnavailable ? 'text-slate-600' : cfg.color} />
          <span className={`text-sm font-bold ${isUnavailable ? 'text-slate-500' : 'text-slate-200'}`}>
            {group.title}
          </span>
        </div>
        {!isUnavailable && <StatusPill status={status} />}
      </div>
      <p className={`text-sm leading-relaxed ${isUnavailable ? 'text-slate-600' : 'text-slate-300'}`}>
        {primary.value}
      </p>
      {secondary && !isUnavailable && (
        <p className="text-xs text-slate-500 mt-1.5">
          {secondary.label}:{' '}
          <span className="text-slate-400 font-semibold">{secondary.value}</span>
          {secondary.unit && <span className="text-slate-600 mr-0.5">{secondary.unit}</span>}
        </p>
      )}
    </div>
  );
}

function RecommendationCard({ rec, index }: { rec: AreaRecommendation; index: number }) {
  const { Icon, color, bg } = SEVERITY_CFG[rec.severity];
  return (
    <div className={`rounded-xl border px-4 py-4 ${bg}`}>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900/60 shrink-0 mt-0.5">
          <span className="text-xs font-bold text-slate-300">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Icon size={13} className={`${color} shrink-0`} />
              <p className={`text-sm font-bold ${color}`}>{rec.title}</p>
            </div>
            {rec.department && (
              <span className="text-[10px] text-slate-500 shrink-0 bg-slate-900/60 px-2 py-0.5 rounded-full">
                {rec.department}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{rec.explanation}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  result: AreaIntelResult;
}

export default function AreaHumanSummary({ result }: Props) {
  const areaDisplay = result.area_km2 >= 1
    ? `${result.area_km2.toFixed(2)} كم²`
    : `${(result.area_m2 / 10_000).toFixed(1)} هكتار`;

  const sceneLbl = result.scene_uid ? parseSceneLabel(result.scene_uid) : null;
  const sectionGroups = result.groups.filter(g => g.id !== 'geometry');

  return (
    <div className="flex flex-col gap-4" dir="rtl">

      {/* ── Area overview header ──────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/20 border border-slate-700/40 rounded-xl px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={14} className="text-slate-500" />
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">منطقة محددة</span>
            </div>
            <p className="text-4xl font-black text-slate-50 leading-none">{areaDisplay}</p>
            <p className="text-sm text-slate-500 mt-2">محيط {result.perimeter_km.toFixed(1)} كم</p>
          {sceneLbl && (
            <p className="text-xs text-slate-600 mt-1">
              استناداً إلى صورة {sceneLbl.satellite} · {sceneLbl.dateAr}
            </p>
          )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-xs px-3 py-1.5 rounded-full border font-semibold ${
              result.quality.data_type === 'real'
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-700/40'
                : result.quality.data_type === 'simulated'
                  ? 'bg-amber-950/50 text-amber-300 border-amber-700/40'
                  : 'bg-slate-800/50 text-slate-500 border-slate-600/40'
            }`}>
              {result.quality.data_type === 'real'
                ? 'بيانات حقيقية'
                : result.quality.data_type === 'simulated'
                  ? 'بيانات محاكاة'
                  : 'هندسة فقط'}
            </span>
            {result.has_scene_data && (
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${
                  result.quality.confidence === 'high'
                    ? 'bg-blue-950/50 text-blue-300 border-blue-700/40'
                    : result.quality.confidence === 'medium'
                      ? 'bg-violet-950/50 text-violet-300 border-violet-700/40'
                      : 'bg-slate-800 text-slate-500 border-slate-600/40'
                }`}>
                  ثقة {result.quality.confidence === 'high' ? 'عالية' : result.quality.confidence === 'medium' ? 'متوسطة' : 'منخفضة'}
                </span>
                <span className="text-[10px] px-2.5 py-1 rounded-full border font-semibold bg-cyan-950/40 text-cyan-300 border-cyan-700/40">
                  دقة التحليل {result.quality.analysis_score}%
                </span>
              </div>
            )}
          </div>
        </div>
        {!result.has_scene_data && (
          <div className="mt-3 text-xs text-amber-400/80 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2.5 leading-relaxed">
            شغّل تحليل المشهد أولاً من شريط الأدوار للحصول على الاستخبارات البيئية الكاملة
          </div>
        )}
      </div>

      {/* ── Light signals bar ───────────────────────────────── */}
      {result.light_signals.length > 0 && (
        <LightSignalBar signals={result.light_signals} />
      )}

      {/* ── Section cards ────────────────────────────────────── */}
      {sectionGroups.length > 0 && (
        <div className="flex flex-col gap-3">
          {sectionGroups.map(group => (
            <SectionCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {/* ── Recommendations ──────────────────────────────────── */}
      {result.recommendations.length > 0 && (
        <div>
          <p className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <ChevronRight size={14} className="text-blue-400" />
            التوصيات والخطوات المقترحة
            <span className="text-[10px] font-normal text-slate-600 bg-slate-800/60 border border-slate-700/40 px-2 py-0.5 rounded-full">
              {result.recommendations.length}
            </span>
          </p>
          <div className="flex flex-col gap-2.5">
            {result.recommendations.map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
