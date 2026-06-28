'use client';
/**
 * GisLayerManager — مدير الطبقات الموحد
 * ══════════════════════════════════════════════════════════════
 * شجرة طبقات كاملة متصلة بـ gisEngine.
 * تجمّع الطبقات حسب الفئة: ERP، فضائي، بنية تحتية، إداري.
 */

import React from 'react';
import { Eye, EyeOff, Layers, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useGisEngine, LAYER_REGISTRY, type LayerId, type LayerCategory } from '@/store/gisEngine';

const CATEGORY_LABELS: Record<LayerCategory, string> = {
  erp:            'بيانات ERP',
  satellite:      'صور فضائية',
  infrastructure: 'البنية التحتية',
  admin:          'الحدود الإدارية',
};

const CATEGORY_ORDER: LayerCategory[] = ['erp', 'satellite', 'infrastructure', 'admin'];

function CategoryGroup({ category, children }: { category: LayerCategory; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="font-medium uppercase tracking-wider">{CATEGORY_LABELS[category]}</span>
      </button>
      {open && <div className="pl-3">{children}</div>}
    </div>
  );
}

function LayerRow({ layerId }: { layerId: LayerId }) {
  const def        = LAYER_REGISTRY.find(l => l.id === layerId);
  const visible    = useGisEngine(s => s.layerVisibility[layerId]);
  const opacity    = useGisEngine(s => s.layerOpacity[layerId]);
  const toggleLayer = useGisEngine(s => s.toggleLayer);
  const setOpacity  = useGisEngine(s => s.setLayerOpacity);
  const workspace   = useGisEngine(s => s.workspace);

  if (!def) return null;

  // Grey out layers not available for this workspace
  const available = def.minWorkspace.includes(workspace);

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800/60 transition-colors ${!available ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Colour swatch */}
      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: def.color }} />

      {/* Label */}
      <span className="flex-1 text-xs text-slate-300 truncate">{def.labelAr}</span>

      {/* Opacity slider — only show when visible */}
      {visible && (
        <input
          type="range"
          min={0} max={1} step={0.05}
          value={opacity}
          onChange={e => setOpacity(layerId, parseFloat(e.target.value))}
          className="w-14 h-1 accent-blue-500"
          title={`شفافية: ${Math.round(opacity * 100)}%`}
        />
      )}

      {/* Toggle */}
      <button
        onClick={() => toggleLayer(layerId)}
        className={`flex-shrink-0 transition-colors ${visible ? 'text-blue-400' : 'text-slate-600'}`}
        title={visible ? 'إخفاء الطبقة' : 'إظهار الطبقة'}
      >
        {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export default function GisLayerManager() {
  const violations      = useGisEngine(s => s.violations);
  const violationPanel  = useGisEngine(s => s.violationPanelOpen);
  const toggleViolation = useGisEngine(s => s.toggleViolationPanel);
  const workspace       = useGisEngine(s => s.workspace);

  const grouped = React.useMemo(() => {
    const map: Record<LayerCategory, LayerId[]> = { erp: [], satellite: [], infrastructure: [], admin: [] };
    LAYER_REGISTRY.forEach(l => map[l.category].push(l.id));
    return map;
  }, []);

  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warnCount  = violations.filter(v => v.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full bg-slate-900/95 border-r border-slate-800 w-56 text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
        <Layers className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-200">الطبقات</span>
      </div>

      {/* ERP Binding Violations badge */}
      {violations.length > 0 && (
        <button
          onClick={toggleViolation}
          className="mx-2 mt-2 flex items-center gap-2 px-2 py-1.5 rounded border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20 transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {errorCount > 0 && <span className="text-red-400 font-bold">{errorCount} خطأ </span>}
            {warnCount  > 0 && <span>{warnCount} تحذير</span>}
            {' — ربط ERP-GIS'}
          </span>
        </button>
      )}

      {/* Layer groups */}
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5">
        {CATEGORY_ORDER.map(cat => (
          <CategoryGroup key={cat} category={cat}>
            {grouped[cat].map(id => <LayerRow key={id} layerId={id} />)}
          </CategoryGroup>
        ))}
      </div>
    </div>
  );
}
