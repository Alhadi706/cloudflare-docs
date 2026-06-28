'use client';

/**
 * Production Schedule — جدولة الإنتاج
 * الإنتاج اليومي/الأسبوعي، موازنة الخزانات، تنبؤ الطلب، NRW
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { BarChart3, Droplets, TrendingUp, TrendingDown, Calendar, Target, RefreshCw, Zap } from 'lucide-react';

/* ─── types ─────────────────────────────────────────────────────────────────── */
interface DayRecord {
  date: string;
  day_ar: string;
  produced_m3: number;
  distributed_m3: number;
  target_m3: number;
  tank_avg_pct: number;
}

interface SourceAllocation {
  source: string;
  allocated_m3: number;
  actual_m3: number;
  efficiency_pct: number;
  power_kw?: number;
}

/* ─── mock data ─────────────────────────────────────────────────────────────── */
const WEEK_DATA: DayRecord[] = [
  { date: '2026-06-05', day_ar: 'الخميس',  produced_m3: 188000, distributed_m3: 176000, target_m3: 185000, tank_avg_pct: 74 },
  { date: '2026-06-06', day_ar: 'الجمعة',  produced_m3: 172000, distributed_m3: 168000, target_m3: 175000, tank_avg_pct: 76 },
  { date: '2026-06-07', day_ar: 'السبت',   produced_m3: 165000, distributed_m3: 162000, target_m3: 170000, tank_avg_pct: 79 },
  { date: '2026-06-08', day_ar: 'الأحد',   produced_m3: 190000, distributed_m3: 182000, target_m3: 185000, tank_avg_pct: 71 },
  { date: '2026-06-09', day_ar: 'الاثنين', produced_m3: 195000, distributed_m3: 187000, target_m3: 185000, tank_avg_pct: 68 },
  { date: '2026-06-10', day_ar: 'الثلاثاء',produced_m3: 183000, distributed_m3: 178000, target_m3: 185000, tank_avg_pct: 72 },
  { date: '2026-06-11', day_ar: 'الأربعاء',produced_m3: 185000, distributed_m3: 174000, target_m3: 185000, tank_avg_pct: 75 },
];

const SOURCES: SourceAllocation[] = [
  { source: 'حقل نجح الشمالي', allocated_m3: 45000, actual_m3: 42000, efficiency_pct: 93.3 },
  { source: 'حقل نجح الجنوبي', allocated_m3: 40000, actual_m3: 38500, efficiency_pct: 96.3 },
  { source: 'حقل الحيرة',       allocated_m3: 35000, actual_m3: 31000, efficiency_pct: 88.6 },
  { source: 'محطة المطار',       allocated_m3: 30000, actual_m3: 28000, efficiency_pct: 93.3 },
  { source: 'محطة ترهونة',       allocated_m3: 25000, actual_m3: 22500, efficiency_pct: 90.0 },
  { source: 'محطة الرفع PS-1',  allocated_m3: 20000, actual_m3: 18000, efficiency_pct: 90.0 },
];

const HOURLY_DEMAND: { hour: string; actual: number; forecast: number }[] = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0');
  const base = 7000 + Math.sin(((i - 6) / 24) * Math.PI * 2) * 3500;
  return { hour: `${h}:00`, actual: Math.round(base + (Math.random() - 0.5) * 600), forecast: Math.round(base) };
});

