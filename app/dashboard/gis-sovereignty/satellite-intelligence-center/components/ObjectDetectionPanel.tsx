'use client';
// ─── ObjectDetectionPanel ─────────────────────────────────────────────────────
// AI Object Detection using OpenCV blob/contour analysis on Sentinel-2 imagery.
// Detects: vehicles, buildings, bare ground, water pools, hotspots.

import React, { useState, useCallback } from 'react';
import {
  ScanSearch, Loader2, AlertTriangle, Car, Building2,
  Flame, Droplets, Layers, RefreshCw, CheckCircle2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Detection {
  class: string;
  class_ar: string;
  lon: number;
  lat: number;
  area_px: number;
  area_m2?: number;
  confidence: number;
}

interface DetectionResult {
  ok: boolean;
  date: string;
  image_real: boolean;
  total_objects: number;
  stats: Record<string, number>;
  summary_ar: string;
  detections: Detection[];
  bbox: [number, number, number, number];
}

interface Props {
  polygon: [number, number][] | null;
}

// ── Class config ──────────────────────────────────────────────────────────────

const CLASS_CFG: Record<string, { labelAr: string; color: string; Icon: React.ElementType; bg: string }> = {
  vehicles:    { labelAr: 'مركبات',       color: '#ef4444', Icon: Car,       bg: 'bg-red-500/10 border-red-500/30' },
  buildings:   { labelAr: 'مبانٍ',        color: '#3b82f6', Icon: Building2, bg: 'bg-blue-500/10 border-blue-500/30' },
  bare_ground: { labelAr: 'أرض مكشوفة',  color: '#d97706', Icon: Layers,    bg: 'bg-amber-500/10 border-amber-500/30' },
  water_pools: { labelAr: 'برك مياه',    color: '#0ea5e9', Icon: Droplets,  bg: 'bg-sky-500/10 border-sky-500/30' },
  hotspots:    { labelAr: 'بؤر حرارية',  color: '#f97316', Icon: Flame,     bg: 'bg-orange-500/10 border-orange-500/30' },
};

const ALL_CLASSES = Object.keys(CLASS_CFG);

// ── Mini detection map (SVG) ──────────────────────────────────────────────────

function DetectionMap({ detections, bbox }: { detections: Detection[]; bbox: [number, number, number, number] }) {
  const W = 300;
  const H = 200;
  const PAD = 10;
  const cW = W - PAD * 2;
  const cH = H - PAD * 2;

  const lonSpan = bbox[2] - bbox[0];
  const latSpan = bbox[3] - bbox[1];

  const toX = (lon: number) => PAD + ((lon - bbox[0]) / lonSpan) * cW;
  const toY = (lat: number) => PAD + ((bbox[3] - lat) / latSpan) * cH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-slate-700/50 rounded-xl bg-slate-900/60" style={{ height: H }}>
      {/* Background grid */}
      <rect x={PAD} y={PAD} width={cW} height={cH} fill="#0f172a" rx="4" />
      {[0.25, 0.5, 0.75].map(t => (
        <g key={t}>
          <line x1={PAD + t * cW} y1={PAD} x2={PAD + t * cW} y2={PAD + cH} stroke="#1e293b" strokeWidth="1" />
          <line x1={PAD} y1={PAD + t * cH} x2={PAD + cW} y2={PAD + t * cH} stroke="#1e293b" strokeWidth="1" />
        </g>
      ))}

      {/* Detections */}
      {detections.map((d, i) => {
        const cfg = CLASS_CFG[d.class] ?? { color: '#94a3b8' };
        const x = toX(d.lon);
        const y = toY(d.lat);
        const r = Math.max(3, Math.min(8, d.area_px / 5));
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill={cfg.color} fillOpacity={0.6} />
            <circle cx={x} cy={y} r={r + 2} fill="none" stroke={cfg.color} strokeWidth="0.7" strokeOpacity={0.4} />
          </g>
        );
      })}

      {/* Legend */}
      {Object.entries(CLASS_CFG).map(([cls, cfg], i) => {
        const count = detections.filter(d => d.class === cls).length;
        if (count === 0) return null;
        return (
          <g key={cls} transform={`translate(${PAD + 4}, ${PAD + 8 + i * 14})`}>
            <circle cx={4} cy={4} r={4} fill={cfg.color} fillOpacity={0.8} />
            <text x={11} y={8} fontSize="8" fill="#94a3b8">{cfg.labelAr} ({count})</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ObjectDetectionPanel({ polygon }: Props) {
  const [classes, setClasses] = useState<string[]>(ALL_CLASSES);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string | null>(null);

  const toggleClass = (cls: string) => {
    setClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  const runDetection = useCallback(async () => {
    if (!polygon || polygon.length < 3) {
      setError('ارسم منطقة على الخريطة أولاً');
      return;
    }
    if (classes.length === 0) {
      setError('اختر فئة واحدة على الأقل');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gis/object-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygon, classes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'خطأ في الخادم');
      if (data.ok === false && data.unavailable_reason) {
        setError(`⚠️ البيانات غير متوفرة: ${data.unavailable_reason}`);
      } else {
        setResult(data as DetectionResult);
        setFilterClass(null);
      }
    } catch (e: any) {
      setError(e.message ?? 'خطأ غير معروف');
    } finally {
      setLoading(false);
    }
  }, [polygon, classes]);

  const visibleDetections = result
    ? (filterClass ? result.detections.filter(d => d.class === filterClass) : result.detections)
    : [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-0.5">
          <ScanSearch size={15} className="text-purple-400 shrink-0" />
          <span className="text-sm font-bold text-white">كشف الكائنات بالذكاء الاصطناعي</span>
        </div>
        <p className="text-[10px] text-slate-500">
          تحليل الصور الفضائية Sentinel-2 باستخدام Computer Vision
        </p>
      </div>

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 space-y-3">
        {/* Class checkboxes */}
        <div>
          <p className="text-[10px] text-slate-500 mb-2 font-semibold">الفئات المراد كشفها</p>
          <div className="space-y-1.5">
            {ALL_CLASSES.map(cls => {
              const cfg = CLASS_CFG[cls];
              const Icon = cfg.Icon;
              const checked = classes.includes(cls);
              return (
                <label key={cls} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-all ${
                  checked ? cfg.bg : 'border-slate-700/30 bg-transparent'
                }`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleClass(cls)}
                    className="sr-only"
                  />
                  <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                    checked ? 'border-transparent' : 'border-slate-600'
                  }`} style={{ background: checked ? cfg.color : 'transparent' }}>
                    {checked && <span className="text-white text-[8px] leading-none">✓</span>}
                  </span>
                  <Icon size={11} style={{ color: cfg.color }} className="shrink-0" />
                  <span className="text-[10px] text-slate-300">{cfg.labelAr}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runDetection}
          disabled={loading || !polygon || polygon.length < 3}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
            loading || !polygon || polygon.length < 3
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30'
          }`}
        >
          {loading ? (
            <><Loader2 size={13} className="animate-spin" /> جاري التحليل...</>
          ) : (
            <><ScanSearch size={13} /> تشغيل الكشف</>
          )}
        </button>

        {!polygon || polygon.length < 3 ? (
          <p className="text-[10px] text-amber-400 text-center">
            ارسم منطقة على الخريطة أولاً (تبويب رسم)
          </p>
        ) : null}
      </div>

      {/* ── Results ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {error && (
          <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-lg p-3">
            <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {loading && (
          <div className="bg-slate-800/40 rounded-xl p-6 text-center">
            <ScanSearch size={22} className="mx-auto mb-2 text-purple-400 animate-pulse" />
            <p className="text-xs text-slate-400">جاري تحليل الصورة الفضائية...</p>
            <p className="text-[10px] text-slate-600 mt-1">OpenCV blob detection + morphological analysis</p>
          </div>
        )}

        {result && !loading && (
          <>
            {/* Source badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] ${
              result.image_real
                ? 'bg-emerald-900/20 border border-emerald-800/30 text-emerald-300'
                : 'bg-amber-900/20 border border-amber-800/30 text-amber-300'
            }`}>
              <CheckCircle2 size={11} className="shrink-0" />
              {result.image_real
                ? `صورة Sentinel-2 حقيقية (${result.date})`
                : `بيانات اصطناعية — الصورة الحقيقية غير متاحة`}
            </div>

            {/* Summary */}
            <div className="bg-purple-900/10 border border-purple-800/20 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-white">{result.total_objects}</p>
              <p className="text-[10px] text-slate-400">كائن مكتشف</p>
              <p className="text-[10px] text-purple-300 mt-1">{result.summary_ar}</p>
            </div>

            {/* Stats per class */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(result.stats).map(([cls, count]) => {
                const cfg = CLASS_CFG[cls];
                if (!cfg || count === 0) return null;
                const Icon = cfg.Icon;
                return (
                  <button
                    key={cls}
                    onClick={() => setFilterClass(filterClass === cls ? null : cls)}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-right ${
                      filterClass === cls ? cfg.bg + ' ring-1 ring-current' : 'border-slate-700/30 bg-slate-800/30 hover:border-slate-600'
                    }`}
                  >
                    <Icon size={13} style={{ color: cfg.color }} className="shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white leading-none">{count}</p>
                      <p className="text-[9px] text-slate-400 leading-none mt-0.5">{cfg.labelAr}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Map */}
            {result.detections.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-2">
                  خريطة الكائنات
                  {filterClass && (
                    <button onClick={() => setFilterClass(null)} className="mr-2 text-purple-400 hover:underline">
                      (مرشح: {CLASS_CFG[filterClass]?.labelAr}) ✕
                    </button>
                  )}
                </p>
                <DetectionMap
                  detections={visibleDetections}
                  bbox={result.bbox}
                />
              </div>
            )}

            {/* Detection list */}
            {visibleDetections.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-2">
                  قائمة الكائنات ({visibleDetections.length})
                </p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {visibleDetections.slice(0, 50).map((d, i) => {
                    const cfg = CLASS_CFG[d.class];
                    const Icon = cfg?.Icon ?? ScanSearch;
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/30 rounded-lg text-xs">
                        <Icon size={11} style={{ color: cfg?.color ?? '#94a3b8' }} className="shrink-0" />
                        <span className="text-slate-300 flex-1">{d.class_ar}</span>
                        {d.area_m2 && (
                          <span className="text-slate-500 text-[9px] font-mono">{d.area_m2.toLocaleString()} م²</span>
                        )}
                        <span className="text-[9px] text-slate-600 font-mono">
                          {(d.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                  {visibleDetections.length > 50 && (
                    <p className="text-center text-[9px] text-slate-500 py-1">
                      + {visibleDetections.length - 50} كائن إضافي
                    </p>
                  )}
                </div>
              </div>
            )}

            {result.total_objects === 0 && (
              <div className="text-center py-6">
                <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-500" />
                <p className="text-xs text-slate-400">لم يُكتشف أي كائن في هذه المنطقة</p>
                {result.image_real && (
                  <p className="text-[10px] text-slate-600 mt-1">
                    الصورة حقيقية — المنطقة تبدو خالية/صحراوية بمقياس 10م/بكسل
                  </p>
                )}
              </div>
            )}

            <p className="text-[9px] text-slate-600 pb-2 text-center">
              Computer Vision · Sentinel-2 L2A 10م · OpenCV morphological analysis
            </p>
          </>
        )}

        {!result && !loading && !error && (
          <div className="text-center py-10">
            <ScanSearch size={28} className="mx-auto mb-3 text-slate-700" />
            <p className="text-xs text-slate-500">اختر الفئات واضغط "تشغيل الكشف"</p>
          </div>
        )}
      </div>
    </div>
  );
}
