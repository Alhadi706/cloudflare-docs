'use client';
/**
 * ExecutivePack — حزمة السياق التنفيذي
 * ══════════════════════════════════════
 * Skeleton Phase 1: overlay + widget zones للقيادة التنفيذية.
 */

import React, { useEffect } from 'react';
import { Target, Activity, Globe2, BarChart2 } from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';

export function ExecutiveRightWidget() {
  const loadDepartmentInventory = useGisEngine(s => s.loadDepartmentInventory);
  const loadUnifiedGeojson = useGisEngine(s => s.loadUnifiedGeojson);
  const departments = useGisEngine(s => s.departmentInventory);

  useEffect(() => {
    loadDepartmentInventory();
    loadUnifiedGeojson({ entityTypes: ['project', 'asset', 'employee', 'work_order'], department: 'executive', limit: 1500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 p-3 w-56">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">لوحة القيادة</div>
      {[
        { icon: <Activity className="w-4 h-4" />,  label: 'مؤشرات الأداء الجغرافية' },
        { icon: <Target className="w-4 h-4" />,    label: 'الأهداف الاستراتيجية' },
        { icon: <Globe2 className="w-4 h-4" />,    label: 'النطاق الجغرافي الكلي' },
        { icon: <BarChart2 className="w-4 h-4" />, label: 'التقارير التنفيذية' },
      ].map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 text-sm transition-colors text-right w-full"
        >
          <span className="text-amber-400 shrink-0">{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
        Inventories: {departments.length}
      </div>
    </div>
  );
}

export function ExecutiveOverlay() {
  const projects  = useGisEngine(s => s.projects);
  const alerts    = useGisEngine(s => s.alerts);
  const critCount = alerts.filter(a => a.type === 'critical').length;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-950/80 border-b border-amber-800/60 backdrop-blur-sm">
      <Target className="w-4 h-4 text-amber-400 shrink-0" />
      <span className="text-sm font-semibold text-amber-200">المنظور التنفيذي</span>
      <span className="text-xs text-amber-400/70">{projects.length} مشروع نشط</span>
      {critCount > 0 && (
        <span className="text-xs bg-red-600/40 text-red-200 px-2 py-0.5 rounded-full border border-red-500/30 mr-auto">
          {critCount} تنبيه حرج
        </span>
      )}
    </div>
  );
}
