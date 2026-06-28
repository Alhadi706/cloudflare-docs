'use client';
/**
 * SCADAMimicView — Phase 1: Layout + Tag wiring
 * Mirrors the reference P&ID daily operations report.
 * Flow path:  Well Fields → Main Header → Tarhunah/Sidi-Sayyad Reservoirs
 *             → Cross Connection → TAZ PS-1 / PS-2 → Tank Cells A-E → Gharyan
 * Every element carries a tag_id. Values come from engine readings or show N/A.
 * No fake/hardcoded process values.
 */

import React, { useMemo, useState } from 'react';

/* ═══════════════════════════════════  helpers  ═══════════════════════════════ */
type MV = number | string | null;
const nn  = (v: MV): number => { const x = +String(v ?? ''); return isNaN(x) ? 0 : x; };
const fmt = (v: MV, dec = 0): string => {
  if (v === null || v === undefined || String(v).trim() === '') return 'N/A';
  const x = +String(v);
  if (!isFinite(x)) return 'N/A';
  return dec > 0 ? x.toFixed(dec) : x.toLocaleString('en');
};
const isRunning = (v: MV) => nn(v) > 0;
const isFlowing = (v: MV) => nn(v) > 0;

/* ═══════════════════════════════════  colour  ════════════════════════════════ */
const CLR = {
  pipeIdle:    '#334155',
  pipeFlow:    '#22d3ee',
  pipeFlowHi:  '#67e8f9',
  pumpOk:      '#16a34a',
  pumpOff:     '#dc2626',
  pumpIdle:    '#64748b',
  tankFill:    '#0ea5e9',
  tankBg:      '#0f172a',
  tankBorder:  '#1d4ed8',
  valveOpen:   '#16a34a',
  valveClosed: '#dc2626',
  cardBg:      '#0b1a2b',
  cardBorder:  '#1e3a5f',
  cardHead:    '#10243f',
  headerBg:    '#0f172a',
  bg:          '#020617',
  text:        '#cbd5e1',
};

