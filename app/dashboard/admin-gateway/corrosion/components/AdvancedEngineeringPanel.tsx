'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import dynamic from 'next/dynamic';
import { Calculator, ChevronDown, Clock, Gauge, Loader2, Save, Zap } from 'lucide-react';
import type { Config, Layout, PlotData } from 'plotly.js';
import {
  calculateCorrosionRateFaraday,
  calculateCorrosionRateTafel,
  calculateIrDropCompensation,
  calculatePotentialShift,
  calculateRemainingLife,
  CorrosionRateResult,
} from '@/lib/engineering/corrosion-calculations';

type CpSession = {
  session_id: string;
  file_name: string;
  survey_date?: string | null;
  cp_installation_year?: number | null;
};

type CpPipeline = {
  pipeline_id?: string | null;
  display_name: string;
  sessions: CpSession[];
};

type AnalysisPoint = {
  natural_potential?: number | null;
  as_found?: number | null;
  shift_value?: number | null;
  on_potential?: number | null;
  off_potential?: number | null;
};

type SavedCalculation = {
  id: string;
  calculationType: string;
  timestamp: string;
  results: Record<string, any>;
};

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

type ChartMetric = 'potentialShift' | 'corrosionRate' | 'yearsRemaining';

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function toNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function AdvancedEngineeringPanel() {
  const [expandedSection, setExpandedSection] = useState<string | null>('potential');

  const [pipelines, setPipelines] = useState<CpPipeline[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('');

  const [potentialInputs, setPotentialInputs] = useState({ nativeVoltage: -650, polarizedVoltage: -890 });
  const [irDropInputs, setIrDropInputs] = useState({
    measuredVoltage: -780,
    appliedCurrent: 45,
    soilResistance: 1500,
    measurementDistance: 5,
  });
  const [corrosionInputs, setCorrosionInputs] = useState({
    method: 'faraday' as 'faraday' | 'tafel',
    corrosionCurrent: 8,
    metalDensity: 7.85,
    atomicWeight: 55.85,
    baCorr: 50,
    bcCorr: 100,
    potentialDifference: -750,
  });
  const [remainingLifeInputs, setRemainingLifeInputs] = useState({
    originalWallThickness: 12.7,
    currentWallThickness: 10.5,
    corrosionRate: 0.25,
    minAllowableThickness: 4,
    operatingPressure: 80,
    pipelineYieldStrength: 450,
    defectType: 'general' as 'general' | 'localized' | 'pit',
  });
  const [yearsInService, setYearsInService] = useState<number>(10);
  const [thicknessIsEstimated, setThicknessIsEstimated] = useState(false);

  // ── CP-aware dual-rate mode ─────────────────────────────────────────────
  const [cpAwareMode, setCpAwareMode] = useState(false);
  const [cpAwareInputs, setCpAwareInputs] = useState({
    pipeInstallYear: new Date().getFullYear() - 20,
    cpInstallYear: 0,       // 0 = unknown / not installed
    rPre: 0.30,             // mm/year before CP (editable default)
    outerDiameterMm: 406.4, // mm (outer diameter for MAOP calc)
  });
  const [rawBaseData, setRawBaseData] = useState<
    Array<{ ch: number; offMv: number | null }>
  >([]);
  const [cpProfilePoints, setCpProfilePoints] = useState<
    Array<{ ch: number; offMv: number | null; t: number; maop: number | null }>
  >([]);
  const [cpRateBreakdown, setCpRateBreakdown] = useState<{
    rPost: number;
    avgOffMv: number;
    yearsPre: number;
    yearsPost: number;
    thickLossPre: number;
    thickLossPost: number;
    currentThickness: number;
    yearsLeft: number;
  } | null>(null);

  const estimateCurrentThickness = () => {
    const estimated = remainingLifeInputs.originalWallThickness - (remainingLifeInputs.corrosionRate * yearsInService);
    const clamped = Math.max(0, parseFloat(estimated.toFixed(3)));
    setRemainingLifeInputs((p) => ({ ...p, currentWallThickness: clamped }));
    setThicknessIsEstimated(true);
  };

  const [results, setResults] = useState<{
    potential?: ReturnType<typeof calculatePotentialShift>;
    irDrop?: ReturnType<typeof calculateIrDropCompensation>;
    corrosion?: ReturnType<typeof calculateCorrosionRateFaraday>;
    remainingLife?: ReturnType<typeof calculateRemainingLife>;
  }>({});

  const [saveMessage, setSaveMessage] = useState<string>('');
  const [history, setHistory] = useState<SavedCalculation[]>([]);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('potentialShift');

  const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || 'default';

  const calcHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-department': 'corrosion',
    }),
    [tenantId]
  );

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/corrosion/engineering/calculations?limit=120', {
        headers: {
          'x-tenant-id': tenantId,
          'x-department': 'corrosion',
        },
      });
      if (!r.ok) return;
      const data = await r.json();
      setHistory(Array.isArray(data?.calculations) ? data.calculations : []);
    } catch {
      setHistory([]);
    }
  }, [tenantId]);

  const loadPipelines = useCallback(async () => {
    setPipelinesLoading(true);
    setSourceError(null);
    try {
      const r = await fetch('/api/v1/corrosion/cp-pipelines?page=1&page_size=120&include_sessions=true');
      if (!r.ok) throw new Error(`Pipeline API failed: ${r.status}`);
      const data = await r.json();
      const rows: CpPipeline[] = data?.pipelines ?? [];
      setPipelines(rows);

      if (!selectedPipeline && rows.length > 0) {
        const first = rows[0];
        const pid = first.pipeline_id ?? '__UNASSIGNED__';
        setSelectedPipeline(pid);
        setSelectedSession(first.sessions[0]?.session_id ?? '');
      }
    } catch (error: any) {
      setSourceError(error?.message ?? 'تعذر تحميل خطوط التآكل');
    } finally {
      setPipelinesLoading(false);
    }
  }, [selectedPipeline]);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const activePipeline = useMemo(() => {
    return pipelines.find((p) => (p.pipeline_id ?? '__UNASSIGNED__') === selectedPipeline) ?? null;
  }, [pipelines, selectedPipeline]);

  const activeSession = useMemo(() => {
    if (!activePipeline) return null;
    return activePipeline.sessions.find((s) => s.session_id === selectedSession) ?? null;
  }, [activePipeline, selectedSession]);

  const loadSessionDefaults = useCallback(async () => {
    if (!selectedSession) return;
    setSourceLoading(true);
    setSourceError(null);

    try {
      const r = await fetch(
        `/api/v1/corrosion/cp-analysis/${encodeURIComponent(selectedSession)}?segment_size=100&include_chart_data=true&include_gis_points=true`
      );
      if (!r.ok) throw new Error(`Analysis API failed: ${r.status}`);
      const data = await r.json();
      const chartData: AnalysisPoint[] = Array.isArray(data?.chart_data) ? data.chart_data : [];

      const natural = chartData
        .map((p) => p.natural_potential)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const asFound = chartData
        .map((p) => p.as_found ?? p.off_potential ?? p.on_potential)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const shifts = chartData
        .map((p) => p.shift_value)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        .map((v) => Math.abs(v));

      const avgNative = natural.length > 0 ? avg(natural) : -650;
      const avgPolarized = asFound.length > 0 ? avg(asFound) : -890;
      const avgShift = shifts.length > 0 ? avg(shifts) : Math.abs(avgPolarized - avgNative);

      setPotentialInputs({
        nativeVoltage: Number(avgNative.toFixed(2)),
        polarizedVoltage: Number(avgPolarized.toFixed(2)),
      });

      setIrDropInputs((prev) => ({
        ...prev,
        measuredVoltage: Number(avgPolarized.toFixed(2)),
        appliedCurrent: Math.max(10, Math.min(250, Number((avgShift / 2).toFixed(2)))),
      }));

      setCorrosionInputs((prev) => ({
        ...prev,
        corrosionCurrent: Math.max(1, Math.min(200, Number((avgShift / 20).toFixed(2)))),
        potentialDifference: Number(avgPolarized.toFixed(2)),
      }));

      // Save raw chart points for CP-aware profile
      setRawBaseData(
        chartData
          .filter((p) => typeof (p as any).distance === 'number' && Number.isFinite((p as any).distance))
          .map((p) => ({
            ch: (p as any).distance as number,
            offMv:
              typeof p.off_potential === 'number'
                ? p.off_potential
                : typeof p.as_found === 'number'
                  ? p.as_found
                  : null,
          }))
      );
      // Auto-fill CP installation year from session data
      const autoYear =
        (data?.session as any)?.cp_installation_year ?? null;
      if (typeof autoYear === 'number' && autoYear > 1950) {
        setCpAwareInputs((prev) => ({ ...prev, cpInstallYear: autoYear }));
      }
    } catch (error: any) {
      setSourceError(error?.message ?? 'تعذر تحميل بيانات الجلسة');
    } finally {
      setSourceLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => {
    loadSessionDefaults();
  }, [loadSessionDefaults]);

  const persistCalculation = useCallback(
    async (calculationType: string, inputs: Record<string, any>, output: Record<string, any>) => {
      setSaveMessage('');
      try {
        const r = await fetch('/api/v1/corrosion/engineering/calculations', {
          method: 'POST',
          headers: calcHeaders,
          body: JSON.stringify({
            calculationType,
            source: {
              pipeline_id: activePipeline?.pipeline_id ?? null,
              session_id: activeSession?.session_id ?? null,
              file_name: activeSession?.file_name ?? null,
            },
            inputs,
            results: output,
          }),
        });

        if (!r.ok) throw new Error(`Save API failed: ${r.status}`);
        setSaveMessage('تم حفظ نتيجة الحساب بنجاح');
        await loadHistory();
      } catch (error: any) {
        setSaveMessage(`تعذر حفظ النتيجة: ${error?.message ?? 'خطأ غير معروف'}`);
      }
    },
    [activePipeline, activeSession, calcHeaders, loadHistory]
  );

  const handlePotentialCalc = async () => {
    const result = calculatePotentialShift(potentialInputs);
    setResults((prev) => ({ ...prev, potential: result }));
    await persistCalculation('potential_shift', potentialInputs, result);
  };

  const handleIrDropCalc = async () => {
    const result = calculateIrDropCompensation(irDropInputs);
    setResults((prev) => ({ ...prev, irDrop: result }));
    await persistCalculation('ir_drop_compensation', irDropInputs, result);
  };

  const handleCorrosionCalc = async () => {
    const result: CorrosionRateResult =
      corrosionInputs.method === 'tafel'
        ? calculateCorrosionRateTafel(corrosionInputs)
        : calculateCorrosionRateFaraday(corrosionInputs);

    setResults((prev) => ({ ...prev, corrosion: result }));
    setRemainingLifeInputs((prev) => ({
      ...prev,
      corrosionRate: Number(result.corrosionRateMmYear.toFixed(4)),
    }));
    await persistCalculation('corrosion_rate', corrosionInputs, result);
  };

  const handleRemainingLifeCalc = async () => {
    const result = calculateRemainingLife(remainingLifeInputs);
    setResults((prev) => ({ ...prev, remainingLife: result }));
    await persistCalculation('remaining_life', remainingLifeInputs, result);
  };

  const chartData = useMemo(() => {
    const points = [...history]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((item, idx) => ({
        i: idx + 1,
        ts: new Date(item.timestamp).toLocaleString('ar-LY', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        tISO: new Date(item.timestamp).toISOString(),
        potentialShift:
          item.calculationType === 'potential_shift' && typeof item.results?.potentialShift === 'number'
            ? item.results.potentialShift
            : null,
        corrosionRate:
          item.calculationType === 'corrosion_rate' && typeof item.results?.corrosionRateMmYear === 'number'
            ? item.results.corrosionRateMmYear
            : null,
        yearsRemaining:
          item.calculationType === 'remaining_life' && typeof item.results?.estimatedYearsRemaining === 'number'
            ? item.results.estimatedYearsRemaining
            : null,
      }));
    return points;
  }, [history]);

  const metricMeta = useMemo(
    () => ({
      potentialShift: {
        label: 'Potential Shift',
        unit: 'mV',
        color: '#f59e0b',
        warning: 100,
        critical: 70,
        higherIsBetter: true,
      },
      corrosionRate: {
        label: 'Corrosion Rate',
        unit: 'mm/year',
        color: '#f97316',
        warning: 0.1,
        critical: 0.2,
        higherIsBetter: false,
      },
      yearsRemaining: {
        label: 'Remaining Life',
        unit: 'years',
        color: '#a855f7',
        warning: 10,
        critical: 5,
        higherIsBetter: true,
      },
    }),
    []
  );

  const activeMetric = metricMeta[chartMetric];

  const activeSeries = useMemo(() => {
    return chartData.filter((p) => typeof p[chartMetric] === 'number');
  }, [chartData, chartMetric]);

  const plotTraces = useMemo<PlotData[]>(() => {
    const x = activeSeries.map((p) => p.tISO);
    const y = activeSeries.map((p) => p[chartMetric] as number);

    const mainTrace: PlotData = {
      type: 'scatter',
      mode: 'lines+markers',
      name: `${activeMetric.label} (${activeMetric.unit})`,
      x,
      y,
      line: {
        color: activeMetric.color,
        width: 2.4,
        shape: 'spline',
      },
      marker: {
        color: activeMetric.color,
        size: 5,
      },
      hovertemplate: `%{x}<br>%{y:.4f} ${activeMetric.unit}<extra></extra>`,
    };

    const warningTrace: PlotData = {
      type: 'scatter',
      mode: 'lines',
      name: 'Warning Limit',
      x,
      y: x.map(() => activeMetric.warning),
      line: {
        color: '#facc15',
        width: 1.2,
        dash: 'dot',
      },
      hovertemplate: `Warning: ${activeMetric.warning} ${activeMetric.unit}<extra></extra>`,
    };

    const criticalTrace: PlotData = {
      type: 'scatter',
      mode: 'lines',
      name: 'Critical Limit',
      x,
      y: x.map(() => activeMetric.critical),
      line: {
        color: '#ef4444',
        width: 1.4,
        dash: 'dash',
      },
      hovertemplate: `Critical: ${activeMetric.critical} ${activeMetric.unit}<extra></extra>`,
    };

    return [mainTrace, warningTrace, criticalTrace];
  }, [activeMetric, activeSeries, chartMetric]);

  const plotLayout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      paper_bgcolor: 'rgba(2, 6, 23, 0)',
      plot_bgcolor: 'rgba(15, 23, 42, 0.65)',
      hovermode: 'x unified',
      dragmode: 'zoom',
      margin: { l: 56, r: 18, t: 16, b: 52 },
      font: { color: '#e2e8f0', size: 11 },
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.15,
        font: { size: 10, color: '#cbd5e1' },
      },
      xaxis: {
        type: 'date',
        title: { text: 'Timeline' },
        showgrid: true,
        gridcolor: '#334155',
        zeroline: false,
        rangeslider: { visible: true, thickness: 0.12, bgcolor: '#0f172a' },
      },
      yaxis: {
        title: { text: `${activeMetric.label} (${activeMetric.unit})` },
        showgrid: true,
        gridcolor: '#334155',
        zerolinecolor: '#475569',
      },
    }),
    [activeMetric]
  );

  const plotConfig = useMemo<Partial<Config>>(
    () => ({
      responsive: true,
      displaylogo: false,
      scrollZoom: true,
      editable: true,
      modeBarButtonsToAdd: ['drawline', 'drawopenpath', 'drawrect', 'eraseshape'],
      toImageButtonOptions: {
        format: 'png',
        filename: `corrosion-engineering-${chartMetric}`,
        scale: 2,
      },
    }),
    [chartMetric]
  );

  const computeCpProfile = useCallback(() => {
    const { pipeInstallYear, cpInstallYear, rPre, outerDiameterMm } = cpAwareInputs;
    const { originalWallThickness, minAllowableThickness, pipelineYieldStrength } = remainingLifeInputs;
    const currentYear = new Date().getFullYear();
    const hasCp = cpInstallYear > 0 && cpInstallYear > pipeInstallYear;
    const yearsPre = hasCp
      ? Math.max(0, cpInstallYear - pipeInstallYear)
      : Math.max(0, currentYear - pipeInstallYear);
    const yearsPost = hasCp ? Math.max(0, currentYear - cpInstallYear) : 0;

    const offVals = rawBaseData
      .map((p) => p.offMv)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const avgOffMv =
      offVals.length > 0 ? offVals.reduce((a, b) => a + b, 0) / offVals.length : -800;

    // NACE SP0169 protection factor
    const protFactor =
      avgOffMv <= -1000 ? 0.05 :
      avgOffMv <= -850  ? 0.10 :
      avgOffMv <= -750  ? 0.30 :
      avgOffMv <= -700  ? 0.50 : 0.80;

    const rPost = Number((rPre * protFactor).toFixed(4));
    const thickLossPre = rPre * yearsPre;
    const thickLossPost = rPost * yearsPost;
    const currentThickness = Math.max(0, originalWallThickness - thickLossPre - thickLossPost);
    const yearsLeft = rPost > 0 ? Math.max(0, (currentThickness - minAllowableThickness) / rPost) : 999;

    setCpRateBreakdown({
      rPost,
      avgOffMv: Number(avgOffMv.toFixed(1)),
      yearsPre,
      yearsPost,
      thickLossPre: Number(thickLossPre.toFixed(3)),
      thickLossPost: Number(thickLossPost.toFixed(3)),
      currentThickness: Number(currentThickness.toFixed(3)),
      yearsLeft: Number(yearsLeft.toFixed(1)),
    });

    // Per-chainage profile (downsample for chart performance)
    const step = rawBaseData.length > 500 ? Math.ceil(rawBaseData.length / 400) : 1;
    const pts = rawBaseData
      .filter((_, i) => i % step === 0)
      .map((p) => {
        const localOff = p.offMv;
        const lPf =
          localOff === null ? protFactor :
          localOff <= -1000 ? 0.05 :
          localOff <= -850  ? 0.10 :
          localOff <= -750  ? 0.30 :
          localOff <= -700  ? 0.50 : 0.80;
        const lRPost = rPre * lPf;
        const lLoss = rPre * yearsPre + lRPost * yearsPost;
        const lT = Math.max(0, originalWallThickness - lLoss);
        // MAOP: Barlow formula — P = 2tSF/D, convert MPa→bar (×10)
        const maop =
          outerDiameterMm > 0
            ? Number(((2 * lT * pipelineYieldStrength * 1.0 * 0.72) / outerDiameterMm * 10).toFixed(1))
            : null;
        return { ch: p.ch, offMv: localOff, t: Number(lT.toFixed(3)), maop };
      });

    setCpProfilePoints(pts);
    setRemainingLifeInputs((prev) => ({
      ...prev,
      currentWallThickness: Number(currentThickness.toFixed(3)),
      corrosionRate: rPost,
    }));
    setThicknessIsEstimated(true);
  }, [cpAwareInputs, rawBaseData, remainingLifeInputs]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:p-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-bold text-slate-100">وحدة الحسابات الهندسية المتقدمة</h2>
          <span className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white">Tier-1</span>
        </div>
        <button
          onClick={loadPipelines}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200"
        >
          <Loader2 className={`h-4 w-4 ${pipelinesLoading ? 'animate-spin' : ''}`} /> تحديث مصدر البيانات
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-400">الخط</label>
          <select
            value={selectedPipeline}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedPipeline(next);
              const p = pipelines.find((row) => (row.pipeline_id ?? '__UNASSIGNED__') === next);
              setSelectedSession(p?.sessions[0]?.session_id ?? '');
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            {pipelines.map((p) => (
              <option key={p.pipeline_id ?? '__UNASSIGNED__'} value={p.pipeline_id ?? '__UNASSIGNED__'}>
                {p.display_name} ({p.sessions.length})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">جلسة القياس</label>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            {(activePipeline?.sessions ?? []).map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.file_name} {s.survey_date ? `• ${s.survey_date}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 text-xs text-slate-400">
          {sourceLoading ? 'جاري تحميل القيم المرجعية من قاعدة البيانات...' : sourceError ? `خطأ: ${sourceError}` : 'تم تحميل القيم المرجعية من بيانات CP analysis.'}
        </div>
      </div>

      {saveMessage && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${saveMessage.includes('تعذر') ? 'border-red-600 bg-red-900/20 text-red-300' : 'border-green-600 bg-green-900/20 text-green-300'}`}>
          {saveMessage}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
        <button
          onClick={() => setExpandedSection(expandedSection === 'potential' ? null : 'potential')}
          className="flex w-full items-center justify-between p-4 hover:bg-slate-700"
        >
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-yellow-400" />
            <div className="text-right">
              <h3 className="text-lg font-semibold text-slate-100">حاسبة الإزاحة الكهروكيميائية</h3>
              <p className="text-xs text-slate-400">Potential Shift Calculator</p>
            </div>
          </div>
          <ChevronDown className={`h-5 w-5 transition-transform ${expandedSection === 'potential' ? 'rotate-180' : ''}`} />
        </button>
        {expandedSection === 'potential' && (
          <div className="space-y-4 border-t border-slate-700 p-4">
            {/* Conceptual Diagram */}
            <div className="rounded-lg border border-yellow-500/20 bg-slate-950/60 p-3">
              <p className="mb-2 text-xs font-medium text-yellow-300/80">الإزاحة الكهروكيميائية — Electrochemical Potential Shift</p>
              <svg viewBox="0 0 640 210" className="w-full" style={{ height: '210px' }} direction="ltr">
                {/* Unprotected zone */}
                <rect x="12" y="22" width="248" height="108" rx="10" fill="rgba(239,68,68,0.2)" stroke="rgba(239,68,68,0.45)" strokeWidth="1.5" />
                <text x="136" y="62" textAnchor="middle" fill="#fca5a5" fontSize="17" fontWeight="bold">⚠ غير محمي</text>
                <text x="136" y="86" textAnchor="middle" fill="#f87171" fontSize="13">-300 mV → -850 mV</text>
                <text x="136" y="108" textAnchor="middle" fill="#fca5a5" fontSize="12">خطر تآكل</text>
                {/* Protected zone */}
                <rect x="380" y="22" width="248" height="108" rx="10" fill="rgba(34,197,94,0.2)" stroke="rgba(34,197,94,0.45)" strokeWidth="1.5" />
                <text x="504" y="62" textAnchor="middle" fill="#86efac" fontSize="17" fontWeight="bold">✓ محمي</text>
                <text x="504" y="86" textAnchor="middle" fill="#4ade80" fontSize="13">-850 mV → -1200 mV</text>
                <text x="504" y="108" textAnchor="middle" fill="#86efac" fontSize="12">حماية كاثودية فعّالة</text>
                {/* NACE criterion line */}
                <line x1="320" y1="12" x2="320" y2="144" stroke="#facc15" strokeWidth="2.5" />
                <text x="320" y="9" textAnchor="middle" fill="#facc15" fontSize="13" fontFamily="monospace" fontWeight="bold">-850 mV</text>
                <text x="320" y="158" textAnchor="middle" fill="#fbbf24" fontSize="12">NACE SP0169</text>
                {/* Shift arrow */}
                <defs>
                  <marker id="shiftArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#a855f7" />
                  </marker>
                </defs>
                <line x1="50" y1="178" x2="610" y2="178" stroke="#a855f7" strokeWidth="2.5" markerEnd="url(#shiftArrow)" />
                <circle cx="50" cy="178" r="5" fill="#94a3b8" />
                <circle cx="504" cy="178" r="5" fill="#60a5fa" />
                <text x="50" y="200" textAnchor="middle" fill="#94a3b8" fontSize="13">V_native</text>
                <text x="504" y="200" textAnchor="middle" fill="#60a5fa" fontSize="13">V_polarized</text>
                <text x="296" y="200" textAnchor="middle" fill="#c084fc" fontSize="13">← إزاحة الجهد →</text>
              </svg>
            </div>
            {/* Labeled inputs */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">الجهد الطبيعي (Native Voltage) — mV vs CSE</label>
                <input value={potentialInputs.nativeVoltage} type="number" onChange={(e) => setPotentialInputs((p) => ({ ...p, nativeVoltage: toNumber(e.target.value, p.nativeVoltage) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">الجهد المستقطب (Polarized Voltage) — mV vs CSE</label>
                <input value={potentialInputs.polarizedVoltage} type="number" onChange={(e) => setPotentialInputs((p) => ({ ...p, polarizedVoltage: toNumber(e.target.value, p.polarizedVoltage) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
            </div>
            <button onClick={handlePotentialCalc} className="w-full rounded bg-yellow-600 py-2 font-semibold text-white hover:bg-yellow-700">حساب الإزاحة</button>
            {results.potential && (
              <div className="rounded-lg border border-yellow-500/30 bg-slate-700/50 p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-slate-400">إزاحة الجهد</p><p className="text-xl font-bold text-yellow-300">{results.potential.potentialShift.toFixed(2)} mV</p></div>
                  <div><p className="text-xs text-slate-400">النسبة المئوية</p><p className="text-xl font-bold text-yellow-300">{results.potential.shiftPercentage.toFixed(1)}%</p></div>
                  <div className="col-span-2"><p className={`text-base font-bold ${results.potential.classification === 'PROTECTED' ? 'text-green-400' : results.potential.classification === 'MARGINAL' ? 'text-yellow-400' : 'text-red-400'}`}>{results.potential.classification === 'PROTECTED' ? '✅ حماية كاملة' : results.potential.classification === 'MARGINAL' ? '⚠️ حماية هامشية' : '❌ لا توجد حماية'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-slate-400">المعيار</p><p className="text-xs text-slate-300">{results.potential.naceStatus}</p></div>
                  <div className="col-span-2"><p className="text-xs text-slate-300 mt-1">{results.potential.explanation}</p></div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
        <button onClick={() => setExpandedSection(expandedSection === 'irDrop' ? null : 'irDrop')} className="flex w-full items-center justify-between p-4 hover:bg-slate-700">
          <div className="flex items-center gap-3"><Gauge className="h-5 w-5 text-cyan-400" /><div><h3 className="text-lg font-semibold text-slate-100">تصحيح هبوط الجهد</h3><p className="text-xs text-slate-400">IR Drop Compensation</p></div></div>
          <ChevronDown className={`h-5 w-5 transition-transform ${expandedSection === 'irDrop' ? 'rotate-180' : ''}`} />
        </button>
        {expandedSection === 'irDrop' && (
          <div className="space-y-4 border-t border-slate-700 p-4">
            {/* Conceptual Diagram */}
            <div className="rounded-lg border border-cyan-500/20 bg-slate-950/60 p-3">
              <p className="mb-2 text-xs font-medium text-cyan-300/80">تصحيح هبوط الجهد — IR Drop Compensation</p>
              <svg viewBox="0 0 640 220" className="w-full" style={{ height: '220px' }} direction="ltr">
                {/* TRU / Rectifier */}
                <rect x="12" y="38" width="116" height="100" rx="10" fill="rgba(6,182,212,0.2)" stroke="rgba(6,182,212,0.6)" strokeWidth="2" />
                <text x="70" y="80" textAnchor="middle" fill="#67e8f9" fontSize="18" fontWeight="bold">TRU</text>
                <text x="70" y="102" textAnchor="middle" fill="#67e8f9" fontSize="13">مُقوِّم</text>
                <text x="70" y="122" textAnchor="middle" fill="#a5f3fc" fontSize="12">تيار مستمر</text>
                {/* Current flow arrow */}
                <defs>
                  <marker id="iArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,0 L7,3.5 L0,7 Z" fill="#22d3ee" />
                  </marker>
                </defs>
                <line x1="128" y1="88" x2="204" y2="88" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="6,4" markerEnd="url(#iArrow)" />
                <text x="166" y="76" textAnchor="middle" fill="#22d3ee" fontSize="12">I (mA)</text>
                {/* Soil block */}
                <rect x="210" y="52" width="140" height="76" rx="8" fill="rgba(120,90,40,0.3)" stroke="rgba(210,160,80,0.55)" strokeWidth="1.5" />
                <text x="280" y="88" textAnchor="middle" fill="#d4a853" fontSize="16">تربة</text>
                <text x="280" y="112" textAnchor="middle" fill="#b8860b" fontSize="12">R = ρ × d</text>
                {/* Arrow to pipe */}
                <line x1="350" y1="88" x2="414" y2="88" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="6,4" markerEnd="url(#iArrow)" />
                {/* Pipe cross-section */}
                <ellipse cx="524" cy="88" rx="104" ry="60" fill="rgba(100,116,139,0.45)" stroke="rgba(148,163,184,0.7)" strokeWidth="2.5" />
                <ellipse cx="524" cy="88" rx="76" ry="42" fill="rgba(15,23,42,0.9)" />
                <text x="524" y="85" textAnchor="middle" fill="#94a3b8" fontSize="13">أنبوب</text>
                <text x="524" y="103" textAnchor="middle" fill="#64748b" fontSize="11">مقطع عرضي</text>
                {/* Voltage labels */}
                <text x="280" y="152" textAnchor="middle" fill="#f87171" fontSize="13">V_measured</text>
                <text x="280" y="170" textAnchor="middle" fill="#f87171" fontSize="12">(يشمل IR drop)</text>
                <text x="524" y="152" textAnchor="middle" fill="#4ade80" fontSize="13">V_true</text>
                <text x="524" y="170" textAnchor="middle" fill="#4ade80" fontSize="12">(بعد التصحيح)</text>
                {/* Formula bar */}
                <rect x="120" y="190" width="400" height="24" rx="6" fill="rgba(6,182,212,0.12)" stroke="rgba(6,182,212,0.35)" strokeWidth="1.2" />
                <text x="320" y="207" textAnchor="middle" fill="#67e8f9" fontSize="13" fontFamily="monospace">V_true = V_measured + IR_drop</text>
              </svg>
            </div>
            {/* Labeled inputs */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">الجهد المقاس (Measured Voltage) — mV</label>
                <input value={irDropInputs.measuredVoltage} type="number" onChange={(e) => setIrDropInputs((p) => ({ ...p, measuredVoltage: toNumber(e.target.value, p.measuredVoltage) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">التيار المطبوع (Applied Current) — mA</label>
                <input value={irDropInputs.appliedCurrent} type="number" onChange={(e) => setIrDropInputs((p) => ({ ...p, appliedCurrent: toNumber(e.target.value, p.appliedCurrent) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">مقاومة التربة (Soil Resistivity) — Ω·cm</label>
                <input value={irDropInputs.soilResistance} type="number" onChange={(e) => setIrDropInputs((p) => ({ ...p, soilResistance: toNumber(e.target.value, p.soilResistance) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">مسافة القياس (Measurement Distance) — m</label>
                <input value={irDropInputs.measurementDistance} type="number" onChange={(e) => setIrDropInputs((p) => ({ ...p, measurementDistance: toNumber(e.target.value, p.measurementDistance) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
            </div>
            <button onClick={handleIrDropCalc} className="w-full rounded bg-cyan-600 py-2 font-semibold text-white hover:bg-cyan-700">حساب التصحيح</button>
            {results.irDrop && (
              <div className="rounded-lg border border-cyan-500/30 bg-slate-700/50 p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-slate-400">هبوط الجهد المقدر</p><p className="text-xl font-bold text-cyan-300">{results.irDrop.irDropEstimated.toFixed(2)} mV</p></div>
                  <div><p className="text-xs text-slate-400">الجهد الحقيقي للمعدن</p><p className="text-xl font-bold text-cyan-300">{results.irDrop.trueMetalVoltage.toFixed(2)} mV</p></div>
                  <div className="col-span-2"><p className={`text-sm font-semibold ${results.irDrop.reliability === 'high' ? 'text-green-400' : results.irDrop.reliability === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>{results.irDrop.reliability === 'high' ? '✅ موثوقية عالية' : results.irDrop.reliability === 'medium' ? '⚠️ موثوقية متوسطة' : '❌ موثوقية منخفضة'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-slate-300">{results.irDrop.recommendation}</p></div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
        <button onClick={() => setExpandedSection(expandedSection === 'corrosion' ? null : 'corrosion')} className="flex w-full items-center justify-between p-4 hover:bg-slate-700">
          <div className="flex items-center gap-3"><Zap className="h-5 w-5 text-orange-400" /><div><h3 className="text-lg font-semibold text-slate-100">تقدير معدل التآكل</h3><p className="text-xs text-slate-400">Faraday / Tafel</p></div></div>
          <ChevronDown className={`h-5 w-5 transition-transform ${expandedSection === 'corrosion' ? 'rotate-180' : ''}`} />
        </button>
        {expandedSection === 'corrosion' && (
          <div className="space-y-4 border-t border-slate-700 p-4">
            {/* Conceptual Diagram */}
            <div className="rounded-lg border border-orange-500/20 bg-slate-950/60 p-3">
              <p className="mb-2 text-xs font-medium text-orange-300/80">قانون فاراداي لحساب معدل التآكل — Faraday's Law of Corrosion</p>
              <svg viewBox="0 0 640 248" className="w-full" style={{ height: '248px' }} direction="ltr">
                {/* Pipe cross-section */}
                <rect x="10" y="36" width="196" height="140" rx="12" fill="rgba(100,116,139,0.35)" stroke="rgba(148,163,184,0.5)" strokeWidth="2" />
                <rect x="26" y="54" width="164" height="104" rx="8" fill="rgba(15,23,42,0.88)" />
                <text x="108" y="104" textAnchor="middle" fill="#94a3b8" fontSize="13">سطح الأنبوب</text>
                <text x="108" y="124" textAnchor="middle" fill="#64748b" fontSize="11">مقطع عرضي</text>
                {/* Corrosion pits on top edge */}
                <circle cx="32" cy="36" r="9" fill="rgba(239,68,68,0.75)" stroke="#ef4444" strokeWidth="1.2" />
                <circle cx="66" cy="31" r="7" fill="rgba(239,68,68,0.65)" stroke="#ef4444" strokeWidth="1.2" />
                <circle cx="106" cy="37" r="10" fill="rgba(239,68,68,0.8)" stroke="#ef4444" strokeWidth="1.2" />
                <circle cx="148" cy="31" r="7.5" fill="rgba(239,68,68,0.6)" stroke="#ef4444" strokeWidth="1.2" />
                <circle cx="184" cy="36" r="6" fill="rgba(239,68,68,0.5)" stroke="#ef4444" strokeWidth="1.2" />
                <text x="108" y="18" textAnchor="middle" fill="#fca5a5" fontSize="12">نقاط تآكل (corrosion pits)</text>
                {/* Arrow */}
                <defs>
                  <marker id="crArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,0 L7,3.5 L0,7 Z" fill="#64748b" />
                  </marker>
                </defs>
                <line x1="208" y1="106" x2="252" y2="106" stroke="#64748b" strokeWidth="2" strokeDasharray="5,3" markerEnd="url(#crArrow)" />
                {/* Formula box */}
                <rect x="260" y="12" width="368" height="216" rx="8" fill="rgba(251,146,60,0.1)" stroke="rgba(251,146,60,0.35)" strokeWidth="1.5" />
                <text x="444" y="40" textAnchor="middle" fill="#fb923c" fontSize="16" fontFamily="monospace" fontWeight="bold">CR = i·M / (n·F·ρ)</text>
                <line x1="272" y1="52" x2="616" y2="52" stroke="rgba(251,146,60,0.3)" strokeWidth="1" />
                <text x="276" y="80" fill="#94a3b8" fontSize="13">i  = كثافة التيار (μA/cm²)</text>
                <text x="276" y="110" fill="#94a3b8" fontSize="13">M = الوزن الذري (g/mol)</text>
                <text x="276" y="140" fill="#94a3b8" fontSize="13">n  = عدد الإلكترونات (= 2)</text>
                <text x="276" y="170" fill="#94a3b8" fontSize="13">F  = ثابت فاراداي (96485)</text>
                <text x="276" y="200" fill="#94a3b8" fontSize="13">ρ  = كثافة المعدن (g/cm³)</text>
                {/* Result bar */}
                <rect x="260" y="218" width="368" height="8" rx="3" fill="rgba(251,146,60,0.35)" />
                <text x="444" y="243" textAnchor="middle" fill="#fb923c" fontSize="13" fontWeight="bold">↓ النتيجة بوحدة mm/year</text>
              </svg>
            </div>
            {/* Method selector */}
            <div>
              <label className="mb-1 block text-xs text-slate-400">طريقة الحساب</label>
              <select value={corrosionInputs.method} onChange={(e) => setCorrosionInputs((p) => ({ ...p, method: e.target.value as 'faraday' | 'tafel' }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100">
                <option value="faraday">Faraday — قانون فاراداي (كثافة التيار)</option>
                <option value="tafel">Tafel — استقراء Tafel (الجهد)</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">كثافة التيار — μA/cm²</label>
                <input value={corrosionInputs.corrosionCurrent} type="number" onChange={(e) => setCorrosionInputs((p) => ({ ...p, corrosionCurrent: toNumber(e.target.value, p.corrosionCurrent) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">كثافة المعدن — g/cm³</label>
                <input value={corrosionInputs.metalDensity} type="number" onChange={(e) => setCorrosionInputs((p) => ({ ...p, metalDensity: toNumber(e.target.value, p.metalDensity) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">الوزن الذري — g/mol</label>
                <input value={corrosionInputs.atomicWeight} type="number" onChange={(e) => setCorrosionInputs((p) => ({ ...p, atomicWeight: toNumber(e.target.value, p.atomicWeight) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
            </div>
            <button onClick={handleCorrosionCalc} className="w-full rounded bg-orange-600 py-2 font-semibold text-white hover:bg-orange-700">حساب معدل التآكل</button>
            {results.corrosion && (
              <div className="rounded-lg border border-orange-500/30 bg-slate-700/50 p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-slate-400">معدل التآكل</p><p className="text-xl font-bold text-orange-300">{results.corrosion.corrosionRateMmYear.toFixed(4)} mm/year</p></div>
                  <div><p className="text-xs text-slate-400">بوحدة mpy</p><p className="text-xl font-bold text-orange-300">{results.corrosion.corrosionRateMpy.toFixed(4)} mpy</p></div>
                  <div><p className="text-xs text-slate-400">فقد في 3 سنوات</p><p className="text-lg font-bold text-orange-300">{results.corrosion.mmYear3Years.toFixed(3)} mm</p></div>
                  <div><p className="text-xs text-slate-400">فقد في 10 سنوات</p><p className="text-lg font-bold text-orange-300">{results.corrosion.mmYear10Years.toFixed(3)} mm</p></div>
                  <div className="col-span-2"><p className={`text-base font-bold ${results.corrosion.severity === 'CRITICAL' ? 'text-red-400' : results.corrosion.severity === 'HIGH' ? 'text-orange-400' : results.corrosion.severity === 'MODERATE' ? 'text-yellow-400' : 'text-green-400'}`}>{results.corrosion.severity === 'CRITICAL' ? '🚨 حرج' : results.corrosion.severity === 'HIGH' ? '⚠️ عالي' : results.corrosion.severity === 'MODERATE' ? '📋 متوسط' : '✅ منخفض'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-slate-300">{results.corrosion.recommendation}</p></div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
        <button onClick={() => setExpandedSection(expandedSection === 'remaining' ? null : 'remaining')} className="flex w-full items-center justify-between p-4 hover:bg-slate-700">
          <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-purple-400" /><div><h3 className="text-lg font-semibold text-slate-100">تحليل العمر المتبقي</h3><p className="text-xs text-slate-400">ASME B31G</p></div></div>
          <ChevronDown className={`h-5 w-5 transition-transform ${expandedSection === 'remaining' ? 'rotate-180' : ''}`} />
        </button>
        {expandedSection === 'remaining' && (
          <div className="space-y-4 border-t border-slate-700 p-4">
            {/* Conceptual Diagram */}
            <div className="rounded-lg border border-purple-500/20 bg-slate-950/60 p-3">
              <p className="mb-2 text-xs font-medium text-purple-300/80">مقطع جدار الأنبوب — ASME B31G Wall Thickness Assessment</p>
              <svg viewBox="0 0 640 240" className="w-full" style={{ height: '240px' }} direction="ltr">
                {/* Outer wall - original */}
                <rect x="10" y="20" width="226" height="152" rx="14" fill="rgba(100,116,139,0.3)" stroke="rgba(148,163,184,0.55)" strokeWidth="2.5" />
                {/* Current wall */}
                <rect x="24" y="34" width="198" height="124" rx="11" fill="rgba(96,165,250,0.15)" stroke="rgba(96,165,250,0.5)" strokeWidth="2" />
                {/* Minimum allowable */}
                <rect x="40" y="50" width="166" height="92" rx="8" fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.5)" strokeWidth="1.5" strokeDasharray="7,4" />
                {/* Interior bore */}
                <rect x="56" y="66" width="134" height="60" rx="7" fill="rgba(15,23,42,0.92)" />
                <text x="123" y="94" textAnchor="middle" fill="#94a3b8" fontSize="13">تدفق داخلي</text>
                <text x="123" y="113" textAnchor="middle" fill="#64748b" fontSize="12">ضغط تشغيلي</text>
                {/* Legend on right - with wide viewBox there's plenty of space */}
                <line x1="248" y1="24" x2="286" y2="24" stroke="#94a3b8" strokeWidth="2.5" />
                <text x="294" y="30" fill="#94a3b8" fontSize="13">السمك الأصلي: {remainingLifeInputs.originalWallThickness} mm</text>
                <line x1="248" y1="60" x2="286" y2="60" stroke="#60a5fa" strokeWidth="2" />
                <text x="294" y="66" fill="#60a5fa" fontSize="13">السمك الحالي: {remainingLifeInputs.currentWallThickness} mm</text>
                <line x1="248" y1="96" x2="286" y2="96" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="7,4" />
                <text x="294" y="102" fill="#ef4444" fontSize="13">الحد الأدنى: {remainingLifeInputs.minAllowableThickness} mm</text>
                <text x="294" y="136" fill="#94a3b8" fontSize="12">الفارق المتبقي:</text>
                <text x="294" y="162" fill="#c084fc" fontSize="18" fontWeight="bold">{(remainingLifeInputs.currentWallThickness - remainingLifeInputs.minAllowableThickness).toFixed(1)} mm</text>
                <text x="294" y="184" fill="#c084fc" fontSize="13">قبل الوصول إلى الحد الأدنى</text>
                {/* Time arrow */}
                <defs>
                  <marker id="tArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <path d="M0,0 L7,3.5 L0,7 Z" fill="#a855f7" />
                  </marker>
                </defs>
                <line x1="14" y1="196" x2="232" y2="196" stroke="#a855f7" strokeWidth="2" markerEnd="url(#tArrow)" />
                <text x="14" y="216" fill="#94a3b8" fontSize="12">اليوم</text>
                <text x="123" y="216" textAnchor="middle" fill="#c084fc" fontSize="12">← تآكل {remainingLifeInputs.corrosionRate} mm/year →</text>
                <text x="232" y="216" textAnchor="end" fill="#94a3b8" fontSize="12">مستقبل</text>
              </svg>
            </div>
            {/* Labeled inputs */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">السمك الأصلي — mm</label>
                <input value={remainingLifeInputs.originalWallThickness} type="number" onChange={(e) => setRemainingLifeInputs((p) => ({ ...p, originalWallThickness: toNumber(e.target.value, p.originalWallThickness) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                  السمك الحالي — mm
                  {thicknessIsEstimated && (
                    <span className="rounded bg-amber-600/30 px-1.5 py-0.5 text-amber-300 text-[10px] font-semibold">تقديري</span>
                  )}
                </label>
                <input
                  value={remainingLifeInputs.currentWallThickness}
                  type="number"
                  onChange={(e) => {
                    setRemainingLifeInputs((p) => ({ ...p, currentWallThickness: toNumber(e.target.value, p.currentWallThickness) }));
                    setThicknessIsEstimated(false);
                  }}
                  className={`w-full rounded border px-3 py-2 text-sm text-slate-100 bg-slate-700 ${thicknessIsEstimated ? 'border-amber-500/60' : 'border-slate-600'}`}
                />
              </div>
              {/* Estimation row */}
              <div className="md:col-span-3 rounded-lg border border-amber-500/25 bg-amber-900/10 p-3">
                <p className="mb-2 text-xs font-medium text-amber-300">
                  📐 حساب السماكة تقديرياً — للأنابيب تحت الأرض بدون قياس مباشر
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[120px]">
                    <label className="mb-1 block text-xs text-slate-400">سنوات الخدمة</label>
                    <input
                      type="number"
                      min="0"
                      value={yearsInService}
                      onChange={(e) => setYearsInService(Math.max(0, toNumber(e.target.value, yearsInService)))}
                      className="w-full rounded border border-amber-500/40 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                      placeholder="مثال: 15"
                    />
                  </div>
                  <div className="flex-1 min-w-[160px] text-xs text-slate-400 leading-relaxed">
                    <div className="font-mono bg-slate-900/60 rounded px-2 py-1 text-amber-200 text-[11px]">
                      {remainingLifeInputs.originalWallThickness} − ({remainingLifeInputs.corrosionRate} × {yearsInService})
                      {' = '}
                      <span className="font-bold text-amber-300">
                        {Math.max(0, remainingLifeInputs.originalWallThickness - remainingLifeInputs.corrosionRate * yearsInService).toFixed(3)} mm
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">يستخدم معدل التآكل من الحاسبة 3</p>
                  </div>
                  <button
                    onClick={estimateCurrentThickness}
                    className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 whitespace-nowrap"
                  >
                    احسب تقديرياً ←
                  </button>
                </div>
                {thicknessIsEstimated && (
                  <p className="mt-2 text-[11px] text-amber-400/80">
                    ⚠️ هذه قيمة تقديرية مبنية على معدل تآكل ثابت. للدقة العالية استخدم Intelligent Pigging أو Ultrasonic Testing.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">معدل التآكل — mm/year</label>
                <input value={remainingLifeInputs.corrosionRate} type="number" onChange={(e) => setRemainingLifeInputs((p) => ({ ...p, corrosionRate: toNumber(e.target.value, p.corrosionRate) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">الحد الأدنى المسموح — mm</label>
                <input value={remainingLifeInputs.minAllowableThickness} type="number" onChange={(e) => setRemainingLifeInputs((p) => ({ ...p, minAllowableThickness: toNumber(e.target.value, p.minAllowableThickness) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">الضغط التشغيلي — bar</label>
                <input value={remainingLifeInputs.operatingPressure} type="number" onChange={(e) => setRemainingLifeInputs((p) => ({ ...p, operatingPressure: toNumber(e.target.value, p.operatingPressure) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">حد الخضوع — MPa</label>
                <input value={remainingLifeInputs.pipelineYieldStrength} type="number" onChange={(e) => setRemainingLifeInputs((p) => ({ ...p, pipelineYieldStrength: toNumber(e.target.value, p.pipelineYieldStrength) }))} className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100" />
              </div>
            </div>
            <button onClick={handleRemainingLifeCalc} className="w-full rounded bg-purple-600 py-2 font-semibold text-white hover:bg-purple-700">حساب العمر المتبقي</button>
            {results.remainingLife && (
              <div className="rounded-lg border border-purple-500/30 bg-slate-700/50 p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-slate-400">فقدان السمك</p><p className="text-xl font-bold text-purple-300">{results.remainingLife.wallLoss.toFixed(2)} mm</p></div>
                  <div><p className="text-xs text-slate-400">نسبة الفقد</p><p className="text-xl font-bold text-purple-300">{results.remainingLife.wallLossPercentage.toFixed(1)}%</p></div>
                  <div><p className="text-xs text-slate-400">معامل الأمان</p><p className="text-xl font-bold text-purple-300">{results.remainingLife.safetyFactor.toFixed(2)}</p></div>
                  <div><p className="text-xs text-slate-400">السنوات المتبقية</p><p className="text-xl font-bold text-purple-300">{results.remainingLife.estimatedYearsRemaining.toFixed(1)} سنة</p></div>
                  <div className="col-span-2"><p className={`text-base font-bold ${results.remainingLife.criticality === 'IMMEDIATE' ? 'text-red-400' : results.remainingLife.criticality === 'HIGH' ? 'text-orange-400' : results.remainingLife.criticality === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'}`}>{results.remainingLife.criticality === 'IMMEDIATE' ? '🚨 تدخل فوري' : results.remainingLife.criticality === 'HIGH' ? '⚠️ أولوية عالية' : results.remainingLife.criticality === 'MEDIUM' ? '📋 متابعة دورية' : '✅ وضع مقبول'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-slate-400">جدول الفحص القادم</p><p className="text-sm text-blue-300">{results.remainingLife.nextInspectionSchedule}</p></div>
                  <div className="col-span-2"><p className={`text-xs font-semibold ${results.remainingLife.asmeB31gCompliance ? 'text-green-400' : 'text-red-400'}`}>{results.remainingLife.asmeB31gCompliance ? '✅ متوافق مع ASME B31G' : '❌ غير متوافق مع ASME B31G'}</p></div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 mb-1">الإجراءات الموصى بها</p>
                    <ul className="space-y-1">{results.remainingLife.recommendedActions.map((a, i) => <li key={i} className="text-xs text-slate-300">• {a}</li>)}</ul>
                  </div>
                </div>
              </div>
            )}

            {/* ── CP-Aware Dynamic Analysis ─────────────────────────────── */}
            <div className="rounded-lg border border-purple-500/20 bg-purple-950/20 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-200">التحليل الديناميكي CP-Aware</p>
                  <p className="text-xs text-slate-400">معدلات مزدوجة قبل/بعد الحماية الكاثودية من بيانات المسوحات الفعلية</p>
                </div>
                <button
                  onClick={() => setCpAwareMode(!cpAwareMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cpAwareMode ? 'bg-purple-600' : 'bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cpAwareMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {cpAwareMode && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">سنة تأسيس الأنبوب</label>
                      <input
                        type="number"
                        value={cpAwareInputs.pipeInstallYear}
                        onChange={(e) => setCpAwareInputs((p) => ({ ...p, pipeInstallYear: toNumber(e.target.value, p.pipeInstallYear) }))}
                        className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        سنة تركيب CP
                        {cpAwareInputs.cpInstallYear > 0 && <span className="mr-1 text-[10px] text-green-400">✓ تلقائي</span>}
                      </label>
                      <input
                        type="number"
                        value={cpAwareInputs.cpInstallYear || ''}
                        placeholder="0 = غير محدد"
                        onChange={(e) => setCpAwareInputs((p) => ({ ...p, cpInstallYear: toNumber(e.target.value, 0) }))}
                        className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">معدل التآكل قبل CP (mm/y)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={cpAwareInputs.rPre}
                        onChange={(e) => setCpAwareInputs((p) => ({ ...p, rPre: toNumber(e.target.value, p.rPre) }))}
                        className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">القطر الخارجي (mm)</label>
                      <input
                        type="number"
                        value={cpAwareInputs.outerDiameterMm}
                        onChange={(e) => setCpAwareInputs((p) => ({ ...p, outerDiameterMm: toNumber(e.target.value, p.outerDiameterMm) }))}
                        className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 rounded bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
                    <span className="text-slate-500">مصدر البيانات:</span>
                    <span className="text-blue-300">{rawBaseData.length} نقطة قياس محملة</span>
                    {activeSession?.survey_date && (
                      <span className="text-slate-500">• تاريخ الجلسة: {activeSession.survey_date}</span>
                    )}
                    {activeSession?.cp_installation_year && (
                      <span className="text-green-400">• سنة CP: {activeSession.cp_installation_year}</span>
                    )}
                  </div>

                  <button
                    onClick={computeCpProfile}
                    disabled={rawBaseData.length === 0}
                    className="w-full rounded bg-purple-700 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
                  >
                    احسب المسار الديناميكي ←
                  </button>

                  {cpRateBreakdown && (
                    <div className="space-y-3">
                      {/* Summary cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="rounded bg-slate-800 p-2">
                          <p className="text-slate-500">متوسط OFF</p>
                          <p className="text-lg font-bold text-cyan-300">{cpRateBreakdown.avgOffMv} mV</p>
                        </div>
                        <div className="rounded bg-slate-800 p-2">
                          <p className="text-slate-500">معدل بعد CP</p>
                          <p className="text-lg font-bold text-green-300">{cpRateBreakdown.rPost} mm/y</p>
                        </div>
                        <div className="rounded bg-slate-800 p-2">
                          <p className="text-slate-500">السمك الحالي</p>
                          <p className="text-lg font-bold text-purple-300">{cpRateBreakdown.currentThickness} mm</p>
                        </div>
                        <div className="rounded bg-slate-800 p-2">
                          <p className="text-slate-500">السنوات المتبقية</p>
                          <p className={`text-lg font-bold ${cpRateBreakdown.yearsLeft < 5 ? 'text-red-400' : cpRateBreakdown.yearsLeft < 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {cpRateBreakdown.yearsLeft > 900 ? '∞' : cpRateBreakdown.yearsLeft} سنة
                          </p>
                        </div>
                      </div>

                      {/* Thickness breakdown */}
                      <div className="rounded bg-slate-900/50 p-3 text-xs space-y-1">
                        <p className="font-medium text-slate-300 mb-2">تفصيل فقدان السماكة:</p>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-36">قبل CP ({cpRateBreakdown.yearsPre} سنة):</span>
                          <span className="text-orange-300 font-mono">{cpAwareInputs.rPre} × {cpRateBreakdown.yearsPre} = {cpRateBreakdown.thickLossPre} mm</span>
                        </div>
                        {cpRateBreakdown.yearsPost > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 w-36">بعد CP ({cpRateBreakdown.yearsPost} سنة):</span>
                            <span className="text-green-300 font-mono">{cpRateBreakdown.rPost} × {cpRateBreakdown.yearsPost} = {cpRateBreakdown.thickLossPost} mm</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
                          <span className="text-slate-400 w-36">الإجمالي:</span>
                          <span className="text-purple-300 font-mono font-semibold">
                            {remainingLifeInputs.originalWallThickness} − {(cpRateBreakdown.thickLossPre + cpRateBreakdown.thickLossPost).toFixed(3)} = {cpRateBreakdown.currentThickness} mm
                          </span>
                        </div>
                      </div>

                      {/* Pipeline profile chart */}
                      {cpProfilePoints.length > 0 && (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-slate-300 mb-2">مسار السماكة المقدرة على طول الخط</p>
                            <div className="h-[240px] rounded-lg border border-slate-700 bg-slate-900/60 p-2" dir="ltr">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={cpProfilePoints} margin={{ top: 8, right: 30, left: 0, bottom: 20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                  <XAxis
                                    dataKey="ch"
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    label={{ value: 'Distance (m)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }}
                                  />
                                  <YAxis
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    label={{ value: 'Thickness (mm)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                                    domain={[0, Math.ceil(remainingLifeInputs.originalWallThickness + 2)]}
                                  />
                                  <Tooltip
                                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
                                    formatter={(val: any, name: string) => [
                                      `${val} mm`,
                                      name === 't' ? 'السمك المقدر' : name,
                                    ]}
                                    labelFormatter={(label: any) => `المسافة: ${label} م`}
                                  />
                                  <ReferenceLine
                                    y={remainingLifeInputs.minAllowableThickness}
                                    stroke="#ef4444"
                                    strokeDasharray="5 5"
                                    label={{ value: `t_min ${remainingLifeInputs.minAllowableThickness}mm`, fill: '#ef4444', fontSize: 9, position: 'right' }}
                                  />
                                  <ReferenceLine
                                    y={remainingLifeInputs.originalWallThickness}
                                    stroke="#475569"
                                    strokeDasharray="3 3"
                                    label={{ value: `t₀ ${remainingLifeInputs.originalWallThickness}mm`, fill: '#475569', fontSize: 9, position: 'right' }}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="t"
                                    stroke="#a855f7"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 3, fill: '#a855f7' }}
                                    name="السمك المقدر"
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* MAOP distribution chart */}
                          {cpProfilePoints.some((p) => p.maop !== null) && (
                            <div>
                              <p className="text-xs font-medium text-slate-300 mb-2">توزيع الضغط الأقصى المسموح (MAOP) على طول الخط</p>
                              <div className="h-[200px] rounded-lg border border-slate-700 bg-slate-900/60 p-2" dir="ltr">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={cpProfilePoints} margin={{ top: 8, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis
                                      dataKey="ch"
                                      tick={{ fill: '#64748b', fontSize: 10 }}
                                      label={{ value: 'Distance (m)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }}
                                    />
                                    <YAxis
                                      tick={{ fill: '#64748b', fontSize: 10 }}
                                      label={{ value: 'MAOP (bar)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                                    />
                                    <Tooltip
                                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
                                      formatter={(val: any) => [`${val} bar`, 'MAOP']}
                                      labelFormatter={(label: any) => `المسافة: ${label} م`}
                                    />
                                    <ReferenceLine
                                      y={remainingLifeInputs.operatingPressure}
                                      stroke="#f59e0b"
                                      strokeDasharray="5 5"
                                      label={{ value: `P_op ${remainingLifeInputs.operatingPressure}bar`, fill: '#f59e0b', fontSize: 9, position: 'right' }}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="maop"
                                      stroke="#22d3ee"
                                      strokeWidth={2}
                                      dot={false}
                                      activeDot={{ r: 3, fill: '#22d3ee' }}
                                      name="MAOP"
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-400">
        <span>{saveMessage || 'سيتم حفظ كل عملية حساب تلقائياً.'}</span>
        <span className="inline-flex items-center gap-1 text-slate-300"><Save className="h-3.5 w-3.5" /> Engineering Audit Trail</span>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">منحنيات الأداء الهندسي</h3>
          <span className="text-xs text-slate-400">{history.length} سجل</span>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">القياس:</span>
          <button
            onClick={() => setChartMetric('potentialShift')}
            className={`rounded px-2.5 py-1 text-xs ${chartMetric === 'potentialShift' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            Potential Shift
          </button>
          <button
            onClick={() => setChartMetric('corrosionRate')}
            className={`rounded px-2.5 py-1 text-xs ${chartMetric === 'corrosionRate' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            Corrosion Rate
          </button>
          <button
            onClick={() => setChartMetric('yearsRemaining')}
            className={`rounded px-2.5 py-1 text-xs ${chartMetric === 'yearsRemaining' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            Remaining Life
          </button>
          <span className="mr-auto text-[11px] text-slate-500">
            أدوات احترافية: Zoom, Pan, Select, Draw, Save Image
          </span>
        </div>

        <div className="h-[370px] w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
          <Plot
            data={plotTraces}
            layout={plotLayout}
            config={plotConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </div>
      </div>
    </div>
  );
}
