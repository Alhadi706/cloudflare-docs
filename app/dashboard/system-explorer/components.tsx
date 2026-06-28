'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Sec, Mod, DbStatus, MapStatus, PhaseNum } from './data';

// ─── ألوان المراحل ───
const PHASE_COLORS: Record<PhaseNum, string> = {
  0: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
  1: 'text-blue-400 bg-blue-900/30 border-blue-700/40',
  2: 'text-cyan-400 bg-cyan-900/30 border-cyan-700/40',
  3: 'text-violet-400 bg-violet-900/30 border-violet-700/40',
  4: 'text-orange-400 bg-orange-900/30 border-orange-700/40',
  5: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40',
  6: 'text-pink-400 bg-pink-900/30 border-pink-700/40',
  7: 'text-slate-400 bg-slate-800/50 border-slate-600/40',
  8: 'text-red-400 bg-red-900/30 border-red-700/40',
};

/**
 * DbB - شارة حالة قاعدة البيانات
 */
export function DbBadge({ status }: { status: DbStatus }) {
  const colorMap: Record<DbStatus, string> = {
    'CONNECTED': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'PARTIAL': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    'DISCONNECTED': 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  const labelMap: Record<DbStatus, string> = {
    'CONNECTED': 'DB ✓',
    'PARTIAL': 'DB ~',
    'DISCONNECTED': 'DB ✗',
  };
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${colorMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}

/**
 * MapB - شارة حالة الخريطة
 */
export function MapBadge({ status }: { status: MapStatus }) {
  const colorMap: Record<MapStatus, string> = {
    'LINKED': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'POSSIBLE': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'NO': 'bg-slate-800 text-slate-600 border-slate-700',
  };
  const labelMap: Record<MapStatus, string> = {
    'LINKED': 'خريطة ✓',
    'POSSIBLE': 'خريطة ~',
    'NO': 'خريطة ✗',
  };
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${colorMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}

/**
 * ModCard - بطاقة وحدة (صفحة)
 */
export function ModuleCard({ mod }: { mod: Mod }) {
  const borderColors: Record<DbStatus, string> = {
    'CONNECTED': 'border-emerald-600/30 bg-emerald-950/15',
    'PARTIAL': 'border-yellow-600/30 bg-yellow-950/10',
    'DISCONNECTED': 'border-slate-700/30 bg-slate-900/20',
  };

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${borderColors[mod.db]}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <Link href={mod.path}>
          <span className="font-medium text-slate-200 hover:text-blue-400 text-xs cursor-pointer">
            {mod.name} →
          </span>
        </Link>
        <div className="flex gap-1 items-center flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${PHASE_COLORS[mod.phase]}`}>
            م{mod.phase}
          </span>
          <DbBadge status={mod.db} />
          <MapBadge status={mod.map} />
        </div>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">{mod.desc}</p>
      <div className="text-[10px] font-mono text-slate-700 truncate">
        📋 {mod.table}
      </div>
      {mod.needs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mod.needs.map((need) => (
            <span
              key={need}
              className="text-[10px] bg-red-900/20 text-red-400/70 px-1.5 py-0.5 rounded border border-red-800/20"
            >
              {need}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DeptCard - بطاقة قسم (مجموعة وحدات)
 */
export function DepartmentCard({ section }: { section: Sec }) {
  const [open, setOpen] = useState(false);

  const total = section.mods.length;
  const dbOk = section.mods.filter((m) => m.db === 'CONNECTED').length;
  const dbPart = section.mods.filter((m) => m.db === 'PARTIAL').length;
  const dbNo = section.mods.filter((m) => m.db === 'DISCONNECTED').length;

  const borderColors =
    dbNo === 0
      ? 'border-emerald-600/40 bg-emerald-950/10'
      : dbOk === 0 && dbPart === 0
        ? 'border-red-700/40 bg-red-950/10'
        : 'border-yellow-600/30 bg-yellow-950/5';

  const badgeColors =
    dbNo === 0
      ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40'
      : dbOk === 0 && dbPart === 0
        ? 'bg-red-900/40 text-red-400 border-red-700/40'
        : 'bg-yellow-900/40 text-yellow-400 border-yellow-700/40';

  const label =
    dbNo === 0 ? '✅ مرتبطة بالكامل' : dbOk === 0 && dbPart === 0 ? '❌ غير مرتبطة' : '⚠️ مرتبطة جزئياً';

  return (
    <div className={`border rounded-xl overflow-hidden ${borderColors}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-right p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">{section.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-bold text-sm text-slate-100">{section.title}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${badgeColors}`}>
                {label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>
                📊 {dbOk}/{total} مرتبطة
              </span>
              {dbPart > 0 && (
                <span className="text-yellow-400/70">
                  ⚠️ {dbPart} جزئية
                </span>
              )}
              {dbNo > 0 && (
                <span className="text-red-400/70">
                  ❌ {dbNo} غير مرتبطة
                </span>
              )}
            </div>
          </div>
          <span className="text-slate-500 shrink-0">{open ? '▼' : '▶'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-600/30 p-4 bg-slate-900/20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {section.mods.map((mod) => (
            <ModuleCard key={mod.name} mod={mod} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * StatCard - بطاقة إحصائية
 */
export function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div className={`border rounded-lg p-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}
