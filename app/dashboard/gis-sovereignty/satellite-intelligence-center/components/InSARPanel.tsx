'use client';
// ─── InSARPanel ───────────────────────────────────────────────────────────────
// InSAR Ground Deformation Detection — Sentinel-1 SAR interferometry.
// Shows coherence map, displacement map (mm), and deformation hotspots.

import React, { useState, useCallback, useMemo } from 'react';
import {
  Radio, Loader2, AlertTriangle, TrendingDown, TrendingUp,
  Minus, MapPin, Layers, CheckCircle2, Info,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Hotspot {
  lon: number;
  lat: number;
  displacement_mm: number;
  coherence: number;
  area_m2: number;
  event_type: string;
  severity: 'critical' | 'warning' | 'info';
}

interface InSARResult {
  ok: boolean;
  date_ref: string;
  date_secondary: string;
  image_real: boolean;
  img_size: number;
  bbox: [number, number, number, number];
  mean_coherence: number;
  min_displacement_mm: number;
  max_displacement_mm: number;
  deform_area_pct: number;
  deform_area_km2: number;
  hotspot_count: number;
  critical_count: number;
  hotspots: Hotspot[];
  coherence_map: number[][];
  displacement_map: number[][];
  map_downsample: number;
}

interface Props {
  polygon: [number, number][] | null;
}

// ── Colormaps ─────────────────────────────────────────────────────────────────

/** تحويل قيمة 0→1 إلى لون الـ coherence (أزرق → أخضر → أصفر) */
function cohColor(v: number): string {
  const r = Math.round(v < 0.5 ? 0 : (v - 0.5) * 2 * 255);
  const g = Math.round(v < 0.5 ? v * 2 * 200 : 200);
  const b = Math.round(v < 0.5 ? 180 : Math.max(0, (1 - v) * 180));
  return `rgb(${r},${g},${b})`;
}

/** تحويل إزاحة بالمم إلى لون (أزرق = ارتفاع، أحمر = هبوط) */
function dispColor(v: number, minV: number, maxV: number): string {
  const norm = (v - minV) / Math.max(maxV - minV, 0.001);
  // Blue (ارتفاع) → white (لا تغيير) → red (هبوط)
  const mid = 0.5;
  if (norm >= mid) {
    const t = (norm - mid) / mid;
    return `rgb(${Math.round(255 * t)},${Math.round(255 * (1 - t))},${Math.round(255 * (1 - t))})`;
  } else {
    const t = (mid - norm) / mid;
    return `rgb(${Math.round(255 * (1 - t))},${Math.round(255 * (1 - t))},${Math.round(255 * t)})`;
  }
}

// ── SVG Map ───────────────────────────────────────────────────────────────────

function InSARMap({
  result,
  mode,
}: {
  result: InSARResult;
  mode: 'coherence' | 'displacement';
}) {
  const W = 300;
  const H = 220;
  const data = mode === 'coherence' ? result.coherence_map : result.displacement_map;
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;

  const cellW = W / cols;
  const cellH = H / rows;

  const minV = Math.min(...data.flat());
  const maxV = Math.max(...data.flat());

  // Hotspots بإحداثيات SVG
  const bbox = result.bbox;
  const lonSpan = bbox[2] - bbox[0];
  const latSpan = bbox[3] - bbox[1];
  const toX = (lon: number) => ((lon - bbox[0]) / lonSpan) * W;
  const toY = (lat: number) => ((bbox[3] - lat) / latSpan) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-slate-700/50" style={{ height: H }}>
      {/* Heatmap cells */}
      {data.map((row, ri) =>
        row.map((val, ci) => {
          const color = mode === 'coherence'
            ? cohColor(val)
            : dispColor(val, minV, maxV);
          return (
            <rect
              key={`${ri}-${ci}`}
              x={ci * cellW} y={ri * cellH}
              width={cellW + 0.5} height={cellH + 0.5}
              fill={color}
            />
          );
        })
      )}

      {/* Hotspot markers */}
      {result.hotspots.map((h, i) => {
        const x = toX(h.lon);
        const y = toY(h.lat);
        const color = h.severity === 'critical' ? '#ef4444' : h.severity === 'warning' ? '#f59e0b' : '#6b7280';
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={5} fill={color} fillOpacity={0.9} />
            <circle cx={x} cy={y} r={9} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity={0.6} />
            <text x={x + 7} y={y + 4} fontSize="8" fill={color} fontWeight="bold">
              {h.displacement_mm > 0 ? '+' : ''}{h.displacement_mm.toFixed(0)}م‌م
            </text>
          </g>
        );
      })}

      {/* Color scale bar */}
      <defs>
        <linearGradient id="scale-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          {mode === 'coherence'
            ? <>
                <stop offset="0%" stopColor={cohColor(0)} />
                <stop offset="50%" stopColor={cohColor(0.5)} />
                <stop offset="100%" stopColor={cohColor(1)} />
              </>
            : <>
                <stop offset="0%" stopColor={dispColor(minV, minV, maxV)} />
                <stop offset="50%" stopColor="white" />
                <stop offset="100%" stopColor={dispColor(maxV, minV, maxV)} />
              </>
          }
        </linearGradient>
      </defs>
      <rect x={8} y={H - 18} width={80} height={8} fill="url(#scale-grad)" rx="2" />
      <text x={8} y={H - 2} fontSize="7" fill="#64748b">
        {mode === 'coherence' ? '0' : `${minV.toFixed(0)}مم`}
      </text>
      <text x={88} y={H - 2} fontSize="7" fill="#64748b" textAnchor="end">
        {mode === 'coherence' ? '1' : `${maxV.toFixed(0)}مم`}
      </text>
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function InSARPanel({ polygon }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InSARResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'coherence' | 'displacement'>('displacement');

  const today = new Date();
  const [dateRef, setDateRef] = useState('');
  const [dateSecondary, setDateSecondary] = useState('');
  const [autoMode, setAutoMode] = useState(true); // STAC تلقائي افتراضياً

  const runAnalysis = useCallback(async () => {
    if (!polygon || polygon.length < 3) { setError('ارسم منطقة على الخريطة أولاً'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/gis/insar-deformation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polygon,
          date_ref: autoMode ? '' : dateRef,
          date_secondary: autoMode ? '' : dateSecondary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'خطأ في الخادم');
      // تحقق من no_data
      if (data.ok === false && data.unavailable_reason) {
        setError(`⚠️ البيانات غير متوفرة: ${data.unavailable_reason}`);
      } else {
        setResult(data as InSARResult);
      }
    } catch (e: any) {
      setError(e.message ?? 'خطأ');
    } finally {
      setLoading(false);
    }
  }, [polygon, dateRef, dateSecondary, autoMode]);

  const overallSeverity = useMemo(() => {
    if (!result) return null;
    if (result.critical_count > 0) return 'critical';
    if (result.hotspot_count > 0) return 'warning';
    return 'ok';
  }, [result]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-0.5">
          <Radio size={15} className="text-violet-400 shrink-0" />
          <span className="text-sm font-bold text-white">InSAR — كشف تشوه الأرض</span>
        </div>
        <p className="text-[10px] text-slate-500">
          Sentinel-1 SAR interferometry · دقة المليمترات · يعمل ليلاً وبالغيوم
        </p>
      </div>

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 space-y-2.5">
        {/* Date pickers */}
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={`text-[9px] px-2 py-1 rounded-full border transition-all ${autoMode ? 'bg-violet-600/20 border-violet-500 text-violet-300' : 'border-slate-700 text-slate-500'}`}
          >
            {autoMode ? '🔄 STAC تلقائي (مُوصى به)' : 'تاريخ يدوي'}
          </button>
        </div>
        {autoMode ? (
          <div className="bg-slate-800/40 border border-violet-800/20 rounded-lg p-2">
            <p className="text-[9px] text-violet-300">
              النظام سيبحث تلقائياً عن أفضل زوج Sentinel-1 متاح (STAC Catalog)
              بفاصل 12–35 يوماً للتماسك الأمثل.
              {result && result.image_real && (
                <span className="block mt-1 text-emerald-400">
                  ✅ استُخدم: {result.date_ref} → {result.date_secondary}
                </span>
              )}
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] text-slate-500 mb-1">صورة مرجعية</p>
            <input
              type="date"
              value={dateRef}
              onChange={e => setDateRef(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700/50 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <p className="text-[9px] text-slate-500 mb-1">صورة ثانوية</p>
            <input
              type="date"
              value={dateSecondary}
              onChange={e => setDateSecondary(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700/50 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>
        )}

        <div className="bg-slate-800/30 border border-slate-700/20 rounded-lg p-2">
          <p className="text-[9px] text-slate-500 leading-relaxed">
            <Info size={9} className="inline ml-1 text-violet-400" />
            الفاصل المثالي بين الصورتين: 12–35 يوماً للحصول على تماسك عالٍ. فاصل أطول = ضوضاء أكثر.
          </p>
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading || !polygon || polygon.length < 3}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
            loading || !polygon || polygon.length < 3
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'
          }`}
        >
          {loading ? (
            <><Loader2 size={13} className="animate-spin" /> جاري المعالجة...</>
          ) : (
            <><Radio size={13} /> تشغيل InSAR</>
          )}
        </button>

        {!polygon || polygon.length < 3 ? (
          <p className="text-[10px] text-amber-400 text-center">
            ارسم منطقة أولاً من تبويب "رسم"
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
          <div className="space-y-3">
            <div className="bg-slate-800/40 rounded-xl p-6 text-center">
              <Radio size={22} className="mx-auto mb-2 text-violet-400 animate-pulse" />
              <p className="text-xs text-slate-400">جاري معالجة InSAR...</p>
              <p className="text-[10px] text-slate-600 mt-1">جلب SAR + حساب Coherence + Displacement</p>
            </div>
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
                ? `بيانات SAR حقيقية · ${result.date_ref} → ${result.date_secondary}`
                : `بيانات محاكاة — SAR الحقيقي غير متاح للتاريخ المحدد`}
            </div>

            {/* Overall status */}
            <div className={`rounded-xl p-3 text-center border ${
              overallSeverity === 'critical' ? 'bg-red-900/20 border-red-800/30' :
              overallSeverity === 'warning'  ? 'bg-amber-900/20 border-amber-800/30' :
              'bg-emerald-900/20 border-emerald-800/30'
            }`}>
              {overallSeverity === 'critical' && <AlertTriangle size={18} className="mx-auto mb-1 text-red-400" />}
              {overallSeverity === 'warning'  && <AlertTriangle size={18} className="mx-auto mb-1 text-amber-400" />}
              {overallSeverity === 'ok'       && <CheckCircle2 size={18} className="mx-auto mb-1 text-emerald-400" />}
              <p className={`text-sm font-bold ${
                overallSeverity === 'critical' ? 'text-red-300' :
                overallSeverity === 'warning' ? 'text-amber-300' : 'text-emerald-300'
              }`}>
                {overallSeverity === 'critical' ? 'تشوه حرج مكتشف' :
                 overallSeverity === 'warning'  ? 'تشوه طفيف مكتشف' :
                 'لا تشوه ملحوظ'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {result.hotspot_count} بؤرة · {result.deform_area_pct.toFixed(1)}% من المنطقة
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-slate-500 mb-1">التماسك المتوسط</p>
                <p className={`text-lg font-bold ${result.mean_coherence > 0.6 ? 'text-emerald-400' : result.mean_coherence > 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
                  {(result.mean_coherence * 100).toFixed(0)}%
                </p>
                <p className="text-[9px] text-slate-600">{result.mean_coherence > 0.6 ? 'عالٍ' : result.mean_coherence > 0.4 ? 'متوسط' : 'منخفض'}</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-slate-500 mb-1">أقصى هبوط</p>
                <p className={`text-lg font-bold ${result.min_displacement_mm < -5 ? 'text-red-400' : 'text-slate-300'}`}>
                  {result.min_displacement_mm.toFixed(1)} <span className="text-xs">مم</span>
                </p>
                <p className="text-[9px] text-slate-600">إزاحة عمودية</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-slate-500 mb-1">بؤر التشوه</p>
                <p className={`text-lg font-bold ${result.hotspot_count > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {result.hotspot_count}
                </p>
                <p className="text-[9px] text-slate-600">{result.critical_count} حرجة</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-slate-500 mb-1">مساحة التشوه</p>
                <p className="text-lg font-bold text-slate-300">{result.deform_area_km2.toFixed(2)}</p>
                <p className="text-[9px] text-slate-600">كم²</p>
              </div>
            </div>

            {/* Map toggle + heatmap */}
            <div>
              <div className="flex gap-1.5 mb-2">
                <button
                  onClick={() => setMapMode('displacement')}
                  className={`flex-1 text-[10px] py-1 rounded-lg font-semibold transition-colors ${
                    mapMode === 'displacement' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  خريطة الإزاحة
                </button>
                <button
                  onClick={() => setMapMode('coherence')}
                  className={`flex-1 text-[10px] py-1 rounded-lg font-semibold transition-colors ${
                    mapMode === 'coherence' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  خريطة التماسك
                </button>
              </div>
              <InSARMap result={result} mode={mapMode} />
              <p className="text-[9px] text-slate-600 mt-1 text-center">
                {mapMode === 'displacement'
                  ? 'أحمر = هبوط · أزرق = ارتفاع · الأرقام بالمليمتر'
                  : 'أخضر = تماسك عالٍ · أزرق = تماسك منخفض (تشوه محتمل)'}
              </p>
            </div>

            {/* Hotspots list */}
            {result.hotspots.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-2">
                  بؤر التشوه ({result.hotspots.length})
                </p>
                <div className="space-y-2">
                  {result.hotspots.map((h, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 ${
                        h.severity === 'critical' ? 'bg-red-900/15 border-red-800/30' :
                        h.severity === 'warning'  ? 'bg-amber-900/15 border-amber-800/30' :
                        'bg-slate-800/30 border-slate-700/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          {h.displacement_mm < 0
                            ? <TrendingDown size={13} className={h.severity === 'critical' ? 'text-red-400' : 'text-amber-400'} />
                            : h.displacement_mm > 0
                            ? <TrendingUp size={13} className="text-blue-400" />
                            : <Minus size={13} className="text-slate-400" />}
                          <span className={`text-xs font-bold ${
                            h.severity === 'critical' ? 'text-red-300' :
                            h.severity === 'warning'  ? 'text-amber-300' : 'text-slate-300'
                          }`}>{h.event_type}</span>
                        </div>
                        <span className={`text-xs font-mono font-bold ${
                          h.displacement_mm < -5 ? 'text-red-400' :
                          h.displacement_mm < 0  ? 'text-amber-400' :
                          h.displacement_mm > 0  ? 'text-blue-400' : 'text-slate-400'
                        }`}>
                          {h.displacement_mm > 0 ? '+' : ''}{h.displacement_mm.toFixed(1)} مم
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin size={8} /> {h.lat.toFixed(4)}°N, {h.lon.toFixed(4)}°E
                        </span>
                        <span>تماسك: {(h.coherence * 100).toFixed(0)}%</span>
                        <span>مساحة: {h.area_m2.toLocaleString()} م²</span>
                        <span className={`font-semibold ${
                          h.severity === 'critical' ? 'text-red-400' :
                          h.severity === 'warning'  ? 'text-amber-400' : 'text-slate-400'
                        }`}>{h.severity === 'critical' ? '⚠ حرج' : h.severity === 'warning' ? 'تحذير' : 'معلومات'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.hotspots.length === 0 && (
              <div className="text-center py-6">
                <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-500" />
                <p className="text-xs text-slate-400">لا توجد بؤر تشوه مكتشفة</p>
                <p className="text-[10px] text-slate-600 mt-1">الأرض مستقرة في هذه الفترة</p>
              </div>
            )}

            <p className="text-[9px] text-slate-600 pb-2 text-center">
              Sentinel-1 IW · C-band (5.6cm) · Coherence + Phase proxy · ±{SAR_HALF_WAVELENGTH_MM_DISPLAY}مم دقة
            </p>
          </>
        )}

        {!result && !loading && !error && (
          <div className="text-center py-10">
            <Radio size={28} className="mx-auto mb-3 text-slate-700" />
            <p className="text-xs text-slate-500 mb-1">InSAR جاهز للتشغيل</p>
            <p className="text-[10px] text-slate-600">اضبط التواريخ واضغط "تشغيل InSAR"</p>
            <div className="mt-4 bg-slate-800/30 rounded-xl p-3 text-right space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400">كيف يعمل؟</p>
              <p className="text-[9px] text-slate-500">1. جلب صورتين SAR رادار بفاصل 30 يوم</p>
              <p className="text-[9px] text-slate-500">2. حساب خريطة التماسك (Coherence)</p>
              <p className="text-[9px] text-slate-500">3. تحويل الفرق إلى إزاحة رأسية بالمم</p>
              <p className="text-[9px] text-slate-500">4. تحديد مناطق الهبوط/الانتفاخ الحرجة</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SAR_HALF_WAVELENGTH_MM_DISPLAY = 28;
