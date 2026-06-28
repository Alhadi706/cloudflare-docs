'use client';

/**
 * StationClustersPanel
 * ─────────────────────────────────────────────────────────────
 * يجمّع الأصول التي تقع على نفس الموقع (±150م) في "محطات ميدانية"
 * ويعرض لكل محطة: عدد الأصول، أنواعها، درجة الخطر المركّبة،
 * وعدد الزيارات الميدانية اللازمة لخدمة كل الأصول فيها.
 * ─────────────────────────────────────────────────────────────
 */

import React, { useMemo, useState } from 'react';
import { LinearAsset } from '@/lib/linear-referencing/types';

interface Props {
  assets: LinearAsset[];
  onAssetSelect?: (id: string) => void;
}

// ── helpers ───────────────────────────────────────────────────────────────
function getType(code: string): string {
  if (code.startsWith('PUWE')) return 'PUWE';
  if (code.startsWith('SAV'))  return 'SAV';
  if (code.startsWith('DAV'))  return 'DAV';
  if (code.startsWith('M/H') || code.startsWith('MH')) return 'MH';
  if (code.startsWith('PU'))   return 'PU';
  if (code.startsWith('WT'))   return 'WT';
  if (code.startsWith('FCS'))  return 'FCS';
  if (code.startsWith('TJE'))  return 'TJE';
  return 'OTHER';
}

function getThickness(a: LinearAsset): number {
  const d = a.technical?.diameter || '';
  if (d.includes('x')) { const t = parseFloat(d.split('x')[1]); return isNaN(t) ? -1 : t; }
  return -1;
}

const TYPE_COLOR: Record<string, string> = {
  SAV:  '#10b981', DAV: '#f59e0b', MH: '#64748b',
  PU:   '#818cf8', PUWE: '#6366f1', WT: '#14b8a6',
  FCS:  '#d97706', TJE: '#94a3b8', OTHER: '#475569',
};
const TYPE_LABEL: Record<string, string> = {
  SAV: 'SAV', DAV: 'DAV', MH: 'MH', PU: 'PU',
  PUWE: 'PUWE', WT: 'WT', FCS: 'FCS', TJE: 'TJE', OTHER: '?',
};

// ── Station cluster type ──────────────────────────────────────────────────
interface Cluster {
  id: string;
  centreStation: number;
  centreElev: number;
  assets: LinearAsset[];
  sector: string;
  typeCounts: Record<string, number>;
  riskScore: number;   // 0–100
  riskLabel: 'critical' | 'warning' | 'ok';
  criticalCount: number;
  warningCount: number;
}

const CLUSTER_RADIUS = 150; // metres – assets within ±150m are same site

function buildClusters(assets: LinearAsset[]): Cluster[] {
  const sorted = [...assets].sort((a, b) => a.station - b.station);
  const groups: LinearAsset[][] = [];

  for (const a of sorted) {
    const last = groups[groups.length - 1];
    if (last && a.station - last[last.length - 1].station <= CLUSTER_RADIUS) {
      last.push(a);
    } else {
      groups.push([a]);
    }
  }

  return groups
    .filter(g => g.length > 0)
    .map((g, i) => {
      const centreStation = g.reduce((s, a) => s + a.station, 0) / g.length;
      const centreElev    = g.reduce((s, a) => s + a.invert_level, 0) / g.length;
      const typeCounts: Record<string, number> = {};
      let criticalCount = 0, warningCount = 0;
      for (const a of g) {
        const t = getType(a.equipment_code || '');
        typeCounts[t] = (typeCounts[t] || 0) + 1;
        const th = getThickness(a);
        if (th > 0 && th < 10)  criticalCount++;
        else if (th > 0 && th < 16) warningCount++;
      }
      const riskScore = Math.min(100,
        (criticalCount * 40 + warningCount * 15) / Math.max(g.length, 1)
      );
      return {
        id: `cluster-${i}`,
        centreStation,
        centreElev,
        assets: g,
        sector: g[0].technical?.route_sector || 'Unknown',
        typeCounts,
        riskScore,
        riskLabel: riskScore >= 35 ? 'critical' : riskScore >= 10 ? 'warning' : 'ok',
        criticalCount,
        warningCount,
      } as Cluster;
    });
}

