'use client';

/**
 * Pressure Zones Management — إدارة مناطق الضغط
 * تحليل مناطق الضغط، صمامات PRV، تنبيهات الانحراف عن النطاق المقبول
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Gauge, AlertTriangle, CheckCircle, Settings, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';

/* ─── types ─────────────────────────────────────────────────────────────────── */
interface PressureZone {
  id: string;
  name_ar: string;
  zone_type: 'high' | 'medium' | 'low';
  target_bar: number;
  current_bar: number;
  min_acceptable: number;
  max_acceptable: number;
  prv_count: number;
  prv_active: number;
  coverage_km: number;
  population_k: number;
}

interface PRVRecord {
  id: string;
  location_ar: string;
  zone_id: string;
  inlet_bar: number;
  outlet_bar: number;
  setpoint_bar: number;
  status: 'open' | 'partial' | 'closed' | 'fault';
  last_inspection: string;
}

/* ─── mock ─────────────────────────────────────────────────────────────────── */
const ZONES: PressureZone[] = [
  { id: 'Z1', name_ar: 'منطقة الضغط العالي — الشمال',    zone_type: 'high',   target_bar: 7.0, current_bar: 7.2, min_acceptable: 6.0, max_acceptable: 8.0, prv_count: 4, prv_active: 4, coverage_km: 120, population_k: 180 },
  { id: 'Z2', name_ar: 'منطقة الضغط المتوسط — المركز',   zone_type: 'medium', target_bar: 5.5, current_bar: 5.8, min_acceptable: 4.5, max_acceptable: 6.5, prv_count: 6, prv_active: 5, coverage_km: 280, population_k: 340 },
  { id: 'Z3', name_ar: 'منطقة الضغط المنخفض — الجنوب',  zone_type: 'low',    target_bar: 4.0, current_bar: 3.6, min_acceptable: 3.0, max_acceptable: 5.0, prv_count: 3, prv_active: 3, coverage_km: 450, population_k: 120 },
  { id: 'Z4', name_ar: 'منطقة محطة المطار',               zone_type: 'high',   target_bar: 6.5, current_bar: 6.8, min_acceptable: 5.5, max_acceptable: 7.5, prv_count: 2, prv_active: 2, coverage_km: 85,  population_k: 95  },
  { id: 'Z5', name_ar: 'منطقة ترهونة',                    zone_type: 'medium', target_bar: 5.0, current_bar: 4.9, min_acceptable: 4.0, max_acceptable: 6.0, prv_count: 3, prv_active: 3, coverage_km: 160, population_k: 210 },
  { id: 'Z6', name_ar: 'منطقة الشويرف',                  zone_type: 'low',    target_bar: 3.5, current_bar: 3.2, min_acceptable: 2.5, max_acceptable: 4.5, prv_count: 2, prv_active: 2, coverage_km: 320, population_k: 85  },
];

const PRVS: PRVRecord[] = [
  { id: 'PRV-001', location_ar: 'تقاطع نجح الشمالي',  zone_id: 'Z1', inlet_bar: 9.2, outlet_bar: 7.1, setpoint_bar: 7.0, status: 'open',    last_inspection: '2026-06-01' },
  { id: 'PRV-002', location_ar: 'المخرج الرئيسي Z2',  zone_id: 'Z2', inlet_bar: 8.5, outlet_bar: 5.8, setpoint_bar: 5.5, status: 'partial', last_inspection: '2026-05-28' },
  { id: 'PRV-003', location_ar: 'خط ترهونة الجنوبي',  zone_id: 'Z3', inlet_bar: 6.1, outlet_bar: 3.6, setpoint_bar: 4.0, status: 'open',    last_inspection: '2026-06-03' },
  { id: 'PRV-004', location_ar: 'محطة المطار مدخل',   zone_id: 'Z4', inlet_bar: 8.8, outlet_bar: 6.8, setpoint_bar: 6.5, status: 'open',    last_inspection: '2026-06-05' },
  { id: 'PRV-005', location_ar: 'منطقة الشويرف',      zone_id: 'Z6', inlet_bar: 5.5, outlet_bar: 3.2, setpoint_bar: 3.5, status: 'partial', last_inspection: '2026-05-15' },
  { id: 'PRV-006', location_ar: 'توصيلة عرضية',       zone_id: 'Z2', inlet_bar: 7.2, outlet_bar: 5.6, setpoint_bar: 5.5, status: 'fault',   last_inspection: '2026-04-20' },
];

/* ─── helpers ───────────────────────────────────────────────────────────────── */
const zoneStatus = (z: PressureZone): 'ok' | 'warning' | 'critical' => {
  const diff = Math.abs(z.current_bar - z.target_bar);
  if (z.current_bar < z.min_acceptable || z.current_bar > z.max_acceptable) return 'critical';
  if (diff > 0.5) return 'warning';
  return 'ok';
};

