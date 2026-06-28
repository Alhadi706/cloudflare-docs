'use client';
// ─── AreaMetricsChart — Phase S11.3 ──────────────────────────────────────────
// SVG-based mini charts for area metrics comparison and time series.
// No external chart library — pure SVG + Tailwind CSS.

import React from 'react';
import type { TemporalCompareResult, TimeSeriesResult } from '@/lib/s12API';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, isPercent = false): string {
  if (isPercent) return `${n.toFixed(0)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}ك`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}ك`;
  return Math.round(n).toString();
}

function changePct(from: number, to: number): number {
  if (from === 0) return to > 0 ? 100 : 0;
  return ((to - from) / Math.abs(from)) * 100;
}

// ─── Comparison Bars Chart ────────────────────────────────────────────────────
// Side-by-side horizontal bars comparing two years for each metric.

interface ComparisonProps {
  result: TemporalCompareResult;
}

export function TemporalComparisonChart({ result }: ComparisonProps) {
  const f = result.from_snapshot;
  const t = result.to_snapshot;

  // Metrics to display with their display config
  const metrics: Array<{
    label: string;
    from: number;
    to: number;
    isPercent?: boolean;
    // If true, growth is bad (e.g. temperature). If false, growth is good (trees).
    growthBad?: boolean;
  }> = [
    { label: 'المباني',         from: f.buildings_count,  to: t.buildings_count  },
    { label: 'الأشجار',         from: f.trees_count,      to: t.trees_count,      growthBad: false },
    { label: 'السكان',          from: f.population_est,   to: t.population_est   },
    { label: 'الطرق (كم)',      from: f.road_km_paved,    to: t.road_km_paved    },
    { label: 'الغطاء الأخضر',  from: f.vegetation_pct,   to: t.vegetation_pct,   isPercent: true, growthBad: false },
  ];

  return (
    <div className="space-y-2" dir="rtl">
      {/* Legend */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-sm bg-blue-500/60" />
          <span className="text-[9px] text-slate-500">{result.year_from}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-sm bg-amber-500" />
          <span className="text-[9px] text-slate-500">{result.year_to}</span>
        </div>
        <span className="text-[8px] text-slate-600 mr-auto">التغير النسبي</span>
      </div>

      {/* Bars */}
      {metrics.map(m => {
        const max   = Math.max(m.from, m.to, 1);
        const pct   = changePct(m.from, m.to);
        const absP  = Math.abs(pct);
        // Color logic: trees/vegetation → green is good; others → growth is orange
        const toBarColor =
          m.growthBad === false  ? (pct > 2 ? '#10b981' : pct < -2 ? '#ef4444' : '#64748b') :
          m.growthBad === true   ? (pct > 2 ? '#ef4444' : '#10b981') :
          '#f97316';

        const pctLabel = `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
        const pctColor =
          m.growthBad === false  ? (pct > 2 ? 'text-emerald-400' : pct < -2 ? 'text-red-400' : 'text-slate-500') :
          m.growthBad === true   ? (pct > 2 ? 'text-red-400' : pct < -2 ? 'text-emerald-400' : 'text-slate-500') :
          absP > 2               ? 'text-orange-400' : 'text-slate-500';

        return (
          <div key={m.label} className="flex items-center gap-2 min-w-0">
            {/* Label */}
            <span className="text-[9px] text-slate-500 shrink-0 w-16 text-left ltr">{m.label}</span>

            {/* Bars column */}
            <div className="flex-1 min-w-0 space-y-0.5">
              {/* From year */}
              <div className="flex items-center gap-1">
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/60"
                    style={{ width: `${(m.from / max) * 100}%` }}
                  />
                </div>
                <span className="text-[8px] text-slate-600 w-8 shrink-0 text-right">{fmt(m.from, m.isPercent)}</span>
              </div>
              {/* To year */}
              <div className="flex items-center gap-1">
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(m.to / max) * 100}%`, backgroundColor: toBarColor }}
                  />
                </div>
                <span className="text-[8px] text-slate-200 w-8 shrink-0 text-right font-bold">{fmt(m.to, m.isPercent)}</span>
              </div>
            </div>

            {/* Change % */}
            <span className={`text-[9px] font-bold shrink-0 w-9 text-right ${pctColor}`}>
              {pctLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── SVG Sparkline (Time Series) ─────────────────────────────────────────────

type MetricKey = 'buildings_count' | 'trees_count' | 'road_km_paved' | 'population_est' | 'vegetation_pct';

const METRIC_LABELS: Record<MetricKey, string> = {
  buildings_count: 'المباني',
  trees_count:     'الأشجار',
  road_km_paved:   'الطرق (كم)',
  population_est:  'السكان',
  vegetation_pct:  'الغطاء (%)',
};

interface SparklineProps {
  result:    TimeSeriesResult;
  metricKey: MetricKey;
  color?:    string;
}

export function TimeSeriesChart({ result, metricKey, color = '#3b82f6' }: SparklineProps) {
  const points = result.chart_data[metricKey];
  if (!points || points.length < 2) return null;

  const values = points.map(p => p.value);
  const max    = Math.max(...values, 1);
  const min    = Math.min(...values, 0);
  const range  = Math.max(max - min, 1);
  const W = 200, H = 52, padX = 8, padY = 10;

  const coords = points.map((p, i) => ({
    x: padX + (i / (points.length - 1)) * (W - 2 * padX),
    y: H - padY - ((p.value - min) / range) * (H - 2 * padY),
    year: p.year,
    value: p.value,
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${coords[coords.length - 1].x},${H - padY} L${coords[0].x},${H - padY} Z`;
  const gradId = `area-grad-${metricKey}`;

  const first = coords[0];
  const last  = coords[coords.length - 1];

  return (
    <div className="bg-slate-800/40 border border-slate-700/30 rounded-lg p-2.5">
      <p className="text-[9px] font-bold text-slate-500 mb-1">{METRIC_LABELS[metricKey]}</p>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 10}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.5, 1].map(t => (
          <line
            key={t}
            x1={padX} y1={padY + t * (H - 2 * padY)}
            x2={W - padX} y2={padY + t * (H - 2 * padY)}
            stroke="#1e293b" strokeWidth="0.5"
          />
        ))}
        {/* Area fill */}
        <path d={areaD} fill={`url(#${gradId})`} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Start + end dots */}
        <circle cx={first.x} cy={first.y} r="2.5" fill={color} opacity="0.5" />
        <circle cx={last.x}  cy={last.y}  r="3"   fill={color} />
        {/* Year labels */}
        <text x={first.x} y={H + 8} fontSize="7" textAnchor="middle" fill="#475569">{first.year}</text>
        <text x={last.x}  y={H + 8} fontSize="7" textAnchor="middle" fill="#475569">{last.year}</text>
      </svg>
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px] text-slate-600">{fmt(values[0], metricKey === 'vegetation_pct')}</span>
        <span className="text-[8px] text-slate-200 font-bold">{fmt(last.value, metricKey === 'vegetation_pct')}</span>
      </div>
    </div>
  );
}

