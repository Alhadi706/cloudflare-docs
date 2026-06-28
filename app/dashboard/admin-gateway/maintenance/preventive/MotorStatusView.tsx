'use client';

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, CheckCircle, XCircle, Clock, Zap, Droplets } from 'lucide-react';

/* ─── Generic engine shape ──────────────────────────────────────────────────── */
type MV = number | string | null;
const n = (v: MV, d = 0): number => { const x = +String(v ?? ''); return isNaN(x) ? d : x; };

interface EngineReading { [key: string]: unknown }
interface EngineOutput { filename: string; sheetName: string; readings: EngineReading[]; issues?: string[] }

export interface MotorStatusViewProps {
  engine1: EngineOutput | null;  // Well Fields & Pump Stations
  engine3: EngineOutput | null;  // Central Branch (Tarhunah)
  engine4: EngineOutput | null;  // TAZ pump stations
}

/* ─── Colours ───────────────────────────────────────────────────────────────── */
const C = {
  bg:     '#020617',
  card:   '#0c1523',
  border: '#1e293b',
  ok:     '#22c55e',
  warn:   '#f59e0b',
  err:    '#ef4444',
  idle:   '#475569',
  cyan:   '#22d3ee',
};

/* ─── Helper to compute daily pump series from readings ─────────────────────── */
function dailySeries(readings: EngineReading[], getCount: (r: EngineReading) => number) {
  return readings.map((r, i) => ({
    day: n((r as any).dayNo, i + 1),
    pumps: getCount(r),
  }));
}

function avgActive(series: { pumps: number }[]): number {
  const active = series.filter(d => d.pumps > 0);
  if (!active.length) return 0;
  return active.reduce((s, d) => s + d.pumps, 0) / active.length;
}

function daysRunning(series: { pumps: number }[]): number {
  return series.filter(d => d.pumps > 0).length;
}

