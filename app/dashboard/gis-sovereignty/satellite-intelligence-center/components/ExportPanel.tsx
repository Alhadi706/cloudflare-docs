'use client';
// ─── ExportPanel ──────────────────────────────────────────────────────────────
// Exports scene summaries and comparison contracts as downloadable JSON
// Placed inside the SIC as a collapsible panel

import React, { useState } from 'react';
import { Download, RefreshCw, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import {
  getSceneSummary,
  getComparisonSummary,
  type SceneListItem,
} from '@/lib/satelliteIntelAPI';

interface ExportPanelProps {
  scenes: SceneListItem[];
  activeScene: string | null;
}

export function ExportPanel({ scenes, activeScene }: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string>(scenes[0]?.scene_uid ?? '');
  const [compareB, setCompareB] = useState<string>(scenes[1]?.scene_uid ?? '');

  // ── Helpers ──────────────────────────────────────────────────────────────
  function downloadBlob(data: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Export scene summary ─────────────────────────────────────────────────
  async function handleExportSceneSummary() {
    if (!activeScene) return;
    setExporting(true);
    setError(null);
    try {
      const data = await getSceneSummary(activeScene);
      downloadBlob(data, `scene-summary-${activeScene}-${new Date().toISOString().slice(0, 10)}.json`);
      setLastExport(`scene-summary-${activeScene}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل تصدير ملخص المشهد');
    } finally {
      setExporting(false);
    }
  }

  // ── Export comparison contract ───────────────────────────────────────────
  async function handleExportComparison(sceneUidA: string, sceneUidB: string) {
    setExporting(true);
    setError(null);
    try {
      const data = await getComparisonSummary(sceneUidA, sceneUidB);
      downloadBlob(data, `comparison-${sceneUidA}-vs-${sceneUidB}-${new Date().toISOString().slice(0, 10)}.json`);
      setLastExport(`comparison-${sceneUidA.slice(0,8)}-vs-${sceneUidB.slice(0,8)}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل تصدير نتيجة المقارنة');
    } finally {
      setExporting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-700 p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <Download className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">تصدير البيانات الاستخباراتية</h3>
          <p className="text-xs text-slate-500 mt-0.5">تنزيل ملخصات المشاهد وعقود المقارنة بصيغة JSON</p>
        </div>
      </div>

      {/* Export current scene summary */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400">ملخص المشهد النشط</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 px-3 py-2 bg-slate-800 rounded-xl border border-slate-700 text-xs text-slate-300 truncate font-mono">
            {activeScene ?? 'لم يُختَر مشهد'}
          </div>
          <button
            onClick={handleExportSceneSummary}
            disabled={!activeScene || exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-semibold text-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            تصدير JSON
          </button>
        </div>
      </div>

      {/* Export comparison */}
      <div className="space-y-2 border-t border-slate-800 pt-4">
        <p className="text-xs font-semibold text-slate-400">تصدير مقارنة مشهدين</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">مشهد A (قبل)</label>
            <select
              value={compareA}
              onChange={e => setCompareA(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              {scenes.map(s => (
                <option key={s.scene_uid} value={s.scene_uid}>{s.scene_uid.slice(0, 30)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">مشهد B (بعد)</label>
            <select
              value={compareB}
              onChange={e => setCompareB(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              {scenes.map(s => (
                <option key={s.scene_uid} value={s.scene_uid}>{s.scene_uid.slice(0, 30)}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => handleExportComparison(compareA, compareB)}
          disabled={!compareA || !compareB || compareA === compareB || exporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-semibold text-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          تصدير المقارنة JSON
        </button>
      </div>

      {/* Status */}
      {lastExport && !error && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          تم تنزيل: {lastExport}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
