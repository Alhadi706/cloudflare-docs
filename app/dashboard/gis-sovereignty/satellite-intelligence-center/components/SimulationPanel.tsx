'use client';
// ─── SimulationPanel — Phase S12 ─────────────────────────────────────────────
// Future state simulation: select a target year → get prediction.
// Clearly labelled as future estimate, not real data.

import React, { useState } from 'react';
import {
  Zap, Save, RefreshCw, AlertTriangle,
  Building2, Trees, Route, Users, Thermometer,
} from 'lucide-react';
import {
  fetchSimulation, saveSimulation,
  type SimulationResult,
} from '@/lib/s12API';

// ─── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({
  Icon, color, label, current, predicted,
}: {
  Icon: React.ElementType; color: string;
  label: string; current: number; predicted: number;
}) {
  const pct = ((predicted - current) / Math.max(1, current)) * 100;
  const up  = pct > 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon size={12} className={color} />
        {label}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-500">{current.toLocaleString('ar-LY')}</span>
        <span className="text-slate-600">→</span>
        <span className="font-bold text-slate-200">{predicted.toLocaleString('ar-LY')}</span>
        <span className={`text-[10px] font-semibold ${up ? 'text-orange-400' : 'text-emerald-400'}`}>
          {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  onResult?: (narrative: string, year: number) => void;
  bbox?:    [number, number, number, number] | null;
  polygon?: [number, number][] | null;
  areaId?:  string | null;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function SimulationPanel({ bbox, polygon, areaId, onResult }: Props) {
  const [targetYear, setTargetYear]   = useState(CURRENT_YEAR + 5);
  const [result,     setResult]       = useState<SimulationResult | null>(null);
  const [loading,    setLoading]      = useState(false);
  const [saving,     setSaving]       = useState(false);
  const [saved,      setSaved]        = useState(false);
  const [error,      setError]        = useState<string | null>(null);

  const hasGeom = !!(bbox || polygon);

  const run = async () => {
    if (!hasGeom) return;
    setLoading(true); setError(null); setSaved(false);
    try {
      const r = await fetchSimulation({
        ...(bbox ? { bbox } : { polygon: polygon! }),
        target_year: targetYear,
        area_id: areaId ?? undefined,
      });
      setResult(r);
      if (onResult && r.narrative) onResult(r.narrative, targetYear);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل التوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || !areaId) return;
    setSaving(true);
    try {
      await saveSimulation({
        area_id:     areaId,
        target_year: result.target_year,
        predicted:   result.predicted,
      });
      setSaved(true);
    } catch (_) { /* ignore */ } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-3" dir="rtl">

      {/* Future warning banner */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-950/40 border border-amber-700/30">
        <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-300 leading-tight">
          هذا توقع مستقبلي مبني على اتجاهات النمو الحالية — وليس بيانات فعلية
        </p>
      </div>

      {/* Year selector */}
      <div>
        <label className="text-[10px] text-slate-500 font-semibold mb-1.5 block">
          حاكِ حتى سنة
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={CURRENT_YEAR + 1}
            max={CURRENT_YEAR + 30}
            value={targetYear}
            onChange={e => setTargetYear(+e.target.value)}
            className="flex-1 accent-blue-500"
          />
          <span className="text-sm font-bold text-blue-300 w-12 text-center">{targetYear}</span>
        </div>
        <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
          <span>{CURRENT_YEAR + 1}</span>
          <span>{CURRENT_YEAR + 30}</span>
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={run}
        disabled={loading || !hasGeom}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-600/20 border border-violet-600/30 text-violet-300 text-xs font-semibold hover:bg-violet-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
        {loading ? 'جارٍ المحاكاة…' : `توقع حال المنطقة سنة ${targetYear}`}
      </button>

      {!hasGeom && (
        <p className="text-xs text-slate-600 text-center">ارسم منطقة على الخريطة أولاً</p>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/30 border border-rose-800/30">
          <AlertTriangle size={12} className="text-rose-400" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {/* Narrative */}
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3.5">
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {result.narrative}
            </p>
          </div>

          {/* Comparison table */}
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              الحالة الحالية → التوقع ({result.target_year})
            </p>
            <StatRow Icon={Building2}   color="text-orange-400" label="المباني"
              current={result.current_state.buildings_count}
              predicted={result.predicted.buildings_count} />
            <StatRow Icon={Users}       color="text-blue-400"   label="السكان"
              current={result.current_state.population_est}
              predicted={result.predicted.population_est} />
            <StatRow Icon={Trees}       color="text-emerald-400" label="الأشجار"
              current={result.current_state.trees_count}
              predicted={result.predicted.trees_count} />
            <StatRow Icon={Route}       color="text-violet-400" label="الطرق (كم)"
              current={result.current_state.road_km_paved}
              predicted={result.predicted.road_km_paved} />
            <StatRow Icon={Thermometer} color="text-red-400"    label="الحرارة (°C)"
              current={result.current_state.temp_mean_c}
              predicted={result.predicted.temp_mean_c} />
          </div>

          {/* Save button */}
          {areaId && (
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                saved
                  ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-300'
                  : 'bg-slate-800/40 border-slate-700/30 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              {saved ? 'تم حفظ المحاكاة ✓' : 'حفظ المحاكاة لمقارنتها لاحقاً'}
            </button>
          )}

          <p className="text-[9px] text-slate-600 px-1">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
