'use client';

import React, { useMemo, useState } from 'react';
import { LinearAsset } from '@/lib/linear-referencing/types';

interface Alert {
  assetId: string;
  code: string;
  name: string;
  station: number;
  sector: string;
  severity: 'critical' | 'warning';
  reasons: string[];
  score: number; // higher = more urgent
}

function buildAlerts(assets: LinearAsset[], minElev: number, maxElev: number): Alert[] {
  const out: Alert[] = [];
  const elevRange = maxElev - minElev || 1;

  for (const a of assets) {
    const code = a.equipment_code || '';
    const d = a.technical?.diameter || '';
    const thickness = d.includes('x') ? parseFloat(d.split('x')[1]) : -1;
    const elevPct = (a.invert_level - minElev) / elevRange;
    const estP = (maxElev - a.invert_level) * 0.0981;
    const isSAV = code.startsWith('SAV') || code.startsWith('DAV');

    const reasons: string[] = [];
    let severity: 'critical' | 'warning' | null = null;
    let score = 0;

    if (isSAV && !isNaN(thickness) && thickness > 0) {
      if (thickness < 10) {
        reasons.push(`سماكة جدار ${thickness}mm دون الحد (16mm)`);
        severity = 'critical'; score += 60;
      } else if (thickness < 16) {
        reasons.push(`سماكة جدار ${thickness}mm أقل من المعيار`);
        if (!severity) severity = 'warning'; score += 25;
      }
    }

    if (elevPct < 0.2 && estP > 25) {
      reasons.push(`ضغط مرتفع ~${estP.toFixed(0)} bar`);
      if (!severity) severity = 'warning';
      score += elevPct < 0.1 ? 30 : 15;
    }

    // double-hit: thin wall + high pressure = compound critical
    if (isSAV && !isNaN(thickness) && thickness < 10 && elevPct < 0.2) {
      reasons.push('⚡ خطر مركّب: سماكة منخفضة + ضغط مرتفع');
      severity = 'critical'; score += 40;
    }

    if (severity) {
      out.push({
        assetId: a.id, code, name: a.name || '',
        station: a.station,
        sector: a.technical?.route_sector || '—',
        severity, reasons, score,
      });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

interface Props {
  assets: LinearAsset[];
  onAssetSelect: (id: string) => void;
  selectedId?: string;
}

export function SmartAlertsPanel({ assets, onAssetSelect, selectedId }: Props) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [expanded, setExpanded] = useState(true);

  const elevations = useMemo(() => assets.map(a => a.invert_level).filter(e => e > 0), [assets]);
  const minElev = useMemo(() => Math.min(...elevations), [elevations]);
  const maxElev = useMemo(() => Math.max(...elevations), [elevations]);

  const allAlerts = useMemo(() => buildAlerts(assets, minElev, maxElev), [assets, minElev, maxElev]);

  const critCount = allAlerts.filter(a => a.severity === 'critical').length;
  const warnCount = allAlerts.filter(a => a.severity === 'warning').length;

  const filtered = filter === 'all' ? allAlerts : allAlerts.filter(a => a.severity === filter);

  if (assets.length === 0) return null;

  return (
    <div className="rounded-[20px] border border-white/8 bg-slate-950/70 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`w-2 h-2 rounded-full ${critCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-sm font-bold text-white">تنبيهات الذكاء الهندسي</span>
          {critCount > 0 && (
            <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">
              {critCount} حرج
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
              {warnCount} تحذير
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-600 shrink-0">
          {allAlerts.length} أصل يحتاج مراجعة من أصل {assets.length}
        </span>
        <span className="text-slate-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1 px-4 pt-2.5 pb-0">
            {([
              { key: 'all',      label: `الكل (${allAlerts.length})` },
              { key: 'critical', label: `حرج (${critCount})` },
              { key: 'warning',  label: `تحذير (${warnCount})` },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${filter === key ? (key === 'critical' ? 'bg-rose-500/20 text-rose-400' : key === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white') : 'text-slate-600 hover:text-slate-400'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Alert list */}
          <div className="divide-y divide-white/4 max-h-72 overflow-y-auto">
            {filtered.slice(0, 25).map(alert => {
              const isCrit = alert.severity === 'critical';
              const isSelected = alert.assetId === selectedId;
              return (
                <button key={alert.assetId} onClick={() => onAssetSelect(alert.assetId)}
                  className={`w-full text-right flex items-start gap-3 px-4 py-3 transition-all hover:bg-white/4 ${isSelected ? 'bg-cyan-500/8 border-r-2 border-cyan-400' : ''}`}>
                  <div className="mt-1.5 shrink-0">
                    <div className={`w-2 h-2 rounded-full ${isCrit ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-bold font-mono text-white">{alert.code}</span>
                      <span className="text-[9px] text-slate-600 font-mono">C{Math.floor(alert.station / 1000)}+000</span>
                      <span className="text-[9px] text-slate-700">{alert.sector}</span>
                    </div>
                    {alert.reasons.map((r, i) => (
                      <p key={i} className={`text-[10px] ${isCrit ? 'text-rose-400' : 'text-amber-400'}`}>{r}</p>
                    ))}
                  </div>
                  <div className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 ${isCrit ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {alert.score}
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-slate-600">
                <span className="text-2xl">✓</span>
                <p className="text-sm">لا توجد تنبيهات في هذه الفئة</p>
              </div>
            )}

            {filtered.length > 25 && (
              <div className="px-4 py-3 text-center text-[10px] text-slate-600">
                يعرض أعلى 25 أصلاً بالأولوية — يوجد {filtered.length - 25} إضافي
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
