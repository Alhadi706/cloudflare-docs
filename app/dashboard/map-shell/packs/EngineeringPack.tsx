'use client';
/**
 * EngineeringPack — حزمة السياق الهندسي
 */

import React, { useEffect } from 'react';
import { HardHat, Layers, Wrench, Map, AlertTriangle } from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';

export function EngineeringRightWidget() {
  const loadSectionsInventory = useGisEngine(s => s.loadSectionsInventory);
  const loadUnifiedGeojson = useGisEngine(s => s.loadUnifiedGeojson);
  const sections = useGisEngine(s => s.sectionsInventory);
  const unified = useGisEngine(s => s.unifiedGeojson);

  useEffect(() => {
    loadSectionsInventory('engineering');
    loadUnifiedGeojson({ entityTypes: ['project', 'asset', 'work_order'], department: 'engineering', limit: 1200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 p-3 w-56">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">أدوات الهندسة</div>
      {[
        { icon: <Layers className="w-4 h-4" />, label: 'إدارة الطبقات' },
        { icon: <Wrench className="w-4 h-4" />, label: 'أوامر العمل' },
        { icon: <Map className="w-4 h-4" />, label: 'مناطق المشاريع' },
        { icon: <AlertTriangle className="w-4 h-4" />, label: 'انتهاكات الربط' },
      ].map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 text-sm transition-colors text-right w-full"
        >
          <span className="text-blue-400 shrink-0">{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-400 space-y-1">
        <div>Sections: {sections.length}</div>
        <div>Features: {unified?.metadata?.total ?? unified?.features?.length ?? 0}</div>
      </div>
    </div>
  );
}

export function EngineeringOverlay() {
  const drawingMode = useGisEngine(s => s.drawingMode);
  const violations = useGisEngine(s => s.violations);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-blue-950/80 border-b border-blue-800/60 backdrop-blur-sm">
      <HardHat className="w-4 h-4 text-blue-400 shrink-0" />
      <span className="text-sm font-semibold text-blue-200">مساحة العمل الهندسية</span>
      {drawingMode !== 'idle' && (
        <span className="text-xs bg-blue-600/40 text-blue-200 px-2 py-0.5 rounded-full border border-blue-500/30">
          وضع الرسم: {drawingMode}
        </span>
      )}
      {violations.length > 0 && (
        <span className="text-xs bg-red-600/40 text-red-200 px-2 py-0.5 rounded-full border border-red-500/30 mr-auto">
          {violations.length} انتهاك ربط
        </span>
      )}
    </div>
  );
}
