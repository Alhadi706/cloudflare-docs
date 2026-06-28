'use client';
/**
 * AssetTopBar — شريط أدوات نظام الأصول المكانية
 * ══════════════════════════════════════════════════════
 * أدوات فقط:  تحديد | رسم مضلع | رسم مسار | إضافة أصل بنت | حذف
 * يمين:       رفع ملف | تبديل الخريطة | لوحة الذكاء
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  MousePointer2, Hexagon, Route, Plus, Trash2, MapPin,
  FileUp, Layers, ChevronDown, Shield, X, WandSparkles, FileImage,
} from 'lucide-react';
import { useGisEngine, type DrawingMode } from '@/store/gisEngine';
import { useToast } from '@/components/ToastProvider';
import { useUserStore } from '@/store/useUserStore';
import { getAssetCapabilities } from '@/lib/gis/assetGovernance';
import { listMunicipalities } from '@/lib/serviceLayersAPI';

type Props = {
  onAddChildAsset: () => void;   // open child-asset modal
  onOpenIntelligence?: () => void;
  intelligenceOpen?: boolean;
  onStartLayerExtractionPolygon?: () => void;
  onRunMunicipalityExtraction?: (municipalityKey: string) => void;
  onMunicipalityChange?: (municipalityKey: string) => void;
  onCancelExtractionSelection?: () => void;
  extractionBusy?: boolean;
  geoScadaTool?: 'idle' | 'path' | 'tank' | 'valve' | 'pump' | 'delete';
  onSelectGeoScadaTool?: (tool: 'idle' | 'path' | 'tank' | 'valve' | 'pump' | 'delete') => void;
  onClearGeoScada?: () => void;
};

export default function AssetTopBar({
  onAddChildAsset,
  onOpenIntelligence,
  intelligenceOpen,
  onStartLayerExtractionPolygon,
  onRunMunicipalityExtraction,
  onMunicipalityChange,
  onCancelExtractionSelection,
  extractionBusy,
  geoScadaTool = 'idle',
  onSelectGeoScadaTool,
  onClearGeoScada,
}: Props) {
  const drawingMode    = useGisEngine(s => s.drawingMode);
  const setDrawingMode = useGisEngine(s => s.setDrawingMode);
  const basemap        = useGisEngine(s => s.basemap);
  const setBasemap     = useGisEngine(s => s.setBasemap);
  const currentUser    = useUserStore(s => s.current);

  const { showToast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const digitizationInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = React.useState(false);
  const [isDigitizingFile, setIsDigitizingFile] = React.useState(false);
  const [showBaseMapMenu, setShowBaseMapMenu] = React.useState(false);
  const [showExtractionMenu, setShowExtractionMenu] = React.useState(false);
  const [showScadaMenu, setShowScadaMenu] = React.useState(false);

  // Fixed-position dropdown refs
  const extractionBtnRef = useRef<HTMLButtonElement>(null);
  const basemapBtnRef    = useRef<HTMLButtonElement>(null);
  const scadaBtnRef      = useRef<HTMLButtonElement>(null);
  const [extractionDropStyle, setExtractionDropStyle] = React.useState<React.CSSProperties>({});
  const [basemapDropStyle,    setBasemapDropStyle]    = React.useState<React.CSSProperties>({});
  const [scadaDropStyle,      setScadaDropStyle]      = React.useState<React.CSSProperties>({});

  function calcDropStyle(btnRef: React.RefObject<HTMLElement>): React.CSSProperties {
    if (!btnRef.current) return {};
    const rect = btnRef.current.getBoundingClientRect();
    return { position: 'fixed', top: rect.bottom + 4, right: window.innerWidth - rect.right, zIndex: 9999 };
  }

  React.useEffect(() => {
    if (showExtractionMenu) setExtractionDropStyle(calcDropStyle(extractionBtnRef as React.RefObject<HTMLElement>));
  }, [showExtractionMenu]);
  React.useEffect(() => {
    if (showBaseMapMenu) setBasemapDropStyle(calcDropStyle(basemapBtnRef as React.RefObject<HTMLElement>));
  }, [showBaseMapMenu]);
  React.useEffect(() => {
    if (showScadaMenu) setScadaDropStyle(calcDropStyle(scadaBtnRef as React.RefObject<HTMLElement>));
  }, [showScadaMenu]);
  const [selectedMunicipality, setSelectedMunicipality] = React.useState('tripoli');
  const [municipalities, setMunicipalities] = React.useState<Array<{ key: string; label: string }>>([
    { key: 'libya', label: 'ليبيا بالكامل' },
    { key: 'tripoli', label: 'منطقة طرابلس' },
  ]);
  const [previewMode, setPreviewMode] = React.useState<'both' | 'centerline' | 'corridor'>('both');

  const storedDepartment = typeof window !== 'undefined' ? localStorage.getItem('user_department') : null;
  const caps = getAssetCapabilities(currentUser, storedDepartment);
  const drawingAllowed = caps.canDrawSpatial;
  const uploadAllowed = caps.canUploadSpatialFiles;

  React.useEffect(() => {
    let active = true;
    listMunicipalities()
      .then((items) => {
        if (!active || !Array.isArray(items) || items.length === 0) return;
        setMunicipalities(items.map((m) => ({ key: m.key, label: m.labelAr || m.labelEn || m.key })));
      })
      .catch(() => {
        // Keep minimal fallback list on network/API errors.
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!municipalities.some((m) => m.key === selectedMunicipality)) {
      const next = municipalities[0]?.key;
      if (next) {
        setSelectedMunicipality(next);
        onMunicipalityChange?.(next);
      }
    }
  }, [municipalities, selectedMunicipality, onMunicipalityChange]);

  // ── Drawing tools ──────────────────────────────────────────────────────
  const allTools = [
    {
      icon: MousePointer2,
      label: 'تحديد / تحريك',
      mode: 'idle' as DrawingMode,
      color: 'indigo',
    },
    {
      icon: Hexagon,
      label: 'رسم مضلع (أصل رئيسي — مساحة)',
      mode: 'polygon' as DrawingMode,
      color: 'cyan',
      gisOnly: true,
    },
    {
      icon: Route,
      label: 'رسم مسار (أصل رئيسي — خط)',
      mode: 'line' as DrawingMode,
      color: 'emerald',
      gisOnly: true,
    },
    {
      icon: MapPin,
      label: 'تحديد نقطة',
      mode: 'point' as DrawingMode,
      color: 'amber',
      gisOnly: true,
    },
    {
      icon: Trash2,
      label: 'حذف',
      mode: 'delete' as DrawingMode,
      color: 'red',
      gisOnly: true,
    },
  ];
  // Show the full toolset in the workspace; capability state only affects the badge.
  const tools = allTools;

  // ── File upload ────────────────────────────────────────────────────────
  
  // Merge all GeoJSON features into a single geometry (MultiLineString, MultiPolygon, etc.)
  const mergeFeaturesToGeometry = (features: any[], fileName: string): any => {
    const geoms = features.map(f => f.geometry).filter(Boolean);
    if (geoms.length === 0) return null;
    if (geoms.length === 1) return geoms[0];

    // Collect line coordinates
    const lineCoords: number[][][] = [];
    const polyCoords: number[][][][] = [];
    const pointCoords: number[][] = [];

    for (const g of geoms) {
      if (!g) continue;
      switch (g.type) {
        case 'LineString':
          lineCoords.push(g.coordinates);
          break;
        case 'MultiLineString':
          lineCoords.push(...g.coordinates);
          break;
        case 'Polygon':
          polyCoords.push(g.coordinates);
          break;
        case 'MultiPolygon':
          polyCoords.push(...g.coordinates);
          break;
        case 'Point':
          pointCoords.push(g.coordinates);
          break;
        case 'MultiPoint':
          pointCoords.push(...g.coordinates);
          break;
      }
    }

    // Return dominant geometry type as Multi*
    if (lineCoords.length > 0 && polyCoords.length === 0) {
      return lineCoords.length === 1
        ? { type: 'LineString', coordinates: lineCoords[0] }
        : { type: 'MultiLineString', coordinates: lineCoords };
    }
    if (polyCoords.length > 0 && lineCoords.length === 0) {
      return polyCoords.length === 1
        ? { type: 'Polygon', coordinates: polyCoords[0] }
        : { type: 'MultiPolygon', coordinates: polyCoords };
    }
    // Mixed — return GeometryCollection
    return { type: 'GeometryCollection', geometries: geoms };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const supported = ['.geojson','.json','.kml','.kmz','.shp','.gpx','.zip','.xlsx','.xls','.csv','.dxf','.dwg'];
    setIsUploadingFile(true);
    try {
      for (const file of Array.from(files)) {
        const ext = '.' + file.name.toLowerCase().split('.').pop();
        if (!supported.includes(ext)) {
          showToast(`نوع الملف غير مدعوم: ${ext}`, 'error');
          continue;
        }
        showToast(`⏳ جاري معالجة "${file.name}"...`, 'info');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('user_id', 'web_user');
        const isTabular = ['.xlsx', '.xls', '.csv'].includes(ext);
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 120000);
        try {
          const res = await fetch(isTabular ? '/api/engineering/workspace/river-import' : '/api/gis/upload', {
            method: 'POST',
            body: fd,
            signal: ctrl.signal,
          });
          clearTimeout(tid);
          if (!res.ok) {
            if (res.status === 413) {
              showToast(`فشل رفع ${file.name}: حجم الملف أكبر من الحد المسموح به على الخادم (413).`, 'error');
              continue;
            }
            let msg = `خطأ ${res.status}`;
            try { const err = await res.json(); msg = err.detail || err.message || msg; } catch {}
            showToast(`فشل رفع ${file.name}: ${msg}`, 'error');
            continue;
          }
          const data = await res.json();
          const geojson = data.geojson ?? (data.type === 'FeatureCollection' ? data : null);
          const count: number = geojson?.features?.length ?? 0;
          if (geojson && count > 0) {
            // Show preview on map
            window.dispatchEvent(new CustomEvent('engineering:preview-geojson', { detail: { featureCollection: geojson } }));

            if (isTabular) {
              const typedFeatures = geojson.features.map((f: any) => ({
                geometry: f.geometry,
                properties: f.properties || {},
              }));
              const mainOnly = typedFeatures.filter((f: any) => f?.properties?.relation_type !== 'child');
              window.dispatchEvent(new CustomEvent('engineering:process-uploaded-features', {
                detail: { features: mainOnly.length > 0 ? mainOnly : typedFeatures, fileName: file.name },
              }));
              const mainCount = Number(data?.classification_summary?.main_count || 0);
              const childCount = Number(data?.classification_summary?.child_count || 0);
              showToast(`✅ "${file.name}" — ${count} نقطة، رئيسي: ${mainCount} / فرعي: ${childCount}`, 'success');
            } else {
              // Merge standard GIS datasets into one geometry (old behavior)
              const mergedGeometry = mergeFeaturesToGeometry(geojson.features, file.name);
              window.dispatchEvent(new CustomEvent('engineering:process-uploaded-features', {
                detail: {
                  features: [{ geometry: mergedGeometry, properties: { asset_name: file.name.split('.')[0] } }],
                  fileName: file.name,
                  autoCreatePrincipal: true,
                },
              }));
              showToast(`✅ "${file.name}" — ${count} معلم، سيتم تسجيله كأصل تلقائيًا`, 'success');
            }
          } else {
            showToast(`⚠️ "${file.name}": لا توجد إحداثيات في الملف`, 'warning');
          }
        } catch (fe: any) {
          clearTimeout(tid);
          if (fe.name === 'AbortError') showToast(`انتهت مهلة رفع "${file.name}"`, 'error');
          else throw fe;
        }
      }
    } catch (err: any) {
      showToast(`خطأ في رفع الملف: ${err.message}`, 'error');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDigitizationFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setIsDigitizingFile(true);
    try {
      for (const file of Array.from(files)) {
        const ext = '.' + file.name.toLowerCase().split('.').pop();
        if (!['.tif', '.tiff', '.pdf'].includes(ext)) {
          showToast(`الملف ${file.name} غير مدعوم للمحرك (فقط TIF/PDF)`, 'error');
          continue;
        }

        showToast(`⏳ رفع ${file.name} إلى محرك الرقمنة...`, 'info');
        const fd = new FormData();
        fd.append('file', file);

        const uploadRes = await fetch('/api/map-digitization/upload', {
          method: 'POST',
          body: fd,
        });

        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadData?.job_id) {
          showToast(`فشل رفع ${file.name}: ${uploadData?.message || uploadData?.error || uploadRes.status}`, 'error');
          continue;
        }

        showToast(`⚙️ بدء تحليل ${file.name}...`, 'info');
        const analyzeRes = await fetch('/api/map-digitization/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: uploadData.job_id }),
        });

        const analyzeData = await analyzeRes.json().catch(() => ({}));
        if (!analyzeRes.ok || !analyzeData?.ok) {
          const msg = analyzeData?.message || analyzeData?.error || `خطأ ${analyzeRes.status}`;
          showToast(`اكتمل الرفع لكن التحليل لم يكتمل: ${msg}`, 'warning');
          continue;
        }

        const geojson = analyzeData?.geojson;
        const count = Number(analyzeData?.feature_count || geojson?.features?.length || 0);
        const georeferenced = Boolean(analyzeData?.georeferenced ?? geojson?.features?.[0]?.properties?.georeferenced);
        if (geojson?.type === 'FeatureCollection' && Array.isArray(geojson.features) && geojson.features.length > 0) {
          if (georeferenced) {
            window.dispatchEvent(new CustomEvent('engineering:preview-geojson', { detail: { featureCollection: geojson } }));
            showToast(`✅ اكتمل تحليل ${file.name} وتم إسقاطه جغرافيًا على الخريطة (${count})`, 'success');
          } else {
            showToast(`⚠️ اكتمل استخراج ${file.name} لكن الموقع ما زال محليًا داخل الصورة ولم يُثبت جغرافيًا بعد`, 'warning');
          }
        } else {
          showToast(`تم تحليل ${file.name} لكن لم يتم العثور على مسار صالح`, 'warning');
        }
      }
    } catch (err: any) {
      showToast(`خطأ محرك الرقمنة: ${err?.message || 'غير معروف'}`, 'error');
    } finally {
      setIsDigitizingFile(false);
      if (digitizationInputRef.current) digitizationInputRef.current.value = '';
    }
  };

  const BASEMAPS = [
    { key: 'satellite', label: 'قمر صناعي', emoji: '🛰️' },
    { key: 'road',      label: 'شوارع (OSM)',  emoji: '🗺️' },
    { key: 'light',     label: 'فاتحة',        emoji: '☀️' },
    { key: 'terrain',   label: 'تضاريس',       emoji: '🌿' },
    { key: 'dark',      label: 'داكنة',        emoji: '🌑' },
  ];

  const setMapPreviewMode = (mode: 'both' | 'centerline' | 'corridor') => {
    setPreviewMode(mode);
    window.dispatchEvent(new CustomEvent('engineering:set-preview-mode', { detail: { mode } }));
  };

  return (
    <div
      className="bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3 h-12 shrink-0 relative z-30 gap-2 overflow-visible"
      dir="rtl"
    >
      {/* ══ RIGHT (RTL = visual left): Drawing tools ════════════════════ */}
      <div className="flex items-center gap-1 min-w-0 overflow-visible">
        {tools.map(({ icon: Icon, label, mode, color }) => {
          const active = drawingMode === mode;
          return (
            <button
              key={mode}
              onClick={() => {
                onSelectGeoScadaTool?.('idle');
                setDrawingMode(mode);
              }}
              title={label}
              className={`p-2 rounded-lg flex items-center justify-center transition-all border ${
                active
                  ? `bg-${color}-500/20 text-${color}-400 border-${color}-500/50`
                  : 'text-gray-500 hover:text-white hover:bg-gray-800 border-transparent'
              }`}
            >
              <Icon style={{ width: 18, height: 18 }} />
            </button>
          );
        })}

        <div className="w-px h-6 bg-gray-700/60 mx-1.5" />

        {/* Add child asset — GIS only */}
        <button
          onClick={onAddChildAsset}
          title="إضافة أصل بنت إلى أصل رئيسي"
          className="p-2 rounded-lg flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-300 hover:bg-amber-900/20 border border-transparent hover:border-amber-700/40 transition-all"
        >
          <Plus style={{ width: 16, height: 16 }} />
          <span className="hidden sm:inline text-[11px]">أصل بنت</span>
        </button>

        <div className="w-px h-6 bg-gray-700/60 mx-1.5" />

        {/* Delete — GIS only */}
        <button
          onClick={() => {
            onSelectGeoScadaTool?.('idle');
            setDrawingMode('delete' as DrawingMode);
          }}
          title="حذف معلم"
          className={`p-2 rounded-lg flex items-center justify-center transition-all border ${
            drawingMode === 'delete'
              ? 'bg-red-500/20 text-red-400 border-red-500/50'
              : 'text-gray-600 hover:text-red-400 hover:bg-red-900/20 border-transparent'
          }`}
        >
          <Trash2 style={{ width: 18, height: 18 }} />
        </button>

        {onSelectGeoScadaTool && (
          <>
            <div className="w-px h-6 bg-gray-700/60 mx-1.5" />
            <div className="relative">
              <button
                ref={scadaBtnRef}
                onClick={() => setShowScadaMenu(v => !v)}
                className={`px-2 py-1.5 rounded-lg border text-[11px] flex items-center gap-1 ${geoScadaTool !== 'idle' ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-200' : 'border-gray-700 bg-gray-800 text-fuchsia-300'}`}
                title="أدوات SCADA"
              >
                SCADA
                <ChevronDown className="w-3 h-3" />
              </button>
              {showScadaMenu && (
                <div style={scadaDropStyle} className="w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden" dir="rtl">
                  <button onClick={() => { onSelectGeoScadaTool('path'); setShowScadaMenu(false); }} className={`w-full px-3 py-2 text-right text-xs border-b border-gray-700 ${geoScadaTool === 'path' ? 'bg-cyan-500/20 text-cyan-200' : 'text-gray-200 hover:bg-gray-700'}`}>مسار</button>
                  <button onClick={() => { onSelectGeoScadaTool('tank'); setShowScadaMenu(false); }} className={`w-full px-3 py-2 text-right text-xs border-b border-gray-700 ${geoScadaTool === 'tank' ? 'bg-amber-500/20 text-amber-200' : 'text-gray-200 hover:bg-gray-700'}`}>خزان</button>
                  <button onClick={() => { onSelectGeoScadaTool('pump'); setShowScadaMenu(false); }} className={`w-full px-3 py-2 text-right text-xs border-b border-gray-700 ${geoScadaTool === 'pump' ? 'bg-emerald-500/20 text-emerald-200' : 'text-gray-200 hover:bg-gray-700'}`}>مضخة</button>
                  <button onClick={() => { onSelectGeoScadaTool('valve'); setShowScadaMenu(false); }} className={`w-full px-3 py-2 text-right text-xs border-b border-gray-700 ${geoScadaTool === 'valve' ? 'bg-rose-500/20 text-rose-200' : 'text-gray-200 hover:bg-gray-700'}`}>صمام</button>
                  <button onClick={() => { onSelectGeoScadaTool('delete'); setShowScadaMenu(false); }} className={`w-full px-3 py-2 text-right text-xs border-b border-gray-700 ${geoScadaTool === 'delete' ? 'bg-red-500/20 text-red-200' : 'text-gray-200 hover:bg-gray-700'}`}>حذف</button>
                  <button onClick={() => { onClearGeoScada?.(); setShowScadaMenu(false); }} className="w-full px-3 py-2 text-right text-xs text-gray-200 hover:bg-gray-700">مسح الكل</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Read-only badge for non-GIS */}
        {!drawingAllowed && (
          <span className="px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-400 text-[10px] border border-gray-700">عرض فقط</span>
        )}
      </div>

      {/* Drawing mode badge */}
      {drawingMode !== 'idle' && (
        <div className="hidden xl:flex items-center gap-2 px-2 py-1 rounded-full bg-cyan-900/40 border border-cyan-700/40 text-cyan-300 text-[11px]">
          <span>{{
            polygon: '📐 ارسم مضلع الأصل — انقر لوضع النقاط، انقر مزدوج للإنهاء',
            line:    '📏 ارسم مسار الأصل — انقر لوضع النقاط، انقر مزدوج للإنهاء',
            trace:   '🧲 تتبع مغناطيسي للمسار — اتبع الخطوط القريبة تلقائيًا',
            delete:  '🗑 انقر على معلم لحذفه',
          }[drawingMode as string] ?? drawingMode}
          </span>
          <button onClick={() => setDrawingMode('idle')} className="hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ══ LEFT (RTL = visual right): File + Basemap + Intelligence ═══ */}
      <div className="flex items-center gap-1.5 min-w-0 overflow-visible">
        {/* File upload — GIS only */}
        {uploadAllowed && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".geojson,.json,.kml,.kmz,.shp,.gpx,.zip,.xlsx,.xls,.csv,.dxf,.dwg"
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingFile}
              title="رفع ملف (GeoJSON, KML, Excel, CSV, DXF, DWG)"
              className={`p-2 rounded-lg flex items-center justify-center transition-colors border ${
                isUploadingFile
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 cursor-wait'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
              }`}
            >
              <FileUp className={`w-4 h-4 ${isUploadingFile ? 'animate-bounce' : ''}`} />
            </button>

            <input
              ref={digitizationInputRef}
              type="file"
              accept=".tif,.tiff,.pdf"
              onChange={handleDigitizationFileChange}
              className="hidden"
              multiple
            />
            <button
              onClick={() => digitizationInputRef.current?.click()}
              disabled={isDigitizingFile}
              title="محرك رقمنة الخرائط (TIF/PDF)"
              className={`p-2 rounded-lg flex items-center justify-center transition-colors border ${
                isDigitizingFile
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 cursor-wait'
                  : 'bg-gray-800 hover:bg-gray-700 text-emerald-300 border-gray-700'
              }`}
            >
              <FileImage className={`w-4 h-4 ${isDigitizingFile ? 'animate-pulse' : ''}`} />
            </button>

            <div className="flex items-center rounded-lg border border-gray-700 overflow-hidden">
              <button
                onClick={() => setMapPreviewMode('both')}
                title="عرض الخط والحرم"
                className={`px-2 py-1 text-[10px] transition-colors ${previewMode === 'both' ? 'bg-cyan-600/30 text-cyan-200' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                الكل
              </button>
              <button
                onClick={() => setMapPreviewMode('centerline')}
                title="عرض الخط فقط"
                className={`px-2 py-1 text-[10px] transition-colors border-r border-gray-700 ${previewMode === 'centerline' ? 'bg-cyan-600/30 text-cyan-200' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                الخط
              </button>
              <button
                onClick={() => setMapPreviewMode('corridor')}
                title="عرض الحرم فقط"
                className={`px-2 py-1 text-[10px] transition-colors border-r border-gray-700 ${previewMode === 'corridor' ? 'bg-cyan-600/30 text-cyan-200' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                الحرم
              </button>
            </div>
          </>
        )}


        {/* Layer decomposition tool: single button + dropdown */}
        <div className="relative">
          <button
            ref={extractionBtnRef}
            onClick={() => setShowExtractionMenu(v => !v)}
            title="محلل الطبقات"
            className={`p-2 rounded-lg flex items-center justify-center border transition relative ${showExtractionMenu ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'}`}
          >
            <WandSparkles className="w-4 h-4" />
            <ChevronDown className="w-2.5 h-2.5 absolute bottom-1 left-1 opacity-60" />
          </button>
          {showExtractionMenu && (
            <div style={extractionDropStyle} className="w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden" dir="rtl">
              <div className="px-3 py-2 border-b border-gray-700 text-xs text-cyan-300 font-semibold">تفكيك الخريطة إلى طبقات</div>
              <div className="p-3 space-y-3">
                <button
                  onClick={() => {
                    setShowExtractionMenu(false);
                    onStartLayerExtractionPolygon?.();
                  }}
                  disabled={!!extractionBusy}
                  className="w-full py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 text-sm hover:bg-cyan-600/30 disabled:opacity-40"
                >
                  رسم مضلع للتفكيك
                </button>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">أو اختر من المناطق</label>
                  <select
                    value={selectedMunicipality}
                    onChange={(e) => {
                      const nextMunicipality = e.target.value;
                      setSelectedMunicipality(nextMunicipality);
                      onMunicipalityChange?.(nextMunicipality);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-100"
                  >
                    {municipalities.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      setShowExtractionMenu(false);
                      onRunMunicipalityExtraction?.(selectedMunicipality);
                    }}
                    disabled={!!extractionBusy}
                    className="w-full py-2 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 text-sm hover:bg-indigo-600/30 disabled:opacity-40"
                  >
                    {extractionBusy ? 'جاري التفكيك...' : 'تفكيك المنطقة'}
                  </button>
                  <button
                    onClick={() => {
                      setShowExtractionMenu(false);
                      onCancelExtractionSelection?.();
                    }}
                    className="w-full py-2 rounded-lg bg-gray-700/50 border border-gray-600 text-gray-200 text-sm hover:bg-gray-700"
                  >
                    إلغاء تحديد المنطقة
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Basemap */}
        <div className="relative">
          <button
            ref={basemapBtnRef}
            onClick={() => setShowBaseMapMenu(v => !v)}
            title="تغيير طبقة الخريطة الأساسية"
            className="p-2 rounded-lg flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition relative"
          >
            <Layers className="w-4 h-4" />
            <ChevronDown className="w-2.5 h-2.5 absolute bottom-1 left-1 opacity-50" />
          </button>
          {showBaseMapMenu && (
            <div style={basemapDropStyle} className="w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden" dir="rtl">
              <div className="px-3 py-1.5 border-b border-gray-700 text-[10px] text-gray-500 uppercase tracking-wider">طبقة الخريطة</div>
              {BASEMAPS.map(bm => (
                <button
                  key={bm.key}
                  onClick={() => { setBasemap(bm.key as any); setShowBaseMapMenu(false); }}
                  className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-700 flex items-center gap-2 ${basemap === bm.key ? 'text-indigo-400 bg-gray-700/50' : 'text-gray-200'}`}
                >
                  <span>{bm.emoji}</span>
                  <span>{bm.label}</span>
                  {basemap === bm.key && <span className="mr-auto text-xs text-indigo-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Intelligence toggle */}
        <button
          onClick={onOpenIntelligence}
          title="مركز الذكاء التشغيلي"
          className={`p-2 rounded-lg flex items-center justify-center transition-all border ${
            intelligenceOpen
              ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
          }`}
        >
          <Shield className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
