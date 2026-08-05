'use client';
// ─── InSARPanel ───────────────────────────────────────────────────────────────
// InSAR Ground Deformation Detection — Sentinel-1 SAR interferometry.
// Shows coherence map, displacement map (mm), and deformation hotspots.

import { useInSarStore } from '@/store/useInSarStore';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Radio, Loader2, AlertTriangle, TrendingDown, TrendingUp,
  Minus, MapPin, Layers, CheckCircle2, Info, Send, RefreshCw,
  Clock, XCircle, ChevronDown, Download, Calendar,
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
  onFlyTo?: (lon: number, lat: number, zoom?: number) => void;
}

interface HistoricalFile {
  filename?: string;
  name?: string;
  url?: string;
  size_mb?: string;
}

interface HistoricalJob {
  id: string;
  job_id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  granules: string[];
  files: HistoricalFile[];
  bbox?: [number, number, number, number] | null;
  bbox_source?: string;
  area_name?: string | null;
  displacement_url?: string | null;
  browse_images?: string[];
  browse_url?: string | null;
}

function normalizeHistoricalJob(raw: any): HistoricalJob {
  const files: HistoricalFile[] = Array.isArray(raw?.files)
    ? raw.files.map((f: any) => ({
        filename: f?.filename || f?.name,
        name: f?.name || f?.filename,
        url: f?.url,
        size_mb: f?.size_mb,
      }))
    : [];

  const status = (raw?.status || raw?.status_code || 'PENDING') as HistoricalJob['status'];
  const jobId = raw?.job_id || raw?.id || raw?.name || `job-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: jobId,
    job_id: jobId,
    name: raw?.name || 'InSAR Job',
    status,
    granules: Array.isArray(raw?.granules) ? raw.granules : [],
    files,
    bbox: Array.isArray(raw?.bbox) && raw.bbox.length === 4
      ? [Number(raw.bbox[0]), Number(raw.bbox[1]), Number(raw.bbox[2]), Number(raw.bbox[3])]
      : null,
    bbox_source: raw?.bbox_source || 'unknown',
    area_name: raw?.area_name || null,
    displacement_url: raw?.displacement_url || null,
    browse_images: Array.isArray(raw?.browse_images)
      ? raw.browse_images
      : raw?.browse_url
      ? [raw.browse_url]
      : [],
    browse_url: raw?.browse_url || null,
  };
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

// Predefined Libya areas for historical analysis
const PRESET_AREAS = [
  { id: 'tripoli_center', label: 'طرابلس — وسط',       bbox: [12.95,32.75,13.45,33.05] as [number,number,number,number] },
  { id: 'tripoli_tajura', label: 'طرابلس — تاجوراء',   bbox: [13.25,32.78,13.55,32.98] as [number,number,number,number] },
  { id: 'benghazi',       label: 'بنغازي — وسط',       bbox: [19.85,31.95,20.30,32.25] as [number,number,number,number] },
  { id: 'jebel_akhdar',   label: 'الجبل الأخضر',       bbox: [20.5, 32.0, 22.5, 33.0]  as [number,number,number,number] },
  { id: 'gmmr_gharyan',   label: 'GMMR — غريان',       bbox: [12.85,32.05,13.20,32.32] as [number,number,number,number] },
  { id: 'gmmr_shweref',   label: 'GMMR — الشويرف',     bbox: [13.8, 30.0, 14.8, 30.9]  as [number,number,number,number] },
  { id: 'misrata',        label: 'مصراتة',              bbox: [15.00,32.25,15.25,32.55] as [number,number,number,number] },
  { id: 'sabha',          label: 'سبها',                bbox: [14.25,26.88,14.65,27.22] as [number,number,number,number] },
  { id: 'custom',         label: '📐 منطقة مخصصة',     bbox: null as any },
];

export default function InSARPanel({ polygon, onFlyTo }: Props) {
  const [panelMode, setPanelMode] = useState<'instant' | 'historical'>('instant');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InSARResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'coherence' | 'displacement'>('displacement');

  const today = new Date();
  const [dateRef, setDateRef] = useState('');
  const [dateSecondary, setDateSecondary] = useState('');
  const [autoMode, setAutoMode] = useState(true); // STAC تلقائي افتراضياً

  // ── Historical mode state ─────────────────────────────────────────────────
  const [hAreaId,    setHAreaId]    = useState('tripoli_center');
  const [hYearFrom,  setHYearFrom]  = useState(2024);
  const [hYearTo,    setHYearTo]    = useState(2026);
  const [hMonthFrom, setHMonthFrom] = useState('01');
  const [hMonthTo,   setHMonthTo]   = useState('07');
  const [hMaxPairs,  setHMaxPairs]  = useState(3);
  const [hLoading,   setHLoading]   = useState(false);
  const [hResult,    setHResult]    = useState<any>(null);
  const [hError,     setHError]     = useState<string | null>(null);
  const [hJobs,      setHJobs]      = useState<any[]>([]);
  const [hJobsLoading, setHJobsLoading] = useState(false);
  const [hExpandJob, setHExpandJob] = useState<string | null>(null);
  const [hSelectingJobId, setHSelectingJobId] = useState<string | null>(null);
  const [hSelectedJobId, setHSelectedJobId] = useState<string | null>(null);
  const [hSelectError, setHSelectError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setSelectedJob = useInSarStore((state) => state.setSelectedJob);
  const selectedResult = useInSarStore((state) => state.selectedResult);

  const deriveActiveBbox = useCallback((): [number, number, number, number] => {
    const area = PRESET_AREAS.find((a) => a.id === hAreaId);
    if (hAreaId === 'custom' && polygon && polygon.length >= 3) {
      return [
        Math.min(...polygon.map((p) => p[0])),
        Math.min(...polygon.map((p) => p[1])),
        Math.max(...polygon.map((p) => p[0])),
        Math.max(...polygon.map((p) => p[1])),
      ];
    }
    return area?.bbox ?? [12.95, 32.75, 13.45, 33.05];
  }, [hAreaId, polygon]);

  const handleSelectHistoricalJob = useCallback(async (job: HistoricalJob) => {
    const nextExpand = hExpandJob === job.job_id ? null : job.job_id;
    setHExpandJob(nextExpand);

    if (job.status !== 'SUCCEEDED') return;

    setHSelectingJobId(job.job_id);
    setHSelectError(null);
    try {
      const fallbackBbox = deriveActiveBbox();
      const isCustomNamed = /منطقة_مخصصة|custom/i.test(job.name || '');
      const requestBbox = job.bbox || (isCustomNamed ? fallbackBbox : undefined);

      const data = await setSelectedJob({
        id: job.id,
        job_id: job.job_id,
        name: job.name,
        status: job.status,
        bbox: requestBbox,
        polygon: polygon ?? undefined,
      });

      if (!data) {
        setHSelectError('تعذر تحميل تفاصيل الوظيفة المختارة.');
        return;
      }

      setHSelectedJobId(job.job_id);

      const bounds = Array.isArray(data?.bounds) && data.bounds.length === 4
        ? data.bounds as [number, number, number, number]
        : null;
      if (bounds) {
        const centerLon = (bounds[0] + bounds[2]) / 2;
        const centerLat = (bounds[1] + bounds[3]) / 2;
        onFlyTo?.(centerLon, centerLat, 13);
      } else {
        setHSelectError('لا يمكن تحديد حدود AOI لهذه المهمة حالياً؛ لذلك لن يتم التحريك على الخريطة.');
      }

      if (data?.geojson?.features?.length) {
        window.dispatchEvent(new CustomEvent('engineering:preview-geojson', {
          detail: { featureCollection: data.geojson },
        }));
      } else {
        window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
      }
    } catch {
      setHSelectError('فشل تحميل النتائج المكانية للمهمة المحددة.');
    } finally {
      setHSelectingJobId(null);
    }
  }, [deriveActiveBbox, hExpandJob, onFlyTo, polygon, setSelectedJob]);

  const loadHyP3Jobs = useCallback(async () => {
    setHJobsLoading(true);
    try {
      const res = await fetch('/api/v1/satellite/insar-subsidence');
      if (res.ok) {
        const d = await res.json();
        const pending = Array.isArray(d.pending_jobs)
          ? d.pending_jobs.map((j: any) => normalizeHistoricalJob({ ...j, status: j?.status || 'PENDING' }))
          : [];
        const completed = Array.isArray(d.completed_results)
          ? d.completed_results.map((j: any) => normalizeHistoricalJob({ ...j, status: j?.status || 'SUCCEEDED' }))
          : [];
        const all = [...pending, ...completed];
        setHJobs(all);
      }
    } catch { /* ignore */ } finally {
      setHJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHyP3Jobs();
  }, [loadHyP3Jobs]);

  useEffect(() => {
    const active = hJobs.some(j => j.status === 'PENDING' || j.status === 'RUNNING');
    if (active && !pollRef.current) {
      pollRef.current = setInterval(loadHyP3Jobs, 30_000);
    } else if (!active && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [hJobs, loadHyP3Jobs]);

  const submitHistorical = async () => {
    const area = PRESET_AREAS.find(a => a.id === hAreaId);
    const bbox = hAreaId === 'custom' && polygon && polygon.length >= 2
      ? [
          Math.min(...polygon.map(p => p[0])), Math.min(...polygon.map(p => p[1])),
          Math.max(...polygon.map(p => p[0])), Math.max(...polygon.map(p => p[1])),
        ]
      : area?.bbox ?? [12.95,32.75,13.45,33.05];

    setHLoading(true); setHError(null); setHResult(null);
    try {
      const res = await fetch('/api/v1/satellite/insar-subsidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode:      'historical',
          bbox,
          date_from: `${hYearFrom}-${hMonthFrom}-01`,
          date_to:   `${hYearTo}-${hMonthTo}-28`,
          area_name: area?.label ?? 'منطقة مخصصة',
          max_pairs: hMaxPairs,
        }),
      });
      const d = await res.json();
      setHResult(d);
      if (d.ok) await loadHyP3Jobs();
      else setHError(d.error || 'خطأ غير معروف');
    } catch (e: any) {
      setHError(e.message || 'خطأ في الاتصال');
    } finally {
      setHLoading(false);
    }
  };

  const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const MONTHS    = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const YEARS     = Array.from({ length: 8 }, (_,i) => 2018+i);

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
      if (!res.ok) {
        const msg = data?.message_ar || data?.error || 'تعذر تنفيذ التحليل حالياً.';
        throw new Error(msg);
      }

      // Business-logic response: local SAR engine unavailable.
      if (data?.available === false || data?.code === 'SAR_DATA_REQUIRED') {
        const msg = data?.message_ar || 'المعالجة الفورية غير متاحة حالياً.';
        setError(`⚠️ ${msg}\n\nالحل المقترح: استخدم تبويب "تاريخي (HyP3)" لتنفيذ التحليل عبر ASF HyP3.`);
        return;
      }

      // تحقق من no_data
      if (data.ok === false && data.unavailable_reason) {
        setError(`⚠️ البيانات غير متوفرة: ${data.unavailable_reason}`);
      } else {
        setResult(data as InSARResult);
      }
    } catch (e: any) {
      setError(
        e?.message
          || 'تعذر تنفيذ المعالجة الفورية. إذا لم يكن محرك SNAP/ISCE++ مفعلاً، استخدم تبويب "تاريخي (HyP3)".'
      );
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

      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1.5">
          <Radio size={15} className="text-violet-400 shrink-0" />
          <span className="text-sm font-bold text-white">InSAR — كشف تشوه الأرض</span>
        </div>
        {/* Mode tabs */}
        <div className="flex gap-1 bg-slate-800/60 rounded-lg p-0.5">
          <button onClick={() => setPanelMode('instant')}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${panelMode==='instant' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            ⚡ فوري (STAC)
          </button>
          <button onClick={() => setPanelMode('historical')}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${panelMode==='historical' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            📅 تاريخي (HyP3)
          </button>
        </div>
      </div>

      {/* ── Historical Mode ─────────────────────────────────────── */}
      {panelMode === 'historical' && (
        <div className="flex-1 overflow-y-auto">
          {/* Form */}
          <div className="px-4 py-3 space-y-3 border-b border-slate-800">
            {/* Area */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">📍 المنطقة</label>
              <select value={hAreaId} onChange={e => setHAreaId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500">
                {PRESET_AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              {hAreaId === 'custom' && (!polygon || polygon.length < 3) && (
                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> ارسم منطقة على الخريطة أولاً (تبويب رسم)
                </p>
              )}
            </div>

            {/* Date range */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">📅 الفترة الزمنية</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">من</p>
                  <div className="flex gap-1">
                    <select value={hYearFrom} onChange={e => setHYearFrom(+e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-violet-500">
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={hMonthFrom} onChange={e => setHMonthFrom(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-1.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-violet-500">
                      {MONTHS.map((m,i) => <option key={m} value={m}>{MONTHS_AR[i]}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">إلى</p>
                  <div className="flex gap-1">
                    <select value={hYearTo} onChange={e => setHYearTo(+e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-violet-500">
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={hMonthTo} onChange={e => setHMonthTo(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-1.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-violet-500">
                      {MONTHS.map((m,i) => <option key={m} value={m}>{MONTHS_AR[i]}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Max pairs */}
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-slate-400 shrink-0">أزواج InSAR:</label>
              <input type="range" min={1} max={8} value={hMaxPairs}
                onChange={e => setHMaxPairs(+e.target.value)}
                className="flex-1 accent-violet-500 h-1" />
              <span className="text-xs text-violet-300 w-4 text-center">{hMaxPairs}</span>
            </div>

            <button onClick={submitHistorical}
              disabled={hLoading || (hAreaId === 'custom' && (!polygon || polygon.length < 3))}
              className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs flex items-center justify-center gap-2 font-medium">
              {hLoading ? <><RefreshCw size={13} className="animate-spin" /> جاري الإرسال...</>
                        : <><Send size={13} /> إرسال للمعالجة (ASF HyP3)</>}
            </button>
          </div>

          {/* Submit result */}
          {hResult && (
            <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs shrink-0 ${hResult.ok ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
              {hResult.ok
                ? <><p className="font-semibold">✅ {hResult.message}</p><p className="mt-0.5 opacity-80">مشاهد: {hResult.scenes_found} | أزواج: {hResult.pairs_built} | وظائف: {hResult.jobs_submitted}</p></>
                : <><p className="font-semibold">❌ {hResult.error}</p>{hResult.scene_dates && <p className="mt-0.5 font-mono opacity-70 text-[10px]">مشاهد: {hResult.scene_dates?.join(', ')}</p>}</>
              }
            </div>
          )}
          {hError && <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-300">❌ {hError}</div>}

          {/* Jobs */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">وظائف HyP3 ({hJobs.length})</span>
              <button onClick={loadHyP3Jobs} disabled={hJobsLoading}
                className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-40">
                <RefreshCw size={12} className={hJobsLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {hJobs.length === 0 && !hJobsLoading && (
              <div className="text-center py-4">
                <Calendar size={24} className="text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-600">لا توجد وظائف InSAR بعد</p>
              </div>
            )}

            {hSelectError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                ❌ {hSelectError}
              </div>
            )}

            {hJobs.map((job: HistoricalJob) => (
              <div key={job.job_id || job.id} className={`rounded-lg border text-xs ${
                job.status==='SUCCEEDED' ? 'bg-emerald-500/5 border-emerald-500/20' :
                job.status==='RUNNING'   ? 'bg-blue-500/5 border-blue-500/20' :
                job.status==='FAILED'    ? 'bg-red-500/5 border-red-500/20' :
                                           'bg-slate-800/50 border-slate-700'} ${hSelectedJobId===job.job_id ? 'ring-1 ring-violet-400/70' : ''}`}>
                <button onClick={() => { void handleSelectHistoricalJob(job); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-right">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {job.status==='SUCCEEDED' && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                    {job.status==='RUNNING'   && <RefreshCw size={12} className="text-blue-400 animate-spin shrink-0" />}
                    {job.status==='PENDING'   && <Clock size={12} className="text-amber-400 shrink-0" />}
                    {job.status==='FAILED'    && <XCircle size={12} className="text-red-400 shrink-0" />}
                    <span className="truncate text-slate-200">{job.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hSelectingJobId===job.job_id && <Loader2 size={11} className="text-violet-300 animate-spin" />}
                    <span className={{SUCCEEDED:'text-emerald-400',RUNNING:'text-blue-400',PENDING:'text-amber-400',FAILED:'text-red-400'}[job.status as string] || 'text-slate-400'}>
                      {job.status==='SUCCEEDED'?'منجز✓':job.status==='RUNNING'?'جاري...':job.status==='PENDING'?'معلق':'فشل'}
                    </span>
                    <ChevronDown size={11} className={`text-slate-500 ${hExpandJob===job.job_id?'rotate-180':''}`} />
                  </div>
                </button>
                {hExpandJob===job.job_id && (
                  <div className="px-3 pb-3 pt-2 border-t border-slate-700/50 space-y-2">
                    <p className="font-mono text-slate-500 text-[10px]">{job.job_id?.slice(0,16)}...</p>
                    {job.granules?.length > 0 && <p className="text-slate-600 text-[10px] truncate">{job.granules[0]?.slice(0,50)}...</p>}
                    {job.status==='SUCCEEDED' && (
                      <div className="space-y-1">
                        {job.displacement_url && (
                          <a href={job.displacement_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20 hover:bg-emerald-500/20">
                            <Download size={11} className="text-emerald-400 shrink-0" />
                            <span className="truncate text-emerald-300 text-[10px]">ملف الإزاحة | Displacement Raster</span>
                          </a>
                        )}
                        {job.files
                          .filter((f: HistoricalFile) => (f.filename || f.name || '').toLowerCase().endsWith('.tif'))
                          .slice(0,3)
                          .map((f: HistoricalFile, i: number)=>(
                          <a key={`${f.filename || f.name || 'file'}-${i}`} href={f.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20 hover:bg-emerald-500/20">
                            <Download size={11} className="text-emerald-400 shrink-0" />
                            <span className="truncate text-emerald-300 text-[10px]">{f.filename || f.name}</span>
                          </a>
                        ))}
                        {job.browse_images?.[0] && (
                          <img src={job.browse_images[0]} alt="InSAR preview"
                            className="w-full rounded border border-slate-700 max-h-36 object-contain bg-black mt-1"
                            onError={e=>(e.currentTarget.style.display='none')} />
                        )}
                        {!job.displacement_url && (job.files?.length ?? 0) === 0 && (
                          <p className="text-[10px] text-slate-500">
                            لا توجد مخرجات قابلة للعرض حالياً. قد تكون الملفات تحت الأرشفة في HyP3.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {selectedResult?.ok && (
              <div className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-violet-200">تقرير مهمة InSAR المختارة</p>
                  <span className="text-[10px] text-violet-300">{selectedResult?.status || 'SUCCEEDED'}</span>
                </div>
                {selectedResult?.message_ar && (
                  <p className="text-[11px] text-slate-300">{selectedResult.message_ar}</p>
                )}

                {selectedResult?.measurements_available === false && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-200 leading-relaxed">
                    لا توجد قياسات رقمية حقيقية لهذه المهمة حالياً. تم إيقاف أي قيم fallback لتفادي التضليل.
                  </div>
                )}

                {selectedResult?.measurements_available === true && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 leading-relaxed">
                    القيم المعروضة مستخرجة مباشرة من ملف الإزاحة InSAR (GeoTIFF).
                  </div>
                )}

                {!selectedResult?.has_precise_bounds && (
                  <div className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-200 leading-relaxed">
                    ملاحظة: حدود المنطقة غير متاحة لهذه المهمة حالياً، لذلك قد لا يظهر توجيه الخريطة أو الطبقة المكانية بشكل كامل.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border border-slate-700/60 bg-slate-900/40 px-2 py-1.5">
                    <p className="text-[10px] text-slate-500">أقصى هبوط | Max Subsidence</p>
                    <p className="text-sm font-bold text-red-300">{selectedResult?.stats?.max_subsidence_mm ?? '—'} مم</p>
                  </div>
                  <div className="rounded border border-slate-700/60 bg-slate-900/40 px-2 py-1.5">
                    <p className="text-[10px] text-slate-500">أقصى ارتفاع | Max Uplift</p>
                    <p className="text-sm font-bold text-blue-300">{selectedResult?.stats?.max_uplift_mm ?? '—'} مم</p>
                  </div>
                  <div className="rounded border border-slate-700/60 bg-slate-900/40 px-2 py-1.5">
                    <p className="text-[10px] text-slate-500">متوسط الإزاحة | Mean</p>
                    <p className="text-sm font-bold text-slate-200">{selectedResult?.stats?.mean_displacement_mm ?? '—'} مم</p>
                  </div>
                  <div className="rounded border border-slate-700/60 bg-slate-900/40 px-2 py-1.5">
                    <p className="text-[10px] text-slate-500">معدل سنوي | Annual Rate</p>
                    <p className="text-sm font-bold text-amber-300">{selectedResult?.stats?.annual_rate_mm_year ?? '—'} مم/سنة</p>
                  </div>
                </div>

                {Array.isArray(selectedResult?.time_series_data) && selectedResult.time_series_data.length > 0 && (
                  <div className="rounded border border-slate-700/60 bg-slate-900/40 px-2 py-2">
                    <p className="text-[10px] text-slate-500 mb-1">التغير الزمني | Time-Series</p>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {selectedResult.time_series_data.map((pt: any, idx: number) => (
                        <div key={`${pt?.at || 't'}-${idx}`} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">{pt?.at || '—'}</span>
                          <span className="text-slate-200 font-mono">{pt?.displacement_mm ?? '—'} mm</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedResult?.report?.ar && (
                  <p className="text-[11px] text-slate-300 leading-relaxed">{selectedResult.report.ar}</p>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="px-4 pb-4">
            <div className="bg-slate-800/30 rounded-lg p-3 text-xs space-y-1.5 text-slate-500">
              <p className="text-slate-400 font-semibold text-[10px]">تفسير خريطة الإزاحة:</p>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 shrink-0"/><span>هبوط &gt;5مم ← انهيار/تسرب/ترسب</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 shrink-0"/><span>ارتفاع ← ضغط مياه/تمدد</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-500 shrink-0"/><span>مستقر (±2مم)</span></div>
              <p className="text-slate-700 text-[10px]">دقة: 5-20مم | فترة: 12 يوم | الملف: *_los_disp.tif</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Instant Mode (original) ─────────────────────────────── */}
      {panelMode === 'instant' && (<>
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
        </div>{/* end controls */}

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
      {/* end instant mode */}
      </>)}
    </div>
  );
}

const SAR_HALF_WAVELENGTH_MM_DISPLAY = 28;