/* ═══════════════════════════════════  tag dict  ══════════════════════════════ */
export const TAG_DICT: Record<string, { desc: string; unit: string; signal: 'analog'|'digital'; source: string }> = {
  'WF-NEJHN-PUMP': { desc: 'NEJH-N مضخات عاملة',           unit: 'عدد',    signal: 'digital', source: 'E1.nejhN.operatingPumps'      },
  'WF-NEJHN-FLOW': { desc: 'NEJH-N تدفق حقل الآبار',        unit: 'م³/يوم', signal: 'analog',  source: 'E1.nejhN.wellFieldDailyFlow'  },
  'WF-NEJHN-PRSS': { desc: 'NEJH-N ضغط الخروج',             unit: 'bar',    signal: 'analog',  source: 'E1.nejhN.outletPressure'      },
  'WF-NEJHN-WELL': { desc: 'NEJH-N آبار عاملة',             unit: 'عدد',    signal: 'digital', source: 'E1.nejhN.workingWells'        },
  'WF-NEJHS-PUMP': { desc: 'NEJH-S مضخات عاملة',           unit: 'عدد',    signal: 'digital', source: 'E1.nejhS.operatingPumps'      },
  'WF-NEJHS-FLOW': { desc: 'NEJH-S تدفق حقل الآبار',        unit: 'م³/يوم', signal: 'analog',  source: 'E1.nejhS.wellFieldDailyFlow'  },
  'WF-NEJHS-PRSS': { desc: 'NEJH-S ضغط الخروج',             unit: 'bar',    signal: 'analog',  source: 'E1.nejhS.outletPressure'      },
  'WF-NEJHS-WELL': { desc: 'NEJH-S آبار عاملة',             unit: 'عدد',    signal: 'digital', source: 'E1.nejhS.workingWells'        },
  'WF-EJH-PUMP':   { desc: 'EJH مضخات عاملة',               unit: 'عدد',    signal: 'digital', source: 'E1.ejh.operatingPumps'        },
  'WF-EJH-FLOW':   { desc: 'EJH تدفق حقل الآبار',            unit: 'م³/يوم', signal: 'analog',  source: 'E1.ejh.wellFieldDailyFlow'    },
  'WF-EJH-PRSS':   { desc: 'EJH ضغط الخروج',                 unit: 'bar',    signal: 'analog',  source: 'E1.ejh.outletPressure'        },
  'WF-EJH-FOREB':  { desc: 'EJH مستوى خزان الفور',           unit: 'م',      signal: 'analog',  source: 'E1.ejh.forebayTankLevel'      },
  'WF-EJH-WELL':   { desc: 'EJH آبار عاملة',                 unit: 'عدد',    signal: 'digital', source: 'E1.ejh.workingWells'          },
  'WF-FEZZAN-LVL': { desc: 'مستوى خزان فزان',                unit: 'م',      signal: 'analog',  source: 'E1.fezzanTankLevel'           },
  'CB-XCON-FLOW':  { desc: 'توصيلة عرضية – تدفق كلي',        unit: 'م³/يوم', signal: 'analog',  source: 'E3.crossConnections.totalFlow' },
  'CB-XCON-P-IN':  { desc: 'توصيلة عرضية – ضغط دخول',        unit: 'bar',    signal: 'analog',  source: 'E3.crossConnections.inletPressure'  },
  'CB-XCON-P-OUT': { desc: 'توصيلة عرضية – ضغط خروج',        unit: 'bar',    signal: 'analog',  source: 'E3.crossConnections.outletPressure' },
  'CB-SIDSD-LVL':  { desc: 'خزان سيدي الصيد – المنسوب',       unit: 'م',      signal: 'analog',  source: 'E3.sidiSied.level'            },
  'CB-SIDSD-FLOW': { desc: 'خزان سيدي الصيد – تدفق',          unit: 'م³/يوم', signal: 'analog',  source: 'E3.sidiSied.totalFlow'        },
  'CB-TARH-LVL':   { desc: 'خزان ترهونة – المنسوب',           unit: 'م',      signal: 'analog',  source: 'E3.tarhunah.level'            },
  'CB-TARH-FLOW':  { desc: 'خزان ترهونة – تدفق',              unit: 'م³/يوم', signal: 'analog',  source: 'E3.tarhunah.totalFlow'        },
  'CB-TARH-PUMP':  { desc: 'خزان ترهونة – عدد مضخات',        unit: 'عدد',    signal: 'digital', source: 'E3.tarhunah.noPumps'          },
  'CB-TARH-PRSS':  { desc: 'خزان ترهونة – ضغط خروج',          unit: 'bar',    signal: 'analog',  source: 'E3.tarhunah.outletPressure'   },
  'EB-AIRP-FLOW':  { desc: 'صمامات التحكم بطريق المطار – تدفق يومي', unit: 'م³/يوم', signal: 'analog',  source: 'E2.airport.dailyFlow'         },
  'EB-AIRP-P-OUT': { desc: 'صمامات التحكم بطريق المطار – ضغط خروج', unit: 'bar',    signal: 'analog',  source: 'E2.airport.outletPressure'    },
  'EB-AIRP-P-IN':  { desc: 'صمامات التحكم بطريق المطار – ضغط دخول', unit: 'bar',    signal: 'analog',  source: 'E2.airport.inletPressure'     },
  'EB-SHWR-LVL':   { desc: 'الشويرف – منسوب الخزان',           unit: 'م',      signal: 'analog',  source: 'E2.ashShwayrifRtLevel'        },
  'EB-SHWR-FLOW':  { desc: 'الشويرف – تدفق FCS',               unit: 'م³/يوم', signal: 'analog',  source: 'E2.ashShwayrifFcs.dailyFlow'  },
  'TAZ-PS1-PUMP':  { desc: 'PS1 – رقم المضخة العاملة',         unit: 'رقم',    signal: 'digital', source: 'E4.ps1.activePumpNo'          },
  'TAZ-PS1-P-IN':  { desc: 'PS1 – ضغط الدخول',                unit: 'bar',    signal: 'analog',  source: 'E4.ps1.inletPressure'         },
  'TAZ-PS1-P-OUT': { desc: 'PS1 – ضغط الخروج',                unit: 'bar',    signal: 'analog',  source: 'E4.ps1.outletPressure'        },
  'TAZ-PS1-VOL':   { desc: 'PS1 – حجم الضخ',                   unit: 'م³',     signal: 'analog',  source: 'E4.ps1.pumpingVolume'         },
  'TAZ-PS1-OPHRS': { desc: 'PS1 – ساعات التشغيل',               unit: 'ساعة',   signal: 'analog',  source: 'E4.ps1.totalOperationHours'   },
  'TAZ-PS2-PUMP':  { desc: 'PS2 – رقم المضخة العاملة',         unit: 'رقم',    signal: 'digital', source: 'E4.ps2.activePumpNo'          },
  'TAZ-PS2-P-IN':  { desc: 'PS2 – ضغط الدخول',                unit: 'bar',    signal: 'analog',  source: 'E4.ps2.inletPressure'         },
  'TAZ-PS2-P-OUT': { desc: 'PS2 – ضغط الخروج',                unit: 'bar',    signal: 'analog',  source: 'E4.ps2.outletPressure'        },
  'TAZ-PS2-VOL':   { desc: 'PS2 – ضخ للخزان',                  unit: 'م³',     signal: 'analog',  source: 'E4.ps2.pumpingToTank'         },
  'TAZ-PS2-OPHRS': { desc: 'PS2 – ساعات التشغيل',               unit: 'ساعة',   signal: 'analog',  source: 'E4.ps2.totalOperationHours'   },
  'TAZ-TANK-A':    { desc: 'خزان طز – الخلية A',               unit: 'م',      signal: 'analog',  source: 'E4.tankLevel.cellA'           },
  'TAZ-TANK-B':    { desc: 'خزان طز – الخلية B',               unit: 'م',      signal: 'analog',  source: 'E4.tankLevel.cellB'           },
  'TAZ-TANK-C':    { desc: 'خزان طز – الخلية C',               unit: 'م',      signal: 'analog',  source: 'E4.tankLevel.cellC'           },
  'TAZ-TANK-D':    { desc: 'خزان طز – الخلية D',               unit: 'م',      signal: 'analog',  source: 'E4.tankLevel.cellD'           },
  'TAZ-TANK-E':    { desc: 'خزان طز – الخلية E',               unit: 'م',      signal: 'analog',  source: 'E4.tankLevel.cellE'           },
  'TAZ-GHARYAN':   { desc: 'غريان – استهلاك يومي',              unit: 'م³/يوم', signal: 'analog',  source: 'E4.gharyanConsumption'        },
};

/* ═══════════════════════════════  SVG primitives  ════════════════════════════ */

/** Pump: circle with triangle arrow, coloured by status */
const Pump = ({ cx, cy, active, r = 14 }: { cx: number; cy: number; active: boolean; r?: number }) => {
  const c = active ? CLR.pumpOk : CLR.pumpOff;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="white" stroke={c} strokeWidth={2.5} />
      <polygon
        points={`${cx - r * 0.38},${cy - r * 0.6} ${cx - r * 0.38},${cy + r * 0.6} ${cx + r * 0.65},${cy}`}
        fill={c}
      />
    </g>
  );
};

/** Butterfly / cross valve */
const Valve = ({ cx, cy, open, size = 10 }: { cx: number; cy: number; open: boolean; size?: number }) => {
  const c = open ? CLR.valveOpen : CLR.valveClosed;
  return (
    <g>
      <polygon points={`${cx - size},${cy - size} ${cx - size},${cy + size} ${cx},${cy}`} fill={c} stroke="#111" strokeWidth={0.8} />
      <polygon points={`${cx + size},${cy - size} ${cx + size},${cy + size} ${cx},${cy}`} fill={c} stroke="#111" strokeWidth={0.8} />
    </g>
  );
};

