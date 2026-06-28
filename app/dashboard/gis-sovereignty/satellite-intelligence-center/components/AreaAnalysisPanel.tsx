'use client';
import React, { useState } from 'react';
import { MapPin, Play, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import {
  getSceneSummary,
  type SceneSummaryContract,
  type SceneListItem,
  type WorkflowInfo,
} from '@/lib/satelliteIntelAPI';
import SceneSelector from './SceneSelector';
import SceneSummaryCard from './SceneSummaryCard';
import ConfidenceBadge from './ConfidenceBadge';

interface Props {
  scenes: SceneListItem[];
  workflows: WorkflowInfo[];
  scenesLoading?: boolean;
}

export default function AreaAnalysisPanel({ scenes, workflows, scenesLoading }: Props) {
  const [selectedScene, setSelectedScene] = useState<string>('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('environment_summary');
  const [result, setResult] = useState<SceneSummaryContract | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!selectedScene) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await getSceneSummary(selectedScene, selectedWorkflow);
      setResult(res.summary);
    } catch (e: any) {
      setError(e.message ?? 'فشل تشغيل التحليل');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <MapPin className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-slate-200">تحليل المنطقة</h2>
      </div>

      {/* Controls */}
      <div className="space-y-3 mb-4 shrink-0">
        <SceneSelector
          scenes={scenes}
          selectedUid={selectedScene}
          onSelect={setSelectedScene}
          loading={scenesLoading}
        />

        {/* Workflow selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400">سير العمل</label>
          <div className="grid grid-cols-1 gap-1.5">
            {/* Always show environment_summary plus workflow list */}
            {[
              { workflow_key: 'environment_summary', description: 'ملخص بيئي شامل (S5)', indicators: [], intel_outputs: [], needs_compare: false },
              ...workflows.filter(w => !w.needs_compare),
            ].map(w => (
              <button
                key={w.workflow_key}
                onClick={() => setSelectedWorkflow(w.workflow_key)}
                className={`text-right px-3 py-2 rounded-lg border text-[10px] font-mono transition-colors ${
                  selectedWorkflow === w.workflow_key
                    ? 'bg-emerald-950/50 border-emerald-600/50 text-emerald-300'
                    : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span className="font-semibold text-slate-200">{w.workflow_key}</span>
                <br />
                <span className="opacity-70">{w.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={!selectedScene || running}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-600/40 rounded-xl text-sm font-semibold text-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> جارٍ التحليل...</>
          ) : (
            <><Play className="w-4 h-4" /> تشغيل التحليل</>
          )}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {error && (
          <div className="flex items-start gap-2 bg-rose-950/30 border border-rose-700/40 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="text-xs text-rose-400">{error}</p>
          </div>
        )}

        {result && !running && (
          <>
            <div className="flex items-center gap-2 px-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">اكتمل التحليل</span>
              <ConfidenceBadge value={result.quality.confidence_class} />
            </div>
            <SceneSummaryCard summary={result} compact={false} />
          </>
        )}

        {!result && !running && !error && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <MapPin className="w-7 h-7 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">اختر مشهداً وسير عمل ثم اضغط تشغيل</p>
          </div>
        )}
      </div>
    </div>
  );
}
