'use client';
/**
 * AdministrationPack — حزمة السياق الإداري
 * ══════════════════════════════════════════
 * Skeleton Phase 1: overlay + widget zones للإدارة العامة.
 */

import React, { useEffect } from 'react';
import { Building2, Users, FileText, Shield } from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';

export function AdministrationRightWidget() {
  const loadDepartmentInventory = useGisEngine(s => s.loadDepartmentInventory);
  const loadSectionsInventory = useGisEngine(s => s.loadSectionsInventory);
  const loadUnifiedGeojson = useGisEngine(s => s.loadUnifiedGeojson);
  const departments = useGisEngine(s => s.departmentInventory);
  const sections = useGisEngine(s => s.sectionsInventory);

  useEffect(() => {
    loadDepartmentInventory();
    loadSectionsInventory('administration');
    loadUnifiedGeojson({ entityTypes: ['project', 'asset', 'employee'], department: 'administration', limit: 1200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 p-3 w-56">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">أدوات الإدارة</div>
      {[
        { icon: <Users className="w-4 h-4" />,     label: 'الموظفون على الخريطة' },
        { icon: <Building2 className="w-4 h-4" />, label: 'الوحدات التنظيمية' },
        { icon: <FileText className="w-4 h-4" />,  label: 'الوثائق الإدارية' },
        { icon: <Shield className="w-4 h-4" />,    label: 'الصلاحيات والحوكمة' },
      ].map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 text-sm transition-colors text-right w-full"
        >
          <span className="text-purple-400 shrink-0">{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-400 space-y-1">
        <div>Departments: {departments.length}</div>
        <div>Sections: {sections.length}</div>
      </div>
    </div>
  );
}

export function AdministrationOverlay() {
  const departments = useGisEngine(s => s.departmentInventory);
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-purple-950/80 border-b border-purple-800/60 backdrop-blur-sm">
      <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
      <span className="text-sm font-semibold text-purple-200">مساحة العمل الإدارية</span>
      <span className="text-xs text-purple-400/70 mr-auto">{departments.length} إدارة مفعلة جغرافيًا</span>
    </div>
  );
}
