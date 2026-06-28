'use client';
import React, { useState } from 'react';
import { Zap, Play, RefreshCw, AlertCircle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { runWorkflow, type WorkflowInfo, type SceneListItem } from '@/lib/satelliteIntelAPI';
import SceneSelector from './SceneSelector';

interface WorkflowResult {
  workflow_key: string;
  results: any[];
  ran_at: string;
}

interface Props {
  scenes: SceneListItem[];
  workflows: WorkflowInfo[];
  scenesLoading?: boolean;
}

function WorkflowCard({
  wf,
  onRun,
  running,
  disabled,
}: {
  wf: WorkflowInfo;
  onRun: (key: string) => void;
  running: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-slate-800/60 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-mono font-bold text-slate-200">{wf.workflow_key}</p>
            <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{wf.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {wf.needs_compare && (
            <span className="text-[9px] bg-purple-950/60 text-purple-400 border border-purple-700/40 px-1.5 py-0.5 rounded-full font-mono">
              مقارنة
            </span>
          )}
          {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-slate-700/40 pt-2.5 space-y-2">
          <div className="flex flex-wrap gap-1">
            {wf.indicators.map(ind => (
              <span key={ind} className="text-[9px] bg-blue-950/50 text-blue-400 border border-blue-700/40 px-1.5 py-0.5 rounded font-mono">
                {ind.toUpperCase()}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {wf.intel_outputs.map(out => (
              <span key={out} className="text-[9px] bg-emerald-950/50 text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded font-mono">
                {out}
              </span>
            ))}
          </div>
          {!wf.needs_compare && (
            <button
              onClick={() => onRun(wf.workflow_key)}
              disabled={disabled || running}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-yellow-700/20 hover:bg-yellow-700/40 border border-yellow-600/30 rounded-lg text-xs font-semibold text-yellow-300 transition-colors disabled:opacity-40"
            >
              {running ? (
                <><RefreshCw className="w-3 h-3 animate-spin" /> تشغيل...</>
              ) : (
                <><Play className="w-3 h-3" /> تشغيل</>
              )}
            </button>
          )}
          {wf.needs_compare && (
            <p className="text-[9px] text-slate-500 text-center py-1">
              استخدم لوحة المقارنة الزمنية لهذا سير العمل
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultsBlock({ result }: { result: WorkflowResult }) {
  return (
    <div className="bg-slate-800/30 border border-emerald-700/30 rounded-xl p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-300">{result.workflow_key}</span>
        <span className="text-[9px] text-slate-500 font-mono">{result.ran_at}</span>
      </div>
      <div className="space-y-1.5">
        {result.results.map((r: any, i: number) => (
          <div key={i} className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-slate-300">
                {r.indicator_type?.toUpperCase() ?? r.output_type ?? `نتيجة ${i + 1}`}
              </span>
              {r.mean !== undefined && (
                <span className="text-[10px] font-mono text-blue-300">{Number(r.mean).toFixed(3)}</span>
              )}
              {r.classification && (
                <span className="text-[10px] font-mono text-amber-300">{r.classification}</span>
              )}
            </div>
            {r.effective_classification && r.effective_classification !== r.classification && (
              <p className="text-[9px] text-slate-500 mt-0.5">
                فعّال: {r.effective_classification} (خُفِّض)
              </p>
            )}
            {r.semantic_level && (
              <p className="text-[9px] text-slate-500">
                المستوى الدلالي: {r.semantic_level}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkflowExecutionPanel({ scenes, workflows, scenesLoading }: Props) {
  const [selectedScene, setSelectedScene] = useState<string>('');
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [results, setResults] = useState<WorkflowResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (workflowKey: string) => {
    if (!selectedScene) {
      setError('الرجاء اختيار مشهد أولاً');
      return;
    }
    setRunningKey(workflowKey);
    setError(null);
    try {
      const res = await runWorkflow(selectedScene, workflowKey);
      setResults(prev => [
        {
          workflow_key: workflowKey,
          results: res.results ?? [],
          ran_at: new Date().toLocaleTimeString('ar'),
        },
        ...prev.slice(0, 4),
      ]);
    } catch (e: any) {
      setError(e.message ?? 'فشل تشغيل سير العمل');
    } finally {
      setRunningKey(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h2 className="text-sm font-semibold text-slate-200">تنفيذ سير العمل</h2>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-950/60 text-yellow-400 border border-yellow-700/40 font-mono">
          {workflows.length} متاح
        </span>
      </div>

      {/* Scene selector */}
      <div className="mb-3 shrink-0">
        <SceneSelector
          scenes={scenes}
          selectedUid={selectedScene}
          onSelect={val => { setSelectedScene(val); setError(null); }}
          loading={scenesLoading}
        />
        {!selectedScene && (
          <p className="text-[10px] text-amber-400/70 mt-1">اختر مشهداً لتفعيل التشغيل</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-rose-950/30 border border-rose-700/40 rounded-xl p-3 mb-3 shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}

      {/* Workflow list */}
      <div className="space-y-2 mb-4 shrink-0">
        {workflows.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">جارٍ تحميل سير العمل...</div>
        ) : (
          workflows.map(wf => (
            <WorkflowCard
              key={wf.workflow_key}
              wf={wf}
              onRun={handleRun}
              running={runningKey === wf.workflow_key}
              disabled={!selectedScene}
            />
          ))
        )}
      </div>

      {/* Results history */}
      {results.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          <p className="text-[11px] font-semibold text-slate-400 shrink-0">نتائج أحدث التشغيلات</p>
          {results.map((r, i) => <ResultsBlock key={i} result={r} />)}
        </div>
      )}
    </div>
  );
}
