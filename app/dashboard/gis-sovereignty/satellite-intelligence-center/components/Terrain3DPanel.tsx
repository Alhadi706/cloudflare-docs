'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Mountain, Eye, Loader2, AlertTriangle, BarChart3 } from 'lucide-react';
import {
  fetchTerrain3DAnalysis,
  listTerrain3DReports,
  saveTerrain3DReport,
  type Terrain3DArchivedReport,
  type Terrain3DResponse,
  type LonLat,
  type BBox,
} from '@/lib/terrain3DAPI';
import {
  TERRAIN_3D_BENCHMARK_PRESETS,
  evaluateTerrain3DBenchmark,
  type Terrain3DBenchmarkResult,
} from '@/lib/terrain3DBenchmark';

interface Props {
  bbox?: BBox | null;
  polygon?: LonLat[] | null;
  onResult?: (result: Terrain3DResponse) => void;
  onBenchmark?: (benchmark: Terrain3DBenchmarkResult) => void;
}

export default function Terrain3DPanel({ bbox, polygon, onResult, onBenchmark }: Props) {
  const [loading, setLoading] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Terrain3DResponse | null>(null);
  const [benchmark, setBenchmark] = useState<Terrain3DBenchmarkResult | null>(null);
  const [savedReport, setSavedReport] = useState<Terrain3DArchivedReport | null>(null);
  const [archiveItems, setArchiveItems] = useState<Terrain3DArchivedReport[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>(TERRAIN_3D_BENCHMARK_PRESETS[0].id);

  const [contourInterval, setContourInterval] = useState(20);
  const [gridSize, setGridSize] = useState(11);
  const [observerHeight, setObserverHeight] = useState(1.75);
  const [targetHeight, setTargetHeight] = useState(1.75);
  const [baseLevel, setBaseLevel] = useState<string>('');

  const hasGeom = !!(bbox || (polygon && polygon.length >= 3));

  const losStartEnd = useMemo(() => {
    if (polygon && polygon.length >= 2) {
      return {
        start: polygon[0],
        end: polygon[Math.floor(polygon.length / 2)],
      };
    }
    if (bbox) {
      return {
        start: [bbox[0], bbox[1]] as LonLat,
        end: [bbox[2], bbox[3]] as LonLat,
      };
    }
    return null;
  }, [bbox, polygon]);

  const run = async () => {
    if (!hasGeom) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTerrain3DAnalysis({
        ...(bbox ? { bbox } : {}),
        ...(polygon && polygon.length >= 3 ? { polygon } : {}),
        contour_interval_m: contourInterval,
        grid_size: gridSize,
        ...(baseLevel.trim() ? { base_level_m: Number(baseLevel) } : {}),
        ...(losStartEnd
          ? {
              los: {
                start: losStartEnd.start,
                end: losStartEnd.end,
                observer_height_m: observerHeight,
                target_height_m: targetHeight,
              },
            }
          : {}),
      });

      setResult(res);
      onResult?.(res);
    } catch (e: any) {
      setError(e?.message ?? 'فشل تحليل 3D');
    } finally {
      setLoading(false);
    }
  };

  const runBenchmark = async () => {
    const preset = TERRAIN_3D_BENCHMARK_PRESETS.find(p => p.id === activePresetId) ?? TERRAIN_3D_BENCHMARK_PRESETS[0];
    setBenchmarkLoading(true);
    setError(null);
    try {
      const res = await fetchTerrain3DAnalysis(preset.request);
      const nextBenchmark = evaluateTerrain3DBenchmark(preset, res);
      setBenchmark(nextBenchmark);
      setResult(res);
      onResult?.(res);
      onBenchmark?.(nextBenchmark);
    } catch (e: any) {
      setError(e?.message ?? 'فشل Benchmark 3D');
    } finally {
      setBenchmarkLoading(false);
    }
  };

  const loadArchive = async () => {
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const items = await listTerrain3DReports(8);
      setArchiveItems(items);
    } catch (e: any) {
      setArchiveError(e?.message ?? 'فشل تحميل الأرشيف');
    } finally {
      setArchiveLoading(false);
    }
  };

  const saveCurrentReport = async () => {
    if (!benchmark || !result) return;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const item = await saveTerrain3DReport({ benchmark, result });
      setSavedReport(item);
      await loadArchive();
    } catch (e: any) {
      setArchiveError(e?.message ?? 'فشل حفظ التقرير');
    } finally {
      setArchiveLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
  }, []);

  const benchmarkVerdictClass = benchmark?.verdict === 'accepted'
    ? 'text-emerald-300 bg-emerald-950/30 border-emerald-700/30'
    : benchmark?.verdict === 'conditional'
      ? 'text-amber-300 bg-amber-950/30 border-amber-700/30'
      : 'text-rose-300 bg-rose-950/30 border-rose-700/30';

  const exportBenchmarkReport = () => {
    if (!result || !benchmark) return;

    const now = new Date().toLocaleString('ar-LY');
    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير اعتماد 3D</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #0f172a; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    h2 { font-size: 16px; margin: 18px 0 8px; }
    .muted { color: #475569; font-size: 12px; }
    .kpi { display: inline-block; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; margin: 6px 6px 0 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <h1>تقرير اعتماد 3D Analyst</h1>
  <div class="muted">وقت الإصدار: ${now}</div>
  <div class="muted">نموذج الاختبار: ${benchmark.presetName}</div>
  <div class="muted">سياسة القبول: ${benchmark.policyName} (${benchmark.policyVersion})</div>
  <div class="muted">الحكم النهائي: ${benchmark.verdict === 'accepted' ? 'مقبول' : benchmark.verdict === 'conditional' ? 'قبول مشروط' : 'مرفوض'} (${benchmark.score}%)</div>
  <div class="muted">التوقيع الرقمي للحكم: ${savedReport?.signature_sha256 ?? 'غير متاح - احفظ التقرير أولاً'}</div>

  <h2>مؤشرات التضاريس</h2>
  <div class="kpi">أدنى منسوب: ${result.terrain.min_elevation_m} م</div>
  <div class="kpi">أعلى منسوب: ${result.terrain.max_elevation_m} م</div>
  <div class="kpi">Relief: ${result.terrain.relief_m} م</div>
  <div class="kpi">Slope mean/max: ${result.terrain.slope_mean_deg}° / ${result.terrain.slope_max_deg}°</div>

  <h2>نتيجة LOS</h2>
  <div class="kpi">${result.visibility ? (result.visibility.visible ? 'خط بصر مفتوح' : 'خط بصر محجوب') : 'غير متاح'}</div>
  <div class="kpi">الانقطاع: ${result.visibility?.blocked_at_distance_m ?? 'لا يوجد'} م</div>

  <h2>Cut / Fill</h2>
  <div class="kpi">Cut: ${Math.round(result.cut_fill.cut_m3).toLocaleString('en-US')} م³</div>
  <div class="kpi">Fill: ${Math.round(result.cut_fill.fill_m3).toLocaleString('en-US')} م³</div>

  <h2>اختبارات القبول</h2>
  <table>
    <thead><tr><th>المعيار</th><th>الحالة</th><th>الملاحظة</th></tr></thead>
    <tbody>
      ${benchmark.checks.map((c) => `<tr><td>${c.label}</td><td>${c.passed ? 'مطابق' : 'غير مطابق'}</td><td>${c.note}</td></tr>`).join('')}
    </tbody>
  </table>

</body>
</html>`;

    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="p-3 space-y-3" dir="rtl">
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/25 p-3">
        <p className="text-xs font-bold text-slate-200">تحليل Terrain 3D (DEM/DSM)</p>
        <p className="text-[10px] text-slate-500 mt-1">
          تحليل إنتاجي مباشر يعتمد نموذج ارتفاع SRTM، ويحسب الانحدار والكنتور والرؤية والحفر/الردم.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-slate-500">فاصل الكنتور (م)
          <input
            type="number"
            min={5}
            max={200}
            value={contourInterval}
            onChange={(e) => setContourInterval(Number(e.target.value) || 20)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          />
        </label>
        <label className="text-[10px] text-slate-500">كثافة العينة
          <input
            type="number"
            min={7}
            max={21}
            step={2}
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value) || 11)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          />
        </label>
        <label className="text-[10px] text-slate-500">ارتفاع الراصد (م)
          <input
            type="number"
            min={0}
            max={50}
            value={observerHeight}
            onChange={(e) => setObserverHeight(Number(e.target.value) || 1.75)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          />
        </label>
        <label className="text-[10px] text-slate-500">ارتفاع الهدف (م)
          <input
            type="number"
            min={0}
            max={50}
            value={targetHeight}
            onChange={(e) => setTargetHeight(Number(e.target.value) || 1.75)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          />
        </label>
      </div>

      <label className="block text-[10px] text-slate-500">منسوب مرجعي Cut/Fill (اختياري)
        <input
          type="number"
          value={baseLevel}
          onChange={(e) => setBaseLevel(e.target.value)}
          placeholder="يُترك فارغًا لاستخدام المتوسط"
          className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
        />
      </label>

      <button
        onClick={run}
        disabled={!hasGeom || loading}
        className="w-full py-2 rounded-xl border border-indigo-600/30 bg-indigo-600/20 text-indigo-300 text-xs font-semibold hover:bg-indigo-600/30 disabled:opacity-40"
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> جارٍ التحليل...</span>
        ) : (
          'تشغيل تحليل Terrain 3D'
        )}
      </button>

      <button
        onClick={runBenchmark}
        disabled={benchmarkLoading}
        className="w-full py-2 rounded-xl border border-cyan-600/30 bg-cyan-600/15 text-cyan-300 text-xs font-semibold hover:bg-cyan-600/25 disabled:opacity-40"
      >
        {benchmarkLoading ? (
          <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> جارٍ Benchmark الاعتماد...</span>
        ) : (
          'تشغيل Benchmark الاعتماد 3D'
        )}
      </button>

      <label className="block text-[10px] text-slate-500">نموذج الـ Benchmark المعتمد
        <select
          value={activePresetId}
          onChange={(e) => setActivePresetId(e.target.value)}
          className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
        >
          {TERRAIN_3D_BENCHMARK_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.name}</option>
          ))}
        </select>
      </label>

      {!hasGeom && <p className="text-xs text-slate-600 text-center">ارسم منطقة أولاً لتفعيل تحليل 3D</p>}

      {benchmark && (
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/25 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-700/40 bg-slate-800/40 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-200">{benchmark.presetName}</p>
              <p className="text-[10px] text-slate-500">درجة الاعتماد: {benchmark.score}%</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${benchmarkVerdictClass}`}>
              {benchmark.verdict === 'accepted' ? 'مقبول' : benchmark.verdict === 'conditional' ? 'قبول مشروط' : 'مرفوض'}
            </span>
          </div>
          <div className="p-3 space-y-2">
            {benchmark.checks.map((check) => (
              <div key={check.id} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 h-2 w-2 rounded-full ${check.passed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <div>
                  <p className="text-slate-200">{check.label}</p>
                  <p className="text-slate-500 text-[10px] mt-0.5">{check.note}</p>
                </div>
              </div>
            ))}
            <button
              onClick={saveCurrentReport}
              disabled={archiveLoading}
              className="w-full mt-2 py-2 rounded-lg border border-cyan-600/30 bg-cyan-600/15 text-cyan-300 text-xs font-semibold hover:bg-cyan-600/25 disabled:opacity-40"
            >
              حفظ تقرير الاعتماد في الأرشيف الداخلي
            </button>
            <button
              onClick={exportBenchmarkReport}
              className="w-full mt-2 py-2 rounded-lg border border-slate-600/40 bg-slate-800/30 text-slate-200 text-xs font-semibold hover:bg-slate-800/50"
            >
              تصدير تقرير الاعتماد (PDF)
            </button>
            {savedReport && (
              <p className="text-[10px] text-emerald-300 mt-1">
                تم الحفظ: {new Date(savedReport.created_at).toLocaleString('ar-LY')} • توقيع: {savedReport.signature_sha256.slice(0, 16)}...
              </p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-bold text-slate-200">أرشيف تقارير الاعتماد</p>
          <button onClick={loadArchive} className="text-[10px] text-slate-400 hover:text-slate-200">تحديث</button>
        </div>
        {archiveError && <p className="text-[10px] text-rose-300 mb-2">{archiveError}</p>}
        {archiveLoading && <p className="text-[10px] text-slate-500">جارٍ تحميل الأرشيف...</p>}
        {!archiveLoading && archiveItems.length === 0 && <p className="text-[10px] text-slate-500">لا توجد تقارير محفوظة بعد</p>}
        <div className="space-y-1.5 max-h-40 overflow-auto">
          {archiveItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-700/30 bg-slate-900/30 px-2 py-1.5">
              <p className="text-[10px] text-slate-200">{item.benchmark?.presetName ?? item.benchmark?.presetId ?? 'Benchmark'}</p>
              <p className="text-[10px] text-slate-500">{new Date(item.created_at).toLocaleString('ar-LY')} • {item.benchmark?.score ?? '-'}%</p>
              <p className="text-[10px] text-slate-600">sig: {item.signature_sha256.slice(0, 14)}...</p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/30 border border-rose-800/30">
          <AlertTriangle size={12} className="text-rose-400" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
            <p className="text-[10px] text-slate-500 mb-2">مؤشرات التضاريس</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-900/40 p-2"><span className="text-slate-500">أدنى منسوب</span><p className="font-bold text-slate-200">{result.terrain.min_elevation_m} م</p></div>
              <div className="rounded-lg bg-slate-900/40 p-2"><span className="text-slate-500">أعلى منسوب</span><p className="font-bold text-slate-200">{result.terrain.max_elevation_m} م</p></div>
              <div className="rounded-lg bg-slate-900/40 p-2"><span className="text-slate-500">متوسط الانحدار</span><p className="font-bold text-slate-200">{result.terrain.slope_mean_deg}°</p></div>
              <div className="rounded-lg bg-slate-900/40 p-2"><span className="text-slate-500">أقصى انحدار</span><p className="font-bold text-slate-200">{result.terrain.slope_max_deg}°</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
            <p className="text-[10px] text-slate-500 mb-2 inline-flex items-center gap-1"><BarChart3 size={11} /> أشرطة الكنتور</p>
            <div className="space-y-1.5 max-h-40 overflow-auto">
              {result.contours.bands.slice(0, 8).map((b) => (
                <div key={b.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{b.label}</span>
                  <span className="text-slate-500">{b.coverage_pct}%</span>
                </div>
              ))}
              {result.contours.bands.length === 0 && <p className="text-xs text-slate-600">لا توجد أشرطة كنتور كافية</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
            <p className="text-[10px] text-slate-500 mb-2 inline-flex items-center gap-1"><Eye size={11} /> تحليل الرؤية</p>
            {result.visibility ? (
              <div className="text-xs space-y-1">
                <p className={result.visibility.visible ? 'text-emerald-400' : 'text-amber-400'}>
                  {result.visibility.visible ? 'خط البصر مفتوح بالكامل' : 'يوجد انقطاع في خط البصر'}
                </p>
                <p className="text-slate-500">أقرب انقطاع: {result.visibility.blocked_at_distance_m ?? 'لا يوجد'} م</p>
                <p className="text-slate-500">أدنى خلوص: {result.visibility.min_clearance_m} م</p>
              </div>
            ) : (
              <p className="text-xs text-slate-600">لم يُطلب تحليل LOS في هذا التشغيل</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-3">
            <p className="text-[10px] text-slate-500 mb-2 inline-flex items-center gap-1"><Mountain size={11} /> الحفر والردم</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-900/40 p-2"><span className="text-slate-500">Cut</span><p className="font-bold text-slate-200">{result.cut_fill.cut_m3.toLocaleString('en-US')} م³</p></div>
              <div className="rounded-lg bg-slate-900/40 p-2"><span className="text-slate-500">Fill</span><p className="font-bold text-slate-200">{result.cut_fill.fill_m3.toLocaleString('en-US')} م³</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
