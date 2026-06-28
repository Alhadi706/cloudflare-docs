'use client';

import React, { useEffect } from 'react';
import { Shield, Eye, Lock, Users, GitBranch, Layers, Database } from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';

const DEPTS = [
  { key: 'engineering', label: 'الهندسة' },
  { key: 'hr', label: 'الموارد البشرية' },
  { key: 'communications', label: 'الاتصالات' },
  { key: 'finance', label: 'المالية' },
  { key: 'corrosion', label: 'التآكل' },
  { key: 'maintenance', label: 'الصيانة' },
  { key: 'sensing', label: 'الاستشعار' },
  { key: 'executive', label: 'القيادة' },
];

export default function GisLayerGovernancePanel() {
  const governedLayers = useGisEngine(s => s.governedLayers);
  const governedLayersLoading = useGisEngine(s => s.governedLayersLoading);
  const activeDepartment = useGisEngine(s => s.activeDepartment);
  const setActiveDepartment = useGisEngine(s => s.setActiveDepartment);
  const loadGovernedLayers = useGisEngine(s => s.loadGovernedLayers);
  const satelliteDatasets = useGisEngine(s => s.satelliteDatasets);
  const satelliteLoading = useGisEngine(s => s.satelliteDatasetsLoading);
  const loadSatelliteDatasets = useGisEngine(s => s.loadSatelliteDatasets);

  useEffect(() => {
    loadGovernedLayers(activeDepartment ?? undefined);
    loadSatelliteDatasets(activeDepartment ?? undefined);
  }, [activeDepartment, loadGovernedLayers, loadSatelliteDatasets]);

  return (
    <aside className="w-[360px] max-w-[42vw] h-full bg-slate-900/95 border-r border-slate-800 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-100 text-xs font-semibold">
          <Shield className="w-4 h-4 text-cyan-400" />
          حوكمة الطبقات
        </div>
        <div className="text-[10px] text-slate-400 mt-1">ملكية، رؤية، صلاحيات تعديل، وحالة نشر</div>
      </div>

      <div className="px-3 py-2 border-b border-slate-800">
        <label className="text-[10px] text-slate-400 block mb-1">تصفية حسب القسم</label>
        <select
          value={activeDepartment ?? ''}
          onChange={(e) => setActiveDepartment(e.target.value || null)}
          className="w-full h-8 rounded bg-slate-800 border border-slate-700 text-xs px-2 text-slate-200"
        >
          <option value="">كل الأقسام</option>
          {DEPTS.map(d => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5" />
          الطبقات المحكومة ({governedLayers.length})
        </div>

        {governedLayersLoading && <div className="text-xs text-slate-500">جار تحميل طبقات الحوكمة...</div>}

        {!governedLayersLoading && governedLayers.map((l) => (
          <div key={l.id} className="rounded border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-slate-100 font-semibold truncate">{l.name}</div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                l.publish_status === 'published'
                  ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/60'
                  : l.publish_status === 'reviewed'
                  ? 'bg-amber-900/50 text-amber-300 border border-amber-700/60'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {l.publish_status}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-slate-300">
              <div className="flex items-center gap-1"><Users className="w-3 h-3 text-slate-500" />{l.owner_department || 'unassigned'}</div>
              <div className="flex items-center gap-1"><GitBranch className="w-3 h-3 text-slate-500" />{l.layer_type}</div>
              <div className="flex items-center gap-1"><Eye className="w-3 h-3 text-slate-500" />{l.visibility_scope}</div>
              <div className="flex items-center gap-1"><Lock className="w-3 h-3 text-slate-500" />{l.edit_policy}</div>
            </div>

            {l.visibility_scope === 'shared_selected' && l.visible_to_departments?.length > 0 && (
              <div className="mt-2 text-[10px] text-cyan-300">
                shared with: {l.visible_to_departments.join(', ')}
              </div>
            )}

            {l.is_base_layer && (
              <div className="mt-2 text-[10px] text-blue-300">Base Project Layer · {l.geometry_type}</div>
            )}
          </div>
        ))}

        <div className="pt-2 border-t border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center gap-2 mb-2">
            <Database className="w-3.5 h-3.5" />
            خط بيانات الأقمار الاصطناعية ({satelliteDatasets.length})
          </div>
          {satelliteLoading && <div className="text-xs text-slate-500">جار تحميل بيانات الأقمار...</div>}
          {!satelliteLoading && (
            <div className="space-y-1 text-[10px]">
              <div className="text-slate-300">raw: {satelliteDatasets.filter(d => d.data_category === 'raw').length}</div>
              <div className="text-slate-300">processed: {satelliteDatasets.filter(d => d.data_category === 'processed').length}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
