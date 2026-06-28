'use client';
/**
 * FinancePack — حزمة السياق المالي
 * ══════════════════════════════════
 * Skeleton Phase 1: overlay + widget zones للإدارة المالية.
 */

import React, { useEffect } from 'react';
import { Banknote, TrendingUp, FileText, AlertCircle } from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';

export function FinanceRightWidget() {
  const loadDepartmentInventory = useGisEngine(s => s.loadDepartmentInventory);
  const loadUnifiedGeojson = useGisEngine(s => s.loadUnifiedGeojson);
  const unified = useGisEngine(s => s.unifiedGeojson);

  useEffect(() => {
    loadDepartmentInventory();
    loadUnifiedGeojson({ entityTypes: ['project', 'asset', 'work_order'], department: 'finance', limit: 1500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 p-3 w-56">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">أدوات المالية</div>
      {[
        { icon: <Banknote className="w-4 h-4" />,     label: 'ميزانيات المشاريع' },
        { icon: <TrendingUp className="w-4 h-4" />,   label: 'تحليل الإنفاق الجغرافي' },
        { icon: <FileText className="w-4 h-4" />,     label: 'التقارير المكانية' },
        { icon: <AlertCircle className="w-4 h-4" />,  label: 'تجاوزات الميزانية' },
      ].map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 text-sm transition-colors text-right w-full"
        >
          <span className="text-emerald-400 shrink-0">{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
        Features: {unified?.metadata?.total ?? unified?.features?.length ?? 0}
      </div>
    </div>
  );
}

export function FinanceOverlay() {
  const projects = useGisEngine(s => s.projects);
  const total = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-emerald-950/80 border-b border-emerald-800/60 backdrop-blur-sm">
      <Banknote className="w-4 h-4 text-emerald-400 shrink-0" />
      <span className="text-sm font-semibold text-emerald-200">المنظور المالي</span>
      {total > 0 && (
        <span className="text-xs text-emerald-300 bg-emerald-900/40 px-2 py-0.5 rounded-full mr-auto">
          إجمالي الميزانيات: {total.toLocaleString('ar')}
        </span>
      )}
    </div>
  );
}
