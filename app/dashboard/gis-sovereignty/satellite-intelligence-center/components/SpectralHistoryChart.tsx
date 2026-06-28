'use client';
// SpectralHistoryChart — time-series chart for NDVI / LST / Urban% from spectral_history

import React, { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { fetchSpectralHistory, type SpectralHistoryPoint } from '@/lib/areaReportAPI';

interface HistoryPoint extends SpectralHistoryPoint {}

interface HistoryData {
  bbox_key:    string;
  point_count: number;
  series:      HistoryPoint[];
}

interface SpectralHistoryChartProps {
  bbox: [number, number, number, number] | null;
}

// ── Inline SVG Sparkline ───────────────────────────────────────────────────────
function Sparkline({
  values,
  color,
  height = 40,
  width = 180,
  minVal,
  maxVal,
}: {
  values: number[];
  color: string;
  height?: number;
  width?: number;
  minVal?: number;
  maxVal?: number;
}) {
  if (values.length < 2) return <div className="h-10 flex items-center text-[10px] text-slate-600">نقطة واحدة فقط</div>;

  const mn = minVal ?? Math.min(...values);
  const mx = maxVal ?? Math.max(...values);
  const range = mx - mn || 1;
  const PAD = 4;
  const W = width - PAD * 2;
  const H = height - PAD * 2;

  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * W;
    const y = PAD + H - ((v - mn) / range) * H;
    return `${x},${y}`;
  });

  const polyline = pts.join(' ');
  const first = pts[0].split(',').map(Number);
  const last  = pts[pts.length - 1].split(',').map(Number);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* start dot */}
      <circle cx={first[0]} cy={first[1]} r="2.5" fill={color} opacity="0.6" />
      {/* end dot */}
      <circle cx={last[0]}  cy={last[1]}  r="3"   fill={color} />
    </svg>
  );
}

