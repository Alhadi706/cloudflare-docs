'use client';
/**
 * ContextBrokerPanel.tsx
 * ======================
 * Spatiotemporal Context Broker UI — Phase S9
 *
 * Displays structured context from /api/v1/context-broker
 * with explicit source_type badges for every metric.
 *
 * Width: designed for the 320px right panel.
 */

import React, { useCallback, useState } from 'react';
import {
  Brain, Download, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, MinusCircle, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  requestAreaContext,
  requestSceneContext,
  downloadBrainReadyJSON,
  ContextBrokerError,
} from '@/lib/contextBrokerClient';
import {
  defaultDateRange,
  formatDateAr,
  formatTemporalGapAr,
  classifyTemporalMatch,
} from '@/lib/temporalContextHelper';
import type {
  ContextResponse,
  ContextGroupId,
  ContextMetric,
  ContextGroup,
  RecommendationSeverity,
} from '@/lib/contextBrokerTypes';
import {
  SOURCE_TYPE_AR,
  SOURCE_TYPE_COLOR,
  SEVERITY_COLOR,
  TEMPORAL_MATCH_COLOR,
} from '@/lib/contextBrokerTypes';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  sceneUid:     string | null;
  drawnPolygon: [number, number][] | null;
}

// ─── All context groups ────────────────────────────────────────────────────────

