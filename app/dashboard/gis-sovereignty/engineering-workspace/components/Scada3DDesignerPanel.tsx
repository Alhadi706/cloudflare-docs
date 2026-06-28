'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SCADA_USER_LAYOUT } from '../../../../control-center/scada/scadaUserLayout';

type MV = number | string | null;
const n = (v: MV, d = 0): number => {
  const x = +String(v ?? '');
  return Number.isFinite(x) ? x : d;
};

type DrawTool = 'path' | 'tank' | 'valve' | 'pump' | 'delete';
type DrawPath = { id: string; x1: number; y1: number; x2: number; y2: number };
type DrawTank = { id: string; x: number; y: number; w: number; h: number };
type DrawValve = { id: string; x: number; y: number; size: number };
type DrawPump = { id: string; x: number; y: number; r: number };
type LayoutDraft = { paths: DrawPath[]; tanks: DrawTank[]; valves: DrawValve[]; pumps: DrawPump[] };

type LivePayload = {
  e1?: any;
  e2?: any;
  e3?: any;
  e4?: any;
};

function uid() {
  return `eng-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

function pointLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, dot / lenSq)) : 0;
  const xx = x1 + t * C;
  const yy = y1 + t * D;
  return Math.hypot(px - xx, py - yy);
}

function euclidean(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function tankLevelColor(level: number, max: number) {
  const ratio = max > 0 ? level / max : 0;
  if (ratio >= 0.65) return '#22c55e';
  if (ratio >= 0.3) return '#f59e0b';
  return '#ef4444';
}

export default function Scada3DDesignerPanel({ onClose }: { onClose: () => void }) {
  const [activeTool, setActiveTool] = useState<DrawTool>('path');
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawHover, setDrawHover] = useState<{ x: number; y: number } | null>(null);
  const [jsonDraft, setJsonDraft] = useState('');
  const [layoutDraft, setLayoutDraft] = useState<LayoutDraft>(SCADA_USER_LAYOUT as unknown as LayoutDraft);
  const [live, setLive] = useState<LivePayload>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('engineering_scada_3d_layout_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as LayoutDraft;
      setLayoutDraft({
        paths: Array.isArray(parsed?.paths) ? parsed.paths : [],
        tanks: Array.isArray(parsed?.tanks) ? parsed.tanks : [],
        valves: Array.isArray(parsed?.valves) ? parsed.valves : [],
        pumps: Array.isArray(parsed?.pumps) ? parsed.pumps : [],
      });
    } catch {
      // Ignore malformed content.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('engineering_scada_3d_layout_v1', JSON.stringify(layoutDraft));
  }, [layoutDraft]);

  useEffect(() => {
    let cancel = false;
    const pull = async () => {
      try {
        const res = await fetch('/api/v1/engines/scada-live', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancel && data?.ok) {
          setLive({ e1: data.e1, e2: data.e2, e3: data.e3, e4: data.e4 });
        }
      } catch {
        // Keep last payload.
      }
    };

    void pull();
    const id = window.setInterval(() => { void pull(); }, 5000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, []);

  const e1 = live.e1?.readings?.[0] || null;
  const e2 = live.e2?.readings?.[0] || null;
  const e3 = live.e3?.readings?.[0] || null;
  const e4 = live.e4?.readings?.[0] || null;

  const wellsFlowing = n(e1?.ejh?.wellFieldDailyFlow) + n(e1?.nejhS?.wellFieldDailyFlow) + n(e1?.nejhN?.wellFieldDailyFlow) > 0;
  const centralFlowing = n(e3?.crossConnections?.totalFlow) + n(e3?.sidiSied?.totalFlow) + n(e3?.tarhunah?.totalFlow) > 0;
  const easternFlowing = n(e2?.airport?.dailyFlow) + n(e2?.sidiSaiah?.dailyFlow) + n(e2?.garabulli?.dailyFlow) + n(e2?.wadiTumallah?.dailyFlow) + n(e2?.ashShwayrifFcs?.dailyFlow) > 0;
  const tazFlowing = n(e4?.ps1?.pumpingVolume) + n(e4?.ps2?.pumpingToTank) > 0;
  const gharyanFlowing = n(e4?.gharyanConsumption) > 0;

  const tankDefs = [
    { label: 'خزان فزان', level: n(e1?.fezzanTankLevel), max: 12, x: 183, y: 1142 },
    { label: 'ترهونة', level: n(e3?.tarhunah?.level), max: 7, x: 425, y: 538 },
    { label: 'سيدي سعيد', level: n(e3?.sidiSied?.level), max: 7, x: 1115, y: 845 },
    { label: 'سيدي صياح', level: n(e2?.sidiSaiah?.rtLevel), max: 7, x: 1105, y: 1341 },
    { label: 'وادي تميلح', level: n(e2?.wadiTumallah?.rtLevel), max: 7, x: 1526, y: 1337 },
    { label: 'الشويرف', level: n(e2?.ashShwayrifRtLevel), max: 7, x: 2295, y: 506 },
    { label: 'TAZ A', level: n(e4?.tankLevel?.cellA), max: 8, x: 2032, y: 1339 },
    { label: 'TAZ B', level: n(e4?.tankLevel?.cellB), max: 8, x: 1514, y: 842 },
    { label: 'TAZ C', level: n(e4?.tankLevel?.cellC), max: 8, x: 559, y: 1124 },
    { label: 'TAZ D', level: n(e4?.tankLevel?.cellD), max: 8, x: 350, y: 858 },
    { label: 'TAZ E', level: n(e4?.tankLevel?.cellE), max: 8, x: 1526, y: 1337 },
  ];

  const pumpDefs = [
    { x: 528.7, y: 574.4, key: 'ejh', label: 'مضخة EJH' },
    { x: 447.4, y: 884.0, key: 'nejhS', label: 'مضخة NEJH-S' },
    { x: 276.0, y: 1164.4, key: 'nejhN', label: 'مضخة NEJH-N' },
    { x: 1260.3, y: 887.8, key: 'tarhunah', label: 'مضخة ترهونة' },
    { x: 2312.6, y: 623.2, key: 'ps1', label: 'مضخة PS1' },
    { x: 2317.0, y: 746.2, key: 'ps2', label: 'مضخة PS2' },
  ];

  const signalState: Record<string, boolean> = {
    wells: wellsFlowing,
    central: centralFlowing,
    eastern: easternFlowing,
    taz: tazFlowing,
    gharyan: gharyanFlowing,
    ejh: n(e1?.ejh?.operatingPumps) > 0,
    nejhS: n(e1?.nejhS?.operatingPumps) > 0,
    nejhN: n(e1?.nejhN?.operatingPumps) > 0,
    ps1: n(e4?.ps1?.activePumpNo) > 0,
    ps2: n(e4?.ps2?.activePumpNo) > 0,
    tarhunah: n(e3?.tarhunah?.noPumps) > 0,
  };

  const getSvgPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2420,
      y: ((e.clientY - rect.top) / rect.height) * 1870,
    };
  };

  const getPathActive = (pth: DrawPath) => {
    const xMid = (pth.x1 + pth.x2) / 2;
    const yMid = (pth.y1 + pth.y2) / 2;
    if (xMid < 900) {
      if (yMid < 760) return wellsFlowing;
      if (yMid < 1250) return centralFlowing || tazFlowing;
      return easternFlowing || tazFlowing;
    }
    if (xMid < 1800) return centralFlowing || tazFlowing || easternFlowing;
    return tazFlowing || easternFlowing || gharyanFlowing;
  };

  const getValveOpen = (v: DrawValve) => {
    if (v.x < 1000) return wellsFlowing || centralFlowing;
    if (v.x < 1800) return centralFlowing || tazFlowing;
    return easternFlowing || gharyanFlowing || tazFlowing;
  };

  const mapPumpSignal = (pm: DrawPump) => {
    let selected = pumpDefs[0];
    let best = Number.POSITIVE_INFINITY;
    pumpDefs.forEach(def => {
      const d = euclidean(pm.x, pm.y, def.x, def.y);
      if (d < best) {
        best = d;
        selected = def;
      }
    });
    return selected;
  };

  const mappedTanks = useMemo(() => {
    const valid = layoutDraft.tanks.filter(tk => tk.w >= 10 && tk.h >= 10);
    const byArea = [...valid].sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const remaining = new Set(tankDefs.map((_, idx) => idx));

    return byArea.map(tk => {
      const cx = tk.x + tk.w / 2;
      const cy = tk.y + tk.h / 2;
      let chosen = -1;
      let best = Number.POSITIVE_INFINITY;

      remaining.forEach(idx => {
        const t = tankDefs[idx];
        const d = euclidean(cx, cy, t.x, t.y);
        if (d < best) {
          best = d;
          chosen = idx;
        }
      });

      if (chosen === -1) {
        tankDefs.forEach((t, idx) => {
          const d = euclidean(cx, cy, t.x, t.y);
          if (d < best) {
            best = d;
            chosen = idx;
          }
        });
      }

      if (chosen >= 0) remaining.delete(chosen);
      return { tank: tk, signal: tankDefs[Math.max(0, chosen)] };
    });
  }, [layoutDraft.tanks, live]);

  const mappedPaths = useMemo(() => layoutDraft.paths.map(path => ({ path, active: getPathActive(path) })), [layoutDraft.paths, live]);
  const mappedValves = useMemo(() => layoutDraft.valves.map(valve => ({ valve, open: getValveOpen(valve) })), [layoutDraft.valves, live]);
  const mappedPumps = useMemo(() => layoutDraft.pumps.map(pump => {
    const sig = mapPumpSignal(pump);
    return { pump, label: sig.label, active: Boolean(signalState[sig.key]) };
  }), [layoutDraft.pumps, live]);

  const onCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
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
      setLayoutDraft(prev => ({ ...prev, tanks: [...prev.tanks, { id: uid(), x, y, w, h }] }));
      setDrawStart(null);
    }
  };

  return (
    <div className="fixed right-6 bottom-6 z-[9200] w-[680px] max-w-[95vw] rounded-2xl border border-cyan-700/50 bg-slate-950/95 text-slate-200 shadow-2xl backdrop-blur">
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-cyan-300">لوحة رسم المنظومة 3D الحية</h3>
          <p className="text-[11px] text-slate-400">أدوات: مسار | خزان | صمام | مضخة | حذف</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
      </div>

      <div className="p-2 border-b border-slate-800 flex flex-wrap gap-2 text-xs">
        {(['path', 'tank', 'valve', 'pump', 'delete'] as DrawTool[]).map(tool => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            className={`px-2 py-1 rounded border ${activeTool === tool ? 'bg-cyan-700/20 border-cyan-500/60 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
          >
            {tool === 'path' ? 'رسم مسار' : tool === 'tank' ? 'رسم خزان' : tool === 'valve' ? 'إضافة صمام' : tool === 'pump' ? 'إضافة مضخة' : 'حذف عنصر'}
          </button>
        ))}
        <button
          onClick={() => setLayoutDraft({ paths: [], tanks: [], valves: [], pumps: [] })}
          className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300"
        >
          مسح الكل
        </button>
        <button
          onClick={() => setLayoutDraft(SCADA_USER_LAYOUT as unknown as LayoutDraft)}
          className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300"
        >
          تحميل الافتراضي
        </button>
        <button
          onClick={async () => {
            const text = JSON.stringify(layoutDraft, null, 2);
            setJsonDraft(text);
            try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
          }}
          className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-300"
        >
          نسخ JSON
        </button>
      </div>

      <textarea
        value={jsonDraft}
        onChange={e => setJsonDraft(e.target.value)}
        placeholder="الصق JSON للتعديل السريع"
        className="w-full h-20 px-2 py-1 text-[11px] bg-slate-900 border-b border-slate-800 text-slate-300"
      />

      <div className="p-2">
        <svg
          viewBox="0 0 2420 1870"
          className="w-full h-auto rounded-xl border border-slate-800 bg-slate-950 cursor-crosshair"
          onClick={onCanvasClick}
          onMouseMove={e => drawStart && setDrawHover(getSvgPoint(e))}
        >
          <defs>
            <style>{`
              @keyframes engScadaFlow { from { stroke-dashoffset: 28; } to { stroke-dashoffset: 0; } }
              @keyframes engScadaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
              @keyframes engScadaShine { from { transform: translateX(-16px); opacity: 0; } 40% { opacity: 0.3; } to { transform: translateX(90px); opacity: 0; } }
            `}</style>
            <pattern id="engGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0f172a" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect x={0} y={0} width={2420} height={1870} fill="url(#engGrid)" />

          {mappedPaths.map(({ path, active }) => (
            <g key={path.id}>
              <line x1={path.x1} y1={path.y1} x2={path.x2} y2={path.y2} stroke="#0f172a" strokeWidth={9} strokeLinecap="round" opacity={0.6} />
              <line x1={path.x1} y1={path.y1} x2={path.x2} y2={path.y2} stroke="#334155" strokeWidth={6} strokeLinecap="round" />
              {active && (
                <line
                  x1={path.x1}
                  y1={path.y1}
                  x2={path.x2}
                  y2={path.y2}
                  stroke="#22d3ee"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray="12 8"
                  style={{ animation: 'engScadaFlow 0.9s linear infinite' }}
                />
              )}
            </g>
          ))}

          {mappedTanks.map(({ tank, signal }) => {
            const fillRatio = Math.max(0, Math.min(1, signal.max > 0 ? signal.level / signal.max : 0));
            const fillHeight = tank.h * fillRatio;
            const c = tankLevelColor(signal.level, signal.max);
            return (
              <g key={tank.id}>
                <rect x={tank.x} y={tank.y} width={tank.w} height={tank.h} fill="rgba(15,23,42,0.2)" stroke={c} strokeWidth={2.5} />
                <ellipse cx={tank.x + tank.w / 2} cy={tank.y + 2} rx={Math.max(4, tank.w / 2 - 2)} ry={3.5} fill="rgba(148,163,184,0.2)" />
                <rect x={tank.x + 1.5} y={tank.y + tank.h - fillHeight - 1.5} width={Math.max(0, tank.w - 3)} height={Math.max(0, fillHeight)} fill={c} opacity={0.35} />
                <rect x={tank.x + 6} y={tank.y + 4} width={6} height={Math.max(0, tank.h - 8)} fill="rgba(255,255,255,0.14)" style={{ animation: 'engScadaShine 3s ease-in-out infinite' }} />
                <text x={tank.x + tank.w / 2} y={tank.y - 8} textAnchor="middle" fill="#94a3b8" fontSize={11}>{signal.label}</text>
              </g>
            );
          })}

          {mappedValves.map(({ valve, open }) => {
            const vc = open ? '#22c55e' : '#ef4444';
            return (
              <g key={valve.id}>
                <circle cx={valve.x} cy={valve.y} r={valve.size * 0.72} fill="rgba(15,23,42,0.45)" stroke={vc} strokeWidth={1.2} />
                <polygon points={`${valve.x - valve.size},${valve.y - valve.size} ${valve.x - valve.size},${valve.y + valve.size} ${valve.x},${valve.y}`} fill={vc} stroke="#111827" strokeWidth={1} />
                <polygon points={`${valve.x + valve.size},${valve.y - valve.size} ${valve.x + valve.size},${valve.y + valve.size} ${valve.x},${valve.y}`} fill={vc} stroke="#111827" strokeWidth={1} />
              </g>
            );
          })}

          {mappedPumps.map(({ pump, active, label }) => {
            const pc = active ? '#22c55e' : '#64748b';
            return (
              <g key={pump.id}>
                <circle cx={pump.x} cy={pump.y} r={pump.r + 3} fill="rgba(2,6,23,0.45)" />
                <circle cx={pump.x} cy={pump.y} r={pump.r} fill={active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)'} stroke={pc} strokeWidth={3} />
                <g style={{ transformOrigin: `${pump.x}px ${pump.y}px`, animation: active ? 'engScadaSpin 1.3s linear infinite' : undefined }}>
                  <polygon points={`${pump.x - pump.r * 0.35},${pump.y - pump.r * 0.55} ${pump.x - pump.r * 0.35},${pump.y + pump.r * 0.55} ${pump.x + pump.r * 0.6},${pump.y}`} fill={pc} />
                  <polygon points={`${pump.x + pump.r * 0.35},${pump.y - pump.r * 0.55} ${pump.x + pump.r * 0.35},${pump.y + pump.r * 0.55} ${pump.x - pump.r * 0.6},${pump.y}`} fill={pc} opacity={0.65} />
                </g>
                <text x={pump.x} y={pump.y + pump.r + 15} textAnchor="middle" fill="#94a3b8" fontSize={10}>{label}</text>
              </g>
            );
          })}

          {drawStart && <circle cx={drawStart.x} cy={drawStart.y} r={7} fill="#facc15" stroke="#111827" strokeWidth={2} />}
          {drawStart && drawHover && activeTool === 'path' && (
            <line x1={drawStart.x} y1={drawStart.y} x2={drawHover.x} y2={drawHover.y} stroke="#facc15" strokeWidth={3} strokeDasharray="10 6" />
          )}
          {drawStart && drawHover && activeTool === 'tank' && (
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

      <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 max-h-36 overflow-auto">
          <div className="text-slate-300 mb-1">الخزانات</div>
          {mappedTanks.map(({ tank, signal }) => (
            <div key={`t-${tank.id}`} className="flex justify-between py-0.5 border-b border-slate-800/60 last:border-0">
              <span className="text-slate-400">{signal.label}</span>
              <span className="font-mono">{signal.level > 0 ? signal.level.toFixed(2) : '—'} m</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 max-h-36 overflow-auto">
          <div className="text-slate-300 mb-1">المضخات/الصمامات</div>
          {mappedPumps.map(({ pump, label, active }) => (
            <div key={`p-${pump.id}`} className="flex justify-between py-0.5 border-b border-slate-800/60">
              <span className="text-slate-400">{label}</span>
              <span className={active ? 'text-emerald-400' : 'text-rose-400'}>{active ? 'تشغيل' : 'توقف'}</span>
            </div>
          ))}
          {mappedValves.map(({ valve, open }, idx) => (
            <div key={`v-${valve.id}`} className="flex justify-between py-0.5 border-b border-slate-800/60 last:border-0">
              <span className="text-slate-400">صمام {idx + 1}</span>
              <span className={open ? 'text-emerald-400' : 'text-rose-400'}>{open ? 'مفتوح' : 'مغلق'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
