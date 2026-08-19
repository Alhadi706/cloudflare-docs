'use client';
// ─── SatIntelLeftPanel ────────────────────────────────────────────────────────
// Left panel: scene tree, overlays section, drawn area context.
// Width: w-56, Engineering Workspace LeftPanel pattern.

import React from 'react';
import { Satellite, MapPin, ChevronRight, Camera } from 'lucide-react';
import type { SceneListItem } from '@/lib/satelliteIntelAPI';
import type { AreaIntelResult } from '@/lib/areaIntelEngine';
import { parseSceneLabel, classifyDataType, parseSensorInfo } from '@/lib/sceneLabels';
import type { ServiceLayerRecord } from '@/lib/serviceLayersAPI';

interface Props {
  scenes:         SceneListItem[];
  activeSceneUid: string | null;
  onSelectScene:  (uid: string) => void;
  serviceLayers: ServiceLayerRecord[];
  serviceLayersLoading?: boolean;
  serviceLayersError?: string | null;
  onReloadServiceLayers?: () => void;
  onCreateServiceLayer?: (name: string) => void;
  onToggleServiceLayer?: (layerId: string, visible: boolean) => void;
  onOpenLayerPanel?: (layer: ServiceLayerRecord) => void;
  svcLayerFeatureCounts?: Record<string, number>;
  drawnPolygon:   [number, number][] | null;
  areaResult:     AreaIntelResult | null;
  areaLoading:    boolean;

}

