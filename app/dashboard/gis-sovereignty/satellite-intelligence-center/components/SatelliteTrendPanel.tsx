'use client';
// ─── SatelliteTrendPanel ──────────────────────────────────────────────────────
// Temporal trend analysis: shows NDVI/SAR/NDWI change over 12 months as SVG chart.
// No external chart library — pure SVG + Tailwind.

import React, { useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Loader2, AlertTriangle,
  Activity, BarChart3, Satellite, RefreshCw,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrendPoint {
  month: string;
  month_ar: string;
  value: number | null;
  available: boolean;
  source: string;
  z_score?: number | null;
  is_anomaly?: boolean;
}

interface TrendResult {
  ok: boolean;
  indicator: string;
  label_ar: string;
  unit: string;
  months_requested: number;
  months_available: number;
  missing_count: number;
  baseline_mean: number | null;
  trend_direction: 'up' | 'down' | 'stable';
  anomaly_count: number;
  points: TrendPoint[];
}

interface Props {
  polygon: [number, number][] | null;
}

// ── Indicator config ──────────────────────────────────────────────────────────

const INDICATORS = [
  { id: 'ndvi',           label: 'NDVI',       labelAr: 'الغطاء النباتي',  color: '#22c55e', desc: 'صحة النبات والغطاء الأخضر' },
  { id: 'ndwi',           label: 'NDWI',       labelAr: 'الرطوبة',         color: '#38bdf8', desc: 'محتوى الماء والرطوبة' },
  { id: 'sar',            label: 'SAR VV',     labelAr: 'الرادار SAR',     color: '#a78bfa', desc: 'يخترق السحب — كشف التغيرات' },
  { id: 'rgb_brightness', label: 'Brightness', labelAr: 'الإضاءة',         color: '#fbbf24', desc: 'متوسط إضاءة المنطقة' },
] as const;

type IndicatorId = typeof INDICATORS[number]['id'];

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function TrendLineChart({ points, color, baseline }: {
  points: TrendPoint[];
  color: string;
  baseline: number | null;
}) {
  const W = 520;
  const H = 140;
  const PAD = { top: 16, right: 12, bottom: 40, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const available = points.filter(p => p.value !== null && p.available);
  if (available.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-slate-500 text-xs">
        لا توجد بيانات كافية للرسم
      </div>
    );
  }

  const allVals = available.map(p => p.value as number);
  const minV = Math.min(...allVals) * 0.95;
  const maxV = Math.max(...allVals) * 1.05;
  const range = maxV - minV || 0.01;

  const xOf = (i: number) => PAD.left + (i / Math.max(points.length - 1, 1)) * chartW;
  const yOf = (v: number) => PAD.top + chartH - ((v - minV) / range) * chartH;

  // Build SVG path through available points only
  const pathParts: string[] = [];
  let lastAvail = false;
  points.forEach((p, i) => {
    if (p.value !== null && p.available) {
      const x = xOf(i);
      const y = yOf(p.value);
      if (!lastAvail) pathParts.push(`M ${x} ${y}`);
      else pathParts.push(`L ${x} ${y}`);
      lastAvail = true;
    } else {
      lastAvail = false;
    }
  });
  const pathD = pathParts.join(' ');

  // Baseline Y
  const baselineY = baseline !== null ? yOf(baseline) : null;

  // Y-axis ticks
  const yTicks = 4;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    minV + (i / yTicks) * range
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid lines */}
      {yTickVals.map((v, i) => (
        <line
          key={i}
          x1={PAD.left} y1={yOf(v)}
          x2={PAD.left + chartW} y2={yOf(v)}
          stroke="#334155" strokeWidth="0.5" strokeDasharray="3,4"
        />
      ))}

      {/* Baseline */}
      {baselineY !== null && (
        <line
          x1={PAD.left} y1={baselineY}
          x2={PAD.left + chartW} y2={baselineY}
          stroke="#64748b" strokeWidth="1" strokeDasharray="5,3"
        />
      )}

      {/* Shaded area under line */}
      {pathParts.length > 0 && (
        <path
          d={`${pathD} V ${PAD.top + chartH} L ${PAD.left} ${PAD.top + chartH} Z`}
          fill={color}
          fillOpacity="0.1"
        />
      )}

      {/* Main line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Data points */}
      {points.map((p, i) => {
        if (p.value === null || !p.available) {
          // Missing: small X mark
          const x = xOf(i);
          const y = PAD.top + chartH / 2;
          return (
            <g key={i}>
              <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} stroke="#475569" strokeWidth="1.5" />
              <line x1={x + 3} y1={y - 3} x2={x - 3} y2={y + 3} stroke="#475569" strokeWidth="1.5" />
            </g>
          );
        }
        const x = xOf(i);
        const y = yOf(p.value);
        const isAnomaly = p.is_anomaly;
        return (
          <g key={i}>
            <circle
              cx={x} cy={y}
              r={isAnomaly ? 5 : 3}
              fill={isAnomaly ? '#ef4444' : color}
              stroke={isAnomaly ? '#fca5a5' : 'transparent'}
              strokeWidth="2"
            />
            {isAnomaly && (
              <circle cx={x} cy={y} r={8} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />
            )}
          </g>
        );
      })}

      {/* Y-axis labels */}
      {yTickVals.map((v, i) => (
        <text
          key={i}
          x={PAD.left - 4} y={yOf(v) + 4}
          textAnchor="end" fontSize="8" fill="#64748b"
          fontFamily="monospace"
        >
          {v.toFixed(2)}
        </text>
      ))}

      {/* X-axis labels — every 2nd month */}
      {points.map((p, i) => {
        if (i % 2 !== 0 && i !== points.length - 1) return null;
        const parts = p.month_ar.split(' ');
        const shortMonth = parts[0]?.slice(0, 3) ?? '';
        const yr = parts[1] ?? '';
        return (
          <g key={i}>
            <text
              x={xOf(i)} y={H - 18}
              textAnchor="middle" fontSize="7.5" fill="#64748b"
            >
              {shortMonth}
            </text>
            <text
              x={xOf(i)} y={H - 8}
              textAnchor="middle" fontSize="7" fill="#475569"
            >
              {yr}
            </text>
          </g>
        );
      })}

      {/* Baseline label */}
      {baselineY !== null && baseline !== null && (
        <text
          x={PAD.left + chartW - 2} y={baselineY - 3}
          textAnchor="end" fontSize="7.5" fill="#64748b"
        >
          خط القاعدة
        </text>
      )}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SatelliteTrendPanel({ polygon }: Props) {
  const [indicator, setIndicator] = useState<IndicatorId>('ndvi');
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const indicatorCfg = INDICATORS.find(i => i.id === indicator)!;

  const runAnalysis = useCallback(async () => {
    if (!polygon || polygon.length < 3) {
      setError('ارسم منطقة على الخريطة أولاً');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/gis/satellite-trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygon, indicator, months }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'خطأ في الخادم');
      if (data.ok === false && data.unavailable_reason) {
        setError(`⚠️ البيانات غير متوفرة: ${data.unavailable_reason}`);
      } else if (data.months_available === 0) {
        const pts: Array<{source?: string}> = data.points ?? [];
        const reasons = [...new Set(pts.map((p) => p.source).filter(Boolean))];
        const reasonText = reasons.length
          ? `السبب: ${reasons.join(' / ')}`
          : 'تعذّر جلب أي صورة من Copernicus للنطاق الزمني المحدد';
        setError(`⚠️ لا توجد بيانات متاحة لهذه المنطقة في آخر ${data.months_requested} شهراً — ${reasonText}`);
      } else {
        setResult(data as TrendResult);
      }
    } catch (e: any) {
      setError(e.message ?? 'خطأ غير معروف');
    } finally {
      setLoading(false);
    }
  }, [polygon, indicator, months]);

  const TrendIcon = result?.trend_direction === 'up'
    ? TrendingUp
    : result?.trend_direction === 'down'
    ? TrendingDown
    : Minus;

  const trendColor = result?.trend_direction === 'up'
    ? 'text-emerald-400'
    : result?.trend_direction === 'down'
    ? 'text-red-400'
    : 'text-slate-400';

  const trendLabel = result?.trend_direction === 'up'
    ? 'اتجاه تصاعدي'
    : result?.trend_direction === 'down'
    ? 'اتجاه تنازلي'
    : 'مستقر';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={15} className="text-cyan-400 shrink-0" />
          <span className="text-sm font-bold text-white">تحليل الاتجاه الزمني</span>
        </div>
        <p className="text-[10px] text-slate-500">
          تغير المؤشر على مدى {months} شهراً — مقارنة شهر بشهر بالصور الفضائية
        </p>
      </div>

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 space-y-3">
        {/* Indicator selector */}
        <div>
          <p className="text-[10px] text-slate-500 mb-1.5 font-semibold">المؤشر</p>
          <div className="grid grid-cols-2 gap-1.5">
            {INDICATORS.map(ind => (
              <button
                key={ind.id}
                onClick={() => setIndicator(ind.id)}
                className={`flex items-start gap-2 p-2 rounded-lg border text-right transition-all ${
                  indicator === ind.id
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-white'
                    : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                  style={{ background: ind.color }}
                />
                <div>
                  <p className="text-[10px] font-bold leading-none mb-0.5">{ind.labelAr}</p>
                  <p className="text-[8px] text-slate-500 leading-none">{ind.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Months selector */}
        <div className="flex items-center gap-3">
          <p className="text-[10px] text-slate-500 whitespace-nowrap">عدد الأشهر:</p>
          {[6, 12, 18, 24].map(m => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                months === m
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Run button */}
        <button
          onClick={runAnalysis}
          disabled={loading || !polygon || polygon.length < 3}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
            loading || !polygon || polygon.length < 3
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30'
          }`}
        >
          {loading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              جاري التحليل... ({months} شهر)
            </>
          ) : (
            <>
              <BarChart3 size={13} />
              تشغيل تحليل الاتجاه
            </>
          )}
        </button>

        {!polygon || polygon.length < 3 ? (
          <p className="text-[10px] text-amber-400 text-center">
            ارسم منطقة على الخريطة أولاً (تبويب رسم)
          </p>
        ) : null}
      </div>

      {/* ── Results ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {error && (
          <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-lg p-3">
            <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            <div className="bg-slate-800/40 rounded-xl p-4 text-center">
              <Satellite size={20} className="mx-auto mb-2 text-cyan-400 animate-pulse" />
              <p className="text-xs text-slate-400">جاري جلب بيانات {months} شهراً من Sentinel...</p>
              <p className="text-[10px] text-slate-600 mt-1">هذا قد يستغرق 2-3 دقائق</p>
            </div>
            {/* Skeleton bars */}
            <div className="flex items-end gap-1 h-24 px-2">
              {Array.from({ length: months }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-slate-800/60 rounded-t animate-pulse"
                  style={{ height: `${30 + Math.random() * 60}%` }}
                />
              ))}
            </div>
          </div>
        )}

        {result && !loading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-slate-500 mb-1">الأشهر المتاحة</p>
                <p className="text-lg font-bold text-white">{result.months_available}</p>
                <p className="text-[9px] text-slate-600">من {result.months_requested}</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-slate-500 mb-1">الاتجاه</p>
                <div className={`flex items-center justify-center gap-1 ${trendColor}`}>
                  <TrendIcon size={14} />
                  <span className="text-xs font-bold">{trendLabel}</span>
                </div>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-slate-500 mb-1">شذوذات</p>
                <p className={`text-lg font-bold ${result.anomaly_count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {result.anomaly_count}
                </p>
                <p className="text-[9px] text-slate-600">شهر</p>
              </div>
            </div>

            {/* Baseline */}
            {result.baseline_mean !== null && (
              <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2">
                <span className="text-[10px] text-slate-400">متوسط القاعدة ({result.label_ar})</span>
                <span className="text-sm font-mono font-bold" style={{ color: indicatorCfg.color }}>
                  {result.baseline_mean.toFixed(3)} {result.unit}
                </span>
              </div>
            )}

            {/* Chart */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: indicatorCfg.color }} />
                <span className="text-[11px] font-bold text-slate-300">{result.label_ar}</span>
                {result.anomaly_count > 0 && (
                  <span className="mr-auto text-[9px] text-red-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    {result.anomaly_count} شهر شذوذ
                  </span>
                )}
              </div>
              <TrendLineChart
                points={result.points}
                color={indicatorCfg.color}
                baseline={result.baseline_mean}
              />
              <p className="text-[9px] text-slate-600 mt-2 text-center">
                النقاط الحمراء = شذوذات (Z-score &gt; 2) · الخط المقطّع = متوسط القاعدة · × = لا بيانات
              </p>
            </div>

            {/* Monthly data table */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 mb-2">البيانات الشهرية</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {[...result.points].reverse().map((p, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
                      p.is_anomaly
                        ? 'bg-red-900/20 border border-red-800/30'
                        : 'bg-slate-800/30'
                    }`}
                  >
                    <span className={`text-[10px] ${p.is_anomaly ? 'text-red-300' : 'text-slate-400'}`}>
                      {p.month_ar}
                    </span>
                    {p.available && p.value !== null ? (
                      <div className="flex items-center gap-3">
                        {p.z_score !== null && p.z_score !== undefined && (
                          <span className={`text-[9px] font-mono ${Math.abs(p.z_score) > 2 ? 'text-red-400' : 'text-slate-500'}`}>
                            z={p.z_score > 0 ? '+' : ''}{p.z_score.toFixed(1)}
                          </span>
                        )}
                        <span className="font-mono font-bold" style={{ color: indicatorCfg.color }}>
                          {p.value.toFixed(3)}
                        </span>
                        {p.is_anomaly && (
                          <AlertTriangle size={11} className="text-red-400 shrink-0" />
                        )}
                      </div>
                    ) : (
                      <span className="text-[9px] text-slate-600">لا بيانات</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Data notes */}
            {result.missing_count > 0 && (
              <div className="bg-amber-900/10 border border-amber-800/20 rounded-lg p-2.5">
                <p className="text-[10px] text-amber-400">
                  ⚠ {result.missing_count} شهر بدون بيانات — قد يكون بسبب التغطية السحابية أو توفر الأرشيف
                </p>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[9px] text-slate-600 pb-2">
              <Satellite size={10} className="shrink-0" />
              البيانات من Sentinel-2 L2A / Sentinel-1 SAR عبر Copernicus Data Space
            </div>
          </>
        )}

        {!result && !loading && !error && (
          <div className="text-center py-8">
            <BarChart3 size={28} className="mx-auto mb-3 text-slate-700" />
            <p className="text-xs text-slate-500 mb-1">لا توجد نتائج بعد</p>
            <p className="text-[10px] text-slate-600">اختر مؤشراً واضغط "تشغيل تحليل الاتجاه"</p>
          </div>
        )}
      </div>
    </div>
  );
}
