'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Activity, Droplets, Gauge, Zap, GitBranch } from 'lucide-react';
import { SCADA_USER_LAYOUT } from './scadaUserLayout';

/* ─── helpers ──────────────────────────────────────────────────────────────── */
type MV = number | string | null;
const n  = (v: MV, d = 0): number => { const x = +String(v ?? ''); return isNaN(x) ? d : x; };
const fl = (v: MV): string => { const x = n(v); return x > 0 ? x.toLocaleString('en') : '—'; };
const p  = (v: MV): string => { const x = n(v); return x > 0 ? x.toFixed(1) : '—'; };
const C  = {
  ok: '#22c55e', warn: '#f59e0b', err: '#ef4444',
  cyan: '#22d3ee', idle: '#334155',
  bg: '#020617', card: '#0c1523', border: '#1e293b',
};
const col = (v: MV, warnAt: number, errAt = 9999): string => {
  const x = n(v);
  if (x <= 0) return C.idle;
  if (x >= errAt) return C.err;
  if (x >= warnAt) return C.warn;
  return C.ok;
};

/* ─── Engine type skeletons ────────────────────────────────────────────────── */
interface WFG { wellFieldDailyFlow: MV; workingWells: MV; operatingPumps: MV; outletPressure: MV; forebayTankLevel: MV; }
interface E1R { dayNo: number|null; fezzanTankLevel: MV; ejh: WFG; nejhS: WFG; nejhN: WFG; }
interface E2R { dayNo: number|null;
  aenZara: { outletPressure: MV; openingValvePct: MV; };
  airport: { dailyFlow: MV; outletPressure: MV; inletPressure: MV; openingValvePct: MV; };
  sidiSaiah: { rtLevel: MV; dailyFlow: MV; };
  garabulli: { rtLevel: MV; dailyFlow: MV; };
  wadiTumallah: { rtLevel: MV; dailyFlow: MV; };
  ashShwayrifRtLevel: MV;
  ashShwayrifFcs: { dailyFlow: MV; };
}
interface E3R { dayNo: number|null;
  crossConnections: { totalFlow: MV; outletPressure: MV; inletPressure: MV; };
  sidiSied: { level: MV; totalFlow: MV; };
  tarhunah: { level: MV; totalFlow: MV; noPumps: MV; outletPressure: MV; };
  ashShwayrifFcs: { dailyFlow: MV; };
}
interface E4R { dayNo: number|null;
  ps1: { pumpingVolume: MV; activePumpNo: MV; outletPressure: MV; totalOperationHours: MV; inletPressure: MV; };
  ps2: { pumpingToTank: MV; activePumpNo: MV; outletPressure: MV; totalOperationHours: MV; inletPressure: MV; };
  tankLevel: { cellA: MV; cellB: MV; cellC: MV; cellD: MV; cellE: MV; };
  gharyanConsumption: MV;
}
interface EngState<T> { filename: string; sheetName: string; readings: T[]; issues?: string[]; }

export interface SCADAViewProps {
  engine1: EngState<E1R> | null;
  engine2: EngState<E2R> | null;
  engine3: EngState<E3R> | null;
  engine4: EngState<E4R> | null;
}

/* ─── Sub-views definition ──────────────────────────────────────────────────── */
const VIEWS = [
  { id: 'overview',  label: 'نظرة عامة',    icon: Activity },
  { id: 'fields',    label: 'حقول الآبار',  icon: Droplets },
  { id: 'eastern',   label: 'الفرع الشرقي', icon: GitBranch },
  { id: 'central',   label: 'الوسط / طز',   icon: Gauge },
] as const;
type ViewId = typeof VIEWS[number]['id'];

/* ─── Reusable components ───────────────────────────────────────────────────── */
function KCard({ label, value, unit, color = C.cyan, icon: Icon }:
  { label: string; value: string; unit: string; color?: string; icon?: React.ElementType }) {
  return (
    <div style={{ background: C.card, borderColor: color + '44' }}
      className="border rounded-xl p-4 flex flex-col gap-1.5 min-w-0">
      {Icon && <Icon style={{ color }} className="w-4 h-4 mb-1 shrink-0" />}
      <span className="text-[10px] text-slate-400 tracking-wide uppercase">{label}</span>
      <span style={{ color }} className="text-xl font-bold font-mono leading-none">{value}</span>
      <span className="text-[10px] text-slate-500">{unit}</span>
    </div>
  );
}

function DataRow({ label, value, unit, highlight = false }:
  { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono font-semibold ${highlight ? 'text-cyan-300' : 'text-slate-200'}`}>
        {value} <span className="text-slate-500 font-normal">{unit}</span>
      </span>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium
      ${active ? 'bg-green-900/40 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
      {active ? 'نشط' : 'غير نشط'}
    </span>
  );
}

function EngineCard({ title, active, children }: { title: string; active: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, borderColor: active ? C.cyan + '33' : C.border }}
      className="border rounded-2xl overflow-hidden">
      <div style={{ background: active ? '#0c1e2e' : '#0f172a' }}
        className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        <StatusBadge active={active} />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ─── Gauge ring (SVG mini) ─────────────────────────────────────────────────── */
function GaugeRing({ pct, color, label, value }: { pct: number; color: string; label: string; value: string }) {
  const r = 32; const circ = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(pct, 0), 1) * circ * 0.75).toFixed(1);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={80} height={80} viewBox="0 0 80 80">
        <circle cx={40} cy={40} r={r} fill="none" stroke="#1e293b" strokeWidth={7}
          strokeDasharray={`${(circ * 0.75).toFixed(1)} ${(circ * 0.25).toFixed(1)}`}
          strokeDashoffset={circ * 0.125} strokeLinecap="round" />
        <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${(circ - +dash).toFixed(1)}`}
          strokeDashoffset={circ * 0.125} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        <text x={40} y={44} textAnchor="middle" fill={color} fontSize={11} fontWeight="bold" fontFamily="monospace">{value}</text>
      </svg>
      <span className="text-[10px] text-slate-400 text-center">{label}</span>
    </div>
  );
}

/* ─── Tank bar ──────────────────────────────────────────────────────────────── */
function TankBar({ label, level, max = 10, color = C.cyan }: { label: string; level: MV; max?: number; color?: string }) {
  const val = n(level);
  const pct = Math.min(val / max, 1);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-8 h-16 rounded border border-slate-700 overflow-hidden" style={{ background: '#0f172a' }}>
        <div style={{ height: `${pct * 100}%`, background: color, opacity: 0.85 }}
          className="absolute bottom-0 w-full transition-all duration-500" />
      </div>
      <span className="text-[9px] text-slate-400 text-center">{label}</span>
      <span className="text-[10px] font-mono font-bold" style={{ color }}>{val > 0 ? val.toFixed(1) : '—'}</span>
    </div>
  );
}

