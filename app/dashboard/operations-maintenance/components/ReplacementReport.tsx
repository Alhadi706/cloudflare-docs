'use client';

/**
 * ReplacementReport
 * ─────────────────────────────────────────────────────────────
 * تقرير مواصفات الصمامات (SAV/DAV) — يحلّل حقل القطر لكل SAV/DAV
 * ويستخرج درجة الضغط التصميمية (PN) — الصيغة: DN × PN
 * مثال: "150x06" → DN150 mm, PN6 (6 bar rated) — الرقم الثاني درجة ضغط وليس سماكة.
 * ─────────────────────────────────────────────────────────────
 */

import React, { useMemo, useState } from 'react';
import { LinearAsset } from '@/lib/linear-referencing/types';

interface Props {
  assets: LinearAsset[];
  onAssetSelect?: (id: string) => void;
}

// Returns the pressure class (PN) from the diameter field — e.g. "150x06" → 6 (PN6 = 6 bar rated)
// NOTE: the second number is pressure class in bar, NOT wall thickness in mm.
function getPressureClass(a: LinearAsset): number {
  const d = a.technical?.diameter || '';
  if (d.includes('x')) { const pn = parseFloat(d.split('x')[1]); return isNaN(pn) ? -1 : pn; }
  return -1;
}
function getDiameter(a: LinearAsset): number {
  const d = a.technical?.diameter || '';
  const p = parseFloat(d.split('x')[0]);
  return isNaN(p) ? -1 : p;
}

// ── Types ─────────────────────────────────────────────────────────────────
interface PartGroup {
  key: string;          // e.g. "150×06" i.e. DN150 × PN6
  diamMm: number;       // DN (nominal diameter in mm)
  pn: number;           // PN (pressure class in bar) — NOT wall thickness
  count: number;
  assets: LinearAsset[];
  urgency: 'high-pn' | 'mid-pn' | 'low-pn';  // classification by pressure class
}

// ── Build parts analysis ──────────────────────────────────────────────────
function buildPartGroups(assets: LinearAsset[]): PartGroup[] {
  const valves = assets.filter(a => {
    const c = a.equipment_code || '';
    return c.startsWith('SAV') || c.startsWith('DAV');
  });

  const map: Record<string, LinearAsset[]> = {};
  for (const a of valves) {
    const d = a.technical?.diameter || '';
    if (!d || !d.includes('x')) continue;
    const key = d.replace(' ', '');
    if (!map[key]) map[key] = [];
    map[key].push(a);
  }

  return Object.entries(map)
    .map(([key, list]) => {
      const pn  = getPressureClass(list[0]);
      const dm  = getDiameter(list[0]);
      return {
        key,
        diamMm: dm,
        pn,
        count: list.length,
        assets: list,
        // Classification by PN: ≥ 10 → high-pn (green), 8 → mid-pn (amber), 6 → low-pn (sky)
        urgency: pn >= 10 ? 'high-pn' : pn >= 8 ? 'mid-pn' : 'low-pn',
      } as PartGroup;
    })
    .sort((a, b) => a.pn - b.pn || a.diamMm - b.diamMm);
}

// ── Summary totals ──────────────────────────────────────────────────────────────────
interface SectorReplacement {
  sector: string;
  lowPn: number;
  midPn: number;
  total: number;
}

function buildSectorBreakdown(assets: LinearAsset[]): SectorReplacement[] {
  const map: Record<string, SectorReplacement> = {};
  for (const a of assets) {
    const c = a.equipment_code || '';
    if (!c.startsWith('SAV') && !c.startsWith('DAV')) continue;
    const pn = getPressureClass(a);
    if (pn < 0) continue;
    const s = a.technical?.route_sector || 'Unknown';
    if (!map[s]) map[s] = { sector: s, lowPn: 0, midPn: 0, total: 0 };
    map[s].total++;
    if (pn < 8)        map[s].lowPn++;
    else if (pn < 10)  map[s].midPn++;
  }
  return Object.values(map).sort((a, b) => b.lowPn - a.lowPn);
}

