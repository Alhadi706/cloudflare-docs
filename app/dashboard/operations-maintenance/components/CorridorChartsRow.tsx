'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as any;

export interface CorridorChartPoint {
  id: string;
  station_label: string;
  station: number;
  hydraulic_pressure_bar: number;
  pipe_bar_grade_bar: number;
  safety_margin_bar: number;
  invert_level: number;
  risk_level: 'safe' | 'watch' | 'critical';
}

function riskColor(riskLevel: CorridorChartPoint['risk_level']) {
  if (riskLevel === 'critical') return '#f43f5e';
  if (riskLevel === 'watch') return '#f59e0b';
  return '#10b981';
}

function SectionShell({ title, subtitle, badge, children }: { title: string; subtitle: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-4 shadow-[0_20px_80px_rgba(2,6,23,0.28)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">{badge}</span>
      </div>
      {children}
    </div>
  );
}

export function CorridorChartsRow({
  points,
  heatmapValues,
  selectedPointId,
}: {
  points: CorridorChartPoint[];
  heatmapValues: number[][];
  selectedPointId: string | null;
}) {
  return (
    <div className="grid gap-4 border-y border-white/5 px-6 py-6 xl:grid-cols-2 2xl:grid-cols-3 xl:px-8">
      <SectionShell title="Pressure Envelope" subtitle="Hydraulic pressure against Pipe Bar Grade with immediate risk colors" badge="live comparison">
        <div className="h-[380px] w-full md:h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points}>
              <defs>
                <linearGradient id="pressureGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.14)" strokeDasharray="4 6" />
              <XAxis dataKey="station_label" tick={{ fill: '#cbd5e1', fontSize: 11 }} interval={0} angle={-24} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(1)}b`} />
              <Tooltip />
              <Area type="monotone" dataKey="hydraulic_pressure_bar" stroke="none" fill="url(#pressureGlow)" />
              <Bar dataKey="safety_margin_bar" barSize={10} fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="hydraulic_pressure_bar"
                stroke="#22c55e"
                strokeWidth={3}
                dot={(dotProps: any) => {
                  const p = dotProps.payload as CorridorChartPoint | undefined;
                  const r = p ? (p.id === selectedPointId ? 6 : p.risk_level === 'critical' ? 5 : 4) : 3;
                  const fill = p ? riskColor(p.risk_level) : 'rgba(148,163,184,0.35)';
                  return <circle cx={dotProps.cx} cy={dotProps.cy} r={r} fill={fill} stroke="#020617" strokeWidth={p?.id === selectedPointId ? 2.5 : 1.5} />;
                }}
              />
              <Line type="monotone" dataKey="pipe_bar_grade_bar" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="8 6" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionShell>

      <SectionShell title="3D Hydraulic Terrain" subtitle="Station + pressure + invert elevation in a single three-dimensional view" badge="3D scene">
        <div className="h-[360px] w-full md:h-[420px]">
          <Plot
            data={[{
              type: 'scatter3d',
              mode: 'lines+markers+text',
              x: points.map((p) => p.station),
              y: points.map((p) => p.hydraulic_pressure_bar),
              z: points.map((p) => p.invert_level),
              text: points.map((p) => p.station_label),
              textposition: 'top center',
              line: { color: '#38bdf8', width: 8 },
              marker: {
                size: points.map((p) => (p.risk_level === 'critical' ? 8 : p.risk_level === 'watch' ? 6 : 5)),
                color: points.map((p) => riskColor(p.risk_level)),
                opacity: 0.95,
              },
              hovertemplate: '%{text}<br>Pressure: %{y:.2f} bar<br>Invert: %{z:.2f} m<extra></extra>',
            }]}
            layout={{
              autosize: true,
              margin: { l: 0, r: 0, t: 10, b: 0 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { color: '#dbeafe', size: 11 },
              scene: {
                bgcolor: 'rgba(2,6,23,0)',
                xaxis: { title: 'Station', gridcolor: 'rgba(148,163,184,0.12)', zerolinecolor: 'rgba(148,163,184,0.12)' },
                yaxis: { title: 'Pressure', gridcolor: 'rgba(148,163,184,0.12)', zerolinecolor: 'rgba(148,163,184,0.12)' },
                zaxis: { title: 'Invert', gridcolor: 'rgba(148,163,184,0.12)', zerolinecolor: 'rgba(148,163,184,0.12)' },
                camera: { eye: { x: 1.45, y: 1.2, z: 0.9 } },
              },
            }}
            config={{ displayModeBar: false, responsive: true }}
            className="h-full w-full"
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </SectionShell>

      <div className="2xl:col-auto xl:col-span-2">
        <SectionShell title="Signal Matrix" subtitle="Heatmap reads the corridor as layered engineering signals" badge="matrix">
          <div className="h-[340px] w-full md:h-[400px]">
            <Plot
              data={[{
                type: 'heatmap',
                x: points.map((p) => p.station_label),
                y: ['Hydraulic', 'Pipe Grade', 'Margin', 'Invert'],
                z: heatmapValues,
                colorscale: [[0, '#082f49'], [0.3, '#0891b2'], [0.6, '#f59e0b'], [1, '#ef4444']],
                showscale: false,
                hoverongaps: false,
              }]}
              layout={{
                autosize: true,
                margin: { l: 60, r: 10, t: 10, b: 60 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#dbeafe', size: 11 },
                xaxis: { tickangle: -24 },
              }}
              config={{ displayModeBar: false, responsive: true }}
              className="h-full w-full"
              useResizeHandler
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </SectionShell>
      </div>
    </div>
  );
}