/* ─── Overview SVG schematic ────────────────────────────────────────────────── */
function OverviewSVG({ e1, e2, e3, e4 }: { e1: E1R|null; e2: E2R|null; e3: E3R|null; e4: E4R|null }) {
  const ejhFlow  = n(e1?.ejh.wellFieldDailyFlow);
  const nSFlow   = n(e1?.nejhS.wellFieldDailyFlow);
  const nNFlow   = n(e1?.nejhN.wellFieldDailyFlow);
  const eastFlow = n(e2?.airport.dailyFlow);
  const centFlow = n(e3?.crossConnections.totalFlow);
  const ps1Vol   = n(e4?.ps1.pumpingVolume);
  const fezzan   = n(e1?.fezzanTankLevel);

  const pActive = (v: number) => v > 0;
  const W = 1020, H = 460;

  // Node box helper
  const NodeBox = ({ x, y, w, h, label, val, unit, active }: {
    x:number;y:number;w:number;h:number;label:string;val:string;unit:string;active:boolean}) => {
    const c = active ? C.cyan : C.idle;
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={5} fill="#0c1523" stroke={c} strokeWidth={1.2} />
        <text x={x+w/2} y={y+14} textAnchor="middle" fill="#64748b" fontSize={8.5} fontFamily="monospace">{label}</text>
        <text x={x+w/2} y={y+h/2+4} textAnchor="middle" fill={c} fontSize={13} fontWeight="bold" fontFamily="monospace">{val}</text>
        <text x={x+w/2} y={y+h-8} textAnchor="middle" fill="#475569" fontSize={8} fontFamily="monospace">{unit}</text>
        {active && <circle cx={x+w-8} cy={y+8} r={3.5} fill={C.ok}>
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>}
      </g>
    );
  };

  const Pipe = ({ d, active, dir = 1 }: { d: string; active: boolean; dir?: number }) => (
    active ? (
      <path d={d} fill="none" stroke={C.cyan} strokeWidth={2.5} strokeDasharray="8 4" opacity={0.9}
        style={{ animation: `scadaflow${dir > 0 ? '' : 'rev'} 0.9s linear infinite` }} />
    ) : (
      <path d={d} fill="none" stroke="#1e2d40" strokeWidth={2} />
    )
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: C.bg, borderRadius: 12 }}>
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#0f172a" strokeWidth={0.6} />
        </pattern>
        <style>{`
          @keyframes scadaflow    { from { stroke-dashoffset: 12; } to { stroke-dashoffset: 0; } }
          @keyframes scadaflowrev { from { stroke-dashoffset: 0;  } to { stroke-dashoffset: 12; } }
        `}</style>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />

      {/* ── PIPES ─────────────────────────────── */}
      {/* EJH → Fezzan */}
      <Pipe d="M 165 90 H 230 V 230" active={pActive(ejhFlow)} />
      {/* NEJH-S → Fezzan */}
      <Pipe d="M 165 230 H 280" active={pActive(nSFlow)} />
      {/* NEJH-N → Fezzan */}
      <Pipe d="M 165 370 H 230 V 260" active={pActive(nNFlow)} />
      {/* Fezzan → junction */}
      <Pipe d="M 390 230 H 440" active={pActive(ejhFlow + nSFlow + nNFlow)} />
      {/* Junction → Eastern */}
      <Pipe d="M 470 210 V 110 H 560" active={pActive(eastFlow)} />
      {/* Junction → Central */}
      <Pipe d="M 490 230 H 560" active={pActive(centFlow)} />
      {/* Junction → PS1 */}
      <Pipe d="M 470 250 V 370 H 560" active={pActive(ps1Vol)} />
      {/* Eastern terminal */}
      <Pipe d="M 680 110 H 830" active={pActive(eastFlow)} />
      {/* Central terminal */}
      <Pipe d="M 680 230 H 830" active={pActive(centFlow)} />
      {/* PS1 → PS2 */}
      <Pipe d="M 680 370 H 730" active={pActive(ps1Vol)} />
      {/* PS2 → TAZ */}
      <Pipe d="M 850 370 H 880" active={pActive(n(e4?.ps2.pumpingToTank))} />
      {/* TAZ → Gharyan */}
      <Pipe d="M 980 390 V 420" active={pActive(n(e4?.gharyanConsumption))} />

      {/* ── NODES ─────────────────────────────── */}
      <NodeBox x={35}  y={60}  w={130} h={60} label="EJH — حقل عين زيانة"   val={fl(e1?.ejh.wellFieldDailyFlow)}   unit="M³/day"  active={pActive(ejhFlow)} />
      <NodeBox x={35}  y={200} w={130} h={60} label="NEJH-S — الجنوبي"       val={fl(e1?.nejhS.wellFieldDailyFlow)} unit="M³/day"  active={pActive(nSFlow)} />
      <NodeBox x={35}  y={340} w={130} h={60} label="NEJH-N — الشمالي"       val={fl(e1?.nejhN.wellFieldDailyFlow)} unit="M³/day"  active={pActive(nNFlow)} />
      <NodeBox x={280} y={200} w={110} h={60} label="خزان فزان"              val={p(e1?.fezzanTankLevel)}           unit="m"       active={fezzan > 0} />
      <NodeBox x={440} y={200} w={30}  h={60} label="" val="" unit="" active={pActive(ejhFlow+nSFlow+nNFlow)} />

      {/* Eastern branch */}
      <NodeBox x={560} y={80}  w={120} h={60} label="عين زارة / المطار"    val={fl(e2?.airport.dailyFlow)}            unit="M³/day" active={pActive(eastFlow)} />
      {/* Central branch */}
      <NodeBox x={560} y={200} w={120} h={60} label="تقاطعات وسط"          val={fl(e3?.crossConnections.totalFlow)}   unit="M³/day" active={pActive(centFlow)} />
      {/* PS1 */}
      <NodeBox x={560} y={340} w={120} h={60} label="محطة ضخ PS1"          val={fl(e4?.ps1.pumpingVolume)}            unit="M³"     active={pActive(ps1Vol)} />
      {/* PS2 */}
      <NodeBox x={730} y={340} w={120} h={60} label="محطة ضخ PS2"          val={fl(e4?.ps2.pumpingToTank)}            unit="M³"     active={pActive(n(e4?.ps2.pumpingToTank))} />
      {/* TAZ tank */}
      <NodeBox x={880} y={340} w={110} h={60} label="خزان أبو زيان"        val={p(e4?.tankLevel.cellA)}               unit="m"      active={n(e4?.tankLevel.cellA) > 0} />

      {/* Terminal labels */}
      <text x={840} y={103} fill="#94a3b8" fontSize={10} fontFamily="monospace">{'← مدن شرق ليبيا'}</text>
      <text x={840} y={224} fill="#94a3b8" fontSize={10} fontFamily="monospace">{'← مدن وسط ليبيا'}</text>
      <text x={958} y={438} fill="#94a3b8" fontSize={10} fontFamily="monospace" textAnchor="middle">غريان</text>
      <text x={958} y={450} fill="#64748b" fontSize={9}  fontFamily="monospace" textAnchor="middle">{fl(e4?.gharyanConsumption)} M³</text>

      {/* Title */}
      <text x={W/2} y={H-10} fill="#1e3a5f" fontSize={11} fontFamily="monospace" textAnchor="middle">
        شبكة مياه طرابلس الكبرى — مخطط SCADA
      </text>
    </svg>
  );
}

