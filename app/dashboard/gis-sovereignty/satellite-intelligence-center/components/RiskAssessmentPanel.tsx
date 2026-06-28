'use client';

import React, { useState, useCallback } from 'react';
import { ShieldAlert, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface RiskTypes {
  flood:      boolean;
  landslide:  boolean;
  subsidence: boolean;
  fire:       boolean;
  pollution:  boolean;
  seismic:    boolean;
}

type InfraContext = 'residential' | 'industrial' | 'agricultural' | 'infrastructure' | 'general';

interface RiskZoneSummary {
  score:       number;
  level:       string;
  zone_count:  number;
  description: string;
}

interface RiskResult {
  status: 'ok';
  overall_risk_score: number;
  overall_risk_level: 'low' | 'medium' | 'high' | 'critical';
  area_km2: number;
  risk_summary: Record<string, RiskZoneSummary>;
  geojson: { type: 'FeatureCollection'; features: any[] };
  priority_actions: string[];
  analysis_notes: string[];
}

interface Props {
  drawnPolygon?: [number, number][] | null;
  highlightBoundary?: any;                       // municipality geometry
  onResultReady: (result: RiskResult | null, geojson: any | null) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<string, string> = {
  low:      'text-green-400 border-green-700/40 bg-green-900/20',
  medium:   'text-yellow-400 border-yellow-700/40 bg-yellow-900/20',
  high:     'text-orange-400 border-orange-700/40 bg-orange-900/20',
  critical: 'text-rose-400 border-rose-700/40 bg-rose-900/20',
};
const LEVEL_AR: Record<string, string> = {
  low: 'منخفض', medium: 'متوسط', high: 'مرتفع', critical: 'حرج',
};
const LEVEL_BADGE: Record<string, string> = {
  low: 'bg-green-900/40 text-green-300', medium: 'bg-yellow-900/40 text-yellow-300',
  high: 'bg-orange-900/40 text-orange-300', critical: 'bg-rose-900/40 text-rose-300',
};

function RiskScoreBar({ score, level }: { score: number; level: string }) {
  const color = level === 'low' ? 'bg-green-500' : level === 'medium' ? 'bg-yellow-500' :
                level === 'high' ? 'bg-orange-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[9px] text-slate-400 w-6 text-right">{score}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RiskAssessmentPanel({ drawnPolygon, highlightBoundary, onResultReady }: Props) {
  const [riskTypes, setRiskTypes] = useState<RiskTypes>({
    flood: true, landslide: true, subsidence: true, fire: false, pollution: true, seismic: false,
  });
  const [infraCtx, setInfraCtx] = useState<InfraContext>('general');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<RiskResult | null>(null);
  const [showOnMap, setShowOnMap] = useState(true);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);

  const toggleRisk = (k: keyof RiskTypes) => setRiskTypes(p => ({ ...p, [k]: !p[k] }));

  // Build geometry from drawn polygon or boundary
  const getGeometry = () => {
    if (drawnPolygon && drawnPolygon.length >= 3) {
      const ring = [...drawnPolygon.map(p => [p[0], p[1]]), [drawnPolygon[0][0], drawnPolygon[0][1]]];
      return { type: 'Polygon', coordinates: [ring] };
    }
    if (highlightBoundary) return highlightBoundary;
    // Default: Tripoli rough bbox
    return { type: 'Polygon', coordinates: [[[12.8, 32.6], [13.6, 32.6], [13.6, 33.1], [12.8, 33.1], [12.8, 32.6]]] };
  };

  const handleRun = useCallback(async () => {
    const activeCount = Object.values(riskTypes).filter(Boolean).length;
    if (!activeCount) { setError('اختر نوع مخاطر واحداً على الأقل'); return; }

    setLoading(true); setError(null); setResult(null); onResultReady(null, null);
    try {
      const res = await fetch('/api/gis/risk-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometry: getGeometry(), risk_types: riskTypes, infrastructure_context: infraCtx }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data: RiskResult = await res.json();
      setResult(data);
      setShowOnMap(true);
      onResultReady(data, data.geojson);
    } catch (e: any) {
      setError(e?.message ?? 'فشل التحليل');
    } finally {
      setLoading(false);
    }
  }, [riskTypes, infraCtx, drawnPolygon, highlightBoundary, onResultReady]);

  const handleClear = () => { setResult(null); setError(null); onResultReady(null, null); };
  const handleToggleMap = () => {
    setShowOnMap(p => { onResultReady(result, p ? null : result?.geojson ?? null); return !p; });
  };

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="text-rose-400 shrink-0" />
        <span className="text-[12px] font-bold text-slate-200">تقييم المخاطر البيئية</span>
      </div>

      {/* Area source info */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2.5 py-2 text-[9px] text-slate-400">
        {drawnPolygon
          ? '✓ تحليل المنطقة المرسومة على الخريطة'
          : highlightBoundary
          ? '✓ تحليل المنطقة الإدارية المحددة'
          : '⚠ لا توجد منطقة محددة — سيتم تحليل منطقة افتراضية (ارسم مضلعاً أو حدد بلدية)'}
      </div>

      {/* Infrastructure context */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-1.5">
        <p className="text-[10px] text-slate-400 font-semibold">نوع الاستخدام</p>
        <div className="grid grid-cols-2 gap-1">
          {([
            { v: 'general',        l: 'عام' },
            { v: 'residential',    l: 'سكني' },
            { v: 'industrial',     l: 'صناعي' },
            { v: 'agricultural',   l: 'زراعي' },
            { v: 'infrastructure', l: 'بنية تحتية' },
          ] as const).map(({ v, l }) => (
            <button key={v} onClick={() => setInfraCtx(v)}
              className={`py-1 rounded text-[10px] border transition-colors ${
                infraCtx === v
                  ? 'bg-rose-800/50 border-rose-500 text-rose-200'
                  : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-slate-500'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Risk types */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-1.5">
        <p className="text-[10px] text-slate-400 font-semibold">أنواع المخاطر</p>
        {([
          { key: 'flood',      label: 'فيضان',              icon: '💧', color: 'text-blue-400' },
          { key: 'landslide',  label: 'انزلاق أرضي',        icon: '⛰', color: 'text-amber-400' },
          { key: 'subsidence', label: 'هبوط أرضي',          icon: '⬇', color: 'text-green-400' },
          { key: 'fire',       label: 'حرائق',              icon: '🔥', color: 'text-red-400' },
          { key: 'pollution',  label: 'تلوث بيئي',          icon: '☣', color: 'text-purple-400' },
          { key: 'seismic',    label: 'نشاط زلزالي',        icon: '〰', color: 'text-slate-300' },
        ] as const).map(({ key, label, icon, color }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer group">
            <div onClick={() => toggleRisk(key)}
              className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                riskTypes[key] ? 'bg-rose-600/70 border-rose-500' : 'bg-slate-800 border-slate-600'
              }`}>
              {riskTypes[key] && <CheckCircle2 size={9} className="text-white" />}
            </div>
            <span className="text-[11px]">{icon}</span>
            <span className={`text-[10px] ${color} select-none`}>{label}</span>
          </label>
        ))}
      </div>

      {/* Run */}
      <button onClick={handleRun} disabled={loading}
        className="w-full py-2 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-[11px] font-bold flex items-center justify-center gap-2 transition-colors">
        {loading ? <Loader2 size={13} className="animate-spin" /> : <ShieldAlert size={13} />}
        {loading ? 'جارٍ التقييم...' : 'تقييم المخاطر'}
      </button>

      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 px-3 py-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-rose-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-2">
          {/* Overall score */}
          <div className={`rounded-lg border p-2.5 ${LEVEL_STYLE[result.overall_risk_level]}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold">المخاطر الإجمالية</span>
              <div className="flex items-center gap-1">
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${LEVEL_BADGE[result.overall_risk_level]}`}>
                  {LEVEL_AR[result.overall_risk_level]}
                </span>
                <button onClick={handleToggleMap}
                  className="text-[9px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                  {showOnMap ? <Eye size={9} /> : <EyeOff size={9} />}
                </button>
                <button onClick={handleClear} className="text-slate-600 hover:text-slate-300 text-[10px]">✕</button>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="text-[28px] font-black leading-none">{result.overall_risk_score}</div>
              <div className="text-[9px] text-slate-400 space-y-0.5">
                <div>{result.area_km2} كم² محللة</div>
                <div>{Object.values(result.risk_summary).reduce((s, r) => s + r.zone_count, 0)} منطقة خطر مرصودة</div>
              </div>
            </div>
            <RiskScoreBar score={result.overall_risk_score} level={result.overall_risk_level} />
          </div>

          {/* Per-risk breakdown */}
          <div className="space-y-1.5">
            {Object.entries(result.risk_summary).map(([name, r]) => (
              <div key={name} className="rounded-lg border border-slate-700/50 bg-slate-800/30 overflow-hidden">
                <button
                  onClick={() => setExpandedRisk(p => p === name ? null : name)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-right hover:bg-slate-700/20 transition-colors"
                >
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${LEVEL_BADGE[r.level]}`}>
                    {LEVEL_AR[r.level]}
                  </span>
                  <span className="text-[10px] text-slate-200 font-medium flex-1">{name}</span>
                  <span className="text-[10px] font-bold text-slate-300 w-6 text-center">{r.score}</span>
                  {expandedRisk === name ? <ChevronUp size={10} className="text-slate-500" /> : <ChevronDown size={10} className="text-slate-500" />}
                </button>
                {expandedRisk === name && (
                  <div className="px-2.5 pb-2 space-y-1.5">
                    <RiskScoreBar score={r.score} level={r.level} />
                    <p className="text-[9px] text-slate-500">{r.description}</p>
                    <p className="text-[9px] text-slate-600">{r.zone_count} منطقة مرصودة</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Priority actions */}
          {result.priority_actions.length > 0 && (
            <div className="rounded-lg border border-orange-800/30 bg-orange-950/20 p-2.5 space-y-1">
              <p className="text-[10px] font-semibold text-orange-300">الإجراءات ذات الأولوية</p>
              {result.priority_actions.map((a, i) => (
                <p key={i} className="text-[9px] text-slate-400 leading-relaxed">{a}</p>
              ))}
            </div>
          )}

          {/* Notes */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-2.5 space-y-1">
            {result.analysis_notes.map((n, i) => (
              <p key={i} className="text-[9px] text-slate-500 leading-relaxed">{n}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
