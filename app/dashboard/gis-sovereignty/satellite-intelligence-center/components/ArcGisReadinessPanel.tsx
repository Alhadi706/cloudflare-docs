'use client';

import React, { useMemo } from 'react';
import { CheckCircle2, CircleSlash2, AlertTriangle, BarChart3 } from 'lucide-react';
import type { SceneSummaryContract, SceneListItem } from '@/lib/satelliteIntelAPI';
import type { AreaReport } from '@/lib/areaReportAPI';
import type { MultiSourceResponse } from '@/lib/multiSourceAPI';
import type { TemporalCompareResult, TimeSeriesResult } from '@/lib/s12API';
import type { Terrain3DResponse } from '@/lib/terrain3DAPI';
import type { Terrain3DBenchmarkResult } from '@/lib/terrain3DBenchmark';
import type { ZonalStatsResult } from '@/lib/zonalStatsAPI';
import type { ObjectExtractionResult } from '@/lib/objectExtractionAPI';
import type { GeoprocessingResult } from '@/lib/geoprocessingAPI';
import type { TopologyQaResult } from '@/lib/topologyQaAPI';

type RequirementStatus = 'pass' | 'partial' | 'fail';

interface RequirementRow {
  id: string;
  label: string;
  status: RequirementStatus;
  note?: string;
}

interface ExtensionScore {
  name: string;
  score: number;
  stage: 'ready' | 'partial' | 'blocked';
  rows: RequirementRow[];
  blocker?: string;
}

interface Props {
  sceneUid: string | null;
  scenes: SceneListItem[];
  summary: SceneSummaryContract | null;
  areaReport: AreaReport | null;
  multiSourceData: MultiSourceResponse | null;
  zonalStats: ZonalStatsResult | null;
  objectExtraction: ObjectExtractionResult | null;
  geoprocessing: GeoprocessingResult | null;
  topologyQa: TopologyQaResult | null;
  temporalCompare: TemporalCompareResult | null;
  timeSeries: TimeSeriesResult | null;
  hasGeometry: boolean;
  simulationReady: boolean;
  terrain3d: Terrain3DResponse | null;
  terrain3dBenchmark: Terrain3DBenchmarkResult | null;
  sceneConsistencyWarning: string | null;
  auditRunId?: string | null;
  canonicalKpiSnapshot?: {
    runId: string;
    createdAt: string;
    year: number;
    source: string;
    confidenceScore: number;
    driftLevel: 'low' | 'medium' | 'high';
    maxDriftPct: number;
  } | null;
}

function calcScore(rows: RequirementRow[]): number {
  const total = rows.length * 2;
  const points = rows.reduce((acc, row) => {
    if (row.status === 'pass') return acc + 2;
    if (row.status === 'partial') return acc + 1;
    return acc;
  }, 0);
  return Math.round((points / Math.max(total, 1)) * 100);
}

function stageFromScore(score: number): 'ready' | 'partial' | 'blocked' {
  if (score >= 80) return 'ready';
  if (score >= 45) return 'partial';
  return 'blocked';
}

