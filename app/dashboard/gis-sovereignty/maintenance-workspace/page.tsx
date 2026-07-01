'use client';
/**
 * مساحة الصيانة الجغرافية
 * ═══════════════════════════════════════════════════════
 * خريطة موحدة + قائمة أوامر عمل + فرق ميدانية
 */

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Wrench, Users, AlertTriangle, CheckCircle2, Clock,
  RefreshCw, MapPin, Loader2,
} from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';
import { GisErrorBoundary } from '../components/GisErrorBoundary';
import { GisWorkspaceSwitcher } from '../components/GisWorkspaceSwitcher';

const MapCenterCanvas = dynamic(() => import('../components/MapCenterCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
    </div>
  ),
});

const PRIORITY = {
  critical: { label: 'حرج',   color: 'text-red-400',    dot: 'bg-red-400'    },
  high:     { label: 'عالي',  color: 'text-orange-400', dot: 'bg-orange-400' },
  medium:   { label: 'متوسط', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  low:      { label: 'منخفض', color: 'text-green-400',  dot: 'bg-green-400'  },
} as const;

const STATUS_AR: Record<string, string> = {
  pending: 'معلق', in_progress: 'جارٍ', completed: 'منجز',
  cancelled: 'ملغي', on_hold: 'متوقف',
};

function StatsBar() {
  const workOrders        = useGisEngine(s => s.workOrders);
  const workOrdersLoading = useGisEngine(s => s.workOrdersLoading);
  const employees         = useGisEngine(s => s.employees);
  const refreshAll        = useGisEngine(s => s.refreshAll);

  const s = useMemo(() => ({
    total:    workOrders.length,
    critical: workOrders.filter(w => w.priority === 'critical').length,
    active:   workOrders.filter(w => w.status === 'in_progress').length,
    done:     workOrders.filter(w => w.status === 'completed').length,
    teams:    employees.filter(e => e.active).length,
  }), [workOrders, employees]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/90 flex-wrap shrink-0" dir="rtl">
      <h1 className="text-sm font-bold text-white ml-1">مساحة الصيانة الجغرافية</h1>
      <GisWorkspaceSwitcher />
      <div className="flex-1" />
      {[
        { label: 'إجمالي',  v: s.total,    Icon: Wrench,        c: 'text-slate-300' },
        { label: 'حرجة',   v: s.critical, Icon: AlertTriangle,  c: 'text-red-400'   },
        { label: 'جارية',  v: s.active,   Icon: Clock,         c: 'text-amber-400' },
        { label: 'منجزة',  v: s.done,     Icon: CheckCircle2,  c: 'text-green-400' },
        { label: 'فرق',    v: s.teams,    Icon: Users,         c: 'text-blue-400'  },
      ].map(({ label, v, Icon, c }) => (
        <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40">
          <Icon className={`w-3.5 h-3.5 ${c}`} />
          <span className={`text-sm font-bold ${c}`}>{workOrdersLoading ? '—' : v}</span>
          <span className="text-[10px] text-slate-500">{label}</span>
        </div>
      ))}
      <button onClick={() => refreshAll()} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/40">
        <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${workOrdersLoading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

function WorkOrdersList({ onLocate }: { onLocate: (lat: number, lon: number) => void }) {
  const workOrders        = useGisEngine(s => s.workOrders);
  const workOrdersLoading = useGisEngine(s => s.workOrdersLoading);
  const workOrdersError   = useGisEngine(s => s.workOrdersError);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'in_progress'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all')         return workOrders;
    if (filter === 'in_progress') return workOrders.filter(w => w.status === 'in_progress');
    return workOrders.filter(w => w.priority === filter);
  }, [workOrders, filter]);

  return (
    <div className="w-72 shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden" dir="rtl">
      <div className="px-3 pt-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">أوامر العمل</span>
          <span className="mr-auto text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded-full">{filtered.length}</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            { key: 'all',         label: 'الكل'  },
            { key: 'critical',    label: 'حرج'   },
            { key: 'high',        label: 'عالي'  },
            { key: 'in_progress', label: 'جارية' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border transition-colors ${
                filter === f.key
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}>{f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {workOrdersLoading && (
          <div className="flex items-center justify-center h-16 gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">تحميل...</span>
          </div>
        )}
        {workOrdersError && <p className="p-3 text-xs text-red-400">{workOrdersError}</p>}
        {!workOrdersLoading && filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-slate-500">لا توجد أوامر عمل</p>
        )}
        {!workOrdersLoading && filtered.map(wo => {
          const pr = PRIORITY[wo.priority] ?? PRIORITY.medium;
          return (
            <div key={wo.id} className="px-3 py-2.5 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pr.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{wo.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-bold ${pr.color}`}>{pr.label}</span>
                    <span className="text-[10px] text-slate-500">{STATUS_AR[wo.status] ?? wo.status}</span>
                    {wo.scheduled_date && (
                      <span className="text-[10px] text-slate-600">{wo.scheduled_date.slice(0,10)}</span>
                    )}
                  </div>
                </div>
                {wo.latitude != null && wo.longitude != null && (
                  <button onClick={() => onLocate(wo.latitude!, wo.longitude!)}
                    className="shrink-0 p-1 rounded hover:bg-amber-500/20 transition-colors">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldTeamsList({ onLocate }: { onLocate: (lat: number, lon: number) => void }) {
  const employees        = useGisEngine(s => s.employees);
  const employeesLoading = useGisEngine(s => s.employeesLoading);
  const active           = employees.filter(e => e.active);

  return (
    <div className="w-52 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden" dir="rtl">
      <div className="px-3 pt-3 pb-2 border-b border-slate-800 flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-bold text-white">الفرق الميدانية</span>
        <span className="mr-auto text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded-full">{active.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {employeesLoading && (
          <div className="flex items-center justify-center h-12 gap-1 text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" /><span className="text-[10px]">تحميل...</span>
          </div>
        )}
        {!employeesLoading && active.length === 0 && (
          <p className="p-3 text-center text-xs text-slate-500">لا يوجد فريق نشط</p>
        )}
        {!employeesLoading && active.map(emp => (
          <div key={emp.id} className="px-2.5 py-2 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Users className="w-3 h-3 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{emp.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{emp.department}</p>
              </div>
              {emp.latitude != null && emp.longitude != null && (
                <button onClick={() => onLocate(emp.latitude!, emp.longitude!)}
                  className="shrink-0 p-1 rounded hover:bg-blue-500/20 transition-colors">
                  <MapPin className="w-3 h-3 text-blue-400" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaintenanceWorkspaceContent() {
  const setWorkspace = useGisEngine(s => s.setWorkspace);
  const refreshAll   = useGisEngine(s => s.refreshAll);
  const setCenter    = useGisEngine(s => s.setCenter);

  useEffect(() => {
    setWorkspace('maintenance');
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocate = (lat: number, lon: number) => setCenter([lon, lat]);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      <StatsBar />
      <div className="flex flex-1 overflow-hidden">
        <FieldTeamsList onLocate={handleLocate} />
        <div className="flex-1 relative overflow-hidden">
          <MapCenterCanvas />
        </div>
        <WorkOrdersList onLocate={handleLocate} />
      </div>
    </div>
  );
}

export default function GisMaintenanceWorkspacePage() {
  return (
    <GisErrorBoundary title="تعذر تحميل مساحة الصيانة الجغرافية">
      <MaintenanceWorkspaceContent />
    </GisErrorBoundary>
  );
}

