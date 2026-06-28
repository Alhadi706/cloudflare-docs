'use client';
import React from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock3, Download, Sparkles, Target, TrendingUp } from 'lucide-react';
import { CpAnalysis, CpPipeline } from '../types';
import { OVERALL_STATUS_CONFIG, SCENARIOS } from '../constants';

type ScenarioId = 'delay' | 'partial' | 'full';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatMoney(amount: number | null) {
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

function scoreAnalysis(analysis: CpAnalysis | null) {
  if (!analysis) return 0;
  const s = analysis.stats;
  const raw =
    s.not_protected_pct * 1.6 +
    s.marginal_pct * 0.8 +
    s.critical_zones * 12 +
    (analysis.overall_status === 'CRITICAL' ? 18 : analysis.overall_status === 'WARNING' ? 8 : 0) +
    (100 - analysis.data_quality.confidence_score * 100) * 0.15;
  return clamp(Math.round(raw), 0, 100);
}

function estimateScenarioCost(analysis: CpAnalysis | null, scenarioId: ScenarioId) {
  if (!analysis) return null;
  const criticalZones = Math.max(analysis.stats.critical_zones, 1);
  const notProtected = Math.max(analysis.stats.not_protected_pct, 1);
  const base = 18000 + criticalZones * 6500 + notProtected * 900;
  if (scenarioId === 'delay') return Math.round(base * 0.18);
  if (scenarioId === 'partial') return Math.round(base * 0.52);
  return Math.round(base * 1.1);
}

function scenarioPriority(analysis: CpAnalysis | null, scenarioId: ScenarioId) {
  if (!analysis) return 0;
  const severity = scoreAnalysis(analysis);
  if (scenarioId === 'delay') return clamp(100 - severity, 5, 95);
  if (scenarioId === 'partial') return clamp(45 + severity * 0.5, 25, 96);
  return clamp(60 + severity * 0.35, 35, 98);
}

function scenarioTitle(scenarioId: ScenarioId) {
  return SCENARIOS.find((s) => s.id === scenarioId)!;
}

export function ScenariosTab({
  analysis, viewMode, onGoToAnalysis,
}: {
  analysis: CpAnalysis | null;
  pipelines: CpPipeline[];
  viewMode: 'specialist' | 'manager';
  onGoToAnalysis: () => void;
}) {
  const [activeScenario, setActiveScenario] = React.useState<string | null>(null);

  const severity = scoreAnalysis(analysis);
  const recommendedScenario: ScenarioId = severity >= 75 ? 'full' : severity >= 45 ? 'partial' : 'delay';
  const dashboardCards = (['delay', 'partial', 'full'] as ScenarioId[]).map((id) => {
    const template = scenarioTitle(id);
    const cost = estimateScenarioCost(analysis, id);
    const priority = scenarioPriority(analysis, id);
    const isRecommended = id === recommendedScenario;
    const impactLabel = id === 'delay' ? 'رفع المخاطر' : id === 'partial' ? 'تخفيض الخطر' : 'إزالة الخطر';
    return {
      ...template,
      id,
      cost,
      priority,
      recommended: analysis ? isRecommended : template.recommended,
      impactLabel,
      implementation: id === 'delay'
        ? ['مراقبة أسبوعية', 'تجميد القرارات غير الضرورية', 'إعادة تقييم خلال 90 يوم']
        : id === 'partial'
          ? ['استهداف المقاطع غير المحمية', 'إعادة قياس بعد التنفيذ', 'تحديث أوامر العمل']
          : ['إيقاف/تقليل التشغيل حسب الحاجة', 'إعادة تأهيل CP كاملة', 'توثيق معايرة بعد الإصلاح'],
    };
  });

  const activeScenarioDetails = activeScenario ? dashboardCards.find((sc) => sc.id === activeScenario) : null;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              السيناريوهات الهندسية — تحليل ماذا لو
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">قارن تأثير قرارات الصيانة المختلفة</p>
          </div>
          {!analysis && (
            <button onClick={onGoToAnalysis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-xs text-slate-300">
              <Activity className="w-3.5 h-3.5" /> حمِّل بيانات التحليل أولاً
            </button>
          )}
        </div>

        {analysis && (
          <div className="mt-3 flex flex-wrap gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300">
              الخط: {analysis.session.pipeline_id ?? 'غير محدد'}
            </span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
              analysis.overall_status === 'CRITICAL' ? 'bg-red-900/30 border-red-500/30 text-red-300' :
              analysis.overall_status === 'WARNING'  ? 'bg-amber-900/30 border-amber-500/30 text-amber-300' :
              'bg-emerald-900/30 border-emerald-500/30 text-emerald-300'
            }`}>
              الوضع الحالي: {OVERALL_STATUS_CONFIG[analysis.overall_status]?.label ?? '—'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-900/20 border border-cyan-500/30 text-xs text-cyan-300">
              شدة الوضع: {severity}/100
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-violet-900/20 border border-violet-500/30 text-xs text-violet-300">
              السيناريو المقترح: {scenarioTitle(recommendedScenario).title}
            </span>
          </div>
        )}
      </div>

      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[10px] text-slate-500">المقاطع غير المحمية</p>
            <p className="mt-1 text-2xl font-bold text-red-300">{analysis.stats.not_protected_pct.toFixed(1)}%</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[10px] text-slate-500">المقاطع الهامشية</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{analysis.stats.marginal_pct.toFixed(1)}%</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[10px] text-slate-500">المناطق الحرجة</p>
            <p className="mt-1 text-2xl font-bold text-cyan-300">{analysis.stats.critical_zones}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[10px] text-slate-500">ثقة البيانات</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{Math.round(analysis.data_quality.confidence_score * 100)}%</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dashboardCards.map((s) => (
          <button key={s.id}
            onClick={() => setActiveScenario(activeScenario === s.id ? null : s.id)}
            className={`text-right rounded-2xl border p-5 transition-all hover:brightness-110 ${s.color} ${activeScenario === s.id ? 'ring-2 ring-white/20' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-2xl">{s.icon}</p>
                <h4 className={`text-base font-bold mt-1 ${s.headerColor}`}>{s.title}</h4>
              </div>
              {s.recommended && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-900/40 border border-emerald-500/40 text-emerald-300">موصى به</span>
              )}
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">{s.technical}</p>
            {analysis && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-black/20 p-2">
                  <p className="text-[10px] text-slate-500">الأولوية</p>
                  <p className="text-sm font-bold text-white">{s.priority}%</p>
                </div>
                <div className="rounded-lg bg-black/20 p-2">
                  <p className="text-[10px] text-slate-500">الأثر</p>
                  <p className="text-sm font-bold text-white">{s.impactLabel}</p>
                </div>
                <div className="rounded-lg bg-black/20 p-2">
                  <p className="text-[10px] text-slate-500">التكلفة</p>
                  <p className="text-sm font-bold text-white">{formatMoney(s.cost)} $</p>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {activeScenarioDetails && (() => {
        const s = activeScenarioDetails;
        return (
          <div className={`rounded-2xl border p-6 ${s.color} space-y-4`}>
            <h3 className={`text-xl font-bold ${s.headerColor} flex items-center gap-2`}>
              <span>{s.icon}</span> {s.title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: '⚙ التأثير التقني', value: s.technical,  color: 'text-cyan-400'   },
                { label: '🛡 تأثير المخاطر',  value: s.risk,       color: 'text-orange-400' },
                { label: '🏭 التأثير التشغيلي', value: s.operational, color: 'text-blue-400' },
                { label: '💰 التأثير المالي',   value: s.budget,    color: 'text-purple-400' },
              ].map(item => (
                <div key={item.label} className="bg-black/20 rounded-xl p-4">
                  <p className={`text-xs font-bold mb-2 ${item.color}`}>{item.label}</p>
                  <p className="text-sm text-slate-200">{item.value}</p>
                  {analysis && item.label.includes('تقني') && (
                    <p className="text-xs text-slate-500 mt-2">
                      بناءً على {analysis.stats.critical_zones} منطقة حرجة، و{analysis.stats.not_protected_pct.toFixed(1)}% غير محمية — NACE SP0169
                    </p>
                  )}
                </div>
              ))}
            </div>
            {/* Timeline + Risk Reduction */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">الإطار الزمني</p>
                <p className="text-xl font-bold text-white">
                  {s.timeline_months === 1 ? 'فوري' : `${s.timeline_months} أشهر`}
                </p>
              </div>
              <div className="bg-black/20 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">تخفيض الخطر</p>
                <p className={`text-xl font-bold ${s.risk_reduction_pct >= 70 ? 'text-emerald-400' : s.risk_reduction_pct > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {s.risk_reduction_pct > 0 ? `↓${s.risk_reduction_pct}%` : 'بدون تغيير'}
                </p>
              </div>
              <div className="bg-black/20 rounded-xl p-3 col-span-2 md:col-span-1">
                <p className="text-xs text-slate-400 mb-1">ملاحظة التكلفة</p>
                <p className="text-xs text-slate-300">{s.cost_note}</p>
              </div>
            </div>
            {analysis && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-xs font-bold text-cyan-300 mb-2 flex items-center gap-2"><Target className="w-4 h-4" />خطة التنفيذ المقترحة</p>
                  <ul className="space-y-2 text-sm text-slate-200">
                    {s.implementation.map((step, index) => (
                      <li key={step} className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-cyan-300">{index + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-xs font-bold text-violet-300 mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4" />المتغيرات الهندسية</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500">تأثير الخطر</p>
                      <p className="mt-1 font-semibold text-white">{s.risk_reduction_pct > 0 ? `↓${s.risk_reduction_pct}%` : 'لا يوجد تخفيض'}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500">المدة</p>
                      <p className="mt-1 font-semibold text-white">{s.timeline_months === 1 ? 'فوري' : `${s.timeline_months} أشهر`}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500">تكلفة تقديرية</p>
                      <p className="mt-1 font-semibold text-white">{formatMoney(s.cost)} $</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500">حجم العائد</p>
                      <p className="mt-1 font-semibold text-white">{s.priority}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {s.recommended && (
              <div className="flex items-center gap-3 bg-emerald-900/30 rounded-xl border border-emerald-500/30 px-4 py-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-300">هذا السيناريو هو التوازن الأمثل بين تخفيض الخطر وتكلفة التدخل</p>
              </div>
            )}
          </div>
        );
      })()}

      {viewMode === 'manager' && (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Download className="w-4 h-4 text-cyan-400" />مقارنة السيناريوهات</h3>
              {analysis && (
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock3 className="w-3.5 h-3.5" /> القرار مبني على {analysis.stats.critical_zones} منطقة حرجة و{analysis.stats.not_protected_pct.toFixed(1)}% مناطق غير محمية
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/40 text-right">
                  {['القرار','الأولوية','تخفيض الخطر','الإطار الزمني','تأثير التشغيل','التكلفة','التوصية'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs text-slate-400 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dashboardCards.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-800/20">
                    <td className="px-4 py-3 text-slate-200 font-medium">{s.title}</td>
                    <td className="px-4 py-3 text-cyan-300 font-semibold">{s.priority}%</td>
                    <td className="px-4 py-3">
                      <span className={s.risk_reduction_pct >= 70 ? 'text-emerald-400' : s.risk_reduction_pct > 0 ? 'text-amber-400' : 'text-slate-500'}>
                        {s.risk_reduction_pct > 0 ? `↓${s.risk_reduction_pct}%` : 'بدون تغيير'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{s.timeline_months === 1 ? 'فوري' : `${s.timeline_months} أشهر`}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{s.operational}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{formatMoney(s.cost)} $</td>
                    <td className="px-4 py-3"><span className={`text-xs font-bold ${s.recommended ? 'text-emerald-400' : 'text-slate-500'}`}>{s.recommended ? 'موصى به ✓' : '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
