'use client';
/**
 * MINERVA Imagery Intelligence Panel — Phase 5
 * يعرض: توصية MINERVA للصور التجارية + أرشيف Planet + VoI
 */
import React, { useState, useEffect } from 'react';
import {
  Satellite, RefreshCw, CheckCircle2, AlertTriangle, Info,
  Calendar, Cloud, Crosshair, TrendingUp, DollarSign,
  Archive, Zap, Eye, ChevronDown, ChevronUp, Clock,
} from 'lucide-react';

interface ImageryResult {
  ok: boolean;
  analysis_date: string;
  recommendation: {
    action: string;
    provider: string | null;
    reasoning_ar: string;
    expected_confidence_gain: number;
    expected_cost_usd: number;
    voi_usd: number;
    archive_total: number;
    archive_latest_date: string | null;
    archive_cloud_cover_avg: number;
    scenes_evaluated: Array<{
      scene_id: string; provider: string; acquisition_date: string;
      cloud_cover_pct: number; resolution_m: number; quality_score: number;
      available_locally: boolean; voi_usd: number; age_days: number;
    }>;
    recommended_scene: null | {
      scene_id: string; acquisition_date: string; cloud_cover_pct: number;
      resolution_m: number; quality_score: number;
    };
  };
  timeline: Array<{ date: string; cloud: number; resolution: number; quality: number; available: boolean; voi: number }>;
  archive_summary: { total_scenes: number; latest_date: string | null; avg_cloud_cover: number; years_covered: string[] };
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  NONE:         { icon: CheckCircle2, label: 'لا حاجة لصور إضافية', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  USE_ARCHIVE:  { icon: Archive,      label: 'استخدام الأرشيف (مجاني)', color: 'text-blue-300',    bg: 'bg-blue-500/10 border-blue-500/30' },
  USE_FREE:     { icon: Satellite,    label: 'متابعة بـ Sentinel',     color: 'text-slate-300',   bg: 'bg-slate-500/10 border-slate-500/30' },
  REQUEST_LIVE: { icon: Zap,          label: 'طلب صورة جديدة',         color: 'text-amber-300',   bg: 'bg-amber-500/10 border-amber-500/30' },
  FIELD:        { icon: Crosshair,    label: 'زيارة ميدانية أفضل',     color: 'text-violet-300',  bg: 'bg-violet-500/10 border-violet-500/30' },
  DRONE:        { icon: Eye,          label: 'مسح بطائرة مسيّرة',      color: 'text-rose-300',    bg: 'bg-rose-500/10 border-rose-500/30' },
};

function QualityBar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

function ArchiveTimeline({ timeline }: { timeline: ImageryResult['timeline'] }) {
  if (!timeline || timeline.length === 0) return null;
  const max_q = Math.max(...timeline.map(t => t.quality), 0.01);

  return (
    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
      <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-blue-400" />
        جدول اكتساب الصور ({timeline.length} مشهد)
      </p>
      <div className="flex items-end gap-0.5 h-10 mb-1">
        {timeline.map((t, i) => {
          const h = Math.max((t.quality / max_q) * 100, 5);
          const color = t.available
            ? (t.cloud <= 15 ? 'bg-emerald-400' : t.cloud <= 30 ? 'bg-yellow-400' : 'bg-orange-400')
            : 'bg-slate-600';
          return (
            <div key={i} title={`${t.date} | سحاب: ${t.cloud}% | دقة: ${t.resolution}م`}
              className={`flex-1 rounded-sm ${color} opacity-80 hover:opacity-100 cursor-pointer`}
              style={{ height: `${h}%`, minHeight: 2 }} />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>{timeline[0]?.date?.slice(0, 7)}</span>
        <span>{timeline[timeline.length - 1]?.date?.slice(0, 7)}</span>
      </div>
      <div className="flex gap-3 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-400" />أرشيف جيد</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-yellow-400" />سحاب متوسط</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-slate-600" />غير متاح محليًا</span>
      </div>
    </div>
  );
}

interface Props {
  lat: number;
  lon: number;
  currentConfidence: number;
  anomalyScore: number;
  assetCriticality?: number;
  evidenceCompleteness?: number;
}

export default function MINERVAImageryPanel({
  lat, lon, currentConfidence, anomalyScore,
  assetCriticality = 0.85, evidenceCompleteness = 0.80,
}: Props) {
  const [data,    setData]    = useState<ImageryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/minerva/imagery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat, lon,
          current_confidence:   currentConfidence,
          anomaly_score:        anomalyScore,
          asset_criticality:    assetCriticality,
          evidence_completeness: evidenceCompleteness,
          daily_damage_usd:     300,
        }),
      });
      const d: ImageryResult = await res.json();
      if (!d.ok) { setError((d as any).error ?? 'خطأ'); return; }
      setData(d);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [lat, lon]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
      <p className="text-xs text-slate-500">تقييم الصور التجارية المتاحة...</p>
    </div>
  );