/** Reservoir / tank with proportional fill + animated level + name label */
const Tank = ({
  x, y, w, h, level, maxLvl = 10, tagId, name,
}: { x: number; y: number; w: number; h: number; level: MV; maxLvl?: number; tagId: string; name?: string }) => {
  const lvl    = Math.max(0, nn(level));
  const pct    = Math.min(1, maxLvl > 0 ? lvl / maxLvl : 0);
  const fillH  = h * pct;
  /* colour by fill level: blue=ok, amber=medium, red=low */
  const lc     = pct >= 0.65 ? CLR.tankFill : pct >= 0.3 ? '#f59e0b' : '#dc2626';
  const hasData = lvl > 0 || (level !== null && level !== undefined && String(level).trim() !== '');
  return (
    <g>
      {/* ── Name plate above tank ── */}
      {name && (
        <>
          <rect x={x} y={y - 18} width={w} height={18} fill={CLR.cardHead} stroke={CLR.tankBorder} strokeWidth={1} rx={2} />
          <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight="bold" fill="white">{name}</text>
        </>
      )}
      {/* ── Tank body ── */}
      <rect x={x} y={y} width={w} height={h} fill={CLR.tankBg} stroke={CLR.tankBorder} strokeWidth={2} rx={2} />
      {/* ── Animated water fill ── */}
      {hasData && (
        <rect
          x={x + 1} y={y + h - fillH} width={w - 2} height={Math.max(0, fillH)}
          fill={lc} opacity={0.82} rx={1}
          style={{ transition: 'y 1.5s ease, height 1.5s ease, fill 0.8s ease' }}
        />
      )}
      {/* ── Level value (large, white) ── */}
      <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fontSize={13} fontWeight="bold" fill="white"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}>
        {fmt(level, 2)} م
      </text>
      {/* ── Percentage badge at bottom of tank ── */}
      {hasData && (
        <text x={x + w / 2} y={y + h - 6} textAnchor="middle" fontSize={9} fill={lc} fontWeight="bold">
          {(pct * 100).toFixed(0)}٪
        </text>
      )}
      {/* ── Tag ID small below ── */}
      <text x={x + w / 2} y={y + h + 13} textAnchor="middle" fontSize={7} fill="#475569">{tagId}</text>
    </g>
  );
};

/** Flow arrow indicator on a pipe */
const Arrow = ({ x, y, dir = 'right', flowing }: { x: number; y: number; dir?: 'right'|'left'|'down'|'up'; flowing: boolean }) => {
  const c = flowing ? CLR.pipeFlow : CLR.pipeIdle;
  const paths: Record<string, string> = {
    right: `M${x - 7},${y - 5} L${x + 7},${y} L${x - 7},${y + 5}Z`,
    left:  `M${x + 7},${y - 5} L${x - 7},${y} L${x + 7},${y + 5}Z`,
    down:  `M${x - 5},${y - 7} L${x},${y + 7} L${x + 5},${y - 7}Z`,
    up:    `M${x - 5},${y + 7} L${x},${y - 7} L${x + 5},${y + 7}Z`,
  };
  return <path d={paths[dir]} fill={c} opacity={0.9} />;
};

/** Data card: header + table rows */
const Card = ({ x, y, w = 145, title, rows, tagPrefix }: {
  x: number; y: number; w?: number;
  title: string;
  rows: { label: string; value: MV; unit?: string }[];
  tagPrefix?: string;
}) => {
  const rh = 17;
  const totalH = 22 + rows.length * rh;
  return (
    <g>
      <rect x={x} y={y} width={w} height={totalH} fill={CLR.cardBg} stroke={CLR.cardBorder} strokeWidth={1.5} />
      <rect x={x} y={y} width={w} height={21} fill={CLR.cardHead} />
      <text x={x + w / 2} y={y + 14} textAnchor="middle" fontSize={9} fontWeight="bold" fill="white">{title}</text>
      {rows.map((row, i) => (
        <g key={i}>
          <line x1={x} y1={y + 22 + i * rh} x2={x + w} y2={y + 22 + i * rh} stroke={CLR.cardBorder} strokeWidth={0.5} />
          <line x1={x + w * 0.55} y1={y + 22 + i * rh} x2={x + w * 0.55} y2={y + 22 + (i + 1) * rh} stroke={CLR.cardBorder} strokeWidth={0.5} />
          <text x={x + w * 0.53} y={y + 22 + i * rh + rh - 4} textAnchor="end"  fontSize={8} fill="#94a3b8">{row.label}</text>
          <text x={x + w * 0.57} y={y + 22 + i * rh + rh - 4} textAnchor="start" fontSize={8} fontWeight="bold"
            fill={row.value === null || String(row.value ?? '') === '' ? '#94a3b8' : CLR.text}>
            {fmt(row.value, ['bar', 'م'].includes(row.unit ?? '') ? 2 : 0)}{row.unit ? ` ${row.unit}` : ''}
          </text>
        </g>
      ))}
      {tagPrefix && (
        <text x={x + 2} y={y + totalH + 10} fontSize={6.5} fill="#94a3b8">{tagPrefix}-*</text>
      )}
    </g>
  );
};

/** Flow-meter badge (oval) */
const FlowMeter = ({ x, y, value, unit = 'م³/يوم' }: { x: number; y: number; value: MV; unit?: string }) => (
  <g>
    <rect x={x - 42} y={y - 11} width={84} height={22} rx={11} fill="white" stroke="#5c3a21" strokeWidth={1.5} />
    <text x={x} y={y + 4} textAnchor="middle" fontSize={9} fontWeight="bold" fill={CLR.text}>
      {fmt(value)} {unit}
    </text>
  </g>
);

