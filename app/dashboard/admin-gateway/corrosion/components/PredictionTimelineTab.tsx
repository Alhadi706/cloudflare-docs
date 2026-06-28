'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ComposedChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Cell, Brush
} from 'recharts';
import {
  TrendingUp, RefreshCw, Download, CheckCircle,
  AlertTriangle, Zap, Clock, Activity, ChevronDown,
  ChevronUp, Loader2, GitBranch, Target, BarChart2,
  GitCompare, X, Globe, Thermometer, Droplets, Wind
} from 'lucide-react';
import { fetchNasaPowerData, type NasaEnvData } from '@/lib/nasa-power';
import {
  calcCEF, calcAnnualCEF, calcPeakCEF,
  pearsonCorrelation, interpretCorrelation,
  buildSurveyEnvRows, type SurveyEnvSummary,
  computeCefSensitivity,
} from '@/lib/corrosion-env-factor';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RealPoint {
  chainage: number;
  potential_mv: number;
  on_mv?: number;
}

interface PredictedPoint {
  chainage_distance: number;
  natural_potential_mv: number;
  confidence_score: number;
  is_critical: boolean;
  error_vs_real_mv?: number;
}

interface MatchedPoint {
  chainage: number;
  real_mv: number;
  pred_mv: number;
  error_mv: number; // real_mv − pred_mv  (negative = real is WORSE than predicted)
}

interface RealEntry {
  type: 'real';
  year: number;
  session_id: string;
  file_name: string;
  total_points: number;
  points: RealPoint[];
}

interface PredictedEntry {
  type: 'predicted';
  year: number;
  run_id: string;
  model_version: number;
  total_points: number;
  validated: boolean;
  mae_mv?: number;
  accuracy_pct?: number;
  correction_applied: boolean;
  points: PredictedPoint[];
}

type TimelineEntry = RealEntry | PredictedEntry;

interface TimelineSummary {
  real_sessions: number;
  predicted_sessions: number;
  validated_predictions: number;
  correction_buckets: number;
  avg_accuracy?: number;
}

interface TimelineData {
  pipeline_id: string;
  timeline: TimelineEntry[];
  summary: TimelineSummary;
  corrections?: Record<string, number>; // bucket → correction_mv learned from validations
}

interface Props {
  selectedPipeline: string | null;
  pipelines: { pipeline_id: string; display_name?: string }[];
  onSelectPipeline: (pid: string) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const YEAR_PALETTE = [
  '#06b6d4', '#f97316', '#22c55e', '#a855f7', '#ec4899',
  '#eab308', '#14b8a6', '#f43f5e', '#6366f1', '#84cc16',
  '#fb923c', '#38bdf8', '#4ade80', '#c084fc', '#f472b6',
];

const NACE_PROTECTED = -850;   // mV — NACE SP0169 full protection
const NACE_MARGINAL  = -700;   // mV — NACE marginal threshold

function getHeaders(contentType = false): Record<string, string> {
  const headers: Record<string, string> = {
    'x-staff-api-key': 'haoAJhwAboEQTsgXex1q4T-vQ7q3d6YOLjpNHqszA9A',
  };
  if (contentType) headers['Content-Type'] = 'application/json';
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function yearColor(entries: TimelineEntry[], year: number): string {
  const sortedYears = [...new Set(entries.map((e) => e.year))].sort();
  const idx = sortedYears.indexOf(year);
  return YEAR_PALETTE[idx % YEAR_PALETTE.length];
}

/** Binary search: first index i where sorted[i] >= target */
function bisectLeft(sorted: number[], target: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < target) lo = mid + 1; else hi = mid; }
  return lo;
}

function buildChartData(
  entries: TimelineEntry[],
  selectedYears: Set<number>
): Record<string, number | null>[] {
  const TOLERANCE = 5; // metres

  // Pre-build sorted index per year for O(log n) nearest-neighbour lookup
  type YearIndex = { chs: number[]; mvs: (number | null)[] };
  const yearIndex = new Map<number, YearIndex>();
  const allChainages = new Set<number>();

  for (const e of entries) {
    if (!selectedYears.has(e.year)) continue;
    const sorted = e.type === 'real'
      ? e.points
          .filter((p) => p.chainage != null && p.potential_mv != null)
          .map((p) => ({ chainage: p.chainage, mv: p.potential_mv }))
          .sort((a, b) => a.chainage - b.chainage)
      : e.points
          .filter((p) => p.chainage_distance != null && p.natural_potential_mv != null)
          .map((p) => ({ chainage: p.chainage_distance, mv: p.natural_potential_mv }))
          .sort((a, b) => a.chainage - b.chainage);
    yearIndex.set(e.year, {
      chs: sorted.map((p) => Math.round(p.chainage * 10) / 10),
      mvs: sorted.map((p) => p.mv),
    });
    for (const p of sorted) allChainages.add(Math.round(p.chainage * 10) / 10);
  }

  return Array.from(allChainages)
    .sort((a, b) => a - b)
    .map((ch) => {
      const row: Record<string, number | null> = { chainage: ch };
      for (const e of entries) {
        if (!selectedYears.has(e.year)) continue;
        const key = `y_${e.year}`;
        const idx = yearIndex.get(e.year);
        if (!idx) { row[key] = null; continue; }
        const { chs, mvs } = idx;
        const i = bisectLeft(chs, ch);
        let best: number | null = null, bestDist = TOLERANCE + 1;
        for (const j of [i - 1, i]) {
          if (j >= 0 && j < chs.length) {
            const d = Math.abs(chs[j] - ch);
            if (d <= TOLERANCE && d < bestDist) { bestDist = d; best = mvs[j]; }
          }
        }
        row[key] = best;
      }
      return row;
    });
}

/** Match real session points against predicted points (10 m tolerance). */
function buildMatchedComparison(realEntry: RealEntry, predEntry: PredictedEntry): MatchedPoint[] {
  const TOLERANCE = 10;
  const predSorted = [...predEntry.points].sort((a, b) => a.chainage_distance - b.chainage_distance);
  const predChs = predSorted.map((p) => p.chainage_distance);
  const result: MatchedPoint[] = [];
  for (const rp of realEntry.points) {
    const i = bisectLeft(predChs, rp.chainage);
    let best: PredictedPoint | null = null, bestDist = TOLERANCE + 1;
    for (const j of [i - 1, i]) {
      if (j >= 0 && j < predSorted.length) {
        const d = Math.abs(predSorted[j].chainage_distance - rp.chainage);
        if (d <= TOLERANCE && d < bestDist) { bestDist = d; best = predSorted[j]; }
      }
    }
    if (best) result.push({
      chainage: rp.chainage,
      real_mv: rp.potential_mv,
      pred_mv: best.natural_potential_mv,
      error_mv: rp.potential_mv - best.natural_potential_mv,
    });
  }
  return result.sort((a, b) => a.chainage - b.chainage);
}

/** Bucket matched points into 100 m segments for the error bar chart. */
function buildSegmentErrors(matched: MatchedPoint[]): { segment: number; avg_error: number; count: number }[] {
  const buckets: Record<number, { sum: number; count: number }> = {};
  for (const pt of matched) {
    const b = Math.round(pt.chainage / 100) * 100;
    if (!buckets[b]) buckets[b] = { sum: 0, count: 0 };
    buckets[b].sum += pt.error_mv;
    buckets[b].count++;
  }
  return Object.entries(buckets)
    .map(([k, v]) => ({ segment: Number(k), avg_error: Math.round(v.sum / v.count * 10) / 10, count: v.count }))
    .sort((a, b) => a.segment - b.segment);
}

