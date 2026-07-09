'use client';
// ─── ObjectDetectionPanel ─────────────────────────────────────────────────────
// AI Object Detection using OpenCV blob/contour analysis on Sentinel-2 imagery.
// Detects: vehicles, buildings, bare ground, water pools, hotspots.

import React, { useState, useCallback } from 'react';
import {
  ScanSearch, Loader2, AlertTriangle, Car, Building2,
  Flame, Droplets, Layers, RefreshCw, CheckCircle2, Download, Zap,
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
  cdse_active: boolean;
  viirs_active: boolean;
  data_source: string;
  ndwi: number | null;
  ndvi: number | null;
  bsi:  number | null;
  total_objects: number;
  stats: Record<string, number>;
  class_status: Record<string, { available: boolean; note: string }>;
  summary_ar: string;
  detections: Detection[];
  bbox: [number, number, number, number];
  area_ha: number;
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
  // Buildings footprints from OSM
  const [buildingsGeo, setBuildingsGeo] = useState<any | null>(null);
  const [buildingsLoading, setBuildingsLoading] = useState(false);

  // DOTA tile detection (YOLOv8 on Esri imagery)
  const [tileResult,  setTileResult]  = useState<any | null>(null);
  const [tileLoading, setTileLoading] = useState(false);
  const [tileError,   setTileError]   = useState<string | null>(null);

  const runTileDetect = useCallback(async () => {
    if (!polygon || polygon.length < 3) return;
    const lons = polygon.map(p => p[0]);
    const lats = polygon.map(p => p[1]);
    const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    setTileLoading(true); setTileError(null); setTileResult(null);
    try {
      const r = await fetch('/api/v1/satellite/tile-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, zoom: 18, conf: 0.12, grid: 4 }),
      });
      const d = await r.json();
      if (!r.ok) { setTileError(d.hint ?? d.error ?? 'خطأ'); return; }
      setTileResult(d);
    } catch (e: any) { setTileError(e.message); }
    finally { setTileLoading(false); }
  }, [polygon]);

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

    // Compute bbox from polygon
    const lons = polygon.map(p => p[0]);
    const lats = polygon.map(p => p[1]);
    const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];

    try {
      // Run spectral + VIIRS detection
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

    // Fetch buildings footprints if buildings class selected
    if (classes.includes('buildings') || classes.includes('all')) {
      setBuildingsLoading(true);
      try {
        const bRes = await fetch(
          `/api/v1/gis/buildings?bbox=${bbox.join(',')}&limit=1000`
        );
        if (bRes.ok) {
          const bg = await bRes.json();
          setBuildingsGeo(bg);
        }
      } catch { /* silent */ }
      finally { setBuildingsLoading(false); }
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
              // Show availability based on known capabilities
              const nativeSupport = ['water_pools','bare_ground','hotspots'].includes(cls);
              const resultStatus = result?.class_status?.[cls];
              return (
                <label key={cls} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-all ${
                  checked ? cfg.bg : 'border-slate-700/30 bg-transparent'
                }`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleClass(cls)} className="sr-only" />
                  <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                    checked ? 'border-transparent' : 'border-slate-600'
                  }`} style={{ background: checked ? cfg.color : 'transparent' }}>
                    {checked && <span className="text-white text-[8px] leading-none">✓</span>}
                  </span>
                  <Icon size={11} style={{ color: cfg.color }} className="shrink-0" />
                  <span className="text-[10px] text-slate-300 flex-1">{cfg.labelAr}</span>
                  {/* Availability badge */}
                  {nativeSupport
                    ? <span className="text-[8px] bg-green-500/20 text-green-400 px-1 rounded border border-green-500/30">10م ✓</span>
                    : <span className="text-[8px] bg-red-500/10 text-red-400 px-1 rounded border border-red-500/20">≤50سم</span>
                  }
                </label>
              );
            })}
          </div>
          <p className="text-[9px] text-slate-600 mt-1.5">
            <span className="text-green-400">10م ✓</span> = يعمل مع Sentinel-2 &nbsp;
            <span className="text-red-400">≤50سم</span> = يحتاج Planet/Maxar
          </p>
        </div>

        {/* Run buttons */}
        <div className="space-y-2">
          {/* Spectral + VIIRS detection */}
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
              <><ScanSearch size={13} /> تحليل طيفي + VIIRS (Sentinel-2)</>
            )}
          </button>

          {/* DOTA tile detection — YOLOv8 on Esri imagery */}
          <button
            onClick={runTileDetect}
            disabled={tileLoading || !polygon || polygon.length < 3}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border ${
              tileLoading || !polygon || polygon.length < 3
                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-200 hover:bg-amber-500/25'
            }`}
          >
            {tileLoading ? (
              <><Loader2 size={13} className="animate-spin" /> يعمل نموذج YOLO...</>
            ) : (
              <><Zap size={13} /> كشف بالذكاء الاصطناعي — Esri 0.5م (DOTA)</>
            )}
          </button>
        </div>

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
                ? `✅ بيانات Sentinel-2 حقيقية (${result.date})`
                : `⚠️ تقديري — أضف CDSE للتحليل الكامل`}
            </div>

            {/* Data source detail */}
            {result.data_source && (
              <div className="text-[9px] text-slate-600 bg-slate-800/30 rounded px-2 py-1 border border-slate-700/30">
                {result.data_source}
                {result.area_ha > 0 && ` · ${result.area_ha} هكتار`}
              </div>
            )}

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

        {/* ── DOTA AI Tile Detection Results ────────────────── */}
        {(tileLoading || tileResult || tileError) && (
          <div className="border-t border-slate-800 pt-3 mt-1">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} className="text-amber-400 shrink-0" />
              <span className="text-[11px] font-bold text-white">كشف بالذكاء الاصطناعي — DOTA/Esri</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 rounded border border-amber-500/30 mr-auto">0.5م/pixel</span>
            </div>

            {tileLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 size={11} className="animate-spin" />
                <span>يعمل النموذج YOLO على صور Esri... (~30-60 ثانية)</span>
              </div>
            )}

            {tileError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                <AlertTriangle size={11} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-300">{tileError}</p>
              </div>
            )}

            {tileResult && !tileLoading && (
              <>
                <div className="bg-slate-800/60 rounded-lg p-2.5 mb-2 text-[10px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>النموذج:</span><span className="text-slate-300">{tileResult.model}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>الدقة:</span><span className="text-amber-300">{tileResult.res_m}م/pixel</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>الصورة:</span><span className="text-slate-300">{tileResult.img_size_px}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>الوقت:</span><span className="text-slate-300">{((tileResult.elapsed_ms??0)/1000).toFixed(1)}ث</span>
                  </div>
                </div>

                {tileResult.total > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(tileResult.stats as Record<string,number>).map(([cls, cnt]) => (
                      <div key={cls} className="flex items-center justify-between px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <span className="text-[11px] text-amber-200 font-semibold">
                          {tileResult.detections?.find((d: any) => d.class === cls)?.class_ar ?? cls}
                        </span>
                        <span className="text-sm font-bold text-amber-300">{cnt}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-500 text-center mt-1">
                      مصدر البيانات: DOTA dataset · YOLOv8-OBB · Esri World Imagery
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-[11px] text-slate-400">لم يُكتشف شيء بثقة &gt;12%</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      جرب: تصغير المنطقة · تكبير الخريطة للـ zoom 19 · أو المنطقة لا تحتوي أهدافاً مرئية
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Buildings footprints from OSM ────────────────────── */}
        {(buildingsLoading || buildingsGeo) && (
          <div className="border-t border-slate-800 pt-3 mt-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={12} className="text-blue-400 shrink-0" />
              <span className="text-[11px] font-bold text-white">بصمات المباني (OpenStreetMap)</span>
              <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 rounded border border-green-500/30 mr-auto">مجاني ✓</span>
            </div>

            {buildingsLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 size={11} className="animate-spin" />
                <span>جاري تحميل بصمات المباني...</span>
              </div>
            )}

            {buildingsGeo && !buildingsLoading && (
              <>
                <div className={`px-2.5 py-2 rounded-lg border text-xs mb-2 ${
                  buildingsGeo.metadata?.count > 0
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}>
                  <span className="font-bold text-lg text-white mr-1">
                    {buildingsGeo.metadata?.count ?? 0}
                  </span>
                  مبنى مُرصود في المنطقة
                  {buildingsGeo.metadata?.area_km2 && (
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      المصدر: {buildingsGeo.metadata.source} · {buildingsGeo.metadata.area_km2} كم²
                    </span>
                  )}
                </div>

                {buildingsGeo.metadata?.count > 0 && (
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(buildingsGeo, null, 2)], { type: 'application/geo+json' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `buildings_osm_${new Date().toISOString().slice(0,10)}.geojson`;
                      a.click();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-semibold border bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/50 hover:text-blue-300 transition-colors"
                  >
                    <Download size={11} />
                    تحميل GeoJSON المباني ({buildingsGeo.metadata?.count})
                  </button>
                )}

                {(!buildingsGeo.metadata?.count || buildingsGeo.metadata.count === 0) && (
                  <p className="text-[10px] text-slate-500">
                    {buildingsGeo.metadata?.note ?? 'لم تُعثر على مباني في OpenStreetMap لهذه المنطقة'}
                  </p>
                )}
              </>
            )}
          </div>
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
