'use client';

import React, { useState, useCallback } from 'react';
import {
  GitMerge, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Microscope, ShieldCheck, Clock, Play, RefreshCw, MapPin,
  Navigation2, CalendarDays, BarChart3, Zap,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type CVAMode = 'cva' | 'subpixel' | 'ground_truth' | 'automonitor';

interface Hotspot {
  id: string;
  location: { lon: number; lat: number };
  magnitude?: number;
  intensity?: number;
  area_m2?: number;
  change_type?: string;
  severity: string;
}

interface CVAResult {
  ok: boolean;
  method: string;
  change_pct: number;
  hotspot_count?: number;
  region_count?: number;
  critical_count: number;
  warning_count: number;
  hotspots?: Hotspot[];
  regions?: Hotspot[];
  type_distribution?: Record<string, number>;
  magnitude_max?: number;
  effective_resolution_m?: number;
  bands_used?: string[];
}

interface GroundTruthResult {
  ok: boolean;
  metrics: {
    TP: number; FP: number; FN: number;
    precision: number; recall: number; f1_score: number;
    accuracy_pct: number;
  };
  detected_count: number;
  ground_truth_count: number;
  match_details: any[];
  false_negatives: any[];
  cva_summary: any;
}

interface MonitorState {
  last_run: string | null;
  next_run: string | null;
  running: boolean;
  last_result_summary?: { total_checked: number; total_events: number; critical_count: number };
}

interface Props {
  polygon: [number, number][] | null;
  onFlyTo?: (lon: number, lat: number, zoom?: number) => void;
  onMarkersReady?: (markers: { lon: number; lat: number; severity: string; type: string; label: string }[]) => void;
}

const SEV_COLOR: Record<string, string> = {
  critical: 'text-red-400 border-red-700/40 bg-red-900/20',
  warning:  'text-amber-400 border-amber-700/40 bg-amber-900/20',
  info:     'text-slate-400 border-slate-700/40 bg-slate-800/30',
};

const MODE_META: Record<CVAMode, { label: string; color: string; Icon: React.ElementType; desc: string }> = {
  cva:          { label: 'CVA متعدد النطاقات', color: 'teal',   Icon: GitMerge,    desc: '4 نطاقات طيفية: NDVI+NDWI+SAR+Brightness' },
  subpixel:     { label: 'Sub-pixel دقة 2.5م', color: 'cyan',   Icon: Microscope,  desc: 'تكبير ×4 + Laplacian edges للتغييرات الصغيرة' },
  ground_truth: { label: 'التحقق الميداني',    color: 'emerald', Icon: ShieldCheck, desc: 'Precision / Recall / F1 مقارنة مع المشاريع الحقيقية' },
  automonitor:  { label: 'مراقبة تلقائية 24h', color: 'amber',   Icon: Clock,       desc: 'دورة فحص كل 24 ساعة لجميع التنبيهات' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CVAAdvancedPanel({ polygon, onFlyTo, onMarkersReady }: Props) {
  const [activeMode, setActiveMode] = useState<CVAMode>('cva');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [cvaResult, setCvaResult]   = useState<CVAResult | null>(null);
  const [spResult, setSpResult]     = useState<CVAResult | null>(null);
  const [gtResult, setGtResult]     = useState<GroundTruthResult | null>(null);
  const [monitorState, setMonitorState] = useState<MonitorState | null>(null);
  const [monitorLog, setMonitorLog]     = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // تحميل حالة المراقبة التلقائية
  const loadMonitorState = useCallback(async () => {
    try {
      const res = await fetch('/api/gis/auto-monitor');
      const data = await res.json();
      setMonitorState(data.state);
      setMonitorLog(data.last_log ?? []);
    } catch { /* ignore */ }
  }, []);

  // تشغيل دورة مراقبة
  const runAutoMonitor = useCallback(async (force: boolean) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/gis/auto-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.skipped) {
        setError(data.reason);
      } else {
        setMonitorState({ last_run: data.next_run ? new Date().toISOString() : null, next_run: data.next_run, running: false, last_result_summary: data.summary });
        setMonitorLog([{ run_at: new Date().toISOString(), summary: data.summary, results: data.results }]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // تشغيل التحليل
  const runAnalysis = useCallback(async () => {
    if (activeMode === 'automonitor') { await runAutoMonitor(true); return; }
    if (!polygon || polygon.length < 3) { setError('ارسم منطقة على الخريطة أولاً'); return; }

    setLoading(true); setError(null);

    const now = new Date();
    const dateBefore = new Date(now.getTime() - 90 * 86400_000).toISOString().slice(0, 10);
    const dateAfter  = now.toISOString().slice(0, 10);

    const endpointMap: Record<string, string> = {
      cva:          '/api/gis/cva-change',
      subpixel:     '/api/gis/subpixel-change',
      ground_truth: '/api/gis/ground-truth',
    };

    try {
      const res = await fetch(endpointMap[activeMode], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygon, date_before: dateBefore, date_after: dateAfter }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data = await res.json();

      if (activeMode === 'cva') {
        if (data.ok === false && data.unavailable_reason) {
          setError(`⚠️ البيانات غير متوفرة: ${data.unavailable_reason}`);
          return;
        }
        setCvaResult(data);
        const items = data.hotspots ?? [];
        onMarkersReady?.(items.filter((h: Hotspot) => h.location.lon !== 0).map((h: Hotspot) => ({
          lon: h.location.lon, lat: h.location.lat,
          severity: h.severity, type: h.change_type ?? 'cva',
          label: h.change_type ?? 'CVA hotspot',
        })));
      } else if (activeMode === 'subpixel') {
        if (data.ok === false && data.unavailable_reason) {
          setError(`⚠️ البيانات غير متوفرة: ${data.unavailable_reason}`);
          return;
        }
        setSpResult(data);
        const items = data.regions ?? [];
        onMarkersReady?.(items.filter((r: Hotspot) => r.location.lon !== 0).map((r: Hotspot) => ({
          lon: r.location.lon, lat: r.location.lat,
          severity: r.severity, type: 'subpixel',
          label: `${r.area_m2?.toFixed(0)} م² — ${r.severity}`,
        })));
      } else if (activeMode === 'ground_truth') {
        if (data.ok === false) {
          const msg = data.unavailable_reason ?? (data.status === 'no_ground_truth'
            ? 'لا توجد مشاريع مسجلة في هذه المنطقة — أضف مشاريع عبر واجهة الأصول أولاً'
            : 'البيانات غير متوفرة');
          setError(`⚠️ ${msg}`);
          return;
        }
        setGtResult(data);
      }
    } catch (e: any) {
      setError(e.message ?? 'خطأ في التحليل');
    } finally {
      setLoading(false);
    }
  }, [activeMode, polygon, onMarkersReady, runAutoMonitor]);

  // ── Render: Mode selector ──────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden" dir="rtl">
      {/* Mode tabs */}
      <div className="grid grid-cols-2 gap-1 p-2 border-b border-slate-800 bg-slate-900/60 shrink-0">
        {(Object.keys(MODE_META) as CVAMode[]).map(m => {
          const { label, color, Icon } = MODE_META[m];
          const isActive = activeMode === m;
          return (
            <button key={m} onClick={() => { setActiveMode(m); setError(null); }}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-semibold transition-colors text-right border ${
                isActive
                  ? `bg-${color}-800/50 border-${color}-600/50 text-${color}-200`
                  : 'bg-slate-800/30 border-slate-700/30 text-slate-400 hover:bg-slate-700/40'
              }`}>
              <Icon size={10} className="shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Description */}
        <div className="rounded bg-slate-800/40 border border-slate-700/40 px-2.5 py-1.5">
          <p className="text-[9px] text-slate-400">{MODE_META[activeMode].desc}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-1.5 rounded bg-red-900/20 border border-red-700/30 px-2.5 py-2">
            <AlertCircle size={11} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[9px] text-red-300">{error}</p>
          </div>
        )}

        {/* Run button */}
        <button onClick={runAnalysis} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded bg-teal-700/40 hover:bg-teal-600/50 border border-teal-600/40 text-teal-200 text-[11px] font-bold transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? 'جارٍ التحليل...' : activeMode === 'automonitor' ? 'تشغيل دورة مراقبة' : 'تشغيل التحليل'}
        </button>

        {/* ── CVA Results ─────────────────────────────────────────────────── */}
        {activeMode === 'cva' && cvaResult && (
          <CVAResults result={cvaResult} onFlyTo={onFlyTo} expandedId={expandedId} setExpandedId={setExpandedId} />
        )}

        {/* ── Sub-pixel Results ─────────────────────────────────────────── */}
        {activeMode === 'subpixel' && spResult && (
          <SubPixelResults result={spResult} onFlyTo={onFlyTo} expandedId={expandedId} setExpandedId={setExpandedId} />
        )}

        {/* ── Ground Truth Results ──────────────────────────────────────── */}
        {activeMode === 'ground_truth' && gtResult && (
          <GroundTruthResults result={gtResult} />
        )}

        {/* ── Auto Monitor ──────────────────────────────────────────────── */}
        {activeMode === 'automonitor' && (
          <AutoMonitorPanel
            monitorState={monitorState}
            monitorLog={monitorLog}
            onLoad={loadMonitorState}
            onForce={() => runAutoMonitor(true)}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

// ── CVA Results Sub-component ─────────────────────────────────────────────────

function CVAResults({ result, onFlyTo, expandedId, setExpandedId }: {
  result: CVAResult;
  onFlyTo?: (lon: number, lat: number, zoom?: number) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const items = result.hotspots ?? [];
  return (
    <div className="space-y-1.5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-1 text-center">
        {[
          { label: 'تغيير', value: `${result.change_pct}٪`, color: 'text-teal-300' },
          { label: 'بؤر', value: result.hotspot_count ?? 0, color: 'text-amber-300' },
          { label: 'حرج', value: result.critical_count, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded bg-slate-800/50 border border-slate-700/40 py-1.5">
            <p className={`text-[13px] font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[8px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
      {/* Bands */}
      {result.bands_used && (
        <div className="flex flex-wrap gap-1">
          {result.bands_used.map(b => (
            <span key={b} className="text-[8px] px-1.5 py-0.5 rounded bg-teal-900/30 border border-teal-700/30 text-teal-300">{b}</span>
          ))}
        </div>
      )}
      {/* Type distribution */}
      {result.type_distribution && (
        <div className="rounded bg-slate-800/40 border border-slate-700/30 p-2 space-y-1">
          <p className="text-[9px] text-slate-400 font-semibold">توزيع أنواع التغيير</p>
          {Object.entries(result.type_distribution).filter(([,v]) => (v as number) > 0).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 w-20 shrink-0">{k}</span>
              <div className="flex-1 h-1.5 bg-slate-700 rounded overflow-hidden">
                <div className="h-full bg-teal-500 rounded" style={{ width: `${Math.min(100, (v as number) / 500 * 100)}%` }} />
              </div>
              <span className="text-[9px] text-slate-400">{v as number}</span>
            </div>
          ))}
        </div>
      )}
      {/* Hotspots */}
      {items.map(h => (
        <HotspotCard key={h.id} item={h} expandedId={expandedId} setExpandedId={setExpandedId} onFlyTo={onFlyTo}
          extra={`magnitude: ${h.magnitude?.toFixed(3)}`} />
      ))}
    </div>
  );
}

// ── Sub-pixel Results Sub-component ──────────────────────────────────────────

function SubPixelResults({ result, onFlyTo, expandedId, setExpandedId }: {
  result: CVAResult;
  onFlyTo?: (lon: number, lat: number, zoom?: number) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const items = result.regions ?? [];
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1 text-center">
        {[
          { label: 'دقة',    value: `${result.effective_resolution_m}م`, color: 'text-cyan-300' },
          { label: 'مناطق', value: result.region_count ?? 0,             color: 'text-amber-300' },
          { label: 'تغيير', value: `${result.change_pct}٪`,              color: 'text-teal-300' },
        ].map(s => (
          <div key={s.label} className="rounded bg-slate-800/50 border border-slate-700/40 py-1.5">
            <p className={`text-[13px] font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[8px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-slate-500 text-center">أصغر تغيير قابل للكشف: {(10 / 4).toFixed(2)} م × {(10 / 4).toFixed(2)} م</p>
      {items.map(r => (
        <HotspotCard key={r.id} item={r} expandedId={expandedId} setExpandedId={setExpandedId} onFlyTo={onFlyTo}
          extra={`${r.area_m2?.toFixed(0)} م²`} />
      ))}
    </div>
  );
}

// ── Ground Truth Results Sub-component ───────────────────────────────────────

function GroundTruthResults({ result }: { result: GroundTruthResult }) {
  const m = result.metrics;
  const scoreColor = m.f1_score > 0.75 ? 'text-emerald-400' : m.f1_score > 0.5 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-2">
      {/* F1 Score highlight */}
      <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 text-center">
        <p className={`text-3xl font-black ${scoreColor}`}>{(m.f1_score * 100).toFixed(0)}٪</p>
        <p className="text-[9px] text-slate-400 mt-0.5">F1 Score (دقة النظام)</p>
      </div>
      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: 'Precision', value: `${(m.precision * 100).toFixed(0)}٪`, desc: 'نسبة صحيحة من المكتشَف' },
          { label: 'Recall',    value: `${(m.recall    * 100).toFixed(0)}٪`, desc: 'نسبة المكتشَف من الكلي' },
          { label: 'TP',        value: m.TP, desc: 'اكتشاف صحيح' },
          { label: 'FP',        value: m.FP, desc: 'إنذار كاذب' },
          { label: 'FN',        value: m.FN, desc: 'فائت' },
          { label: 'الدقة',     value: `${m.accuracy_pct}٪`, desc: 'الكلية' },
        ].map(s => (
          <div key={s.label} className="rounded bg-slate-800/40 border border-slate-700/30 px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-slate-500">{s.label}</span>
              <span className="text-[12px] font-bold text-slate-200">{s.value}</span>
            </div>
            <p className="text-[8px] text-slate-600">{s.desc}</p>
          </div>
        ))}
      </div>
      {/* False Negatives */}
      {result.false_negatives.length > 0 && (
        <div className="rounded bg-red-900/20 border border-red-700/30 p-2">
          <p className="text-[9px] text-red-300 font-semibold mb-1">تغييرات فائتة (FN)</p>
          {result.false_negatives.map((fn: any, i: number) => (
            <p key={i} className="text-[8px] text-red-400">• {fn.name} — {fn.area_m2} م²</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Auto Monitor Panel Sub-component ─────────────────────────────────────────

function AutoMonitorPanel({ monitorState, monitorLog, onLoad, onForce, loading }: {
  monitorState: MonitorState | null;
  monitorLog: any[];
  onLoad: () => void;
  onForce: () => void;
  loading: boolean;
}) {
  React.useEffect(() => { onLoad(); }, [onLoad]);

  return (
    <div className="space-y-2">
      {/* Status */}
      <div className="rounded bg-slate-800/50 border border-slate-700/40 p-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${monitorState?.running ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-[10px] text-slate-300 font-semibold">
            {monitorState?.running ? 'جارٍ الفحص...' : 'جاهز'}
          </span>
        </div>
        {monitorState?.last_run && (
          <p className="text-[9px] text-slate-500">
            آخر فحص: <span className="text-slate-300">{new Date(monitorState.last_run).toLocaleString('ar')}</span>
          </p>
        )}
        {monitorState?.next_run && (
          <p className="text-[9px] text-slate-500">
            التالي: <span className="text-cyan-300">{new Date(monitorState.next_run).toLocaleString('ar')}</span>
          </p>
        )}
        {monitorState?.last_result_summary && (
          <div className="grid grid-cols-3 gap-1 mt-1">
            {[
              { label: 'مُفحوص', value: monitorState.last_result_summary.total_checked },
              { label: 'أحداث', value: monitorState.last_result_summary.total_events },
              { label: 'حرج', value: monitorState.last_result_summary.critical_count, red: true },
            ].map(s => (
              <div key={s.label} className="text-center rounded bg-slate-900/50 py-1">
                <p className={`text-[12px] font-bold ${s.red ? 'text-red-400' : 'text-slate-200'}`}>{s.value}</p>
                <p className="text-[8px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log */}
      {monitorLog.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] text-slate-500 font-semibold">سجل الدورات الأخيرة</p>
          {monitorLog.map((entry: any, i: number) => (
            <div key={i} className="rounded bg-slate-800/40 border border-slate-700/30 px-2 py-1.5">
              <p className="text-[9px] text-slate-400">{new Date(entry.run_at).toLocaleString('ar')}</p>
              <p className="text-[9px] text-slate-300">
                {entry.summary?.total_events ?? 0} حدث — {entry.summary?.critical_count ?? 0} حرج
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared Hotspot Card ───────────────────────────────────────────────────────

function HotspotCard({ item, expandedId, setExpandedId, onFlyTo, extra }: {
  item: Hotspot;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onFlyTo?: (lon: number, lat: number, zoom?: number) => void;
  extra?: string;
}) {
  const isOpen = expandedId === item.id;
  return (
    <div className={`rounded border overflow-hidden ${SEV_COLOR[item.severity] ?? SEV_COLOR.info}`}>
      <button onClick={() => setExpandedId(isOpen ? null : item.id)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/5 transition-colors text-right">
        <Zap size={9} className="shrink-0" />
        <span className="text-[9px] font-medium flex-1 truncate">{item.change_type ?? item.id}</span>
        <span className="text-[8px] opacity-60">{extra}</span>
        {isOpen ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
      </button>
      {isOpen && (
        <div className="px-2.5 pb-2 bg-black/20 space-y-1.5">
          <div className="grid grid-cols-2 gap-x-2 text-[8px] text-slate-400">
            <span>خط الطول: <strong className="text-slate-200">{item.location.lon.toFixed(5)}</strong></span>
            <span>خط العرض: <strong className="text-slate-200">{item.location.lat.toFixed(5)}</strong></span>
            {item.area_m2 && <span>المساحة: <strong className="text-slate-200">{item.area_m2.toFixed(0)} م²</strong></span>}
          </div>
          {item.location.lon !== 0 && (
            <button
              onClick={() => onFlyTo?.(item.location.lon, item.location.lat, 16)}
              className="w-full flex items-center justify-center gap-1.5 py-1 rounded bg-teal-700/40 hover:bg-teal-600/50 border border-teal-600/40 text-teal-200 text-[9px] font-semibold">
              <Navigation2 size={9} />
              عرض على الخريطة
            </button>
          )}
        </div>
      )}
    </div>
  );
}