const C = { card: '#0b1623', border: '#1e293b', cyan: '#22d3ee', blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444' };

/* ─── KPI ─────────────────────────────────────────────────────────────────── */
function Kpi({ label, value, unit, icon: Icon, color, sub }:
  { label: string; value: string; unit: string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div style={{ background: C.card, borderColor: C.border }} className="border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</span>
        <Icon style={{ color }} className="w-4 h-4" />
      </div>
      <p style={{ color }} className="text-2xl font-bold font-mono">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{unit}{sub ? ` — ${sub}` : ''}</p>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function ProductionSchedulePage() {
  const [weekData,  setWeekData]  = useState<DayRecord[]>(WEEK_DATA);
  const [sources,   setSources]   = useState<SourceAllocation[]>(SOURCES);
  const [source,    setSource]    = useState<'mock' | 'live'>('mock');
  const [loading,   setLoading]   = useState(false);
  const [viewMode, setViewMode]   = useState<'daily' | 'hourly'>('daily');

  const DAY_NAMES: Record<string, string> = {
    '0': 'الأحد', '1': 'الاثنين', '2': 'الثلاثاء', '3': 'الأربعاء',
    '4': 'الخميس', '5': 'الجمعة', '6': 'السبت',
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/control-center/production?days=7');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.has_data && data.daily_summary?.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: DayRecord[] = data.daily_summary.map((d: any) => {
            const dt = new Date(d.reading_date);
            const dayName = DAY_NAMES[dt.getDay().toString()] ?? d.reading_date;
            const flow = Number(d.total_flow_m3) || 0;
            const target = flow * 1.05; // 5% above actual as target baseline
            const distrib = flow * 0.85; // ~85% distribution ratio
            return {
              date: d.reading_date,
              day_ar: dayName,
              produced_m3: Math.round(flow),
              distributed_m3: Math.round(distrib),
              target_m3: Math.round(target),
              tank_avg_pct: 65,
            };
          });
          setWeekData(mapped);

          if (data.latest_sources?.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mappedSrc: SourceAllocation[] = data.latest_sources.map((s: any) => {
              const actual = Number(s.flow_m3) || 0;
              const allocated = actual * 1.1;
              const eff = allocated > 0 ? Math.min(100, (actual / allocated) * 100) : 0;
              return {
                source:         s.name_ar as string,
                allocated_m3:   Math.round(allocated),
                actual_m3:      Math.round(actual),
                efficiency_pct: parseFloat(eff.toFixed(1)),
                power_kw:       Number(s.power_kw) || 0,
              };
            });
            setSources(mappedSrc);
          }
          setSource('live');
          setLoading(false);
          return;
        }
      }
    } catch { /* fallback */ }
    setWeekData(WEEK_DATA);
    setSources(SOURCES);
    setSource('mock');
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = weekData[weekData.length - 1];
  const totalProduced = weekData.reduce((s, d) => s + d.produced_m3, 0);
  const totalDistributed = weekData.reduce((s, d) => s + d.distributed_m3, 0);
  const nrwPct = (((totalProduced - totalDistributed) / totalProduced) * 100).toFixed(1);
  const efficiencyVsTarget = (((today.produced_m3 - today.target_m3) / today.target_m3) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">جدولة الإنتاج</h1>
            <p className="text-xs text-slate-500">إنتاج وتوزيع المياه — أسبوع {weekData[0].date} إلى {today.date}</p>
          </div>
          <div className="mr-auto flex items-center gap-2">
            {source === 'live' ? (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">بيانات حقيقية</span>
            ) : (
              <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">بيانات تجريبية</span>
            )}
            <button onClick={loadData} disabled={loading} className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Kpi label="إنتاج اليوم" value={(today.produced_m3 / 1000).toFixed(0)} unit="ألف م³" icon={Droplets} color={C.cyan} sub={`هدف: ${(today.target_m3 / 1000).toFixed(0)}k`} />
          <Kpi label="الأداء vs الهدف" value={`${parseFloat(efficiencyVsTarget) >= 0 ? '+' : ''}${efficiencyVsTarget}`} unit="%" icon={parseFloat(efficiencyVsTarget) >= 0 ? TrendingUp : TrendingDown} color={parseFloat(efficiencyVsTarget) >= 0 ? C.green : C.amber} />
          <Kpi label="الفاقد (NRW) أسبوعي" value={nrwPct} unit="%" icon={Target} color={parseFloat(nrwPct) > 20 ? C.red : parseFloat(nrwPct) > 15 ? C.amber : C.green} sub="معيار IWA < 15%" />
          <Kpi label="متوسط الخزانات" value={`${today.tank_avg_pct}`} unit="%" icon={Calendar} color={today.tank_avg_pct < 50 ? C.red : today.tank_avg_pct < 65 ? C.amber : C.green} />
        </div>

        {/* ── View toggle ── */}
        <div className="flex gap-2">
          {(['daily', 'hourly'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === m ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {m === 'daily' ? 'يومي (7 أيام)' : 'بالساعة (24 ساعة)'}
            </button>
          ))}
        </div>

        {/* ── Main chart ── */}
        {viewMode === 'daily' ? (
          <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-4">الإنتاج والتوزيع (م³)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="day_ar" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <ReferenceLine y={185000} stroke={C.amber} strokeDasharray="4 2" label={{ value: 'الهدف', fill: C.amber, fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: '#0f1f2e', border: `1px solid ${C.border}`, borderRadius: 8 }}
                  formatter={(v: number, name: string) => [
                    `${v.toLocaleString()} م³`,
                    name === 'produced_m3' ? 'الإنتاج' : 'التوزيع'
                  ]}
                />
                <Legend formatter={v => v === 'produced_m3' ? 'الإنتاج' : 'التوزيع'} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="produced_m3"    fill={C.cyan}  radius={[4,4,0,0]} />
                <Bar dataKey="distributed_m3" fill={C.blue}  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-4">منحنى الطلب — اليوم (م³/ساعة)</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={HOURLY_DEMAND} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} interval={3} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#0f1f2e', border: `1px solid ${C.border}`, borderRadius: 8 }}
                  formatter={(v: number, name: string) => [`${v.toLocaleString()} م³`, name === 'actual' ? 'الفعلي' : 'التوقع']}
                />
                <Legend formatter={v => v === 'actual' ? 'الفعلي' : 'التوقع'} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="actual"   stroke={C.cyan}  strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="forecast" stroke={C.blue}  strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Source allocation ── */}
        <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-800">
            <Droplets className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-semibold">تخصيص وأداء مصادر المياه — اليوم</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/60 text-[10px] text-slate-400 uppercase tracking-wide">
                  <th className="text-right p-3">المصدر</th>
                  <th className="text-right p-3">المخصص (م³)</th>
                  <th className="text-right p-3">الفعلي (م³)</th>
                  <th className="text-right p-3">الكفاءة</th>
                  <th className="text-right p-3">الطاقة (كيلوواط)</th>
                  <th className="text-right p-3">الفجوة</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const gap = s.actual_m3 - s.allocated_m3;
                  return (
                    <tr key={s.source} className="border-t border-slate-800/50 hover:bg-slate-900/30">
                      <td className="p-3 text-slate-200 font-medium">{s.source}</td>
                      <td className="p-3 font-mono text-slate-300">{s.allocated_m3.toLocaleString()}</td>
                      <td className="p-3 font-mono text-slate-200">{s.actual_m3.toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-[60px]">
                            <div
                              className={`h-full rounded-full ${s.efficiency_pct >= 95 ? 'bg-emerald-500' : s.efficiency_pct >= 85 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${s.efficiency_pct}%` }}
                            />
                          </div>
                          <span className={`font-mono text-xs font-bold ${s.efficiency_pct >= 95 ? 'text-emerald-400' : s.efficiency_pct >= 85 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {s.efficiency_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-400">
                        {s.power_kw ? (
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-400" />
                            {s.power_kw.toLocaleString()}
                          </span>
                        ) : '—'}
                      </td>
                      <td className={`p-3 font-mono text-sm font-bold ${gap >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {gap >= 0 ? '+' : ''}{gap.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-900/40 text-xs">
                  <td className="p-3 font-bold text-slate-300">الإجمالي</td>
                  <td className="p-3 font-mono font-bold text-slate-300">
                    {sources.reduce((s, r) => s + r.allocated_m3, 0).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono font-bold text-cyan-300">
                    {sources.reduce((s, r) => s + r.actual_m3, 0).toLocaleString()}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── NRW indicator ── */}
        <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">تحليل الفاقد الأسبوعي (NRW)</p>
            <span className="text-xs text-slate-500">معيار IWA المقبول: &lt; 15%</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 mb-1">إجمالي الإنتاج</p>
              <p className="text-xl font-bold text-cyan-400 font-mono">{(totalProduced / 1000).toFixed(0)}k</p>
              <p className="text-[10px] text-slate-500">م³</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 mb-1">إجمالي التوزيع</p>
              <p className="text-xl font-bold text-blue-400 font-mono">{(totalDistributed / 1000).toFixed(0)}k</p>
              <p className="text-[10px] text-slate-500">م³</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 mb-1">الفاقد NRW</p>
              <p className={`text-xl font-bold font-mono ${parseFloat(nrwPct) > 20 ? 'text-rose-400' : parseFloat(nrwPct) > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {nrwPct}%
              </p>
              <p className={`text-[10px] ${parseFloat(nrwPct) > 15 ? 'text-amber-500' : 'text-slate-500'}`}>
                {parseFloat(nrwPct) > 15 ? 'يتجاوز الحد المقبول' : 'ضمن الحد المقبول'}
              </p>
            </div>
          </div>
          <div className="mt-4 h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${parseFloat(nrwPct) > 20 ? 'bg-rose-500' : parseFloat(nrwPct) > 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, parseFloat(nrwPct) * 3)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-600 mt-1">
            <span>0%</span>
            <span className="text-amber-600">15% (حد IWA)</span>
            <span>33%+</span>
          </div>
        </div>

      </div>
    </div>
  );
}
