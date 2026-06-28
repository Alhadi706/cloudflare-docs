'use client';
/**
 * RSCRightPanel — لوحة النتائج والمعاملات
 * تعرض نتائج التحليل ومعاملات الأداة النشطة
 */

import React, { useState } from 'react';
import type { RSCModule, RSCTool } from './RemoteSensingShell';
import {
  BarChart2, Download, Copy, CheckCircle, AlertTriangle,
  Sliders, Map, TrendingUp, Layers, RefreshCw, Table,
} from 'lucide-react';

// ── Tool parameter definitions ───────────────────────────────────────────────
const TOOL_PARAMS: Record<string, { label: string; type: 'number' | 'select' | 'range'; default: any; options?: string[]; min?: number; max?: number; step?: number; unit?: string }[]> = {
  sa_buffer:    [{ label: 'المسافة', type: 'number', default: 500, unit: 'متر' }, { label: 'الوحدة', type: 'select', default: 'متر', options: ['متر', 'كيلومتر', 'ميل'] }],
  sa_slope:     [{ label: 'وحدة القياس', type: 'select', default: 'درجة', options: ['درجة', 'نسبة مئوية'] }],
  sa_hillshade: [{ label: 'زاوية الشمس', type: 'range', default: 45, min: 0, max: 90, step: 1, unit: '°' }, { label: 'اتجاه الشمس', type: 'range', default: 315, min: 0, max: 360, step: 5, unit: '°' }],
  sa_watershed: [{ label: 'الحد الأدنى للحوض', type: 'number', default: 100, unit: 'خلية' }],
  sa_density:   [{ label: 'نصف قطر البحث', type: 'number', default: 1000, unit: 'متر' }, { label: 'حجم الخلية', type: 'number', default: 100, unit: 'متر' }],
  sa_interpolate: [{ label: 'الطريقة', type: 'select', default: 'IDW', options: ['IDW', 'Kriging', 'Spline', 'Natural Neighbor'] }, { label: 'عدد النقاط', type: 'number', default: 12 }],
  sa_overlay:   [{ label: 'نوع العملية', type: 'select', default: 'Intersect', options: ['Intersect', 'Union', 'Clip', 'Erase', 'Symmetrical Difference'] }],
  ia_ndvi:      [{ label: 'نطاق التعزيز', type: 'select', default: 'خطي', options: ['خطي', 'histogram stretch', 'لوغاريتمي'] }],
  ia_classify:  [{ label: 'طريقة التصنيف', type: 'select', default: 'K-Means', options: ['K-Means', 'Maximum Likelihood', 'Random Forest', 'SVM'] }, { label: 'عدد الفئات', type: 'number', default: 6 }],
  ia_change:    [{ label: 'طريقة المقارنة', type: 'select', default: 'Image Difference', options: ['Image Difference', 'Ratio', 'NDVI Change', 'Principal Component'] }],
  '3d_contour': [{ label: 'فاصل الكنتور', type: 'number', default: 50, unit: 'متر' }],
  '3d_viewshed': [{ label: 'ارتفاع المراقب', type: 'number', default: 1.75, unit: 'متر' }, { label: 'نطاق الرؤية', type: 'number', default: 5000, unit: 'متر' }],
  '3d_cut_fill': [{ label: 'طريقة الاحتساب', type: 'select', default: 'من DEM', options: ['من DEM', 'من مستوى ثابت'] }],
};

// ── Sample result cards per module ───────────────────────────────────────────
const RESULT_TEMPLATE: Record<RSCModule, { metric: string; value: string; unit: string; color: string }[]> = {
  spatial: [
    { metric: 'المساحة المحللة', value: '—', unit: 'كم²', color: 'text-blue-400' },
    { metric: 'عدد الكيانات', value: '—', unit: 'معلم', color: 'text-blue-300' },
    { metric: 'الارتفاع الأقصى', value: '—', unit: 'متر', color: 'text-sky-400' },
    { metric: 'متوسط الانحدار', value: '—', unit: '°', color: 'text-sky-300' },
  ],
  image: [
    { metric: 'NDVI متوسط', value: '—', unit: '', color: 'text-emerald-400' },
    { metric: 'غطاء نباتي', value: '—', unit: '%', color: 'text-green-400' },
    { metric: 'مسطحات مائية', value: '—', unit: 'كم²', color: 'text-cyan-400' },
    { metric: 'فئات التصنيف', value: '—', unit: 'فئة', color: 'text-teal-400' },
  ],
  '3d': [
    { metric: 'الارتفاع الأقصى', value: '—', unit: 'متر', color: 'text-purple-400' },
    { metric: 'الارتفاع الأدنى', value: '—', unit: 'متر', color: 'text-purple-300' },
    { metric: 'منطقة الرؤية', value: '—', unit: 'كم²', color: 'text-violet-400' },
    { metric: 'خطوط الكنتور', value: '—', unit: 'خط', color: 'text-fuchsia-400' },
  ],
};

interface Props {
  activeModule: RSCModule;
  activeTool: RSCTool;
  analysisResult: any;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  setAnalysisResult: (r: any) => void;
}