// ── Component ─────────────────────────────────────────────────────────────
export default function ReplacementReport({ assets, onAssetSelect }: Props) {
  const [view, setView]         = useState<'parts' | 'sector' | 'list'>('parts');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const parts   = useMemo(() => buildPartGroups(assets), [assets]);
  const sectors = useMemo(() => buildSectorBreakdown(assets), [assets]);

  const totalLowPn     = parts.filter(p => p.pn < 8).reduce((s, p) => s + p.count, 0);
  const totalMidPn     = parts.filter(p => p.pn >= 8 && p.pn < 10).reduce((s, p) => s + p.count, 0);
  const totalValves    = assets.filter(a => { const c = a.equipment_code||''; return c.startsWith('SAV')||c.startsWith('DAV'); }).length;
  const uniqueDiams    = new Set(parts.map(p => p.diamMm)).size;

  if (assets.length === 0) return null;

  return (
    <div className="space-y-4">

      {/* ── ملاحظة تصميمية ── */}
      <div className="flex items-start gap-2 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-3 text-[13px] text-cyan-300/80">
        <span className="mt-0.5 shrink-0">ℹ️</span>
        <span>البيانات من مواصفات التصميم الهندسي (DN × PN). الرقم الثاني في الكود هو <strong>درجة الضغط التصميمي PN</strong> (بالبار) وليس سماكة الجدار — مثال: &quot;150x06&quot; = DN150 mm, PN6 (مُصنَّف عند 6 bar).</span>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'إجمالي صمامات SAV/DAV', value: totalValves, color: '#0ea5e9', sub: 'تحت الرصد التصميمي' },
          { label: 'مواصفة PN6 (6 bar)', value: totalLowPn, color: '#38bdf8', sub: 'درجة ضغط تصميمية أساسية' },
          { label: 'مواصفة PN8 (8 bar)', value: totalMidPn, color: '#f59e0b', sub: 'درجة ضغط تصميمية متوسطة' },
          { label: 'تشكيلات DN×PN مختلفة', value: uniqueDiams, color: '#8b5cf6', sub: 'نوع صنف مختلف' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
            <p className="text-[13px] text-slate-500 mb-1">{c.label}</p>
            <p className="text-2xl font-black font-mono" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[13px] text-slate-600 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── View tabs ── */}
      <div className="flex gap-2">
        {([
          ['parts',  'قائمة المواصفات (Parts List)'],
          ['sector', 'توزيع القطاعات'],
          ['list',   'جميع الصمامات'],
        ] as [string, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setView(k as typeof view)}
            className={`rounded-full px-4 py-1.5 text-base font-semibold border transition-all ${
              view === k ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'border-white/8 text-slate-500'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Parts List view ── */}
      {view === 'parts' && (
        <div className="space-y-2">
          <p className="text-[13px] text-slate-500">
            قائمة المواصفات مرتّبة حسب درجة الضغط (PN) — استخدمها كأساس لقوائم المشتريات الاحتياطية
          </p>

          {/* Table header */}
          <div className="grid grid-cols-6 gap-2 px-3 py-1.5 text-[13px] text-slate-600 uppercase tracking-wider border-b border-white/5">
            <span className="col-span-2">المواصفة (DN × PN)</span>
            <span className="text-center">المجموع</span>
            <span className="text-center">PN6</span>
            <span className="text-center">PN8</span>
            <span className="text-center">درجة الضغط</span>
          </div>

          {parts.map(p => {
            const isOpen = expandedKey === p.key;
            const urgColors = {
              'high-pn': { bg: 'bg-emerald-500/5 border-emerald-500/15', badge: 'bg-emerald-500/15 text-emerald-400' },
              'mid-pn':  { bg: 'bg-amber-500/5 border-amber-500/15',    badge: 'bg-amber-500/20 text-amber-300' },
              'low-pn':  { bg: 'bg-sky-500/5 border-sky-500/15',        badge: 'bg-sky-500/20 text-sky-300' },
            }[p.urgency];
            const lowPnCount  = p.pn < 8  ? p.count : 0;
            const midPnCount  = (p.pn >= 8 && p.pn < 10) ? p.count : 0;

            return (
              <div key={p.key} className={`rounded-2xl border ${urgColors!.bg}`}>
                <button className="w-full grid grid-cols-6 gap-2 items-center px-3 py-3 text-base"
                  onClick={() => setExpandedKey(isOpen ? null : p.key)}>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{p.key}</span>
                    <span className="text-[14px] text-slate-500">DN{p.diamMm} × PN{p.pn}</span>
                  </div>
                  <span className="text-center font-mono font-bold text-slate-300">{p.count}</span>
                  <span className={`text-center font-mono font-bold ${lowPnCount > 0 ? 'text-sky-400' : 'text-slate-600'}`}>
                    {lowPnCount > 0 ? lowPnCount : '—'}
                  </span>
                  <span className={`text-center font-mono font-bold ${midPnCount > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                    {midPnCount > 0 ? midPnCount : '—'}
                  </span>
                  <span className={`text-center text-[13px] font-bold rounded-full px-2 py-0.5 ${urgColors!.badge}`}>
                    PN{p.pn}
                  </span>
                </button>

                {/* Expanded: asset list */}
                {isOpen && (
                  <div className="border-t border-white/5 px-3 pb-3 space-y-1">
                    <p className="text-[13px] text-slate-500 pt-2 pb-1">
                      الأصول بمواصفة {p.key} (DN{p.diamMm} × PN{p.pn})
                    </p>
                    {p.assets.map(a => {
                        const pnA = getPressureClass(a);
                        const tc = pnA >= 10 ? '#10b981' : pnA >= 8 ? '#f59e0b' : '#38bdf8';
                        return (
                          <button key={a.id}
                            className="w-full flex items-center gap-3 rounded-lg bg-black/30 hover:bg-black/50 px-3 py-1.5 text-left"
                            onClick={() => onAssetSelect?.(a.id)}>
                            <span className="font-mono text-[13px] text-white w-28 flex-shrink-0">{a.equipment_code}</span>
                            <span className="text-[13px] text-slate-500 flex-1 truncate">{a.technical?.route_sector}</span>
                            <span className="text-[13px] font-mono text-slate-600">C{Math.floor(a.station/1000)}+{String(a.station%1000|0).padStart(3,'0')}</span>
                            <span className="font-mono font-bold text-[13px] flex-shrink-0" style={{ color: tc }}>PN{pnA}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Sector breakdown view ── */}
      {view === 'sector' && (
        <div className="space-y-2">
          {sectors.map(s => {
            const lowPct  = s.total > 0 ? s.lowPn / s.total * 100 : 0;
            const midPct  = s.total > 0 ? s.midPn / s.total * 100 : 0;
            const highPct = 100 - lowPct - midPct;
            return (
              <div key={s.sector} className="rounded-2xl border border-white/8 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono font-bold text-base text-white">{s.sector}</span>
                  <div className="flex gap-3 text-[13px]">
                    {s.lowPn > 0 && <span className="text-sky-400 font-bold">{s.lowPn} × PN6</span>}
                    {s.midPn > 0 && <span className="text-amber-400">{s.midPn} × PN8</span>}
                    <span className="text-slate-500">{s.total} إجمالي</span>
                  </div>
                </div>
                {/* Stacked bar */}
                <div className="flex h-3 rounded-full overflow-hidden gap-px">
                  {lowPct  > 0 && <div style={{ width: `${lowPct}%` }}  className="bg-sky-500" />}
                  {midPct  > 0 && <div style={{ width: `${midPct}%` }}  className="bg-amber-500" />}
                  {highPct > 0 && <div style={{ width: `${highPct}%` }} className="bg-emerald-600" />}
                </div>
                <div className="flex gap-4 mt-1.5 text-[14px] text-slate-600">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500 inline-block" /> PN6 {lowPct.toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> PN8 {midPct.toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-600 inline-block" /> PN≥10 {highPct.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Full assets list view ── */}
      {view === 'list' && (
        <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
          <p className="text-[13px] text-slate-500 mb-2">قائمة الصمامات SAV/DAV مرتّبة حسب درجة الضغط التصميمي (PN) — البيانات من مواصفات التصميم</p>
          {assets
            .filter(a => {
              const c = a.equipment_code || '';
              return c.startsWith('SAV') || c.startsWith('DAV');
            })
            .sort((a, b) => getPressureClass(a) - getPressureClass(b))
            .map(a => {
              const pnA = getPressureClass(a);
              const isLow = pnA > 0 && pnA < 8;
              return (
                <button key={a.id}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${
                    isLow ? 'border-sky-500/20 bg-sky-500/5' : 'border-white/8 bg-white/2'
                  }`}
                  onClick={() => onAssetSelect?.(a.id)}>
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${isLow ? 'bg-sky-400' : 'bg-emerald-500'}`} />
                  <span className="font-mono font-bold text-[14px] text-white w-28 flex-shrink-0">{a.equipment_code}</span>
                  <span className="text-[13px] text-slate-500 bg-slate-800/50 rounded px-1.5 py-0.5 font-mono flex-shrink-0">{a.technical?.route_sector}</span>
                  <span className="text-[13px] text-slate-600 font-mono flex-shrink-0">C{Math.floor(a.station/1000)}+{String(a.station%1000|0).padStart(3,'0')}</span>
                  <span className="flex-1" />
                  <span className="font-mono font-black text-base flex-shrink-0" style={{ color: pnA >= 10 ? '#10b981' : pnA >= 8 ? '#f59e0b' : '#38bdf8' }}>
                    PN{pnA}
                  </span>
                  <span className={`text-[13px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 ${
                    pnA >= 10 ? 'bg-emerald-500/20 text-emerald-300' : pnA >= 8 ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                  }`}>
                    {pnA >= 10 ? 'PN عالي' : pnA >= 8 ? 'PN متوسط' : 'PN أساسي'}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