const statusColors = {
  ok:       { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', label: 'ضمن النطاق' },
  warning:  { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   label: 'انحراف خفيف' },
  critical: { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/25',    label: 'خارج النطاق' },
};

const prvStatusColors = {
  open:    { text: 'text-emerald-400', label: 'مفتوح' },
  partial: { text: 'text-amber-400',   label: 'جزئي' },
  closed:  { text: 'text-slate-400',   label: 'مغلق' },
  fault:   { text: 'text-rose-400',    label: 'عطل' },
};

const C = { card: '#0b1623', border: '#1e293b' };

/* ─── Component ─────────────────────────────────────────────────────────────── */
export default function PressureZonesPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [zones,  setZones]   = useState<PressureZone[]>(ZONES);
  const [prvs,   setPrvs]    = useState<PRVRecord[]>(PRVS);
  const [source, setSource]  = useState<'mock' | 'live'>('mock');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/control-center/pressure-zones');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.has_data && data.zones?.length > 0) {
          const zoneLabels: Record<string, string> = {
            A: 'حقول نجح والحيرة — المنطقة A',
            B: 'الخط الرئيسي — المنطقة B',
            C: 'ترهونة وسيدي سعيد — المنطقة C',
            D: 'محطات TAZ وغريان — المنطقة D',
            E: 'الفرع الشرقي — المنطقة E',
          };
          const zoneTypes: Record<string, PressureZone['zone_type']> = {
            A: 'high', B: 'high', C: 'medium', D: 'medium', E: 'low',
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: PressureZone[] = data.zones.map((z: any) => ({
            id: z.zone as string,
            name_ar: zoneLabels[z.zone as string] || `منطقة ${z.zone}`,
            zone_type: zoneTypes[z.zone as string] ?? 'medium',
            target_bar: 5.5,
            current_bar: Number(z.avg_pressure) || 0,
            min_acceptable: 3.5,
            max_acceptable: 7.5,
            prv_count:    z.stations?.length ?? 0,
            prv_active:   z.stations?.filter((s: any) => s.pumps_running > 0).length ?? 0,
            coverage_km:  0,
            population_k: 0,
          }));
          setZones(mapped);
          setSource('live');
          setLoading(false);
          return;
        }
      }
    } catch { /* fallback to mock */ }
    setZones(ZONES);
    setPrvs(PRVS);
    setSource('mock');
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const displayZones = zones;
  const displayPrvs  = prvs;

  const radarData = displayZones.map(z => ({
    zone: z.name_ar.split('—')[0].trim(),
    ضغط_حالي: z.current_bar,
    هدف: z.target_bar,
  }));

  const barData = displayZones.map(z => ({
    name: z.name_ar.split('—')[0].trim(),
    actual: z.current_bar,
    target: z.target_bar,
    status: zoneStatus(z),
  }));

  const filteredPRVs = selectedZone
    ? displayPrvs.filter(p => p.zone_id === selectedZone)
    : displayPrvs;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">مناطق الضغط</h1>
            <p className="text-xs text-slate-500">إدارة ضغط الشبكة — مناطق DMA، صمامات PRV، مراقبة الانحراف</p>
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

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div style={{ background: C.card, borderColor: C.border }} className="border rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">مناطق مراقبة</p>
            <p className="text-2xl font-bold text-blue-400 font-mono">{displayZones.length}</p>
          </div>
          <div style={{ background: C.card, borderColor: C.border }} className="border rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">ضمن النطاق</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono">
              {displayZones.filter(z => zoneStatus(z) === 'ok').length}
            </p>
          </div>
          <div style={{ background: C.card, borderColor: C.border }} className="border rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">صمامات PRV</p>
            <p className="text-2xl font-bold text-cyan-400 font-mono">
              {displayPrvs.filter(p => p.status === 'open' || p.status === 'partial').length}/{displayPrvs.length}
            </p>
          </div>
          <div style={{ background: C.card, borderColor: C.border }} className="border rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">أعطال PRV</p>
            <p className="text-2xl font-bold text-rose-400 font-mono">
              {displayPrvs.filter(p => p.status === 'fault').length}
            </p>
          </div>
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pressure bar chart */}
          <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-4">الضغط الحالي مقابل الهدف (بار)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -15, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 8 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={[0, 10]} />
                <Tooltip
                  contentStyle={{ background: '#0f1f2e', border: `1px solid ${C.border}`, borderRadius: 8 }}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)} بار`, name === 'actual' ? 'الحالي' : 'الهدف']}
                />
                <Bar dataKey="actual" radius={[3, 3, 0, 0]} name="actual">
                  {barData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.status === 'ok' ? '#22c55e' : entry.status === 'warning' ? '#f59e0b' : '#ef4444'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="target" radius={[3, 3, 0, 0]} fill="#1e293b" name="target" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar chart */}
          <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-4">توازن الضغط بين المناطق</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="zone" tick={{ fill: '#64748b', fontSize: 9 }} />
                <Radar name="ضغط حالي" dataKey="ضغط_حالي" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} />
                <Radar name="الهدف"    dataKey="هدف"       stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Zone cards ── */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">
            مناطق الشبكة ({displayZones.length}) — انقر للتصفية
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayZones.map((z) => {
              const st = zoneStatus(z);
              const sc = statusColors[st];
              const deviation = z.current_bar - z.target_bar;
              const isSelected = selectedZone === z.id;
              return (
                <button
                  key={z.id}
                  onClick={() => setSelectedZone(isSelected ? null : z.id)}
                  className={`text-right p-4 rounded-xl border ${sc.border} ${sc.bg}
                    ${isSelected ? 'ring-2 ring-offset-1 ring-offset-slate-950 ring-blue-500' : ''}
                    hover:scale-[1.01] transition-all`}
                  style={{ background: C.card }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-100 leading-tight">{z.name_ar}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mt-3">
                    <div>
                      <p className="text-[10px] text-slate-500">حالي</p>
                      <p className={`font-mono font-bold text-lg ${sc.text}`}>{z.current_bar.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">هدف</p>
                      <p className="font-mono font-bold text-lg text-slate-300">{z.target_bar.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">انحراف</p>
                      <p className={`font-mono font-bold text-lg flex items-center justify-center gap-0.5 ${deviation >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                        {deviation >= 0
                          ? <TrendingUp className="w-3 h-3" />
                          : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(deviation).toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500">
                    <span>PRV: {z.prv_active}/{z.prv_count}</span>
                    <span>{z.coverage_km} كم</span>
                    <span>{z.population_k}k نسمة</span>
                  </div>
                  {/* Pressure bar indicator */}
                  <div className="mt-3">
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          st === 'ok' ? 'bg-emerald-500' : st === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, (z.current_bar / z.max_acceptable) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                      <span>{z.min_acceptable} بار</span>
                      <span>{z.max_acceptable} بار</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── PRV Table ── */}
        <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              <p className="text-sm font-semibold">
                صمامات التقليل PRV
                {selectedZone && <span className="text-xs text-slate-500 mr-2">(تصفية: {selectedZone})</span>}
              </p>
            </div>
            {selectedZone && (
              <button onClick={() => setSelectedZone(null)} className="text-xs text-slate-500 hover:text-slate-300">
                إلغاء التصفية
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/60 text-[10px] text-slate-400 uppercase tracking-wide">
                  <th className="text-right p-3">الرقم</th>
                  <th className="text-right p-3">الموقع</th>
                  <th className="text-right p-3">المنطقة</th>
                  <th className="text-right p-3">دخول (بار)</th>
                  <th className="text-right p-3">خروج (بار)</th>
                  <th className="text-right p-3">الضبط</th>
                  <th className="text-right p-3">الحالة</th>
                  <th className="text-right p-3">آخر فحص</th>
                </tr>
              </thead>
              <tbody>
                {filteredPRVs.map((p) => {
                  const sc = prvStatusColors[p.status];
                  const deviation = Math.abs(p.outlet_bar - p.setpoint_bar);
                  return (
                    <tr key={p.id} className="border-t border-slate-800/50 hover:bg-slate-900/30">
                      <td className="p-3 font-mono text-xs text-slate-400">{p.id}</td>
                      <td className="p-3 text-slate-200">{p.location_ar}</td>
                      <td className="p-3 text-slate-400 text-xs">{p.zone_id}</td>
                      <td className="p-3 font-mono text-slate-300">{p.inlet_bar.toFixed(1)}</td>
                      <td className={`p-3 font-mono font-bold ${deviation > 0.5 ? 'text-amber-400' : 'text-slate-200'}`}>
                        {p.outlet_bar.toFixed(1)}
                      </td>
                      <td className="p-3 font-mono text-slate-400">{p.setpoint_bar.toFixed(1)}</td>
                      <td className={`p-3 font-bold text-xs ${sc.text}`}>
                        <span className="flex items-center gap-1">
                          {p.status === 'fault'
                            ? <AlertTriangle className="w-3 h-3" />
                            : <CheckCircle className="w-3 h-3" />}
                          {sc.label}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-500">{p.last_inspection}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