// Custom active-dot for critical points (only shown on hover)
function CriticalActiveDot(props: {
  cx?: number; cy?: number; value?: number; fill?: string;
}) {
  const { cx, cy, value, fill } = props;
  if (cx == null || cy == null || value == null) return null;
  const isCritical = value > NACE_MARGINAL;
  return isCritical ? (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="#f97316" opacity={0.25} />
      <circle cx={cx} cy={cy} r={5} fill="#ef4444" strokeWidth={1.5} stroke="#fca5a5" />
    </g>
  ) : (
    <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#1e293b" strokeWidth={1.5} />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PredictionTimelineTab({ selectedPipeline, pipelines, onSelectPipeline }: Props) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [futureYears, setFutureYears] = useState(5);
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [validating, setValidating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandAccuracy, setExpandAccuracy] = useState(true);
  const [comparisonYear, setComparisonYear] = useState<number | null>(null);
  const [comparisonTab, setComparisonTab] = useState<'overlay' | 'error' | 'learning' | 'cef_impact'>('overlay');
  const [validatingLearning, setValidatingLearning] = useState(false);

  // ── NASA POWER state ──
  const [nasaEnvData,  setNasaEnvData]  = useState<NasaEnvData | null>(null);
  const [nasaLoading,  setNasaLoading]  = useState(false);
  const [nasaError,    setNasaError]    = useState<string | null>(null);
  const [nasaExpanded, setNasaExpanded] = useState(true);

  const fetchTimeline = useCallback(async (pid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/corrosion/cp-timeline/${encodeURIComponent(pid)}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TimelineData = await res.json();
      setData(json);
      // Select all real years + any predicted years by default
      const yrs = new Set(json.timeline.map((e) => e.year));
      setSelectedYears(yrs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطأ غير معروف');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPipeline) fetchTimeline(selectedPipeline);
  }, [selectedPipeline, fetchTimeline]);

  // Fetch NASA POWER — starts from earliest real survey year (e.g. 2003) when data loads
  const nasaStartYear = useMemo(() => {
    if (!data?.timeline.length) return new Date().getFullYear() - 5;
    return Math.min(...data.timeline.map((e) => e.year));
  }, [data]);

  useEffect(() => {
    if (!selectedPipeline) return;
    let cancelled = false;
    const load = async () => {
      setNasaLoading(true);
      setNasaError(null);
      try {
        const lat = 28.5;  // Libya centroid — replace with pipeline GPS when available
        const lng = 14.1;
        const currentYear = new Date().getFullYear();
        const result = await fetchNasaPowerData(lat, lng, nasaStartYear, currentYear);
        if (!cancelled) setNasaEnvData(result);
      } catch (e: unknown) {
        if (!cancelled) setNasaError(e instanceof Error ? e.message : 'فشل تحميل بيانات NASA');
      } finally {
        if (!cancelled) setNasaLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedPipeline, nasaStartYear]);

  const handleGenerate = async () => {
    if (!selectedPipeline) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/corrosion/cp-timeline-generate/${encodeURIComponent(selectedPipeline)}?future_years=${futureYears}`,
        {
          method: 'POST',
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTimeline(selectedPipeline);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل التوليد');
    } finally {
      setGenerating(false);
    }
  };

  const handleValidate = async (sessionId: string) => {
    if (!selectedPipeline) return;
    setValidating(sessionId);
    try {
      const res = await fetch(
        `/api/v1/corrosion/cp-timeline-validate/${encodeURIComponent(selectedPipeline)}/${sessionId}`,
        {
          method: 'POST',
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTimeline(selectedPipeline);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل التحقق');
    } finally {
      setValidating(null);
    }
  };

  const handleDownload = async (year: number) => {
    if (!selectedPipeline) return;
    setDownloading(year);
    try {
      const res = await fetch(
        `/api/v1/corrosion/cp-timeline-download/${encodeURIComponent(selectedPipeline)}/${year}`,
        {
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cp_predicted_${selectedPipeline}_${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل التنزيل');
    } finally {
      setDownloading(null);
    }
  };

  const toggleYear = (year: number) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const chartData = useMemo(() => {
    if (!data) return [];
    return buildChartData(data.timeline, selectedYears);
  }, [data, selectedYears]);

  const accuracyData = useMemo(() => {
    if (!data) return [];
    return data.timeline
      .filter((e): e is PredictedEntry => e.type === 'predicted' && e.validated && e.accuracy_pct != null)
      .sort((a, b) => a.year - b.year)
      .map((e) => ({ year: e.year, accuracy: Math.round(e.accuracy_pct!) }));
  }, [data]);

  // Combined year-by-year CEF × CP potential impact data
  const cefTimelineData = useMemo(() => {
    if (!nasaEnvData) return [];
    const allYears = [...new Set([
      ...nasaEnvData.annual.map((a) => a.year),
      ...(data?.timeline ?? []).map((e) => e.year),
    ])].sort((a, b) => a - b);

    return allYears.map((yr) => {
      const timeline = data?.timeline ?? [];
      const realEntry = timeline.find((e) => e.type === 'real'      && e.year === yr) as RealEntry | undefined;
      const predEntry = timeline.find((e) => e.type === 'predicted' && e.year === yr) as PredictedEntry | undefined;
      const realMean = realEntry?.points.length
        ? Math.round(realEntry.points.reduce((s, p) => s + p.potential_mv, 0) / realEntry.points.length)
        : null;
      const predMean = predEntry?.points.length
        ? Math.round(predEntry.points.reduce((s, p) => s + p.natural_potential_mv, 0) / predEntry.points.length)
        : null;
      const monthsForYear = nasaEnvData.monthly.filter((m) => m.year === yr);
      const cefResult     = monthsForYear.length ? calcAnnualCEF(monthsForYear) : null;
      const annualRec     = nasaEnvData.annual.find((a) => a.year === yr);
      // Degradation above NACE -850mV threshold (positive = under-protected)
      const realDeg   = realMean != null ? Math.max(0, realMean - NACE_PROTECTED) : null;
      const predDeg   = predMean != null ? Math.max(0, predMean - NACE_PROTECTED) : null;
      const cefAdjDeg = realDeg  != null && cefResult
        ? parseFloat((realDeg * cefResult.cef).toFixed(1)) : null;
      const cefBoost  = cefAdjDeg != null && realDeg != null
        ? parseFloat((cefAdjDeg - realDeg).toFixed(1)) : null;
      return {
        year:       yr,
        real_mean:  realMean,
        pred_mean:  predMean,
        cef:        cefResult ? parseFloat(cefResult.cef.toFixed(3)) : null,
        soil_wet:   annualRec ? parseFloat((annualRec.avg_soil_wet * 100).toFixed(1)) : null,
        precip:     annualRec?.total_precip_mm ?? null,
        temp:       annualRec?.avg_temp_c ?? null,
        real_deg:   realDeg,
        pred_deg:   predDeg,
        cef_adj_deg: cefAdjDeg,
        cef_boost:  cefBoost,
        has_real:   realEntry != null,
        has_pred:   predEntry != null,
      };
    });
  }, [nasaEnvData, data]);

  // ── CEF prediction-improvement analysis ──────────────────────────────────
  const cefImprovementData = useMemo(() => {
    if (!nasaEnvData || !data) return null;
    // Build annual CEF per year
    const cefByYear = new Map<number, number>();
    for (const ann of nasaEnvData.annual) {
      const months = nasaEnvData.monthly.filter((m) => m.year === ann.year);
      const cef = calcAnnualCEF(months);
      if (cef) cefByYear.set(ann.year, cef.cef);
    }
    if (cefByYear.size < 2) return null;
    const avgCef = [...cefByYear.values()].reduce((s, v) => s + v, 0) / cefByYear.size;
    const realEntries = data.timeline.filter((e): e is RealEntry => e.type === 'real');
    const predEntries = data.timeline.filter((e): e is PredictedEntry => e.type === 'predicted');
    // Match each real year to closest predicted year
    const pairs = realEntries.flatMap((re) => {
      const pe = predEntries.reduce<PredictedEntry | undefined>(
        (best, cur) => !best || Math.abs(cur.year - re.year) < Math.abs(best.year - re.year) ? cur : best,
        undefined,
      );
      if (!pe) return [];
      const matched = buildMatchedComparison(re, pe);
      if (matched.length < 5) return [];
      const meanError = matched.reduce((s, p) => s + p.error_mv, 0) / matched.length;
      return [{ realYear: re.year, predYear: pe.year, matched, meanError }];
    });
    if (!pairs.length) return null;
    const errorByYear = new Map(pairs.map((p) => [p.realYear, p.meanError]));
    const beta = computeCefSensitivity(errorByYear, cefByYear);
    const improvements = pairs.map(({ realYear, predYear, matched }) => {
      const cef_yr  = cefByYear.get(realYear) ?? avgCef;
      const cefDev  = cef_yr - avgCef;
      const adj_mv  = parseFloat((beta * cefDev).toFixed(1));
      const mae_before = matched.reduce((s, p) => s + Math.abs(p.error_mv), 0) / matched.length;
      const mae_after  = matched.reduce((s, p) => s + Math.abs(p.error_mv - adj_mv), 0) / matched.length;
      const pct        = mae_before > 0 ? parseFloat(((mae_before - mae_after) / mae_before * 100).toFixed(1)) : 0;
      return { realYear, predYear, cef: cef_yr, cefDev: parseFloat(cefDev.toFixed(3)), adj_mv, mae_before: parseFloat(mae_before.toFixed(1)), mae_after: parseFloat(mae_after.toFixed(1)), pct, matched };
    });
    const total_before = improvements.reduce((s, r) => s + r.mae_before, 0) / improvements.length;
    const total_after  = improvements.reduce((s, r) => s + r.mae_after,  0) / improvements.length;
    const total_pct    = total_before > 0 ? parseFloat(((total_before - total_after) / total_before * 100).toFixed(1)) : 0;
    return { beta: parseFloat(beta.toFixed(2)), avgCef: parseFloat(avgCef.toFixed(3)), improvements, total_mae_before: parseFloat(total_before.toFixed(1)), total_mae_after: parseFloat(total_after.toFixed(1)), total_pct };
  }, [nasaEnvData, data]);

  // ── No pipeline selected ──
  if (!selectedPipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
        <GitBranch className="w-12 h-12 opacity-30" />
        <p className="text-lg">اختر خطًا من القائمة لعرض خط الزمن التنبؤي</p>
        {pipelines.length > 0 && (
          <select
            className="mt-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm"
            onChange={(e) => onSelectPipeline(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>اختر خطًا...</option>
            {pipelines.map((p) => (
              <option key={p.pipeline_id} value={p.pipeline_id}>
                {p.display_name ?? p.pipeline_id}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  // ── Pipeline selector helper (persistent in header) ──
  const PipelineDropdown = (
    <select
      value={selectedPipeline ?? ''}
      onChange={(e) => onSelectPipeline(e.target.value)}
      className="bg-slate-900 border border-slate-600 text-cyan-300 rounded-lg px-3 py-1.5 text-sm font-mono max-w-xs"
    >
      {pipelines.map((p) => (
        <option key={p.pipeline_id} value={p.pipeline_id}>
          {p.display_name ?? p.pipeline_id}
        </option>
      ))}
    </select>
  );

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>جارٍ تحميل بيانات خط الزمن…</span>
      </div>
    );
  }

  const entries = data?.timeline ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6 pb-10" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            خط الزمن التنبؤي
          </h2>
          {PipelineDropdown}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Future years selector */}
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>سنوات مستقبلية:</span>
            <select
              value={futureYears}
              onChange={(e) => setFutureYears(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 w-16"
            >
              {[1,2,3,4,5,7,10].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            توليد التنبؤات
          </button>

          <button
            onClick={() => fetchTimeline(selectedPipeline)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Summary KPIs ────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'مسوحات حقيقية', value: summary.real_sessions, color: 'text-green-400', border: 'border-green-500/20' },
            { label: 'سنوات متنبأة', value: summary.predicted_sessions, color: 'text-cyan-400', border: 'border-cyan-500/20' },
            { label: 'تنبؤات مُحقَّقة', value: summary.validated_predictions, color: 'text-orange-400', border: 'border-orange-500/20' },
            { label: 'معاملات التصحيح', value: summary.correction_buckets, color: 'text-purple-400', border: 'border-purple-500/20' },
            { label: 'متوسط الدقة', value: summary.avg_accuracy != null ? `${Math.round(summary.avg_accuracy)}%` : '—', color: 'text-yellow-400', border: 'border-yellow-500/20' },
          ].map((kpi) => (
            <div key={kpi.label} className={`bg-slate-800/50 border ${kpi.border} rounded-xl p-3 text-center`}>
              <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Year Cards ──────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {entries
              .slice()
              .sort((a, b) => a.year - b.year)
              .map((entry) => {
                const color = yearColor(entries, entry.year);
                const isSelected = selectedYears.has(entry.year);
                const isReal = entry.type === 'real';
                const isValidated = !isReal && (entry as PredictedEntry).validated;

                return (
                  <div
                    key={`${entry.type}-${entry.year}`}
                    onClick={() => toggleYear(entry.year)}
                    style={{
                      borderColor: isSelected ? color : 'transparent',
                      boxShadow: isSelected ? `0 0 8px ${color}44` : 'none',
                    }}
                    className={`
                      relative cursor-pointer rounded-xl border-2 p-3 min-w-[130px] transition-all
                      ${isSelected ? 'bg-slate-800' : 'bg-slate-900/60 opacity-50'}
                      ${isReal ? '' : 'border-dashed'}
                    `}
                  >
                    {/* Year badge */}
                    <div className="text-2xl font-bold" style={{ color }}>{entry.year}</div>

                    {/* Type badge */}
                    <div className={`text-xs mt-1 px-1.5 py-0.5 rounded-full w-fit font-medium ${
                      isReal
                        ? 'bg-green-500/20 text-green-300'
                        : isValidated
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                    }`}>
                      {isReal ? 'حقيقي' : isValidated ? 'مُحقَّق' : 'متنبأ'}
                    </div>

                    {/* Points count */}
                    <div className="text-xs text-slate-400 mt-1">{entry.total_points} نقطة</div>

                    {/* Accuracy */}
                    {!isReal && (entry as PredictedEntry).accuracy_pct != null && (
                      <div className="text-xs font-semibold mt-1" style={{ color }}>
                        دقة: {Math.round((entry as PredictedEntry).accuracy_pct!)}%
                      </div>
                    )}

                    {/* Action buttons for predicted entries */}
                    {!isReal && (
                      <div className="flex gap-1 mt-2" onClick={(ev) => ev.stopPropagation()}>
                        <button
                          onClick={() => handleDownload(entry.year)}
                          disabled={downloading === entry.year}
                          title="تنزيل CSV"
                          className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all disabled:opacity-40"
                        >
                          {downloading === entry.year
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Download className="w-3 h-3" />}
                        </button>
                      </div>
                    )}

                    {/* Validate button: show on real entry if there's a matching prediction */}
                    {isReal && entries.some(
                      (e) => e.type === 'predicted' && e.year === entry.year && !(e as PredictedEntry).validated
                    ) && (
                      <div className="mt-2" onClick={(ev) => ev.stopPropagation()}>
                        <button
                          onClick={() => handleValidate((entry as RealEntry).session_id)}
                          disabled={validating === (entry as RealEntry).session_id}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 text-xs transition-all disabled:opacity-40"
                        >
                          {validating === (entry as RealEntry).session_id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <CheckCircle className="w-3 h-3" />}
                          تحقق
                        </button>
                      </div>
                    )}

                    {/* Compare button — bright green, prominent */}
                    {isReal && entries.some((e) => e.type === 'predicted') && (
                      <div className="mt-2" onClick={(ev) => ev.stopPropagation()}>
                        <button
                          onClick={() => {
                            setComparisonYear(comparisonYear === entry.year ? null : entry.year);
                            setComparisonTab('overlay');
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                            comparisonYear === entry.year
                              ? 'bg-emerald-500/40 border-emerald-400/70 text-emerald-100 shadow-[0_0_8px_#34d39955]'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-500/50 text-emerald-300 hover:text-emerald-100 hover:shadow-[0_0_6px_#34d39944]'
                          }`}
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          مقارنة
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Main Comparison Chart ────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
          {/* Chart title + filter controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              مقارنة قراءات الجهد عبر السنوات (mV)
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setSelectedYears(new Set(entries.map(e => e.year)))}
                className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-all"
              >الكل</button>
              <button
                onClick={() => setSelectedYears(new Set(entries.filter(e => e.type === 'real').map(e => e.year)))}
                className="px-2.5 py-1 rounded bg-green-900/30 hover:bg-green-900/50 text-green-300 border border-green-700/40 transition-all"
              >الحقيقية فقط</button>
              <button
                onClick={() => setSelectedYears(new Set(entries.filter(e => e.type === 'predicted').map(e => e.year)))}
                className="px-2.5 py-1 rounded bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-700/40 transition-all"
              >المتنبأة فقط</button>
              <button
                onClick={() => setSelectedYears(new Set())}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-all"
              >مسح</button>
            </div>
          </div>

          {/* External legend: colour swatches */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 px-1">
            {entries
              .slice()
              .sort((a, b) => a.year - b.year)
              .map((entry) => {
                const color = yearColor(entries, entry.year);
                const isReal = entry.type === 'real';
                const active = selectedYears.has(entry.year);
                return (
                  <button
                    key={`leg_${entry.type}_${entry.year}`}
                    onClick={() => toggleYear(entry.year)}
                    className={`flex items-center gap-1.5 text-xs transition-all ${active ? 'opacity-100' : 'opacity-30'}`}
                  >
                    <span className="inline-block w-6 h-0.5" style={{
                      background: isReal ? color : 'transparent',
                      borderTop: isReal ? 'none' : `2px dashed ${color}`,
                      verticalAlign: 'middle',
                    }} />
                    <span style={{ color }}>{entry.year}</span>
                    <span className="text-slate-500">{isReal ? '(حقيقي)' : '(متنبأ)'}</span>
                  </button>
                );
              })}
          </div>

          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              لا توجد نقاط للعرض — اختر سنوات من الأسطورة أعلاه
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={580}>
              <ComposedChart data={chartData} margin={{ top: 14, right: 80, bottom: 50, left: 64 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" strokeOpacity={0.6} />
                <XAxis
                  dataKey="chainage"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(2)}km`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickCount={12}
                  label={{ value: 'المسافة على الخط (كم)', position: 'insideBottom', offset: -32, fill: '#475569', fontSize: 12 }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `${v}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  width={56}
                  label={{ value: 'الجهد (mV)', angle: -90, position: 'insideLeft', offset: 16, fill: '#475569', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', fontSize: 12, direction: 'rtl' }}
                  labelFormatter={(v: number) => `📍 ${(v / 1000).toFixed(3)} km`}
                  formatter={(value: number, name: string) => {
                    const year = name.replace('y_', '');
                    const entry = entries.find(e => e.year === parseInt(year));
                    const label = `${year} ${entry?.type === 'real' ? '(حقيقي)' : '(متنبأ)'}`;
                    return [`${value} mV`, label];
                  }}
                />

                {/* NACE protection zone fills */}
                <ReferenceArea y1={0} y2={-700} fill="#ef4444" fillOpacity={0.07} ifOverflow="visible" />
                <ReferenceArea y1={-700} y2={-850} fill="#f97316" fillOpacity={0.07} />
                <ReferenceArea y1={-850} y2={-1300} fill="#22c55e" fillOpacity={0.05} />

                {/* NACE threshold lines */}
                <ReferenceLine
                  y={NACE_PROTECTED}
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  strokeOpacity={0.8}
                  label={{ value: '-850mV ✓ محمي', position: 'insideTopRight', fill: '#22c55e', fontSize: 10 }}
                />
                <ReferenceLine
                  y={NACE_MARGINAL}
                  stroke="#f97316"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  strokeOpacity={0.8}
                  label={{ value: '-700mV ⚠ هامشي', position: 'insideTopRight', fill: '#f97316', fontSize: 10 }}
                />

                {/* One Line per selected year — no static dots, critical dots on hover */}
                {entries
                  .filter((e) => selectedYears.has(e.year))
                  .sort((a, b) => a.year - b.year)
                  .map((entry) => {
                    const color = yearColor(entries, entry.year);
                    const isReal = entry.type === 'real';
                    return (
                      <Line
                        key={`y_${entry.year}`}
                        type="monotone"
                        dataKey={`y_${entry.year}`}
                        stroke={color}
                        strokeWidth={isReal ? 3 : 2}
                        strokeDasharray={isReal ? undefined : '8 4'}
                        strokeOpacity={isReal ? 1 : 0.85}
                        dot={(props: {cx?: number; cy?: number; value?: number}) => {
                          const { cx, cy, value } = props;
                          if (cx == null || cy == null || value == null || value <= NACE_MARGINAL) return <g />;
                          // Permanent red alert dot for critical/unprotected points
                          return (
                            <g key={`crit-${cx}-${cy}`}>
                              <circle cx={cx} cy={cy} r={6} fill="#ef4444" opacity={0.2} />
                              <circle cx={cx} cy={cy} r={3.5} fill="#ef4444" stroke="#fca5a5" strokeWidth={1} />
                            </g>
                          );
                        }}
                        activeDot={(props: {cx?: number; cy?: number; value?: number}) => (
                          <CriticalActiveDot {...props} fill={color} />
                        )}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    );
                  })}

                {/* Brush for zoom/pan along X-axis */}
                <Brush
                  dataKey="chainage"
                  height={24}
                  stroke="#334155"
                  fill="#0f172a"
                  travellerWidth={8}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Comparison Panel ─────────────────────────────────────────────── */}
      {comparisonYear != null && (() => {
        const realEntry = entries.find((e) => e.type === 'real' && e.year === comparisonYear) as RealEntry | undefined;
        // Find nearest predicted year to the real session year
        const predEntries = entries.filter((e) => e.type === 'predicted') as PredictedEntry[];
        const predEntry   = predEntries.reduce<PredictedEntry | undefined>((best, cur) =>
          !best || Math.abs(cur.year - comparisonYear) < Math.abs(best.year - comparisonYear) ? cur : best
        , undefined);
        if (!realEntry || !predEntry) return null;

        const matched    = buildMatchedComparison(realEntry, predEntry);
        const segErrors  = buildSegmentErrors(matched);
        const mae        = matched.length ? Math.abs(matched.reduce((s, p) => s + p.error_mv, 0) / matched.length) : 0;
        const rmse       = matched.length ? Math.sqrt(matched.reduce((s, p) => s + p.error_mv ** 2, 0) / matched.length) : 0;
        const corrFix    = data?.corrections ?? {};
        const corrKeys   = Object.keys(corrFix).map(Number).sort((a, b) => a - b);

        // Worst 5 error segments (most negative error = real WORSE than predicted)
        const worst5 = [...segErrors].sort((a, b) => a.avg_error - b.avg_error).slice(0, 5);

        return (
          <div className="bg-slate-800/40 border border-violet-500/30 rounded-2xl p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-violet-400" />
                <span className="text-base font-semibold text-slate-200">
                  مقارنة — واقعي {comparisonYear} vs متنبأ {predEntry.year}
                </span>
              </div>
              <button
                onClick={() => setComparisonYear(null)}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'نقاط متطابقة', value: matched.length.toLocaleString(), color: 'text-blue-400' },
                { label: 'MAE', value: `${mae.toFixed(1)} mV`, color: mae < 30 ? 'text-green-400' : mae < 60 ? 'text-yellow-400' : 'text-red-400' },
                { label: 'RMSE', value: `${rmse.toFixed(1)} mV`, color: rmse < 50 ? 'text-green-400' : rmse < 80 ? 'text-yellow-400' : 'text-red-400' },
                {
                  label: 'دقة التنبؤ',
                  value: predEntry.accuracy_pct != null ? `${Math.round(predEntry.accuracy_pct)}%` : '—',
                  color: predEntry.accuracy_pct == null ? 'text-slate-400' : predEntry.accuracy_pct >= 80 ? 'text-green-400' : predEntry.accuracy_pct >= 60 ? 'text-yellow-400' : 'text-red-400',
                },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-slate-900/50 rounded-xl p-3 text-center border border-slate-700/40">
                  <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-900/40 rounded-xl p-1 w-fit">
              {([
                { id: 'overlay',  label: 'تراكب المنحنيين' },
                { id: 'error',    label: 'الفرق بالقيم' },
                { id: 'learning',   label: 'التعلم الذاتي' },
                { id: 'cef_impact', label: '🌡️ تأثير CEF' },
              ] as { id: 'overlay' | 'error' | 'learning' | 'cef_impact'; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setComparisonTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    comparisonTab === t.id
                      ? 'bg-violet-500/30 text-violet-200 border border-violet-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Overlay chart ── */}
            {comparisonTab === 'overlay' && (
              <div>
                <p className="text-xs text-slate-400 mb-2">
                  الخط الصلب = واقعي&nbsp;·&nbsp;الخط المتقطع = متنبأ&nbsp;·&nbsp;نقاط حمراء = خارج نطاق الحماية NACE
                </p>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={matched} margin={{ top: 10, right: 60, bottom: 40, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" strokeOpacity={0.6} />
                    <XAxis
                      dataKey="chainage"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}km`}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      label={{ value: 'المسافة (كم)', position: 'insideBottom', offset: -28, fill: '#475569', fontSize: 12 }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => `${v}`}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      width={52}
                      label={{ value: 'الجهد (mV)', angle: -90, position: 'insideLeft', offset: 14, fill: '#475569', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #7c3aed', borderRadius: 8, fontSize: 12, direction: 'rtl' }}
                      labelFormatter={(v: number) => `📍 ${(v / 1000).toFixed(3)} km`}
                      formatter={(val: number, name: string) => [
                        `${val} mV`,
                        name === 'real_mv' ? '⚡ واقعي' : '🔮 متنبأ',
                      ]}
                    />
                    <ReferenceArea y1={0}    y2={-700}  fill="#ef4444" fillOpacity={0.07} />
                    <ReferenceArea y1={-700} y2={-850}  fill="#f97316" fillOpacity={0.07} />
                    <ReferenceArea y1={-850} y2={-1300} fill="#22c55e" fillOpacity={0.05} />
                    <ReferenceLine y={NACE_PROTECTED} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.7}
                      label={{ value: '-850mV', position: 'insideTopRight', fill: '#22c55e', fontSize: 10 }} />
                    <ReferenceLine y={NACE_MARGINAL} stroke="#f97316" strokeDasharray="6 4" strokeOpacity={0.7}
                      label={{ value: '-700mV', position: 'insideTopRight', fill: '#f97316', fontSize: 10 }} />
                    <Line type="monotone" dataKey="real_mv" stroke="#22c55e" strokeWidth={2.5}
                      dot={false} connectNulls isAnimationActive={false} />
                    <Line type="monotone" dataKey="pred_mv" stroke="#f97316" strokeWidth={2}
                      strokeDasharray="8 4" dot={false} connectNulls isAnimationActive={false} />
                    <Brush dataKey="chainage" height={20} stroke="#334155" fill="#0f172a" travellerWidth={7}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`} />
                  </ComposedChart>
                </ResponsiveContainer>
                {/* Colour legend */}
                <div className="flex items-center gap-6 mt-2 text-xs text-slate-400 justify-center">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5 h-0.5 bg-green-400" />
                    واقعي ({realEntry.year})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5" style={{ borderTop: '2px dashed #f97316' }} />
                    متنبأ ({predEntry.year})
                  </span>
                </div>
              </div>
            )}

            {/* ── Tab: Error bar chart ── */}
            {comparisonTab === 'error' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  الفرق = واقعي − متنبأ&nbsp;·&nbsp;
                  <span className="text-red-400">سالب = الواقع أسوأ من التنبؤ (خطر)</span>&nbsp;·&nbsp;
                  <span className="text-green-400">موجب = الواقع أفضل من التنبؤ (آمن)</span>
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={segErrors} margin={{ top: 8, right: 40, bottom: 40, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="segment"
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}km`}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: 'المسافة (كم)', position: 'insideBottom', offset: -28, fill: '#475569', fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      width={50}
                      label={{ value: 'فرق الجهد (mV)', angle: -90, position: 'insideLeft', offset: 12, fill: '#475569', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12, direction: 'rtl' }}
                      formatter={(v: number) => [`${v} mV`, 'متوسط الفرق']}
                      labelFormatter={(v: number) => `منطقة ${(v / 1000).toFixed(2)} km`}
                    />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                    <Bar dataKey="avg_error" radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                      {segErrors.map((row, i) => (
                        <Cell key={i} fill={row.avg_error < -50 ? '#dc2626' : row.avg_error < 0 ? '#f97316' : '#22c55e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Worst 5 segments table */}
                {worst5.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      أكثر 5 مناطق انحرافاً عن التنبؤ
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-slate-300">
                        <thead>
                          <tr className="border-b border-slate-700/50 text-slate-400">
                            <th className="py-1.5 pr-2 text-right">المسافة</th>
                            <th className="py-1.5 text-center">متوسط الفرق</th>
                            <th className="py-1.5 text-center">عدد النقاط</th>
                            <th className="py-1.5 text-center">التقييم</th>
                          </tr>
                        </thead>
                        <tbody>
                          {worst5.map((row) => (
                            <tr key={row.segment} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                              <td className="py-1.5 pr-2 font-mono">{(row.segment / 1000).toFixed(2)} km</td>
                              <td className={`py-1.5 text-center font-mono font-semibold ${row.avg_error < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {row.avg_error > 0 ? '+' : ''}{row.avg_error} mV
                              </td>
                              <td className="py-1.5 text-center text-slate-400">{row.count}</td>
                              <td className="py-1.5 text-center">
                                {row.avg_error < -50
                                  ? <span className="text-red-400">⚠ خطر — تآكل متسارع</span>
                                  : row.avg_error < 0
                                  ? <span className="text-orange-400">تحذير — تدهور محتمل</span>
                                  : <span className="text-green-400">✓ ضمن التوقعات</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Self-learning ── */}
            {comparisonTab === 'learning' && (
              <div className="space-y-4">
                {corrKeys.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                    <Zap className="w-10 h-10 text-yellow-400/40" />
                    <div>
                      <p className="text-slate-300 text-sm font-medium mb-1">النظام لم يتعلم بعد من هذه البيانات</p>
                      <p className="text-slate-500 text-xs">
                        اضغط الزر أدناه لمقارنة بيانات {realEntry.year} الواقعية<br/>مع تنبؤ سنة {predEntry.year} وتفعيل التعلم الذاتي
                      </p>
                    </div>
                    <button
                      disabled={validatingLearning}
                      onClick={async () => {
                        if (!selectedPipeline) return;
                        setValidatingLearning(true);
                        try {
                          const res = await fetch(
                            `/api/v1/corrosion/cp-timeline-validate/${encodeURIComponent(selectedPipeline)}/${realEntry.session_id}?run_id=${predEntry.run_id}`,
                            {
                              method: 'POST',
                              headers: getHeaders(),
                            }
                          );
                          if (!res.ok) throw new Error(`HTTP ${res.status}`);
                          await fetchTimeline(selectedPipeline);
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setValidatingLearning(false);
                        }
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/40 text-yellow-200 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:shadow-[0_0_12px_#facc1544]"
                    >
                      {validatingLearning
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التعلم…</>
                        : <><Zap className="w-4 h-4" /> تفعيل التعلم الذاتي</>}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-400">
                      عوامل التصحيح التي تعلّمها النظام من مقارنة البيانات الواقعية مع التنبؤات السابقة.
                      تُضاف لتحسين التنبؤات المستقبلية تلقائياً.
                    </p>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={corrKeys.map((k) => ({ segment: k, correction: Math.round(corrFix[k] * 10) / 10 }))}
                        margin={{ top: 8, right: 40, bottom: 40, left: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" strokeOpacity={0.5} />
                        <XAxis
                          dataKey="segment"
                          tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}km`}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          label={{ value: 'المسافة (كم)', position: 'insideBottom', offset: -28, fill: '#475569', fontSize: 12 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          width={50}
                          label={{ value: 'التصحيح (mV)', angle: -90, position: 'insideLeft', offset: 12, fill: '#475569', fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12, direction: 'rtl' }}
                          formatter={(v: number) => [`${v} mV`, 'عامل التصحيح']}
                          labelFormatter={(v: number) => `منطقة ${(v / 1000).toFixed(2)} km`}
                        />
                        <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                        <Bar dataKey="correction" radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                          {corrKeys.map((k, i) => (
                            <Cell key={i} fill={corrFix[k] < 0 ? '#22c55e' : '#f97316'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Before / After comparison chart */}
                    {matched.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-violet-400" />
                          قبل وبعد التصحيح مقارنةً بالواقعي
                        </p>
                        <ResponsiveContainer width="100%" height={280}>
                          <ComposedChart
                            data={matched.map((pt) => {
                              const bucket = Math.round(pt.chainage / 100) * 100;
                              const corr = corrFix[bucket] ?? 0;
                              return { ...pt, corrected_mv: Math.round((pt.pred_mv + corr) * 10) / 10 };
                            })}
                            margin={{ top: 10, right: 60, bottom: 40, left: 60 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" strokeOpacity={0.5} />
                            <XAxis
                              dataKey="chainage"
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}km`}
                              tick={{ fontSize: 10, fill: '#64748b' }}
                              label={{ value: 'المسافة (كم)', position: 'insideBottom', offset: -28, fill: '#475569', fontSize: 12 }}
                            />
                            <YAxis
                              domain={['auto', 'auto']}
                              tick={{ fontSize: 10, fill: '#64748b' }}
                              width={50}
                              label={{ value: 'الجهد (mV)', angle: -90, position: 'insideLeft', offset: 14, fill: '#475569', fontSize: 12 }}
                            />
                            <Tooltip
                              contentStyle={{ background: '#0f172a', border: '1px solid #7c3aed', borderRadius: 8, fontSize: 12, direction: 'rtl' }}
                              labelFormatter={(v: number) => `📍 ${(v / 1000).toFixed(3)} km`}
                              formatter={(val: number, name: string) => [
                                `${val} mV`,
                                name === 'real_mv' ? '⚡ واقعي' : name === 'pred_mv' ? '🔮 قبل التصحيح' : '✅ بعد التصحيح',
                              ]}
                            />
                            <Line type="monotone" dataKey="real_mv" stroke="#22c55e" strokeWidth={2.5}
                              dot={false} connectNulls isAnimationActive={false} name="real_mv" />
                            <Line type="monotone" dataKey="pred_mv" stroke="#94a3b8" strokeWidth={1.5}
                              strokeDasharray="8 4" dot={false} connectNulls isAnimationActive={false} name="pred_mv" />
                            <Line type="monotone" dataKey="corrected_mv" stroke="#a78bfa" strokeWidth={2}
                              strokeDasharray="4 2" dot={false} connectNulls isAnimationActive={false} name="corrected_mv" />
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div className="flex items-center gap-6 mt-2 text-xs text-slate-400 justify-center">
                          <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-green-400" />واقعي</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-5" style={{ borderTop: '2px dashed #94a3b8' }} />قبل التصحيح</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-5" style={{ borderTop: '2px dashed #a78bfa' }} />بعد التصحيح</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Tab: CEF Impact (before vs after) ── */}
            {comparisonTab === 'cef_impact' && (() => {
              if (!nasaEnvData || !cefImprovementData) {
                return (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                    <p className="text-slate-400 text-sm">
                      {!nasaEnvData ? '⏳ جارٍ تحميل بيانات NASA POWER...' : 'لا توجد بيانات مقارنة كافية لحساب تأثير CEF'}
                    </p>
                  </div>
                );
              }
              const yearData = cefImprovementData.improvements.find((r) => r.realYear === comparisonYear);
              if (!yearData) {
                return (
                  <div className="space-y-4">
                    {/* Overall summary when no specific year is selected */}
                    <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-xl text-xs space-y-1">
                      <p className="text-blue-200 font-semibold">كيف يعمل تعديل CEF؟</p>
                      <p className="text-slate-400">يُطبَّق معامل البيئة CEF على تصحيح التنبؤات عبر: تنبؤ_معدَّل = تنبؤ_خام + β × (CEF_السنة − متوسط_CEF)</p>
                      <p className="text-slate-300">β = <span className="font-mono text-yellow-300">{cefImprovementData.beta}</span> mV/وحدة_CEF &nbsp;·&nbsp; متوسط CEF = <span className="font-mono">{cefImprovementData.avgCef}</span></p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-900/50 rounded-xl p-3 text-center border border-red-500/30">
                        <div className="text-2xl font-bold text-red-400">{cefImprovementData.total_mae_before} mV</div>
                        <div className="text-xs text-slate-400 mt-1">متوسط MAE قبل CEF</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-xl p-3 text-center border border-green-500/30">
                        <div className="text-2xl font-bold text-green-400">{cefImprovementData.total_mae_after} mV</div>
                        <div className="text-xs text-slate-400 mt-1">متوسط MAE بعد CEF</div>
                      </div>
                      <div className={`bg-slate-900/50 rounded-xl p-3 text-center border ${
                        cefImprovementData.total_pct > 0 ? 'border-emerald-500/30' : 'border-orange-500/30'
                      }`}>
                        <div className={`text-2xl font-bold ${
                          cefImprovementData.total_pct > 0 ? 'text-emerald-400' : 'text-orange-400'
                        }`}>
                          {cefImprovementData.total_pct > 0 ? '+' : ''}{cefImprovementData.total_pct}%
                        </div>
                        <div className="text-xs text-slate-400 mt-1">نسبة التحسن الإجمالية</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">اختر سنة مسح للاطلاع على المقارنة التفصيلية بالرسم البياني.</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-700">
                          <th className="text-right py-1 pr-2">السنة</th>
                          <th className="text-center py-1">CEF</th>
                          <th className="text-center py-1">تعديل (mV)</th>
                          <th className="text-center py-1">MAE قبل</th>
                          <th className="text-center py-1">MAE بعد</th>
                          <th className="text-center py-1">تحسن %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cefImprovementData.improvements.map((r) => (
                          <tr key={r.realYear} className="border-b border-slate-800">
                            <td className="py-1.5 pr-2 text-slate-300">{r.realYear}</td>
                            <td className="py-1.5 text-center font-mono text-slate-300">{r.cef.toFixed(3)}</td>
                            <td className={`py-1.5 text-center font-mono ${
                              r.adj_mv > 0 ? 'text-orange-400' : r.adj_mv < 0 ? 'text-cyan-400' : 'text-slate-400'
                            }`}>{r.adj_mv > 0 ? '+' : ''}{r.adj_mv}</td>
                            <td className="py-1.5 text-center text-red-400">{r.mae_before}</td>
                            <td className="py-1.5 text-center text-green-400">{r.mae_after}</td>
                            <td className={`py-1.5 text-center font-semibold ${
                              r.pct > 0 ? 'text-emerald-400' : 'text-orange-400'
                            }`}>{r.pct > 0 ? '+' : ''}{r.pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
              // Year-specific view
              const adjustedMatched = yearData.matched.map((p) => ({
                ...p,
                adj_pred_mv: Math.round(p.pred_mv + yearData.adj_mv),
              }));
              return (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-xl text-xs space-y-1">
                    <p className="text-blue-200 font-semibold">تعديل CEF لسنة {yearData.realYear}</p>
                    <p className="text-slate-400">
                      تنبؤ_معدَّل = تنبؤ_خام + β × (CEF_السنة − متوسط_CEF)
                      &nbsp;=&nbsp; خام + <span className="font-mono text-yellow-300">{cefImprovementData.beta}</span>
                      &nbsp;×&nbsp; ({yearData.cef.toFixed(3)} − {cefImprovementData.avgCef})
                      &nbsp;=&nbsp; خام <span className="font-mono text-blue-300">{yearData.adj_mv >= 0 ? '+' : ''}{yearData.adj_mv} mV</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/50 rounded-xl p-3 text-center border border-red-500/30">
                      <div className="text-2xl font-bold text-red-400">{yearData.mae_before} mV</div>
                      <div className="text-xs text-slate-400 mt-1">MAE قبل CEF</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-xl p-3 text-center border border-green-500/30">
                      <div className="text-2xl font-bold text-green-400">{yearData.mae_after} mV</div>
                      <div className="text-xs text-slate-400 mt-1">MAE بعد CEF</div>
                    </div>
                    <div className={`bg-slate-900/50 rounded-xl p-3 text-center border ${
                      yearData.pct > 0 ? 'border-emerald-500/30' : 'border-orange-500/30'
                    }`}>
                      <div className={`text-2xl font-bold ${
                        yearData.pct > 0 ? 'text-emerald-400' : 'text-orange-400'
                      }`}>
                        {yearData.pct > 0 ? '+' : ''}{yearData.pct}%
                      </div>
                      <div className="text-xs text-slate-400 mt-1">نسبة التحسن</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    الخط الأخضر = واقعي &nbsp;·&nbsp; الرمادي المتقطع = تنبؤ خام &nbsp;·&nbsp; البرتقالي المتقطع = تنبؤ بعد CEF
                  </p>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={adjustedMatched} margin={{ top: 10, right: 60, bottom: 40, left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="chainage" type="number" domain={['dataMin', 'dataMax']}
                        tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}km`}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        label={{ value: 'المسافة (كم)', position: 'insideBottom', offset: -28, fill: '#475569', fontSize: 12 }}
                      />
                      <YAxis
                        domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} width={50}
                        label={{ value: 'الجهد (mV)', angle: -90, position: 'insideLeft', offset: 14, fill: '#475569', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #f97316', borderRadius: 8, fontSize: 12, direction: 'rtl' }}
                        labelFormatter={(v: number) => `📍 ${(v / 1000).toFixed(3)} km`}
                        formatter={(val: number, name: string) => [
                          `${val} mV`,
                          name === 'real_mv' ? '⚡ واقعي' : name === 'pred_mv' ? '🔮 تنبؤ خام' : '🌡️ بعد تعديل CEF',
                        ]}
                      />
                      <Line type="monotone" dataKey="real_mv" stroke="#22c55e" strokeWidth={2.5}
                        dot={false} connectNulls isAnimationActive={false} name="real_mv" />
                      <Line type="monotone" dataKey="pred_mv" stroke="#94a3b8" strokeWidth={1.5}
                        strokeDasharray="8 4" dot={false} connectNulls isAnimationActive={false} name="pred_mv" />
                      <Line type="monotone" dataKey="adj_pred_mv" stroke="#f97316" strokeWidth={2}
                        strokeDasharray="4 2" dot={false} connectNulls isAnimationActive={false} name="adj_pred_mv" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-6 mt-1 text-xs text-slate-400 justify-center">
                    <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-green-400" />واقعي</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-5" style={{ borderTop: '2px dashed #94a3b8' }} />تنبؤ خام</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-5" style={{ borderTop: '2px dashed #f97316' }} />بعد تعديل CEF</span>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ── Accuracy Evolution Chart ─────────────────────────────────────── */}
      {accuracyData.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
          <button
            className="flex items-center gap-2 w-full text-base font-semibold text-slate-200 mb-1"
            onClick={() => setExpandAccuracy((v) => !v)}
          >
            <BarChart2 className="w-4 h-4 text-orange-400" />
            تطور دقة التنبؤ (التعلم الذاتي)
            {expandAccuracy ? <ChevronUp className="w-4 h-4 mr-auto text-slate-500" /> : <ChevronDown className="w-4 h-4 mr-auto text-slate-500" />}
          </button>

          {expandAccuracy && (
            <>
              <p className="text-xs text-slate-400 mb-4">
                كلما أُضيف مسح حقيقي جديد وجرى التحقق منه، يتحسن النموذج ويُصحح التنبؤات المستقبلية تلقائيًا.
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={accuracyData} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.5} />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, 'دقة التنبؤ']}
                  />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {accuracyData.map((row, i) => (
                      <Cell key={i} fill={row.accuracy >= 80 ? '#22c55e' : row.accuracy >= 60 ? '#eab308' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      {/* ── NASA POWER Environmental Data ─────────────────────────────── */}
      {selectedPipeline && (() => {
        const realYears = entries.filter((e) => e.type === 'real').map((e) => e.year);
        const surveyRows: SurveyEnvSummary[] = nasaEnvData
          ? buildSurveyEnvRows(realYears.length ? realYears : entries.map((e) => e.year), nasaEnvData.monthly)
          : [];

        // Pearson correlation: CP mean potential per year vs annual soil wetness
        const cpMeans = realYears.map((yr) => {
          const entry = entries.find((e) => e.type === 'real' && e.year === yr) as RealEntry | undefined;
          if (!entry) return null;
          const pts = entry.points.filter((p) => p.potential_mv != null);
          return pts.length ? pts.reduce((s, p) => s + p.potential_mv, 0) / pts.length : null;
        }).filter((v): v is number => v !== null);

        const soilWets = realYears.map((yr) =>
          nasaEnvData?.annual.find((a) => a.year === yr)?.avg_soil_wet ?? null
        ).filter((v): v is number => v !== null);

        const corr    = pearsonCorrelation(soilWets, cpMeans);
        const corrText = interpretCorrelation(corr);

        const annualCEF = nasaEnvData
          ? calcAnnualCEF(nasaEnvData.monthly)
          : null;
        const peakCEF = nasaEnvData
          ? calcPeakCEF(nasaEnvData.monthly)
          : null;

        return (
          <div className="bg-slate-800/40 border border-blue-500/25 rounded-2xl p-5 space-y-4">
            {/* Section header */}
            <button
              className="flex items-center gap-2 w-full text-base font-semibold text-slate-200"
              onClick={() => setNasaExpanded((v) => !v)}
            >
              <Globe className="w-4 h-4 text-blue-400" />
              📡 البيانات البيئية — NASA POWER
              <span className="text-xs font-normal text-slate-500 mr-1">({nasaEnvData ? `${nasaEnvData.startDate.slice(0,4)}–${nasaEnvData.endDate.slice(0,4)}` : 'تحميل…'})</span>
              {nasaExpanded
                ? <ChevronUp className="w-4 h-4 mr-auto text-slate-500" />
                : <ChevronDown className="w-4 h-4 mr-auto text-slate-500" />}
            </button>

            {nasaExpanded && (
              <>
                {/* Loading / error states */}
                {nasaLoading && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    جارٍ تحميل البيانات المناخية من NASA POWER…
                  </div>
                )}
                {nasaError && (
                  <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {nasaError}
                  </div>
                )}

                {nasaEnvData && (
                  <>
                    {/* ── Summary KPI cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Avg annual precipitation */}
                      {(() => {
                        const avgPrecip = nasaEnvData.annual.length
                          ? parseFloat((nasaEnvData.annual.reduce((s, a) => s + a.total_precip_mm, 0) / nasaEnvData.annual.length).toFixed(1))
                          : 0;
                        return (
                          <div className="bg-slate-900/50 border border-blue-500/20 rounded-xl p-3 text-center">
                            <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                            <div className="text-xl font-bold text-blue-300">{avgPrecip}</div>
                            <div className="text-xs text-slate-400">متوسط الأمطار (مم/سنة)</div>
                          </div>
                        );
                      })()}

                      {/* Avg soil wetness */}
                      {(() => {
                        const avgSoil = nasaEnvData.annual.length
                          ? parseFloat((nasaEnvData.annual.reduce((s, a) => s + a.avg_soil_wet, 0) / nasaEnvData.annual.length).toFixed(3))
                          : 0;
                        return (
                          <div className="bg-slate-900/50 border border-emerald-500/20 rounded-xl p-3 text-center">
                            <Wind className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                            <div className="text-xl font-bold text-emerald-300">{(avgSoil * 100).toFixed(1)}%</div>
                            <div className="text-xs text-slate-400">متوسط رطوبة التربة</div>
                          </div>
                        );
                      })()}

                      {/* Avg temperature */}
                      {(() => {
                        const avgTemp = nasaEnvData.annual.length
                          ? parseFloat((nasaEnvData.annual.reduce((s, a) => s + a.avg_temp_c, 0) / nasaEnvData.annual.length).toFixed(1))
                          : 0;
                        return (
                          <div className="bg-slate-900/50 border border-orange-500/20 rounded-xl p-3 text-center">
                            <Thermometer className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                            <div className="text-xl font-bold text-orange-300">{avgTemp}°C</div>
                            <div className="text-xs text-slate-400">متوسط درجة الحرارة</div>
                          </div>
                        );
                      })()}

                      {/* Annual CEF */}
                      {annualCEF && (
                        <div className={`bg-slate-900/50 rounded-xl p-3 text-center border ${
                          annualCEF.risk_level === 'severe'   ? 'border-red-500/30' :
                          annualCEF.risk_level === 'high'     ? 'border-orange-500/30' :
                          annualCEF.risk_level === 'moderate' ? 'border-yellow-500/30' :
                          'border-green-500/20'
                        }`}>
                          <Activity className="w-4 h-4 mx-auto mb-1 " style={{ color:
                            annualCEF.risk_level === 'severe'   ? '#f87171' :
                            annualCEF.risk_level === 'high'     ? '#fb923c' :
                            annualCEF.risk_level === 'moderate' ? '#facc15' : '#4ade80'
                          }} />
                          <div className="text-xl font-bold" style={{ color:
                            annualCEF.risk_level === 'severe'   ? '#f87171' :
                            annualCEF.risk_level === 'high'     ? '#fb923c' :
                            annualCEF.risk_level === 'moderate' ? '#facc15' : '#4ade80'
                          }}>{annualCEF.cef.toFixed(3)}</div>
                          <div className="text-xs text-slate-400">CEF — عامل التآكل البيئي</div>
                          <div className="text-xs mt-0.5 font-medium" style={{ color:
                            annualCEF.risk_level === 'severe'   ? '#f87171' :
                            annualCEF.risk_level === 'high'     ? '#fb923c' :
                            annualCEF.risk_level === 'moderate' ? '#facc15' : '#4ade80'
                          }}>{annualCEF.risk_label_ar}</div>
                        </div>
                      )}
                    </div>

                    {/* ── CEF × CP Impact Timeline chart ── */}
                    {cefTimelineData.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-200 mb-1 flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-orange-400" />
                          تأثير البيئة على جهد CP — من {cefTimelineData[0]?.year} إلى {cefTimelineData[cefTimelineData.length - 1]?.year}
                        </p>
                        <p className="text-xs text-slate-500 mb-3">
                          الأعمدة الملونة = CEF (محور أيمن) · الخط الأخضر = جهد حقيقي · الخط المتقطع = جهد متنبأ —
                          كلما ارتفع CEF ↑ تسارع التآكل → تدهور الجهد نحو الصفر
                        </p>
                        <ResponsiveContainer width="100%" height={280}>
                          <ComposedChart data={cefTimelineData} margin={{ top: 10, right: 60, bottom: 20, left: 64 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" strokeOpacity={0.5} />
                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <YAxis
                              yAxisId="cp"
                              domain={['auto', 'auto']}
                              tickFormatter={(v: number) => `${v}mV`}
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              width={58}
                              label={{ value: 'الجهد (mV)', angle: -90, position: 'insideLeft', offset: 16, fill: '#475569', fontSize: 11 }}
                            />
                            <YAxis
                              yAxisId="cef"
                              orientation="right"
                              domain={[0.8, 2.2]}
                              tickFormatter={(v: number) => v.toFixed(1)}
                              tick={{ fontSize: 10, fill: '#fb923c' }}
                              width={38}
                              label={{ value: 'CEF', angle: 90, position: 'insideRight', offset: 10, fill: '#fb923c', fontSize: 11 }}
                            />
                            <Tooltip
                              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12, direction: 'rtl' }}
                              formatter={(val: number, name: string) => {
                                if (name === 'cef')        return [val.toFixed(3), 'عامل التآكل CEF'];
                                if (name === 'real_mean')  return [`${val} mV`, 'متوسط جهد حقيقي'];
                                if (name === 'pred_mean')  return [`${val} mV`, 'متوسط جهد متنبأ'];
                                return [`${val}`, name];
                              }}
                            />
                            {/* NACE thresholds */}
                            <ReferenceLine yAxisId="cp" y={NACE_PROTECTED} stroke="#22c55e" strokeDasharray="6 3"
                              strokeOpacity={0.7}
                              label={{ value: '-850 mV ✓', position: 'insideTopRight', fill: '#22c55e', fontSize: 9 }} />
                            <ReferenceLine yAxisId="cp" y={NACE_MARGINAL} stroke="#f97316" strokeDasharray="6 3"
                              strokeOpacity={0.7}
                              label={{ value: '-700 mV ⚠', position: 'insideTopRight', fill: '#f97316', fontSize: 9 }} />
                            <ReferenceLine yAxisId="cef" y={1.0} stroke="#475569" strokeDasharray="4 2"
                              strokeOpacity={0.6}
                              label={{ value: 'CEF=1.0', position: 'insideTopLeft', fill: '#64748b', fontSize: 9 }} />
                            {/* CEF bars */}
                            <Bar yAxisId="cef" dataKey="cef" radius={[3, 3, 0, 0]} maxBarSize={52} isAnimationActive={false} opacity={0.75}>
                              {cefTimelineData.map((row, i) => (
                                <Cell key={i} fill={
                                  !row.cef           ? '#1e293b' :
                                  row.cef >= 1.70    ? '#ef4444' :
                                  row.cef >= 1.40    ? '#f97316' :
                                  row.cef >= 1.10    ? '#eab308' : '#22c55e'
                                } />
                              ))}
                            </Bar>
                            {/* Real CP mean line */}
                            <Line
                              yAxisId="cp" type="monotone" dataKey="real_mean"
                              stroke="#22c55e" strokeWidth={2.5} connectNulls isAnimationActive={false}
                              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                                const { cx, cy, index } = props;
                                if (cx == null || cy == null) return <g key={index} />;
                                return <circle key={`r${index}`} cx={cx} cy={cy} r={5} fill="#22c55e" stroke="#0f172a" strokeWidth={1.5} />;
                              }}
                            />
                            {/* Predicted CP mean line */}
                            <Line
                              yAxisId="cp" type="monotone" dataKey="pred_mean"
                              stroke="#22d3ee" strokeWidth={2} strokeDasharray="8 4"
                              connectNulls isAnimationActive={false}
                              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                                const { cx, cy, index } = props;
                                if (cx == null || cy == null) return <g key={index} />;
                                return <circle key={`p${index}`} cx={cx} cy={cy} r={4} fill="#22d3ee" stroke="#0f172a" strokeWidth={1.5} />;
                              }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div className="flex items-center gap-5 mt-1.5 text-xs text-slate-400 justify-center flex-wrap">
                          <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-green-400" />جهد حقيقي (mV)</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-5" style={{ borderTop: '2px dashed #22d3ee' }} />جهد متنبأ (mV)</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-3 rounded-sm" style={{ background: '#f97316bb' }} />CEF مرتفع (تآكل متسارع)</span>
                          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-3 rounded-sm" style={{ background: '#22c55ebb' }} />CEF منخفض (ضمن السيطرة)</span>
                        </div>
                      </div>
                    )}

                    {/* ── Degradation amplification table ── */}
                    {cefTimelineData.some((r) => r.real_mean != null || r.pred_mean != null) && (
                      <div>
                        <p className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                          <BarChart2 className="w-3.5 h-3.5 text-orange-400" />
                          تأثير CEF على شدة التآكل — سنة بسنة
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-slate-300 min-w-[760px]">
                            <thead>
                              <tr className="border-b border-slate-700/50 text-slate-400 text-right">
                                <th className="py-1.5 pr-2">السنة</th>
                                <th className="py-1.5 text-center">نوع</th>
                                <th className="py-1.5 text-center">متوسط CP (mV)</th>
                                <th className="py-1.5 text-center">تدهور أساسي (mV↑)</th>
                                <th className="py-1.5 text-center">CEF</th>
                                <th className="py-1.5 text-center">تدهور معزّز بالبيئة</th>
                                <th className="py-1.5 text-center">زيادة بسبب CEF</th>
                                <th className="py-1.5 text-center">حماية NACE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cefTimelineData
                                .filter((r) => r.real_mean != null || r.pred_mean != null)
                                .map((row) => {
                                  const mean = row.real_mean ?? row.pred_mean;
                                  const deg  = row.real_deg  ?? row.pred_deg;
                                  return (
                                    <tr key={row.year} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                                      <td className="py-1.5 pr-2 font-mono font-semibold text-cyan-300">{row.year}</td>
                                      <td className="py-1.5 text-center">
                                        <span className={`px-1.5 py-0.5 rounded-full ${
                                          row.has_real ? 'bg-green-500/20 text-green-300' : 'bg-cyan-500/20 text-cyan-300'
                                        }`}>{row.has_real ? 'حقيقي' : 'متنبأ'}</span>
                                      </td>
                                      <td className={`py-1.5 text-center font-mono font-semibold ${
                                        mean != null && mean > NACE_MARGINAL  ? 'text-red-400' :
                                        mean != null && mean > NACE_PROTECTED ? 'text-yellow-400' : 'text-green-400'
                                      }`}>{mean ?? '—'} mV</td>
                                      <td className={`py-1.5 text-center font-mono ${
                                        deg && deg > 0 ? 'text-orange-400' : 'text-green-400'
                                      }`}>{deg != null ? (deg > 0 ? `+${deg}` : '✓ 0') : '—'}</td>
                                      <td className="py-1.5 text-center font-mono font-bold" style={{ color:
                                        !row.cef           ? '#475569' :
                                        row.cef >= 1.70    ? '#f87171' :
                                        row.cef >= 1.40    ? '#fb923c' :
                                        row.cef >= 1.10    ? '#facc15' : '#4ade80'
                                      }}>{row.cef?.toFixed(3) ?? '—'}</td>
                                      <td className={`py-1.5 text-center font-mono font-bold ${
                                        row.cef_adj_deg && row.cef_adj_deg > 0 ? 'text-red-400' : 'text-green-400'
                                      }`}>
                                        {row.cef_adj_deg != null
                                          ? (row.cef_adj_deg > 0 ? `+${row.cef_adj_deg}` : '✓ 0')
                                          : '—'}
                                      </td>
                                      <td className={`py-1.5 text-center font-mono ${
                                        row.cef_boost && row.cef_boost > 0 ? 'text-red-300' : 'text-slate-400'
                                      }`}>
                                        {row.cef_boost != null && row.cef_boost > 0
                                          ? <span>⬆ +{row.cef_boost} mV</span>
                                          : <span className="text-slate-500">—</span>}
                                      </td>
                                      <td className="py-1.5 text-center">
                                        {mean == null ? <span className="text-slate-500">—</span> :
                                          mean > NACE_MARGINAL  ? <span className="text-red-400">⚠ غير محمي</span> :
                                          mean > NACE_PROTECTED ? <span className="text-yellow-400">⚡ هامشي</span> :
                                          <span className="text-green-400">✓ محمي</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          تدهور أساسي = mean CP − (−1850 mV) ·
                          تدهور معزّز = تدهور × CEF ·
                          زيادة بسبب CEF = الفرق — تعكس الأثر الإضافي للرطوبة والحرارة على سرعة التآكل
                        </p>
                      </div>
                    )}

                    {/* ── Correlation badge ── */}
                    {!isNaN(corr) && (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-900/20 border border-violet-500/30 rounded-xl text-sm">
                        <Target className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        <span className="text-slate-300">ارتباط رطوبة التربة × متوسط الجهد:</span>
                        <span className="font-bold font-mono text-violet-300">{corrText}</span>
                        <span className="text-slate-500 text-xs mr-auto">( r = {corr.toFixed(3)} )</span>
                      </div>
                    )}

                    {/* ── Annual bar chart: soil wetness + precipitation ── */}
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-2">تطور رطوبة التربة والأمطار سنوياً</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart
                          data={nasaEnvData.annual.map((a) => ({
                            year: a.year,
                            soil_pct: parseFloat((a.avg_soil_wet * 100).toFixed(1)),
                            precip:   a.total_precip_mm,
                          }))}
                          margin={{ top: 5, right: 40, bottom: 20, left: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" strokeOpacity={0.6} />
                          <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748b' }} />
                          <YAxis
                            yAxisId="soil"
                            domain={[0, 100]}
                            tickFormatter={(v: number) => `${v}%`}
                            tick={{ fontSize: 10, fill: '#34d399' }}
                            width={40}
                          />
                          <YAxis
                            yAxisId="precip"
                            orientation="left"
                            tick={{ fontSize: 10, fill: '#60a5fa' }}
                            width={44}
                            tickFormatter={(v: number) => `${v}مم`}
                            hide
                          />
                          <Tooltip
                            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12, direction: 'rtl' }}
                            formatter={(val: number, name: string) => [
                              name === 'soil_pct' ? `${val}%` : `${val} مم`,
                              name === 'soil_pct' ? 'رطوبة التربة' : 'الأمطار',
                            ]}
                          />
                          <Bar yAxisId="precip" dataKey="precip" fill="#3b82f6" opacity={0.35} radius={[3,3,0,0]} maxBarSize={40} isAnimationActive={false} />
                          <Line yAxisId="soil" type="monotone" dataKey="soil_pct" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4, fill: '#34d399' }} isAnimationActive={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div className="flex items-center gap-6 mt-1 text-xs text-slate-400 justify-center">
                        <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-emerald-400" />رطوبة التربة (%)</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-3 bg-blue-500/40 rounded-sm" />إجمالي الأمطار (مم)</span>
                      </div>
                    </div>

                    {/* ── Per-survey environment table ── */}
                    {surveyRows.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                          البيئة المناخية لكل مسح حقيقي
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-slate-300 min-w-[640px]">
                            <thead>
                              <tr className="border-b border-slate-700/50 text-slate-400">
                                <th className="py-1.5 pr-2 text-right">سنة المسح</th>
                                <th className="py-1.5 text-center">أمطار (مم)</th>
                                <th className="py-1.5 text-center">رطوبة التربة</th>
                                <th className="py-1.5 text-center">درجة حرارة (°C)</th>
                                <th className="py-1.5 text-center">CEF</th>
                                <th className="py-1.5 text-center">مستوى الخطر</th>
                              </tr>
                            </thead>
                            <tbody>
                              {surveyRows.map((row) => (
                                <tr key={row.surveyYear} className="border-b border-slate-800/50 hover:bg-slate-700/20">
                                  <td className="py-1.5 pr-2 font-mono font-semibold text-cyan-300">{row.surveyYear}</td>
                                  <td className="py-1.5 text-center font-mono">{row.totalPrecipMm}</td>
                                  <td className="py-1.5 text-center font-mono">{(row.avgSoilWet * 100).toFixed(1)}%</td>
                                  <td className="py-1.5 text-center font-mono">{row.avgTempC}</td>
                                  <td className="py-1.5 text-center font-mono font-bold" style={{ color:
                                    row.cef.risk_level === 'severe'   ? '#f87171' :
                                    row.cef.risk_level === 'high'     ? '#fb923c' :
                                    row.cef.risk_level === 'moderate' ? '#facc15' : '#4ade80'
                                  }}>{row.cef.cef.toFixed(3)}</td>
                                  <td className="py-1.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      row.cef.risk_level === 'severe'   ? 'bg-red-500/20 text-red-300' :
                                      row.cef.risk_level === 'high'     ? 'bg-orange-500/20 text-orange-300' :
                                      row.cef.risk_level === 'moderate' ? 'bg-yellow-500/20 text-yellow-300' :
                                      'bg-green-500/20 text-green-300'
                                    }`}>{row.cef.risk_label_ar}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ── Peak CEF note ── */}
                    {peakCEF && (
                      <div className="flex items-start gap-3 p-3 bg-yellow-900/10 border border-yellow-500/20 rounded-xl text-xs">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-yellow-200">ذروة عامل التآكل البيئي (CEF): {peakCEF.cef.toFixed(3)}</span>
                          <span className="text-slate-400 mr-2">—</span>
                          <span className="text-slate-400">
                            معامل التربة: {peakCEF.soil_factor.toFixed(3)} · معامل الحرارة: {peakCEF.temp_factor.toFixed(3)} · معامل الرطوبة: {peakCEF.rh_factor.toFixed(3)}
                          </span>
                          <div className="text-slate-500 mt-1">
                            المعادلة: CEF = (1 + 0.45×W<sub>soil</sub>) × e<sup>0.022(T−20)</sup> × (1 + 0.08×RH/100) — ISO 15589-1 Annex D / NACE TM0497
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
          <TrendingUp className="w-12 h-12 opacity-30" />
          <p>لا توجد بيانات لهذا الخط بعد.</p>
          <p className="text-sm text-slate-500">اضغط "توليد التنبؤات" لإنشاء خط الزمن التنبؤي.</p>
        </div>
      )}

    </div>
  );
}
