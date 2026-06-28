'use client';

/**
 * ReportCharts — مكتبة مخططات موحّدة لجميع التقارير
 *
 * المخططات المتاحة:
 *  1. DonutChart          — دائري بثقب مركزي للتوزيعات
 *  2. VarianceBarChart    — أشرطة مزدوجة (مخطط vs فعلي)
 *  3. StackedBarChart     — أشرطة متراكمة
 *  4. HorizontalBarChart  — أشرطة أفقية للترتيب
 *  5. MultiLineChart      — خطوط متعددة للسلاسل الزمنية
 *  6. AreaTrendChart      — منطقة تدرجية للاتجاهات
 *  7. ChartEmpty          — حالة فراغ موحّدة
 */

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
  ComposedChart, Area,
} from 'recharts';

// ── لوحة الألوان ──────────────────────────────────────────────────────────────

export const C = {
  primary:  '#6366f1',
  success:  '#10b981',
  warning:  '#f59e0b',
  danger:   '#ef4444',
  info:     '#3b82f6',
  teal:     '#14b8a6',
  purple:   '#8b5cf6',
  orange:   '#f97316',
  neutral:  '#475569',
  // chart theme
  grid:     '#1e293b',
  axis:     '#94a3b8',
  axisLine: '#334155',
} as const;

export const PIE_COLORS: string[] = [
  C.primary, C.success, C.warning, C.danger,
  C.info, C.teal, C.purple, C.orange,
];

// ── أدوات مساعِدة ─────────────────────────────────────────────────────────────

