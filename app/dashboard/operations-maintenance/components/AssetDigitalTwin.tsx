'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { LinearAsset } from '@/lib/linear-referencing/types';

// ── Types ──────────────────────────────────────────────────────────────────
interface HealthScore { total: number; wall: number; pressure: number; age: number; inspection: number; }
interface Issue { id: string; severity: 'critical' | 'warning' | 'info'; title: string; description: string; }
interface MaintenanceEntry {
  id: string;
  date: string;
  type: 'inspection' | 'repair' | 'replacement' | 'cleaning' | 'calibration' | 'other';
  description: string;
  result: 'pass' | 'fail' | 'needs_followup';
  technician?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Returns the pressure class (PN) from the diameter field — e.g. "150x06" → 6 (PN6 = 6 bar rated)
// NOTE: the second number is NOT wall thickness; it is the pressure class (PN) in bar.
export function getSAVPressureClass(asset: LinearAsset): number {
  const d = asset.technical?.diameter || '';
  if (d.includes('x')) { const pn = parseFloat(d.split('x')[1]); return isNaN(pn) ? -1 : pn; }
  return -1;
}
/** @deprecated use getSAVPressureClass — kept for backward compat only */
export const getSAVThickness = getSAVPressureClass;

function computeHealth(asset: LinearAsset, minElev: number, maxElev: number): HealthScore {
  const code = asset.equipment_code || '';
  // Wall score now represents pressure-class adequacy (PN≥10 → full marks, PN6/8 → lower but not critical)
  let wall = 70;
  if (code.startsWith('SAV') || code.startsWith('DAV')) {
    const pn = getSAVPressureClass(asset);
    if (pn > 0) wall = pn >= 10 ? 100 : pn >= 8 ? 80 : 65;
  }
  const elevRange = maxElev - minElev || 1;
  const pressure = Math.round(((asset.invert_level - minElev) / elevRange) * 100);
  return {
    total: Math.round(wall * 0.35 + pressure * 0.30 + 70 * 0.20 + 50 * 0.15),
    wall, pressure, age: 70, inspection: 50,
  };
}

function detectIssues(asset: LinearAsset, minElev: number, maxElev: number): Issue[] {
  const issues: Issue[] = [];
  const code = asset.equipment_code || '';
  if (code.startsWith('SAV') || code.startsWith('DAV')) {
    const pn = getSAVPressureClass(asset);
    if (pn > 0) issues.push({ id: 'pn-class', severity: 'info', title: `درجة الضغط التصميمية: PN${pn}`, description: `الصمام مُصنَّف عند PN${pn} (${pn} bar حسب مواصفة التصميم) — الرقم الثاني في الكود "DN×PN" هو درجة الضغط وليس سماكة الجدار` });
  }
  const elevPct = (asset.invert_level - minElev) / (maxElev - minElev);
  if (elevPct < 0.25) {
    const estP = ((maxElev - asset.invert_level) * 0.0981).toFixed(1);
    issues.push({ id: 'high-pressure', severity: elevPct < 0.1 ? 'critical' : 'warning', title: 'منطقة ضغط هيدروليكي مرتفع', description: `الموقع في منطقة ضغط تقديري ~${estP} bar ناتج عن انخفاض المنسوب — زيادة تكرار الفحص مطلوبة` });
  }
  if (!asset.technical?.source_sheet) issues.push({ id: 'no-ref', severity: 'info', title: 'مرجع المخطط الهندسي غير مرفق', description: 'يُوصى بإضافة رقم مخطط المصدر (As-Built Drawing) لاستيفاء ملف الأصل' });
  if (!asset.technical?.diameter) issues.push({ id: 'no-spec', severity: 'info', title: 'مواصفات القطر غير مسجّلة', description: 'البيانات التقنية للقطر والسماكة غير موجودة في السجل' });
  return issues;
}

// ── SVG: Health Score Ring ─────────────────────────────────────────────────
function HealthRing({ score }: { score: number }) {
  const R = 42, cx = 54, cy = 54;
  const circ = 2 * Math.PI * R;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#f43f5e';
  const label = score >= 70 ? 'جيد' : score >= 40 ? 'متوسط' : 'حرج';
  return (
    <svg width="108" height="108" viewBox="0 0 108 108">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 1.2s ease', filter: `drop-shadow(0 0 8px ${color})` }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="20" fontWeight="800" fontFamily="monospace">{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={color} fontSize="10" fontFamily="sans-serif">{label}</text>
    </svg>
  );
}

// ── SVG: 3D Animated Pipe Cross-Section ────────────────────────────────────
function PipeCrossSection({ pnClass, pressurePct }: { pnClass: number; pressurePct: number }) {
  const outerR = 50, cx = 62, cy = 62;
  const wallPx = 8; // fixed visual wall (actual wall thickness not in data)
  const innerR = outerR - wallPx;
  const waterFill = Math.max(0.2, Math.min(0.95, pressurePct / 100));
  const waterY = cy + innerR - waterFill * 2 * innerR;
  // Colour by PN class: PN≥10 → green, PN8 → amber, PN6 → sky blue
  const wallColor = pnClass >= 10 ? '#10b981' : pnClass >= 8 ? '#f59e0b' : '#38bdf8';
  const wallLabel = `PN${pnClass}`;
  const pBar = ((100 - pressurePct) * 0.35).toFixed(1);

  return (
    <div className="space-y-1">
      <svg width="124" height="124" viewBox="0 0 124 124">
        <defs>
          <clipPath id="dt-inner-clip"><circle cx={cx} cy={cy} r={innerR - 0.5} /></clipPath>
          <radialGradient id="dt-pipe-bg" cx="38%" cy="32%">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#071428" />
          </radialGradient>
          <linearGradient id="dt-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {/* Glow behind outer ring */}
        <circle cx={cx} cy={cy} r={outerR + 4} fill="none" stroke={wallColor} strokeWidth="2" opacity="0.15" />
        {/* Outer wall ring */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={wallColor} strokeWidth={wallPx}
          style={{ filter: `drop-shadow(0 0 5px ${wallColor}88)` }} />
        {/* Inner pipe dark fill */}
        <circle cx={cx} cy={cy} r={innerR} fill="url(#dt-pipe-bg)" />
        {/* Water body */}
        <rect x={cx - innerR} y={waterY} width={innerR * 2} height={cy + innerR - waterY}
          fill="url(#dt-water)" clipPath="url(#dt-inner-clip)" />
        {/* Animated wave on water surface */}
        <g clipPath="url(#dt-inner-clip)" opacity="0.85">
          <path d={`M ${cx - innerR},${waterY} q ${innerR * 0.3},-5 ${innerR * 0.6},0 q ${innerR * 0.3},5 ${innerR * 0.6},0`}
            fill="none" stroke="#7dd3fc" strokeWidth="1.5">
            <animateTransform attributeName="transform" type="translate"
              from={`${-innerR * 0.6},0`} to={`0,0`} dur="2.5s" repeatCount="indefinite" />
          </path>
        </g>
        {/* Air pocket label */}
        {waterFill < 0.9 && (
          <text x={cx} y={Math.max(cy - innerR + 14, waterY - 5)} textAnchor="middle" fill="#94a3b8" fontSize="7.5">هواء</text>
        )}
        <text x={cx} y={cy + innerR - 8} textAnchor="middle" fill="#bae6fd" fontSize="7.5">ماء</text>
        {/* PN annotation */}
        <line x1={cx + innerR} y1={cy} x2={cx + outerR} y2={cy} stroke={wallColor} strokeWidth="1" strokeDasharray="2 1" />
        <text x={cx + outerR + 4} y={cy + 4} fill={wallColor} fontSize="8.5" fontWeight="bold" fontFamily="monospace">{wallLabel}</text>
        <text x={cx + outerR + 4} y={cy + 14} fill={wallColor} fontSize="7" fontFamily="monospace">د. ضغط</text>
      </svg>
      <p className="text-[14px] text-slate-500 text-center">مقطع عرضي — ضغط ~{pBar} bar</p>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  asset: LinearAsset;
  allAssets: LinearAsset[];
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  inspection: 'فحص دوري', repair: 'إصلاح', replacement: 'استبدال',
  cleaning: 'تنظيف', calibration: 'معايرة', other: 'أخرى',
};
const RESULT_COLORS: Record<string, string> = { pass: 'text-emerald-400', fail: 'text-rose-400', needs_followup: 'text-amber-400' };
const RESULT_LABELS: Record<string, string> = { pass: '✓ اجتاز', fail: '✗ رسب', needs_followup: '⚠ يحتاج متابعة' };

// ── Main Component ─────────────────────────────────────────────────────────
export default function AssetDigitalTwin({ asset, allAssets, onClose }: Props) {
  const [tab, setTab] = useState<'overview' | 'issues' | 'maintenance' | 'specs'>('overview');
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<MaintenanceEntry>>({
    type: 'inspection', result: 'pass', date: new Date().toISOString().split('T')[0],
  });
  const [log, setLog] = useState<MaintenanceEntry[]>([]);

  // Load from localStorage
  useEffect(() => {
    try { setLog(JSON.parse(localStorage.getItem(`maint-${asset.id}`) || '[]')); }
    catch { setLog([]); }
  }, [asset.id]);

  const elevations = useMemo(() => allAssets.map(a => a.invert_level).filter(e => e > 0), [allAssets]);
  const minElev = useMemo(() => Math.min(...elevations), [elevations]);
  const maxElev = useMemo(() => Math.max(...elevations), [elevations]);
  const health = useMemo(() => computeHealth(asset, minElev, maxElev), [asset, minElev, maxElev]);
  const issues = useMemo(() => detectIssues(asset, minElev, maxElev), [asset, minElev, maxElev]);

  const code = asset.equipment_code || '';
  const pn = getSAVPressureClass(asset);
  const thickness = pn; // alias for legacy uses below
  const pressurePct = Math.round(((asset.invert_level - minElev) / (maxElev - minElev)) * 100);
  const estPressure = ((maxElev - asset.invert_level) * 0.0981).toFixed(1);
  const isSAV = code.startsWith('SAV') || code.startsWith('DAV');
  const severity = health.total >= 70 ? 'safe' : health.total >= 40 ? 'warning' : 'critical';
  const borderClass = severity === 'safe' ? 'border-emerald-500/25' : severity === 'warning' ? 'border-amber-500/25' : 'border-rose-500/35';
  const bgClass = severity === 'critical' ? 'bg-rose-500/4' : '';

  const riskBars = [
    { label: 'درجة الضغط (PN)', score: health.wall, weight: '35%', note: pn > 0 ? `PN${pn}` : 'غير محدد' },
    { label: 'الضغط الهيدروليكي', score: health.pressure, weight: '30%', note: `~${estPressure} bar` },
    { label: 'عمر الأصل', score: health.age, weight: '20%', note: 'بيانات غير متاحة' },
    { label: 'حالة الفحص', score: health.inspection, weight: '15%', note: log.length > 0 ? `${log.length} سجل` : 'لا سجلات' },
  ];

  const saveEntry = () => {
    if (!newEntry.description || !newEntry.date) return;
    const entry: MaintenanceEntry = {
      id: Date.now().toString(), date: newEntry.date!,
      type: (newEntry.type as MaintenanceEntry['type']) || 'inspection',
      description: newEntry.description!, result: (newEntry.result as MaintenanceEntry['result']) || 'pass',
      technician: newEntry.technician,
    };
    const updated = [entry, ...log];
    setLog(updated);
    localStorage.setItem(`maint-${asset.id}`, JSON.stringify(updated));
    setNewEntry({ type: 'inspection', result: 'pass', date: new Date().toISOString().split('T')[0] });
    setShowForm(false);
  };

  const tabDefs: { key: typeof tab; label: string; badge?: number }[] = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'issues', label: 'المشاكل', badge: issues.filter(i => i.severity !== 'info').length || undefined },
    { key: 'maintenance', label: 'الصيانة', badge: log.length || undefined },
    { key: 'specs', label: 'المواصفات' },
  ];

  return (
    <div className={`rounded-[24px] border ${borderClass} ${bgClass} bg-slate-950/80 backdrop-blur-xl overflow-hidden`}>

      {/* ── Header ── */}
      <div className="flex items-start gap-4 px-6 py-5 border-b border-white/8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <span className="font-black font-mono text-xl text-white tracking-wide">{code}</span>
            <span className={`text-[13px] px-2 py-0.5 rounded-full font-bold border ${severity === 'safe' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : severity === 'warning' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse'}`}>
              {severity === 'safe' ? '● سليم' : severity === 'warning' ? '● تحذير' : '● حرج'}
            </span>
            {issues.some(i => i.severity === 'critical') && (
              <span className="text-[13px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                {issues.filter(i => i.severity === 'critical').length} مشكلة حرجة
              </span>
            )}
          </div>
          <p className="text-base text-slate-400 truncate">{asset.name}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-[13px] text-slate-500">
            <span>📍 {asset.technical?.route_sector || '—'}</span>
            <span>📏 C{Math.floor(asset.station / 1000)}+{String(asset.station % 1000).padStart(3, '0')}</span>
            <span>⬆ {asset.invert_level.toFixed(2)} م ارتفاع</span>
            {pn > 0 && <span>🔩 PN{pn} ({pn} bar)</span>}
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-full bg-white/5 hover:bg-white/12 text-slate-400 hover:text-white flex items-center justify-center text-lg leading-none transition-all">×</button>
      </div>

      {/* ── Sub-tabs ── */}
      <div className="flex px-4 pt-3 border-b border-white/5 gap-0.5">
        {tabDefs.map(({ key, label, badge }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`relative px-4 py-2 text-base font-semibold transition-all rounded-t ${tab === key ? 'text-cyan-400 bg-cyan-500/8 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}>
            {label}
            {badge ? (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[13px] flex items-center justify-center font-bold">{badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="p-5">

        {/* ══ OVERVIEW ══ */}
        {tab === 'overview' && (
          <div className="grid gap-5 md:grid-cols-[auto_1fr]">
            {/* Left column */}
            <div className="flex flex-col items-center gap-2">
              <HealthRing score={health.total} />
              <p className="text-[13px] text-slate-500">مؤشر الصحة الإجمالي</p>
              {isSAV && pn > 0 && (
                <PipeCrossSection pnClass={pn} pressurePct={pressurePct} />
              )}
            </div>
            {/* Right column */}
            <div className="space-y-3.5">
              <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">تحليل الخطر الرباعي</p>
              {riskBars.map(bar => {
                const c = bar.score >= 70 ? '#10b981' : bar.score >= 40 ? '#f59e0b' : '#f43f5e';
                return (
                  <div key={bar.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[13px] text-slate-300">{bar.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-slate-600">{bar.note}</span>
                        <span className="text-[14px] text-slate-600">وزن {bar.weight}</span>
                        <span className="text-[13px] font-bold font-mono" style={{ color: c }}>{bar.score}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${bar.score}%`, background: c, boxShadow: `0 0 8px ${c}55` }} />
                    </div>
                  </div>
                );
              })}
              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="rounded-xl bg-black/30 border border-white/6 p-3 text-center">
                  <p className="text-[14px] text-slate-500 mb-0.5">الضغط التقديري</p>
                  <p className="text-lg font-black font-mono text-amber-400">{estPressure} bar</p>
                </div>
                <div className="rounded-xl bg-black/30 border border-white/6 p-3 text-center">
                  <p className="text-[14px] text-slate-500 mb-0.5">فارق الارتفاع</p>
                  <p className="text-lg font-black font-mono text-sky-400">{(maxElev - asset.invert_level).toFixed(0)} م</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ ISSUES ══ */}
        {tab === 'issues' && (
          <div className="space-y-3">
            {issues.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-600">
                <span className="text-4xl">✓</span>
                <p className="text-base">لا توجد مشاكل مُكتشفة تلقائياً</p>
              </div>
            ) : issues.map(issue => {
              const styles = {
                critical: { bg: 'bg-rose-500/8', border: 'border-rose-500/30', icon: '🔴', text: 'text-rose-400', badge: 'حرج' },
                warning:  { bg: 'bg-amber-500/8', border: 'border-amber-500/30', icon: '🟡', text: 'text-amber-400', badge: 'تحذير' },
                info:     { bg: 'bg-sky-500/8',  border: 'border-sky-500/30',  icon: 'ℹ️', text: 'text-sky-400',  badge: 'معلومة' },
              }[issue.severity];
              return (
                <div key={issue.id} className={`rounded-xl border ${styles.border} ${styles.bg} p-4`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{styles.icon}</span>
                    <span className={`text-[13px] font-bold ${styles.text}`}>{issue.title}</span>
                    <span className={`mr-auto text-[14px] px-1.5 py-0.5 rounded-full border ${styles.border} ${styles.text} font-bold`}>{styles.badge}</span>
                  </div>
                  <p className="text-[13px] text-slate-400 leading-relaxed">{issue.description}</p>
                </div>
              );
            })}
            <p className="text-[13px] text-slate-600 pt-2">💡 المشاكل الواردة مُولَّدة تلقائياً من البيانات الهندسية المتاحة — أضف ملاحظات يدوية من تبويب الصيانة</p>
          </div>
        )}

        {/* ══ MAINTENANCE LOG ══ */}
        {tab === 'maintenance' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base text-slate-400">{log.length} سجل مسجّل</span>
              <button onClick={() => setShowForm(!showForm)}
                className="text-base px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all font-semibold">
                + إضافة سجل صيانة
              </button>
            </div>

            {showForm && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[13px] text-slate-500 block mb-1">التاريخ</label>
                    <input type="date" value={newEntry.date || ''} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-base text-white" />
                  </div>
                  <div>
                    <label className="text-[13px] text-slate-500 block mb-1">نوع العمل</label>
                    <select value={newEntry.type} onChange={e => setNewEntry(p => ({ ...p, type: e.target.value as MaintenanceEntry['type'] }))}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-base text-white">
                      {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[13px] text-slate-500 block mb-1">المنفّذ (اختياري)</label>
                  <input type="text" value={newEntry.technician || ''} onChange={e => setNewEntry(p => ({ ...p, technician: e.target.value }))}
                    placeholder="اسم الفني أو الفريق"
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-base text-white" />
                </div>
                <div>
                  <label className="text-[13px] text-slate-500 block mb-1">وصف العمل</label>
                  <textarea value={newEntry.description || ''} onChange={e => setNewEntry(p => ({ ...p, description: e.target.value }))}
                    rows={2} placeholder="وصف العمل المنجز والنتائج..."
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-base text-white resize-none" />
                </div>
                <div>
                  <label className="text-[13px] text-slate-500 block mb-1">نتيجة الفحص</label>
                  <select value={newEntry.result} onChange={e => setNewEntry(p => ({ ...p, result: e.target.value as MaintenanceEntry['result'] }))}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-base text-white">
                    <option value="pass">✓ اجتاز الفحص</option>
                    <option value="fail">✗ رسب / يحتاج إصلاح</option>
                    <option value="needs_followup">⚠ يحتاج متابعة</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEntry} className="flex-1 rounded-lg bg-cyan-500 text-black text-base font-bold py-2 hover:bg-cyan-400 transition-all">حفظ السجل</button>
                  <button onClick={() => setShowForm(false)} className="px-4 rounded-lg bg-white/5 text-slate-400 text-base hover:bg-white/10 transition-all">إلغاء</button>
                </div>
              </div>
            )}

            {log.length === 0 && !showForm ? (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-600">
                <span className="text-4xl">📋</span>
                <p className="text-base">لا يوجد سجل صيانة حتى الآن</p>
                <p className="text-[13px]">أضف أول سجل لتتبع أعمال الصيانة على هذا الأصل</p>
              </div>
            ) : (
              <div className="relative space-y-2">
                {/* Timeline line */}
                <div className="absolute right-5 top-4 bottom-4 w-px bg-white/8" />
                {log.map((entry, idx) => (
                  <div key={entry.id} className="relative flex gap-3 pr-10">
                    {/* Timeline dot */}
                    <div className={`absolute right-3.5 top-3 w-3 h-3 rounded-full border-2 border-slate-950 ${entry.result === 'pass' ? 'bg-emerald-500' : entry.result === 'fail' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                    <div className={`flex-1 rounded-xl border border-white/8 bg-black/20 p-3 ${idx === 0 ? 'border-cyan-500/20' : ''}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-white">{TYPE_LABELS[entry.type]}</span>
                          <span className={`text-[13px] font-bold ${RESULT_COLORS[entry.result]}`}>{RESULT_LABELS[entry.result]}</span>
                        </div>
                        <span className="text-[13px] text-slate-600 font-mono">{entry.date}</span>
                      </div>
                      <p className="text-[13px] text-slate-400">{entry.description}</p>
                      {entry.technician && <p className="text-[13px] text-slate-600 mt-1">المنفّذ: {entry.technician}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TECHNICAL SPECS ══ */}
        {tab === 'specs' && (
          <div className="space-y-5">
            <div className="space-y-0 rounded-xl border border-white/8 overflow-hidden">
              {[
                { label: 'كود المعدة', value: code, mono: true },
                { label: 'الاسم الكامل', value: asset.name || '—' },
                { label: 'القطاع الهندسي', value: asset.technical?.route_sector || '—', mono: true },
                { label: 'المحطة (Station)', value: `C${Math.floor(asset.station / 1000)}+${String(asset.station % 1000).padStart(3,'0')}`, mono: true },
                { label: 'البعد عن البداية', value: `${(asset.station / 1000).toFixed(3)} كم`, mono: true },
                { label: 'المنسوب (Invert Level)', value: `${asset.invert_level.toFixed(3)} م`, mono: true },
                { label: 'القطر × درجة الضغط (DN×PN)', value: asset.technical?.diameter || '—', mono: true },
                { label: 'رقم المخطط المرجعي', value: asset.technical?.source_sheet || '—', mono: true },
              ].map((row, i) => (
                <div key={row.label} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 === 0 ? 'bg-white/2' : ''}`}>
                  <span className="text-[13px] text-slate-500 w-40 shrink-0">{row.label}</span>
                  <span className={`text-[13px] text-white flex-1 ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Compliance Checklist */}
            <div>
              <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-3">قائمة الموافقة الفنية (Technical Compliance)</p>
              <div className="space-y-2">
                {[
                  { ok: !!code, label: 'كود المعدة مسجّل ومُحدَّد' },
                  { ok: asset.station > 0, label: 'محطة الموقع (Station) موثّقة' },
                  { ok: asset.invert_level > 0, label: 'منسوب القاع (Invert Level) مسجّل' },
                  { ok: !!asset.technical?.diameter, label: 'مواصفات القطر ودرجة الضغط (DN×PN) متاحة' },
                  { ok: pn >= 6, label: `درجة الضغط مسجّلة (فعلي: ${pn > 0 ? 'PN' + pn : 'غير محدد'})` },
                  { ok: !!asset.technical?.source_sheet, label: 'رقم المخطط الهندسي (As-Built) مرفق' },
                  { ok: !!asset.technical?.route_sector, label: 'القطاع الهندسي معرَّف' },
                  { ok: log.length > 0, label: 'سجل صيانة موثَّق على الأصل' },
                ].map(({ ok, label }) => (
                  <div key={label} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${ok ? 'bg-emerald-500/5' : 'bg-white/2'}`}>
                    <span className={`text-base font-bold ${ok ? 'text-emerald-400' : 'text-slate-700'}`}>{ok ? '✓' : '○'}</span>
                    <span className={`text-[13px] ${ok ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
                    {!ok && <span className="mr-auto text-[14px] text-slate-700 bg-white/5 px-1.5 py-0.5 rounded">ناقص</span>}
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-slate-600 mt-3">
                نسبة الامتثال: {Math.round(
                  [!!code, asset.station > 0, asset.invert_level > 0, !!asset.technical?.diameter,
                   pn >= 6, !!asset.technical?.source_sheet, !!asset.technical?.route_sector, log.length > 0]
                   .filter(Boolean).length / 8 * 100
                )}% ({[!!code, asset.station > 0, asset.invert_level > 0, !!asset.technical?.diameter, pn >= 6, !!asset.technical?.source_sheet, !!asset.technical?.route_sector, log.length > 0].filter(Boolean).length}/8 بنود)
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
