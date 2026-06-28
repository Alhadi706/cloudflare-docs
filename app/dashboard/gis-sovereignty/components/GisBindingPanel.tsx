'use client';
/**
 * GisBindingPanel — لوحة انتهاكات ربط ERP-GIS
 * ══════════════════════════════════════════════
 * تعرض الكيانات التي تفتقر لبيانات مكانية مع رابط للتصحيح.
 */

import React from 'react';
import { AlertTriangle, X, CheckCircle2, ExternalLink } from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';
import { violationLabel, entityTypeLabel } from '@/lib/gis/erpBinding';

export default function GisBindingPanel() {
  const violations      = useGisEngine(s => s.violations);
  const loading         = useGisEngine(s => s.violationsLoading);
  const panelOpen       = useGisEngine(s => s.violationPanelOpen);
  const togglePanel     = useGisEngine(s => s.toggleViolationPanel);
  const loadViolations  = useGisEngine(s => s.loadViolations);

  if (!panelOpen) return null;

  const errors   = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  return (
    <div className="absolute top-14 left-60 z-40 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-200 flex-1">انتهاكات ربط ERP-GIS</span>
        <button onClick={() => loadViolations()} className="text-slate-500 hover:text-slate-300 text-xs px-1">تحديث</button>
        <button onClick={togglePanel} className="text-slate-500 hover:text-slate-300">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-3 py-2 border-b border-slate-800 text-xs">
        <span className="text-red-400 font-semibold">{errors.length} خطأ</span>
        <span className="text-amber-400">{warnings.length} تحذير</span>
        {violations.length === 0 && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />امتثال كامل</span>}
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
        {loading && (
          <div className="px-3 py-4 text-xs text-slate-400 text-center">جاري الفحص...</div>
        )}
        {!loading && violations.length === 0 && (
          <div className="px-3 py-4 text-xs text-emerald-400 text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />جميع الكيانات مرتبطة مكانياً
          </div>
        )}
        {!loading && violations.map((v, i) => (
          <div key={i} className={`px-3 py-2 flex items-start gap-2 ${v.severity === 'error' ? 'bg-red-950/20' : 'bg-amber-950/20'}`}>
            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${v.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-200 truncate">{v.entity_name}</p>
              <p className="text-[10px] text-slate-400">{entityTypeLabel(v.entity_type)} · {violationLabel(v)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
