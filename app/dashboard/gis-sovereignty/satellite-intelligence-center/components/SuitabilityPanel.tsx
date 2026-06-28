'use client';

import React, { useState, useCallback } from 'react';
import { Target, Loader2, AlertCircle, ChevronDown, ChevronUp, MapPin, ChevronRight } from 'lucide-react';

type UseCase = 'health_center' | 'school' | 'pump_station' | 'warehouse' | 'fire_station' | 'park';

const USE_CASE_OPTIONS: { value: UseCase; label: string }[] = [
  { value: 'health_center', label: 'مركز صحي' },
  { value: 'school',        label: 'مدرسة' },
  { value: 'pump_station',  label: 'محطة ضخ' },
  { value: 'warehouse',     label: 'مستودع' },
  { value: 'fire_station',  label: 'محطة إطفاء' },
  { value: 'park',          label: 'حديقة عامة' },
];

const CRITERIA_LABELS: Record<string, string> = {
  population_density:    'الكثافة السكانية',
  road_access:           'إمكانية الوصول',
  green_coverage:        'التغطية الخضراء',
  heat_level:            'مستوى الحرارة',
  flood_risk:            'مخاطر الفيضانات',
  proximity_to_services: 'القرب من الخدمات',
};

interface SuitabilityResult {
  use_case: UseCase;
  use_case_label: string;
  score: number;
  score_pct: number;
  verdict: string;
  criteria_scores: Record<string, number>;
  weights_used: Record<string, number>;
  top_locations: {
    lon: number; lat: number; score: number; label: string;
    criteria?: Record<string, number>;
    justification?: string;
  }[];
  narrative_ar: string;
  bbox: [number, number, number, number];
}

export interface SuitabilityPin {
  lon: number;
  lat: number;
  score: number;
  label: string;
}

interface Props {
  bbox: [number, number, number, number] | null;
  polygon?: [number, number][];
  onLocationsReady?: (pins: SuitabilityPin[]) => void;
  onFlyTo?: (lon: number, lat: number) => void;
}

