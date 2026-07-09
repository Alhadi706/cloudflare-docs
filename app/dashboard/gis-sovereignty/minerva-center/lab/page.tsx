'use client';

import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  name: string;
  type: string;
  location: string;
  period: string;
  expected: string;
  has_gt: boolean;
  tags: string[];
}

interface BenchmarkResult {
  scenario_id: string;
  lab_run_id: string;
  passed: boolean;
  failure_reasons: string[];
  duration_seconds: number;
  n_frames: number;
  n_eo_observations: number;
  signal_coverage: Record<string, number>;
  detection: {
    tp: number; fp: number; tn: number; fn: number;
    precision: number; recall: number; f1: number; fpr: number;
  };
  timing: {
    detection_delay_days: number | null;
    detection_status: string;
  };
  localization: { distance_error_m: number | null; quality: string };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function MetricBadge({ value, label, good }: { value: string | number; label: string; good?: boolean }) {
  const color = good === true ? 'text-green-400' : good === false ? 'text-red-400' : 'text-blue-300';
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function ScenarioRow({ s, onRun, running }: { s: Scenario; onRun: (id: string) => void; running: boolean }) {
  const typeColors: Record<string, string> = {
    WATER_LEAK: 'bg-blue-900 text-blue-300',
    VEGETATION_LOSS: 'bg-green-900 text-green-300',
    GROUND_DEFORMATION: 'bg-yellow-900 text-yellow-300',
    CUSTOM: 'bg-gray-700 text-gray-300',
  };
  const tc = typeColors[s.type] || 'bg-gray-700 text-gray-300';
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-600 transition-colors">
      <span className={`text-xs px-2 py-1 rounded font-mono ${tc}`}>{s.type}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium truncate">{s.name}</div>
        <div className="text-xs text-gray-400">{s.period} | {s.location}</div>
      </div>
      <div className="flex items-center gap-2">
        {s.has_gt && <span className="text-xs text-green-400 font-mono">GT✓</span>}
        {s.tags.map(t => (
          <span key={t} className="text-xs bg-gray-700 text-gray-300 px-1 rounded">{t}</span>
        ))}
      </div>
      <button
        onClick={() => onRun(s.id)}
        disabled={running}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          running
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {running ? '⟳ جارٍ...' : '▶ تشغيل'}
      </button>
    </div>
  );
}

function ResultCard({ result }: { result: BenchmarkResult }) {
  const [expanded, setExpanded] = useState(false);
  const pass = result.passed;
  return (
    <div className={`rounded-lg border p-4 ${pass ? 'border-green-700 bg-green-950' : 'border-red-700 bg-red-950'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-lg ${pass ? 'text-green-400' : 'text-red-400'}`}>
            {pass ? '✅' : '❌'}
          </span>
          <span className="text-white font-medium font-mono text-sm">{result.scenario_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{result.duration_seconds.toFixed(1)}s</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {expanded ? 'طيّ ▲' : 'تفاصيل ▼'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <MetricBadge value={result.detection.f1.toFixed(3)} label="F1"
          good={result.detection.f1 >= 0.70} />
        <MetricBadge value={result.detection.precision.toFixed(3)} label="Precision"
          good={result.detection.precision >= 0.70} />
        <MetricBadge value={result.detection.recall.toFixed(3)} label="Recall"
          good={result.detection.recall >= 0.70} />
        <MetricBadge value={result.detection.fpr.toFixed(3)} label="FPR"
          good={result.detection.fpr <= 0.15} />
      </div>

      {result.failure_reasons.length > 0 && (
        <div className="mt-3 space-y-1">
          {result.failure_reasons.map((r, i) => (
            <div key={i} className="text-xs text-red-300 flex items-center gap-1">
              <span>✗</span><span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <div className="text-gray-400">الكشف:</div>
            <div className="font-mono text-gray-300">
              TP={result.detection.tp} FP={result.detection.fp} TN={result.detection.tn} FN={result.detection.fn}
            </div>
            <div className="text-gray-300">
              تأخر الكشف: {result.timing.detection_delay_days ?? 'N/A'} يوم
              ({result.timing.detection_status})
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-400">البيانات:</div>
            <div className="text-gray-300">إطارات: {result.n_frames}</div>
            <div className="text-gray-300">مشاهدات EO: {result.n_eo_observations}</div>
            <div className="font-mono text-gray-300 text-xs">
              {Object.entries(result.signal_coverage)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${k}:${v}`)
                .join(' ')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MinervaLabPage() {
  const [scenarios,      setScenarios]      = useState<Scenario[]>([]);
  const [runningId,      setRunningId]       = useState<string | null>(null);
  const [results,        setResults]         = useState<BenchmarkResult[]>([]);
  const [activeTab,      setActiveTab]       = useState<'scenarios' | 'results' | 'report'>('scenarios');
  const [loadingList,    setLoadingList]     = useState(true);
  const [reportMarkdown, setReportMarkdown]  = useState('');
  const [runningAll,     setRunningAll]      = useState(false);

  useEffect(() => {
    fetch('/api/minerva/lab/scenarios')
      .then(r => r.json())
      .then(d => setScenarios(d.scenarios || []))
      .catch(() => setScenarios([]))
      .finally(() => setLoadingList(false));
  }, []);

  const handleRun = async (scenarioId: string) => {
    setRunningId(scenarioId);
    try {
      const res = await fetch('/api/minerva/lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenarioId, version: '13.0.0' }),
      });
      const data = await res.json();
      if (data.result) {
        setResults(prev => [data.result, ...prev.filter(r => r.scenario_id !== scenarioId)]);
        setActiveTab('results');
      }
    } catch (err) {
      console.error('Lab run failed:', err);
    } finally {
      setRunningId(null);
    }
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      const res = await fetch('/api/minerva/lab/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: '13.0.0' }),
      });
      const data = await res.json();
      if (data.results)  setResults(data.results);
      if (data.report_md) setReportMarkdown(data.report_md);
      setActiveTab('results');
    } finally {
      setRunningAll(false);
    }
  };

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-blue-400">🔬</span>
            MINERVA — مختبر التحقق والقياس
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            بيئة هندسية معزولة — لا تؤثر على بيانات الإنتاج
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-1 rounded font-mono">
            LAB ENVIRONMENT
          </span>
          <button
            onClick={handleRunAll}
            disabled={runningAll || loadingList}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              runningAll
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {runningAll ? '⟳ تشغيل كل السيناريوهات...' : '▶▶ تشغيل الكل'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {results.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <MetricBadge value={results.length} label="سيناريوهات" />
          <MetricBadge value={passed} label="ناجح ✅" good={true} />
          <MetricBadge value={failed} label="فاشل ❌" good={failed === 0} />
          <MetricBadge
            value={(results.reduce((s, r) => s + r.detection.f1, 0) / results.length).toFixed(3)}
            label="متوسط F1"
            good={(results.reduce((s, r) => s + r.detection.f1, 0) / results.length) >= 0.70}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-700">
        {(['scenarios', 'results', 'report'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'scenarios' ? `📋 السيناريوهات (${scenarios.length})` :
             tab === 'results'   ? `📊 النتائج (${results.length})` :
                                    '📄 التقرير'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'scenarios' && (
        <div className="space-y-2">
          {loadingList ? (
            <div className="text-gray-400 text-sm text-center py-8">جارٍ التحميل...</div>
          ) : scenarios.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-8">
              لا توجد سيناريوهات — تحقق من API
            </div>
          ) : (
            scenarios.map(s => (
              <ScenarioRow
                key={s.id}
                s={s}
                onRun={handleRun}
                running={runningId === s.id}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-8">
              شغّل سيناريو لعرض النتائج
            </div>
          ) : (
            results.map(r => <ResultCard key={r.scenario_id + r.lab_run_id} result={r} />)
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <div className="bg-gray-900 rounded-lg p-4">
          {reportMarkdown ? (
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-[600px]">
              {reportMarkdown}
            </pre>
          ) : (
            <div className="text-gray-400 text-sm text-center py-8">
              شغّل "تشغيل الكل" لتوليد تقرير علمي كامل
            </div>
          )}
        </div>
      )}
    </div>
  );
}