  if (error) return (
    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">{error}</div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <Satellite className="w-8 h-8 text-slate-700" />
      <p className="text-xs text-slate-600">اضغط لتحليل الصور المتاحة</p>
      <button onClick={load} className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg px-3 py-1.5 mt-1">
        تحليل الصور
      </button>
    </div>
  );

  const rec   = data.recommendation;
  const aconf = ACTION_CONFIG[rec.action] ?? ACTION_CONFIG.USE_FREE;
  const Icon  = aconf.icon;

  return (
    <div className="space-y-3 p-1">
      {/* توصية MINERVA */}
      <div className={`rounded-xl border p-3 ${aconf.bg}`}>
        <div className="flex items-start gap-2 mb-2">
          <Icon className={`w-4 h-4 ${aconf.color} shrink-0 mt-0.5`} />
          <div>
            <p className={`text-xs font-bold ${aconf.color}`}>{aconf.label}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{rec.reasoning_ar}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="bg-slate-900/40 rounded-lg p-2 text-center">
            <p className="text-xs text-slate-500">رفع الثقة</p>
            <p className={`text-sm font-bold ${aconf.color}`}>+{(rec.expected_confidence_gain * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2 text-center">
            <p className="text-xs text-slate-500">التكلفة</p>
            <p className="text-sm font-bold text-slate-200">${rec.expected_cost_usd.toFixed(0)}</p>
          </div>
          <div className={`bg-slate-900/40 rounded-lg p-2 text-center`}>
            <p className="text-xs text-slate-500">VoI</p>
            <p className={`text-sm font-bold ${rec.voi_usd > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              ${rec.voi_usd.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      {/* ملخص الأرشيف */}
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
        <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
          <Archive className="w-3.5 h-3.5 text-slate-400" />أرشيف Planet المحلي
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-900/40 rounded p-2">
            <p className="text-slate-500">إجمالي المشاهد</p>
            <p className="text-slate-200 font-semibold text-base">{data.archive_summary.total_scenes}</p>
          </div>
          <div className="bg-slate-900/40 rounded p-2">
            <p className="text-slate-500">أحدث مشهد</p>
            <p className="text-slate-200 font-semibold">{data.archive_summary.latest_date?.slice(0, 10) ?? 'غير متاح'}</p>
          </div>
          <div className="bg-slate-900/40 rounded p-2">
            <p className="text-slate-500">غيوم متوسط</p>
            <p className="text-slate-200 font-semibold">{data.archive_summary.avg_cloud_cover.toFixed(1)}%</p>
          </div>
          <div className="bg-slate-900/40 rounded p-2">
            <p className="text-slate-500">سنوات التغطية</p>
            <p className="text-slate-200 font-semibold">{data.archive_summary.years_covered.length} سنة</p>
          </div>
        </div>
        {data.archive_summary.years_covered.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.archive_summary.years_covered.slice(-6).map(y => (
              <span key={y} className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">{y}</span>
            ))}
          </div>
        )}
      </div>

      {/* الجدول الزمني */}
      <ArchiveTimeline timeline={data.timeline} />

      {/* أفضل المشاهد */}
      {rec.scenes_evaluated.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Satellite className="w-3.5 h-3.5" />أفضل المشاهد المتاحة
            </p>
            <button onClick={() => setShowAll(!showAll)} className="text-xs text-slate-500 hover:text-slate-300">
              {showAll ? 'عرض أقل' : `عرض الكل (${rec.scenes_evaluated.length})`}
            </button>
          </div>

          <div className="space-y-1.5">
            {(showAll ? rec.scenes_evaluated : rec.scenes_evaluated.slice(0, 4)).map((scene, i) => (
              <div key={scene.scene_id}
                className={`flex items-center gap-2 text-xs p-2 rounded-lg ${i === 0 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-slate-900/40'}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${scene.available_locally ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span className="text-slate-300 font-mono w-20 truncate">{scene.acquisition_date}</span>
                <span className="text-slate-500 flex items-center gap-0.5"><Cloud className="w-2.5 h-2.5" />{scene.cloud_cover_pct.toFixed(0)}%</span>
                <span className="text-slate-500">{scene.resolution_m}م</span>
                <div className="flex-1">
                  <QualityBar value={scene.quality_score} />
                </div>
                <span className={`${scene.voi_usd > 0 ? 'text-emerald-400' : 'text-slate-600'} w-12 text-right`}>
                  ${scene.voi_usd.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* زر تحديث */}
      <button onClick={load}
        className="w-full py-2 rounded-xl border border-slate-700/50 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all flex items-center justify-center gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" />تحديث التقييم
      </button>
    </div>
  );
}
