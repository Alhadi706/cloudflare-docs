'use client';

/**
 * Risk Analysis Panel – تحليل الخطر والانحدار
 * Calculates slope anomalies and a hydraulic risk index per segment,
 * then renders a colour-coded heatmap ribbon + top-N critical segments table.
 */

import React, { useMemo } from 'react';
import { LinearAsset } from '@/lib/linear-referencing/types';
import { formatStation } from '@/lib/linear-referencing/engine';

interface SegmentRisk {
  fromCode: string;
  toCode: string;
  fromStation: number;
  toStation: number;
  deltaStation: number;
  deltaElevation: number;
  /** absolute slope in % */
  slopePercent: number;
  /** 0–100 risk index */
  riskIndex: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface RiskAnalysisPanelProps {
  assets: LinearAsset[];
}

// Slope thresholds (absolute %)
const SLOPE_MEDIUM = 0.5;
const SLOPE_HIGH = 1.5;
const SLOPE_CRITICAL = 3.0;

function classifyRisk(slopePercent: number): SegmentRisk['riskLevel'] {
  if (slopePercent >= SLOPE_CRITICAL) return 'critical';
  if (slopePercent >= SLOPE_HIGH) return 'high';
  if (slopePercent >= SLOPE_MEDIUM) return 'medium';
  return 'low';
}

function slopeToRiskIndex(slopePercent: number): number {
  // Normalise to 0–100 using a capped exponential model
  const raw = Math.min(100, (slopePercent / SLOPE_CRITICAL) * 80 + (slopePercent > SLOPE_HIGH ? 20 : 0));
  return Math.round(raw);
}

const RISK_COLOURS: Record<SegmentRisk['riskLevel'], string> = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#7C3AED',
};

const RISK_LABELS: Record<SegmentRisk['riskLevel'], string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالٍ',
  critical: 'حرج',
};

const RISK_BG: Record<SegmentRisk['riskLevel'], string> = {
  low: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-200',
  medium: 'bg-amber-900/30 border-amber-700/40 text-amber-200',
  high: 'bg-rose-900/30 border-rose-700/40 text-rose-200',
  critical: 'bg-purple-900/30 border-purple-700/40 text-purple-200',
};

function buildSegments(assets: LinearAsset[]): SegmentRisk[] {
  const sorted = [...assets].sort((a, b) => a.station - b.station);
  const segments: SegmentRisk[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const deltaStation = to.station - from.station;
    if (deltaStation <= 0) continue;
    const deltaElevation = to.invert_level - from.invert_level;
    const slopePercent = Math.abs(deltaElevation / deltaStation) * 100;
    const riskLevel = classifyRisk(slopePercent);
    const riskIndex = slopeToRiskIndex(slopePercent);

    segments.push({
      fromCode: from.equipment_code,
      toCode: to.equipment_code,
      fromStation: from.station,
      toStation: to.station,
      deltaStation,
      deltaElevation,
      slopePercent,
      riskIndex,
      riskLevel,
    });
  }

  return segments;
}