// ─── Multi-metric Time Series Grid ───────────────────────────────────────────
// Uses Arabic chart_data keys as returned by the time-series API.

interface MultiSeriesProps {
  result: TimeSeriesResult;
}

// Map from Arabic backend key → display color
const ARABIC_KEY_CONFIGS: Array<{ key: string; label: string; color: string }> = [
  { key: 'تطور المباني',        label: 'المباني',          color: '#f97316' },
  { key: 'النمو السكاني',       label: 'السكان',           color: '#3b82f6' },
  { key: 'تطور الغطاء الأخضر', label: 'الغطاء الأخضر',   color: '#10b981' },
  { key: 'التوسع العمراني',     label: 'التوسع العمراني',  color: '#8b5cf6' },
  { key: 'تغير درجات الحرارة', label: 'درجة الحرارة (°C)', color: '#ef4444' },
];

export function MultiTimeSeriesCharts({ result }: MultiSeriesProps) {
  const available = ARABIC_KEY_CONFIGS.filter(
    c => (result.chart_data[c.key]?.length ?? 0) >= 2
  );
  if (available.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2" dir="rtl">
      {available.slice(0, 4).map(({ key, label, color }) => {
        const points = result.chart_data[key];
        if (!points || points.length < 2) return null;

        const values = points.map((p: { year: number; value: number }) => p.value);
        const max    = Math.max(...values, 1);
        const min    = Math.min(...values, 0);
        const range  = Math.max(max - min, 1);
        const W = 200, H = 52, padX = 8, padY = 10;

        const coords = points.map((p: { year: number; value: number }, i: number) => ({
          x: padX + (i / (points.length - 1)) * (W - 2 * padX),
          y: H - padY - ((p.value - min) / range) * (H - 2 * padY),
          year: p.year,
          value: p.value,
        }));

        const pathD = coords.map((c: { x: number; y: number }, i: number) =>
          `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`
        ).join(' ');
        const areaD = `${pathD} L${coords[coords.length - 1].x},${H - padY} L${coords[0].x},${H - padY} Z`;
        const gradId = `grad-${key.replace(/\s/g, '-')}`;
        const first  = coords[0];
        const last   = coords[coords.length - 1];

        const fmtV = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}م` :
                                     n >= 10_000   ? `${(n/1_000).toFixed(0)}ك` :
                                     n.toFixed(n < 10 ? 1 : 0);

        return (
          <div key={key} className="bg-slate-800/40 border border-slate-700/30 rounded-lg p-2.5">
            <p className="text-[9px] font-bold text-slate-500 mb-1">{label}</p>
            <svg width="100%" viewBox={`0 0 ${W} ${H + 10}`} style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 0.5, 1].map(t => (
                <line key={t}
                  x1={padX} y1={padY + t * (H - 2 * padY)}
                  x2={W - padX} y2={padY + t * (H - 2 * padY)}
                  stroke="#1e293b" strokeWidth="0.5"
                />
              ))}
              <path d={areaD} fill={`url(#${gradId})`} />
              <path d={pathD} fill="none" stroke={color} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={first.x} cy={first.y} r="2.5" fill={color} opacity="0.5" />
              <circle cx={last.x}  cy={last.y}  r="3"   fill={color} />
              <text x={first.x} y={H + 8} fontSize="7" textAnchor="middle" fill="#475569">{first.year}</text>
              <text x={last.x}  y={H + 8} fontSize="7" textAnchor="middle" fill="#475569">{last.year}</text>
            </svg>
            <div className="flex justify-between mt-0.5">
              <span className="text-[8px] text-slate-600">{fmtV(values[0])}</span>
              <span className="text-[8px] text-slate-200 font-bold">{fmtV(last.value)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
