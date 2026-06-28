'use client';

import React from 'react';
import { MousePointer2, Settings, Download, Trash2, Edit2, Hexagon, Maximize, AlertTriangle, Play, FileUp, FileText, ChevronDown, Ruler, Type, Crosshair, Map as MapIcon, Layers, Circle, Search, X, Shield } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useProjectStore } from '@/store/projectStore';
import { useLayerStore } from '@/store/layerStore';
// ── Unified engine: drawing mode now lives in gisEngine ──────────────────────
import { useGisEngine, type DrawingMode } from '@/store/gisEngine';
import { useToast } from '@/components/ToastProvider';
import { resolveTenantContext, tenantHeaders } from '@/lib/gis/tenantContext';

export default function TopBar({ onOpenIntelligence, intelligenceOpen }: {
  onOpenIntelligence?: () => void;
  intelligenceOpen?: boolean;
}) {
  // Drawing state from unified engine
  const editingState    = useGisEngine(s => s.drawingMode);
  const setEditingState = useGisEngine(s => s.setDrawingMode);

  const {
    bufferDistance, nearbyRadius,
    setBufferDistance, setNearbyRadius,
    clearSpatialAnalysis,
  } = useWorkspaceStore();
  const baseMap = useGisEngine(s => s.basemap);
  const setBaseMap = useGisEngine(s => s.setBasemap);
  const [showBaseMapMenu, setShowBaseMapMenu] = React.useState(false);
  const [isUploadingFile, setIsUploadingFile] = React.useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = React.useState(false);
  const [showBufferInput, setShowBufferInput] = React.useState(false);
  const [showNearbyInput, setShowNearbyInput] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const activeLayerId = useLayerStore(s => s.activeLayerId);
    const { showToast } = useToast();

  
  const handleToolClick = (state: string) => {
    if (!activeProjectId && state !== 'idle') {
        showToast('اختر مشروعاً من اللوحة اليسرى أولاً', 'warning');
        window.dispatchEvent(new CustomEvent('gis:highlight-project-selector'));
      return;
    }
    setEditingState(state as DrawingMode);
  };

  const tools = [
    { icon: MousePointer2, label: 'تحديد', state: 'idle', active: editingState === 'idle' },
    { icon: Edit2, label: 'رسم خط', state: 'line', active: editingState === 'line' },
    { icon: Hexagon, label: 'رسم مساحة', state: 'polygon', active: editingState === 'polygon' },
    { icon: MapIcon, label: 'تحديد نقطة', state: 'point', active: editingState === 'point' },
    { icon: Ruler, label: 'قياس مسافة', state: 'measure-distance', active: editingState === 'measure-distance' },
    { icon: Maximize, label: 'قياس مساحة', state: 'measure-area', active: editingState === 'measure-area' },
    { icon: Crosshair, label: 'فحص إحداثيات', state: 'inspect-coordinate', active: editingState === 'inspect-coordinate' },
    { icon: Trash2, label: 'حذف', state: 'delete', active: editingState === 'delete', danger: true },
  ];

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const supportedTypes = [
      '.geojson', '.json', '.kml', '.kmz', '.shp', '.gpx', '.zip',
      '.xlsx', '.xls', '.csv', '.dxf', '.dwg'
    ];

    setIsUploadingFile(true);

    try {
      for (const file of Array.from(files)) {
        const fileExt = '.' + file.name.toLowerCase().split('.').pop();
        if (!supportedTypes.includes(fileExt)) {
          showToast(`نوع الملف غير مدعوم: ${fileExt}`, 'error');
          continue;
        }

        showToast(`⏳ جاري معالجة "${file.name}"...`, 'info');
        console.log(`🚀 Uploading: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', 'web_user');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        try {
          const response = await fetch('/api/gis/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            let errorMsg = `خطأ ${response.status}`;
            try {
              const errData = await response.json();
              errorMsg = errData.detail || errData.message || errorMsg;
            } catch {}
            showToast(`فشل رفع ${file.name}: ${errorMsg}`, 'error');
            continue;
          }

          const data = await response.json();
          console.log('✅ File parsed:', data);

          // Extract GeoJSON feature collection from response
          const geojson = data.geojson ?? (data.type === 'FeatureCollection' ? data : null);
          const featureCount: number = geojson?.features?.length ?? data.count ?? 0;

          if (geojson && geojson.type === 'FeatureCollection' && featureCount > 0) {
            // Show features on the map immediately via existing preview bridge
            window.dispatchEvent(new CustomEvent('engineering:preview-geojson', {
              detail: { featureCollection: geojson },
            }));
            showToast(`✅ "${file.name}" — ${featureCount} معلم على الخريطة`, 'success');
          } else {
            // File parsed OK but no spatial data (e.g. Excel without coordinates)
            const msg = data.message || data.summary || 'لا توجد إحداثيات في الملف';
            showToast(`⚠️ "${file.name}": ${msg}`, 'warning');
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            showToast(`انتهت مهلة رفع "${file.name}" — الملف كبير أو الاتصال بطيء`, 'error');
          } else {
            throw fetchError;
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      showToast(`خطأ في رفع الملف: ${error.message}`, 'error');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Generate Report
  const handleGenerateReport = async () => {
    if (!activeProjectId) {
      showToast('اختر مشروعاً من اللوحة اليسرى أولاً', 'warning');
      return;
    }

    setIsGeneratingReport(true);
    try {
      const tenant = resolveTenantContext();
      const response = await fetch('/api/v1/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
             ...tenantHeaders(tenant),
        },
        body: JSON.stringify({
          question: `أنشئ تقريراً فنياً شاملاً عن المشروع ${activeProjectId} يتضمن: \n- نظرة عامة عن المشروع\n- حالة التنفيذ والإنجاز\n- التحليل المالي\n- التحديات والمخاطر\n- التوصيات والخطوات القادمة`,
          module: 'gis',
          language: 'ar',
          context: {
            user_role: 'tenant_admin',
            active_mode: 'projects',
            project_id: activeProjectId,
            layer_id: activeLayerId,
            report_language: 'arabic',
            report_type: 'comprehensive'
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Report generated:', data);
        
        // Download report as markdown file
        const reportContent = data.answer || 'لم يتم توليد التقرير';
        const blob = new Blob([reportContent], { type: 'text/markdown; charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        a.download = `تقرير_فني_مشروع_${activeProjectId}_${timestamp}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
          showToast('تم توليد التقرير الفني وحفظه في مجلد التنزيلات', 'success');
      } else {
        const error = await response.text();
        console.error('❌ Report generation failed:', error);
          showToast(`فشل توليد التقرير: ${error.slice(0, 80)}`, 'error');
      }
    } catch (error) {
      console.error('❌ Report error:', error);
        showToast('حدث خطأ أثناء توليد التقرير', 'error');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // GIS UX UPDATED — grouped toolbar
  const mkToolBtn = (tool: typeof tools[number]) => {
    const Icon = tool.icon;
    const needsLayer = ['line','polygon','point','measure-distance','measure-area','inspect-coordinate'].includes(tool.state);
    const disabled = needsLayer && (!activeProjectId || !activeLayerId);
    return (
      <button
        key={tool.state}
        onClick={() => {
          if (needsLayer) {
            if (!activeProjectId) { showToast('اختر مشروعاً من اللوحة اليسرى أولاً', 'warning'); window.dispatchEvent(new CustomEvent('gis:highlight-project-selector')); return; }
            if (!activeLayerId)   { showToast('اختر طبقة من المشروع أو أنشئ طبقة جديدة', 'warning'); window.dispatchEvent(new CustomEvent('gis:highlight-layer-selector')); return; }
          }
          setEditingState(tool.state as any);
        }}
        title={tool.label}
        className={`p-2 rounded-lg flex items-center justify-center transition-all ${
          tool.active
            ? tool.danger
              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
              : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
            : 'text-gray-500 hover:text-white hover:bg-gray-800 border border-transparent'
        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      >
        <Icon className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}} />
      </button>
    );
  };

  return (
    <div className="bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3 shrink-0 relative z-30 h-12 gap-2">

      {/* ══ LEFT: Tool groups — icon-only with tooltips ═══════════════════ */}
      <div className="flex items-center gap-0.5" dir="rtl">

        {/* G1 — Select */}
        {mkToolBtn(tools[0])}

        <div className="w-px h-6 bg-gray-700/60 mx-1.5" />

        {/* G2 — Draw */}
        <div className="flex gap-0.5">{[tools[3], tools[1], tools[2]].map(t => mkToolBtn(t))}</div>

        <div className="w-px h-6 bg-gray-700/60 mx-1.5" />

        {/* G3 — Measure */}
        <div className="flex gap-0.5">{[tools[4], tools[5], tools[6]].map(t => mkToolBtn(t))}</div>

        <div className="w-px h-6 bg-gray-700/60 mx-1.5" />

        {/* G4 — Delete */}
        {mkToolBtn(tools[7])}
      </div>

      {/* ══ MIDDLE: Spatial Intelligence — collapsible dropdown ════════ */}
      <div className="flex items-center gap-0.5 border-r border-l border-gray-700/40 px-3 mx-1" dir="rtl">
        <div className="flex items-center gap-0.5">

          {/* Buffer Tool */}
          <div className="relative">
            <button
              onClick={() => {
                if (!activeProjectId) { showToast('اختر مشروعاً أولاً', 'warning'); window.dispatchEvent(new CustomEvent('gis:highlight-project-selector')); return; }
                setShowBufferInput(v => !v);
                setShowNearbyInput(false);
              }}
              title="تحليل منطقة التأثير (Buffer)"
              className={`p-2 rounded-lg flex items-center justify-center transition-all border ${
                editingState === 'buffer'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                  : 'text-gray-500 hover:text-white hover:bg-gray-800 border-transparent'
              }`}
            >
              <Circle style={{width:'18px',height:'18px'}} />
            </button>
            {showBufferInput && (
              <div className="absolute top-full mt-2 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 z-50 w-52" dir="rtl">
                <p className="text-xs text-gray-400 mb-2">المسافة (متر)</p>
                <input
                  type="number"
                  value={bufferDistance}
                  onChange={e => setBufferDistance(Number(e.target.value))}
                  min={50} max={10000} step={50}
                  className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600 mb-2"
                />
                <div className="flex gap-2">
                  <button onClick={() => { setEditingState('buffer'); setShowBufferInput(false); }}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs py-1 rounded">
                    تفعيل (انقر على الخريطة)
                  </button>
                  <button onClick={() => setShowBufferInput(false)} className="text-gray-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Nearby Tool */}
          <div className="relative">
            <button
              onClick={() => {
                if (!activeProjectId) { showToast('اختر مشروعاً أولاً', 'warning'); window.dispatchEvent(new CustomEvent('gis:highlight-project-selector')); return; }
                setShowNearbyInput(v => !v);
                setShowBufferInput(false);
              }}
              title="البحث عن أصول قريبة"
              className={`p-2 rounded-lg flex items-center justify-center transition-all border ${
                editingState === 'nearby'
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                  : 'text-gray-500 hover:text-white hover:bg-gray-800 border-transparent'
              }`}
            >
              <Search style={{width:'18px',height:'18px'}} />
            </button>
            {showNearbyInput && (
              <div className="absolute top-full mt-2 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 z-50 w-52" dir="rtl">
                <p className="text-xs text-gray-400 mb-2">نطاق البحث (متر)</p>
                <input
                  type="number"
                  value={nearbyRadius}
                  onChange={e => setNearbyRadius(Number(e.target.value))}
                  min={50} max={10000} step={50}
                  className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600 mb-2"
                />
                <div className="flex gap-2">
                  <button onClick={() => { setEditingState('nearby'); setShowNearbyInput(false); }}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs py-1 rounded">
                    تفعيل (انقر على الخريطة)
                  </button>
                  <button onClick={() => setShowNearbyInput(false)} className="text-gray-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Intersect */}
          <button
            onClick={() => { if (!activeProjectId) { showToast('اختر مشروعاً أولاً', 'warning'); window.dispatchEvent(new CustomEvent('gis:highlight-project-selector')); return; } setEditingState('intersect' as any); }}
            title="استعلام تقاطع (ارسم مضلعاً)"
            className={`p-2 rounded-lg flex items-center justify-center transition-all border ${
              editingState === 'intersect'
                ? 'bg-violet-500/20 text-violet-400 border-violet-500/50'
                : 'text-gray-500 hover:text-white hover:bg-gray-800 border-transparent'
            }`}
          >
            <Hexagon style={{width:'18px',height:'18px'}} />
          </button>

          {/* Clear */}
          <button
            onClick={() => {
              clearSpatialAnalysis();
              if (['buffer', 'nearby', 'intersect'].includes(editingState)) setEditingState('idle');
            }}
            title="مسح نتائج التحليل المكاني"
            className="p-2 rounded-lg flex items-center justify-center transition-all border border-transparent text-gray-600 hover:text-red-400 hover:bg-red-900/20"
          >
            <X style={{width:'18px',height:'18px'}} />
          </button>
        </div>
      </div>

      {/* ══ RIGHT: Action Buttons ════════════════════════════════════════════ */}
      <div className="flex items-center gap-1.5" dir="rtl">
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json,.kml,.kmz,.shp,.gpx,.zip,.xlsx,.xls,.csv,.dxf,.dwg"
          onChange={handleFileUpload}
          className="hidden"
          multiple
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingFile}
          title={isUploadingFile ? 'جاري المعالجة...' : 'رفع ملف (GeoJSON, KML, Excel, CSV, DXF, DWG)'}
          className={`p-2 rounded-lg flex items-center justify-center transition-colors border ${
            isUploadingFile
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 cursor-wait'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
          }`}
        >
          <FileUp className={`w-4 h-4 ${isUploadingFile ? 'animate-bounce' : ''}`} />
        </button>

        <button
          onClick={handleGenerateReport}
          disabled={isGeneratingReport || !activeProjectId}
          title={isGeneratingReport ? 'جاري التوليد...' : 'توليد تقرير فني شامل بالذكاء الاصطناعي'}
          className="p-2 rounded-lg flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileText className={`w-4 h-4 ${isGeneratingReport ? 'animate-pulse' : ''}`} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowBaseMapMenu(!showBaseMapMenu)}
            title="تغيير طبقة الخريطة الأساسية"
            className="p-2 rounded-lg flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition relative"
          >
            <Layers className="w-4 h-4" />
            <ChevronDown className="w-2.5 h-2.5 absolute bottom-1 left-1 opacity-50" />
          </button>
          {showBaseMapMenu && (
            <div className="absolute top-full mt-2 left-0 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
              <div className="px-4 py-2 border-b border-gray-700 text-[11px] text-gray-500 uppercase tracking-wider">طبقة الخريطة الأساسية</div>
              <button onClick={() => { setBaseMap('satellite'); setShowBaseMapMenu(false); }} className={`w-full text-right px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-2 ${baseMap === 'satellite' ? 'text-indigo-400 bg-gray-700/50' : 'text-gray-200'}`}>
                <span>🛰️</span><span>قمر صناعي — Satellite</span>{baseMap === 'satellite' && <span className="mr-auto text-xs text-indigo-400">✓</span>}
              </button>
              <button onClick={() => { setBaseMap('road');      setShowBaseMapMenu(false); }} className={`w-full text-right px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-2 ${baseMap === 'road'      ? 'text-indigo-400 bg-gray-700/50' : 'text-gray-200'}`}>
                <span>🗺️</span><span>شوارع — Streets (OSM)</span>{baseMap === 'road' && <span className="mr-auto text-xs text-indigo-400">✓</span>}
              </button>
              <button onClick={() => { setBaseMap('light');     setShowBaseMapMenu(false); }} className={`w-full text-right px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-2 ${baseMap === 'light'     ? 'text-indigo-400 bg-gray-700/50' : 'text-gray-200'}`}>
                <span>☀️</span><span>فاتحة — Light (Positron)</span>{baseMap === 'light' && <span className="mr-auto text-xs text-indigo-400">✓</span>}
              </button>
              <button onClick={() => { setBaseMap('terrain');   setShowBaseMapMenu(false); }} className={`w-full text-right px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-2 ${baseMap === 'terrain'   ? 'text-indigo-400 bg-gray-700/50' : 'text-gray-200'}`}>
                <span>🌿</span><span>تضاريس — Terrain</span>{baseMap === 'terrain' && <span className="mr-auto text-xs text-indigo-400">✓</span>}
              </button>
              <button onClick={() => { setBaseMap('dark');      setShowBaseMapMenu(false); }} className={`w-full text-right px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-2 ${baseMap === 'dark'      ? 'text-indigo-400 bg-gray-700/50' : 'text-gray-200'}`}>
                <span>🌑</span><span>داكنة — Dark Matter</span>{baseMap === 'dark' && <span className="mr-auto text-xs text-indigo-400">✓</span>}
              </button>
            </div>
          )}
        </div>

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