export function RiskAnalysisPanel({ assets }: RiskAnalysisPanelProps) {
  const segments = useMemo(() => buildSegments(assets), [assets]);

  if (assets.length < 2) {
    return null; // not enough data to compute risks
  }

  const minStation = segments[0]?.fromStation ?? 0;
  const maxStation = segments[segments.length - 1]?.toStation ?? 1;
  const span = Math.max(1, maxStation - minStation);

  const counts = {
    low: segments.filter((s) => s.riskLevel === 'low').length,
    medium: segments.filter((s) => s.riskLevel === 'medium').length,
    high: segments.filter((s) => s.riskLevel === 'high').length,
    critical: segments.filter((s) => s.riskLevel === 'critical').length,
  };

  const avgRisk = Math.round(
    segments.reduce((sum, s) => sum + s.riskIndex, 0) / segments.length
  );

  const maxSlope = Math.max(...segments.map((s) => s.slopePercent));
  const topRisk = [...segments]
    .sort((a, b) => b.riskIndex - a.riskIndex)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="rounded-lg border border-rose-700/40 bg-gradient-to-r from-rose-950/50 to-slate-950/50 px-5 py-4">
        <h2 className="text-lg font-bold text-rose-100 flex items-center gap-2">
          ⚠️ تحليل الخطر والانحدار الهيدروليكي
        </h2>
        <p className="text-xs text-rose-200/70 mt-1">
          يقيس الانحدار النسبي بين كل محطتين متتاليتين ويحسب مؤشر خطر هيدروليكي
          لكل مقطع.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="متوسط مؤشر الخطر" value={`${avgRisk}%`} tone="neutral" />
        <KpiCard label="أقصى انحدار" value={`${maxSlope.toFixed(3)}%`} tone={maxSlope >= SLOPE_CRITICAL ? 'bad' : maxSlope >= SLOPE_HIGH ? 'warn' : 'good'} />
        <KpiCard label="مقاطع عالية/حرجة" value={(counts.high + counts.critical).toString()} tone={(counts.high + counts.critical) > 0 ? 'bad' : 'good'} />
        <KpiCard label="مقاطع آمنة" value={counts.low.toString()} tone="good" />
      </div>

      {/* Heatmap ribbon */}
      <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          🌡️ خريطة حرارية للمخاطر على طول المسار
        </h3>
        <div className="overflow-x-auto pb-2">
          <svg width={Math.max(800, segments.length * 10)} height={60}>
            {segments.map((seg, i) => {
              const x = ((seg.fromStation - minStation) / span) * Math.max(800, segments.length * 10);
              const w = Math.max(2, (seg.deltaStation / span) * Math.max(800, segments.length * 10));
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={8}
                    width={w - 1}
                    height={30}
                    fill={RISK_COLOURS[seg.riskLevel]}
                    opacity={0.85}
                    rx={1}
                  >
                    <title>
                      {`${seg.fromCode} → ${seg.toCode}\nانحدار: ${seg.slopePercent.toFixed(3)}%\nالخطر: ${RISK_LABELS[seg.riskLevel]}`}
                    </title>
                  </rect>
                </g>
              );
            })}
            {/* station labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const svgW = Math.max(800, segments.length * 10);
              const stVal = minStation + ratio * span;
              return (
                <text
                  key={i}
                  x={ratio * svgW}
                  y={52}
                  fill="#94A3B8"
                  fontSize={10}
                  textAnchor="middle"
                >
                  {formatStation(stVal)}
                </text>
              );
            })}
          </svg>
        </div>
        {/* legend */}
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-300">
          {(['low', 'medium', 'high', 'critical'] as const).map((lvl) => (
            <span key={lvl} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: RISK_COLOURS[lvl] }} />
              {RISK_LABELS[lvl]} ({counts[lvl]})
            </span>
          ))}
        </div>
      </div>

      {/* Top-5 critical segments */}
      {topRisk.filter((s) => s.riskLevel !== 'low').length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            🔺 أعلى المقاطع خطورةً (تحتاج مراجعة)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 border-b border-slate-700">
                  <th className="px-3 py-2 text-right text-slate-300">من</th>
                  <th className="px-3 py-2 text-right text-slate-300">إلى</th>
                  <th className="px-3 py-2 text-center text-slate-300">طول (م)</th>
                  <th className="px-3 py-2 text-center text-slate-300">Δ I.L (م)</th>
                  <th className="px-3 py-2 text-center text-slate-300">الانحدار %</th>
                  <th className="px-3 py-2 text-center text-slate-300">مؤشر الخطر</th>
                  <th className="px-3 py-2 text-center text-slate-300">التقييم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {topRisk.map((seg, i) => (
                  <tr key={i} className="bg-slate-900/50 hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 py-2 text-slate-300 font-mono">{seg.fromCode}</td>
                    <td className="px-3 py-2 text-slate-300 font-mono">{seg.toCode}</td>
                    <td className="px-3 py-2 text-center text-slate-200">{seg.deltaStation.toFixed(0)}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${seg.deltaElevation < 0 ? 'text-sky-300' : 'text-orange-300'}`}>
                      {seg.deltaElevation > 0 ? '+' : ''}{seg.deltaElevation.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-white">{seg.slopePercent.toFixed(4)}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-16 h-2 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${seg.riskIndex}%`, background: RISK_COLOURS[seg.riskLevel] }}
                          />
                        </div>
                        <span className="text-slate-200 w-8">{seg.riskIndex}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${RISK_BG[seg.riskLevel]}`}>
                        {RISK_LABELS[seg.riskLevel]}
                      </span>
                    </td>
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

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const cls =
    tone === 'good'
      ? 'border-emerald-700/40 bg-emerald-900/20 text-emerald-200'
      : tone === 'warn'
        ? 'border-amber-700/40 bg-amber-900/20 text-amber-200'
        : tone === 'bad'
          ? 'border-rose-700/40 bg-rose-900/20 text-rose-200'
          : 'border-slate-700 bg-slate-800/50 text-slate-200';
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