function ExactScadaTemplate({ e1, e2, e3, e4 }: { e1: E1R|null; e2: E2R|null; e3: E3R|null; e4: E4R|null }) {
  type DrawTool = 'path' | 'tank' | 'valve' | 'pump' | 'delete';
  type DrawPath = { id: string; x1: number; y1: number; x2: number; y2: number };
  type DrawTank = { id: string; x: number; y: number; w: number; h: number };
  type DrawValve = { id: string; x: number; y: number; size: number };
  type DrawPump = { id: string; x: number; y: number; r: number };
  type LayoutDraft = { paths: DrawPath[]; tanks: DrawTank[]; valves: DrawValve[]; pumps: DrawPump[] };
  type SignalKey =
    | 'wells'
    | 'central'
    | 'eastern'
    | 'taz'
    | 'gharyan'
    | 'ejh'
    | 'nejhS'
    | 'nejhN'
    | 'ps1'
    | 'ps2'
    | 'tarhunahPump';

  const wellsFlowing = n(e1?.ejh.wellFieldDailyFlow) + n(e1?.nejhS.wellFieldDailyFlow) + n(e1?.nejhN.wellFieldDailyFlow) > 0;
  const centralFlowing = n(e3?.crossConnections.totalFlow) + n(e3?.sidiSied.totalFlow) + n(e3?.tarhunah.totalFlow) > 0;
  const easternFlowing = n(e2?.airport.dailyFlow) + n(e2?.sidiSaiah.dailyFlow) + n(e2?.garabulli.dailyFlow) + n(e2?.wadiTumallah.dailyFlow) + n(e2?.ashShwayrifFcs.dailyFlow) > 0;
  const tazFlowing = n(e4?.ps1.pumpingVolume) + n(e4?.ps2.pumpingToTank) > 0;
  const gharyanFlowing = n(e4?.gharyanConsumption) > 0;
  const [builderMode, setBuilderMode] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawTool>('path');
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawHover, setDrawHover] = useState<{ x: number; y: number } | null>(null);
  const [jsonDraft, setJsonDraft] = useState('');
  const [layoutDraft, setLayoutDraft] = useState<LayoutDraft>(SCADA_USER_LAYOUT as unknown as LayoutDraft);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('scada_layout_draft_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as LayoutDraft;
      setLayoutDraft({
        paths: Array.isArray(parsed?.paths) && parsed.paths.length > 0 ? parsed.paths : (SCADA_USER_LAYOUT as unknown as LayoutDraft).paths,
        tanks: Array.isArray(parsed?.tanks) && parsed.tanks.length > 0 ? parsed.tanks : (SCADA_USER_LAYOUT as unknown as LayoutDraft).tanks,
        valves: Array.isArray(parsed?.valves) && parsed.valves.length > 0 ? parsed.valves : (SCADA_USER_LAYOUT as unknown as LayoutDraft).valves,
        pumps: Array.isArray(parsed?.pumps) && parsed.pumps.length > 0 ? parsed.pumps : (SCADA_USER_LAYOUT as unknown as LayoutDraft).pumps,
      });
    } catch {
      // Ignore malformed local storage content.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('scada_layout_draft_v1', JSON.stringify(layoutDraft));
  }, [layoutDraft]);

  const getSvgPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2420,
      y: ((e.clientY - rect.top) / rect.height) * 1870,
    };
  };

  const uid = () => `n-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

  const pointLineDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, dot / lenSq)) : 0;
    const xx = x1 + t * C;
    const yy = y1 + t * D;
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleBuilderClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!builderMode) return;
    const pt = getSvgPoint(e);

    if (activeTool === 'valve') {
      setLayoutDraft(prev => ({ ...prev, valves: [...prev.valves, { id: uid(), x: pt.x, y: pt.y, size: 16 }] }));
      return;
    }

    if (activeTool === 'pump') {
      setLayoutDraft(prev => ({ ...prev, pumps: [...prev.pumps, { id: uid(), x: pt.x, y: pt.y, r: 18 }] }));
      return;
    }

    if (activeTool === 'delete') {
      setLayoutDraft(prev => {
        const lineHit = prev.paths.find(p => pointLineDist(pt.x, pt.y, p.x1, p.y1, p.x2, p.y2) < 12);
        if (lineHit) return { ...prev, paths: prev.paths.filter(p => p.id !== lineHit.id) };
        const tankHit = prev.tanks.find(t => pt.x >= t.x && pt.x <= t.x + t.w && pt.y >= t.y && pt.y <= t.y + t.h);
        if (tankHit) return { ...prev, tanks: prev.tanks.filter(t => t.id !== tankHit.id) };
        const valveHit = prev.valves.find(v => Math.hypot(pt.x - v.x, pt.y - v.y) < 20);
        if (valveHit) return { ...prev, valves: prev.valves.filter(v => v.id !== valveHit.id) };
        const pumpHit = prev.pumps.find(p => Math.hypot(pt.x - p.x, pt.y - p.y) < 22);
        if (pumpHit) return { ...prev, pumps: prev.pumps.filter(p => p.id !== pumpHit.id) };
        return prev;
      });
      return;
    }

    if (!drawStart) {
      setDrawStart(pt);
      return;
    }

    if (activeTool === 'path') {
      setLayoutDraft(prev => ({
        ...prev,
        paths: [...prev.paths, { id: uid(), x1: drawStart.x, y1: drawStart.y, x2: pt.x, y2: pt.y }],
      }));
      setDrawStart(null);
      return;
    }

    if (activeTool === 'tank') {
      const x = Math.min(drawStart.x, pt.x);
      const y = Math.min(drawStart.y, pt.y);
      const w = Math.abs(drawStart.x - pt.x);
      const h = Math.abs(drawStart.y - pt.y);
      setLayoutDraft(prev => ({
        ...prev,
        tanks: [...prev.tanks, { id: uid(), x, y, w, h }],
      }));
      setDrawStart(null);
    }
  };

  const handleBuilderMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!builderMode || !drawStart) return;
    setDrawHover(getSvgPoint(e));
  };

  const signalState: Record<SignalKey, boolean> = {
    wells: wellsFlowing,
    central: centralFlowing,
    eastern: easternFlowing,
    taz: tazFlowing,
    gharyan: gharyanFlowing,
    ejh: n(e1?.ejh.operatingPumps) > 0,
    nejhS: n(e1?.nejhS.operatingPumps) > 0,
    nejhN: n(e1?.nejhN.operatingPumps) > 0,
    ps1: n(e4?.ps1.activePumpNo) > 0,
    ps2: n(e4?.ps2.activePumpNo) > 0,
    tarhunahPump: n(e3?.tarhunah.noPumps) > 0,
  };
  const tankSignalDefs: Array<{ id: string; label: string; level: number; max: number; x: number; y: number }> = [
    { id: 'fezzan', label: 'خزان فزان', level: n(e1?.fezzanTankLevel), max: 12, x: 183, y: 1142 },
    { id: 'tarhunah', label: 'ترهونة', level: n(e3?.tarhunah.level), max: 6.5, x: 425, y: 538 },
    { id: 'sidiSied', label: 'سيدي سعيد', level: n(e3?.sidiSied.level), max: 6.5, x: 1115, y: 845 },
    { id: 'sidiSaiah', label: 'سيدي صياح', level: n(e2?.sidiSaiah.rtLevel), max: 6.5, x: 1105, y: 1341 },
    { id: 'wadiTumallah', label: 'وادي تميلح', level: n(e2?.wadiTumallah.rtLevel), max: 6.5, x: 1526, y: 1337 },
    { id: 'shwayrif', label: 'الشويرف', level: n(e2?.ashShwayrifRtLevel), max: 6.5, x: 2295, y: 506 },
    { id: 'cellA', label: 'TAZ A', level: n(e4?.tankLevel.cellA), max: 8, x: 2032, y: 1339 },
    { id: 'cellB', label: 'TAZ B', level: n(e4?.tankLevel.cellB), max: 8, x: 1514, y: 842 },
    { id: 'cellC', label: 'TAZ C', level: n(e4?.tankLevel.cellC), max: 8, x: 559, y: 1124 },
    { id: 'cellD', label: 'TAZ D', level: n(e4?.tankLevel.cellD), max: 8, x: 350, y: 858 },
    { id: 'cellE', label: 'TAZ E', level: n(e4?.tankLevel.cellE), max: 8, x: 1526, y: 1337 },
  ];
  const pumpSignalDefs: Array<{ x: number; y: number; key: Exclude<SignalKey, 'wells' | 'central' | 'eastern' | 'taz' | 'gharyan'>; label: string }> = [
    { x: 528.7, y: 574.4, key: 'ejh', label: 'مضخة EJH' },
    { x: 447.4, y: 884.0, key: 'nejhS', label: 'مضخة NEJH-S' },
    { x: 276.0, y: 1164.4, key: 'nejhN', label: 'مضخة NEJH-N' },
    { x: 1260.3, y: 887.8, key: 'tarhunahPump', label: 'مضخة ترهونة' },
    { x: 2312.6, y: 623.2, key: 'ps1', label: 'مضخة PS1' },
    { x: 2317.0, y: 746.2, key: 'ps2', label: 'مضخة PS2' },
  ];
  const euclidean = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);
  const mappedLayoutTanks = useMemo(() => {
    const valid = layoutDraft.tanks.filter(tk => tk.w >= 10 && tk.h >= 10);
    const byArea = [...valid].sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const remaining = new Set(tankSignalDefs.map((_, idx) => idx));

    return byArea.map(tk => {
      const cx = tk.x + tk.w / 2;
      const cy = tk.y + tk.h / 2;

      let chosen = -1;
      let best = Number.POSITIVE_INFINITY;
      remaining.forEach(idx => {
        const s = tankSignalDefs[idx];
        const d = euclidean(cx, cy, s.x, s.y);
        if (d < best) {
          best = d;
          chosen = idx;
        }
      });

      if (chosen === -1) {
        tankSignalDefs.forEach((s, idx) => {
          const d = euclidean(cx, cy, s.x, s.y);
          if (d < best) {
            best = d;
            chosen = idx;
          }
        });
      }

      if (chosen >= 0) {
        remaining.delete(chosen);
      }

      const fallback = tankSignalDefs[0];
      const signal = chosen >= 0 ? tankSignalDefs[chosen] : fallback;
      return { tank: tk, signal };
    });
  }, [layoutDraft.tanks, e1, e2, e3, e4]);
  const getPathActive = (pth: DrawPath) => {
    const xMid = (pth.x1 + pth.x2) / 2;
    const yMid = (pth.y1 + pth.y2) / 2;

    if (xMid < 900) {
      if (yMid < 760) return signalState.wells;
      if (yMid < 980) return signalState.wells || signalState.central;
      if (yMid < 1320) return signalState.central || signalState.taz;
      return signalState.taz || signalState.eastern;
    }

    if (xMid < 1600) {
      if (yMid < 980) return signalState.central;
      if (yMid < 1200) return signalState.central || signalState.eastern;
      return signalState.taz || signalState.central;
    }

    if (xMid < 2100) {
      if (yMid < 1000) return signalState.eastern || signalState.central;
      return signalState.taz || signalState.eastern;
    }

    if (yMid < 950) return signalState.eastern;
    if (yMid < 1300) return signalState.eastern || signalState.taz;
    return signalState.gharyan || signalState.taz;
  };
  const getValveOpen = (v: DrawValve) => {
    if (v.x < 950) {
      if (v.y < 1120) return signalState.wells || signalState.central;
      if (v.y < 1360) return signalState.taz || signalState.central;
      return signalState.taz || signalState.eastern;
    }

    if (v.x < 1400) return signalState.taz;

    if (v.x < 1900) {
      if (v.y < 1100) return signalState.central;
      return signalState.taz || signalState.central;
    }

    if (v.x < 2150) {
      if (v.y < 1100) return signalState.eastern;
      return signalState.eastern || signalState.taz;
    }

    return signalState.gharyan || signalState.taz;
  };
  const getPumpActive = (pm: DrawPump) => {
    let key: (typeof pumpSignalDefs)[number]['key'] = 'ejh';
    let best = Number.POSITIVE_INFINITY;
    pumpSignalDefs.forEach(def => {
      const d = euclidean(pm.x, pm.y, def.x, def.y);
      if (d < best) {
        best = d;
        key = def.key;
      }
    });
    return signalState[key];
  };
  const mapPumpSignal = (pm: DrawPump) => {
    let best = Number.POSITIVE_INFINITY;
    let selected = pumpSignalDefs[0];
    pumpSignalDefs.forEach(def => {
      const d = euclidean(pm.x, pm.y, def.x, def.y);
      if (d < best) {
        best = d;
        selected = def;
      }
    });
    return selected;
  };
  const tankLevelColor = (level: number, max: number) => {
    const ratio = max > 0 ? level / max : 0;
    if (ratio >= 0.65) return '#38bdf8';
    if (ratio >= 0.3) return '#f59e0b';
    return '#ef4444';
  };
  const mappedPaths = useMemo(() => layoutDraft.paths.map(p => ({ path: p, active: getPathActive(p) })), [layoutDraft.paths, e1, e2, e3, e4]);
  const mappedValves = useMemo(() => layoutDraft.valves.map(v => ({ valve: v, open: getValveOpen(v) })), [layoutDraft.valves, e1, e2, e3, e4]);
  const mappedPumps = useMemo(() => layoutDraft.pumps.map(pm => {
    const signal = mapPumpSignal(pm);
    return { pump: pm, active: signalState[signal.key], label: signal.label };
  }), [layoutDraft.pumps, e1, e2, e3, e4]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-2 overflow-x-auto">
      <div className="mb-2 p-2 rounded-lg border border-slate-800 bg-slate-900/50 flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => { setBuilderMode(v => !v); setDrawStart(null); }}
          className={`px-2 py-1 rounded border ${builderMode ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
        >
          {builderMode ? 'إيقاف رسم الشبكة' : 'تشغيل رسم الشبكة'}
        </button>
        {(['path', 'tank', 'valve', 'pump', 'delete'] as DrawTool[]).map(tool => (
          <button
            key={tool}
            onClick={() => { setActiveTool(tool); setBuilderMode(true); }}
            className={`px-2 py-1 rounded border ${activeTool === tool ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
          >
            {tool === 'path' ? 'رسم مسار' : tool === 'tank' ? 'رسم خزان' : tool === 'valve' ? 'إضافة صمام' : tool === 'pump' ? 'إضافة مضخة' : 'حذف عنصر'}
          </button>
        ))}
        <button
          onClick={() => setLayoutDraft({ paths: [], tanks: [], valves: [], pumps: [] })}
          className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300"
        >
          مسح كل رسم الشبكة
        </button>
        <button
          onClick={() => setLayoutDraft(SCADA_USER_LAYOUT as unknown as LayoutDraft)}
          className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300"
        >
          تحميل الرسم المعتمد
        </button>
        <button
          onClick={async () => {
            const text = JSON.stringify(layoutDraft, null, 2);
            setJsonDraft(text);
            try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
          }}
          className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300"
        >
          نسخ JSON الشبكة
        </button>
        <button
          onClick={() => {
            try {
              const parsed = JSON.parse(jsonDraft) as LayoutDraft;
              setLayoutDraft({
                paths: Array.isArray(parsed?.paths) ? parsed.paths : [],
                tanks: Array.isArray(parsed?.tanks) ? parsed.tanks : [],
                valves: Array.isArray(parsed?.valves) ? parsed.valves : [],
                pumps: Array.isArray(parsed?.pumps) ? parsed.pumps : [],
              });
            } catch {
              // Ignore invalid JSON.
            }
          }}
          className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300"
        >
          تحميل JSON
        </button>
        <span className="text-slate-400">الأيقونات: صمام (رمز فيونكة) ومضخة (دائرة + سهم) داخل الرسم.</span>
        <span className="text-emerald-300">الحالة: {builderMode ? 'وضع الرسم مفعل' : 'وضع الرسم متوقف'}</span>
      </div>
      <textarea
        value={jsonDraft}
        onChange={e => setJsonDraft(e.target.value)}
        placeholder="الصق JSON الشبكة هنا (اختياري)"
        className="w-full mb-2 h-24 rounded-lg bg-slate-900 border border-slate-800 p-2 text-[11px] text-slate-300"
      />
      <div className="relative min-w-[1100px] rounded-xl border border-slate-800 bg-slate-950/70">
        <svg
          viewBox="0 0 2420 1870"
          className={`z-20 w-full h-auto rounded-xl ${builderMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
          onClick={e => {
            if (builderMode) {
              handleBuilderClick(e);
            }
          }}
          onMouseMove={e => {
            if (builderMode) {
              handleBuilderMove(e);
            }
          }}
        >
          <defs>
            <style>{`
              @keyframes scadaTemplateFlow { from { stroke-dashoffset: 32; } to { stroke-dashoffset: 0; } }
              @keyframes scadaPumpSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
              @keyframes scadaShine { from { transform: translateX(-24px); opacity: 0; } 40% { opacity: 0.35; } to { transform: translateX(120px); opacity: 0; } }
            `}</style>
          </defs>

          <rect x={0} y={0} width={2420} height={1870} fill="url(#gridLite)" opacity={0.85} />

          <defs>
            <pattern id="gridLite" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#0f172a" strokeWidth="0.9" />
            </pattern>
          </defs>

          {/* Manual network drawing toolkit output */}
          {mappedPaths.map(({ path: pth, active }) => (
            <g key={pth.id}>
              <line x1={pth.x1} y1={pth.y1} x2={pth.x2} y2={pth.y2} stroke="#0f172a" strokeWidth={9} strokeLinecap="round" opacity={0.55} />
              <line x1={pth.x1} y1={pth.y1} x2={pth.x2} y2={pth.y2} stroke="#334155" strokeWidth={6} strokeLinecap="round" />
              <line x1={pth.x1} y1={pth.y1} x2={pth.x2} y2={pth.y2} stroke="#64748b" strokeWidth={2} strokeLinecap="round" opacity={0.35} />
              {active && (
                <line
                  x1={pth.x1}
                  y1={pth.y1}
                  x2={pth.x2}
                  y2={pth.y2}
                  stroke="#22d3ee"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="12 8"
                  style={{ animation: 'scadaTemplateFlow 0.9s linear infinite' }}
                />
              )}
            </g>
          ))}

          {mappedLayoutTanks.map(({ tank: tk, signal }) => {
            const level = signal.level;
            const max = signal.max;
            const fillRatio = Math.max(0, Math.min(1, max > 0 ? level / max : 0));
            const fillHeight = tk.h * fillRatio;
            const c = tankLevelColor(level, max);
            return (
              <g key={tk.id}>
                <rect x={tk.x} y={tk.y} width={tk.w} height={tk.h} fill="rgba(15,23,42,0.2)" stroke={c} strokeWidth={2.5} />
                <rect x={tk.x + tk.w - 10} y={tk.y + 2} width={8} height={Math.max(0, tk.h - 4)} fill="rgba(2,6,23,0.35)" />
                <ellipse cx={tk.x + tk.w / 2} cy={tk.y + 2} rx={Math.max(4, tk.w / 2 - 2)} ry={3.5} fill="rgba(148,163,184,0.18)" />
                <rect x={tk.x + 1.5} y={tk.y + tk.h - fillHeight - 1.5} width={Math.max(0, tk.w - 3)} height={Math.max(0, fillHeight)} fill={c} opacity={0.35} />
                <rect x={tk.x} y={tk.y} width={tk.w} height={tk.h} fill="none" stroke={c} strokeWidth={1.2} style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.22))' }} />
                <rect x={tk.x + 6} y={tk.y + 4} width={6} height={Math.max(0, tk.h - 8)} fill="rgba(255,255,255,0.16)" style={{ animation: 'scadaShine 3.2s ease-in-out infinite' }} />
                {tk.w > 28 && tk.h > 28 && (
                  <>
                    <text x={tk.x + tk.w / 2} y={tk.y - 8} textAnchor="middle" fill="#94a3b8" fontSize={11}>{signal.label}</text>
                    <text x={tk.x + tk.w / 2} y={tk.y + tk.h + 16} textAnchor="middle" fill={c} fontSize={12} fontWeight="bold">
                      {level > 0 ? level.toFixed(2) : '—'} m
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {mappedValves.map(({ valve: v, open }) => {
            const vc = open ? '#22c55e' : '#ef4444';
            return (
            <g key={v.id}>
              <circle cx={v.x} cy={v.y} r={v.size * 0.72} fill="rgba(15,23,42,0.45)" stroke={vc} strokeWidth={1.2} />
              <polygon points={`${v.x - v.size},${v.y - v.size} ${v.x - v.size},${v.y + v.size} ${v.x},${v.y}`} fill={vc} stroke="#111827" strokeWidth={1} />
              <polygon points={`${v.x + v.size},${v.y - v.size} ${v.x + v.size},${v.y + v.size} ${v.x},${v.y}`} fill={vc} stroke="#111827" strokeWidth={1} />
              <line x1={v.x - 2} y1={v.y - v.size - 6} x2={v.x - 2} y2={v.y + v.size + 6} stroke="rgba(148,163,184,0.5)" strokeWidth={1} />
            </g>
          )})}

          {mappedPumps.map(({ pump: pm, active, label }) => {
            const pc = active ? '#22c55e' : '#64748b';
            return (
            <g key={pm.id}>
              <circle cx={pm.x} cy={pm.y} r={pm.r + 3} fill="rgba(2,6,23,0.45)" />
              <circle cx={pm.x} cy={pm.y} r={pm.r} fill={active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)'} stroke={pc} strokeWidth={3} />
              <g style={{ transformOrigin: `${pm.x}px ${pm.y}px`, animation: active ? 'scadaPumpSpin 1.2s linear infinite' : undefined }}>
                <polygon points={`${pm.x - pm.r * 0.35},${pm.y - pm.r * 0.55} ${pm.x - pm.r * 0.35},${pm.y + pm.r * 0.55} ${pm.x + pm.r * 0.6},${pm.y}`} fill={pc} />
                <polygon points={`${pm.x + pm.r * 0.35},${pm.y - pm.r * 0.55} ${pm.x + pm.r * 0.35},${pm.y + pm.r * 0.55} ${pm.x - pm.r * 0.6},${pm.y}`} fill={pc} opacity={0.6} />
              </g>
              {active && <circle cx={pm.x} cy={pm.y} r={pm.r + 3} fill="none" stroke="#22d3ee" strokeWidth={1.2} strokeDasharray="5 4" style={{ animation: 'scadaTemplateFlow 1.2s linear infinite' }} />}
              <text x={pm.x} y={pm.y + pm.r + 15} textAnchor="middle" fill="#94a3b8" fontSize={10}>{label}</text>
            </g>
          )})}

          {builderMode && drawStart && (
            <circle cx={drawStart.x} cy={drawStart.y} r={8} fill="#facc15" stroke="#111827" strokeWidth={2} />
          )}

          {builderMode && drawStart && drawHover && activeTool === 'path' && (
            <line x1={drawStart.x} y1={drawStart.y} x2={drawHover.x} y2={drawHover.y} stroke="#facc15" strokeWidth={3} strokeDasharray="10 6" />
          )}

          {builderMode && drawStart && drawHover && activeTool === 'tank' && (
            <rect
              x={Math.min(drawStart.x, drawHover.x)}
              y={Math.min(drawStart.y, drawHover.y)}
              width={Math.abs(drawStart.x - drawHover.x)}
              height={Math.abs(drawStart.y - drawHover.y)}
              fill="rgba(250,204,21,0.15)"
              stroke="#facc15"
              strokeDasharray="10 6"
              strokeWidth={2}
            />
          )}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <h4 className="text-xs text-slate-300 mb-2">جدول الخزانات الحية</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-right py-1">الخزان</th>
                  <th className="text-right py-1">المنسوب</th>
                  <th className="text-right py-1">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {mappedLayoutTanks.map(({ tank: tk, signal }) => {
                  const ratio = signal.max > 0 ? signal.level / signal.max : 0;
                  const status = ratio >= 0.65 ? 'ممتلئ' : ratio >= 0.3 ? 'متوسط' : 'منخفض';
                  return (
                    <tr key={`tbl-${tk.id}`} className="border-b border-slate-800/60 text-slate-200">
                      <td className="py-1">{signal.label}</td>
                      <td className="py-1 font-mono">{signal.level > 0 ? signal.level.toFixed(2) : '—'} m</td>
                      <td className="py-1">{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <h4 className="text-xs text-slate-300 mb-2">جدول المضخات والصمامات</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-right py-1">العنصر</th>
                  <th className="text-right py-1">النوع</th>
                  <th className="text-right py-1">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {mappedPumps.map(({ pump, active, label }) => (
                  <tr key={`p-${pump.id}`} className="border-b border-slate-800/60 text-slate-200">
                    <td className="py-1">{label}</td>
                    <td className="py-1">مضخة</td>
                    <td className={`py-1 ${active ? 'text-emerald-400' : 'text-rose-400'}`}>{active ? 'تشغيل' : 'توقف'}</td>
                  </tr>
                ))}
                {mappedValves.map(({ valve, open }, idx) => (
                  <tr key={`v-${valve.id}`} className="border-b border-slate-800/60 text-slate-200">
                    <td className="py-1">صمام {idx + 1}</td>
                    <td className="py-1">صمام</td>
                    <td className={`py-1 ${open ? 'text-emerald-400' : 'text-rose-400'}`}>{open ? 'مفتوح' : 'مغلق'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
        <h4 className="text-xs text-slate-300 mb-2">جدول المسارات</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-right py-1">المسار</th>
                <th className="text-right py-1">الطول التقريبي</th>
                <th className="text-right py-1">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {mappedPaths.map(({ path, active }, idx) => {
                const len = Math.hypot(path.x2 - path.x1, path.y2 - path.y1);
                return (
                  <tr key={`l-${path.id}`} className="border-b border-slate-800/60 text-slate-200">
                    <td className="py-1">خط {idx + 1}</td>
                    <td className="py-1 font-mono">{len.toFixed(0)} px</td>
                    <td className={`py-1 ${active ? 'text-cyan-300' : 'text-slate-500'}`}>{active ? 'تدفق' : 'خامل'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mt-2 px-1">
        عرض حي مباشر: الخريطة المعتمدة والقيم التوضيحية تتحدث فور تغيّر قراءات النظام.
      </p>
    </div>
  );
}

/* ─── Overview view ─────────────────────────────────────────────────────────── */
function OverviewView({ e1, e2, e3, e4, r1, r2, r3, r4 }: {
  e1: E1R|null; e2: E2R|null; e3: E3R|null; e4: E4R|null;
  r1: E1R[]; r2: E2R[]; r3: E3R[]; r4: E4R[];
}) {
  const totalProd = n(e1?.ejh.wellFieldDailyFlow) + n(e1?.nejhS.wellFieldDailyFlow) + n(e1?.nejhN.wellFieldDailyFlow);
  const totalWells = n(e1?.ejh.workingWells) + n(e1?.nejhS.workingWells) + n(e1?.nejhN.workingWells);

  const trendData = r1.map((r, i) => ({
    day: r.dayNo ?? i+1,
    إنتاج: n(r.ejh.wellFieldDailyFlow) + n(r.nejhS.wellFieldDailyFlow) + n(r.nejhN.wellFieldDailyFlow),
    شرقي: n(r2[i]?.airport.dailyFlow),
    وسطى: n(r3[i]?.crossConnections.totalFlow),
  }));

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KCard label="إجمالي الإنتاج"   value={totalProd > 0 ? totalProd.toLocaleString() : '—'} unit="M³/day"    color={C.cyan}  icon={Droplets} />
        <KCard label="الآبار العاملة"   value={totalWells > 0 ? String(totalWells) : '—'}         unit="بئر نشط"  color={C.ok}    icon={Activity} />
        <KCard label="منسوب خزان فزان" value={p(e1?.fezzanTankLevel)}                             unit="متر"      color={C.warn}  icon={Gauge} />
        <KCard label="تدفق محطة PS1"   value={fl(e4?.ps1.pumpingVolume)}                          unit="M³"       color="#a78bfa" icon={Zap} />
      </div>

      {/* Exact template SCADA (from original report drawing) */}
      <ExactScadaTemplate e1={e1} e2={e2} e3={e3} e4={e4} />

      {/* Trend chart */}
      {trendData.length > 1 && (
        <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">اتجاه الإنتاج اليومي (M³/day)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.cyan} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.cyan} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gEast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.ok} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.ok} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} width={55} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
              <Area type="monotone" dataKey="إنتاج" stroke={C.cyan} fill="url(#gProd)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="شرقي"  stroke={C.ok}   fill="url(#gEast)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ─── Fields view (Engine 1) ────────────────────────────────────────────────── */
function FieldsView({ e1, r1 }: { e1: E1R|null; r1: E1R[] }) {
  const groups = [
    { key: 'ejh',   label: 'EJH — عين زيانة',    data: e1?.ejh,   color: C.cyan },
    { key: 'nejhS', label: 'NEJH-S — الجنوبي',   data: e1?.nejhS, color: C.ok },
    { key: 'nejhN', label: 'NEJH-N — الشمالي',   data: e1?.nejhN, color: '#a78bfa' },
  ];

  const trendData = r1.map((r, i) => ({
    day: r.dayNo ?? i+1,
    EJH:    n(r.ejh.wellFieldDailyFlow),
    'NEJH-S': n(r.nejhS.wellFieldDailyFlow),
    'NEJH-N': n(r.nejhN.wellFieldDailyFlow),
  }));

  return (
    <div className="space-y-4">
      {/* Fezzan tank */}
      <div style={{ background: C.card, borderColor: C.warn + '44' }} className="border rounded-2xl p-4 flex items-center gap-6">
        <GaugeRing pct={n(e1?.fezzanTankLevel) / 15} color={C.warn} label="خزان فزان" value={p(e1?.fezzanTankLevel) + 'm'} />
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">خزان فزان الرئيسي</p>
          <p className="text-2xl font-bold font-mono" style={{ color: C.warn }}>{p(e1?.fezzanTankLevel)} <span className="text-sm text-slate-500">متر</span></p>
          <p className="text-xs text-slate-500 mt-1">يتغذى من ثلاثة حقول آبار</p>
        </div>
      </div>

      {/* 3 pump field cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {groups.map(g => {
          const d = g.data;
          const active = n(d?.wellFieldDailyFlow) > 0;
          return (
            <EngineCard key={g.key} title={g.label} active={active}>
              <div className="flex justify-center mb-4">
                <GaugeRing
                  pct={n(d?.wellFieldDailyFlow) / 60000}
                  color={g.color}
                  label="تدفق يومي"
                  value={n(d?.wellFieldDailyFlow) > 0 ? (n(d.wellFieldDailyFlow)/1000).toFixed(1)+'k' : '—'}
                />
              </div>
              <DataRow label="الآبار العاملة"  value={fl(d?.workingWells)}        unit="بئر"    highlight />
              <DataRow label="التدفق اليومي"   value={fl(d?.wellFieldDailyFlow)}  unit="M³/day" highlight />
              <DataRow label="المضخات العاملة" value={fl(d?.operatingPumps)}      unit="مضخة" />
              <DataRow label="ضغط الخروج"      value={p(d?.outletPressure)}       unit="bar" />
              <DataRow label="منسوب الخزان"     value={p(d?.forebayTankLevel)}    unit="m" />
            </EngineCard>
          );
        })}
      </div>

      {/* Trend */}
      {trendData.length > 1 && (
        <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">التدفق اليومي لكل حقل (M³/day)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} width={60} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
              <Bar dataKey="EJH"     fill={C.cyan}    stackId="a" radius={[0,0,0,0]} />
              <Bar dataKey="NEJH-S"  fill={C.ok}      stackId="a" />
              <Bar dataKey="NEJH-N"  fill="#a78bfa"   stackId="a" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ─── Eastern branch view (Engine 2) ───────────────────────────────────────── */
function EasternView({ e2, r2 }: { e2: E2R|null; r2: E2R[] }) {
  const stations = [
    { label: 'عين زارة / المطار', flow: e2?.airport.dailyFlow, level: null, pOut: e2?.airport.outletPressure, valve: e2?.airport.openingValvePct },
    { label: 'سيدي صياح FCS',    flow: e2?.sidiSaiah.dailyFlow,   level: e2?.sidiSaiah.rtLevel,    pOut: null, valve: null },
    { label: 'قرابوللي RT',       flow: e2?.garabulli.dailyFlow,   level: e2?.garabulli.rtLevel,    pOut: null, valve: null },
    { label: 'وادي تميلح FCS',    flow: e2?.wadiTumallah.dailyFlow, level: e2?.wadiTumallah.rtLevel, pOut: null, valve: null },
    { label: 'الشويرف FCS',       flow: e2?.ashShwayrifFcs.dailyFlow, level: e2?.ashShwayrifRtLevel, pOut: null, valve: null },
  ];

  const trendData = r2.map((r, i) => ({
    day: r.dayNo ?? i+1,
    مطار:    n(r.airport.dailyFlow),
    سيدي: n(r.sidiSaiah.dailyFlow),
    وادي: n(r.wadiTumallah.dailyFlow),
  }));

  return (
    <div className="space-y-4">
      {/* Flow path visual */}
      <div className="flex items-center gap-2 overflow-x-auto py-2">
        {stations.map((s, i) => (
          <React.Fragment key={s.label}>
            <div style={{ background: n(s.flow) > 0 ? '#0c1e2e' : C.card, borderColor: n(s.flow) > 0 ? C.cyan + '55' : C.border }}
              className="border rounded-xl p-3 shrink-0 min-w-[120px]">
              <p className="text-[10px] text-slate-400 text-center mb-1 leading-tight">{s.label}</p>
              <p className="text-center font-mono font-bold text-sm" style={{ color: n(s.flow) > 0 ? C.cyan : C.idle }}>
                {fl(s.flow)}
              </p>
              <p className="text-[9px] text-slate-500 text-center">M³/day</p>
              {s.level !== null && (
                <p className="text-[10px] text-center text-amber-400 mt-1">منسوب: {p(s.level)} m</p>
              )}
              {s.pOut !== null && n(s.pOut) > 0 && (
                <p className="text-[10px] text-center text-slate-400 mt-1">ضغط: {p(s.pOut)} bar</p>
              )}
              {s.valve !== null && n(s.valve) > 0 && (
                <p className="text-[10px] text-center text-slate-400">صمام: {p(s.valve)}%</p>
              )}
            </div>
            {i < stations.length - 1 && (
              <div style={{ color: n(s.flow) > 0 ? C.cyan : C.idle }} className="text-lg shrink-0">→</div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EngineCard title="محطة عين زارة / المطار" active={n(e2?.airport.dailyFlow) > 0}>
          <DataRow label="التدفق اليومي"  value={fl(e2?.airport.dailyFlow)}         unit="M³/day" highlight />
          <DataRow label="ضغط الخروج"     value={p(e2?.airport.outletPressure)}      unit="bar" />
          <DataRow label="ضغط الدخول"     value={p(e2?.airport.inletPressure)}       unit="bar" />
          <DataRow label="فتح الصمام"     value={p(e2?.airport.openingValvePct)}     unit="%" />
        </EngineCard>
        <EngineCard title="سيدي صياح + قرابوللي" active={n(e2?.sidiSaiah.dailyFlow) + n(e2?.garabulli.dailyFlow) > 0}>
          <DataRow label="سيدي صياح — تدفق"   value={fl(e2?.sidiSaiah.dailyFlow)}  unit="M³/day" highlight />
          <DataRow label="سيدي صياح — منسوب"  value={p(e2?.sidiSaiah.rtLevel)}     unit="m" />
          <DataRow label="قرابوللي — تدفق"     value={fl(e2?.garabulli.dailyFlow)}  unit="M³/day" highlight />
          <DataRow label="قرابوللي — منسوب"    value={p(e2?.garabulli.rtLevel)}     unit="m" />
        </EngineCard>
        <EngineCard title="وادي تميلح + الشويرف" active={n(e2?.wadiTumallah.dailyFlow) > 0}>
          <DataRow label="وادي تميلح — تدفق"  value={fl(e2?.wadiTumallah.dailyFlow)} unit="M³/day" highlight />
          <DataRow label="وادي تميلح — منسوب" value={p(e2?.wadiTumallah.rtLevel)}    unit="m" />
          <DataRow label="الشويرف — تدفق"     value={fl(e2?.ashShwayrifFcs.dailyFlow)} unit="M³/day" highlight />
          <DataRow label="الشويرف — منسوب"    value={p(e2?.ashShwayrifRtLevel)}       unit="m" />
        </EngineCard>
      </div>

      {/* Trend */}
      {trendData.length > 1 && (
        <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">تدفق المحطات اليومي — الفرع الشرقي (M³/day)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gMt"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.cyan} stopOpacity={0.3}/><stop offset="95%" stopColor={C.cyan} stopOpacity={0}/></linearGradient>
                <linearGradient id="gSd"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.ok}   stopOpacity={0.3}/><stop offset="95%" stopColor={C.ok}   stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} width={55} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
              <Area type="monotone" dataKey="مطار"  stroke={C.cyan} fill="url(#gMt)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="سيدي"  stroke={C.ok}   fill="url(#gSd)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="وادي"  stroke="#f59e0b" fill="none"      strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ─── Central + TAZ view (Engines 3 + 4) ───────────────────────────────────── */
function CentralView({ e3, e4, r3, r4 }: { e3: E3R|null; e4: E4R|null; r3: E3R[]; r4: E4R[] }) {
  const cells = [
    { label: 'A', val: e4?.tankLevel.cellA },
    { label: 'B', val: e4?.tankLevel.cellB },
    { label: 'C', val: e4?.tankLevel.cellC },
    { label: 'D', val: e4?.tankLevel.cellD },
    { label: 'E', val: e4?.tankLevel.cellE },
  ];
  const avgLevel = cells.reduce((s, c) => s + n(c.val), 0) / cells.filter(c => n(c.val) > 0).length || 0;

  const trendData4 = r4.map((r, i) => ({
    day: r.dayNo ?? i+1,
    PS1: n(r.ps1.pumpingVolume),
    PS2: n(r.ps2.pumpingToTank),
    غريان: n(r.gharyanConsumption),
  }));

  const trendData3 = r3.map((r, i) => ({
    day: r.dayNo ?? i+1,
    تقاطعات: n(r.crossConnections.totalFlow),
    تارهونة:  n(r.tarhunah.totalFlow),
  }));

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KCard label="تدفق التقاطعات" value={fl(e3?.crossConnections.totalFlow)} unit="M³/day" color={C.cyan} />
        <KCard label="ضخ PS1"         value={fl(e4?.ps1.pumpingVolume)}          unit="M³"     color={C.ok} />
        <KCard label="ضخ PS2"         value={fl(e4?.ps2.pumpingToTank)}          unit="M³"     color="#a78bfa" />
        <KCard label="استهلاك غريان"  value={fl(e4?.gharyanConsumption)}         unit="M³/day" color={C.warn} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Central branch */}
        <div className="space-y-4">
          <EngineCard title="الفرع الوسطى — تقاطعات" active={n(e3?.crossConnections.totalFlow) > 0}>
            <DataRow label="التدفق الكلي"  value={fl(e3?.crossConnections.totalFlow)}  unit="M³/day" highlight />
            <DataRow label="ضغط الخروج"    value={p(e3?.crossConnections.outletPressure)} unit="bar" />
            <DataRow label="ضغط الدخول"    value={p(e3?.crossConnections.inletPressure)}  unit="bar" />
          </EngineCard>
          <EngineCard title="سيدي سيد RT + تارهونة PS" active={n(e3?.sidiSied.totalFlow) + n(e3?.tarhunah.totalFlow) > 0}>
            <DataRow label="سيدي سيد — تدفق"   value={fl(e3?.sidiSied.totalFlow)}        unit="M³/day" highlight />
            <DataRow label="سيدي سيد — منسوب"  value={p(e3?.sidiSied.level)}             unit="m" />
            <DataRow label="تارهونة — تدفق"    value={fl(e3?.tarhunah.totalFlow)}         unit="M³/day" highlight />
            <DataRow label="تارهونة — منسوب"   value={p(e3?.tarhunah.level)}             unit="m" />
            <DataRow label="تارهونة — مضخات"   value={fl(e3?.tarhunah.noPumps)}           unit="عاملة" />
            <DataRow label="تارهونة — ضغط خروج" value={p(e3?.tarhunah.outletPressure)}   unit="bar" />
          </EngineCard>
        </div>

        {/* TAZ system */}
        <div className="space-y-4">
          <EngineCard title="محطة ضخ PS1 + PS2" active={n(e4?.ps1.pumpingVolume) > 0}>
            <DataRow label="PS1 — كمية الضخ"    value={fl(e4?.ps1.pumpingVolume)}          unit="M³"  highlight />
            <DataRow label="PS1 — ضغط الخروج"   value={p(e4?.ps1.outletPressure)}           unit="bar" />
            <DataRow label="PS1 — ساعات التشغيل" value={p(e4?.ps1.totalOperationHours)}     unit="hr" />
            <DataRow label="PS2 — ضخ للخزان"    value={fl(e4?.ps2.pumpingToTank)}           unit="M³"  highlight />
            <DataRow label="PS2 — ضغط الخروج"   value={p(e4?.ps2.outletPressure)}           unit="bar" />
          </EngineCard>
          <EngineCard title="خزان أبو زيان — مناسيب الخلايا" active={avgLevel > 0}>
            <div className="flex justify-around items-end py-2">
              {cells.map(c => (
                <TankBar key={c.label} label={`خلية ${c.label}`} level={c.val} max={12} color={C.cyan} />
              ))}
            </div>
            <DataRow label="متوسط المنسوب" value={avgLevel > 0 ? avgLevel.toFixed(2) : '—'} unit="m" highlight />
            <DataRow label="استهلاك غريان" value={fl(e4?.gharyanConsumption)}                unit="M³/day" />
          </EngineCard>
        </div>
      </div>

      {/* TAZ trend */}
      {trendData4.length > 1 && (
        <div style={{ background: C.card, borderColor: C.border }} className="border rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">كميات الضخ اليومية — محطات طز (M³)</h3>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={trendData4} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gP1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.ok}   stopOpacity={0.3}/><stop offset="95%" stopColor={C.ok}   stopOpacity={0}/></linearGradient>
                <linearGradient id="gP2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} width={60} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
              <Area type="monotone" dataKey="PS1"    stroke={C.ok}     fill="url(#gP1)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="PS2"    stroke="#a78bfa"  fill="url(#gP2)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="غريان"  stroke={C.warn}   fill="none"      strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ─── Main SCADAView ────────────────────────────────────────────────────────── */
export default function SCADAView({ engine1, engine2, engine3, engine4 }: SCADAViewProps) {
  const [view, setView] = useState<ViewId>('overview');
  const r1 = (engine1?.readings ?? []) as E1R[];
  const r2 = (engine2?.readings ?? []) as E2R[];
  const r3 = (engine3?.readings ?? []) as E3R[];
  const r4 = (engine4?.readings ?? []) as E4R[];

  // Always bind to the latest reading from each engine so UI stays live with system updates.
  const e1 = r1.length > 0 ? r1[r1.length - 1] : null;
  const e2 = r2.length > 0 ? r2[r2.length - 1] : null;
  const e3 = r3.length > 0 ? r3[r3.length - 1] : null;
  const e4 = r4.length > 0 ? r4[r4.length - 1] : null;

  const hasAny = r1.length > 0 || r2.length > 0 || r3.length > 0 || r4.length > 0;
  const dayLabel = (e1?.dayNo ?? e2?.dayNo ?? e3?.dayNo ?? e4?.dayNo) ?? '—';

  if (!hasAny) {
    return (
      <div style={{ background: C.bg }} className="rounded-2xl p-16 text-center space-y-3">
        <Activity className="w-10 h-10 text-slate-700 mx-auto" />
        <p className="text-slate-500 text-sm">لا توجد بيانات محركات لعرض SCADA</p>
        <p className="text-slate-600 text-xs">قم برفع ملفات Excel لمحركات 1–4 للحصول على البيانات الكاملة</p>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ background: C.bg, fontFamily: 'monospace' }} className="rounded-2xl overflow-hidden">
      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div style={{ background: '#050e1a', borderBottom: '1px solid #0f2035' }} className="px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="text-xs text-slate-400 font-semibold">خريطة الشبكة المعتمدة (Live)</div>

        <div className="flex-1" />

        {/* Day display */}
        <span style={{ color: C.cyan }} className="text-xs font-bold tabular-nums">
          اليوم {dayLabel}
        </span>

        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-700/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          تحديث مباشر
        </span>

        {/* Engine status indicators */}
        <div className="flex gap-2 text-[10px]">
          {[
            { label: 'E1', active: r1.length > 0 },
            { label: 'E2', active: r2.length > 0 },
            { label: 'E3', active: r3.length > 0 },
            { label: 'E4', active: r4.length > 0 },
          ].map(e => (
            <span key={e.label} style={{ color: e.active ? C.ok : C.idle }}
              className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${e.active ? 'animate-pulse' : ''}`}
                style={{ background: e.active ? C.ok : C.idle }} />
              {e.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {VIEWS.map(v => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 rounded-lg border text-xs inline-flex items-center gap-1.5 ${active ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700/60' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            );
          })}
        </div>

        {view === 'overview' && <OverviewView e1={e1} e2={e2} e3={e3} e4={e4} r1={r1} r2={r2} r3={r3} r4={r4} />}
        {view === 'fields' && <FieldsView e1={e1} r1={r1} />}
        {view === 'eastern' && <EasternView e2={e2} r2={r2} />}
        {view === 'central' && <CentralView e3={e3} e4={e4} r3={r3} r4={r4} />}
      </div>
    </div>
  );
}
