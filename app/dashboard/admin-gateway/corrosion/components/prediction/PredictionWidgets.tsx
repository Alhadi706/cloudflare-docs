'use client';

import { useMemo, useState } from 'react';
import {
  Clock,
  Flame,
  LocateFixed,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AutoForecastPipeline, CpPredictedSegment } from '../../types';
import {
  MARGINAL_THRESHOLD,
  PROTECTED_THRESHOLD,
  accColor,
  healthLabel,
  healthScore,
  monthsToMarginal,
  segBgClass,
  segColor,
  trendColor,
} from './predictionUtils';

function hasRealMv(segments: CpPredictedSegment[]) {
  return segments.some((s) => s.predicted_avg_mv !== 0);
}

export function PipelineStripMap({ segments }: { segments: CpPredictedSegment[] }) {
  const [hovered, setHovered] = useState<CpPredictedSegment | null>(null);
  if (!segments.length) return null;
  const hasRealData = hasRealMv(segments);

  const total = segments.length;
  const protCount = segments.filter(s => s.predicted_class === 'PROTECTED').length;
  const margCount = segments.filter(s => s.predicted_class === 'MARGINAL').length;
  const unprCount = segments.filter(s => s.predicted_class === 'NOT_PROTECTED').length;
  const protPct = Math.round(protCount / total * 100);
  const margPct = Math.round(margCount / total * 100);
  const unprPct = Math.round(unprCount / total * 100);

  return (
    <div>
      <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-cyan-400" />خريطة الخط — بداية ← نهاية</p>
      <div className="relative">
        <div className="flex h-10 rounded-xl overflow-hidden border border-slate-700 gap-px">
          {segments.map((s, i) => (
            <div key={i} className={`flex-1 cursor-pointer transition-opacity hover:opacity-80 ${segBgClass(s.predicted_class)}`} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(null)} />
          ))}
        </div>
        <div className="flex justify-between mt-1 px-0.5"><span className="text-[9px] text-slate-600">0م</span><span className="text-[9px] text-slate-600">{segments.length * 100}م</span></div>
        {hovered && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs z-10 whitespace-nowrap shadow-xl">
            <span className="text-slate-300">{hovered.seg_id}</span>
            {hovered.predicted_avg_mv !== 0 && <span className="ml-2 text-cyan-300">{hovered.predicted_avg_mv} mV</span>}
            <span className="ml-2 font-semibold" style={{ color: segColor(hovered.predicted_class) }}>{hovered.predicted_class}</span>
          </div>
        )}
      </div>
      {/* Percentage summary */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {protCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            محمية {protPct}% <span className="text-slate-500">({protCount} مقطع)</span>
          </span>
        )}
        {margCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-amber-400">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            هامشية {margPct}% <span className="text-slate-500">({margCount} مقطع)</span>
          </span>
        )}
        {unprCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-red-400">
            <span className="w-3 h-3 rounded bg-red-500 inline-block" />
            غير محمية {unprPct}% <span className="text-slate-500">({unprCount} مقطع)</span>
          </span>
        )}
      </div>
      {!hasRealData && <div className="text-[10px] mt-2 text-amber-400/70 border border-amber-500/20 rounded px-1.5 py-0.5 inline-block">⚠ التصنيف مبني على نمط البيانات</div>}
    </div>
  );
}

