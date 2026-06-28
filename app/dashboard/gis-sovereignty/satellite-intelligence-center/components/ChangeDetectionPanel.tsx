'use client';

import React, { useState, useCallback } from 'react';
import { GitCompare, Loader2, AlertCircle, ChevronDown, ChevronUp, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import type { SceneListItem } from '@/lib/satelliteIntelAPI';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChangeCategories {
  buildings:  boolean;
  vegetation: boolean;
  roads:      boolean;
  water:      boolean;
  bare_land:  boolean;
}

interface ChangeSummary {
  total_changes: number;
  added_count: number;
  removed_count: number;
  modified_count: number;
  total_area_changed_m2: number;
  change_intensity: 'low' | 'moderate' | 'high' | 'extreme';
  dominant_category: string;
}

interface ChangeResult {
  status: 'ok';
  date_before: string;
  date_after: string;
  days_apart: number;
  summary: ChangeSummary;
  by_category: Record<string, { added: number; removed: number; modified: number; area_m2: number }>;
  geojson: { type: 'FeatureCollection'; features: any[] };
  analysis_notes: string[];
}

interface Props {
  scenes: SceneListItem[];
  drawnPolygon?: [number, number][] | null;
  onResultReady: (result: ChangeResult | null, geojson: any | null) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const INTENSITY_STYLE: Record<string, string> = {
  low:      'text-green-400',
  moderate: 'text-yellow-400',
  high:     'text-orange-400',
  extreme:  'text-rose-400',
};
const INTENSITY_AR: Record<string, string> = {
  low: 'منخفضة', moderate: 'متوسطة', high: 'مرتفعة', extreme: 'شديدة',
};
const TYPE_COLOR: Record<string, string> = {
  added:    'bg-green-500',
  removed:  'bg-red-500',
  modified: 'bg-amber-500',
};
const TYPE_AR: Record<string, string> = {
  added: 'جديد', removed: 'مُزال', modified: 'مُعدَّل',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ChangeDetectionPanel({ scenes, drawnPolygon, onResultReady }: Props) {
  const [sceneBefore, setSceneBefore] = useState(scenes[2]?.scene_uid ?? '');
  const [sceneAfter,  setSceneAfter]  = useState(scenes[0]?.scene_uid ?? '');
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [categories,  setCategories]  = useState<ChangeCategories>({
    buildings: true, vegetation: true, roads: true, water: false, bare_land: false,
  });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<ChangeResult | null>(null);
  const [showOnMap, setShowOnMap] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const toggleCat = (k: keyof ChangeCategories) => setCategories(p => ({ ...p, [k]: !p[k] }));

  const dateBefore = scenes.find(s => s.scene_uid === sceneBefore)?.acquisition_date ?? '';
  const dateAfter  = scenes.find(s => s.scene_uid === sceneAfter)?.acquisition_date  ?? '';

  const handleRun = useCallback(async () => {
    if (!sceneBefore || !sceneAfter || sceneBefore === sceneAfter) {
      setError('اختر صورتين مختلفتين للمقارنة');
      return;
    }
    setLoading(true); setError(null); setResult(null); onResultReady(null, null);

    // Build bbox from drawn polygon if available
    let bbox: [number, number, number, number] | undefined;
    if (drawnPolygon && drawnPolygon.length >= 3) {
      const lons = drawnPolygon.map(p => p[0]), lats = drawnPolygon.map(p => p[1]);
      bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    }

    try {
      const res = await fetch('/api/gis/change-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene_before: sceneBefore, scene_after: sceneAfter,
          date_before: dateBefore, date_after: dateAfter, sensitivity, categories, bbox }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data: ChangeResult = await res.json();
      setResult(data);
      setShowOnMap(true);
      onResultReady(data, data.geojson);
    } catch (e: any) {
      setError(e?.message ?? 'فشل التحليل');
    } finally {
      setLoading(false);
    }
  }, [sceneBefore, sceneAfter, dateBefore, dateAfter, sensitivity, categories, drawnPolygon, onResultReady]);

  const handleClear = () => { setResult(null); setError(null); onResultReady(null, null); };

  const handleToggleMap = () => {
    setShowOnMap(p => {
      onResultReady(result, p ? null : result?.geojson ?? null);
      return !p;
    });
  };

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GitCompare size={14} className="text-cyan-400 shrink-0" />
        <span className="text-[12px] font-bold text-slate-200">كشف التغيير</span>
        <span className="text-[9px] text-slate-500 mr-auto">مقارنة صورتين فضائيتين</span>
      </div>

      {/* Scene selectors */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-2">
        <p className="text-[10px] text-slate-400 font-semibold">الصورتان المقارنتان</p>
        <div className="space-y-1.5">
          <div>
            <label className="text-[9px] text-slate-500 block mb-0.5">الصورة القديمة (قبل)</label>
            <select
              value={sceneBefore}
              onChange={e => setSceneBefore(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 px-2 py-1.5 focus:outline-none focus:border-blue-500"
            >
              {scenes.map(s => (
                <option key={s.scene_uid} value={s.scene_uid}>
                  {s.acquisition_date ?? s.scene_uid.slice(0, 20)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-slate-500 block mb-0.5">الصورة الحديثة (بعد)</label>
            <select
              value={sceneAfter}
              onChange={e => setSceneAfter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 px-2 py-1.5 focus:outline-none focus:border-blue-500"
            >
              {scenes.map(s => (
                <option key={s.scene_uid} value={s.scene_uid}>
                  {s.acquisition_date ?? s.scene_uid.slice(0, 20)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {drawnPolygon && (
          <p className="text-[9px] text-emerald-400">✓ سيتم تطبيق المقارنة على المنطقة المرسومة</p>
        )}
      </div>

      {/* Sensitivity */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-1.5">
        <p className="text-[10px] text-slate-400 font-semibold">حساسية الكشف</p>
        <div className="grid grid-cols-3 gap-1">
          {(['low', 'medium', 'high'] as const).map(s => (
            <button key={s} onClick={() => setSensitivity(s)}
              className={`py-1 rounded text-[10px] border transition-colors ${
                sensitivity === s
                  ? 'bg-cyan-700/50 border-cyan-500 text-cyan-200'
                  : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-slate-500'
              }`}>
              {s === 'low' ? 'منخفضة' : s === 'medium' ? 'متوسطة' : 'عالية'}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-slate-600">
          {sensitivity === 'low' ? 'تغييرات كبيرة فقط — أقل false-positives' :
           sensitivity === 'medium' ? 'توازن بين الدقة والشمولية' :
           'كشف كل التغييرات بما فيها الصغيرة'}
        </p>
      </div>

      {/* Categories */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-1.5">
        <p className="text-[10px] text-slate-400 font-semibold">فئات الكشف</p>
        {([
          { key: 'buildings',  label: 'مبانٍ وإنشاءات',    color: 'text-orange-400' },
          { key: 'vegetation', label: 'غطاء نباتي',         color: 'text-green-400' },
          { key: 'roads',      label: 'طرق وممرات',         color: 'text-blue-400' },
          { key: 'water',      label: 'مجاري مائية',         color: 'text-cyan-400' },
          { key: 'bare_land',  label: 'أرض مكشوفة',          color: 'text-amber-400' },
        ] as const).map(({ key, label, color }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer group">
            <div onClick={() => toggleCat(key)}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                categories[key] ? 'bg-cyan-600 border-cyan-500' : 'bg-slate-800 border-slate-600'
              }`}>
              {categories[key] && <CheckCircle2 size={9} className="text-white" />}
            </div>
            <span className={`text-[9px] ${color}`}>■</span>
            <span className="text-[10px] text-slate-300 select-none">{label}</span>
          </label>
        ))}
      </div>

      {/* Run */}
      <button onClick={handleRun} disabled={loading || !sceneBefore || !sceneAfter}
        className="w-full py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-[11px] font-bold flex items-center justify-center gap-2 transition-colors">
        {loading ? <Loader2 size={13} className="animate-spin" /> : <GitCompare size={13} />}
        {loading ? 'جارٍ التحليل...' : 'كشف التغييرات'}
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
        <div className="space-y-2">
          {/* Summary bar */}
          <div className="rounded-lg border border-cyan-800/40 bg-slate-800/60 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-200">نتائج المقارنة</span>
              <div className="flex items-center gap-1">
                <button onClick={handleToggleMap}
                  className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded border border-slate-700 transition-colors">
                  {showOnMap ? <Eye size={9} /> : <EyeOff size={9} />}
                  {showOnMap ? 'مرئي' : 'مخفي'}
                </button>
                <button onClick={handleClear} className="text-slate-600 hover:text-slate-300 text-[10px]">✕</button>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <div className="text-center rounded bg-slate-900/60 py-1.5">
                <div className="text-[14px] font-bold text-slate-100">{result.summary.total_changes}</div>
                <div className="text-[9px] text-slate-500">تغيير مرصود</div>
              </div>
              <div className="text-center rounded bg-slate-900/60 py-1.5">
                <div className={`text-[12px] font-bold ${INTENSITY_STYLE[result.summary.change_intensity]}`}>
                  {INTENSITY_AR[result.summary.change_intensity]}
                </div>
                <div className="text-[9px] text-slate-500">شدة التغيير</div>
              </div>
              <div className="text-center rounded bg-slate-900/60 py-1.5">
                <div className="text-[12px] font-bold text-slate-200">{result.days_apart}</div>
                <div className="text-[9px] text-slate-500">يوم بين الصورتين</div>
              </div>
            </div>

            {/* Change type breakdown */}
            <div className="flex gap-2 mb-2">
              {(['added', 'removed', 'modified'] as const).map(t => {
                const count = t === 'added' ? result.summary.added_count :
                              t === 'removed' ? result.summary.removed_count :
                              result.summary.modified_count;
                return (
                  <div key={t} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${TYPE_COLOR[t]}`} />
                    <span className="text-[9px] text-slate-400">{TYPE_AR[t]}: <span className="text-slate-200 font-semibold">{count}</span></span>
                  </div>
                );
              })}
            </div>

            {/* By category */}
            <button onClick={() => setExpanded(p => !p)}
              className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300 w-full">
              {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
              تفصيل حسب الفئة
            </button>
            {expanded && (
              <div className="mt-1.5 space-y-1">
                {Object.entries(result.by_category).map(([cat, stats]) => (
                  <div key={cat} className="flex items-center gap-2 text-[9px]">
                    <span className="text-slate-400 w-20 truncate">{cat}</span>
                    <div className="flex gap-1.5 flex-1">
                      <span className="text-green-400">+{stats.added}</span>
                      <span className="text-red-400">-{stats.removed}</span>
                      <span className="text-amber-400">~{stats.modified}</span>
                    </div>
                    <span className="text-slate-600">{(stats.area_m2 / 1000).toFixed(1)} ألف م²</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-2.5 space-y-1">
            {result.analysis_notes.map((n, i) => (
              <p key={i} className="text-[9px] text-slate-400 leading-relaxed">{n}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
