'use client';
// ─── AreaReportPanel — Phase S11 ──────────────────────────────────────────────
// Displays the real Arabic spatial report produced by POST /api/v1/satellite/area-report
// Shows: human_summary · spatial_estimates · environment · risk signals · recommendations

import React from 'react';
import {
  Building2, Trees, Route, Users, Leaf, Thermometer,
  Droplets, AlertTriangle, CheckCircle2, Info, Flame, MapPin,
  ArrowLeft, BarChart3, ShieldCheck,
} from 'lucide-react';
import type { AreaReport } from '@/lib/areaReportAPI';
import type { TemporalCompareResult, TimeSeriesResult } from '@/lib/s12API';
import type { MultiSourceResponse } from '@/lib/multiSourceAPI';
import { sourceStackLabel } from '@/lib/multiSourceAPI';
import SpectralHistoryChart from './SpectralHistoryChart';
import { TemporalComparisonChart, MultiTimeSeriesCharts } from './AreaMetricsChart';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_CFG = {
  urgent: { bg: 'bg-red-950/50 border-red-700/40',     text: 'text-red-300',    dot: 'bg-red-400',     label: 'عاجل'    },
  high:   { bg: 'bg-orange-950/50 border-orange-700/40',text: 'text-orange-300', dot: 'bg-orange-400',  label: 'مرتفع'   },
  medium: { bg: 'bg-amber-950/40 border-amber-700/40',  text: 'text-amber-300',  dot: 'bg-amber-400',   label: 'متوسط'   },
  info:   { bg: 'bg-slate-800/40 border-slate-700/30',  text: 'text-slate-300',  dot: 'bg-slate-500',   label: 'معلومات' },
} as const;

const RISK_CFG: Record<string, { color: string; Icon: React.ElementType }> = {
  'لا خطر':      { color: 'text-emerald-400', Icon: CheckCircle2 },
  'منخفض':      { color: 'text-emerald-400', Icon: CheckCircle2 },
  'متوسط':      { color: 'text-amber-400',   Icon: AlertTriangle },
  'مرتفع':      { color: 'text-orange-400',  Icon: AlertTriangle },
  'حرج':        { color: 'text-red-400',     Icon: AlertTriangle },
  'تحذير':      { color: 'text-orange-400',  Icon: AlertTriangle },
};

function riskCfg(val: string) {
  for (const [key, cfg] of Object.entries(RISK_CFG)) {
    if (val.includes(key)) return cfg;
  }
  return { color: 'text-slate-400', Icon: Info };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  Icon, color, label, value, sub,
}: {
  Icon: React.ElementType; color: string;
  label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-[10px] text-slate-500 font-semibold">{label}</span>
      </div>
      <p className="text-base font-bold text-slate-100 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function AreaReportSkeleton() {
  return (
    <div className="p-3 space-y-3 animate-pulse" dir="rtl">
      <div className="h-4 bg-slate-800 rounded w-3/4" />
      <div className="h-3 bg-slate-800 rounded w-full" />
      <div className="h-3 bg-slate-800 rounded w-5/6" />
      <div className="grid grid-cols-2 gap-2 mt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="h-3 bg-slate-800 rounded w-full mt-2" />
      <div className="h-3 bg-slate-800 rounded w-4/5" />
    </div>
  );
}

// ─── Main component —————————————————————————————————————————————————————

interface Props {
  report:             AreaReport;
  loading:            boolean;
  bbox?:              [number, number, number, number] | null;
  temporalCompare?:   TemporalCompareResult | null;
  timeSeries?:        TimeSeriesResult | null;
  multiSourceData?:   MultiSourceResponse | null;
  auditRunId?:        string | null;
  canonicalKpiSnapshot?: {
    runId: string;
    createdAt: string;
    year: number;
    buildings_count: number;
    trees_count: number;
    road_km_paved: number;
    road_km_unpaved: number;
    population_est: number;
    source: string;
    confidenceScore: number;
    driftLevel: 'low' | 'medium' | 'high';
    maxDriftPct: number;
    driftMetrics: {
      buildings_pct: number;
      trees_pct: number;
      road_paved_pct: number;
      population_pct: number;
    };
  } | null;
}

