'use client';

/**
 * SectorBenchmarkPanel — مقارنة المواصفات التصميمية بين القطاعات
 * ─────────────────────────────────────────────────────────────
 * يعرض هذا المكوّن المواصفات التصميمية مقارنةً بين القطاعات:
 *  - توزيع فئات الضغط PN
 *  - متوسط قطر التصميم DN
 *  - كثافة الأصول لكل كيلومتر
 *  - اكتمال المواصفات (جودة البيانات)
 *  - نطاق المنسوب وفارق الارتفاع
 *
 * لا يحسب هذا المكوّن "مخاطر" أو "تنبيهات" — البيانات تصميمية فقط.
 * ─────────────────────────────────────────────────────────────
 */

import React, { useMemo, useState } from 'react';
import { LinearAsset } from '@/lib/linear-referencing/types';

interface Props {
  assets: LinearAsset[];
}

function getPn(a: LinearAsset): number {
  const d = a.technical?.diameter || '';
  if (d.includes('x')) { const t = parseFloat(d.split('x')[1]); return isNaN(t) ? -1 : t; }
  return -1;
}

function getDn(a: LinearAsset): number {
  const d = a.technical?.diameter || '';
  if (d.includes('x')) { const v = parseFloat(d.split('x')[0]); return isNaN(v) ? -1 : v; }
  return -1;
}

function getType(code: string): string {
  if (code.startsWith('PUWE')) return 'PUWE';
  if (code.startsWith('SAV'))  return 'SAV';
  if (code.startsWith('DAV'))  return 'DAV';
  if (code.startsWith('M/H') || code.startsWith('MH')) return 'MH';
  if (code.startsWith('PU'))   return 'PU';
  if (code.startsWith('WT'))   return 'WT';
  return 'OTHER';
}

interface SectorMetrics {
  sector: string;
  totalAssets: number;
  valveCount: number;
  mhCount: number;
  puCount: number;
  avgPn: number;
  minPn: number;
  maxPn: number;
  avgDn: number;
  avgElev: number;
  minElev: number;
  maxElev: number;
  elevDelta: number;
  lengthKm: number;
  assetDensity: number;
  dataQuality: number;   // % of valves with complete DN×PN
  pnDist: Record<number, number>;  // PN value → count
}

function buildSectorMetrics(assets: LinearAsset[]): SectorMetrics[] {
  const sectorMap: Record<string, LinearAsset[]> = {};
  for (const a of assets) {
    const s = a.technical?.route_sector || 'Unknown';
    if (!sectorMap[s]) sectorMap[s] = [];
    sectorMap[s].push(a);
  }

  return Object.entries(sectorMap).map(([sector, list]) => {
    const stations = list.map(a => a.station).filter(s => s > 0);
    const elevs    = list.map(a => a.invert_level).filter(e => e > 0);
    const minSt    = stations.length ? Math.min(...stations) : 0;
    const maxSt    = stations.length ? Math.max(...stations) : 0;
    const lengthKm = (maxSt - minSt) / 1000;

    const valves = list.filter(a => { const t = getType(a.equipment_code||''); return t==='SAV'||t==='DAV'; });
    const mhs    = list.filter(a => getType(a.equipment_code||'') === 'MH');
    const pus    = list.filter(a => { const t = getType(a.equipment_code||''); return t==='PU'||t==='PUWE'||t==='WT'; });

    const maxElev  = elevs.length ? Math.max(...elevs) : 0;
    const minElev  = elevs.length ? Math.min(...elevs) : 0;
    const avgElev  = elevs.length ? elevs.reduce((a,b) => a+b, 0) / elevs.length : 0;
    const elevDelta = maxElev - minElev;

    const withPn = valves.filter(a => getPn(a) > 0);
    const withDn = valves.filter(a => getDn(a) > 0);
    const withFull = valves.filter(a => getPn(a) > 0 && getDn(a) > 0);

    const avgPn = withPn.length ? withPn.reduce((s,a) => s + getPn(a), 0) / withPn.length : -1;
    const minPn = withPn.length ? Math.min(...withPn.map(a => getPn(a))) : -1;
    const maxPn = withPn.length ? Math.max(...withPn.map(a => getPn(a))) : -1;
    const avgDn = withDn.length ? withDn.reduce((s,a) => s + getDn(a), 0) / withDn.length : -1;

    // PN distribution
    const pnDist: Record<number, number> = {};
    for (const a of withPn) {
      const pn = getPn(a);
      pnDist[pn] = (pnDist[pn] || 0) + 1;
    }

    const dataQuality = valves.length > 0 ? withFull.length / valves.length * 100 : 100;

    return {
      sector, totalAssets: list.length,
      valveCount: valves.length, mhCount: mhs.length, puCount: pus.length,
      avgPn, minPn, maxPn, avgDn,
      avgElev, minElev, maxElev, elevDelta,
      lengthKm, assetDensity: lengthKm > 0 ? list.length / lengthKm : 0,
      dataQuality, pnDist,
    } as SectorMetrics;
  }).sort((a,b) => b.totalAssets - a.totalAssets);
}