export default function SatIntelLeftPanel({
  scenes, activeSceneUid, onSelectScene,
  serviceLayers,
  serviceLayersLoading,
  serviceLayersError,
  onReloadServiceLayers,
  onCreateServiceLayer,
  onToggleServiceLayer,
  onOpenLayerPanel,
  svcLayerFeatureCounts = {},
  drawnPolygon, areaResult, areaLoading,
}: Props) {
  return (
    <div className="w-64 shrink-0 border-r border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Camera size={13} className="text-blue-400 shrink-0" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">الصور الفضائية</span>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">هذه صور التقطها القمر الصناعي — اختر صورة لتحليلها</p>
      </div>

      {/* ── Scene list ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Legend header */}
        <div className="px-3 py-2 mb-1 border-b border-slate-800/60 bg-slate-900/60">
          <p className="text-xs text-slate-500 leading-relaxed">
            اختر صورة لتحليلها ← الصور مرتبة من الأحدث للأقدم
          </p>
        </div>

        {scenes.length === 0 ? (
          <div className="px-4 py-6 text-xs text-slate-500 text-center">
            <Camera size={20} className="mx-auto mb-2 text-slate-700" />
            لا توجد صور فضائية متاحة
          </div>
        ) : (
          scenes.map(s => {
            const isActive = s.scene_uid === activeSceneUid;
            const lbl    = parseSceneLabel(s.scene_uid, s.data_is_real);
            const sensor = parseSensorInfo(s.scene_uid, s.pixel_type);
            const dt     = classifyDataType(s.scene_uid, s.data_is_real);
            const tileId = s.tile_id ?? lbl.tileId;
            return (
              <button
                key={s.scene_uid}
                onClick={() => onSelectScene(s.scene_uid)}
                className={`w-full text-right flex flex-col gap-0 px-3 py-2.5 transition-colors group border-b border-slate-800/40 ${
                  isActive
                    ? 'bg-blue-600/15 border-r-2 border-r-blue-500'
                    : 'hover:bg-slate-800/40 border-r-2 border-r-transparent'
                }`}
              >
                {/* Row 1: sensor type badge + date */}
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${sensor.badgeClass}`}>
                    {sensor.icon} {sensor.typeAr}
                  </span>
                  <span className={`text-xs font-semibold ${isActive ? 'text-blue-300' : 'text-slate-300'}`}>
                    {lbl.dateAr}
                  </span>
                </div>

                {/* Row 2: area name + tile badge */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-sm font-bold ${isActive ? 'text-blue-200' : 'text-slate-100 group-hover:text-white'}`}>
                    {lbl.area}
                  </span>
                  {tileId && (
                    <span className="text-[10px] px-1 rounded bg-slate-700/60 text-slate-400 font-mono shrink-0">
                      {tileId}
                    </span>
                  )}
                </div>

                {/* Row 3: sensor short desc */}
                <p className="text-[10px] text-slate-500 leading-tight mb-1.5 text-right">
                  {sensor.shortDesc}
                </p>

                {/* Row 4: uses tags */}
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {sensor.usesAr.slice(0, 3).map(u => (
                    <span key={u} className="text-[9px] px-1.5 py-px rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/40">
                      {u}
                    </span>
                  ))}
                </div>

                {/* Row 5: metadata row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-600">{lbl.satellite}</span>
                  <span className="text-[10px] text-slate-600">· دقة {sensor.resolutionAr}</span>
                  {sensor.allWeather && (
                    <span className="text-[10px] text-purple-400 font-semibold">☁ يخترق الغيوم</span>
                  )}
                  <span className={`text-[10px] px-1.5 py-px rounded-sm font-bold ${dt.labelClass}`}>
                    {dt.label}
                  </span>
                  {s.online === false && (
                    <span className="text-[10px] text-amber-500">⏳ offline</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* ── Drawn area context ─────────────────────────────────── */}
      {drawnPolygon && (
        <div className="border-t border-slate-800 px-3 py-3.5 shrink-0 bg-emerald-950/20">
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin size={13} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-emerald-300">المنطقة المرسومة</span>
          </div>
          {areaLoading ? (
            <p className="text-xs text-slate-500">جاري الحساب…</p>
          ) : areaResult ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">المساحة</span>
                <span className="text-slate-200 font-bold">
                  {areaResult.area_km2 >= 1
                    ? `${areaResult.area_km2.toFixed(2)} كم²`
                    : `${(areaResult.area_m2 / 10_000).toFixed(1)} هكتار`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">المحيط</span>
                <span className="text-slate-300">{areaResult.perimeter_km.toFixed(1)} كم</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">جودة البيانات</span>
                <span className={`font-semibold ${
                  areaResult.quality.confidence === 'high'   ? 'text-emerald-400' :
                  areaResult.quality.confidence === 'medium' ? 'text-amber-400'   : 'text-slate-400'
                }`}>
                  {areaResult.quality.confidence === 'high' ? 'عالية' :
                   areaResult.quality.confidence === 'medium' ? 'متوسطة' : 'منخفضة'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">درجة التحليل</span>
                <span className="text-cyan-300 font-semibold">{areaResult.quality.analysis_score}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">اتفاق المؤشرات</span>
                <span className={`font-semibold ${
                  areaResult.quality.indicator_agreement === 'high' ? 'text-emerald-400' :
                  areaResult.quality.indicator_agreement === 'medium' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {areaResult.quality.indicator_agreement === 'high' ? 'عالٍ' :
                   areaResult.quality.indicator_agreement === 'medium' ? 'متوسط' : 'منخفض'}
                </span>
              </div>
              {/* Top light signals */}
              {areaResult.light_signals.length > 0 && (
                <div className="pt-2 mt-1 border-t border-slate-700/50 space-y-1.5">
                  {areaResult.light_signals
                    .filter(s => s.status === 'alert' || s.status === 'caution')
                    .slice(0, 3)
                    .map(sig => (
                      <div key={sig.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">{sig.label}</span>
                        <span className={`text-xs font-bold ${
                          sig.status === 'alert'   ? 'text-rose-400'   :
                          sig.status === 'caution' ? 'text-amber-400'  : 'text-slate-400'
                        }`}>
                          {sig.brief}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">لا توجد بيانات للمنطقة</p>
          )}
        </div>
      )}
    </div>
  );
}
