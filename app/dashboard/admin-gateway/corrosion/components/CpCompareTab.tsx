'use client';
import { BarChart2, RefreshCw, AlertTriangle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, Brush,
} from 'recharts';
import { CpPipeline, CpCompareData } from '../types';
import { CP_STATUS_CONFIG, CHANGE_CONFIG } from '../constants';

function segCfg(s: string) {
  return CP_STATUS_CONFIG[s as keyof typeof CP_STATUS_CONFIG] ?? CP_STATUS_CONFIG.UNKNOWN;
}

export function CpCompareTab({
  pipelines, pipelinesLoading,
  selectedPipeline, onSelectPipeline,
  segmentSize, onSegmentSizeChange,
  compareSessionA, compareSessionB, compareSessionC, compareSessionD,
  onCompareSessionAChange, onCompareSessionBChange,
  onCompareSessionCChange, onCompareSessionDChange,
  compareData, compareLoading,
  onRefresh,
}: {
  pipelines: CpPipeline[];
  pipelinesLoading: boolean;
  selectedPipeline: string | null;
  onSelectPipeline: (id: string | null) => void;
  segmentSize: number;
  onSegmentSizeChange: (s: number) => void;
  compareSessionA: string | null;
  compareSessionB: string | null;
  compareSessionC: string | null;
  compareSessionD: string | null;
  onCompareSessionAChange: (id: string | null) => void;
  onCompareSessionBChange: (id: string | null) => void;
  onCompareSessionCChange: (id: string | null) => void;
  onCompareSessionDChange: (id: string | null) => void;
  compareData: CpCompareData | null;
  compareLoading: boolean;
  onRefresh: () => void;
}) {
  const activePipeline = pipelines.find(p =>
    (p.pipeline_id ?? '__UNASSIGNED__') === (selectedPipeline ?? '__UNASSIGNED__')
  ) ?? null;
  const pipelineSessions = [...(activePipeline?.sessions ?? [])].sort((a, b) => {
    const da = a.survey_date ? new Date(a.survey_date).getTime() : Infinity;
    const db = b.survey_date ? new Date(b.survey_date).getTime() : Infinity;
    return da - db;
  });

  // ── Zoom state for the comparison chart ──
  type Domain = [number, number] | ['auto', 'auto'];
  const [xDomain, setXDomain] = useState<Domain>(['auto', 'auto']);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!compareData?.combined_chart?.length) return;
    const allDist = compareData.combined_chart
      .map((p: any) => p.distance)
      .filter((d: any) => d != null) as number[];
    const minAll = Math.min(...allDist);
    const maxAll = Math.max(...allDist);
    const [curMin, curMax] = xDomain[0] === 'auto'
      ? [minAll, maxAll]
      : (xDomain as [number, number]);
    const center = (curMin + curMax) / 2;
    const range  = curMax - curMin;
    const factor = e.deltaY > 0 ? 1.25 : 0.8;   // scroll down = zoom out, up = zoom in
    const newRange = Math.max(50, Math.min(maxAll - minAll, range * factor));
    const rawMin = center - newRange / 2;
    const newMin = Math.max(minAll, rawMin);
    const newMax = Math.min(maxAll, newMin + newRange);
    setXDomain([Math.round(newMin), Math.round(newMax)]);
  }, [compareData, xDomain]);

  const resetZoom = useCallback(() => setXDomain(['auto', 'auto']), []);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-purple-400" />
              مقارنة مسوحات الحماية الكاثودية
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">اختر نفس الخط وما يصل إلى 4 جلسات مسح — الجلستان الأولى والثانية إلزاميتان، الثالثة والرابعة اختياريتان</p>
          </div>
          <button onClick={onRefresh} disabled={pipelinesLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${pipelinesLoading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">الخط</label>
            {pipelinesLoading ? (
              <div className="h-9 bg-slate-800 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedPipeline ?? ''}
                onChange={e => { onSelectPipeline(e.target.value || null); onCompareSessionAChange(null); onCompareSessionBChange(null); }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">— اختر الخط —</option>
                {pipelines.map(p => (
                  <option key={p.pipeline_id ?? '__UNASSIGNED__'} value={p.pipeline_id ?? ''}>
                    {p.display_name} ({p.session_count} جلسة)
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">حجم المقطع (م)</label>
            <input
              type="number" min={10} max={1000} step={10}
              value={segmentSize}
              onChange={e => onSegmentSizeChange(Math.max(10, Math.min(1000, Number(e.target.value))))}
              className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {activePipeline && (
          <div className="space-y-3 pt-3 border-t border-slate-800">
            {/* Row 1: sessions A and B (required) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  جلسة المسح الأولى (المرجع) <span className="text-red-400">*</span>
                </label>
                <select
                  value={compareSessionA ?? ''}
                  onChange={e => onCompareSessionAChange(e.target.value || null)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="">— اختر جلسة المسح —</option>
                  {pipelineSessions.map(s => (
                    <option key={s.session_id} value={s.session_id}>
                      {s.survey_date ? `${s.survey_date} — ` : ''}{s.file_name} ({s.total_points} نقطة)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  جلسة المسح الثانية <span className="text-red-400">*</span>
                </label>
                <select
                  value={compareSessionB ?? ''}
                  onChange={e => onCompareSessionBChange(e.target.value || null)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="">— اختر جلسة المسح —</option>
                  {pipelineSessions.filter(s => s.session_id !== compareSessionA).map(s => (
                    <option key={s.session_id} value={s.session_id}>
                      {s.survey_date ? `${s.survey_date} — ` : ''}{s.file_name} ({s.total_points} نقطة)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: sessions C and D (optional) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
                  جلسة المسح الثالثة
                  <span className="text-slate-600 text-[10px]">(اختياري)</span>
                  {compareSessionC && (
                    <button onClick={() => onCompareSessionCChange(null)}
                      className="mr-auto text-slate-500 hover:text-red-400 text-[10px]">✕ حذف</button>
                  )}
                </label>
                <select
                  value={compareSessionC ?? ''}
                  onChange={e => onCompareSessionCChange(e.target.value || null)}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-purple-500 focus:outline-none"
                >
                  <option value="">— اختياري —</option>
                  {pipelineSessions
                    .filter(s => s.session_id !== compareSessionA && s.session_id !== compareSessionB)
                    .map(s => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.survey_date ? `${s.survey_date} — ` : ''}{s.file_name} ({s.total_points} نقطة)
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
                  جلسة المسح الرابعة
                  <span className="text-slate-600 text-[10px]">(اختياري)</span>
                  {compareSessionD && (
                    <button onClick={() => onCompareSessionDChange(null)}
                      className="mr-auto text-slate-500 hover:text-red-400 text-[10px]">✕ حذف</button>
                  )}
                </label>
                <select
                  value={compareSessionD ?? ''}
                  onChange={e => onCompareSessionDChange(e.target.value || null)}
                  disabled={!compareSessionC}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-purple-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">— اختياري —</option>
                  {pipelineSessions
                    .filter(s => s.session_id !== compareSessionA && s.session_id !== compareSessionB && s.session_id !== compareSessionC)
                    .map(s => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.survey_date ? `${s.survey_date} — ` : ''}{s.file_name} ({s.total_points} نقطة)
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {!activePipeline.has_multi_survey && (
              <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-300">
                ⚠ هذا الخط يحتوي على جلسة مسح واحدة فقط — المقارنة تتطلب جلستين أو أكثر
              </div>
            )}
          </div>
        )}
      </div>

      {compareLoading ? (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-10 text-center">
          <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-purple-400" />
          <span className="text-slate-400">جاري مقارنة الجلسات…</span>
        </div>
      ) : compareData ? (
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 text-sm flex items-center gap-3 ${compareData.prediction_eligible ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-300' : 'bg-amber-900/20 border-amber-500/30 text-amber-300'}`}>
            <span className="text-xl">{compareData.prediction_eligible ? '✅' : '⚠'}</span>
            <span>{compareData.prediction_note}</span>
          </div>

          {compareData.no_overlap && (
            <div className="rounded-xl border p-4 text-sm flex items-center gap-3 bg-amber-900/20 border-amber-500/30 text-amber-300">
              <AlertTriangle className="w-4 h-4" />
              <span>
                لا يوجد تداخل مسافي بين الجلسات المختارة (عدد المقاطع المشتركة: {compareData.overlap_segments ?? 0}).
                الرسم يعرض الجلسات كمسارات منفصلة على المحور.
              </span>
            </div>
          )}

          {/* Degradation rate + trend */}
          {compareData.degradation_rate_mv_per_month != null && (
            <div className={`rounded-xl border p-4 flex items-center gap-4 ${
              compareData.trend === 'improving'          ? 'bg-emerald-900/20 border-emerald-500/30' :
              compareData.trend === 'stable'             ? 'bg-slate-800/40 border-slate-700' :
              compareData.trend === 'degrading'          ? 'bg-amber-900/20 border-amber-500/30' :
                                                          'bg-red-900/20 border-red-500/30'
            }`}>
              <div className="flex-1">
                <p className="text-xs text-slate-400 mb-0.5">معدل التدهور — NACE SP0169</p>
                <p className="text-xl font-bold text-white">
                  {compareData.degradation_rate_mv_per_month > 0 ? '+' : ''}{compareData.degradation_rate_mv_per_month.toFixed(1)} mV/شهر
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  ≈ {(compareData.degradation_rate_mv_per_month * 12).toFixed(1)} mV/سنة
                </p>
              </div>
              <div className={`text-center px-4 py-2 rounded-xl border ${
                compareData.trend === 'improving'          ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300' :
                compareData.trend === 'stable'             ? 'bg-slate-700/40 border-slate-600 text-slate-300' :
                compareData.trend === 'degrading'          ? 'bg-amber-900/30 border-amber-500/40 text-amber-300' :
                                                            'bg-red-900/30 border-red-500/40 text-red-300'
              }`}>
                <p className="text-xs font-semibold">
                  {compareData.trend === 'improving'          ? '▲ تحسن' :
                   compareData.trend === 'stable'             ? '— مستقر' :
                   compareData.trend === 'degrading'          ? '▼ تدهور' :
                                                               '▼▼ تدهور حرج'}
                </p>
              </div>
            </div>
          )}

          {compareData.protection_loss_zones.length > 0 && (
            <div className="bg-red-900/20 rounded-2xl border border-red-500/30 p-5">
              <h4 className="font-bold text-red-200 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                مناطق فقدان الحماية ({compareData.protection_loss_zones.length} منطقة)
              </h4>
              <div className="space-y-2">
                {compareData.protection_loss_zones.map((z, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3 text-sm text-red-300 bg-red-900/20 rounded-lg px-3 py-2">
                    <span className="font-mono font-bold">{z.start_distance}–{z.end_distance} م</span>
                    <span>{segCfg(z.prev_class).label}</span>
                    <span className="text-slate-600">←</span>
                    <span className={`font-semibold ${segCfg(z.curr_class).color}`}>{segCfg(z.curr_class).label}</span>
                    {z.delta_potential != null && (
                      <span className="text-red-400 font-bold mr-auto">الإزاحة: {z.delta_potential > 0 ? '+' : ''}{z.delta_potential} mV</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-base font-semibold text-white">مقارنة الجهد على طول الخط (mV)</h3>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">العجلة للتكبير/التصغير</span>
                {xDomain[0] !== 'auto' && (
                  <button onClick={resetZoom}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-xs text-slate-300">
                    <RotateCcw className="w-3 h-3" /> إعادة الضبط
                  </button>
                )}
              </div>
            </div>
            <div
              onWheel={handleWheel}
              style={{ userSelect: 'none' }}
              className="rounded-xl overflow-hidden"
            >
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={compareData.combined_chart}
                margin={{ top: 5, right: 20, left: 10, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="distance" stroke="#64748b" tick={{ fontSize: 10 }}
                  domain={xDomain}
                  type="number"
                  label={{ value: 'الموقع على الخط (م)', position: 'insideBottom', offset: -20, fill: '#64748b', fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }}
                  label={{ value: 'الجهد (mV)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v: any, name: string) => {
                    const labels: Record<string, string> = {
                      np_a: `الجلسة الأولى (${compareData.session_a.survey_date ?? '—'})`,
                      np_b: `الجلسة الثانية (${compareData.session_b.survey_date ?? '—'})`,
                      np_c: `الجلسة الثالثة (${compareData.session_c?.survey_date ?? '—'})`,
                      np_d: `الجلسة الرابعة (${compareData.session_d?.survey_date ?? '—'})`,
                    };
                    return [`${v} mV`, labels[name] ?? name];
                  }} />
                <Legend formatter={(v) => {
                  const labels: Record<string, string> = {
                    np_a: `الجلسة الأولى (${compareData.session_a.survey_date ?? '—'})`,
                    np_b: `الجلسة الثانية (${compareData.session_b.survey_date ?? '—'})`,
                    np_c: `الجلسة الثالثة (${compareData.session_c?.survey_date ?? '—'})`,
                    np_d: `الجلسة الرابعة (${compareData.session_d?.survey_date ?? '—'})`,
                  };
                  return labels[v] ?? v;
                }} />
                <ReferenceLine y={-850} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
                  label={{ value: '−850 mV', fill: '#ef4444', fontSize: 9, position: 'insideTopRight' }} />
                <Line type="monotone" dataKey="np_a" stroke="#06b6d4" dot={false} strokeWidth={1.5} name="np_a" connectNulls={true} />
                <Line type="monotone" dataKey="np_b" stroke="#34d399" dot={false} strokeWidth={1.5} name="np_b" connectNulls={true} />
                {compareData.session_c && (
                  <Line type="monotone" dataKey="np_c" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="np_c" connectNulls={true} />
                )}
                {compareData.session_d && (
                  <Line type="monotone" dataKey="np_d" stroke="#a78bfa" dot={false} strokeWidth={1.5} name="np_d" connectNulls={true} />
                )}
                <Brush
                  dataKey="distance"
                  height={20}
                  stroke="#334155"
                  fill="#0f172a"
                  travellerWidth={6}
                  onChange={(range) => {
                    if (range.startIndex != null && range.endIndex != null) {
                      const chart = compareData.combined_chart;
                      const startDist = chart[range.startIndex]?.distance;
                      const endDist   = chart[range.endIndex]?.distance;
                      if (startDist != null && endDist != null) {
                        setXDomain([startDist, endDist]);
                      }
                    }
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">جدول مقارنة المقاطع — {segmentSize} م لكل مقطع</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/60 text-right">
                    {[
                      'مقطع الخط',
                      'جلسة أولى (mV)', 'حماية أولى',
                      'جلسة ثانية (mV)', 'حماية ثانية',
                      ...(compareData.session_c ? ['جلسة ثالثة (mV)', 'حماية ثالثة'] : []),
                      ...(compareData.session_d ? ['جلسة رابعة (mV)', 'حماية رابعة'] : []),
                      'الإزاحة أ→ب (mV)', 'التغيير',
                    ].map(h => (
                      <th key={h} className="px-4 py-2.5 text-xs text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {compareData.comparison.map((row, i) => {
                    const chg = CHANGE_CONFIG[row.change] ?? { label: row.change, color: 'text-slate-400' };
                    return (
                      <tr key={i} className={`hover:bg-slate-800/20 ${row.change === 'protection_loss' || row.change === 'degraded_to_not_protected' ? 'bg-red-900/10' : ''}`}>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{row.start_distance}–{row.end_distance} م</td>
                        <td className="px-4 py-2.5 text-slate-300">{row.session_a_avg_mv != null ? row.session_a_avg_mv.toFixed(0) : '—'}</td>
                        <td className={`px-4 py-2.5 text-xs font-semibold ${segCfg(row.session_a_class).color}`}>{segCfg(row.session_a_class).label}</td>
                        <td className="px-4 py-2.5 text-slate-300">{row.session_b_avg_mv != null ? row.session_b_avg_mv.toFixed(0) : '—'}</td>
                        <td className={`px-4 py-2.5 text-xs font-semibold ${segCfg(row.session_b_class).color}`}>{segCfg(row.session_b_class).label}</td>
                        {compareData.session_c && <>
                          <td className="px-4 py-2.5 text-slate-300">{row.session_c_avg_mv != null ? row.session_c_avg_mv.toFixed(0) : '—'}</td>
                          <td className={`px-4 py-2.5 text-xs font-semibold ${segCfg(row.session_c_class ?? 'UNKNOWN').color}`}>{segCfg(row.session_c_class ?? 'UNKNOWN').label}</td>
                        </>}
                        {compareData.session_d && <>
                          <td className="px-4 py-2.5 text-slate-300">{row.session_d_avg_mv != null ? row.session_d_avg_mv.toFixed(0) : '—'}</td>
                          <td className={`px-4 py-2.5 text-xs font-semibold ${segCfg(row.session_d_class ?? 'UNKNOWN').color}`}>{segCfg(row.session_d_class ?? 'UNKNOWN').label}</td>
                        </>}
                        <td className={`px-4 py-2.5 font-bold ${row.delta_potential_mv != null && row.delta_potential_mv < 0 ? 'text-emerald-400' : row.delta_potential_mv != null && row.delta_potential_mv > 50 ? 'text-red-400' : 'text-slate-300'}`}>
                          {row.delta_potential_mv != null ? `${row.delta_potential_mv > 0 ? '+' : ''}${row.delta_potential_mv.toFixed(0)}` : '—'}
                        </td>
                        <td className={`px-4 py-2.5 text-xs font-semibold ${chg.color}`}>{chg.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 text-slate-700" />
          <p className="text-slate-400">اختر الخط ثم جلستَي المسح الإلزاميتَين (الأولى والثانية) لعرض نتائج المقارنة</p>
        </div>
      )}
    </div>
  );
}