/* ═══════════════════════════════════  props  ═════════════════════════════════ */
interface EngineOutput { filename: string; sheetName: string; readings: Record<string, unknown>[]; issues?: string[] }
export interface SCADAMimicProps {
  engine1: EngineOutput | null;
  engine2: EngineOutput | null;
  engine3: EngineOutput | null;
  engine4: EngineOutput | null;
  totalProduction?: number;
  totalConsumption?: number;
  embedded?: boolean;
}

/* ═══════════════════════════════════  main  ══════════════════════════════════ */
export default function SCADAMimicView({ engine1, engine2, engine3, engine4, totalProduction, totalConsumption, embedded = false }: SCADAMimicProps) {
  const [showTags, setShowTags] = useState(false);

  /* extract last-day readings */
  const d = useMemo(() => {
    const last = (eng: EngineOutput | null) =>
      eng?.readings?.length ? (eng.readings[eng.readings.length - 1] as Record<string, unknown>) : null;
    const r1 = last(engine1) as any;
    const r2 = last(engine2) as any;
    const r3 = last(engine3) as any;
    const r4 = last(engine4) as any;
    return {
      /* E1 – Well Fields */
      nejhN:  r1?.nejhN  ?? {},
      nejhS:  r1?.nejhS  ?? {},
      ejh:    r1?.ejh    ?? {},
      fezzan: r1?.fezzanTankLevel ?? null,
      /* E2 – Eastern Branch */
      airport:  r2?.airport         ?? {},
      garabulli: r2?.garabulli      ?? {},
      wadiTumallah: r2?.wadiTumallah ?? {},
      shwyrLvl: r2?.ashShwayrifRtLevel   ?? null,
      shwyrFcs: r2?.ashShwayrifFcs?.dailyFlow ?? null,
      sidiSaiah: r2?.sidiSaiah       ?? {},
      /* E3 – Central Branch */
      xconn:    r3?.crossConnections ?? {},
      sidiSied: r3?.sidiSied         ?? {},
      tarhunah: r3?.tarhunah         ?? {},
      /* E4 – TAZ */
      ps1:     r4?.ps1       ?? {},
      ps2:     r4?.ps2       ?? {},
      tanks:   r4?.tankLevel ?? {},
      gharyan: r4?.gharyanConsumption ?? null,
    };
  }, [engine1, engine2, engine3, engine4]);

  /* derive pipe / flow states */
  const wellsFlowing = isFlowing(d.nejhN.wellFieldDailyFlow) || isFlowing(d.nejhS.wellFieldDailyFlow) || isFlowing(d.ejh.wellFieldDailyFlow);
  const tarhFlowing  = isFlowing(d.tarhunah.totalFlow);
  const sidsFlowing  = isFlowing(d.sidiSied.totalFlow);
  const xconFlowing  = isFlowing(d.xconn.totalFlow);
  const ps1Flowing   = isFlowing(d.ps1.pumpingVolume);
  const ps2Flowing   = isFlowing(d.ps2.pumpingToTank);
  const eastFlowing  = isFlowing(d.airport.dailyFlow) || isFlowing(d.sidiSaiah.dailyFlow) || isFlowing(d.garabulli.dailyFlow) || isFlowing(d.wadiTumallah.dailyFlow) || isFlowing(d.shwyrFcs);
  const eastCityFlow = nn(d.airport.dailyFlow) + nn(d.sidiSaiah.dailyFlow) + nn(d.garabulli.dailyFlow) + nn(d.wadiTumallah.dailyFlow) + nn(d.shwyrFcs);
  const centralCityFlow = nn(d.xconn.totalFlow) + nn(d.sidiSied.totalFlow);

  const noData = !engine1 && !engine2 && !engine3 && !engine4;

  /* svg dimensions */
  const W = 1380, H = 1030;

  /* pipe helper */
  const pipe = (x1: number, y1: number, x2: number, y2: number, flowing: boolean, w = 5) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={CLR.pipeIdle}
        strokeWidth={w} strokeLinecap="round" />
      {flowing && (
        <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={CLR.pipeFlowHi}
          strokeWidth={Math.max(2, w - 1)}
          strokeLinecap="round"
          strokeDasharray="10 8"
          style={{ animation: 'pipeFlowDash 0.9s linear infinite' }} />
      )}
    </g>
  );

  return (
    <div className="w-full" dir="rtl">
      {/* toolbar */}
      {!embedded && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-700">
          <span className="text-xs text-slate-400 font-mono">
            Phase 1 — Layout &amp; Tag Wiring
            {engine1 && <span className="ml-2 text-slate-500">{engine1.filename}</span>}
          </span>
          <button
            onClick={() => setShowTags(v => !v)}
            className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
          >
            {showTags ? 'إخفاء جدول Tags' : 'عرض جدول Tags'}
          </button>
        </div>
      )}

      {/* ── MIMIC SVG ── */}
      <div className="overflow-x-auto" style={{ background: CLR.bg }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 900, maxWidth: W }}
          preserveAspectRatio="xMidYMid meet"
          fontFamily="'Segoe UI', Arial, sans-serif">

          <defs>
            <pattern id="scada-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#0f2035" strokeWidth="0.8" />
            </pattern>
            <style>{`@keyframes pipeFlowDash { from { stroke-dashoffset: 18; } to { stroke-dashoffset: 0; } }`}</style>
          </defs>

          {/* background */}
          <rect width={W} height={H} fill={CLR.bg} />
          <rect width={W} height={H} fill="url(#scada-grid)" opacity="0.65" />

          {/* ══ HEADER ═════════════════════════════════════════════════════════ */}
          <rect x={0} y={0} width={W} height={58} fill={CLR.headerBg} />
          <text x={W / 2} y={24} textAnchor="middle" fontSize={18} fontWeight="bold" fill="white">
            التقرير اليومي لوضعية تشغيل المنظومة
          </text>
          <text x={W / 2} y={42} textAnchor="middle" fontSize={10} fill="#64748b">
            منظومة الحساوات – سهل الكارة · إدارة التحكم والاتصالات
          </text>
          {/* Production / Consumption summary */}
          {(totalProduction || totalConsumption) && (
            <>
              <rect x={W / 2 - 200} y={32} width={180} height={20} rx={4} fill="white" opacity={0.15} />
              <text x={W / 2 - 110} y={46} textAnchor="middle" fontSize={10} fill="white">
                الإنتاج: {(totalProduction || 0).toLocaleString('en')} م³/يوم
              </text>
              <rect x={W / 2 + 20} y={32} width={180} height={20} rx={4} fill="white" opacity={0.15} />
              <text x={W / 2 + 110} y={46} textAnchor="middle" fontSize={10} fill="white">
                الاستهلاك: {(totalConsumption || 0).toLocaleString('en')} م³/يوم
              </text>
            </>
          )}
          {/* Status legend */}
          {[
            { cx: 30,  label: 'شغّال',      c: CLR.pumpOk },
            { cx: 95,  label: 'متوقف',      c: CLR.pumpOff },
            { cx: 165, label: 'غير متصل',   c: '#64748b' },
            { cx: 255, label: 'تدفق نشط',   c: CLR.pipeFlow },
          ].map(s => (
            <g key={s.label}>
              <circle cx={s.cx} cy={H - 18} r={6} fill={s.c} />
              <text x={s.cx + 10} y={H - 14} fontSize={9} fill={CLR.text}>{s.label}</text>
            </g>
          ))}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ZONE A — WELL FIELDS (x=10 to x=290)                             */}
          {/* ══════════════════════════════════════════════════════════════════ */}

          {/* ── NEJH-N (top well field group) ──────────────────── y≈90 */}
          <Card x={10} y={78} w={170} title="حقل شمال شرق جبال الحساوينة"
            tagPrefix="WF-NEJHN" rows={[
              { label: 'معدل تدفق الآبار',  value: d.nejhN.wellFieldDailyFlow, unit: 'م³/يوم' },
              { label: 'المضخات العاملة',   value: d.nejhN.operatingPumps },
              { label: 'الآبار العاملة',    value: d.nejhN.workingWells },
              { label: 'ضغط الخروج',        value: d.nejhN.outletPressure,     unit: 'bar' },
            ]} />
          {/* pipe: card → pump → valve → main header */}
          {pipe(165, 118,  220, 118, wellsFlowing)}
          <Pump  cx={233}  cy={118} active={isRunning(d.nejhN.operatingPumps)} />
          {pipe(247, 118,  275, 118, wellsFlowing)}
          <Valve cx={288} cy={118} open={isRunning(d.nejhN.operatingPumps)} />
          {pipe(300, 118,  320, 118, wellsFlowing)}

          {/* ── NEJH-S (middle well field group) ───────────────── y≈240 */}
          <Card x={10} y={228} w={170} title="حقل شمال شرق جبل الحساونة"
            tagPrefix="WF-NEJHS" rows={[
              { label: 'معدل تدفق الآبار',  value: d.nejhS.wellFieldDailyFlow, unit: 'م³/يوم' },
              { label: 'المضخات العاملة',   value: d.nejhS.operatingPumps },
              { label: 'الآبار العاملة',    value: d.nejhS.workingWells },
              { label: 'ضغط الخروج',        value: d.nejhS.outletPressure,     unit: 'bar' },
            ]} />
          {pipe(165, 268,  220, 268, wellsFlowing)}
          <Pump  cx={233}  cy={268} active={isRunning(d.nejhS.operatingPumps)} />
          {pipe(247, 268,  275, 268, wellsFlowing)}
          <Valve cx={288} cy={268} open={isRunning(d.nejhS.operatingPumps)} />
          {pipe(300, 268,  320, 268, wellsFlowing)}

          {/* ── EJH (main well field station) ──────────────────── y≈390 */}
          <Card x={10} y={378} w={170} title="حقل شرق جبل الحساونة"
            tagPrefix="WF-EJH" rows={[
              { label: 'معدل تدفق الآبار',  value: d.ejh.wellFieldDailyFlow,   unit: 'م³/يوم' },
              { label: 'المضخات العاملة',   value: d.ejh.operatingPumps },
              { label: 'الآبار العاملة',    value: d.ejh.workingWells },
              { label: 'ضغط الخروج',        value: d.ejh.outletPressure,       unit: 'bar' },
              { label: 'مستوى خزان الفور',  value: d.ejh.forebayTankLevel,     unit: 'م' },
            ]} />
          {pipe(165, 423,  220, 423, wellsFlowing)}
          <Pump  cx={233}  cy={423} active={isRunning(d.ejh.operatingPumps)} />
          {pipe(247, 423,  275, 423, wellsFlowing)}
          <Valve cx={288} cy={423} open={isRunning(d.ejh.operatingPumps)} />
          {pipe(300, 423,  320, 423, wellsFlowing)}

          {/* ── Fezzan Tank (lower left) ─────────────────────────── y≈570 */}
          <Tank x={40} y={598} w={110} h={90} level={d.fezzan} maxLvl={12} tagId="WF-FEZZAN-LVL" name="خزان فزان" />

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ZONE B — MAIN VERTICAL SUPPLY HEADER (x≈320)                     */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {pipe(320, 80,  320, 660, wellsFlowing, 8)}
          <text x={333} y={260} fontSize={8} fontWeight="bold" fill={CLR.text} transform="rotate(90, 333, 260)">
            الخط الرئيسي
          </text>
          <Arrow x={320} y={160} dir="down" flowing={wellsFlowing} />
          <Arrow x={320} y={310} dir="down" flowing={wellsFlowing} />
          <Arrow x={320} y={500} dir="down" flowing={wellsFlowing} />

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ZONE C — CENTRAL ZONE: Tarhunah + Sidi Sayyad (x=340 to x=680)  */}
          {/* ══════════════════════════════════════════════════════════════════ */}

          {/* ── Tarhunah Reservoir ─────────────────── y≈90..280 */}
          {pipe(320, 175,  500, 175, tarhFlowing)}
          <Arrow x={415} y={175} dir="right" flowing={tarhFlowing} />
          <FlowMeter x={410} y={155} value={d.tarhunah.totalFlow} />

          {/* Tarhunah pump on pipe */}
          <Pump cx={470} cy={175} active={isRunning(d.tarhunah.noPumps)} r={13} />
          {pipe(483, 175, 510, 175, tarhFlowing)}
          <Valve cx={523} cy={175} open={isRunning(d.tarhunah.noPumps)} />
          {pipe(536, 175, 555, 175, tarhFlowing)}

          <Tank x={555} y={108} w={110} h={105} level={d.tarhunah.level} maxLvl={15} tagId="CB-TARH-LVL" name="خزان ترهونة" />

          <Card x={430} y={218} w={160} title="محطة الضخ بترهونة" tagPrefix="CB-TARH" rows={[
            { label: 'التدفق الكلي',    value: d.tarhunah.totalFlow,      unit: 'م³/يوم' },
            { label: 'عدد المضخات',    value: d.tarhunah.noPumps },
            { label: 'ضغط الخروج',     value: d.tarhunah.outletPressure, unit: 'bar' },
            { label: 'المنسوب',         value: d.tarhunah.level,           unit: 'م' },
          ]} />

          {/* ── Sidi Sayyad Reservoir ──────────────── y≈390..550 */}
          {pipe(320, 440,  500, 440, sidsFlowing)}
          <Arrow x={415} y={440} dir="right" flowing={sidsFlowing} />
          <FlowMeter x={410} y={420} value={d.sidiSied.totalFlow} />

          <Tank x={555} y={382} w={110} h={105} level={d.sidiSied.level} maxLvl={15} tagId="CB-SIDSD-LVL" name="خزان سيدي الصيد" />

          <Card x={430} y={492} w={150} title="خزان سيدي الصيد" tagPrefix="CB-SIDSD" rows={[
            { label: 'التدفق الكلي', value: d.sidiSied.totalFlow, unit: 'م³/يوم' },
            { label: 'المنسوب',      value: d.sidiSied.level,      unit: 'م' },
          ]} />

          {/* ── Cross connection (dashed vertical between tanks) ── */}
          <line x1={605} y1={203} x2={605} y2={382} stroke={xconFlowing ? CLR.pipeFlowHi : '#64748b'} strokeWidth={3} strokeDasharray="10 5"
            style={xconFlowing ? { animation: 'pipeFlowDash 0.9s linear infinite' } : undefined} />
          <Valve cx={605} cy={295} open={xconFlowing} size={9} />
          <text x={617} y={295} fontSize={8} fill="#475569">توصيلة عرضية</text>

          <Card x={622} y={258} w={140} title="التوصيلة العرضية" tagPrefix="CB-XCON" rows={[
            { label: 'التدفق الكلي',  value: d.xconn.totalFlow,        unit: 'م³/يوم' },
            { label: 'ضغط الدخول',   value: d.xconn.inletPressure,    unit: 'bar' },
            { label: 'ضغط الخروج',   value: d.xconn.outletPressure,   unit: 'bar' },
          ]} />

          {/* ── Eastern Branch (Airport → Sidi Saiah → Garabulli → Wadi Tumallah → Shwayrif) */}
          {pipe(320, 620,  360, 620, eastFlowing, 4)}
          <line x1={360} y1={620} x2={360} y2={690} stroke={eastFlowing ? CLR.pipeFlowHi : CLR.pipeIdle} strokeWidth={3} strokeDasharray="9 4"
            style={eastFlowing ? { animation: 'pipeFlowDash 0.9s linear infinite' } : undefined} />
          <text x={363} y={660} fontSize={8} fill={eastFlowing ? CLR.pipeFlowHi : CLR.pipeIdle}>فرع شرقي</text>

          {pipe(360, 690, 760, 690, eastFlowing, 4)}
          <Arrow x={430} y={690} dir="right" flowing={eastFlowing} />
          <Arrow x={560} y={690} dir="right" flowing={eastFlowing} />
          <Arrow x={690} y={690} dir="right" flowing={eastFlowing} />

          <Card x={370} y={608} w={155} title="صمامات التحكم بطريق المطار" tagPrefix="EB-AIRP" rows={[
            { label: 'التدفق اليومي',  value: d.airport.dailyFlow,      unit: 'م³/يوم' },
            { label: 'ضغط الدخول',    value: d.airport.inletPressure,  unit: 'bar' },
            { label: 'ضغط الخروج',    value: d.airport.outletPressure, unit: 'bar' },
          ]} />

          <Card x={532} y={608} w={130} title="خزان سيدي السايح" tagPrefix="EB-SIDI" rows={[
            { label: 'التدفق اليومي',  value: d.sidiSaiah.dailyFlow, unit: 'م³/يوم' },
            { label: 'منسوب RT',       value: d.sidiSaiah.rtLevel,    unit: 'م' },
          ]} />

          <Card x={670} y={608} w={130} title="خزان القرابوللي" tagPrefix="EB-GARB" rows={[
            { label: 'التدفق اليومي',  value: d.garabulli.dailyFlow, unit: 'م³/يوم' },
            { label: 'منسوب RT',       value: d.garabulli.rtLevel,    unit: 'م' },
          ]} />

          <Card x={808} y={608} w={145} title="محطة التحكم بالتدفق وادي تمالة" tagPrefix="EB-WADI" rows={[
            { label: 'التدفق اليومي',  value: d.wadiTumallah.dailyFlow, unit: 'م³/يوم' },
            { label: 'منسوب RT',       value: d.wadiTumallah.rtLevel,    unit: 'م' },
          ]} />

          <Card x={946} y={608} w={140} title="الشويرف المسار الشرقي" tagPrefix="EB-SHWR" rows={[
            { label: 'منسوب الخزان',  value: d.shwyrLvl, unit: 'م' },
            { label: 'تدفق FCS',      value: d.shwyrFcs, unit: 'م³/يوم' },
          ]} />

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ZONE D — TAZ PUMP STATIONS (x=780 to x=960)                     */}
          {/* ══════════════════════════════════════════════════════════════════ */}

          {/* pipe: Tarhunah → PS-1 */}
          {pipe(655, 175,  800, 175, ps1Flowing)}
          <Arrow x={730} y={175} dir="right" flowing={ps1Flowing} />
          <Pump cx={775} cy={175} active={isRunning(d.ps1.activePumpNo)} r={13} />
          {pipe(788, 175, 800, 175, ps1Flowing)}

          <Card x={800} y={118} w={165} title="محطة الضخ 1  (PS-1)" tagPrefix="TAZ-PS1" rows={[
            { label: 'المضخة العاملة',    value: d.ps1.activePumpNo },
            { label: 'ضغط الدخول',       value: d.ps1.inletPressure,      unit: 'bar' },
            { label: 'ضغط الخروج',       value: d.ps1.outletPressure,     unit: 'bar' },
            { label: 'حجم الضخ',          value: d.ps1.pumpingVolume,      unit: 'م³' },
            { label: 'ساعات التشغيل',    value: d.ps1.totalOperationHours, unit: 'ساعة' },
          ]} />

          {/* pipe: Sidi Sayyad → PS-2 */}
          {pipe(655, 440,  800, 440, ps2Flowing)}
          <Arrow x={730} y={440} dir="right" flowing={ps2Flowing} />
          <Pump cx={775} cy={440} active={isRunning(d.ps2.activePumpNo)} r={13} />
          {pipe(788, 440, 800, 440, ps2Flowing)}

          <Card x={800} y={388} w={165} title="محطة الضخ 2  (PS-2)" tagPrefix="TAZ-PS2" rows={[
            { label: 'المضخة العاملة',    value: d.ps2.activePumpNo },
            { label: 'ضغط الدخول',       value: d.ps2.inletPressure,      unit: 'bar' },
            { label: 'ضغط الخروج',       value: d.ps2.outletPressure,     unit: 'bar' },
            { label: 'ضخ للخزان',         value: d.ps2.pumpingToTank,      unit: 'م³' },
            { label: 'ساعات التشغيل',    value: d.ps2.totalOperationHours, unit: 'ساعة' },
          ]} />

          {/* direct distribution spine (without synthetic A-E tank column) */}
          {pipe(965, 175, 1060, 175, ps1Flowing || ps2Flowing, 5)}
          {pipe(965, 440, 1060, 440, ps1Flowing || ps2Flowing, 5)}
          {pipe(1060, 120, 1060, 730, ps1Flowing || ps2Flowing, 6)}
          <Arrow x={1060} y={300} dir="down" flowing={ps1Flowing || ps2Flowing} />

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ZONE F — DISTRIBUTION: Gharyan + Cities (x=1130 to x=1380)      */}
          {/* ══════════════════════════════════════════════════════════════════ */}

          {/* Eastern / central distribution endpoints */}
          {pipe(655, 125, 1160, 125, tarhFlowing, 3)}
          {pipe(655, 420, 1160, 420, sidsFlowing || xconFlowing, 3)}
          {pipe(1060, 690, 1160, 690, eastFlowing, 3)}
          {pipe(1060, 340, 1160, 340, ps1Flowing || ps2Flowing, 3)}
          <Arrow x={1128} y={125} dir="right" flowing={tarhFlowing} />
          <Arrow x={1128} y={420} dir="right" flowing={sidsFlowing || xconFlowing} />
          <Arrow x={1128} y={690} dir="right" flowing={eastFlowing} />

          <Card x={1160} y={86} w={180} title="مدن الخط الأوسط (علوي)" tagPrefix="DIST-CENTRAL-N" rows={[
            { label: 'تغذية تقديرية', value: centralCityFlow, unit: 'م³/يوم' },
            { label: 'المصدر', value: 'ترهونة + التقاطعات' },
          ]} />

          <Card x={1160} y={380} w={180} title="مدن الخط الأوسط (سفلي)" tagPrefix="DIST-CENTRAL-S" rows={[
            { label: 'تغذية تقديرية', value: nn(d.sidiSied.totalFlow), unit: 'م³/يوم' },
            { label: 'المصدر', value: 'سيدي سعيد' },
          ]} />

          <Card x={1160} y={615} w={180} title="مدن الفرع الشرقي" tagPrefix="DIST-EAST" rows={[
            { label: 'تغذية تقديرية', value: eastCityFlow, unit: 'م³/يوم' },
            { label: 'المصدر', value: 'المطار/السايح/القرابوللي/تمالة/الشويرف' },
          ]} />

          {/* Pipe: tank array → Gharyan */}
          {pipe(1115, 340, 1160, 340, isFlowing(d.gharyan))}
          <Arrow x={1138} y={340} dir="right" flowing={isFlowing(d.gharyan)} />

          <Card x={1160} y={295} w={160} title="مدينة غريان" tagPrefix="TAZ-GHARYAN" rows={[
            { label: 'الاستهلاك اليومي', value: d.gharyan, unit: 'م³/يوم' },
          ]} />

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ZONE E — TAZ TANK CELLS A–E (خزانات مجمع طز)                     */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* Header label */}
          <rect x={745} y={780} width={385} height={18} rx={3} fill={CLR.cardHead} />
          <text x={937} y={793} textAnchor="middle" fontSize={11} fontWeight="bold" fill="white">
            خزانات مجمع طز — الخلايا A إلى E
          </text>
          {/* Tanks row */}
          <Tank x={745}  y={800} w={70} h={90} level={d.tanks.cellA} maxLvl={15} tagId="TAZ-TANK-A" name="خلية A" />
          <Tank x={820}  y={800} w={70} h={90} level={d.tanks.cellB} maxLvl={15} tagId="TAZ-TANK-B" name="خلية B" />
          <Tank x={895}  y={800} w={70} h={90} level={d.tanks.cellC} maxLvl={15} tagId="TAZ-TANK-C" name="خلية C" />
          <Tank x={970}  y={800} w={70} h={90} level={d.tanks.cellD} maxLvl={15} tagId="TAZ-TANK-D" name="خلية D" />
          <Tank x={1045} y={800} w={70} h={90} level={d.tanks.cellE} maxLvl={15} tagId="TAZ-TANK-E" name="خلية E" />
          {/* Connect spine to tanks */}
          {pipe(1060, 730, 1060, 800, ps1Flowing || ps2Flowing, 4)}
          <Arrow x={1060} y={760} dir="down" flowing={ps1Flowing || ps2Flowing} />

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* TANK COLOUR LEGEND (top-right)                                    */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          <rect x={1075} y={62} width={300} height={56} rx={4} fill={CLR.cardHead} opacity={0.95} />
          <text x={1087} y={76} fontSize={9} fontWeight="bold" fill="#94a3b8">دلالة ألوان الخزانات (نسبة الامتلاء)</text>
          {/* Blue */}
          <rect x={1087} y={81} width={13} height={13} rx={2} fill={CLR.tankFill} />
          <text x={1104} y={92} fontSize={8.5} fill={CLR.text}>مستوى مرتفع  ≥ 65٪</text>
          {/* Amber */}
          <rect x={1087} y={99} width={13} height={13} rx={2} fill="#f59e0b" />
          <text x={1104} y={110} fontSize={8.5} fill={CLR.text}>مستوى متوسط  30–65٪</text>
          {/* Red */}
          <rect x={1225} y={81} width={13} height={13} rx={2} fill="#dc2626" />
          <text x={1242} y={92} fontSize={8.5} fill={CLR.text}>مستوى منخفض  &lt; 30٪</text>
          {/* No data */}
          <rect x={1225} y={99} width={13} height={13} rx={2} fill={CLR.tankBg} stroke="#475569" strokeWidth={1} />
          <text x={1242} y={110} fontSize={8.5} fill="#64748b">لا توجد بيانات</text>

          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#1e3a5f">
            SCADA Integrated Dynamic View — Tripoli Water System
          </text>

          {/* No data overlay */}
          {noData && (
            <g>
              <rect x={0} y={58} width={W} height={H - 58} fill="rgba(0,0,0,0.55)" />
              <text x={W / 2} y={H / 2 - 20} textAnchor="middle" fontSize={20} fill="white" fontWeight="bold">
                لا توجد بيانات محركات
              </text>
              <text x={W / 2} y={H / 2 + 10} textAnchor="middle" fontSize={13} fill="#94a3b8">
                حمّل ملف Excel الشهري لعرض شاشة الميميك
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ══ Tag Dictionary Panel ══════════════════════════════════════════════ */}
      {!embedded && showTags && (
        <div className="mt-4 px-4 pb-6 overflow-x-auto" dir="rtl">
          <h3 className="text-sm font-bold text-slate-300 mb-2">
            جدول Tags — Phase 1 ({Object.keys(TAG_DICT).length} عنصر)
          </h3>
          <table className="text-[11px] border-collapse w-full">
            <thead>
              <tr className="bg-slate-800 text-slate-300">
                {['tag_id', 'الوصف', 'الوحدة', 'النوع', 'المصدر (Engine)'].map(h => (
                  <th key={h} className="border border-slate-700 px-2 py-1 text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(TAG_DICT).map(([id, t], i) => (
                <tr key={id} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-950'}>
                  <td className="border border-slate-800 px-2 py-0.5 font-mono text-cyan-400">{id}</td>
                  <td className="border border-slate-800 px-2 py-0.5 text-slate-300">{t.desc}</td>
                  <td className="border border-slate-800 px-2 py-0.5 text-slate-400">{t.unit}</td>
                  <td className="border border-slate-800 px-2 py-0.5 text-slate-500">{t.signal}</td>
                  <td className="border border-slate-800 px-2 py-0.5 font-mono text-slate-500 text-[10px]">{t.source}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 bg-amber-950/40 border border-amber-800 rounded-lg p-3 text-xs text-amber-200" dir="rtl">
            <strong>قائمة الفجوات (Gaps) — Phase 1</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside text-amber-300">
              <li>استهلاك المدن الأخرى (طرابلس، سوق الجمعة…) غير متوفرة في محركات E1-E4 — تُجلب من <code>result.consumption</code>.</li>
              <li>مستويات الضغط الكاملة للشبكة الشرقية (سيدي عيسى، وادي تميلح، غرابولي) — E2 يحتوي فقط مستويات RT.</li>
              <li>حالة الصمامات الفعلية (مفتوح/مغلق) غير متوفرة كإشارة رقمية — مستنتجة من تدفق المضخة.</li>
              <li>الأحمال الكهربائية للمضخات وتيارات الطور غير متوفرة في هذه المحركات.</li>
              <li>مواقع GPS للأصول لتكاملها مع نظام GIS — تحتاج إلى ربط خارجي (Phase 2+).</li>
              <li>تواريخ آخر صيانة للمضخات — تحتاج قاعدة بيانات الصيانة الوقائية.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