function StatusPill({ stage }: { stage: ExtensionScore['stage'] }) {
  const cls =
    stage === 'ready'
      ? 'text-emerald-300 bg-emerald-950/40 border-emerald-700/40'
      : stage === 'partial'
        ? 'text-amber-300 bg-amber-950/40 border-amber-700/40'
        : 'text-rose-300 bg-rose-950/40 border-rose-700/40';
  const label = stage === 'ready' ? 'جاهز تشغيل' : stage === 'partial' ? 'جاهزية جزئية' : 'غير مكتمل';
  return <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cls}`}>{label}</span>;
}

function ReqIcon({ status }: { status: RequirementStatus }) {
  if (status === 'pass') return <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />;
  if (status === 'partial') return <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />;
  return <CircleSlash2 size={12} className="text-rose-400 mt-0.5 shrink-0" />;
}

function ExtensionCard({ item }: { item: ExtensionScore }) {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/25 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-700/40 bg-slate-800/40 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-200">{item.name}</p>
          <p className="text-[10px] text-slate-500">درجة المطابقة: {item.score}%</p>
        </div>
        <StatusPill stage={item.stage} />
      </div>

      <div className="p-3 space-y-2">
        {item.rows.map((row) => (
          <div key={row.id} className="flex items-start gap-2">
            <ReqIcon status={row.status} />
            <div>
              <p className="text-[11px] text-slate-200 leading-tight">{row.label}</p>
              {row.note && <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{row.note}</p>}
            </div>
          </div>
        ))}

        {item.blocker && (
          <div className="mt-2 px-2.5 py-2 rounded-lg border border-rose-700/30 bg-rose-950/25 text-[10px] text-rose-300">
            مانع تنفيذي: {item.blocker}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArcGisReadinessPanel({
  sceneUid,
  scenes,
  summary,
  areaReport,
  multiSourceData,
  zonalStats,
  objectExtraction,
  geoprocessing,
  topologyQa,
  temporalCompare,
  timeSeries,
  hasGeometry,
  simulationReady,
  terrain3d,
  terrain3dBenchmark,
  sceneConsistencyWarning,
  auditRunId,
  canonicalKpiSnapshot,
}: Props) {
  const activeScene = useMemo(() => scenes.find(s => s.scene_uid === sceneUid) ?? null, [scenes, sceneUid]);

  const spatial = useMemo<ExtensionScore>(() => {
    const zonalStatus: RequirementStatus = !zonalStats
      ? 'fail'
      : zonalStats.source_mode === 'backend-zonal'
        ? 'pass'
        : 'partial';
    const objectStatus: RequirementStatus = !objectExtraction
      ? 'fail'
      : objectExtraction.source_mode === 'backend-object-extraction'
        ? 'pass'
        : 'partial';
    const geoprocessingStatus: RequirementStatus = !geoprocessing
      ? 'fail'
      : geoprocessing.source_mode === 'backend-geoprocessing'
        ? 'pass'
        : 'partial';
    const topologyStatus: RequirementStatus = !topologyQa
      ? 'fail'
      : topologyQa.source_mode === 'backend-topology-qa'
        ? 'pass'
        : 'partial';

    const rows: RequirementRow[] = [
      {
        id: 'sa_aoi',
        label: 'تحديد نطاق عمل مكاني (AOI) على الخريطة',
        status: hasGeometry ? 'pass' : 'fail',
      },
      {
        id: 'sa_raster',
        label: 'توليد تقرير Raster تحليلي للمنطقة',
        status: areaReport ? 'pass' : 'fail',
        note: areaReport ? `تم إنشاء تقرير رقم ${areaReport.report_id.slice(0, 8)}...` : 'لم يتم إنشاء تقرير منطقة بعد',
      },
      {
        id: 'sa_zonal_native',
        label: 'Zonal Statistics على مسار backend-native',
        status: zonalStatus,
        note: !zonalStats
          ? 'غير متاح بعد'
          : zonalStats.source_mode === 'backend-zonal'
            ? 'مفعل من endpoint نطاقي مباشر'
            : 'يعمل عبر fallback من area-report (قبول جزئي)',
      },
      {
        id: 'sa_object_native',
        label: 'Object Extraction على مسار backend-native',
        status: objectStatus,
        note: !objectExtraction
          ? 'غير متاح بعد'
          : objectExtraction.source_mode === 'backend-object-extraction'
            ? 'مفعل من endpoint extraction مباشر'
            : 'يعمل عبر fallback من area-report (قبول جزئي)',
      },
          {
            id: 'sa_geoprocessing_native',
            label: 'عمليات Geoprocessing (Buffer/Clip/Intersect) على مسار backend-native',
            status: geoprocessingStatus,
            note: !geoprocessing
              ? 'غير متاح بعد'
              : geoprocessing.source_mode === 'backend-geoprocessing'
            ? 'مفعلة من endpoint geoprocessing مباشر'
            : 'تعمل عبر fallback مشتق من AOI/area-report (قبول جزئي)',
          },
          {
            id: 'sa_topology_native',
            label: 'Topology QA Rules على مسار backend-native',
            status: topologyStatus,
            note: !topologyQa
              ? 'غير متاح بعد'
              : topologyQa.source_mode === 'backend-topology-qa'
            ? 'مفعل من endpoint topology QA مباشر'
            : `وضع fallback محلي (score: ${topologyQa.quality_score}%)`,
          },
      {
        id: 'sa_hydro_sim',
        label: 'تحليل زمني/محاكاة لدعم سيناريوهات الهيدرولوجيا',
        status: temporalCompare && timeSeries && simulationReady ? 'pass' : (temporalCompare || timeSeries || simulationReady ? 'partial' : 'fail'),
        note: temporalCompare && timeSeries && simulationReady
          ? 'تم تفعيل التحليل الزمني والمحاكاة في نفس دورة الفحص'
          : temporalCompare || timeSeries || simulationReady
          ? 'متاح كتحليل داعم، ويحتاج ربط نموذج هيدرولوجي تفصيلي لمرحلة الاعتماد النهائي'
          : 'غير منفذ بعد',
      },
      {
        id: 'sa_consistency',
        label: 'توحيد مؤشرات المباني/الطرق/السكان على Snapshot واحد',
        status: !canonicalKpiSnapshot
          ? 'partial'
          : canonicalKpiSnapshot.driftLevel === 'high'
            ? 'fail'
            : canonicalKpiSnapshot.driftLevel === 'medium'
              ? 'partial'
              : 'pass',
        note: canonicalKpiSnapshot
          ? `Run ${canonicalKpiSnapshot.runId.slice(0, 8)} • سنة ${canonicalKpiSnapshot.year} • دقة ${canonicalKpiSnapshot.confidenceScore}%`
          : 'لا يوجد توحيد للمؤشرات بعد؛ قد يظهر تضارب بين اللوحات',
      },
      {
        id: 'sa_decision',
        label: 'مخرجات قرار عملية مع توصيات تنفيذية',
        status: areaReport?.recommendations?.length ? 'pass' : 'partial',
        note: areaReport?.recommendations?.length
          ? `عدد التوصيات الحالية: ${areaReport.recommendations.length}`
          : 'يلزم تشغيل تقرير المنطقة لتوليد توصيات',
      },
    ];
    const score = calcScore(rows);
    return { name: 'ArcGIS Spatial Analyst', score, stage: stageFromScore(score), rows };
  }, [areaReport, canonicalKpiSnapshot, geoprocessing, hasGeometry, objectExtraction, simulationReady, temporalCompare, timeSeries, topologyQa, zonalStats]);

  const image = useMemo<ExtensionScore>(() => {
    const hasIndicators = !!summary?.indicators?.length;
    const hasIntelOutputs = !!summary?.intelligence_outputs?.length;
    const hasUnifiedKpi = !!canonicalKpiSnapshot;
    const kpiReliable = !!canonicalKpiSnapshot && canonicalKpiSnapshot.driftLevel !== 'high' && canonicalKpiSnapshot.confidenceScore >= 70;
    const objectReady = !!objectExtraction;
    const objectNative = objectExtraction?.source_mode === 'backend-object-extraction';
    const sourceFusionStatus: RequirementStatus =
      multiSourceData
        ? (sceneConsistencyWarning ? 'partial' : (kpiReliable ? 'pass' : hasUnifiedKpi ? 'partial' : 'partial'))
        : 'partial';
    const rows: RequirementRow[] = [
      {
        id: 'ia_scene',
        label: 'تشغيل تحليل مشهد فضائي فعلي',
        status: summary ? 'pass' : 'fail',
        note: summary ? `المشهد الحالي: ${summary.scene_uid}` : 'لم يتم تشغيل تحليل المشهد بعد',
      },
      {
        id: 'ia_classification',
        label: 'تصنيف مؤشرات طيفية مع تفسير',
        status: hasIndicators ? 'pass' : 'fail',
        note: hasIndicators ? `عدد المؤشرات: ${summary?.indicators.length}` : 'لا توجد مؤشرات محللة',
      },
      {
        id: 'ia_features',
        label: 'استخلاص معالم من مصادر متعددة (Optical/SAR)',
        status: !objectReady ? 'fail' : (objectNative ? 'pass' : 'partial'),
        note: multiSourceData
          ? (sceneConsistencyWarning
            ? 'نتائج الدمج متاحة لكن مزامنة قائمة المشاهد لم تكتمل بعد'
            : `نمط الدمج: ${multiSourceData.result.source_stack}`)
          : !objectReady
            ? 'لا يوجد Object Extraction AOI'
            : objectNative
              ? 'Object Extraction backend-native مفعل'
              : 'Object Extraction يعمل بوضع fallback',
      },
      {
        id: 'ia_quality',
        label: 'مستوى موثوقية المخرجات (Quality/Confidence)',
        status: hasIntelOutputs && kpiReliable ? 'pass' : (hasIntelOutputs && hasUnifiedKpi ? 'partial' : 'fail'),
        note: hasIntelOutputs && kpiReliable
          ? `درجة الاستخدام: ${summary?.usage_grade ?? 'غير محدد'} • دقة المؤشرات ${canonicalKpiSnapshot?.confidenceScore ?? '-'}%`
          : hasIntelOutputs
          ? 'التحليل متاح لكن دقة المؤشرات غير كافية للاعتماد الكامل'
          : 'لا توجد مخرجات جودة كافية بعد',
      },
    ];
    const score = calcScore(rows);
    return { name: 'ArcGIS Image Analyst', score, stage: stageFromScore(score), rows };
  }, [summary, multiSourceData, sceneConsistencyWarning, canonicalKpiSnapshot, objectExtraction]);

  const analyst3d = useMemo<ExtensionScore>(() => {
    const hasTerrain = !!terrain3d;
    const hasContours = (terrain3d?.contours?.bands?.length ?? 0) > 0;
    const hasVisibility = !!terrain3d?.visibility;
    const hasCutFill = !!terrain3d?.cut_fill;
    const benchmarkAccepted = terrain3dBenchmark?.verdict === 'accepted';
    const benchmarkConditional = terrain3dBenchmark?.verdict === 'conditional';

    const rows: RequirementRow[] = [
      {
        id: '3d_dem',
        label: 'تحميل DEM/DSM إنتاجي داخل خط التحليل',
        status: hasTerrain ? 'pass' : 'fail',
        note: hasTerrain
          ? `المصدر: ${terrain3d?.source.dataset} عبر ${terrain3d?.source.provider}`
          : 'لم يتم تشغيل تحليل Terrain 3D بعد',
      },
      {
        id: '3d_surface',
        label: 'تحليل تضاريس (Slope/Contour) من نموذج ارتفاع',
        status: hasContours ? 'pass' : hasTerrain ? 'partial' : 'fail',
        note: hasTerrain
          ? `Slope mean/max = ${terrain3d?.terrain.slope_mean_deg}° / ${terrain3d?.terrain.slope_max_deg}°`
          : 'غير متاح قبل تشغيل 3D',
      },
      {
        id: '3d_visibility',
        label: 'تحليل الرؤية (Viewshed/LOS) مع نتائج قابلة للتدقيق',
        status: hasVisibility ? 'pass' : hasTerrain ? 'partial' : 'fail',
        note: hasVisibility
          ? (terrain3d?.visibility?.visible ? 'خط بصر مفتوح' : `انقطاع عند ${terrain3d?.visibility?.blocked_at_distance_m ?? 'غير معروف'} م`)
          : 'غير محسوب في آخر تشغيل',
      },
      {
        id: '3d_volumetric',
        label: 'نمذجة مجسمة وحسابات حجمية (Cut/Fill)',
        status: hasCutFill ? 'pass' : hasTerrain ? 'partial' : 'fail',
        note: hasCutFill
          ? `Cut=${terrain3d?.cut_fill.cut_m3.toFixed(0)} / Fill=${terrain3d?.cut_fill.fill_m3.toFixed(0)} م³`
          : 'لم تُحسب أحجام الحفر/الردم',
      },
      {
        id: '3d_benchmark',
        label: 'اختبار مرجعي ثابت مع حكم قبول رقمي',
        status: benchmarkAccepted ? 'pass' : benchmarkConditional ? 'partial' : 'fail',
        note: terrain3dBenchmark
          ? `${terrain3dBenchmark.presetName} = ${terrain3dBenchmark.score}% (${terrain3dBenchmark.verdict === 'accepted' ? 'مقبول' : terrain3dBenchmark.verdict === 'conditional' ? 'قبول مشروط' : 'مرفوض'})`
          : 'لم يتم تشغيل Benchmark الاعتماد بعد',
      },
    ];
    const score = calcScore(rows);
    const stage = stageFromScore(score);
    return {
      name: 'ArcGIS 3D Analyst',
      score,
      stage,
      rows,
      blocker: stage === 'blocked'
        ? 'لا تزال سلسلة 3D غير مكتملة تشغيلياً، شغّل تحليل Terrain 3D وBenchmark الاعتماد أولاً.'
        : undefined,
    };
  }, [terrain3d, terrain3dBenchmark]);

  const overallScore = Math.round((spatial.score + image.score + analyst3d.score) / 3);
  const realDataLabel = activeScene?.data_is_real ? 'بيانات حقيقية' : 'بيانات تجريبية/غير مؤكدة';

  return (
    <div className="p-3 space-y-3" dir="rtl">
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/25 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-sky-300" />
            <p className="text-xs font-bold text-slate-200">تدقيق مطابقة الملحقات الرسمية</p>
          </div>
          <span className="text-sm font-black text-sky-300">{overallScore}%</span>
        </div>
        <p className="mt-2 text-[10px] text-slate-500 leading-tight">
          هذا التدقيق يُستخدم بعد كل مرحلة تنفيذ كاختبار خبير GIS/Remote Sensing للتأكد من المطابقة الفعلية.
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          حالة المشهد الحالي: {sceneUid ? sceneUid : 'لا يوجد'} • نوع البيانات: {realDataLabel}
        </p>
        {auditRunId && (
          <p className="mt-1 text-[10px] text-cyan-300/80">Run ID: {auditRunId}</p>
        )}
      </div>

      <ExtensionCard item={spatial} />
      <ExtensionCard item={image} />
      <ExtensionCard item={analyst3d} />
    </div>
  );
}