// ── Trend icon ─────────────────────────────────────────────────────────────────
function TrendIcon({ delta, invert = false }: { delta: number; invert?: boolean }) {
  const positive = invert ? delta < 0 : delta > 0;
  if (Math.abs(delta) < 0.01) return <Minus size={12} className="text-slate-500" />;
  return positive
    ? <TrendingUp  size={12} className="text-emerald-400" />
    : <TrendingDown size={12} className="text-red-400" />;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SpectralHistoryChart({ bbox }: SpectralHistoryChartProps) {
  const [data, setData]   = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bboxStr = useMemo(
    () => bbox ? `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}` : null,
    [bbox]
  );

  useEffect(() => {
    if (!bbox) return;
    setLoading(true);
    setError(null);
    fetchSpectralHistory(bbox)
      .then(d => {
        if (d.series) setData(d);
        else setError('لا بيانات');
      })
      .catch(() => setError('تعذّر تحميل السجل'))
      .finally(() => setLoading(false));
  }, [bboxStr]);

  if (!bbox) return null;

  if (loading) return (
    <div className="flex items-center gap-2 text-[10px] text-slate-500 py-3">
      <RefreshCw size={11} className="animate-spin" />
      جاري تحميل السجل التاريخي...
    </div>
  );

  if (error || !data || data.point_count === 0) return (
    <div className="text-[10px] text-slate-600 py-2 text-center">
      {error ?? 'لا يوجد سجل طيفي لهذه المنطقة بعد — سيظهر بعد أول تحليل'}
    </div>
  );

  const { series } = data;
  const ndviVals  = series.map(p => p.ndvi);
  const lstVals   = series.map(p => p.lst_c);
  const urbanVals = series.map(p => p.urban_pct);
  const labels    = series.map(p => p.date.slice(0, 7)); // YYYY-MM

  const ndviDelta  = ndviVals.length > 1  ? ndviVals[ndviVals.length-1]   - ndviVals[0]   : 0;
  const lstDelta   = lstVals.length > 1   ? lstVals[lstVals.length-1]     - lstVals[0]     : 0;
  const urbanDelta = urbanVals.length > 1 ? urbanVals[urbanVals.length-1] - urbanVals[0]   : 0;

  return (
    <div className="mt-3 bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
      <p className="text-[10px] font-bold text-slate-400 mb-3 flex items-center gap-1.5">
        <span className="w-1 h-3 bg-purple-500 rounded-full" />
        السجل التاريخي — {data.point_count} صورة فضائية
      </p>

      {/* Date labels */}
      <div className="flex justify-between text-[8px] text-slate-600 mb-1 px-1">
        {labels.length > 0 && <span>{labels[0]}</span>}
        {labels.length > 2 && <span>{labels[Math.floor(labels.length/2)]}</span>}
        {labels.length > 1 && <span>{labels[labels.length-1]}</span>}
      </div>

      {/* NDVI chart */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <TrendIcon delta={ndviDelta} />
            NDVI (نباتات)
          </span>
          <span className="text-[10px] font-mono text-emerald-400">
            {ndviVals[ndviVals.length-1].toFixed(3)}
            {ndviDelta !== 0 && (
              <span className={ndviDelta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {' '}{ndviDelta > 0 ? '+' : ''}{ndviDelta.toFixed(3)}
              </span>
            )}
          </span>
        </div>
        <Sparkline values={ndviVals} color="#34d399" width={240} height={36} minVal={0} maxVal={0.5} />
      </div>

      {/* LST chart */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <TrendIcon delta={lstDelta} invert />
            LST °م
          </span>
          <span className="text-[10px] font-mono text-orange-400">
            {lstVals[lstVals.length-1].toFixed(1)}°
            {lstDelta !== 0 && (
              <span className={lstDelta < 0 ? 'text-emerald-400' : 'text-red-400'}>
                {' '}{lstDelta > 0 ? '+' : ''}{lstDelta.toFixed(1)}°
              </span>
            )}
          </span>
        </div>
        <Sparkline values={lstVals} color="#fb923c" width={240} height={36} minVal={20} maxVal={55} />
      </div>

      {/* Urban % chart */}
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <TrendIcon delta={urbanDelta} />
            حضري %
          </span>
          <span className="text-[10px] font-mono text-slate-300">
            {urbanVals[urbanVals.length-1].toFixed(1)}%
            {urbanDelta !== 0 && (
              <span className={urbanDelta > 0 ? 'text-amber-400' : 'text-cyan-400'}>
                {' '}{urbanDelta > 0 ? '+' : ''}{urbanDelta.toFixed(1)}%
              </span>
            )}
          </span>
        </div>
        <Sparkline values={urbanVals} color="#94a3b8" width={240} height={36} minVal={0} maxVal={100} />
      </div>

      {/* Point table */}
      {series.length > 1 && (
        <div className="mt-3 border-t border-slate-700/30 pt-2">
          <div className="grid text-[9px] text-slate-600 mb-1" style={{gridTemplateColumns:'auto 1fr 1fr 1fr 1fr'}}>
            <span className="pr-2">التاريخ</span>
            <span className="text-center">NDVI</span>
            <span className="text-center">LST</span>
            <span className="text-center">حضري%</span>
            <span className="text-center">مباني</span>
          </div>
          {series.map(p => (
            <div key={p.scene_id}
              className="grid text-[9px] text-slate-400 py-0.5 hover:bg-slate-700/20 rounded"
              style={{gridTemplateColumns:'auto 1fr 1fr 1fr 1fr'}}
            >
              <span className="pr-2 text-slate-500 font-mono">{p.date}</span>
              <span className="text-center text-emerald-400/80">{p.ndvi.toFixed(3)}</span>
              <span className="text-center text-orange-400/80">{p.lst_c.toFixed(1)}°</span>
              <span className="text-center">{p.urban_pct.toFixed(1)}%</span>
              <span className="text-center">{p.buildings?.toLocaleString('ar') ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
