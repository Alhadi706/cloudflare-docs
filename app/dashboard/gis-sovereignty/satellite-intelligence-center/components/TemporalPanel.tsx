'use client';
// ─── TemporalPanel — Phase S12 ────────────────────────────────────────────────
// Compare two years OR view time series trends for a drawn area.
// All labels in Arabic. No technical jargon.

import React, { useState } from 'react';
import { GitCompare, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  fetchTemporalCompare, fetchTimeSeries,
  type TemporalCompareResult, type TimeSeriesResult, type TemporalSnapshot,
} from '@/lib/s12API';

// ─── Mini bar chart (no external lib) ────────────────────────────────────────

function MiniBarChart({ data, label }: { data: { year: number; value: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
      <p className="text-[10px] font-bold text-slate-400 mb-3">{label}</p>
      <div className="flex items-end gap-1.5 h-20">
        {data.map(d => (
          <div key={d.year} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full bg-blue-500/70 rounded-t"
              style={{ height: `${(d.value / max) * 64}px`, minHeight: 2 }}
            />
            <span className="text-[8px] text-slate-500">{d.year}</span>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-slate-600 mt-1.5 text-left ltr">
        max: {data[data.length - 1]?.value?.toLocaleString('ar-LY')}
      </p>
    </div>
  );
}

// ─── Change badge ─────────────────────────────────────────────────────────────

function ChangeBadge({ from, to, unit = '' }: { from: number; to: number; unit?: string }) {
  const pct = ((to - from) / Math.max(1, from)) * 100;
  const up  = pct > 0;
  const Icon = pct > 2 ? TrendingUp : pct < -2 ? TrendingDown : Minus;
  const color = up ? 'text-emerald-400' : pct < 0 ? 'text-red-400' : 'text-slate-400';
  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon size={11} />
      <span>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Compare view ─────────────────────────────────────────────────────────────

function CompareView({
  result,
  canonicalKpiSnapshot,
}: {
  result: TemporalCompareResult;
  canonicalKpiSnapshot?: {
    year: number;
    buildings_count: number;
    trees_count: number;
    road_km_paved: number;
    population_est: number;
    confidenceScore: number;
    maxDriftPct: number;
  } | null;
}) {
  const { from_snapshot: f, to_snapshot: t } = result;
  const harmonizedTo = canonicalKpiSnapshot && canonicalKpiSnapshot.year === t.year
    ? {
        ...t,
        buildings_count: canonicalKpiSnapshot.buildings_count,
        trees_count: canonicalKpiSnapshot.trees_count,
        road_km_paved: canonicalKpiSnapshot.road_km_paved,
        population_est: canonicalKpiSnapshot.population_est,
      }
    : t;
  const buildingsSourceGapPct = canonicalKpiSnapshot && canonicalKpiSnapshot.year === t.year
    ? Math.abs(((t.buildings_count - harmonizedTo.buildings_count) / Math.max(1, t.buildings_count)) * 100)
    : 0;
  const rows: [string, keyof TemporalSnapshot, string][] = [
    ['المباني',           'buildings_count', ' مبنى'],
    ['الأشجار',           'trees_count',     ' شجرة'],
    ['الطرق المعبّدة',    'road_km_paved',   ' كم'],
    ['السكان',            'population_est',  ' نسمة'],
    ['الحرارة (°C)',       'temp_mean_c',     '°C'],
    ['الغطاء الأخضر (%)', 'vegetation_pct',  '%'],
  ];

  return (
    <div className="space-y-3" dir="rtl">
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3.5">
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{result.narrative}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/60">
              <th className="text-right px-3 py-2 text-slate-400 font-semibold">المؤشر</th>
              <th className="text-center px-2 py-2 text-slate-500 font-semibold">{f.year}</th>
              <th className="text-center px-2 py-2 text-slate-500 font-semibold">{t.year}</th>
              <th className="text-center px-2 py-2 text-slate-400 font-semibold">التغير</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, key, unit]) => {
              const fv = f[key] as number;
              const tv = harmonizedTo[key] as number;
              return (
                <tr key={key} className="border-t border-slate-800/60 hover:bg-slate-800/20">
                  <td className="px-3 py-2 text-slate-300 font-medium">{label}</td>
                  <td className="px-2 py-2 text-center text-slate-500">
                    {typeof fv === 'number' ? fv.toLocaleString('ar-LY') : fv}{unit}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-300 font-semibold">
                    {typeof tv === 'number' ? tv.toLocaleString('ar-LY') : tv}{unit}
                  </td>
                  <td className="px-2 py-2 flex justify-center">
                    <ChangeBadge from={fv} to={tv} unit={unit} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] text-slate-600 px-1 leading-relaxed">{result.disclaimer}</p>
      {buildingsSourceGapPct >= 8 && (
        <p className="text-[10px] text-amber-300 px-1 leading-relaxed">
          تنبيه اتساق: تم اكتشاف فرق {buildingsSourceGapPct.toFixed(1)}% في مؤشر المباني بين القراءة الزمنية الخام واللقطة الموحدة، لذلك تم اعتماد قيمة موحدة لحماية التقرير من تضارب المصادر.
        </p>
      )}
      {canonicalKpiSnapshot && canonicalKpiSnapshot.year === t.year && (
        <p className="text-[9px] text-cyan-300/80 px-1 leading-relaxed">
          تم توحيد قيم سنة {t.year} مع لقطة التشغيل الموحدة (دقة {canonicalKpiSnapshot.confidenceScore}% • انحراف {canonicalKpiSnapshot.maxDriftPct}%).
        </p>
      )}
    </div>
  );
}

// ─── Time series view ─────────────────────────────────────────────────────────

function TimeSeriesView({ result }: { result: TimeSeriesResult }) {
  const chartKeys = Object.keys(result.chart_data);
  return (
    <div className="space-y-3" dir="rtl">
      <div className="grid grid-cols-1 gap-2">
        {chartKeys.slice(0, 4).map(key => (
          <MiniBarChart key={key} data={result.chart_data[key]} label={key} />
        ))}
      </div>
      <p className="text-[9px] text-slate-600 px-1">{result.disclaimer}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Mode = 'compare' | 'series';

interface Props {
  bbox?: [number, number, number, number] | null;
  polygon?: [number, number][] | null;
  onResult?: (narrative: string, yearFrom: number, yearTo: number, fullResult?: TemporalCompareResult) => void;
  onSeriesResult?: (result: TimeSeriesResult) => void;
  canonicalKpiSnapshot?: {
    year: number;
    buildings_count: number;
    trees_count: number;
    road_km_paved: number;
    population_est: number;
    confidenceScore: number;
    maxDriftPct: number;
  } | null;
}

const SERIES_PRESETS = [2010, 2015, 2020, 2024, 2026, 2030];

export default function TemporalPanel({ bbox, polygon, onResult, onSeriesResult, canonicalKpiSnapshot }: Props) {
  const [mode,           setMode]           = useState<Mode>('compare');
  const [yearFrom,       setYearFrom]       = useState(2010);
  const [yearTo,         setYearTo]         = useState(2026);
  const [selectedYears,  setSelectedYears]  = useState<number[]>([2010, 2015, 2020, 2024]);
  const [compareResult,  setCompareResult]  = useState<TemporalCompareResult | null>(null);
  const [seriesResult,   setSeriesResult]   = useState<TimeSeriesResult | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  const hasGeom = !!(bbox || polygon);

  const run = async () => {
    if (!hasGeom) return;
    setLoading(true); setError(null);
    try {
      if (mode === 'compare') {
        const r = await fetchTemporalCompare({
          ...(bbox ? { bbox } : { polygon: polygon! }),
          year_from: yearFrom, year_to: yearTo,
        });
        setCompareResult(r); setSeriesResult(null);
        if (onResult && r.narrative) onResult(r.narrative, yearFrom, yearTo, r);
      } else {
        const r = await fetchTimeSeries({
          ...(bbox ? { bbox } : { polygon: polygon! }),
          years: selectedYears,
        });
        setSeriesResult(r); setCompareResult(null);
        if (onSeriesResult) onSeriesResult(r);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل التحليل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 space-y-3" dir="rtl">
      {/* Mode toggle */}
      <div className="flex gap-1 p-0.5 bg-slate-800/60 border border-slate-700/40 rounded-lg">
        {(['compare', 'series'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              mode === m
                ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <GitCompare size={11} />
            {m === 'compare' ? 'مقارنة سنتين' : 'سلسلة زمنية'}
          </button>
        ))}
      </div>

      {/* Controls */}
      {mode === 'compare' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-semibold mb-1 block">من سنة</label>
            <input
              type="number" value={yearFrom} min={1990} max={yearTo - 1}
              onChange={e => setYearFrom(+e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 text-center"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold mb-1 block">إلى سنة</label>
            <input
              type="number" value={yearTo} min={yearFrom + 1} max={2030}
              onChange={e => setYearTo(+e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 text-center"
            />
          </div>
        </div>
      )}

      {mode === 'series' && (
        <div>
          <label className="text-[10px] text-slate-500 font-semibold mb-1.5 block">اختر السنوات</label>
          <div className="flex flex-wrap gap-1.5">
            {SERIES_PRESETS.map(y => (
              <button
                key={y}
                onClick={() =>
                  setSelectedYears(prev =>
                    prev.includes(y) ? prev.filter(v => v !== y) : [...prev, y].sort()
                  )
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedYears.includes(y)
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-600/40'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Run button */}
      <button
        onClick={run}
        disabled={loading || !hasGeom}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600/20 border border-blue-600/30 text-blue-300 text-xs font-semibold hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <RefreshCw size={12} className="animate-spin" /> : <GitCompare size={12} />}
        {loading ? 'جارٍ التحليل…' : 'تشغيل التحليل'}
      </button>

      {!hasGeom && (
        <p className="text-xs text-slate-600 text-center">ارسم منطقة على الخريطة أولاً</p>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/30 border border-rose-800/30">
          <AlertTriangle size={12} className="text-rose-400" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {compareResult && <CompareView result={compareResult} canonicalKpiSnapshot={canonicalKpiSnapshot} />}
      {seriesResult  && <TimeSeriesView result={seriesResult} />}
    </div>
  );
}