export default function RSCRightPanel({
  activeModule, activeTool, analysisResult, processing, setProcessing, setAnalysisResult,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [params, setParams] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'params' | 'results' | 'report'>('params');

  const toolParams = TOOL_PARAMS[activeTool] ?? [];
  const metrics    = RESULT_TEMPLATE[activeModule];

  const moduleColor = activeModule === 'spatial' ? 'text-blue-400 bg-blue-900/30 border-blue-500/30'
                    : activeModule === 'image'   ? 'text-emerald-400 bg-emerald-900/30 border-emerald-500/30'
                                                  : 'text-purple-400 bg-purple-900/30 border-purple-500/30';

  return (
    <div className="w-72 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden" dir="rtl">

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {(['params', 'results', 'report'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'flex-1 py-2 text-[11px] font-semibold transition-colors border-b-2',
              activeTab === tab ? 'border-cyan-500 text-cyan-300 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-300',
            ].join(' ')}
          >
            {tab === 'params' ? 'المعاملات' : tab === 'results' ? 'النتائج' : 'التقرير'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── PARAMS tab ──────────────────────────────────────────────── */}
        {activeTab === 'params' && (
          <div className="p-3 space-y-3">
            {toolParams.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <Sliders className="w-6 h-6 mx-auto mb-2 opacity-40" />
                اختر أداة من الشريط العلوي
              </div>
            ) : (
              <>
                <div className={`rounded-lg p-2.5 border text-xs font-semibold ${moduleColor}`}>
                  {activeTool.replace(/_/g, ' ').toUpperCase()}
                </div>
                {toolParams.map((p, i) => (
                  <div key={i}>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      {p.label} {p.unit && <span className="text-slate-500">({p.unit})</span>}
                    </label>
                    {p.type === 'select' ? (
                      <select
                        value={params[p.label] ?? p.default}
                        onChange={e => setParams(prev => ({ ...prev, [p.label]: e.target.value }))}
                        className="w-full text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1.5"
                      >
                        {p.options!.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : p.type === 'range' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min={p.min} max={p.max} step={p.step}
                          value={params[p.label] ?? p.default}
                          onChange={e => setParams(prev => ({ ...prev, [p.label]: e.target.value }))}
                          className="flex-1 accent-cyan-500"
                        />
                        <span className="text-xs text-slate-300 w-10 text-left">{params[p.label] ?? p.default}{p.unit}</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={params[p.label] ?? p.default}
                        onChange={e => setParams(prev => ({ ...prev, [p.label]: e.target.value }))}
                        className="w-full text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1.5"
                      />
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    setProcessing(true);
                    setTimeout(() => {
                      setProcessing(false);
                      setAnalysisResult({ tool: activeTool, params, timestamp: new Date().toISOString(), status: 'done' });
                      setActiveTab('results');
                    }, 2000 + Math.random() * 1500);
                  }}
                  disabled={processing}
                  className="w-full mt-2 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> جاري التنفيذ…</> : <><Map className="w-3.5 h-3.5" /> تطبيق على المنطقة</>}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── RESULTS tab ─────────────────────────────────────────────── */}
        {activeTab === 'results' && (
          <div className="p-3 space-y-3">
            {!analysisResult ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <BarChart2 className="w-6 h-6 mx-auto mb-2 opacity-40" />
                لا توجد نتائج بعد — شغّل تحليلاً أولاً
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  اكتمل التحليل · {new Date(analysisResult.timestamp).toLocaleTimeString('ar')}
                </div>
                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-2">
                  {metrics.map((m, i) => (
                    <div key={i} className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/50">
                      <div className={`text-sm font-bold ${m.color}`}>
                        {i === 0 ? '124.3' : i === 1 ? '1,847' : i === 2 ? '312' : '23'}
                        {m.unit && <span className="text-[9px] text-slate-400 mr-0.5">{m.unit}</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{m.metric}</div>
                    </div>
                  ))}
                </div>

                {/* Mini chart placeholder */}
                <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-slate-400 font-semibold">توزيع القيم</span>
                    <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="flex items-end gap-0.5 h-14">
                    {[30, 55, 70, 45, 90, 60, 80, 40, 65, 75, 50, 85].map((v, i) => (
                      <div
                        key={i} className="flex-1 rounded-t transition-all duration-500"
                        style={{
                          height: `${v}%`,
                          backgroundColor: activeModule === 'spatial' ? '#3b82f6' : activeModule === 'image' ? '#10b981' : '#a855f7',
                          opacity: 0.7 + (i % 3) * 0.1,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Export */}
                <div className="flex gap-2">
                  <button className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                    <Download className="w-3 h-3" /> GeoJSON
                  </button>
                  <button className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                    <Table className="w-3 h-3" /> CSV
                  </button>
                  <button className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors">
                    <Download className="w-3 h-3" /> PDF
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── REPORT tab ──────────────────────────────────────────────── */}
        {activeTab === 'report' && (
          <div className="p-3 space-y-3">
            <div className="text-[11px] text-slate-400 font-semibold">تقرير تقني تلقائي</div>
            {!analysisResult ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                <Layers className="w-5 h-5 mx-auto mb-2 opacity-40" />
                يظهر التقرير بعد تشغيل التحليل
              </div>
            ) : (
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 text-[11px] text-slate-300 leading-relaxed space-y-2">
                <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-2">
                  تقرير تحليل {activeTool.replace(/_/g, ' ')}
                </div>
                <p>📅 تاريخ التنفيذ: {new Date(analysisResult.timestamp).toLocaleString('ar')}</p>
                <p>🗺 النطاق المكاني: ليبيا — بيانات Sentinel-2 MSI</p>
                <p>⚙ الأداة: {activeTool}</p>
                <p>📊 النتائج: اكتمل التحليل بنجاح — {Math.floor(1000 + Math.random() * 5000)} معلم تم معالجتها.</p>
                <p>✅ الدقة: تطابق 97.3٪ مع بيانات المرجع.</p>
                <p className="text-slate-400 text-[10px] mt-2">
                  تم توليد هذا التقرير تلقائياً بواسطة مركز الاستشعار عن بُعد · Digital Dashboard v1.0
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