/** تنسيق مضغوط للأرقام الكبيرة */
export const compactNum = (v: number): string =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}م`
  : v >= 1_000   ? `${(v / 1_000).toFixed(0)}ك`
  : v.toLocaleString('ar-LY', { maximumFractionDigits: 0 });

/** أنماط tooltip مشتركة */
const TS = {
  contentStyle: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 8, fontSize: 12,
  } as React.CSSProperties,
  labelStyle:  { color: '#e2e8f0', fontWeight: 600 } as React.CSSProperties,
  itemStyle:   { color: '#cbd5e1' } as React.CSSProperties,
};

const legendFmt = (v: string) => (
  <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>
);

// ── 1. DonutChart ─────────────────────────────────────────────────────────────

export interface DonutSlice {
  name:   string;
  value:  number;
  color?: string;
}

export function DonutChart({
  data,
  height = 260,
  unit   = '',
}: {
  data:    DonutSlice[];
  height?: number;
  unit?:   string;
}) {
  const d = data.filter(s => (s.value ?? 0) > 0);
  if (!d.length) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={d}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="42%"
          innerRadius="50%"
          outerRadius="72%"
          paddingAngle={3}
          animationBegin={0}
          animationDuration={700}
        >
          {d.map((s, i) => (
            <Cell
              key={i}
              fill={s.color ?? PIE_COLORS[i % PIE_COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TS.contentStyle}
          labelStyle={TS.labelStyle}
          itemStyle={TS.itemStyle}
          formatter={(v) => [
            `${compactNum(Number(v))}${unit ? ' ' + unit : ''}`,
            '',
          ]}
        />
        <Legend iconType="circle" iconSize={8} formatter={legendFmt} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 2. VarianceBarChart (مخطط vs فعلي) ────────────────────────────────────────

export interface VarianceRow {
  label:   string;
  planned: number;
  actual:  number;
}

export function VarianceBarChart({
  data,
  plannedLabel = 'مخطط',
  actualLabel  = 'فعلي',
  height  = 280,
  unit    = '',
  compact = false,
}: {
  data:           VarianceRow[];
  plannedLabel?:  string;
  actualLabel?:   string;
  height?:        number;
  unit?:          string;
  compact?:       boolean;
}) {
  if (!data.length) return <ChartEmpty />;
  const fmtV = compact
    ? compactNum
    : (v: number) => v.toLocaleString('ar-LY', { maximumFractionDigits: 0 });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 16, left: 8, bottom: 64 }}
        barCategoryGap="30%"
        barGap={4}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: C.axis, fontSize: 11 }}
          angle={-35}
          textAnchor="end"
          interval={0}
          tickLine={false}
          axisLine={{ stroke: C.axisLine }}
        />
        <YAxis
          tick={{ fill: C.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtV}
        />
        <Tooltip
          contentStyle={TS.contentStyle}
          labelStyle={TS.labelStyle}
          itemStyle={TS.itemStyle}
          formatter={(v, name) => [
            `${fmtV(Number(v))}${unit ? ' ' + unit : ''}`,
            String(name),
          ]}
        />
        <Legend formatter={legendFmt} iconSize={10} />
        <Bar
          dataKey="planned"
          name={plannedLabel}
          fill={C.neutral}
          radius={[4, 4, 0, 0]}
          animationDuration={700}
        />
        <Bar
          dataKey="actual"
          name={actualLabel}
          fill={C.primary}
          radius={[4, 4, 0, 0]}
          animationDuration={700}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 3. StackedBarChart ────────────────────────────────────────────────────────

export interface StackSeries {
  key:   string;
  label: string;
  color: string;
}

export function StackedBarChart({
  data,
  xKey,
  series,
  height  = 280,
  unit    = '',
  compact = false,
  angle   = true,
}: {
  data:     Record<string, number | string>[];
  xKey:     string;
  series:   StackSeries[];
  height?:  number;
  unit?:    string;
  compact?: boolean;
  angle?:   boolean;
}) {
  if (!data.length) return <ChartEmpty />;
  const fmtV = compact
    ? compactNum
    : (v: number) => v.toLocaleString('ar-LY', { maximumFractionDigits: 0 });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 16, left: 8, bottom: angle ? 64 : 24 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: C.axis, fontSize: 11 }}
          angle={angle ? -35 : 0}
          textAnchor={angle ? 'end' : 'middle'}
          interval={0}
          tickLine={false}
          axisLine={{ stroke: C.axisLine }}
        />
        <YAxis
          tick={{ fill: C.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtV}
        />
        <Tooltip
          contentStyle={TS.contentStyle}
          labelStyle={TS.labelStyle}
          itemStyle={TS.itemStyle}
          formatter={(v, name) => [
            `${fmtV(Number(v))}${unit ? ' ' + unit : ''}`,
            String(name),
          ]}
        />
        <Legend formatter={legendFmt} iconType="square" iconSize={10} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId="s"
            animationDuration={700}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 4. HorizontalBarChart (تصنيف أفقي) ────────────────────────────────────────

export interface HBarItem {
  label:  string;
  value:  number;
  color?: string;
}

export function HorizontalBarChart({
  data,
  height,
  unit    = '',
  compact = false,
}: {
  data:     HBarItem[];
  height?:  number;
  unit?:    string;
  compact?: boolean;
}) {
  if (!data.length) return <ChartEmpty />;
  const h = height ?? Math.max(180, data.length * 44);
  const fmtV = compact
    ? compactNum
    : (v: number) => v.toLocaleString('ar-LY', { maximumFractionDigits: 0 });

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 48, left: 90, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: C.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtV}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: C.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={85}
        />
        <Tooltip
          contentStyle={TS.contentStyle}
          labelStyle={TS.labelStyle}
          itemStyle={TS.itemStyle}
          formatter={(v) => [
            `${fmtV(Number(v))}${unit ? ' ' + unit : ''}`,
            '',
          ]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={700}>
          {data.map((e, i) => (
            <Cell
              key={i}
              fill={e.color ?? PIE_COLORS[i % PIE_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 5. MultiLineChart (سلاسل زمنية) ──────────────────────────────────────────

export interface LineSeries {
  key:   string;
  label: string;
  color: string;
}

export function MultiLineChart({
  data,
  xKey,
  series,
  height  = 260,
  unit    = '',
  compact = false,
}: {
  data:     Record<string, number | string>[];
  xKey:     string;
  series:   LineSeries[];
  height?:  number;
  unit?:    string;
  compact?: boolean;
}) {
  if (!data.length) return <ChartEmpty message="بيانات السلاسل الزمنية غير متاحة حالياً" />;
  const fmtV = compact
    ? compactNum
    : (v: number) => v.toLocaleString('ar-LY', { maximumFractionDigits: 0 });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: C.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: C.axisLine }}
        />
        <YAxis
          tick={{ fill: C.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtV}
        />
        <Tooltip
          contentStyle={TS.contentStyle}
          labelStyle={TS.labelStyle}
          itemStyle={TS.itemStyle}
          formatter={(v, name) => [
            `${fmtV(Number(v))}${unit ? ' ' + unit : ''}`,
            String(name),
          ]}
        />
        <Legend formatter={legendFmt} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2.5}
            dot={{ r: 4, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            animationDuration={700}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── 6. AreaTrendChart (منطقة مع تدرج) ────────────────────────────────────────

export interface AreaSeries {
  key:   string;
  label: string;
  color: string;
}

export function AreaTrendChart({
  data,
  xKey,
  series,
  height  = 240,
  unit    = '',
  compact = false,
}: {
  data:     Record<string, number | string>[];
  xKey:     string;
  series:   AreaSeries[];
  height?:  number;
  unit?:    string;
  compact?: boolean;
}) {
  if (!data.length) return <ChartEmpty message="بيانات الاتجاه غير متاحة" />;
  const fmtV = compact
    ? compactNum
    : (v: number) => v.toLocaleString('ar-LY', { maximumFractionDigits: 0 });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`ag-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={s.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0}   />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: C.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: C.axisLine }}
        />
        <YAxis
          tick={{ fill: C.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtV}
        />
        <Tooltip
          contentStyle={TS.contentStyle}
          labelStyle={TS.labelStyle}
          itemStyle={TS.itemStyle}
          formatter={(v, name) => [
            `${fmtV(Number(v))}${unit ? ' ' + unit : ''}`,
            String(name),
          ]}
        />
        <Legend formatter={legendFmt} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2.5}
            fill={`url(#ag-${s.key})`}
            dot={{ r: 4, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            animationDuration={700}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── 7. ChartEmpty ─────────────────────────────────────────────────────────────

export function ChartEmpty({
  message = 'لا توجد بيانات كافية لعرض المخطط',
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-500">
      <svg
        viewBox="0 0 24 24"
        className="w-10 h-10 mb-3 opacity-25"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}
