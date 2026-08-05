'use client';
/**
 * مركز القيادة التنفيذي
 * ═══════════════════════════════════════════════════
 * لوحة رقابة جغرافية حية: KPIs + خريطة + تغذية الأحداث
 */

import React, { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle, Users, Wrench, Activity,
  CheckCircle2, Clock, MapPin, RefreshCw, Loader2,
} from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';
import { GisErrorBoundary } from '../components/GisErrorBoundary';
import { GisWorkspaceSwitcher } from '../components/GisWorkspaceSwitcher';

const MapCenterCanvas = dynamic(() => import('../components/MapCenterCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  ),
});

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400', high: 'text-orange-400',
  medium: 'text-yellow-400', low: 'text-green-400',
};
const PRIORITY_AR: Record<string, string> = {
  critical: 'حرج', high: 'عالي', medium: 'متوسط', low: 'منخفض',
};
const STATUS_AR: Record<string, string> = {
  pending: 'معلق', in_progress: 'جارٍ', completed: 'منجز', on_hold: 'متوقف',
};

function KpiCard({
  label, value, sub, Icon, color, loading,
}: { label: string; value: number | string; sub?: string; Icon: React.ElementType; color: string; loading?: boolean }) {
  
  const handleSelectJob = async (job: any) => {
    try {
      console.log('Fetching results for job:', job);
      const res = await fetch('/api/gis/insar-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job?.id || job?.job_id, name: job?.name })
      });
      const data = await res.json();
      if (data.ok) {
        alert('تم جلب بيانات الهبوط والتشوه بنجاح لهذه الوظيفة!');
      }
    } catch (e) {
      console.error('Error fetching InSAR results:', e);
    }
  };

return (
    <div className="flex-1 min-w-0 bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color.replace('text-', 'bg-').replace('400', '500/15')}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <div className={`text-xl font-bold ${color}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : value}
        </div>
        <div className="text-[11px] text-slate-400 truncate">{label}</div>
        {sub && <div className="text-[10px] text-slate-600 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function EventFeed() {
  const workOrders = useGisEngine(s => s.workOrders);
  const employees  = useGisEngine(s => s.employees);
  const loading    = useGisEngine(s => s.workOrdersLoading);
  const setCenter  = useGisEngine(s => s.setCenter);

  const critical = useMemo(() =>
    [...workOrders]
      .filter(w => w.priority === 'critical' || w.priority === 'high')
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
      })
      .slice(0, 20)
  , [workOrders]);

  return (
    <div className="w-72 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-bold text-white">تغذية الأحداث الحية</span>
          <span className="mr-auto text-[10px] bg-red-500/20 text-red-300 px-1.5 rounded-full border border-red-500/30">
            {critical.length} عاجل
          </span>
        </div>
      </div>

      {/* Active field teams */}
      <div className="px-3 py-2 border-b border-slate-800/60">
        <p className="text-[10px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">الفرق الميدانية النشطة</p>
        <div className="flex flex-wrap gap-1.5">
          {employees.filter(e => e.active).slice(0, 6).map(emp => (
            <button
              key={emp.id}
              onClick={() => emp.latitude != null && emp.longitude != null && setCenter([emp.longitude, emp.latitude])}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-[10px] text-blue-300 hover:bg-blue-500/25 transition-colors"
            >
              <Users className="w-2.5 h-2.5" />
              <span className="truncate max-w-[70px]">{emp.name}</span>
            </button>
          ))}
          {employees.filter(e => e.active).length === 0 && (
            <span className="text-[10px] text-slate-600">لا يوجد فريق نشط</span>
          )}
        </div>
      </div>

      {/* Critical work orders feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-12 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">تحميل...</span>
          </div>
        )}
        {!loading && critical.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            <p className="text-xs text-slate-500">لا توجد أحداث حرجة</p>
          </div>
        )}
        {!loading && critical.map(wo => (
          <div key={wo.id} className="px-3 py-2.5 border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
            <div className="flex items-start gap-2">
              <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${PRIORITY_COLOR[wo.priority] ?? 'text-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{wo.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-bold ${PRIORITY_COLOR[wo.priority] ?? 'text-slate-400'}`}>
                    {PRIORITY_AR[wo.priority] ?? wo.priority}
                  </span>
                  <span className="text-[10px] text-slate-500">{STATUS_AR[wo.status] ?? wo.status}</span>
                </div>
              </div>
              {wo.latitude != null && wo.longitude != null && (
                <button
                  onClick={() => setCenter([wo.longitude!, wo.latitude!])}
                  className="shrink-0 p-1 rounded hover:bg-cyan-500/20 transition-colors"
                >
                  <MapPin className="w-3 h-3 text-cyan-400" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandCenterContent() {
  const setWorkspace      = useGisEngine(s => s.setWorkspace);
  const refreshAll        = useGisEngine(s => s.refreshAll);
  const workOrders        = useGisEngine(s => s.workOrders);
  const employees         = useGisEngine(s => s.employees);
  const assets            = useGisEngine(s => s.assets);
  const loading           = useGisEngine(s => s.workOrdersLoading);

  useEffect(() => {
    setWorkspace('executive');
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => ({
    critical: workOrders.filter(w => w.priority === 'critical').length,
    inProgress: workOrders.filter(w => w.status === 'in_progress').length,
    activeTeams: employees.filter(e => e.active).length,
    totalAssets: assets.length,
    healthyCritical: assets.filter(a => a.health_score != null && a.health_score < 50).length,
    done: workOrders.filter(w => w.status === 'completed').length,
  }), [workOrders, employees, assets]);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/90 shrink-0" dir="rtl">
        <Activity className="w-4 h-4 text-cyan-400" />
        <h1 className="text-sm font-bold text-white">مركز الرقابة والمتابعة الميدانية</h1>
        <GisWorkspaceSwitcher />
        <div className="flex-1" />
        <button onClick={() => refreshAll()} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/40">
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="flex items-stretch gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/60 shrink-0 overflow-x-auto" dir="rtl">
        <KpiCard label="أوامر حرجة"   value={stats.critical}    color="text-red-400"    Icon={AlertTriangle} loading={loading} />
        <KpiCard label="جارية الآن"   value={stats.inProgress}  color="text-amber-400"  Icon={Clock}        loading={loading} />
        <KpiCard label="فرق نشطة"     value={stats.activeTeams} color="text-blue-400"   Icon={Users}        loading={loading} />
        <KpiCard label="أصول مسجلة"   value={stats.totalAssets} color="text-purple-400" Icon={Wrench}       loading={loading} sub={stats.healthyCritical > 0 ? `${stats.healthyCritical} بحاجة متابعة` : 'كل الأصول سليمة'} />
        <KpiCard label="مُنجزة اليوم" value={stats.done}        color="text-green-400"  Icon={CheckCircle2} loading={loading} />
      </div>

      {/* ─── Body ─── */}
      <div className="flex flex-1 overflow-hidden">
        <EventFeed />
        <div className="flex-1 relative overflow-hidden">
          <MapCenterCanvas />
        </div>
      </div>
    </div>
  );
}

export default function GisCommandCenterPage() {
  return (
    <GisErrorBoundary title="تعذر تحميل مركز القيادة التنفيذي">
      <CommandCenterContent />
    </GisErrorBoundary>
  );
}
