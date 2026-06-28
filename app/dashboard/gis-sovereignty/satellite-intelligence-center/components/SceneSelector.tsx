'use client';
import React from 'react';
import { Database, ChevronDown, RefreshCw } from 'lucide-react';
import type { SceneListItem } from '@/lib/satelliteIntelAPI';

interface Props {
  scenes: SceneListItem[];
  selectedUid: string | null;
  onSelect: (uid: string) => void;
  loading?: boolean;
}

export default function SceneSelector({ scenes, selectedUid, onSelect, loading }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" />
          اختر مشهداً
        </label>
        {loading && <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />}
      </div>
      <div className="relative">
        <select
          className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-200 appearance-none focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 cursor-pointer"
          value={selectedUid ?? ''}
          onChange={e => onSelect(e.target.value)}
          disabled={loading || scenes.length === 0}
        >
          <option value="" disabled>— اختر مشهداً —</option>
          {scenes.map(s => (
            <option key={s.scene_uid} value={s.scene_uid}>
              {s.scene_uid.length > 40
                ? '…' + s.scene_uid.slice(-38)
                : s.scene_uid}
              {s.data_is_real ? ' ★' : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
      </div>
      {selectedUid && (
        <p className="text-[9px] text-slate-500 font-mono truncate" title={selectedUid}>
          {selectedUid}
        </p>
      )}
    </div>
  );
}
