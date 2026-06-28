'use client';

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { LinearAsset } from '@/lib/linear-referencing/types';

interface Props {
  assets: LinearAsset[];
  selectedAssetId?: string;
  onAssetClick?: (id: string) => void;
}

// ── Sector colour palette ──────────────────────────────────────────────────
const SECTOR_COLORS: Record<string, string> = {
  'P/S-EJH':     '#6366f1',
  'CONV-C000':   '#0284c7',
  'CONV-C100':   '#0891b2',
  'P/S-NEJH(S)': '#7c3aed',
  'P/S-NEJH(N)': '#7c3aed',
  'CONV-C200':   '#0e7490',
  'CONV-C300':   '#0f766e',
  'FCS-ASH':     '#d97706',
  'CONV-C400':   '#155e75',
  'CONV-C500':   '#134e4a',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function getAssetType(code: string): string {
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

function getAssetColor(asset: LinearAsset): string {
  const type = getAssetType(asset.equipment_code || '');
  if (type === 'SAV' || type === 'DAV') return '#10b981';
  if (type === 'MH')            return '#475569';
  if (type === 'PU' || type === 'PUWE') return '#818cf8';
  if (type === 'WT')            return '#14b8a6';
  if (type === 'FCS')           return '#f59e0b';
  if (type === 'TJE')           return '#94a3b8';
  return '#64748b';
}

const FILTER_BUTTONS = [
  { key: 'SAV',  label: 'صمام هواء',    color: '#10b981' },
  { key: 'MH',   label: 'بوابة تفتيش',  color: '#475569' },
  { key: 'PU',   label: 'محطة ضخ',      color: '#818cf8' },
  { key: 'WT',   label: 'خزان مياه',    color: '#14b8a6' },
  { key: 'DAV',  label: 'صمام مزدوج',   color: '#f59e0b' },
  { key: 'PUWE', label: 'معدات ضخ',     color: '#6366f1' },
];

// ── SVG Layout constants ───────────────────────────────────────────────────
const SVG_H       = 300;
const PIPE_Y      = 140;   // pipeline centre-line y
const DENS_TOP    = 155;   // density strip top
const DENS_BTM    = 167;   // density strip bottom
const ELEV_TOP    = 172;   // elevation profile top
const ELEV_BTM    = 290;   // elevation profile bottom

// ── Component ─────────────────────────────────────────────────────────────
export default function LinearSchematicMap({ assets, selectedAssetId, onAssetClick }: Props) {
  const [zoom, setZoom]           = useState(1);          // 1 | 2 | 4
  const [filters, setFilters]     = useState<Set<string>>(
    new Set(['SAV', 'MH', 'PU', 'WT', 'DAV', 'PUWE', 'FCS', 'TJE'])
  );
  const [hovered, setHovered]     = useState<string | null>(null);
  const [showFlow, setShowFlow]   = useState(true);
  const containerRef              = useRef<HTMLDivElement>(null);
  const minimapViewRef            = useRef<SVGRectElement>(null);

  const sorted = useMemo(() => [...assets].sort((a, b) => a.station - b.station), [assets]);

  const minStation = sorted[0]?.station ?? 0;
  const maxStation = sorted[sorted.length - 1]?.station ?? 1;
  const totalLen   = maxStation - minStation || 1;

  const BASE_W  = 7000;
  const svgW    = BASE_W * zoom;

  const stX  = useCallback((st: number) => ((st - minStation) / totalLen) * svgW, [minStation, totalLen, svgW]);
  // Minimap coordinate space (0–1000)
  const stXM = useCallback((st: number) => ((st - minStation) / totalLen) * 1000, [minStation, totalLen]);

  // ── Scroll → update minimap viewport indicator (no re-render) ────────
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!minimapViewRef.current) return;
    const vw = Math.max(10, (el.clientWidth / svgW) * 1000);
    const vx = (el.scrollLeft / svgW) * 1000;
    minimapViewRef.current.setAttribute('x', vx.toString());
    minimapViewRef.current.setAttribute('width', vw.toString());
  }, [svgW]);

  // ── Minimap click → jump to position ─────────────────────────────────
  const handleMinimapClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const cw    = containerRef.current?.clientWidth ?? 0;
    containerRef.current?.scrollTo({ left: Math.max(0, ratio * svgW - cw / 2), behavior: 'smooth' });
  }, [svgW]);

  // Initialise viewport width on mount / zoom change
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !minimapViewRef.current) return;
    const vw = Math.max(10, (el.clientWidth / svgW) * 1000);
    minimapViewRef.current.setAttribute('width', vw.toString());
  }, [svgW]);

  // ── Elevation profile path ────────────────────────────────────────────
  const { elevPath, minElev, maxElev } = useMemo(() => {
    const pts = sorted.filter(a => a.invert_level > 0);
    if (pts.length < 2) return { elevPath: '', minElev: 0, maxElev: 1 };
    const elevs = pts.map(a => a.invert_level);
    const minE  = Math.min(...elevs);
    const maxE  = Math.max(...elevs);
    const eY    = (e: number) => ELEV_BTM - ((e - minE) / (maxE - minE)) * (ELEV_BTM - ELEV_TOP);
    const d     = pts.map((a, i) => {
      const x = ((a.station - minStation) / totalLen) * svgW;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${eY(a.invert_level).toFixed(1)}`;
    });
    const lx = (((pts[pts.length-1].station - minStation) / totalLen) * svgW).toFixed(1);
    const fx = (((pts[0].station - minStation) / totalLen) * svgW).toFixed(1);
    return {
      elevPath: `${d.join(' ')} L${lx},${ELEV_BTM} L${fx},${ELEV_BTM} Z`,
      minElev: minE,
      maxElev: maxE,
    };
  }, [sorted, minStation, totalLen, svgW]);

  // ── Sector bands ──────────────────────────────────────────────────────
  const sectorBands = useMemo(() => {
    const map: Record<string, { minSt: number; maxSt: number }> = {};
    for (const a of sorted) {
      const s = a.technical?.route_sector || 'Unknown';
      if (!map[s]) map[s] = { minSt: a.station, maxSt: a.station };
      map[s].minSt = Math.min(map[s].minSt, a.station);
      map[s].maxSt = Math.max(map[s].maxSt, a.station);
    }
    return map;
  }, [sorted]);

  // ── Density strip (per 10 km bins) ───────────────────────────────────
  const densityBins = useMemo(() => {
    const BIN = 10000;
    const bins: Record<number, { total: number }> = {};
    for (const a of sorted) {
      const b = Math.floor((a.station - minStation) / BIN);
      if (!bins[b]) bins[b] = { total: 0 };
      bins[b].total++;
    }
    const maxCount = Math.max(...Object.values(bins).map(b => b.total), 1);
    return Object.entries(bins).map(([b, { total }]) => {
      const bNum = parseInt(b);
      return {
        x:         ((bNum * BIN) / totalLen) * svgW,
        w:         Math.max(1, (BIN / totalLen) * svgW - 1),
        heightPct: total / maxCount,
      };
    });
  }, [sorted, minStation, totalLen, svgW]);

  // ── Steep slope zones (elevation drop >10m/km — pure geometry) ─────────
  const riskZones = useMemo(() => {
    const zones: { start: number; end: number }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const from = sorted[i - 1];
      const to   = sorted[i];
      const ds   = to.station - from.station;
      const de   = Math.abs(to.invert_level - from.invert_level);
      if (ds > 0 && (de / ds) * 1000 > 10) {
        zones.push({ start: from.station, end: to.station });
      }
    }
    return zones;
  }, [sorted]);

  // ── Station labels every 50 km ────────────────────────────────────────
  const stLabels = useMemo(() => {
    const out = [];
    const step = 50000;
    for (let st = Math.ceil(minStation / step) * step; st <= maxStation; st += step)
      out.push({ st, label: `C${Math.floor(st / 1000)}` });
    return out;
  }, [minStation, maxStation]);

  // ── Filtered / visible assets ─────────────────────────────────────────
  const visible = useMemo(() =>
    sorted.filter(a => {
      const t = getAssetType(a.equipment_code || '');
      // Always show FCS and TJE regardless of toggle
      if (t === 'FCS' || t === 'TJE') return true;
      return filters.has(t) || filters.has('PUWE') && t === 'PUWE';
    }),
  [sorted, filters]);

  // ── Summary counts ────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of visible) {
      const t = getAssetType(a.equipment_code || '');
      m[t] = (m[t] || 0) + 1;
    }
    return m;
  }, [visible]);

  // ── Hover tooltip ─────────────────────────────────────────────────────
  const hoveredAsset = hovered ? assets.find(a => a.id === hovered) : null;

  const toggleFilter = (key: string) => {
    setFilters(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">

      {/* ── Controls Row ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Zoom */}
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/60 p-1">
          <span className="px-2 text-[15px] text-slate-500 font-bold">تكبير</span>
          {([1, 2, 4] as const).map(z => (
            <button key={z} onClick={() => setZoom(z)}
              className={`px-3 py-1 rounded text-base font-bold transition-all ${zoom === z ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'}`}>
              {z}×
            </button>
          ))}
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_BUTTONS.map(({ key, label, color }) => (
            <button key={key} onClick={() => toggleFilter(key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-semibold transition-all border ${filters.has(key) ? 'border-transparent' : 'border-white/10 text-slate-500 bg-transparent'}`}
              style={filters.has(key) ? { background: color + '22', borderColor: color + '55', color } : {}}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: filters.has(key) ? color : '#475569' }} />
              {label} {filters.has(key) && counts[key] ? `(${counts[key]})` : ''}
            </button>
          ))}
        </div>

        {/* Flow toggle */}
        <button onClick={() => setShowFlow(!showFlow)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-semibold transition-all border ${
            showFlow ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' : 'border-white/10 text-slate-600'
          }`}>
          💧 تدفق {showFlow ? 'مفعّل' : 'معطّل'}
        </button>

        <span className="mr-auto text-[15px] text-slate-500">
          {visible.length} أصل مرئي من أصل {assets.length}
        </span>
      </div>

      {/* ── Minimap ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-black/40 overflow-hidden" style={{ height: 52 }}>
        <svg width="100%" height={52} viewBox="0 0 1000 52" preserveAspectRatio="none"
          onClick={handleMinimapClick} style={{ cursor: 'crosshair', display: 'block' }}>
          {/* Sector bands */}
          {Object.entries(sectorBands).map(([s, { minSt, maxSt }]) => (
            <rect key={s} x={stXM(minSt)} y={0}
              width={Math.max(1, stXM(maxSt) - stXM(minSt))} height={52}
              fill={SECTOR_COLORS[s] || '#334155'} opacity={0.18} />
          ))}
          {/* Risk zones */}
          {riskZones.map((z, i) => (
            <rect key={i} x={stXM(z.start) - 1} y={0}
              width={Math.max(2, stXM(z.end) - stXM(z.start) + 2)} height={52}
              fill="#f43f5e" opacity={0.22} />
          ))}
          {/* Pipeline line */}
          <line x1={0} y1={26} x2={1000} y2={26} stroke="#0284c7" strokeWidth={2} opacity={0.5} />
          {/* Special stations (PU, WT, FCS) — type-based color only */}
          {sorted.filter(a => { const t = getAssetType(a.equipment_code || ''); return t === 'PU' || t === 'PUWE' || t === 'WT' || t === 'FCS'; }).map(a => (
            <circle key={a.id} cx={stXM(a.station)} cy={26} r={4}
              fill={getAssetColor(a)} stroke="#0f172a" strokeWidth={1} />
          ))}
          {/* Viewport indicator */}
          <rect ref={minimapViewRef} x={0} y={1} width={200} height={50}
            fill="rgba(6,182,212,0.08)" stroke="#06b6d4" strokeWidth={1} rx={2}
            style={{ pointerEvents: 'none' }} />
        </svg>
      </div>
      <p className="text-[14px] text-slate-600 -mt-2 text-center">
        ← انقر على الخريطة المصغّرة للتنقل · المناطق المظللة = منحدر حاد (&gt;10م/كم) · الدوائر الملونة = محطات PU/WT/FCS
      </p>

      {/* ── SVG Strip Map ─────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-x-auto rounded-xl border border-white/8 bg-slate-950/70 cursor-default"
        style={{ height: SVG_H + 4 }}
      >
        <svg
          width={svgW}
          height={SVG_H}
          style={{ display: 'block', minWidth: svgW }}
        >
          <defs>
            <linearGradient id="lsm-elev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#0ea5e9" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="lsm-risk-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f43f5e" stopOpacity="0" />
              <stop offset="45%"  stopColor="#f43f5e" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* ── Sector background bands ──────────────────────────────── */}
          {Object.entries(sectorBands).map(([sector, { minSt, maxSt }]) => {
            const x1 = stX(minSt);
            const x2 = stX(maxSt);
            const c  = SECTOR_COLORS[sector] || '#334155';
            const cx = (x1 + x2) / 2;
            return (
              <g key={sector}>
                <rect x={x1} y={0} width={Math.max(x2 - x1, 1)} height={PIPE_Y - 8}
                  fill={c} opacity={0.07} />
                {/* Sector top bar */}
                <rect x={x1} y={0} width={Math.max(x2 - x1, 1)} height={3}
                  fill={c} opacity={0.5} />
                {/* Vertical divider */}
                <line x1={x1} y1={3} x2={x1} y2={PIPE_Y - 8}
                  stroke={c} strokeWidth={0.5} opacity={0.3} />
                {/* Sector label */}
                <text x={cx} y={16} textAnchor="middle"
                  fill={c} fontSize={14.0} fontWeight="bold" opacity={0.85} fontFamily="monospace">
                  {sector}
                </text>
                {/* Asset count */}
                <text x={cx} y={28} textAnchor="middle"
                  fill={c} fontSize={9.5} opacity={0.6} fontFamily="monospace">
                  {sorted.filter(a => a.technical?.route_sector === sector).length} أصل
                </text>
              </g>
            );
          })}

          {/* ── Risk zone overlays ────────────────────────────────────── */}
          {riskZones.map((z, i) => {
            const x1 = stX(z.start) - 10;
            const x2 = stX(z.end)   + 10;
            return (
              <g key={i}>
                <rect x={x1} y={0} width={Math.max(x2 - x1, 4)} height={SVG_H}
                  fill="url(#lsm-risk-grad)" />
                <rect x={x1} y={PIPE_Y - 22} width={Math.max(x2 - x1, 4)} height={44}
                  fill="#f43f5e" opacity={0.06} rx={3} />
                <text x={(x1 + x2) / 2} y={PIPE_Y - 24} textAnchor="middle"
                  fill="#f43f5e" fontSize={9.0} opacity={0.7} fontFamily="monospace">⚠ خطر مركّب</text>
              </g>
            );
          })}

          {/* ── Elevation profile ────────────────────────────────────── */}
          {elevPath && (
            <>
              {/* Divider line between schematic and elevation */}
              <line x1={0} y1={ELEV_TOP - 2} x2={svgW} y2={ELEV_TOP - 2}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <path d={elevPath} fill="url(#lsm-elev)" stroke="#0ea5e9" strokeWidth={1.2} opacity={0.85} />
              {/* Elevation axis labels */}
              <text x={8} y={ELEV_TOP + 9}  fill="#475569" fontSize={9.5} fontFamily="monospace">{maxElev.toFixed(0)}م</text>
              <text x={8} y={ELEV_BTM - 3}  fill="#475569" fontSize={9.5} fontFamily="monospace">{minElev.toFixed(0)}م</text>
              <text x={8} y={(ELEV_TOP + ELEV_BTM) / 2} fill="#334155" fontSize={9.0} fontFamily="monospace" transform={`rotate(-90,8,${(ELEV_TOP + ELEV_BTM) / 2})`}>المنسوب (م)</text>
            </>
          )}

          {/* ── Pipeline centre-line ─────────────────────────────────── */}
          <line x1={0} y1={PIPE_Y} x2={svgW} y2={PIPE_Y}
            stroke="#1e293b" strokeWidth={5} />
          <line x1={0} y1={PIPE_Y} x2={svgW} y2={PIPE_Y}
            stroke="#0284c7" strokeWidth={2} opacity={0.5} strokeDasharray="6 3" />
          {/* ── Animated flow dots ───────────────────────────────────── */}
          {showFlow && (
            <>
              <path id="lsm-flow-path" d={`M0,${PIPE_Y} L${svgW},${PIPE_Y}`} fill="none" />
              {[0, 3, 6, 9, 12, 15, 18, 21, 24, 27].map((delay, i) => (
                <circle key={i} r={2.5} fill="#22d3ee" opacity={0.55}>
                  <animateMotion dur="28s" begin={`-${delay}s`} repeatCount="indefinite">
                    <mpath href="#lsm-flow-path" />
                  </animateMotion>
                </circle>
              ))}
            </>
          )}

          {/* ── Density strip ─────────────────────────────────────────── */}
          <text x={6} y={DENS_TOP + 7} fill="#334155" fontSize={8.5} fontFamily="monospace">كثافة</text>
          {densityBins.map(({ x, w, heightPct }, i) => {
            const bh = Math.max(1, heightPct * (DENS_BTM - DENS_TOP));
            return (
              <rect key={i}
                x={x} y={DENS_BTM - bh} width={Math.max(w - 0.5, 0.5)} height={bh}
                fill={'#0ea5e9'} opacity={0.45} />
            );
          })}
          {/* ── Station labels ───────────────────────────────────────── */}
          {stLabels.map(({ st, label }) => {
            const x = stX(st);
            return (
              <g key={label}>
                <line x1={x} y1={PIPE_Y - 6} x2={x} y2={PIPE_Y + 6}
                  stroke="#334155" strokeWidth={1} />
                <line x1={x} y1={PIPE_Y + 6} x2={x} y2={ELEV_TOP - 2}
                  stroke="#334155" strokeWidth={0.5} opacity={0.4} />
                <text x={x} y={PIPE_Y + 18} textAnchor="middle"
                  fill="#475569" fontSize={9.5} fontFamily="monospace">
                  {label}
                </text>
              </g>
            );
          })}

          {/* ── Asset symbols ────────────────────────────────────────── */}
          {visible.map(asset => {
            const x     = stX(asset.station);
            const code  = asset.equipment_code || '';
            const type  = getAssetType(code);
            const isSel = asset.id === selectedAssetId;
            const isHov = asset.id === hovered;
            const color = getAssetColor(asset);
            const sc    = isSel ? 1.9 : isHov ? 1.5 : 1;

            // SAV / DAV → triangle above pipe
            if (type === 'SAV' || type === 'DAV') {
              const h  = 9 * sc;
              const hw = 5 * sc;
              const ty = PIPE_Y - 4 - h;
              return (
                <polygon key={asset.id}
                  points={`${x},${ty} ${x - hw},${PIPE_Y - 4} ${x + hw},${PIPE_Y - 4}`}
                  fill={color} opacity={isHov || isSel ? 1 : 0.72}
                  stroke={isSel ? '#fff' : isHov ? color : 'none'}
                  strokeWidth={isSel ? 0.8 : isHov ? 0.4 : 0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onAssetClick?.(asset.id)}
                  onMouseEnter={() => setHovered(asset.id)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            }

            // MH → circle below pipe
            if (type === 'MH') {
              const r = 3.5 * sc;
              return (
                <circle key={asset.id}
                  cx={x} cy={PIPE_Y + 10} r={r}
                  fill={color} opacity={isHov || isSel ? 1 : 0.6}
                  stroke={isSel ? '#fff' : isHov ? color : 'none'}
                  strokeWidth={isSel ? 0.8 : isHov ? 0.4 : 0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onAssetClick?.(asset.id)}
                  onMouseEnter={() => setHovered(asset.id)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            }

            // PU / PUWE / WT / FCS → large station marker ON the pipe
            if (type === 'PU' || type === 'PUWE' || type === 'WT' || type === 'FCS') {
              const r = type === 'WT' || type === 'FCS' ? 10 * sc : 12 * sc;
              const lbl = type === 'PUWE' ? 'PU' : code.split('-')[0].slice(0, 3);
              return (
                <g key={asset.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onAssetClick?.(asset.id)}
                  onMouseEnter={() => setHovered(asset.id)}
                  onMouseLeave={() => setHovered(null)}>
                  {/* Glow */}
                  {(isSel || isHov) && (
                    <circle cx={x} cy={PIPE_Y} r={r + 4} fill={color} opacity={0.2} />
                  )}
                  <circle cx={x} cy={PIPE_Y} r={r}
                    fill="#0f172a" stroke={color} strokeWidth={isSel ? 2 : 1.5} />
                  <circle cx={x} cy={PIPE_Y} r={r - 3} fill={color} opacity={0.35} />
                  <text x={x} y={PIPE_Y + 3} textAnchor="middle"
                    fill="#fff" fontSize={9.0} fontWeight="bold" fontFamily="monospace">
                    {lbl}
                  </text>
                  {/* Label below */}
                  <text x={x} y={PIPE_Y + r + 10} textAnchor="middle"
                    fill={color} fontSize={9.0} fontFamily="monospace" opacity={0.85}>
                    {code.split('-').slice(0, 2).join('-').slice(0, 12)}
                  </text>
                </g>
              );
            }

            // TJE → small diamond
            const ds = 4 * sc;
            return (
              <polygon key={asset.id}
                points={`${x},${PIPE_Y - ds} ${x + ds},${PIPE_Y} ${x},${PIPE_Y + ds} ${x - ds},${PIPE_Y}`}
                fill={color} opacity={isHov || isSel ? 1 : 0.7}
                style={{ cursor: 'pointer' }}
                onClick={() => onAssetClick?.(asset.id)}
                onMouseEnter={() => setHovered(asset.id)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}

          {/* ── Hover tooltip ────────────────────────────────────────── */}
          {hoveredAsset && (() => {
            const x     = stX(hoveredAsset.station);
            const tipW  = 160;
            const tipH  = 56;
            const tipX  = Math.max(4, Math.min(x - tipW / 2, svgW - tipW - 4));
            const tipY  = 35;
            const color = getAssetColor(hoveredAsset);
            const diameter = hoveredAsset.technical?.diameter || '';
            return (
              <g style={{ pointerEvents: 'none' }}>
                {/* Connector line */}
                <line x1={x} y1={PIPE_Y - 8} x2={x} y2={tipY + tipH}
                  stroke={color} strokeWidth={0.5} strokeDasharray="3 2" opacity={0.5} />
                <rect x={tipX} y={tipY} width={tipW} height={tipH}
                  rx={5} fill="#0a1628" stroke={color} strokeWidth={0.8} opacity={0.98} />
                <text x={tipX + 8} y={tipY + 14} fill="#e2e8f0" fontSize={12.0} fontWeight="bold" fontFamily="monospace">
                  {hoveredAsset.equipment_code}
                </text>
                <text x={tipX + 8} y={tipY + 26} fill="#94a3b8" fontSize={13.0} fontFamily="sans-serif">
                  {(hoveredAsset.name || '').slice(0, 24)}
                </text>
                <text x={tipX + 8} y={tipY + 37} fill="#64748b" fontSize={9.5} fontFamily="monospace">
                  C{Math.floor(hoveredAsset.station / 1000)}+{String(hoveredAsset.station % 1000).padStart(3,'0')} · {hoveredAsset.invert_level.toFixed(1)}م ارتفاع
                </text>
                {diameter && (
                  <text x={tipX + 8} y={tipY + 48} fontSize={9.5} fontFamily="monospace"
                    fill="#94a3b8">
                    مواصفة: {diameter}
                  </text>
                )}
              </g>
            );
          })()}
        </svg>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="9"><polygon points="5,0 0,9 10,9" fill="#10b981" /></svg>
          SAV/DAV — صمام هواء
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill="#475569" /></svg>
          MH — بوابة تفتيش
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="none" stroke="#818cf8" strokeWidth="2" /><circle cx="6" cy="6" r="3" fill="#818cf8" opacity="0.4" /></svg>
          PU/WT/FCS — محطات خاصة
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="8"><polygon points="5,0 10,4 5,8 0,4" fill="#94a3b8" /></svg>
          TJE — وصلة تمدد
        </span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-2 rounded inline-block bg-rose-500/20 border border-rose-500/30" /> منطقة منحدر حاد (&gt;10م/كم)</span>
        <span className="flex items-center gap-1.5"><svg width="10" height="8"><rect width="10" height="8" fill="#0ea5e9" opacity="0.5" /></svg> شريط الكثافة — توزيع الأصول على الطول</span>
        <span className="flex items-center gap-1.5">💧 نقاط متحركة = اتجاه التدفق</span>
        <span className="mr-auto text-slate-600">المنحنى الأزرق = منسوب القاع (Invert Level Profile)</span>
      </div>

    </div>
  );
}