function ScoreArc({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#22c55e' : pct >= 65 ? '#84cc16' : pct >= 50 ? '#eab308' : pct >= 35 ? '#f97316' : '#ef4444';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <span className="text-2xl font-bold -mt-14" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function SuitabilityPanel({ bbox, polygon, onLocationsReady, onFlyTo }: Props) {
  const [useCase, setUseCase]           = useState<UseCase>('health_center');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [result, setResult]             = useState<SuitabilityResult | null>(null);
  const [showWeights, setShowWeights]   = useState(false);
  const [weights, setWeights]           = useState<Record<string, number>>({});
  const [expandedLoc, setExpandedLoc]   = useState<number | null>(null);

  const handleRun = useCallback(async () => {
    if (!bbox && !polygon) {
      setError('ارسم منطقة على الخريطة أولاً لتحديد نطاق التحليل.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gis/suitability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          use_case: useCase,
          ...(bbox ? { bbox } : {}),
          ...(polygon ? { polygon } : {}),
          ...(Object.keys(weights).length > 0 ? { weights } : {}),
        }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => 'unknown_error');
        throw new Error(msg);
      }
      const data = await res.json();
      setResult(data);
      if (data.top_locations?.length > 0) {
        onLocationsReady?.(data.top_locations);
      }
    } catch (e: any) {
      setError(e?.message ?? 'فشل تحليل الملاءمة');
    } finally {
      setLoading(false);
    }
  }, [bbox, polygon, useCase, weights]);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target size={14} className="text-blue-400 shrink-0" />
        <span className="text-[12px] font-bold text-slate-200">تحليل الملاءمة البقعية</span>
      </div>

      {/* Use-case selector */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-2">
        <p className="text-[10px] text-slate-400 font-semibold">نوع المنشأة المقترحة</p>
        <div className="grid grid-cols-3 gap-1">
          {USE_CASE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setUseCase(value); setResult(null); }}
              className={`px-2 py-1.5 rounded text-[10px] font-semibold border transition-colors ${
                useCase === value
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-slate-500'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Advanced weights toggle */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30">
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-slate-400 hover:text-slate-200"
          onClick={() => setShowWeights(!showWeights)}
        >
          <span>تخصيص معايير التقييم (اختياري)</span>
          {showWeights ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
        {showWeights && (
          <div className="px-3 pb-3 space-y-2">
            {Object.entries(CRITERIA_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400 w-32 shrink-0">{label}</span>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={weights[key] ?? 0.17}
                  onChange={(e) => setWeights((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                  className="flex-1 accent-blue-500 h-1"
                />
                <span className="text-[9px] text-slate-300 w-8 text-left">{((weights[key] ?? 0.17) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* No AOI warning */}
      {!bbox && !polygon && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-3 py-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-300">ارسم منطقة على الخريطة أولاً</p>
        </div>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={loading || (!bbox && !polygon)}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-bold flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Target size={13} />}
        {loading ? 'جارٍ التحليل...' : 'تشغيل تحليل الملاءمة'}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 px-3 py-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-rose-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Score gauge */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 flex flex-col items-center gap-2">
            <ScoreArc pct={result.score_pct} />
            <p className="text-[13px] font-bold text-slate-100 mt-2">{result.verdict}</p>
            <p className="text-[10px] text-slate-400">{result.use_case_label}</p>
          </div>

          {/* Narrative */}
          <div className="rounded-lg border border-blue-800/30 bg-blue-950/25 px-3 py-2.5">
            <p className="text-[11px] text-blue-200 leading-relaxed">{result.narrative_ar}</p>
          </div>

          {/* Criteria breakdown */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5 space-y-2">
            <p className="text-[10px] text-slate-400 font-semibold mb-1">تفصيل المعايير</p>
            {Object.entries(result.criteria_scores).map(([key, val]) => {
              const pct = Math.round(val * 100);
              const barColor = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-rose-500';
              return (
                <div key={key}>
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-slate-300">{CRITERIA_LABELS[key] ?? key}</span>
                    <span className="text-slate-400">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%`, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top locations */}
          {result.top_locations.length > 0 && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5">
              <p className="text-[10px] text-slate-400 font-semibold mb-2">المواقع المقترحة</p>
              <div className="space-y-2">
                {result.top_locations.map((loc, i) => (
                  <div key={i} className="rounded-lg border border-slate-700/40 bg-slate-900/50 overflow-hidden">
                    {/* Location header — clickable to fly + expand */}
                    <button
                      className="w-full flex items-center gap-2 px-2 py-2 hover:bg-slate-800/60 transition-colors text-right"
                      onClick={() => { onFlyTo?.(loc.lon, loc.lat); setExpandedLoc(expandedLoc === i ? null : i); }}
                    >
                      <MapPin size={11} className="text-green-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-200 font-semibold">{loc.label}</p>
                        <p className="text-[9px] text-slate-500 font-mono">{loc.lon.toFixed(4)}, {loc.lat.toFixed(4)}</p>
                      </div>
                      <span className="text-[10px] font-bold text-green-400 shrink-0">{Math.round(loc.score * 100)}٪</span>
                      {expandedLoc === i ? <ChevronUp size={10} className="text-slate-500 shrink-0" /> : <ChevronRight size={10} className="text-slate-500 shrink-0" />}
                    </button>

                    {/* Expanded: justification + per-location criteria bars */}
                    {expandedLoc === i && (
                      <div className="px-3 pb-2.5 pt-1 space-y-2 border-t border-slate-700/30">
                        {/* Justification text */}
                        {loc.justification && (
                          <p className="text-[9px] text-slate-300 leading-relaxed bg-slate-800/40 rounded p-1.5">
                            {loc.justification}
                          </p>
                        )}
                        {/* Per-location criteria bars */}
                        {loc.criteria && (
                          <div className="space-y-1">
                            {Object.entries(loc.criteria).map(([key, val]) => {
                              const pct = Math.round(val * 100);
                              const barColor = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-rose-500';
                              return (
                                <div key={key}>
                                  <div className="flex justify-between text-[8px] mb-0.5">
                                    <span className="text-slate-400">{CRITERIA_LABELS[key] ?? key}</span>
                                    <span className="text-slate-500">{pct}٪</span>
                                  </div>
                                  <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
