'use client';
/**
 * EngineeringPen — قلم الإدارة الهندسية
 * ══════════════════════════════════════════════════════════
 * أدوات الرسم (نقطة / خط / مضلع) حصراً للإدارة الهندسية.
 * يحفظ كل رسم في engineering_backbone_layer عبر API.
 * يعرض لوحة الطبقات السيادية بجوار أدوات الرسم.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Pencil, MapPin, Minus, Pentagon, Trash2, Check, X,
  Layers, ChevronDown, ChevronUp, Lock, Globe, Eye, EyeOff
} from 'lucide-react';
import { useGisEngine, type DrawingMode } from '@/store/gisEngine';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SovereignLayer {
  id: string;
  name: string;
  layer_dept_type: string;
  owner_department: string;
  visibility_scope: string;
  is_base_layer: boolean;
  can_edit: boolean;
  geometry_type: string;
  description?: string;
}

interface EngineeringPenProps {
  /** The department of the logged-in user — pen only active for 'engineering' */
  userDepartment?: string;
  className?: string;
}

// ── Sovereign layer colours ───────────────────────────────────────────────────
const DEPT_COLORS: Record<string, string> = {
  engineering_backbone: '#06b6d4',
  engineering:          '#3b82f6',
  electrical:           '#f59e0b',
  hr:                   '#8b5cf6',
  finance:              '#10b981',
  maintenance:          '#f97316',
  executive:            '#e11d48',
  logistics:            '#22d3ee',
  general:              '#94a3b8',
};

const TENANT =
  typeof window !== 'undefined'
    ? (localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '')
    : '';

