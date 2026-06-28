'use client';
import React from 'react';
import {
  Activity, RefreshCw, AlertTriangle, Shield, ShieldOff, Info,
  TrendingDown, ZapOff, Layers,
  ClipboardList,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { CpPipeline, CpAnalysis } from '../types';
import { CP_STATUS_CONFIG, OVERALL_STATUS_CONFIG, CP_RISK_EXPLANATIONS } from '../constants';

function segCfg(s: string) {
  return CP_STATUS_CONFIG[s as keyof typeof CP_STATUS_CONFIG] ?? CP_STATUS_CONFIG.UNKNOWN;
}

export function CpAnalysisTab({
  pipelines, pipelinesLoading,
  selectedPipeline, onSelectPipeline,
  selectedSession, onSelectSession,
  analysis, analysisLoading,
  segmentSize, onSegmentSizeChange,
  viewMode, onRefresh, onOpenSegments,
  onGoToWorkOrders,
}: {
  pipelines: CpPipeline[];
  pipelinesLoading: boolean;
  selectedPipeline: string | null;
  onSelectPipeline: (id: string | null) => void;
  selectedSession: string | null;
  onSelectSession: (id: string) => void;
  analysis: CpAnalysis | null;
  analysisLoading: boolean;
  segmentSize: number;
  onSegmentSizeChange: (s: number) => void;
  viewMode: 'specialist' | 'manager';
  onRefresh: () => void;
  onOpenSegments?: () => void;
  onGoToWorkOrders?: () => void;
}) {
  const [showRiskLegend, setShowRiskLegend] = React.useState(false);

  const activePipeline = pipelines.find(p =>
    (p.pipeline_id ?? '__UNASSIGNED__') === (selectedPipeline ?? '__UNASSIGNED__')
  ) ?? null;
  const pipelineSessions = activePipeline?.sessions ?? [];

  const chartSample = React.useMemo(() => {
    if (!analysis) return [];
    const pts = analysis.chart_data.filter(p => p.distance !== null);
    const n = pts.length;
    if (n <= 300) return pts;
    const step = Math.ceil(n / 300);
    return pts.filter((_, i) => i % step === 0);
  }, [analysis]);

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            نظام تحليل الحماية الكاثودية
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {onGoToWorkOrders && (
              <button
                onClick={onGoToWorkOrders}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/30 text-xs text-rose-200 transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5" /> أوامر العمل
              </button>
            )}
            <button onClick={onRefresh} disabled={pipelinesLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${pipelinesLoading ? 'animate-spin' : ''}`} /> تحديث
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">الخط</label>
            {pipelinesLoading ? (
              <div className="h-9 bg-slate-800 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedPipeline ?? ''}
                onChange={e => onSelectPipeline(e.target.value || null)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">— اختر الخط —</option>
                {pipelines.map(p => (
                  <option key={p.pipeline_id ?? '__UNASSIGNED__'} value={p.pipeline_id ?? ''}>
                    {p.display_name}{p.has_multi_survey ? ' ✓ متعدد' : ''} ({p.session_count} مسح)
                  </option>
                ))}
              </select>
            )}
          </div>

          {pipelineSessions.length > 0 && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">جلسة المسح</label>
              <select
                value={selectedSession ?? ''}
                onChange={e => onSelectSession(e.target.value)}
                disabled={!activePipeline}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">— اختر المسح —</option>
                {pipelineSessions.map(s => (
                  <option key={s.session_id} value={s.session_id}>
                    {s.survey_date ? `${s.survey_date} — ` : ''}{s.file_name} ({s.total_points} نقطة)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">حجم المقطع التحليلي (م)</label>
            <input
              type="number" min={10} max={1000} step={10}
              value={segmentSize}
              onChange={e => onSegmentSizeChange(Math.max(10, Math.min(1000, Number(e.target.value))))}
              className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <button onClick={() => setShowRiskLegend(!showRiskLegend)}
          className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
          <Info className="w-3.5 h-3.5" />
          {showRiskLegend ? 'إخفاء' : 'عرض'} مستويات الخطر
        </button>
        {showRiskLegend && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
            {[
              { key: 'PROTECTED', threshold: 'الجهد < −850 mV',       explanation: 'حماية كاثودية جيدة وفق معيار NACE SP0169' },
              { key: 'MARGINAL',      threshold: '−850 ≤ الجهد < −700 mV', explanation: 'حماية هامشية وفق NACE SP0169 — يُوصى بمراجعة نظام CP خلال 90 يوماً' },
              { key: 'NOT_PROTECTED', threshold: 'الجهد > −700 mV',        explanation: 'لا توجد حماية فعالة وفق NACE SP0169 — خطر تآكل مباشر — تدخل فوري' },
            ].map(item => {
              const cfg = CP_STATUS_CONFIG[item.key as keyof typeof CP_STATUS_CONFIG];
              return (
                <div key={item.key} className={`rounded-xl border p-3 ${cfg.bg}`}>
                  <div className={`flex items-center gap-2 mb-1 font-semibold text-xs ${cfg.color}`}>
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cfg.dot }} />
                    {cfg.label}: {item.threshold}
                  </div>
                  <p className="text-xs text-slate-400">{item.explanation}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!selectedPipeline && !pipelinesLoading && pipelines.length === 0 && (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-10 text-center text-slate-500">
          لا توجد بيانات مسح CP — استورد ملف مسح من تبويب «جلسات المسح».
        </div>
      )}

      {selectedSession && (
        analysisLoading ? (
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-10 text-center">
            <div className="inline-flex items-center gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              جاري التحليل الهندسي…
            </div>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Data quality warning — shown when session has no usable potential readings */}
            {analysis.data_quality && analysis.data_quality.missing_potential > 0 &&
              analysis.data_quality.missing_potential === analysis.data_quality.total_points && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-5 flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-300 mb-1">بيانات الجلسة غير مكتملة — لا توجد قراءات جهد صالحة</p>
                  <p className="text-xs text-amber-200/70">
                    تعذّر استخراج قراءات الجهد من هذا الملف. يُرجح أن تنسيق الملف غير مدعوم أو أن الأعمدة لم يُتعرّف عليها تلقائياً.
                    لعرض البيانات بشكل صحيح، احذف هذه الجلسة وأعد رفع الملف بتنسيق CSV أو SVY مع أعمدة واضحة للمسافة والجهد.
                  </p>
                </div>
              </div>
            )}
            {/* Manager View */}
            {viewMode === 'manager' && (() => {
              const cfg = OVERALL_STATUS_CONFIG[analysis.overall_status] ?? OVERALL_STATUS_CONFIG.CRITICAL;
              const cpInstalled = analysis.session.cp_system_installed;
              const cpYear = analysis.session.cp_installation_year;
              return (
                <div className={`rounded-2xl border p-6 ${cfg.bg}`}>
                  {/* CP System Status Banner */}
                  {cpInstalled === 'YES' ? (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-900/20 px-3 py-2">
                      <Shield className="w-4 h-4 text-green-400 shrink-0" />
                      <span className="text-xs font-semibold text-green-300">
                        الخط مجهز بنظام حماية كاثودية (CP){cpYear ? ` — مُثبَّت ${cpYear}` : ''}.
                        القراءات الضعيفة تدل على <strong>عطل في النظام</strong> لا على غياب الحماية.
                      </span>
                    </div>
                  ) : cpInstalled === 'NO' ? (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-900/10 px-3 py-2">
                      <ShieldOff className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-xs font-semibold text-red-300">
                        الخط <strong>بدون</strong> نظام حماية كاثودية. التآكل الطبيعي مستمر دون أي حاجز واقٍ.
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{cfg.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">الوضع العام — {analysis.session.pipeline_id ?? 'خط غير محدد'}</p>
                      <h2 className={`text-3xl font-bold mb-2 ${cfg.text}`}>{cfg.label}</h2>
                      <p className={`text-base leading-relaxed mb-3 ${cfg.text}`}>{analysis.manager_summary}</p>
                  <div className="flex items-start gap-2 border-t border-current/20 pt-3">
                        <Shield className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                        <p className={`text-sm ${cfg.text} opacity-90`}><strong>التوصية: </strong>{analysis.recommendation}</p>
                      </div>
                    </div>
                  </div>

                  {/* NACE Compliance Panel */}
                  {analysis.compliance_summary && (
                    <div className="mt-4 bg-slate-900/60 rounded-xl border border-slate-700 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-300">NACE SP0169 — ملخص الامتثال</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          analysis.compliance_summary.compliant
                            ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300'
                            : 'bg-red-900/30 border-red-500/40 text-red-300'
                        }`}>
                          {analysis.compliance_summary.compliant ? '✓ مطابق' : '✗ غير مطابق'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-400">{analysis.compliance_summary.protected_pct}%</p>
                          <p className="text-xs text-slate-400">محمية ≤−850 mV</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-amber-400">{analysis.compliance_summary.marginal_pct}%</p>
                          <p className="text-xs text-slate-400">هامشية −700↔−850</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-400">{analysis.compliance_summary.not_protected_pct}%</p>
                          <p className="text-xs text-slate-400">غير محمية &gt;−700 mV</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">{analysis.compliance_summary.notes}</p>
                    </div>
                  )}

                  {/* Data Quality Badge */}
                  {analysis.data_quality && (
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-slate-400">جودة البيانات:</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        analysis.data_quality.confidence_score >= 0.8
                          ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300'
                          : analysis.data_quality.confidence_score >= 0.6
                          ? 'bg-amber-900/30 border-amber-500/40 text-amber-300'
                          : 'bg-red-900/30 border-red-500/40 text-red-300'
                      }`}>
                        ثقة {Math.round(analysis.data_quality.confidence_score * 100)}%
                      </span>
                      {analysis.data_quality.anomaly_count > 0 && (
                        <span className="text-xs text-amber-400">{analysis.data_quality.anomaly_count} قيمة شاذة</span>
                      )}
                      {analysis.data_quality.missing_potential > 0 && (
                        <span className="text-xs text-slate-500">{analysis.data_quality.missing_potential} قياس مفقود</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Specialist View */}
            {viewMode === 'specialist' && (
              <>
                {/* CP System indicator for specialist view */}
                {analysis.session.cp_system_installed === 'YES' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-900/20 px-3 py-2 text-xs text-green-300">
                    <Shield className="w-3.5 h-3.5" />
                    <span>نظام CP مُثبَّت{analysis.session.cp_installation_year ? ` (${analysis.session.cp_installation_year})` : ''} — القراءات الضعيفة = خلل في المنظومة وليس غياباً للحماية</span>
                  </div>
                ) : analysis.session.cp_system_installed === 'NO' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/10 px-3 py-2 text-xs text-red-300">
                    <ShieldOff className="w-3.5 h-3.5" />
                    <span>لا يوجد نظام CP — التآكل الطبيعي مستمر. النتائج تعكس التدهور بدون حماية كاثودية.</span>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'إجمالي نقاط القياس', value: analysis.stats.total_points.toLocaleString(), color: 'border-cyan-500/30',    icon: <Activity className="w-4 h-4 text-cyan-400" /> },
                    { label: 'نسبة الحماية',        value: `${analysis.stats.protected_pct}%`,           color: 'border-emerald-500/30', icon: <Shield className="w-4 h-4 text-emerald-400" /> },
                    { label: 'مناطق حرجة',          value: analysis.stats.critical_zones,                color: 'border-red-500/30',     icon: <AlertTriangle className="w-4 h-4 text-red-400" /> },
                    { label: 'أقصى جهد سلبي (mV)',   value: analysis.stats.max_negative_potential != null ? analysis.stats.max_negative_potential.toFixed(0) : '—', color: 'border-orange-500/30', icon: <ZapOff className="w-4 h-4 text-orange-400" /> },
                    { label: 'متوسط الإزاحة (mV)',    value: analysis.stats.avg_shift != null ? analysis.stats.avg_shift.toFixed(1) : '—', color: 'border-purple-500/30', icon: <TrendingDown className="w-4 h-4 text-purple-400" /> },
                  ].map((kpi, i) => (
                    <div key={i} className={`bg-slate-900/50 rounded-xl border ${kpi.color} p-4`}>
                      <div className="flex items-center gap-2 mb-1">{kpi.icon}<p className="text-xs text-slate-400">{kpi.label}</p></div>
                      <p className="text-2xl font-bold text-white">{kpi.value}</p>
                    </div>
                  ))}
                </div>

                {/* Pipeline heatmap */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
                  <h3 className="text-sm font-semibold text-slate-300 mb-1">
                    خريطة الخط الحرارية — {analysis.fixed_segments.length} مقطع × {analysis.segment_size_used} م
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">
                    كل شريط = مقطع {analysis.segment_size_used}م — اللون يعكس مستوى الحماية الكاثودية · مرّر المؤشر على أي مقطع لرؤية تفاصيله
                  </p>
                  <div className="flex h-10 rounded-lg overflow-hidden gap-px">
                    {analysis.fixed_segments.map((seg) => {
                      const cfg = segCfg(seg.classification);
                      return (
                        <div key={seg.seg_id}
                          style={{ backgroundColor: cfg.dot, minWidth: 4 }}
                          className="h-full flex-1 cursor-pointer hover:brightness-125 transition-[filter]"
                          title={`${seg.start_distance}–${seg.end_distance} م\n${cfg.label}\n${seg.risk_explanation}`}
                        />
                      );
                    })}
                  </div>
                  {/* Distance markers */}
                  <div className="flex justify-between mt-1 px-0.5">
                    <span className="text-[9px] text-slate-600">{analysis.fixed_segments[0]?.start_distance ?? 0}م</span>
                    <span className="text-[9px] text-slate-600">{analysis.fixed_segments[analysis.fixed_segments.length - 1]?.end_distance ?? (analysis.fixed_segments.length * analysis.segment_size_used)}م</span>
                  </div>
                  {/* Percentage summary */}
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    {(['PROTECTED', 'MARGINAL', 'NOT_PROTECTED'] as const).map(k => {
                      const count = analysis.fixed_segments.filter(s => s.classification === k).length;
                      const pct = analysis.fixed_segments.length > 0
                        ? Math.round(count / analysis.fixed_segments.length * 100) : 0;
                      if (count === 0) return null;
                      return (
                        <span key={k} className={`text-xs flex items-center gap-1.5 ${CP_STATUS_CONFIG[k].color}`}>
                          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: CP_STATUS_CONFIG[k].dot }} />
                          {CP_STATUS_CONFIG[k].label}: <strong>{pct}%</strong>
                          <span className="text-slate-500">({count} مقطع)</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Potential chart — switches to ON/OFF mode for CIPS SVY sessions */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
                  <h3 className="text-base font-semibold text-white mb-1">الجهد الكهروكيميائي على طول الخط (mV)</h3>
                  {analysis.is_svy_session ? (
                    <p className="text-xs text-slate-500 mb-4">
                      جلسة CIPS SVY — خطّا ON/OFF الكاملان · الخط الأحمر = −850 mV (NACE SP0169)
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mb-4">الخط الأحمر المنقط = −850 mV (حد الحماية — NACE SP0169)</p>
                  )}
                  {chartSample.length === 0 || chartSample.every(p => p.natural_potential == null && p.on_potential == null) ? (
                    <div className="flex items-center justify-center h-[300px] rounded-xl border border-dashed border-slate-700 bg-slate-800/30">
                      <p className="text-sm text-slate-500">لا توجد بيانات جهد صالحة لهذه الجلسة</p>
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartSample} margin={{ top: 5, right: 20, left: 10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="distance" stroke="#64748b" tick={{ fontSize: 11 }}
                        label={{ value: 'الموقع على الخط (م)', position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }}
                        label={{ value: 'الجهد (mV)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                        labelFormatter={(v) => `الموقع: ${v} م`}
                        formatter={(v: any, name: string) => {
                          const labels: Record<string, string> = {
                            on_potential: 'ON Potential',
                            off_potential: 'OFF Potential',
                            natural_potential: 'الجهد الطبيعي',
                            as_found: 'القراءة الأولية',
                          };
                          return [`${v} mV`, labels[name] ?? name];
                        }} />
                      <Legend formatter={(v) => {
                        const labels: Record<string, string> = {
                          on_potential: 'ON Potential',
                          off_potential: 'OFF Potential',
                          natural_potential: 'الجهد الطبيعي',
                          as_found: 'القراءة الأولية',
                        };
                        return labels[v] ?? v;
                      }} />
                      <ReferenceLine y={-850} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={2}
                        label={{ value: '−850 mV NACE-Protected', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
                      {!analysis.is_svy_session && (
                        <ReferenceLine y={-700} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5}
                          label={{ value: '−700 mV NACE-Marginal', fill: '#f59e0b', fontSize: 10, position: 'insideBottomRight' }} />
                      )}
                      {analysis.is_svy_session ? (
                        <>
                          <Line type="monotone" dataKey="on_potential"  stroke="#06b6d4" dot={false} strokeWidth={2} name="on_potential" />
                          <Line type="monotone" dataKey="off_potential" stroke="#f97316" dot={false} strokeWidth={2} name="off_potential" />
                        </>
                      ) : (
                        <>
                          <Line type="monotone" dataKey="natural_potential" stroke="#06b6d4" dot={false} strokeWidth={1.5} name="natural_potential" />
                          <Line type="monotone" dataKey="as_found" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="as_found" />
                        </>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  )}
                </div>

                {/* Shift chart */}
                {chartSample.some(p => p.shift_value !== null) && (
                  <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
                    <h3 className="text-base font-semibold text-white mb-4">إزاحة الجهد على طول الخط (mV)</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartSample.filter(p => p.shift_value !== null)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="distance" stroke="#64748b" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                          formatter={(v: any) => [`${v} mV`, 'الإزاحة']} />
                        <Bar dataKey="shift_value" name="الإزاحة" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Segment table */}
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white">جدول المقاطع الهندسية</h3>
                      <p className="text-xs text-slate-500 mt-0.5">شبكة مقاطع ثابتة بحجم {analysis.segment_size_used} م</p>
                    </div>
                    {onOpenSegments && (
                      <button onClick={onOpenSegments}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-xs text-slate-300 transition-colors">
                        <Layers className="w-3.5 h-3.5" /> عرض تفصيلي
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800/60 text-right">
                          {['مقطع الخط','نقاط القياس','متوسط الجهد (mV)','متوسط الإزاحة (mV)','التصنيف','درجة الخطورة','التفسير'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-xs text-slate-400 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {analysis.fixed_segments.map((seg) => {
                          const cfg = segCfg(seg.classification);
                          return (
                            <tr key={seg.seg_id}
                              className={`hover:bg-slate-800/20 ${seg.classification === 'NOT_PROTECTED' ? 'bg-red-900/10' : seg.classification === 'MARGINAL' ? 'bg-amber-900/10' : ''}`}>
                              <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{seg.start_distance}–{seg.end_distance} م</td>
                              <td className="px-4 py-2.5 text-slate-300">{seg.point_count}</td>
                              <td className="px-4 py-2.5 text-slate-300">{seg.avg_potential != null ? seg.avg_potential.toFixed(0) : '—'}</td>
                              <td className="px-4 py-2.5 text-slate-300">{seg.avg_shift != null ? seg.avg_shift.toFixed(1) : '—'}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
                                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cfg.dot }} />
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 10 }).map((_, j) => (
                                    <div key={j} className={`w-1.5 h-3 rounded-sm ${j < seg.severity_score ? (seg.classification === 'NOT_PROTECTED' ? 'bg-red-500' : seg.classification === 'MARGINAL' ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-700'}`} />
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-400 max-w-48 truncate" title={seg.risk_explanation}>{seg.risk_explanation}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {analysis.stats.worst_segment && (
                  <div className="bg-red-900/20 rounded-2xl border border-red-500/30 p-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-red-200 mb-1">أسوأ مقطع بلا حماية</h4>
                        <p className="text-sm text-red-300">
                          من موقع <strong>{analysis.stats.worst_segment.start}</strong> م
                          إلى <strong>{analysis.stats.worst_segment.end}</strong> م
                          — <strong>{analysis.stats.worst_segment.length}</strong> نقطة قياس بدون حماية.
                        </p>
                        <p className="text-xs text-red-400 mt-1">{CP_RISK_EXPLANATIONS.NOT_PROTECTED}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null
      )}
    </div>
  );
}
