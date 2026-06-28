'use client';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  Download,
  Flame,
  Gauge,
  Info,
  MapPin,
  Printer,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Upload,
  Zap,
} from 'lucide-react';
import { PredictionTabProps } from '../types';
import { AccuracySparkline, HealthGauge, HotSpots, PipelineCard, PipelineStripMap, SegmentChart } from './prediction/PredictionWidgets';
import { usePredictionTabModel } from './prediction/usePredictionTabModel';
import { accColor, trendColor } from './prediction/predictionUtils';

export function PredictionTab({ onGoToSessions, onGoToWorkOrders }: PredictionTabProps) {
  const {
    loading,
    forecasts,
    selected,
    setSelected,
    triggering,
    triggerMessage,
    creatingWos,
    woMessage,
    mapFocusMessage,
    locatingSegId,
    activePipeline,
    f,
    a,
    score,
    alerts,
    withForecasts,
    withValidation,
    avgAccuracy,
    loadForecasts,
    triggerForecast,
    focusSegmentOnMap,
    downloadReport,
    printReport,
    createForecastWorkOrders,
  } = usePredictionTabModel();

  if (!loading && forecasts.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center space-y-4">
        <TrendingDown className="w-14 h-14 mx-auto text-slate-700" />
        <h3 className="text-lg font-semibold text-slate-300">لا توجد خطوط متاحة للتنبؤ حالياً</h3>
        <p className="text-sm text-slate-500">تحقق من تحميل ملفات المسح وربطها بخطوط واضحة، ثم أعد التحديث</p>
        <button onClick={onGoToSessions} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 font-medium">
          <Upload className="w-4 h-4" /> استيراد ملف مسح CP
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2"><Brain className="w-5 h-5 text-purple-400" />نظام التنبؤ الذكي التلقائي</h3>
            <p className="text-xs text-slate-500 mt-0.5">NACE SP0169 · يُشغَّل تلقائياً عند كل تحميل</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onGoToWorkOrders && (
              <button onClick={onGoToWorkOrders} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/30 text-xs text-rose-200">
                <ClipboardList className="w-3.5 h-3.5" /> أوامر العمل
              </button>
            )}
            <button onClick={loadForecasts} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي الخطوط', value: forecasts.length, color: 'text-white', icon: <Activity className="w-4 h-4" /> },
            { label: 'لديها تنبؤ', value: withForecasts, color: 'text-purple-400', icon: <Brain className="w-4 h-4" /> },
            { label: 'تم التحقق منها', value: withValidation, color: 'text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: 'متوسط الدقة', value: avgAccuracy !== null ? `${avgAccuracy}%` : '—', color: avgAccuracy !== null ? accColor(avgAccuracy) : 'text-slate-500', icon: <Activity className="w-4 h-4" /> },
          ].map((k, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
              <div className={`${k.color} opacity-70`}>{k.icon}</div><div><p className="text-[10px] text-slate-500">{k.label}</p><p className={`text-xl font-bold ${k.color}`}>{k.value}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-3">
          <p className="text-xs text-slate-400 font-medium px-1">الخطوط المرصودة</p>
          {loading && forecasts.length === 0 ? (
            <div className="flex items-center justify-center p-8"><RefreshCw className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : (
            forecasts.map((p) => <PipelineCard key={p.pipeline_id} p={p} selected={selected === p.pipeline_id} onClick={() => setSelected(p.pipeline_id)} />)
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!activePipeline ? (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center text-slate-500 text-sm">اختر خطاً من القائمة لعرض التفاصيل</div>
          ) : (
            <>
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" />الجدول الزمني للمسوحات</h4>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {activePipeline.sessions.map((s, i) => (
                    <div key={s.session_id} className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-center min-w-[110px]">
                      <p className="text-[9px] text-slate-500">مسح {i + 1}</p>
                      <p className="text-xs font-semibold text-white mt-0.5 truncate max-w-[100px]">{s.survey_date ?? s.file_name.slice(0, 14)}</p>
                    </div>
                  ))}
                </div>
                {!activePipeline.ready_for_forecast && <div className="mt-3 flex items-center gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-500/30 rounded-xl p-3"><AlertTriangle className="w-4 h-4" />يلزم مسحان على الأقل لتفعيل التنبؤ</div>}
              </div>

              {!f && activePipeline.ready_for_forecast && (
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 text-center space-y-3">
                  <p className="text-sm text-slate-300">التنبؤ التلقائي لم ينفذ بعد لهذا الخط</p>
                  <button onClick={() => triggerForecast(activePipeline.pipeline_id)} disabled={triggering === activePipeline.pipeline_id} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white font-semibold text-sm">
                    {triggering === activePipeline.pipeline_id ? <><RefreshCw className="w-4 h-4 animate-spin" /> جاري الحساب…</> : <><Brain className="w-4 h-4" /> تشغيل التنبؤ الآن</>}
                  </button>
                  {triggerMessage && (
                    <div className={`mx-auto max-w-xl rounded-lg border px-3 py-2 text-xs ${triggerMessage.startsWith('تم') ? 'border-emerald-500/30 bg-emerald-900/10 text-emerald-300' : 'border-amber-500/30 bg-amber-900/10 text-amber-300'}`}>
                      {triggerMessage}
                    </div>
                  )}
                </div>
              )}

              {f && (
                <>
                  {alerts.length > 0 && (
                    <div className="bg-red-900/10 border border-red-500/20 rounded-2xl p-4 space-y-2">
                      <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5 mb-2"><TriangleAlert className="w-4 h-4" /> تنبيهات النظام الذكي</p>
                      {alerts.map((al, i) => <div key={i} className="text-xs text-red-300">• {al}</div>)}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {score !== null && <HealthGauge score={score} />}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-3"><p className="text-[10px] text-slate-500">التنبؤ لتاريخ</p><p className="text-sm font-bold mt-1 text-cyan-400">{f.predicted_for_date.slice(0, 7)}</p></div>
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-3"><p className="text-[10px] text-slate-500">اتجاه الجهد</p><p className={`text-sm font-bold mt-1 ${trendColor(f.overall_trend_mv_per_year)}`}>{f.overall_trend_mv_per_year !== null ? `${f.overall_trend_mv_per_year > 0 ? '+' : ''}${f.overall_trend_mv_per_year.toFixed(1)} mV` : '—'}</p></div>
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-3"><p className="text-[10px] text-slate-500">مقاطع في خطر</p><p className="text-sm font-bold mt-1 text-red-400">{f.at_risk_segments}/{f.segments_count}</p></div>
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-3"><p className="text-[10px] text-slate-500">آخر تحديث</p><p className="text-sm font-bold mt-1 text-slate-400">{f.created_at.slice(0, 10)}</p></div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={downloadReport} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-900/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold"><Download className="w-3.5 h-3.5" /> تنزيل تقرير</button>
                    <button onClick={printReport} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-900/20 border border-violet-500/30 text-violet-300 text-xs font-semibold"><Printer className="w-3.5 h-3.5" /> طباعة تقرير</button>
                    <button onClick={() => createForecastWorkOrders('quarterly')} disabled={creatingWos !== null} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold disabled:opacity-60"><Zap className="w-3.5 h-3.5" /> أوامر (ربع سنوي)</button>
                    <button onClick={() => createForecastWorkOrders('annual')} disabled={creatingWos !== null} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-900/20 border border-blue-500/30 text-blue-300 text-xs font-semibold disabled:opacity-60"><Activity className="w-3.5 h-3.5" /> أوامر (سنوي)</button>
                  </div>
                  {woMessage && <div className="rounded-lg border border-emerald-500/20 bg-emerald-900/10 px-3 py-2 text-[11px] text-emerald-300">{woMessage}</div>}

                  {f.segments.length > 0 && <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5"><h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-cyan-400" />خريطة الخط</h4><PipelineStripMap segments={f.segments} /></div>}
                  {f.segments.length > 0 && <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5"><h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Flame className="w-4 h-4 text-red-400" />النقاط الساخنة</h4><HotSpots segments={f.segments} trend={f.overall_trend_mv_per_year} onLocate={focusSegmentOnMap} locatingSegId={locatingSegId} />{mapFocusMessage && <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-900/10 px-3 py-2 text-[11px] text-cyan-300">{mapFocusMessage}</div>}</div>}
                  {f.segments.length > 0 && <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5"><h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Gauge className="w-4 h-4 text-purple-400" />توزيع الجهد</h4><SegmentChart segments={f.segments} /></div>}
                </>
              )}

              {a && a.validations_count > 0 && (
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-4">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" />دقة النموذج</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center"><p className="text-[10px] text-slate-500">الدقة التراكمية</p><p className={`text-xl font-bold mt-0.5 ${accColor(a.cumulative_accuracy)}`}>{a.cumulative_accuracy.toFixed(1)}%</p></div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center"><p className="text-[10px] text-slate-500">عمليات تحقق</p><p className="text-xl font-bold mt-0.5 text-purple-400">{a.validations_count}</p></div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center"><p className="text-[10px] text-slate-500">إصدار المعايرة</p><p className="text-xl font-bold mt-0.5 text-cyan-400">v{a.calibration_version}</p></div>
                  </div>
                  {a.recent_errors.length > 0 && <div><p className="text-xs text-slate-400 mb-1">منحنى الدقة عبر الزمن</p><AccuracySparkline errors={a.recent_errors} /></div>}
                </div>
              )}

              {a && a.validations_count === 0 && f && (
                <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-blue-300">في انتظار التحقق التلقائي</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      تم إنشاء التنبؤ بنجاح. سيُحتسب التحقق تلقائياً عند رفع <strong className="text-blue-300">جلسة مسح جديدة</strong> لهذا الخط،
                      حيث يقارن النظام التنبؤ السابق بالقياسات الفعلية الجديدة لقياس دقة النموذج.
                    </p>
                    <p className="text-[10px] text-slate-500">
                      كلما زادت جلسات المسح، زادت دقة التنبؤات المستقبلية.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