type SortKey = 'totalAssets' | 'avgPn' | 'assetDensity' | 'dataQuality' | 'lengthKm' | 'elevDelta';

export default function SectorBenchmarkPanel({ assets }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('totalAssets');
  const [descending, setDescending] = useState(true);
  const [highlightSector, setHighlightSector] = useState<string | null>(null);

  const metrics = useMemo(() => buildSectorMetrics(assets), [assets]);

  const sorted = useMemo(() => {
    const list = [...metrics];
    list.sort((a,b) => descending ? (b[sortBy] as number) - (a[sortBy] as number) : (a[sortBy] as number) - (b[sortBy] as number));
    return list;
  }, [metrics, sortBy, descending]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setDescending(!descending);
    else { setSortBy(key); setDescending(true); }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)}
      className={`text-[15px] px-2 py-1 rounded border transition-all ${
        sortBy===k ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'border-white/8 text-slate-500 hover:text-white'
      }`}>
      {label} {sortBy===k ? (descending?'↓':'↑') : ''}
    </button>
  );

  const maxDensity = Math.max(...metrics.map(m=>m.assetDensity), 1);

  if (assets.length === 0) return null;

  // All unique PN values across all sectors
  const allPnVals = Array.from(new Set(
    metrics.flatMap(m => Object.keys(m.pnDist).map(Number))
  )).sort((a,b)=>a-b);

  return (
    <div className="space-y-4">

      {/* ── ملاحظة منهجية ── */}
      <div className="flex items-start gap-2 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-3 text-[15px] text-cyan-300/80">
        <span className="mt-0.5 shrink-0">📐</span>
        <span>
          هذه <strong>مواصفات تصميمية</strong> بحسب القطاع — تشمل فئات الضغط PN، متوسط القطر DN،
          كثافة الأصول، وجودة توثيق المواصفات. لا تُمثّل هذه الأرقام حالةً تشغيليةً فعليةً.
          البيانات مصدرها: مواصفات التصميم (DN × PN).
        </span>
      </div>

      {/* ── Global stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'أعلى كثافة أصول',
            value: [...metrics].sort((a,b)=>b.assetDensity-a.assetDensity)[0]?.sector||'—',
            sub: `${[...metrics].sort((a,b)=>b.assetDensity-a.assetDensity)[0]?.assetDensity.toFixed(1)} أصل/كم`,
            color: '#0ea5e9' },
          { label: 'أعلى متوسط PN تصميمي',
            value: [...metrics].filter(m=>m.avgPn>0).sort((a,b)=>b.avgPn-a.avgPn)[0]?.sector||'—',
            sub: `PN${[...metrics].filter(m=>m.avgPn>0).sort((a,b)=>b.avgPn-a.avgPn)[0]?.avgPn.toFixed(1)||'—'}`,
            color: '#10b981' },
          { label: 'أطول قطاع',
            value: [...metrics].sort((a,b)=>b.lengthKm-a.lengthKm)[0]?.sector||'—',
            sub: `${[...metrics].sort((a,b)=>b.lengthKm-a.lengthKm)[0]?.lengthKm.toFixed(0)} كم`,
            color: '#8b5cf6' },
          { label: 'أقل اكتمال مواصفات',
            value: [...metrics].filter(m=>m.valveCount>0).sort((a,b)=>a.dataQuality-b.dataQuality)[0]?.sector||'—',
            sub: `${[...metrics].filter(m=>m.valveCount>0).sort((a,b)=>a.dataQuality-b.dataQuality)[0]?.dataQuality.toFixed(0)||100}%`,
            color: '#f59e0b' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
            <p className="text-[15px] text-slate-500 mb-1">{c.label}</p>
            <p className="text-xl font-black font-mono" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[15px] text-slate-600 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Sort controls ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[15px] text-slate-600">ترتيب حسب:</span>
        <SortBtn k="totalAssets"   label="عدد الأصول" />
        <SortBtn k="avgPn"         label="متوسط PN" />
        <SortBtn k="assetDensity"  label="الكثافة/كم" />
        <SortBtn k="dataQuality"   label="جودة البيانات" />
        <SortBtn k="lengthKm"      label="الطول" />
        <SortBtn k="elevDelta"     label="فارق المنسوب" />
      </div>

      {/* ── Benchmark cards ── */}
      <div className="space-y-2">
        {sorted.map((m, rank) => {
          const isHL = highlightSector === m.sector;
          return (
            <div key={m.sector}
              className={`rounded-2xl border border-white/8 bg-slate-950/40 transition-all cursor-pointer ${isHL ? 'ring-1 ring-cyan-500/30' : ''}`}
              onClick={() => setHighlightSector(isHL ? null : m.sector)}>
              <div className="px-4 py-3">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[15px] font-mono font-bold text-slate-500">#{rank+1}</span>
                  <span className="font-mono font-bold text-base text-white">{m.sector}</span>
                  <div className="flex gap-2 text-[15px] ml-2">
                    <span className="text-slate-600">{m.totalAssets} أصل</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-600">{m.lengthKm.toFixed(0)} كم</span>
                    {m.puCount > 0 && <span className="text-violet-400 font-bold">{m.puCount} محطة</span>}
                  </div>
                </div>

                {/* Metric bars */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">

                  {/* Asset density */}
                  <div>
                    <div className="flex justify-between text-[14px] text-slate-500 mb-0.5">
                      <span>كثافة الأصول/كم</span>
                      <span className="text-sky-400">{m.assetDensity.toFixed(1)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${(m.assetDensity/maxDensity)*100}%` }} />
                    </div>
                  </div>

                  {/* Avg PN */}
                  <div>
                    <div className="flex justify-between text-[14px] text-slate-500 mb-0.5">
                      <span>متوسط PN تصميمي</span>
                      <span className={m.avgPn>0 ? 'text-emerald-400' : 'text-slate-600'}>
                        {m.avgPn > 0 ? `PN${m.avgPn.toFixed(1)}` : 'غير متاح'}
                      </span>
                    </div>
                    {m.avgPn > 0 && (
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, m.avgPn / 16 * 100)}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Data quality */}
                  <div>
                    <div className="flex justify-between text-[14px] text-slate-500 mb-0.5">
                      <span>اكتمال المواصفات</span>
                      <span className={m.dataQuality<70?'text-amber-400':m.dataQuality<90?'text-sky-400':'text-emerald-400'}>
                        {m.dataQuality.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${m.dataQuality}%`, background: m.dataQuality<70?'#f59e0b':m.dataQuality<90?'#0ea5e9':'#10b981' }} />
                    </div>
                  </div>

                  {/* Elev delta */}
                  <div>
                    <div className="flex justify-between text-[14px] text-slate-500 mb-0.5">
                      <span>فارق المنسوب</span>
                      <span className="text-slate-400">{m.elevDelta.toFixed(0)} م</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-500 rounded-full"
                        style={{ width: `${Math.min(100, m.elevDelta / 200 * 100)}%` }} />
                    </div>
                  </div>
                </div>

                {/* PN distribution chips */}
                {Object.keys(m.pnDist).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[14px] text-slate-600 self-center">PN:</span>
                    {Object.entries(m.pnDist)
                      .sort((a,b)=>Number(a[0])-Number(b[0]))
                      .map(([pn, cnt]) => {
                        const pnN = Number(pn);
                        const color = pnN >= 16 ? '#10b981' : pnN >= 10 ? '#0ea5e9' : pnN >= 8 ? '#f59e0b' : '#94a3b8';
                        return (
                          <span key={pn} className="text-[14px] font-mono rounded px-1.5 py-0.5 border"
                            style={{ color, borderColor: color+'40', background: color+'12' }}>
                            PN{pn}×{cnt}
                          </span>
                        );
                      })}
                  </div>
                )}

                {/* Expanded details */}
                {isHL && (
                  <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
                    {[
                      { label: 'SAV/DAV', value: m.valveCount, color: '#10b981' },
                      { label: 'بوابات MH', value: m.mhCount, color: '#64748b' },
                      { label: 'محطات PU/WT', value: m.puCount, color: '#818cf8' },
                      { label: 'كثافة/كم', value: m.assetDensity.toFixed(1), color: '#0ea5e9' },
                      { label: 'أدنى PN تصميمي', value: m.minPn > 0 ? `PN${m.minPn}` : '—', color: '#94a3b8' },
                      { label: 'أعلى PN تصميمي', value: m.maxPn > 0 ? `PN${m.maxPn}` : '—', color: '#10b981' },
                      { label: 'متوسط DN تصميمي', value: m.avgDn > 0 ? `${m.avgDn.toFixed(0)}mm` : '—', color: '#0ea5e9' },
                      { label: 'أدنى/أعلى منسوب', value: `${m.minElev.toFixed(0)}–${m.maxElev.toFixed(0)}م`, color: '#f59e0b' },
                    ].map(d => (
                      <div key={d.label} className="rounded-xl bg-black/30 px-3 py-2">
                        <p className="text-[14px] text-slate-600">{d.label}</p>
                        <p className="font-mono font-bold text-base" style={{ color: d.color }}>{d.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