export default function AreaReportPanel({ report, loading, bbox, temporalCompare, timeSeries, multiSourceData, canonicalKpiSnapshot, auditRunId }: Props) {
  if (loading) return <AreaReportSkeleton />;

  const est  = report.spatial_estimates;
  const kpi  = canonicalKpiSnapshot
    ? {
        ...est,
        buildings_count: canonicalKpiSnapshot.buildings_count,
        trees_count: canonicalKpiSnapshot.trees_count,
        road_km_paved: canonicalKpiSnapshot.road_km_paved,
        road_km_unpaved: canonicalKpiSnapshot.road_km_unpaved,
        population_est: canonicalKpiSnapshot.population_est,
      }
    : est;
  const env  = report.environment_summary;
  const risk = report.risk_signals;

  const fmtNum = (n: number) => n.toLocaleString('ar-LY');

  return (
    <div className="p-3 space-y-4" dir="rtl">

      {/* ── Zone badge ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <MapPin size={12} className="text-blue-400 shrink-0" />
        <span className="text-xs text-slate-400 font-semibold">{est.zone_ar}</span>
        <span className="text-[10px] text-slate-600 mr-auto">
          {est.area_hectares.toFixed(1)} هكتار
        </span>
      </div>

      {/* ── Human summary (Executive Summary) ───────────────────── */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3.5">
        <p className="text-[10px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
          <span className="w-1 h-3 bg-blue-500 rounded-full" />
          الملخص التنفيذي
        </p>
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
          {report.human_summary}
        </p>
      </div>

      {/* ── Key statistics ────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-0.5 flex items-center gap-1.5">
          <BarChart3 size={11} className="text-slate-600" />
          المؤشرات الكمية
        </p>
        {canonicalKpiSnapshot && (
          <div className="mb-2 space-y-1">
            <p className="text-[10px] text-cyan-300/80">
              تم توحيد المؤشرات على لقطة تشغيل موحدة: {canonicalKpiSnapshot.year} • Run {canonicalKpiSnapshot.runId.slice(0, 8)}
            </p>
            <p className="text-[10px] text-slate-400">
              دقة المطابقة: {canonicalKpiSnapshot.confidenceScore}% • انحراف أقصى: {canonicalKpiSnapshot.maxDriftPct}%
            </p>
            {canonicalKpiSnapshot.driftLevel === 'high' && (
              <p className="text-[10px] text-amber-300">
                تحذير دقة: يوجد تفاوت مرتفع بين المصادر. يوصى بمراجعة AOI أو إعادة التشغيل بصور أحدث.
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            Icon={Building2} color="text-orange-400"
            label="المباني"
            value={fmtNum(kpi.buildings_count)}
            sub={`متوسط ${est.floors_avg} طوابق`}
          />
          <StatCard
            Icon={Users} color="text-blue-400"
            label="السكان"
            value={fmtNum(kpi.population_est)}
            sub="تقدير"
          />
          <StatCard
            Icon={Route} color="text-violet-400"
            label="الشبكة الطرقية"
            value={`${kpi.road_km_paved.toFixed(1)} كم`}
            sub={`${kpi.road_km_unpaved.toFixed(1)} كم غير معبّد`}
          />
          <StatCard
            Icon={Trees} color="text-emerald-400"
            label="الأشجار"
            value={fmtNum(kpi.trees_count)}
            sub="غطاء نباتي"
          />
        </div>
      </div>

      {/* ── Environment ────────────────────────────────────────────── */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
          الحالة البيئية
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Leaf size={11} className="text-emerald-400" />
              الغطاء النباتي
            </div>
            <span className="text-xs font-semibold text-slate-200">
              {env.vegetation_status}
              {env.vegetation_pct !== null && ` (${env.vegetation_pct.toFixed(0)}%)`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Thermometer size={11} className="text-red-400" />
              مستوى الحرارة
            </div>
            <span className="text-xs font-semibold text-slate-200">
              {env.heat_level}
              {env.temp_mean_c !== null && ` (${env.temp_mean_c.toFixed(1)}°C)`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Droplets size={11} className="text-blue-400" />
              رطوبة التربة
            </div>
            <span className="text-xs font-semibold text-slate-200">{env.soil_moisture}</span>
          </div>
        </div>
        {env.satellite_enriched && (
          <p className="text-[10px] text-blue-400/70 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
            مدعوم ببيانات الأقمار الاصطناعية
          </p>
        )}
      </div>

      {/* ── Risk signals ───────────────────────────────────────────── */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
          مؤشرات المخاطر
        </p>
        <div className="space-y-1.5">
          {[
            { label: 'خطر الفيضانات', value: risk.flood_risk,  icon: Droplets },
            { label: 'خطر الحرائق',  value: risk.fire_risk,   icon: Flame    },
            { label: 'إجهاد حراري',  value: risk.heat_stress, icon: Thermometer },
          ].map(({ label, value, icon: RIcon }) => {
            const cfg = riskCfg(value);
            return (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <RIcon size={11} className="text-slate-500" />
                  {label}
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
                  <cfg.Icon size={11} />
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Temporal Analysis (charts shown when temporal data is available) ── */}
      {(temporalCompare || timeSeries) && (
        <div className="bg-slate-800/30 border border-blue-900/30 rounded-xl p-3">
          <p className="text-[10px] font-bold text-blue-400/80 mb-3 flex items-center gap-1.5">
            <span className="w-1 h-3 bg-blue-500 rounded-full" />
            التحليل الزمني
            {temporalCompare && (
              <span className="text-[9px] text-blue-500/70 font-normal mr-1">
                {temporalCompare.year_from} ← {temporalCompare.year_to}
              </span>
            )}
          </p>

          {temporalCompare && (
            <div className="mb-3">
              <TemporalComparisonChart result={temporalCompare} />
            </div>
          )}

          {timeSeries && (
            <MultiTimeSeriesCharts result={timeSeries} />
          )}

          {temporalCompare?.narrative && (
            <div className="mt-2 pt-2 border-t border-slate-800/60">
              <p className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-line">
                {temporalCompare.narrative.split('\n').slice(0, 4).join('\n')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Recommendations ────────────────────────────────────────── */}
      {report.recommendations.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-0.5">
            التوصيات
          </p>
          <div className="space-y-2">
            {report.recommendations.map((rec, idx) => {
              const p = rec.priority as keyof typeof PRIORITY_CFG;
              const cfg = PRIORITY_CFG[p] ?? PRIORITY_CFG.info;
              return (
                <div key={idx} className={`flex items-start gap-2.5 p-3 rounded-xl border ${cfg.bg}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${cfg.text}`}>{rec.text}</p>
                    {rec.department && (
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowLeft size={9} className="text-slate-600" />
                        <span className="text-[10px] text-slate-500">{rec.department}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Data Confidence & Limitations ──────────────────── */}
      <div className="bg-slate-800/20 border border-slate-800/40 rounded-xl p-3">
        <p className="text-[10px] font-bold text-slate-500 mb-2 flex items-center gap-1.5">
          <ShieldCheck size={11} className="text-slate-600" />
          مستوى الثقة والقيود
        </p>
        <div className="space-y-1">
          {auditRunId && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">Run ID</span>
              <span className="font-semibold text-cyan-300">{auditRunId}</span>
            </div>
          )}
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">درجة الثقة</span>
            <span className="font-semibold text-slate-300">{report.meta.confidence}</span>
          </div>
          {/* OSM quality badge */}
          {(report.meta as any).osm_quality && (report.meta as any).osm_quality !== 'unavailable' && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">مصدر الإحصاءات</span>
              <span className={`font-semibold ${
                (report.meta as any).osm_quality === 'osm' ? 'text-emerald-400' :
                (report.meta as any).osm_quality === 'osm-partial' ? 'text-amber-400' : 'text-orange-400'
              }`}>
                {(report.meta as any).osm_quality === 'osm' ? '🗺 OpenStreetMap حقيقي' :
                 (report.meta as any).osm_quality === 'osm-partial' ? '🗺 OSM جزئي' : '🗺 OSM شحيح'}
              </span>
            </div>
          )}
          {/* Spectral analysis badge */}
          {(report.meta as any).spectral_quality === 'spectral' && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">تحليل الصور</span>
              <span className="font-semibold text-cyan-400">
                🛰 Sentinel-2 بكسلي حقيقي
              </span>
            </div>
          )}
          {(report.meta as any).spectral_scene && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">صورة الأقمار</span>
              <span className="font-mono text-slate-400 text-[9px]">
                {(report.meta as any).spectral_date} · {(report.meta as any).spectral_cloud}% سحاب
              </span>
            </div>
          )}
          {/* Spectral environment fields */}
          {(report.environment_summary as any).ndvi_mean != null && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">NDVI (نباتات)</span>
              <span className="font-mono text-emerald-400">{(report.environment_summary as any).ndvi_mean}</span>
            </div>
          )}
          {(report.environment_summary as any).ndbi_mean != null && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">NDBI (حضري)</span>
              <span className="font-mono text-orange-400">{(report.environment_summary as any).ndbi_mean}</span>
            </div>
          )}
          {(report.environment_summary as any).lst_proxy_c != null && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">حرارة السطح (LST)</span>
              <span className={`font-mono font-semibold ${
                (report.environment_summary as any).lst_proxy_c >= 45 ? 'text-red-400' :
                (report.environment_summary as any).lst_proxy_c >= 38 ? 'text-orange-400' : 'text-amber-400'
              }`}>{(report.environment_summary as any).lst_proxy_c}°م</span>
            </div>
          )}
          {(report.environment_summary as any).urban_fraction_pct != null && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">نسبة الكتلة الحضرية</span>
              <span className="font-mono text-slate-300">{(report.environment_summary as any).urban_fraction_pct}%</span>
            </div>
          )}
          {(report.meta as any).osm_raw_buildings != null && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">مباني معيّنة فعلياً</span>
              <span className="font-mono text-slate-400">{((report.meta as any).osm_raw_buildings as number).toLocaleString('ar')}</span>
            </div>
          )}
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">مصدر البيانات البيئية</span>
            <span className="font-semibold text-slate-300">
              {multiSourceData
                ? sourceStackLabel(multiSourceData.result.source_stack)
                : report.environment_summary.satellite_enriched ? 'أقمار صناعية' : 'تقدير جغرافي'}
            </span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">تاريخ التقرير</span>
            <span className="text-slate-500">{new Date(report.computed_at).toLocaleDateString('ar-LY')}</span>
          </div>
        </div>

        {/* ── Spectral Trend box ──────────────────────────────────────── */}
        {(report as any).spectral_trend && (
          <div className="mt-3 bg-slate-800/40 border border-cyan-900/40 rounded-xl p-3">
            <p className="text-[10px] font-bold text-cyan-400/80 mb-2 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-cyan-500 rounded-full" />
              الاتجاه الزمني — مقارنة بصورة سابقة
            </p>
            <p className="text-[10px] text-slate-300 leading-relaxed mb-2">
              {(report as any).spectral_trend.trend_ar}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {/* NDVI delta */}
              <div className="bg-slate-900/50 rounded-lg p-1.5 text-center">
                <p className="text-[9px] text-slate-500 mb-0.5">NDVI</p>
                <p className={`text-xs font-bold font-mono ${(report as any).spectral_trend.ndvi_delta > 0.01 ? 'text-emerald-400' : (report as any).spectral_trend.ndvi_delta < -0.01 ? 'text-red-400' : 'text-slate-400'}`}>
                  {(report as any).spectral_trend.ndvi_delta > 0 ? '+' : ''}{(report as any).spectral_trend.ndvi_delta}
                </p>
              </div>
              {/* LST delta */}
              <div className="bg-slate-900/50 rounded-lg p-1.5 text-center">
                <p className="text-[9px] text-slate-500 mb-0.5">LST °م</p>
                <p className={`text-xs font-bold font-mono ${(report as any).spectral_trend.lst_delta > 1 ? 'text-red-400' : (report as any).spectral_trend.lst_delta < -1 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {(report as any).spectral_trend.lst_delta > 0 ? '+' : ''}{(report as any).spectral_trend.lst_delta}°
                </p>
              </div>
              {/* Urban delta */}
              <div className="bg-slate-900/50 rounded-lg p-1.5 text-center">
                <p className="text-[9px] text-slate-500 mb-0.5">حضري</p>
                <p className={`text-xs font-bold font-mono ${(report as any).spectral_trend.urban_delta > 0.01 ? 'text-orange-400' : (report as any).spectral_trend.urban_delta < -0.01 ? 'text-cyan-400' : 'text-slate-400'}`}>
                  {(report as any).spectral_trend.urban_delta > 0 ? '+' : ''}{((report as any).spectral_trend.urban_delta * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-[9px] text-slate-600 mt-1.5">
              الفجوة الزمنية: {(report as any).spectral_trend.months_apart} شهر · مقارنة بصورة {(report as any).spectral_trend.prev_scene_date}
            </p>
          </div>
        )}
        <p className="text-[9px] text-slate-600 mt-2 leading-relaxed">
          {(report.meta as any).osm_quality && (report.meta as any).osm_quality !== 'unavailable'
            ? (report.meta as any).spectral_quality === 'spectral'
              ? 'البيانات مدمجة من OpenStreetMap (مباني وطرق حقيقية) + Sentinel-2 (تحليل بكسلي للغطاء الأرضي والحرارة). دقة عالية.'
              : 'الأرقام مستخرجة من OpenStreetMap (بيانات حقيقية معيّنة) مع تعويض عن نقص التغطية. تُستخدم للتخطيط والمقارنة.'
            : 'الأرقام تقديرية مستخرجة من نماذج هندسية وبيانات فضائية. تُستخدم للتخطيط والمقارنة فقط.'}
          {canonicalKpiSnapshot && ` تم توحيد عرض المؤشرات على لقطة تشغيل واحدة (${canonicalKpiSnapshot.source}).`}
          {multiSourceData && ` دعم متعدد المصادر: ${multiSourceData.result.scene_count} مشاهد فضائية.`}
        </p>

        {/* ─── Spectral Alerts ─────────────────────────────────────────────── */}
        {(report as any).spectral_alerts && (report as any).spectral_alerts.length > 0 && (
          <div className="mt-3 rounded-xl bg-red-950/30 border border-red-800/40 p-2.5">
            <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1.5">
              تنبيهات مرصودة تلقائياً
            </p>
            <ul className="space-y-1">
              {(report as any).spectral_alerts.map((a: any, i: number) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className={`mt-0.5 text-[9px] font-bold uppercase px-1 rounded ${
                    a.severity === 'critical' ? 'bg-red-800/60 text-red-300' :
                    a.severity === 'high'     ? 'bg-orange-800/60 text-orange-300' :
                    'bg-yellow-800/60 text-yellow-300'
                  }`}>{a.severity === 'critical' ? 'حرج' : a.severity === 'high' ? 'عالٍ' : 'متوسط'}</span>
                  <span className="text-[10px] text-slate-300 leading-tight">{a.message_ar ?? a.alert_type}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ─── Spectral History Chart ────────────────────────────────────────── */}
        {bbox && <SpectralHistoryChart bbox={bbox} />}

      </div>

    </div>
  );
}