export function HotSpots({ segments, trend, onLocate, locatingSegId }: { segments: CpPredictedSegment[]; trend: number | null; onLocate?: (seg: CpPredictedSegment) => void; locatingSegId?: string | null }) {
  const hotspots = useMemo(() => {
    return [...segments].filter((s) => s.predicted_class !== 'PROTECTED').sort((a, b) => {
      const scoreA = a.predicted_class === 'NOT_PROTECTED' ? 2 : 1;
      const scoreB = b.predicted_class === 'NOT_PROTECTED' ? 2 : 1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.predicted_avg_mv - a.predicted_avg_mv;
    }).slice(0, 5);
  }, [segments]);

  if (!hotspots.length) return <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-3"><ShieldCheck className="w-4 h-4" />جميع المقاطع ضمن الحدود</div>;

  return (
    <div className="space-y-2">
      {hotspots.map((s, i) => {
        const months = s.predicted_avg_mv !== 0 && trend !== null ? monthsToMarginal(s.predicted_avg_mv, trend) : null;
        const isCritical = s.predicted_class === 'NOT_PROTECTED';
        return (
          <div key={s.seg_id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isCritical ? 'bg-red-900/10 border-red-500/25' : 'bg-amber-900/10 border-amber-500/25'}`}>
            <span className={`text-sm font-bold w-4 text-center ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>{i + 1}</span>
            <div className={`w-1 self-stretch rounded-full ${isCritical ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">{s.seg_id}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.predicted_avg_mv !== 0 ? `${s.predicted_avg_mv} mV — ` : ''}{isCritical ? 'غير محمي' : 'هامشي'}</p>
            </div>
            {onLocate && <button onClick={() => onLocate(s)} className="inline-flex items-center gap-1.5 text-[10px] rounded-lg px-2 py-1 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"><LocateFixed className={`w-3 h-3 ${locatingSegId === s.seg_id ? 'animate-pulse' : ''}`} />على الخريطة</button>}
            {months !== null && months > 0 && <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-900/20 rounded-lg px-2 py-1"><Clock className="w-3 h-3" />{months < 12 ? `${months} شهر` : `${Math.round(months / 12)} سنة`}</div>}
            {months === 0 && <div className="flex items-center gap-1 text-[10px] text-red-400 bg-red-900/20 rounded-lg px-2 py-1"><Flame className="w-3 h-3" />حرج الآن</div>}
          </div>
        );
      })}
    </div>
  );
}

export function HealthGauge({ score }: { score: number }) {
  const { label, color, bg } = healthLabel(score);
  const circumference = 2 * Math.PI * 36;
  const filled = circumference * (score / 100);
  const strokeColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : score >= 20 ? '#f97316' : '#ef4444';
  return <div className={`rounded-2xl border ${bg} p-4 flex items-center gap-4`}><div className="relative w-20 h-20"><svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90"><circle cx="40" cy="40" r="36" fill="none" stroke="#1e293b" strokeWidth="8" /><circle cx="40" cy="40" r="36" fill="none" stroke={strokeColor} strokeWidth="8" strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className={`text-xl font-black ${color}`}>{score}</span><span className="text-[8px] text-slate-500">/ 100</span></div></div><div><p className="text-[10px] text-slate-500 uppercase">مؤشر سلامة الخط</p><p className={`text-2xl font-black mt-0.5 ${color}`}>{label}</p></div></div>;
}

export function SegmentChart({ segments }: { segments: CpPredictedSegment[] }) {
  if (!hasRealMv(segments)) {
    const prot = segments.filter((s) => s.predicted_class === 'PROTECTED').length;
    const marg = segments.filter((s) => s.predicted_class === 'MARGINAL').length;
    const risk = segments.filter((s) => s.predicted_class === 'NOT_PROTECTED').length;
    return <div className="text-xs text-slate-400">محمي: {prot} | هامشي: {marg} | خطر: {risk}</div>;
  }

  const data = segments.slice(0, 80).map((s, i) => ({ seg: `${i * 100}`, mv: s.predicted_avg_mv, fill: segColor(s.predicted_class) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="seg" stroke="#475569" tick={{ fontSize: 8 }} interval={Math.floor(data.length / 6)} tickFormatter={(v) => `${v}م`} />
        <YAxis stroke="#475569" tick={{ fontSize: 8 }} tickFormatter={(v) => `${v}mV`} />
        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [`${v} mV`, 'الجهد المتنبأ']} />
        <ReferenceLine y={PROTECTED_THRESHOLD} stroke="#10b981" strokeDasharray="5 3" strokeWidth={1.5} />
        <ReferenceLine y={MARGINAL_THRESHOLD} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5} />
        <Area type="monotone" dataKey="mv" fill="#10b98120" stroke="none" />
        <Bar dataKey="mv" radius={[2, 2, 0, 0]} maxBarSize={12}>{data.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function AccuracySparkline({ errors }: { errors: Array<{ survey_date?: string; accuracy_pct: number }> }) {
  if (!errors.length) return null;
  return <ResponsiveContainer width="100%" height={80}><LineChart data={errors} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}><YAxis domain={[0, 100]} stroke="#475569" tick={{ fontSize: 7 }} /><ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1} /><Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 10 }} formatter={(v: unknown) => [`${v}%`, 'الدقة']} /><Line type="monotone" dataKey="accuracy_pct" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>;
}

export function PipelineCard({ p, onClick, selected }: { p: AutoForecastPipeline; onClick: () => void; selected: boolean }) {
  const f = p.forecast;
  const a = p.accuracy;
  const riskPct = f ? Math.round((f.at_risk_segments / Math.max(f.segments_count, 1)) * 100) : null;
  const score = f?.segments ? healthScore(f.segments) : null;
  const accCls = a && a.cumulative_accuracy > 0 ? (a.cumulative_accuracy >= 80 ? 'good' : a.cumulative_accuracy >= 60 ? 'warn' : 'bad') : null;

  return (
    <button onClick={onClick} className={`w-full text-right rounded-2xl border p-4 transition-all space-y-3 ${selected ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'}`}>
      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-white">{p.pipeline_id}</p><p className="text-[10px] text-slate-500 mt-0.5">{p.session_count} مسح</p></div>{score !== null ? <div className="flex items-center gap-1.5">{score >= 80 ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : score >= 50 ? <ShieldAlert className="w-4 h-4 text-amber-400" /> : <ShieldOff className="w-4 h-4 text-red-400" />}<span className={`text-sm font-bold ${healthLabel(score).color}`}>{score}</span></div> : <span className="text-[10px] text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">مسح واحد</span>}</div>
      {f && <div className="grid grid-cols-3 gap-2"><div className="bg-slate-800/60 rounded-xl p-2 text-center"><p className="text-[9px] text-slate-500">التنبؤ لـ</p><p className="text-xs font-semibold text-cyan-400 mt-0.5">{f.predicted_for_date.slice(0, 7)}</p></div><div className="bg-slate-800/60 rounded-xl p-2 text-center"><p className="text-[9px] text-slate-500">اتجاه الجهد</p><p className={`text-xs font-semibold mt-0.5 ${trendColor(f.overall_trend_mv_per_year)}`}>{f.overall_trend_mv_per_year !== null ? `${f.overall_trend_mv_per_year > 0 ? '+' : ''}${f.overall_trend_mv_per_year.toFixed(1)} mV` : '—'}</p></div><div className="bg-slate-800/60 rounded-xl p-2 text-center"><p className="text-[9px] text-slate-500">مقاطع خطرة</p><p className={`text-xs font-semibold mt-0.5 ${riskPct !== null && riskPct > 30 ? 'text-red-400' : 'text-slate-300'}`}>{riskPct !== null ? `${riskPct}%` : '—'}</p></div></div>}
      {f?.segments?.length ? <div className="flex h-3 rounded-md overflow-hidden gap-px">{f.segments.slice(0, 40).map((s, i) => <div key={i} className={`flex-1 ${segBgClass(s.predicted_class)} opacity-80`} />)}</div> : null}
      {accCls && <div className={`text-[10px] ${accColor(a?.cumulative_accuracy ?? 0)}`}>دقة: {a?.cumulative_accuracy.toFixed(1)}%</div>}
    </button>
  );
}