// ── Main component ────────────────────────────────────────────────────────────
export default function EngineeringPen({
  userDepartment = 'engineering',
  className = '',
}: EngineeringPenProps) {
  const drawingMode    = useGisEngine(s => s.drawingMode);
  const setDrawingMode = useGisEngine(s => s.setDrawingMode);
  const drawnFeatures  = useGisEngine(s => s.drawnFeatures);
  const clearDrawn     = useGisEngine(s => s.clearDrawnFeatures);

  const [layerPanelOpen,  setLayerPanelOpen]  = useState(false);
  const [sovereignLayers, setSovereignLayers] = useState<SovereignLayer[]>([]);
  const [layersLoading,   setLayersLoading]   = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [savedCount,      setSavedCount]      = useState(0);
  const [featureName,     setFeatureName]     = useState('');
  const [showSaveDialog,  setShowSaveDialog]  = useState(false);

  const isEngineer = userDepartment === 'engineering';

  // ── Load sovereign layers for display ────────────────────────────────────
  const loadLayers = useCallback(async () => {
    setLayersLoading(true);
    try {
      const res = await fetch(
        `/api/v1/map/sovereign-layers?tenant_id=${TENANT}&requesting_dept=${userDepartment}`,
        { headers: { 'X-Tenant-ID': TENANT } }
      );
      if (res.ok) {
        const data = await res.json();
        setSovereignLayers(data.layers ?? []);
      }
    } catch { /* silent */ }
    setLayersLoading(false);
  }, [userDepartment]);

  useEffect(() => { loadLayers(); }, [loadLayers]);

  // ── Drawing tools ─────────────────────────────────────────────────────────
  const tools: { mode: DrawingMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'point',   icon: <MapPin   size={16} />, label: 'نقطة' },
    { mode: 'line',    icon: <Minus    size={16} />, label: 'خط' },
    { mode: 'polygon', icon: <Pentagon size={16} />, label: 'مضلع' },
  ];

  const activeTool = tools.find(t => t.mode === drawingMode);

  const handleToolClick = (mode: DrawingMode) => {
    if (!isEngineer) return;
    setDrawingMode(drawingMode === mode ? 'idle' : mode);
  };

  const handleCancel = () => {
    setDrawingMode('idle');
    setShowSaveDialog(false);
    setFeatureName('');
  };

  const handleSave = async () => {
    if (!drawnFeatures.length) return;
    if (!featureName.trim()) { setShowSaveDialog(true); return; }

    setSaving(true);
    let ok = 0;
    for (const feat of drawnFeatures) {
      const geom = (feat.geojson as any)?.geometry ?? feat.geojson;
      const geomType = geom?.type?.toLowerCase?.() ?? feat.type;
      try {
        const res = await fetch(`/api/v1/map/features?tenant_id=${TENANT}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT },
          body: JSON.stringify({
            name:         featureName.trim(),
            feature_type: geomType,
            geometry:     geom,
            category:     'engineering_backbone',
            department:   'engineering',
            color:        DEPT_COLORS.engineering_backbone,
            created_by:   userDepartment,
            properties: { saved_via: 'engineering_pen', layer_dept_type: 'engineering_backbone' },
          }),
        });
        if (res.ok) ok += 1;
      } catch { /* silent */ }
    }
    setSaving(false);
    if (ok > 0) {
      setSavedCount(c => c + ok);
      clearDrawn();
      setDrawingMode('idle');
      setFeatureName('');
      setShowSaveDialog(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col gap-1 ${className}`} dir="rtl">

      {/* ── Drawing toolbar ── */}
      <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl px-2 py-1.5 shadow-xl">
        {/* Pen icon label */}
        <div className="flex items-center gap-1.5 px-2 border-l border-slate-700 ml-1">
          <Pencil size={14} className="text-cyan-400" />
          <span className="text-[11px] text-cyan-300 font-semibold whitespace-nowrap">القلم الهندسي</span>
        </div>

        {/* Drawing tools — only enabled for engineering dept */}
        {tools.map(tool => (
          <button
            key={tool.mode}
            onClick={() => handleToolClick(tool.mode)}
            disabled={!isEngineer}
            title={isEngineer ? tool.label : 'متاح للإدارة الهندسية فقط'}
            className={`
              flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium
              transition-all duration-150
              ${drawingMode === tool.mode
                ? 'bg-cyan-500 text-white shadow-cyan-500/40 shadow-md'
                : isEngineer
                  ? 'text-slate-300 hover:bg-slate-700/80 hover:text-white'
                  : 'text-slate-600 cursor-not-allowed'}
            `}
          >
            {tool.icon}
            <span className="hidden sm:inline">{tool.label}</span>
          </button>
        ))}

        {/* Lock indicator for non-engineers */}
        {!isEngineer && (
          <div className="flex items-center gap-1 px-2 text-slate-500">
            <Lock size={12} />
            <span className="text-[10px]">هندسة فقط</span>
          </div>
        )}

        {/* Separator */}
        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Pending features count + save */}
        {drawnFeatures.length > 0 && (
          <>
            <span className="text-[11px] text-amber-300 font-medium px-1">
              {drawnFeatures.length} معلم جديد
            </span>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Check size={13} /> حفظ
            </button>
            <button
              onClick={() => { clearDrawn(); setDrawingMode('idle'); }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}

        {/* Saved counter badge */}
        {savedCount > 0 && (
          <span className="text-[10px] text-cyan-400 bg-cyan-900/40 border border-cyan-700/50 rounded-lg px-2 py-0.5">
            ✓ {savedCount} محفوظ
          </span>
        )}

        {/* Separator */}
        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Sovereign layers toggle */}
        <button
          onClick={() => { setLayerPanelOpen(v => !v); if (!layerPanelOpen) loadLayers(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] text-slate-300 hover:bg-slate-700/80 hover:text-white transition-colors"
          title="سجل الطبقات السيادية"
        >
          <Layers size={14} />
          <span className="hidden sm:inline">الطبقات</span>
          {layerPanelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* ── Save dialog ── */}
      {showSaveDialog && (
        <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-700/50 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3">
          <label className="text-[12px] text-slate-300 whitespace-nowrap">اسم المعلم:</label>
          <input
            autoFocus
            type="text"
            value={featureName}
            onChange={e => setFeatureName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            placeholder="مثال: خط أنابيب شمال"
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleSave}
            disabled={saving || !featureName.trim()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
          >
            {saving ? '...' : <><Check size={13} /> حفظ في الأساس الهندسي</>}
          </button>
          <button onClick={handleCancel} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Sovereign layers panel ── */}
      {layerPanelOpen && (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 shadow-2xl max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-slate-200">سجل الطبقات السيادية</span>
            {layersLoading && <span className="text-[10px] text-slate-400">جارٍ التحميل...</span>}
          </div>

          {sovereignLayers.length === 0 && !layersLoading && (
            <p className="text-[11px] text-slate-500 text-center py-2">لا توجد طبقات</p>
          )}

          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {sovereignLayers.map(layer => {
              const color = DEPT_COLORS[layer.layer_dept_type] ?? DEPT_COLORS.general;
              const isVisible = layer.is_base_layer ||
                layer.owner_department === userDepartment ||
                layer.visibility_scope === 'organization_wide';
              return (
                <div
                  key={layer.id}
                  className="flex items-start gap-2 p-2 rounded-xl hover:bg-slate-800/60 transition-colors"
                >
                  {/* Color indicator */}
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ring-1 ring-white/20"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-200 truncate">{layer.name}</span>
                      {layer.is_base_layer && (
                        <span className="text-[9px] bg-cyan-900/60 text-cyan-300 border border-cyan-700/40 rounded-md px-1">أساسية</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {/* Visibility scope */}
                      {layer.visibility_scope === 'organization_wide' ? (
                        <Globe size={9} className="text-emerald-400" />
                      ) : layer.visibility_scope === 'private' ? (
                        <Lock size={9} className="text-rose-400" />
                      ) : (
                        <Eye size={9} className="text-amber-400" />
                      )}
                      <span className="text-[9px] text-slate-500">{layer.owner_department}</span>
                      {layer.can_edit && isEngineer && (
                        <span className="text-[9px] text-cyan-400">• تعديل</span>
                      )}
                      {!isVisible && (
                        <span className="text-[9px] text-rose-400 flex items-center gap-0.5">
                          <EyeOff size={8} /> مقيّد
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-slate-500">
            أنت في قسم: <span className="text-slate-300">{userDepartment}</span>
            {!isEngineer && (
              <span className="block text-amber-400 mt-0.5">
                أدوات الرسم متاحة للإدارة الهندسية فقط في هذه المرحلة
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
