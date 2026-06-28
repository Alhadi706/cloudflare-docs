'use client';

/**
 * المراقبة الآنية — غرفة التحكم (قراءة فقط)
 * يعرض بيانات حقيقية من ctrl.latest_readings (بيانات الراصدين الميدانيين)
 * لا يتضمن رفع ملفات أو تعديل — إدارة التحكم الكاملة في /dashboard/control-center/scada
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity, Gauge, Droplets, Zap,
  RefreshCw, AlertTriangle, Clock, LayoutDashboard,
  ArrowRight, Radio, Database, Eye,
} from 'lucide-react';
import SCADAMimicView from '../scada/SCADAMimicView';
import { dbStationsToEngines, type DBStation } from '@/lib/scadaDbMapper';

const C = {
  bg: '#020617', card: '#0b1623', border: '#1e293b',
  cyan: '#22d3ee', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b', red: '#ef4444', slate: '#94a3b8',
};

interface StationStatus {
  id: string; name_ar: string;
  flow_m3_day: number; pressure_bar: number;
  pumps_running: number; pumps_total: number;
  tank_level_pct: number;
  status: 'normal' | 'warning' | 'critical' | 'offline';
}

interface NetworkKPI {
  total_production_m3: number; avg_pressure_bar: number;
  active_stations: number; total_stations: number;
  active_pumps: number; total_pumps: number;
  open_alarms: number; network_efficiency_pct: number;
  last_updated: string;
}

const statusColor = (s: StationStatus['status']) => ({
  normal:   { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', label: 'طبيعي' },
  warning:  { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   label: 'تحذير' },
  critical: { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/25',    label: 'حرج' },
  offline:  { text: 'text-slate-500',   bg: 'bg-slate-500/10',   border: 'border-slate-500/25',   label: 'غير متصل' },
}[s]);

function StationCard({ s }: { s: StationStatus }) {
  const sc = statusColor(s.status);
  return (
    <div style={{ background: C.card }} className={`border ${sc.border} rounded-xl p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-100 leading-tight">{s.name_ar}</p>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${sc.bg} ${sc.text}`}>{sc.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-[10px] text-slate-500">تدفق</p>
          <p className="font-mono text-sm text-cyan-300">{s.flow_m3_day > 0 ? (s.flow_m3_day / 1000).toFixed(1) + 'k' : '—'}</p>
          <p className="text-[9px] text-slate-600">م³/يوم</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">ضغط</p>
          <p className={`font-mono text-sm ${s.pressure_bar < 4 ? 'text-rose-400' : s.pressure_bar > 7 ? 'text-amber-400' : 'text-blue-300'}`}>
            {s.pressure_bar > 0 ? s.pressure_bar.toFixed(1) : '—'}
          </p>
          <p className="text-[9px] text-slate-600">بار</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Zap className="w-3 h-3 text-slate-500" />
        <div className="flex gap-1">
          {Array.from({ length: Math.max(s.pumps_total, 1) }).map((_, i) => (
            <div key={i} className={`w-4 h-2 rounded-sm ${i < s.pumps_running ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          ))}
        </div>
        <span className="text-[10px] text-slate-500 mr-1">{s.pumps_running}/{s.pumps_total} مضخة</span>
      </div>
      {s.tank_level_pct > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>منسوب الخزان</span><span>{s.tank_level_pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${s.tank_level_pct < 40 ? 'bg-rose-500' : s.tank_level_pct < 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${s.tank_level_pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RealTimePage() {
  const [viewMode, setViewMode] = useState<'mimic' | 'cards'>('mimic');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('');
  const [dataSource, setDataSource] = useState<'db' | 'no_data'>('no_data');
  const [kpi, setKpi] = useState<NetworkKPI | null>(null);
  const [stations, setStations] = useState<StationStatus[]>([]);
  const [engines, setEngines] = useState<ReturnType<typeof dbStationsToEngines> | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/control-center/live-status', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          if (d.kpi)      setKpi(d.kpi);
          if (d.stations) {
            setStations(d.stations);
            // Map to engine format for SCADAMimicView
            const mapped = dbStationsToEngines(d.stations as DBStation[]);
            setEngines(mapped);
            setDataSource('db');
          }
        } else {
          setDataSource('no_data');
        }
      }
    } catch { setDataSource('no_data'); }
    setLastRefresh(new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setRefreshing(false);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  const kpiCards = kpi ? [
    { icon: <Clock className="w-4 h-4" />,    label: 'آخر تحديث',        value: kpi.last_updated,                                 unit: 'ص',    color: '#22d3ee' },
    { icon: <Activity className="w-4 h-4" />, label: 'كفاءة الشبكة',     value: kpi.network_efficiency_pct.toFixed(1) + '%',      unit: '',     color: '#22c55e' },
    { icon: <AlertTriangle className="w-4 h-4" />, label: 'تنبيهات مفتوحة', value: kpi.open_alarms,                             unit: 'تنبيه', color: kpi.open_alarms > 0 ? '#f59e0b' : '#22c55e' },
    { icon: <Gauge className="w-4 h-4" />,    label: 'متوسط الضغط',      value: kpi.avg_pressure_bar,                             unit: 'بار',  color: '#3b82f6' },
    { icon: <Droplets className="w-4 h-4" />, label: 'محطات عاملة',       value: `${kpi.active_stations} / ${kpi.total_stations}`, unit: '',     color: '#a78bfa' },
    { icon: <Zap className="w-4 h-4" />,      label: 'الإنتاج اليومي',   value: kpi.total_production_m3.toLocaleString('en'),     unit: 'م³',   color: '#22d3ee' },
  ] : [];

  const hasEngines = engines && (engines.e1 || engines.e2 || engines.e3 || engines.e4);

  return (
    <div className="min-h-screen text-slate-100" style={{ background: C.bg }} dir="rtl">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/control-center" className="text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">المراقبة الآنية — غرفة التحكم</h1>
              <p className="text-xs text-slate-500">{lastRefresh ? `آخر تحديث: ${lastRefresh}` : 'جارٍ التحميل...'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Read-only badge */}
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
              <Eye className="w-3 h-3" /> عرض فقط
            </span>
            {/* Data source badge */}
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${dataSource === 'db' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <Database className="w-3 h-3" />
              {dataSource === 'db' ? 'بيانات حية من الراصدين الميدانيين' : 'لا توجد بيانات ميدانية بعد'}
            </span>
            {/* View toggle */}
            <div className="flex bg-slate-900/60 border border-slate-800 rounded-lg p-0.5">
              <button onClick={() => setViewMode('mimic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'mimic' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                <Radio className="w-3 h-3" /> P&ID Mimic
              </button>
              <button onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'cards' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                <LayoutDashboard className="w-3 h-3" /> KPI محطات
              </button>
            </div>
            <button onClick={refresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'جارٍ التحديث...' : 'تحديث'}
            </button>
            <Link href="/dashboard/control-center/scada"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cyan-600/15 text-cyan-400 hover:bg-cyan-600/25 border border-cyan-500/30 transition-colors font-semibold">
              <Activity className="w-3 h-3" /> إدارة SCADA ↗
            </Link>
          </div>
        </div>

        {/* ── KPI strip ── */}
        {kpi && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {kpiCards.map(k => (
              <div key={k.label} style={{ background: C.card, borderColor: C.border }} className="border rounded-xl p-3 text-center">
                <div className="flex justify-center mb-1" style={{ color: k.color }}>{k.icon}</div>
                <p className="text-[10px] text-slate-500 mb-1">{k.label}</p>
                <p className="font-mono text-sm font-bold" style={{ color: k.color }}>
                  {k.value} <span className="text-[9px] text-slate-500">{k.unit}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── Main view ── */}
        {viewMode === 'mimic' ? (
          <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl overflow-hidden">
            <SCADAMimicView
              engine1={hasEngines ? engines.e1 : null}
              engine2={hasEngines ? engines.e2 : null}
              engine3={hasEngines ? engines.e3 : null}
              engine4={hasEngines ? engines.e4 : null}
              totalProduction={engines?.totalProduction}
              embedded={false}
            />
            {!hasEngines && (
              <div className="text-center py-8 text-slate-500 text-sm">
                <Database className="w-6 h-6 mx-auto mb-2 opacity-40" />
                لا توجد بيانات راصدين ميدانيين بعد
                <br />
                <Link href="/dashboard/control-center/scada" className="text-cyan-400 hover:underline text-xs mt-1 inline-block">
                  أو ارفع ملف Excel من صفحة إدارة SCADA ↗
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div>
            {stations.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد قراءات في قاعدة البيانات بعد</p>
                <Link href="/dashboard/control-center/scada" className="text-cyan-400 hover:underline text-xs mt-1 inline-block">
                  ارفع ملف Excel من صفحة إدارة SCADA ↗
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {stations.map(s => <StationCard key={s.id} s={s} />)}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