/* ─── Small chart for one station ───────────────────────────────────────────── */
function PumpChart({ series, color }: { series: { day: number; pumps: number }[]; color: string }) {
  if (!series.length) return null;
  return (
    <ResponsiveContainer width="100%" height={60}>
      <BarChart data={series} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="day" hide />
        <YAxis hide domain={[0, 'auto']} />
        <Tooltip
          contentStyle={{ background: C.card, border: `1px solid ${C.border}`, fontSize: 11 }}
          formatter={(v: number) => [v, 'مضخات عاملة']}
          labelFormatter={(d: number) => `يوم ${d}`}
        />
        <Bar dataKey="pumps" radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {series.map((d, i) => (
            <Cell key={i} fill={d.pumps > 0 ? color : C.err + '88'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─── Station card ──────────────────────────────────────────────────────────── */
interface StationCardProps {
  name: string;
  nameEn?: string;
  currentPumps: number;
  avgPumps: number;
  daysOn: number;
  totalDays: number;
  opHours?: number | null;
  flow?: number | null;
  pressure?: number | null;
  series: { day: number; pumps: number }[];
  chartColor?: string;
}

function StationCard({
  name, nameEn, currentPumps, avgPumps, daysOn, totalDays,
  opHours, flow, pressure, series, chartColor = C.ok,
}: StationCardProps) {
  const isRunning = currentPumps > 0;
  const uptime = totalDays > 0 ? Math.round((daysOn / totalDays) * 100) : 0;

  return (
    <div
      style={{
        background: C.card,
        borderColor: isRunning ? C.ok + '55' : C.err + '55',
        borderWidth: 1,
        borderStyle: 'solid',
      }}
      className="rounded-xl p-4 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-sm text-white leading-tight">{name}</div>
          {nameEn && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{nameEn}</div>}
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
          isRunning ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        }`}>
          {isRunning
            ? <><CheckCircle className="w-3.5 h-3.5" /> شغّالة</>
            : <><XCircle className="w-3.5 h-3.5" /> متوقفة</>
          }
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label="المضخات الآن" value={currentPumps > 0 ? currentPumps : '—'} unit="مضخة" color={isRunning ? C.ok : C.err} />
        <Metric label="متوسط شهري" value={avgPumps > 0 ? avgPumps.toFixed(1) : '—'} unit="مضخة/يوم" color={C.cyan} />
        <Metric label="أيام التشغيل" value={daysOn} unit={`/ ${totalDays}`} color={uptime >= 70 ? C.ok : uptime >= 40 ? C.warn : C.err} />
      </div>

      {/* Optional metrics */}
      {(opHours != null || flow != null || pressure != null) && (
        <div className="grid grid-cols-3 gap-2">
          {opHours != null && <Metric label="ساعات التشغيل" value={opHours > 0 ? opHours.toFixed(0) : '—'} unit="ساعة" color={C.cyan} icon={Clock} />}
          {flow != null && <Metric label="معدل الضخ" value={flow > 0 ? flow.toLocaleString('en') : '—'} unit="م³" color="#818cf8" icon={Droplets} />}
          {pressure != null && <Metric label="ضغط الخروج" value={pressure > 0 ? pressure.toFixed(1) : '—'} unit="bar" color={C.warn} icon={Zap} />}
        </div>
      )}

      {/* Uptime bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>نسبة التشغيل</span>
          <span>{uptime}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            style={{ width: `${uptime}%`, background: uptime >= 70 ? C.ok : uptime >= 40 ? C.warn : C.err }}
            className="h-full rounded-full transition-all"
          />
        </div>
      </div>

      {/* Mini chart */}
      {series.length > 0 && <PumpChart series={series} color={chartColor} />}
    </div>
  );
}

function Metric({ label, value, unit, color, icon: Icon }:
  { label: string; value: string | number; unit: string; color: string; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        {Icon && <Icon style={{ color }} className="w-3 h-3" />}
        <span className="text-[9px] text-slate-500 uppercase tracking-wide leading-tight">{label}</span>
      </div>
      <span style={{ color }} className="text-base font-bold font-mono leading-none">{value}</span>
      <span className="text-[9px] text-slate-600">{unit}</span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */
export default function MotorStatusView({ engine1, engine3, engine4 }: MotorStatusViewProps) {

  const stations = useMemo(() => {
    const list: StationCardProps[] = [];

    /* ── Well Fields (E1): EJH, NEJH-S, NEJH-N ──────────────────────────── */
    if (engine1?.readings?.length) {
      const r1 = engine1.readings as any[];
      const last = r1[r1.length - 1];

      const groups = [
        { key: 'ejh',   nameAr: 'محطة الجبل الغربي',    nameEn: 'EJH',    color: '#34d399' },
        { key: 'nejhS', nameAr: 'محطة الجبل الغربي (جنوب)', nameEn: 'NEJH-S', color: '#60a5fa' },
        { key: 'nejhN', nameAr: 'محطة الجبل الغربي (شمال)', nameEn: 'NEJH-N', color: '#a78bfa' },
      ];

      for (const g of groups) {
        const series = dailySeries(r1, r => n((r as any)[g.key]?.operatingPumps, 0));
        const lastGroup = last?.[g.key] || {};
        list.push({
          name: g.nameAr,
          nameEn: g.nameEn,
          currentPumps: n(lastGroup.operatingPumps, 0),
          avgPumps: avgActive(series),
          daysOn: daysRunning(series),
          totalDays: r1.length,
          flow: n(lastGroup.wellFieldDailyFlow, 0) || null,
          pressure: n(lastGroup.outletPressure, 0) || null,
          series,
          chartColor: g.color,
        });
      }
    }

    /* ── Central Branch (E3): Tarhunah PS ───────────────────────────────── */
    if (engine3?.readings?.length) {
      const r3 = engine3.readings as any[];
      const last3 = r3[r3.length - 1];
      const series = dailySeries(r3, r => n((r as any).tarhunah?.noPumps, 0));
      list.push({
        name: 'محطة ترهونة',
        nameEn: 'Tarhunah PS',
        currentPumps: n(last3?.tarhunah?.noPumps, 0),
        avgPumps: avgActive(series),
        daysOn: daysRunning(series),
        totalDays: r3.length,
        pressure: n(last3?.tarhunah?.outletPressure, 0) || null,
        flow: n(last3?.tarhunah?.totalFlow, 0) || null,
        series,
        chartColor: '#fb923c',
      });
    }

    /* ── TAZ (E4): PS1, PS2 ──────────────────────────────────────────────── */
    if (engine4?.readings?.length) {
      const r4 = engine4.readings as any[];
      const last4 = r4[r4.length - 1];

      const ps = [
        { key: 'ps1', nameAr: 'محطة الضخ 1', nameEn: 'TAZ PS-1', flowKey: 'pumpingVolume',  color: '#f472b6' },
        { key: 'ps2', nameAr: 'محطة الضخ 2', nameEn: 'TAZ PS-2', flowKey: 'pumpingToTank',  color: '#38bdf8' },
      ];

      for (const p of ps) {
        const series = dailySeries(r4, r => n((r as any)[p.key]?.activePumpNo, 0));
        const lastPs = last4?.[p.key] || {};
        list.push({
          name: p.nameAr,
          nameEn: p.nameEn,
          currentPumps: n(lastPs.activePumpNo, 0),
          avgPumps: avgActive(series),
          daysOn: daysRunning(series),
          totalDays: r4.length,
          opHours: n(lastPs.totalOperationHours, 0) || null,
          flow: n(lastPs[p.flowKey], 0) || null,
          pressure: n(lastPs.outletPressure, 0) || null,
          series,
          chartColor: p.color,
        });
      }
    }

    return list;
  }, [engine1, engine3, engine4]);

  /* ── Summary KPIs ──────────────────────────────────────────────────────── */
  const totalStations = stations.length;
  const runningCount  = stations.filter(s => s.currentPumps > 0).length;
  const stoppedCount  = totalStations - runningCount;
  const totalPumps    = stations.reduce((s, x) => s + x.currentPumps, 0);
  const avgUptime     = totalStations > 0
    ? Math.round(stations.reduce((s, x) => s + (x.totalDays > 0 ? (x.daysOn / x.totalDays) * 100 : 0), 0) / totalStations)
    : 0;

  if (!engine1 && !engine3 && !engine4) {
    return (
      <div
        style={{ background: C.bg }}
        className="min-h-[400px] flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-800 text-slate-500"
      >
        <Activity className="w-12 h-12 opacity-30" />
        <div className="text-center">
          <div className="font-bold text-slate-400">لا توجد بيانات محركات</div>
          <div className="text-sm mt-1">حمّل ملف Excel الشهري لعرض حالة المحركات</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg }} className="space-y-6 p-1" dir="rtl">

      {/* ── Summary banner ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumCard label="المحطات الشغّالة"   value={runningCount}  total={totalStations} color={C.ok}  icon={CheckCircle} />
        <SumCard label="المحطات المتوقفة"   value={stoppedCount}  total={totalStations} color={C.err} icon={XCircle} />
        <SumCard label="إجمالي المضخات العاملة" value={totalPumps} color={C.cyan}        icon={Zap} />
        <SumCard label="متوسط نسبة التشغيل" value={`${avgUptime}%`} color={avgUptime >= 70 ? C.ok : avgUptime >= 40 ? C.warn : C.err} icon={Clock} />
      </div>

      {/* ── Station grid ─────────────────────────────────────────────────── */}
      {stations.length === 0 ? (
        <div className="text-center text-slate-500 py-12">
          تعذّر استخراج بيانات المحطات من المحركات
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((s, i) => <StationCard key={i} {...s} />)}
        </div>
      )}
    </div>
  );
}

function SumCard({ label, value, total, color, icon: Icon }:
  { label: string; value: string | number; total?: number; color: string; icon: React.ElementType }) {
  return (
    <div style={{ background: C.card, borderColor: color + '44', borderWidth: 1, borderStyle: 'solid' }}
      className="rounded-xl p-4 flex flex-col gap-2">
      <Icon style={{ color }} className="w-5 h-5" />
      <div style={{ color }} className="text-2xl font-bold font-mono leading-none">
        {value}{total != null && <span className="text-slate-500 text-sm font-normal"> / {total}</span>}
      </div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}
