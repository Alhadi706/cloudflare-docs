'use client';
import React from 'react';
import { Database, Satellite, Shield, Clock, CheckCircle } from 'lucide-react';
import type { SceneListItem, WorkflowInfo } from '@/lib/satelliteIntelAPI';
import SceneSelector from './SceneSelector';
import ConfidenceBadge from './ConfidenceBadge';

interface SystemStats {
  totalScenes: number;
  realScenes: number;
  simulatedScenes: number;
  workflows: number;
  endpointsTier: { canonical: number; stable: number };
}

interface Props {
  scenes: SceneListItem[];
  workflows: WorkflowInfo[];
  activeSceneUid: string | null;
  onSceneSelect: (uid: string) => void;
  stats: SystemStats;
  scenesLoading: boolean;
}

export default function CommandSidebar({
  scenes,
  workflows,
  activeSceneUid,
  onSceneSelect,
  stats,
  scenesLoading,
}: Props) {
  const activeScene = scenes.find(s => s.scene_uid === activeSceneUid);

  return (
    <div className="w-72 shrink-0 bg-slate-900/50 border-l border-slate-800 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Active Scene Selector */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">المشهد النشط</h3>
          <SceneSelector
            scenes={scenes}
            selectedUid={activeSceneUid}
            onSelect={onSceneSelect}
            loading={scenesLoading}
          />
          {activeScene && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">النوع</span>
                <span className={`text-[10px] font-mono font-bold ${activeScene.data_is_real ? 'text-blue-400' : 'text-amber-400'}`}>
                  {activeScene.data_is_real ? 'COG حقيقي ★' : 'محاكاة'}
                </span>
              </div>
              {activeScene.acquisition_date && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">التاريخ</span>
                  <span className="text-[10px] font-mono text-slate-300">{activeScene.acquisition_date}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 pt-0.5">
                <ConfidenceBadge
                  value={activeScene.data_is_real ? 'high' : 'medium'}
                  showLabel={false}
                />
                <span className="text-[9px] text-slate-500">
                  {activeScene.data_is_real
                    ? 'بيانات حقيقية، تسمح بثقة عالية'
                    : 'محاكاة، مقيدة بثقة متوسطة'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800/60" />

        {/* System Stats */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">حالة النظام</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { icon: Satellite,    label: 'المشاهد',        value: stats.totalScenes,        color: 'text-blue-400' },
              { icon: Database,     label: 'COG حقيقي',      value: stats.realScenes,         color: 'text-emerald-400' },
              { icon: Shield,       label: 'نقاط API',       value: stats.endpointsTier.canonical + stats.endpointsTier.stable, color: 'text-purple-400' },
              { icon: Clock,        label: 'سير العمل',       value: stats.workflows,          color: 'text-amber-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-2.5">
                <stat.icon className={`w-3.5 h-3.5 ${stat.color} mb-1.5`} />
                <p className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                <p className="text-[9px] text-slate-500 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800/60" />

        {/* S5 Status */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">بروتوكول S5 نشط</h3>
          {[
            'بوابات الصحة (G1/G2/G3) مفعّلة',
            'بوابات المقارنة (C1/C2/C3) مفعّلة',
            'بوابات الاستخبارات (I1/I2/I3/I4) مفعّلة',
            'التحقق الدلالي (Alert Guard) مفعّل',
            'عقود التكامل (S5 Contracts) مفعّلة',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="text-[9px] text-slate-500 leading-tight">{item}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800/60" />

        {/* Available workflows summary */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">سير العمل المتاح</h3>
          {workflows.map(wf => (
            <div key={wf.workflow_key} className="flex items-center gap-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
              <span className="text-[10px] font-mono text-slate-400">{wf.workflow_key}</span>
              {wf.needs_compare && (
                <span className="text-[8px] text-purple-400 bg-purple-950/40 border border-purple-700/30 px-1 rounded font-mono ml-auto">
                  مقارنة
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800/60 bg-slate-900/80">
        <p className="text-[9px] text-slate-600 font-mono text-center leading-tight">
          Phase S6 · Satellite Intelligence Command Center<br />
          Backend: FastAPI/7860 · Sentinel-2 · ESA Copernicus
        </p>
      </div>
    </div>
  );
}