const ALL_GROUPS: { id: ContextGroupId; label: string }[] = [
  { id: 'vegetation',       label: 'النبات' },
  { id: 'water',            label: 'المياه' },
  { id: 'built_environment',label: 'العمران' },
  { id: 'thermal',          label: 'الحرارة' },
  { id: 'inferred_needs',   label: 'الاحتياجات' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function SourceBadge({ type }: { type: string }) {
  const label = SOURCE_TYPE_AR[type as keyof typeof SOURCE_TYPE_AR] ?? type;
  const cls   = SOURCE_TYPE_COLOR[type as keyof typeof SOURCE_TYPE_COLOR]
    ?? 'bg-slate-700 text-slate-300';
  return (
    <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
}

function MetricRow({ m }: { m: ContextMetric }) {
  const isUnavailable = m.source_type === 'unavailable';
  const valStr = m.value === null ? '—' : String(m.value);

  return (
    <div className={`flex items-start gap-2 py-1.5 px-2 rounded ${
      isUnavailable ? 'opacity-50' : ''
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 truncate">{m.label}</span>
          {m.unit && <span className="text-[9px] text-slate-600">{m.unit}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[12px] font-semibold ${
            isUnavailable ? 'text-slate-600 italic' : 'text-slate-200'
          }`}>
            {valStr}
          </span>
          <SourceBadge type={m.source_type} />
        </div>
        {m.trigger_rule && (
          <p className="text-[9px] text-purple-400 mt-0.5 leading-tight">
            قاعدة: {m.trigger_rule}
          </p>
        )}
        {m.note && (
          <p className="text-[9px] text-slate-600 mt-0.5 leading-tight">{m.note}</p>
        )}
      </div>
    </div>
  );
}

function CollapsibleGroup({ group, defaultOpen = true }: { group: ContextGroup; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const unavailableCount = group.items.filter(i => i.source_type === 'unavailable').length;
  const availableCount   = group.items.length - unavailableCount;

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden mb-2">
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/40 hover:bg-slate-800/60 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-1.5">
          {open ? <ChevronDown size={11} className="text-slate-500" /> : <ChevronRight size={11} className="text-slate-500" />}
          <span className="text-[12px] font-semibold text-slate-300">{group.group_title}</span>
        </div>
        <span className="text-[9px] text-slate-600">
          {availableCount} متوفر / {unavailableCount} غير متوفر
        </span>
      </button>
      {open && (
        <div className="divide-y divide-slate-800/40">
          {group.items.map(item => (
            <MetricRow key={item.id} m={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Severity icon ─────────────────────────────────────────────────────────────

function SeverityDot({ sev }: { sev: RecommendationSeverity }) {
  const cls = {
    critical: 'bg-red-500',
    high:     'bg-orange-500',
    medium:   'bg-yellow-500',
    low:      'bg-blue-400',
    info:     'bg-slate-400',
  }[sev] ?? 'bg-slate-400';
  return <span className={`w-2 h-2 rounded-full shrink-0 ${cls}`} />;
}

// ─── Temporal match strip ──────────────────────────────────────────────────────

function TemporalStrip({ response }: { response: ContextResponse }) {
  const tc  = response.temporal_context;
  const cls = TEMPORAL_MATCH_COLOR[tc.match_class] ?? 'text-slate-400';
  const gap = tc.temporal_gap_days;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/30 border border-slate-700/40 rounded-lg">
      <Clock size={12} className={cls} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold ${cls}`}>{tc.match_class_ar}</span>
          {gap !== null && (
            <span className="text-[10px] text-slate-500">({formatTemporalGapAr(gap)})</span>
          )}
        </div>
        {tc.scene_date && (
          <p className="text-[9px] text-slate-500 mt-0.5">
            المشهد: {formatDateAr(tc.scene_date)}
            {tc.data_is_real === false && (
              <span className="ms-1 text-yellow-600">(محاكاة)</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Confidence strip ──────────────────────────────────────────────────────────

function ConfidenceStrip({ response }: { response: ContextResponse }) {
  const conf = response.confidence_and_limitations;
  const Icon = conf.overall_confidence === 'high'
    ? CheckCircle2
    : conf.overall_confidence === 'none'
    ? MinusCircle
    : AlertTriangle;
  const iconCls = {
    high:   'text-green-400',
    medium: 'text-yellow-400',
    low:    'text-orange-400',
    none:   'text-slate-500',
  }[conf.overall_confidence] ?? 'text-slate-400';

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden mb-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/30">
        <Icon size={12} className={iconCls} />
        <span className="text-[11px] font-semibold text-slate-300">
          الموثوقية والقيود
        </span>
        <span className="ms-auto text-[9px] text-slate-500">{conf.data_type}</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {conf.limitations.map((lim, i) => (
          <p key={i} className="text-[10px] text-slate-500 leading-tight">• {lim}</p>
        ))}
        {conf.aoi_limitation && (
          <p className="text-[10px] text-orange-400 leading-tight mt-1">⚠ {conf.aoi_limitation}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export default function ContextBrokerPanel({ sceneUid, drawnPolygon }: Props) {
  const defaults = defaultDateRange();

  const [dateFrom,       setDateFrom]       = useState(defaults.from);
  const [dateTo,         setDateTo]         = useState(defaults.to);
  const [selectedGroups, setSelectedGroups] = useState<Set<ContextGroupId>>(
    new Set(ALL_GROUPS.map(g => g.id)),
  );
  const [loading,   setLoading]   = useState(false);
  const [response,  setResponse]  = useState<ContextResponse | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const toggleGroup = (id: ContextGroupId) => {
    setSelectedGroups(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const groups = selectedGroups.size === ALL_GROUPS.length
        ? null
        : Array.from(selectedGroups);

      let res: ContextResponse;
      if (drawnPolygon && drawnPolygon.length >= 3) {
        res = await requestAreaContext(
          drawnPolygon.map(([lon, lat]) => [lon, lat]),
          dateFrom,
          dateTo,
          groups,
        );
      } else if (sceneUid) {
        res = await requestSceneContext(sceneUid, null, groups);
      } else {
        // No geometry, no scene — still send a date-range-only request
        res = await requestAreaContext(null, dateFrom, dateTo, groups);
      }
      setResponse(res);
    } catch (e) {
      if (e instanceof ContextBrokerError) {
        setError(`خطأ ${e.status}: ${e.message}`);
      } else {
        setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
      }
    } finally {
      setLoading(false);
    }
  }, [sceneUid, drawnPolygon, dateFrom, dateTo, selectedGroups]);

  const handleDownload = useCallback(() => {
    if (!response) return;
    downloadBrainReadyJSON(response);
  }, [response]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-800 flex items-center gap-2">
        <Brain size={14} className="text-violet-400" />
        <span className="text-[12px] font-bold text-slate-200">وسيط السياق المكاني-الزمني</span>
        <span className="ms-auto text-[9px] text-slate-600 font-mono">S9</span>
      </div>

      {/* ── Request form ────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-3 space-y-3 border-b border-slate-800">

        {/* Source indicator */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-500">المصدر:</span>
          {drawnPolygon ? (
            <span className="text-emerald-400 font-semibold">مضلع مرسوم ({drawnPolygon.length} نقطة)</span>
          ) : sceneUid ? (
            <span className="text-blue-400 font-semibold truncate max-w-[150px]">{sceneUid}</span>
          ) : (
            <span className="text-slate-600 italic">لم يُحدَّد — سيُختار أقرب مشهد</span>
          )}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-slate-500 block mb-1">من</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 block mb-1">إلى</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Group selectors */}
        <div>
          <label className="text-[9px] text-slate-500 block mb-1.5">مجموعات السياق</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_GROUPS.map(g => (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  selectedGroups.has(g.id)
                    ? 'bg-violet-600/30 border-violet-500 text-violet-200'
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRequest}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-semibold transition-all ${
            loading
              ? 'bg-violet-900/30 text-violet-500 cursor-not-allowed'
              : 'bg-violet-600 hover:bg-violet-500 text-white'
          }`}
        >
          {loading
            ? <><RefreshCw size={12} className="animate-spin" /> جارٍ المعالجة...</>
            : <><Brain size={12} /> طلب سياق</>
          }
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="shrink-0 mx-3 mt-2 p-2 rounded border border-rose-800 bg-rose-950/30">
          <p className="text-[10px] text-rose-300 leading-tight">{error}</p>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {response && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">

          {/* Temporal strip */}
          <TemporalStrip response={response} />

          {/* Geometry summary */}
          {response.geometry_summary && (
            <div className="px-3 py-2 bg-slate-800/30 rounded-lg border border-slate-700/40">
              <p className="text-[9px] text-slate-500 mb-1 font-semibold uppercase tracking-wider">الهندسة</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                <span className="text-slate-400">المساحة</span>
                <span className="text-slate-200 font-semibold">{response.geometry_summary.area_formatted}</span>
                <span className="text-slate-400">المحيط</span>
                <span className="text-slate-200">{response.geometry_summary.perimeter_km.toFixed(2)} كم</span>
                <span className="text-slate-400">الشكل</span>
                <span className="text-slate-200">{response.geometry_summary.shape_label}</span>
              </div>
            </div>
          )}

          {/* Context groups */}
          {Object.values(response.context_groups).map(group => (
            <CollapsibleGroup key={group.group_id} group={group} />
          ))}

          {/* Inferred needs */}
          {response.inferred_needs?.items?.length > 0 && (
            <CollapsibleGroup group={response.inferred_needs} />
          )}

          {/* Recommendations */}
          {response.recommendations.length > 0 && (
            <div className="border border-slate-800 rounded-lg overflow-hidden mb-2">
              <div className="px-3 py-2 bg-slate-800/40">
                <span className="text-[12px] font-semibold text-slate-300">التوصيات</span>
              </div>
              <div className="divide-y divide-slate-800/40">
                {response.recommendations.map(rec => (
                  <div
                    key={rec.id}
                    className={`p-2 border-r-2 ms-1 ${SEVERITY_COLOR[rec.severity]}`}
                  >
                    <div className="flex items-start gap-1.5">
                      <SeverityDot sev={rec.severity} />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-200 leading-tight">{rec.title}</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{rec.explanation}</p>
                        <p className="text-[9px] text-slate-600 mt-0.5">{rec.department}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence & limitations */}
          <ConfidenceStrip response={response} />

          {/* Export button */}
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded border border-violet-700 text-violet-400 hover:bg-violet-900/20 text-[11px] font-semibold transition-colors"
          >
            <Download size={11} />
            تصدير عقد الدماغ (JSON)
          </button>

          <p className="text-[9px] text-slate-700 text-center pb-2">
            طلب #{response.request_id} · {response.temporal_context.scene_uid ?? '—'}
          </p>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!response && !loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3">
          <Brain size={32} className="text-slate-700" />
          <div>
            <p className="text-[12px] text-slate-500 font-semibold">وسيط السياق المكاني</p>
            <p className="text-[10px] text-slate-600 mt-1 leading-relaxed">
              ارسم منطقة على الخريطة أو حدد مشهداً ثم اضغط "طلب سياق" للحصول على تحليل مُهيكَل مع تصنيف كل قيمة.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            {(['observed','estimated','inferred','unavailable'] as const).map(t => (
              <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded ${SOURCE_TYPE_COLOR[t]}`}>
                {SOURCE_TYPE_AR[t]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