// ── Component ─────────────────────────────────────────────────────────────
export default function StationClustersPanel({ assets, onAssetSelect }: Props) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'multi'>('critical');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>('all');

  const clusters = useMemo(() => buildClusters(assets), [assets]);

  const sectors = useMemo(() => {
    const s = new Set(clusters.map(c => c.sector));
    return ['all', ...Array.from(s).sort()];
  }, [clusters]);

  const filtered = useMemo(() => {
    let list = clusters;
    if (sectorFilter !== 'all') list = list.filter(c => c.sector === sectorFilter);
    if (filter === 'critical') list = list.filter(c => c.riskLabel === 'critical');
    else if (filter === 'warning') list = list.filter(c => c.riskLabel !== 'ok');
    else if (filter === 'multi')   list = list.filter(c => c.assets.length > 1);
    return list.sort((a, b) => b.riskScore - a.riskScore);
  }, [clusters, filter, sectorFilter]);

  // Summary stats
  const totalSites    = clusters.length;
  const multiAsset    = clusters.filter(c => c.assets.length > 1).length;
  const criticalSites = clusters.filter(c => c.riskLabel === 'critical').length;
  // Field visit efficiency: if each site = 1 visit, vs visiting individually
  const totalAssets   = assets.length;
  const visitSaving   = totalAssets - totalSites;

  if (assets.length === 0) return null;

  return (
    <div className="space-y-4">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'إجمالي المواقع الميدانية', value: totalSites, sub: `من ${totalAssets} أصل`, color: '#0ea5e9' },
          { label: 'مواقع متعددة الأصول', value: multiAsset, sub: 'أصلان+ في موقع واحد', color: '#8b5cf6' },
          { label: 'مواقع حرجة', value: criticalSites, sub: 'تحتاج أولوية فورية', color: '#f43f5e' },
          { label: 'توفير في الزيارات', value: `${visitSaving}+`, sub: 'زيارة يمكن توفيرها', color: '#10b981' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
            <p className="text-[10px] text-slate-500 mb-1">{card.label}</p>
            <p className="text-2xl font-black font-mono" style={{ color: card.color }}>{card.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          ['critical', '⚠ حرجة فقط', '#f43f5e'],
          ['warning',  '⚡ تحتاج مراقبة', '#f59e0b'],
          ['multi',    '📍 متعددة الأصول', '#8b5cf6'],
          ['all',      'كل المواقع', '#64748b'],
        ] as [string, string, string][]).map(([key, label, color]) => (
          <button key={key} onClick={() => setFilter(key as typeof filter)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition-all ${
              filter === key ? 'border-transparent text-white' : 'border-white/8 text-slate-500'
            }`}
            style={filter === key ? { background: color + '22', borderColor: color + '55', color } : {}}>
            {label}
          </button>
        ))}
        <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
          className="mr-auto rounded-lg border border-white/8 bg-slate-900 px-3 py-1 text-[11px] text-slate-300">
          {sectors.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'كل القطاعات' : s}</option>
          ))}
        </select>
        <span className="text-[10px] text-slate-600">{filtered.length} موقع</span>
      </div>

      {/* ── Cluster list ── */}
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-600 text-sm">لا توجد مواقع تطابق الفلتر</div>
        )}
        {filtered.map(cluster => {
          const isOpen = expanded === cluster.id;
          const riskColors = {
            critical: { border: 'border-rose-500/25',   bg: 'bg-rose-500/5',   dot: 'bg-rose-500',   text: 'text-rose-400' },
            warning:  { border: 'border-amber-500/25',  bg: 'bg-amber-500/5',  dot: 'bg-amber-500',  text: 'text-amber-400' },
            ok:       { border: 'border-slate-700/40',  bg: 'bg-slate-950/40', dot: 'bg-emerald-500',text: 'text-emerald-400' },
          }[cluster.riskLabel];

          return (
            <div key={cluster.id} className={`rounded-2xl border ${riskColors.border} ${riskColors.bg} transition-all`}>
              {/* Cluster header */}
              <button className="w-full text-left px-4 py-3 flex items-start gap-3"
                onClick={() => setExpanded(isOpen ? null : cluster.id)}>
                {/* Risk dot */}
                <div className="mt-1 flex-shrink-0">
                  <span className={`inline-block w-2 h-2 rounded-full ${riskColors.dot} ${cluster.riskLabel === 'critical' ? 'animate-pulse' : ''}`} />
                </div>

                {/* Station info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm text-white">
                      C{Math.floor(cluster.centreStation / 1000)}+{String(Math.floor(cluster.centreStation % 1000)).padStart(3,'0')}
                    </span>
                    <span className="text-[10px] text-slate-500 bg-slate-800/60 rounded px-1.5 py-0.5 font-mono">
                      {cluster.sector}
                    </span>
                    <span className="text-[10px] text-slate-500">↑{cluster.centreElev.toFixed(1)}م</span>
                    {cluster.assets.length > 1 && (
                      <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 rounded px-1.5 py-0.5">
                        {cluster.assets.length} أصل
                      </span>
                    )}
                  </div>

                  {/* Type chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.entries(cluster.typeCounts).map(([type, count]) => (
                      <span key={type} className="text-[10px] font-mono rounded px-1.5 py-0.5 border"
                        style={{ color: TYPE_COLOR[type] || '#64748b', borderColor: (TYPE_COLOR[type] || '#64748b') + '40', background: (TYPE_COLOR[type] || '#64748b') + '12' }}>
                        {TYPE_LABEL[type]}×{count}
                      </span>
                    ))}
                    {cluster.criticalCount > 0 && (
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 rounded px-1.5 py-0.5 border border-rose-500/30">
                        ⚠ {cluster.criticalCount} حرجة
                      </span>
                    )}
                  </div>
                </div>

                {/* Risk score */}
                <div className="flex-shrink-0 text-right">
                  <div className={`text-lg font-black font-mono ${riskColors.text}`}>
                    {Math.round(cluster.riskScore)}
                  </div>
                  <div className="text-[9px] text-slate-600">خطورة</div>
                </div>

                {/* Expand arrow */}
                <div className="flex-shrink-0 text-slate-600 text-xs mt-1">
                  {isOpen ? '▲' : '▼'}
                </div>
              </button>

              {/* Expanded: asset list */}
              {isOpen && (
                <div className="border-t border-white/5 px-4 py-3 space-y-1.5">
                  <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">
                    قائمة الأصول في هذا الموقع (نقر للعرض التفصيلي)
                  </p>
                  {cluster.assets.map(a => {
                    const t  = getThickness(a);
                    const tc = t > 0 && t < 10 ? '#f43f5e' : t > 0 && t < 16 ? '#f59e0b' : '#10b981';
                    return (
                      <button key={a.id}
                        className="w-full flex items-center gap-3 rounded-xl bg-black/30 hover:bg-black/50 px-3 py-2 text-left transition-colors"
                        onClick={() => onAssetSelect?.(a.id)}>
                        <span className="font-mono text-xs font-bold text-white w-32 flex-shrink-0">{a.equipment_code}</span>
                        <span className="text-[11px] text-slate-400 flex-1 truncate">{a.name}</span>
                        {t > 0 && (
                          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: tc }}>
                            {t}mm
                          </span>
                        )}
                        <span className="text-[10px] text-slate-600 font-mono flex-shrink-0">
                          {a.invert_level.toFixed(1)}م
                        </span>
                      </button>
                    );
                  })}

                  {/* Field visit card summary */}
                  <div className="mt-3 rounded-xl bg-slate-900/60 border border-white/5 p-3">
                    <p className="text-[10px] text-slate-500 mb-2 font-bold uppercase tracking-wider">بطاقة الزيارة الميدانية</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-base font-black text-white">{cluster.assets.length}</p>
                        <p className="text-[9px] text-slate-600">أصل للخدمة</p>
                      </div>
                      <div>
                        <p className="text-base font-black text-amber-400">{cluster.warningCount + cluster.criticalCount}</p>
                        <p className="text-[9px] text-slate-600">يحتاج فحصاً</p>
                      </div>
                      <div>
                        <p className="text-base font-black text-cyan-400">
                          C{Math.floor(cluster.centreStation / 1000)}+{String(Math.floor(cluster.centreStation % 1000)).padStart(3,'0')}
                        </p>
                        <p className="text-[9px] text-slate-600">موقع الوصول</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
